// Small pieces used on every page.
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { imageUrl } from '../lib/model.js'
import { LAYER } from '../lib/store.js'
import { I } from './icons.jsx'

/** the three-circle logo */
export function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="11.5" cy="12" r="7.5" fill="var(--music)" fillOpacity=".9" />
      <circle cx="20.5" cy="12" r="7.5" fill="var(--film)" fillOpacity=".9" />
      <circle cx="16" cy="20" r="7.5" fill="var(--style)" fillOpacity=".9" />
    </svg>
  )
}

const initials = name => (name || '?').replace(/^the\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

/** an item's photo from Amazon, or its initials if there is none or it fails to load */
export function Cover({ item, size = 300, className = '' }) {
  const [broken, setBroken] = useState(false)
  const url = !broken && imageUrl(item.img, size)
  return (
    <div className={`cover ${item.layer} ${className}`}>
      {url
        ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span className="ph">{item.src === 'tag' ? '#' : initials(item.name)}</span>}
    </div>
  )
}

export function LayerTag({ layer }) {
  return <span className={`layer ${layer}`}>{LAYER[layer].name}</span>
}

/** a cover with a name under it, its short line, and an optional note (like why it's picked). As a button it can be pressed */
export function ItemTile({ item, sub, note, pressed, onClick, to }) {
  const inner = (
    <>
      <Cover item={item} />
      {pressed && <span className="tick">{I.check}</span>}
      <span className="name">{item.name}</span>
      <span className="sub">{sub ?? item.sub}</span>
      {note && <span className="note">{note}</span>}
    </>
  )
  if (to) return <Link className="tile" to={to}>{inner}</Link>
  return <button type="button" className="tile" aria-pressed={!!pressed} onClick={onClick}>{inner}</button>
}

/** one line in a list: small cover, name, sub line, and something on the right */
export function ItemRow({ item, sub, right, to }) {
  const body = (
    <>
      <Cover item={item} size={160} />
      <span className="grow"><span className="name" style={{ display: 'block' }}>{item.name}</span><span className="sub" style={{ display: 'block' }}>{sub ?? item.sub}</span></span>
    </>
  )
  return (
    <div className="rowitem">
      {to ? <Link to={to} className="row grow" style={{ color: 'inherit' }}>{body}</Link> : <span className="row grow">{body}</span>}
      {right}
    </div>
  )
}

export function Match({ value }) {
  const label = value > .8 ? 'Strong match' : value > .5 ? 'Good match' : 'Worth a try'
  return <span className="match"><span className="bar"><i style={{ width: `${Math.round(value * 100)}%` }} /></span>{label}</span>
}

export function Loading({ text = 'Loading the taste model…' }) {
  return <div className="loading"><div className="spinner" />{text}</div>
}

export function Toast({ toast }) {
  const n = toast ? toast.n : 0
  const [gone, setGone] = useState(0)
  useEffect(() => {
    if (!n) return
    const t = setTimeout(() => setGone(n), 2400)
    return () => clearTimeout(t)
  }, [n])
  return <div className={n > gone ? 'toast on' : 'toast'} role="status" aria-live="polite">{toast ? toast.msg : ''}</div>
}

