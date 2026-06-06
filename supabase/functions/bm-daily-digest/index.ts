// bm-daily-digest — sends a daily "your report is ready" email per account (Resend).
// Trigger: scheduled daily via pg_cron (see supabase/sql/daily_digest_cron.sql),
// or POST { accountId, test:true } to send a single test.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// Use a verified domain sender so client inboxes (CM offices) receive it.
// onboarding@resend.dev only delivers to the Resend account owner.
const FROM       = Deno.env.get('DIGEST_FROM') ?? 'BharatMonitor <reports@bharatmonitor.online>'
const APP_URL    = Deno.env.get('APP_URL') ?? 'https://bharatmonitor.online'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) { console.warn('[digest] no RESEND_API_KEY'); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    })
    const d = await res.json()
    if (!res.ok) { console.warn('[digest] email failed:', JSON.stringify(d)); return false }
    return true
  } catch (e: any) { console.warn('[digest] email error:', e.message); return false }
}

function digestHTML(name: string, stats: any, reportUrl: string): string {
  const row = (label: string, val: string | number, color = '#11161f') =>
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:${color};font-size:13px">${val}</td></tr>`
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0d1018;border-radius:12px 12px 0 0;padding:20px 24px">
      <span style="color:#edf0f8;font-size:18px;font-weight:700;letter-spacing:.5px">Bharat<span style="color:#f97316">Monitor</span></span>
    </div>
    <div style="background:#fff;border:1px solid #e4e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <h1 style="font-size:17px;color:#11161f;margin:0 0 4px">Your daily report is ready</h1>
      <p style="color:#6b7280;font-size:13px;margin:0 0 18px">${name} · last 24 hours</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${row('Total mentions', stats.total)}
        ${row('Crisis signals', stats.crisis, stats.crisis > 0 ? '#cf2b2b' : '#11161f')}
        ${row('Developing', stats.developing, '#c98410')}
        ${row('Net sentiment', stats.sentiment + '%', stats.sentiment >= 50 ? '#0f9d6e' : '#cf2b2b')}
      </table>
      ${stats.topHeadline ? `<p style="font-size:13px;color:#11161f;border-left:3px solid #f97316;padding-left:10px;margin:0 0 20px">${stats.topHeadline}</p>` : ''}
      <a href="${reportUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px">View full report →</a>
      <p style="color:#9aa3b8;font-size:11px;margin:22px 0 0">You're receiving this because daily updates are enabled for this account.</p>
    </div>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  let body: any = {}
  try { body = await req.json() } catch {}
  const { accountId, test } = body

  // Which accounts to send to
  let q = db.from('accounts').select('id, politician_name, contact_email, email, alert_prefs')
  if (accountId) q = q.eq('id', accountId)
  const { data: accounts, error } = await q
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: CORS })

  const since = new Date(Date.now() - 864e5).toISOString()
  let sent = 0, skipped = 0
  for (const a of accounts ?? []) {
    const to = a.contact_email || a.email
    const wantsDigest = test || a.alert_prefs?.daily_digest !== false   // default ON unless explicitly disabled
    if (!to || !wantsDigest) { skipped++; continue }

    const { data: items } = await db.from('bm_feed')
      .select('headline, bucket, sentiment').eq('account_id', a.id).gte('published_at', since).limit(500)
    const list = items ?? []
    const crisis = list.filter((i) => i.bucket === 'red').length
    const developing = list.filter((i) => i.bucket === 'yellow').length
    const pos = list.filter((i) => i.sentiment === 'positive').length
    const neg = list.filter((i) => i.sentiment === 'negative').length
    const sentiment = (pos + neg) ? Math.round((pos / (pos + neg)) * 100) : 50
    const topHeadline = (list.find((i) => i.bucket === 'red') || list[0])?.headline || ''
    const stats = { total: list.length, crisis, developing, sentiment, topHeadline }
    const reportUrl = `${APP_URL}/report?accountId=${encodeURIComponent(a.id)}`

    const ok = await sendEmail(to, `BharatMonitor — Daily report ready (${a.politician_name || a.id})`, digestHTML(a.politician_name || 'Your account', stats, reportUrl))
    ok ? sent++ : skipped++
  }
  return new Response(JSON.stringify({ ok: true, sent, skipped, accounts: accounts?.length ?? 0 }), { headers: CORS })
})
