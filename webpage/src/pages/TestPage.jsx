// /test: for the person running the user test. Not linked from the app.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { fmt } from '../lib/format.js'
import { useModel } from '../lib/model.js'
import { startOver, toast, update, useAppState } from '../lib/store.js'
import { clearLog, exportLog, logCounts, nextTester } from '../lib/testlog.js'

/** a button that needs a second tap within 3 seconds */
function Careful({ label, again, onDo, className = 'btn danger' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return <button type="button" className={className} onClick={() => { if (armed) { setArmed(false); onDo() } else setArmed(true) }}>{armed ? again : label}</button>
}

export default function TestPage() {
  useAppState()   // redraw when anything changes
  const { model: m } = useModel()
  const nav = useNavigate()
  const n = logCounts()
  const refresh = () => update(x => { x.ui.tick = (x.ui.tick || 0) + 1 })
  return (
    <div className="stack-lg fade">
      <div className="stack">
        <p className="eyebrow">For the facilitator</p>
        <h1>User test</h1>
        <p className="lead">Every keep and skip on a pick gets saved here, with where the model ranked it. Nothing is sent anywhere.</p>
      </div>
      <div className="card stack">
        <p>Now testing <b>{n.tester}</b>: {n.kept} kept, {n.skipped} skipped.</p>
        <p className="muted small">{fmt(n.all)} answers from {n.testers} tester{n.testers === 1 ? '' : 's'} saved on this device.</p>
        <div className="row wrap">
          <button type="button" className="btn secondary" disabled={!n.all} onClick={() => exportLog('json')}>Download JSON</button>
          <button type="button" className="btn secondary" disabled={!n.all} onClick={() => exportLog('csv')}>Download CSV</button>
        </div>
        <p className="hint">The JSON goes in results/user_test/ for <code>make user-test</code>. The CSV opens in a spreadsheet.</p>
      </div>
      <div className="card stack">
        <h3>Next tester</h3>
        <p className="muted small">Clears the app (name, inputs, skips) and gives the next person a new number. The saved answers stay.</p>
        <div><Careful label="Start the next tester" again="Tap again to clear the app" className="btn" onDo={() => { nextTester(); startOver(); toast('Ready for the next tester'); nav('/') }} /></div>
      </div>
      <div className="card stack">
        <h3>Clear the answers</h3>
        <p className="muted small">Deletes every saved answer on this device. Download them first.</p>
        <div><Careful label="Clear all answers" again="Tap again to delete them" onDo={() => { clearLog(); refresh(); toast('Answers cleared') }} /></div>
      </div>
      {m && <p className="tiny">Model: {m.manifest.name}, trained {m.manifest.created?.slice(0, 10)}.</p>}
    </div>
  )
}
