"""Upload the demo backlog through the API, oldest first, exactly as the lawyer would (no hints).

    python scripts/load_backlog.py              # everything in tareekh-data/uploads/manifest.json
    python scripts/load_backlog.py --limit 10   # first 10 uploads only
    python scripts/load_backlog.py --case C3    # only uploads that touch case C3

Entries the pipeline is confident about are saved to memory automatically; the rest stay in review (shown at the end).
"""
import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

UPL = Path(__file__).resolve().parents[3] / "tareekh-data" / "uploads"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--case")
    ap.add_argument("--workers", type=int, default=5)
    a = ap.parse_args()
    manifest = json.loads((UPL / "manifest.json").read_text(encoding="utf-8"))
    if a.case:
        manifest = [m for m in manifest if a.case in m["case_ids"]]
    manifest = manifest[:a.limit] if a.limit else manifest

    def one(m):
        with httpx.Client(base_url=a.api, timeout=120) as c:
            files = [("files", (Path(f).name, (UPL / f).read_bytes())) for f in m["files"]]
            up = c.post("/uploads", files=files, data={"auto_confirm": "true"}).json()["upload_id"]
            deadline = time.time() + 600
            while (r := c.get(f"/uploads/{up}").json())["status"] in ("queued", "extracting", "segmenting", "retaining"):
                if time.time() > deadline:
                    r["error"] = "gave up waiting after 10 min"
                    break
                time.sleep(2)
            return up, m, r

    review = []
    # several at once: each upload waits mostly on the OCR model, not on this machine
    with ThreadPoolExecutor(a.workers) as pool:
        for i, (up, m, r) in enumerate(pool.map(one, manifest), 1):
            got = ", ".join(f"{e['case_id']} {e['hearing_date']} [{e['status']}]" for e in r["entries"])
            print(f"{i:3}/{len(manifest)} {m['files'][0]:60} {r['status']:7} {got}", flush=True)
            if r["status"] != "done":
                review.append((up, m["files"][0], r.get("error")))
    if review:
        print(f"\n{len(review)} uploads need review in the UI:")
        for up, f, err in review:
            print(f"  {up}  {f}  {err or ''}")


if __name__ == "__main__":
    main()
