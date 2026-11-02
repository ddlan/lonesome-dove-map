"""Build data/basemap.js from Natural Earth, clipped to book.json's map area.

Needs mapshaper (npm install -g mapshaper) and these Natural Earth 10m files as GeoJSON in one folder:
  ne_10m_land, ne_10m_admin_0_countries, ne_10m_admin_1_states_provinces,
  ne_10m_rivers_lake_centerlines, ne_10m_rivers_north_america (optional), ne_10m_lakes,
  ne_10m_geography_regions_polys
Usage: python3 -I scripts/build_basemap.py path/to/natural_earth_folder [path/to/mapshaper]
"""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "book.json").read_text())["map"]
src = Path(sys.argv[1])
ms = sys.argv[2] if len(sys.argv) > 2 else shutil.which("mapshaper")
if not ms:
    sys.exit("mapshaper not found: npm install -g mapshaper, or pass its path")
BB = ",".join(str(v) for v in M["bbox"])
countries = json.dumps(M.get("countries", []))
sc, excl = M.get("state_country", ""), json.dumps(M.get("state_exclude", []))
merge = json.dumps(M.get("state_merge", {}))
out = Path(tempfile.mkdtemp())


def run(inputs, steps, name):
    files = [str(src / f"{i}.geojson") for i in inputs if (src / f"{i}.geojson").exists()]
    if not files:
        print(f"skipping {name}: no source file"); return False
    cmd = [ms, *files] + (["combine-files", "-merge-layers", "force"] if len(files) > 1 else []) + steps + \
          ["-o", str(out / f"{name}.json"), "format=geojson", "precision=0.01"]
    subprocess.run(cmd, check=True)
    return True


run(["ne_10m_land"], ["-clip", f"bbox={BB}", "-simplify", "8%", "keep-shapes", "-filter-fields"], "land")
run(["ne_10m_admin_0_countries"], ["-filter", f"{countries}.includes(NAME)", "-clip", f"bbox={BB}",
    "-simplify", "8%", "keep-shapes", "-filter-fields", "NAME"], "countries")
# internal state/province lines for one country; state_merge joins states that were one territory in the book's era
has_states = sc and run(["ne_10m_admin_1_states_provinces"], [
    "-filter", f"adm0_a3=={json.dumps(sc)} && !{excl}.includes(postal)",
    "-each", f"grp = ({merge})[postal] || postal", "-dissolve", "grp", "copy-fields=name",
    "-clip", f"bbox={BB}", "-simplify", "8%", "keep-shapes", "-innerlines"], "statelines")
run(["ne_10m_rivers_lake_centerlines", "ne_10m_rivers_north_america"], [
    "-clip", f"bbox={BB}", "-filter", "featurecla.indexOf('River')>=0 || featurecla.indexOf('Lake Centerline')>=0",
    "-simplify", "15%", "-filter-fields", "name,scalerank"], "rivers")
run(["ne_10m_lakes"], ["-clip", f"bbox={BB}", "-filter", "scalerank<=6", "-simplify", "10%", "keep-shapes",
    "-filter-fields", "name"], "lakes")
run(["ne_10m_geography_regions_polys"], ["-filter", "FEATURECLA=='Range/mtn'", "-clip", f"bbox={BB}",
    "-simplify", "10%", "keep-shapes", "-filter-fields", "NAME,SCALERANK"], "mountains")

empty = {"type": "FeatureCollection", "features": []}
bm = {k: json.loads((out / f"{k}.json").read_text()) if (out / f"{k}.json").exists() else empty
      for k in ("land", "countries", "statelines", "rivers", "lakes", "mountains")}
(ROOT / "data" / "basemap.js").write_text("// Natural Earth (public domain), clipped to the map area\nwindow.BASEMAP="
                                          + json.dumps(bm, separators=(",", ":")) + ";\n")
print("wrote data/basemap.js", f"({(ROOT / 'data' / 'basemap.js').stat().st_size // 1024} KB)")
