// /start/music, /start/film, /start/style: what they like in one layer. Also used from /me with ?edit=1.
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import Picker from '../../components/Picker.jsx'
import { Loading } from '../../components/ui.jsx'
import { I } from '../../components/icons.jsx'
import { inputItem, useModel } from '../../lib/model.js'
import { removeInput, useAppState } from '../../lib/store.js'

const STEP = {
  music: { n: 2, title: 'Artists you love', lead: 'Add a few artists or bands you listen to. Three or more works best.', next: '/start/film' },
  film: { n: 3, title: 'Films and series you love', lead: 'Add a few you’ve watched and liked. Three or more works best.', next: '/start/style' },
  style: {
    n: 4, title: 'Clothes, shoes and jewelry you’d wear', next: '/start/ready',
    lead: 'Pick brands and kinds of things you like. This one is optional. Skip it and we’ll guess your style from your music and films.',
  },
}

export default function LayerStep({ layer }) {
  const s = useAppState()
  const { model: m, error } = useModel()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const editing = params.get('edit') === '1'
  if (!s.profile.name && !editing) return <Navigate to="/start" replace />
  const st = STEP[layer]
  const given = s.inputs[layer]
  const label = x => (m && inputItem(m, layer, x)?.name) || x.id

  return (
    <>
      <div className="stack-lg fade">
        <div className="stack">
          {!editing && <p className="eyebrow">Step {st.n} of 4</p>}
          <h1>{st.title}</h1>
          <p className="lead">{st.lead}</p>
        </div>
        {m ? <Picker m={m} s={s} layer={layer} /> : error ? <p className="muted">Couldn’t load the model ({error.message}).</p> : <Loading />}
      </div>
      <div className="tray">
        <div className="inner">
          <div className="picked" aria-label="Added so far">
            {given.length
              ? given.map(x => <button type="button" key={x.id} className="pick" onClick={() => removeInput(layer, x.id)} aria-label={`Remove ${label(x)}`}><span>{label(x)}</span>{I.x}</button>)
              : <span className="muted small">Nothing added yet</span>}
          </div>
          <button type="button" className="btn" onClick={() => nav(editing ? '/me' : st.next)}>
            {editing ? 'Done' : given.length ? 'Next' : 'Skip'}
          </button>
        </div>
      </div>
    </>
  )
}
