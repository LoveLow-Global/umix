// Keeping, skipping and removing picks, with the user test log.
import { model } from './model.js'
import { picksFor, rankOf } from './picks.js'
import { LAYERS, addInput, countGiven, getState, removeInput, skip, toast } from './store.js'
import { logVerdict } from './testlog.js'

/** notes one answer about a pick, with where the model ranked it right before */
function log(action, layer, it, from, withRank = true) {
  const m = model(), s = getState()
  const r = withRank ? rankOf(m, s, layer, it.id) : { rank: null, of: null, pick: null }
  const p = withRank ? picksFor(m, s, layer).picks.find(x => x.item.id === it.id) : null
  logVerdict({
    action, from, layer, id: it.id, name: it.name, rank: r.rank, of: r.of,
    match: r.pick ? Math.round(r.pick.match * 1000) / 1000 : null, score: r.pick ? Math.round(r.pick.score * 10000) / 10000 : null,
    because: p?.because?.name ?? null, becauseLayer: p?.because?.layer ?? null,
    given: Object.fromEntries(LAYERS.map(L => [L, countGiven(s, L)])), section: s.profile.section, age: s.profile.age || null,
  }, m.manifest)
}

export function keepPick(layer, it, from) {
  log('keep', layer, it, from)
  addInput(layer, it.id, 'graph', 'pick')
  toast(`Added ${it.name} to your map`)
}

export function skipPick(layer, it, from) {
  log('skip', layer, it, from)
  skip(layer, it.id)
  toast('Got it. We won’t show that again.')
}

/** removes something they gave. If it was one of our picks they kept, that counts as a change of mind */
export function removeGiven(layer, x, it, from) {
  if (x.via === 'pick' && it) log('remove', layer, it, from, false)
  removeInput(layer, x.id)
}
