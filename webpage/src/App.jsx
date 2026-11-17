import { useEffect, useState } from 'react'
import { act } from './actions.js'
import { Facilitator, ResetButton } from './components/Facilitator.jsx'
import { MenuLayer, SheetLayer, Toast } from './components/Sheets.jsx'
import { Account, FollowList, Peek, Settings } from './screens/Account.jsx'
import { Board, TabBar } from './screens/Board.jsx'
import Bubbles from './screens/Bubbles.jsx'
import Discover from './screens/Discover.jsx'
import FullMap from './screens/FullMap.jsx'
import Onboarding from './screens/Onboarding.jsx'
import { boot, engine, getState, useAppState } from './store.js'
import { getLog } from './testlog.js'

export default function App() {
  const S = useAppState()
  const [ready, setReady] = useState(false), [error, setError] = useState(null)

  // load the trained model once
  useEffect(() => {
    boot().then(() => {
      setReady(true)
      window.umix = { engine: engine(), state: getState, act, log: getLog }   // handy in the browser console while testing
    }, setError)
  }, [])

  // ` opens the facilitator panel, Escape closes whatever is on top
  useEffect(() => {
    const onKey = e => {
      if (!engine()) return
      if (e.key === '`' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); act('wiz'); return }
      if (e.key !== 'Escape') return
      const ui = getState().ui
      if (ui.search && !ui.sheet) act('dsearchx')
      else if (ui.menu) act('closemenu')
      else if (ui.sheet) act('close')
      else if (ui.wiz) act('wiz', { on: false })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  let screen, flush = false
  if (error) screen = (
    <div className="boot">
      <h1 className="lt">Couldn’t load <i>the model</i></h1>
      <p className="sub">{error.message}. Run backend/bin/train.jl to make the model file, or start the Julia server.</p>
    </div>
  )
  else if (!ready) screen = <div className="boot"><p className="sub">Loading the taste model…</p></div>
  else ({ screen, flush } = pickScreen(S))

  return (
    <>
      <ResetButton />
      <div className="stage">
        <div className="phone" id="phone">
          <div className="island" aria-hidden="true" />
          <div id="screen" className={flush ? 'flush' : undefined}>{screen}</div>
          {ready && <SheetLayer S={S} />}
          {ready && <MenuLayer menu={S.ui.menu} />}
          <Toast toast={S.ui.toast} />
          <div className="homebar" aria-hidden="true" />
        </div>
      </div>
      {ready && S.ui.wiz && <Facilitator />}
    </>
  )
}

/** which screen to show, and whether it scrolls under a floating header */
function pickScreen(S) {
  const only = screen => ({ screen, flush: false })
  if (S.step !== 'app' || !S.boards.length) return only(<Onboarding S={S} />)
  const plain = !S.settings && !S.viewing
  if (S.full && S.tab === 'board' && plain) return only(<FullMap S={S} />)
  if (S.bubbles && S.tab === 'discover' && plain && !S.flist) return only(<Bubbles S={S} />)
  if (S.settings) return only(<Settings S={S} />)
  if (S.viewing) return only(<Peek S={S} />)
  if (S.flist) return only(<FollowList S={S} />)
  const tab = ['board', 'discover', 'account'].includes(S.tab) ? S.tab : 'account'
  const page = tab === 'board' ? <Board S={S} /> : tab === 'discover' ? <Discover S={S} /> : <Account S={S} />
  return { screen: <>{page}<TabBar tab={tab} /></>, flush: tab !== 'board' }
}
