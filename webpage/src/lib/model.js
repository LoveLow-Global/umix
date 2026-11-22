// Loads the trained model and its catalogue from /model, and answers "what is this item" and
// "find me Taylor Swift". The model math itself is in engine.js.
//
// Files (written by backend/bin/export.jl):
//   manifest.json   sizes, tag names, the small network weights, test numbers
//   music.json, film.json, style.json   one catalogue per layer, as columns (id, name, sub, img, fans, tags, ...)
//   search.json     real items that are too rare for the graph, they count through their tags
//   vectors.bin     item vectors (8 bit), their scales and biases, and tag vectors (32 bit)
import { useEffect, useState } from 'react'
import { attachSearch, norm, prepare } from './engine.js'

export { norm }

const BASE = import.meta.env.BASE_URL + 'model/'
let MODEL = null
let loading = null
const listeners = new Set()
const changed = () => { for (const l of listeners) l() }

async function get(f, kind = 'json') {
  const r = await fetch(BASE + f)
  if (!r.ok) throw new Error(`${f} answered ${r.status}`)
  return kind === 'json' ? r.json() : r.arrayBuffer()
}

/**
 * Loads the model once, later calls get the same promise. The search-only list (the biggest file)
 * comes after, in the background, so pages show up sooner.
 */
export function loadModel() {
  loading ??= (async () => {
    const manifest = await get('manifest.json')
    const [music, film, style, bin] = await Promise.all([
      get(manifest.catalog.music), get(manifest.catalog.film), get(manifest.catalog.style), get(manifest.vectors.file, 'bin'),
    ])
    MODEL = prepare(manifest, { music, film, style }, null, bin)
    get(manifest.search).then(s => { attachSearch(MODEL, s); changed() }, e => console.warn('um!x: search list did not load', e))
    return MODEL
  })()
  return loading
}

export const model = () => MODEL

/** { model, error } in a component, redraws when the model or the search list arrives */
export function useModel() {
  const [, setTick] = useState(0)
  const [error, setError] = useState(null)
  useEffect(() => {
    let live = true
    const redraw = () => live && setTick(t => t + 1)
    listeners.add(redraw)
    if (!MODEL) loadModel().then(redraw, e => live && setError(e))
    return () => { live = false; listeners.delete(redraw) }
  }, [])
  return { model: MODEL, error }
}

/* ---------- items ---------- */

/** one item as an object. src is graph (in the model) or search (known, counts through its tags) */
export function item(m, layer, id, src) {
  const which = src === 'search' ? m.cold[layer] : m.cat[layer]
  const i = which.index.get(id)
  if (i === undefined) {
    if (src === undefined) return item(m, layer, id, 'search')   // look in the rare list too
    return null
  }
  const c = which.cols
  return {
    layer, id, i, src: src || 'graph',
    name: c.name[i], sub: c.sub ? c.sub[i] : '', img: c.img ? c.img[i] : null, info: c.info ? c.info[i] : '',
    fans: c.fans ? c.fans[i] : 0, tags: c.tags[i] || [], kind: c.kind ? c.kind[i] : '',
  }
}

/** a genre or category tag as an item-like object, for the inputs list */
export function tagItem(m, layer, name) {
  const t = m.tagIndex[layer].get(name)
  return t === undefined ? null : { layer, id: name, src: 'tag', name, sub: 'Genre', tags: [t], img: null }
}

/** the item behind one saved input */
export function inputItem(m, layer, x) {
  return x.src === 'tag' ? tagItem(m, layer, x.id) : item(m, layer, x.id, x.src)
}

export const imageUrl = (img, size = 300) => img ? `https://m.media-amazon.com/images/I/${img}._SL${size}_.jpg` : null

/* ---------- search ---------- */

/** finds items by name (and a few extra words like a director), best match first, graph items before rare ones.
 * Accents and punctuation don't matter, so "beyonce" finds Beyoncé and "ac dc" finds AC/DC. */
export function search(m, layer, query, { limit = 12, section } = {}) {
  const q = norm(query)
  if (!q) return []
  const words = q.split(' ')
  const out = []
  for (const src of ['graph', 'search']) {
    const L = src === 'graph' ? m.cat[layer] : m.cold[layer]
    const { names, infos, cols } = L
    for (let i = 0; i < names.length; i++) {
      if (layer === 'style' && section && !fitsSection(cols.kind[i], section)) continue
      const n = names[i]
      let s = 0
      if (n === q) s = 5
      else if (n.startsWith(q)) s = 4
      else if (words.every(w => n.includes(w))) s = n.includes(' ' + words[0]) ? 3 : 2
      else if (infos[i] && words.every(w => infos[i].includes(w))) s = 1
      if (!s) continue
      const fans = cols.fans ? cols.fans[i] : 0
      out.push({ src, i, s: s + (src === 'graph' ? .5 : 0) + Math.log1p(fans) / 20 })
    }
  }
  out.sort((a, b) => b.s - a.s)
  return out.slice(0, limit).map(o => item(m, layer, (o.src === 'graph' ? m.cat : m.cold)[layer].cols.id[o.i], o.src))
}

/** style items are tagged w (women's), m (men's) or u (anyone) */
export const fitsSection = (sec, section) => !section || section === 'both' || !sec || sec === 'u' || sec === section[0]

/** the most loved items in a layer */
export function popular(m, layer, { limit = 24, section, skip = new Set() } = {}) {
  const c = m.cat[layer].cols
  const out = []
  for (const i of m.cat[layer].byFans) {
    if (out.length >= limit) break
    if (skip.has(c.id[i])) continue
    if (layer === 'style' && !fitsSection(c.kind[i], section)) continue
    out.push(item(m, layer, c.id[i], 'graph'))
  }
  return out
}

/** genres to offer as chips */
export const chips = (m, layer) => m.manifest.chips[layer].map(t => m.manifest.tags[layer][t])
