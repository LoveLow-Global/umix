// Bottom sheets, the pull-down menu and the toast. Which one shows lives in state.ui.
import { useEffect, useRef, useState } from 'react'
import { act } from '../actions.js'
import { CUSTOM, FILTERS, PEOPLE, f } from '../data.js'
import { I } from '../icons.jsx'
import { CAT, balanceText, cur, findRec, ranked, recsOf, why } from '../store.js'
import { Conf, Cover, Icon, Segc } from '../ui.jsx'

export function SheetLayer({ S }) {
  const sh = S.ui.sheet, box = useRef(null)
  const key = sh ? sh.type + ':' + (sh.id || '') : ''

  // move keyboard focus into a sheet when it opens
  useEffect(() => {
    if (!key) return
    const t = setTimeout(() => {
      const first = box.current && box.current.querySelector('input,button')
      if (first) first.focus({ preventScroll: true })
    }, 60)
    return () => clearTimeout(t)
  }, [key])

  if (!sh) return null
  const id = sh.id
  if (id && !CAT[id]) return null
  const body = {
    item: () => <ItemSheet S={S} id={id} />,
    hunch: () => <HunchSheet S={S} id={id} />,
    disc: () => <DiscSheet S={S} id={id} />,
    peek: () => <PeekSheet S={S} id={id} />,
    add: () => <AddSheet S={S} />,
    prof: () => <ProfSheet me={S.me} />,
    tutorial: () => <TutorialSheet />,
  }[sh.type]
  if (!body) return null
  return (
    <div id="sheetWrap">
      <div className="scrim" onClick={() => act('close')} />
      <div className={'sheet' + (sh.type === 'add' ? ' tall' : '')} role="dialog" aria-modal="true" ref={box}>
        <div className="grab" />
        {body()}
      </div>
    </div>
  )
}

function Head({ c, k, sugg }) {
  return (
    <div className="shead">
      <div className={'bigtile' + (sugg ? ' sugg' : '')}><Icon t={c.t} size={sugg ? 40 : 46} ghost={sugg} /></div>
      <div className="t"><div className="k">{k}</div><h2>{c.title}</h2><div className="by">{c.by} · {c.kind}</div></div>
    </div>
  )
}

function ItemSheet({ S, id }) {
  const c = CAT[id], b = cur(S)
  const conn = b.items.filter(x => x !== id && CAT[x] && CAT[x].tags.some(t => c.tags.includes(t))).map(x => CAT[x].title)
  const note = c.custom ? 'um!x can’t read this one yet, so it doesn’t steer your picks. Things from the catalogue do.'
    : c.d === 'film' ? 'Films and series you keep stay on your map. In this alpha only songs, pictures and clothes steer the picks.' : ''
  return (
    <>
      <Head c={c} k={'On ' + b.name} />
      <dl className="kv">
        <dt>Feels</dt><dd>{c.tags.length ? c.tags.join(', ') : 'Not known yet. The map learns this from other people’s maps.'}</dd>
        <dt>Connected on this map to</dt><dd>{conn.length ? conn.join(', ') : 'Nothing yet. Add more and lines appear.'}</dd>
      </dl>
      {note && <p className="note">{note}</p>}
      <div className="row-actions">
        <button className="btn glass" onClick={() => act('remove', { id })}>Remove</button>
        <button className="btn prim" onClick={() => act('close')}>Done</button>
      </div>
    </>
  )
}

function HunchSheet({ S, id }) {
  const b = cur(S), x = findRec(b, id), c = CAT[id]
  return (
    <>
      <Head c={c} k="Suggestion" sugg />
      <p className="why">{why(x)}</p>
      <Conf s={x.s} />
      <p className="note">{balanceText(recsOf(b))}</p>
      <div className="row-actions">
        <button className="btn glass" onClick={() => act('dismiss', { id })}>Not for me</button>
        <button className="btn prim" onClick={() => act('keep', { id })}>Keep it</button>
      </div>
    </>
  )
}

function DiscSheet({ S, id }) {
  const c = CAT[id], x = c.d === 'film' ? findRec(cur(S), id) : null
  return (
    <>
      <div className="shead">
        <div style={{ width: 96, flexShrink: 0 }}><Cover c={c} /></div>
        <div className="t"><div className="k">{x ? 'For you' : 'In the catalogue'}</div><h2>{c.title}</h2><div className="by">{c.by} · {c.kind}</div></div>
      </div>
      {x
        ? <><p className="why">{why(x)}</p><Conf s={x.s} /></>
        : <p className="why">Feels {c.tags.join(', ') || 'new'}. Save it and your film picks shift.</p>}
      <p className="slabel">Add to</p>
      <div className="group" style={{ marginTop: 10 }}>
        {S.boards.map((b, i) => (
          <button key={i} className="li" onClick={() => act('pickboard', { i })} role="radio" aria-checked={i === S.addTo}>
            <span className="m"><b>{b.name}</b></span>{i === S.addTo && <span className="check">{I.check}</span>}
          </button>
        ))}
      </div>
      <div className="row-actions">
        <button className="btn glass" onClick={() => act('dskip', { id })}>{x ? 'Not for me' : 'Close'}</button>
        <button className="btn prim" onClick={() => act('dadd', { id })}>Add to map</button>
      </div>
    </>
  )
}

function PeekSheet({ S, id }) {
  const c = CAT[id], p = PEOPLE[S.viewing], has = cur(S).items.includes(id)
  return (
    <>
      <Head c={c} k={'On ' + (p ? p.h : 'their') + '’s map'} />
      <dl className="kv"><dt>Feels</dt><dd>{c.tags.join(', ')}</dd></dl>
      <div className="row-actions">
        <button className="btn glass" onClick={() => act('close')}>Close</button>
        <button className="btn prim" onClick={() => act('addit', { id, from: 'peek' })} disabled={has}>{has ? 'Already saved' : 'Save to my map'}</button>
      </div>
    </>
  )
}

function AddSheet({ S }) {
  const b = cur(S), sug = ranked(b).slice(0, 4), q = S.aq.trim().toLowerCase()
  const L = Object.values(CAT).filter(c => !c.custom && (S.atype === 'all' || c.d === S.atype) &&
    (!q || (c.title + ' ' + c.by + ' ' + c.tags.join(' ')).toLowerCase().includes(q)))
  return (
    <>
      <div className="shead">
        <div className="t"><div className="k">Add to</div><h2 style={{ margin: '4px 0 0' }}>{b.name}</h2></div>
        <button className="glass circ" onClick={() => act('close')} aria-label="Close">{I.x}</button>
      </div>
      <label className="search">
        <span style={{ color: 'var(--label2)', display: 'grid' }}>{I.search}</span><span className="vh">Search</span>
        <input id="q" type="search" placeholder="Songs, pictures, clothes, films" autoComplete="off" value={S.aq} onChange={e => act('aq', { v: e.target.value })} />
      </label>
      {sug.length > 0 && (
        <>
          <p className="slabel">Films that fit this map</p>
          <div className="sugs">
            {sug.map(x => {
              const c = CAT[x.id]
              return (
                <button key={x.id} className="sug" onClick={() => act('addit', { id: x.id, from: 'add-picks' })} aria-label={`Add ${c.title}`}>
                  <Icon t={c.t} size={28} /><b>{c.title}</b>
                  <span>{x.from && CAT[x.from] ? 'Goes with ' + CAT[x.from].title : 'Popular to start with'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
      <div style={{ marginTop: 28 }}><Segc value={S.atype} opts={FILTERS} label="Filter by layer" onPick={v => act('atype', { v })} /></div>
      <div style={{ marginTop: 8 }}>
        {q && !L.length ? (
          <>
            <p className="sub" style={{ margin: '20px 0 12px' }}>Nothing called “{S.aq}” yet. Add it anyway as a:</p>
            <div className="group">
              {CUSTOM.map(([t, l]) => (
                <button key={t} className="li ind" onClick={() => act('addcustom', { t })}>
                  <span className="tile" style={{ background: 'var(--bg)' }}><Icon t={t} size={24} /></span>
                  <span className="m"><b>{l}</b></span><span className="v">{I.chev}</span>
                </button>
              ))}
            </div>
          </>
        ) : L.slice(0, 60).map(c => (
          <div key={c.id} className="irow">
            <span className="tile" style={{ background: 'var(--bg2)' }}><Icon t={c.t} size={26} /></span>
            <div className="m"><b>{c.title}</b><span>{c.by} · {c.kind}</span></div>
            {b.items.includes(c.id)
              ? <span className="added">Added</span>
              : <button className="glass circ" style={{ width: 36, height: 36 }} onClick={() => act('addit', { id: c.id, from: 'add-list' })} aria-label={`Add ${c.title}`}>{I.plus}</button>}
          </div>
        ))}
      </div>
    </>
  )
}

function ProfSheet({ me }) {
  const [name, setName] = useState(me.name), [handle, setHandle] = useState(me.handle), [bio, setBio] = useState(me.bio)
  return (
    <>
      <div className="shead">
        <div className="t"><h2 style={{ margin: 0 }}>Edit profile</h2></div>
        <button className="glass circ" onClick={() => act('close')} aria-label="Close">{I.x}</button>
      </div>
      <label className="flabel" htmlFor="pname">Name</label>
      <input className="inp" id="pname" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      <label className="flabel" htmlFor="phandle">Username</label>
      <input className="inp" id="phandle" value={handle} onChange={e => setHandle(e.target.value)} autoComplete="off" />
      <label className="flabel" htmlFor="pbio">Bio</label>
      <textarea className="inp" id="pbio" rows="3" value={bio} onChange={e => setBio(e.target.value)} />
      <div className="row-actions">
        <button className="btn glass" onClick={() => act('close')}>Cancel</button>
        <button className="btn prim" onClick={() => act('saveprof', { name, handle, bio })}>Save</button>
      </div>
    </>
  )
}

function TutorialSheet() {
  const row = (t, ghost, title, sub) => (
    <div className="row" key={title}><Icon t={t} size={34} ghost={ghost} /><span><b>{title}</b><span>{sub}</span></span></div>
  )
  return (
    <>
      <div className="shead"><div className="t"><div className="k">Before you start</div><h2>How to read <i>your map</i></h2></div></div>
      <div className="legend">
        {row('music', false, 'Songs', 'From Spotify or anything you add')}
        {row('image', false, 'Pictures', 'Moods you saved, like rainy windows')}
        {row('fashion', false, 'Clothes', 'Pieces you wear or want to')}
        <div className="row">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M4 26 Q17 4 30 22" fill="none" stroke="var(--label)" strokeOpacity=".45" /></svg>
          <span><b>Lines</b><span>Two saves that share a mood</span></span>
        </div>
        {row('film', true, 'Dashed rings', 'Films and series um!x thinks fit. Tap one to keep it or skip it.')}
      </div>
      <p className="note">The rings come from a graph model trained on thousands of maps. It reads your songs and your pictures and clothes, then guesses what you’d watch.</p>
      <div className="row-actions"><button className="btn prim" onClick={() => act('tutorial-done')}>Got it</button></div>
    </>
  )
}

export function MenuLayer({ menu }) {
  const box = useRef(null), n = menu ? menu.n : 0
  useEffect(() => {
    if (!n) return
    const first = box.current && box.current.querySelector('button')
    if (first) first.focus({ preventScroll: true })
  }, [n])
  if (!menu) return null
  return (
    <div id="menuWrap">
      <div className="scrim" onClick={() => act('closemenu')} />
      <div className="menu" role="menu" ref={box} style={{ left: f(menu.left) + 'px', top: f(menu.top) + 'px' }}>
        {menu.items.map((it, i) => it === '-' ? <hr key={i} /> : (
          <button key={i} role="menuitemradio" aria-checked={!!it.on} onClick={() => { act('closemenu'); act(it.act, it.args) }}>
            <span className="ck">{it.on ? I.check : null}</span>{it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** shows each new toast for a bit over two seconds */
export function Toast({ toast }) {
  const n = toast ? toast.n : 0, [gone, setGone] = useState(0)
  useEffect(() => {
    if (!n) return
    const t = setTimeout(() => setGone(n), 2200)
    return () => clearTimeout(t)
  }, [n])
  return <div id="toast" className={n > gone ? 'on' : ''} role="status" aria-live="polite">{toast ? toast.msg : ''}</div>
}
