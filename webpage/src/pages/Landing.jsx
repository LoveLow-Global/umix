// /: what um!x does, and a way in.
import { Link } from 'react-router'
import { Logo } from '../components/ui.jsx'
import { fmt } from '../lib/format.js'
import { useModel } from '../lib/model.js'
import { useAppState } from '../lib/store.js'

export default function Landing() {
  const s = useAppState()
  const { model: m } = useModel()
  const people = m?.manifest.stats?.people
  return (
    <div className="stack-lg fade">
      <section className="hero stack-lg">
        <Logo size={56} />
        <div className="stack">
          <h1>Your music, films and style on one map.</h1>
          <p className="lead">Tell us a few artists and films you love. um!x guesses the rest, like what you’d wear, from what {people ? fmt(people) : 'thousands of'} real shoppers saved together.</p>
        </div>
        <div className="row wrap">
          {s.onboarded
            ? <><Link className="btn" to="/map">Open your map</Link><Link className="btn secondary" to="/discover">See your picks</Link></>
            : <><Link className="btn" to="/start">Start</Link><Link className="btn ghost" to="/about">How it works</Link></>}
        </div>
      </section>
      <section className="how">
        <div className="card"><div className="n">1</div><h3>Add what you love</h3><p className="muted small">Search artists, films, series and brands, or tap genres. Skip any layer you like.</p></div>
        <div className="card"><div className="n">2</div><h3>We read the graph</h3><p className="muted small">A graph network links music, film and style through the people who saved them together.</p></div>
        <div className="card"><div className="n">3</div><h3>See your map</h3><p className="muted small">Picks for every layer, each with a reason. Keep what fits, skip what doesn’t.</p></div>
      </section>
      <p className="tiny">Everything runs in your browser. Nothing you enter is sent anywhere.</p>
    </div>
  )
}
