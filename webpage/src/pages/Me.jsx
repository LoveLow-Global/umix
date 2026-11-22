// /me: your info, everything you gave us, and starting over.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ItemRow, LayerTag, Loading } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { itemPath } from '../lib/format.js'
import { removeGiven } from '../lib/actions.js'
import { inputItem, useModel } from '../lib/model.js'
import { AGES, LAYER, LAYERS, SECTIONS, startOver, update, useAppState } from '../lib/store.js'

export default function Me() {
  const s = useAppState()
  const { model: m } = useModel()
  const nav = useNavigate()
  const [sure, setSure] = useState(false)
  const set = (k, v) => update(x => { x.profile[k] = v })
  if (!m) return <Loading />

  return (
    <div className="stack-lg fade">
      <h1>You</h1>
      <section className="card stack">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={s.profile.name} maxLength={40} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <span className="label">Clothes you shop for</span>
          <div className="chips">{SECTIONS.map(([v, l]) => <button type="button" key={v} className="chip" aria-pressed={s.profile.section === v} onClick={() => set('section', v)}>{l}</button>)}</div>
        </div>
        <div>
          <span className="label">Age range</span>
          <div className="chips">{AGES.map(a => <button type="button" key={a} className="chip" aria-pressed={s.profile.age === a} onClick={() => set('age', s.profile.age === a ? '' : a)}>{a}</button>)}</div>
        </div>
      </section>

      {LAYERS.map(L => {
        const given = s.inputs[L].map(x => ({ x, it: inputItem(m, L, x) })).filter(g => g.it)
        return (
          <section key={L} className="stack">
            <div className="row"><h2 className="grow"><LayerTag layer={L} /></h2><Link className="btn sm secondary" to={`/start/${L}?edit=1`}>{I.plus} Add</Link></div>
            {given.length
              ? <div className="list card" style={{ padding: '4px 16px' }}>{given.map(({ x, it }) => (
                  <ItemRow key={x.id} item={it} to={it.src === 'tag' ? undefined : itemPath(it)}
                    sub={x.src === 'tag' ? 'Genre you picked' : x.via === 'pick' ? `Kept from your picks · ${it.sub}` : it.sub}
                    right={<button type="button" className="iconbtn" aria-label={`Remove ${it.name}`} onClick={() => removeGiven(L, x, it, 'me')}>{I.x}</button>} />
                ))}</div>
              : <p className="muted small">Nothing yet. We guess your {LAYER[L].things} from your other layers.</p>}
          </section>
        )
      })}

      <section className="card stack">
        <h3>Start over</h3>
        <p className="muted small">Clears your name, everything you gave us and your skips on this device.</p>
        <div className="row">
          {sure
            ? <><button type="button" className="btn danger" onClick={() => { startOver(); nav('/') }}>Yes, clear everything</button><button type="button" className="btn ghost" onClick={() => setSure(false)}>Cancel</button></>
            : <button type="button" className="btn danger" onClick={() => setSure(true)}>Start over</button>}
        </div>
      </section>
    </div>
  )
}
