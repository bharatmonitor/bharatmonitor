// FeedDetailPanel — slide-in right drawer for full item detail.
// Users stay on the portal. The only way to leave is an explicit
// "Open original source" button that opens in a new tab.
// NOW includes: on-demand AI contradiction check button.

import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/store'
import { useCheckSingleItem } from '@/hooks/useData'
import type { FeedItem } from '@/types'

interface Props {
  trackedPoliticianNames?: string[]
  accountId?: string
}

const selectSelectedItem = (s: ReturnType<typeof useDashboardStore.getState>) => s.selectedItem
const selectCloseItem    = (s: ReturnType<typeof useDashboardStore.getState>) => s.closeItem

const PLAT_COLOR: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2',
  whatsapp: '#25d366', youtube: '#ff2020', news: '#8892a4', reddit: '#ff4500',
}
const PLAT_ICON: Record<string, string> = {
  twitter: '𝕏', instagram: '📷', facebook: 'f', whatsapp: '💬',
  youtube: '▶', news: '📰', reddit: '🔴',
}
const SENT_COLOR: Record<string, string> = {
  positive: '#22d3a0', negative: '#f03e3e', neutral: '#8892a4',
}
const BUCKET_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  red:    { bg: 'rgba(240,62,62,0.12)',   fg: '#f03e3e', label: '● CRISIS'     },
  yellow: { bg: 'rgba(245,166,35,0.12)',  fg: '#f5a623', label: '● DEVELOPING' },
  blue:   { bg: 'rgba(61,142,240,0.12)',  fg: '#3d8ef0', label: '● POSITIVE'   },
  silver: { bg: 'rgba(136,146,164,0.1)',  fg: '#8892a4', label: '● ARCHIVE'    },
}

const mono = 'IBM Plex Mono, monospace'

export default function FeedDetailPanel({ trackedPoliticianNames = [], accountId = '' }: Props) {
  const item      = useDashboardStore(selectSelectedItem)
  const closeItem = useDashboardStore(selectCloseItem)

  const checkItem = useCheckSingleItem(accountId, trackedPoliticianNames)
  const [checkResult, setCheckResult] = useState<any>(null)
  const [checkRan, setCheckRan] = useState(false)

  // Reset state when a new item is opened
  useEffect(() => {
    setCheckResult(null)
    setCheckRan(false)
  }, [item?.id])

  useEffect(() => {
    if (!item) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeItem() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [item, closeItem])

  if (!item) return null

  const bucket    = BUCKET_COLOR[item.bucket] ?? BUCKET_COLOR.silver
  const platColor = PLAT_COLOR[item.platform] ?? '#8892a4'
  const platIcon  = PLAT_ICON[item.platform]  ?? '●'
  const sentColor = SENT_COLOR[item.sentiment] ?? '#8892a4'

  const date    = new Date(item.published_at)
  const dateStr = isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const isXPost       = item.platform === 'twitter'
  const isGoogleXPost = item.id.startsWith('gx-')

  const canCheckContradiction = trackedPoliticianNames.length > 0 && accountId

  function handleCheckContradiction() {
    if (!canCheckContradiction) return
    setCheckRan(true)
    checkItem.mutate(item!, {
      onSuccess: (result) => {
        setCheckResult(result)
      },
    })
  }

  // Merge detected check result into displayed contradiction
  const displayedContradiction = checkResult || item.contradiction

  return (
    <>
      <div
        onClick={closeItem}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 900, backdropFilter: 'blur(2px)',
          animation: 'fadeIn .18s ease',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)',
        background: 'var(--s1)',
        borderLeft: '1px solid var(--b1)',
        zIndex: 901,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .22s cubic-bezier(.25,.46,.45,.94)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--b1)',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--s2)', flexShrink: 0,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: platColor + '18', border: `1px solid ${platColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isXPost ? '14px' : '16px', color: platColor, flexShrink: 0,
          }}>
            {platIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: mono, fontSize: '10px', color: platColor, fontWeight: 600, letterSpacing: '0.5px' }}>
              {item.platform.toUpperCase()}
              {isGoogleXPost && <span style={{ color: '#8892a4', fontWeight: 400 }}> · via Google Index</span>}
            </div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.source} {dateStr && `· ${dateStr}`}
            </div>
          </div>
          <button onClick={closeItem} style={{
            background: 'none', border: '1px solid var(--b1)', borderRadius: '5px',
            color: 'var(--t2)', cursor: 'pointer', padding: '4px 8px',
            fontFamily: mono, fontSize: '10px', flexShrink: 0,
          }}>✕</button>
        </div>

        {/* ── Badges row ── */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--b0)',
          display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0,
          background: 'var(--s2)',
        }}>
          <span style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: bucket.bg, color: bucket.fg, border: `1px solid ${bucket.fg}30` }}>
            {bucket.label}
          </span>
          <span style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: sentColor + '18', color: sentColor, border: `1px solid ${sentColor}30` }}>
            {item.sentiment.toUpperCase()}
          </span>
          {item.language !== 'english' && (
            <span style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--b1)' }}>
              {item.language.toUpperCase()}
            </span>
          )}
          {item.keyword && (
            <span style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(124,109,250,0.1)', color: '#a89ef8', border: '1px solid rgba(124,109,250,0.2)' }}>
              #{item.keyword}
            </span>
          )}
          {item.is_trending && (
            <span style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(240,62,62,0.1)', color: '#f03e3e', border: '1px solid rgba(240,62,62,0.25)' }}>
              🔥 TRENDING
            </span>
          )}
          {displayedContradiction && (
            <span style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,166,35,0.12)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)' }}>
              ⚡ CONTRADICTION
            </span>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t0)', lineHeight: 1.5, marginBottom: '12px', margin: '0 0 12px 0' }}>
            {item.headline}
          </h2>

          {item.body && item.body !== item.headline && (
            <div style={{
              fontSize: '12px', color: 'var(--t1)', lineHeight: 1.7,
              padding: '12px', background: 'var(--s2)', borderRadius: '8px',
              border: '1px solid var(--b0)', marginBottom: '14px',
            }}>
              {item.body}
            </div>
          )}

          {item.ai_summary && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '5px' }}>◈ AI SUMMARY</div>
              <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.6, padding: '10px', background: 'rgba(124,109,250,0.05)', borderRadius: '7px', border: '1px solid rgba(124,109,250,0.15)' }}>
                {item.ai_summary}
              </div>
            </div>
          )}

          {/* ── AI Contradiction Checker Button ── */}
          {canCheckContradiction && !displayedContradiction && (
            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={handleCheckContradiction}
                disabled={checkItem.isPending}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: checkItem.isPending ? 'var(--s3)' : 'rgba(245,166,35,0.08)',
                  border: '1px solid rgba(245,166,35,0.25)',
                  color: checkItem.isPending ? 'var(--t3)' : '#f5a623',
                  fontFamily: mono, fontSize: '9px', fontWeight: 600,
                  cursor: checkItem.isPending ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                  transition: 'all .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                }}
              >
                {checkItem.isPending ? (
                  <>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #f5a623', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                    SCANNING HISTORICAL RECORD…
                  </>
                ) : checkRan && !checkResult ? (
                  '✓ NO CONTRADICTION FOUND IN 5-YEAR RECORD'
                ) : (
                  '⚡ CHECK FOR CONTRADICTIONS (5-YEAR RECORD)'
                )}
              </button>
              {checkRan && !checkResult && !checkItem.isPending && (
                <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', textAlign: 'center', marginTop: '5px' }}>
                  AI scanned historical statements — no flip or contradiction detected
                </div>
              )}
            </div>
          )}

          {/* ── Contradiction block ── */}
          {displayedContradiction && (
            <div style={{
              padding: '14px', borderRadius: '10px', marginBottom: '14px',
              background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)',
            }}>
              <div style={{ fontFamily: mono, fontSize: '8px', color: '#f5a623', marginBottom: '8px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚡ {(displayedContradiction as any).contradiction_type ?? (displayedContradiction as any).contradictionType ?? "contradiction" === 'flip' ? 'POSITION FLIP DETECTED' : (displayedContradiction as any).contradiction_type ?? (displayedContradiction as any).contradictionType ?? "contradiction" === 'vote_record' ? 'VOTE RECORD CONTRADICTION' : (displayedContradiction as any).contradiction_type ?? (displayedContradiction as any).contradictionType ?? "contradiction" === 'data_gap' ? 'DATA GAP DETECTED' : 'CONTRADICTION DETECTED'}</span>
                <span style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: '3px', background: 'rgba(245,166,35,0.15)', fontWeight: 700 }}>
                  {(displayedContradiction as any).contradiction_score ?? (displayedContradiction as any).contradictionScore ?? 0}%
                </span>
              </div>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginBottom: '5px', letterSpacing: '0.5px' }}>HISTORICAL RECORD:</div>
              <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.6, marginBottom: '5px' }}>
                <span style={{ color: 'var(--t3)' }}>{((displayedContradiction as any).historical_date ?? (displayedContradiction as any).historicalDate ?? "" || '').substring(0, 7)}:</span>{' '}
                "{(displayedContradiction as any).historical_quote ?? (displayedContradiction as any).historicalQuote ?? ""}"
              </div>
              {(displayedContradiction as any).historical_source ?? (displayedContradiction as any).historicalSource && (
                <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>— {(displayedContradiction as any).historical_source ?? (displayedContradiction as any).historicalSource}</div>
              )}
              {/* Reasoning (from AI check) */}
              {((displayedContradiction as any).reasoning) && (
                <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(245,166,35,0.05)', borderRadius: '5px', border: '1px solid rgba(245,166,35,0.12)' }}>
                  <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginBottom: '3px' }}>AI REASONING:</div>
                  <div style={{ fontSize: '10px', color: 'var(--t2)', lineHeight: 1.5 }}>
                    {(displayedContradiction as any).reasoning}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Geo tags */}
          {item.geo_tags?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '5px' }}>GEO SIGNALS</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {item.geo_tags.map(t => (
                  <span key={t} style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', borderRadius: '3px', background: 'rgba(124,109,250,0.1)', color: '#a89ef8', border: '1px solid rgba(124,109,250,0.2)' }}>📍 {t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Topic tags */}
          {item.topic_tags?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '5px' }}>TOPICS</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {item.topic_tags.map(t => (
                  <span key={t} style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', borderRadius: '3px', background: 'rgba(34,211,160,0.1)', color: 'var(--grn)', border: '1px solid rgba(34,211,160,0.2)' }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {(item.entities?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '5px' }}>ENTITIES DETECTED</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {(item.entities ?? []).map(e => (
                  <span key={e} style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', borderRadius: '3px', background: 'var(--s3)', color: 'var(--t1)', border: '1px solid var(--b1)' }}>👤 {e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Engagement stats */}
          {(item.views || item.shares || item.engagement) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'VIEWS',      value: item.views      ?? 0 },
                { label: 'SHARES',     value: item.shares     ?? 0 },
                { label: 'ENGAGEMENT', value: item.engagement ?? 0 },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--s2)', border: '1px solid var(--b0)', borderRadius: '7px', padding: '9px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '3px' }}>{s.label}</div>
                  <div style={{ fontFamily: mono, fontSize: '14px', fontWeight: 700, color: 'var(--t0)' }}>
                    {s.value > 999999 ? `${(s.value/1000000).toFixed(1)}M` : s.value > 999 ? `${(s.value/1000).toFixed(0)}K` : s.value || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Opp risk score */}
          {item.opp_risk !== undefined && item.opp_risk > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '5px' }}>OPPOSITION ATTACK RISK</div>
              <div style={{ height: '6px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.opp_risk}%`, background: item.opp_risk > 70 ? '#f03e3e' : item.opp_risk > 40 ? '#f5a623' : '#22d3a0', borderRadius: '3px', transition: 'width .4s' }} />
              </div>
              <div style={{ fontFamily: mono, fontSize: '8px', color: item.opp_risk > 70 ? '#f03e3e' : item.opp_risk > 40 ? '#f5a623' : '#22d3a0', marginTop: '3px' }}>
                {item.opp_risk}% risk score
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--b1)',
          background: 'var(--s2)', flexShrink: 0,
          display: 'flex', gap: '8px', alignItems: 'center',
        }}>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '9px 14px', borderRadius: '7px',
                background: platColor + '18', border: `1px solid ${platColor}40`,
                color: platColor, textDecoration: 'none',
                fontFamily: mono, fontSize: '9px', fontWeight: 600, letterSpacing: '0.5px',
                transition: 'all .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = platColor + '28')}
              onMouseLeave={e => (e.currentTarget.style.background = platColor + '18')}>
              {platIcon} OPEN ORIGINAL SOURCE ↗
            </a>
          ) : (
            <div style={{ flex: 1, fontFamily: mono, fontSize: '8px', color: 'var(--t3)', textAlign: 'center' }}>No source URL available</div>
          )}
          <button onClick={closeItem} style={{
            padding: '9px 14px', borderRadius: '7px', border: '1px solid var(--b1)',
            background: 'transparent', color: 'var(--t2)', cursor: 'pointer',
            fontFamily: mono, fontSize: '9px',
          }}>CLOSE</button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
