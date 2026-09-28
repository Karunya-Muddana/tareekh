"""The knowledge graph: every retained note, order sheet and document, the cases, courts and people they
belong to, and how they relate. Also the search behind it: fuzzy keywords plus search by meaning.

Nodes
  e:<entry id>   a note / order sheet / document (the thing a lawyer opens and reads)
  c:<case id>    a case;  j:<judge>, o:<opposing counsel>, k:<client>
  m:<memory id>  something remembered from a chat
Links
  case      entry -> its case
  entity    case -> judge / opposing counsel / client
  temporal  consecutive entries of the same case
  semantic  entries that talk about the same things (local TF-IDF, top neighbours)
  memory    chat memory -> its case
"""
import heapq
import json
import logging
import math
import re
import threading
import time
from collections import Counter
from pathlib import Path

from urllib.parse import quote

from rapidfuzz import fuzz, process

from . import db, memory

log = logging.getLogger("tareekh.graph")

WORD = re.compile(r"[a-z0-9][a-z0-9./-]*[a-z0-9]|[a-z0-9]", re.I)
STOP = set("""a an and are as at be been but by for from had has have he her his i if in into is it its of on or our
our she so than that the their them then there these they this to was we were which who will with would not no yes
sir mr mrs ms dt did do does done also only very""".split())

DOC_KIND = {"order_sheet": "order_sheet", "document": "document"}  # everything else is a note


def _tokens(text: str) -> list[str]:
    return [w.lower() for w in WORD.findall(text or "") if len(w) > 1 and w.lower() not in STOP]


# ------------------------------------------------------------------ building the graph
_cache: dict = {"key": None, "at": 0.0, "graph": None, "index": None}
_lock = threading.Lock()
_version = 0  # bumped by invalidate(): edits that don't change counts (a case fixed in review, a text edit)


def invalidate() -> None:
    """Call after anything that changes entries or chat memories; the next build() starts fresh."""
    global _version
    with _lock:
        _version += 1


def _entries() -> list[dict]:
    return db.rows("""SELECT e.id, e.upload_id, e.source_file, e.case_id, e.hearing_date, e.author, e.doc_type, e.text
                      FROM entries e WHERE e.status IN ('retained', 'confirmed')
                      ORDER BY e.case_id, e.hearing_date""")


def _tfidf(docs: dict[str, list[str]]) -> tuple[dict[str, dict[str, float]], dict[str, float]]:
    n = max(len(docs), 1)
    df = Counter(t for toks in docs.values() for t in set(toks))
    idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
    vecs = {}
    for k, toks in docs.items():
        tf = Counter(toks)
        v = {t: (1 + math.log(c)) * idf[t] for t, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs[k] = {t: x / norm for t, x in v.items()}
    return vecs, idf


def _nearest_pairs(vecs: dict[str, dict[str, float]], k: int = 2):
    """Each document's k most similar others, via an inverted index: only documents that share a term are ever
    compared, and nlargest avoids sorting every candidate. Yields (a, b, cosine)."""
    postings: dict[str, list[tuple[str, float]]] = {}
    for doc, v in vecs.items():
        for t, w in v.items():
            postings.setdefault(t, []).append((doc, w))
    for a, va in vecs.items():
        scores: dict[str, float] = {}
        for t, w in va.items():
            for b, wb in postings[t]:
                if b != a:
                    scores[b] = scores.get(b, 0.0) + w * wb
        for b, s in heapq.nlargest(k, scores.items(), key=lambda kv: kv[1]):
            yield a, b, s


def _cos(a: dict[str, float], b: dict[str, float]) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(t, 0.0) for t, x in a.items())


def build() -> dict:
    """Cached until the set of entries or chat memories changes."""
    key = db.row("""SELECT (SELECT count(*) FROM entries WHERE status IN ('retained','confirmed')) AS e,
                           (SELECT count(*) FROM chat_memories) AS m,
                           (SELECT max(id) FROM entries) AS last""")
    key = (key["e"], key["m"], key["last"], _version) if key else None
    with _lock:
        if _cache["graph"] is not None and _cache["key"] == key:
            return _cache["graph"]

    entries = _entries()
    cases = {c["id"]: c for c in db.rows("""SELECT c.id, c.short_name, c.case_number, c.judge_id, c.opposing_counsel_id,
                                                   c.client_id, j.name AS judge, o.name AS counsel, k.name AS client
                                            FROM cases c LEFT JOIN judges j ON j.id=c.judge_id
                                            LEFT JOIN counsel o ON o.id=c.opposing_counsel_id
                                            LEFT JOIN clients k ON k.id=c.client_id""")}
    mems = db.rows("SELECT id, case_id, text, kind, created_at FROM chat_memories")

    nodes, links = [], []
    for c in cases.values():
        nodes.append({"id": f"c:{c['id']}", "type": "case", "label": c["short_name"], "sub": c["case_number"]})
        for prefix, ref, name, kind in (("j", c["judge_id"], c["judge"], "judge"), ("o", c["opposing_counsel_id"], c["counsel"], "counsel"),
                                        ("k", c["client_id"], c["client"], "client")):
            if ref and name:
                nid = f"{prefix}:{ref}"
                if not any(n["id"] == nid for n in nodes):
                    nodes.append({"id": nid, "type": kind, "label": name})
                links.append({"source": f"c:{c['id']}", "target": nid, "type": "entity"})

    prev_by_case: dict[str, str] = {}
    for e in entries:
        nid = f"e:{e['id']}"
        text = (e["text"] or "").strip()
        nodes.append({"id": nid, "type": DOC_KIND.get(e["doc_type"], "note"), "label": text[:70], "case_id": e["case_id"],
                      "date": e["hearing_date"], "author": e["author"], "file": e["source_file"]})
        if e["case_id"] in cases:
            links.append({"source": nid, "target": f"c:{e['case_id']}", "type": "case"})
            if e["case_id"] in prev_by_case:
                links.append({"source": prev_by_case[e["case_id"]], "target": nid, "type": "temporal"})
            prev_by_case[e["case_id"]] = nid

    for m in mems:
        nid = f"m:{m['id']}"
        nodes.append({"id": nid, "type": "memory", "label": m["text"][:70], "case_id": m["case_id"], "date": (m["created_at"] or "")[:10],
                      "kind": m["kind"]})
        if m["case_id"] in cases:
            links.append({"source": nid, "target": f"c:{m['case_id']}", "type": "memory"})

    # Semantic links: each entry to its two closest others (across cases too), when genuinely similar.
    docs = {f"e:{e['id']}": _tokens(e["text"]) for e in entries}
    docs.update({f"m:{m['id']}": _tokens(m["text"]) for m in mems})
    vecs, idf = _tfidf(docs)
    seen = set()
    for a, b, s in _nearest_pairs(vecs, k=2):
        pair = tuple(sorted((a, b)))
        if s >= 0.18 and pair not in seen:
            seen.add(pair)
            links.append({"source": a, "target": b, "type": "semantic", "weight": round(s, 3)})

    graph = {"nodes": nodes, "links": links, "counts": {"notes": len(entries), "memories": len(mems), "cases": len(cases)}}
    with _lock:
        _cache.update(key=key, at=time.time(), graph=graph, index={"vecs": vecs, "idf": idf, "docs": docs,
                                                                   "entries": {f"e:{e['id']}": e for e in entries},
                                                                   "mems": {f"m:{m['id']}": m for m in mems},
                                                                   "cases": cases})
    return graph


def _index() -> dict:
    build()
    return _cache["index"]


# ------------------------------------------------------------------ search
def _keyword_scores(q: str, idx: dict) -> dict[str, tuple[float, list[str]]]:
    """Fuzzy: every query word may match a word in the note with small typos ("seabreze", "adjurnment")."""
    qtoks = _tokens(q)
    if not qtoks:
        return {}
    out = {}
    phrase = q.strip().lower()
    for nid, toks in idx["docs"].items():
        vocab = set(toks)
        if not vocab:
            continue
        hits, score = [], 0.0
        for qt in qtoks:
            if qt in vocab:
                score += 1.0
                hits.append(qt)
                continue
            best = process.extractOne(qt, vocab, scorer=fuzz.ratio, score_cutoff=80 if len(qt) > 4 else 90)
            if best:
                score += best[1] / 100 * 0.85
                hits.append(best[0])
            elif len(qt) >= 4 and any(v.startswith(qt) for v in vocab):
                score += 0.7
                hits.append(qt)
        if not hits:
            continue
        coverage = score / len(qtoks)
        text = _node_text(nid, idx).lower()
        if len(phrase) > 3 and phrase in text:
            coverage += 0.5
        # Case names and numbers count too: "seabreeze" finds everything filed under the Seabreeze cases.
        out[nid] = (min(coverage, 1.5), hits)
    for cid, c in idx["cases"].items():
        name = f"{c['short_name']} {c['case_number']}".lower()
        if fuzz.partial_ratio(phrase, name) >= 85 and len(phrase) >= 3:
            for nid, e in idx["entries"].items():
                if e["case_id"] == cid and nid not in out:
                    out[nid] = (0.55, [])
    return out


def _node_text(nid: str, idx: dict) -> str:
    if nid in idx["entries"]:
        return idx["entries"][nid]["text"] or ""
    if nid in idx["mems"]:
        return idx["mems"][nid]["text"] or ""
    return ""


def _semantic_scores(q: str, idx: dict) -> tuple[dict[str, float], str]:
    """By meaning, from Hindsight's recall; mapped back to our entries. Falls back to local similarity offline."""
    try:
        results = memory.recall(q, max_tokens=4000, budget="low")
        by_doc: dict[tuple, list[str]] = {}
        for nid, e in idx["entries"].items():
            by_doc.setdefault((e["upload_id"], e["case_id"], e["hearing_date"]), []).append(nid)
        scores: dict[str, float] = {}
        for rank, r in enumerate(results):
            md = r.get("metadata") or {}
            doc = r.get("document_id") or ""
            parts = doc.split(":")
            keys = []
            if len(parts) == 3:
                keys.append(tuple(parts))
            if md.get("upload_id"):
                keys.append((md.get("upload_id"), md.get("case_id"), md.get("hearing_date")))
            for k in keys:
                for nid in by_doc.get(k, []):
                    scores[nid] = max(scores.get(nid, 0.0), 1.0 - rank / max(len(results), 1) * 0.6)
        if scores:
            return scores, "memory"
    except Exception as ex:  # noqa: BLE001 - search must still work when memory is unreachable
        log.info("semantic recall unavailable, using local similarity: %s", ex)
    tf = Counter(t for t in _tokens(q) if t in idx["idf"])
    qvec = {t: (1 + math.log(c)) * idx["idf"][t] for t, c in tf.items()}
    norm = math.sqrt(sum(x * x for x in qvec.values())) or 1.0
    qvec = {t: x / norm for t, x in qvec.items()}
    sims = {nid: _cos(qvec, idx["vecs"][nid]) for nid in idx["vecs"]}
    return {nid: min(s * 2.2, 1.0) for nid, s in sims.items() if s >= 0.06}, "local"


def search(q: str, mode: str = "both", limit: int = 40) -> dict:
    q = (q or "").strip()
    if not q:
        return {"query": q, "results": [], "semantic_source": None}
    idx = _index()
    kw = _keyword_scores(q, idx) if mode in ("both", "keyword") else {}
    sem, source = _semantic_scores(q, idx) if mode in ("both", "semantic") else ({}, None)
    combined = {}
    for nid in set(kw) | set(sem):
        k = kw.get(nid, (0.0, []))
        s = sem.get(nid, 0.0)
        score = max(k[0], s) + 0.35 * min(k[0], s)   # found both ways ranks highest
        combined[nid] = {"id": nid, "score": round(score, 3), "keyword": round(k[0], 3), "semantic": round(s, 3),
                         "terms": sorted(set(k[1]))}
    ranked = sorted(combined.values(), key=lambda r: r["score"], reverse=True)
    if ranked:  # keep what is plausibly relevant: relative to the best hit, and never pure noise
        top = ranked[0]["score"]
        ranked = [r for r in ranked if r["score"] >= max(0.3, top * 0.45)][:limit]
    for r in ranked:
        r["snippet"] = _snippet(_node_text(r["id"], idx), r["terms"] or _tokens(q))
    return {"query": q, "mode": mode, "results": ranked, "semantic_source": source}


def _snippet(text: str, terms: list[str], width: int = 220) -> str:
    t = re.sub(r"\s+", " ", text or "").strip()
    low = t.lower()
    pos = min((low.find(x) for x in terms if x and low.find(x) >= 0), default=0)
    start = max(0, pos - 60)
    s = t[start:start + width]
    return ("…" if start else "") + s + ("…" if start + width < len(t) else "")


# ------------------------------------------------------------------ one entry, for reading
def entry(entry_id: str) -> dict | None:
    e = db.row("""SELECT e.*, c.short_name, c.case_number FROM entries e LEFT JOIN cases c ON c.id=e.case_id
                  WHERE e.id=?""", entry_id)
    if not e:
        return None
    up = db.row("SELECT files FROM uploads WHERE id=?", e["upload_id"])
    files = json.loads(up["files"]) if up and up["files"] else []
    e["files"] = [{"name": f["name"], "kind": f.get("kind"), "url": f"/entries/{entry_id}/file?name={quote(f['name'])}"} for f in files]
    return e


def entry_file_path(entry_id: str, name: str | None):
    """Only files registered on the entry's own upload can be served; never a path from the request."""
    e = db.row("SELECT upload_id, source_file FROM entries WHERE id=?", entry_id)
    if not e:
        return None
    up = db.row("SELECT files FROM uploads WHERE id=?", e["upload_id"])
    files = json.loads(up["files"]) if up and up["files"] else []
    want = name or e["source_file"]
    for f in files:
        if f["name"] == want:
            p = Path(f["path"])
            return p if p.is_file() else None
    return None
