# BharatMonitor

Political and ministry intelligence platform for India. Real-time tracking across 83 Indian publications, Twitter, YouTube, Instagram and social media.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Login credentials

| Account | Email | Password | Tier |
|---------|-------|----------|------|
| Narendra Modi / BJP | modi@bharatmonitor.in | modi1234 | Elections |
| Rekha Gupta / Delhi CM | rekha@bharatmonitor.in | rekha1234 | Advanced |
| Sushant Shukla / CG MLA | sushant@bharatmonitor.in | ss1234 | Basic |
| Indian Railways | railways@bharatmonitor.in | rail1234 | Ministry |
| God Mode / Admin | god@bharatmonitor.in | god1234 | Admin |

## Environment variables needed for Vercel

```
VITE_SUPABASE_URL=https://ylajerluygbeiqybkgtx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable___PNm7MXlZIeRitNp070Rw_JTV2rT2d
```

## Backend setup

```bash
brew install supabase/tap/supabase
supabase login
bash setup-supabase.sh
```

Built by Hertz MSC · ankit@hertzmsc.com
