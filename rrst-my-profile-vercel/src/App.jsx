import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Bell, Check, CheckCircle2, ChevronDown, CircleUserRound,
  Globe2, Heart, ImagePlus, LockKeyhole, LogOut, Menu, MoreHorizontal,
  Search, Settings2, ShieldCheck, Shirt, UserPlus, Users, X
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const demoPeople = [
  { id: 'demo-1', name: 'Aarav Mehta', handle: '@aarav.mehta', initials: 'AM', color: 'sand', bio: 'Less noise. More meaning. RRST.', public: true, friends: 128, status: 'none' },
  { id: 'demo-2', name: 'Kiara Shah', handle: '@kiara.shah', initials: 'KS', color: 'rose', bio: 'Collecting moments, not things.', public: false, friends: 86, status: 'pending' },
  { id: 'demo-3', name: 'Reyansh Patel', handle: '@rey.patel', initials: 'RP', color: 'blue', bio: 'Made of good days and good fits.', public: true, friends: 204, status: 'friends' },
]

function Avatar({ initials = 'RR', color = 'dark', size = 'md', photo }) {
  return <div className={`avatar ${color} ${size}`}>{photo ? <img src={photo} alt="Profile" /> : initials}</div>
}

function Brand() {
  return <a className="brand" href="#" aria-label="RRST Fashion home"><span className="brand-mark">R</span><span>RRST<span className="brand-dot">.</span>FASHION<small>MY PROFILE</small></span></a>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authMode, setAuthMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('discover')
  const [privacy, setPrivacy] = useState('public')
  const [search, setSearch] = useState('')
  const [requests, setRequests] = useState([])
  const [friends, setFriends] = useState([])
  const [notice, setNotice] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editPrivacy, setEditPrivacy] = useState('public')
  const [photo, setPhoto] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); return }
    let cancelled = false
    async function loadProfile() {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (cancelled) return
      if (data) {
        setProfile(data)
        setPrivacy(data.privacy || 'public')
        setEditName(data.full_name || '')
        setEditBio(data.bio || '')
        setEditPrivacy(data.privacy || 'public')
        setPhoto(data.avatar_url || '')
      } else {
        const initial = { id: session.user.id, full_name: session.user.user_metadata?.full_name || '', username: session.user.email?.split('@')[0] || 'member', bio: '', privacy: 'public' }
        const { data: created } = await supabase.from('profiles').upsert(initial).select().single()
        if (!cancelled) { setProfile(created || initial); setEditName(initial.full_name); setEditPrivacy('public') }
      }
      const { data: received } = await supabase.from('friend_requests').select('id, requester_id, status, profiles!friend_requests_requester_id_fkey(id, full_name, username, avatar_url)').eq('recipient_id', session.user.id).eq('status', 'pending')
      if (!cancelled && received) setRequests(received)
      const { data: connections } = await supabase.from('friendships').select('id, friend_id, profiles!friendships_friend_id_fkey(id, full_name, username, avatar_url)').eq('user_id', session.user.id)
      if (!cancelled && connections) setFriends(connections)
    }
    loadProfile()
    return () => { cancelled = true }
  }, [session])

  const people = useMemo(() => demoPeople.filter(p => `${p.name} ${p.handle}`.toLowerCase().includes(search.toLowerCase())), [search])

  async function handleAuth(e) {
    e.preventDefault(); setBusy(true); setAuthMessage('')
    if (!isSupabaseConfigured) {
      setAuthMessage('Connect Supabase first: copy .env.example to .env and add your project URL and anon key. Demo preview is available below.')
      setBusy(false); return
    }
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        if (error) throw error
        setAuthMessage('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthMessage('Welcome back.')
      }
    } catch (err) { setAuthMessage(err.message || 'Something went wrong.') }
    setBusy(false)
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!session?.user) { setNotice('Sign in with your connected Supabase account to save changes.'); return }
    const payload = { id: session.user.id, full_name: editName, bio: editBio, privacy: editPrivacy, avatar_url: photo || null, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single()
    if (error) setNotice(error.message)
    else { setProfile(data); setPrivacy(data.privacy); setEditOpen(false); setNotice('Profile updated successfully.') }
  }

  async function sendRequest(person) {
    if (!session?.user) { setNotice('Create an account or sign in to send friend requests.'); setActiveTab('profile'); return }
    if (person.id.startsWith('demo-')) { setNotice('Demo accounts are previews. Real friend requests work between registered accounts.'); return }
    const { error } = await supabase.from('friend_requests').insert({ requester_id: session.user.id, recipient_id: person.id, status: 'pending' })
    setNotice(error ? error.message : 'Friend request sent.')
  }

  async function respondRequest(request, status) {
    const { error } = await supabase.from('friend_requests').update({ status }).eq('id', request.id)
    if (error) { setNotice(error.message); return }
    if (status === 'accepted') {
      const uid = session.user.id
      await supabase.from('friendships').upsert([{ user_id: uid, friend_id: request.requester_id }, { user_id: request.requester_id, friend_id: uid }], { onConflict: 'user_id,friend_id' })
    }
    setRequests(prev => prev.filter(r => r.id !== request.id))
    setNotice(status === 'accepted' ? 'Friend request accepted.' : 'Friend request declined.')
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setSession(null); setProfile(null); setActiveTab('discover')
  }

  function choosePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setNotice('Choose an image under 3 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  const currentName = profile?.full_name || session?.user?.user_metadata?.full_name || 'Your name'
  const currentHandle = profile?.username || session?.user?.email?.split('@')[0] || 'your.handle'

  return <div className="app-shell">
    <header className="topbar">
      <Brand />
      <div className="top-links"><button onClick={() => setActiveTab('discover')}>Discover</button><button onClick={() => setActiveTab('friends')}>Friends</button><button onClick={() => setActiveTab('requests')}>Requests {requests.length > 0 && <b className="count">{requests.length}</b>}</button></div>
      <div className="top-actions"><button className="icon-button" aria-label="Notifications" onClick={() => setActiveTab('requests')}><Bell size={18}/>{requests.length > 0 && <i/>}</button>{session ? <button className="mini-profile" onClick={() => setActiveTab('profile')}><Avatar initials={currentName.slice(0,1)} size="sm"/><span>My profile</span><ChevronDown size={14}/></button> : <button className="button button-dark top-join" onClick={() => setActiveTab('profile')}>Join RRST <ArrowRight size={15}/></button>}<button className="icon-button mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={20}/></button></div>
    </header>
    {mobileMenu && <div className="mobile-menu"><button onClick={() => {setActiveTab('discover');setMobileMenu(false)}}>Discover</button><button onClick={() => {setActiveTab('friends');setMobileMenu(false)}}>Friends</button><button onClick={() => {setActiveTab('requests');setMobileMenu(false)}}>Requests</button><button onClick={() => {setActiveTab('profile');setMobileMenu(false)}}>My Profile</button></div>}

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> YOUR STYLE. YOUR CIRCLE.</div><h1>Wear your<br/><em>identity.</em></h1><p>A profile that goes wherever your RRST tee goes. Connect with your people, on your terms.</p><div className="hero-cta"><button className="button button-dark" onClick={() => setActiveTab('profile')}>Create your profile <ArrowRight size={16}/></button><button className="text-button" onClick={() => setActiveTab('discover')}>Explore the community <ArrowRight size={15}/></button></div><div className="hero-trust"><span><ShieldCheck size={15}/> Privacy controls</span><span><Users size={15}/> Your circle, your choice</span></div></div>
        <div className="hero-art"><div className="art-sun"/><div className="art-label">RRST / IDENTITY<br/><span>EST. YOUR WAY</span></div><div className="tee-shape"><div className="tee-neck"/><div className="tee-stamp">RRST<span>.</span><small>MY PROFILE</small></div><div className="tee-qr"><div className="qr-grid">▦</div><small>SCAN TO CONNECT</small></div></div><div className="art-caption">THE WORLD IS YOUR<br/>CLOSET.</div><div className="art-index">01 — 03</div></div>
      </section>

      <section className="feature-strip"><div><span>01</span><Globe2/><strong>Public or private</strong><small>You decide what people see.</small></div><div><span>02</span><UserPlus/><strong>Real connections</strong><small>Requests, accepts, your circle.</small></div><div><span>03</span><LockKeyhole/><strong>Privacy first</strong><small>Your content, your rules.</small></div></section>

      <section className="workspace">
        <aside className="sidebar"><div className="side-title">YOUR SPACE <span>—</span></div><button className={activeTab==='discover'?'side-link active':'side-link'} onClick={() => setActiveTab('discover')}><Search size={17}/> Discover people</button><button className={activeTab==='friends'?'side-link active':'side-link'} onClick={() => setActiveTab('friends')}><Users size={17}/> My friends <span className="side-count">{friends.length}</span></button><button className={activeTab==='requests'?'side-link active':'side-link'} onClick={() => setActiveTab('requests')}><UserPlus size={17}/> Friend requests <span className="side-count">{requests.length}</span></button><button className={activeTab==='profile'?'side-link active':'side-link'} onClick={() => setActiveTab('profile')}><CircleUserRound size={17}/> My profile</button><div className="sidebar-note"><LockKeyhole size={18}/><strong>Your privacy matters.</strong><p>Switch between public and private whenever you want.</p></div><div className="sidebar-footer">RRST.FASHION © 2026<br/>MADE FOR YOUR EVERYDAY.</div></aside>

        <div className="main-panel">
          {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
          {!isSupabaseConfigured && <div className="setup-banner"><span className="setup-dot"/> <div><strong>Preview mode</strong><p>Connect Supabase to enable real accounts, persistent profiles, and friend requests.</p></div><button onClick={() => setActiveTab('profile')}>Setup account <ArrowRight size={14}/></button></div>}

          {activeTab === 'discover' && <><div className="panel-heading"><div><div className="eyebrow small">MEET YOUR PEOPLE</div><h2>Discover <em>people.</em></h2><p>Find your next connection.</p></div><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." /></div></div><div className="people-grid">{people.map(person => <article className="person-card" key={person.id}><div className={`person-cover ${person.color}`}><span className="cover-tag">RRST COMMUNITY</span><button className="more-button" aria-label="More options"><MoreHorizontal size={18}/></button><Avatar initials={person.initials} color={person.color} size="lg"/></div><div className="person-body"><div className="person-name-row"><div><h3>{person.name}</h3><small>{person.handle}</small></div>{person.public ? <Globe2 size={16} className="muted-icon"/> : <LockKeyhole size={16} className="muted-icon"/>}</div><p>{person.bio}</p><div className="person-meta"><span><Users size={14}/>{person.friends} friends</span><span>{person.public ? 'Public' : 'Private'}</span></div><button className={`button ${person.status==='friends'?'button-outline':'button-dark'} full-button`} onClick={() => person.status==='friends' ? setNotice(`You and ${person.name} are already friends in this preview.`) : sendRequest(person)}>{person.status==='friends' ? <><Check size={15}/> Friends</> : person.status==='pending' ? <><CheckCircle2 size={15}/> Request sent</> : <><UserPlus size={15}/> Add friend</>}</button></div></article>)}</div><div className="demo-note"><span className="demo-pill">PREVIEW</span> Sample profiles show the design. Real member search and friend actions activate after Supabase setup.</div></>}

          {activeTab === 'profile' && <><div className="panel-heading"><div><div className="eyebrow small">YOUR IDENTITY, YOUR WAY</div><h2>My <em>profile.</em></h2><p>Make it yours. Keep it on your terms.</p></div><button className="button button-outline" onClick={() => {setEditOpen(!editOpen);setEditName(profile?.full_name || '');setEditBio(profile?.bio || '');setEditPrivacy(profile?.privacy || 'public')}}><Settings2 size={16}/> Edit profile</button></div>
            {!session ? <div className="auth-layout"><div className="auth-intro"><div className="auth-icon"><CircleUserRound size={28}/></div><h3>{authMode==='signup'?'Your story starts here.':'Welcome back.'}</h3><p>Create your RRST identity with your email. One account, your profile, your circle.</p><div className="auth-benefit"><CheckCircle2 size={16}/> Choose public or private</div><div className="auth-benefit"><CheckCircle2 size={16}/> Send and accept friend requests</div><div className="auth-benefit"><CheckCircle2 size={16}/> Update your profile anytime</div></div><form className="auth-form" onSubmit={handleAuth}><div className="form-heading"><h3>{authMode==='signup'?'Create account':'Sign in'}</h3><span>Email account</span></div>{authMode==='signup' && <label>Full name<input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name"/></label>}<label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label><label>Password<input type="password" minLength="8" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={authMode==='signup'?'new-password':'current-password'}/></label><button className="button button-dark full-button" disabled={busy}>{busy?'Please wait...':authMode==='signup'?'Create my account':'Sign in'} <ArrowRight size={16}/></button>{authMessage && <p className="form-message">{authMessage}</p>}<p className="switch-auth">{authMode==='signup'?'Already have an account?':'New to RRST?'} <button type="button" onClick={() => {setAuthMode(authMode==='signup'?'login':'signup');setAuthMessage('')}}>{authMode==='signup'?'Sign in':'Create account'}</button></p></form></div> : <div className="profile-view"><div className="profile-cover"><span>RRST / MY IDENTITY</span><span>MEMBER PROFILE</span></div><div className="profile-summary"><Avatar initials={currentName.slice(0,1)} photo={photo} size="xl"/><div className="profile-title"><h3>{currentName}</h3><span>@{currentHandle}</span><p>{profile?.bio || 'Add a little about yourself.'}</p></div><div className="privacy-chip">{privacy==='public'?<Globe2 size={14}/>:<LockKeyhole size={14}/>} {privacy==='public'?'Public profile':'Private profile'}</div></div><div className="profile-stats"><div><strong>{friends.length}</strong><span>Friends</span></div><div><strong>{requests.length}</strong><span>Requests</span></div><div><strong>RRST</strong><span>Member</span></div></div>{editOpen && <form className="edit-form" onSubmit={saveProfile}><div className="form-heading"><h3>Edit your profile</h3><span>Changes are saved to your account</span></div><label>Profile photo <input type="file" accept="image/*" onChange={choosePhoto}/></label><label>Full name<input required value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Bio<textarea value={editBio} onChange={e=>setEditBio(e.target.value)} maxLength={160} placeholder="A few words about you..." /></label><label>Profile visibility<select value={editPrivacy} onChange={e=>setEditPrivacy(e.target.value)}><option value="public">Public — anyone can see public details</option><option value="private">Private — friends only</option></select></label><div className="edit-actions"><button type="button" className="button button-outline" onClick={()=>setEditOpen(false)}>Cancel</button><button className="button button-dark">Save changes <Check size={15}/></button></div></form>}<div className="profile-safety"><ShieldCheck size={18}/><div><strong>Privacy control</strong><p>When your profile is private, only accepted friends can see private profile content. Your basic profile may still appear in discovery.</p></div></div><button className="button button-outline signout" onClick={signOut}><LogOut size={15}/> Sign out</button></div>}
          </>}

          {activeTab === 'requests' && <><div className="panel-heading"><div><div className="eyebrow small">YOUR NEXT CONNECTION</div><h2>Friend <em>requests.</em></h2><p>Accept the people you want in your circle.</p></div><div className="round-count">{requests.length}</div></div>{!session ? <div className="empty-state"><UserPlus size={30}/><h3>Requests will show here.</h3><p>Sign in to receive and manage real friend requests.</p><button className="button button-dark" onClick={()=>setActiveTab('profile')}>Sign in <ArrowRight size={15}/></button></div> : requests.length===0 ? <div className="empty-state"><CheckCircle2 size={30}/><h3>You're all caught up.</h3><p>New friend requests will appear here when someone wants to connect.</p><button className="button button-outline" onClick={()=>setActiveTab('discover')}>Discover people <ArrowRight size={15}/></button></div> : <div className="request-list">{requests.map(r=><div className="request-row" key={r.id}><Avatar initials={(r.profiles?.full_name||'U').slice(0,1)} photo={r.profiles?.avatar_url}/><div className="request-person"><strong>{r.profiles?.full_name||'RRST member'}</strong><span>@{r.profiles?.username||'member'} wants to connect</span></div><button className="button button-dark" onClick={()=>respondRequest(r,'accepted')}><Check size={15}/> Accept</button><button className="button button-outline" onClick={()=>respondRequest(r,'declined')}>Decline</button></div>)}</div>}</>}

          {activeTab === 'friends' && <><div className="panel-heading"><div><div className="eyebrow small">YOUR PEOPLE</div><h2>My <em>circle.</em></h2><p>People you've connected with.</p></div><div className="round-count">{friends.length}</div></div>{!session ? <div className="empty-state"><Users size={30}/><h3>Your circle starts with you.</h3><p>Sign in to manage your accepted friends.</p><button className="button button-dark" onClick={()=>setActiveTab('profile')}>Create profile <ArrowRight size={15}/></button></div> : friends.length===0 ? <div className="empty-state"><Users size={30}/><h3>Your circle is waiting.</h3><p>Discover people and send your first friend request.</p><button className="button button-dark" onClick={()=>setActiveTab('discover')}>Discover people <ArrowRight size={15}/></button></div> : <div className="friend-list">{friends.map(f=><div className="request-row" key={f.id}><Avatar initials={(f.profiles?.full_name||'U').slice(0,1)} photo={f.profiles?.avatar_url}/><div className="request-person"><strong>{f.profiles?.full_name||'RRST member'}</strong><span>@{f.profiles?.username||'member'}</span></div><span className="friend-badge"><Check size={14}/> Friends</span></div>)}</div>}</>}
        </div>
      </section>
    </main>
    <footer className="footer"><Brand/><span>Wear it. Scan it. Connect.</span><span>© 2026 RRST.FASHION</span></footer>
  </div>
}