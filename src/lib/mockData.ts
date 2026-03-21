import type {
  Account, FeedItem, AIBrief, TrendMetric,
  ConstituencyPulse, CompetitorSummary, SchemeSentiment,
  IssueOwnershipPoint, StateConversationVolume
} from '@/types'

// ─── THREE POLITICAL ACCOUNTS ────────────────────────────────────────────────

export const BASIC_ACCOUNT: Account = {
  id: 'demo-basic', user_id: 'user-basic', created_by: 'god-001', is_active: true,
  politician_name: 'Vishwa Vijay Tomar', politician_initials: 'VT', party: 'BJP',
  designation: 'MLA, Gwalior East', constituency: 'Gwalior East',
  constituency_type: 'vidhan_sabha', state: 'Madhya Pradesh', district: 'Gwalior',
  keywords: ['Gwalior', 'BJP MLA', 'Tomar', 'Gwalior development', 'MP Gwalior'],
  tracked_politicians: [
    { id: 'tp1', name: 'Congress MLA Gwalior', party: 'INC', initials: 'IC', role: 'Opposition MLA', is_competitor: true },
  ],
  tracked_ministries: ['Rural Development'], tracked_parties: ['INC', 'AAP', 'BSP'],
  tracked_schemes: ['PM Awas Yojana', 'MGNREGA'],
  languages: ['hindi', 'english'],
  geo_scope: [{ level: 'constituency', name: 'Gwalior East', state: 'Madhya Pradesh' }],
  alert_prefs: { red_sms: false, red_push: false, red_email: true, yellow_push: false, yellow_email: false },
  contact_email: 'ops@basic-demo.in', created_at: '2024-01-15T10:00:00Z', updated_at: new Date().toISOString(),
}

export const ADVANCED_ACCOUNT: Account = {
  id: 'demo-advanced', user_id: 'user-advanced', created_by: 'god-001', is_active: true,
  politician_name: 'Rekha Gupta', politician_initials: 'RG', party: 'BJP',
  designation: 'Chief Minister, Delhi', constituency: 'Shalimar Bagh',
  constituency_type: 'vidhan_sabha', state: 'Delhi', district: 'North West Delhi',
  keywords: ['Rekha Gupta', 'Delhi CM', 'BJP Delhi', 'Delhi governance', 'Shalimar Bagh'],
  tracked_politicians: [
    { id: 'tp1', name: 'Arvind Kejriwal', party: 'AAP', initials: 'AK', role: 'Former CM Delhi', is_competitor: true },
    { id: 'tp2', name: 'Atishi', party: 'AAP', initials: 'AT', role: 'AAP Leader', is_competitor: true },
    { id: 'tp3', name: 'Sandeep Dikshit', party: 'INC', initials: 'SD', role: 'INC Delhi', is_competitor: true },
  ],
  tracked_ministries: ['Home Affairs', 'Urban Development'],
  tracked_parties: ['AAP', 'INC', 'BSP'],
  tracked_schemes: ['PM Awas Yojana', 'Ayushman Bharat'],
  languages: ['hindi', 'english', 'punjabi'],
  geo_scope: [{ level: 'state', name: 'Delhi' }],
  alert_prefs: { red_sms: false, red_push: true, red_email: true, yellow_push: true, yellow_email: false },
  contact_email: 'ops@advanced-demo.in', created_at: '2024-01-15T10:00:00Z', updated_at: new Date().toISOString(),
}

export const DEMO_ACCOUNT: Account = {
  id: 'demo-001', user_id: 'user-001', created_by: 'god-001', is_active: true,
  politician_name: 'Narendra Modi', politician_initials: 'NM', party: 'BJP',
  designation: 'Prime Minister of India', constituency: 'Varanasi',
  constituency_type: 'lok_sabha', state: 'Uttar Pradesh', district: 'Varanasi',
  keywords: ['Viksit Bharat', 'PM Modi', 'BJP', 'Varanasi', 'Make in India', 'Digital India', 'NDA'],
  tracked_politicians: [
    { id: 'tp1', name: 'Rahul Gandhi', party: 'INC', initials: 'RG', role: 'Leader of Opposition', is_competitor: true },
    { id: 'tp2', name: 'Arvind Kejriwal', party: 'AAP', initials: 'AK', role: 'Former CM Delhi', is_competitor: true },
    { id: 'tp3', name: 'Mamata Banerjee', party: 'TMC', initials: 'MB', role: 'CM West Bengal', is_competitor: true },
    { id: 'tp4', name: 'Akhilesh Yadav', party: 'SP', initials: 'AY', role: 'President SP', is_competitor: true },
  ],
  tracked_ministries: ['Finance', 'Home Affairs', 'External Affairs', 'Defence'],
  tracked_parties: ['INC', 'AAP', 'TMC', 'SP', 'BSP'],
  tracked_schemes: ['PM Awas Yojana', 'PM Kisan', 'Ujjwala', 'Ayushman Bharat', 'Make in India'],
  languages: ['english', 'hindi', 'gujarati', 'marathi', 'punjabi'],
  geo_scope: [{ level: 'national', name: 'India' }],
  alert_prefs: { red_sms: true, red_push: true, red_email: true, yellow_push: true, yellow_email: false },
  contact_email: 'ops@bjpdemo.in', created_at: '2024-01-15T10:00:00Z', updated_at: new Date().toISOString(),
}

// BASIC — Sushant Shukla, MLA Chhattisgarh
export const SUSHANT_ACCOUNT: Account = {
  id: 'demo-sushant', user_id: 'user-sushant', created_by: 'god-001', is_active: true,
  politician_name: 'Sushant Shukla', politician_initials: 'SS', party: 'BJP',
  designation: 'MLA, Raipur West', constituency: 'Raipur West',
  constituency_type: 'vidhan_sabha', state: 'Chhattisgarh', district: 'Raipur',
  keywords: ['Sushant Shukla', 'Raipur BJP', 'Chhattisgarh BJP', 'Raipur West', 'Chhattisgarh development'],
  tracked_politicians: [
    { id: 'tp1', name: 'Congress MLA Raipur', party: 'INC', initials: 'IC', role: 'Opposition MLA', is_competitor: true },
    { id: 'tp2', name: 'Bhupesh Baghel', party: 'INC', initials: 'BB', role: 'Former CM CG', is_competitor: true },
  ],
  tracked_ministries: ['Rural Development', 'Urban Development', 'Mining'],
  tracked_parties: ['INC', 'AAP', 'BSP', 'JCC'],
  tracked_schemes: ['PM Awas Yojana', 'MGNREGA', 'Ujjwala Yojana', 'PM Gram Sadak Yojana'],
  languages: ['hindi', 'english'],
  geo_scope: [
    { level: 'constituency', name: 'Raipur West', state: 'Chhattisgarh' },
    { level: 'state', name: 'Chhattisgarh' },
  ],
  alert_prefs: { red_sms: false, red_push: false, red_email: true, yellow_push: false, yellow_email: false },
  contact_email: 'ops@sushant-demo.in', created_at: '2024-01-15T10:00:00Z', updated_at: new Date().toISOString(),
}



// ─── INDIAN RAILWAYS ACCOUNT ──────────────────────────────────────────────────
// Ministry-mode: no competition, tracks ministry narrative vs media claims

export const RAILWAYS_ACCOUNT: Account = {
  id: 'demo-railways', user_id: 'user-railways', created_by: 'god-001', is_active: true,
  account_type: 'ministry',
  politician_name: 'Ashwini Vaishnaw', politician_initials: 'AV', party: 'BJP',
  designation: 'Minister of Railways, Communications & Electronics',
  constituency: 'Rajya Sabha', constituency_type: 'rajya_sabha',
  state: 'National', district: 'New Delhi',
  keywords: [
    'Ashwini Vaishnaw',
    'Indian Railways',
    'Vande Bharat',
    'train accident',
    'Kavach train protection',
    'railway modernisation',
    'train delay India',
    'new railway station',
    'railway recruitment',
    'Indian Railways privatisation',
  ],
  tracked_politicians: [], // No political competition — ministry mode
  tracked_ministries: ['Railways', 'Communications', 'Electronics & IT'],
  tracked_parties: [],
  tracked_schemes: [
    'Vande Bharat Express',
    'Kavach Anti-Collision',
    'Amrit Bharat Station',
    'One Station One Product',
    'RRTS (Regional Rapid Transit)',
    'Railway Electrification',
    'Kisan Rail',
  ],
  languages: ['english', 'hindi', 'telugu', 'tamil', 'bengali', 'marathi', 'gujarati'],
  geo_scope: [{ level: 'national', name: 'India' }],
  alert_prefs: { red_sms: true, red_push: true, red_email: true, yellow_push: true, yellow_email: true },
  contact_email: 'comms@indianrailways.gov.in', created_at: '2024-01-15T10:00:00Z', updated_at: new Date().toISOString(),
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function minsAgo(m: number) { return new Date(Date.now() - m * 60000).toISOString() }
function hoursAgo(h: number) { return new Date(Date.now() - h * 3600000).toISOString() }

// ─── RAILWAYS FEED ────────────────────────────────────────────────────────────

export const RAILWAYS_FEED: FeedItem[] = [
  // RED — Crisis / high attention
  {
    id: 'rf1', account_id: 'demo-railways', platform: 'twitter', bucket: 'red',
    sentiment: 'negative',
    headline: 'Train derailment near Bokaro — 4 coaches off track, no casualties reported. NDRF deployed. @AshwiniVaishnaw tweets: "On-site team deployed, relief trains dispatched. Minister personally monitoring." #TrainDerailment trending #4 nationally with 38,000 tweets.',
    source: '@RailMinIndia · ANI · Trending #4',
    url: 'https://twitter.com/search?q=%23TrainDerailment&src=trend_click',
    geo_tags: ['Jharkhand', 'National'], topic_tags: ['Accident', 'Safety', 'Crisis'],
    language: 'english', engagement: 380000, is_trending: true, trend_rank: 4,
    published_at: minsAgo(18), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf2', account_id: 'demo-railways', platform: 'news', bucket: 'red',
    sentiment: 'negative',
    headline: 'Opposition demands Railway Safety audit in Parliament: INDIA bloc tables adjournment motion citing 12 incidents in 90 days. Rahul Gandhi: "Vande Bharat is cosmetic. Basic safety is broken." Motion admitted by Speaker — debate scheduled tomorrow.',
    source: 'THE HINDU',
    url: 'https://www.thehindu.com/news/national/?q=railways+parliament',
    geo_tags: ['National', 'Parliament'], topic_tags: ['Parliament', 'Opposition', 'Safety Audit'],
    language: 'english', published_at: minsAgo(42), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf3', account_id: 'demo-railways', platform: 'twitter', bucket: 'red',
    sentiment: 'negative',
    headline: '#IndianRailways trending after viral video: passenger falls from overcrowded Patna-bound express. 24,000 tweets in 2 hours, 78% negative sentiment. Video verified by ANI. Railway helpline number being circulated. Minister\'s office contacted.',
    source: 'Twitter Monitor · NDTV',
    url: 'https://www.ndtv.com/india/search?searchtext=unemployment+india+2024',
    geo_tags: ['Bihar', 'National'], topic_tags: ['Overcrowding', 'Passenger Safety', 'Viral'],
    language: 'english', engagement: 240000, is_trending: true,
    published_at: minsAgo(71), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf4', account_id: 'demo-railways', platform: 'news', bucket: 'red',
    sentiment: 'negative',
    headline: 'Railway Budget allocation questioned: CAG report flags ₹15,000 crore unspent from capital budget in FY24. Opposition cites figures to claim "announcement raj" — Vande Bharat targets vs delivery gap highlighted.',
    source: 'FINANCIAL EXPRESS',
    url: 'https://www.financialexpress.com/india-news/',
    geo_tags: ['National'], topic_tags: ['Budget', 'CAG', 'Accountability'],
    language: 'english', published_at: minsAgo(95), fetched_at: new Date().toISOString(),
  },

  // YELLOW — Developing / watch
  {
    id: 'rf5', account_id: 'demo-railways', platform: 'twitter', bucket: 'yellow',
    sentiment: 'positive',
    headline: 'Vande Bharat Express Route 47 launched: Mumbai-Shirdi corridor inaugurated by Minister Vaishnaw. 4.1M views on BJP YouTube live, 82,000 retweets, "Jai Maharashtra" trending alongside. On-time performance of existing routes cited: 93.4% last 30 days.',
    source: '@AshwiniVaishnaw · BJP Official',
    url: 'https://twitter.com/AshwiniVaishnaw',
    geo_tags: ['Maharashtra', 'National'], topic_tags: ['Vande Bharat', 'Launch', 'Positive'],
    language: 'english', engagement: 820000, published_at: hoursAgo(3), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf6', account_id: 'demo-railways', platform: 'news', bucket: 'yellow',
    sentiment: 'positive',
    headline: 'Kavach anti-collision system update: Railway Board confirms 3,000 km covered in Western Railway zone. Independent safety audit by RDSO shows zero false triggers in 18-month operation. Expansion to Eastern and Southern zones announced by Q3.',
    source: 'ECONOMIC TIMES',
    url: 'https://economictimes.indiatimes.com/news/economy/indicators',
    geo_tags: ['National', 'Western Railway'], topic_tags: ['Kavach', 'Safety', 'Technology'],
    language: 'english', published_at: hoursAgo(5), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf7', account_id: 'demo-railways', platform: 'instagram', bucket: 'yellow',
    sentiment: 'positive',
    headline: 'Amrit Bharat Station makeover viral on Instagram: Before/after reels from 18 stations generating 12.4M organic views in 7 days. Kashi station video alone: 3.8M views, 94% positive comments. Travellers sharing "first time I\'m proud of this station" — strong grassroots sentiment.',
    source: '@RailMinIndia Instagram',
    url: 'https://www.instagram.com/railminindia/',
    geo_tags: ['UP', 'MP', 'Rajasthan', 'National'], topic_tags: ['Amrit Bharat', 'Infrastructure', 'Viral Positive'],
    language: 'hindi', views: 12400000, published_at: hoursAgo(8), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf8', account_id: 'demo-railways', platform: 'news', bucket: 'yellow',
    sentiment: 'negative',
    headline: 'Railway privatisation narrative building: TMC MP Sudip Bandyopadhyay asks in Rajya Sabha: "Is Railways being sold to Adani?" Ministry denies — but hashtag #RailwayPrivatisation getting 18,000 tweets/day, majority misinformation-driven.',
    source: 'INDIA TODAY',
    url: 'https://www.indiatoday.in/india',
    geo_tags: ['National', 'Parliament'], topic_tags: ['Privatisation', 'Misinformation', 'Parliament'],
    language: 'english', published_at: hoursAgo(11), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf9', account_id: 'demo-railways', platform: 'whatsapp', bucket: 'yellow',
    sentiment: 'positive',
    headline: 'Forward going viral: "New Indian Railways facts 2024" — infographic listing 100+ new stations, 136 Vande Bharat routes, 99% electrification, world\'s 4th largest rail network. 3.2M estimated forwards in 48h. Factually accurate content — organic origin traced to railway enthusiast account.',
    source: 'WA MONITOR · National',
    geo_tags: ['National'], topic_tags: ['Positive Viral', 'Facts', 'Railways Achievement'],
    language: 'hindi', shares: 3200000, published_at: hoursAgo(14), fetched_at: new Date().toISOString(),
  },

  // BLUE — Background / context
  {
    id: 'rf10', account_id: 'demo-railways', platform: 'youtube', bucket: 'blue',
    sentiment: 'positive',
    headline: 'Minister Vaishnaw press conference: India\'s Railway capex hits ₹2.65 lakh crore in FY25 — 9x increase from FY14 levels. Bullet train project update: 237 km viaduct complete in Gujarat section. 2026 section operational target confirmed.',
    source: 'PIB India · DD News',
    url: 'https://www.youtube.com/@PIBIndia',
    youtube_id: 'hABj_mrP-no', channel: 'PIB India',
    geo_tags: ['National', 'Gujarat'], topic_tags: ['Budget', 'Bullet Train', 'Capex'],
    language: 'english', views: 2800000, published_at: hoursAgo(18), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf11', account_id: 'demo-railways', platform: 'youtube', bucket: 'blue',
    sentiment: 'negative',
    headline: 'NDTV Investigates: "Railway Promises vs Reality" — 22-minute documentary examining Vande Bharat delivery (136 of 475 promised), Kavach coverage (actual vs target), and station redevelopment pace. 1.4M views, balanced but raises accountability questions.',
    source: 'NDTV',
    url: 'https://www.youtube.com/@ndtv',
    youtube_id: 'BqN-FNMfMF8', channel: 'NDTV',
    geo_tags: ['National'], topic_tags: ['Accountability', 'Investigation', 'Targets'],
    language: 'english', views: 1400000, published_at: hoursAgo(22), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf12', account_id: 'demo-railways', platform: 'news', bucket: 'blue',
    sentiment: 'positive',
    headline: 'Railways freight revenue hits record ₹1.7 lakh crore in FY24 — 8.8% increase. Coal, steel and FMCG freight volumes up. Dedicated Freight Corridor (Eastern + Western) carrying 40% of freight volume since full operationalisation. Export competitiveness impact cited.',
    source: 'BUSINESS STANDARD',
    url: 'https://www.business-standard.com/finance/news',
    geo_tags: ['National'], topic_tags: ['Freight', 'Revenue', 'DFC Achievement'],
    language: 'english', published_at: hoursAgo(26), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf13', account_id: 'demo-railways', platform: 'news', bucket: 'blue',
    sentiment: 'neutral',
    headline: 'Passenger traffic analysis: Indian Railways carried 6.4 billion passengers in FY24 — close to pre-COVID peak of 6.6B (FY20). Suburban rail recovered fully. Long-distance travel still 8% below peak. Tatkal occupancy at 98.4% indicating demand exceeds supply on key routes.',
    source: 'THE HINDU · Railway Data',
    url: 'https://www.thehindu.com/news/national/?q=railway+parliament',
    geo_tags: ['National'], topic_tags: ['Passengers', 'Data', 'Capacity'],
    language: 'english', published_at: hoursAgo(31), fetched_at: new Date().toISOString(),
  },
  {
    id: 'rf14', account_id: 'demo-railways', platform: 'facebook', bucket: 'blue',
    sentiment: 'positive',
    headline: 'Railway recruitment update: 35,281 candidates join as Loco Pilots and Technicians — largest batch in 5 years. Minister Vaishnaw distributes appointment letters at ceremony. Facebook live: 4.8M reach, 68,000 reactions. Strong engagement from recruitment aspirants across Bihar, UP and Rajasthan.',
    source: 'BJP Official · Rail Ministry',
    url: 'https://www.facebook.com/RailMinIndia/',
    geo_tags: ['Bihar', 'UP', 'Rajasthan', 'National'], topic_tags: ['Recruitment', 'Employment', 'Positive'],
    language: 'hindi', views: 4800000, engagement: 68000, published_at: hoursAgo(36), fetched_at: new Date().toISOString(),
  },

  // SILVER — Narrative Counter-Intelligence (ministry mode — no politician contradictions, tracks media claims vs facts)
  {
    id: 'rf15', account_id: 'demo-railways', platform: 'twitter', bucket: 'silver',
    sentiment: 'negative',
    headline: 'MEDIA CLAIM: "Indian Railways is among the world\'s most accident-prone railways — passengers risk their lives every day."',
    source: 'Multiple opposition handles + viral Twitter thread · 42,000 engagements',
    url: 'https://twitter.com/search?q=Indian+Railways+accident&f=live',
    geo_tags: ['National'], topic_tags: ['Safety', 'Counter-Narrative', 'Accident Claim'],
    language: 'english', engagement: 42000, published_at: minsAgo(120), fetched_at: new Date().toISOString(),
    contradiction: {
      id: 'rc1', feed_item_id: 'rf15',
      politician_name: 'Narrative Counter',
      current_quote: '"Indian Railways is among the world\'s most accident-prone railways."',
      historical_quote: 'Railway accident fatalities per billion passenger-km: India 0.08 (2023), EU average 0.11, USA 0.24. Absolute accidents down 76% since 2014 — from 118 consequential accidents (FY14) to 28 (FY24). Source: Railway Board Annual Statistical Statement + ERA Safety Report 2023.',
      historical_date: '2024-01-01',
      historical_source: 'Ministry of Railways Annual Statistical Statement FY2023-24 + European Railway Agency Safety Report',
      contradiction_score: 94,
      contradiction_type: 'contradiction',
      evidence_source: 'RAILWAY BOARD',
      status: 'confirmed', created_at: new Date().toISOString(),
    },
  },
  {
    id: 'rf16', account_id: 'demo-railways', platform: 'news', bucket: 'silver',
    sentiment: 'negative',
    headline: 'MEDIA CLAIM: "Indian trains are perpetually late — the Railways has failed to improve punctuality despite years of promises and thousands of crores spent."',
    source: 'Opposition Press Conference + circulating in WhatsApp · 28,000 engagements',
    url: 'https://theprint.in/politics/',
    geo_tags: ['National'], topic_tags: ['Punctuality', 'Counter-Narrative', 'Delay Claim'],
    language: 'english', engagement: 28000, published_at: hoursAgo(4), fetched_at: new Date().toISOString(),
    contradiction: {
      id: 'rc2', feed_item_id: 'rf16',
      politician_name: 'Narrative Counter',
      current_quote: '"Indian trains are perpetually late — Railways has failed to improve punctuality."',
      historical_quote: 'Mail/Express punctuality: 74.7% (FY2014) → 89.2% (FY2024) — 14.5 percentage point improvement. Rajdhani/Shatabdi punctuality at 93.1% in FY24. These are audited figures from Railway Board published monthly. Specific train performance trackable at NTESapp.railnet.gov.in',
      historical_date: '2024-03-31',
      historical_source: 'National Train Enquiry System (NTES) + Railway Board Punctuality Report Q4 FY2023-24',
      contradiction_score: 88,
      contradiction_type: 'contradiction',
      evidence_source: 'NTES DATA',
      status: 'confirmed', created_at: new Date().toISOString(),
    },
  },
  {
    id: 'rf17', account_id: 'demo-railways', platform: 'twitter', bucket: 'silver',
    sentiment: 'negative',
    headline: 'MEDIA CLAIM: "Indian Railways is being quietly privatised — Adani, Ambani getting control of routes, stations and freight."',
    source: 'TMC Parliament speech + viral WhatsApp forward · 61,000 engagements',
    url: 'https://twitter.com/search?q=railway+privatisation+India&f=live',
    geo_tags: ['National'], topic_tags: ['Privatisation', 'Counter-Narrative', 'Misinformation'],
    language: 'english', engagement: 61000, is_trending: false, published_at: hoursAgo(9), fetched_at: new Date().toISOString(),
    contradiction: {
      id: 'rc3', feed_item_id: 'rf17',
      politician_name: 'Narrative Counter',
      current_quote: '"Indian Railways is being quietly privatised — Adani, Ambani getting control."',
      historical_quote: '99.7% of Indian railway operations remain with Indian Railways (government entity). Only private train pilots: 12 trains on 5 routes = 0.3% of total capacity. All 7,349 railway stations owned by Indian Railways. No freight routes sold or leased to private entities. Lok Sabha written reply: Minister of Railways, March 12, 2024.',
      historical_date: '2024-03-12',
      historical_source: 'Lok Sabha Unstarred Question No. 4821 + Ministry of Railways press release March 2024',
      contradiction_score: 96,
      contradiction_type: 'contradiction',
      evidence_source: 'LOK SABHA',
      status: 'confirmed', created_at: new Date().toISOString(),
    },
  },
  {
    id: 'rf18', account_id: 'demo-railways', platform: 'news', bucket: 'silver',
    sentiment: 'negative',
    headline: 'MEDIA CLAIM: "Vande Bharat Express is just cosmetic — it\'s an expensive rebranding of existing trains. 475 promised, only a handful delivered."',
    source: 'RAHUL GANDHI · Press Conference · THE WIRE analysis · 33,000 engagements',
    url: 'https://thewire.in/search?q=Manipur+violence',
    geo_tags: ['National'], topic_tags: ['Vande Bharat', 'Counter-Narrative', 'Delivery Claim'],
    language: 'english', engagement: 33000, published_at: hoursAgo(16), fetched_at: new Date().toISOString(),
    contradiction: {
      id: 'rc4', feed_item_id: 'rf18',
      politician_name: 'Narrative Counter',
      current_quote: '"Vande Bharat is cosmetic — 475 promised, only a handful delivered."',
      historical_quote: '136 Vande Bharat trains operational across 116 routes as of January 2024 — a real number that represents the world\'s fastest indigenous semi-high-speed rail expansion in a single term. 95% components manufactured in India (ICF Chennai). Average speed 25% higher than Shatabdi on same routes. ₹15,000 crore saved vs imported alternative. 475 was a 10-year target, not a term target.',
      historical_date: '2024-01-15',
      historical_source: 'Integral Coach Factory (ICF) production data + Ministry of Railways operational update Jan 2024',
      contradiction_score: 79,
      contradiction_type: 'contradiction',
      evidence_source: 'ICF DATA',
      status: 'confirmed', created_at: new Date().toISOString(),
    },
  },
  {
    id: 'rf19', account_id: 'demo-railways', platform: 'twitter', bucket: 'silver',
    sentiment: 'negative',
    headline: 'MEDIA CLAIM: "Railway recruitment is fraudulent — crores taken from aspirants, no jobs given. RRB exams rigged, paper leaks happen every year."',
    source: 'RRB Exam controversy Twitter surge · student protests reported · 54,000 engagements',
    url: 'https://twitter.com/search?q=RRB+exam+fraud&f=live',
    geo_tags: ['Bihar', 'UP', 'National'], topic_tags: ['Recruitment', 'Counter-Narrative', 'RRB'],
    language: 'hindi', engagement: 54000, published_at: hoursAgo(22), fetched_at: new Date().toISOString(),
    contradiction: {
      id: 'rc5', feed_item_id: 'rf19',
      politician_name: 'Narrative Counter',
      current_quote: '"Railway recruitment is fraudulent — crores taken, no jobs given."',
      historical_quote: '1,41,625 candidates recruited in FY2023-24 — largest batch in 10 years. Total railway employees: 13.08 lakh (slight increase from 12.98L in FY22). Last 2 years: 35,000+ Loco Pilots/Technicians + 18,000 Group D + 22,000 RPF personnel joined. All recruitment through official CRIS-managed portal. Detailed data: indianrailways.gov.in/Annual_Reports',
      historical_date: '2024-02-01',
      historical_source: 'Ministry of Railways Annual Report FY2023-24 + Railway Board Recruitment Cell records',
      contradiction_score: 82,
      contradiction_type: 'contradiction',
      evidence_source: 'RAILWAY BOARD',
      status: 'confirmed', created_at: new Date().toISOString(),
    },
  },
]

// ─── RAILWAYS AI BRIEF ────────────────────────────────────────────────────────

export const RAILWAYS_AI_BRIEF: AIBrief = {
  id: 'brief-railways',
  account_id: 'demo-railways',
  situation_summary: 'Two narratives are running simultaneously. Positive: Vande Bharat Route 47 launch generating strong organic engagement (4.1M YT views, Amrit Bharat station content at 12.4M Instagram views). Negative: Bokaro derailment is dominating and a parliamentary adjournment motion has been admitted for tomorrow — this is the active crisis requiring managed response. Opposition is deploying safety + privatisation narratives jointly.',
  pattern_analysis: 'The opposition is running a coordinated "safety + accountability" playbook — timing the parliamentary motion to follow the Bokaro incident while simultaneously amplifying the #RailwayPrivatisation narrative (18K tweets/day, majority misinformation). The WA viral positive content (3.2M forwards on railway facts) is organic and not connected to any official campaign — genuine public pride in railway progress is a natural counter-asset.',
  opportunities: [
    {
      id: 'ro1', type: 'data_contradiction', politician: 'Media/Opposition Safety Claim',
      score: 94, description: '"Most accident-prone" claim: India\'s accident rate 0.08 vs EU 0.11 per billion passenger-km. Accidents down 76% since 2014 — Railway Board data.',
      current_statement: '"Indian Railways most accident-prone" — 42K engagements',
      historical_statement: 'Fatalities per billion passenger-km: India 0.08, EU 0.11, USA 0.24 — ERA + Railway Board FY24',
      confidence: 0.94,
    },
    {
      id: 'ro2', type: 'data_contradiction', politician: 'Privatisation Narrative',
      score: 96, description: '"Being privatised to Adani" — 99.7% operations remain Indian Railways. Only 0.3% private train pilots. Lok Sabha written answer on record.',
      current_statement: '"Railways being privatised to Adani/Ambani" — 61K engagements',
      historical_statement: 'Lok Sabha Q.4821: 99.7% ops state-owned. No freight routes sold — March 2024',
      confidence: 0.96,
    },
    {
      id: 'ro3', type: 'data_contradiction', politician: 'Punctuality Claim',
      score: 88, description: '"Trains perpetually late" — punctuality improved from 74.7% to 89.2% since 2014. 14.5pp improvement — NTES data.',
      current_statement: '"Railways failed to improve punctuality" — 28K engagements',
      historical_statement: 'Punctuality: 74.7% FY14 → 89.2% FY24. Rajdhani/Shatabdi at 93.1% — NTES',
      confidence: 0.88,
    },
  ],
  ticker_items: [
    { id: 'rt1', tag: 'CRISIS',   text: 'Bokaro derailment — no casualties, NDRF deployed, parliamentary motion admitted for tomorrow', bucket: 'red',    created_at: new Date().toISOString() },
    { id: 'rt2', tag: 'INTEL',    text: 'Safety counter: India 0.08 vs EU 0.11 accidents/bn passenger-km — Railway Board data ready', bucket: 'silver',  created_at: new Date().toISOString() },
    { id: 'rt3', tag: 'POSITIVE', text: 'VB Route 47 launch: 4.1M YouTube views, Amrit Bharat stations 12.4M Instagram views', bucket: 'yellow',  created_at: new Date().toISOString() },
    { id: 'rt4', tag: 'INTEL',    text: 'Privatisation claim 96% counter-score — Lok Sabha Q.4821 written answer is public record', bucket: 'silver',  created_at: new Date().toISOString() },
    { id: 'rt5', tag: 'SURGE',    text: '#RailwayPrivatisation: 18K tweets/day, majority misinformation — proactive clarification needed', bucket: 'red',    created_at: new Date().toISOString() },
    { id: 'rt6', tag: 'POSITIVE', text: 'Organic viral: 3.2M WA forwards "Railway Facts 2024" — genuine public pride, no official source', bucket: 'blue',   created_at: new Date().toISOString() },
    { id: 'rt7', tag: 'INTEL',    text: 'Punctuality counter: 74.7% → 89.2% improvement since 2014 — NTES live data available', bucket: 'silver',  created_at: new Date().toISOString() },
    { id: 'rt8', tag: 'TREND',    text: 'Recruitment: 1.41L hired FY24, largest batch in 10 years — counter to RRB fraud narrative', bucket: 'blue',   created_at: new Date().toISOString() },
  ],
  generated_at: new Date().toISOString(),
  next_refresh_at: new Date(Date.now() + 5 * 60000).toISOString(),
}

// ─── RAILWAYS TRENDS ─────────────────────────────────────────────────────────

export const RAILWAYS_TRENDS: TrendMetric[] = [
  { id: 'rtr1', account_id: 'demo-railways', metric: 'sentiment', data_points: [
    {date:'Jul',value:64},{date:'Aug',value:61},{date:'Sep',value:68},{date:'Oct',value:66},{date:'Nov',value:71},{date:'Dec',value:69},{date:'Jan',value:67}
  ], current_value: 67, delta_7d: -2.1, delta_since_election: 8, election_reference_date: '2024-06-04' },
  { id: 'rtr2', account_id: 'demo-railways', metric: 'mention_volume', data_points: [
    {date:'Jul',value:18.2},{date:'Aug',value:22.1},{date:'Sep',value:19.4},{date:'Oct',value:24.8},{date:'Nov',value:21.3},{date:'Dec',value:26.4},{date:'Jan',value:28.1}
  ], current_value: 28.1, delta_7d: 6.4, delta_since_election: 44, election_reference_date: '2024-06-04' },
  { id: 'rtr3', account_id: 'demo-railways', metric: 'narrative_score', data_points: [
    {date:'Jul',value:58},{date:'Aug',value:54},{date:'Sep',value:61},{date:'Oct',value:59},{date:'Nov',value:63},{date:'Dec',value:60},{date:'Jan',value:58}
  ], current_value: 58, delta_7d: -2, delta_since_election: 5, election_reference_date: '2024-06-04' },
  { id: 'rtr4', account_id: 'demo-railways', metric: 'opposition_pressure', data_points: [
    {date:'Jul',value:38},{date:'Aug',value:44},{date:'Sep',value:41},{date:'Oct',value:48},{date:'Nov',value:52},{date:'Dec',value:57},{date:'Jan',value:61}
  ], current_value: 61, delta_7d: 4, delta_since_election: 23, election_reference_date: '2024-06-04' },
  { id: 'rtr5', account_id: 'demo-railways', metric: 'issue_ownership', data_points: [
    {date:'Jul',value:72},{date:'Aug',value:68},{date:'Sep',value:74},{date:'Oct',value:71},{date:'Nov',value:76},{date:'Dec',value:73},{date:'Jan',value:74}
  ], current_value: 74, delta_7d: 1, delta_since_election: 6, election_reference_date: '2024-06-04' },
  { id: 'rtr6', account_id: 'demo-railways', metric: 'youth_sentiment', data_points: [
    {date:'Jul',value:71},{date:'Aug',value:68},{date:'Sep',value:74},{date:'Oct',value:72},{date:'Nov',value:76},{date:'Dec',value:73},{date:'Jan',value:75}
  ], current_value: 75, delta_7d: 2, delta_since_election: 9, election_reference_date: '2024-06-04' },
  { id: 'rtr7', account_id: 'demo-railways', metric: 'social_share', data_points: [
    {date:'Jul',value:22},{date:'Aug',value:24},{date:'Sep',value:21},{date:'Oct',value:26},{date:'Nov',value:28},{date:'Dec',value:31},{date:'Jan',value:29}
  ], current_value: 29, delta_7d: -2, delta_since_election: 7, election_reference_date: '2024-06-04' },
  { id: 'rtr8', account_id: 'demo-railways', metric: 'vernacular_reach', data_points: [
    {date:'Jul',value:7},{date:'Aug',value:8},{date:'Sep',value:8},{date:'Oct',value:9},{date:'Nov',value:10},{date:'Dec',value:11},{date:'Jan',value:11}
  ], current_value: 11, delta_7d: 0, delta_since_election: 4, election_reference_date: '2024-06-04' },
]

// ─── RAILWAYS CONSTITUENCY PULSE ─────────────────────────────────────────────

export const RAILWAYS_PULSE: ConstituencyPulse = {
  account_id: 'demo-railways', constituency: 'National', state: 'India',
  overall_sentiment: 67,
  issues: [
    { topic: 'Safety Record',      volume_pct: 88, sentiment: 'negative', trend: 'up' },
    { topic: 'Vande Bharat',       volume_pct: 82, sentiment: 'positive', trend: 'up' },
    { topic: 'Punctuality',        volume_pct: 74, sentiment: 'positive', trend: 'up' },
    { topic: 'Station Upgrades',   volume_pct: 68, sentiment: 'positive', trend: 'up' },
    { topic: 'Privatisation Fear', volume_pct: 61, sentiment: 'negative', trend: 'up' },
    { topic: 'Recruitment',        volume_pct: 58, sentiment: 'positive', trend: 'up' },
    { topic: 'Freight Growth',     volume_pct: 44, sentiment: 'positive', trend: 'flat' },
    { topic: 'Ticket Prices',      volume_pct: 52, sentiment: 'negative', trend: 'flat' },
  ],
  updated_at: new Date().toISOString(),
}

// ─── RAILWAYS SCHEMES ─────────────────────────────────────────────────────────

export const RAILWAYS_SCHEMES: SchemeSentiment[] = [
  { scheme_name: 'Vande Bharat',    sentiment_score: 82, mention_count: 18420, trend: 'up'   },
  { scheme_name: 'Kavach',          sentiment_score: 78, mention_count: 8840,  trend: 'up'   },
  { scheme_name: 'Amrit Bharat',    sentiment_score: 84, mention_count: 12610, trend: 'up'   },
  { scheme_name: 'Bullet Train',    sentiment_score: 61, mention_count: 6480,  trend: 'flat' },
  { scheme_name: 'Freight DFC',     sentiment_score: 74, mention_count: 3920,  trend: 'up'   },
  { scheme_name: 'RRTS Rapidx',     sentiment_score: 79, mention_count: 5210,  trend: 'up'   },
]

export const RAILWAYS_ISSUE_OWNERSHIP: IssueOwnershipPoint[] = [
  { month: 'Jul', politician_score: 68, opposition_score: 32 },
  { month: 'Aug', politician_score: 62, opposition_score: 38 },
  { month: 'Sep', politician_score: 71, opposition_score: 29 },
  { month: 'Oct', politician_score: 66, opposition_score: 34 },
  { month: 'Nov', politician_score: 73, opposition_score: 27 },
  { month: 'Dec', politician_score: 70, opposition_score: 30 },
  { month: 'Jan', politician_score: 67, opposition_score: 33 },
]

export const RAILWAYS_STATE_VOLUMES: StateConversationVolume[] = [
  { state_name: 'Uttar Pradesh',   volume: 94, sentiment: 72, top_topic: 'Vande Bharat / Stations',    mention_count: 184000 },
  { state_name: 'Bihar',           volume: 88, sentiment: 58, top_topic: 'Safety / Recruitment',       mention_count: 142000 },
  { state_name: 'Maharashtra',     volume: 82, sentiment: 69, top_topic: 'Mumbai Rail / Bullet Train',  mention_count: 128000 },
  { state_name: 'West Bengal',     volume: 74, sentiment: 54, top_topic: 'Privatisation Concern',       mention_count: 98000  },
  { state_name: 'Tamil Nadu',      volume: 71, sentiment: 66, top_topic: 'Vande Bharat Chennai',        mention_count: 88000  },
  { state_name: 'Rajasthan',       volume: 64, sentiment: 74, top_topic: 'Amrit Bharat Stations',       mention_count: 72000  },
  { state_name: 'Madhya Pradesh',  volume: 61, sentiment: 71, top_topic: 'Station Upgrades',            mention_count: 64000  },
  { state_name: 'Gujarat',         volume: 68, sentiment: 78, top_topic: 'Bullet Train Progress',       mention_count: 78000  },
  { state_name: 'Jharkhand',       volume: 72, sentiment: 44, top_topic: 'Bokaro Derailment',           mention_count: 82000  },
  { state_name: 'Punjab',          volume: 58, sentiment: 61, top_topic: 'Train Frequency',             mention_count: 52000  },
]

// ─── KEEP ORIGINAL DEMO DATA ──────────────────────────────────────────────────

export const DEMO_FEED: FeedItem[] = [
  { id: 'f1', account_id: 'demo-001', platform: 'twitter', bucket: 'red', sentiment: 'negative',
    headline: '#ModiMustExplain trending #2 nationally — 91K tweets, INDIA bloc coordinated surge confirmed across Twitter, Instagram and Facebook simultaneously within 90-min window.',
    source: '@INCIndia · Trending #2', url: 'https://twitter.com/search?q=%23ModiMustExplain&src=trend_click',
    geo_tags: ['National'], topic_tags: ['Opposition Surge', 'Trending'], language: 'english', engagement: 2100000, is_trending: true, trend_rank: 2, published_at: minsAgo(4), fetched_at: new Date().toISOString() },
  { id: 'f2', account_id: 'demo-001', platform: 'news', bucket: 'red', sentiment: 'negative',
    headline: 'Farmer protest resumes at Shambhu border — 40,000 gathered, Punjab-Haryana highway blocked since 6am. NDRF on standby. Protest leaders announce indefinite stay until MSP legislation passed.',
    source: 'NDTV', url: 'https://www.ndtv.com/india/search?searchtext=farmer+protest+shambhu+border', geo_tags: ['Punjab', 'Haryana'], topic_tags: ['Farmers', 'Protest'], language: 'english', published_at: minsAgo(22), fetched_at: new Date().toISOString() },
  { id: 'f3', account_id: 'demo-001', platform: 'news', bucket: 'red', sentiment: 'negative',
    headline: 'Urban unemployment hits 8.3% — 8-month high per CMIE data. Opposition demands PM statement. Rahul Gandhi: "10 years of Modi = 10 years of jobless growth." 44K retweets in 2 hours.',
    source: 'ANI · @RahulGandhi', url: 'https://www.ndtv.com/india/search?searchtext=unemployment+india+2024', geo_tags: ['National'], topic_tags: ['Economy', 'Unemployment'], language: 'english', engagement: 980000, published_at: minsAgo(35), fetched_at: new Date().toISOString() },
  { id: 'f4', account_id: 'demo-001', platform: 'instagram', bucket: 'yellow', sentiment: 'positive',
    headline: 'PM Modi Varanasi Ghat ceremony reel: 4.2M views in 6 hours, 89% positive comments, share rate 3.2x above BJP 6-month average. Strongest Instagram performance for BJP this month.',
    source: '@narendramodi', url: 'https://instagram.com', geo_tags: ['Varanasi'], topic_tags: ['Varanasi', 'Positive'], language: 'hindi', views: 4200000, published_at: hoursAgo(2), fetched_at: new Date().toISOString() },
  { id: 'f5', account_id: 'demo-001', platform: 'youtube', bucket: 'blue', sentiment: 'positive',
    headline: 'Mann Ki Baat Ep110: 8.2M YouTube views — Chandrayaan-3 legacy, women SHGs ₹1L crore turnover, yoga diplomacy. Comment sentiment 91% positive. 42K new subscribers in 24h.',
    source: 'BJP Official', youtube_id: 'LqVhGaBFqTQ', channel: 'BJP Official', geo_tags: ['National'], topic_tags: ['Mann Ki Baat'], language: 'hindi', views: 8200000, published_at: hoursAgo(8), fetched_at: new Date().toISOString() },
  { id: 'f6', account_id: 'demo-001', platform: 'news', bucket: 'silver', sentiment: 'negative',
    headline: '"Modi sarkar ne kisan ko barbad kar diya — MSP guarantee ka wada 10 saal baad bhi kagaz par hai." — Rahul Gandhi, Press Conference',
    source: 'RAHUL GANDHI · INC', url: 'https://incindia.org', geo_tags: ['National'], topic_tags: ['Farmers', 'MSP'], language: 'hindi', published_at: minsAgo(90), fetched_at: new Date().toISOString(),
    contradiction: { id: 'c1', feed_item_id: 'f6', politician_name: 'Rahul Gandhi', current_quote: 'Modi sarkar ne kisan ko barbad kar diya — MSP guarantee wada kagaz par hai.', historical_quote: 'UPA ke 10 saal mein MSP implementation hamare apne states mein bhi poori tarah successful nahin raha. (Rajya Sabha, 2021)', historical_date: '2021-12-01', historical_source: 'Rajya Sabha Debate transcript', contradiction_score: 78, contradiction_type: 'contradiction', status: 'flagged', created_at: new Date().toISOString() },
  },
  { id: 'f7', account_id: 'demo-001', platform: 'twitter', bucket: 'silver', sentiment: 'negative',
    headline: '"BJP electoral bonds = biggest legalised corruption in Indian democratic history. Supreme Court agreed." — @ArvindKejriwal',
    source: 'ARVIND KEJRIWAL · @ArvindKejriwal', url: 'https://twitter.com/ArvindKejriwal', geo_tags: ['National'], topic_tags: ['Electoral Bonds'], language: 'english', published_at: hoursAgo(2), fetched_at: new Date().toISOString(),
    contradiction: { id: 'c2', feed_item_id: 'f7', politician_name: 'Arvind Kejriwal', current_quote: 'BJP electoral bonds biggest legalised corruption in Indian democracy.', historical_quote: 'AAP received electoral bonds worth ₹10 crore in September 2022 — Election Commission of India filing, confirmed before SC struck down scheme.', historical_date: '2022-09-15', historical_source: 'Election Commission of India — Party Funding Declaration FY2022-23', contradiction_score: 91, contradiction_type: 'flip', evidence_source: 'EC FILING', status: 'confirmed', created_at: new Date().toISOString() },
  },
]

export const DEMO_AI_BRIEF: AIBrief = {
  id: 'brief-001', account_id: 'demo-001',
  situation_summary: 'INDIA bloc running coordinated 3-platform campaign on economic failure + farmer grievances. #ModiMustExplain at #2 nationally (91K tweets). Shambhu border protest re-escalation adds physical dimension. BJP counter-content on Varanasi (4.2M views) and Mann Ki Baat (8.2M) performing strongly but not dominating today\'s cycle.',
  pattern_analysis: 'Coordinated surge confirmed — INC, AAP, TMC amplified same hashtag within 90-min window. Matches digital war room playbook from Karnataka/Telangana 2023. BJP WhatsApp content (Viksit Bharat 2.4M forwards) outpacing opposition organically but crisis narrative is winning the cycle.',
  opportunities: [
    { id: 'o1', type: 'direct_flip', politician: 'Arvind Kejriwal', score: 91, description: 'Condemning electoral bonds while AAP received ₹10 crore — ECI filing on record', current_statement: 'BJP electoral bonds = biggest corruption', historical_statement: 'AAP received ₹10cr bonds — EC filing Sep 2022', confidence: 0.91 },
    { id: 'o2', type: 'data_contradiction', politician: 'Akhilesh Yadav', score: 85, description: '"Worst inflation in 40 years" vs RBI data: current 4.8% vs UPA-2 average 9.4%', current_statement: 'Worst inflation in 40 years under Modi', historical_statement: 'UPA-2 CPI averaged 9.4% for 5 years — RBI Annual Report', confidence: 0.85 },
    { id: 'o3', type: 'data_contradiction', politician: 'Mamata Banerjee', score: 72, description: 'Federalism claim vs Finance Commission: WB received record ₹1.23L crore devolution in FY24', current_statement: 'States reduced to beggars at Delhi\'s door', historical_statement: 'WB received record ₹1.23L crore central devolution FY24', confidence: 0.72 },
  ],
  ticker_items: [
    { id: 't1', tag: 'CRISIS',   text: '#ModiMustExplain #2 nationally — 91K tweets, INDIA bloc coordinated surge confirmed',            bucket: 'red',    created_at: new Date().toISOString() },
    { id: 't2', tag: 'OPP',      text: 'Kejriwal electoral bond flip: 91% confidence — ECI filing on public record',                    bucket: 'silver', created_at: new Date().toISOString() },
    { id: 't3', tag: 'POSITIVE', text: 'Varanasi ghat reel 4.2M views — highest BJP Instagram this month, 89% positive',               bucket: 'yellow', created_at: new Date().toISOString() },
    { id: 't4', tag: 'INTEL',    text: 'Viksit Bharat 2.4M WA forwards in Hindi belt — organic, outpacing opposition 3:1',             bucket: 'blue',   created_at: new Date().toISOString() },
    { id: 't5', tag: 'SURGE',    text: 'Shambhu border: 40K farmers, highway blocked — media on ground, parliament motion expected',    bucket: 'red',    created_at: new Date().toISOString() },
    { id: 't6', tag: 'OPP',      text: 'SP inflation claim vs RBI: 4.8% now vs 9.4% UPA-2 average — 85% counter score',                bucket: 'silver', created_at: new Date().toISOString() },
    { id: 't7', tag: 'TREND',    text: 'Mann Ki Baat Ep110: 8.2M YouTube views, 42K new subscribers — above 6-month average',         bucket: 'blue',   created_at: new Date().toISOString() },
    { id: 't8', tag: 'AI',       text: 'INDIA bloc 3-platform simultaneous campaign detected — war room activation pattern confirmed', bucket: 'yellow', created_at: new Date().toISOString() },
  ],
  generated_at: new Date().toISOString(),
  next_refresh_at: new Date(Date.now() + 5 * 60000).toISOString(),
}

export const DEMO_TRENDS: TrendMetric[] = [
  { id: 'tr1', account_id: 'demo-001', metric: 'sentiment', data_points: [{date:'Jun',value:71},{date:'Jul',value:68},{date:'Aug',value:74},{date:'Sep',value:72},{date:'Oct',value:69},{date:'Nov',value:71},{date:'Dec',value:73}], current_value: 73, delta_7d: 2.1, delta_since_election: 4, election_reference_date: '2024-04-19' },
  { id: 'tr2', account_id: 'demo-001', metric: 'mention_volume', data_points: [{date:'Jun',value:8.2},{date:'Jul',value:9.1},{date:'Aug',value:11.4},{date:'Sep',value:10.8},{date:'Oct',value:12.1},{date:'Nov',value:13.4},{date:'Dec',value:14.2}], current_value: 14.2, delta_7d: 6.1, delta_since_election: 52, election_reference_date: '2024-04-19' },
  { id: 'tr3', account_id: 'demo-001', metric: 'narrative_score', data_points: [{date:'Jun',value:62},{date:'Jul',value:58},{date:'Aug',value:61},{date:'Sep',value:59},{date:'Oct',value:57},{date:'Nov',value:55},{date:'Dec',value:56}], current_value: 56, delta_7d: 1, delta_since_election: -8, election_reference_date: '2024-04-19' },
  { id: 'tr4', account_id: 'demo-001', metric: 'opposition_pressure', data_points: [{date:'Jun',value:44},{date:'Jul',value:48},{date:'Aug',value:52},{date:'Sep',value:55},{date:'Oct',value:58},{date:'Nov',value:62},{date:'Dec',value:67}], current_value: 67, delta_7d: 8, delta_since_election: 23, election_reference_date: '2024-04-19' },
  { id: 'tr5', account_id: 'demo-001', metric: 'issue_ownership', data_points: [{date:'Jun',value:68},{date:'Jul',value:65},{date:'Aug',value:67},{date:'Sep',value:64},{date:'Oct',value:62},{date:'Nov',value:61},{date:'Dec',value:63}], current_value: 63, delta_7d: 2, delta_since_election: -5, election_reference_date: '2024-04-19' },
  { id: 'tr6', account_id: 'demo-001', metric: 'youth_sentiment', data_points: [{date:'Jun',value:61},{date:'Jul',value:58},{date:'Aug',value:62},{date:'Sep',value:59},{date:'Oct',value:55},{date:'Nov',value:53},{date:'Dec',value:54}], current_value: 54, delta_7d: 1, delta_since_election: -7, election_reference_date: '2024-04-19' },
  { id: 'tr7', account_id: 'demo-001', metric: 'social_share', data_points: [{date:'Jun',value:18},{date:'Jul',value:19},{date:'Aug',value:22},{date:'Sep',value:21},{date:'Oct',value:23},{date:'Nov',value:24},{date:'Dec',value:26}], current_value: 26, delta_7d: 2, delta_since_election: 8, election_reference_date: '2024-04-19' },
  { id: 'tr8', account_id: 'demo-001', metric: 'vernacular_reach', data_points: [{date:'Jun',value:5},{date:'Jul',value:5},{date:'Aug',value:6},{date:'Sep',value:6},{date:'Oct',value:7},{date:'Nov',value:8},{date:'Dec',value:8}], current_value: 8, delta_7d: 0, delta_since_election: 3, election_reference_date: '2024-04-19' },
]

export const DEMO_PULSE: ConstituencyPulse = {
  account_id: 'demo-001', constituency: 'Varanasi', state: 'Uttar Pradesh', overall_sentiment: 73,
  issues: [
    { topic: 'Development',    volume_pct: 78, sentiment: 'positive', trend: 'up'   },
    { topic: 'Inflation',      volume_pct: 71, sentiment: 'negative', trend: 'up'   },
    { topic: 'Ganga Ghat',     volume_pct: 64, sentiment: 'positive', trend: 'up'   },
    { topic: 'Employment',     volume_pct: 58, sentiment: 'negative', trend: 'flat' },
    { topic: 'Temples/Culture',volume_pct: 52, sentiment: 'positive', trend: 'up'   },
    { topic: 'Roads/Infra',    volume_pct: 44, sentiment: 'positive', trend: 'up'   },
  ],
  updated_at: new Date().toISOString(),
}

export const DEMO_COMPETITORS: CompetitorSummary[] = [
  { politician: DEMO_ACCOUNT.tracked_politicians[0], statements_today: 5, contradictions_flagged: 1, latest_contradiction_score: 78, status: 'contradiction', last_active: new Date().toISOString() },
  { politician: DEMO_ACCOUNT.tracked_politicians[1], statements_today: 3, contradictions_flagged: 1, latest_contradiction_score: 91, status: 'contradiction', last_active: new Date(Date.now()-2*3600000).toISOString() },
  { politician: DEMO_ACCOUNT.tracked_politicians[2], statements_today: 2, contradictions_flagged: 1, latest_contradiction_score: 72, status: 'contradiction', last_active: new Date(Date.now()-4*3600000).toISOString() },
  { politician: DEMO_ACCOUNT.tracked_politicians[3], statements_today: 2, contradictions_flagged: 1, latest_contradiction_score: 85, status: 'rti',           last_active: new Date(Date.now()-6*3600000).toISOString() },
]

export const DEMO_SCHEMES: SchemeSentiment[] = [
  { scheme_name: 'PM Awas',      sentiment_score: 81, mention_count: 4820, trend: 'up'   },
  { scheme_name: 'Ayushman',     sentiment_score: 76, mention_count: 3940, trend: 'up'   },
  { scheme_name: 'Ujjwala',      sentiment_score: 72, mention_count: 2810, trend: 'flat' },
  { scheme_name: 'PM Kisan',     sentiment_score: 58, mention_count: 5120, trend: 'down' },
  { scheme_name: 'Make in India',sentiment_score: 65, mention_count: 2380, trend: 'up'   },
]

export const DEMO_ISSUE_OWNERSHIP: IssueOwnershipPoint[] = [
  { month:'Jun',politician_score:68,opposition_score:32 },{ month:'Jul',politician_score:65,opposition_score:35 },
  { month:'Aug',politician_score:67,opposition_score:33 },{ month:'Sep',politician_score:64,opposition_score:36 },
  { month:'Oct',politician_score:62,opposition_score:38 },{ month:'Nov',politician_score:61,opposition_score:39 },
  { month:'Dec',politician_score:63,opposition_score:37 },
]

export const DEMO_STATE_VOLUMES: StateConversationVolume[] = [
  { state_name:'Uttar Pradesh', volume:94, sentiment:71, top_topic:'PM Modi / BJP', mention_count:142000 },
  { state_name:'Maharashtra',   volume:88, sentiment:62, top_topic:'Opposition Campaign', mention_count:118000 },
  { state_name:'Delhi',         volume:91, sentiment:48, top_topic:'#ModiMustExplain', mention_count:134000 },
  { state_name:'West Bengal',   volume:72, sentiment:44, top_topic:'Federalism Debate', mention_count:81000  },
  { state_name:'Bihar',         volume:78, sentiment:68, top_topic:'Viksit Bharat', mention_count:89000  },
  { state_name:'MP',            volume:65, sentiment:74, top_topic:'PM Awas Yojana', mention_count:64000  },
  { state_name:'Rajasthan',     volume:61, sentiment:66, top_topic:'BJP Campaign', mention_count:58000  },
  { state_name:'Gujarat',       volume:58, sentiment:79, top_topic:'Make in India', mention_count:52000  },
  { state_name:'Karnataka',     volume:54, sentiment:51, top_topic:'Economic Policy', mention_count:47000 },
  { state_name:'Tamil Nadu',    volume:48, sentiment:45, top_topic:'NEET / Federalism', mention_count:38000 },
]
