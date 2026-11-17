// Account tab, followers and following, someone else's map, and privacy settings.
import { act } from '../actions.js'
import { ACC, FOLLOWERS, PEOPLE, VISL } from '../data.js'
import { I } from '../icons.jsx'
import { CAT, common, following, vis } from '../store.js'
import { BackBtn, FloatPage, Flower, Hdr, Icon, MapSvg, Segc } from '../ui.jsx'

export function Account({ S }) {
  const M = S.me, total = S.boards.reduce((s, x) => s + x.items.length, 0), linked = ACC.filter(a => S.links[a.k]).length
  const row = (key, onClick, label, val) => (
    <button key={key} className="li" onClick={onClick}><span className="m"><b>{label}</b></span><span className="v">{val || ''} {I.chev}</span></button>
  )
  return (
    <FloatPage right={<button className="glass circ" onClick={() => act('settings')} aria-label="Settings">{I.gear}</button>}>
      <div className="acc-top">
        <span className="av big" aria-hidden="true">{(M.name.trim()[0] || 'Y').toUpperCase()}</span>
        <div className="stats">
          <div className="stat"><b>{S.boards.length}</b><span>Maps</span></div>
          <button className="stat" onClick={() => act('flist', { v: 'followers' })}><b>{FOLLOWERS.length}</b><span>Followers</span></button>
          <button className="stat" onClick={() => act('flist', { v: 'following' })}><b>{following(S).length}</b><span>Following</span></button>
        </div>
      </div>
      <h1 className="lt" style={{ fontSize: 28, marginTop: 20 }}>{M.name}</h1>
      <p className="sub" style={{ marginTop: 2 }}>{M.handle} · {total} saves</p>
      <p className="body" style={{ marginTop: 10 }}>{M.bio}</p>
      <div className="row-actions" style={{ marginTop: 20 }}>
        <button className="btn glass" style={{ height: 44, fontSize: 15 }} onClick={() => act('editprof')}>Edit profile</button>
        <button className="btn glass" style={{ height: 44, fontSize: 15 }} onClick={() => act('toast', { msg: 'Profile link copied' })}>Share profile</button>
      </div>
      <div className="ghead">Your maps</div>
      <div className="group">
        {S.boards.map((b, i) => (
          <button key={i} className="li ind" onClick={() => act('openboard', { i })}>
            <span className="tile" style={{ background: 'var(--bg)' }}>{b.items.length && CAT[b.items[0]] ? <Icon t={CAT[b.items[0]].t} size={22} /> : <Flower size={22} />}</span>
            <span className="m"><b style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 19, fontWeight: 400 }}>{b.name}</b><span>{b.items.length} saves · {VISL[vis(S, b)]}</span></span>
            <span className="v">{I.chev}</span>
          </button>
        ))}
      </div>
      <div className="ghead">Settings</div>
      <div className="group">
        {row('privacy', () => act('settings'), 'Privacy', VISL[S.priv.profile])}
        {row('linked', () => act('settings'), 'Linked accounts', linked + ' linked')}
        {row('quiz', () => act('redoquiz'), 'Taste questions', 'Answer again')}
        {row('tutorial', () => act('tutorial'), 'How to read a map', '')}
        {row('help', () => act('toast', { msg: 'Thanks! Tell the facilitator anything you noticed.' }), 'Help and feedback', '')}
      </div>
      <p className="fine" style={{ marginTop: 32 }}>um!x alpha · for user testing</p>
    </FloatPage>
  )
}

function PersonRow({ S, k, mode }) {
  const p = PEOPLE[k], fl = !!S.follow[k]
  return (
    <div className="li">
      <span className="av">{p.h[1].toUpperCase()}</span>
      <button className="m" onClick={() => act('peek', { u: k })} style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }}>
        <b>{p.h}</b><span><i style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--label)' }}>{p.board}</i> · {common(S, k)}</span>
      </button>
      <button className="tbtn sm" onClick={() => act('follow', { u: k })} aria-pressed={fl} style={fl ? { color: 'var(--label2)' } : undefined}>
        {fl ? 'Following' : mode === 'followers' ? 'Follow back' : 'Follow'}
      </button>
    </div>
  )
}

export function FollowList({ S }) {
  const F = S.flist, fl = following(S), sugg = Object.keys(PEOPLE).filter(k => !S.follow[k])
  const L = F === 'followers' ? FOLLOWERS : fl
  return (
    <>
      <Hdr left={<BackBtn onClick={() => act('unflist')} />} />
      <div className="scroll">
        <p className="fn" style={{ marginTop: 8, fontSize: 14 }}>{S.me.handle}</p>
        <h1 className="lt" style={{ marginTop: 2 }}>{F === 'followers' ? 'Followers' : 'Following'}</h1>
        <div style={{ marginTop: 20 }}>
          <Segc value={F} label="Followers or following" onPick={v => act('flseg', { v })}
            opts={[['followers', `${FOLLOWERS.length} Followers`], ['following', `${fl.length} Following`]]} />
        </div>
        {L.length
          ? <div className="group" style={{ marginTop: 20 }}>{L.map(k => <PersonRow key={k} S={S} k={k} mode={F} />)}</div>
          : <p className="sub" style={{ marginTop: 28, textAlign: 'center' }}>You’re not following anyone yet.</p>}
        {F === 'following' && sugg.length > 0 && (
          <>
            <div className="ghead">Maps like yours</div>
            <div className="group">{sugg.map(k => <PersonRow key={k} S={S} k={k} />)}</div>
            <p className="gfoot">People whose maps overlap with yours. You see their maps, never a feed.</p>
          </>
        )}
      </div>
    </>
  )
}

export function Peek({ S }) {
  const k = S.viewing, p = PEOPLE[k]
  return (
    <>
      <Hdr left={<BackBtn onClick={() => act('unpeek')} />} right={
        <button className="glass btn" style={{ height: 44, fontSize: 15, padding: '0 18px' }} onClick={() => act('follow', { u: k })} aria-pressed={!!S.follow[k]}>
          {S.follow[k] ? 'Following' : 'Follow'}
        </button>
      } />
      <div className="scroll">
        <p className="fn" style={{ marginTop: 8, fontSize: 14 }}>{p.h}’s map</p>
        <h1 className="lt" style={{ marginTop: 4 }}><i>{p.board}</i></h1>
        <p className="sub" style={{ marginTop: 6 }}>{common(S, k)}. Tap anything to save it to your own map.</p>
        <div className="map"><MapSvg key={k} ids={p.items} hun={[]} peek center={p.h.slice(1, 2).toUpperCase() + p.h.slice(2).split('.')[0]} /></div>
      </div>
    </>
  )
}

export function Settings({ S }) {
  const P = S.priv, priv = P.profile === 'only me'
  const radio = (k, v, l, sub) => (
    <button key={v} className="li" onClick={() => act('pv', { k, v })} role="radio" aria-checked={P[k] === v}>
      <span className="m"><b>{l}</b>{sub && <span>{sub}</span>}</span>{P[k] === v && <span className="check">{I.check}</span>}
    </button>
  )
  return (
    <>
      <Hdr left={<BackBtn onClick={() => act('unsettings')} />} />
      <div className="scroll" style={{ paddingBottom: 48 }}>
        <h1 className="lt" style={{ marginTop: 8 }}>Privacy</h1>
        <p className="sub" style={{ marginTop: 8 }}>Choose who sees your maps, and how your saves help other people find things.</p>

        <div className="ghead">Who can see your profile</div>
        <div className="group">{radio('profile', 'public', 'Everyone')}{radio('profile', 'followers', 'Followers')}{radio('profile', 'only me', 'Only me')}</div>

        <div className="ghead">Each map</div>
        <div className="group">
          {S.boards.map((b, i) => (
            <button key={i} className="li" onClick={e => act('bvismenu', { i, el: e.currentTarget })} disabled={priv} aria-haspopup="menu">
              <span className="m"><b>{b.name}</b><span>{b.items.length} saves</span></span>
              <span className="v">{VISL[vis(S, b)]} {priv ? null : I.chev}</span>
            </button>
          ))}
        </div>
        <p className="gfoot">{priv ? 'Your profile is private, so every map is private too.' : 'A map set to Only me never shows on your profile.'}</p>

        <div className="ghead">Helping other people’s suggestions</div>
        <div className="group">
          {radio('share', 'named', 'With my name', 'Others may see “saved by you” on a suggestion')}
          {radio('share', 'anon', 'Anonymously', 'Your saves count, but nobody sees they came from you')}
          {radio('share', 'off', 'Don’t use my maps', 'Your saves never shape anyone else’s suggestions')}
        </div>
        <p className="gfoot">When your maps overlap with someone else’s, the things you saved together can become their suggestions.</p>

        <div className="ghead">Being found</div>
        <div className="group">
          <div className="li">
            <span className="m"><b id="sw-rhyme">Show me in Maps like yours</b><span>People with similar maps can see yours in Discover</span></span>
            <button className="switch" role="switch" aria-labelledby="sw-rhyme" aria-checked={!!P.rhyme && !priv} onClick={() => act('pswitch', { k: 'rhyme' })} disabled={priv} />
          </div>
        </div>

        <div className="ghead">Linked accounts</div>
        <div className="group">
          {ACC.map(a => {
            const on = !!S.links[a.k]
            return (
              <button key={a.k} className="li ind" onClick={() => act('link', { k: a.k })} aria-pressed={on}>
                <span className="tile" style={{ background: 'var(--bg)' }}><Icon t={a.t} size={24} /></span>
                <span className="m"><b>{a.name}</b><span>{on ? 'Syncing new saves' : 'Not linked'}</span></span>
                <span className="v" style={{ color: on ? 'var(--label2)' : 'var(--tint)' }}>{on ? 'Unlink' : 'Link'}</span>
              </button>
            )
          })}
        </div>
        <p className="fine" style={{ marginTop: 32 }}>Alpha. These settings only change what this page shows.</p>
      </div>
    </>
  )
}
