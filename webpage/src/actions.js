// Everything a tap can do. Screens call act('name', { details }), for example act('keep', { id }).
import { CUSTOM, LAYER_OF, PEOPLE, QS, VISL } from './data.js'
import {
  CAT, ENGINE_KEY, cur, discoverList, engine, getState, hunches, quizItems, ranked, recsOf, resetState, seedBoards, update,
} from './store.js'
import { clearLog, exportLog, logVerdict, nextTester } from './testlog.js'

let toastN = 0, menuN = 0, taps = []

export function toast(msg) { update(s => { s.ui.toast = { msg, n: ++toastN } }) }
const sheet = (type, id) => update(s => { s.ui.sheet = { type, id } })
const closeSheet = () => update(s => { s.ui.sheet = null })

/** opens a pull-down menu under the element that was tapped */
function openMenu(el, items) {
  const phone = document.getElementById('phone'), pr = phone.getBoundingClientRect(), ar = el.getBoundingClientRect()
  const sc = pr.width / phone.offsetWidth || 1, pw = phone.offsetWidth
  const left = Math.max(16, Math.min((ar.left - pr.left) / sc, pw - 256)), top = (ar.bottom - pr.top) / sc + 8
  update(s => { s.ui.menu = { left, top, items, n: ++menuN } })
}

const boardShowing = s => s.step === 'app' && s.tab === 'board' && !s.full && !s.settings && !s.viewing && !s.flist

/**
 * For the user test: notes a keep, skip or remove on a film, with where it happened and how the
 * model ranked that film for the map right before (rank 1 is the model's top pick).
 */
function verdict(action, id, from, b) {
  const c = CAT[id]
  if (!c || c.d !== 'film' || c.custom || !b) return
  const list = ranked(b), i = list.findIndex(x => x.id === id), x = list[i]
  const items = b.items.filter(k => CAT[k] && !CAT[k].custom)
  logVerdict({
    action, from, film: id, title: c.title, kind: c.kind,
    rank: x ? i + 1 : null, of: list.length || null, match: x ? x.s : null, score: x ? x.score : null,
    because: x && x.from ? x.from : null, becauseTitle: x && x.from && CAT[x.from] ? CAT[x.from].title : null,
    map: b.name, songs: items.filter(k => CAT[k].d === 'music').length, visual: items.filter(k => CAT[k].d === 'visual').length, items,
  }, engine().model)
}

/** saves an item to a map and says how many new film suggestions it brought. `from` marks a film pick for the test log. */
function addTo(bi, id, from) {
  const S = getState(), b = S.boards[bi]
  if (!b || b.items.includes(id)) return
  if (from) verdict('keep', id, from, b)
  const nb = { ...b, items: [...b.items, id], dismissed: b.dismissed.filter(x => x !== id) }
  let nw = 0
  if (engine().sync) {
    const before = new Set(hunches(b).map(h => h.id))
    nw = hunches(nb).filter(h => !before.has(h.id)).length
  }
  update(s => {
    s.boards[bi] = nb
    if (bi === s.cur && boardShowing(s)) s.ui.newId = id
    s.ui.toast = { msg: `Added to ${nb.name}` + (nw ? ` · ${nw} new suggestion${nw > 1 ? 's' : ''}` : ''), n: ++toastN }
  })
}

function go(to) {
  if (['welcome', 'connect', 'quiz'].includes(to)) {
    update(s => { s.step = to; if (to === 'quiz') s.qi = 0 })
    return
  }
  update(s => {
    if (!s.boards.length) seedBoards(s)
    s.step = 'app'; s.viewing = null; s.flist = null
    s.settings = to === 'settings'
    s.tab = to === 'discover' ? 'discover' : 'board'
  })
}

function next() {
  if (getState().qi < QS.length - 1) update(s => { s.qi++ })
  else startBuilding()
}

/** after the last question, draw the first map while the engine works */
function startBuilding() {
  update(s => {
    s.step = 'building'
    if (s.redo && s.boards.length) {
      const b = cur(s)
      b.items = [...new Set([...b.items, ...quizItems(s).filter(id => CAT[id])])]
      s.redo = false
    } else seedBoards(s)
  })
  recsOf(cur(getState()))   // start asking the engine while the animation plays
  setTimeout(() => {
    if (getState().step !== 'building') return
    update(s => { s.step = 'app'; s.tab = 'board' })
    if (getState().seenTutorial) toast('Your map is ready')
    else setTimeout(() => sheet('tutorial'), 500)
  }, 2700)
}

function resetAll() {
  resetState()
  toast('Back to the start')
}

const A = {
  // tapping the flower logo three times opens the facilitator panel
  wm() {
    const now = Date.now()
    taps = taps.filter(t => now - t < 700)
    taps.push(now)
    if (taps.length >= 3) { taps = []; A.wiz() }
  },
  wiz({ on } = {}) { update(s => { s.ui.wiz = on === undefined ? !s.ui.wiz : on }) },

  /* onboarding */
  go({ to }) { go(to) },
  link({ k }) { update(s => { s.links[k] = !s.links[k] }) },
  qback() { if (getState().qi > 0) update(s => { s.qi-- }); else go('connect') },
  pick({ v }) {
    if (getState().ui.picking) return
    update(s => { s.answers[s.qi] = v === 'skip' ? null : v })
    if (v === 'skip') return next()
    update(s => { s.ui.picking = true })
    setTimeout(() => { update(s => { s.ui.picking = false }); next() }, 650)
  },

  /* moving around */
  tab({ t }) {
    update(s => {
      s.tab = t; s.viewing = null; s.settings = false; s.full = false; s.flist = null; s.bubbles = false
      s.ui.sheet = null; s.ui.search = false; s.ui.sq = ''
    })
  },
  flist({ v }) { update(s => { s.flist = v; s.viewing = null }) },
  flseg({ v }) { update(s => { s.flist = v }) },
  unflist() { update(s => { s.flist = null }) },
  openboard({ i }) { update(s => { s.cur = i; s.addTo = i; s.tab = 'board'; s.flist = null }) },
  full() { update(s => { s.full = true }) },
  unfull() { update(s => { s.full = false }) },
  settings() { update(s => { s.settings = true; s.ui.sheet = null }) },
  unsettings() { update(s => { s.settings = false }) },
  peek({ u }) { update(s => { s.viewing = u; s.ui.sheet = null }) },
  unpeek() { update(s => { s.viewing = null }) },
  bubbles() { update(s => { s.bubbles = true; s.ui.sheet = null }) },
  unbubbles() { update(s => { s.bubbles = false }) },

  /* maps */
  boardmenu({ el }) {
    const S = getState()
    openMenu(el, [...S.boards.map((b, i) => ({ label: b.name, act: 'board', args: { i }, on: i === S.cur })), '-', { label: 'New map', act: 'newboard' }])
  },
  board({ i }) { update(s => { s.cur = i; s.addTo = i }) },
  newboard() {
    update(s => { s.boards.push({ name: 'New map ' + s.boards.length, items: [], dismissed: [] }); s.cur = s.boards.length - 1; s.addTo = s.cur })
    toast('New map. Add a few songs or pictures.')
  },
  item({ id }) { sheet('item', id) },
  hunch({ id }) { sheet('hunch', id) },
  keep({ id }) { closeSheet(); addTo(getState().cur, id, 'map') },
  dismiss({ id }) {
    verdict('skip', id, 'map', cur(getState()))
    update(s => { cur(s).dismissed.push(id); s.ui.sheet = null })
    toast('Got it. We’ll stop suggesting that.')
  },
  remove({ id }) {
    verdict('remove', id, 'map', cur(getState()))
    update(s => {
      const b = cur(s)
      b.items = b.items.filter(x => x !== id)
      if (CAT[id] && CAT[id].d === 'film') b.dismissed.push(id)
      s.ui.sheet = null
    })
    toast('Removed from ' + cur(getState()).name)
  },

  /* adding things */
  add() { update(s => { s.aq = ''; s.atype = 'all'; s.ui.sheet = { type: 'add' } }) },
  aq({ v }) { update(s => { s.aq = v }) },
  atype({ v }) { update(s => { s.atype = v }) },
  addit({ id, from = 'add-list' }) { closeSheet(); addTo(getState().cur, id, from) },
  addcustom({ t }) {
    const S = getState(), id = 'c' + Date.now(), label = CUSTOM.find(x => x[0] === t)[1]
    const c = { id, t, d: LAYER_OF[t], kind: label, title: S.aq.trim(), by: 'Added by you', tags: [], custom: true }
    CAT[id] = c
    update(s => { s.custom.push(c); s.ui.sheet = null })
    addTo(getState().cur, id)
  },

  /* discover */
  // `from` says which part of Discover the sheet came from (today, because, films, outside, search, bubbles...)
  disc({ id, from = 'discover' }) { update(s => { s.addTo = s.cur; s.ui.sheet = { type: 'disc', id, from } }) },
  pickboard({ i }) { update(s => { s.addTo = i }) },
  dadd({ id }) {
    const from = getState().ui.sheet?.from || 'discover'
    closeSheet()
    addTo(getState().addTo, id, from)
  },
  dskip({ id }) {
    if (!(CAT[id] && CAT[id].d === 'film')) return closeSheet()
    verdict('skip', id, getState().ui.sheet?.from || 'discover', cur(getState()))
    update(s => { cur(s).dismissed.push(id); s.ui.sheet = null })
    toast('Skipped')
  },
  dsearch() { update(s => { s.ui.search = true }) },
  dsearchx() { update(s => { s.ui.search = false; s.ui.sq = '' }) },
  sq({ v }) { update(s => { s.ui.sq = v }) },
  surprise() {
    const S = getState(), pool = discoverList(S, cur(S)).slice(0, 25)
    if (pool.length) A.disc({ id: pool[Math.floor(Math.random() * pool.length)].id, from: 'surprise' })
  },

  /* people */
  'peek-item'({ id }) { sheet('peek', id) },
  follow({ u }) {
    update(s => { s.follow[u] = !s.follow[u] })
    toast(getState().follow[u] ? 'Following ' + PEOPLE[u].h : 'Unfollowed')
  },

  /* account and settings */
  editprof() { sheet('prof') },
  saveprof({ name, handle, bio }) {
    const n = name.trim(), hd = handle.trim(), bi = bio.trim()
    update(s => {
      if (n) s.me.name = n
      if (hd) s.me.handle = hd[0] === '@' ? hd : '@' + hd
      s.me.bio = bi
      s.ui.sheet = null
    })
    toast('Profile saved')
  },
  redoquiz() { update(s => { s.redo = true; s.step = 'quiz'; s.qi = 0; s.answers = []; s.settings = false }) },
  tutorial() { sheet('tutorial') },
  'tutorial-done'() { update(s => { s.seenTutorial = true; s.ui.sheet = null }) },
  pv({ k, v }) { update(s => { s.priv[k] = v }) },
  pswitch({ k }) { update(s => { s.priv[k] = !s.priv[k] }) },
  bvismenu({ i, el }) {
    const b = getState().boards[i]
    openMenu(el, ['public', 'followers', 'only me'].map(v => ({ label: VISL[v], act: 'bvis', args: { i, v }, on: (b.vis || 'public') === v })))
  },
  bvis({ i, v }) { update(s => { s.boards[i].vis = v }) },

  /* sheets, menus, toasts */
  toast({ msg }) { toast(msg) },
  close() { closeSheet() },
  closemenu() { update(s => { s.ui.menu = null }) },

  /* facilitator panel */
  'wz-jump'({ to }) {
    update(s => { s.ui.sheet = null; s.ui.menu = null; s.settings = false; s.full = false; s.bubbles = false })
    go(to)
  },
  'wz-undismiss'() {
    update(s => { s.boards.forEach(b => { b.dismissed = [] }) })
    toast('Skipped suggestions are back')
  },
  'wz-tutorial'() {
    update(s => { s.ui.wiz = false })
    if (getState().step !== 'app') go('board')
    sheet('tutorial')
  },
  // a reset means the next tester, their answers get a new number
  'wz-reset'() { update(s => { s.ui.wiz = false }); nextTester(); resetAll() },

  /* user test results */
  'log-csv'() { exportLog('csv', CAT) },
  'log-json'() { exportLog('json', CAT) },
  'log-clear'() { clearLog(); update(s => { s.ui.tick++ }); toast('Test results cleared') },
  'wz-engine'({ v }) {
    try { localStorage.setItem(ENGINE_KEY, v) } catch { /* ignore */ }
    location.reload()
  },
}

export function act(name, args = {}) {
  const fn = A[name]
  if (fn) fn(args)
  else console.warn('um!x: no action called', name)
}
