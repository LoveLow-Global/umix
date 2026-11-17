// Every pick as a bubble on a hex grid, best match in the middle. Drag to look around, tap to open.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { act } from '../actions.js'
import { f } from '../data.js'
import { I } from '../icons.jsx'
import { CAT, cur, discoverList } from '../store.js'
import { Cover } from '../ui.jsx'

const BP = { x: 0, y: 0 }   // how far you dragged, kept while the app is open

export default function Bubbles({ S }) {
  const idsKey = JSON.stringify(discoverList(S, cur(S)).map(x => x.id))
  const field = useRef(null), els = useRef([])

  // hex grid spots, spiraling out from the middle
  const pts = useMemo(() => {
    const ids = JSON.parse(idsKey), sp = 104, pos = [[0, 0]]
    const dirs = [[-1, 1], [-1, 0], [0, -1], [1, -1], [1, 0], [0, 1]]
    for (let ring = 1; pos.length < ids.length; ring++) {
      let q = ring, r = 0
      for (let d = 0; d < 6; d++) for (let s = 0; s < ring; s++) { pos.push([q, r]); q += dirs[d][0]; r += dirs[d][1] }
    }
    return ids.map((id, i) => { const [q, r] = pos[i]; return { id, x: sp * (q + r / 2), y: sp * .866 * r } })
  }, [idsKey])

  useLayoutEffect(() => {
    const el = field.current
    const B = { raf: 0, vx: 0, vy: 0, drag: null }
    const open = i => act('disc', { id: pts[i].id, from: 'bubbles' })

    el.onpointerdown = e => {
      try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      const t = e.target.closest('.bb')
      B.drag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, i: t ? +t.dataset.i : -1, lt: performance.now() }
      B.vx = B.vy = 0
    }
    el.onpointermove = e => {
      const D = B.drag
      if (!D) return
      const sc = el.getBoundingClientRect().width / el.clientWidth || 1
      const dx = (e.clientX - D.lx) / sc, dy = (e.clientY - D.ly) / sc
      BP.x += dx; BP.y += dy
      D.moved = Math.max(D.moved, Math.hypot(e.clientX - D.sx, e.clientY - D.sy))
      const now = performance.now(), dt = Math.max(1, now - D.lt)
      B.vx = dx * 16 / dt; B.vy = dy * 16 / dt
      D.lx = e.clientX; D.ly = e.clientY; D.lt = now
    }
    const up = () => {
      const D = B.drag
      B.drag = null
      if (D && D.moved < 6 && D.i >= 0) { B.vx = B.vy = 0; open(D.i) }
    }
    el.onpointerup = up
    el.onpointercancel = up
    el.onkeydown = e => {
      const t = e.target.closest && e.target.closest('.bb')
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(+t.dataset.i) }
    }

    const step = () => {
      if (!B.drag) { BP.x += B.vx; BP.y += B.vy; B.vx *= .93; B.vy *= .93 }
      const w = el.clientWidth, hh = el.clientHeight, cx = w / 2, cy = hh / 2, R = Math.min(w, hh) * .62
      pts.forEach((p, i) => {
        const st = els.current[i] && els.current[i].style
        if (!st) return
        let x = p.x + BP.x + cx, y = p.y + BP.y + cy
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy)
        const t = Math.min(1, d / R), s = Math.max(.32, 1 - t * t * .7), pull = .82 + .18 * s
        x = cx + dx * pull; y = cy + dy * pull
        st.transform = `translate(${f(x - 48)}px,${f(y - 48)}px) scale(${s.toFixed(3)})`
        st.opacity = d > R * 1.6 ? 0 : 1
        st.zIndex = Math.round(s * 100)
      })
      B.raf = requestAnimationFrame(step)
    }
    step()

    return () => {
      cancelAnimationFrame(B.raf)
      el.onpointerdown = el.onpointermove = el.onpointerup = el.onpointercancel = el.onkeydown = null
    }
  }, [pts])

  return (
    <div className="full">
      <div className="bfield" ref={field} role="group" aria-label="All picks as bubbles">
        {pts.map((p, i) => (
          <button key={p.id} className="bb" data-i={i} ref={el => { els.current[i] = el }} aria-label={`${CAT[p.id].title}, ${CAT[p.id].kind}`}>
            <Cover c={CAT[p.id]} cls="round" />
          </button>
        ))}
      </div>
      <div className="fulltop">
        <button className="glass circ" onClick={() => act('unbubbles')} aria-label="Close">{I.x}</button>
        <span className="ttl">Everything for you</span><span style={{ width: 44 }} />
      </div>
      <div className="fullhint glass">Drag to explore · tap a bubble</div>
    </div>
  )
}
