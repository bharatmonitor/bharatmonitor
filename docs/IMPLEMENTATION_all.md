# BharatMonitor — "All things" implementation guide

Four workstreams. Every new .ts/.tsx file typechecks against your project.

---

## A. Plan caps — basic 1 / advanced 5 / elections 15 (#2)

**File:** `src/lib/planLimits.ts` (new). Cap map keyed to your existing `Tier`.

**Wire into account creation** (`src/lib/accounts.ts`, top of `createAccount`):

```ts
import { assertCanCreateAccount } from './planLimits'

export async function createAccount(data: Partial<Account>, creatorTier: Tier, createdBy: string): Promise<Account> {
  await assertCanCreateAccount(createdBy, creatorTier)   // throws if at cap
  // ...existing body unchanged...
}
```

**Wire into the UI** (GodModePage / wherever the "Create account" button lives):

```ts
import { getCapState } from '../lib/planLimits'
const cap = await getCapState(currentUser.id, currentUser.tier)
// disable the button + show: `${cap.used}/${cap.cap} accounts used`
<button disabled={!cap.canCreate}>+ New account</button>
{!cap.canCreate && <span>Plan limit reached — upgrade to add more.</span>}
```

God tier is `Infinity` (uncapped). The `assert` is the defensive backstop; the UI
state is the friendly path.

---

## B. India-map branding (#3)

**Files:** `src/components/brand/BrandLogo.tsx` (new), plus `logo-mark.svg`,
`logo-lockup.svg`, `favicon.svg` (static assets). Brand sheet: `branding.html`.

- Replace the favicon: drop `favicon.svg` into `/public/favicon.svg`.
- Use the component everywhere a logo appears:

```tsx
import { BrandLogo } from './components/brand/BrandLogo'
<BrandLogo variant="lockup" height={40} />   // sidebar header, auth page, report header
<BrandLogo variant="mark"   height={28} />   // collapsed sidebar, mobile
```

> The mark is a **stylised** India silhouette (not the flag). For any **literal**
> map render (the district choropleth), use a Survey-of-India-compliant boundary —
> full claimed territory incl. J&K, Ladakh, Arunachal — a legal requirement for an
> Indian entity. The logo's stylisation sidesteps this; a literal map doesn't.

---

## C. Mandatory social-login gate (#1)

**Files:** `src/lib/socialConnect.ts`, `src/components/SocialGate.tsx` (new),
`social_connections.sql` (run in Supabase).

**Wire the gate** around the authenticated app (e.g. in `App.tsx` after auth):

```tsx
import { SocialGate } from './components/SocialGate'
<SocialGate userId={user.id}>
  <AuthenticatedApp />
</SocialGate>
```

Until X + Meta + Google are connected, the app shows the connect screen. Reddit is
optional. Change which are mandatory via the `required` flag in `socialConnect.ts`.

**What still needs real credentials (can't be stubbed):**
1. Register an OAuth app with each provider (X, Meta, Google Cloud, Reddit).
2. Add client IDs as Vite env vars: `VITE_TWITTER_CLIENT_ID`, `VITE_META_CLIENT_ID`,
   `VITE_GOOGLE_CLIENT_ID`, `VITE_REDDIT_CLIENT_ID`.
3. Set each provider's redirect URI to `https://<your-domain>/oauth/callback`.
4. Add a **`bm-oauth-callback` edge function** (service role) that: validates the
   `state`, exchanges the `code` for tokens, and upserts a `social_connections` row
   with `access_token`/`refresh_token`/`expires_at`. Tokens never touch the client.
5. The ingest then reads those tokens (server-side) instead of the current
   keyless/RapidAPI sources — this is the "use for tracking" half.

The client gate, connection state, schema, and OAuth initiation are done; items
1–5 are the server/credential half that only you can provision.

---

## D. Ingest body capture (#5)

See `INGEST_PATCH.md` — three edits to `bm-ingest-v2/index.ts` so quote-only
mentions are captured and analysed, not dropped. This is what makes the
issue-ownership pie and scheme tracking trustworthy.

---

## Order I'd ship in
1. **Branding** (zero risk, instant polish) — favicon + BrandLogo everywhere.
2. **Plan caps** (small, self-contained, revenue-relevant).
3. **Ingest body capture** (improves every chart's accuracy).
4. **Social gate** (biggest — needs the OAuth apps + callback function).

---

## E. India choropleth (the map)

**Files:** `src/components/maps/indiaPaths.ts`, `src/components/maps/IndiaChoropleth.tsx`.

```tsx
import { IndiaChoropleth } from './components/maps/IndiaChoropleth'
import { INDIA_STATES, CHHATTISGARH_DISTRICTS } from './components/maps/indiaPaths'
import { geoSentimentByRegions } from './lib/chartData'

// National (36 states/UTs)
const stateData = {}; for (const s of Object.keys(INDIA_STATES)) Object.assign(stateData, geoSentimentByRegions(feed, [s]))
<IndiaChoropleth mode="india" data={geoSentimentByRegions(feed, Object.keys(INDIA_STATES))} />

// Chhattisgarh districts (the hero view)
<IndiaChoropleth mode="chhattisgarh" data={geoSentimentByRegions(feed, Object.keys(CHHATTISGARH_DISTRICTS))} />
```

Region match is by `geo_tags` + headline/body text. District names follow the
source dataset (e.g. "Raipur", "Bastar"); align your `geo_tags` taxonomy to them
for best fill coverage.

---

## SOCIAL_TRACKING_NOTE — does social login give you tracking? (mostly NO)

Verified May 2026. **Connecting a user's social account ≠ being able to track
mentions.** Auth and data-access are different grants:

- **X / Twitter:** the user OAuth token reads *their own* timeline/mentions only.
  Tracking keywords/opponents/public discourse needs the **X API search endpoints**,
  which are paid — the old free/Basic/Pro tiers are closed to new signups; it's now
  pay-per-use (reads ~$0.005+/post, capped at 2M/mo before Enterprise ~$42k+). So you
  still need a paid API product (or a third-party provider like the RapidAPI scrapers
  you already use). Login does not unlock it.
- **Meta (FB/IG):** OAuth gives you only Pages/IG-Business accounts the user *owns*.
  Broad public monitoring is gone — **CrowdTangle shut down Aug 2024**; its successor
  **Meta Content Library is academic/non-profit only**, not available to a commercial
  SaaS. There is no official way to track opponents' public FB/IG content via login.
- **Google / YouTube:** tracking coverage uses the **YouTube Data API key + quota**
  (app-level), not the user's login. OAuth would only read the user's own channel.
- **Reddit:** here the OAuth *app* credentials effectively ARE the read API — this is
  the one platform where "connect" ≈ "track".

**Implication for the mandatory-login model:** it works to analyse the client's
*own* accounts/pages, but the political-monitoring value (opposition, hashtags,
public sentiment) still depends on paid platform APIs and third-party providers —
not on the user logging in. Treat the social gate as identity + own-account
analytics, and keep your existing ingest (Google News, GDELT, providers) as the
monitoring backbone. Budget for the X API / a Twitter data provider separately if
X mention-tracking matters.
