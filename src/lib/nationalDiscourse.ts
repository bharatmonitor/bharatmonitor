// BharatMonitor — National Discourse Engine
//
// Two layers of national tracking (separate from account keywords):
//
// Layer 1: WATCHLIST ACCOUNTS — curated Indian political journalists/commentators
//          whose every post is tracked (GovernanceVibe methodology)
//
// Layer 2: NATIONAL KEYWORDS — broad political discourse terms
//          covering all major narratives running at any given time

// ─── Layer 1: Indian Political Twitter Watchlist ──────────────────────────────
// ~150 verified journalists, commentators, and political voices
// Sourced from: Wire, NDTV, Indian Express, The Hindu, Mirror Now, News18, ABP, Aaj Tak
// Covers: Left, Centre, Right — full spectrum for unbiased national discourse

export const POLITICAL_WATCHLIST = {
  journalists: [
    // Wire / Caravan / independent
    '@svaradarajan', '@MkBhadrakumar', '@dhanyarajendran', '@AbhinandanSekhr',
    '@thewire_in', '@caravanmag', '@scroll_in',
    // NDTV
    '@navikakumar', '@VishnuNDTV', '@sidhant', '@suhasinih', '@Geeta_Mohan',
    '@AnoushkaMehta', '@VishnuSom', '@HitenBheda',
    // Indian Express / Financial Express
    '@nistula', '@ameytirodkar', '@PrabhuChawla', '@ShekharGupta',
    '@iSpeakFinance', '@PriyaGupta_IE',
    // The Hindu
    '@sanket', '@mkvenu1', '@suresh_bhusari', '@_pallavabhatt', '@sureshprabhuET',
    // News18 / CNN-News18
    '@navikakumar', '@shankar_news18', '@amitk_journo',
    // Republic / Times Now
    '@RheemaParashar', '@AshokShrivasta6', '@prafullaketkar', '@TimsyJaipuria',
    // ABP / Aaj Tak / India Today
    '@RajdeepSardesai', '@sardesairajdeep', '@bdutt', '@rohini_sgh',
    '@swatimaliwal', '@gauravcsawant',
    // Mirror Now / ET Now / CNBC
    '@fayedsouza', '@NeerajCNBC', '@ShereenBhan', '@UpendrraRai',
    // Freelance / substack
    '@mrajshekhar', '@oratorgreat', '@vaishnaroy', '@GulshanRKhatri',
    '@DanishKh4n', '@jugalrp', '@RonoMaz', '@iindrojit', '@adityakalra',
    '@maryashakil', '@sneheshphilip', '@Anurag_Dwary', '@sahilpndy',
    '@pallavabagla', '@santwana99', '@RRRameshRRR',
  ],
  politicians_tracked: [
    // Government voices
    '@narendramodi', '@AmitShah', '@JPNadda', '@rajnathsingh', '@nsitharaman',
    '@PMOIndia', '@BJP4India', '@PIBIndia',
    '@myogiadityanath', '@CMOkarnatakaGov', '@CMOMaharashtra',
    // Opposition
    '@RahulGandhi', '@INCIndia', '@ArvindKejriwal', '@AamAadmiParty',
    '@mamataofficial', '@AITCofficial', '@MKStalin', '@DMKofficial',
    '@priyankagandhi', '@akhileshyadav', '@SamajwadiParty',
    '@asadowaisi', '@HMOwaisi', '@siddaramaiah', '@DKShivakumar',
    '@RevanthOfficial', '@TelanganaCMO',
    // Commentators
    '@YogendraYadav', '@PrashantKishor', '@kapilsibal', '@P_Chidambaram_IN',
  ],
}

// ─── Layer 2: National Discourse Keywords ────────────────────────────────────
// Comprehensive keyword set covering all major political narratives
// Rotated/updated based on news cycle — these are the "always-on" national set

export const NATIONAL_DISCOURSE_KEYWORDS: Record<string, string[]> = {
  governance: [
    'Modi government', 'BJP policy', 'Parliament session', 'Cabinet decision',
    'Central government', 'Prime Minister Modi', 'Amit Shah', 'Rajnath Singh',
  ],
  opposition: [
    'Rahul Gandhi', 'INDIA bloc', 'Congress party', 'Arvind Kejriwal',
    'Mamata Banerjee', 'MK Stalin', 'opposition India', 'Akhilesh Yadav',
  ],
  economy: [
    'India GDP', 'inflation India', 'unemployment India', 'Indian economy',
    'RBI policy', 'rupee dollar', 'India growth', 'Make in India',
  ],
  social: [
    'women reservation bill', 'OBC reservation', 'caste census India',
    'delimitation India', 'CAA NRC India', 'farmers protest India',
  ],
  elections: [
    'Bengal election', 'West Bengal polls', 'Bihar election', 'UP election',
    'election commission India', 'EVM India', 'voter list India',
  ],
  institutional: [
    'ED raid India', 'CBI India', 'Supreme Court India', 'Election Commission',
    'media freedom India', 'IT rules India', 'press freedom India',
  ],
  geopolitics: [
    'India China border', 'India Pakistan', 'India US relations',
    'Jaishankar', 'India foreign policy', 'BRICS India',
  ],
  crisis: [
    'India protest', 'India riot', 'India violence', 'India flood',
    'India labor strike', 'India shutdown', 'India bandh',
  ],
}

// Flatten for use in ingest
export const ALL_NATIONAL_KEYWORDS: string[] = Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat()

// Get a rotating set of 8 national keywords for each ingest cycle
// (prevents hitting quota with all 60+ keywords at once)
export function getNationalKeywordsForCycle(cycleIndex = 0): string[] {
  const all = ALL_NATIONAL_KEYWORDS
  const start = (cycleIndex * 8) % all.length
  return all.slice(start, start + 8)
}

// Get watchlist accounts as search queries for XPOZ/CSE
export function getWatchlistQuery(limit = 10): string {
  const allAccounts = [...POLITICAL_WATCHLIST.journalists, ...POLITICAL_WATCHLIST.politicians_tracked]
  const shuffled = allAccounts.sort(() => Math.random() - 0.5).slice(0, limit)
  return shuffled.map(h => h.replace('@', 'from:')).join(' OR ')
}
