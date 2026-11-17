// The user test log: which film picks each tester keeps or skips, and how the model ranked them.
//
// It has its own key in localStorage, so "Reset prototype" (which starts the next tester) keeps it.
// Nothing is sent anywhere. The facilitator panel downloads it as CSV (for a spreadsheet) or as
// JSON (for backend/bin/user_test.jl, which checks if people keep what the model ranks high).

const KEY = 'umix-test-log-v1'

const newDevice = () => Math.random().toString(36).slice(2, 6)
const fresh = device => ({ format: 'umix-user-test/1', device: device || newDevice(), next: 1, tester: null, testers: [], events: [] })

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (x && Array.isArray(x.events)) return x
  } catch { /* blocked storage, the log only lives in memory then */ }
  return fresh()
}
let LOG = load()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(LOG)) } catch { /* ignore */ }
}

/** saves one answer. A tester number (P1, P2, ...) is given on a person's first answer. */
export function logVerdict(ev, model) {
  if (!LOG.tester) {
    LOG.tester = 'P' + LOG.next++
    LOG.testers.push({ tester: LOG.tester, started: new Date().toISOString(), model: model ? `${model.name}, ${model.dataset}, ${model.created}` : null })
  }
  LOG.events.push({ t: new Date().toISOString(), device: LOG.device, tester: LOG.tester, ...ev })
  save()
}

/** the next person's answers get a new tester number */
export function nextTester() { LOG.tester = null; save() }

export function clearLog() { LOG = fresh(LOG.device); save() }

/** numbers for the facilitator panel */
export function logCounts() {
  const mine = LOG.tester ? LOG.events.filter(e => e.tester === LOG.tester) : []
  return {
    tester: LOG.tester || 'P' + LOG.next,
    kept: mine.filter(e => e.action === 'keep').length,
    skipped: mine.filter(e => e.action !== 'keep').length,
    all: LOG.events.length,
    testers: new Set(LOG.events.map(e => e.tester)).size,
  }
}

export const getLog = () => LOG

// one row per answer, in the order a spreadsheet would want them
const CSV = [
  ['time', e => e.t], ['device', e => e.device], ['tester', e => e.tester], ['action', e => e.action], ['from', e => e.from],
  ['film_id', e => e.film], ['film', e => e.title], ['kind', e => e.kind], ['rank', e => e.rank], ['out_of', e => e.of],
  ['match', e => e.match], ['score', e => e.score], ['because_id', e => e.because], ['because', e => e.becauseTitle],
  ['map', e => e.map], ['songs', e => e.songs], ['pictures_and_clothes', e => e.visual], ['map_items', (e, CAT) => e.items.map(i => CAT[i] ? CAT[i].title : i)],
]

/** downloads the log as 'csv' or 'json' */
export function exportLog(kind, CAT) {
  const name = `umix-user-test-${LOG.device}-${new Date().toISOString().slice(0, 10)}.${kind}`
  if (kind === 'json') {
    download(name, JSON.stringify({ ...LOG, exported: new Date().toISOString() }, null, 1), 'application/json')
    return
  }
  const cell = v => {
    if (v == null) return ''
    const s = Array.isArray(v) ? v.join('; ') : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const rows = LOG.events.map(e => CSV.map(([, get]) => cell(get(e, CAT))).join(','))
  // the BOM makes Excel read accents like "Céline" right
  download(name, '﻿' + [CSV.map(([h]) => h).join(','), ...rows].join('\n') + '\n', 'text/csv;charset=utf-8')
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
