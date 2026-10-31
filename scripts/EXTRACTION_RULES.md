# Place extraction rules

You are extracting geographic places from one chapter of the novel *Lonesome Dove* to build a spoiler-safe map.
The chapter text is at `book/chapters/NNN.txt`. Write your output to `extract/NNN.json` (3-digit chapter number).

## Hard rules
1. **Use only this chapter's text.** Do not use outside knowledge of the novel's plot, and never mention or hint at events from later chapters. A note for chapter N may only describe what is known by the end of chapter N. (You MAY use general geography knowledge, e.g. that San Antonio is in Texas.)
2. **Never quote the book.** Notes are short paraphrases in your own words, at most 25 words.
3. Read the whole chapter. Do not skim.

## What counts as a place
Anything with a geographic location: towns, cities, forts, rivers, creeks, crossings, mountains, regions, states/territories, countries, ranches, saloons/buildings only if they anchor a scene in an unnamed spot (record the town instead, and mention the building in the note).
Include passing mentions and backstory places (where someone grew up, fought, travelled years ago).
Do NOT include: generic directions alone ("north"), metaphorical uses, place names used only as people's names or nicknames.

## Event vs mention
- `event`: a scene in this chapter takes place there, or characters are physically there / pass through / camp there during this chapter.
- `mention`: talked about, remembered, planned, or referenced, but nobody is there in this chapter.

## Output format (valid JSON, nothing else in the file)
```json
{
  "chapter": 7,
  "places": [
    {
      "raw_name": "the river",
      "name": "Rio Grande",
      "kind": "river",
      "type": "event",
      "characters": ["Augustus", "Call"],
      "note": "Paraphrased one-liner about what happens or is said about this place here.",
      "fictional": false,
      "location_hint": "",
      "confidence": "high"
    }
  ],
  "groups": [
    {
      "label": "Short neutral label, e.g. 'Hat Creek outfit'",
      "members": ["Call", "Augustus"],
      "at": "Rio Grande",
      "hint": "If 'at' is vague, describe position from text clues, e.g. 'two days north of the Rio Grande'"
    }
  ]
}
```

Field details:
- `name`: canonical modern/standard name if you can identify it ("San Antone" -> "San Antonio", "the Nations" -> "Indian Territory"). For fictional or unnamed places use a short descriptive name, e.g. "Lonesome Dove" or "Pedro Flores's ranch". Use names from `scripts/canonical_names.txt` when they match, so the same place is spelled the same everywhere.
- `kind`: one of `town`, `city`, `fort`, `river`, `creek`, `crossing`, `mountain`, `region`, `state`, `country`, `ranch`, `camp`, `other`.
- `characters`: named characters present at (event) or talking about (mention) the place. Use the name the book uses most (e.g. "Augustus", "Call", "Newt").
- `fictional`: true if the place is invented or unnamed and needs its position estimated.
- `location_hint`: REQUIRED when `fictional` is true or the place is vague. Give every geographic clue from the text: distances, days of travel, directions, nearby rivers/towns. E.g. "on the Texas side of the Rio Grande, a short ride from the border, south of San Antonio".
- `confidence`: `high` / `medium` / `low` for your identification of the place.
- `groups`: where each travelling party or separate storyline character is at the END of the chapter. Only include groups that appear in this chapter. Keep labels neutral and based only on this chapter.

One entry per distinct place per chapter. If a place is both visited and discussed, record it once as `event`.
