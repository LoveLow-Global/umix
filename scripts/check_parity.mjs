// Checks that the browser engine (webpage/src/lib/engine.js) gives the same picks as the Julia
// version for the cases in backend/test/parity_fixture.json.
//   julia --project=backend backend/bin/parity_fixture.jl
//   node scripts/check_parity.mjs
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYERS, prepare, recommend } from '../webpage/src/lib/engine.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = JSON.parse(readFileSync(join(root, 'backend/test/parity_fixture.json'), 'utf8'))
const dir = resolve(root, fixture.model)
const json = f => JSON.parse(readFileSync(join(dir, f), 'utf8'))
const manifest = json('manifest.json')
const catalogs = Object.fromEntries(LAYERS.map(l => [l, json(manifest.catalog[l])]))
const buf = readFileSync(join(dir, manifest.vectors.file))
const m = prepare(manifest, catalogs, json(manifest.search), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

let bad = 0, picks = 0
fixture.cases.forEach((c, n) => {
  const r = recommend(m, c.inputs, { layer: c.layer, k: c.k, exclude: new Set(c.exclude) })
  const problems = []
  if (r.picks.length !== c.picks.length) problems.push(`length ${r.picks.length} vs ${c.picks.length}`)
  r.picks.forEach((p, i) => {
    const o = c.picks[i]
    if (!o) return
    picks++
    if (p.i !== o.i) return problems.push(`rank ${i + 1}: ${p.i} vs ${o.i}`)
    if (Math.abs(p.score - o.score) > 1e-6 * Math.max(1, Math.abs(o.score))) problems.push(`item ${p.i} score ${p.score} vs ${o.score}`)
    if (Math.abs(p.match - o.match) > 1e-6) problems.push(`item ${p.i} match ${p.match} vs ${o.match}`)
    const a = p.because ? `${p.because.layer}/${p.because.n}` : 'none', b = o.because ? `${o.because.layer}/${o.because.n}` : 'none'
    if (a !== b) problems.push(`item ${p.i} because ${a} vs ${b}`)
  })
  for (const l of LAYERS) if (Math.abs(r.weights[l] - c.weights[l]) > 1e-9) problems.push(`weight ${l} ${r.weights[l]} vs ${c.weights[l]}`)
  if (problems.length) { bad++; console.log(`case ${n}: ${problems.slice(0, 4).join('; ')}`) }
})
console.log(`${fixture.cases.length - bad} of ${fixture.cases.length} cases match (${picks} picks compared)`)
process.exit(bad ? 1 : 0)
