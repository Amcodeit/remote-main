# RemoteTracker - Remote Job Board

**Live**: https://remote-main-production-f23a.up.railway.app/

Server-rendered job aggregator using Express v5 and HTMX. Fetches remote job listings from Remotive and Jobicy APIs with fast, interactive UI.

**Stack**: Node.js v22 • Express v5 • HTMX 1.9 • TypeScript 5.6 • Railway

---

## App Overview

Job board aggregating ~1800+ remote jobs from two APIs. Uses server-side rendering with HTMX for dynamic interactions without heavy JavaScript (50KB total vs 500KB+ SPA bundles).

**Features**: Job sync, search/filter, bookmarking, dashboard stats, infinite scroll

---

## APIs Used & Why

### Remotive API
- **Endpoint**: `https://remotive.com/api/remote-jobs?limit=50`
- **Why**: Largest remote job database (~1000+ listings), no auth required, consistent data structure

### Jobicy API
- **Endpoint**: `https://jobicy.com/api/v2/remote-jobs?count=50`
- **Why**: Complements with different sources (~800+ listings), free tier, good variety

**Sync Strategy**: Parallel fetching via `Promise.all()` (2-3s vs 5-6s sequential), error isolation, deduplication by `apiId`

---

## Architecture

```
Browser (HTMX) → Express v5 Server → In-Memory Storage
                      ↓
                External APIs (Remotive, Jobicy)
```

**Backend**: Express v5, TypeScript, esbuild bundling  
**Frontend**: HTMX (declarative AJAX), minimal vanilla JS  
**Storage**: Map-based in-memory (resets on restart)  
**Deploy**: Railway with Nixpacks auto-containerization

**Data Flow**: `User Action → HTMX Request → Express Route → Storage → HTML Response → DOM Swap`

---

## HTMX Data Flow (Key Patterns)

### 1. Live Polling
```html
<div hx-get="/htmx/stats" hx-trigger="load, every 60s" hx-swap="outerHTML">
```
Auto-refreshes stats every 60s without JavaScript

### 2. Infinite Scroll
```html
<button hx-get="/htmx/load-more?offset=20" hx-trigger="revealed">
```
Loads next batch when button scrolls into view

### 3. Debounced Search
```html
<input hx-get="/htmx/search-jobs" hx-trigger="keyup changed delay:500ms">
```
Waits 500ms after user stops typing before searching

### 4. Toggle Actions
```html
<button hx-post="/jobs/123/save" hx-swap="outerHTML">
```
Saves job and replaces button with "Saved ✓" instantly

### 5. Lazy Loading
```html
<div hx-get="/htmx/lazy-description/123" hx-trigger="revealed once">
```
Loads full description only when scrolled into view

**HTMX vs SPA**: 50KB initial load vs 500KB+, perfect SEO, simpler debugging, no client state management

---

## Biggest Technical Challenge

**Problem**: Railway deployment crashed on startup with `TypeError: Missing parameter name at index 1: *`

**Root Cause**: Express v5 doesn't support wildcard `app.use("*", ...)` route pattern from v4

**Why Tricky**: 
- Dev mode worked (used Vite middleware)
- Build succeeded, only runtime crash
- Health checks timed out (server never started)

**Solution**: Removed catch-all route entirely. HTMX uses explicit routes (`/`, `/jobs`, `/jobs/:id`), no catch-all needed.

**Key Learning**: Always test production builds locally before deploying (`NODE_ENV=production node dist/index.cjs`)

---

## Tradeoffs Made

### 1. In-Memory Storage vs Database
**Choice**: Map-based storage  
**Pros**: Zero config, <1ms queries, no costs  
**Cons**: Data resets on restart, no horizontal scaling  
**Why OK**: APIs are source of truth, cold start refetch takes 5s

### 2. Server Rendering vs SPA
**Choice**: HTMX server-side  
**Pros**: 50KB bundle, perfect SEO, simpler state  
**Cons**: Server load per navigation, no offline mode  
**Why OK**: Job boards don't need offline, SEO critical

### 3. Parallel vs Sequential API Calls
**Choice**: `Promise.all()` concurrent  
**Pros**: 2x faster (2-3s), partial data if one fails  
**Cons**: Higher instant load, complex error handling

### 4. Manual vs Auto Sync
**Choice**: Sync on first load only  
**Pros**: No background process, rate-limit friendly  
**Cons**: Stale data until refresh  
**Why OK**: Jobs don't change rapidly, restarts are rare

---

## What I Learned

**HTMX Mastery**: HTML attributes replace thousands of React lines, `hx-trigger` modifiers powerful for polling/debouncing/lazy-loading

**Express v5 Gotchas**: Major versions break production silently, wildcard routing changed from v4, always test production builds locally

**Railway Deployment**: Nixpacks auto-detect is powerful, health checks must bind to `0.0.0.0:$PORT`, logs crucial for debugging

**Architecture Insights**: Simplicity wins (fewer abstractions = easier debugging), server rendering eliminates hydration bugs, parallel API calls matter (2x speedup)

**Business Lessons**: HTMX built this in 1/3 the time of React, no client state saved weeks of debugging, production exposes issues dev doesn't

---

## What I Would Improve

### Short-Term
- **Database**: Add PostgreSQL with Drizzle ORM for persistence
- **Caching**: Redis layer for API responses (1hr cache, 90% fewer API calls)
- **Auth**: Passport.js for user accounts, persistent saved jobs
- **Search**: Full-text search in descriptions, fuzzy matching, suggestions

### Medium-Term
- **More APIs**: Indeed, We Work Remotely, RemoteCo (target 50k+ jobs)
- **Notifications**: Email alerts for job matches (daily/weekly digest)
- **Advanced Filters**: Salary range, company size, timezone, experience level
- **Analytics**: Track view/save/apply rates per user

### Long-Term
- **AI Matching**: OpenAI embeddings for resume-job matching, auto cover letters
- **Company Profiles**: Scrape Crunchbase/LinkedIn data, reviews, tech stacks
- **Mobile App**: React Native with push notifications
- **Monetization**: Premium tier ($9/mo), company job posts ($99/post)

### Technical Debt
- **Testing**: 0% → 80% coverage (unit + integration tests)
- **Error Handling**: Sentry integration, HTMX error boundaries
- **Monitoring**: Uptime alerts, performance tracking, log aggregation
- **Security**: Rate limiting, CSRF protection, helmet.js headers

---

## Quick Start

```bash
# Install
npm install

# Dev server (http://localhost:5000)
npm run dev

# Production build
npm run build
npm start

# Deploy to Railway
git push origin main  # Auto-deploys
```

**Requirements**: Node.js >= 20, npm >= 9

---

## Contact

**Author**: [@Amcodeit](https://github.com/Amcodeit)  
**Repo**: https://github.com/Amcodeit/remote-main  
**Live**: https://remote-main-production-f23a.up.railway.app/
