import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight, ArrowRight, Bookmark, Check, ChevronDown, CircleHelp,
  Clock3, Copy, Download, Flame, Grid2X2, Instagram, LayoutDashboard,
  Lightbulb, LoaderCircle, Menu, MessageSquareText, Plus, Search, Settings2,
  Sparkles, WandSparkles, X, Youtube, Zap
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'creatoros_campaigns_v1';
const starterCampaigns = [
  { id: 'sample-1', title: 'The 30-minute design reset', platform: 'Instagram', topic: 'A practical design reset routine', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Ready to edit', hooks: ['Your design workflow is not broken. Your first 30 minutes are.', 'Steal this 30-minute reset before your next project.'], caption: 'A small reset can make a messy creative workflow feel manageable. Save this for your next work session.', cta: 'Save this for your next project.', ideas: ['A 5-slide checklist carousel', 'A 20-second before/after reel', 'A desk setup story sequence'], thumbnail: 'Stop designing on autopilot' },
  { id: 'sample-2', title: 'Build a portfolio that gets noticed', platform: 'YouTube', topic: 'Portfolio advice for beginner designers', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'Draft', hooks: ['Your portfolio is not a gallery. It is proof you can solve problems.', '3 portfolio mistakes keeping beginner designers invisible.'], caption: 'Show the problem, your decisions, and what changed. A pretty screen is only one part of the story.', cta: 'Comment PORTFOLIO for the checklist.', ideas: ['A 6-minute breakdown video', 'A short showing one case-study fix', 'A community poll about portfolio struggles'], thumbnail: 'Your portfolio needs THIS' }
];

function readCampaigns() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : starterCampaigns;
  } catch { return starterCampaigns; }
}
function App() {
  const [campaigns, setCampaigns] = useState(readCampaigns);
  const [activeId, setActiveId] = useState(null);
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [audience, setAudience] = useState('Beginner creators & designers');
  const [tone, setTone] = useState('Bold and useful');
  const [goal, setGoal] = useState('Grow an engaged audience');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState('studio');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns)), [campaigns]);
  const active = campaigns.find(c => c.id === activeId) || null;
  const visibleCampaigns = useMemo(() => campaigns.filter(c => `${c.title} ${c.topic} ${c.platform}`.toLowerCase().includes(query.toLowerCase())), [campaigns, query]);

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }
  async function generate() {
    if (topic.trim().length < 4) {
      setError('Add a little more detail to your idea (at least 4 characters).');
      return;
    }
    setBusy(true); setError(''); setActiveId(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platform, audience, tone, goal })
      });
      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid server response (HTTP ${response.status}). Check the backend terminal.`);
      }
      if (!response.ok) throw new Error(data.error || data.message || 'Could not generate the campaign.');
      const campaign = { ...data.campaign, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'Ready to edit' };
      setCampaigns(previous => [campaign, ...previous]);
      setActiveId(campaign.id);
      setPage('campaigns');
    } catch (e) {
      setError(`${e.message} Check that the local server is running.`);
    } finally { setBusy(false); }
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); flash('Copied to clipboard'); }
    catch { flash('Clipboard unavailable — select and copy the text.'); }
  }
  function removeCampaign(id) {
    setCampaigns(previous => previous.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
    flash('Campaign removed');
  }
  function exportCampaign(c) {
    // Use the browser's print engine to create a clean, multi-page PDF without
    // requiring an extra package. In the print dialog, choose "Save as PDF".
    const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const list = (items = []) => items.length
      ? `<ol>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
      : '<p class="muted">No items added.</p>';
    const safeTitle = escapeHtml(c.title || 'CreatorOS Campaign');
    const created = c.createdAt ? new Date(c.createdAt).toLocaleString() : new Date().toLocaleString();
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTitle} — CreatorOS AI</title>
<style>
  @page {
    size: A4;
    margin: 20mm 17mm 19mm;
    @bottom-left {
      content: "CREATOROS AI  ·  CAMPAIGN BRIEF";
      color: #85867f;
      font: 700 8pt/1.2 Arial, Helvetica, sans-serif;
      letter-spacing: .08em;
    }
    @bottom-right {
      content: "PAGE " counter(page) " OF " counter(pages);
      color: #85867f;
      font: 700 8pt/1.2 Arial, Helvetica, sans-serif;
      letter-spacing: .06em;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    color: #22231f;
    font-family: Inter, "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }
  .brand {
    color: #ed604c;
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: .17em;
    line-height: 1.4;
    text-transform: uppercase;
  }
  .hero {
    border-bottom: 4px solid #d9ff62;
    padding: 0 0 18px;
    margin: 0 0 26px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h1 {
    color: #191a17;
    font-size: 28pt;
    font-weight: 750;
    letter-spacing: -.045em;
    line-height: 1.12;
    margin: 12px 0 11px;
    overflow-wrap: anywhere;
  }
  .meta { color: #73746d; font-size: 9pt; line-height: 1.5; }
  .topic { color: #4b4c45; font-size: 12pt; margin: 14px 0 0; line-height: 1.55; }
  .section { margin: 22px 0 0; }
  h2 {
    color: #282923;
    font-size: 13pt;
    font-weight: 750;
    letter-spacing: -.015em;
    line-height: 1.3;
    margin: 0 0 10px;
    padding: 0 0 7px;
    border-bottom: 1px solid #e5e4dc;
    break-after: avoid;
    page-break-after: avoid;
  }
  p { margin: 0 0 10px; white-space: pre-wrap; overflow-wrap: anywhere; }
  ol { margin: 0; padding-left: 23px; }
  li { margin: 0 0 9px; padding-left: 4px; break-inside: avoid; page-break-inside: avoid; }
  .caption-card {
    background: #f6f6f0;
    border: 1px solid #e8e8dd;
    border-left: 4px solid #d9ff62;
    border-radius: 7px;
    padding: 14px 16px;
  }
  .caption-card p { margin: 0; }
  .cta-copy { font-weight: 650; }
  .thumbnail-card {
    background: #242520;
    color: #d9ff62;
    border-radius: 8px;
    padding: 18px 20px;
    font-weight: 800;
    font-size: 18pt;
    letter-spacing: -.02em;
    line-height: 1.25;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .muted { color: #77786f; }
  .closing-note {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #e5e4dc;
    color: #77786f;
    font-size: 8.5pt;
  }
  @media screen {
    body { max-width: 820px; margin: 0 auto; padding: 28px 36px 48px; }
    .hero { margin-bottom: 30px; }
  }
  @media print {
    a { color: inherit; text-decoration: none; }
    .section { orphans: 3; widows: 3; }
    h2, .caption-card, .thumbnail-card { -webkit-column-break-inside: avoid; }
  }
</style></head><body>
  <header class="hero"><div class="brand">CreatorOS AI · Campaign brief</div>
    <h1>${safeTitle}</h1>
    <div class="meta">Platform: ${escapeHtml(c.platform || 'Not specified')} · Created: ${escapeHtml(created)}</div>
    <p class="topic">${escapeHtml(c.topic || '')}</p>
  </header>
  <section class="section"><h2>Hooks that stop the scroll</h2>${list(c.hooks || [])}</section>
  <section class="section"><h2>Caption / post copy</h2><div class="caption-card"><p>${escapeHtml(c.caption || '')}</p></div></section>
  <section class="section"><h2>Call to action</h2><p class="cta-copy">${escapeHtml(c.cta || '')}</p></section>
  <section class="section"><h2>Content ideas</h2>${list(c.ideas || [])}</section>
  <section class="section"><h2>Thumbnail / cover direction</h2><div class="thumbnail-card">${escapeHtml(c.thumbnail || c.title || '')}</div></section>
  <footer class="closing-note">Generated with CreatorOS AI · Review all content before publishing.</footer>
</body></html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      flash('Allow pop-ups for this site to export a PDF.');
      return;
    }
    printWindow.opener = null;
    printWindow.onload = () => {
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);
    };
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    flash('PDF export ready — choose Save as PDF in the print dialog.');
  }

  const nav = [
    { id: 'studio', label: 'Idea studio', icon: WandSparkles },
    { id: 'campaigns', label: 'My campaigns', icon: Grid2X2 },
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor" /></div><span>creator<span className="brand-heavy">OS</span><sup>AI</sup></span><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE <ChevronDown size={13}/></div>
      <div className="workspace-card"><div className="workspace-avatar">C.</div><div><strong>Creative studio</strong><small>Personal workspace</small></div><span className="online-dot"/></div>
      <nav className="nav-list">{nav.map(item => <button key={item.id} onClick={() => {setPage(item.id); setMobileNav(false);}} className={`nav-item ${page === item.id ? 'active' : ''}`}><item.icon size={17}/><span>{item.label}</span>{item.id === 'campaigns' && <span className="nav-count">{campaigns.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><div className="tip-icon"><Lightbulb size={16}/></div><strong>Creator tip</strong><p>Specific ideas beat broad topics. Tell the AI who you're helping and what they'll learn.</p><button onClick={() => {setPage('studio'); setTopic('3 mistakes beginner UI designers make when building their first portfolio');}}>Try this idea <ArrowRight size={13}/></button></div>
        <button className="nav-item muted-nav" onClick={() => flash('Settings are coming in the next build.')}><Settings2 size={17}/> Settings <span className="soon">SOON</span></button>
        <div className="profile-row"><div className="profile-avatar">S</div><div className="profile-copy"><strong>Creator workspace</strong><small>Free plan · MVP</small></div><CircleHelp size={17} className="help-icon" onClick={() => flash('CreatorOS AI starter build · feedback welcome.')}/></div>
      </div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page === 'studio' ? 'Idea studio' : 'My campaigns'}</strong></div><div className="topbar-right"><div className="ai-status"><span/> AI workspace</div><div className="top-avatar">S</div></div></header>
      <div className="content-wrap">
        {page === 'studio' ? <Studio topic={topic} setTopic={setTopic} platform={platform} setPlatform={setPlatform} audience={audience} setAudience={setAudience} tone={tone} setTone={setTone} goal={goal} setGoal={setGoal} busy={busy} error={error} generate={generate} setPage={setPage} campaigns={campaigns} setActiveId={setActiveId} /> :
          <Campaigns campaigns={visibleCampaigns} query={query} setQuery={setQuery} active={active} setActiveId={setActiveId} onCopy={copyText} onExport={exportCampaign} onRemove={removeCampaign} setPage={setPage}/>}
      </div>
      <footer className="app-footer"><span>CREATOROS AI <span className="footer-dot">•</span> BUILT FOR THE NEXT BIG IDEA</span><span>MAKE SOMETHING THAT MATTERS ↗</span></footer>
    </main>
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
  </div>;
}

function Studio(props) {
  const {topic,setTopic,platform,setPlatform,audience,setAudience,tone,setTone,goal,setGoal,busy,error,generate,setPage,campaigns,setActiveId} = props;
  return <div className="studio-page">
    <section className="hero">
      <div className="hero-kicker"><span className="kicker-star">✳</span> YOUR CREATIVE CO-PILOT <span className="kicker-line"/></div>
      <h1>One idea.<br/><span className="headline-accent">A whole</span> <span className="headline-outline">campaign.</span></h1>
      <p className="hero-sub">Stop staring at the blank page. Turn the thought in your head into content people actually want to see.</p>
      <div className="hero-sticker"><Sparkles size={15}/> MADE FOR MAKERS <ArrowDownRight size={15}/></div>
      <div className="hero-art" aria-hidden="true"><div className="art-sun"/><div className="art-shape art-shape-one"/><div className="art-shape art-shape-two"/><div className="art-label label-top">IDEA → IMPACT</div><div className="art-label label-bottom">MAKE IT REAL.</div><div className="art-scribble">✳</div></div>
    </section>
    <div className="section-heading"><div><span className="eyebrow">01 / THE INPUT</span><h2>What's the big idea?</h2></div><span className="required-note">ALL FIELDS HELP THE AI GET SPECIFIC</span></div>
    <section className="generator-card">
      <label className="field-label" htmlFor="topic">YOUR CONTENT IDEA <span>*</span></label>
      <textarea id="topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Why beginner designers should stop copying Dribbble shots and start solving real problems..." rows={3} maxLength={500}/>
      <div className="input-foot"><span>Make it messy. We'll help shape it.</span><span>{topic.length}/500</span></div>
      <div className="form-grid">
        <div className="field"><label className="field-label" htmlFor="platform">PLATFORM</label><div className="select-wrap"><select id="platform" value={platform} onChange={e => setPlatform(e.target.value)}><option>Instagram</option><option>YouTube</option><option>LinkedIn</option><option>TikTok</option><option>X</option></select><ChevronDown size={15}/></div></div>
        <div className="field"><label className="field-label" htmlFor="audience">WHO'S IT FOR?</label><input id="audience" value={audience} onChange={e => setAudience(e.target.value)} maxLength={120} placeholder="e.g. first-time founders"/></div>
        <div className="field"><label className="field-label" htmlFor="tone">CREATIVE ENERGY</label><div className="select-wrap"><select id="tone" value={tone} onChange={e => setTone(e.target.value)}><option>Bold and useful</option><option>Funny and relatable</option><option>Educational and clear</option><option>Story-driven</option><option>Premium and thoughtful</option></select><ChevronDown size={15}/></div></div>
        <div className="field"><label className="field-label" htmlFor="goal">THE GOAL</label><div className="select-wrap"><select id="goal" value={goal} onChange={e => setGoal(e.target.value)}><option>Grow an engaged audience</option><option>Drive comments and saves</option><option>Generate leads</option><option>Build personal brand</option><option>Promote a product or service</option></select><ChevronDown size={15}/></div></div>
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="generate-row"><span className="privacy-note"><Sparkles size={14}/> AI-assisted · Always editable</span><button className="primary-btn" disabled={busy} onClick={generate}>{busy ? <><LoaderCircle className="spin" size={17}/> Creating campaign...</> : <><WandSparkles size={17}/> Generate campaign <ArrowRight size={16}/></>}</button></div>
    </section>
    <div className="below-grid"><section className="how-card"><span className="eyebrow">THE CREATOROS METHOD</span><h3>Less blank page.<br/>More <span>making things.</span></h3><div className="method-steps"><div><b>01</b><span>Drop your idea</span></div><ArrowRight size={15}/><div><b>02</b><span>Shape the story</span></div><ArrowRight size={15}/><div><b>03</b><span>Make it yours</span></div></div></section>
      <section className="recent-card"><div className="recent-head"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h3>Recent campaigns</h3></div><button className="text-btn" onClick={() => setPage('campaigns')}>View all <ArrowRight size={14}/></button></div>{campaigns.slice(0,2).map((c,i)=><button className="recent-item" key={c.id} onClick={()=>{setActiveId(c.id);setPage('campaigns')}}><div className={`recent-thumb thumb-${i}`}>{i===0?'01':'02'}</div><div className="recent-copy"><strong>{c.title}</strong><small>{c.platform} · {new Date(c.createdAt).toLocaleDateString()}</small></div><ArrowDownRight size={16}/></button>)}</section></div>
  </div>;
}

function Campaigns({campaigns,query,setQuery,active,setActiveId,onCopy,onExport,onRemove,setPage}) {
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  useEffect(() => { setEditing(false); setEditCaption(active?.caption || ''); }, [active?.id]);
  return <div className="campaign-page">
    <div className="page-title-row"><div><span className="eyebrow">02 / YOUR CONTENT LIBRARY</span><h1>Ideas in motion<span className="title-period">.</span></h1><p>Your ideas, organized. Your next post, closer than ever.</p></div><button className="primary-btn" onClick={() => setPage('studio')}><Plus size={17}/> New campaign</button></div>
    <div className="campaign-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search campaigns..."/></div><span className="campaign-count">{campaigns.length} CAMPAIGNS</span></div>
    {active ? <section className="campaign-detail">
      <div className="detail-top"><button className="back-link" onClick={()=>setActiveId(null)}>← All campaigns</button><span className="status-pill"><span/> {active.status || 'Draft'}</span></div>
      <div className="detail-heading"><div><span className="eyebrow">{active.platform} CAMPAIGN</span><h2>{active.title}</h2><p>{active.topic}</p></div><div className="detail-actions"><button className="outline-btn" onClick={()=>onExport(active)}><Download size={15}/> Export</button><button className="icon-btn danger-btn" onClick={()=>onRemove(active.id)} title="Delete campaign"><X size={17}/></button></div></div>
      <div className="output-grid">
        <OutputCard number="01" title="Hooks that stop the scroll" icon={<Flame size={17}/>}><div className="hook-list">{(active.hooks||[]).map((h,i)=><div className="hook-item" key={i}><span>0{i+1}</span><p>{h}</p><button className="tiny-copy" onClick={()=>onCopy(h)} aria-label="Copy hook"><Copy size={14}/></button></div>)}</div></OutputCard>
        <OutputCard number="02" title="Caption / post copy" icon={<MessageSquareText size={17}/>}><div className="caption-editor">{editing?<textarea value={editCaption} onChange={e=>setEditCaption(e.target.value)} rows={6}/>:<p>{active.caption}</p>}<div className="caption-actions"><button className="text-btn" onClick={()=>{if(editing){active.caption=editCaption;setEditing(false);onCopy(editCaption);}else{setEditCaption(active.caption||'');setEditing(true)}}}>{editing?'Save & copy':'Edit caption'}</button><button className="tiny-copy" onClick={()=>onCopy(editing?editCaption:active.caption)}><Copy size={14}/></button></div></div></OutputCard>
        <OutputCard number="03" title="Content angles" icon={<Grid2X2 size={17}/>}><ul className="idea-list">{(active.ideas||[]).map((x,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span>{x}</li>)}</ul></OutputCard>
        <OutputCard number="04" title="Thumbnail / cover direction" icon={<Instagram size={17}/>}><div className="thumbnail-preview"><span>THE BIG IDEA</span><strong>{active.thumbnail || active.title}</strong><div className="thumbnail-spark">✳</div></div><button className="text-btn copy-direction" onClick={()=>onCopy(active.thumbnail || active.title)}><Copy size={14}/> Copy thumbnail text</button></OutputCard>
      </div>
      <div className="detail-bottom"><span><Clock3 size={14}/> Created {new Date(active.createdAt).toLocaleString()}</span><button className="primary-btn" onClick={()=>onExport(active)}><Download size={16}/> Export campaign</button></div>
    </section> : campaigns.length ? <div className="campaign-grid">{campaigns.map((c,i)=><button className="campaign-tile" key={c.id} onClick={()=>setActiveId(c.id)}><div className={`tile-art tile-art-${i%3}`}><span>{c.platform}</span><span className="tile-number">{String(i+1).padStart(2,'0')}</span><strong>{c.thumbnail || c.title}</strong><span className="tile-spark">✳</span></div><div className="tile-meta"><div><h3>{c.title}</h3><p>{c.topic}</p></div><ArrowDownRight size={18}/></div><div className="tile-foot"><span>{new Date(c.createdAt).toLocaleDateString()}</span><span className="status-pill"><span/>{c.status||'Draft'}</span></div></button>)}</div> : <div className="empty-state"><div className="empty-icon"><Bookmark size={24}/></div><h2>No campaigns found.</h2><p>Try a different search or start a fresh idea.</p><button className="primary-btn" onClick={()=>setPage('studio')}><Plus size={16}/> Create your first campaign</button></div>}
    <div className="library-note"><Sparkles size={15}/> Campaigns are saved in this browser for now. Cloud sync and accounts are planned for a later build.</div>
  </div>;
}
function OutputCard({number,title,icon,children}) { return <section className="output-card"><div className="output-head"><span className="output-number">{number}</span><span className="output-icon">{icon}</span><h3>{title}</h3></div>{children}</section> }
createRoot(document.getElementById('root')).render(<App/>);
