// um!x engine: runs the trained model in the browser. No DOM code, so Node can run it too
// (scripts/check_parity.mjs checks it against the Julia version).
//
// The math, for one person
//   1. every input becomes a vector. An item in the graph uses its learned vector Z. A rare item
//      or a genre chip uses the average of its genre vectors G.
//   2. inputs are averaged per layer, giving one vector p per layer they filled in
//   3. attention mixes those: score_l = q . tanh(Wa p_l + ba), softmax over the given layers, z = sum a_l p_l
//   4. each target layer has a small head: u = z + W2 relu(W1 z + b1) + b2
//   5. an item's score is u . Z_item + bias_item
// "Because" is the input that, taken away, lowers the pick's score the most.

export const LAYERS = ['music', 'film', 'style']
export const FORMAT = 'umix/2'

/** lowercase, no accents, no punctuation */
export const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** turns the downloaded files into something fast to use. `search` can be null and come later (attachSearch) */
export function prepare(manifest, catalogs, search, bin) {
  if (manifest.format !== FORMAT) throw new Error('unknown model format ' + manifest.format)
  const blocks = manifest.vectors.blocks
  const block = name => {
    const b = blocks[name]
    if (!b) throw new Error('model file has no ' + name)
    return b.dtype === 'i8' ? new Int8Array(bin, b.offset, b.length) : new Float32Array(bin, b.offset, b.length)
  }
  const m = { manifest, dim: manifest.dim, temp: manifest.match_temperature, cat: {}, cold: {}, tagIndex: {}, Z: {}, scale: {}, bias: {}, G: {}, heads: {} }
  for (const L of LAYERS) {
    m.cat[L] = part(catalogs[L])
    m.cold[L] = part(search ? search[L] : EMPTY)
    m.tagIndex[L] = new Map(manifest.tags[L].map((t, i) => [t, i]))
    m.Z[L] = block(`Z_${L}`)
    m.scale[L] = block(`scale_${L}`)
    m.bias[L] = block(`bias_${L}`)
    m.G[L] = block(`G_${L}`)
    m.heads[L] = { W1: block(`head_${L}_W1`), b1: block(`head_${L}_b1`), W2: block(`head_${L}_W2`), b2: block(`head_${L}_b2`) }
  }
  m.att = { W: block('att_W'), b: block('att_b'), q: block('att_q') }
  m.searchReady = !!search
  return m
}

const EMPTY = { id: [], name: [], sub: [], info: [], kind: [], img: [], fans: [], tags: [] }

/** adds the search-only items once they arrive (the site loads them after the rest) */
export function attachSearch(m, search) {
  for (const L of LAYERS) m.cold[L] = part(search[L])
  m.searchReady = true
}

function part(cols) {
  const n = cols.id.length, ids = [...Array(n).keys()]
  return {
    cols,
    index: new Map(cols.id.map((id, i) => [id, i])),
    names: cols.name.map(norm),
    infos: cols.info ? cols.info.map(norm) : [],
    byFans: cols.fans ? ids.sort((a, b) => cols.fans[b] - cols.fans[a]) : ids,
  }
}

/* ---------- vectors ---------- */

/** vector of one input: { src: 'graph', i } or { src: 'search', tags } or { src: 'tag', tags } */
function inputVector(m, L, x) {
  const d = m.dim, v = new Float64Array(d)
  if (x.src === 'graph') {
    const Z = m.Z[L], s = m.scale[L][x.i], o = x.i * d
    for (let k = 0; k < d; k++) v[k] = Z[o + k] * s
    return v
  }
  const G = m.G[L], tags = x.tags || []
  for (const t of tags) for (let k = 0; k < d; k++) v[k] += G[t * d + k]
  if (tags.length) for (let k = 0; k < d; k++) v[k] /= tags.length
  return v
}

/** sum of input vectors per layer, and how many: { music: { sum, n, list: [vectors] }, ... } */
function layerSums(m, inputs) {
  const out = {}
  for (const L of LAYERS) {
    const list = (inputs[L] || []).map(x => inputVector(m, L, x))
    const sum = new Float64Array(m.dim)
    for (const v of list) for (let k = 0; k < m.dim; k++) sum[k] += v[k]
    out[L] = { sum, n: list.length, list }
  }
  return out
}

/** attention over the layers that have inputs. Returns { z, a } where a holds each layer's share */
function fuse(m, sums) {
  const d = m.dim, { W, b, q } = m.att, h = b.length
  const means = {}, scores = {}
  for (const L of LAYERS) {
    const { sum, n } = sums[L]
    if (!n) continue
    const p = new Float64Array(d)
    for (let k = 0; k < d; k++) p[k] = sum[k] / n
    let s = 0
    for (let r = 0; r < h; r++) {
      let acc = b[r]
      for (let k = 0; k < d; k++) acc += W[r * d + k] * p[k]
      s += q[r] * Math.tanh(acc)
    }
    means[L] = p
    scores[L] = s
  }
  const given = Object.keys(means)
  const z = new Float64Array(d), a = { music: 0, film: 0, style: 0 }
  if (!given.length) return { z, a }
  const mx = Math.max(...given.map(L => scores[L]))
  let tot = 0
  for (const L of given) { a[L] = Math.exp(scores[L] - mx); tot += a[L] }
  for (const L of given) {
    a[L] /= tot
    for (let k = 0; k < d; k++) z[k] += a[L] * means[L][k]
  }
  return { z, a }
}

/** the target layer's head: u = z + W2 relu(W1 z + b1) + b2 */
function head(m, L, z) {
  const d = m.dim, { W1, b1, W2, b2 } = m.heads[L]
  const h = new Float64Array(d), u = new Float64Array(d)
  for (let r = 0; r < d; r++) {
    let acc = b1[r]
    for (let k = 0; k < d; k++) acc += W1[r * d + k] * z[k]
    h[r] = acc > 0 ? acc : 0
  }
  for (let r = 0; r < d; r++) {
    let acc = b2[r] + z[r]
    for (let k = 0; k < d; k++) acc += W2[r * d + k] * h[k]
    u[r] = acc
  }
  return u
}

const scoreOne = (m, L, u, i) => {
  const d = m.dim, Z = m.Z[L], o = i * d
  let acc = 0
  for (let k = 0; k < d; k++) acc += Z[o + k] * u[k]
  return acc * m.scale[L][i] + m.bias[L][i]
}

/* ---------- picks ---------- */

/**
 * Picks for one layer.
 *   inputs   { music: [...], film: [...], style: [...] } with entries { src, i } or { src, tags }, plus id
 *   exclude  item indices of `layer` not to pick (already given, skipped, wrong clothes section)
 * Returns { picks: [{ i, score, match, because }], weights } where because is { layer, n } (the
 * n-th input of that layer) and weights says how much each given layer counted.
 */
export function recommend(m, inputs, { layer, k = 30, exclude = new Set(), because = true } = {}) {
  const sums = layerSums(m, inputs)
  const { z, a } = fuse(m, sums)
  const u = head(m, layer, z)
  const n = m.bias[layer].length
  const s = new Float64Array(n)
  for (let i = 0; i < n; i++) s[i] = scoreOne(m, layer, u, i)
  const order = []
  for (let i = 0; i < n; i++) if (!exclude.has(i)) order.push(i)
  order.sort((x, y) => s[y] - s[x] || x - y)
  const top = order.slice(0, k)
  const smax = order.length ? s[order[0]] : 0
  const picks = top.map(i => ({ i, score: s[i], match: Math.min(1, Math.max(0.12, Math.exp((s[i] - smax) / m.temp))), because: null }))

  // leave one input out at a time, and see which one each pick leans on most
  const total = LAYERS.reduce((t, L) => t + sums[L].n, 0)
  if (because && total > 1) {
    const best = picks.map(() => ({ drop: -Infinity, b: null }))
    for (const L of LAYERS) {
      const { sum, n: cnt, list } = sums[L]
      list.forEach((v, j) => {
        const without = { ...sums, [L]: { sum: sum.map((x, k) => x - v[k]), n: cnt - 1 } }
        const u2 = head(m, layer, fuse(m, without).z)
        picks.forEach((p, r) => {
          const drop = p.score - scoreOne(m, layer, u2, p.i)
          if (drop > best[r].drop) best[r] = { drop, b: { layer: L, n: j } }
        })
      })
    }
    picks.forEach((p, r) => { p.because = best[r].b })
  } else if (total === 1) {
    const L = LAYERS.find(x => sums[x].n === 1)
    picks.forEach(p => { p.because = { layer: L, n: 0 } })
  }
  return { picks, weights: a }
}
