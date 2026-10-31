# Lonesome Dove Map — Plan

A spoiler-safe, old-West-styled map of every place in *Lonesome Dove*. You set the chapter you're on, and the map shows only what has appeared up to that chapter.

> This plan names no place beyond the book's opening premise, so reading it is spoiler-free.

---

## 1. The source book

- EPUB, cleanly split: **102 chapter files** (`ch001`–`ch102`), ~364,000 words.
- Three parts: **Part I = ch 1–25**, **Part II = ch 26–74**, **Part III = ch 75–102**.
- The book text stays local (`book/`, excluded from git) and is **never published**. Only the extracted data (place names, coordinates, short notes in my own words) goes into the map.

---

## 2. Pulling places out of the book

### Step 1: Split into chapters
A small script turns each chapter file into plain text: `chapters/001.txt` … `102.txt`.

### Step 2: Read each chapter and record its places
I work through the book in batches of about 10 chapters, using helper agents running side by side. For each chapter they write `extract/NNN.json`:

```json
{
  "chapter": 7,
  "places": [
    {
      "raw_name": "the river",
      "resolved": "Rio Grande",
      "type": "event",            // event = characters are there; mention = talked about
      "characters": ["Call", "Gus"],
      "note": "One-line summary in my own words",
      "confidence": "high"        // high / medium / low
    }
  ],
  "groups": [                      // where each traveling party is at chapter's end
    { "members": ["..."], "at": "Rio Grande", "moving_toward": "..." }
  ]
}
```

**Rules for each reader:**
- Use **only that chapter's text** (plus the place list built so far). No outside knowledge of the plot, so a chapter-7 note can't hint at chapter 50.
- Notes are short paraphrases, never quotes.
- Count every place, including passing mentions and backstory (e.g. where a character grew up). The map can filter these.
- Vague places ("a creek two days north") are recorded with whatever clues the text gives about where they are.

### Step 3: Merge names that mean the same place
One pass over all 102 files builds `aliases.json` ("San Antone" → San Antonio, "the river" → Rio Grande, depending on context) and merges duplicates into a single place list.

### Step 4: Look up coordinates
- **Real places:** looked up in the USGS and GeoNames place-name databases, which include old forts, abandoned towns and trail crossings.
- **Fictional or vague places:** placed by an estimate from the clues in the text, with a `radius_km` for how unsure the position is. The map draws a soft circle instead of a pin.
- Rivers and regions are stored as lines or shapes rather than single points where that makes sense.

### Step 5: Review report
`REVIEW.md` lists everything low-confidence: unclear names, guessed positions, uncertain merges. It is **sorted by chapter**, so you only check up to where you've read and never see later entries.

**Expected result:** a few hundred places with roughly 1,000+ appearances across the book.

---

## 3. Data files the app uses

```
data/
  places.json            # id, name, kind (town/fort/river/region/fictional), coords or shape, radius_km
  chapters/001.json …    # appearances in that chapter: place, type, characters, note
  chapters/102.json      #   plus each traveling party's position
```

**Splitting by chapter is the spoiler guard.** The app loads only chapter files 1…X, so nothing past your chapter is ever loaded into the browser. Each place's details (popup text, first-seen chapter) are built from loaded chapters only. Storyline colors and the legend appear only once that group exists in the story.

---

## 4. The map: look and feel

An **original** hand-drawn frontier style, inspired by the mood of open-world Western games but using no assets from them.

| Element | Treatment |
|---|---|
| Paper | Aged parchment texture, darker toward the edges, faint fold creases |
| Ink | Sepia/brown lines with a slight hand-drawn wobble (an SVG distortion filter) |
| Terrain | Shaded relief in sepia tones, plus hand-drawn hatching on mountain ranges |
| Rivers | Thin ink lines that taper; major rivers labeled in italics along their course |
| Borders | Dashed lines for **1870s-era** states and territories, with period names where they differ from today |
| Type | Period-style fonts from Google Fonts: a woodcut font for titles, an old-style serif for labels |
| Pins | Small ink symbols by kind: town dot, fort square, camp tent, river crossing; faded ink for mentions |
| Storylines | Dashed trail lines in muted red, indigo or green that grow chapter by chapter |
| Decoration | Compass rose, scale bar in miles, an ornate cartouche with the title and current chapter |
| Unexplored areas | Light fog over regions no character has reached yet (optional, can be switched off) |

**How it's built:** D3 with free map data (Natural Earth coastlines, rivers, lakes, relief; historical state and territory borders), drawn as SVG so the ink and paper effects work. Zoom and pan are included. No map service or API key is needed, and it runs as a single static site.

---

## 5. App features

1. **Chapter control:** a slider plus a number box, shown as "Part II · Chapter 31". Remembered between visits.
2. **Pins up to chapter X:** solid for events, faded for mentions. Places new this chapter get a brief highlight.
3. **Place popup:** name, real/fictional label, and notes for each appearance up to chapter X, newest first.
4. **Storyline paths:** one colored trail per traveling group, drawn through its positions chapter by chapter.
5. **Filters:** events only or events plus mentions; filter by character.
6. **"This chapter" panel:** a list of places in the current chapter. Clicking one flies the map there.
7. **Works on a phone**, so you can check it while reading.

---

## 6. Build order

| # | Step | Output |
|---|---|---|
| 1 | Split the book into chapters | `chapters/*.txt` |
| 2 | Run the extraction on chapters 1–10 as a test; you spot-check (only ones you've read) | `extract/001–010.json` |
| 3 | Adjust the rules, then extract the rest | `extract/*.json` |
| 4 | Merge names, look up coordinates, write the review report | `data/`, `REVIEW.md` |
| 5 | Basic map: paper, coastlines, rivers, borders, chapter slider, pins | working page |
| 6 | Popups, filters, storyline paths, "this chapter" panel | full features |
| 7 | Style polish: relief, hatching, cartouche, fog, fonts | finished look |
| 8 | Publish as a private web page you can open on any device (optional) | link |

---

## 7. Open questions for you

1. **Which chapter are you on?** I'll use it to choose test chapters you can check without spoilers.
2. **Mentions:** include every passing mention (more complete, busier map), or only places where scenes happen, with mentions available behind a toggle? *Default: include everything, show events only, mentions behind a toggle.*
3. **Where should it live?** Local files you open in a browser, or a private hosted link that works on your phone? *Default: both.*
4. **Fog over unexplored areas:** keep it, or skip it?
