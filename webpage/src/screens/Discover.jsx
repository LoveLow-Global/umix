// The Discover tab: today's pick, why the picks look the way they do, and rows of films and series.
import { useEffect, useRef } from 'react'
import { act } from '../actions.js'
import { PEOPLE, pal } from '../data.js'
import { I } from '../icons.jsx'
import { CAT, balanceText, common, cur, discoverList, onAnyMap, recsOf, why } from '../store.js'
import { Cover, FloatPage, Flower, Tile } from '../ui.jsx'

const BUBBLE_SPOTS = [[32, 26, 15], [12, 16, 8], [54, 14, 7], [52, 40, 9], [14, 40, 7], [33, 6, 4]]

export default function Discover({ S }) {
  const b = cur(S), r = recsOf(b), R = discoverList(S, b)

  // each film shows up once on the page, the first row that wants it gets it
  const used = new Set()
  const take = (arr, n) => {
    const out = []
    for (const id of arr) { if (out.length >= n) break; if (!used.has(id)) { out.push(id); used.add(id) } }
    return out
  }
  const tp = R[0]
  if (tp) used.add(tp.id)

  // "Because you saved X": picks grouped by the save that pushed them up the most (top 30 picks only)
  const bySrc = {}
  R.slice(0, 30).forEach(x => { if (x.from && CAT[x.from]) (bySrc[x.from] = bySrc[x.from] || []).push(x) })
  const because = Object.keys(bySrc).sort((a, c) => bySrc[c].length - bySrc[a].length).slice(0, 3)
    .map(src => ({ src, ids: take(bySrc[src].map(x => x.id), 6) })).filter(x => x.ids.length >= 2)

  // twins: one save, one film that feels the same
  const twins = [], seen = new Set()
  for (const src of Object.keys(bySrc)) {
    const x = bySrc[src].find(y => !seen.has(y.id))
    if (x) { twins.push([src, x.id]); seen.add(x.id) }
    if (twins.length >= 4) break
  }

  const goesWith = id => { const x = R.find(y => y.id === id); return x && x.from && CAT[x.from] ? 'Goes with ' + CAT[x.from].title : CAT[id].kind }
  const films = take(R.filter(x => CAT[x.id].kind === 'Film').map(x => x.id), 8)
  const tv = take(R.filter(x => CAT[x.id].kind === 'TV').map(x => x.id), 8)
  const mine = onAnyMap(S)
  const people = Object.keys(PEOPLE).filter(k => !S.follow[k]).concat(Object.keys(PEOPLE).filter(k => S.follow[k])).slice(0, 5)
  const far = take(R.slice().reverse().map(x => x.id), 8)

  return (
    <FloatPage searchOpen={S.ui.search} right={<SearchBox open={S.ui.search} q={S.ui.sq} />} over={<SearchResults q={S.ui.sq} />}>
      <h1 className="lt" style={{ marginTop: 8 }}>For you <i>this week</i></h1>
      <p className="sub" style={{ marginTop: 8 }}>Picked by the um!x graph from what’s on {b.name}.</p>

      <button className="bentry" onClick={() => act('bubbles')}>
        <svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">
          {R.slice(0, 6).map((x, i) => { const P = BUBBLE_SPOTS[i]; return <circle key={x.id} cx={P[0]} cy={P[1]} r={P[2]} fill={pal(CAT[x.id])[0]} /> })}
        </svg>
        <span className="m"><b>Explore as bubbles</b><span>Every film and series, biggest match in the middle</span></span>
        <span style={{ color: 'var(--label2)' }}>{I.chev}</span>
      </button>

      {r.pending && <p className="sub pending" style={{ marginTop: 32 }}>Asking the Julia engine…</p>}

      {tp && (
        <button className="hero" onClick={() => act('disc', { id: tp.id, from: 'today' })}>
          <p className="k">Today’s pick</p><Cover c={CAT[tp.id]} cls="wide" /><p className="r">{why(tp)}</p>
        </button>
      )}

      <div className="balance">
        <p>{balanceText(r)}</p>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${r.pending ? 50 : Math.round(r.weights.music * 100)}%`, background: 'var(--music)' }} />
          <i style={{ width: `${r.pending ? 50 : 100 - Math.round(r.weights.music * 100)}%`, background: 'var(--image)' }} />
        </div>
        <div className="keys"><span>Songs</span><span>Pictures and clothes</span></div>
      </div>

      {because.map(({ src, ids }) => (
        <section className="dsec" key={src}>
          <div className="sechead"><div>
            <h2 className="t3">Because you saved <i>{CAT[src].title}</i></h2>
            <p className="why2">Films and series people kept next to it</p>
          </div></div>
          <div className="hrow">{ids.map(id => <Tile key={id} id={id} from="because" cap={(bySrc[src].find(x => x.id === id).shared || []).join(', ') || CAT[id].kind} />)}</div>
        </section>
      ))}

      {twins.length > 0 && (
        <section className="dsec">
          <h2 className="t3">If it were a <i>film</i></h2>
          <p className="why2">Your saves, turned into something to watch</p>
          <div className="hrow">
            {twins.map(([a, b2]) => (
              <button key={b2} className="pair" onClick={() => act('disc', { id: b2, from: 'twins' })}>
                <span className="two"><Cover c={CAT[a]} /><Cover c={CAT[b2]} /><span className="eq glass">≈</span></span>
                <span className="pc"><i>{CAT[a].title}</i>, as a {CAT[b2].kind === 'TV' ? 'series' : 'film'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {films.length > 0 && (
        <section className="dsec"><h2 className="t3">Films for <i>{b.name}</i></h2>
          <div className="hrow">{films.map(id => <Tile key={id} id={id} from="films" cap={goesWith(id)} />)}</div></section>
      )}
      {tv.length > 0 && (
        <section className="dsec"><h2 className="t3">Series to <i>start</i></h2>
          <div className="hrow">{tv.map(id => <Tile key={id} id={id} from="series" cap={goesWith(id)} />)}</div></section>
      )}

      <section className="dsec">
        <div className="sechead">
          <h2 className="t3">From maps like <i>yours</i></h2>
          <button className="tbtn sm" onClick={() => act('flist', { v: 'following' })}>See all</button>
        </div>
        <div className="hrow">
          {people.map(k => {
            const p = PEOPLE[k], three = p.items.filter(i => CAT[i] && !mine.has(i)).slice(0, 3)
            return (
              <button key={k} className="pcard" onClick={() => act('peek', { u: k })}>
                <span className="three">{three.map(i => <Cover key={i} c={CAT[i]} />)}</span>
                <b>{p.board}</b><span>{p.h} · {common(S, k)}</span>
              </button>
            )
          })}
        </div>
      </section>

      {far.length > 0 && (
        <section className="dsec"><h2 className="t3">Outside your <i>bubble</i></h2>
          <p className="why2">Far from your usual. Might be your next favourite.</p>
          <div className="hrow">{far.map(id => <Tile key={id} id={id} from="outside" cap={CAT[id].kind} />)}</div></section>
      )}

      <div className="endcard">
        <Flower size={40} />
        <h2>That’s everything<br /><i>for this week.</i></h2>
        <p className="sub">New picks show up as your map changes.</p>
        <div className="row-actions">
          <button className="btn glass" onClick={() => act('surprise')}>Surprise me</button>
          <button className="btn glass" onClick={() => act('bubbles')}>Bubbles</button>
        </div>
      </div>
    </FloatPage>
  )
}

function SearchBox({ open, q }) {
  const input = useRef(null)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => input.current && input.current.focus(), 60)
    return () => clearTimeout(t)
  }, [open])
  return (
    <div className={'sbox glass' + (open ? ' open' : '')}>
      <button className="sbtn" onClick={() => open ? input.current.focus() : act('dsearch')} aria-label="Search">{I.search}</button>
      <label className="vh" htmlFor="dq">Search</label>
      <input id="dq" ref={input} type="search" placeholder="Songs, pictures, films" autoComplete="off" tabIndex={open ? 0 : -1}
        value={q} onChange={e => act('sq', { v: e.target.value })} />
      <button className="sx" onClick={() => act('dsearchx')} aria-label="Close search">{I.x}</button>
    </div>
  )
}

function SearchResults({ q }) {
  q = q.trim().toLowerCase()
  if (!q) return null
  const L = Object.values(CAT).filter(c => (c.title + ' ' + c.by + ' ' + c.tags.join(' ')).toLowerCase().includes(q)).slice(0, 14)
  return (
    <div className="sres">
      {L.length ? L.map(c => (
        <button key={c.id} className="irow" onClick={() => act('disc', { id: c.id, from: 'search' })}>
          <span style={{ width: 46, flexShrink: 0 }}><Cover c={c} /></span>
          <span className="m"><b>{c.title}</b><span>{c.by} · {c.kind}</span></span>
        </button>
      )) : <p className="sub" style={{ padding: '16px 4px' }}>Nothing called “{q}” yet.</p>}
    </div>
  )
}
