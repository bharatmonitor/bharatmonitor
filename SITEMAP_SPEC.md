# BharatMonitor — Proposed Sitemap & Rebuild Spec

## PAGE ARCHITECTURE (6 pages from 10)

### 1. / LOGIN (/auth)
Single screen. Email + Password. Two accounts visible to demo users.
No Nav. Just the war-room logo + login box.

### 2. 🏠 DASHBOARD (/dashboard)  ← Main war room
TOP BAR: Logo | Politician name + party + constituency | Sentiment% | Mentions | Crisis | Opp Gaps | Pressure | [SEARCH NOW] [⛽ FUEL] [⬇ REPORT]
AI RIBBON: Scrolling live ticker of top stories
BUCKET FILTER: ALL SOURCES | X/TWITTER | INSTAGRAM | FACEBOOK | WHATSAPP | YOUTUBE | REDDIT | NEWS/RSS
MAIN AREA (3 columns):
  Left sidebar (220px):
    - Sentiment (Overall / By Channel toggle)
    - Constituency Pulse (keyword scores)
    - Competitor Monitor
    - Tracked Keywords (editable)
    - National Discourse (fetch button)
    - Meta Ads Tracker
  Centre (fills):
    - 4 bucket columns: CRISIS | DEVELOPING | BACKGROUND | QUOTE INTEL
    - Each column: scrollable cards with source, headline, tags, sentiment dot
  No right panel — sidebar is enough
BOTTOM: Quota bar showing N:x/5 YT:x/10 X:x/85 + hours until reset

### 3. 📊 ANALYSE (/analyse) ← Merged: Trends + Audience + Intelligence + Contradictions
Single page with 4 TABS:
  Tab 1: TRENDS
    - Signal intensity gauges (Crisis/Developing/Background/Opp Gaps)
    - Sentiment over time chart (14 days)
    - Keyword performance table (clickable filter)
    - Platform coverage bars
    - Top conversations list (20 items)
  Tab 2: AUDIENCE  
    - 6 KPIs: Coverage/Positive/Negative/Engagement/Platforms/Geo
    - Sub-tabs: Overview | Personas (8 segments) | Geography | Competition
    - Top posts by sentiment (positive/negative/neutral filter)
  Tab 3: INTELLIGENCE (AI Report)
    - Date range picker
    - Account Keywords vs National Discourse toggle
    - [Generate Report] button
    - Report output: topic clusters, sentiment per cluster, top sources, narrative bullets
    - 5 strategic conclusions
    - [Save as PDF] button
  Tab 4: CONTRADICTIONS
    - AI-detected flip-flops, broken promises, sarcasm (2014-present)
    - Filter by type: flip | contradiction | vote_record | data_gap | sarcasm
    - Each entry: current quote vs historical quote, confidence score, source

### 4. ⚡ TRACK (/track) ← Keywords + National Discourse setup
  Section 1: TRACKED KEYWORDS
    - Add/remove account-specific keywords
    - See volume per keyword (bar chart)
    - [Fetch Now] button per keyword
  Section 2: TRACKED ENTITIES  
    - Politicians (competitors + allies)
    - Parties, Ministries, Schemes
    - Add/remove entities
  Section 3: NATIONAL DISCOURSE
    - Journalist watchlist (150 accounts, shown as tag cloud)
    - National keyword categories (8 categories, toggleable)
    - [Fetch National Discourse] button
  Section 4: DATA SOURCES
    - Toggle: Google News RSS | GDELT | NewsData | YouTube | Reddit | X/Twitter
    - Quota display per source
    - Last fetch timestamp per source

### 5. 🗃 DATA (/data)
  - Search/filter bar (platform, bucket, sentiment, date range, keyword)
  - Full data table (sortable columns)
  - [Export CSV] button
  - [Export All (140)] button
  - Row detail panel on click

### 6. ⬇ REPORT (/report)
  - Opens in new tab
  - Dark-themed PDF with all 11 sections
  - [Save as PDF] button top-right
  - Auto-populates from live data

### 7. ⚙ SETTINGS (/settings) ← Simplified: account profile only
  - Politician profile (name, party, constituency, photo)
  - Contact email + password change
  - Alert preferences (SMS/email on crisis)
  - Session management

### 8. 👑 GOD MODE (/god) ← Admin only
  Section 1: CREDENTIALS TABLE — all accounts with email/password visible
  Section 2: ACCOUNTS TABLE — with EDIT | INGEST | QUOTA | DELETE per row
  Section 3: QUOTA MANAGER — set custom limits per account (searches/news/yt/social)
  Section 4: INGEST CONTROL — trigger ingest for any account manually

## NAVIGATION
Top NavBar (all authenticated pages):
[◉ DASHBOARD] [📊 ANALYSE] [⚡ TRACK] [🗃 DATA] [⬇ REPORT] [⚙ SETTINGS]

CommandBar only on DASHBOARD:
Shows live KPIs: Sentiment% | Mentions | Crisis | Opp Gaps | Pressure
Buttons: [⚡ KEYWORDS→/track] [🗃 DATA→/data] [◈ ANALYTICS→/analyse] [⚡ QUICK SCAN] [⬇ REPORT]

## WHAT GETS REMOVED
- /trends → merged into /analyse Tab 1
- /content (NarrativeGaps) → merged into /analyse Tab 3 (Intelligence)
- /audience → merged into /analyse Tab 2
- /intelligence → merged into /analyse Tab 3
- /keywords/:keyword → inline in /track page
- Duplicate components across pages

## KEY DESIGN PRINCIPLES
1. One page = one mental model. Dashboard = live monitoring. Analyse = historical insight. Track = configuration. Data = raw export.
2. Everything visible in max 2 clicks from dashboard
3. No page repeats data that another page already shows
4. God Mode is truly separate — not a tab inside another page
5. PDF report always accessible from top nav — not buried
