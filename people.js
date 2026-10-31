/* Character blurbs for the "Follow" feature.
   Blurbs live in data/people/NNN.js; only files up to the reader's chapter are loaded.
   app.js fires "ld:render" with { ch, who, lastSeen } after each redraw. */
(() => {
"use strict";
const blurbs = {};  // chapter -> { name: { text, kind } }
window.LD_PEOPLE = { add(d) { blurbs[d.n] = d.b; } };

const loading = {};
function load(n) {
  if (blurbs[n]) return Promise.resolve();
  return loading[n] || (loading[n] = new Promise(res => {
    const s = document.createElement("script");
    s.src = `data/people/${String(n).padStart(3, "0")}.js`;
    s.onload = s.onerror = () => res();
    document.head.appendChild(s);
  }));
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// newest blurb for this character written at or before chapter ch
function latest(who, ch) {
  for (let n = ch; n >= 1; n--) if (blurbs[n] && blurbs[n][who]) return { n, ...blurbs[n][who] };
  return null;
}

let req = 0;
document.addEventListener("ld:render", async e => {
  const { ch, who, lastSeen } = e.detail;
  const card = document.getElementById("who-card");
  if (!card) return;
  if (!who) { card.hidden = true; return; }
  const my = ++req;
  await Promise.all(Array.from({ length: ch }, (_, i) => load(i + 1)));
  if (my !== req) return;  // a newer request arrived while loading
  const b = latest(who, ch);
  const seen = lastSeen ? `<button class="who-seen" title="Show on map">📍 Last seen: ${esc(lastSeen.name)} <span>(ch. ${lastSeen.ch})</span></button>` : "";
  card.innerHTML = `<h3>${esc(who)}</h3>` +
    (b ? `<div class="who-asof">${b.kind === "intro" ? `First met in chapter ${b.n}` : `As of chapter ${b.n}`}</div><p>${esc(b.text)}</p>`
       : `<p class="who-none">No description yet.</p>`) + seen;
  card.hidden = false;
});
// "Last seen" jumps the map to the character's latest position (handled in app.js)
document.addEventListener("click", e => {
  if (e.target.closest("#who-card .who-seen")) document.dispatchEvent(new Event("ld:goto-who"));
});
})();
