"""Rules-based cross-check of the AI place extraction.

Two directions, per chapter:
  * missed    — a known real place is named in the chapter text, but the chapter's
                extract has no entry for it (possible miss by the reader)
  * unsupported — the extract has a real (non-fictional) place, but neither its name,
                the wording the reader recorded, nor any known variant appears in the
                chapter text (possible invention, or a place identified only by context)

Matching is deterministic: case-sensitive, whole words, using the gazetteer names plus
the variant spellings below. States and countries are matched too but reported separately,
since the map doesn't plot them.

Usage: python3 -I scripts/check_extraction.py            → extract/_check.json + summary
       python3 -I scripts/check_extraction.py --context  → also print a short snippet per miss (local triage only)
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = ROOT / "scripts"
gaz = json.loads((S / "gazetteer.json").read_text())
aliases = json.loads((S / "aliases.json").read_text())
alias_lower = {k.lower(): v for k, v in aliases.items()}
gaz_lower = {k.lower(): k for k in gaz}

# Ways the book (or plain English) refers to a place, beyond its gazetteer name.
VARIANTS = {
    "San Antonio": ["San Antone"],
    "St. Joseph": ["St. Jo", "Saint Jo"],
    "Purgatoire River": ["Purgatory", "Purgatoire"],
    "Llano Estacado": ["Staked Plains", "Staked Plain", "Llano"],
    "Indian Territory": ["the Nations", "Indian Nations", "Oklahoma Territory"],
    "New York": ["New York City"],
    "Washington, D.C.": ["Washington City"],
    "Mexico City": ["Mexico City"],
    "Fort Phantom Hill": ["Phantom Hill"],
    "Doan's Store": ["Doan's", "Doans"],
    "Bent's Fort": ["Bents' Fort", "Bent's Fort"],
    "Marias River": ["Marais", "Marias"],
    "Prairie Dog Town Fork Red River": ["Prairie Dog Fork", "Prairie Dog Town Fork"],
    "Clear Fork Brazos River": ["Clear Fork"],
    "Colorado River (Texas)": [],
    "Rio Grande": ["Rio Grande", "Río Grande"],
}
# Words that are also ordinary names or too generic to match on their own.
SKIP_BARE = {"Red", "Milk", "Powder", "Wind", "Salt", "Platte"}
# States whose name is also a river: match the state only when not "the X" / "X River".
STATE_RIVER = {"Arkansas", "Colorado", "Missouri", "Mississippi", "Canadian"}


def canon(name):
    n, seen = (name or "").strip(), set()
    while n.lower() in alias_lower and n.lower() not in seen:
        seen.add(n.lower()); n = alias_lower[n.lower()]
    return gaz_lower.get(n.lower(), n)


THE = r"(?<![A-Za-z])[Tt]he "
# Place names that are also used for peoples, animals or as adjectives: count only after a
# word that places something somewhere ("in Memphis", "to Cheyenne").
LOCATIVE_ONLY = {"Cheyenne", "Memphis"}
LOCATIVE = re.compile(r"\b(?:in|to|from|at|near|of|toward|towards|for|into|outside|reach|reached)\s+$", re.I)


def patterns(name, g):
    """Regexes that count as the text naming this place."""
    out = []
    kind = g.get("kind")
    base = re.sub(r" River$", "", name)
    if kind == "river" and name.endswith(" River"):
        # "X River", or "the X" — but not "Fork of the X" (a different branch),
        # "the X country" (a region) or "X River of the North" (a different river)
        out.append(rf"(?<!Fork of the )\b{re.escape(base)} River\b(?! of the North)")
        tail = r"(?! (?:River|country|[a-z]))" if base in SKIP_BARE else r"(?! (?:River|country))"
        out.append(rf"(?<!Fork of ){THE}{re.escape(base)}\b{tail}")
    elif kind == "state" and name in STATE_RIVER:
        out.append(rf"(?<![Tt]he )\b{re.escape(name)}\b(?! River)")
    elif not g.get("fictional"):
        # "New Mexico" is not Mexico; "the San Antonio" is the river; "Ogallala Sioux" are a people;
        # "Texas bull" / "Texas Ranger" are adjectives
        out.append(rf"(?<!New )(?<![Tt]he )\b{re.escape(name)}\b(?! (?:Sioux|bull|Ranger|Rangers|longhorns?|cattle|steers?))")
    for v in VARIANTS.get(name, []):
        out.append(rf"\b{re.escape(v)}\b")
    return [re.compile(p) for p in out]


PATS = {n: patterns(n, g) for n, g in gaz.items()}


def matches(text, name):
    """Match objects for this place, after context filters."""
    g = gaz.get(name, {})
    out = []
    for p in PATS.get(name, []):
        for m in p.finditer(text):
            before = text[max(0, m.start() - 30):m.start()]
            if name in LOCATIVE_ONLY and not LOCATIVE.search(before):
                continue
            # "Fort Smith, Arkansas": the state is only part of a town's address
            if g.get("kind") == "state" and re.search(r"[A-Z][\w.']+,\s*$", before):
                continue
            out.append(m)
    return out


def named_in(text, name):
    return len(matches(text, name))


report = {"missed": [], "missed_broad": [], "unsupported": []}
for n in range(1, 103):
    text = (ROOT / "book" / "chapters" / f"{n:03d}.txt").read_text().replace("\u2019", "'")
    ext = json.loads((ROOT / "extract" / f"{n:03d}.json").read_text())
    have = {canon(p.get("name")) for p in ext.get("places", [])}
    have |= {canon(g.get("at")) for g in ext.get("groups", []) if g.get("at")}

    for name, g in gaz.items():
        if g.get("fictional") or name in have:
            continue
        # a state that shares its name with a river, when the reader already recorded the river
        if name in STATE_RIVER and f"{name} River" in have:
            continue
        hits = named_in(text, name)
        if hits:
            bucket = "missed_broad" if g.get("kind") in ("state", "country") or g.get("offmap") else "missed"
            report[bucket].append({"chapter": n, "place": name, "hits": hits})

    for p in ext.get("places", []):
        name = canon(p.get("name"))
        g = gaz.get(name)
        if not g or g.get("fictional"):
            continue
        raw = (p.get("raw_name") or "").strip()
        raw_core = re.sub(r"^(the|a|an)\s+", "", raw, flags=re.I)
        found = named_in(text, name) or (raw_core and raw_core.lower() in text.lower())
        if not found:
            report["unsupported"].append({"chapter": n, "place": name, "raw_name": raw, "type": p.get("type")})

# Place-shaped proper names that no known place covers (catches places no reader recorded anywhere).
SHAPES = re.compile(r"\b(?:Fort|Mount|Camp|Lake)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?"
                    r"|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:River|Creek|Springs|Spring|Crossing|Fork|Canyon|Mountains|Hills|Valley|Pass|Gap|City|Station|Store|County|Bluff|Ford)\b")
known = " | ".join(list(gaz) + list(aliases) + [v for vs in VARIANTS.values() for v in vs]).lower()
for f in sorted((ROOT / "extract").glob("[0-9]*.json")):
    known += " | " + " | ".join(p.get("raw_name", "") for p in json.loads(f.read_text()).get("places", [])).lower()
unknown = {}
for n in range(1, 103):
    text = (ROOT / "book" / "chapters" / f"{n:03d}.txt").read_text().replace("\u2019", "'")
    for m in SHAPES.finditer(text):
        phrase = re.sub(r"^(?:The|A|An|And|But|Then|When|If)\s+", "", m.group(0))
        if phrase.lower() not in known:
            unknown.setdefault(phrase, []).append(n)
# Bare capitalised names after a locative word ("in Abilene", "to Denver"), minus known
# places and anyone the readers recorded as a character.
people = set()
for f in sorted((ROOT / "extract").glob("[0-9]*.json")):
    d = json.loads(f.read_text())
    for p in d.get("places", []):
        for c in p.get("characters", []): people.update(c.split())
    for g in d.get("groups", []):
        for c in g.get("members", []): people.update(c.split())
COMMON = {"I", "God", "Lord", "Captain", "Mister", "Mr", "Mrs", "Miss", "Ma", "Pa", "Indians", "Indian", "Mexicans",
          "Mexican", "Christ", "Jesus", "Hell", "Heaven", "Sunday", "Saturday", "Rangers", "Ranger", "Army", "Yankees",
          "Comanches", "Kiowas", "Sioux", "Cheyenne", "Crow", "Crows", "Blackfeet", "Pawnee", "Pawnees", "Arapahoe",
          "Irish", "Irishman", "Dutch", "German", "Germans", "French", "English", "Spanish", "Greek", "Latin", "Bible"}
LOC = re.compile(r"\b(?:in|to|from|at|toward|towards|into|near|outside|reached|reach)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)")
for n in range(1, 103):
    text = (ROOT / "book" / "chapters" / f"{n:03d}.txt").read_text().replace("\u2019", "'")
    for m in LOC.finditer(text):
        phrase = m.group(1)
        words = phrase.split()
        if phrase.lower() in known or words[0] in people or words[0] in COMMON:
            continue
        if any(w.lower() in known for w in words):
            continue
        unknown.setdefault(phrase, []).append(n)
report["unknown_named"] = [{"phrase": k, "chapters": sorted(set(v))} for k, v in sorted(unknown.items())]

# Mark anything already reviewed (scripts/check_decisions.json) so only new flags need attention.
dec_path = S / "check_decisions.json"
dec = json.loads(dec_path.read_text()) if dec_path.exists() else {}
def key(x): return (x.get("chapter"), x.get("place") or x.get("phrase"))
for bucket in ("missed", "missed_broad", "unsupported", "unknown_named"):
    seen = {key(d): d for d in dec.get(bucket, []) + (dec.get("missed", []) if bucket == "missed_broad" else [])}
    for x in report[bucket]:
        d = seen.get(key(x)) or seen.get((None, x.get("phrase")))
        if d: x["decision"], x["reason"] = d["decision"], d["reason"]

(ROOT / "extract" / "_check.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
for bucket in ("missed", "missed_broad", "unsupported", "unknown_named"):
    new = sum(1 for x in report[bucket] if "decision" not in x)
    print(f"{bucket:<14} {len(report[bucket]):>3} flagged · {new} not yet reviewed")

if "--context" in sys.argv:
    for x in report["missed"] + report["missed_broad"]:
        t = (ROOT / "book" / "chapters" / f"{x['chapter']:03d}.txt").read_text().replace("\n", " ")
        m = next(iter(matches(t, x["place"])), None)
        if m:
            print(f"{x['chapter']:>3} {x['place']:<22} …{t[max(0, m.start() - 30):m.end() + 25]}…")
