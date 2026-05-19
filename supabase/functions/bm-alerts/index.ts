// supabase/functions/bm-alerts/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// BharatMonitor Alert System
// Sends: Email (Resend) + SMS (Fast2SMS/Twilio) + WhatsApp (Twilio)
//
// Called automatically by bm-ingest-v2 when crisis items are found
// OR called manually from dashboard
//
// Respects per-account alert_prefs:
//   red_email:  send email on crisis (bucket=red)
//   red_sms:    send SMS on crisis
//   red_push:   (future: push notifications)
//   yellow_email: send email on developing stories
//
// Rate limit: max 3 alerts per account per hour (stored in alerts_sent table)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? 're_PQoWq94d_41WT5kC1iiH8F8Gn5tAG6otw'

// SMS providers (set one)
const FAST2SMS_KEY     = Deno.env.get('FAST2SMS_KEY') ?? ''       // Indian, cheapest
const TWILIO_SID       = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_FROM      = Deno.env.get('TWILIO_PHONE') ?? ''        // +1234567890
const TWILIO_WA_FROM   = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886' // Sandbox

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Content-Type': 'application/json',
}

// ─── Email via Resend ─────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) { console.warn('[Alert] No Resend key'); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BharatMonitor Alerts <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const d = await res.json()
    if (!res.ok) { console.warn('[Alert] Email failed:', d); return false }
    console.log('[Alert] Email sent to', to, 'id:', d.id)
    return true
  } catch (e: any) { console.warn('[Alert] Email error:', e.message); return false }
}

// ─── SMS via Fast2SMS (India, cheapest) ───────────────────────────────────────
async function sendSMSFast2SMS(phone: string, message: string): Promise<boolean> {
  if (!FAST2SMS_KEY) return false
  try {
    // Remove +91 or 91 prefix
    const cleanPhone = phone.replace(/^\+?91/, '').replace(/\D/g, '')
    const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_KEY}&message=${encodeURIComponent(message)}&language=english&route=q&numbers=${cleanPhone}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })
    const d = await res.json()
    if (!d.return) { console.warn('[Alert] Fast2SMS failed:', d.message); return false }
    console.log('[Alert] SMS sent via Fast2SMS to', cleanPhone)
    return true
  } catch (e: any) { console.warn('[Alert] Fast2SMS error:', e.message); return false }
}

// ─── SMS via Twilio ───────────────────────────────────────────────────────────
async function sendSMSTwilio(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return false
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: phone, Body: message }).toString(),
      signal: AbortSignal.timeout(10_000),
    })
    const d = await res.json()
    if (!res.ok) { console.warn('[Alert] Twilio SMS failed:', d.message); return false }
    console.log('[Alert] SMS sent via Twilio to', phone, 'sid:', d.sid)
    return true
  } catch (e: any) { console.warn('[Alert] Twilio SMS error:', e.message); return false }
}

// ─── WhatsApp via Twilio ──────────────────────────────────────────────────────
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return false
  try {
    const waTo = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone.startsWith('+') ? phone : '+91' + phone}`
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: TWILIO_WA_FROM, To: waTo, Body: message }).toString(),
      signal: AbortSignal.timeout(10_000),
    })
    const d = await res.json()
    if (!res.ok) { console.warn('[Alert] WhatsApp failed:', d.message); return false }
    console.log('[Alert] WhatsApp sent to', phone)
    return true
  } catch (e: any) { console.warn('[Alert] WhatsApp error:', e.message); return false }
}

// ─── Combined SMS sender (tries Fast2SMS first, then Twilio) ──────────────────
async function sendSMS(phone: string, message: string): Promise<boolean> {
  if (await sendSMSFast2SMS(phone, message)) return true
  return sendSMSTwilio(phone, message)
}

// ─── Rate limit check ─────────────────────────────────────────────────────────
async function isRateLimited(accountId: string, channel: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await db.from('bm_alert_log')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('channel', channel)
    .gte('sent_at', oneHourAgo)
  return (count || 0) >= 3  // max 3 per channel per hour
}

async function logAlert(accountId: string, channel: string, headline: string) {
  await db.from('bm_alert_log').insert({
    account_id: accountId, channel, headline: headline.slice(0, 200),
    sent_at: new Date().toISOString(),
  }).then(() => {})
}

// ─── Build email HTML ─────────────────────────────────────────────────────────
function buildEmailHTML(items: any[], politicianName: string, bucket: string): string {
  const isRed = bucket === 'red'
  const color = isRed ? '#f03e3e' : '#f5a623'
  const label = isRed ? '🔴 CRISIS ALERT' : '🟡 DEVELOPING STORY'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1018;font-family:'Courier New',monospace;color:#edf0f8">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#111827;border:1px solid ${color}40;border-radius:12px;overflow:hidden">
      <!-- Header -->
      <div style="background:${color}15;border-bottom:1px solid ${color}30;padding:20px 24px">
        <div style="font-size:10px;color:${color};letter-spacing:2px;margin-bottom:6px">BHARATMONITOR · ${label}</div>
        <div style="font-size:18px;font-weight:700;color:#edf0f8">${politicianName} — ${isRed ? 'Crisis Detected' : 'Story Developing'}</div>
        <div style="font-size:10px;color:#545f78;margin-top:4px">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
      </div>
      <!-- Items -->
      <div style="padding:20px 24px">
        ${items.slice(0, 5).map(item => `
          <div style="background:#161d2c;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:14px;margin-bottom:10px">
            <div style="font-size:12px;color:#c8d0e0;line-height:1.5;margin-bottom:6px">${item.headline || item.title || ''}</div>
            <div style="display:flex;gap:12px;align-items:center">
              <span style="font-size:9px;color:#8892a4">${item.source || ''}</span>
              <span style="font-size:9px;color:#545f78">${item.published_at ? new Date(item.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''}</span>
            </div>
            ${item.url ? `<a href="${item.url}" style="display:inline-block;margin-top:8px;font-size:9px;color:#3d8ef0;text-decoration:none">View source →</a>` : ''}
          </div>
        `).join('')}
      </div>
      <!-- Footer -->
      <div style="border-top:1px solid rgba(255,255,255,0.07);padding:16px 24px;text-align:center">
        <a href="https://bharatmonitor.vercel.app/dashboard" style="display:inline-block;padding:10px 24px;background:${color}20;border:1px solid ${color}50;border-radius:8px;color:${color};font-size:10px;font-weight:700;text-decoration:none;letter-spacing:1px">OPEN WAR ROOM →</a>
        <div style="font-size:8px;color:#545f78;margin-top:12px">BharatMonitor · Political Intelligence Platform · To unsubscribe, update alert settings in your account.</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let body: any = {}
  try { body = await req.json() } catch { /* no body */ }

  const {
    accountId,          // required
    items = [],         // crisis/yellow items to alert about
    bucket = 'red',     // 'red' | 'yellow'
    test = false,       // if true, send test alert
  } = body

  if (!accountId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing accountId' }), { headers: CORS, status: 400 })
  }

  // Load account + alert prefs
  const { data: account } = await db.from('accounts')
    .select('id, politician_name, contact_email, contact_phone, alert_prefs')
    .eq('id', accountId)
    .maybeSingle()

  if (!account) {
    return new Response(JSON.stringify({ ok: false, error: 'Account not found' }), { headers: CORS, status: 404 })
  }

  const prefs = account.alert_prefs || {}
  const name  = account.politician_name || 'Politician'
  const email = account.contact_email
  const phone = account.contact_phone

  // For test mode, override with dummy items
  const alertItems = test ? [{
    headline: 'Test alert: BharatMonitor notification system is working correctly.',
    source: 'BharatMonitor Test',
    published_at: new Date().toISOString(),
    url: 'https://bharatmonitor.vercel.app/dashboard',
  }] : items

  if (!alertItems.length && !test) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No items to alert' }), { headers: CORS })
  }

  const sent: string[] = []
  const failed: string[] = []

  // ── Email ──
  const wantsEmail = (bucket === 'red' && prefs.red_email) || (bucket === 'yellow' && prefs.yellow_email) || test
  if (wantsEmail && email) {
    const limited = !test && await isRateLimited(accountId, 'email')
    if (!limited) {
      const subject = bucket === 'red'
        ? `🔴 CRISIS ALERT — ${name} — BharatMonitor`
        : `🟡 Developing Story — ${name} — BharatMonitor`
      const html = buildEmailHTML(alertItems, name, bucket)
      const ok = await sendEmail(email, subject, html)
      if (ok) {
        sent.push('email')
        await logAlert(accountId, 'email', alertItems[0]?.headline || 'Alert')
      } else failed.push('email')
    } else { console.log('[Alert] Email rate limited for', accountId) }
  }

  // ── SMS ──
  const wantsSMS = (bucket === 'red' && prefs.red_sms) || test
  if (wantsSMS && phone) {
    const limited = !test && await isRateLimited(accountId, 'sms')
    if (!limited) {
      const topItem = alertItems[0]
      const msg = bucket === 'red'
        ? `BHARATMONITOR CRISIS\n${name}: ${(topItem?.headline || '').slice(0, 100)}\n${topItem?.source || ''}\nbharatmonitor.vercel.app`
        : `BharatMonitor Alert\n${name}: ${(topItem?.headline || '').slice(0, 120)}\nbharatmonitor.vercel.app`
      const ok = await sendSMS(phone, msg)
      if (ok) {
        sent.push('sms')
        await logAlert(accountId, 'sms', topItem?.headline || 'Alert')
      } else failed.push('sms')
    }
  }

  // ── WhatsApp ──
  const wantsWA = (bucket === 'red' && prefs.red_sms) || test  // WhatsApp tied to red_sms pref
  if (wantsWA && phone && (TWILIO_SID || test)) {
    const limited = !test && await isRateLimited(accountId, 'whatsapp')
    if (!limited) {
      const topItem = alertItems[0]
      const msg = `*BharatMonitor ${bucket === 'red' ? '🔴 CRISIS' : '🟡 ALERT'}*\n\n*${name}*\n\n${(topItem?.headline || '').slice(0, 200)}\n\n_${topItem?.source || ''}_\n\nhttps://bharatmonitor.vercel.app/dashboard`
      const ok = await sendWhatsApp(phone, msg)
      if (ok) {
        sent.push('whatsapp')
        await logAlert(accountId, 'whatsapp', topItem?.headline || 'Alert')
      } else failed.push('whatsapp')
    }
  }

  console.log(`[bm-alerts] accountId=${accountId} sent=[${sent.join(',')}] failed=[${failed.join(',')}]`)

  return new Response(JSON.stringify({
    ok: true,
    sent,
    failed,
    channels_configured: {
      email: !!email && !!RESEND_KEY,
      sms: !!(phone && (FAST2SMS_KEY || TWILIO_SID)),
      whatsapp: !!(phone && TWILIO_SID),
    },
  }), { headers: CORS })
})
