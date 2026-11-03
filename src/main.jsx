import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight, ArrowRight, Bookmark, Check, ChevronDown, CircleHelp,
  Clock3, Copy, Download, Flame, Grid2X2, Instagram, LayoutDashboard,
  Lightbulb, LoaderCircle, Menu, MessageSquareText, Plus, Search, Settings2,
  Sparkles, WandSparkles, X, Youtube, Zap
} from 'lucide-react';
import './styles.css';
import { supabase } from './lib/supabase';

const STORAGE_KEY = 'creatoros_campaigns_v1';
const MIGRATION_KEY = 'creatoros_cloud_migration_v1';
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
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudOwnerId, setCloudOwnerId] = useState(null);
  const cloudSyncQueue = useRef(Promise.resolve());
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
  const [page, setPage] = useState('landing');
  const [mobileNav, setMobileNav] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [publicCampaignCount, setPublicCampaignCount] = useState(null);
  const [publicCampaignCountError, setPublicCampaignCountError] = useState(false);

  useEffect(() => {
    if (page !== 'landing') return;
    let cancelled = false;

    async function loadPublicCampaignCount() {
      setPublicCampaignCountError(false);
      const { data, error } = await supabase.rpc('get_public_campaign_count');
      if (cancelled) return;
      if (error || !Number.isFinite(Number(data))) {
        console.error('Could not load public campaign count:', error);
        setPublicCampaignCountError(true);
        return;
      }
      setPublicCampaignCount(Number(data));
    }

    loadPublicCampaignCount();
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError(error.message);
      const restoredSession = data?.session ?? null;
      setSession(restoredSession);
      // Restore the last workspace location for this account after a refresh.
      if (restoredSession) {
        let savedLocation = null;
        try {
          savedLocation = JSON.parse(sessionStorage.getItem(`creatoros_workspace_state_${restoredSession.user.id}`) || 'null');
        } catch { /* Ignore invalid saved navigation state. */ }
        setPage(savedLocation?.page === 'campaigns' ? 'campaigns' : 'studio');
      } else {
        setPage('landing');
      }
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthError('');
      if (event === 'SIGNED_IN') {
        if (nextSession) setPage('studio');
      } else if (event === 'SIGNED_OUT') {
        setPage('landing');
      }
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Load only the signed-in user's campaigns. On the first account using this
  // browser, migrate the existing local campaign library once.
  useEffect(() => {
    let cancelled = false;

    async function loadUserCampaigns() {
      if (authLoading) return;
      if (!session?.user?.id) {
        setCampaigns([]);
        setCloudReady(false);
        setCloudOwnerId(null);
        setCampaignsLoading(false);
        return;
      }

      setCampaignsLoading(true);
      setCloudReady(false);
      setCloudOwnerId(null);

      try {
        const { data: rows, error: fetchError } = await supabase
          .from('campaigns')
          .select('campaign_id, campaign_data')
          .eq('user_id', session.user.id);

        if (fetchError) throw fetchError;

        let userCampaigns = (rows || [])
          .map(row => row.campaign_data)
          .filter(campaign => campaign && typeof campaign === 'object' && campaign.id);

        const migrationDone = localStorage.getItem(MIGRATION_KEY) === 'done';
        if (!migrationDone && userCampaigns.length === 0) {
          let localCampaigns = [];
          try {
            localCampaigns = readCampaigns().filter(campaign => !String(campaign.id).startsWith('sample-'));
          } catch (parseError) {
            console.warn('Could not read local campaigns for migration:', parseError);
          }

          if (localCampaigns.length) {
            const migrationRows = localCampaigns.map(campaign => ({
              user_id: session.user.id,
              campaign_id: String(campaign.id),
              campaign_data: campaign
            }));
            const { error: migrationError } = await supabase
              .from('campaigns')
              .upsert(migrationRows, { onConflict: 'user_id,campaign_id' });
            if (migrationError) throw migrationError;
            userCampaigns = localCampaigns;
          }
          localStorage.setItem(MIGRATION_KEY, 'done');
        } else if (!migrationDone) {
          // Existing cloud data is authoritative; don't import another user's
          // browser-local cache into this account.
          localStorage.setItem(MIGRATION_KEY, 'done');
        }

        // Campaign numbering belongs to the signed-in account, not the browser.
        // Normalize legacy numbers that may have been generated by a shared
        // localStorage counter before cloud storage was introduced.
        userCampaigns = [...userCampaigns]
          .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
          .map((campaign, index) => ({ ...campaign, campaignNumber: index + 1 }));

        if (!cancelled) {
          setCampaigns(userCampaigns);
          let savedLocation = null;
          try {
            savedLocation = JSON.parse(sessionStorage.getItem(`creatoros_workspace_state_${session.user.id}`) || 'null');
          } catch { /* Ignore invalid saved navigation state. */ }
          const restoredActiveId = savedLocation?.activeId;
          setActiveId(restoredActiveId && userCampaigns.some(campaign => campaign.id === restoredActiveId) ? restoredActiveId : null);
          setCloudOwnerId(session.user.id);
          setCloudReady(true);
        }
      } catch (loadError) {
        console.error('Campaign cloud load failed:', loadError);
        if (!cancelled) {
          setError(`Could not load your cloud campaigns: ${loadError.message}`);
          setCampaigns([]);
        }
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    }

    loadUserCampaigns();
    return () => { cancelled = true; };
  }, [session?.user?.id, authLoading]);

  // Keep the current workspace location across refreshes, scoped to this account.
  useEffect(() => {
    if (!cloudReady || !session?.user?.id || cloudOwnerId !== session.user.id) return;
    try {
      sessionStorage.setItem(`creatoros_workspace_state_${session.user.id}`, JSON.stringify({
        page: page === 'campaigns' ? 'campaigns' : 'studio',
        activeId
      }));
    } catch (storageError) {
      console.warn('Could not save workspace location:', storageError);
    }
  }, [page, activeId, cloudReady, cloudOwnerId, session?.user?.id]);

  // Persist each signed-in user's complete campaign list. The queue prevents
  // overlapping saves from an older render overwriting a newer edit.
  useEffect(() => {
    if (!cloudReady || !session?.user?.id || cloudOwnerId !== session.user.id) return;
    const userId = session.user.id;
    const snapshot = campaigns.map(campaign => ({ ...campaign }));

    cloudSyncQueue.current = cloudSyncQueue.current
      .catch(() => {})
      .then(async () => {
        const rows = snapshot.map(campaign => ({
          user_id: userId,
          campaign_id: String(campaign.id),
          campaign_data: campaign
        }));

        if (rows.length) {
          const { error: saveError } = await supabase
            .from('campaigns')
            .upsert(rows, { onConflict: 'user_id,campaign_id' });
          if (saveError) throw saveError;
        }

        const { data: existingRows, error: listError } = await supabase
          .from('campaigns')
          .select('campaign_id')
          .eq('user_id', userId);
        if (listError) throw listError;

        const keepIds = new Set(snapshot.map(campaign => String(campaign.id)));
        const staleIds = (existingRows || [])
          .map(row => row.campaign_id)
          .filter(id => !keepIds.has(String(id)));

        if (staleIds.length) {
          const { error: deleteError } = await supabase
            .from('campaigns')
            .delete()
            .eq('user_id', userId)
            .in('campaign_id', staleIds);
          if (deleteError) throw deleteError;
        }
      })
      .catch(syncError => {
        console.error('Campaign cloud sync failed:', syncError);
        setError(`Cloud save failed: ${syncError.message}`);
      });
  }, [campaigns, cloudReady, cloudOwnerId, session?.user?.id]);
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
  async function submitAuth(email, password, displayName) {
    setAuthBusy(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || email.trim().split('@')[0] } }
        });
        if (error) throw error;
        if (data.session) {
          setPage('studio');
          flash('Account created successfully.');
        } else {
          setAuthError('Account created. Check your email to confirm your address, then log in.');
          setAuthMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        setPage('studio');
        flash('Welcome back.');
      }
    } catch (error) {
      setAuthError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      flash(error.message || 'Could not sign out.');
      return;
    }
    setPage('landing');
    setActiveId(null);
    flash('Signed out.');
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
      // The sequence is derived only from this authenticated user's campaigns.
      const nextCampaignNumber =
        campaigns.reduce((highest, item) => Math.max(highest, Number(item.campaignNumber) || 0), 0) + 1;
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
  function updateCampaign(id, updates) {
    setCampaigns(previous => previous.map(campaign =>
      campaign.id === id ? { ...campaign, ...updates } : campaign
    ));
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

  if (authLoading || (session && campaignsLoading)) {
    return <div className="auth-loading-screen"><div className="auth-loading-mark"><Zap size={22} fill="currentColor" /></div><p>Loading your private workspace…</p></div>;
  }

  if (page === 'auth' || (!session && page !== 'landing')) {
    return <AuthPage
      mode={authMode}
      setMode={(mode) => { setAuthMode(mode); setAuthError(''); }}
      onSubmit={submitAuth}
      busy={authBusy}
      error={authError}
      onBack={() => { setPage('landing'); setAuthError(''); }}
    />;
  }

  if (page === 'landing') {
    return <Landing
      campaignCount={publicCampaignCount}
      campaignCountError={publicCampaignCountError}
      onEnter={() => { setAuthMode('signup'); setAuthError(''); setPage(session ? 'studio' : 'auth'); }}
      onLogin={() => { setAuthMode('login'); setAuthError(''); setPage(session ? 'studio' : 'auth'); }}
    />;
  }

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
        <div className="profile-row"><div className="profile-avatar">{(session?.user?.user_metadata?.display_name || session?.user?.email || 'C').slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{session?.user?.user_metadata?.display_name || 'Creator workspace'}</strong><small>{session?.user?.email || 'Signed in'}</small></div><button className="signout-btn" onClick={signOut} title="Sign out">↗</button></div>
      </div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page === 'studio' ? 'Idea studio' : 'My campaigns'}</strong></div><div className="topbar-right"><div className="ai-status"><span/> AI workspace</div><div className="top-avatar" title={session?.user?.email || 'Signed in'}>{(session?.user?.user_metadata?.display_name || session?.user?.email || 'C').slice(0,1).toUpperCase()}</div></div></header>
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
            onUpdateCampaign={updateCampaign}
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


function AuthPage({ mode, setMode, onSubmit, busy, error, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(email, password, displayName);
  }

  return <main className="auth-shell">
    <div className="auth-aurora auth-aurora-a" />
    <div className="auth-aurora auth-aurora-b" />
    <button className="auth-back" onClick={onBack}>← Back to CreatorOS</button>
    <section className="auth-card">
      <div className="auth-brand-mark"><Zap size={22} fill="currentColor" /></div>
      <span className="auth-eyebrow">CREATOROS AI / YOUR CREATIVE WORKSPACE</span>
      <h1>{mode === 'signup' ? 'Create your account.' : 'Welcome back.'}</h1>
      <p>{mode === 'signup' ? 'Set up your account and start turning ideas into campaigns.' : 'Sign in to continue building your next campaign.'}</p>
      <form onSubmit={handleSubmit}>
        {mode === 'signup' && <label className="auth-field"><span>NAME</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" placeholder="Your name" maxLength={80} /></label>}
        <label className="auth-field"><span>EMAIL ADDRESS</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
        <label className="auth-field"><span>PASSWORD</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required placeholder="At least 6 characters" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account →' : 'Log in →'}</button>
      </form>
      <div className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to CreatorOS?'} <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Log in' : 'Create an account'}</button></div>
      <div className="auth-security-note">Your account is secured by Supabase authentication.</div>
    </section>
  </main>;
}

function Landing({ onEnter, onLogin, campaignCount, campaignCountError }) {
  return <div className="landing-shell">
    <div className="landing-aurora landing-aurora-one" />
    <div className="landing-aurora landing-aurora-two" />
    <nav className="landing-nav">
      <a className="landing-brand" href="#top" aria-label="CreatorOS AI home">
        <span className="landing-brand-mark"><Zap size={19} fill="currentColor" /></span>
        <span>creator<span>OS</span><sup>AI</sup></span>
      </a>
      <div className="landing-nav-links">
        <a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#showcase">Product</a>
      </div>
      <div className="landing-nav-actions">
        <button className="landing-login" onClick={onLogin}>Log in</button>
        <button className="landing-nav-cta" onClick={onEnter}>Get started <ArrowRight size={15}/></button>
      </div>
    </nav>

    <main id="top">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span className="landing-live-dot"/> YOUR IDEAS, IN MOTION <span className="landing-eyebrow-line"/></div>
          <h1>Turn one idea into a <span>whole campaign.</span></h1>
          <p className="landing-hero-description">A creative workspace for people who make things. Build campaign angles, write platform-ready content and design scroll-stopping thumbnails—all in one flow.</p>
          <div className="landing-hero-actions"><button className="landing-primary" onClick={onEnter}>Create your first campaign <ArrowRight size={17}/></button><a className="landing-secondary" href="#showcase">Explore the workspace <ArrowDownRight size={16}/></a></div>
          <div className="landing-proof"><div className="landing-proof-avatars"><span>C</span><span>✳</span><span>OS</span></div><span>From first thought to publish-ready direction.</span></div>
        </div>
        <div className="landing-hero-visual" aria-label="CreatorOS campaign workspace preview">
          <div className="landing-orbit orbit-one"/><div className="landing-orbit orbit-two"/>
          <div className="landing-preview-window">
            <div className="landing-preview-top"><div className="landing-window-dots"><i/><i/><i/></div><span>CREATOROS / CAMPAIGN STUDIO</span><span className="landing-preview-status"><b/> LIVE WORKSPACE</span></div>
            <div className="landing-preview-body">
              <div className="landing-preview-sidebar"><div className="landing-mini-logo"><Zap size={14} fill="currentColor"/></div><i/><i/><i/><i/></div>
              <div className="landing-preview-main"><div className="landing-preview-kicker">CAMPAIGN OVERVIEW <span>01 / 04</span></div><h3>Make your next<br/><em>big idea</em> count.</h3><p>One clear idea. A complete content direction.</p>
                <div className="landing-preview-tags"><span>Instagram</span><span>Awareness</span><span>Educational</span></div>
                <div className="landing-preview-output"><div><small>01 / HOOK</small><strong>Your next big idea starts here.</strong></div><div><small>02 / CONTENT ANGLE</small><strong>Turn a simple insight into a story.</strong></div><div><small>03 / CREATIVE</small><strong>Thumbnail direction generated <Sparkles size={13}/></strong></div></div>
              </div>
              <div className="landing-preview-float"><span className="landing-float-icon"><Sparkles size={16}/></span><div><small>CREATIVE MOMENTUM</small><strong>Idea → Campaign</strong></div><span className="landing-float-check"><Check size={14}/></span></div>
            </div>
          </div>
          <div className="landing-glass-chip chip-top"><span className="chip-pulse"/> AI-powered workflow</div>
          <div className="landing-glass-chip chip-bottom"><WandSparkles size={15}/> Made for makers</div>
        </div>
      </section>

      <section className="landing-trust-strip"><span>ONE WORKSPACE</span><i/> <span>MORE CREATIVE CLARITY</span><i/> <span>LESS STARTING FROM ZERO</span><i/> <span>BUILT FOR THE NEXT BIG IDEA</span></section>

      <section className="landing-community-count" aria-live="polite"><div className="landing-community-count-inner"><span className="landing-section-label">THE CREATOROS COMMUNITY</span><strong>{campaignCountError ? '—' : campaignCount === null ? '…' : campaignCount.toLocaleString('en-IN')}</strong><p>campaigns generated by creators using CreatorOS AI</p></div></section>

      <section className="landing-section" id="features"><div className="landing-section-heading"><span className="landing-section-label">THE CREATOROS TOOLKIT / 01</span><h2>Everything you need to<br/><span>move an idea forward.</span></h2><p>Skip the scattered tabs and disconnected tools. Keep the thinking, writing and visual direction connected.</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card feature-large"><div className="feature-card-top"><span>01 / STRATEGY</span><span className="feature-icon"><Lightbulb size={18}/></span></div><div className="feature-visual feature-strategy"><div className="strategy-orb"/><div className="strategy-lines"><i/><i/><i/></div><span className="strategy-label">IDEA → IMPACT</span></div><h3>Campaigns with a clear direction.</h3><p>Turn a rough topic into a focused campaign with hooks, captions, calls to action and content angles.</p></article>
          <article className="landing-feature-card"><div className="feature-card-top"><span>02 / CONTENT</span><span className="feature-icon"><MessageSquareText size={18}/></span></div><div className="feature-visual feature-content"><div className="content-sheet"><small>YOUR CAPTION</small><b>Start with a hook<br/>worth stopping for.</b><i/><i/><i/></div><span className="content-spark"><Sparkles size={18}/></span></div><h3>Copy you can make your own.</h3><p>Generate platform-aware hooks and captions, then edit and copy what works.</p></article>
          <article className="landing-feature-card"><div className="feature-card-top"><span>03 / DESIGN</span><span className="feature-icon"><WandSparkles size={18}/></span></div><div className="feature-visual feature-design"><div className="design-image"><span>MAKE<br/>IT<br/><b>MATTER.</b></span></div><div className="design-controls"><i/><i/><i/></div></div><h3>Visuals that complete the story.</h3><p>Create thumbnail backgrounds and refine headline style, placement, colour and export format.</p></article>
        </div>
      </section>

      <section className="landing-workflow" id="how-it-works"><div className="workflow-heading"><span className="landing-section-label">A SIMPLE CREATIVE FLOW / 02</span><h2>From blank page<br/>to <span>next move.</span></h2><p>Keep momentum without overcomplicating the process.</p></div><div className="workflow-steps"><div className="workflow-step"><span>01</span><div className="workflow-step-icon"><Lightbulb size={20}/></div><h3>Bring the idea</h3><p>Start with a topic, audience, platform and goal.</p></div><div className="workflow-connector"><ArrowRight size={18}/></div><div className="workflow-step"><span>02</span><div className="workflow-step-icon"><Sparkles size={20}/></div><h3>Shape the campaign</h3><p>Generate hooks, captions, content angles and a clear CTA.</p></div><div className="workflow-connector"><ArrowRight size={18}/></div><div className="workflow-step"><span>03</span><div className="workflow-step-icon"><Download size={20}/></div><h3>Make it yours</h3><p>Edit your copy, design the thumbnail and export your work.</p></div></div></section>

      <section className="landing-showcase" id="showcase"><div className="showcase-copy"><span className="landing-section-label">INSIDE THE WORKSPACE / 03</span><h2>Your creative process,<br/><span>all in one place.</span></h2><p>Organize campaigns, revisit ideas and refine the details before you publish. CreatorOS keeps the workflow focused on making—not managing more tools.</p><ul><li><Check size={15}/> Save and revisit campaign drafts</li><li><Check size={15}/> Customize thumbnail typography and layout</li><li><Check size={15}/> Export campaign briefs and PNG thumbnails</li></ul><button className="landing-primary" onClick={onEnter}>Explore CreatorOS <ArrowRight size={17}/></button></div><div className="showcase-art"><div className="showcase-glow"/><div className="showcase-card showcase-back"><span>MY CAMPAIGNS</span><i/><i/><i/></div><div className="showcase-card showcase-front"><div className="showcase-card-head"><span>THUMBNAIL EDITOR</span><span>● READY</span></div><div className="showcase-thumbnail"><span>MAKE<br/><b>IT</b><br/>MATTER.</span><small>THE BIG IDEA</small></div><div className="showcase-tools"><i/><i/><i/><i/></div></div><div className="showcase-badge"><Check size={14}/> Ready to export</div></div></section>

      <section className="landing-final-cta"><div className="final-cta-glow"/><span className="landing-section-label">YOUR NEXT BIG IDEA IS WAITING</span><h2>Make something<br/><span>that matters.</span></h2><p>Start with one idea. See where you can take it.</p><button className="landing-primary" onClick={onEnter}>Start creating <ArrowRight size={17}/></button><div className="final-cta-star">✳</div></section>
    </main>
    <footer className="landing-footer"><a className="landing-brand" href="#top"><span className="landing-brand-mark"><Zap size={17} fill="currentColor"/></span><span>creator<span>OS</span><sup>AI</sup></span></a><span>CREATOROS AI · BUILT FOR THE NEXT BIG IDEA</span><a href="#top">Back to top ↑</a></footer>
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
  onUpdateCampaign,
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
  const [headlineSize, setHeadlineSize] = useState('19');
  const [headlineAlign, setHeadlineAlign] = useState('left');
  const [headlineWeight, setHeadlineWeight] = useState('700');
  const [headlineFont, setHeadlineFont] = useState('Space Grotesk');
  const [headlineText, setHeadlineText] = useState('');
  const [imageEditPrompt, setImageEditPrompt] = useState('');
  const [headlinePosition, setHeadlinePosition] = useState({ x: 8, y: 72 });
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
    setHeadlineFont(savedSettings?.headlineFont ?? 'Space Grotesk');
    const savedSize = savedSettings?.headlineSize;
    const normalizedSize = savedSize == null
      ? '19'
      : String(savedSize).endsWith('px')
        ? String(Number.parseFloat(savedSize) * 0.75)
        : String(savedSize);
    setHeadlineSize(normalizedSize);
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
      headlineText, headlinePosition, headlineFont, headlineSize,
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
  }, [active?.id, settingsLoadedFor, headlineText, headlinePosition,
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

      const exportPlatform = active.platform || 'YouTube';
      const dimensions = {
        Instagram: [1080, 1350],
        YouTube: [1280, 720],
        LinkedIn: [1200, 627],
        TikTok: [1080, 1920],
        X: [1200, 675]
      }[exportPlatform] || [1280, 720];
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
      const fontSize = ((Number.parseFloat(headlineSize) || 19) * (4 / 3)) * unit;
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
        await document.fonts.load(`${headlineFont === 'Archivo Black' ? 900 : headlineWeight} ${fontSize}px '${headlineFont}'`);
      }
      context.save();
      context.font = `${headlineFont === 'Archivo Black' ? 900 : headlineWeight} ${fontSize}px '${headlineFont}', sans-serif`;
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
      <div className="detail-heading"><div><span className="eyebrow">{active.platform} CAMPAIGN</span><h2>{active.title}</h2><p>{active.topic}</p></div><div className="detail-actions"><button className="outline-btn" onClick={()=>onExport(active, active.platform)}><Download size={15}/> Export</button><button className="icon-btn danger-btn" onClick={()=>onRemove(active.id)} title="Delete campaign"><X size={17}/></button></div></div>
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
        <OutputCard number="02" title="Caption / post copy" icon={<MessageSquareText size={17}/>}><div className="caption-editor">{editing?<textarea value={editCaption} onChange={e=>setEditCaption(e.target.value)} rows={6}/>:<p>{active.caption}</p>}<div className="caption-actions"><button className="text-btn" onClick={()=>{if(editing){onUpdateCampaign(active.id, { caption: editCaption });setEditing(false);onCopy(editCaption);}else{setEditCaption(active.caption||'');setEditing(true)}}}>{editing?'Save & copy':'Edit caption'}</button><button className="tiny-copy" onClick={()=>onCopy(editing?editCaption:active.caption)}><Copy size={14}/></button></div></div></OutputCard>
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
              <span>Font size (pt)</span>
              <input
                type="number"
                min="8"
                max="120"
                step="0.5"
                value={headlineSize}
                onChange={event => setHeadlineSize(event.target.value)}
                aria-label="Headline font size in points"
              />
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
              }[active.platform] || '16 / 9'
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
                  fontSize: `${(Number.parseFloat(headlineSize) || 19) * (4 / 3)}px`,
                  fontWeight: headlineFont === 'Archivo Black' ? 900 : headlineWeight,
                  fontSynthesis: 'weight',
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
      <div className="detail-bottom"><span><Clock3 size={14}/> Created {new Date(active.createdAt).toLocaleString()}</span><button className="primary-btn" onClick={()=>onExport(active, active.platform)}><Download size={16}/> Export campaign</button></div>
    </section> : campaigns.length ? <div className="campaign-grid">{campaigns.map((c,i)=><button className="campaign-tile" key={c.id} onClick={()=>setActiveId(c.id)}><div className={`tile-art tile-art-${i%5}`}><span>{c.platform}</span><span className="tile-number">{String(c.campaignNumber || 1).padStart(3,'0')}</span><strong>{c.thumbnail || c.title}</strong></div><div className="tile-meta"><div><h3>{c.title}</h3><p>{c.topic}</p></div><ArrowDownRight size={18}/></div><div className="tile-foot"><span>{new Date(c.createdAt).toLocaleDateString()}</span><span className="status-pill"><span/>{c.status||'Draft'}</span></div></button>)}</div> : <div className="empty-state"><div className="empty-icon"><Bookmark size={24}/></div><h2>No campaigns found.</h2><p>Try a different search or start a fresh idea.</p><button className="primary-btn" onClick={()=>setPage('studio')}><Plus size={16}/> Create your first campaign</button></div>}
    <div className="library-note"><Sparkles size={15}/> Your campaigns are saved to your private CreatorOS cloud workspace.</div>
  </div>;
}
function OutputCard({number,title,icon,children}) { return <section className="output-card"><div className="output-head"><span className="output-number">{number}</span><span className="output-icon">{icon}</span><h3>{title}</h3></div>{children}</section> }
createRoot(document.getElementById('root')).render(<App/>);
