"""Turn the EPUB's chapter files into plain text: book/chapters/001.txt, 002.txt, ...

Chapter files are found with book.json's epub.chapter_file regex and numbered in that order.
Usage: python3 -I scripts/split_chapters.py path/to/book.epub book/chapters
"""
import html, json, re, sys, zipfile
from pathlib import Path

BOOK = json.loads((Path(__file__).resolve().parent.parent / "book.json").read_text())

PAT = re.compile(BOOK.get("epub", {}).get("chapter_file", r"ch(\d{3})\.html$"))

epub, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(epub) as z:
    files = sorted((n for n in z.namelist() if PAT.search(n)), key=lambda n: int(PAT.search(n).group(1)))
    for i, name in enumerate(files, 1):
        num = f"{i:03d}"
        raw = z.read(name).decode("utf-8", "replace")
        raw = re.sub(r"(?is)<(script|style|head).*?</\1>", "", raw)
        raw = re.sub(r"(?i)</p>|<br\s*/?>", "\n\n", raw)
        text = html.unescape(re.sub(r"<[^>]+>", "", raw))
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
        (out / f"{num}.txt").write_text(text + "\n")
print(len(files), "chapters written")
if len(files) != BOOK["chapters"]:
    print(f"warning: book.json says {BOOK['chapters']} chapters; set it to {len(files)} if that's right")
