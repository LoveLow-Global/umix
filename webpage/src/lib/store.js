// What this person told us, saved in localStorage on this device. Nothing is sent anywhere.
//
// State is one plain object. Change it only with update(fn): fn gets a copy to change, then every
// page redraws and the copy is saved (except `ui`, which is what's on screen right now).
import { useSyncExternalStore } from 'react'

export const LAYERS = ['music', 'film', 'style']
export const LAYER = {
  music: { name: 'Music', lower: 'music', things: 'artists', thing: 'artist' },
  film: { name: 'Film & TV', lower: 'film and TV', things: 'films and series', thing: 'title' },
  style: { name: 'Style', lower: 'style', things: 'clothes, shoes and jewelry', thing: 'style' },
}
export const SECTIONS = [['women', 'Women’s'], ['men', 'Men’s'], ['both', 'Both']]
export const AGES = ['Under 18', '18 to 24', '25 to 34', '35 to 44', '45 to 54', '55 or older']

const KEY = 'umix-v2'

export function fresh() {
  return {
    profile: { name: '', age: '', section: 'both' },
    // what they gave us, per layer: { id, src, via }. src is graph (in the model), search (a real item
    // too rare for the graph, it counts through its genres) or tag (a genre they picked). via is
    // 'you' (they added it) or 'pick' (they kept one of our picks)
    inputs: { music: [], film: [], style: [] },
    skipped: { music: [], film: [], style: [] },
    onboarded: false,
    started: null,
    ui: { toast: null },
  }
}

let state = load()
const listeners = new Set()

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved && saved.inputs) return { ...fresh(), ...saved, ui: fresh().ui }
  } catch { /* private mode or blocked storage, start fresh */ }
  return fresh()
}
function save() {
  try {
    const keep = { ...state }
    delete keep.ui
    localStorage.setItem(KEY, JSON.stringify(keep))
  } catch { /* the app still works, it just forgets on reload */ }
}

export const getState = () => state
export function update(fn) {
  const next = structuredClone(state)
  fn(next)
  state = next
  save()
  for (const l of listeners) l()
}
const subscribe = l => { listeners.add(l); return () => listeners.delete(l) }
export const useAppState = () => useSyncExternalStore(subscribe, getState)

/* ---------- small actions ---------- */
let toastN = 0
export function toast(msg) { update(s => { s.ui.toast = { msg, n: ++toastN } }) }

export const hasInput = (s, layer, id) => s.inputs[layer].some(x => x.id === id)
export function addInput(layer, id, src, via = 'you') {
  update(s => {
    if (hasInput(s, layer, id)) return
    s.inputs[layer].push({ id, src, via })
    s.skipped[layer] = s.skipped[layer].filter(x => x !== id)
  })
}
export function removeInput(layer, id) {
  update(s => { s.inputs[layer] = s.inputs[layer].filter(x => x.id !== id) })
}
export function toggleInput(layer, id, src) {
  if (hasInput(getState(), layer, id)) removeInput(layer, id)
  else addInput(layer, id, src)
}
export function skip(layer, id) {
  update(s => { if (!s.skipped[layer].includes(id)) s.skipped[layer].push(id) })
}
export function startOver() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  state = fresh()
  save()
  for (const l of listeners) l()
}
/** how many real things (not genres) they gave in a layer */
export const countGiven = (s, layer) => s.inputs[layer].filter(x => x.src !== 'tag').length
