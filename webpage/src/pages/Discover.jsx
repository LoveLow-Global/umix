// /discover and /discover/:layer: the model's picks with reasons. Keep or skip each one.
import { Link, NavLink, Navigate, useParams } from 'react-router'
import { Cover, LayerTag, Loading, Match } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { itemPath } from '../lib/format.js'
import { keepPick, skipPick } from '../lib/actions.js'
import { useModel } from '../lib/model.js'
import { picksFor, reason } from '../lib/picks.js'
import { LAYER, LAYERS, useAppState } from '../lib/store.js'

function PickCard({ p, layer, from }) {
  return (
    <div className="pickcard">
      <Link className="tile" to={itemPath(p.item)}>
        <Cover item={p.item} />
        <span className="name">{p.item.name}</span>
        <span className="sub">{p.item.sub}</span>
      </Link>
      <p className="why">{reason(p)}</p>
      <Match value={p.match} />
      <div className="row">
        <button type="button" className="btn sm secondary" onClick={() => keepPick(layer, p.item, from)}>{I.plus} Keep</button>
        <button type="button" className="btn sm ghost" onClick={() => skipPick(layer, p.item, from)}>Not for me</button>
      </div>
    </div>
  )
}

function Tabs() {
  return (
    <nav className="tabs" aria-label="Picks by layer">
      <NavLink to="/discover" end>For you</NavLink>
      {LAYERS.map(L => <NavLink key={L} to={`/discover/${L}`}>{LAYER[L].name}</NavLink>)}
    </nav>
  )
}

export default function Discover() {
  const { layer } = useParams()
  const s = useAppState()
  const { model: m, error } = useModel()
  if (layer && !LAYERS.includes(layer)) return <Navigate to="/discover" replace />
  if (error) return <p className="muted">Couldn’t load the model ({error.message}).</p>
  if (!m) return <Loading />

  if (!layer) return (
    <div className="stack-lg fade">
      <div className="stack"><h1>Picks for you</h1><p className="lead">Everything here comes from the graph model, based on what you gave us.</p></div>
      <Tabs />
      {LAYERS.map(L => {
        const { picks } = picksFor(m, s, L, 8)
        return (
          <section key={L} className="stack">
            <div className="row"><h2 className="grow"><LayerTag layer={L} /></h2><Link className="small" to={`/discover/${L}`}>See all</Link></div>
            {!s.inputs[L].length && <p className="muted small">You didn’t give us any {LAYER[L].things}. This is our guess from your other layers.</p>}
            <div className="grid picks">{picks.slice(0, 4).map(p => <PickCard key={p.item.id} p={p} layer={L} from="discover" />)}</div>
          </section>
        )
      })}
    </div>
  )

  const { picks } = picksFor(m, s, layer, 30)
  return (
    <div className="stack-lg fade">
      <div className="stack">
        <h1>{LAYER[layer].name} for you</h1>
        <p className="lead">{s.inputs[layer].length
          ? `More ${LAYER[layer].things} that go with your map, best match first.`
          : `You didn’t give us any ${LAYER[layer].things}, so this is our guess from your other layers.`}</p>
      </div>
      <Tabs />
      {picks.length
        ? <div className="grid picks">{picks.map(p => <PickCard key={p.item.id} p={p} layer={layer} from={`discover/${layer}`} />)}</div>
        : <p className="muted">You’ve seen everything we have for now.</p>}
    </div>
  )
}
