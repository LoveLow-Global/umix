// Things only the person running a user test needs: the facilitator panel and the reset button.
import { useEffect, useState } from 'react'
import { act } from '../actions.js'
import { I } from '../icons.jsx'
import { engine, enginePreference } from '../store.js'
import { logCounts } from '../testlog.js'

const ENGINES = [['auto', 'Auto'], ['julia', 'Julia API'], ['browser', 'In the browser']]
const JUMPS = [['welcome', 'Welcome'], ['connect', 'Accounts'], ['quiz', 'Questions'], ['board', 'Map'], ['discover', 'Discover'], ['settings', 'Settings']]
const pct = x => typeof x === 'number' ? Math.round(x * 1000) / 10 + '%' : 'n/a'

export function Facilitator() {
  const E = engine(), M = E.model, met = M.metrics || {}, pref = enginePreference(), n = logCounts()
  return (
    <aside className="wiz" aria-label="Facilitator controls">
      <button className="x" onClick={() => act('wiz', { on: false })} aria-label="Close facilitator panel">×</button>
      <h3>Facilitator</h3>
      <p>Open or close with the <b>`</b> key, or tap the flower logo three times.</p>
      <div className="k">Engine</div>
      <div className="eng">
        Running <b>{E.mode === 'julia' ? 'on the Julia API' : 'in the browser'}</b><br />
        {M.name} · {M.dataset} data · {M.items.film.length} films and series<br />
        Hidden-film test: recall@10 {pct(met['recall@10'])}, popularity alone {pct(met['popularity_recall@10'])}
      </div>
      <div className="grp">
        {ENGINES.map(([v, l]) => <button key={v} aria-pressed={pref === v} onClick={() => act('wz-engine', { v })}>{l}</button>)}
      </div>
      <div className="k">Jump to</div>
      <div className="grp">
        {JUMPS.map(([to, l]) => <button key={to} onClick={() => act('wz-jump', { to })}>{l}</button>)}
      </div>
      <div className="grp">
        <button onClick={() => act('wz-undismiss')}>Bring back skipped</button>
        <button onClick={() => act('wz-tutorial')}>Show map tutorial</button>
        <button onClick={() => act('wz-reset')}>Reset prototype</button>
      </div>
      <div className="k">User test</div>
      <div className="eng">
        Tester <b>{n.tester}</b> · {n.kept} kept, {n.skipped} skipped<br />
        {n.all} answers from {n.testers} tester{n.testers === 1 ? '' : 's'} saved on this device
      </div>
      <div className="grp">
        <button onClick={() => act('log-csv')} disabled={!n.all}>Download CSV</button>
        <button onClick={() => act('log-json')} disabled={!n.all}>Download JSON</button>
        <ClearResults disabled={!n.all} />
      </div>
      <p>Reset prototype starts the next tester. Answers stay on this device until you download or clear them.</p>
    </aside>
  )
}

/** wipes the saved test answers, after a second tap */
function ClearResults({ disabled }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  const click = () => {
    if (!armed) { setArmed(true); return }
    setArmed(false)
    act('log-clear')
  }
  return <button className={armed ? 'armed' : undefined} onClick={click} disabled={disabled}>{armed ? 'Tap again to clear' : 'Clear results'}</button>
}

/** top left, outside the phone. Tap twice to wipe everything and start over. */
export function ResetButton() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  const click = () => {
    if (!armed) { setArmed(true); return }
    setArmed(false)
    act('wz-reset')
  }
  return (
    <button className={'reset glass' + (armed ? ' armed' : '')} onClick={click} aria-label="Reset the prototype to the start">
      {I.reset}<span>{armed ? 'Tap again to reset' : 'Reset prototype'}</span>
    </button>
  )
}
