// /map: the taste map. You in the middle, one sector per layer. What you gave sits on the inner
// ring, the model's picks on the outer ring (dashed), each tied to the thing it leans on most.
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ItemTile, LayerTag, Loading } from '../components/ui.jsx'
import { itemPath } from '../lib/format.js'
import { imageUrl, inputItem, useModel } from '../lib/model.js'
import { picksFor } from '../lib/picks.js'
import { LAYER, LAYERS, useAppState } from '../lib/store.js'

const W = 720, H = 690, C = { x: 360, y: 350 }
const ANGLE = { music: -90, film: 150, style: 30 }
const COLOR = { music: 'var(--music)', film: 'var(--film)', style: 'var(--style)' }
const short = (s, n = 14) => s.length > n ? s.slice(0, n - 1) + '…' : s

function spread(layer, k, radius, width) {
  return Array.from({ length: k }, (_, j) => {
    const a = (ANGLE[layer] + (k === 1 ? 0 : -width / 2 + j * width / (k - 1))) * Math.PI / 180
    return { x: C.x + radius * Math.cos(a), y: C.y + radius * Math.sin(a) }
  })
}

function TasteMap({ m, s }) {
  const nav = useNavigate()
  const { nodes, links } = useMemo(() => {
    const nodes = [], links = []
    for (const L of LAYERS) {
      const given = s.inputs[L].map(x => inputItem(m, L, x)).filter(Boolean).slice(0, 4)
      const picks = picksFor(m, s, L, 3).picks
      const gp = spread(L, given.length, 150, 76)
      const pp = spread(L, picks.length, 262, 90)
      const where = new Map()
      given.forEach((it, j) => {
        const n = { key: `g-${L}-${it.id}`, it, ...gp[j], r: 23, mine: true }
        nodes.push(n)
        where.set(`${L}/${it.id}`, n)
        links.push({ key: `l-${n.key}`, a: C, b: n, L, mine: true })
      })
      picks.forEach((p, j) => {
        const n = { key: `p-${L}-${p.item.id}`, it: p.item, ...pp[j], r: 28, mine: false }
        nodes.push(n)
        const from = p.because && where.get(`${p.because.layer}/${p.because.id}`)
        links.push({ key: `l-${n.key}`, a: from || C, b: n, L, mine: false })
      })
    }
    return { nodes, links }
  }, [m, s])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tastemap" role="img" aria-label="Your taste map">
      <defs>{nodes.map(n => <clipPath key={n.key} id={`c-${n.key}`}><circle cx={n.x} cy={n.y} r={n.r - 3} /></clipPath>)}</defs>
      {LAYERS.map(L => {
        const [x, y, anchor] = { music: [C.x, 22, 'middle'], film: [18, H - 14, 'start'], style: [W - 18, H - 14, 'end'] }[L]
        return <text key={L} x={x} y={y} textAnchor={anchor} className="sector" fill={COLOR[L]}>{LAYER[L].name}{s.inputs[L].length ? '' : ' (guessed)'}</text>
      })}
      {links.map(l => <path key={l.key} d={`M${l.a.x},${l.a.y} L${l.b.x},${l.b.y}`} stroke={l.mine ? 'var(--line)' : COLOR[l.L]}
        strokeOpacity={l.mine ? 1 : .6} strokeWidth={l.mine ? 1.5 : 1.3} strokeDasharray={l.mine ? undefined : '3 5'} fill="none" />)}
      <circle cx={C.x} cy={C.y} r="30" fill="var(--text)" />
      <text x={C.x} y={C.y + 5} textAnchor="middle" fill="var(--bg)" fontWeight="700" fontSize="14">{short(s.profile.name || 'You', 8)}</text>
      {nodes.map(n => {
        const L = n.it.layer, url = imageUrl(n.it.img, 160)
        return (
          <g key={n.key} className="mapnode" role="link" tabIndex={0} aria-label={`${n.it.name}${n.mine ? '' : ', a pick for you'}`}
            onClick={() => nav(itemPath(n.it))} onKeyDown={e => { if (e.key === 'Enter') nav(itemPath(n.it)) }}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={`var(--${L}-soft)`} stroke={COLOR[L]} strokeWidth={n.mine ? 2.5 : 2} strokeDasharray={n.mine ? undefined : '4 3'} />
            {url
              ? <image href={url} x={n.x - n.r + 3} y={n.y - n.r + 3} width={2 * n.r - 6} height={2 * n.r - 6} clipPath={`url(#c-${n.key})`}
                  preserveAspectRatio="xMidYMid slice" />
              : <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={COLOR[L]}>{n.it.src === 'tag' ? '#' : n.it.name[0]}</text>}
            <text x={n.x} y={n.y + n.r + 15} textAnchor="middle" className="nodelabel">{short(n.it.name)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function MapPage() {
  const s = useAppState()
  const { model: m, error } = useModel()
  if (error) return <p className="muted">Couldn’t load the model ({error.message}).</p>
  if (!m) return <Loading />
  const { weights } = picksFor(m, s, 'style', 4)

  return (
    <div className="stack-lg fade">
      <div className="stack">
        <h1>{s.profile.name ? `${s.profile.name}’s map` : 'Your map'}</h1>
        <p className="lead">Solid circles are what you gave us. Dashed ones are the model’s picks, linked to what they lean on.</p>
      </div>
      <div className="card mapcard"><TasteMap m={m} s={s} /></div>
      <div className="panel">
        <p className="small"><b>How your layers counted.</b> The model mixes the layers you filled in. For you it leaned on{' '}
          {LAYERS.filter(L => weights[L] > 0).map(L => `${LAYER[L].lower} ${Math.round(weights[L] * 100)}%`).join(', ')}.</p>
        <div className="weights" aria-hidden="true">{LAYERS.map(L => <i key={L} style={{ width: `${weights[L] * 100}%`, background: COLOR[L] }} />)}</div>
      </div>
      {LAYERS.map(L => {
        const { picks } = picksFor(m, s, L, 6)
        const given = s.inputs[L].map(x => inputItem(m, L, x)).filter(Boolean)
        return (
          <section key={L} className="stack">
            <div className="row"><h2 className="grow"><LayerTag layer={L} /></h2><Link to={`/discover/${L}`} className="small">See all picks</Link></div>
            <p className="muted small">{given.length ? `You gave ${given.map(it => it.name).slice(0, 4).join(', ')}${given.length > 4 ? ` and ${given.length - 4} more` : ''}.` : `You didn’t give any ${LAYER[L].things}, so these are all guesses.`}</p>
            <div className="grid">{picks.map(p => <ItemTile key={p.item.id} item={p.item} to={itemPath(p.item)} note={p.because ? `Because of ${p.because.name}` : null} />)}</div>
          </section>
        )
      })}
    </div>
  )
}
