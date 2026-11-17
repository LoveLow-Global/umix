// Checks that the browser engine gives the same answers as the Julia engine for the maps in
// backend/test/parity_fixture.json. It checks both copies of the engine, the one the plain
// app uses (frontend/js/engine.js) and the one the React site uses (webpage/src/engine.js).
//   julia --project=backend backend/bin/parity_fixture.jl
//   node scripts/check_parity.mjs
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(join(root, 'backend/test/parity_fixture.json'), 'utf8'));
const modelJSON = JSON.parse(readFileSync(join(root, fixture.model), 'utf8'));
const engines = ['frontend/js/engine.js', 'webpage/src/engine.js'].filter(p => existsSync(join(root, p)));

let failed = false;
for (const file of engines) {
  const { prepareModel, recommend } = await import(pathToFileURL(join(root, file)).href);
  const model = prepareModel(structuredClone(modelJSON));
  let bad = 0, picks = 0;
  for (const [n, c] of fixture.cases.entries()) {
    const js = recommend(model, c.items, { k: c.k, exclude: c.exclude });
    const jl = c.julia;
    const problems = [];
    if (js.recs.length !== jl.recs.length) problems.push(`length ${js.recs.length} vs ${jl.recs.length}`);
    js.recs.forEach((r, i) => {
      const o = jl.recs[i];
      if (!o) return;
      picks++;
      if (r.id !== o.id) problems.push(`rank ${i + 1}: ${r.id} vs ${o.id}`);
      else {
        if (Math.abs(r.score - o.score) > 2e-4) problems.push(`${r.id} score ${r.score} vs ${o.score}`);
        if (Math.abs(r.match - o.match) > 2e-3) problems.push(`${r.id} match ${r.match} vs ${o.match}`);
        if (r.because !== o.because) problems.push(`${r.id} because ${r.because} vs ${o.because}`);
      }
    });
    for (const k of ['music', 'visual']) {
      if (Math.abs(js.weights[k] - jl.weights[k]) > 2e-3) problems.push(`weight ${k} ${js.weights[k]} vs ${jl.weights[k]}`);
      if (js.used[k] !== jl.used[k]) problems.push(`used ${k} ${js.used[k]} vs ${jl.used[k]}`);
    }
    if (problems.length) { bad++; console.log(`${file} case ${n}: ${problems.slice(0, 4).join('; ')}`); }
  }
  console.log(`${file}: ${fixture.cases.length - bad} of ${fixture.cases.length} maps match (${picks} picks compared)`);
  if (bad) failed = true;
}
process.exit(failed ? 1 : 0);
