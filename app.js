/* Spoiler-safe chapter map. Book settings (title, map view, labels) come from data/meta.js,
   which build.py writes from book.json.
   Chapter data lives in data/chapters/NNN.js and is only loaded up to the chosen chapter. */
(() => {
"use strict";

const META = window.LD_META;
const BM = window.BASEMAP;
const TOTAL = META.total;
const MAPCFG = META.map || {};
const WORD = Object.assign({ jump_confirm: "Jump ahead to chapter {n}? This shows places past chapter {furthest}, the furthest you've marked.",
  jump_yes: "Jump ahead", jump_no: "Stay here" }, META.wording);
if (META.title) {
  document.title = META.title + " Map";
  d3.select("#cartouche h1").text(META.title);
  d3.select("#map").attr("aria-label", "Map of places in " + META.title);
}
d3.select("#cartouche .c-sub").text(META.subtitle || "");
d3.select("#confirm-yes").text(WORD.jump_yes);
d3.select("#confirm-no").text(WORD.jump_no);
const KEY = (META.id || "book") + "-";  // separate saved progress per book on a shared site
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} },
};

/* ---------- chapter loading (only files 1..X are ever requested) ---------- */
const chapters = {};
window.LD = { chapter(d) { chapters[d.n] = d; } };
const loading = {};
function loadChapter(n) {
  if (chapters[n]) return Promise.resolve();
  if (loading[n]) return loading[n];
  loading[n] = new Promise(res => {
    const s = document.createElement("script");
    s.src = `data/chapters/${String(n).padStart(3, "0")}.js`;
    s.onload = s.onerror = () => res();
    document.head.appendChild(s);
  });
  return loading[n];
}
const loadUpTo = x => Promise.all(d3.range(1, x + 1).map(loadChapter));

/* ---------- state ---------- */
const state = {
  ch: Math.min(TOTAL, Math.max(1, store.get("chapter", 1))),
  furthest: store.get("furthest", 1),
  mentions: store.get("mentions", false),
  fog: store.get("fog", true),
  trails: store.get("trails", true),
  who: "",
  k: 1,
};
const urlCh = +new URLSearchParams(location.search).get("ch");
if (urlCh >= 1 && urlCh <= TOTAL) state.ch = urlCh;  // a ?ch=N link counts as "I've read this far"
state.furthest = Math.max(state.furthest, state.ch);

const partOf = n => { let p = 1; for (const [num, start] of META.parts) if (n >= start) p = num; return p; };
const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- svg scaffolding ---------- */
const svg = d3.select("#map");
const W = () => window.innerWidth || svg.node().clientWidth, H = () => window.innerHeight || svg.node().clientHeight;

const PJ = MAPCFG.projection || { type: "conicConformal", parallels: [27, 47], rotate: [101, 0] };
const projection = ({ conicConformal: d3.geoConicConformal, conicEqualArea: d3.geoConicEqualArea, mercator: d3.geoMercator,
  equirectangular: d3.geoEquirectangular, azimuthalEqualArea: d3.geoAzimuthalEqualArea }[PJ.type] || d3.geoConicConformal)();
if (PJ.parallels && projection.parallels) projection.parallels(PJ.parallels);
if (PJ.rotate) projection.rotate(PJ.rotate);
const [[fx0, fy0], [fx1, fy1]] = MAPCFG.frame || [[-117, 18.5], [-84, 50]];
const frame = { type: "MultiPoint", coordinates: [[fx0, fy0], [fx1, fy0], [fx1, fy1], [fx0, fy1]] };
projection.fitExtent([[20, 20], [Math.max(W(), 400) - 20, Math.max(H(), 400) - 20]], frame);
const path = d3.geoPath(projection);

// Hand-drawn wobble baked into the line geometry once (cheaper than an SVG filter on every frame).
const wob = (x, y) => [
  0.55 * Math.sin(x * 0.21 + Math.cos(y * 0.17) * 2.1) + 0.3 * Math.sin(y * 0.53 + x * 0.11),
  0.55 * Math.sin(y * 0.19 + Math.cos(x * 0.23) * 1.9) + 0.3 * Math.sin(x * 0.47 - y * 0.13),
];
const inkPath = d3.geoPath(d3.geoTransform({
  point(lng, lat) { const p = projection([lng, lat]); if (!p) return; const [dx, dy] = wob(p[0], p[1]); this.stream.point(p[0] + dx, p[1] + dy); },
}));

const baseSvg = d3.select("#base");
d3.select("#paper").html(`<defs>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="3" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.08  0 0 0 -1.1 0.62"/>
  </filter>
  <filter id="stains" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="4" seed="11" result="s"/>
    <feColorMatrix in="s" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 -2.4 1.25"/>
  </filter></defs>
  <rect width="100%" height="100%" filter="url(#stains)" opacity="0.55"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.35"/>`);

baseSvg.append("defs").html(`
  <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
    <line x1="0" y1="0" x2="0" y2="5" stroke="#6b5235" stroke-width="0.8"/>
  </pattern>
  <linearGradient id="paper-land" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#efe3c4"/><stop offset="1" stop-color="#e6d4ab"/>
  </linearGradient>
`);

// layer stack: base map (svg) → fog (canvas) → places & trails (svg) → paper texture (static svg)
baseSvg.append("rect").attr("class", "sea").attr("width", "100%").attr("height", "100%").attr("fill", "#d9ccaa");
const worldBase = baseSvg.append("g");
const gBase = worldBase.append("g").attr("id", "base-lines");
const gMtn = worldBase.append("g");
const gLabels = worldBase.append("g");
const world = svg.append("g").attr("id", "world");
const gUncert = world.append("g");
const gTrails = world.append("g");
const gPlaces = world.append("g");
const gDeco = svg.append("g").attr("pointer-events", "none");

/* ---------- base map ---------- */
// D3 wants polygon rings wound the opposite way to standard GeoJSON; flip any that come out inside-out.
function rewind(fc) {
  for (const f of fc.features || [fc]) {
    const g = f.geometry || f;
    if (!g || !/Polygon/.test(g.type)) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const rings of polys) {
      if (d3.geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI) rings.forEach(r => r.reverse());
    }
  }
  return fc;
}
["land", "lakes", "mountains", "countries"].forEach(k => rewind(BM[k]));

function drawBase() {
  const land = BM.land;
  const lines = gBase.append("g").attr("class", "inkwork");
  const landD = inkPath(land);
  [[22, 0.08], [14, 0.12], [8, 0.18], [3.5, 0.3]].forEach(([w, o]) =>
    lines.append("path").attr("class", "ocean-ripple").attr("d", landD).attr("stroke-width", w).attr("opacity", o));
  lines.append("path").attr("class", "land").attr("d", landD).attr("fill-rule", "evenodd");

  // one path per layer instead of thousands of elements
  gMtn.append("path").attr("class", "mtn-area").attr("d", path(BM.mountains));
  const glyphs = gMtn.append("g").attr("id", "mtn-glyphs");
  glyphs.append("path").attr("class", "mtn-shade");
  glyphs.append("path").attr("class", "mtn-glyph");

  lines.append("path").attr("class", "lake").attr("d", inkPath(BM.lakes)).attr("fill-rule", "evenodd");
  const buckets = [[s => s <= 4, 1.7, ""], [s => s > 4 && s <= 6, 1.2, ""], [s => s > 6 && s <= 8, 0.8, ""], [s => s > 8, 0.5, "minor"]];
  for (const [test, w, cls] of buckets) {
    const feats = BM.rivers.features.filter(f => test(+f.properties.scalerank || 10));
    lines.append("path").attr("class", "river " + cls).attr("stroke-width", w)
      .attr("d", inkPath({ type: "FeatureCollection", features: feats }));
  }
  lines.append("path").attr("class", "stateline").attr("d", inkPath(BM.statelines));
  lines.append("path").attr("class", "country").attr("d", inkPath(BM.countries));

  drawRiverLabels();
  drawRegionLabels();
}

const RIVERS = MAPCFG.river_labels || [];
function drawRiverLabels() {
  const best = {};
  for (const f of BM.rivers.features) {
    const n = f.properties.name; if (!n || !RIVERS.includes(n)) continue;
    const segs = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const c of segs) { const L = d3.geoLength({ type: "LineString", coordinates: c }); if (!best[n] || L > best[n].L) best[n] = { L, c }; }
  }
  const g = gLabels.append("g").attr("id", "river-labels");
  Object.entries(best).forEach(([n, { c }], i) => {
    let pts = c.map(projection);
    if (pts[0][0] > pts[pts.length - 1][0]) pts = pts.reverse();
    const id = "rv" + i;
    g.append("path").attr("id", id).attr("d", d3.line().curve(d3.curveBasis)(pts)).attr("fill", "none");
    g.append("text").attr("class", "water-label").attr("dy", -3)
      .append("textPath").attr("href", "#" + id).attr("startOffset", "50%")
      .text(n === "Rio Grande" ? "Rio Grande" : n + " R.");
  });
}
const REGIONS = MAPCFG.region_labels || [];
const WATERS = MAPCFG.sea_labels || [];
function drawRegionLabels() {
  const g = gLabels.append("g").attr("id", "region-labels");
  g.selectAll("text.region-label").data(REGIONS).join("text").attr("class", "region-label")
    .attr("transform", d => `translate(${projection([d[1], d[2]])})`).attr("data-s", d => d[3]).text(d => d[0]);
  g.selectAll("text.sea-label").data(WATERS).join("text").attr("class", "water-label sea-label")
    .attr("transform", d => `translate(${projection([d[1], d[2]])})`).attr("data-s", d => d[3]).text(d => d[0]);
  const mtRe = MAPCFG.mountain_labels ? new RegExp(MAPCFG.mountain_labels) : null;
  const mt = mtRe ? BM.mountains.features.filter(f => mtRe.test(f.properties.NAME)) : [];
  g.selectAll("text.mtn-label").data(mt).join("text").attr("class", "mtn-label")
    .attr("transform", d => `translate(${path.centroid(d)})`).attr("data-s", d => /[A-Z]{4}/.test(d.properties.NAME) ? 13 : 10)
    .text(d => d.properties.NAME.toUpperCase().replace("MTS.", "MOUNTAINS"));
}

/* mountain glyphs: re-drawn after each zoom so they stay a sensible size */
function drawMountainGlyphs() {
  const k = state.k, t = d3.zoomTransform(svg.node());
  const step = 19 / k, s = 5.5 / k;
  const [x0, y0] = t.invert([0, 0]), [x1, y1] = t.invert([W(), H()]);
  const out = [];
  for (const f of BM.mountains.features) {
    const [[bx0, by0], [bx1, by1]] = path.bounds(f);
    const ax0 = Math.max(bx0, x0), ay0 = Math.max(by0, y0), ax1 = Math.min(bx1, x1), ay1 = Math.min(by1, y1);
    if (ax0 >= ax1 || ay0 >= ay1) continue;
    const sx = Math.floor(ax0 / step) * step, sy = Math.floor(ay0 / step) * step;
    for (let y = sy; y <= ay1; y += step) for (let x = sx; x <= ax1; x += step) {
      const row = Math.round(y / step);
      const jx = x + (row % 2 ? step / 2 : 0) + (hash(x, y) - 0.5) * step * 0.5;
      const jy = y + (hash(y, x) - 0.5) * step * 0.4;
      const ll = projection.invert([jx, jy]);
      if (ll && d3.geoContains(f, ll)) out.push([jx, jy, 0.7 + hash(jx, jy) * 0.6]);
      if (out.length > 2500) break;
    }
  }
  out.sort((a, b) => a[1] - b[1]);
  const f = v => v.toFixed(1);
  gMtn.select("path.mtn-shade").attr("d", out.map(([x, y, m]) => `M${f(x)},${f(y - s * m)}L${f(x + s * 1.1)},${f(y + s * 0.55)}L${f(x + s * 0.2)},${f(y + s * 0.55)}Z`).join(""));
  gMtn.select("path.mtn-glyph").attr("d", out.map(([x, y, m]) => `M${f(x - s * 1.1)},${f(y + s * 0.55)}L${f(x)},${f(y - s * m)}L${f(x + s * 1.1)},${f(y + s * 0.55)}`).join(""));
}
function hash(a, b) { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }

/* ---------- decorations: compass + scale ---------- */
function drawDeco() {
  gDeco.selectAll("*").remove();
  const small = W() < 700;
  const cx = small ? W() - 50 : 70, cy = small ? 120 : H() - 150, r = small ? 26 : 40;
  const c = gDeco.append("g").attr("transform", `translate(${cx},${cy})`).attr("opacity", 0.85);
  c.append("circle").attr("r", r * 0.78).attr("fill", "none").attr("stroke", "#3b2a1a").attr("stroke-width", 1);
  c.append("circle").attr("r", r * 0.7).attr("fill", "none").attr("stroke", "#3b2a1a").attr("stroke-width", 0.5);
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0, L = long ? r : r * 0.55, w = long ? r * 0.16 : r * 0.1;
    const g = c.append("g").attr("transform", `rotate(${i * 45})`);
    g.append("path").attr("d", `M0,${-L}L${w},0L0,0Z`).attr("fill", "#3b2a1a");
    g.append("path").attr("d", `M0,${-L}L${-w},0L0,0Z`).attr("fill", "#e9d9b4").attr("stroke", "#3b2a1a").attr("stroke-width", 0.6);
  }
  c.append("text").attr("y", -r - 5).attr("text-anchor", "middle").attr("font-family", "Rye, serif").attr("font-size", small ? 12 : 15).attr("fill", "#8c2f1f").text("N");
  gDeco.append("g").attr("id", "scalebar").attr("transform", `translate(${small ? 16 : cx - 50},${small ? H() - 96 : cy + r + 28})`);
  drawScale();
}
function drawScale() {
  const g = gDeco.select("#scalebar"); if (g.empty()) return;
  g.selectAll("*").remove();
  const t = d3.zoomTransform(svg.node());
  const mid = projection.invert(t.invert([W() / 2, H() / 2])) || [-100, 35];
  const a = projection(mid), b = projection([mid[0] + 1, mid[1]]);
  const pxPerMile = Math.hypot(b[0] - a[0], b[1] - a[1]) * t.k / (69.17 * Math.cos(mid[1] * Math.PI / 180));
  const nice = [10, 25, 50, 100, 200, 300, 500].find(m => m * pxPerMile > 70) || 500;
  const w = nice * pxPerMile;
  for (let i = 0; i < 4; i++) g.append("rect").attr("x", i * w / 4).attr("width", w / 4).attr("height", 5).attr("fill", i % 2 ? "#e9d9b4" : "#3b2a1a").attr("stroke", "#3b2a1a").attr("stroke-width", 0.8);
  g.append("text").attr("x", 0).attr("y", -4).attr("font-family", "IM Fell English, serif").attr("font-size", 12).attr("fill", "#3b2a1a").text("0");
  g.append("text").attr("x", w).attr("y", -4).attr("text-anchor", "middle").attr("font-family", "IM Fell English, serif").attr("font-size", 12).attr("fill", "#3b2a1a").text(nice + " miles");
}

/* ---------- derived data for chapter X ---------- */
const COLORS = ["#8c2f1f", "#2f4a7a", "#3f6b3a", "#9a6a12", "#6a3a6e", "#2d6b6b", "#7a4a2a", "#4a4a4a"];
const leadColor = new Map();  // keeps a character's color steady as chapters advance
function derive(x) {
  const places = new Map(), apps = new Map(), trailsByChar = new Map(), firstSeen = new Map(), died = new Map();
  for (let n = 1; n <= x; n++) {
    const c = chapters[n]; if (!c) continue;
    for (const m of c.died || []) died.set(m, n);
    for (const p of c.places || []) if (!places.has(p.id)) places.set(p.id, { ...p, first: n });
    for (const a of c.apps || []) {
      if (!apps.has(a.p)) apps.set(a.p, []);
      apps.get(a.p).push({ ...a, ch: n });
    }
    for (const g of c.pos || []) for (const m of g.m) {
      if (!trailsByChar.has(m)) { trailsByChar.set(m, []); firstSeen.set(m, n); }
      const T = trailsByChar.get(m), last = T[T.length - 1];
      if (!last || last.at !== g.at) T.push({ ch: n, lng: g.lng, lat: g.lat, at: g.at, rv: g.rv });
    }
  }
  // characters who are at the same place now and mostly travelled the same way share one trail line
  const clusters = [];
  const cands = [...trailsByChar].filter(([, pts]) => pts.length >= 2).sort((a, b) => b[1].length - a[1].length);
  for (const [m, pts] of cands) {
    const set = new Set(pts.map(p => p.at)), last = pts[pts.length - 1].at;
    const hit = clusters.find(c => {
      if (c.last !== last) return false;
      let shared = 0; set.forEach(a => { if (c.set.has(a)) shared++; });
      return shared / Math.min(set.size, c.set.size) >= 0.7;
    });
    if (hit) hit.members.push(m); else clusters.push({ pts, set, last, members: [m] });
  }
  const allGroups = clusters
    .map(t => ({ ...t, weight: t.pts.length * Math.sqrt(t.members.length) }))
    .sort((a, b) => b.weight - a.weight)
    .map(t => {
      t.members.sort((a, b) => firstSeen.get(a) - firstSeen.get(b));
      const lead = t.members[0];
      if (!leadColor.has(lead)) leadColor.set(lead, COLORS[leadColor.size % COLORS.length]);
      return { id: lead, color: leadColor.get(lead), pts: t.pts, members: new Set(t.members),
        label: t.members.length > 3 ? `${t.members.slice(0, 3).join(", ")} & ${t.members.length - 3} more` : t.members.join(", ") };
    });
  allGroups.forEach(g => g.coords = expandTrail(g.pts));
  // the default view shows the main living, active storylines: a party drops out once everyone in it
  // has died (it stays for the chapter of the death), or when it hasn't been seen for a dozen chapters
  const STALE = 12;
  let hiddenDead = 0, hiddenStale = 0;
  const active = allGroups.filter(g => {
    const alive = [...g.members].filter(m => !died.has(m) || died.get(m) === x);
    if (!alive.length) { hiddenDead++; return false; }
    if (x - g.pts[g.pts.length - 1].ch > STALE) { hiddenStale++; return false; }
    g.members = new Set(alive);
    return true;
  });
  const groups = active.slice(0, 8);
  const list = [];
  for (const [id, p] of places) {
    const A = apps.get(id) || [];
    if (!A.length) continue;
    const ev = A.some(a => a.t === "e");
    list.push({ ...p, apps: A, event: ev, fresh: A.some(a => a.ch === x), count: A.length,
      people: new Set(A.flatMap(a => a.c || [])) });
  }
  return { places: list, byId: places, groups, allGroups, trailsByChar, died, hiddenDead, hiddenStale };
}

/* ---------- render places / trails / fog ---------- */
let D = null;
const kmToPx = (lng, lat, km) => { const a = projection([lng, lat]), b = projection([lng, lat + km / 111]); return Math.abs(a[1] - b[1]); };

function symbol(kind) {
  switch (kind) {
    case "fort": return { d: "M-4,-4H4V4H-4Z M-4,-4V-11 M-4,-11H2L0,-9L2,-7H-4", cls: "sym" };
    case "ranch": return { d: "M-4.5,4V-1L0,-5L4.5,-1V4Z", cls: "sym" };
    case "camp": return { d: "M-5,4L0,-5L5,4Z M0,-5V4", cls: "sym" };
    case "river": case "creek": case "crossing": return { d: "M-5,-1.5Q-2.5,-4 0,-1.5T5,-1.5 M-5,2.5Q-2.5,0 0,2.5T5,2.5", cls: "sym", water: true };
    case "mountain": return { d: "M-5,4L0,-5L5,4Z", cls: "sym" };
    case "state": case "country": case "region": return { d: "M0,-5L5,0L0,5L-5,0Z", cls: "sym" };
    case "city": return { d: "M-5,0A5,5 0 1,0 5,0A5,5 0 1,0 -5,0 M-2,0A2,2 0 1,0 2,0A2,2 0 1,0 -2,0", cls: "sym", dot: true };
    default: return { d: "M-3.6,0A3.6,3.6 0 1,0 3.6,0A3.6,3.6 0 1,0 -3.6,0", cls: "sym" };
  }
}

function visiblePlaces() {
  return D.places.filter(p => !p.offmap && p.kind !== "state" && p.kind !== "country" && (p.event || state.mentions));
}

function render() {
  if (!D) return;
  const vis = visiblePlaces();
  const who = state.who;
  const k = state.k;

  // uncertainty circles for estimated positions
  gUncert.selectAll("circle").data(vis.filter(p => p.r > 0 && p.r <= 80 && p.event && p.kind !== "region"), p => p.id).join("circle")
    .attr("class", "place uncert-c")
    .attr("cx", p => projection([p.lng, p.lat])[0]).attr("cy", p => projection([p.lng, p.lat])[1])
    .attr("r", p => kmToPx(p.lng, p.lat, p.r))
    .attr("fill", "rgba(140,47,31,.04)").attr("stroke", "#8c2f1f").attr("stroke-dasharray", "2 4").attr("stroke-width", 0.8)
    .attr("vector-effect", "non-scaling-stroke").attr("pointer-events", "none")
    .attr("opacity", p => (who && !p.people.has(who)) ? 0.1 : 0.55);

  // places
  const sel = gPlaces.selectAll("g.place").data(vis, p => p.id).join(enter => {
    const g = enter.append("g").attr("class", "place").on("click", (ev, p) => { ev.stopPropagation(); openPopup(p, ev); });
    g.append("circle").attr("class", "hit").attr("r", 12);
    g.append("path").attr("class", "sym");
    g.append("text").attr("class", "lbl").attr("x", 8).attr("dy", "0.35em");
    return g;
  });
  sel.classed("mention", p => !p.event).classed("fresh", p => p.fresh)
    .classed("dim", p => who && !p.people.has(who))
    .attr("transform", p => { const [x, y] = projection([p.lng, p.lat]); return `translate(${x},${y}) scale(${1 / k})`; });
  sel.select("path.sym").attr("d", p => symbol(p.kind).d)
    .style("fill", p => symbol(p.kind).dot ? "var(--ink)" : null)
    .style("stroke", p => symbol(p.kind).water ? "var(--water)" : null);
  sel.select("text.lbl").text(p => p.name).style("font-size", p => (p.kind === "city" || p.count > 6 ? 15 : 13) + "px");
  sel.sort((a, b) => (a.event - b.event) || (a.count - b.count));
  layoutLabels(sel);

  // newly appeared this chapter: pulse once
  gPlaces.selectAll("circle.pulse").remove();
  sel.filter(p => p.fresh && p.first === state.ch).append("circle").attr("class", "pulse").attr("r", 10);

  renderTrails();
  renderFog();
  renderPanel();
}

function layoutLabels(sel) {
  const t = d3.zoomTransform(svg.node());
  const boxes = [];
  const items = sel.nodes().map(n => ({ n, p: d3.select(n).datum() }))
    .sort((a, b) => (b.p.fresh - a.p.fresh) || (b.p.event - a.p.event) || (b.p.count - a.p.count));
  for (const { n, p } of items) {
    const [x, y] = t.apply(projection([p.lng, p.lat]));
    const fs = p.kind === "city" || p.count > 6 ? 15 : 13;
    const w = p.name.length * fs * 0.48 + 10, h = fs + 2;
    const cands = [[8, 0, "start"], [-8, 0, "end"], [0, -12, "middle"], [0, 14, "middle"]];
    let placed = false;
    for (const [dx, dy, anchor] of cands) {
      const bx = anchor === "start" ? x + dx : anchor === "end" ? x + dx - w : x - w / 2;
      const by = y + dy - h / 2;
      const box = [bx, by, bx + w, by + h];
      if (!boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) {
        boxes.push(box, [x - 5, y - 5, x + 5, y + 5]);
        d3.select(n).select("text.lbl").attr("x", dx).attr("y", dy).attr("text-anchor", anchor).style("display", null);
        placed = true; break;
      }
    }
    if (!placed) d3.select(n).select("text.lbl").style("display", "none");
  }
}

function renderTrails() {
  const k = state.k;
  const groups = state.trails ? visibleTrails() : [];
  const line = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
  const proj = g => g.coords.map(c => projection(c));
  gTrails.selectAll("path.trail-under").data(groups, g => g.id).join("path").attr("class", "trail-under").attr("d", g => line(proj(g)));
  gTrails.selectAll("path.trail").data(groups, g => g.id).join("path").attr("class", "trail").attr("stroke", g => g.color).attr("d", g => line(proj(g)));
  const marks = gTrails.selectAll("g.party-mark").data(groups, g => g.id).join(enter => {
    const m = enter.append("g").attr("class", "party-mark");
    m.append("circle").attr("r", 5);
    return m;
  });
  marks.attr("transform", g => { const [x, y] = projection(g.coords[g.coords.length - 1]); return `translate(${x},${y}) scale(${1 / k})`; })
    .classed("followed", !!state.who)
    .select("circle").attr("fill", g => g.color).attr("r", state.who ? 7 : 5);
  marks.selectAll("title").data(g => [g]).join("title").text(g => g.label);
  // when following someone, label their latest position on the map
  marks.selectAll("text.party-lbl").data(g => state.who ? [g] : []).join("text").attr("class", "party-lbl")
    .attr("x", 11).attr("dy", "0.35em").text(g => `${g.label} · ch. ${g.pts[g.pts.length - 1].ch}`);
}
// move the map to the followed character's latest position
function goToFollowed() {
  const g = state.who && visibleTrails()[0];
  if (!g || !g.coords.length) return;
  const [x, y] = projection(g.coords[g.coords.length - 1]);
  svg.transition().duration(800).call(zoom.transform,
    d3.zoomIdentity.translate(W() / 2, H() / 2).scale(Math.max(state.k, 3.5)).translate(-x, -y));
}
document.addEventListener("ld:goto-who", goToFollowed);
/* trails along rivers: route between the stops before and after along the river's course */
const riverGraphs = new Map();
function riverGraph(name) {
  if (riverGraphs.has(name)) return riverGraphs.get(name);
  const nodes = new Map(), key = c => c[0].toFixed(2) + "," + c[1].toFixed(2);
  const node = c => { const k = key(c); if (!nodes.has(k)) nodes.set(k, { c, adj: [] }); return nodes.get(k); };
  for (const f of BM.rivers.features) {
    if (f.properties.name !== name) continue;
    const segs = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const seg of segs) for (let i = 1; i < seg.length; i++) {
      const a = node(seg[i - 1]), b = node(seg[i]), w = d3.geoDistance(a.c, b.c);
      a.adj.push([b, w]); b.adj.push([a, w]);
    }
  }
  const g = nodes.size ? [...nodes.values()] : null;
  riverGraphs.set(name, g);
  return g;
}
const nearestNode = (g, c) => d3.least(g, n => d3.geoDistance(n.c, c));
function riverRoute(g, from, to) {  // Dijkstra; graphs are a few hundred nodes
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  const q = [from];
  while (q.length) {
    let bi = 0; for (let i = 1; i < q.length; i++) if (dist.get(q[i]) < dist.get(q[bi])) bi = i;
    const u = q.splice(bi, 1)[0];
    if (u === to) break;
    if (done.has(u)) continue; done.add(u);
    for (const [v, w] of u.adj) {
      const d = dist.get(u) + w;
      if (d < (dist.get(v) ?? Infinity)) { dist.set(v, d); prev.set(v, u); q.push(v); }
    }
  }
  if (!dist.has(to)) return null;
  const out = []; for (let u = to; u; u = prev.get(u)) out.push(u.c);
  return out.reverse();
}
function expandTrail(pts) {
  const out = [];
  pts = dedupe(pts);
  pts.forEach((p, i) => {
    const g = p.rv && riverGraph(p.rv);
    if (!g) { out.push([p.lng, p.lat]); return; }
    const prev = out[out.length - 1], next = pts[i + 1] && [pts[i + 1].lng, pts[i + 1].lat];
    const a = nearestNode(g, prev || next || [p.lng, p.lat]);
    const b = nearestNode(g, next || prev || [p.lng, p.lat]);
    // only trust the river's line if it actually passes near the stops (same-named rivers elsewhere)
    if (d3.geoDistance(a.c, prev || next || [p.lng, p.lat]) * 6371 > 250) { out.push([p.lng, p.lat]); return; }
    const route = a === b ? [a.c] : riverRoute(g, a, b);
    if (route) out.push(...route); else out.push(a.c);
  });
  return out;
}

function visibleTrails() {
  if (!state.who) return D.groups;
  const own = D.trailsByChar.get(state.who);
  if (!own || !own.length) return [];
  const g = D.allGroups.find(g => g.members.has(state.who));
  return [{ id: "who:" + state.who, color: g ? g.color : COLORS[0], pts: own, coords: expandTrail(own), members: new Set([state.who]), label: state.who }];
}
const dedupe = pts => pts.filter((p, i) => i === 0 || p.lng !== pts[i - 1].lng || p.lat !== pts[i - 1].lat);

/* fog lives on a canvas: cheap to redraw every zoom frame */
const fogCanvas = document.getElementById("fog"), fogCtx = fogCanvas.getContext("2d");
let fogHoles = [];  // [x, y, r] in un-zoomed map pixels
const fogPattern = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 12;
  const x = c.getContext("2d");
  x.fillStyle = "#d3bd8c"; x.fillRect(0, 0, 12, 12);
  x.strokeStyle = "#b49866"; x.lineWidth = 0.8;
  x.beginPath(); for (let i = -12; i <= 12; i += 6) { x.moveTo(i, 12); x.lineTo(i + 12, 0); } x.stroke();
  return fogCtx.createPattern(c, "repeat");
})();
const holeSprite = (() => {  // soft-edged circle, stamped out of the fog
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.5, "rgba(0,0,0,.95)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
})();
function sizeFog() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fogCanvas.width = Math.round(W() * dpr); fogCanvas.height = Math.round(H() * dpr);
  fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawFog() {
  const w = W(), h = H();
  fogCtx.clearRect(0, 0, w, h);
  if (!state.fog || !D) return;
  const t = d3.zoomTransform(svg.node());
  fogCtx.globalCompositeOperation = "source-over";
  fogCtx.globalAlpha = 0.86;
  fogCtx.fillStyle = fogPattern;
  fogCtx.fillRect(0, 0, w, h);
  fogCtx.globalAlpha = 1;
  fogCtx.globalCompositeOperation = "destination-out";
  for (const [x, y, r] of fogHoles) {
    const sx = x * t.k + t.x, sy = y * t.k + t.y, sr = r * t.k;
    if (sx + sr < 0 || sy + sr < 0 || sx - sr > w || sy - sr > h) continue;
    fogCtx.drawImage(holeSprite, sx - sr, sy - sr, sr * 2, sr * 2);
  }
  fogCtx.globalCompositeOperation = "source-over";
}
function renderFog() {
  const holes = [];
  const add = (lng, lat, km) => { const [x, y] = projection([lng, lat]); holes.push([x, y, kmToPx(lng, lat, km)]); };
  for (const p of D.places) if (p.event && !p.offmap && !["state", "country", "region"].includes(p.kind)) add(p.lng, p.lat, 230);
  for (const p of D.places) if (p.event && !p.offmap && p.kind === "region") add(p.lng, p.lat, 120);
  for (const g of D.allGroups) {
    const c = g.coords;
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i], n = Math.max(1, Math.ceil(d3.geoDistance(a, b) * 6371 / 80));
      for (let j = (i === 1 ? 0 : 1); j <= n; j++) add(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, 180);
    }
  }
  fogHoles = holes;
  drawFog();
}

/* ---------- panel ---------- */
function renderPanel() {
  const x = state.ch;
  d3.select("#c-chapter").text(META.parts.length > 1 ? `Part ${roman[partOf(x)]} · Chapter ${x}` : `Chapter ${x}`);
  d3.select("#this-ch-title").text(`In Chapter ${x}`);
  const c = chapters[x];
  const items = (c?.apps || []).filter(a => a.t === "e" || state.mentions)
    .map(a => ({ a, p: D.byId.get(a.p) })).filter(d => d.p)
    .sort((m, n) => (m.a.t === "e" ? 0 : 1) - (n.a.t === "e" ? 0 : 1));
  const ul = d3.select("#this-ch");
  ul.selectAll("li").remove();
  if (!items.length) ul.append("li").attr("class", "empty").text(c ? "No places to show." : "No data for this chapter yet.");
  for (const { a, p } of items) {
    ul.append("li").attr("class", a.t === "e" ? "e" : "m")
      .html(`${esc(p.name)} <span class="k">${a.t === "e" ? "" : "mentioned"}</span>`)
      .on("click", () => flyTo(p));
  }
  const groups = visibleTrails();
  d3.select("#legend-sec").style("display", state.trails && (groups.length || state.who) ? null : "none");
  // each name is a button that follows that character
  const dagger = m => D.died.has(m) ? ` <span class="died" title="Died in chapter ${D.died.get(m)}">†</span>` : "";
  const nameBtn = m => `<button class="who-btn${m === state.who ? " on" : ""}" data-who="${esc(m)}" title="Follow ${esc(m)}">${esc(m)}</button>${dagger(m)}`;
  const names = g => {
    const ms = [...g.members];
    const open = legendOpen.has(g.id) || ms.length <= 3;
    const shown = (open ? ms : ms.slice(0, 3)).map(nameBtn).join(", ");
    return open ? shown : `${shown} <button class="more-btn" data-more="${esc(g.id)}">& ${ms.length - 3} more</button>`;
  };
  d3.select("#legend").selectAll("li").remove();  // rebuilt from scratch: rows vary in kind each render
  d3.select("#legend").selectAll("li").data(groups.length ? groups : [null]).join("li")
    .html(g => g ? `<span class="sw" style="border-color:${g.color}"></span><span>${names(g)}${g.pts.length === 1 ? " <i>(hasn't moved yet)</i>" : ""}</span>`
                 : `<span><i>No known whereabouts for ${esc(state.who)} yet.</i></span>`);
  d3.select("#legend").append("li").attr("class", "legend-all").style("display", state.who ? null : "none")
    .html(`<button class="more-btn" data-who="">← show everyone</button>`);
  if (state.who && D.died.has(state.who))
    d3.select("#legend").append("li").attr("class", "legend-note").text(`Died in chapter ${D.died.get(state.who)}.`);
  const hid = [D.hiddenDead && `${D.hiddenDead} ended by deaths`, D.hiddenStale && `${D.hiddenStale} not seen for a dozen chapters`].filter(Boolean);
  if (!state.who && hid.length)
    d3.select("#legend").append("li").attr("class", "legend-note").text(`Hidden: ${hid.join(", ")}. Use Follow to see any of them.`);

  // character list from what's been seen so far
  const people = d3.rollup(D.places.flatMap(p => p.apps.flatMap(a => a.c || [])), v => v.length, d => d);
  const withTrail = [...D.trailsByChar].filter(([, pts]) => pts.length >= 2).map(d => d[0]);
  const top = [...new Set([...[...people].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 40).map(d => d[0]), ...withTrail])].sort();
  if (state.who && !top.includes(state.who)) top.unshift(state.who);
  const s = d3.select("#opt-char");
  s.selectAll("option.p").data(top, d => d).join("option").attr("class", "p").attr("value", d => d).text(d => D.died.has(d) ? d + " †" : d);
  s.property("value", state.who);
  // tell the character card (people.js) who is followed and where they were last placed
  const seenPts = state.who && D.trailsByChar.get(state.who), seen = seenPts && seenPts[seenPts.length - 1];
  document.dispatchEvent(new CustomEvent("ld:render", { detail: { ch: state.ch, who: state.who,
    lastSeen: seen ? { name: D.byId.get(seen.at)?.name || seen.at.replace(/-/g, " "), ch: seen.ch } : null } }));
}

/* ---------- popup ---------- */
function openPopup(p, ev) {
  gPlaces.selectAll("g.place").classed("selected", d => d.id === p.id);
  const A = [...p.apps].sort((a, b) => b.ch - a.ch).filter(a => a.t === "e" || state.mentions || !p.event);
  const kindName = { river: "River", creek: "Creek", crossing: "Crossing", fort: "Fort", town: "Town", city: "City", ranch: "Ranch", camp: "Camp", region: "Region", state: "State or territory", country: "Country", mountain: "Mountains", other: "Place" }[p.kind] || "Place";
  d3.select("#popup-body").html(`
    <h3>${esc(p.name)}</h3>
    <div class="meta">${kindName} · first seen in chapter ${p.first}${p.fictional || p.r > 0 ? ` · <span class="fic">position estimated${p.r ? ` (±${Math.round(p.r * 0.62)} mi)` : ""}</span>` : ""}</div>
    <ol>${A.map(a => `<li class="${a.t === "e" ? "e" : "m"}"><span class="ch">Ch. ${a.ch}</span> — ${esc(a.note)}${a.c?.length ? `<div class="who">${esc(a.c.join(", "))}</div>` : ""}</li>`).join("")}</ol>`);
  const pop = document.getElementById("popup");
  pop.hidden = false;
  const r = pop.getBoundingClientRect();
  let x = (ev?.clientX ?? W() / 2) + 16, y = (ev?.clientY ?? H() / 2) - 30;
  if (x + r.width > W() - 12) x = (ev?.clientX ?? W() / 2) - r.width - 16;
  y = Math.max(12, Math.min(y, H() - r.height - 100));
  pop.style.left = Math.max(12, x) + "px"; pop.style.top = y + "px";
}
function closePopup() { document.getElementById("popup").hidden = true; gPlaces.selectAll("g.place").classed("selected", false); }
d3.select("#popup-close").on("click", closePopup);
svg.on("click", closePopup);

/* ---------- zoom ---------- */
let lastK = null;
const zoom = d3.zoom().scaleExtent([0.6, 40])
  .on("start", () => closePopup())
  .on("zoom", ev => {
    const t = ev.transform;
    world.attr("transform", t);
    worldBase.attr("transform", t);
    state.k = t.k;
    drawFog();
    if (t.k !== lastK) {  // size-dependent work only when the zoom level changes, not while panning
      lastK = t.k;
      const k = t.k;
      gPlaces.selectAll("g.place").attr("transform", p => { const [x, y] = projection([p.lng, p.lat]); return `translate(${x},${y}) scale(${1 / k})`; });
      gTrails.selectAll("g.party-mark").attr("transform", g => { const [x, y] = projection(g.coords[g.coords.length - 1]); return `translate(${x},${y}) scale(${1 / k})`; });
      gLabels.selectAll(".region-label, .sea-label, .mtn-label").style("font-size", function () { return (+this.dataset.s / Math.pow(k, 0.6)) + "px"; });
      gLabels.selectAll("#river-labels text").style("font-size", (12 / Math.pow(k, 0.85)) + "px");
      gBase.classed("river-minor-off", k < 2.5);
      d3.select("#hatch").attr("patternTransform", `rotate(40) scale(${1 / k})`);
    }
    drawScale();
  })
  .on("end", () => {
    drawMountainGlyphs();
    if (D) layoutLabels(gPlaces.selectAll("g.place"));
  });
svg.call(zoom).on("dblclick.zoom", null);

function flyTo(p, k = Math.max(state.k, 4)) {
  const [x, y] = projection([p.lng, p.lat]);
  svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity.translate(W() / 2, H() / 2 - 40).scale(k).translate(-x, -y))
    .on("end", () => {
      const node = gPlaces.selectAll("g.place").filter(d => d.id === p.id).node();
      const b = node?.getBoundingClientRect();
      openPopup(p, b ? { clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 } : null);
    });
}
function fitToEvents() {
  const pts = D.places.filter(p => p.event && !p.offmap && !["state", "country", "region", "river"].includes(p.kind)).map(p => projection([p.lng, p.lat]));
  if (pts.length < 2) return;
  const [x0, x1] = d3.extent(pts, d => d[0]), [y0, y1] = d3.extent(pts, d => d[1]);
  const pad = 160, k = Math.min(4.5, Math.max(0.8, Math.min((W() - pad * 2) / Math.max(x1 - x0, 1), (H() - pad * 2) / Math.max(y1 - y0, 1))));
  svg.call(zoom.transform, d3.zoomIdentity.translate(W() / 2, H() / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
}

/* ---------- chapter controls ---------- */
const slider = document.getElementById("slider"), num = document.getElementById("ch-num");
slider.max = num.max = TOTAL;
d3.select("#part-ticks").selectAll("span").data(META.parts.length > 1 ? META.parts : []).join("span")
  .style("left", d => ((d[1] - 1) / (TOTAL - 1) * 100) + "%").text(d => "Part " + roman[d[0]]);

async function setChapter(n, { ask = true } = {}) {
  n = Math.max(1, Math.min(TOTAL, Math.round(n) || 1));
  if (ask && n > state.furthest + 1) {
    const ok = await confirmJump(n);
    if (!ok) { slider.value = num.value = state.ch; return; }
  }
  state.ch = n;
  state.furthest = Math.max(state.furthest, n);
  store.set("chapter", n); store.set("furthest", state.furthest);
  slider.value = num.value = n;
  await loadUpTo(n);
  if (state.ch !== n) return;
  D = derive(n);
  render();
}
function confirmJump(n) {
  return new Promise(res => {
    d3.select("#confirm-text").text(WORD.jump_confirm.replace("{n}", n).replace("{furthest}", state.furthest));
    const box = document.getElementById("confirm");
    box.hidden = false;
    const done = v => { box.hidden = true; res(v); };
    document.getElementById("confirm-yes").onclick = () => done(true);
    document.getElementById("confirm-no").onclick = () => done(false);
  });
}
slider.addEventListener("input", () => num.value = slider.value);
slider.addEventListener("change", () => setChapter(+slider.value));
num.addEventListener("change", () => setChapter(+num.value));
document.getElementById("prev").onclick = () => setChapter(state.ch - 1);
document.getElementById("next").onclick = () => setChapter(state.ch + 1);
document.addEventListener("keydown", e => {
  if (e.target.matches("input, select")) return;
  if (e.key === "ArrowLeft") setChapter(state.ch - 1);
  if (e.key === "ArrowRight") setChapter(state.ch + 1);
  if (e.key === "Escape") closePopup();
});

/* ---------- options ---------- */
const bindOpt = (id, key) => {
  const el = document.getElementById(id); el.checked = state[key];
  el.addEventListener("change", () => { state[key] = el.checked; store.set(key, el.checked); render(); });
};
bindOpt("opt-mentions", "mentions"); bindOpt("opt-fog", "fog"); bindOpt("opt-trails", "trails");
document.getElementById("opt-char").addEventListener("change", e => { state.who = e.target.value; render(); goToFollowed(); });
// clicking a name in the Parties list follows that character; clicking them again (or "show everyone") stops
const legendOpen = new Set();
document.getElementById("legend").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.more !== undefined) { legendOpen.add(b.dataset.more); renderPanel(); return; }
  if (b.dataset.who !== undefined) {
    state.who = b.dataset.who === state.who ? "" : b.dataset.who;
    render();
    goToFollowed();
  }
});
const panel = document.getElementById("panel");
if (W() < 700) panel.classList.add("collapsed");
document.getElementById("panel-toggle").onclick = () => {
  panel.classList.toggle("collapsed");
  document.getElementById("panel-toggle").setAttribute("aria-expanded", !panel.classList.contains("collapsed"));
};

/* ---------- go ---------- */
drawBase();
drawDeco();
sizeFog();
window.addEventListener("resize", () => { drawDeco(); drawMountainGlyphs(); sizeFog(); drawFog(); });
setChapter(state.ch, { ask: false }).then(() => { fitToEvents(); drawMountainGlyphs(); });
})();
