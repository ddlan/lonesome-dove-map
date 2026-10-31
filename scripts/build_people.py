"""Package character blurbs into per-chapter files: data/people/001.js ... 102.js

Blurbs come from scripts/blurbs/out/*.json: {"Name": {"ch": N, "text": "..."}}.
Each blurb goes into the file for its chapter, so the app (people.js) never
loads a blurb written with knowledge past the reader's chapter.
Usage: python3 -I scripts/build_people.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOTAL = 102
by_ch = {n: {} for n in range(1, TOTAL + 1)}
for f in sorted((ROOT / "scripts" / "blurbs" / "out").glob("*.json")):
    kind = "intro" if f.stem.startswith("intro") else "update"
    for name, b in json.loads(f.read_text()).items():
        n = int(b["ch"])
        by_ch[n][name] = {"text": b["text"].strip(), "kind": kind}

# flag any blurb sharing 7+ consecutive words with the book up to its chapter
toks = lambda s: re.findall(r"[a-z']+", s.lower().replace("’", "'"))
grams, flagged = set(), []
for n in range(1, TOTAL + 1):
    t = toks((ROOT / "book" / "chapters" / f"{n:03d}.txt").read_text())
    grams.update(tuple(t[i:i + 7]) for i in range(len(t) - 6))
    for name, b in by_ch[n].items():
        w = toks(b["text"])
        if any(tuple(w[i:i + 7]) in grams for i in range(len(w) - 6)):
            flagged.append(f"ch{n} {name}")

out = ROOT / "data" / "people"
out.mkdir(parents=True, exist_ok=True)
for n, blurbs in by_ch.items():
    (out / f"{n:03d}.js").write_text(
        "LD_PEOPLE.add(" + json.dumps({"n": n, "b": blurbs}, ensure_ascii=False, separators=(",", ":")) + ");\n")
print(sum(len(b) for b in by_ch.values()), "blurbs written;", len(flagged), "flagged for copied wording")
for x in flagged:
    print("  flagged:", x)
