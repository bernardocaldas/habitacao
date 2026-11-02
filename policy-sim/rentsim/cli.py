"""``rentsim [out_dir]``: calibrate, run every policy, write summary.json and summary.md."""
from __future__ import annotations

import sys
from pathlib import Path

from .report import write


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("out")
    s = write(out)
    print((out / "summary.md").read_text(encoding="utf-8"))
    print(f"wrote {out}/summary.json and summary.md (ESS {s['effective_sample_size']:.0f})")


if __name__ == "__main__":
    main()
