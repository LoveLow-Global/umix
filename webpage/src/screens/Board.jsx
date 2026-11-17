// The Map tab, and the tab bar at the bottom.
import { useEffect } from 'react'
import { act } from '../actions.js'
import { FOLLOWERS, VISL } from '../data.js'
import { I } from '../icons.jsx'
import { cur, getState, hunches, recsOf, update, vis } from '../store.js'
import { Hdr, Logo, MapSvg } from '../ui.jsx'

export function Board({ S }) {
  const b = cur(S), r = recsOf(b), h = hunches(b), v = vis(S, b), newId = S.ui.newId
  const total = S.boards.reduce((s, x) => s + x.items.length, 0)

  // the newest save is drawn a bit bigger until you leave the map
  useEffect(() => () => {
    if (newId && getState().ui.newId === newId) update(s => { s.ui.newId = null })
  }, [newId])

  return (
    <>
      <Hdr left={<Logo />} right={
        <button className="glass circ" aria-label="Share map"
          onClick={() => act('toast', { msg: v === 'only me' ? 'This map is private. Change it in Settings to share.' : 'Link to your map copied' })}>{I.share}</button>
      } />
      <div className="boardwrap">
        <button className="prof" onClick={() => act('tab', { t: 'account' })} style={{ marginTop: 4, border: 0, background: 'none', padding: 0, textAlign: 'left' }}>
          <span className="av">{(S.me.name.trim()[0] || 'Y').toUpperCase()}</span>
          <span>
            <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{S.me.name}</span>
            <span className="fn" style={{ display: 'block', fontSize: 14 }}>{S.boards.length} map{S.boards.length > 1 ? 's' : ''} · {total} saves · {FOLLOWERS.length} followers</span>
          </span>
        </button>
        <button className="mapname" onClick={e => act('boardmenu', { el: e.currentTarget })} aria-haspopup="menu" aria-label={`Switch map, current: ${b.name}`}>
          <span className="lt"><i>{b.name}</i></span><span style={{ color: 'var(--label2)', marginTop: 6 }}>{I.down}</span>
        </button>
        <p className="sub" style={{ marginTop: 6 }}>{b.items.length} saves · {r.pending ? 'finding films…' : h.length + ' film suggestions'} · {VISL[v]}</p>
        <button className="map mapbtn" onClick={() => act('full')} aria-label={`Open ${b.name} to explore`}>
          <MapSvg key={S.cur} ids={b.items} hun={h} newId={newId} />
          <span className="openhint glass">{b.items.length ? 'Tap to explore' : 'Tap to start'}</span>
        </button>
      </div>
    </>
  )
}

const TABS = [['board', 'Map', I.tabMap], ['discover', 'Discover', I.tabDisc], ['account', 'Account', I.tabAcc]]

export function TabBar({ tab }) {
  return (
    <div className="tabbar">
      <nav className="tabs glass" aria-label="Main">
        {TABS.map(([t, l, ic]) => <button key={t} onClick={() => act('tab', { t })} aria-current={tab === t ? 'page' : undefined}>{ic}{l}</button>)}
      </nav>
      {tab === 'board' && <button className="fab glass" onClick={() => act('add')} aria-label="Add to map">{I.plus}</button>}
    </div>
  )
}
