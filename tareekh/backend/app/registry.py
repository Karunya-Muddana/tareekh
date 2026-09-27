"""Practice registry: the cases a lawyer has, and every way she might refer to them.

Resolution order for a piece of text: exact case-number match → alias substring → fuzzy alias match.
"""
import re

from rapidfuzz import fuzz, process

from . import db

# "O.S. No. 318 of 2022", "OS 318/22", "O.S.318/2022", "W.P.No.14872/2025", "IA 402/2025"
_CASE_RE = re.compile(
    r"\b(O\.?\s?S|A\.?\s?S|I\.?\s?A|W\.?\s?P|C\.?\s?R\.?\s?P|C\.?\s?M\.?\s?A)\.?\s*(?:No\.?)?\s*(\d{1,6})\s*(?:of|/)\s*(\d{2,4})\b",
    re.IGNORECASE,
)
_GENERIC = {"state", "telangana", "others", "another", "limited", "private", "partition", "appeal", "suit", "refund",
            "eviction", "contract", "accounts", "permits", "pension", "injunction", "people", "society", "committee"}
_TITLES = ("sri ", "smt. ", "smt ", "dr. ", "kum. ", "m/s ", "mohd. ", "hon'ble ")


def case_key(kind: str, num: str, year: str) -> str:
    kind = re.sub(r"[^A-Z]", "", kind.upper())
    year = year[-2:]
    return f"{kind}-{int(num)}-{year}"


def case_keys_in(text: str) -> list[str]:
    return [case_key(*m.groups()) for m in _CASE_RE.finditer(text or "")]


def _aliases_for(case: dict) -> set[str]:
    out = {case["short_name"].lower(), case["case_number"].lower()}
    out.update(k.lower() for k in case_keys_in(case["case_number"]))
    # party surnames/first words, e.g. "tadepalli", "gudivada", "kasoju"
    for party in case["title"].split(" vs "):
        p = party.lower()
        for t in _TITLES:
            p = p.replace(t, "")
        p = re.sub(r"&.*|and \d+ others?|\d+ others?", "", p).strip()
        words = [w for w in re.split(r"[^a-z]+", p) if len(w) > 3]
        if words:
            out.add(" ".join(words))
            raw = [w for w in re.split(r"[^a-z]+", p) if len(w) >= 3]
            if len(raw) > 2:
                out.add(" ".join(raw[:2]))          # "sai balaji residency ..." -> "sai balaji"
            out.add(words[-1])
    for part in re.split(r"[/()]| v | vs ", case["short_name"].lower()):
        if len(part.strip()) > 3:
            out.add(part.strip())
    return {a for a in out if a}


# ------------------------------------------------------------------ onboarding
LEARNED_FIELDS = {"temperament", "habits", "style", "tactics", "note", "phone_style_note"}


def load_registry(world: dict) -> dict:
    """Load what a lawyer would type in. Habits/tactics are stripped: those must be learned from notes."""
    db.init()
    with db.tx() as con:
        for t in ("judges", "counsel", "clients", "cases", "aliases"):
            con.execute(f"DELETE FROM {t}")
        for j in world["judges"]:
            con.execute("INSERT INTO judges VALUES (?,?,?,?,?,?)",
                        (j["id"], j["name"], j.get("short"), j.get("court"), j.get("court_hall"), j.get("level")))
        for o in world["opposing_counsel"]:
            con.execute("INSERT INTO counsel VALUES (?,?,?)", (o["id"], o["name"], o.get("chamber")))
        for c in world["clients"]:
            con.execute("INSERT INTO clients VALUES (?,?,?)", (c["id"], c["name"], c.get("type")))
        per_case = {}
        for c in world["cases"]:
            con.execute("INSERT INTO cases VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                        (c["id"], c["case_number"], c["title"], c["short_name"], c.get("nature"), c["judge_id"],
                         c["opposing_counsel_id"], c["client_id"], c.get("meera_represents"), c.get("court"),
                         c.get("final_listed_for") or c.get("stage"), c.get("next_date")))
            per_case[c["id"]] = _aliases_for(c)
        # a single word shared by several cases ("association", "constructions") identifies nothing
        owners: dict[str, set] = {}
        for cid, al in per_case.items():
            for a in al:
                owners.setdefault(a, set()).add(cid)
        n_alias = 0
        for cid, al in per_case.items():
            for a in al:
                if a in _GENERIC or (" " not in a and len(owners[a]) > 1):
                    continue
                con.execute("INSERT OR IGNORE INTO aliases VALUES (?,?)", (a, cid))
                n_alias += 1
    return {"judges": len(world["judges"]), "counsel": len(world["opposing_counsel"]),
            "clients": len(world["clients"]), "cases": len(world["cases"]), "aliases": n_alias}


# ------------------------------------------------------------------ lookups
def get_case(case_id: str) -> dict | None:
    return db.row("SELECT * FROM cases WHERE id=?", case_id)


def case_context(case_id: str) -> dict | None:
    """Case row joined with judge, counsel and client names."""
    return db.row(
        """SELECT c.*, j.name AS judge_name, j.short AS judge_short, j.court_hall, j.level,
                  o.name AS counsel_name, cl.name AS client_name
           FROM cases c LEFT JOIN judges j ON j.id=c.judge_id
           LEFT JOIN counsel o ON o.id=c.opposing_counsel_id LEFT JOIN clients cl ON cl.id=c.client_id
           WHERE c.id=?""", case_id)


def find_cases(text: str, limit: int = 3, min_score: int = 82) -> list[dict]:
    """Return [{case_id, score, matched}] best first."""
    text_l = (text or "").lower()
    hits: dict[str, tuple[float, str]] = {}
    keys = case_keys_in(text)
    if keys:
        for c in db.rows("SELECT id, case_number FROM cases"):
            if set(case_keys_in(c["case_number"])) & set(keys):
                hits[c["id"]] = (100.0, c["case_number"])
    aliases = db.rows("SELECT alias, case_id FROM aliases")
    for a in aliases:
        if len(a["alias"]) >= 5 and re.search(rf"\b{re.escape(a['alias'])}\b", text_l):
            score = 95.0 + min(len(a["alias"]), 40) / 10
            if score > hits.get(a["case_id"], (0, ""))[0]:
                hits[a["case_id"]] = (score, a["alias"])
    if not hits and text_l.strip():
        choices = [a["alias"] for a in aliases]
        for alias, score, idx in process.extract(text_l, choices, scorer=fuzz.partial_ratio, limit=limit * 3):
            cid = aliases[idx]["case_id"]
            if score >= min_score and score > hits.get(cid, (0, ""))[0]:
                hits[cid] = (score, alias)
    ranked = sorted(hits.items(), key=lambda kv: -kv[1][0])[:limit]
    return [{"case_id": cid, "score": round(s, 1), "matched": m} for cid, (s, m) in ranked]


def compact_listing() -> str:
    """One line per case for LLM prompts: id | number | nickname | parties | judge."""
    lines = []
    for c in db.rows("""SELECT c.id, c.case_number, c.short_name, c.title, j.short AS judge FROM cases c
                        LEFT JOIN judges j ON j.id=c.judge_id ORDER BY c.id"""):
        lines.append(f"{c['id']} | {c['case_number']} | {c['short_name']} | {c['title']} | {c['judge']}")
    return "\n".join(lines)


def case_tags(case_id: str) -> list[str]:
    c = get_case(case_id)
    if not c:
        return []
    return [f"case:{c['id']}", f"judge:{c['judge_id']}", f"counsel:{c['opposing_counsel_id']}", f"client:{c['client_id']}"]
