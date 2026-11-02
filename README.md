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

### 2b. Rules-based cross-check
Reading handles what rules can't: unnamed places ("the river", "a day north of the Nueces"), event vs. mention, who is where, and notes. Rules handle what reading can't promise, which is that nothing named was skipped. `scripts/check_extraction.py` compares the two deterministically, chapter by chapter.

**Missed places.** It flags a known place named in a chapter's text that the chapter's data doesn't include.
- Matching is case-sensitive and whole-word, using each place's name plus known variant spellings ("San Antone", "St. Jo", "Purgatory", "Staked Plains").
- Context filters remove false matches:
  - names of peoples ("the Cheyenne", "Ogallala Sioux") and an animal named after a city
  - adjectives ("Texas bull", "Texas Ranger")
  - addresses ("Fort Smith, Arkansas" doesn't count as a separate Arkansas reference)
  - a different branch of a river ("Fork of the Red River"), "New Mexico" vs. "Mexico", and "the San Antonio" (the river, not the city)

**Unsupported entries.** It flags a real place recorded for a chapter when neither its name, a variant, nor the reader's wording appears in that chapter's text. These are possible inventions, or places identified only from context.

**Places on no list.** It also catches places no reader recorded anywhere, using two patterns:
- place-shaped names, such as "Fort X", "X Creek", "X Springs" and "X Crossing"
- capitalized names after words like "in", "to" and "from", minus known places and recorded characters

**Review.** Each flag is checked in context and gets a recorded decision (add, dismiss or keep) with a reason in `scripts/check_decisions.json`. Later runs show only new flags.

**First run.** After tuning out the false-match patterns, 23 flags remained:
- **4 possible misses:** 1 was real (a passing mention, now added) and 3 were figurative or already covered.
- **3 unsupported entries:** all correct, identified from context.
- **17 names on no list:** all people, animals, objects or a figure of speech.

The readers missed no named place that rules could find.

### 3. Names and coordinates
- **Merging names:** `scripts/aliases.json` merges plain synonyms and spellings ("New York City" = "New York"). It never merges an unnamed placeholder with a place the book only identifies later, because that would leak the later reveal into earlier chapters.
- **Character names:** `scripts/char_aliases.json` does the same for characters ("Gus" = "Augustus").
- **Coordinates:** `scripts/gazetteer.json` gives every place a position.
  - **Real places:** standard coordinates, using the historic site for old forts, trading posts and crossings.
  - **Invented or unnamed places:** a best guess from the text's clues, such as distances, days of travel (a herd covers roughly 10–15 miles a day, a rider 30–40), directions and nearby landmarks. Each gets an uncertainty radius, which the map draws as a dashed circle.
- **Review list:** `REVIEW.md` lists low-confidence identifications and estimated positions, sorted by chapter.

### 4. Build
Book-wide settings (chapter count, parts, map view and labels) come from `book.json`; see [Using this for another book](#using-this-for-another-book).

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
| Extraction cross-check | Rules-based check for missed, unsupported and unlisted places (`scripts/check_extraction.py`) | 1 miss found and added; 0 flags unreviewed |

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
python3 -I scripts/split_chapters.py path/to/book.epub book/chapters
python3 -I scripts/check_extraction.py   # rules-based cross-check → extract/_check.json
python3 -I scripts/build.py              # → data/chapters/, data/meta.js, REVIEW.md
python3 -I scripts/build_people.py       # → data/people/
python3 -I scripts/build_basemap.py path/to/natural_earth   # → data/basemap.js (only when the map area changes)
```

Place extraction, coordinates and blurbs were produced by AI agents following the rules above; the scripts only package their output.

---

## Using this for another book

The app and scripts are not tied to *Lonesome Dove*. Everything specific to the book is in **`book.json`**:

| Setting | What it controls |
|---|---|
| `id` | Key for saved progress in the browser. Give each book its own, so two maps on one site don't share a bookmark. |
| `title`, `subtitle` | The cartouche and page title |
| `chapters`, `parts` | Chapter count and where each part starts (one part hides the part labels) |
| `epub.chapter_file` | Pattern that finds chapter files inside the EPUB, in reading order |
| `wording` | The jump-ahead prompt and its buttons ("Ride ahead" / "Stay put") |
| `map.bbox`, `countries`, `state_*` | The area cut from Natural Earth for the base map, which borders to draw, and states to merge for the era |
| `map.projection`, `frame` | Map projection and the opening view |
| `map.region_labels`, `sea_labels`, `river_labels`, `mountain_labels` | Which names are lettered on the base map |
| `build.river_names` | Book river names that differ from Natural Earth's, for routing trails along rivers |
| `check.*` | Cross-check tuning: spelling variants, and words that make a place name mean something else |

**Steps for a new book:**
1. Copy this repo. Delete `extract/`, `data/chapters/`, `data/people/`, `scripts/blurbs/` and `REVIEW.md`, and empty `scripts/gazetteer.json`, `aliases.json`, `char_aliases.json`, `deaths.json`, `canonical_names.txt` and `check_decisions.json`.
2. Edit `book.json`. Set `chapters` after splitting if you're not sure of the count; the splitter warns when they differ.
3. `split_chapters.py` your EPUB. If no chapters are found, open the EPUB (it's a zip) and adjust `epub.chapter_file` to match its chapter file names.
4. Have an AI reader go through each chapter with `scripts/EXTRACTION_RULES.md`, producing `extract/NNN.json`.
5. Fill `scripts/gazetteer.json` with coordinates. `build.py` lists any name still missing in `extract/_missing.json`.
6. Run the cross-check, review its flags into `check_decisions.json`, then build. If the setting is outside the current map area, rebuild the base map first.
7. Optionally record deaths and write blurbs; both are skipped when absent.

**Limits:**
- **Invented worlds.** The map uses real longitude and latitude on a Natural Earth base map. A fantasy world would need an image base map with positions measured on the picture; the app doesn't support that yet.
- **Story order.** Trails assume events happen in the order you read them. Books with flashbacks or several timelines would need a "when" field per event.
- **Borders.** Base map borders are modern. `state_merge` can join states (here North and South Dakota), but historic borders that cut across modern ones aren't drawn.
- **Style.** Fonts, colors and paper texture (`style.css`) are themed for the Old West and would need restyling for other settings.

## Credits

- Geography: [Natural Earth](https://www.naturalearthdata.com/) (public domain)
- Rendering: [D3](https://d3js.org/)
- Fonts: IM Fell English and Rye (Google Fonts)
- The novel: *Lonesome Dove* © Larry McMurtry, 1985. This is an unofficial fan reading aid and contains no text from the book.
