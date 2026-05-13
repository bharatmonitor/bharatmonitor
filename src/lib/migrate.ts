// Run once on app start — clears stale localStorage from old auth/account formats
export function migrateLocalStorage() {
  try {
    // Clear old auth keys (v3 and earlier)
    ;['bm-auth-v1', 'bm-auth-v2', 'bm-auth-v3'].forEach(k => localStorage.removeItem(k))

    // Check current auth key (v4) for bad user IDs
    const authRaw = localStorage.getItem('bm-auth-v4')
    if (authRaw) {
      const auth = JSON.parse(authRaw)
      const userId = auth?.state?.user?.id
      // Valid IDs: hardcoded demo IDs or 16-digit numbers
      const knownDemoIds = ['9999999999999999','demo-001','demo-advanced','demo-basic','demo-sushant','demo-railways','god-account']
      const isValid = userId && (knownDemoIds.includes(userId) || /^\d{16}$/.test(userId))
      if (userId && !isValid) {
        console.log('[BM] Migrating stale auth session, old id:', userId)
        localStorage.removeItem('bm-auth-v4')
      }
    }

    // Clear bm-accounts-v2 entries with old-format IDs
    const accsRaw = localStorage.getItem('bm-accounts-v2')
    if (accsRaw) {
      const accs = JSON.parse(accsRaw)
      const cleaned = accs.filter((a: any) => /^\d{16}$/.test(a.id))
      if (cleaned.length !== accs.length) {
        console.log('[BM] Removed', accs.length - cleaned.length, 'stale accounts from localStorage')
        localStorage.setItem('bm-accounts-v2', JSON.stringify(cleaned))
      }
    }

    // Clear stale deleted list
    localStorage.removeItem('bm-deleted-v1')
  } catch (e) {
    // If anything goes wrong, nuke the auth so user logs in fresh
    localStorage.removeItem('bm-auth-v4')
    localStorage.removeItem('bm-auth-v3')
  }
}
