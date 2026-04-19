// Analytics — lightweight no-op stubs (Sentry/PostHog removed)
// Replace with your preferred analytics SDK when ready.

export function identifyUser(_userId: string, _email: string, _tier: string, _role: string) {
  // no-op
}

export function resetUser() {
  // no-op
}

export function track(_event: string, _props?: Record<string, any>) {
  // no-op
}

// Pre-defined events
export const analytics = {
  login:            (tier: string) =>           track('login',              { tier }),
  logout:           ()             =>           track('logout'),
  dashboardLoaded:  (accountId: string) =>      track('dashboard_loaded',   { account_id: accountId }),
  feedFetched:      (count: number, src: string) => track('feed_fetched',   { count, source: src }),
  quickScanRun:     (keywords: string[]) =>     track('quick_scan',         { keywords, count: keywords.length }),
  keywordClicked:   (keyword: string) =>        track('keyword_clicked',    { keyword }),
  searchUsed:       (query: string) =>          track('search',             { query }),
  settingsOpened:   ()             =>           track('settings_opened'),
  accountCreated:   (tier: string) =>           track('account_created',    { tier }),
  exportClicked:    ()             =>           track('export_clicked'),
  crisisCardClicked:(bucket: string) =>         track('card_clicked',       { bucket }),
}
