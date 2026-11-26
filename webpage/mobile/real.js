// The real model behind the phone prototype. The prototype's screens stay as designed; making a map
// (onboarding, New map, Add) and the suggestions on a map come from here, from the trained model in
// public/model, the same one the main site uses.
//
// A map keeps what feeds the model in map.real: { inputs: { music, film, style }, skipped: { ... } },
// with inputs shaped like the main site's ({ id, src, via }), so picks.js can work on one map at a time.
import { LAYERS } from '../src/lib/engine.js'
import { imageUrl, item, loadModel, popular as popularOf, search as searchOf, tagItem } from '../src/lib/model.js'
import { picksFor, rankOf } from '../src/lib/picks.js'
import { logVerdict } from '../src/lib/testlog.js'

export { LAYERS, imageUrl }

let M = null
let loading = null
/** loads the model once. Resolves to the model, or rejects if the files don't load */
export function load() {
  loading ??= loadModel().then(m => (M = m))
  return loading
}
export const ready = () => !!M
export const people = () => M?.manifest.stats?.people

export const emptyReal = () => ({ inputs: { music: [], film: [], style: [] }, skipped: { music: [], film: [], style: [] } })

/** one map as the state picks.js expects. Without setup answers, the quiz's genres don't count */
function state(map, useQuiz = true) {
  const inputs = {}
  for (const L of LAYERS) inputs[L] = map.real.inputs[L].filter(x => useQuiz || x.via !== 'quiz')
  return { inputs, skipped: map.real.skipped, profile: { section: 'both' } }
}

/** the model's picks for one layer of a map, best first: [{ item, match, because }] */
export function picks(map, layer, k = 6, useQuiz = true) {
  if (!M || !map.real) return []
  return picksFor(M, state(map, useQuiz), layer, k).picks
}

export const find = (layer, id, src) => (M ? item(M, layer, id, src) : null)
export const genre = (layer, name) => (M ? tagItem(M, layer, name) : null)
export const search = (layer, q, limit = 8) => (M ? searchOf(M, layer, q, { limit }) : [])
export const popular = (layer, limit = 12) => (M ? popularOf(M, layer, { limit }) : [])
/** genre names of an item */
export const genres = it => (M ? it.tags.map(t => M.manifest.tags[it.layer][t]).filter(Boolean) : [])

/** saves a keep, skip or remove for the user test, with where the model ranked it just before */
export function log(action, map, it, from, useQuiz = true) {
  if (!M || !map.real) return
  const s = state(map, useQuiz)
  const r = action === 'remove' ? { rank: null, of: null, pick: null } : rankOf(M, s, it.layer, it.id)
  const p = picksFor(M, s, it.layer).picks.find(x => x.item.id === it.id)
  logVerdict({
    action, from, layer: it.layer, id: it.id, name: it.name, rank: r.rank, of: r.of,
    match: r.pick ? Math.round(r.pick.match * 1000) / 1000 : null, score: r.pick ? Math.round(r.pick.score * 10000) / 10000 : null,
    because: p?.because?.name ?? null, becauseLayer: p?.because?.layer ?? null,
    given: Object.fromEntries(LAYERS.map(L => [L, s.inputs[L].filter(x => x.src !== 'tag').length])), section: 'both', age: null,
  }, M.manifest)
}
