import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight, ArrowRight, Bookmark, Check, ChevronDown, CircleHelp,
  Clock3, Copy, Download, Flame, Grid2X2, Instagram, LayoutDashboard,
  Lightbulb, LoaderCircle, Menu, MessageSquareText, Plus, Search, Settings2,
  Sparkles, WandSparkles, X, Youtube, Zap
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'creatoros_campaigns_v1';
const SEQUENCE_KEY = 'creatoros_campaign_sequence_v1';
const starterCampaigns = [
  { id: 'sample-1', campaignNumber: 1, title: 'The 30-minute design reset', platform: 'Instagram', topic: 'A practical design reset routine', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Ready to edit', hooks: ['Your design workflow is not broken. Your first 30 minutes are.', 'Steal this 30-minute reset before your next project.'], caption: 'A small reset can make a messy creative workflow feel manageable. Save this for your next work session.', cta: 'Save this for your next project.', ideas: ['A 5-slide checklist carousel', 'A 20-second before/after reel', 'A desk setup story sequence'], thumbnail: 'Stop designing on autopilot' },
  { id: 'sample-2', campaignNumber: 2, title: 'Build a portfolio that gets noticed', platform: 'YouTube', topic: 'Portfolio advice for beginner designers', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'Draft', hooks: ['Your portfolio is not a gallery. It is proof you can solve problems.', '3 portfolio mistakes keeping beginner designers invisible.'], caption: 'Show the problem, your decisions, and what changed. A pretty screen is only one part of the story.', cta: 'Comment PORTFOLIO for the checklist.', ideas: ['A 6-minute breakdown video', 'A short showing one case-study fix', 'A community poll about portfolio struggles'], thumbnail: 'Your portfolio needs THIS' }
];

function readCampaigns() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored)) return starterCampaigns;
    const chronological = [...stored].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    return stored.map(campaign => ({
      ...campaign,
      campaignNumber: Number.isInteger(campaign.campaignNumber)
        ? campaign.campaignNumber
        : chronological.findIndex(item => item.id === campaign.id) + 1
    }));
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
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [campaignSort, setCampaignSort] = useState('newest');
  const [page, setPage] = useState('studio');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns)), [campaigns]);
  const active = campaigns.find(c => c.id === activeId) || null;
  const visibleCampaigns = useMemo(() => {
    const filtered = campaigns.filter(c => `${c.title} ${c.topic} ${c.platform}`.toLowerCase().includes(query.toLowerCase()));
    return filtered.sort((a, b) => {
      if (campaignSort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (campaignSort === 'title') return (a.title || '').localeCompare(b.title || '');
      if (campaignSort === 'sequence') return (a.campaignNumber || 0) - (b.campaignNumber || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [campaigns, query, campaignSort]);

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
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/generate`, {
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
      const nextCampaignNumber = Math.max(
        Number(localStorage.getItem(SEQUENCE_KEY)) || 0,
        campaigns.reduce((highest, item) => Math.max(highest, Number(item.campaignNumber) || 0), 0)
      ) + 1;
      localStorage.setItem(SEQUENCE_KEY, String(nextCampaignNumber));
      const campaign = {
        ...data.campaign,
        audience,
        tone,
        goal,
        id: crypto.randomUUID(),
        campaignNumber: nextCampaignNumber,
        createdAt: new Date().toISOString(),
        status: 'Ready to edit'
      };
      setCampaigns(previous => [campaign, ...previous]);
      setActiveId(campaign.id);
      setPage('campaigns');

      generateThumbnail(campaign);
    } catch (e) {
      setError(`${e.message} Check that the local server is running.`);
    } finally { setBusy(false); }
  }
  
  async function generateThumbnail(campaign, editPrompt = '') {
    setThumbnailBusy(true);
    setThumbnailError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/generate-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: campaign.topic,
          platform: campaign.platform,
          thumbnail: campaign.thumbnail,
          audience: campaign.audience || 'general audience',
          tone: campaign.tone || 'bold and engaging',
          goal: campaign.goal || 'increase audience interest',
          editPrompt
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not generate thumbnail.');
      }

      if (!data.image) {
        throw new Error('The server did not return an image.');
      }

      setCampaigns(previous =>
        previous.map(item =>
          item.id === campaign.id
            ? { ...item, thumbnailImage: data.image }
            : item
        )
      );

      flash('Thumbnail generated successfully');
    } catch (e) {
      setThumbnailError(e.message);
    } finally {
      setThumbnailBusy(false);
    }
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
  function exportCampaign(c, selectedPreset = 'YouTube') {
    // Use the browser's print engine to create a clean, multi-page PDF without
    // requiring an extra package. In the print dialog, choose "Save as PDF".
    const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const list = (items = []) => items.length
      ? `<ol>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
      : '<p class="muted">No items added.</p>';
    const safeTitle = escapeHtml(c.title || 'CreatorOS Campaign');
    const thumbnailPresets = {
      Instagram: { label: 'Instagram Post', width: 1080, height: 1350 },
      YouTube: { label: 'YouTube Thumbnail', width: 1280, height: 720 },
      LinkedIn: { label: 'LinkedIn', width: 1200, height: 627 },
      TikTok: { label: 'TikTok', width: 1080, height: 1920 },
      X: { label: 'X', width: 1200, height: 675 }
    };
    const thumbnailPreset = thumbnailPresets[selectedPreset] || thumbnailPresets.YouTube;
    // The PDF remains an A4 report. Only the thumbnail frame changes to match
    // the currently selected platform ratio, cropping the source image to cover.
    const printableThumbnailWidthMm = 176;
    const printableThumbnailHeightMm =
      printableThumbnailWidthMm * thumbnailPreset.height / thumbnailPreset.width;
    const thumbnailImage =
      typeof c.thumbnailImage === 'string' &&
      /^data:image\/(webp|png|jpeg);base64,/.test(c.thumbnailImage)
        ? `<p class="thumbnail-format">${escapeHtml(thumbnailPreset.label)} · ${thumbnailPreset.width} × ${thumbnailPreset.height}</p>
           <img class="thumbnail-image"
             style="width:${printableThumbnailWidthMm}mm;height:${printableThumbnailHeightMm.toFixed(2)}mm;aspect-ratio:${thumbnailPreset.width} / ${thumbnailPreset.height}"
             src="${escapeHtml(c.thumbnailImage)}" alt="Generated campaign thumbnail in ${escapeHtml(thumbnailPreset.label)} format" />`
        : '';
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
  .thumbnail-format {
  margin: 12px 0 6px;
  color: #77786f;
  font: 700 8pt/1.3 Arial, Helvetica, sans-serif;
  letter-spacing: .04em;
}
.thumbnail-image {
  display: block;
  max-width: 100%;
  max-height: none;
  object-fit: cover;
  object-position: center;
  border-radius: 8px;
  margin: 6px 0 12px;
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
</style>
</head>
<body>
  <header class="hero">
    <div class="brand">CreatorOS AI · Campaign brief</div>
    <h1>${safeTitle}</h1>
      <div class="meta">Platform: ${escapeHtml(c.platform || 'Not specified')} · Created: ${escapeHtml(created)}</div>
    <p class="topic">${escapeHtml(c.topic || '')}</p>
  </header>
  
  <section class="section">
    <h2>Hooks that stop the scroll</h2>
    ${list(c.hooks || [])}
  </section>

  <section class="section">
    <h2>Caption / post copy</h2>
    <div class="caption-card">
      <p>${escapeHtml(c.caption || '')}</p>
    </div>
  </section>

  <section class="section">
    <h2>Call to action</h2>
    <p class="cta-copy">${escapeHtml(c.cta || '')}</p>
  </section>

  <section class="section">
    <h2>Content ideas</h2>
    ${list(c.ideas || [])}
  </section>

  <section class="section">
    <h2>Thumbnail / cover direction</h2>
    ${thumbnailImage}
    <div class="thumbnail-card">${escapeHtml(c.thumbnail || c.title || '')}</div>
  </section>

  <footer class="closing-note">Generated with CreatorOS AI · Review all content before publishing.</footer>
</body>
</html>`;

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
      <div className="brand">
        <div className="brand-mark">
          <Zap size={20} fill="currentColor" />
        </div>
        <span>creator<span className="brand-heavy">OS</span>
          <sup>AI</sup>
        </span>
        <button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu">
          <X size={18}/>
        </button>
      </div>
      
      <div className="workspace-label">WORKSPACE <ChevronDown size={13}/></div>
      
      <div className="workspace-card">
        <div className="workspace-avatar">C.</div>
        <div>
          <strong>Creative studio</strong>
          <small>Personal workspace</small>
        </div>
        <span className="online-dot"/>
      </div>
      
      <nav className="nav-list">
        {nav.map(item => 
          <button key={item.id} onClick={() => {setPage(item.id); setMobileNav(false);}} className={`nav-item ${page === item.id ? 'active' : ''}`}>
            <item.icon size={17}/>
            <span>{item.label}</span>
              {item.id === 'campaigns' && 
            <span className="nav-count">{campaigns.length}</span>}
          </button>)}
      </nav>
      
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
          <Campaigns
            campaigns={visibleCampaigns}
            query={query}
            setQuery={setQuery}
            campaignSort={campaignSort}
            setCampaignSort={setCampaignSort}
            active={active}
            setActiveId={setActiveId}
            onCopy={copyText}
            onExport={exportCampaign}
            onRemove={removeCampaign}
            setPage={setPage}
            thumbnailBusy={thumbnailBusy}
            thumbnailError={thumbnailError}
            onRegenerateThumbnail={generateThumbnail}
          />}
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

function Campaigns({
  campaigns,
  query,
  setQuery,
  campaignSort,
  setCampaignSort,
  active,
  setActiveId,
  onCopy,
  onExport,
  onRemove,
  setPage,
  thumbnailBusy,
  thumbnailError,
  onRegenerateThumbnail
}) {
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [thumbnailTextStyle, setThumbnailTextStyle] = useState({
    color: '#ffffff',
    background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.72), transparent 72%)'
  });
  const [textColorMode, setTextColorMode] = useState('auto');
  const [manualTextColor, setManualTextColor] = useState('#ffffff');
  const [overlayStrength, setOverlayStrength] = useState(72);
  const [textOutline, setTextOutline] = useState(true);
  const [headlineSize, setHeadlineSize] = useState('25px');
  const [headlineAlign, setHeadlineAlign] = useState('left');
  const [headlineWeight, setHeadlineWeight] = useState('700');
  const [headlineFont, setHeadlineFont] = useState('Space Grotesk');
  const [headlineText, setHeadlineText] = useState('');
  const [imageEditPrompt, setImageEditPrompt] = useState('');
  const [headlinePosition, setHeadlinePosition] = useState({ x: 8, y: 72 });
  const [exportPreset, setExportPreset] = useState('YouTube');
  const [settingsLoadedFor, setSettingsLoadedFor] = useState(null);
  const dragState = useRef(null);
  const thumbnailPreviewRef = useRef(null);

  useEffect(() => {
    if (!active?.id) {
      setSettingsLoadedFor(null);
      return;
    }

    let savedSettings = null;
    try {
      const allSettings = JSON.parse(localStorage.getItem('creatoros_thumbnail_settings_v1') || '{}');
      savedSettings = allSettings[active.id] || null;
    } catch (error) {
      console.warn('Could not read saved thumbnail settings:', error);
    }

    setHeadlineText(savedSettings?.headlineText ?? active.thumbnail ?? active.title ?? '');
    setHeadlinePosition(savedSettings?.headlinePosition ?? { x: 8, y: 72 });
    setExportPreset(savedSettings?.exportPreset ?? active.platform ?? 'YouTube');
    setHeadlineFont(savedSettings?.headlineFont ?? 'Space Grotesk');
    setHeadlineSize(savedSettings?.headlineSize ?? '25px');
    setHeadlineAlign(savedSettings?.headlineAlign ?? 'left');
    setHeadlineWeight(savedSettings?.headlineWeight ?? '700');
    setTextColorMode(savedSettings?.textColorMode ?? 'auto');
    setManualTextColor(savedSettings?.manualTextColor ?? '#ffffff');
    setOverlayStrength(savedSettings?.overlayStrength ?? 72);
    setTextOutline(savedSettings?.textOutline ?? true);
    setSettingsLoadedFor(active.id);
  }, [active?.id]);

  useEffect(() => {
    if (!active?.id || settingsLoadedFor !== active.id) return;
    const settings = {
      headlineText, headlinePosition, exportPreset, headlineFont, headlineSize,
      headlineAlign, headlineWeight, textColorMode, manualTextColor,
      overlayStrength, textOutline
    };
    try {
      const allSettings = JSON.parse(localStorage.getItem('creatoros_thumbnail_settings_v1') || '{}');
      allSettings[active.id] = settings;
      localStorage.setItem('creatoros_thumbnail_settings_v1', JSON.stringify(allSettings));
    } catch (error) {
      console.warn('Could not save thumbnail settings:', error);
    }
  }, [active?.id, settingsLoadedFor, headlineText, headlinePosition, exportPreset,
      headlineFont, headlineSize, headlineAlign, headlineWeight, textColorMode,
      manualTextColor, overlayStrength, textOutline]);

  function startHeadlineDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    dragState.current = { pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveHeadline(event) {
    if (!dragState.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setHeadlinePosition({
      x: Math.max(2, Math.min(78, x)),
      y: Math.max(5, Math.min(88, y))
    });
  }

  function stopHeadlineDrag() {
    dragState.current = null;
  }

  async function exportThumbnail() {
    if (!active?.thumbnailImage || !thumbnailPreviewRef.current) return;

    const image = new Image();
    image.src = active.thumbnailImage;

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('The thumbnail image could not be loaded.'));
        if (image.complete && image.naturalWidth) resolve();
      });

      const dimensions = {
        Instagram: [1080, 1350],
        YouTube: [1280, 720],
        LinkedIn: [1200, 627],
        TikTok: [1080, 1920],
        X: [1200, 675]
      }[exportPreset] || [1280, 720];
      const [canvasWidth, canvasHeight] = dimensions;
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not available in this browser.');

      // Match the preview's object-fit: cover image crop.
      const scale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.drawImage(
        image,
        (canvasWidth - drawWidth) / 2,
        (canvasHeight - drawHeight) / 2,
        drawWidth,
        drawHeight
      );

      // Draw the same bottom gradient controlled by the overlay slider.
      const overlayColor = thumbnailTextStyle.color === '#171717' ? '255, 255, 255' : '0, 0, 0';
      const gradient = context.createLinearGradient(0, canvasHeight, 0, canvasHeight * 0.28);
      gradient.addColorStop(0, `rgba(${overlayColor}, ${overlayStrength / 100})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      const previewWidth = thumbnailPreviewRef.current.getBoundingClientRect().width;
      const unit = canvasWidth / previewWidth;
      const headlineColor = textColorMode === 'manual' ? manualTextColor : thumbnailTextStyle.color;
      const fontSize = Number.parseFloat(headlineSize) * unit;
      const lineHeight = fontSize * 1.1;
      const left = (headlinePosition.x / 100) * canvasWidth;
      const top = (headlinePosition.y / 100) * canvasHeight;
      const maxTextWidth = canvasWidth * 0.84;
      const align = headlineAlign;
      const anchorX = align === 'center' ? left + maxTextWidth / 2 : align === 'right' ? left + maxTextWidth : left;

      // Small campaign label shown at the top of the preview.
      context.save();
      context.fillStyle = headlineColor;
      context.font = `${9 * unit}px monospace`;
      context.textAlign = 'left';
      context.fillText('THE BIG IDEA', 16 * unit, 25 * unit);
      context.restore();

      // Wrap the headline to the same 84% text area used in the preview.
      if (document.fonts?.load) {
        await document.fonts.load(`${headlineWeight} ${fontSize}px '${headlineFont}'`);
      }
      context.save();
      context.font = `${headlineWeight} ${fontSize}px '${headlineFont}', sans-serif`;
      context.textAlign = align;
      context.textBaseline = 'top';
      context.lineJoin = 'round';
      const words = (headlineText || '').split(/\s+/).filter(Boolean);
      const lines = [];
      let currentLine = '';
      words.forEach(word => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (currentLine && context.measureText(candidate).width > maxTextWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = candidate;
        }
      });
      if (currentLine) lines.push(currentLine);

      const isDarkHeadline = (() => {
        const hex = headlineColor.replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
      })();
      if (textOutline) {
        context.strokeStyle = isDarkHeadline ? 'rgba(255,255,255,.95)' : 'rgba(0,0,0,.95)';
        context.lineWidth = Math.max(1.5 * unit, 1);
        context.shadowColor = isDarkHeadline ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.9)';
        context.shadowBlur = 2 * unit;
      }
      context.fillStyle = headlineColor;
      lines.forEach((line, index) => {
        const y = top + index * lineHeight;
        if (textOutline) context.strokeText(line, anchorX, y, maxTextWidth);
        context.fillText(line, anchorX, y, maxTextWidth);
      });
      context.restore();

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export could not be created.');
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (active.title || 'creatoros-thumbnail').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
      link.href = downloadUrl;
      link.download = `${safeName || 'creatoros-thumbnail'}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Thumbnail PNG export failed:', error);
      window.alert(error.message || 'Could not export the thumbnail. Please try again.');
    }
  }

  useEffect(() => { setEditing(false); setEditCaption(active?.caption || ''); }, [active?.id]);

  useEffect(() => {
    const imageSource = active?.thumbnailImage;

    if (!imageSource) {
      setThumbnailTextStyle({
        color: '#ffffff',
        background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.72), transparent 72%)'
      });
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;

        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas is unavailable.');

        context.drawImage(image, 0, 0, 40, 40);

        // Sample the image area underneath the current headline position.
        const sampleX = Math.max(0, Math.min(24, Math.round((headlinePosition.x / 100) * 40)));
        const sampleY = Math.max(0, Math.min(28, Math.round((headlinePosition.y / 100) * 40)));
        const sampleWidth = Math.min(16, 40 - sampleX);
        const sampleHeight = Math.min(12, 40 - sampleY);
        const pixels = context.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;
        let totalLuminance = 0;
        let samples = 0;

        const linearize = value =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index] / 255;
          const green = pixels[index + 1] / 255;
          const blue = pixels[index + 2] / 255;

          totalLuminance +=
            0.2126 * linearize(red) +
            0.7152 * linearize(green) +
            0.0722 * linearize(blue);
          samples += 1;
        }

        const averageLuminance = samples ? totalLuminance / samples : 0;
        const useDarkText = averageLuminance > 0.5;

        setThumbnailTextStyle(
          useDarkText
            ? {
                color: '#171717',
                background: 'linear-gradient(0deg, rgba(255, 255, 255, 0.82), transparent 78%)'
              }
            : {
                color: '#ffffff',
                background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.76), transparent 72%)'
              }
        );
      } catch (error) {
        console.warn('Could not analyse thumbnail contrast:', error);
        setThumbnailTextStyle({
          color: '#ffffff',
          background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.72), transparent 72%)'
        });
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setThumbnailTextStyle({
          color: '#ffffff',
          background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.72), transparent 72%)'
        });
      }
    };

    image.src = imageSource;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [active?.thumbnailImage, headlinePosition.x, headlinePosition.y]);
  return <div className="campaign-page">
    <div className="page-title-row"><div><span className="eyebrow">02 / YOUR CONTENT LIBRARY</span><h1>Ideas in motion<span className="title-period">.</span></h1><p>Your ideas, organized. Your next post, closer than ever.</p></div><button className="primary-btn" onClick={() => setPage('studio')}><Plus size={17}/> New campaign</button></div>
    <div className="campaign-toolbar">
      <div className="campaign-tools-left">
        <div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search campaigns..."/></div>
        <label className="campaign-sort"><span>Sort by</span><select value={campaignSort} onChange={e=>setCampaignSort(e.target.value)} aria-label="Sort campaigns"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="sequence">Generation order</option><option value="title">Title A–Z</option></select></label>
      </div>
      <span className="campaign-count">{campaigns.length} CAMPAIGNS</span>
    </div>
    {active ? <section className="campaign-detail">
      <div className="detail-top"><button className="back-link" onClick={()=>setActiveId(null)}>← All campaigns</button><span className="status-pill"><span/> {active.status || 'Draft'}</span></div>
      <div className="detail-heading"><div><span className="eyebrow">{active.platform} CAMPAIGN</span><h2>{active.title}</h2><p>{active.topic}</p></div><div className="detail-actions"><button className="outline-btn" onClick={()=>onExport(active, exportPreset)}><Download size={15}/> Export</button><button className="icon-btn danger-btn" onClick={()=>onRemove(active.id)} title="Delete campaign"><X size={17}/></button></div></div>
      <section className="campaign-overview">
        <div className="overview-heading"><div><span className="eyebrow">CAMPAIGN SNAPSHOT</span><h3>Campaign overview</h3></div><span className="overview-number">#{String(active.campaignNumber || 1).padStart(3, '0')}</span></div>
        <p className="overview-topic">{active.topic || 'No topic description available.'}</p>
        <div className="overview-meta">
          <div><span>PLATFORM</span><strong>{active.platform || 'Not set'}</strong></div>
          <div><span>TARGET AUDIENCE</span><strong>{active.audience || 'General audience'}</strong></div>
          <div><span>CAMPAIGN GOAL</span><strong>{active.goal || 'Not specified'}</strong></div>
          <div><span>TONE</span><strong>{active.tone || 'Not specified'}</strong></div>
        </div>
      </section>
      <div className="output-grid">
        <OutputCard number="01" title="Hooks that stop the scroll" icon={<Flame size={17}/>}><div className="hook-list">{(active.hooks||[]).map((h,i)=><div className="hook-item" key={i}><span>0{i+1}</span><p>{h}</p><button className="tiny-copy" onClick={()=>onCopy(h)} aria-label="Copy hook"><Copy size={14}/></button></div>)}</div></OutputCard>
        <OutputCard number="02" title="Caption / post copy" icon={<MessageSquareText size={17}/>}><div className="caption-editor">{editing?<textarea value={editCaption} onChange={e=>setEditCaption(e.target.value)} rows={6}/>:<p>{active.caption}</p>}<div className="caption-actions"><button className="text-btn" onClick={()=>{if(editing){active.caption=editCaption;setEditing(false);onCopy(editCaption);}else{setEditCaption(active.caption||'');setEditing(true)}}}>{editing?'Save & copy':'Edit caption'}</button><button className="tiny-copy" onClick={()=>onCopy(editing?editCaption:active.caption)}><Copy size={14}/></button></div></div></OutputCard>
        <OutputCard number="03" title="Content angles" icon={<Grid2X2 size={17}/>}><ul className="idea-list">{(active.ideas||[]).map((x,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span>{x}</li>)}</ul></OutputCard>
        <OutputCard number="04" title="Call to action" icon={<Zap size={17}/>}>
          <div className="cta-card-content"><span className="cta-label">YOUR NEXT STEP FOR THE AUDIENCE</span><p>{active.cta || 'No call to action was generated for this campaign.'}</p><button className="text-btn" onClick={()=>onCopy(active.cta || '')} disabled={!active.cta}><Copy size={14}/> Copy CTA</button></div>
        </OutputCard>
        <OutputCard number="05" title="Thumbnail / cover direction" icon={<Instagram size={17}/>}>
          {thumbnailBusy && (
            <div className="thumbnail-status">
              <LoaderCircle size={16} className="spin" />
              <span>Generating thumbnail... Please wait.</span>
            </div>
          )}

          {thumbnailError && (
            <div className="error-message">
              Thumbnail generation failed: {thumbnailError}
            </div>
          )}

          <div className="thumbnail-image-prompt">
            <label className="thumbnail-control" htmlFor="thumbnail-image-prompt">
              <span>Change the image with a prompt</span>
              <textarea
                id="thumbnail-image-prompt"
                value={imageEditPrompt}
                onChange={event => setImageEditPrompt(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Example: Replace the dark room with a bright modern studio, keep the person on the right, and leave clean space for the headline."
              />
            </label>
            <button
              className="outline-btn thumbnail-regenerate-btn"
              disabled={thumbnailBusy || imageEditPrompt.trim().length < 4}
              onClick={() => {
                onRegenerateThumbnail(active, imageEditPrompt.trim());
                setImageEditPrompt('');
              }}
            >
              <WandSparkles size={14} />
              {thumbnailBusy ? 'Generating...' : 'Generate image change'}
            </button>
            <p className="thumbnail-prompt-note">
              This creates a new image using your instruction and campaign details; it does not edit individual pixels of the existing image.
            </p>
          </div>

          <div className="thumbnail-color-controls">
            <label className="thumbnail-control">
              <span>Text colour mode</span>
              <select value={textColorMode} onChange={event => setTextColorMode(event.target.value)}>
                <option value="auto">Automatic contrast</option>
                <option value="manual">Manual colour</option>
              </select>
            </label>
            {textColorMode === 'manual' && (
              <label className="thumbnail-control thumbnail-color-picker">
                <span>Choose text colour</span>
                <input
                  type="color"
                  value={manualTextColor}
                  onChange={event => setManualTextColor(event.target.value)}
                  aria-label="Choose headline text colour"
                />
              </label>
            )}
          </div>

          <div className="thumbnail-finish-controls">
            <label className="thumbnail-control thumbnail-overlay-control">
              <span>Background overlay: {overlayStrength}%</span>
              <input type="range" min="0" max="90" step="5" value={overlayStrength}
                onChange={event => setOverlayStrength(Number(event.target.value))} />
            </label>
            <label className="thumbnail-outline-toggle">
              <input type="checkbox" checked={textOutline}
                onChange={event => setTextOutline(event.target.checked)} />
              <span>Text outline for readability</span>
            </label>
          </div>

          <div className="thumbnail-editor-fields">
            <label className="thumbnail-control thumbnail-headline-field">
              <span>Headline text</span>
              <input
                value={headlineText}
                onChange={event => setHeadlineText(event.target.value)}
                maxLength={100}
                placeholder="Enter thumbnail headline"
              />
            </label>
            <label className="thumbnail-control">
              <span>Font style</span>
              <select value={headlineFont} onChange={event => setHeadlineFont(event.target.value)}>
                <option value="Space Grotesk">Space Grotesk</option>
                <option value="Inter">Inter</option>
                <option value="DM Sans">DM Sans</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Manrope">Manrope</option>
                <option value="Outfit">Outfit</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Oswald">Oswald</option>
                <option value="Lora">Lora</option>
                <option value="Archivo Black">Archivo Black</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Forte">Forte</option>
                <option value="Ink Free">Ink Free</option>
                <option value="Impact">Impact</option>
                <option value="Rockwell">Rockwell</option>
              </select>
            </label>
          </div>

          <div className="thumbnail-controls">
            <label className="thumbnail-control">
              <span>Text size</span>
              <select value={headlineSize} onChange={event => setHeadlineSize(event.target.value)}>
                <option value="20px">Small</option>
                <option value="25px">Medium</option>
                <option value="32px">Large</option>
              </select>
            </label>
            <label className="thumbnail-control">
              <span>Alignment</span>
              <select value={headlineAlign} onChange={event => setHeadlineAlign(event.target.value)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="thumbnail-control">
              <span>Weight</span>
              <select value={headlineWeight} onChange={event => setHeadlineWeight(event.target.value)}>
                <option value="600">Semi-bold</option>
                <option value="700">Bold</option>
                <option value="800">Extra-bold</option>
              </select>
            </label>
          </div>

          <label className="thumbnail-control thumbnail-export-preset">
            <span>Export format</span>
            <select value={exportPreset} onChange={event => setExportPreset(event.target.value)}>
              <option value="Instagram">Instagram Post · 1080 × 1350</option>
              <option value="YouTube">YouTube Thumbnail · 1280 × 720</option>
              <option value="LinkedIn">LinkedIn · 1200 × 627</option>
              <option value="TikTok">TikTok · 1080 × 1920</option>
              <option value="X">X · 1200 × 675</option>
            </select>
          </label>

          <div
            className="thumbnail-preview"
            ref={thumbnailPreviewRef}
            onPointerMove={moveHeadline}
            onPointerUp={stopHeadlineDrag}
            onPointerCancel={stopHeadlineDrag}
            style={{
              aspectRatio: {
                Instagram: '4 / 5',
                YouTube: '16 / 9',
                LinkedIn: '1200 / 627',
                TikTok: '9 / 16',
                X: '16 / 9'
              }[exportPreset] || '16 / 9'
            }}
          >
            {active.thumbnailImage ? (
              <img
                className="thumbnail-background"
                src={active.thumbnailImage}
                alt="Generated thumbnail background"
              />
            ) : (
              <div className="thumbnail-placeholder">
                {thumbnailBusy ? 'Creating your thumbnail...' : 'Thumbnail not available'}
              </div>
            )}

            <div
              className="thumbnail-overlay"
              style={{
                color: textColorMode === 'manual'
                  ? manualTextColor
                  : thumbnailTextStyle.color,
                background: `linear-gradient(
                  0deg,
                  ${thumbnailTextStyle.color === '#171717'
                    ? `rgba(255, 255, 255, ${overlayStrength / 100})`
                    : `rgba(0, 0, 0, ${overlayStrength / 100})`},
                  transparent 72%
                )`
              }}
            >
              <span>THE BIG IDEA</span>
              <strong
                style={{
                  fontSize: headlineSize,
                  fontWeight: headlineWeight,
                  fontFamily: `'${headlineFont}', sans-serif`,
                  textAlign: headlineAlign,
                  color: textColorMode === 'manual' ? manualTextColor : thumbnailTextStyle.color,
                  position: 'absolute',
                  left: `${headlinePosition.x}%`,
                  top: `${headlinePosition.y}%`,
                  width: '84%',
                  maxWidth: '84%',
                  cursor: 'grab',
                  touchAction: 'none',
                  userSelect: 'none',
                  textShadow: !textOutline
                    ? 'none'
                    : thumbnailTextStyle.color === '#171717' && textColorMode === 'auto'
                      ? '0 0 2px rgba(255,255,255,.95), 1px 1px 2px rgba(255,255,255,.95)'
                      : '0 0 2px rgba(0,0,0,.95), 1px 1px 2px rgba(0,0,0,.95), -1px -1px 2px rgba(0,0,0,.95)'
                }}
                onPointerDown={startHeadlineDrag}
                title="Drag to reposition headline"
              >
                {headlineText}
              </strong>
            </div>
          </div>

          <button
            className="outline-btn thumbnail-download-btn"
            onClick={exportThumbnail}
            disabled={!active.thumbnailImage}
          >
            <Download size={14} /> Download PNG
          </button>

          <button
            className="text-btn copy-direction"
            onClick={() => onCopy(active.thumbnail || active.title)}
          >
            <Copy size={14}/> Copy thumbnail text
          </button>
        </OutputCard>   
      </div>
      <div className="detail-bottom"><span><Clock3 size={14}/> Created {new Date(active.createdAt).toLocaleString()}</span><button className="primary-btn" onClick={()=>onExport(active, exportPreset)}><Download size={16}/> Export campaign</button></div>
    </section> : campaigns.length ? <div className="campaign-grid">{campaigns.map((c,i)=><button className="campaign-tile" key={c.id} onClick={()=>setActiveId(c.id)}><div className={`tile-art tile-art-${i%5}`}><span>{c.platform}</span><span className="tile-number">{String(c.campaignNumber || 1).padStart(3,'0')}</span><strong>{c.thumbnail || c.title}</strong></div><div className="tile-meta"><div><h3>{c.title}</h3><p>{c.topic}</p></div><ArrowDownRight size={18}/></div><div className="tile-foot"><span>{new Date(c.createdAt).toLocaleDateString()}</span><span className="status-pill"><span/>{c.status||'Draft'}</span></div></button>)}</div> : <div className="empty-state"><div className="empty-icon"><Bookmark size={24}/></div><h2>No campaigns found.</h2><p>Try a different search or start a fresh idea.</p><button className="primary-btn" onClick={()=>setPage('studio')}><Plus size={16}/> Create your first campaign</button></div>}
    <div className="library-note"><Sparkles size={15}/> Campaigns are saved in this browser for now. Cloud sync and accounts are planned for a later build.</div>
  </div>;
}
function OutputCard({number,title,icon,children}) { return <section className="output-card"><div className="output-head"><span className="output-number">{number}</span><span className="output-icon">{icon}</span><h3>{title}</h3></div>{children}</section> }
createRoot(document.getElementById('root')).render(<App/>);
