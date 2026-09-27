"""Onboard the demo practice from the synthetic data's world.json.

    python scripts/onboard_demo.py                 # registry + Hindsight bank setup
    python scripts/onboard_demo.py --offline       # registry only (no keys needed)
"""
import argparse
import json
from pathlib import Path

import httpx

WORLD = Path(__file__).resolve().parents[3] / "tareekh-data" / "data" / "world.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--offline", action="store_true")
    a = ap.parse_args()
    world = json.loads(WORLD.read_text(encoding="utf-8"))
    r = httpx.post(f"{a.api}/onboard", json={"world": world, "configure_memory": not a.offline}, timeout=300)
    r.raise_for_status()
    print(json.dumps(r.json(), indent=2))


if __name__ == "__main__":
    main()
