// The person's picks. Turns what they gave into engine inputs, asks the engine, and keeps the
// answer until something changes.
import { LAYERS, recommend } from './engine.js'
import { fitsSection, inputItem, item } from './model.js'

/** engine inputs for what they gave, and the matching items in the same order (for "because") */
export function engineInputs(m, s) {
  const inputs = {}, items = {}
  for (const L of LAYERS) {
    inputs[L] = []
    items[L] = []
    for (const x of s.inputs[L]) {
      const it = inputItem(m, L, x)
      if (!it) continue
      inputs[L].push(it.src === 'graph' ? { src: 'graph', i: it.i } : { src: it.src, tags: it.tags })
      items[L].push(it)
    }
  }
  return { inputs, items }
}

/** items of `layer` the person shouldn't get: what they gave, what they skipped, the wrong clothes section */
function excluded(m, s, layer) {
  const out = new Set(), idx = m.cat[layer].index
  for (const x of s.inputs[layer]) if (x.src === 'graph' && idx.has(x.id)) out.add(idx.get(x.id))
  for (const id of s.skipped[layer]) if (idx.has(id)) out.add(idx.get(id))
  if (layer === 'style') {
    const kinds = m.cat.style.cols.kind
    for (let i = 0; i < kinds.length; i++) if (!fitsSection(kinds[i], s.profile.section)) out.add(i)
  }
  return out
}

const cache = new Map()

/**
 * Picks for one layer, best first: { picks: [{ item, score, match, rank, because }], weights, total }.
 * `because` is the item they gave that the pick leans on most, `weights` how much each layer counted.
 */
export function picksFor(m, s, layer, k = 40) {
  const key = JSON.stringify([layer, k, s.inputs, s.skipped[layer], s.profile.section, m.searchReady])
  if (cache.has(key)) return cache.get(key)
  const { inputs, items } = engineInputs(m, s)
  const r = recommend(m, inputs, { layer, k, exclude: excluded(m, s, layer) })
  const ids = m.cat[layer].cols.id
  const out = {
    picks: r.picks.map((p, n) => ({
      item: item(m, layer, ids[p.i], 'graph'), score: p.score, match: p.match, rank: n + 1,
      because: p.because ? items[p.because.layer][p.because.n] : null,
    })),
    weights: r.weights,
    total: LAYERS.reduce((t, L) => t + inputs[L].length, 0),
  }
  cache.set(key, out)
  if (cache.size > 60) cache.delete(cache.keys().next().value)
  return out
}

/** where the model ranks one item for this person right now (rank 1 is its top pick), for the test log */
export function rankOf(m, s, layer, id) {
  const i = m.cat[layer].index.get(id)
  if (i === undefined) return { rank: null, of: null, pick: null }
  const { inputs } = engineInputs(m, s)
  const ex = excluded(m, s, layer)
  ex.delete(i)
  const r = recommend(m, inputs, { layer, k: m.cat[layer].cols.id.length, exclude: ex, because: false })
  const n = r.picks.findIndex(p => p.i === i)
  return { rank: n + 1 || null, of: r.picks.length, pick: n >= 0 ? r.picks[n] : null }
}

/** what people who like one item go for in another layer (that item is the only input). Style keeps to the clothes section */
export function alsoLike(m, from, target, k = 6, section = 'both') {
  const inputs = { music: [], film: [], style: [] }
  inputs[from.layer] = [from.src === 'graph' ? { src: 'graph', i: from.i } : { src: from.src, tags: from.tags }]
  const exclude = new Set()
  if (target === from.layer && from.src === 'graph') exclude.add(from.i)
  if (target === 'style') m.cat.style.cols.kind.forEach((sec, i) => { if (!fitsSection(sec, section)) exclude.add(i) })
  const r = recommend(m, inputs, { layer: target, k, exclude, because: false })
  return r.picks.map(p => item(m, target, m.cat[target].cols.id[p.i], 'graph'))
}

/** the line under a pick that says why */
export const reason = p => !p.because ? 'Popular with people who like what you like'
  : p.because.src === 'tag' ? `Because you picked ${p.because.name}` : `Because you like ${p.because.name}`
