"""Turn the EPUB's chapter files into plain text: book/chapters/001.txt ... 102.txt"""
import html, re, sys, zipfile
from pathlib import Path

epub, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(epub) as z:
    for name in sorted(n for n in z.namelist() if re.search(r"ch\d{3}\.html$", n)):
        num = re.search(r"ch(\d{3})", name).group(1)
        raw = z.read(name).decode("utf-8", "replace")
        raw = re.sub(r"(?is)<(script|style|head).*?</\1>", "", raw)
        raw = re.sub(r"(?i)</p>|<br\s*/?>", "\n\n", raw)
        text = html.unescape(re.sub(r"<[^>]+>", "", raw))
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
        (out / f"{num}.txt").write_text(text + "\n")
print(len(list(out.glob("*.txt"))), "chapters written")
