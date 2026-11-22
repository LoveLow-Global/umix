// /start: name, which clothes they shop for, and (optional) age range.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AGES, SECTIONS, update, useAppState } from '../../lib/store.js'

export default function Profile() {
  const s = useAppState()
  const nav = useNavigate()
  const [name, setName] = useState(s.profile.name)
  const [section, setSection] = useState(s.profile.section)
  const [age, setAge] = useState(s.profile.age)

  const next = e => {
    e.preventDefault()
    if (!name.trim()) return
    update(x => {
      x.profile = { name: name.trim(), section, age }
      x.started ??= new Date().toISOString()
    })
    nav('/start/music')
  }

  return (
    <form className="stack-lg fade" onSubmit={next}>
      <div className="stack">
        <p className="eyebrow">Step 1 of 4</p>
        <h1>First, a bit about you</h1>
        <p className="lead">All of this stays on your device.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">What should we call you?</label>
        <input id="name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          autoComplete="given-name" autoFocus maxLength={40} />
      </div>
      <div>
        <span className="label">Which clothes do you shop for?</span>
        <div className="chips" role="group" aria-label="Which clothes do you shop for">
          {SECTIONS.map(([v, l]) => <button type="button" key={v} className="chip" aria-pressed={section === v} onClick={() => setSection(v)}>{l}</button>)}
        </div>
        <p className="hint">We use this to pick clothes, shoes and jewelry for you.</p>
      </div>
      <div>
        <span className="label">Age range <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
        <div className="chips" role="group" aria-label="Age range">
          {AGES.map(a => <button type="button" key={a} className="chip" aria-pressed={age === a} onClick={() => setAge(age === a ? '' : a)}>{a}</button>)}
        </div>
        <p className="hint">Only for our class study. The model doesn’t use it, since Amazon’s data has no ages.</p>
      </div>
      <div><button className="btn" disabled={!name.trim()}>Continue</button></div>
    </form>
  )
}
