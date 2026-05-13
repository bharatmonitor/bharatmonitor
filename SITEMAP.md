# BharatMonitor — Sitemap & Page Architecture

## Current Problems
- 10 pages with overlapping purposes
- Trends + Narratives + Intelligence = all "analysis" pages, confusing
- Data page exists separately but same data is in all other pages
- Settings buried, not connected to tracking setup
- No clear user journey from login → insight → action

## Proposed Architecture (6 clean sections)

### PUBLIC
/ (Landing) → /auth (Login)

### AUTHENTICATED (War Room)
/dashboard   → Main war room (live feed + crisis + sidebar)
/analyse     → All analysis in one tabbed page (Trends | Audience | Intelligence | Contradictions)
/track       → Keywords + tracking setup (moved from Settings)
/data        → Raw data table (for export/research)
/report      → PDF report (opens new tab)
/god         → Admin panel (God Mode only)
