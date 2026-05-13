# BharatMonitor — Deploy Guide
## Use this every single time you want to deploy

---

## ONE-TIME SETUP (do this once, never again)

### 1. Install Supabase CLI
```bash
brew install supabase/tap/supabase
```

### 2. Login
```bash
supabase login
```

### 3. Link project
```bash
cd ~/Downloads/bm_fixed
supabase link --project-ref ylajerluygbeiqybkgtx
```

---

## EVERY DEPLOY — COPY THESE COMMANDS

### A) Local test
```bash
cd ~/Downloads/bm_fixed
npm install
npm run dev
```
Open http://localhost:5173 ✓

### B) SQL migration (if Claude gave you a .sql file)
Supabase dashboard → SQL Editor → paste → Run

### C) Deploy edge functions
```bash
supabase functions deploy bm-ingest-v2
supabase functions deploy bm-intelligence-report
supabase functions deploy bm-contradiction-check
supabase functions deploy bm-sentiment
supabase functions deploy bm-xpoz
supabase functions deploy bm-crisis-predict
supabase functions deploy bm-opposition-research
```

### D) Set secrets (first time or when adding new ones)
```bash
supabase secrets set GEMINI_API_KEY=AIzaSyDDGVz90suk0VN9RSOkcT1brP4BC1Te7fc
supabase secrets set NEWSDATA_API_KEY=pub_e45c8942cceb4e68acf96cb8f560a540
supabase secrets set YT_API_KEY=AIzaSyBVa-IYLJ9jv-AIRa8KPcfWSejhBE7zL1w
supabase secrets set XPOZ_API_KEY=K3CdGX6jAgsWA8c87NlWbn2c5SVmKEddiTnYie2oIGhUKhvWRI1jhQeEOOqdwZKCVuyU8d1
supabase secrets set GOOGLE_CSE_KEY=AIzaSyCSp3sFwrckph-b0nNeZw4Iy04xjAzBRBY
supabase secrets set GOOGLE_CSE_CX=c6115d16294f64f6a
```

### E) Push to Vercel
```bash
git add -A
git commit -m "v31 deploy"
git push
```

---

## .env.local (create this in bm_fixed folder)

```
VITE_SUPABASE_URL=https://ylajerluygbeiqybkgtx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjA0MzksImV4cCI6MjA5MDA5NjQzOX0.ui2MqbKXl6hcAYdEGrDHA-5uriTRDobls2_rvz7RN7w
VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY
VITE_GOOGLE_CSE_KEY=AIzaSyCSp3sFwrckph-b0nNeZw4Iy04xjAzBRBY
VITE_GOOGLE_CSE_CX=c6115d16294f64f6a
VITE_YOUTUBE_KEY=AIzaSyBVa-IYLJ9jv-AIRa8KPcfWSejhBE7zL1w
VITE_XPOZ_API_KEY=K3CdGX6jAgsWA8c87NlWbn2c5SVmKEddiTnYie2oIGhUKhvWRI1jhQeEOOqdwZKCVuyU8d1
VITE_GETX_API=get-x-api-92f0194c29072683b841759fe5c0aaf296b2bc26312b340d
VITE_NEWSDATA_KEY=pub_e45c8942cceb4e68acf96cb8f560a540
VITE_GEMINI_KEY=AIzaSyDDGVz90suk0VN9RSOkcT1brP4BC1Te7fc
VITE_RESEND_KEY=re_PQoWq94d_41WT5kC1iiH8F8Gn5tAG6otw
VITE_META_ACCESS_TOKEN=EAF5yjiYcxVYBRIOZCZAId33rlA9hLgCZANK3PD9NxUIrxZCyZB8PxKLQZBMuO2llwYKZCm08qMiVuNoTYURM3aZAypUGzMjCDnouQiZCriZASP3SO8W9Sk5udgvLNdgZA2m0q9qIZBwlmoNTbPl0in12P1rIJhNk6QHZBqIiIKVjzekzNZAnCaalwjK8yMKDVVcWfH0JpXw7bu
```

---

## Vercel environment variables
Add all VITE_ keys above in Vercel → Project → Settings → Environment Variables
After adding → Redeploy

---

## Accounts
| Email | Password | Role |
|---|---|---|
| god@bharatmonitor.in | BM@God2024! | god |
| modi@bharatmonitor.in | Demo@Modi2024 | user |

---

## Quick health check (run in Terminal)
```bash
# Check ingest
curl -X POST https://ylajerluygbeiqybkgtx.supabase.co/functions/v1/bm-ingest-v2 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjA0MzksImV4cCI6MjA5MDA5NjQzOX0.ui2MqbKXl6hcAYdEGrDHA-5uriTRDobls2_rvz7RN7w" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"god-account","politicianName":"Modi","keywords":["Modi","BJP"]}'
# Expect: {"ok":true,"inserted":30+,...}

# Check XPOZ
curl -X POST https://ylajerluygbeiqybkgtx.supabase.co/functions/v1/bm-xpoz \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"accountId":"god-account","keywords":["Modi"],"mode":"count"}'
# Expect: {"ok":true,"counts":{"Modi":12450}}
```

---

## If something breaks
- **401 error** → .env.local keys not set or commented out
- **404 on function** → run supabase functions deploy [name]
- **0 items in feed** → check Supabase → Functions → bm-ingest-v2 → Logs
- **Columns empty** → browser console → look for [useFeedItems] row count
- **Build fails on Vercel** → share the error message in chat
