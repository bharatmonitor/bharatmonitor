// NationalDiscoursePanel — shows national political discourse data
// Runs parallel to account-specific tracking
// Uses GovernanceVibe methodology: journalist watchlist + broad keywords

import { useState } from 'react'
import { POLITICAL_WATCHLIST, NATIONAL_DISCOURSE_KEYWORDS, getNationalKeywordsForCycle } from '@/lib/nationalDiscourse'
import { ANON_KEY, SUPABASE_URL } from '@/lib/supabase'
import type { Account } from '@/types'

const mono = '"IBM Plex Mono", monospace'

interface Props {
  account: Account
  accountId: string
  onItemsIngested?: (count: number) => void
}

export default function NationalDiscoursePanel({ account, accountId, onItemsIngested }: Props) {
  const [running, setRunning]     = useState(false)
  const [lastCount, setLastCount] = useState(0)
  const [error, setError]         = useState('')
  const [expanded, setExpanded]   = useState(false)
  const [activeTab, setActiveTab] = useState<'keywords'|'watchlist'>('keywords')

  async function runNationalIngest() {
    setRunning(true)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-ingest-v2`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({
          accountId,
          politicianName: account.politician_name,
          keywords:       getNationalKeywordsForCycle(Math.floor(Date.now() / 3_600_000)), // rotates hourly
          nationalMode:   true,
          maxPerSource:   15,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setLastCount(data.inserted || 0)
        onItemsIngested?.(data.inserted || 0)
      } else {
        setError(data.error || 'Ingest failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setRunning(false)
  }

  const categories = Object.entries(NATIONAL_DISCOURSE_KEYWORDS)
  const journalistCount = POLITICAL_WATCHLIST.journalists.length
  const politicianCount = POLITICAL_WATCHLIST.politicians_tracked.length

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', cursor:'pointer', userSelect:'none' }}>
        <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#7c6dfa', flexShrink:0 }} />
        <span style={{ fontFamily:mono, fontSize:'8px', color:'#7c6dfa', letterSpacing:'1px', flex:1 }}>NATIONAL DISCOURSE</span>
        {lastCount > 0 && (
          <span style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)' }}>+{lastCount} last run</span>
        )}
        <span style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding:'0 14px 14px' }}>
          {/* Run button */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px' }}>
            <button onClick={runNationalIngest} disabled={running}
              style={{ flex:1, padding:'7px', background:running ? 'var(--s3)' : 'rgba(124,109,250,0.1)', border:'1px solid rgba(124,109,250,0.3)', borderRadius:'6px', color:'#a89ef8', fontFamily:mono, fontSize:'8px', cursor:running?'not-allowed':'pointer', letterSpacing:'0.5px' }}>
              {running ? '⚙ FETCHING NATIONAL DISCOURSE…' : '↺ FETCH NATIONAL DISCOURSE'}
            </button>
          </div>

          {error && (
            <div style={{ fontFamily:mono, fontSize:'8px', color:'var(--red)', background:'rgba(240,62,62,0.08)', padding:'6px 8px', borderRadius:'5px', marginBottom:'8px' }}>
              {error}
            </div>
          )}

          {/* Description */}
          <div style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)', lineHeight:1.8, marginBottom:'10px' }}>
            Tracks {journalistCount + politicianCount} Indian political accounts + {Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length} national keywords.
            <br />Results tagged separately from your account keywords.
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'10px', borderBottom:'1px solid var(--b0)', paddingBottom:'0' }}>
            {(['keywords', 'watchlist'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ fontFamily:mono, fontSize:'7px', padding:'4px 10px', border:'none', background:'transparent', cursor:'pointer', color:activeTab===t?'#7c6dfa':'var(--t3)', borderBottom:`1px solid ${activeTab===t?'#7c6dfa':'transparent'}`, marginBottom:'-1px', letterSpacing:'0.5px' }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {activeTab === 'keywords' && (
            <div>
              {categories.map(([category, kws]) => (
                <div key={category} style={{ marginBottom:'8px' }}>
                  <div style={{ fontFamily:mono, fontSize:'7px', color:'#7c6dfa', letterSpacing:'1px', marginBottom:'4px', textTransform:'uppercase' }}>{category}</div>
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                    {kws.map(kw => (
                      <span key={kw} style={{ fontFamily:mono, fontSize:'7px', padding:'2px 6px', background:'rgba(124,109,250,0.08)', border:'1px solid rgba(124,109,250,0.15)', borderRadius:'10px', color:'var(--t2)' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'watchlist' && (
            <div>
              <div style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)', marginBottom:'8px' }}>
                JOURNALISTS & COMMENTATORS ({journalistCount})
              </div>
              <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginBottom:'10px' }}>
                {POLITICAL_WATCHLIST.journalists.map(h => (
                  <span key={h} style={{ fontFamily:mono, fontSize:'7px', padding:'1px 5px', background:'rgba(29,155,240,0.08)', border:'1px solid rgba(29,155,240,0.15)', borderRadius:'10px', color:'#1d9bf0' }}>
                    {h}
                  </span>
                ))}
              </div>
              <div style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)', marginBottom:'6px' }}>
                POLITICAL ACCOUNTS ({politicianCount})
              </div>
              <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                {POLITICAL_WATCHLIST.politicians_tracked.map(h => (
                  <span key={h} style={{ fontFamily:mono, fontSize:'7px', padding:'1px 5px', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:'10px', color:'var(--acc)' }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
