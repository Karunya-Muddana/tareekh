"""Upload a START_HERE level, wait for ingest, confirm, then ask its question.

    python scripts/run_level.py 1
"""
import argparse
import json
import time
from pathlib import Path

import httpx

START = Path(__file__).resolve().parents[3] / "tareekh-data" / "uploads" / "START_HERE"
LEVELS = {
    "1": ("level1_one_case", "rejoinder?", "C23"),
    "2": ("level2_contradiction", "What did PW1 say about possession in Gudivada v Kasoju?", None),
    "3": ("level3_cross_case_pattern", "What should I expect in Tadepalli today?", None),
    "4": ("level4_missed_deadline", "Did we file the appeal for Sunitha?", None),
}


def wait(api, upload_id):
    while True:
        up = httpx.get(f"{api}/uploads/{upload_id}", timeout=30).json()
        if up["status"] in ("review", "done", "error"):
            return up
        time.sleep(2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("level", choices=LEVELS)
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--quick", action="store_true", help="ask in in-court quick mode")
    ap.add_argument("--max-wait", type=int, default=900, help="seconds to wait for Hindsight's queue")
    ap.add_argument("--ask-only", action="store_true", help="skip uploads, just ask")
    a = ap.parse_args()
    folder, question, active = LEVELS[a.level]
    for f in ([] if a.ask_only else sorted((START / folder).iterdir())):
        if f.suffix == ".md":
            continue
        r = httpx.post(f"{a.api}/uploads", files={"files": (f.name, f.read_bytes())}, timeout=60).json()
        up = wait(a.api, r["upload_id"])
        print(f"\n== {f.name}: {up['status']} {up.get('error') or ''}")
        for e in up["entries"]:
            print(f"   {e['case_id']} {e['hearing_date']} conf={e['confidence']} :: {e['text'][:90]!r}")
        if up["status"] == "review":
            print("   confirm ->", httpx.post(f"{a.api}/uploads/{up['id']}/confirm", json={}, timeout=120).json())
    print("\nWaiting for Hindsight to finish extracting (free-tier rate limits make this slow) ...")
    t0 = time.time()
    while time.time() - t0 < a.max_wait:
        try:
            st = httpx.get(f"{a.api}/memory/status", timeout=30).json()
            st["pending_operations"]
        except Exception:  # noqa: BLE001 - Hindsight restarting
            time.sleep(10)
            continue
        print(f"   pending={st['pending_operations']} consolidating={st['pending_consolidation']} "
              f"facts={st['total_nodes']} observations={st['total_observations']}", flush=True)
        if not st["pending_operations"]:
            break
        time.sleep(15)
    ans = httpx.post(f"{a.api}/ask", json={"question": question, "case_id": active, "quick": a.quick}, timeout=180).json()
    print(f"\nQ: {question}\n\nA ({ans['mode']}): {ans['answer']}\n")
    for c in ans["citations"]:
        print(f"  [{c['n']}] {c['hearing_date']} {c['case_id']} {c['source_file']}")
    if ans.get("error"):
        print("\n(agent error before fallback:", ans["error"], ")")
    print(json.dumps(ans.get("trace"), indent=1))


if __name__ == "__main__":
    main()
