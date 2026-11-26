import { useEffect } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router'
import { Logo, Toast } from './components/ui.jsx'
import { I } from './components/icons.jsx'
import { loadModel, model } from './lib/model.js'
import { getState, useAppState } from './lib/store.js'
import { getLog } from './lib/testlog.js'
import About from './pages/About.jsx'
import Discover from './pages/Discover.jsx'
import ItemPage from './pages/ItemPage.jsx'
import Landing from './pages/Landing.jsx'
import MapPage from './pages/MapPage.jsx'
import Me from './pages/Me.jsx'
import NotFound from './pages/NotFound.jsx'
import TestPage from './pages/TestPage.jsx'
import LayerStep from './pages/start/LayerStep.jsx'
import Profile from './pages/start/Profile.jsx'
import Ready from './pages/start/Ready.jsx'

const STEP = { '/start': 1, '/start/music': 2, '/start/film': 3, '/start/style': 4, '/start/ready': 4 }
const TITLE = [['/start', 'Get started'], ['/map', 'Your map'], ['/discover', 'Picks'], ['/item', 'Item'], ['/me', 'You'], ['/about', 'How it works'], ['/test', 'User test']]

function Shell() {
  const s = useAppState()
  const loc = useLocation()
  const [params] = useSearchParams()
  const onboarding = loc.pathname.startsWith('/start') && params.get('edit') !== '1'
  const step = STEP[loc.pathname]

  useEffect(() => { loadModel().catch(() => {}) }, [])   // start loading the model on any page
  useEffect(() => {
    window.scrollTo(0, 0)
    const t = TITLE.find(([p]) => loc.pathname.startsWith(p))
    document.title = t ? `${t[1]} · um!x` : 'um!x'
  }, [loc.pathname])

  return (
    <div className="app">
      <header className="topbar">
        <div className="inner">
          <Link className="brand" to={s.onboarded ? '/map' : '/'} aria-label="um!x home"><Logo />um!x</Link>
          {onboarding && step
            ? <div className="steps" aria-label={`Step ${step} of 4`}>{[1, 2, 3, 4].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
            : (
              <nav className="nav app-nav" aria-label="Main">
                {s.onboarded && <><NavLink to="/map">Map</NavLink><NavLink to="/discover">Picks</NavLink><NavLink to="/me">You</NavLink></>}
                <NavLink to="/about">About</NavLink>
              </nav>
            )}
        </div>
      </header>
      <main className={loc.pathname.startsWith('/start') || loc.pathname === '/about' || loc.pathname === '/test' ? 'narrow' : ''}>
        <Outlet />
      </main>
      {s.onboarded && !onboarding && (
        <nav className="tabbar" aria-label="Main">
          <NavLink to="/map">{I.map}Map</NavLink>
          <NavLink to="/discover">{I.spark}Picks</NavLink>
          <NavLink to="/me">{I.user}You</NavLink>
        </nav>
      )}
      {!onboarding && <footer className="footer"><div className="inner"><span>um!x · Yonsei</span><Link to="/about">How it works</Link><span>Data: Amazon Reviews 2023</span></div></footer>}
      <Toast toast={s.ui.toast} />
    </div>
  )
}

/** pages that need onboarding first */
function Need({ children }) {
  const s = useAppState()
  return s.onboarded ? children : <Navigate to="/start" replace />
}

export default function App() {
  useEffect(() => {
    window.umix = { state: getState, model, log: getLog }   // handy in the browser console while testing
  }, [])
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Landing />} />
          <Route path="start" element={<Profile />} />
          <Route path="start/music" element={<LayerStep key="music" layer="music" />} />
          <Route path="start/film" element={<LayerStep key="film" layer="film" />} />
          <Route path="start/style" element={<LayerStep key="style" layer="style" />} />
          <Route path="start/ready" element={<Ready />} />
          <Route path="map" element={<Need><MapPage /></Need>} />
          <Route path="discover" element={<Need><Discover /></Need>} />
          <Route path="discover/:layer" element={<Need><Discover /></Need>} />
          <Route path="item/:layer/:id" element={<ItemPage />} />
          <Route path="me" element={<Need><Me /></Need>} />
          <Route path="about" element={<About />} />
          <Route path="test" element={<TestPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
