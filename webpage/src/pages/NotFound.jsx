import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="stack-lg fade">
      <h1>Nothing here</h1>
      <p className="lead">This page doesn’t exist, or the item isn’t in our data anymore.</p>
      <div><Link className="btn" to="/">Go home</Link></div>
    </div>
  )
}
