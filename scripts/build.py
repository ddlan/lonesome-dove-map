"""Merge extract/*.json + gazetteer into the app's per-chapter data files.

Usage: python3 -I scripts/build.py
Writes data/chapters/NNN.js, data/meta.js and REVIEW.md.
Each chapter file only holds that chapter's places and appearances, so the app
never loads anything past the reader's chapter.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = ROOT / "scripts"
TOTAL = 102
PARTS = [[1, 1], [2, 26], [3, 75]]

gaz = json.loads((S / "gazetteer.json").read_text())
aliases = json.loads((S / "aliases.json").read_text()) if (S / "aliases.json").exists() else {}
deaths = {k: v for k, v in json.loads((S / "deaths.json").read_text()).items() if not k.startswith("_")} if (S / "deaths.json").exists() else {}
char_aliases = json.loads((S / "char_aliases.json").read_text()) if (S / "char_aliases.json").exists() else {}
gaz_lower = {k.lower(): k for k in gaz}
alias_lower = {k.lower(): v for k, v in aliases.items()}


def canon(name):
    if not name:
        return None
    n = name.strip()
    seen = set()
    while n.lower() in alias_lower and n.lower() not in seen:
        seen.add(n.lower())
        n = alias_lower[n.lower()]
    return gaz_lower.get(n.lower(), n)


def char(c):
    c = c.strip()
    return char_aliases.get(c, c)


# book river name -> river name in the Natural Earth base map, where they differ
RIVER_NAMES = {"Clear Fork Brazos River": "Clear Fk.  Brazos", "Colorado River (Texas)": "Colorado"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


introduced = set()
missing = {}      # name -> first chapter
review = []       # (chapter, text)
out_dir = ROOT / "data" / "chapters"
out_dir.mkdir(parents=True, exist_ok=True)
for f in out_dir.glob("*.js"):
    f.unlink()

stats = {"chapters": 0, "places": 0, "apps": 0}
for n in range(1, TOTAL + 1):
    src = ROOT / "extract" / f"{n:03d}.json"
    if not src.exists():
        continue
    d = json.loads(src.read_text())
    stats["chapters"] += 1
    apps, new_places = {}, []
    for p in d.get("places", []):
        name = canon(p.get("name") or p.get("raw_name"))
        g = gaz.get(name)
        if not g:
            missing.setdefault(name, n)
            continue
        pid = slug(name)
        if p.get("confidence") == "low":
            review.append((n, f"**{name}** (written as \"{p.get('raw_name', '')}\") — unsure which place this is"))
        if pid not in introduced:
            introduced.add(pid)
            stats["places"] += 1
            new_places.append({
                "id": pid, "name": name, "kind": g.get("kind", p.get("kind", "other")),
                "lat": g["lat"], "lng": g["lng"], "r": g.get("r", 0),
                "fictional": bool(g.get("fictional")), "offmap": bool(g.get("offmap")),
            })
            if g.get("r") or g.get("fictional"):
                review.append((n, f"**{name}** — position estimated (±{round(g.get('r', 0) * 0.62)} mi)"))
        t = "e" if p.get("type") == "event" else "m"
        chars = [char(c) for c in p.get("characters", []) if c]
        note = (p.get("note") or "").strip()
        if pid in apps:  # same place twice in a chapter after merging names
            a = apps[pid]
            a["t"] = "e" if "e" in (a["t"], t) else "m"
            a["c"] = sorted(set(a["c"]) | set(chars))
            if note and note not in a["note"]:
                a["note"] = (a["note"] + " " + note).strip()
        else:
            apps[pid] = {"p": pid, "t": t, "c": chars, "note": note}
    pos = []
    # every scene a character is in counts as a stop on their trail (in text order),
    # skipping places too big or vague to plot: states, countries, broad regions,
    # and rivers (a river's single map point says little about where it was crossed)
    for p in d.get("places", []):
        if p.get("type") != "event":
            continue
        name = canon(p.get("name") or p.get("raw_name"))
        gg = gaz.get(name)
        if not gg or gg.get("offmap") or gg.get("kind") in ("state", "country", "river"):
            continue
        if gg.get("kind") == "region" and gg.get("r", 0) > 80:
            continue
        for c in sorted({char(c) for c in p.get("characters", []) if c}):
            pos.append({"m": [c], "lat": gg["lat"], "lng": gg["lng"], "at": slug(name)})
    # then where each party ends the chapter
    for g in d.get("groups", []):
        name = canon(g.get("at"))
        gg = gaz.get(name)
        if not gg or gg.get("kind") in ("state", "country") or gg.get("offmap"):
            continue
        members = sorted({char(c) for c in g.get("members", []) if c})
        if members:
            e = {"m": members, "lat": gg["lat"], "lng": gg["lng"], "at": slug(name)}
            if gg.get("kind") == "river":  # the app routes the trail along this river's course
                e["rv"] = RIVER_NAMES.get(name, re.sub(r" River$", "", name))
            pos.append(e)
    stats["apps"] += len(apps)
    payload = {"n": n, "places": new_places, "apps": list(apps.values()), "pos": pos}
    died = sorted(c for c, ch in deaths.items() if ch == n)
    if died:
        payload["died"] = died
    (out_dir / f"{n:03d}.js").write_text("LD.chapter(" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ");\n")

(ROOT / "data" / "meta.js").write_text(
    "window.LD_META=" + json.dumps({"total": TOTAL, "parts": PARTS}) + ";\n")

for name, n in missing.items():
    review.append((n, f"**{name}** — no coordinates yet, not shown on the map"))
review.sort(key=lambda r: r[0])
lines = ["# Review list", "",
         "Things worth a second look, sorted by chapter. Only read up to the chapter you've reached.", ""]
cur = None
for n, text in review:
    if n != cur:
        lines += ["", f"## Chapter {n}"]
        cur = n
    lines.append(f"- {text}")
(ROOT / "REVIEW.md").write_text("\n".join(lines) + "\n")

print(f"{stats['chapters']} chapters, {stats['places']} places, {stats['apps']} appearances, {len(missing)} names without coordinates")
(ROOT / "extract" / "_missing.json").write_text(json.dumps(missing, indent=1, ensure_ascii=False))
