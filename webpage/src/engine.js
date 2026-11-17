// Copied from frontend/js/engine.js by scripts/sync.mjs. Edit that file, this copy gets replaced.
// um!x engine
//
// Runs the trained multi-layer GCN. Two ways to do it:
//   browser  load model/umix-model.json and do the math right here (works on a static
//            host like Vercel, no server needed)
//   julia    send the map to the Julia API (backend/bin/serve.jl) and let it answer
// Both use the same exported file and the same math, so they give the same picks.
// scripts/check_parity.mjs runs this file in Node against Julia's answers to prove it.
//
// The graph part of the GCN already happened during training, so the file holds the
// final item vectors. What runs here is the small "user tower" that reads a NEW map.
// This file has no DOM code, so a React app can import it as is.

export const DOMAINS = ['music', 'visual', 'film'];

/** Adds a lookup table (id -> [domain, index]) to a parsed model file. */
export function prepareModel(m) {
  if (m.format !== 'umix-mlgcn/1') throw new Error('unknown model format ' + m.format);
  const index = new Map();
  for (const d of DOMAINS) m.items[d].forEach((it, i) => index.set(it.id, [d, i]));
  return { ...m, index };
}

function meanRows(E, idx) {
  const d = E[0].length, out = new Float64Array(d);
  for (const i of idx) { const r = E[i]; for (let k = 0; k < d; k++) out[k] += r[k]; }
  for (let k = 0; k < d; k++) out[k] /= idx.length;
  return out;
}

/** User vector for one map: average each source layer, attention mixes them, small residual MLP. */
export function userVector(m, mus, vis) {
  const d = m.emb.film[0].length, F = m.fusion;
  const P = [new Float64Array(d), new Float64Array(d)], mask = [0, 0];
  [[mus, 'music'], [vis, 'visual']].forEach(([lst, dom], k) => {
    if (lst.length) { mask[k] = 1; P[k] = meanRows(m.emb[dom], lst); }
  });
  let a;
  if (m.config.fusion === 'attention') {
    const h = F.ba.length;
    const logits = [0, 1].map(k => {
      let s = 0;
      for (let j = 0; j < h; j++) {
        let x = F.ba[j];
        for (let i = 0; i < d; i++) x += P[k][i] * F.Wa[i][j];
        s += F.qa[j] * Math.tanh(x);
      }
      return s + (mask[k] - 1) * 1e4;
    });
    const mx = Math.max(logits[0], logits[1]);
    const e = logits.map(x => Math.exp(x - mx)), z = e[0] + e[1];
    a = [e[0] / z, e[1] / z];
  } else {
    const n = Math.max(mask[0] + mask[1], 1);
    a = [mask[0] / n, mask[1] / n];
  }
  const zbar = new Float64Array(d);
  for (let i = 0; i < d; i++) zbar[i] = a[0] * P[0][i] + a[1] * P[1][i];
  const hid = new Float64Array(d);
  for (let j = 0; j < d; j++) {
    let x = F.b1[j];
    for (let i = 0; i < d; i++) x += zbar[i] * F.W1[i][j];
    hid[j] = x > 0 ? x : 0;
  }
  const z = new Float64Array(d);
  for (let j = 0; j < d; j++) {
    let x = zbar[j] + F.b2[j];
    for (let i = 0; i < d; i++) x += hid[i] * F.W2[i][j];
    z[j] = x;
  }
  return { z, a };
}

/** Score of every film for a user vector. */
export function filmScores(m, z) {
  const E = m.emb.film, b = m.film_bias, d = z.length;
  const s = new Float64Array(E.length);
  for (let f = 0; f < E.length; f++) {
    let x = b[f];
    const r = E[f];
    for (let k = 0; k < d; k++) x += r[k] * z[k];
    s[f] = x;
  }
  return s;
}

/** Splits item ids into music and visual indices. Films, custom items and unknown ids are skipped. */
export function sourceLists(m, ids) {
  const mus = [], vis = [];
  for (const id of ids) {
    const hit = m.index.get(id);
    if (!hit) continue;
    const [d, i] = hit;
    if (d === 'music' && !mus.includes(i)) mus.push(i);
    if (d === 'visual' && !vis.includes(i)) vis.push(i);
  }
  return { mus, vis };
}

const r3 = x => Math.round(x * 1000) / 1000;
const r4 = x => Math.round(x * 10000) / 10000;

/**
 * Top films / TV for a map. Same output as POST /api/recommend:
 * { recs: [{ id, score, match, because, shared }], weights: { music, visual }, used: { music, visual } }
 * `because` is the saved item that pushes the pick up the most: take it off the map,
 * and the pick's score drops the most.
 */
export function recommend(m, ids, { k = 12, exclude = [] } = {}) {
  const { mus, vis } = sourceLists(m, ids);
  const { z, a } = userVector(m, mus, vis);
  const s = filmScores(m, z);
  const films = m.items.film;
  const banned = new Set([...ids, ...exclude]);
  const order = [...s.keys()].sort((x, y) => s[y] - s[x]).filter(f => !banned.has(films[f].id));
  const top = order.slice(0, k);
  const smax = order.length ? s[order[0]] : 0;
  const sources = [...mus.map(i => ['music', i]), ...vis.map(i => ['visual', i])];
  const without = sources.map(([dom, i]) => {
    const m2 = dom === 'music' ? mus.filter(x => x !== i) : mus;
    const v2 = dom === 'visual' ? vis.filter(x => x !== i) : vis;
    return filmScores(m, userVector(m, m2, v2).z);
  });
  const recs = top.map(f => {
    let because = null, shared = [];
    if (sources.length) {
      let j = 0, best = -Infinity;
      without.forEach((w, q) => { const drop = s[f] - w[f]; if (drop > best) { best = drop; j = q; } });
      const src = m.items[sources[j][0]][sources[j][1]];
      because = src.id;
      shared = films[f].tags.filter(t => src.tags.includes(t));
    }
    const match = Math.min(1, Math.max(0.12, Math.exp((s[f] - smax) / m.match_temperature)));
    return { id: films[f].id, score: r4(s[f]), match: r3(match), because, shared };
  });
  return { recs, weights: { music: r3(a[0]), visual: r3(a[1]) }, used: { music: mus.length, visual: vis.length } };
}

// ---------- the two engines ----------

async function getJSON(url, ms, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' answered ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

class BrowserEngine {
  constructor(model) { this.model = model; this.mode = 'browser'; this.sync = true; }
  recommendNow(ids, opts) { return recommend(this.model, ids, opts); }
  recommend(ids, opts) { return Promise.resolve(this.recommendNow(ids, opts)); }
}

class JuliaEngine {
  constructor(model, apiBase, health) {
    this.model = model; this.apiBase = apiBase; this.health = health; this.mode = 'julia'; this.sync = false;
  }
  recommendNow(ids, opts) { return recommend(this.model, ids, opts); }
  async recommend(ids, { k = 12, exclude = [] } = {}) {
    return getJSON(this.apiBase + '/api/recommend', 8000, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: ids, exclude, k }),
    });
  }
}

/**
 * prefer: 'auto' (Julia API if it answers, else the browser), 'julia' or 'browser'.
 * apiBase: where the Julia server lives ('' means same origin).
 */
export async function createEngine({ prefer = 'auto', modelUrl = 'model/umix-model.json', apiBase = '' } = {}) {
  if (prefer !== 'browser') {
    try {
      const health = await getJSON(apiBase + '/api/health', 1500);
      if (health && health.ok) {
        const model = prepareModel(await getJSON(apiBase + '/api/model', 10000));
        return new JuliaEngine(model, apiBase, health);
      }
    } catch (err) {
      if (prefer === 'julia') console.warn('Julia API not reachable, using the browser engine', err);
    }
  }
  return new BrowserEngine(prepareModel(await getJSON(modelUrl, 20000)));
}
