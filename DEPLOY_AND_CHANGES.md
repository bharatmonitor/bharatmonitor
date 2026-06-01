# BharatMonitor — full buildable project (this round)

This is the complete project with all changes integrated. `npm run build` passes.

## What changed this round
- **Branding** now uses the real **India outline** (same geodata as the map) in
  `src/components/brand/BrandLogo.tsx` + `public/favicon.svg`, `public/brand/*.svg`.
- **Sign-in is NOT required.** The social gate is opt-in: `SOCIAL_GATE_ENABLED =
  false` in `src/lib/socialConnect.ts`. The app never blocks; existing tracking is
  untouched. Flip the flag to true when you want to enforce it later.
- **God Mode → per-account usage panel.** Click **📊 Usage** on any account row to
  open `AccountUsagePanel`: stored items, ingest runs, items/24h & /7d, data by
  platform, raw-vs-stored, AI-scored runs, last ingest, and today's quota consumed.
- **Ingest telemetry.** `bm-ingest-v2` now writes an `ingest_log` row per run.
- Plus prior work: chart set (`BMCharts`), India/CG choropleth (`IndiaChoropleth`),
  plan caps (`planLimits`), report light print theme.

## 1. Build locally
```bash
npm install          # restores the correct platform binaries
npm run build        # vite build -> dist/
npm run dev          # local dev
```
(If you ever see a rollup "Cannot find module @rollup/rollup-*" error, it's the
known npm optional-deps bug — delete node_modules + package-lock and reinstall.)

## 2. Supabase
Run the new SQL in the Supabase SQL editor (or via CLI):
```bash
# tables
supabase db execute -f supabase/sql/ingest_log.sql
supabase db execute -f supabase/sql/social_connections.sql   # harmless even if gate stays off
```
Redeploy the ingest function (now writes ingest_log):
```bash
supabase functions deploy bm-ingest-v2
```
No secret/env changes needed for this round (the gate is off; no OAuth yet).

## 3. Vercel
Standard flow — push to the connected git branch, or:
```bash
vercel --prod
```
Build command `npm run build`, output dir `dist` (already your config). No new env
vars required this round.

## 4. Wiring still available to you (optional, not blocking)
- Drop the charts/map/logo into pages per `docs/INTEGRATION_v2.md` &
  `docs/IMPLEMENTATION_all.md`.
- Apply the ingest body-capture patch (`docs/INGEST_PATCH.md`) when ready.
- Pass creator tier to `createAccount(data, tier)` to enforce plan caps in the UI.

## Compliance
Choropleth uses an open full-territory dataset (J&K, Ladakh, Arunachal, A&N).
Validate boundaries against Survey of India before production.
