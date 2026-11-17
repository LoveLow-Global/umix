// um!x alpha app
//
// Built on the design prototype, with the same screens and the same look. What changed:
//   * three layers only: music, visual/fashion, and film/TV
//   * film/TV suggestions come from the trained multi-layer GCN (engine.js), not tag matching
//   * the catalogue comes from the model file, so the app and the model share item ids
//   * one first map instead of two (pilot finding 01), a short map tutorial (finding 02),
//     linked apps bring in only a few top items (finding 03)
//   * the facilitator panel shows which engine runs (Julia API or in the browser) and it
//     can no longer fake recommendations
// Other people's maps (the social layer) are still sample data, like in the prototype.

import { createEngine } from './engine.js';

/* ---------- catalogue (filled from the model file) ---------- */
let CAT = {};
let ENGINE = null;
const LAYERS = ['music', 'visual', 'film'];
const LAYER_OF = { music: 'music', image: 'visual', fashion: 'visual', film: 'film' };
const FILTERS = [['all', 'All'], ['music', 'Music'], ['visual', 'Visual'], ['film', 'Film & TV']];
const CUSTOM = [['music', 'Song'], ['image', 'Image'], ['fashion', 'Fashion'], ['film', 'Film']];
function shapeOf(kind, dom) {
  if (dom === 'music') return 'music';
  if (dom === 'visual') return kind === 'Fashion' ? 'fashion' : 'image';
  return 'film';
}
function loadCatalog(model) {
  CAT = {};
  for (const d of LAYERS) for (const it of model.items[d])
    CAT[it.id] = { id: it.id, t: shapeOf(it.kind, d), d, kind: it.kind, title: it.title, by: it.by, tags: it.tags };
}

/* ---------- sample social data (made up, like in the prototype) ---------- */
const PEOPLE = {
  mina: { h: '@mina.k', board: 'Rainy library', items: ['rain', 'ad', 'bks', 'cafes', 'trc', 'ber', 'gym', 'lit'] },
  dohyun: { h: '@dohyun', board: 'Slow cinema', items: ['itm', 'as', 'pl', 'hol', 'ofp', 'ttn'] },
  seoy: { h: '@seo.y', board: 'Loud summer', items: ['mm', 'bib', 'mr', 'sea', 'road', 'bts', 'crw'] },
  jiwoo: { h: '@jiwoo', board: 'Quiet mornings', items: ['fth', 'hol', 'win', 'snow', 'cdl', 'lin', 'pd'] },
  hana: { h: '@hana.p', board: 'Film club', items: ['fh', 'lw', 'lll', 'pat', 'bss', 'dsk', 'tot2'] },
  tae: { h: '@tae.k', board: 'Night drive', items: ['ic', 'tok', 'br', 'road', 'ncl', 'blj', 'drv'] }
};
const FOLLOWERS = ['mina', 'jiwoo', 'hana', 'tae', 'seoy'];
const ACC = [
  { k: 'spotify', name: 'Spotify', t: 'music', sub: 'Brings your 3 most played songs', items: ['pw', 'ms', 'sc'] },
  { k: 'pinterest', name: 'Pinterest', t: 'image', sub: 'Brings 2 pictures from your top board', items: ['sun', 'rain'] }
];
// either/or questions: every answer is a real catalogue item that lands on the first map
const QS = [
  { a: { t: 'AC/DC', s: 'Leather, volume, no notes', g: 'music', items: ['bib'] }, b: { t: 'Taylor Swift', s: 'Bridges, cardigans, lore', g: 'music', items: ['car'] } },
  { a: { t: 'Sunrise', s: 'First train, cold coffee', g: 'image', items: ['sun'] }, b: { t: '3 a.m.', s: 'Neon, taxis, one more song', g: 'image', items: ['neo'] } },
  { a: { t: 'A cream knit sweater', s: 'Soft, warm, a little too big', g: 'fashion', items: ['ckn'] }, b: { t: 'A black leather jacket', s: 'Zipped up, scuffed on purpose', g: 'fashion', items: ['blj'] } },
  { a: { t: 'A rainy café', s: 'Window seat, no plans', g: 'image', items: ['cafes'] }, b: { t: 'A seaside road trip', s: 'Windows down, sand in the car', g: 'image', items: ['sea'] } },
  { a: { t: 'Nujabes on loop', s: 'Rain on the window, homework open', g: 'music', items: ['ad'] }, b: { t: 'MGMT, loud', s: 'Windows down, singing badly', g: 'music', items: ['kds'] } },
  { a: { t: 'Round wire glasses', s: 'A good pen, a worse memory', g: 'fashion', items: ['rwg'] }, b: { t: 'A bucket hat', s: 'Sunscreen and a festival wristband', g: 'fashion', items: ['bkt'] } }
];
const NOTES = ['Noted. Your map just got a little louder.', 'The map is listening.', 'That tells us a lot.', 'Interesting. Keep going.', 'Almost there.', 'That’s everything we need.'];

/* ---------- state ---------- */
const KEY = 'umix-alpha-v1';
const ENGINE_KEY = 'umix-engine';
function fresh() {
  return { step: 'welcome', qi: 0, answers: [], links: { spotify: true, pinterest: true },
    tab: 'board', cur: 0, boards: [], settings: false, priv: { profile: 'public', share: 'anon', rhyme: true },
    dfilt: 'all', atype: 'all', aq: '', addTo: 0, viewing: null, follow: { mina: true, hana: true }, custom: [], newId: null,
    picking: false, flist: null, seenTutorial: false,
    me: { name: 'Your name', handle: '@you', bio: 'Songs, pictures and films I keep coming back to.' } };
}
let S = fresh();
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.step) { S = Object.assign(fresh(), s); S.picking = false; }
  } catch (e) { /* private mode or blocked storage, start fresh */ }
  S.custom.forEach(c => { CAT[c.id] = c; });
  S.boards.forEach(b => { b.items = b.items.filter(id => CAT[id]); b.dismissed = (b.dismissed || []).filter(id => CAT[id]); });
  if (S.cur >= S.boards.length) S.cur = 0;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, S, { newId: null }))); } catch (e) { /* ignore */ } }

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = n => (+n).toFixed(1);
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const cur = () => S.boards[S.cur];

/* ---------- icons ---------- */
const I = {
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v9h14v-9h-1"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  search: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  checkc: '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--label)"/><path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tabMap: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="9" r="2.4"/><circle cx="11" cy="18" r="2.4"/><path d="M8.3 8 Q13 6 15.6 8.4M7 9.3 Q8 14 9.6 16M16.8 11.2 Q15 15 13.3 16.9"/></svg>',
  tabDisc: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="10" r="5.5"/><circle cx="17" cy="15.5" r="3.5"/><circle cx="16.5" cy="5" r="1.8"/></svg>',
  tabAcc: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M5.8 18.6c1.3-2.4 3.5-3.6 6.2-3.6s4.9 1.2 6.2 3.6"/></svg>'
};

/* ---------- glyphs: one shape per kind of save ---------- */
function glyph(t, r, ghost, col) {
  const c = col || `var(--${t})`, op = ghost ? .25 : .9, sw = ghost ? 1 : 1.4, d = ghost ? ' stroke-dasharray="3 3"' : ''; let s = '';
  if (t === 'film') s = `<circle r="${f(r * .6)}" fill="${c}" fill-opacity="${op}"/><circle r="${f(r)}" fill="none" stroke="${c}" stroke-width="${sw}"${d}/>`;
  else if (t === 'music') { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; s += `<line x1="${f(Math.cos(a) * r * .38)}" y1="${f(Math.sin(a) * r * .38)}" x2="${f(Math.cos(a) * r)}" y2="${f(Math.sin(a) * r)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-opacity="${ghost ? .55 : 1}"/>`; } s += `<circle r="${f(r * .24)}" fill="${c}" fill-opacity="${op}"/>`; }
  else if (t === 'fashion' || t === 'thing') { const p = [0, 1, 2].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return `${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}`; }).join(' '); s = `<polygon points="${p}" fill="${c}" fill-opacity="${op * .85}" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"${d}/>`; }
  else { for (let i = 0; i < 5; i++) s += `<ellipse cy="${f(-r * .52)}" rx="${f(r * .3)}" ry="${f(r * .5)}" transform="rotate(${i * 72})" fill="${c}" fill-opacity="${op * .72}" stroke="${c}" stroke-width="${sw * .8}"${d}/>`; s += `<circle r="${f(r * .16)}" fill="#fff"/>`; }
  return s;
}
const icon = (t, size, ghost) => `<svg width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" aria-hidden="true">${glyph(t, size / 2 - 2, ghost)}</svg>`;
function flower(size) {
  const cols = ['film', 'music', 'book', 'thing', 'image'];
  const p = cols.map((c, i) => `<ellipse cy="-5.4" rx="3.3" ry="5.6" fill="var(--${c})" fill-opacity=".92" transform="rotate(${i * 72})"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true"><g transform="rotate(18)">${p}</g><circle r="1.9" fill="var(--bg)"/></svg>`;
}
const logo = (size) => `<button class="logo" data-act="wm" aria-label="um!x">${flower(size || 30)}</button>`;

/* ---------- the model ---------- */
// The engine returns every film ranked for a map. Answers are cached per map state, so
// the Julia API is only asked again when the map really changes.
const RECS = new Map();
const PENDING = { recs: [], weights: { music: .5, visual: .5 }, used: { music: 0, visual: 0 }, pending: true };
const sigOf = b => b.items.join(',') + '|' + b.dismissed.join(',');
const modelInput = b => b.items.filter(id => CAT[id] && !CAT[id].custom);
function recsOf(b) {
  if (!b) return PENDING;
  const sig = sigOf(b), hit = RECS.get(sig);
  if (hit) return hit;
  const ids = modelInput(b), opts = { k: 500, exclude: b.dismissed };
  if (ENGINE.sync) { const r = ENGINE.recommendNow(ids, opts); RECS.set(sig, r); return r; }
  RECS.set(sig, PENDING);
  ENGINE.recommend(ids, opts).then(r => { RECS.set(sig, r); render(); }).catch(err => {
    console.warn('The Julia engine did not answer, using the browser engine', err);
    RECS.set(sig, ENGINE.recommendNow(ids, opts)); render();
  });
  return PENDING;
}
// every film for a map, best first: { id, s (0..1 match), score, from (the save behind it), shared tags }
function ranked(b) {
  return recsOf(b).recs.filter(r => CAT[r.id]).map(r => ({ id: r.id, s: r.match, score: r.score, from: r.because, shared: r.shared || [] }));
}
const hunches = b => ranked(b).slice(0, 3);
const onAnyMap = () => new Set(S.boards.flatMap(x => x.items));
function discoverList(b) { const mine = onAnyMap(); return ranked(b).filter(x => !mine.has(x.id)); }
function why(x) {
  if (x && x.from && CAT[x.from]) {
    const src = CAT[x.from];
    return `People who saved ${src.title} also kept this` + (x.shared.length ? `. You both seem to like things that feel ${x.shared.slice(0, 2).join(' and ')}.` : '.');
  }
  return 'Popular with people who are just starting their maps. Save a few songs or pictures and this gets personal.';
}
function balanceText(r) {
  if (r.pending) return 'Asking the engine…';
  const m = Math.round(r.weights.music * 100);
  if (!r.used.music && !r.used.visual) return 'Nothing to read yet. Add songs, pictures or clothes and the picks get personal.';
  if (!r.used.visual) return 'Right now only your songs steer these picks.';
  if (!r.used.music) return 'Right now only your pictures and clothes steer these picks.';
  return `On this map your songs count ${m}% and your pictures and clothes ${100 - m}%.`;
}
const conf = s => `<div class="conf"><span>Match</span><span class="bar"><i style="width:${Math.round(s * 100)}%"></i></span><span>${s > .8 ? 'Strong' : s > .5 ? 'Good' : 'Worth a try'}</span></div>`;
function quizItems() {
  const out = [];
  S.answers.forEach((a, i) => {
    if (!a || !QS[i]) return;
    if (a === 'a' || a === 'both') out.push(...QS[i].a.items);
    if (a === 'b' || a === 'both') out.push(...QS[i].b.items);
  });
  return out;
}
function seedBoards() {
  const items = [];
  ACC.forEach(a => { if (S.links[a.k]) items.push(...a.items); });
  items.push(...quizItems());
  S.boards = [{ name: 'My first map', items: [...new Set(items)].filter(id => CAT[id]), dismissed: [] }];
  S.cur = 0; S.addTo = 0;
}
const vis = b => S.priv.profile === 'only me' ? 'only me' : (b.vis || 'public');
const VISL = { 'public': 'Everyone', 'followers': 'Followers', 'only me': 'Only me' };

/* ---------- map drawing ---------- */
function cv(a, b, k) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y; return `M${f(a.x)},${f(a.y)} Q${f(mx - dy * k)},${f(my + dx * k)} ${f(b.x)},${f(b.y)}`; }
function mapSVG(ids, hun, o = {}) {
  ids = ids.filter(id => CAT[id]);
  const W = 350, H = 470, C = { x: 175, y: 238 }, n = ids.length;
  const rx = n <= 6 ? 100 : 112, ry = n <= 6 ? 132 : 150, off = n % 2 ? 0 : 18;
  const P = {};
  ids.forEach((id, i) => { const a = (-90 + i * 360 / n + off) * Math.PI / 180; P[id] = { x: C.x + rx * Math.cos(a), y: C.y + ry * Math.sin(a) }; });
  const Hs = hun.map((h, j) => {
    // spread the rings between saves; with fewer saves than rings, give each ring its own slot
    const slots = Math.max(n, hun.length), g = n >= hun.length ? Math.floor(j * n / hun.length) + .5 : j + .25;
    const a = (-90 + g * 360 / slots + off) * Math.PI / 180; return Object.assign({}, h, { x: C.x + 126 * Math.cos(a), y: C.y + 196 * Math.sin(a), r: 9 + 8 * h.s });
  });
  let s = '';
  ids.forEach((id, i) => s += `<path d="${cv(C, P[id], .14)}" pathLength="1" class="draw" style="--d:${i * .05}s" fill="none" stroke="var(--label)" stroke-opacity=".3" stroke-width="1"/>`);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = CAT[ids[i]], b = CAT[ids[j]]; const sh = a.tags.filter(t => b.tags.includes(t)).length;
    if (sh) s += `<path d="${cv(P[ids[i]], P[ids[j]], (i + j) % 2 ? .22 : -.22)}" fill="none" stroke="var(--label)" stroke-opacity="${f(Math.min(.26, .08 + sh * .06))}"/>`;
  }
  Hs.forEach(h => { const src = h.from && P[h.from] ? P[h.from] : C; s += `<path d="${cv(src, h, .16)}" fill="none" stroke="var(--${CAT[h.id].t})" stroke-opacity=".65" stroke-width="1" stroke-dasharray="2 4" stroke-linecap="round"/>`; });
  const label = (x, y, t, w, c) => `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-size="11" font-weight="${w || 500}" fill="${c || 'var(--label)'}" stroke="var(--bg2)" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(trunc(t, 18))}</text>`;
  Hs.forEach((h, i) => {
    const c = CAT[h.id];
    s += `<g class="node" role="button" tabindex="0" data-act="${o.peek ? 'peek-item' : 'hunch'}" data-id="${h.id}" aria-label="Suggestion: ${esc(c.title)}"><g transform="translate(${f(h.x)},${f(h.y)})"><g class="bloom" style="--d:${.4 + i * .15}s">
      <circle class="hit" r="${f(h.r + 10)}"/><circle class="pulse" r="${f(h.r)}" fill="var(--${c.t})" fill-opacity=".08" stroke="var(--${c.t})" stroke-opacity=".7" stroke-width="1" stroke-dasharray="2.5 3"/>${glyph(c.t, h.r * .42, true)}</g></g>
      ${label(h.x, h.y + h.r + 14, c.title, 400, 'var(--label2)')}</g>`;
  });
  ids.forEach((id, i) => {
    const c = CAT[id], p = P[id], isNew = o.newId === id;
    s += `<g class="node" role="button" tabindex="0" data-act="${o.peek ? 'peek-item' : 'item'}" data-id="${id}" aria-label="${esc(c.title)}, ${c.kind}"><g transform="translate(${f(p.x)},${f(p.y)})"><g class="bloom" style="--d:${isNew ? 0 : .1 + i * .05}s">
      <circle class="hit" r="24"/>${glyph(c.t, isNew ? 13 : 11)}</g></g>${label(p.x, p.y + 26, c.title)}</g>`;
  });
  s += `<circle cx="${C.x}" cy="${C.y}" r="5" fill="var(--label)"/><text x="${C.x + 11}" y="${C.y - 8}" font-family="var(--serif)" font-style="italic" font-size="15" fill="var(--label)" stroke="var(--bg2)" stroke-width="5" paint-order="stroke">${esc(o.center || 'You')}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Map">${s}</svg>`;
}

/* ---------- shared bits ---------- */
const backBtn = (act, to) => `<button class="glass circ" data-act="${act}" ${to ? `data-to="${to}"` : ''} aria-label="Back">${I.back}</button>`;
function fhdr(right) { return `<div class="edge" id="edge"></div><div class="top float"><span class="fadelogo" id="flogo">${logo()}</span>${right}</div>`; }
function searchResults(q) {
  const box = $('#sres'); if (!box) return; q = q.trim().toLowerCase(); if (!q) { box.hidden = true; box.innerHTML = ''; return; }
  const L = Object.values(CAT).filter(c => (c.title + ' ' + c.by + ' ' + c.tags.join(' ')).toLowerCase().includes(q)).slice(0, 14);
  box.hidden = false;
  box.innerHTML = L.length ? L.map(c => `<button class="irow" data-act="disc" data-id="${c.id}"><span style="width:46px;flex-shrink:0">${cover(c)}</span><span class="m"><b>${esc(c.title)}</b><span>${esc(c.by)} · ${c.kind}</span></span></button>`).join('') : `<p class="sub" style="padding:16px 4px">Nothing called “${esc(q)}” yet.</p>`;
}
function openSearch(on) {
  const sb = $('#sbox'); if (!sb) return; const i = $('#dq'), lg = $('#flogo');
  if (on) { sb.classList.add('open'); i.tabIndex = 0; if (lg) lg.style.opacity = 0; setTimeout(() => i.focus(), 60); if (i.value) searchResults(i.value); }
  else { sb.classList.remove('open'); i.value = ''; i.tabIndex = -1; searchResults(''); onScrollFx(); }
}
function onScrollFx() {
  const sc = $('.scroll.under'); if (!sc) return; const y = sc.scrollTop, lg = $('#flogo'), ed = $('#edge'), open = $('#sbox') && $('#sbox').classList.contains('open');
  if (lg) lg.style.opacity = open ? 0 : Math.max(0, 1 - y / 36); if (ed) ed.style.opacity = Math.min(1, y / 24);
}
function hdr(left, right) { return `<div class="top">${left || '<span style="width:44px"></span>'}<div class="r">${right || ''}</div></div>`; }
function segc(act, curv, opts, label) { return `<div class="segc" role="tablist" aria-label="${label}">${opts.map(([v, l]) => `<button role="tab" data-act="${act}" data-v="${v}" aria-selected="${curv === v}">${l}</button>`).join('')}</div>`; }
function common(k) {
  const mine = onAnyMap(); const n = PEOPLE[k].items.filter(i => mine.has(i)).length;
  if (n) return `${n} thing${n > 1 ? 's' : ''} in common`;
  const myt = new Set([...mine].filter(i => CAT[i]).flatMap(i => CAT[i].tags));
  const t = PEOPLE[k].items.filter(i => CAT[i]).flatMap(i => CAT[i].tags).find(x => myt.has(x));
  return t ? `You both like ${t} things` : 'Something new for you';
}

/* ---------- onboarding ---------- */
function welcomeField() {
  let r = 7, s = ''; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; const pts = []; let tries = 0;
  const kinds = ['music', 'image', 'fashion', 'film'];
  while (pts.length < 22 && tries++ < 4000) {
    const p = { x: 24 + rnd() * 354, y: 70 + rnd() * 560, r: 3.5 + Math.pow(rnd(), 2) * 8, t: kinds[Math.floor(rnd() * 4)] };
    if (Math.abs(p.x - 201) < 165 && Math.abs(p.y - 400) < 130) continue;
    if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > q.r + p.r + 30)) pts.push(p);
  }
  pts.forEach((p, i) => {
    const nb = pts.map((q, j) => ({ j, d: Math.hypot(q.x - p.x, q.y - p.y) })).filter(o => o.j > i).sort((a, b) => a.d - b.d)[0];
    if (nb && nb.d < 170) s += `<path d="${cv(p, pts[nb.j], .2)}" fill="none" stroke="var(--label)" stroke-opacity=".1"/>`;
  });
  pts.forEach((p, i) => s += `<g transform="translate(${f(p.x)},${f(p.y)})"><g class="bloom" style="--d:${(i % 12) * .06}s">${glyph(p.t, p.r)}</g></g>`);
  return `<svg class="wfield" viewBox="0 0 402 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
}
function renderOnb() {
  if (S.step === 'welcome') return `<div class="onb welcome">${welcomeField()}
    <div class="wcenter"><button class="logo" data-act="wm" aria-label="um!x" style="width:96px;height:96px">${flower(92)}</button>
    <h1 class="lt" style="font-size:38px">Your taste,<br><i>on one map.</i></h1><p class="body" style="color:var(--label2);max-width:300px">Save songs, pictures and clothes you love. um!x finds films and series that feel the same.</p></div>
    <div class="foot"><button class="btn prim block" data-act="go" data-to="connect">Get started</button>
    <p class="fine">Alpha for user testing. Nothing you tap leaves this device.</p></div></div>`;
  if (S.step === 'connect') {
    const any = Object.values(S.links).some(Boolean);
    return hdr(backBtn('go', 'welcome')) +
      `<div class="onb"><p class="fn" style="margin-top:12px">Step 1 of 2</p><h1 class="lt" style="margin-top:6px">Bring your taste <i>with you</i></h1>
    <p class="sub" style="margin-top:10px;font-size:17px">Link the apps where you already save things. We only bring a few top picks, and you choose what stays.</p>
    <div class="group" style="margin-top:32px">${ACC.map(a => `<button class="li ind" data-act="link" data-k="${a.k}" aria-pressed="${!!S.links[a.k]}"><span class="tile">${icon(a.t, 26)}</span><span class="m"><b>${a.name}</b><span>${a.sub}</span></span>
      <span class="v" style="color:${S.links[a.k] ? 'var(--label)' : 'var(--tint)'}">${S.links[a.k] ? I.check + ' Linked' : 'Link'}</span></button>`).join('')}</div>
    <div class="foot"><button class="btn prim block" data-act="go" data-to="quiz">${any ? 'Continue' : 'Continue without linking'}</button></div></div>`;
  }
  if (S.step === 'quiz') {
    const q = QS[S.qi], a = S.answers[S.qi];
    const card = (k, o) => `<button class="choice" data-act="pick" data-v="${k}" aria-pressed="${a === k}"><span class="gt">${icon(o.g, 36)}</span><span style="min-width:0"><b>${o.t}</b><span class="s">${o.s}</span></span>${a === k ? `<span class="ck">${I.checkc}</span>` : ''}</button>`;
    const note = a ? (a === 'both' ? 'A person of range. Respect.' : a === 'neither' ? 'Fair. We’ll find your thing elsewhere.' : NOTES[S.qi]) : 'Go with your gut.';
    return `<div class="top">${backBtn('qback')}<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${QS.length}" aria-valuenow="${S.qi + 1}" aria-label="Question ${S.qi + 1} of ${QS.length}"><i style="width:${(S.qi + 1) / QS.length * 100}%"></i></div><button class="tbtn" data-act="pick" data-v="skip">Skip</button></div>
    <div class="onb"><p class="fn" style="margin-top:12px">Step 2 of 2 · Question ${S.qi + 1} of ${QS.length}</p>
    <h1 class="lt" style="margin-top:6px">Which do you like <i>more?</i></h1>
    <div style="position:relative;display:flex;flex-direction:column;gap:12px;margin-top:28px">${card('a', q.a)}${card('b', q.b)}<span class="ordot glass" aria-hidden="true">or</span></div>
    <div class="alt"><button data-act="pick" data-v="both" aria-pressed="${a === 'both'}">I like both</button><button data-act="pick" data-v="neither" aria-pressed="${a === 'neither'}">Neither</button></div>
    <div class="foot"><p class="sub" style="text-align:center" aria-live="polite">${note}</p></div></div>`;
  }
  if (S.step === 'building') {
    let s = '';
    ['music', 'image', 'fashion', 'film'].forEach((t, i) => {
      const a = (i * 90 - 90) * Math.PI / 180, x = Math.cos(a) * 92, y = Math.sin(a) * 92;
      s += `<path d="M0,0 Q${f(x * .5 - y * .2)},${f(y * .5 + x * .2)} ${f(x)},${f(y)}" pathLength="1" class="draw" style="--d:${.2 + i * .25}s" fill="none" stroke="var(--label)" stroke-opacity=".3" stroke-width="1.4"/>` +
        `<g transform="translate(${f(x)},${f(y)})"><g class="bloom" style="--d:${.3 + i * .25}s">${glyph(t, 12, t === 'film')}</g></g>`;
    });
    s += `<circle r="5" fill="var(--label)"/>`;
    return `<div class="onb" style="align-items:center;justify-content:center;text-align:center;gap:24px">
      <svg width="240" height="240" viewBox="-120 -120 240 240" aria-hidden="true">${s}</svg>
      <h1 class="lt">Drawing <i>your map</i></h1><p class="sub" id="bmsg" aria-live="polite">Reading your saves…</p></div>`;
  }
  return '';
}

/* ---------- app screens ---------- */
function tabbar() {
  const T = [['board', 'Map', I.tabMap], ['discover', 'Discover', I.tabDisc], ['account', 'Account', I.tabAcc]];
  return `<div class="tabbar"><nav class="tabs glass" aria-label="Main">${T.map(([t, l, ic]) => `<button data-act="tab" data-t="${t}" ${S.tab === t ? 'aria-current="page"' : ''}>${ic}${l}</button>`).join('')}</nav>
    ${S.tab === 'board' ? `<button class="fab glass" data-act="add" aria-label="Add to map">${I.plus}</button>` : ''}</div>`;
}
function renderBoard() {
  const b = cur(), r = recsOf(b), h = hunches(b), total = S.boards.reduce((s, x) => s + x.items.length, 0), v = vis(b);
  return hdr(logo(), `<button class="glass circ" data-act="toast" data-msg="${v === 'only me' ? 'This map is private. Change it in Settings to share.' : 'Link to your map copied'}" aria-label="Share map">${I.share}</button>`) +
    `<div class="boardwrap"><button class="prof" data-act="tab" data-t="account" style="margin-top:4px;border:0;background:none;padding:0;text-align:left"><span class="av">${esc(S.me.name.trim()[0] || 'Y').toUpperCase()}</span><span><span style="display:block;font-size:17px;font-weight:600">${esc(S.me.name)}</span><span class="fn" style="display:block;font-size:14px">${S.boards.length} map${S.boards.length > 1 ? 's' : ''} · ${total} saves · ${FOLLOWERS.length} followers</span></span></button>
  <button class="mapname" data-act="boardmenu" aria-haspopup="menu" aria-label="Switch map, current: ${esc(b.name)}"><span class="lt"><i>${esc(b.name)}</i></span><span style="color:var(--label2);margin-top:6px">${I.down}</span></button>
  <p class="sub" style="margin-top:6px">${b.items.length} saves · ${r.pending ? 'finding films…' : h.length + ' film suggestions'} · ${VISL[v]}</p>
  <button class="map mapbtn" data-act="full" aria-label="Open ${esc(b.name)} to explore">${mapSVG(b.items, h, { newId: S.newId }).replace(/ role="button" tabindex="0"/g, '')}
    <span class="openhint glass">${b.items.length ? 'Tap to explore' : 'Tap to start'}</span></button>
  </div>`;
}

/* ---------- full interactive map (force layout, drag, pan, pinch) ---------- */
let G = null; const POS = {};
function renderFull() {
  const b = cur();
  return `<div class="full"><svg id="graph" class="graph" role="group" aria-label="${esc(b.name)}, interactive map"></svg>
  <div class="fulltop"><button class="glass circ" data-act="unfull" aria-label="Close map">${I.x}</button><span class="ttl">${esc(b.name)}</span><button class="glass circ" data-act="add" aria-label="Add to map">${I.plus}</button></div>
  <div class="fullhint glass">Drag things around · pinch to zoom</div></div>`;
}
function gnode(n) {
  if (n.kind === 'me') return `<circle r="16" fill="transparent"/><circle r="6" fill="var(--label)"/><text x="11" y="-9" font-family="var(--serif)" font-style="italic" font-size="16" fill="var(--label)" stroke="var(--bg)" stroke-width="5" paint-order="stroke">You</text>`;
  const c = CAT[n.id], h = n.kind === 'hunch';
  const lab = `<text y="${h ? f(n.r + 15) : 26}" text-anchor="middle" font-size="11.5" font-weight="${h ? 400 : 500}" fill="var(--${h ? 'label2' : 'label'})" stroke="var(--bg)" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(trunc(c.title, 22))}</text>`;
  if (h) return `<circle r="${f(n.r + 12)}" fill="transparent"/><circle class="pulse" r="${f(n.r)}" fill="var(--${c.t})" fill-opacity=".08" stroke="var(--${c.t})" stroke-opacity=".7" stroke-dasharray="2.5 3"/>${glyph(c.t, n.r * .42, true)}${lab}`;
  return `<circle r="22" fill="transparent"/>${glyph(c.t, 11)}${lab}`;
}
function initGraph() {
  const svg = $('#graph'); if (!svg) return;
  const W = svg.clientWidth || 360, H = svg.clientHeight || 720; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const b = cur(), items = b.items.filter(id => CAT[id]), hs = hunches(b), cx = W / 2, cy = H / 2, nodes = [], idx = {};
  const add = o => { const p = POS[o.id]; if (p) { o.x = p.x; o.y = p.y; } o.vx = 0; o.vy = 0; idx[o.id] = o; nodes.push(o); };
  add({ id: '__me', kind: 'me', x: cx, y: cy });
  items.forEach((id, i) => { const a = i / Math.max(1, items.length) * Math.PI * 2; add({ id, kind: 'item', x: cx + Math.cos(a) * 120 + Math.random() * 6, y: cy + Math.sin(a) * 160 + Math.random() * 6 }); });
  hs.forEach(h => { const base = h.from && idx[h.from] ? idx[h.from] : idx.__me, a = Math.random() * Math.PI * 2; add({ id: h.id, kind: 'hunch', from: h.from, r: 9 + 8 * h.s, x: base.x + Math.cos(a) * 80, y: base.y + Math.sin(a) * 80 }); });
  const links = [];
  items.forEach(id => links.push({ a: '__me', b: id, len: 120, k: .035, t: 'me' }));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = CAT[items[i]], B = CAT[items[j]], sh = A.tags.filter(t => B.tags.includes(t)).length;
    if (sh) links.push({ a: A.id, b: B.id, len: 105, k: .008 * sh, t: 's', op: Math.min(.28, .08 + sh * .06) });
  }
  hs.forEach(h => links.push({ a: h.from && idx[h.from] ? h.from : '__me', b: h.id, len: 85, k: .05, t: 'h', col: CAT[h.id].t }));
  svg.innerHTML = `<g id="vp"><g>${links.map((l, i) => `<line id="gl${i}" stroke="${l.t === 'h' ? `var(--${l.col})` : 'var(--label)'}" stroke-opacity="${l.t === 'h' ? .65 : l.t === 'me' ? .3 : l.op}" stroke-width="1"${l.t === 'h' ? ' stroke-dasharray="2 4" stroke-linecap="round"' : ''}/>`).join('')}</g>
    <g>${nodes.map((n, i) => `<g class="gn" data-i="${i}"${n.kind !== 'me' ? ` role="button" tabindex="0" aria-label="${n.kind === 'hunch' ? 'Suggestion: ' : ''}${esc(CAT[n.id].title)}"` : ''}>${gnode(n)}</g>`).join('')}</g></g>`;
  const els = nodes.map((n, i) => svg.querySelector(`.gn[data-i="${i}"]`)), lels = links.map((l, i) => svg.querySelector('#gl' + i)), vp = svg.querySelector('#vp');
  G = { nodes, links, idx, pan: { x: 0, y: 0 }, k: 1, drag: null, ptrs: new Map(), pinch: null, raf: 0 };
  const pt = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const world = p => ({ x: (p.x - G.pan.x) / G.k, y: (p.y - G.pan.y) / G.k });
  const open = n => n.kind === 'hunch' ? hunchSheet(n.id) : itemSheet(n.id);
  svg.onpointerdown = e => {
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } const p = pt(e); G.ptrs.set(e.pointerId, p);
    if (G.ptrs.size === 2) { const [a, c] = [...G.ptrs.values()]; G.pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) || 1, k: G.k, mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, pan: { ...G.pan } }; if (G.drag && G.drag.n) G.drag.n.fixed = false; G.drag = null; return; }
    const g = e.target.closest('.gn'); G.drag = g ? { n: nodes[+g.dataset.i], sx: p.x, sy: p.y, moved: 0 } : { pan: true, sx: p.x, sy: p.y, px: G.pan.x, py: G.pan.y, moved: 0 };
  };
  svg.onpointermove = e => {
    if (!G.ptrs.has(e.pointerId)) return; const p = pt(e); G.ptrs.set(e.pointerId, p);
    if (G.pinch && G.ptrs.size === 2) {
      const [a, c] = [...G.ptrs.values()], k = Math.max(.5, Math.min(2.5, G.pinch.k * Math.hypot(a.x - c.x, a.y - c.y) / G.pinch.d)), P = G.pinch;
      G.pan.x = P.mx - (P.mx - P.pan.x) * k / P.k; G.pan.y = P.my - (P.my - P.pan.y) * k / P.k; G.k = k; return;
    }
    const D = G.drag; if (!D) return; D.moved = Math.max(D.moved, Math.hypot(p.x - D.sx, p.y - D.sy));
    if (D.pan) { G.pan.x = D.px + p.x - D.sx; G.pan.y = D.py + p.y - D.sy; } else if (D.moved > 3) { const w = world(p); D.n.x = w.x; D.n.y = w.y; D.n.vx = D.n.vy = 0; D.n.fixed = true; }
  };
  const up = e => { G.ptrs.delete(e.pointerId); if (G.ptrs.size < 2) G.pinch = null; const D = G.drag; G.drag = null; if (!D || !D.n) return; D.n.fixed = false; if (D.moved < 6 && D.n.kind !== 'me') open(D.n); };
  svg.onpointerup = up; svg.onpointercancel = up;
  svg.onwheel = e => { e.preventDefault(); const p = pt(e), k = Math.max(.5, Math.min(2.5, G.k * Math.exp(-e.deltaY * .0015))); G.pan.x = p.x - (p.x - G.pan.x) * k / G.k; G.pan.y = p.y - (p.y - G.pan.y) * k / G.k; G.k = k; };
  svg.onkeydown = e => { const g = e.target.closest && e.target.closest('.gn'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const n = nodes[+g.dataset.i]; if (n.kind !== 'me') open(n); } };
  const step = () => {
    const N = nodes.length;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const a = nodes[i], c = nodes[j]; const dx = c.x - a.x, dy = c.y - a.y; let d2 = dx * dx + dy * dy; if (d2 > 160000) continue; d2 = Math.max(d2, 80); const d = Math.sqrt(d2), F = 1500 / d2;
      a.vx -= dx / d * F; a.vy -= dy / d * F; c.vx += dx / d * F; c.vy += dy / d * F;
    }
    links.forEach(l => { const a = idx[l.a], c = idx[l.b]; if (!a || !c) return; const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, F = (d - l.len) * l.k; a.vx += dx / d * F; a.vy += dy / d * F; c.vx -= dx / d * F; c.vy -= dy / d * F; });
    nodes.forEach((n, i) => {
      const pull = n.kind === 'me' ? .01 : .0015; n.vx += (cx - n.x) * pull; n.vy += (cy - n.y) * pull;
      if (n.fixed) { n.vx = n.vy = 0; } else { n.vx *= .78; n.vy *= .78; n.x += n.vx; n.y += n.vy; }
      els[i].setAttribute('transform', `translate(${f(n.x)},${f(n.y)})`); POS[n.id] = { x: n.x, y: n.y };
    });
    links.forEach((l, i) => { const a = idx[l.a], c = idx[l.b]; lels[i].setAttribute('x1', f(a.x)); lels[i].setAttribute('y1', f(a.y)); lels[i].setAttribute('x2', f(c.x)); lels[i].setAttribute('y2', f(c.y)); });
    vp.setAttribute('transform', `translate(${f(G.pan.x)},${f(G.pan.y)}) scale(${G.k.toFixed(3)})`);
    G.raf = requestAnimationFrame(step);
  };
  step();
}

/* ---------- covers ---------- */
const MOODC = { summer: ['#EE9447', '#C24A2A'], dusk: ['#EE8A69', '#6E4FA6'], warm: ['#E09A55', '#9E4A31'], night: ['#3A3F7A', '#14183A'], neon: ['#D23E8A', '#33267A'], city: ['#5B6C8C', '#1E2A3F'], rain: ['#6C8AA5', '#273B50'], calm: ['#7AA59D', '#2F5654'], quiet: ['#9B998B', '#47493F'], melancholy: ['#82709A', '#36304A'], longing: ['#B06E8C', '#46293F'], romance: ['#DE7486', '#7E2D4A'], dream: ['#9786DD', '#3F3F8C'], fantasy: ['#4FA9A1', '#33467F'], energy: ['#E4493B', '#6E1A27'], loud: ['#D9372D', '#2E1212'], rock: ['#B73A30', '#1E1A1A'], epic: ['#C68E39', '#553517'], desert: ['#D79D58', '#8C4F25'], sea: ['#3B97B1', '#173F5C'], travel: ['#56A09C', '#294F6E'], youth: ['#8EBF48', '#2F6A44'], quirky: ['#E1BE45', '#B5502F'], memory: ['#C49683', '#5E434A'], tender: ['#E3A1A6', '#8B4E64'], literary: ['#9C8160', '#463527'], writing: ['#8A7962', '#383026'], analog: ['#AE784C', '#45301F'], autumn: ['#C46A2E', '#5E2818'], storytelling: ['#B5743A', '#523425'], everyday: ['#A09D86', '#4F4D42'], cafe: ['#9A7154', '#412E22'], talky: ['#C8826A', '#5E4152'], slow: ['#6B7CA0', '#2A3049'],
  dark: ['#4A4458', '#16141C'], vintage: ['#C49A6C', '#5E4630'], glam: ['#D4A5C9', '#6B2D5C'], minimal: ['#B9B6AE', '#55534D'], cozy: ['#D9A06B', '#7A4A2E'], street: ['#7C8794', '#2B3038'], nature: ['#7FAF6B', '#2F5A33'] };
const TBASE = { film: ['#D2603F', '#5E2A1E'], music: ['#5E9150', '#23402A'], image: ['#C9668A', '#55263C'], fashion: ['#C8952A', '#5A3E12'] };
const hsh = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function pal(c) { const a = MOODC[c.tags[0]] || TBASE[c.t], b = MOODC[c.tags[1]] || MOODC[c.tags[0]] || TBASE[c.t]; return [a[0], b[0], a[1]]; }
function cover(c, cls) {
  const [a, b, d] = pal(c), h = hsh(c.id), px = 15 + h % 70, py = 10 + (h >> 5) % 55, ang = 135 + (h >> 9) % 70;
  return `<span class="cv ${cls || ''}" style="background:radial-gradient(110% 85% at ${px}% ${py}%, ${b} 0%, ${b}00 62%),linear-gradient(${ang}deg, ${a} 0%, ${d} 100%)">
    <svg class="cvg" viewBox="-12 -12 24 24" aria-hidden="true">${glyph(c.t, 10.5, false, '#fff')}</svg><span class="cvk">${c.kind}</span><span class="cvt">${esc(c.title)}</span><span class="cvb">${esc(c.by)}</span></span>`;
}
const tile = (id, cap) => `<button class="tb" data-act="disc" data-id="${id}" aria-label="${esc(CAT[id].title)}, ${CAT[id].kind}">${cover(CAT[id])}${cap ? `<span class="cap">${esc(cap)}</span>` : ''}</button>`;

/* ---------- discover ---------- */
function balanceCard(r) {
  const m = r.pending ? 50 : Math.round(r.weights.music * 100);
  return `<div class="balance"><p>${esc(balanceText(r))}</p>
    <div class="bar" aria-hidden="true"><i style="width:${m}%;background:var(--music)"></i><i style="width:${100 - m}%;background:var(--image)"></i></div>
    <div class="keys"><span>Songs</span><span>Pictures and clothes</span></div></div>`;
}
function renderDiscover() {
  const b = cur(), r = recsOf(b), R = discoverList(b);
  const used = new Set(); const take = (arr, n) => { const out = []; for (const id of arr) { if (out.length >= n) break; if (!used.has(id)) { out.push(id); used.add(id); } } return out; };
  let h = `<button class="bentry" data-act="bubbles"><svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">${R.slice(0, 6).map((x, i) => { const P = [[32, 26, 15], [12, 16, 8], [54, 14, 7], [52, 40, 9], [14, 40, 7], [33, 6, 4]][i], C = pal(CAT[x.id]); return `<circle cx="${P[0]}" cy="${P[1]}" r="${P[2]}" fill="${C[0]}"/>`; }).join('')}</svg>
    <span class="m"><b>Explore as bubbles</b><span>Every film and series, biggest match in the middle</span></span><span style="color:var(--label2)">${I.chev}</span></button>`;
  if (r.pending) h += `<p class="sub pending" style="margin-top:32px">Asking the Julia engine…</p>`;
  const tp = R[0];
  if (tp) { used.add(tp.id); h += `<button class="hero" data-act="disc" data-id="${tp.id}"><p class="k">Today’s pick</p>${cover(CAT[tp.id], 'wide')}<p class="r">${esc(why(tp))}</p></button>`; }
  h += balanceCard(r);
  // because you saved X, grouped by the save that pushed each pick up the most (top 30 picks only)
  const bySrc = {}; R.slice(0, 30).forEach(x => { if (x.from && CAT[x.from]) (bySrc[x.from] = bySrc[x.from] || []).push(x); });
  Object.keys(bySrc).sort((a, c) => bySrc[c].length - bySrc[a].length).slice(0, 3).forEach(src => {
    const ids = take(bySrc[src].map(x => x.id), 6); if (ids.length < 2) return;
    h += `<section class="dsec"><div class="sechead"><div><h2 class="t3">Because you saved <i>${esc(CAT[src].title)}</i></h2><p class="why2">Films and series people kept next to it</p></div></div>
    <div class="hrow">${ids.map(id => tile(id, (bySrc[src].find(x => x.id === id).shared || []).join(', ') || CAT[id].kind)).join('')}</div></section>`;
  });
  // twins: one save, one film that feels the same
  const twins = []; const seen = new Set();
  for (const src of Object.keys(bySrc)) { const x = bySrc[src].find(y => !seen.has(y.id)); if (x) { twins.push([src, x.id]); seen.add(x.id); } if (twins.length >= 4) break; }
  if (twins.length) h += `<section class="dsec"><h2 class="t3">If it were a <i>film</i></h2><p class="why2">Your saves, turned into something to watch</p>
    <div class="hrow">${twins.map(([a, b2]) => `<button class="pair" data-act="disc" data-id="${b2}"><span class="two">${cover(CAT[a])}${cover(CAT[b2])}<span class="eq glass">≈</span></span><span class="pc"><i>${esc(CAT[a].title)}</i>, as a ${CAT[b2].kind === 'TV' ? 'series' : 'film'}</span></button>`).join('')}</div></section>`;
  const goesWith = id => { const x = R.find(y => y.id === id); return x && x.from && CAT[x.from] ? 'Goes with ' + CAT[x.from].title : CAT[id].kind; };
  const films = take(R.filter(x => CAT[x.id].kind === 'Film').map(x => x.id), 8);
  if (films.length) h += `<section class="dsec"><h2 class="t3">Films for <i>${esc(b.name)}</i></h2><div class="hrow">${films.map(id => tile(id, goesWith(id))).join('')}</div></section>`;
  const tv = take(R.filter(x => CAT[x.id].kind === 'TV').map(x => x.id), 8);
  if (tv.length) h += `<section class="dsec"><h2 class="t3">Series to <i>start</i></h2><div class="hrow">${tv.map(id => tile(id, goesWith(id))).join('')}</div></section>`;
  const mine = onAnyMap();
  const pk = Object.keys(PEOPLE).filter(k => !S.follow[k]).concat(Object.keys(PEOPLE).filter(k => S.follow[k])).slice(0, 5);
  h += `<section class="dsec"><div class="sechead"><h2 class="t3">From maps like <i>yours</i></h2><button class="tbtn sm" data-act="flist" data-v="following">See all</button></div>
    <div class="hrow">${pk.map(k => { const p = PEOPLE[k], three = p.items.filter(i => CAT[i] && !mine.has(i)).slice(0, 3); return `<button class="pcard" data-act="peek" data-u="${k}"><span class="three">${three.map(i => cover(CAT[i])).join('')}</span><b>${p.board}</b><span>${p.h} · ${common(k)}</span></button>`; }).join('')}</div></section>`;
  const far = take(R.slice().reverse().map(x => x.id), 8);
  if (far.length) h += `<section class="dsec"><h2 class="t3">Outside your <i>bubble</i></h2><p class="why2">Far from your usual. Might be your next favourite.</p><div class="hrow">${far.map(id => tile(id, CAT[id].kind)).join('')}</div></section>`;
  h += `<div class="endcard">${flower(40)}<h2>That’s everything<br><i>for this week.</i></h2><p class="sub">New picks show up as your map changes.</p>
    <div class="row-actions"><button class="btn glass" data-act="surprise">Surprise me</button><button class="btn glass" data-act="bubbles">Bubbles</button></div></div>`;
  return fhdr(`<div class="sbox glass" id="sbox"><button class="sbtn" data-act="dsearch" aria-label="Search">${I.search}</button><label class="vh" for="dq">Search</label><input id="dq" type="search" placeholder="Songs, pictures, films" autocomplete="off" tabindex="-1"><button class="sx" data-act="dsearchx" aria-label="Close search">${I.x}</button></div>`) +
    `<div class="sres" id="sres" hidden></div><div class="scroll under"><h1 class="lt" style="margin-top:8px">For you <i>this week</i></h1>
  <p class="sub" style="margin-top:8px">Picked by the um!x graph from what’s on ${esc(b.name)}.</p>${h}</div>`;
}

/* ---------- bubble explorer ---------- */
let B = null; const BP = { x: 0, y: 0 };
function renderBubbles() {
  return `<div class="full"><div class="bfield" id="bfield" role="group" aria-label="All picks as bubbles"></div>
  <div class="fulltop"><button class="glass circ" data-act="unbubbles" aria-label="Close">${I.x}</button><span class="ttl">Everything for you</span><span style="width:44px"></span></div>
  <div class="fullhint glass">Drag to explore · tap a bubble</div></div>`;
}
function initBubbles() {
  const el = $('#bfield'); if (!el) return;
  const L = discoverList(cur());
  const sp = 104, pos = [[0, 0]];
  for (let ring = 1; pos.length < L.length; ring++) {
    let q = ring, r = 0; const dirs = [[-1, 1], [-1, 0], [0, -1], [1, -1], [1, 0], [0, 1]];
    for (let d = 0; d < 6; d++) for (let s = 0; s < ring; s++) { pos.push([q, r]); q += dirs[d][0]; r += dirs[d][1]; }
  }
  const pts = L.map((x, i) => { const [q, r] = pos[i]; return { id: x.id, x: sp * (q + r / 2), y: sp * .866 * r }; });
  el.innerHTML = pts.map((p, i) => `<button class="bb" data-i="${i}" aria-label="${esc(CAT[p.id].title)}, ${CAT[p.id].kind}">${cover(CAT[p.id], 'round')}</button>`).join('');
  const els = [...el.children];
  B = { raf: 0, vx: 0, vy: 0, drag: null };
  const W = () => el.clientWidth, H = () => el.clientHeight;
  el.onpointerdown = e => { try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } const t = e.target.closest('.bb'); B.drag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, i: t ? +t.dataset.i : -1, lt: performance.now() }; B.vx = B.vy = 0; };
  el.onpointermove = e => {
    const D = B.drag; if (!D) return; const sc = el.getBoundingClientRect().width / el.clientWidth || 1; const dx = (e.clientX - D.lx) / sc, dy = (e.clientY - D.ly) / sc;
    BP.x += dx; BP.y += dy; D.moved = Math.max(D.moved, Math.hypot(e.clientX - D.sx, e.clientY - D.sy)); const now = performance.now(), dt = Math.max(1, now - D.lt); B.vx = dx * 16 / dt; B.vy = dy * 16 / dt; D.lx = e.clientX; D.ly = e.clientY; D.lt = now;
  };
  const up = () => { const D = B.drag; B.drag = null; if (D && D.moved < 6 && D.i >= 0) { B.vx = B.vy = 0; S.addTo = S.cur; discSheet(pts[D.i].id); } };
  el.onpointerup = up; el.onpointercancel = up;
  el.onkeydown = e => { const t = e.target.closest && e.target.closest('.bb'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.addTo = S.cur; discSheet(pts[+t.dataset.i].id); } };
  const step = () => {
    if (!B.drag) { BP.x += B.vx; BP.y += B.vy; B.vx *= .93; B.vy *= .93; }
    const w = W(), hh = H(), cx = w / 2, cy = hh / 2, R = Math.min(w, hh) * .62;
    pts.forEach((p, i) => {
      let x = p.x + BP.x + cx, y = p.y + BP.y + cy; const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      const t = Math.min(1, d / R), s = Math.max(.32, 1 - t * t * .7); const pull = .82 + .18 * s; x = cx + dx * pull; y = cy + dy * pull;
      const st = els[i].style; st.transform = `translate(${f(x - 48)}px,${f(y - 48)}px) scale(${s.toFixed(3)})`; st.opacity = d > R * 1.6 ? 0 : 1; st.zIndex = Math.round(s * 100);
    });
    B.raf = requestAnimationFrame(step);
  };
  step();
}

/* ---------- account, people, settings ---------- */
const following = () => Object.keys(S.follow).filter(k => S.follow[k] && PEOPLE[k]);
function renderAccount() {
  const M = S.me, total = S.boards.reduce((s, x) => s + x.items.length, 0), linked = ACC.filter(a => S.links[a.k]).length;
  const row = (act, label, val, extra) => `<button class="li" data-act="${act}" ${extra || ''}><span class="m"><b>${label}</b></span><span class="v">${val || ''} ${I.chev}</span></button>`;
  return fhdr(`<button class="glass circ" data-act="settings" aria-label="Settings">${I.gear}</button>`) +
    `<div class="scroll under">
  <div class="acc-top"><span class="av big" aria-hidden="true">${esc(M.name.trim()[0] || 'Y').toUpperCase()}</span>
    <div class="stats"><div class="stat"><b>${S.boards.length}</b><span>Maps</span></div>
      <button class="stat" data-act="flist" data-v="followers"><b>${FOLLOWERS.length}</b><span>Followers</span></button>
      <button class="stat" data-act="flist" data-v="following"><b>${following().length}</b><span>Following</span></button></div></div>
  <h1 class="lt" style="font-size:28px;margin-top:20px">${esc(M.name)}</h1>
  <p class="sub" style="margin-top:2px">${esc(M.handle)} · ${total} saves</p>
  <p class="body" style="margin-top:10px">${esc(M.bio)}</p>
  <div class="row-actions" style="margin-top:20px"><button class="btn glass" style="height:44px;font-size:15px" data-act="editprof">Edit profile</button><button class="btn glass" style="height:44px;font-size:15px" data-act="toast" data-msg="Profile link copied">Share profile</button></div>
  <div class="ghead">Your maps</div>
  <div class="group">${S.boards.map((b, i) => `<button class="li ind" data-act="openboard" data-i="${i}"><span class="tile" style="background:var(--bg)">${b.items.length && CAT[b.items[0]] ? icon(CAT[b.items[0]].t, 22) : flower(22)}</span><span class="m"><b style="font-family:var(--serif);font-style:italic;font-size:19px;font-weight:400">${esc(b.name)}</b><span>${b.items.length} saves · ${VISL[vis(b)]}</span></span><span class="v">${I.chev}</span></button>`).join('')}</div>
  <div class="ghead">Settings</div>
  <div class="group">${row('settings', 'Privacy', VISL[S.priv.profile])}${row('settings', 'Linked accounts', linked + ' linked')}${row('redoquiz', 'Taste questions', 'Answer again')}${row('tutorial', 'How to read a map', '')}${row('toast', 'Help and feedback', '', 'data-msg="Thanks! Tell the facilitator anything you noticed."')}</div>
  <p class="fine" style="margin-top:32px">um!x alpha · for user testing</p></div>`;
}
function personRow(k, mode) {
  const p = PEOPLE[k], fl = !!S.follow[k];
  return `<div class="li"><span class="av">${p.h[1].toUpperCase()}</span>
    <button class="m" data-act="peek" data-u="${k}" style="border:0;background:none;padding:0;text-align:left"><b>${p.h}</b><span><i style="font-family:var(--serif);font-size:15px;color:var(--label)">${p.board}</i> · ${common(k)}</span></button>
    <button class="tbtn sm" data-act="follow" data-u="${k}" aria-pressed="${fl}" style="${fl ? 'color:var(--label2)' : ''}">${fl ? 'Following' : mode === 'followers' ? 'Follow back' : 'Follow'}</button></div>`;
}
function renderFollowList() {
  const F = S.flist, fl = following(), sugg = Object.keys(PEOPLE).filter(k => !S.follow[k]);
  const L = F === 'followers' ? FOLLOWERS : fl;
  return hdr(backBtn('unflist')) + `<div class="scroll"><p class="fn" style="margin-top:8px;font-size:14px">${esc(S.me.handle)}</p><h1 class="lt" style="margin-top:2px">${F === 'followers' ? 'Followers' : 'Following'}</h1>
  <div style="margin-top:20px">${segc('flseg', F, [['followers', `${FOLLOWERS.length} Followers`], ['following', `${fl.length} Following`]], 'Followers or following')}</div>
  ${L.length ? `<div class="group" style="margin-top:20px">${L.map(k => personRow(k, F)).join('')}</div>` : `<p class="sub" style="margin-top:28px;text-align:center">You’re not following anyone yet.</p>`}
  ${F === 'following' && sugg.length ? `<div class="ghead">Maps like yours</div><div class="group">${sugg.map(k => personRow(k)).join('')}</div><p class="gfoot">People whose maps overlap with yours. You see their maps, never a feed.</p>` : ''}</div>`;
}
function openProfSheet() {
  sheet(`<div class="shead"><div class="t"><h2 style="margin:0">Edit profile</h2></div><button class="glass circ" data-act="close" aria-label="Close">${I.x}</button></div>
  <label class="flabel" for="pname">Name</label><input class="inp" id="pname" value="${esc(S.me.name)}" autocomplete="off">
  <label class="flabel" for="phandle">Username</label><input class="inp" id="phandle" value="${esc(S.me.handle)}" autocomplete="off">
  <label class="flabel" for="pbio">Bio</label><textarea class="inp" id="pbio" rows="3">${esc(S.me.bio)}</textarea>
  <div class="row-actions"><button class="btn glass" data-act="close">Cancel</button><button class="btn prim" data-act="saveprof">Save</button></div>`);
}
function renderPeek() {
  const k = S.viewing, p = PEOPLE[k];
  return hdr(backBtn('unpeek'), `<button class="glass btn" style="height:44px;font-size:15px;padding:0 18px" data-act="follow" data-u="${k}" aria-pressed="${!!S.follow[k]}">${S.follow[k] ? 'Following' : 'Follow'}</button>`) +
    `<div class="scroll"><p class="fn" style="margin-top:8px;font-size:14px">${p.h}’s map</p><h1 class="lt" style="margin-top:4px"><i>${p.board}</i></h1>
  <p class="sub" style="margin-top:6px">${common(k)}. Tap anything to save it to your own map.</p>
  <div class="map">${mapSVG(p.items, [], { peek: true, center: p.h.slice(1, 2).toUpperCase() + p.h.slice(2).split('.')[0] })}</div></div>`;
}
function renderSettings() {
  const P = S.priv, priv = P.profile === 'only me';
  const radio = (k, v, l, sub) => `<button class="li" data-act="pv" data-k="${k}" data-v="${v}" role="radio" aria-checked="${P[k] === v}"><span class="m"><b>${l}</b>${sub ? `<span>${sub}</span>` : ''}</span>${P[k] === v ? `<span class="check">${I.check}</span>` : ''}</button>`;
  const sw = (k, l, sub, dis) => `<div class="li"><span class="m"><b id="sw-${k}">${l}</b><span>${sub}</span></span><button class="switch" role="switch" aria-labelledby="sw-${k}" aria-checked="${!!P[k] && !dis}" data-act="pswitch" data-k="${k}" ${dis ? 'disabled' : ''}></button></div>`;
  return hdr(backBtn('unsettings')) +
    `<div class="scroll" style="padding-bottom:48px"><h1 class="lt" style="margin-top:8px">Privacy</h1>
  <p class="sub" style="margin-top:8px">Choose who sees your maps, and how your saves help other people find things.</p>
  <div class="ghead">Who can see your profile</div>
  <div class="group">${radio('profile', 'public', 'Everyone')}${radio('profile', 'followers', 'Followers')}${radio('profile', 'only me', 'Only me')}</div>
  <div class="ghead">Each map</div>
  <div class="group">${S.boards.map((b, i) => `<button class="li" data-act="bvismenu" data-i="${i}" ${priv ? 'disabled' : ''} aria-haspopup="menu"><span class="m"><b>${esc(b.name)}</b><span>${b.items.length} saves</span></span><span class="v">${VISL[vis(b)]} ${priv ? '' : I.chev}</span></button>`).join('')}</div>
  <p class="gfoot">${priv ? 'Your profile is private, so every map is private too.' : 'A map set to Only me never shows on your profile.'}</p>
  <div class="ghead">Helping other people’s suggestions</div>
  <div class="group">${radio('share', 'named', 'With my name', 'Others may see “saved by you” on a suggestion')}${radio('share', 'anon', 'Anonymously', 'Your saves count, but nobody sees they came from you')}${radio('share', 'off', 'Don’t use my maps', 'Your saves never shape anyone else’s suggestions')}</div>
  <p class="gfoot">When your maps overlap with someone else’s, the things you saved together can become their suggestions.</p>
  <div class="ghead">Being found</div>
  <div class="group">${sw('rhyme', 'Show me in Maps like yours', 'People with similar maps can see yours in Discover', priv)}</div>
  <div class="ghead">Linked accounts</div>
  <div class="group">${ACC.map(a => `<button class="li ind" data-act="link" data-k="${a.k}" aria-pressed="${!!S.links[a.k]}"><span class="tile" style="background:var(--bg)">${icon(a.t, 24)}</span><span class="m"><b>${a.name}</b><span>${S.links[a.k] ? 'Syncing new saves' : 'Not linked'}</span></span><span class="v" style="color:${S.links[a.k] ? 'var(--label2)' : 'var(--tint)'}">${S.links[a.k] ? 'Unlink' : 'Link'}</span></button>`).join('')}</div>
  <p class="fine" style="margin-top:32px">Alpha. These settings only change what this page shows.</p></div>`;
}

/* ---------- sheets & menus ---------- */
function sheet(html, tall) {
  const w = $('#sheetWrap'); w.innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet${tall ? ' tall' : ''}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`; w.hidden = false;
  const fb = w.querySelector('.sheet input,.sheet button'); fb && setTimeout(() => fb.focus({ preventScroll: true }), 60);
}
function closeSheet() { const w = $('#sheetWrap'); w.hidden = true; w.innerHTML = ''; }
function menu(anchor, items) {
  const w = $('#menuWrap'), pr = $('#phone').getBoundingClientRect(), ar = anchor.getBoundingClientRect(), sc = pr.width / $('#phone').offsetWidth || 1;
  const pw = $('#phone').offsetWidth, left = Math.max(16, Math.min((ar.left - pr.left) / sc, pw - 256)), topp = (ar.bottom - pr.top) / sc + 8;
  w.innerHTML = `<div class="scrim" data-act="closemenu"></div><div class="menu" role="menu" style="left:${f(left)}px;top:${f(topp)}px">${items.map(it => it === '-' ? '<hr>' :
    `<button role="menuitemradio" aria-checked="${!!it.on}" data-act="${it.act}" ${Object.entries(it.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}><span class="ck">${it.on ? I.check : ''}</span>${esc(it.label)}</button>`).join('')}</div>`;
  w.hidden = false; const fb = w.querySelector('.menu button'); fb && fb.focus({ preventScroll: true });
}
function closeMenu() { const w = $('#menuWrap'); w.hidden = true; w.innerHTML = ''; }
const head = (c, k, sugg) => `<div class="shead"><div class="bigtile${sugg ? ' sugg' : ''}">${icon(c.t, sugg ? 40 : 46, sugg)}</div>
  <div class="t"><div class="k">${k}</div><h2>${esc(c.title)}</h2><div class="by">${esc(c.by)} · ${c.kind}</div></div></div>`;
function itemSheet(id) {
  const c = CAT[id], b = cur(); const conn = b.items.filter(x => x !== id && CAT[x] && CAT[x].tags.some(t => c.tags.includes(t))).map(x => CAT[x].title);
  const note = c.custom ? 'um!x can’t read this one yet, so it doesn’t steer your picks. Things from the catalogue do.'
    : c.d === 'film' ? 'Films and series you keep stay on your map. In this alpha only songs, pictures and clothes steer the picks.' : '';
  sheet(head(c, 'On ' + esc(b.name)) + `<dl class="kv"><dt>Feels</dt><dd>${c.tags.length ? c.tags.join(', ') : 'Not known yet. The map learns this from other people’s maps.'}</dd>
  <dt>Connected on this map to</dt><dd>${conn.length ? conn.map(esc).join(', ') : 'Nothing yet. Add more and lines appear.'}</dd></dl>${note ? `<p class="note">${note}</p>` : ''}
  <div class="row-actions"><button class="btn glass" data-act="remove" data-id="${id}">Remove</button><button class="btn prim" data-act="close">Done</button></div>`);
}
function findRec(id) { return ranked(cur()).find(h => h.id === id) || { s: .5, from: null, shared: [] }; }
function hunchSheet(id) {
  const x = findRec(id), c = CAT[id];
  sheet(head(c, 'Suggestion', true) + `<p class="why">${esc(why(x))}</p>${conf(x.s)}<p class="note">${esc(balanceText(recsOf(cur())))}</p>
  <div class="row-actions"><button class="btn glass" data-act="dismiss" data-id="${id}">Not for me</button><button class="btn prim" data-act="keep" data-id="${id}">Keep it</button></div>`);
}
function discSheet(id) {
  const c = CAT[id], x = c.d === 'film' ? findRec(id) : null;
  sheet(`<div class="shead"><div style="width:96px;flex-shrink:0">${cover(c)}</div><div class="t"><div class="k">${x ? 'For you' : 'In the catalogue'}</div><h2>${esc(c.title)}</h2><div class="by">${esc(c.by)} · ${c.kind}</div></div></div>` +
    (x ? `<p class="why">${esc(why(x))}</p>${conf(x.s)}` : `<p class="why">Feels ${esc(c.tags.join(', ') || 'new')}. Save it and your film picks shift.</p>`) +
    `<p class="slabel">Add to</p><div class="group" style="margin-top:10px">${S.boards.map((b, i) => `<button class="li" data-act="pickboard" data-i="${i}" data-id="${id}" role="radio" aria-checked="${i === S.addTo}"><span class="m"><b>${esc(b.name)}</b></span>${i === S.addTo ? `<span class="check">${I.check}</span>` : ''}</button>`).join('')}</div>
  <div class="row-actions"><button class="btn glass" data-act="dskip" data-id="${id}">${x ? 'Not for me' : 'Close'}</button><button class="btn prim" data-act="dadd" data-id="${id}">Add to map</button></div>`);
}
function peekSheet(id) {
  const c = CAT[id], p = PEOPLE[S.viewing], has = cur().items.includes(id);
  sheet(head(c, 'On ' + p.h + '’s map') + `<dl class="kv"><dt>Feels</dt><dd>${c.tags.join(', ')}</dd></dl>
  <div class="row-actions"><button class="btn glass" data-act="close">Close</button><button class="btn prim" data-act="addit" data-id="${id}" ${has ? 'disabled' : ''}>${has ? 'Already saved' : 'Save to my map'}</button></div>`);
}
function addSheet() {
  const b = cur(); const sug = ranked(b).slice(0, 4);
  sheet(`<div class="shead"><div class="t"><div class="k">Add to</div><h2 style="margin:4px 0 0">${esc(b.name)}</h2></div><button class="glass circ" data-act="close" aria-label="Close">${I.x}</button></div>
  <label class="search"><span style="color:var(--label2);display:grid">${I.search}</span><span class="vh">Search</span><input id="q" type="search" placeholder="Songs, pictures, clothes, films" autocomplete="off" value="${esc(S.aq)}"></label>
  ${sug.length ? `<p class="slabel">Films that fit this map</p>
  <div class="sugs">${sug.map(x => { const c = CAT[x.id]; return `<button class="sug" data-act="addit" data-id="${x.id}" aria-label="Add ${esc(c.title)}">${icon(c.t, 28)}<b>${esc(c.title)}</b><span>${x.from && CAT[x.from] ? 'Goes with ' + esc(CAT[x.from].title) : 'Popular to start with'}</span></button>`; }).join('')}</div>` : ''}
  <div id="addSeg" style="margin-top:28px"></div><div id="addList" style="margin-top:8px"></div>`, true);
  fillAdd();
}
function fillAdd() {
  const b = cur(), q = S.aq.trim().toLowerCase();
  $('#addSeg').innerHTML = segc('atype', S.atype, FILTERS, 'Filter by layer');
  const L = Object.values(CAT).filter(c => !c.custom && (S.atype === 'all' || c.d === S.atype) && (!q || (c.title + ' ' + c.by + ' ' + c.tags.join(' ')).toLowerCase().includes(q)));
  let h = L.slice(0, 60).map(c => `<div class="irow"><span class="tile" style="background:var(--bg2)">${icon(c.t, 26)}</span><div class="m"><b>${esc(c.title)}</b><span>${esc(c.by)} · ${c.kind}</span></div>
    ${b.items.includes(c.id) ? '<span class="added">Added</span>' : `<button class="glass circ" style="width:36px;height:36px" data-act="addit" data-id="${c.id}" aria-label="Add ${esc(c.title)}">${I.plus}</button>`}</div>`).join('');
  if (q && !L.length) h = `<p class="sub" style="margin:20px 0 12px">Nothing called “${esc(S.aq)}” yet. Add it anyway as a:</p><div class="group">${CUSTOM.map(([t, l]) => `<button class="li ind" data-act="addcustom" data-t="${t}"><span class="tile" style="background:var(--bg)">${icon(t, 24)}</span><span class="m"><b>${l}</b></span><span class="v">${I.chev}</span></button>`).join('')}</div>`;
  $('#addList').innerHTML = h;
}
function tutorialSheet() {
  const row = (t, ghost, title, sub) => `<div class="row">${icon(t, 34, ghost)}<span><b>${title}</b><span>${sub}</span></span></div>`;
  const line = `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M4 26 Q17 4 30 22" fill="none" stroke="var(--label)" stroke-opacity=".45"/></svg>`;
  sheet(`<div class="shead"><div class="t"><div class="k">Before you start</div><h2>How to read <i>your map</i></h2></div></div>
  <div class="legend">${row('music', false, 'Songs', 'From Spotify or anything you add')}${row('image', false, 'Pictures', 'Moods you saved, like rainy windows')}${row('fashion', false, 'Clothes', 'Pieces you wear or want to')}
  <div class="row">${line}<span><b>Lines</b><span>Two saves that share a mood</span></span></div>
  ${row('film', true, 'Dashed rings', 'Films and series um!x thinks fit. Tap one to keep it or skip it.')}</div>
  <p class="note">The rings come from a graph model trained on thousands of maps. It reads your songs and your pictures and clothes, then guesses what you’d watch.</p>
  <div class="row-actions"><button class="btn prim" data-act="tutorial-done">Got it</button></div>`);
}

/* ---------- actions ---------- */
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
function addTo(bi, id) {
  const b = S.boards[bi]; if (b.items.includes(id)) return;
  const before = ENGINE.sync ? new Set(hunches(b).map(h => h.id)) : null;
  b.items.push(id); b.dismissed = b.dismissed.filter(x => x !== id);
  const nw = before ? hunches(b).filter(h => !before.has(h.id)).length : 0;
  if (bi === S.cur) S.newId = id;
  toast(`Added to ${b.name}` + (nw ? ` · ${nw} new suggestion${nw > 1 ? 's' : ''}` : ''));
}
function startBuilding() {
  S.step = 'building';
  if (S.redo && S.boards.length) { const b = cur(); b.items = [...new Set([...b.items, ...quizItems().filter(id => CAT[id])])]; S.redo = false; } else seedBoards();
  render();
  recsOf(cur());   // start asking the engine while the animation plays
  const msgs = ['Reading your saves…', 'Walking the graph…', 'Finding films that feel the same…']; let i = 0;
  const iv = setInterval(() => { i++; const el = $('#bmsg'); if (el && msgs[i]) el.textContent = msgs[i]; }, 800);
  setTimeout(() => {
    clearInterval(iv); if (S.step !== 'building') return; S.step = 'app'; S.tab = 'board'; render();
    if (S.seenTutorial) toast('Your map is ready'); else setTimeout(tutorialSheet, 500);
  }, 2700);
}
function go(to) {
  if (['welcome', 'connect', 'quiz'].includes(to)) { S.step = to; if (to === 'quiz') S.qi = 0; render(); return; }
  if (!S.boards.length) seedBoards();
  S.step = 'app'; S.viewing = null; S.flist = null; S.settings = to === 'settings'; S.tab = to === 'discover' ? 'discover' : 'board'; render();
}
function next() { if (S.qi < QS.length - 1) { S.qi++; render(); } else startBuilding(); }
function toggleWiz(on) { const w = $('#wiz'); w.hidden = on === undefined ? !w.hidden : !on; if (!w.hidden) fillWizard(); }
function fillWizard() {
  const box = $('#wzEngine'); if (!box || !ENGINE) return;
  const M = ENGINE.model, met = M.metrics || {};
  const pct = x => typeof x === 'number' ? Math.round(x * 1000) / 10 + '%' : 'n/a';
  box.innerHTML = `Running <b>${ENGINE.mode === 'julia' ? 'on the Julia API' : 'in the browser'}</b><br>${esc(M.name)} · ${esc(M.dataset)} data · ${M.items.film.length} films and series<br>
    Hidden-film test: recall@10 ${pct(met['recall@10'])}, popularity alone ${pct(met['popularity_recall@10'])}`;
  let pref = 'auto'; try { pref = localStorage.getItem(ENGINE_KEY) || 'auto'; } catch (e) { /* ignore */ }
  document.querySelectorAll('[data-act="wz-engine"]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.v === pref)));
}
function resetAll() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } S.custom.forEach(c => delete CAT[c.id]); S = fresh(); RECS.clear(); closeSheet(); closeMenu(); render(); toast('Back to the start'); }

let taps = [];
function act(el) {
  const a = el.dataset.act, id = el.dataset.id;
  if (el.closest('.menu')) closeMenu();
  switch (a) {
    case 'wm': { const now = Date.now(); taps = taps.filter(t => now - t < 700); taps.push(now); if (taps.length >= 3) { taps = []; toggleWiz(); } return; }
    case 'go': return go(el.dataset.to);
    case 'link': S.links[el.dataset.k] = !S.links[el.dataset.k]; return render();
    case 'qback': if (S.qi > 0) { S.qi--; render(); } else go('connect'); return;
    case 'pick': {
      if (S.picking) return; const v = el.dataset.v; S.answers[S.qi] = v === 'skip' ? null : v;
      if (v === 'skip') { next(); return; } S.picking = true; render(); setTimeout(() => { S.picking = false; next(); }, 650); return;
    }
    case 'tab': S.tab = el.dataset.t; S.viewing = null; S.settings = false; S.full = false; S.flist = null; S.bubbles = false; closeSheet(); return render();
    case 'flist': S.flist = el.dataset.v; S.viewing = null; return render();
    case 'flseg': S.flist = el.dataset.v; return render();
    case 'unflist': S.flist = null; return render();
    case 'openboard': S.cur = +el.dataset.i; S.addTo = S.cur; S.tab = 'board'; S.flist = null; return render();
    case 'editprof': return openProfSheet();
    case 'saveprof': {
      const n = $('#pname').value.trim(), hd = $('#phandle').value.trim(), bi = $('#pbio').value.trim();
      if (n) S.me.name = n; if (hd) S.me.handle = hd[0] === '@' ? hd : '@' + hd; S.me.bio = bi; closeSheet(); render(); return toast('Profile saved');
    }
    case 'redoquiz': S.redo = true; S.step = 'quiz'; S.qi = 0; S.answers = []; S.settings = false; return render();
    case 'tutorial': return tutorialSheet();
    case 'tutorial-done': S.seenTutorial = true; save(); return closeSheet();
    case 'full': S.full = true; return render();
    case 'unfull': S.full = false; return render();
    case 'boardmenu': return menu(el, [...S.boards.map((b, i) => ({ label: b.name, act: 'board', data: { i }, on: i === S.cur })), '-', { label: 'New map', act: 'newboard' }]);
    case 'board': S.cur = +el.dataset.i; S.addTo = S.cur; return render();
    case 'newboard': S.boards.push({ name: 'New map ' + S.boards.length, items: [], dismissed: [] }); S.cur = S.boards.length - 1; S.addTo = S.cur; render(); return toast('New map. Add a few songs or pictures.');
    case 'item': return itemSheet(id);
    case 'hunch': return hunchSheet(id);
    case 'keep': closeSheet(); addTo(S.cur, id); return render();
    case 'dismiss': cur().dismissed.push(id); closeSheet(); render(); return toast('Got it. We’ll stop suggesting that.');
    case 'remove': { const b = cur(); b.items = b.items.filter(x => x !== id); if (CAT[id] && CAT[id].d === 'film') b.dismissed.push(id); closeSheet(); render(); return toast('Removed from ' + b.name); }
    case 'add': S.aq = ''; S.atype = 'all'; return addSheet();
    case 'atype': S.atype = el.dataset.v; return fillAdd();
    case 'addit': closeSheet(); addTo(S.cur, id); return render();
    case 'addcustom': {
      const t = el.dataset.t, cid = 'c' + Date.now(), label = CUSTOM.find(x => x[0] === t)[1];
      const c = { id: cid, t, d: LAYER_OF[t], kind: label, title: S.aq.trim(), by: 'Added by you', tags: [], custom: true };
      S.custom.push(c); CAT[cid] = c; closeSheet(); addTo(S.cur, cid); return render();
    }
    case 'disc': S.addTo = S.cur; return discSheet(id);
    case 'dsearch': return openSearch(true);
    case 'dsearchx': return openSearch(false);
    case 'bubbles': S.bubbles = true; closeSheet(); return render();
    case 'unbubbles': S.bubbles = false; return render();
    case 'surprise': { const pool = discoverList(cur()).slice(0, 25); if (pool.length) { S.addTo = S.cur; discSheet(pool[Math.floor(Math.random() * pool.length)].id); } return; }
    case 'pickboard': S.addTo = +el.dataset.i; return discSheet(id);
    case 'dadd': closeSheet(); addTo(S.addTo, id); return render();
    case 'dskip': if (CAT[id] && CAT[id].d === 'film') { cur().dismissed.push(id); closeSheet(); render(); return toast('Skipped'); } return closeSheet();
    case 'peek': S.viewing = el.dataset.u; closeSheet(); return render();
    case 'unpeek': S.viewing = null; return render();
    case 'peek-item': return peekSheet(id);
    case 'follow': { const k = el.dataset.u; S.follow[k] = !S.follow[k]; render(); return toast(S.follow[k] ? 'Following ' + PEOPLE[k].h : 'Unfollowed'); }
    case 'settings': S.settings = true; closeSheet(); return render();
    case 'unsettings': S.settings = false; return render();
    case 'pv': S.priv[el.dataset.k] = el.dataset.v; return render();
    case 'bvismenu': { const i = +el.dataset.i, b = S.boards[i]; return menu(el, ['public', 'followers', 'only me'].map(v => ({ label: VISL[v], act: 'bvis', data: { i, v }, on: (b.vis || 'public') === v }))); }
    case 'bvis': S.boards[+el.dataset.i].vis = el.dataset.v; return render();
    case 'pswitch': S.priv[el.dataset.k] = !S.priv[el.dataset.k]; return render();
    case 'toast': return toast(el.dataset.msg);
    case 'close': return closeSheet();
    case 'closemenu': return closeMenu();
    case 'hardreset': {
      const btn = $('#resetBtn'), sp = btn.querySelector('span');
      if (!btn.classList.contains('armed')) { btn.classList.add('armed'); sp.textContent = 'Tap again to reset'; clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove('armed'); sp.textContent = 'Reset prototype'; }, 3000); return; }
      clearTimeout(btn._t); btn.classList.remove('armed'); sp.textContent = 'Reset prototype'; toggleWiz(false); return resetAll();
    }
    case 'wz-close': return toggleWiz(false);
    case 'wz-jump': closeSheet(); closeMenu(); S.settings = false; S.full = false; return go(el.dataset.to);
    case 'wz-undismiss': S.boards.forEach(b => { b.dismissed = []; }); render(); return toast('Skipped suggestions are back');
    case 'wz-tutorial': toggleWiz(false); if (S.step !== 'app') go('board'); return tutorialSheet();
    case 'wz-reset': toggleWiz(false); return resetAll();
    case 'wz-engine': { try { localStorage.setItem(ENGINE_KEY, el.dataset.v); } catch (e) { /* ignore */ } save(); location.reload(); return; }
  }
}

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled && ENGINE) act(el); });
document.addEventListener('keydown', e => {
  if (e.key === '`' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); toggleWiz(); return; }
  if (e.key === 'Escape') { if ($('#sbox') && $('#sbox').classList.contains('open') && $('#sheetWrap').hidden) { openSearch(false); return; } if (!$('#menuWrap').hidden) closeMenu(); else if (!$('#sheetWrap').hidden) closeSheet(); else if (!$('#wiz').hidden) toggleWiz(false); return; }
  const el = e.target.closest && e.target.closest('[data-act][role="button"]'); if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(el); }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.aq = e.target.value; fillAdd(); } else if (e.target.id === 'dq') searchResults(e.target.value); });

function render() {
  let h;
  if (S.step === 'app' && !S.boards.length) seedBoards();
  if (G) { cancelAnimationFrame(G.raf); G = null; }
  if (B) { cancelAnimationFrame(B.raf); B = null; }
  if (S.step !== 'app') h = renderOnb();
  else if (S.full && S.tab === 'board' && !S.settings && !S.viewing) h = renderFull();
  else if (S.bubbles && S.tab === 'discover' && !S.settings && !S.viewing && !S.flist) h = renderBubbles();
  else if (S.settings) h = renderSettings();
  else if (S.viewing) h = renderPeek();
  else if (S.flist) h = renderFollowList();
  else { if (!['board', 'discover', 'account'].includes(S.tab)) S.tab = 'account'; h = ({ board: renderBoard, discover: renderDiscover, account: renderAccount })[S.tab]() + tabbar(); }
  $('#screen').innerHTML = h; S.newId = null; save();
  if ($('#graph')) initGraph();
  if ($('#bfield')) initBubbles();
  const sc = $('.scroll.under'); $('#screen').classList.toggle('flush', !!sc); if (sc) { sc.onscroll = onScrollFx; onScrollFx(); }
}

/* ---------- start ---------- */
async function boot() {
  const meta = n => { const el = document.querySelector(`meta[name="${n}"]`); return el ? el.content.trim() : ''; };
  let prefer = new URLSearchParams(location.search).get('engine');
  if (!prefer) { try { prefer = localStorage.getItem(ENGINE_KEY); } catch (e) { prefer = null; } }
  prefer = prefer || meta('umix-engine') || 'auto';
  const apiBase = meta('umix-api').replace(/\/$/, '');
  try {
    ENGINE = await createEngine({ prefer, apiBase });
  } catch (err) {
    $('#screen').innerHTML = `<div class="boot"><h1 class="lt">Couldn’t load <i>the model</i></h1><p class="sub">${esc(err.message)}. Run backend/bin/train.jl to make model/umix-model.json, or start the Julia server.</p></div>`;
    return;
  }
  loadCatalog(ENGINE.model);
  restore();
  if (S.step === 'building') S.step = 'quiz';
  render();
  fillWizard();
  window.umix = { engine: ENGINE, state: () => S };   // handy in the console while testing
}
boot();
