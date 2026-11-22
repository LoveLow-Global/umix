// /about: how the data and the model work, in plain words, with the real test numbers.
import { Link } from 'react-router'
import { Loading } from '../components/ui.jsx'
import { fmt } from '../lib/format.js'
import { useModel } from '../lib/model.js'
import { LAYER, LAYERS } from '../lib/store.js'

const pct = x => `${Math.round(x * 1000) / 10}%`

export default function About() {
  const { model: m } = useModel()
  if (!m) return <Loading />
  const { stats, metrics, count } = m.manifest
  return (
    <div className="stack-lg fade">
      <div className="stack">
        <h1>How um!x works</h1>
        <p className="lead">A class project for IID2019 Introduction to Social Computing at Yonsei. It guesses what you’d like in one area of taste from the other two.</p>
      </div>

      <section className="stack">
        <h2>The data</h2>
        <p>Everything comes from Amazon Reviews 2023, a public dataset from the McAuley Lab at UC San Diego. One person’s reviews show up across categories, so we can see the same person’s CDs, movies and clothes. A rating of 4 or 5 stars counts as a save.</p>
        {stats && <p>After cleaning we kept {fmt(stats.people)} people who saved things in at least two of the three areas, with {fmt(count.music)} artists, {fmt(count.film)} films and series, and {fmt(count.style)} kinds of clothes, shoes and jewelry.</p>}
        <p>Albums turn into their artist, DVD and Blu-ray editions into one title, and products into a brand plus a type, like “Dr. Martens, women’s boots”. Genres come from Amazon’s own category labels, which is how Taylor Swift ends up next to Pop and Country without anyone typing that in. Photos are Amazon’s product images.</p>
      </section>

      <section className="stack">
        <h2>The model</h2>
        <p>A graph neural network with three layers, one each for music, film and style. The same people sit in all three, so taste can travel from songs to clothes through people who saved both. When you add things, the model mixes your layers, then scores every item of each layer. Each pick says which of your things it leans on most.</p>
        <p>It was trained by hiding one layer of a person at a time and asking the model to find it from the other two, which is exactly what it does for you when you skip a layer.</p>
      </section>

      {metrics && (
        <section className="stack">
          <h2>How well it guesses</h2>
          <p>On people the model never saw, we hid one layer at a time and checked where their real saves landed among {fmt(count.style)} to {fmt(count.film)} items. NDCG@10 is 1.0 when every top 10 spot is right.</p>
          <table className="data">
            <thead><tr><th>Hidden layer</th><th>Tests</th><th>Popular items only</th><th>um!x model</th></tr></thead>
            <tbody>{LAYERS.map(L => metrics[L] && (
              <tr key={L}><td>{LAYER[L].name}</td><td>{fmt(metrics[L].cases)}</td><td>{metrics[L].popularity.toFixed(3)}</td><td><b>{metrics[L].ours.toFixed(3)}</b> ({metrics[L].ours > metrics[L].popularity ? '+' : ''}{pct(metrics[L].ours / metrics[L].popularity - 1)})</td></tr>
            ))}</tbody>
          </table>
          <p className="muted small">The full report, with more baselines and confidence intervals, is in results/amazon_report.md in the project.</p>
        </section>
      )}

      <section className="stack">
        <h2>Your privacy</h2>
        <p>The model runs inside your browser. What you enter is saved only on this device, and you can clear it any time on <Link to="/me">your page</Link>. During our user test we note which picks you keep or skip, and that also stays on this device until the facilitator saves it.</p>
      </section>
    </div>
  )
}
