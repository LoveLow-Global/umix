// /item/:layer/:id: one artist, title or style. Why it's picked, and what goes with it in every layer.
import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Cover, ItemTile, LayerTag, Loading, Match } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { itemPath } from '../lib/format.js'
import { keepPick, removeGiven, skipPick } from '../lib/actions.js'
import { item, useModel } from '../lib/model.js'
import { alsoLike, picksFor, reason } from '../lib/picks.js'
import { LAYER, LAYERS, addInput, useAppState } from '../lib/store.js'
import NotFound from './NotFound.jsx'

export default function ItemPage() {
  const { layer, id } = useParams()
  const [params] = useSearchParams()
  const s = useAppState()
  const { model: m, error } = useModel()
  const it = useMemo(() => (m && LAYERS.includes(layer) ? item(m, layer, id, params.get('rare') ? 'search' : undefined) : null), [m, layer, id, params])
  if (error) return <p className="muted">Couldn’t load the model ({error.message}).</p>
  if (!m) return <Loading />
  if (!it) return <NotFound />

  const mine = s.inputs[layer].find(x => x.id === it.id)
  const pick = s.onboarded && !mine && it.src === 'graph' ? picksFor(m, s, layer, 40).picks.find(p => p.item.id === it.id) : null
  const skipped = s.skipped[layer].includes(it.id)
  const tagNames = it.tags.map(t => m.manifest.tags[layer][t]).filter(Boolean)

  return (
    <div className="stack-lg fade">
      <div className="itemhead">
        <Cover item={it} size={500} className="big" />
        <div className="stack">
          <LayerTag layer={layer} />
          <h1>{it.name}</h1>
          {it.sub && <p className="lead">{it.sub}</p>}
          {it.info && <p className="muted small">{it.info}</p>}
          {tagNames.length > 0 && <div className="chips">{tagNames.map(t => <span key={t} className="chip static">{t}</span>)}</div>}
          {it.src === 'search' && <p className="tiny">Few people in our data saved this, so the model reads it through its tags.</p>}
          {mine && (
            <div className="panel stack">
              <p><b>On your map.</b> {mine.via === 'pick' ? 'You kept this pick.' : 'You added this.'}</p>
              <div><button type="button" className="btn sm danger" onClick={() => removeGiven(layer, mine, it, 'item')}>Remove from my map</button></div>
            </div>
          )}
          {pick && (
            <div className="panel stack">
              <p><b>Picked for you.</b> {reason(pick)}.</p>
              <Match value={pick.match} />
              <div className="row">
                <button type="button" className="btn sm" onClick={() => keepPick(layer, it, 'item')}>{I.plus} Keep</button>
                <button type="button" className="btn sm ghost" onClick={() => skipPick(layer, it, 'item')}>Not for me</button>
              </div>
            </div>
          )}
          {!mine && !pick && s.onboarded && (
            <div><button type="button" className="btn sm secondary" onClick={() => addInput(layer, it.id, it.src)}>{I.plus} Add to my map</button>
              {skipped && <span className="tiny" style={{ marginLeft: 10 }}>You skipped this before.</span>}</div>
          )}
        </div>
      </div>
      {LAYERS.map(L => {
        const like = alsoLike(m, it, L, 6, s.profile.section)
        if (!like.length) return null
        return (
          <section key={L} className="stack">
            <h2>{L === layer ? `More ${LAYER[L].things} like this` : `People who like this, in ${LAYER[L].lower}`}</h2>
            <div className="grid">{like.map(x => <ItemTile key={x.id} item={x} to={itemPath(x)} />)}</div>
          </section>
        )
      })}
      <p><Link to="/discover">{I.back} Back to your picks</Link></p>
    </div>
  )
}
