import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

// ─── HTML Utilities ─────────────────────────────────────────────────────────

/** Decode common HTML entities in plain-text fields coming from APIs */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "\u2013")   // en-dash
    .replace(/&#8212;/g, "\u2014")   // em-dash
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&apos;/g, "'")
    .trim();
}

// ─── API Fetchers ────────────────────────────────────────────────────────────

/** Fetch with a hard timeout; throws on timeout or HTTP error */
async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemotive() {
  try {
    const res = await fetchWithTimeout("https://remotive.com/api/remote-jobs?limit=50");
    const data = await res.json();
    return (data.jobs || []).slice(0, 50).map((j: any) => ({
      apiId: `remotive-${j.id}`,
      title: decodeEntities(j.title || "Unknown Title"),
      company: decodeEntities(j.company_name || "Unknown Company"),
      location: decodeEntities(j.candidate_required_location || "Anywhere"),
      jobType: (j.job_type || "full-time").toLowerCase().replace(/_/g, "-"),
      description: (j.description || "No description provided.").replace(/<img[^>]*>/gi, ""),
      url: j.url || "#",
      source: "remotive",
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Remotive] fetch failed: ${msg}`);
    return [];
  }
}

async function fetchJobicy() {
  try {
    const res = await fetchWithTimeout("https://jobicy.com/api/v2/remote-jobs?count=50");
    const data = await res.json();
    return (data.jobs || []).map((j: any) => ({
      apiId: `jobicy-${j.id}`,
      title: decodeEntities(j.jobTitle || "Unknown Title"),
      company: decodeEntities(j.companyName || "Unknown Company"),
      location: decodeEntities(j.jobGeo || "Anywhere"),
      jobType: (Array.isArray(j.jobType) ? j.jobType[0] : j.jobType || "full-time").toLowerCase(),
      description: (j.jobDescription || "No description provided.").replace(/<img[^>]*>/gi, ""),
      url: j.url || "#",
      source: "jobicy",
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Jobicy] fetch failed: ${msg}`);
    return [];
  }
}

let syncInProgress = false;
let lastSyncFailedSources: string[] = [];

/**
 * Returns the number of jobs upserted, or -1 if a sync is already running.
 */
async function syncJobs(): Promise<number> {
  if (syncInProgress) return -1;
  syncInProgress = true;
  lastSyncFailedSources = [];
  try {
    const [remotive, jobicy] = await Promise.all([fetchRemotive(), fetchJobicy()]);
    if (remotive.length === 0) lastSyncFailedSources.push("Remotive");
    if (jobicy.length === 0) lastSyncFailedSources.push("Jobicy");
    const allJobs = [...remotive, ...jobicy];
    await storage.upsertJobs(allJobs);
    return allJobs.length;
  } finally {
    syncInProgress = false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Badge helpers ────────────────────────────────────────────────────────────

/** Source badge — colored pill using CSS custom properties */
function sourceBadge(source: string) {
  const styles: Record<string, string> = {
    remotive: "background:#eef2ff;color:#4338ca;border-color:#c7d2fe",
    jobicy: "background:#ecfdf5;color:#047857;border-color:#a7f3d0",
  };
  const style = styles[source] ?? "background:#f1f5f9;color:#475569;border-color:#e2e8f0";
  return `<span class="badge" style="${style}">${source}</span>`;
}

/** Type badge — neutral gray pill */
function typeBadge(type: string) {
  return `<span class="badge" style="background:#f1f5f9;color:#475569;border-color:#e2e8f0">${type}</span>`;
}

// ─── HTML Layout ─────────────────────────────────────────────────────────────

const htmlLayout = (content: string, title = "RemoteTracker", activePage: "dashboard" | "jobs" | "saved" = "dashboard") => {
  const navLink = (href: string, label: string, page: string) => {
    const isActive = activePage === page;
    return `<a href="${href}" class="nav-link ${isActive ? "nav-link--active" : ""}">${label}</a>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="Track remote job listings from multiple sources in real-time. Search, filter, and save your favourite remote opportunities.">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --primary-light: #eef2ff;
      --emerald: #10b981;
      --emerald-light: #ecfdf5;
      --radius: 12px;
      --shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06);
      --shadow-lg: 0 8px 30px rgba(0,0,0,.12);
      --nav-h: 64px;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }

    /* ── Nav ── */
    .nav {
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--nav-h);
      background: rgba(255,255,255,0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
    }
    .nav-inner {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-logo {
      font-size: 1.2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-logo svg { flex-shrink: 0; }
    .nav-links { display: flex; align-items: center; gap: 4px; }
    .nav-link {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: .875rem;
      font-weight: 500;
      color: var(--text-muted);
      text-decoration: none;
      transition: all .15s;
    }
    .nav-link:hover { background: var(--primary-light); color: var(--primary); }
    .nav-link--active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
    .nav-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 99px;
      font-size: .7rem;
      font-weight: 700;
      background: var(--primary);
      color: #fff;
      margin-left: 6px;
    }

    /* ── Main ── */
    .main { max-width: 1100px; margin: 0 auto; padding: 36px 24px 64px; }

    /* ── Cards ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 24px;
    }
    .card--hover {
      transition: transform .15s, box-shadow .15s, border-color .15s;
      cursor: pointer;
    }
    .card--hover:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      border-color: var(--primary);
    }

    /* ── Stat Cards ── */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 20px; margin-bottom: 36px; }
    .stat-card { padding: 24px; }
    .stat-label { font-size: .8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
    .stat-value { font-size: 2.2rem; font-weight: 800; color: var(--primary); line-height: 1; }
    .stat-sub { font-size: .8rem; color: var(--text-muted); margin-top: 6px; }
    .stat-source-row { display: flex; align-items: center; justify-content: space-between; font-size: .85rem; margin-top: 4px; }
    .stat-source-row span:first-child { color: var(--text-muted); text-transform: capitalize; }
    .stat-source-row span:last-child { font-weight: 600; color: var(--text); }

    /* ── Buttons ── */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px; font-size: .875rem; font-weight: 600;
      cursor: pointer; border: none; transition: all .15s; text-decoration: none;
    }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,.35); }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
    .btn-success { background: var(--emerald); color: #fff; }
    .btn-success:hover { background: #059669; }
    .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid transparent; }
    .btn-ghost:hover { background: #f1f5f9; color: var(--text); }
    .btn-danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
    .btn-danger:hover { background: #fecaca; }
    .btn-sm { padding: 5px 10px; font-size: .8rem; }

    /* ── Forms ── */
    .form-label { display: block; font-size: .8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
    .form-input, .form-select {
      width: 100%; padding: 10px 14px; border: 1px solid var(--border);
      border-radius: 8px; font-size: .875rem; font-family: inherit;
      color: var(--text); background: var(--surface); outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99,102,241,.12);
    }

    /* ── Job Card ── */
    .job-card { padding: 20px 24px; margin-bottom: 12px; }
    .job-title { font-size: 1rem; font-weight: 700; color: var(--primary); text-decoration: none; }
    .job-title:hover { text-decoration: underline; }
    .job-meta { font-size: .8rem; color: var(--text-muted); margin-top: 4px; }
    .job-footer { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .job-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .job-badges { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }

    /* ── Page Header ── */
    .page-header { margin-bottom: 32px; }
    .page-title { font-size: 1.875rem; font-weight: 800; color: var(--text); }
    .page-subtitle { font-size: .95rem; color: var(--text-muted); margin-top: 6px; }

    /* ── Layout: sidebar + content ── */
    .search-layout { display: grid; grid-template-columns: 260px 1fr; gap: 28px; align-items: start; }
    @media (max-width: 768px) { .search-layout { grid-template-columns: 1fr; } }
    .sidebar { position: sticky; top: calc(var(--nav-h) + 16px); }
    .sidebar-card { padding: 20px; }
    .sidebar-title { font-size: .875rem; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .filter-group { margin-bottom: 18px; }

    /* ── HTMX Indicator ── */
    .htmx-indicator { display: none; }
    .htmx-request .htmx-indicator { display: flex !important; }
    .htmx-request.htmx-indicator { display: flex !important; }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Toast ── */
    #notification-toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 999;
      max-width: 340px;
    }
    .toast-inner {
      background: #1e293b;
      color: #f8fafc;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: .875rem;
      box-shadow: var(--shadow-lg);
      animation: slideUp .3s ease;
    }
    @keyframes slideUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }

    /* ── Skeleton loaders ── */
    .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .skeleton-card { padding: 20px 24px; margin-bottom: 12px; }
    .skeleton-line { height: 14px; border-radius: 4px; margin-bottom: 10px; }

    /* ── Result count ── */
    .result-meta { font-size: .85rem; color: var(--text-muted); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    .result-count { font-weight: 700; color: var(--text); }

    /* ── Empty state ── */
    .empty-state { text-align: center; padding: 64px 24px; }
    .empty-icon { font-size: 3rem; margin-bottom: 16px; }
    .empty-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 8px; }
    .empty-desc { font-size: .875rem; color: var(--text-muted); }

    /* ── Hero gradient bar ── */
    .hero-bar { height: 4px; background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899); border-radius: 2px; margin-bottom: 32px; }

    /* ── Sections ── */
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .section-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }

    /* ── Auto-sync pulse ── */
    .sync-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--emerald);
      display: inline-block; margin-right: 6px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }

    /* ── Prose / description ── */
    .prose { font-size: .9rem; line-height: 1.75; color: #334155; }
    .prose h1,.prose h2,.prose h3 { font-weight: 700; color: var(--text); margin: 1em 0 .5em; }
    .prose p { margin-bottom: .85em; }
    .prose ul,.prose ol { padding-left: 1.4em; margin-bottom: .85em; }
    .prose li { margin-bottom: .3em; }
    .prose strong { font-weight: 600; }
    .prose a { color: var(--primary); }

    /* ── Saved-jobs heart icon ── */
    .save-btn { gap: 6px; }
    .save-btn svg { width: 15px; height: 15px; }

    /* ── Badge pill ── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      border-radius: 9999px;
      font-size: .73rem;
      font-weight: 600;
      letter-spacing: .01em;
      border: 1px solid;
      text-transform: capitalize;
      white-space: nowrap;
    }

    /* ── Apply-button external hint ── */
    .apply-hint {
      font-size: .72rem;
      color: var(--text-muted);
      margin-top: 5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>
          <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        RemoteTracker
      </a>
      <div class="nav-links">
        ${navLink("/", "Dashboard", "dashboard")}
        ${navLink("/jobs", "Find Jobs", "jobs")}
        <a href="/saved" class="nav-link ${activePage === "saved" ? "nav-link--active" : ""}">
          Saved
          <span id="saved-count-badge" class="nav-badge" style="display:none"></span>
        </a>
      </div>
    </div>
  </nav>

  <main class="main">
    ${content}
  </main>

  <div id="notification-toast"></div>
</body>
</html>`;
};

// ── Route Registration ──────────────────────────────────────────────────────

/** Builds the stats-grid HTML (shared by /htmx/stats and /api/jobs/sync OOB update) */
async function buildStatsHtml() {
  const total = await storage.getJobCount();
  const sources = await storage.getJobSourcesCount();
  const lastUpdated = await storage.getLastUpdated();

  const sourceRows = Object.entries(sources)
    .map(([s, c]) => `<div class="stat-source-row"><span>${s}</span><span>${c}</span></div>`)
    .join("") || '<span style="color:var(--text-muted);font-size:.85rem">No data yet</span>';

  return `
    <div class="stats-grid" id="stats-section"
         hx-get="/htmx/stats"
         hx-trigger="every 60s, statsRefresh from:body"
         hx-swap="outerHTML">

      <div class="card stat-card">
        <div class="stat-label">Total Jobs Tracked</div>
        <div class="stat-value">${total}</div>
        <div class="stat-sub">across all sources</div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">By Source</div>
        ${sourceRows}
      </div>

      <div class="card stat-card" style="display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div class="stat-label">Last Synced</div>
          <div style="font-size:.95rem;font-weight:600;color:var(--text);margin-top:4px;">
            ${lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
          </div>
        </div>
        <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;">
            <span class="sync-dot"></span>Auto-sync every 60s
          </div>
          <button class="btn btn-outline btn-sm"
                  hx-post="/api/jobs/sync"
                  hx-target="#sync-result"
                  hx-swap="innerHTML"
                  hx-indicator="#sync-spinner">
            Sync now
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <div id="sync-result" style="font-size:.8rem;"></div>
          <span id="sync-spinner" class="htmx-indicator"><div class="spinner"></div></span>
        </div>
      </div>
    </div>`;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ── JSON API endpoints ──────────────────────────────────────────────────────

  app.get("/api/jobs", async (req, res) => {
    try {
      const schema = z.object({
        search: z.string().optional(),
        location: z.string().optional(),
        type: z.string().optional(),
        page: z.coerce.number().optional().default(1),
      });
      const input = schema.parse(req.query);
      const limit = 20;
      const offset = ((input.page || 1) - 1) * limit;
      const jobs = await storage.getJobs({ ...input, limit, offset });
      const total = await storage.getJobCount();
      const sources = await storage.getJobSourcesCount();
      const lastUpdated = await storage.getLastUpdated();
      res.json({ jobs, total, sources, lastUpdated });
    } catch (e) {
      res.status(400).json({ message: "Invalid query" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Not found" });
    res.json(job);
  });

  // ── Force-sync endpoint ─────────────────────────────────────────────────────

  app.post("/api/jobs/sync", async (req, res) => {
    const count = await syncJobs();

    if (req.headers["hx-request"]) {
      if (count === -1) {
        // Already syncing — inform the user without firing a refresh
        return res.send(`<span style="color:var(--text-muted);font-weight:600;">⏳ Already syncing…</span>`);
      }
      const warning = lastSyncFailedSources.length
        ? ` (${lastSyncFailedSources.join(", ")} unavailable)`
        : "";
      // Fire HTMX events so the dashboard stats + recent jobs refresh immediately
      res.set("HX-Trigger", JSON.stringify({ statsRefresh: true, recentRefresh: true }));
      return res.send(`<span style="color:var(--emerald);font-weight:600;">✓ Synced ${count} jobs${warning}</span>`);
    }
    res.json({ synced: count });
  });

  // ── Save / Unsave job ───────────────────────────────────────────────────────

  app.post("/jobs/:id/save", async (req, res) => {
    const id = Number(req.params.id);
    const job = await storage.getJob(id);
    if (!job) return res.status(404).send("Not found");

    const wasSaved = await storage.isJobSaved(id);
    if (wasSaved) {
      await storage.unsaveJob(id);
    } else {
      await storage.saveJob(id);
    }
    const nowSaved = !wasSaved;

    // Return the updated save button (inline swap) + OOB toast + OOB saved badge
    const savedJobs = await storage.getSavedJobs();
    const savedCount = savedJobs.length;

    const toast = `<div id="notification-toast" hx-swap-oob="true">
      <div class="toast-inner">
        ${nowSaved ? `❤️ Saved: <strong>${job.title}</strong>` : `🗑️ Removed from saved.`}
      </div>
    </div>`;

    const badge = `<span id="saved-count-badge" hx-swap-oob="true" class="nav-badge" style="${savedCount > 0 ? "" : "display:none"}">${savedCount}</span>`;

    const saveBtn = `
      ${toast}
      ${badge}
      <button class="btn ${nowSaved ? "btn-success" : "btn-outline"} btn-sm save-btn"
              hx-post="/jobs/${id}/save"
              hx-target="#save-btn-wrap"
              hx-swap="innerHTML"
              hx-indicator="#save-indicator">
        ${nowSaved
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>Saved`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>Save Job`
      }
      </button>
      <span id="save-indicator" class="htmx-indicator" style="margin-left:6px;"><div class="spinner"></div></span>`;

    res.send(saveBtn);
  });

  // ── HTMX: Dashboard stats (auto-poll every 60s) ─────────────────────────────

  app.get("/htmx/stats", async (req, res) => {
    const savedJobs = await storage.getSavedJobs();
    const savedCount = savedJobs.length;
    // OOB badge update for the nav Saved count
    const badge = `<span id="saved-count-badge" hx-swap-oob="true" class="nav-badge" style="${savedCount > 0 ? "" : "display:none"}">${savedCount}</span>`;
    const statsHtml = await buildStatsHtml();
    res.send(`${badge}${statsHtml}`);
  });

  // ── HTMX: Recent jobs (lazy-loaded on dashboard) ────────────────────────────

  app.get("/htmx/recent-jobs", async (req, res) => {
    const jobs = await storage.getJobs({ limit: 6 });
    if (jobs.length === 0) {
      return res.send(`
        <div class="card empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No jobs yet</div>
          <div class="empty-desc">Click "Sync now" above to fetch fresh listings.</div>
        </div>`);
    }
    const html = jobs.map(j => `
      <a href="/jobs/${j.id}" class="card card--hover job-card" style="text-decoration:none;display:block;">
        <div class="job-head">
          <div>
            <div class="job-title">${escHtml(j.title)}</div>
            <div class="job-meta">${escHtml(j.company)} &bull; ${escHtml(j.location)}</div>
          </div>
          <div class="job-badges">
            ${typeBadge(j.jobType)}
            ${sourceBadge(j.source)}
          </div>
        </div>
      </a>`).join("");
    res.send(`<div>${html}</div>`);
  });

  // ── HTMX: Lazy job description ──────────────────────────────────────────────

  app.get("/htmx/lazy-description/:id", async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.send(`<div style="color:#dc2626;padding:8px;">Description not available.</div>`);
    res.send(`<div class="prose">${job.description}</div>`);
  });

  // ── HTMX: Search jobs partial (for HTMX filter requests) ───────────────────
  // Also used by the initial full /jobs page render via the shared helper below

  async function buildJobResultsHtml(search: string, location: string, type: string, page: number) {
    const limit = 10;
    const offset = (page - 1) * limit;
    const jobs = await storage.getJobs({ search, location, type, limit, offset });
    const totalCount = await storage.getSearchJobCount({ search, location, type });
    const hasMore = jobs.length === limit;

    if (jobs.length === 0) {
      return `
        <div class="card empty-state" id="job-results-inner">
          <div class="empty-icon">😕</div>
          <div class="empty-title">No jobs match your filters</div>
          <div class="empty-desc">Try adjusting your keyword, location, or job type.</div>
        </div>`;
    }

    const cards = jobs.map((j, i) => {
      const isLast = i === jobs.length - 1;
      const infiniteScroll = (isLast && hasMore)
        ? `hx-get="/jobs?search=${encodeURIComponent(search)}&location=${encodeURIComponent(location)}&type=${encodeURIComponent(type)}&page=${page + 1}"
           hx-trigger="revealed"
           hx-swap="afterend"
           hx-indicator="#scroll-spinner"`
        : "";
      return `
        <a href="/jobs/${j.id}" class="card card--hover job-card" style="text-decoration:none;display:block;" ${infiniteScroll}>
          <div class="job-head">
            <div style="flex:1;min-width:0;">
              <div class="job-title">${escHtml(j.title)}</div>
              <div class="job-meta">${escHtml(j.company)} &bull; ${escHtml(j.location)}</div>
            </div>
            <div class="job-badges">
              ${typeBadge(j.jobType)}
              ${sourceBadge(j.source)}
            </div>
          </div>
        </a>`;
    }).join("");

    return `
      <div class="result-meta">
        <span><span class="result-count">${totalCount}</span> jobs found</span>
        ${search || location || type ? `<span style="font-size:.8rem;color:var(--primary);">Filtered</span>` : ""}
      </div>
      ${cards}
      <div id="scroll-spinner" class="htmx-indicator" style="justify-content:center;padding:16px;">
        <div class="spinner"></div>
      </div>`;
  }

  // ── Pages ───────────────────────────────────────────────────────────────────

  // Dashboard
  app.get("/", async (req, res) => {
    if ((await storage.getJobCount()) === 0) {
      syncJobs().catch(console.error); // fire-and-forget initial sync
    }

    const content = `
      <div class="hero-bar"></div>
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Live overview of remote job listings across platforms.</p>
      </div>

      <!-- Stats: loaded via HTMX hx-trigger="load, every 60s" -->
      <div id="stats-section"
           hx-get="/htmx/stats"
           hx-trigger="load, statsRefresh from:body"
           hx-swap="outerHTML"
           hx-indicator="#stats-spinner">
        <div class="stats-grid">
          ${[1, 2, 3].map(() => `
            <div class="card skeleton-card">
              <div class="skeleton skeleton-line" style="width:40%;height:12px"></div>
              <div class="skeleton skeleton-line" style="width:70%;height:28px;margin-top:8px;"></div>
              <div class="skeleton skeleton-line" style="width:55%;height:10px"></div>
            </div>`).join("")}
        </div>
        <span id="stats-spinner" class="htmx-indicator" style="justify-content:center;padding:12px;">
          <div class="spinner"></div>
        </span>
      </div>

      <!-- Recent Jobs -->
      <div class="section-header" style="margin-top:16px;">
        <div class="section-title">Recent Listings</div>
        <a href="/jobs" class="btn btn-outline btn-sm">View all &rarr;</a>
      </div>
      <div id="recent-jobs-list"
           hx-get="/htmx/recent-jobs"
           hx-trigger="load, recentRefresh from:body"
           hx-swap="innerHTML"
           hx-indicator="#recent-spinner">
        <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);padding:24px 0;">
          <div class="spinner"></div> Loading recent jobs…
        </div>
      </div>
      <div id="recent-spinner" class="htmx-indicator" style="justify-content:center;padding:16px;">
        <div class="spinner"></div>
      </div>
    `;
    res.send(htmlLayout(content, "Dashboard | RemoteTracker", "dashboard"));
  });

  // Job Search
  app.get("/jobs", async (req, res) => {
    const isHtmx = req.headers["hx-request"] === "true";
    const search = (req.query.search as string) || "";
    const location = (req.query.location as string) || "";
    const type = (req.query.type as string) || "";
    const page = parseInt(req.query.page as string) || 1;

    const resultsHtml = await buildJobResultsHtml(search, location, type, page);

    // For HTMX partial requests (filter/pagination)
    if (isHtmx) {
      return res.send(resultsHtml);
    }

    const content = `
      <div class="hero-bar"></div>
      <div class="page-header">
        <h1 class="page-title">Find Jobs</h1>
        <p class="page-subtitle">Search and filter ${await storage.getJobCount()} remote opportunities.</p>
      </div>

      <div class="search-layout">
        <!-- Sidebar Filters -->
        <aside class="sidebar">
          <div class="card sidebar-card">
            <div class="sidebar-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/>
                <line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/>
                <circle cx="12" cy="4" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="14" cy="20" r="2"/>
              </svg>
              Filters
            </div>

            <form hx-get="/jobs"
                  hx-target="#job-results"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                  hx-trigger="input delay:400ms from:#kw-input, change from:select, submit"
                  hx-indicator="#search-spinner">

              <div class="filter-group">
                <label class="form-label" for="kw-input">Keyword</label>
                <input id="kw-input" type="text" name="search" value="${escHtml(search)}"
                       class="form-input" placeholder="React, Python, Design…">
              </div>

              <div class="filter-group">
                <label class="form-label" for="loc-input">Location</label>
                <input id="loc-input" type="text" name="location" value="${escHtml(location)}"
                       class="form-input" placeholder="US, Europe, Anywhere…"
                       hx-get="/jobs"
                       hx-target="#job-results"
                       hx-swap="innerHTML"
                       hx-push-url="true"
                       hx-trigger="input delay:400ms">
              </div>

              <div class="filter-group">
                <label class="form-label" for="type-select">Job Type</label>
                <select id="type-select" name="type" class="form-select">
                  <option value="">All Types</option>
                  <option value="full-time" ${type === "full-time" ? "selected" : ""}>Full-Time</option>
                  <option value="contract" ${type === "contract" ? "selected" : ""}>Contract</option>
                  <option value="freelance" ${type === "freelance" ? "selected" : ""}>Freelance</option>
                  <option value="part-time" ${type === "part-time" ? "selected" : ""}>Part-Time</option>
                  <option value="internship" ${type === "internship" ? "selected" : ""}>Internship</option>
                </select>
              </div>

              <!-- Loading indicator inside sidebar -->
              <div id="search-spinner" class="htmx-indicator" style="justify-content:center;padding:8px 0;">
                <div class="spinner"></div>
                <span style="margin-left:8px;font-size:.8rem;color:var(--text-muted);">Searching…</span>
              </div>

              <noscript>
                <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px;">Search</button>
              </noscript>
            </form>
          </div>
        </aside>

        <!-- Results -->
        <div>
          <div id="job-results">
            ${resultsHtml}
          </div>
        </div>
      </div>
    `;
    res.send(htmlLayout(content, "Find Jobs | RemoteTracker", "jobs"));
  });

  // Job Detail
  app.get("/jobs/:id", async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) {
      const content = `
        <div class="card empty-state" style="margin-top:48px;">
          <div class="empty-icon">🔦</div>
          <div class="empty-title">Job Not Found</div>
          <div class="empty-desc" style="margin-bottom:20px;">This listing may have been removed or never existed.</div>
          <a href="/jobs" class="btn btn-primary">Browse Jobs</a>
        </div>`;
      return res.status(404).send(htmlLayout(content, "Not Found | RemoteTracker", "jobs"));
    }

    const isSaved = await storage.isJobSaved(job.id);
    const savedCount = (await storage.getSavedJobs()).length;

    // OOB: update the nav "Saved" badge on page load
    const oobBadge = `<span id="saved-count-badge" hx-swap-oob="true" class="nav-badge" style="${savedCount > 0 ? "" : "display:none"}">${savedCount}</span>`;

    // OOB: notification toast
    const oobToast = `
      <div id="notification-toast" hx-swap-oob="true">
        <div class="toast-inner">📌 Viewing: <strong>${escHtml(job.title)}</strong></div>
      </div>`;

    const content = `
      ${oobBadge}
      ${oobToast}

      <div style="margin-bottom:20px;">
        <a href="/jobs" class="btn btn-ghost btn-sm">&larr; Back to search</a>
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <!-- Header -->
        <div style="padding:28px 32px;border-bottom:1px solid var(--border);">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:16px;">
            <div>
              <h1 style="font-size:1.5rem;font-weight:800;color:var(--text);">${escHtml(job.title)}</h1>
              <p style="font-size:1rem;color:var(--text-muted);margin-top:4px;">${escHtml(job.company)}</p>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <!-- Save button — hx-post, hx-target, hx-swap -->
              <div id="save-btn-wrap" style="display:flex;align-items:center;gap:6px;">
                <button class="btn ${isSaved ? "btn-success" : "btn-outline"} btn-sm save-btn"
                        hx-post="/jobs/${job.id}/save"
                        hx-target="#save-btn-wrap"
                        hx-swap="innerHTML"
                        hx-indicator="#save-indicator">
                  ${isSaved
        ? `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>Saved`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>Save Job`
      }
                </button>
                <span id="save-indicator" class="htmx-indicator"><div class="spinner"></div></span>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;">
                <a href="${job.url}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn btn-primary btn-sm"
                   title="Opens the job listing on ${escHtml(job.source)} in a new tab">
                  Apply via ${escHtml(job.source)} &rarr;
                </a>
                <span class="apply-hint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  External site &mdash; may show a brief security check
                </span>
              </div>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:.8rem;color:var(--text-muted);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              ${escHtml(job.location)}
            </span>
            ${typeBadge(job.jobType)}
            ${sourceBadge(job.source)}
          </div>
        </div>

        <!-- Description (lazy-loaded) -->
        <div style="padding:28px 32px;">
          <h2 style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:16px;">Job Description</h2>
          <div hx-get="/htmx/lazy-description/${job.id}"
               hx-trigger="load"
               hx-swap="outerHTML"
               hx-indicator="#desc-spinner">
            <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);padding:24px 0;">
              <div class="spinner"></div> Loading description…
            </div>
            <span id="desc-spinner" class="htmx-indicator"><div class="spinner"></div></span>
          </div>
        </div>
      </div>
    `;
    res.send(htmlLayout(content, `${job.title} | RemoteTracker`, "jobs"));
  });

  // Saved Jobs page
  app.get("/saved", async (req, res) => {
    const saved = await storage.getSavedJobs();

    const listHtml = saved.length === 0
      ? `<div class="card empty-state">
           <div class="empty-icon">🤍</div>
           <div class="empty-title">No saved jobs yet</div>
           <div class="empty-desc" style="margin-bottom:20px;">Browse jobs and click "Save Job" to bookmark them here.</div>
           <a href="/jobs" class="btn btn-primary">Browse Jobs</a>
         </div>`
      : saved.map(j => `
          <div class="card card--hover job-card" style="position:relative;">
            <div class="job-head">
              <div style="flex:1;min-width:0;">
                <a class="job-title" href="/jobs/${j.id}">${escHtml(j.title)}</a>
                <div class="job-meta">${escHtml(j.company)} &bull; ${escHtml(j.location)}</div>
                <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;">
                  Saved ${j.savedAt ? new Date(j.savedAt).toLocaleDateString() : ""}
                </div>
              </div>
              <div class="job-badges" style="flex-direction:column;align-items:flex-end;gap:8px;">
                ${typeBadge(j.jobType)}
                ${sourceBadge(j.source)}
              </div>
            </div>
            <div class="job-footer">
              <a href="${j.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Apply &rarr;</a>
              <button class="btn btn-danger btn-sm"
                      hx-post="/jobs/${j.id}/save"
                      hx-target="closest .card"
                      hx-swap="outerHTML swap:0.3s"
                      hx-confirm="Remove this job from saved?">
                Remove
              </button>
            </div>
          </div>`).join("");

    const content = `
      <div class="hero-bar"></div>
      <div class="page-header">
        <h1 class="page-title">Saved Jobs</h1>
        <p class="page-subtitle">Your bookmarked remote opportunities — ${saved.length} saved.</p>
      </div>
      ${listHtml}
    `;
    res.send(htmlLayout(content, "Saved Jobs | RemoteTracker", "saved"));
  });

  return httpServer;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function escHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
