# Lonesome Dove Map

A spoiler-safe, old-West-styled map of every place in Larry McMurtry's *Lonesome Dove*. You set the chapter you've reached, and the map shows only the places, journeys and character notes known up to that chapter.

**Live:** https://ddlan.github.io/lonesome-dove-map/

> **Spoiler warning for this repo.** The website only reveals what you've read. The repository is different: `extract/`, `REVIEW.md` and `scripts/` contain data for the whole book. Browse the source carefully if you haven't finished it. This README contains no plot details.

---

## Using it

- Open the site, or open `index.html` directly from a local copy (no server needed).
- Set your chapter with the slider, the number box or the arrow keys. Jumping more than one chapter ahead asks for confirmation.
- `?ch=N` in the URL opens at chapter N.
- **Ledger panel options:**
  - Places that are only talked about are hidden behind a toggle.
  - Fog over country no one has reached yet can be switched on or off.
  - Trails can be switched on or off.
  - **Follow** picks one character to track.

---

## How the data is made

```
EPUB → chapter text → per-chapter place extraction → name merging + coordinates → per-chapter data files → map
                                                      ↘ deaths, character blurbs ↗
```

### 1. Chapter text
`scripts/split_chapters.py` turns the EPUB's 102 chapter files into plain text in `book/chapters/NNN.txt`. That folder is git-ignored, and the book text is never published.

### 2. Place extraction
An AI reader went through every chapter in full, following `scripts/EXTRACTION_RULES.md`. For each chapter it wrote `extract/NNN.json` containing:

- Every place in the chapter: towns, forts, rivers, regions, ranches, camps, and unnamed spots.
- For each place:
  - whether it's an **event** (characters are there) or a **mention** (talked about or remembered)
  - which characters are involved
  - a one-line note in the reader's own words
  - location clues from the text, such as "a day's ride north of the river"
  - a confidence level
- Where each traveling party is at the end of the chapter.

A test batch of 10 chapters was checked by hand before the rest was processed.

### 3. Names and coordinates
- **Merging names:** `scripts/aliases.json` merges plain synonyms and spellings ("New York City" = "New York"). It never merges an unnamed placeholder with a place the book only identifies later, because that would leak the later reveal into earlier chapters.
- **Character names:** `scripts/char_aliases.json` does the same for characters ("Gus" = "Augustus").
- **Coordinates:** `scripts/gazetteer.json` gives every place a position.
  - **Real places:** standard coordinates, using the historic site for old forts, trading posts and crossings.
  - **Invented or unnamed places:** a best guess from the text's clues, such as distances, days of travel (a herd covers roughly 10–15 miles a day, a rider 30–40), directions and nearby landmarks. Each gets an uncertainty radius, which the map draws as a dashed circle.
- **Review list:** `REVIEW.md` lists low-confidence identifications and estimated positions, sorted by chapter.

### 4. Build
`scripts/build.py` combines the above into **one data file per chapter**: `data/chapters/NNN.js`. Each file holds only:
- places that first appear in that chapter
- that chapter's appearances and notes
- that chapter's trail positions
- deaths revealed in that chapter

`data/basemap.js` holds the geography: coastlines, rivers, lakes, mountain ranges and borders from Natural Earth (public domain).

---

## Trails

A character's trail is the series of places they physically occupy, in reading order.

1. **Stops.** For each chapter, the stops are:
   - every place where the character has a scene, in text order
   - then where their party is at the end of the chapter

   Mentions never count. Places too large or vague to plot are skipped: states, countries, broad regions, and rivers used as scene locations.
2. **Consecutive repeats** of the same place are collapsed into one stop.
3. **Rivers.** When a party's end-of-chapter position is a river, the line follows the river's real course instead of jumping to one fixed point on it. The route runs from the point on the river nearest the previous stop to the point nearest the next stop, using the shortest path along Natural Earth's river lines. The next stop is only used if it falls within chapters you've read.
4. **Parties.** Characters who are at the same place now and have shared at least 70% of their stops are drawn as one line ("Call, Newt, Pea Eye & 8 more").
5. **What the default view shows.** The 8 largest storylines, ranked by number of stops and party size, excluding:
   - parties whose members have all died (they stay visible, marked †, during the chapter of the death)
   - parties not seen for 12 or more chapters

   A note under the list says how many are hidden. **Follow** still shows any character, including those who have died.
6. **Fog of war** is lifted around every event place and along every trail, including hidden ones.

**Deaths.** `scripts/deaths.json` records the chapter where the reader *learns* of each death, which isn't always the chapter it happens. Each death was confirmed against the book text. It is written only into that chapter's data file.

## Character blurbs

Following a character shows a short description card. Each blurb is written with knowledge only up to the chapter it's filed under.

- **Introductions.** Written for 51 characters from the chapter where they first appear (that chapter's text plus its notes) and filed under that chapter. A check confirmed none was given notes from any later chapter.
- **Updates.** Written at checkpoints (chapters 15, 30, 45, 60, 75 and 90) from the paraphrased place notes of chapters 1 through that checkpoint, and filed under the checkpoint.
- **Which blurb shows.** The newest one written at or before your chapter. The card says whether it's from the character's introduction or "as of chapter N".

`scripts/build_people.py` packages the blurbs into `data/people/NNN.js`, one file per chapter, in the same way as the place data. Inputs are in `scripts/blurbs/input/` and the written blurbs are in `scripts/blurbs/out/`.

---

## How spoiler safety is enforced

**Structural guard (the main protection).**
- Everything that depends on the story is split into per-chapter files: places, notes, trails, deaths and blurbs.
- The app only ever requests files 1 through your chapter, so nothing later reaches your browser.
- Everything shown (popups, first-seen chapter, trails, colors, party lists, the Follow menu) is computed from the loaded chapters alone.

**Content rules.**
- Each chapter's notes were written from that chapter's text only. The readers were told not to use outside knowledge of the novel.
- Unnamed places keep their placeholder names even after the book reveals what they are.
- Deaths are recorded at the chapter of the reveal.
- Map labels for states and territories are geography only and give nothing away.

**Checks.**
- A full sweep loads every chapter 1–102 in headless Chrome and confirms:
  - no chapter file past the selected chapter is ever requested
  - no page errors or missing files
  - places render and popups open

  Spot checks are also run against the live site.
- **Jump-ahead guard.** Moving more than one chapter past the furthest you've marked asks for confirmation first.

**Limits.**
- The data files for later chapters are public in this repo and on the site, so anyone can fetch them directly.
- AI-written notes follow the rules but haven't been reviewed by a person line by line. Treat a note as a summary of its chapter, not a guarantee.

## Copyright safeguards

- No book text is committed. `book/` is git-ignored, and all notes and blurbs are paraphrases.
- **Automated check.** Every committed file is compared against the full book text, and any run of 9 or more consecutive words shared with the book is flagged. Notes and blurbs are also checked at 7 words. Flagged text is reworded until the check comes back clean.

---

## Testing

| Check | What it verifies | Result (Nov 2026) |
|---|---|---|
| Full chapter sweep, local | All 102 chapters: no errors, no future-chapter loads, places render, popups open | 102/102 pass |
| Live site sweep | Chapters 1, 20, 58 and 102 on GitHub Pages | 4/4 pass |
| Follow sweep | Every name in the Follow menu at several chapters gets a trail, a marker or a "no known whereabouts" note | Pass |
| Zoom/pan benchmark | Scripted wheel zoom and drag pan, measuring frame times | Steady 60fps |
| Copied-wording check | Committed files vs. book text (9-word runs) | Clean |

The test scripts currently live outside the repo; adding them under `tests/` is an open item.

## Rendering notes

The map is drawn with D3 in four layers:
1. **Base map (SVG):** land, rivers, mountains and labels.
2. **Fog (canvas).**
3. **Places and trails (SVG).**
4. **Paper texture (static SVG),** blended on top.

To keep zooming smooth:
- Rivers and mountain symbols are merged into a handful of shapes instead of thousands.
- The hand-drawn wobble is built into the line shapes once at load, instead of being an SVG filter.
- The fog is a canvas redrawn each frame.
- The paper texture is drawn once and blended by the graphics card.

## Rebuilding

The build scripts expect the chapter text in `book/chapters/` (not committed; regenerate it from your own copy of the book).

```bash
python3 scripts/split_chapters.py path/to/book.epub book/chapters
python3 scripts/build.py          # → data/chapters/, data/meta.js, REVIEW.md
python3 scripts/build_people.py   # → data/people/
```

Place extraction, coordinates and blurbs were produced by AI agents following the rules above; the scripts only package their output.

## Credits

- Geography: [Natural Earth](https://www.naturalearthdata.com/) (public domain)
- Rendering: [D3](https://d3js.org/)
- Fonts: IM Fell English and Rye (Google Fonts)
- The novel: *Lonesome Dove* © Larry McMurtry, 1985. This is an unofficial fan reading aid and contains no text from the book.
