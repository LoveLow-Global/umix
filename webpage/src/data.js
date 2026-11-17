// Fixed content for the app: sample people, the taste questions, cover colors and small helpers.
// The catalogue itself (songs, pictures, clothes, films) comes from the model file, see store.js.

export const LAYERS = ['music', 'visual', 'film']
export const LAYER_OF = { music: 'music', image: 'visual', fashion: 'visual', film: 'film' }
export const FILTERS = [['all', 'All'], ['music', 'Music'], ['visual', 'Visual'], ['film', 'Film & TV']]
export const CUSTOM = [['music', 'Song'], ['image', 'Image'], ['fashion', 'Fashion'], ['film', 'Film']]
export const VISL = { public: 'Everyone', followers: 'Followers', 'only me': 'Only me' }

/** which glyph to draw for an item: music, image, fashion or film */
export function shapeOf(kind, layer) {
  if (layer === 'music') return 'music'
  if (layer === 'visual') return kind === 'Fashion' ? 'fashion' : 'image'
  return 'film'
}

/* ---------- sample social data (made up, like in the design prototype) ---------- */
export const PEOPLE = {
  mina: { h: '@mina.k', board: 'Rainy library', items: ['rain', 'ad', 'bks', 'cafes', 'trc', 'ber', 'gym', 'lit'] },
  dohyun: { h: '@dohyun', board: 'Slow cinema', items: ['itm', 'as', 'pl', 'hol', 'ofp', 'ttn'] },
  seoy: { h: '@seo.y', board: 'Loud summer', items: ['mm', 'bib', 'mr', 'sea', 'road', 'bts', 'crw'] },
  jiwoo: { h: '@jiwoo', board: 'Quiet mornings', items: ['fth', 'hol', 'win', 'snow', 'cdl', 'lin', 'pd'] },
  hana: { h: '@hana.p', board: 'Film club', items: ['fh', 'lw', 'lll', 'pat', 'bss', 'dsk', 'tot2'] },
  tae: { h: '@tae.k', board: 'Night drive', items: ['ic', 'tok', 'br', 'road', 'ncl', 'blj', 'drv'] },
}
export const FOLLOWERS = ['mina', 'jiwoo', 'hana', 'tae', 'seoy']

// linked apps only bring in a few top items (pilot finding 03)
export const ACC = [
  { k: 'spotify', name: 'Spotify', t: 'music', sub: 'Brings your 3 most played songs', items: ['pw', 'ms', 'sc'] },
  { k: 'pinterest', name: 'Pinterest', t: 'image', sub: 'Brings 2 pictures from your top board', items: ['sun', 'rain'] },
]

// either/or questions, every answer is a real catalogue item that lands on the first map
export const QS = [
  { a: { t: 'AC/DC', s: 'Leather, volume, no notes', g: 'music', items: ['bib'] }, b: { t: 'Taylor Swift', s: 'Bridges, cardigans, lore', g: 'music', items: ['car'] } },
  { a: { t: 'Sunrise', s: 'First train, cold coffee', g: 'image', items: ['sun'] }, b: { t: '3 a.m.', s: 'Neon, taxis, one more song', g: 'image', items: ['neo'] } },
  { a: { t: 'A cream knit sweater', s: 'Soft, warm, a little too big', g: 'fashion', items: ['ckn'] }, b: { t: 'A black leather jacket', s: 'Zipped up, scuffed on purpose', g: 'fashion', items: ['blj'] } },
  { a: { t: 'A rainy café', s: 'Window seat, no plans', g: 'image', items: ['cafes'] }, b: { t: 'A seaside road trip', s: 'Windows down, sand in the car', g: 'image', items: ['sea'] } },
  { a: { t: 'Nujabes on loop', s: 'Rain on the window, homework open', g: 'music', items: ['ad'] }, b: { t: 'MGMT, loud', s: 'Windows down, singing badly', g: 'music', items: ['kds'] } },
  { a: { t: 'Round wire glasses', s: 'A good pen, a worse memory', g: 'fashion', items: ['rwg'] }, b: { t: 'A bucket hat', s: 'Sunscreen and a festival wristband', g: 'fashion', items: ['bkt'] } },
]
export const NOTES = ['Noted. Your map just got a little louder.', 'The map is listening.', 'That tells us a lot.', 'Interesting. Keep going.', 'Almost there.', 'That’s everything we need.']

/* ---------- cover colors, picked from an item's first two mood tags ---------- */
export const MOODC = {
  summer: ['#EE9447', '#C24A2A'], dusk: ['#EE8A69', '#6E4FA6'], warm: ['#E09A55', '#9E4A31'], night: ['#3A3F7A', '#14183A'], neon: ['#D23E8A', '#33267A'],
  city: ['#5B6C8C', '#1E2A3F'], rain: ['#6C8AA5', '#273B50'], calm: ['#7AA59D', '#2F5654'], quiet: ['#9B998B', '#47493F'], melancholy: ['#82709A', '#36304A'],
  longing: ['#B06E8C', '#46293F'], romance: ['#DE7486', '#7E2D4A'], dream: ['#9786DD', '#3F3F8C'], fantasy: ['#4FA9A1', '#33467F'], energy: ['#E4493B', '#6E1A27'],
  loud: ['#D9372D', '#2E1212'], rock: ['#B73A30', '#1E1A1A'], epic: ['#C68E39', '#553517'], desert: ['#D79D58', '#8C4F25'], sea: ['#3B97B1', '#173F5C'],
  travel: ['#56A09C', '#294F6E'], youth: ['#8EBF48', '#2F6A44'], quirky: ['#E1BE45', '#B5502F'], memory: ['#C49683', '#5E434A'], tender: ['#E3A1A6', '#8B4E64'],
  literary: ['#9C8160', '#463527'], writing: ['#8A7962', '#383026'], analog: ['#AE784C', '#45301F'], autumn: ['#C46A2E', '#5E2818'], storytelling: ['#B5743A', '#523425'],
  everyday: ['#A09D86', '#4F4D42'], cafe: ['#9A7154', '#412E22'], talky: ['#C8826A', '#5E4152'], slow: ['#6B7CA0', '#2A3049'], dark: ['#4A4458', '#16141C'],
  vintage: ['#C49A6C', '#5E4630'], glam: ['#D4A5C9', '#6B2D5C'], minimal: ['#B9B6AE', '#55534D'], cozy: ['#D9A06B', '#7A4A2E'], street: ['#7C8794', '#2B3038'],
  nature: ['#7FAF6B', '#2F5A33'],
}
export const TBASE = { film: ['#D2603F', '#5E2A1E'], music: ['#5E9150', '#23402A'], image: ['#C9668A', '#55263C'], fashion: ['#C8952A', '#5A3E12'] }

/** a stable number for a string, so each cover always gets the same gradient */
export function hsh(s) {
  let h = 2166136261
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function pal(c) {
  const a = MOODC[c.tags[0]] || TBASE[c.t], b = MOODC[c.tags[1]] || MOODC[c.tags[0]] || TBASE[c.t]
  return [a[0], b[0], a[1]]
}

/* ---------- small helpers ---------- */
export const f = n => (+n).toFixed(1)
export const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s
/** quadratic curve from a to b, bent sideways by k */
export function cv(a, b, k) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y
  return `M${f(a.x)},${f(a.y)} Q${f(mx - dy * k)},${f(my + dx * k)} ${f(b.x)},${f(b.y)}`
}
