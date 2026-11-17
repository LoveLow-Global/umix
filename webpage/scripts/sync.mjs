// Brings in the two files this site shares with the rest of the project.
//   ../frontend/js/engine.js          -> src/engine.js                (runs the trained model)
//   ../frontend/model/umix-model.json -> public/model/umix-model.json  (the trained model)
// It runs by itself before npm run dev and npm run build, so a retrained model shows up here.
// If ../frontend is not there (say, Vercel only sees this folder), the copies already here are used.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const shared = join(here, '..', 'frontend')
const NOTE = '// Copied from frontend/js/engine.js by scripts/sync.mjs. Edit that file, this copy gets replaced.\n'

const files = [
  { from: 'js/engine.js', to: 'src/engine.js', note: NOTE },
  { from: 'model/umix-model.json', to: 'public/model/umix-model.json' },
]

for (const { from, to, note } of files) {
  const a = join(shared, from), b = join(here, to)
  if (!existsSync(a)) {
    if (!existsSync(b)) { console.error(`sync: ${to} is missing and there is no ../frontend/${from} to copy`); process.exit(1) }
    continue
  }
  mkdirSync(dirname(b), { recursive: true })
  if (note) {
    const text = note + readFileSync(a, 'utf8')
    if (existsSync(b) && readFileSync(b, 'utf8') === text) continue
    writeFileSync(b, text)
  } else {
    if (existsSync(b) && readFileSync(a).equals(readFileSync(b))) continue
    copyFileSync(a, b)
  }
  console.log(`sync: ../frontend/${from} -> ${to}`)
}
