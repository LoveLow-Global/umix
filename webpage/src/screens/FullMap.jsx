// The full screen map: a small force layout you can drag, pan and pinch. Tap a node to open it.
// React draws the nodes and lines once, then a requestAnimationFrame loop moves them.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { act } from '../actions.js'
import { f, trunc } from '../data.js'
import { I } from '../icons.jsx'
import { CAT, cur, hunches } from '../store.js'
import { Glyph } from '../ui.jsx'

const POS = {}   // where each node was last, so the map doesn't jump when it redraws

export default function FullMap({ S }) {
  const b = cur(S)
  // the layout only rebuilds when the saves or the suggestions really change
  const itemsKey = JSON.stringify(b.items.filter(id => CAT[id]))
  const hunchKey = JSON.stringify(hunches(b).map(h => [h.id, h.from, h.s]))
  const svgRef = useRef(null), vpRef = useRef(null), nodeEls = useRef([]), linkEls = useRef([])

  const { nodes, links } = useMemo(() => {
    const items = JSON.parse(itemsKey), hs = JSON.parse(hunchKey).map(([id, from, s]) => ({ id, from, s }))
    const nodes = [
      { id: '__me', kind: 'me' },
      ...items.map(id => ({ id, kind: 'item' })),
      ...hs.map(h => ({ id: h.id, kind: 'hunch', from: h.from, r: 9 + 8 * h.s })),
    ]
    const links = items.map(id => ({ a: '__me', b: id, len: 120, k: .035, t: 'me' }))
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = CAT[items[i]], B = CAT[items[j]], sh = A.tags.filter(t => B.tags.includes(t)).length
      if (sh) links.push({ a: A.id, b: B.id, len: 105, k: .008 * sh, t: 's', op: Math.min(.28, .08 + sh * .06) })
    }
    hs.forEach(h => links.push({ a: h.from && items.includes(h.from) ? h.from : '__me', b: h.id, len: 85, k: .05, t: 'h', col: CAT[h.id].t }))
    return { nodes, links }
  }, [itemsKey, hunchKey])

  useLayoutEffect(() => {
    const svg = svgRef.current, vp = vpRef.current
    const W = svg.clientWidth || 360, H = svg.clientHeight || 720, cx = W / 2, cy = H / 2
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)

    // start positions: where a node was last time, else around you (saves) or near its save (suggestions)
    const sim = nodes.map(n => ({ ...n, vx: 0, vy: 0 })), idx = {}
    const nItems = sim.filter(n => n.kind === 'item').length
    let k = 0
    for (const n of sim) {
      if (n.kind === 'me') { n.x = cx; n.y = cy }
      else if (n.kind === 'item') {
        const a = k++ / Math.max(1, nItems) * Math.PI * 2
        n.x = cx + Math.cos(a) * 120 + Math.random() * 6; n.y = cy + Math.sin(a) * 160 + Math.random() * 6
      } else {
        const base = n.from && idx[n.from] ? idx[n.from] : idx.__me, a = Math.random() * Math.PI * 2
        n.x = base.x + Math.cos(a) * 80; n.y = base.y + Math.sin(a) * 80
      }
      const p = POS[n.id]
      if (p) { n.x = p.x; n.y = p.y }
      idx[n.id] = n
    }

    const G = { pan: { x: 0, y: 0 }, k: 1, drag: null, ptrs: new Map(), pinch: null, raf: 0 }
    const pt = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse())
    const world = p => ({ x: (p.x - G.pan.x) / G.k, y: (p.y - G.pan.y) / G.k })
    const open = n => act(n.kind === 'hunch' ? 'hunch' : 'item', { id: n.id })

    svg.onpointerdown = e => {
      try { svg.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      const p = pt(e)
      G.ptrs.set(e.pointerId, p)
      if (G.ptrs.size === 2) {
        const [a, c] = [...G.ptrs.values()]
        G.pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) || 1, k: G.k, mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, pan: { ...G.pan } }
        if (G.drag && G.drag.n) G.drag.n.fixed = false
        G.drag = null
        return
      }
      const g = e.target.closest('.gn')
      G.drag = g ? { n: sim[+g.dataset.i], sx: p.x, sy: p.y, moved: 0 } : { pan: true, sx: p.x, sy: p.y, px: G.pan.x, py: G.pan.y, moved: 0 }
    }
    svg.onpointermove = e => {
      if (!G.ptrs.has(e.pointerId)) return
      const p = pt(e)
      G.ptrs.set(e.pointerId, p)
      if (G.pinch && G.ptrs.size === 2) {
        const [a, c] = [...G.ptrs.values()], P = G.pinch
        const z = Math.max(.5, Math.min(2.5, P.k * Math.hypot(a.x - c.x, a.y - c.y) / P.d))
        G.pan.x = P.mx - (P.mx - P.pan.x) * z / P.k; G.pan.y = P.my - (P.my - P.pan.y) * z / P.k; G.k = z
        return
      }
      const D = G.drag
      if (!D) return
      D.moved = Math.max(D.moved, Math.hypot(p.x - D.sx, p.y - D.sy))
      if (D.pan) { G.pan.x = D.px + p.x - D.sx; G.pan.y = D.py + p.y - D.sy }
      else if (D.moved > 3) { const w = world(p); D.n.x = w.x; D.n.y = w.y; D.n.vx = D.n.vy = 0; D.n.fixed = true }
    }
    const up = e => {
      G.ptrs.delete(e.pointerId)
      if (G.ptrs.size < 2) G.pinch = null
      const D = G.drag
      G.drag = null
      if (!D || !D.n) return
      D.n.fixed = false
      if (D.moved < 6 && D.n.kind !== 'me') open(D.n)
    }
    svg.onpointerup = up
    svg.onpointercancel = up
    const wheel = e => {
      e.preventDefault()
      const p = pt(e), z = Math.max(.5, Math.min(2.5, G.k * Math.exp(-e.deltaY * .0015)))
      G.pan.x = p.x - (p.x - G.pan.x) * z / G.k; G.pan.y = p.y - (p.y - G.pan.y) * z / G.k; G.k = z
    }
    svg.addEventListener('wheel', wheel, { passive: false })
    svg.onkeydown = e => {
      const g = e.target.closest && e.target.closest('.gn')
      if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const n = sim[+g.dataset.i]; if (n.kind !== 'me') open(n) }
    }

    const step = () => {
      const N = sim.length
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = sim[i], c = sim[j], dx = c.x - a.x, dy = c.y - a.y
        let d2 = dx * dx + dy * dy
        if (d2 > 160000) continue
        d2 = Math.max(d2, 80)
        const d = Math.sqrt(d2), F = 1500 / d2
        a.vx -= dx / d * F; a.vy -= dy / d * F; c.vx += dx / d * F; c.vy += dy / d * F
      }
      for (const l of links) {
        const a = idx[l.a], c = idx[l.b]
        if (!a || !c) continue
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, F = (d - l.len) * l.k
        a.vx += dx / d * F; a.vy += dy / d * F; c.vx -= dx / d * F; c.vy -= dy / d * F
      }
      sim.forEach((n, i) => {
        const pull = n.kind === 'me' ? .01 : .0015
        n.vx += (cx - n.x) * pull; n.vy += (cy - n.y) * pull
        if (n.fixed) { n.vx = n.vy = 0 } else { n.vx *= .78; n.vy *= .78; n.x += n.vx; n.y += n.vy }
        nodeEls.current[i]?.setAttribute('transform', `translate(${f(n.x)},${f(n.y)})`)
        POS[n.id] = { x: n.x, y: n.y }
      })
      links.forEach((l, i) => {
        const a = idx[l.a], c = idx[l.b], el = linkEls.current[i]
        if (!el) return
        el.setAttribute('x1', f(a.x)); el.setAttribute('y1', f(a.y)); el.setAttribute('x2', f(c.x)); el.setAttribute('y2', f(c.y))
      })
      vp.setAttribute('transform', `translate(${f(G.pan.x)},${f(G.pan.y)}) scale(${G.k.toFixed(3)})`)
      G.raf = requestAnimationFrame(step)
    }
    step()

    return () => {
      cancelAnimationFrame(G.raf)
      svg.onpointerdown = svg.onpointermove = svg.onpointerup = svg.onpointercancel = svg.onkeydown = null
      svg.removeEventListener('wheel', wheel)
    }
  }, [nodes, links])

  return (
    <div className="full">
      <svg ref={svgRef} className="graph" role="group" aria-label={`${b.name}, interactive map`}>
        <g ref={vpRef}>
          <g>
            {links.map((l, i) => {
              const h = l.t === 'h'
              return <line key={l.a + '>' + l.b} ref={el => { linkEls.current[i] = el }} stroke={h ? `var(--${l.col})` : 'var(--label)'}
                strokeOpacity={h ? .65 : l.t === 'me' ? .3 : l.op} strokeWidth="1" strokeDasharray={h ? '2 4' : undefined} strokeLinecap={h ? 'round' : undefined} />
            })}
          </g>
          <g>
            {nodes.map((n, i) => (
              <g key={n.id} className="gn" data-i={i} ref={el => { nodeEls.current[i] = el }}
                {...(n.kind === 'me' ? {} : { role: 'button', tabIndex: 0, 'aria-label': (n.kind === 'hunch' ? 'Suggestion: ' : '') + CAT[n.id].title })}>
                <Node n={n} />
              </g>
            ))}
          </g>
        </g>
      </svg>
      <div className="fulltop">
        <button className="glass circ" onClick={() => act('unfull')} aria-label="Close map">{I.x}</button>
        <span className="ttl">{b.name}</span>
        <button className="glass circ" onClick={() => act('add')} aria-label="Add to map">{I.plus}</button>
      </div>
      <div className="fullhint glass">Drag things around · pinch to zoom</div>
    </div>
  )
}

function Node({ n }) {
  if (n.kind === 'me') return (
    <>
      <circle r="16" fill="transparent" /><circle r="6" fill="var(--label)" />
      <text x="11" y="-9" fontFamily="var(--serif)" fontStyle="italic" fontSize="16" fill="var(--label)" stroke="var(--bg)" strokeWidth="5" paintOrder="stroke">You</text>
    </>
  )
  const c = CAT[n.id], h = n.kind === 'hunch'
  const label = (
    <text y={h ? f(n.r + 15) : 26} textAnchor="middle" fontSize="11.5" fontWeight={h ? 400 : 500} fill={`var(--${h ? 'label2' : 'label'})`}
      stroke="var(--bg)" strokeWidth="5" strokeLinejoin="round" paintOrder="stroke">{trunc(c.title, 22)}</text>
  )
  if (h) return (
    <>
      <circle r={f(n.r + 12)} fill="transparent" />
      <circle className="pulse" r={f(n.r)} fill={`var(--${c.t})`} fillOpacity=".08" stroke={`var(--${c.t})`} strokeOpacity=".7" strokeDasharray="2.5 3" />
      <Glyph t={c.t} r={n.r * .42} ghost />{label}
    </>
  )
  return <><circle r="22" fill="transparent" /><Glyph t={c.t} r={11} />{label}</>
}
