// Search, most saved items and quick-pick chips for one layer. Used in onboarding and on /me.
import { useMemo, useState } from 'react'
import { chips, popular, search } from '../lib/model.js'
import { hasInput, toggleInput } from '../lib/store.js'
import { Cover, ItemTile } from './ui.jsx'
import { I } from './icons.jsx'

const COPY = {
  music: { search: 'Search artists and bands', chips: 'Or pick genres you like', pop: 'Most saved artists in our data' },
  film: { search: 'Search films, series, directors or actors', chips: 'Or pick genres you like', pop: 'Most saved films and series in our data' },
  style: { search: 'Search brands, like Levi’s, Nike or Dr. Martens', chips: 'Or pick things you like to wear', pop: 'Most saved in our data' },
}

export default function Picker({ m, s, layer }) {
  const [q, setQ] = useState('')
  const section = s.profile.section
  const query = q.trim()
  const results = query.length >= 2 ? search(m, layer, query, { limit: 10, section }) : []   // fast enough to run on every key
  const pop = useMemo(() => popular(m, layer, { limit: 18, section }), [m, layer, section])
  const tags = useMemo(() => chips(m, layer), [m, layer])
  const on = id => hasInput(s, layer, id)

  return (
    <div className="stack-lg">
      <div>
        <div className="search">
          {I.search}
          <input className="input" type="search" placeholder={COPY[layer].search} aria-label={COPY[layer].search} value={q}
            onChange={e => setQ(e.target.value)} autoComplete="off" />
        </div>
        {results.length > 0 && (
          <div className="results list">
            {results.map(it => (
              <div className="rowitem" key={it.src + it.id}>
                <Cover item={it} size={160} />
                <span className="grow">
                  <span className="name" style={{ display: 'block' }}>{it.name}</span>
                  <span className="sub" style={{ display: 'block' }}>{[it.sub, it.info].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" className={on(it.id) ? 'iconbtn on' : 'iconbtn'} aria-label={on(it.id) ? `Remove ${it.name}` : `Add ${it.name}`}
                  aria-pressed={on(it.id)} onClick={() => toggleInput(layer, it.id, it.src)}>{on(it.id) ? I.check : I.plus}</button>
              </div>
            ))}
          </div>
        )}
        {query.length >= 2 && !results.length && (
          <p className="hint">Nothing called “{query}” in our data yet. Try another spelling, or pick from below.</p>
        )}
      </div>

      <section className="stack">
        <h3>{COPY[layer].pop}</h3>
        <div className="grid">
          {pop.map(it => <ItemTile key={it.id} item={it} pressed={on(it.id)} onClick={() => toggleInput(layer, it.id, 'graph')} />)}
        </div>
      </section>

      <section className="stack">
        <h3>{COPY[layer].chips}</h3>
        <div className="chips">
          {tags.map(t => <button type="button" key={t} className="chip" aria-pressed={on(t)} onClick={() => toggleInput(layer, t, 'tag')}>{t}</button>)}
        </div>
      </section>
    </div>
  )
}
