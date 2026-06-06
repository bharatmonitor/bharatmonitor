# Daily email (Resend) + demo robustness

## A. Daily "report is ready" email — setup walkthrough

You're on **Resend**. The function `bm-daily-digest` is built; here's how to make it live.

### 1. Verify a sending domain in Resend (required to email clients)
The current alerts use `onboarding@resend.dev`, which **only delivers to your own
Resend account email** — it will NOT reach CM-office inboxes. To send to clients:
1. Resend dashboard → **Domains → Add Domain** → enter `bharatmonitor.online`.
2. Add the DNS records Resend shows (SPF `TXT`, DKIM `CNAME`s, optional DMARC) at
   your domain registrar / Vercel DNS.
3. Wait for "Verified" (usually minutes).
4. You can now send from `reports@bharatmonitor.online`.

### 2. Set the function secrets (Supabase)
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx        # your real Resend key
supabase secrets set DIGEST_FROM="BharatMonitor <reports@bharatmonitor.online>"
supabase secrets set APP_URL="https://bharatmonitor.online"
```

### 3. Deploy the function
```bash
supabase functions deploy bm-daily-digest
```

### 4. Send yourself a test
```bash
curl -X POST "https://<PROJECT_REF>.functions.supabase.co/bm-daily-digest" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"accountId":"BM-2026-XXXX","test":true}'
```
You should get `{"ok":true,"sent":1,...}` and the email in the account's
`contact_email` inbox.

### 5. Schedule it daily
Enable **pg_cron** + **pg_net** (Dashboard → Database → Extensions), then edit
`supabase/sql/daily_digest_cron.sql` (fill in `<PROJECT_REF>` and a key) and run it.
It fires every day at 08:00 IST and emails every account that hasn't opted out.

### 6. Per-account control
- **Daily digest** is ON by default. To turn it off for an account, set
  `alert_prefs.daily_digest = false` on its `accounts` row.
- **Update notifications** (crisis / developing) already exist via `bm-alerts`,
  driven by `alert_prefs.red_email` / `alert_prefs.yellow_email`. Enable those per
  account to get real-time pings on top of the daily digest.

### Security note
`bm-alerts/index.ts` has a **hardcoded Resend key fallback** in the source. Replace
it with `Deno.env.get('RESEND_API_KEY')` only and rotate that key in Resend — a
committed key is a leak.

---

## B. What changed this round (robustness for the CM-office demo)

1. **Analyse no longer shows the Gemini 429.** `bm-intelligence-report` now catches
   any Gemini failure (quota/429/billing) and returns **computed** topic clusters +
   conclusions from the data, with `aiGenerated:false`. The page always populates.
   *(Redeploy `bm-intelligence-report`.)*
2. **Report download now carries data.** The NavBar "Report" button was opening
   `/report` with no `accountId` (new tab → no session → empty). It now passes the
   account id, so the downloaded report matches the on-screen one.
3. **CSV bucket column** exports `CRISIS / DEVELOPING / BACKGROUND / GENERAL`
   instead of `red/yellow/blue/silver`.
4. **Feed relevance gate** (previous round) keeps unrelated national news out of
   each account's columns.

## C. Pre-demo smoke test (5 minutes, do this before the meeting)
- [ ] Hard-refresh the site (Cmd-Shift-R) — confirm India-map logo, no flag, no error banners.
- [ ] Dashboard: Crisis/Developing columns show only on-topic items.
- [ ] Analyse → Generate: topics + conclusions render (even if "AI analysis pending").
- [ ] NavBar **Report** → new tab shows full data → **Save as PDF** → PDF has data.
- [ ] Data → Export CSV → Bucket column reads CRISIS/DEVELOPING/etc.
- [ ] God Mode → click an account's **📊 Usage** → panel loads.
- [ ] Send yourself the digest test email (step A4) and confirm it arrives.
- [ ] If demoing multiple accounts, switch between 2-3 and confirm each loads its own feed.

## D. Deploy everything for this round
```bash
git add -A && git commit -m "Gemini fallback, report-download fix, CSV bucket labels, daily digest" && git push origin main
supabase functions deploy bm-intelligence-report
supabase functions deploy bm-daily-digest
supabase functions deploy bm-ingest-v2          # if not already (prior round's crash fix)
```
