// App state, the trained model, and the film picks it makes for each map.
//
// State is one plain object. Change it only with update(fn). fn gets a copy to change,
// then every screen redraws and the copy is saved in localStorage (except `ui`, which is
// what's on screen right now, like an open sheet or a toast).
// Picks come from engine.js and are cached per map, so the model only runs again when a map changes.
import { useSyncExternalStore } from 'react'
import { createEngine } from './engine.js'
import { ACC, LAYERS, PEOPLE, QS, shapeOf } from './data.js'

/* ---------- the catalogue: every item in the model, plus things people add themselves ---------- */
// id -> { id, t (glyph), d (layer), kind, title, by, tags, custom? }
export const CAT = {}

function loadCatalog(model) {
  for (const d of LAYERS) for (const it of model.items[d])
    CAT[it.id] = { id: it.id, t: shapeOf(it.kind, d), d, kind: it.kind, title: it.title, by: it.by, tags: it.tags }
}

/* ---------- state ---------- */
const KEY = 'umix-alpha-v1'
export const ENGINE_KEY = 'umix-engine'

export function fresh() {
  return {
    step: 'welcome', qi: 0, answers: [], links: { spotify: true, pinterest: true },
    tab: 'board', cur: 0, boards: [], settings: false, full: false, bubbles: false, redo: false,
    priv: { profile: 'public', share: 'anon', rhyme: true },
    atype: 'all', aq: '', addTo: 0, viewing: null, follow: { mina: true, hana: true }, custom: [],
    flist: null, seenTutorial: false,
    me: { name: 'Your name', handle: '@you', bio: 'Songs, pictures and films I keep coming back to.' },
    ui: freshUi(),
  }
}
function freshUi() {
  return { sheet: null, menu: null, toast: null, wiz: false, search: false, sq: '', newId: null, picking: false, tick: 0 }
}

let state = fresh()
const listeners = new Set()

export const getState = () => state

/** the one way to change state: update(s => { s.tab = 'discover' }) */
export function update(fn) {
  const next = structuredClone(state)
  fn(next)
  state = next
  save()
  emit()
}

function emit() { for (const l of listeners) l() }
function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }

/** use in a component to get the current state, it redraws when the state changes */
export const useAppState = () => useSyncExternalStore(subscribe, getState)

function save() {
  try {
    const keep = { ...state }
    delete keep.ui
    localStorage.setItem(KEY, JSON.stringify(keep))
  } catch { /* private mode or blocked storage, the app still works */ }
}

function restore() {
  let s = fresh()
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved && saved.step) s = { ...s, ...saved, ui: freshUi() }
  } catch { /* start fresh */ }
  for (const c of s.custom) CAT[c.id] = c
  for (const b of s.boards) {
    b.items = b.items.filter(id => CAT[id])
    b.dismissed = (b.dismissed || []).filter(id => CAT[id])
  }
  if (s.cur >= s.boards.length) s.cur = 0
  if (s.step === 'building') s.step = 'quiz'
  if (s.step === 'app' && !s.boards.length) seedBoards(s)
  state = s
}

/** back to the very start, used by the reset buttons */
export function resetState() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  for (const c of state.custom) delete CAT[c.id]
  RECS.clear()
  state = fresh()
  save()
  emit()
}

/* ---------- the engine ---------- */
// Which engine runs the model:
//   browser  the model file runs right here in the page (the default, and all Vercel needs)
//   julia    ask the Julia server (make serve), fall back to the browser if it doesn't answer
//   auto     same as julia, without the warning
// A ?engine= link or the facilitator panel picks one. Set VITE_UMIX_API to the address of a
// hosted Julia server and the default becomes auto.
let ENGINE = null
let PREFER = 'browser'
let booting = null

export const engine = () => ENGINE
export const enginePreference = () => PREFER

/** loads the model once, then restores the saved state */
export function boot() {
  booting ??= start()
  return booting
}

async function start() {
  const api = (import.meta.env.VITE_UMIX_API || '').replace(/\/$/, '')
  let prefer = new URLSearchParams(location.search).get('engine')
  if (!prefer) { try { prefer = localStorage.getItem(ENGINE_KEY) } catch { prefer = null } }
  PREFER = prefer || (api ? 'auto' : 'browser')
  ENGINE = await createEngine({ prefer: PREFER, apiBase: api, modelUrl: import.meta.env.BASE_URL + 'model/umix-model.json' })
  loadCatalog(ENGINE.model)
  restore()
  emit()
  return ENGINE
}

/* ---------- picks for a map ---------- */
const RECS = new Map()
const PENDING = { recs: [], weights: { music: .5, visual: .5 }, used: { music: 0, visual: 0 }, pending: true }
const sigOf = b => b.items.join(',') + '|' + b.dismissed.join(',')
const modelInput = b => b.items.filter(id => CAT[id] && !CAT[id].custom)

/** the engine's answer for a map: { recs, weights, used }, or a pending answer while Julia thinks */
export function recsOf(b) {
  if (!b || !ENGINE) return PENDING
  const sig = sigOf(b), hit = RECS.get(sig)
  if (hit) return hit
  const ids = modelInput(b), opts = { k: 500, exclude: b.dismissed }
  if (ENGINE.sync) {
    const r = ENGINE.recommendNow(ids, opts)
    RECS.set(sig, r)
    return r
  }
  RECS.set(sig, PENDING)
  ENGINE.recommend(ids, opts)
    .catch(err => {
      console.warn('The Julia engine did not answer, using the browser engine', err)
      return ENGINE.recommendNow(ids, opts)
    })
    .then(r => { RECS.set(sig, r); update(s => { s.ui.tick++ }) })
  return PENDING
}

const RANKED = new WeakMap()
/** every film for a map, best first: { id, s (0 to 1 match), score, from (the save behind it), shared tags } */
export function ranked(b) {
  const r = recsOf(b)
  if (!RANKED.has(r))
    RANKED.set(r, r.recs.filter(x => CAT[x.id]).map(x => ({ id: x.id, s: x.match, score: x.score, from: x.because, shared: x.shared || [] })))
  return RANKED.get(r)
}
export const hunches = b => ranked(b).slice(0, 3)
export const onAnyMap = S => new Set(S.boards.flatMap(x => x.items))
export function discoverList(S, b) {
  const mine = onAnyMap(S)
  return ranked(b).filter(x => !mine.has(x.id))
}
export function findRec(b, id) {
  return ranked(b).find(h => h.id === id) || { s: .5, from: null, shared: [] }
}

/** the reason shown under a pick */
export function why(x) {
  if (x && x.from && CAT[x.from]) {
    const src = CAT[x.from]
    return `People who saved ${src.title} also kept this` + (x.shared.length ? `. You both seem to like things that feel ${x.shared.slice(0, 2).join(' and ')}.` : '.')
  }
  return 'Popular with people who are just starting their maps. Save a few songs or pictures and this gets personal.'
}

/** how much songs vs pictures and clothes counted for a map */
export function balanceText(r) {
  if (r.pending) return 'Asking the engine…'
  const m = Math.round(r.weights.music * 100)
  if (!r.used.music && !r.used.visual) return 'Nothing to read yet. Add songs, pictures or clothes and the picks get personal.'
  if (!r.used.visual) return 'Right now only your songs steer these picks.'
  if (!r.used.music) return 'Right now only your pictures and clothes steer these picks.'
  return `On this map your songs count ${m}% and your pictures and clothes ${100 - m}%.`
}

/* ---------- small things screens need ---------- */
export const cur = S => S.boards[S.cur]
export const vis = (S, b) => S.priv.profile === 'only me' ? 'only me' : (b.vis || 'public')
export const following = S => Object.keys(S.follow).filter(k => S.follow[k] && PEOPLE[k])

export function common(S, k) {
  const mine = onAnyMap(S), n = PEOPLE[k].items.filter(i => mine.has(i)).length
  if (n) return `${n} thing${n > 1 ? 's' : ''} in common`
  const myt = new Set([...mine].filter(i => CAT[i]).flatMap(i => CAT[i].tags))
  const t = PEOPLE[k].items.filter(i => CAT[i]).flatMap(i => CAT[i].tags).find(x => myt.has(x))
  return t ? `You both like ${t} things` : 'Something new for you'
}

export function quizItems(S) {
  const out = []
  S.answers.forEach((a, i) => {
    if (!a || !QS[i]) return
    if (a === 'a' || a === 'both') out.push(...QS[i].a.items)
    if (a === 'b' || a === 'both') out.push(...QS[i].b.items)
  })
  return out
}

/** one first map from the linked apps and the quiz answers (pilot finding 01) */
export function seedBoards(s) {
  const items = []
  ACC.forEach(a => { if (s.links[a.k]) items.push(...a.items) })
  items.push(...quizItems(s))
  s.boards = [{ name: 'My first map', items: [...new Set(items)].filter(id => CAT[id]), dismissed: [] }]
  s.cur = 0
  s.addTo = 0
}
