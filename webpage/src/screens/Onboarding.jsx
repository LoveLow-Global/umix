// Welcome, linking apps, the taste questions, and "drawing your map".
import { useEffect, useState } from 'react'
import { act } from '../actions.js'
import { ACC, NOTES, QS, cv, f } from '../data.js'
import { I } from '../icons.jsx'
import { BackBtn, Glyph, Hdr, Icon, Logo } from '../ui.jsx'

export default function Onboarding({ S }) {
  if (S.step === 'welcome') return <Welcome />
  if (S.step === 'connect') return <Connect S={S} />
  if (S.step === 'quiz') return <Quiz S={S} />
  if (S.step === 'building') return <Building />
  return null
}

// the same random dots every time (a fixed seed), kept away from the middle text
let field = null
function welcomeDots() {
  if (field) return field
  let r = 7
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647 }
  const kinds = ['music', 'image', 'fashion', 'film'], pts = []
  let tries = 0
  while (pts.length < 22 && tries++ < 4000) {
    const p = { x: 24 + rnd() * 354, y: 70 + rnd() * 560, r: 3.5 + Math.pow(rnd(), 2) * 8, t: kinds[Math.floor(rnd() * 4)] }
    if (Math.abs(p.x - 201) < 165 && Math.abs(p.y - 400) < 130) continue
    if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > q.r + p.r + 30)) pts.push(p)
  }
  const lines = []
  pts.forEach((p, i) => {
    const nb = pts.map((q, j) => ({ j, d: Math.hypot(q.x - p.x, q.y - p.y) })).filter(o => o.j > i).sort((a, b) => a.d - b.d)[0]
    if (nb && nb.d < 170) lines.push(cv(p, pts[nb.j], .2))
  })
  field = { pts, lines }
  return field
}

function Welcome() {
  const { pts, lines } = welcomeDots()
  return (
    <div className="onb welcome">
      <svg className="wfield" viewBox="0 0 402 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {lines.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--label)" strokeOpacity=".1" />)}
        {pts.map((p, i) => (
          <g key={i} transform={`translate(${f(p.x)},${f(p.y)})`}>
            <g className="bloom" style={{ '--d': `${(i % 12) * .06}s` }}><Glyph t={p.t} r={p.r} /></g>
          </g>
        ))}
      </svg>
      <div className="wcenter">
        <Logo size={92} style={{ width: 96, height: 96 }} />
        <h1 className="lt" style={{ fontSize: 38 }}>Your taste,<br /><i>on one map.</i></h1>
        <p className="body" style={{ color: 'var(--label2)', maxWidth: 300 }}>Save songs, pictures and clothes you love. um!x finds films and series that feel the same.</p>
      </div>
      <div className="foot">
        <button className="btn prim block" onClick={() => act('go', { to: 'connect' })}>Get started</button>
        <p className="fine">Alpha for user testing. Nothing gets sent anywhere. We only note which picks you keep or skip.</p>
      </div>
    </div>
  )
}

function Connect({ S }) {
  const any = Object.values(S.links).some(Boolean)
  return (
    <>
      <Hdr left={<BackBtn onClick={() => act('go', { to: 'welcome' })} />} />
      <div className="onb">
        <p className="fn" style={{ marginTop: 12 }}>Step 1 of 2</p>
        <h1 className="lt" style={{ marginTop: 6 }}>Bring your taste <i>with you</i></h1>
        <p className="sub" style={{ marginTop: 10, fontSize: 17 }}>Link the apps where you already save things. We only bring a few top picks, and you choose what stays.</p>
        <div className="group" style={{ marginTop: 32 }}>
          {ACC.map(a => {
            const on = !!S.links[a.k]
            return (
              <button key={a.k} className="li ind" onClick={() => act('link', { k: a.k })} aria-pressed={on}>
                <span className="tile"><Icon t={a.t} size={26} /></span>
                <span className="m"><b>{a.name}</b><span>{a.sub}</span></span>
                <span className="v" style={{ color: on ? 'var(--label)' : 'var(--tint)' }}>{on ? <>{I.check} Linked</> : 'Link'}</span>
              </button>
            )
          })}
        </div>
        <div className="foot">
          <button className="btn prim block" onClick={() => act('go', { to: 'quiz' })}>{any ? 'Continue' : 'Continue without linking'}</button>
        </div>
      </div>
    </>
  )
}

function Quiz({ S }) {
  const q = QS[S.qi], a = S.answers[S.qi]
  const card = (k, o) => (
    <button className="choice" onClick={() => act('pick', { v: k })} aria-pressed={a === k}>
      <span className="gt"><Icon t={o.g} size={36} /></span>
      <span style={{ minWidth: 0 }}><b>{o.t}</b><span className="s">{o.s}</span></span>
      {a === k && <span className="ck">{I.checkc}</span>}
    </button>
  )
  const note = a ? (a === 'both' ? 'A person of range. Respect.' : a === 'neither' ? 'Fair. We’ll find your thing elsewhere.' : NOTES[S.qi]) : 'Go with your gut.'
  return (
    <>
      <div className="top">
        <BackBtn onClick={() => act('qback')} />
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={QS.length} aria-valuenow={S.qi + 1} aria-label={`Question ${S.qi + 1} of ${QS.length}`}>
          <i style={{ width: `${(S.qi + 1) / QS.length * 100}%` }} />
        </div>
        <button className="tbtn" onClick={() => act('pick', { v: 'skip' })}>Skip</button>
      </div>
      <div className="onb">
        <p className="fn" style={{ marginTop: 12 }}>Step 2 of 2 · Question {S.qi + 1} of {QS.length}</p>
        <h1 className="lt" style={{ marginTop: 6 }}>Which do you like <i>more?</i></h1>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
          {card('a', q.a)}{card('b', q.b)}<span className="ordot glass" aria-hidden="true">or</span>
        </div>
        <div className="alt">
          <button onClick={() => act('pick', { v: 'both' })} aria-pressed={a === 'both'}>I like both</button>
          <button onClick={() => act('pick', { v: 'neither' })} aria-pressed={a === 'neither'}>Neither</button>
        </div>
        <div className="foot"><p className="sub" style={{ textAlign: 'center' }} aria-live="polite">{note}</p></div>
      </div>
    </>
  )
}

const BUILD_MSGS = ['Reading your saves…', 'Walking the graph…', 'Finding films that feel the same…']

function Building() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setI(x => Math.min(x + 1, BUILD_MSGS.length - 1)), 800)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className="onb" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 24 }}>
      <svg width="240" height="240" viewBox="-120 -120 240 240" aria-hidden="true">
        {['music', 'image', 'fashion', 'film'].map((t, k) => {
          const a = (k * 90 - 90) * Math.PI / 180, x = Math.cos(a) * 92, y = Math.sin(a) * 92
          return (
            <g key={t}>
              <path d={`M0,0 Q${f(x * .5 - y * .2)},${f(y * .5 + x * .2)} ${f(x)},${f(y)}`} pathLength="1" className="draw" style={{ '--d': `${.2 + k * .25}s` }}
                fill="none" stroke="var(--label)" strokeOpacity=".3" strokeWidth="1.4" />
              <g transform={`translate(${f(x)},${f(y)})`}><g className="bloom" style={{ '--d': `${.3 + k * .25}s` }}><Glyph t={t} r={12} ghost={t === 'film'} /></g></g>
            </g>
          )
        })}
        <circle r="5" fill="var(--label)" />
      </svg>
      <h1 className="lt">Drawing <i>your map</i></h1>
      <p className="sub" aria-live="polite">{BUILD_MSGS[i]}</p>
    </div>
  )
}
