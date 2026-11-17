// Small drawing pieces shared by every screen: glyphs, the logo, covers, the map.
import { useCallback, useLayoutEffect, useRef } from 'react'
import { act } from './actions.js'
import { cv, f, hsh, pal, trunc } from './data.js'
import { I } from './icons.jsx'
import { CAT } from './store.js'

/** one shape per kind of save: film is a ring, music a starburst, fashion a triangle, pictures a flower */
export function Glyph({ t, r, ghost, col }) {
  const c = col || `var(--${t})`, op = ghost ? .25 : .9, sw = ghost ? 1 : 1.4, dash = ghost ? '3 3' : undefined
  if (t === 'film') return (
    <>
      <circle r={f(r * .6)} fill={c} fillOpacity={op} />
      <circle r={f(r)} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={dash} />
    </>
  )
  if (t === 'music') return (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = i / 12 * Math.PI * 2
        return <line key={i} x1={f(Math.cos(a) * r * .38)} y1={f(Math.sin(a) * r * .38)} x2={f(Math.cos(a) * r)} y2={f(Math.sin(a) * r)}
          stroke={c} strokeWidth={sw} strokeLinecap="round" strokeOpacity={ghost ? .55 : 1} />
      })}
      <circle r={f(r * .24)} fill={c} fillOpacity={op} />
    </>
  )
  if (t === 'fashion' || t === 'thing') {
    const p = [0, 1, 2].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return `${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}` }).join(' ')
    return <polygon points={p} fill={c} fillOpacity={op * .85} stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeDasharray={dash} />
  }
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => <ellipse key={i} cy={f(-r * .52)} rx={f(r * .3)} ry={f(r * .5)} transform={`rotate(${i * 72})`}
        fill={c} fillOpacity={op * .72} stroke={c} strokeWidth={sw * .8} strokeDasharray={dash} />)}
      <circle r={f(r * .16)} fill="#fff" />
    </>
  )
}

export function Icon({ t, size, ghost }) {
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true">
      <Glyph t={t} r={size / 2 - 2} ghost={ghost} />
    </svg>
  )
}

export function Flower({ size }) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
      <g transform="rotate(18)">
        {['film', 'music', 'book', 'thing', 'image'].map((c, i) =>
          <ellipse key={c} cy="-5.4" rx="3.3" ry="5.6" fill={`var(--${c})`} fillOpacity=".92" transform={`rotate(${i * 72})`} />)}
      </g>
      <circle r="1.9" fill="var(--bg)" />
    </svg>
  )
}

/** the flower logo, tap it three times to open the facilitator panel */
export function Logo({ size = 30, style }) {
  return <button className="logo" onClick={() => act('wm')} aria-label="um!x" style={style}><Flower size={size} /></button>
}

/** a made-up cover: two mood colors and the item's glyph */
export function Cover({ c, cls }) {
  const [a, b, d] = pal(c), h = hsh(c.id), px = 15 + h % 70, py = 10 + (h >> 5) % 55, ang = 135 + (h >> 9) % 70
  return (
    <span className={cls ? 'cv ' + cls : 'cv'} style={{ background: `radial-gradient(110% 85% at ${px}% ${py}%, ${b} 0%, ${b}00 62%),linear-gradient(${ang}deg, ${a} 0%, ${d} 100%)` }}>
      <svg className="cvg" viewBox="-12 -12 24 24" aria-hidden="true"><Glyph t={c.t} r={10.5} col="#fff" /></svg>
      <span className="cvk">{c.kind}</span><span className="cvt">{c.title}</span><span className="cvb">{c.by}</span>
    </span>
  )
}

/** a cover you can tap. `from` names the Discover row, for the user test log */
export function Tile({ id, cap, from }) {
  const c = CAT[id]
  return (
    <button className="tb" onClick={() => act('disc', { id, from })} aria-label={`${c.title}, ${c.kind}`}>
      <Cover c={c} />{cap ? <span className="cap">{cap}</span> : null}
    </button>
  )
}

/** the match bar under a pick */
export function Conf({ s }) {
  return (
    <div className="conf">
      <span>Match</span><span className="bar"><i style={{ width: Math.round(s * 100) + '%' }} /></span>
      <span>{s > .8 ? 'Strong' : s > .5 ? 'Good' : 'Worth a try'}</span>
    </div>
  )
}

export function Hdr({ left, right }) {
  return <div className="top">{left || <span style={{ width: 44 }} />}<div className="r">{right}</div></div>
}

export function BackBtn({ onClick }) {
  return <button className="glass circ" onClick={onClick} aria-label="Back">{I.back}</button>
}

/** a segmented control */
export function Segc({ value, opts, label, onPick }) {
  return (
    <div className="segc" role="tablist" aria-label={label}>
      {opts.map(([v, l]) => <button key={v} role="tab" aria-selected={value === v} onClick={() => onPick(v)}>{l}</button>)}
    </div>
  )
}

/** a page with a floating header: the logo fades out and a blur edge fades in as you scroll */
export function FloatPage({ right, over, searchOpen = false, children }) {
  const edge = useRef(null), logo = useRef(null), scroller = useRef(null)
  const fx = useCallback(() => {
    const y = scroller.current ? scroller.current.scrollTop : 0
    if (logo.current) logo.current.style.opacity = searchOpen ? 0 : Math.max(0, 1 - y / 36)
    if (edge.current) edge.current.style.opacity = Math.min(1, y / 24)
  }, [searchOpen])
  useLayoutEffect(fx, [fx])
  return (
    <>
      <div className="edge" ref={edge} />
      <div className="top float"><span className="fadelogo" ref={logo}><Logo /></span>{right}</div>
      {over}
      <div className="scroll under" ref={scroller} onScroll={fx}>{children}</div>
    </>
  )
}

function Label({ x, y, t, w = 500, c = 'var(--label)' }) {
  return (
    <text x={f(x)} y={f(y)} textAnchor="middle" fontSize="11" fontWeight={w} fill={c}
      stroke="var(--bg2)" strokeWidth="5" strokeLinejoin="round" paintOrder="stroke">{trunc(t, 18)}</text>
  )
}

/**
 * A map: saves on an ellipse around the center, lines between saves that share a mood,
 * and dashed rings for the film suggestions, each tied to the save behind it.
 * On the Map tab the whole map is one button (it opens the full map), so the nodes do nothing.
 * On someone else's map (peek) every node can be tapped.
 */
export function MapSvg({ ids, hun, newId, peek = false, center }) {
  ids = ids.filter(id => CAT[id])
  const W = 350, H = 470, C = { x: 175, y: 238 }, n = ids.length
  const rx = n <= 6 ? 100 : 112, ry = n <= 6 ? 132 : 150, off = n % 2 ? 0 : 18
  const P = {}
  ids.forEach((id, i) => { const a = (-90 + i * 360 / n + off) * Math.PI / 180; P[id] = { x: C.x + rx * Math.cos(a), y: C.y + ry * Math.sin(a) } })
  const Hs = hun.map((h, j) => {
    // spread the rings between saves, with fewer saves than rings each ring gets its own slot
    const slots = Math.max(n, hun.length), g = n >= hun.length ? Math.floor(j * n / hun.length) + .5 : j + .25
    const a = (-90 + g * 360 / slots + off) * Math.PI / 180
    return { ...h, x: C.x + 126 * Math.cos(a), y: C.y + 196 * Math.sin(a), r: 9 + 8 * h.s }
  })
  const pairs = []
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = CAT[ids[i]], b = CAT[ids[j]], sh = a.tags.filter(t => b.tags.includes(t)).length
    if (sh) pairs.push({ k: ids[i] + '-' + ids[j], d: cv(P[ids[i]], P[ids[j]], (i + j) % 2 ? .22 : -.22), op: f(Math.min(.26, .08 + sh * .06)) })
  }
  const tap = (name, id, label) => peek ? {
    role: 'button', tabIndex: 0, 'aria-label': label,
    onClick: () => act(name, { id }),
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(name, { id }) } },
  } : { 'aria-label': label }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Map">
      {ids.map((id, i) => <path key={id} d={cv(C, P[id], .14)} pathLength="1" className="draw" style={{ '--d': `${i * .05}s` }}
        fill="none" stroke="var(--label)" strokeOpacity=".3" strokeWidth="1" />)}
      {pairs.map(p => <path key={p.k} d={p.d} fill="none" stroke="var(--label)" strokeOpacity={p.op} />)}
      {Hs.map(h => {
        const src = h.from && P[h.from] ? P[h.from] : C
        return <path key={h.id} d={cv(src, h, .16)} fill="none" stroke={`var(--${CAT[h.id].t})`} strokeOpacity=".65" strokeWidth="1" strokeDasharray="2 4" strokeLinecap="round" />
      })}
      {Hs.map((h, i) => {
        const c = CAT[h.id]
        return (
          <g key={h.id} className="node" {...tap(peek ? 'peek-item' : 'hunch', h.id, 'Suggestion: ' + c.title)}>
            <g transform={`translate(${f(h.x)},${f(h.y)})`}>
              <g className="bloom" style={{ '--d': `${.4 + i * .15}s` }}>
                <circle className="hit" r={f(h.r + 10)} />
                <circle className="pulse" r={f(h.r)} fill={`var(--${c.t})`} fillOpacity=".08" stroke={`var(--${c.t})`} strokeOpacity=".7" strokeWidth="1" strokeDasharray="2.5 3" />
                <Glyph t={c.t} r={h.r * .42} ghost />
              </g>
            </g>
            <Label x={h.x} y={h.y + h.r + 14} t={c.title} w={400} c="var(--label2)" />
          </g>
        )
      })}
      {ids.map((id, i) => {
        const c = CAT[id], p = P[id], isNew = newId === id
        return (
          <g key={id} className="node" {...tap(peek ? 'peek-item' : 'item', id, `${c.title}, ${c.kind}`)}>
            <g transform={`translate(${f(p.x)},${f(p.y)})`}>
              <g className="bloom" style={{ '--d': `${isNew ? 0 : .1 + i * .05}s` }}>
                <circle className="hit" r="24" /><Glyph t={c.t} r={isNew ? 13 : 11} />
              </g>
            </g>
            <Label x={p.x} y={p.y + 26} t={c.title} />
          </g>
        )
      })}
      <circle cx={C.x} cy={C.y} r="5" fill="var(--label)" />
      <text x={C.x + 11} y={C.y - 8} fontFamily="var(--serif)" fontStyle="italic" fontSize="15" fill="var(--label)"
        stroke="var(--bg2)" strokeWidth="5" paintOrder="stroke">{center || 'You'}</text>
    </svg>
  )
}
