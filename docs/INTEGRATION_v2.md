# BharatMonitor — Chart v2 Integration Guide

Everything here is account-agnostic and runs platform-wide. Two new files + one
patch to `ReportPage.tsx`.

---

## 1. Drop in the two files

```
src/lib/chartData.ts                    ← aggregations (replaces v1)
src/components/charts/BMCharts.tsx       ← components (replaces v1)
```

Both typecheck clean against your existing `recharts` and `src/types`. No new
dependencies — `recharts` already ships `ScatterChart`/`ZAxis` for the bubble,
and the word cloud is dependency-free HTML.

---

## 2. Wire the charts (anywhere — dashboard, Analyse, Report)

```tsx
import { buildAllCharts } from '../lib/chartData'
import {
  SentimentDonut, SentimentArea, TopTopics, TopicSentiment,
  PlatformMix, KeywordCloud, TopSources, SchemeBubble, IssueOwnershipPie,
} from '../components/charts/BMCharts'

// `feed` is FeedItem[] for the current account; `account` is the Account.
const ch = buildAllCharts(feed, account)            // optional 3rd arg: issue string

<SentimentDonut    data={ch.sentiment} />
<SentimentArea     data={ch.volume} />               {/* #7 stacked pos/neu/neg */}
<TopTopics         data={ch.topics} />
<TopicSentiment    data={ch.topicSentiment} />
<PlatformMix       data={ch.platforms} />
<KeywordCloud      data={ch.cloud} />                {/* #1 word cloud */}
<TopSources        data={ch.sources} />
<SchemeBubble      data={ch.schemes} />              {/* #6 bubble */}
{ch.ownership && <IssueOwnershipPie data={ch.ownership} />}  {/* #4 pie */}
```

### Issue-ownership pie — choosing the issue
`buildAllCharts(feed, account)` auto-picks the most-discussed topic. To drive it
from a dropdown:

```tsx
const issues = ch.topics.map(t => t.name)          // dropdown options
const ownership = issueOwnership(feed, account, selectedIssue)
<IssueOwnershipPie data={ownership} />
```

Party attribution reads `account.party`, `account.politician_name`,
`account.keywords`, and each `account.tracked_politicians[].party`. Mentions with
no party match fall into "Other / Unattributed". One item can count toward
multiple parties — this is share-of-voice, not a strict partition.

> Note: ownership quality depends on body text being present (see ingest note).
> On headline-only items it will under-attribute the opposition.

---

## 3. Report — light print theme (#3)

The report currently prints on `#0d1018`. Fix is minimal because all report
colors are 13 constants used inline: point them at CSS variables, declare the
variables (dark) on the report root, and flip them under `@media print`. **No
inline styles change**, and semantic green/red/orange are preserved.

### 3a. Replace the color constants (top of `ReportPage.tsx`, lines ~13–26)

```tsx
// BEFORE: const DARK = '#0d1018'  ... etc (plain hex)
// AFTER:  point every constant at a CSS variable
const mono   = '"IBM Plex Mono", monospace'
const DARK   = 'var(--bm-bg)'
const CARD   = 'var(--bm-card)'
const CARD2  = 'var(--bm-card2)'
const BORDER = 'var(--bm-border)'        // if BORDER is a separate const, point it here too
const ACC    = 'var(--bm-acc)'
const GREEN  = 'var(--bm-grn)'
const RED    = 'var(--bm-red)'
const YELLOW = 'var(--bm-yel)'
const BLUE   = 'var(--bm-blu)'
const PURPLE = 'var(--bm-pur)'
const T0     = 'var(--bm-t0)'
const T1     = 'var(--bm-t1)'
const T2     = 'var(--bm-t2)'
const T3     = 'var(--bm-t3)'
```

### 3b. Add the `bm-report` class to the outermost report `<div>` (the `return (` at ~line 203)

```tsx
return (
  <div className="bm-report" style={{ /* keep existing styles */ }}>
    ...
```

### 3c. Replace the `<style>` print block at the bottom with this

```tsx
<style>{`
  /* ---- screen (dark) : default palette ---- */
  .bm-report {
    --bm-bg:#0d1018; --bm-card:#111827; --bm-card2:#161d2c;
    --bm-border:rgba(255,255,255,0.08);
    --bm-acc:#f97316; --bm-grn:#22d3a0; --bm-red:#f03e3e; --bm-yel:#f5a623;
    --bm-blu:#3d8ef0; --bm-pur:#7c6dfa;
    --bm-t0:#edf0f8; --bm-t1:#c8d0e0; --bm-t2:#8892a4; --bm-t3:#545f78;
  }

  @media print {
    .no-print { display: none !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    @page { margin: 12mm; size: A4; }              /* white page, no dark bg */
    html, body { background:#ffffff !important; }

    /* ---- print (light document) : same variables, repainted ---- */
    .bm-report {
      --bm-bg:#ffffff; --bm-card:#ffffff; --bm-card2:#f4f6fa;
      --bm-border:#e4e8f0;
      /* semantic colors kept, nudged darker for white-paper contrast */
      --bm-acc:#e0680f; --bm-grn:#0f9d6e; --bm-red:#cf2b2b; --bm-yel:#c98410;
      --bm-blu:#2a6fc4; --bm-pur:#5a4ad1;
      --bm-t0:#11161f; --bm-t1:#1f2733; --bm-t2:#4a5568; --bm-t3:#7a8597;
      background:#ffffff !important;
    }
    .bm-report section, .bm-report [data-section] { break-inside: avoid; }
  }
`}</style>
```

That's the whole fix: dark on screen, clean white A4 on print/Save-as-PDF, colors
intact. If you later swap the report's CSS `<div>`-bars for the `BMCharts`
components, give each Recharts container an explicit pixel `height` (not `%`)
inside `@media print` or it collapses to zero in the print canvas.

---

## 4. Poster re-review — other parts worth upgrading later (#2)

Quick wins from the 100-ways set, in priority order, none urgent:

- **Crisis line → add a control band (#57).** Same data, add a faint ±range
  band; "abnormal" becomes visual instead of guesswork. Cheap.
- **Keyword coverage gaps → lollipop (#93).** Where you list keywords with ~0
  mentions, the dot-on-stick makes the zeros the story. Cheap.
- **Geo bar → district choropleth (#21)** for Chhattisgarh. High demo value,
  needs district topojson — the one "later, not now" item.
- **Personas stay grouped bar (#94)** — already correct, no change.

Everything else in the current build maps to the right chart already.
