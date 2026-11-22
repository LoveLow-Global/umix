// /start/ready: a quick look at what the model guessed for the layer they left empty, then the map.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ItemTile, Loading } from '../../components/ui.jsx'
import { itemPath } from '../../lib/format.js'
import { useModel } from '../../lib/model.js'
import { picksFor } from '../../lib/picks.js'
import { LAYER, LAYERS, update, useAppState } from '../../lib/store.js'

export default function Ready() {
  const s = useAppState()
  const { model: m } = useModel()
  const nav = useNavigate()
  const [thinking, setThinking] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setThinking(false), 1400)
    return () => clearTimeout(t)
  }, [])

  const total = LAYERS.reduce((n, L) => n + s.inputs[L].length, 0)
  // once the guess shows, they're in, even if they tap a pick before the button
  useEffect(() => {
    if (!thinking && total && !s.onboarded) update(x => { x.onboarded = true })
  }, [thinking, total, s.onboarded])
  if (!total) return (
    <div className="stack-lg fade">
      <h1>Add something first</h1>
      <p className="lead">um!x needs at least one artist, film or style to start from.</p>
      <div className="row wrap"><Link className="btn" to="/start/music">Add artists</Link><Link className="btn secondary" to="/start/film">Add films</Link></div>
    </div>
  )
  if (!m || thinking) return <Loading text="Reading your taste through the graph…" />

  const missing = LAYERS.filter(L => !s.inputs[L].length)
  const focus = missing.includes('style') ? 'style' : missing[0] || 'style'
  const { picks } = picksFor(m, s, focus, 6)
  const gave = LAYERS.filter(L => s.inputs[L].length).map(L => `${s.inputs[L].length} in ${LAYER[L].lower}`).join(' and ')
  const finish = () => nav('/map')

  return (
    <div className="stack-lg fade">
      <div className="stack">
        <p className="eyebrow">Your map is ready</p>
        <h1>{missing.length ? `Here’s our guess for your ${LAYER[focus].lower}` : `More ${LAYER[focus].lower} for you`}</h1>
        <p className="lead">From what you gave us ({gave}), these fit you best.</p>
      </div>
      <div className="grid">{picks.map(p => <ItemTile key={p.item.id} item={p.item} to={itemPath(p.item)}
        note={p.because ? `Because of ${p.because.name}` : null} />)}</div>
      <div><button className="btn" onClick={finish}>See your whole map</button></div>
    </div>
  )
}
