# Domain map

Business domains of CheckPass Club as they exist in code (2026-10-06, commit `7d92027`).
Domains span directories; nothing was moved to fit this map.

Abbreviations: **M** = `apps/merchant/src`, **C** = `apps/consumer/src`,
**D** = `packages/domain/src/server`, **S** = `packages/db/src/schema`.
Tables are in Postgres schema `core` unless prefixed `consumer.` or `merchant_auth.`.
Decisions: `docs/adr/NNNN-*.md`; specs: `docs/specs/NNNN-*.md` (find with `rg -l` on the number).

Dependency overview:

```text
Counter (mostrador)
├── Loyalty program
├── Catalog
├── Coupons & campaigns (welcome issue, cross-sale, coupon selection)
├── Customers (projection writes)
└── Push notifications

Coupons & campaigns
├── Billing/entitlements (plan gate)
├── Catalog (product rewards)
├── Consumer wallet (pass locations)
└── Push notifications

Consumer wallet & enrollment
├── Loyalty program
├── Customers (projection writes)
└── Apple PassKit / Google Wallet / Google+Apple OIDC

Merchant entry & onboarding
├── Loyalty program (program defaults)
├── Locations / Google Places
└── Resend (email)

Billing & plans ── Stripe; used by Locations, Coupons & campaigns (limits/gates)
Brand ── R2; used by Consumer wallet, brand kit poster
```

---

## Domain: Merchant entry, identity and onboarding

Responsibilities:
- Three-step owner signup: Google Places business → email → program (ADR 0121).
- Passwordless access: owner by magic link, staff by `handle@slug` + PIN.
- Onboarding checklist and tour progress; root redirects to onboarding or panel.

Relevant code:
- `M/server/auth.ts`, `M/server/auth-start.ts`, `M/server/merchant-session.ts`, `M/server/onboarding-signup.ts`, `M/server/qa-login.ts`
- `M/server/onboarding/`, `M/server/places/`
- `M/app/api/onboarding/`, `M/app/api/merchant/auth/`, `M/app/api/merchant/session/`, `M/app/api/places/`, `M/app/api/auth/[...all]/`
- `M/app/[locale]/(merchant)/business/onboarding/`, `M/app/backoffice/onboarding/`
- `tests/e2e/merchant-entry.spec.ts`, `tests/e2e/onboarding-google-places.spec.ts`

Tables: `merchant_auth.{user,session,account,verification,auth_start_attempt}`, `owner_profile`, `business`, `business_onboarding_tour`.
External systems: better-auth, Google Places, Resend.
Depends on: Loyalty program, Locations.
Sensitive: **yes** (authentication, session creation).
Docs: ADR 0070, 0076, 0077, 0078, 0081, 0121; specs 0155, 0156, 0163, 0166.

## Domain: Brand and brand kit

Responsibilities:
- Business name, colors, timezone, logo (stored in R2).
- Printable enrollment poster with QR per location.

Relevant code: `D/brand.ts`, `D/brand/`, `M/server/brand-kit/`, `M/app/api/brand/`, `M/app/backoffice/brand/`, `tests/e2e/brand-*.spec.ts`.
Tables: `business`, `brand_asset_upload`, `brand_asset_cleanup`.
External systems: Cloudflare R2.
Depends on: Consumer wallet (enroll URL from `D/wallet/core`).
Sensitive: no (but R2 key rule applies, see cross-cutting).
Important rules: the client-side cropper is best effort; the server validates (ADR 0041/0047).
Docs: ADR 0019, 0029, 0041, 0047, 0088.

## Domain: Locations

Responsibilities:
- Location CRUD, archive status, opening hours.
- Plan cap on the number of locations.

Relevant code: `M/server/locations/`, `M/app/api/locations/`, `M/app/backoffice/locations/`.
Tables: `location`, `location_verification`, `location_hours`.
External systems: Google Places (`M/server/places/google.ts`).
Depends on: Billing/entitlements, Places, `D/counter/core.ts` (`assertLocationInBusiness`).
Used by: Counter, Billing, Coupons & campaigns.
Sensitive: no.
Important rules: closing a location deletes no customer benefits (ADR 0009).
Docs: ADR 0009, 0042, 0124; spec 0061.

## Domain: Catalog (including AI import)

Responsibilities:
- Products and categories per business; per-location visibility by opt-out.
- Stock photos (Pexels).
- AI import from photos/PDF: asynchronous, additive, written directly; quota; reconciler.
- Manual creation returns 409 while an import is open.

Relevant code:
- `D/catalog.ts`, `D/catalog/`, `D/stock/`
- `M/server/catalog-import.ts`, `M/server/catalog-import/` (providers: `openai.ts`, `openai-callback.ts`, `openai-schema.ts`, `fake.ts`)
- `M/app/api/catalog/`, `M/app/api/internal/catalog-imports/` (`reconcile`, `provider-callback`), `M/app/backoffice/catalog/`
- `tests/e2e/catalog-*.spec.ts`

Tables: `product_category`, `product`, `product_location`, `product_asset_upload`, `product_asset_cleanup`, `catalog_import`, `catalog_import_file`, `catalog_import_cleanup`.
External systems: OpenAI (Responses API, `background: true`, signed webhook callback; default model in `M/server/catalog-import/providers/provider.ts`), Pexels, R2, GitHub Actions cron (`.github/workflows/catalog-import-reconcile.yml`).
Used by: Counter, Coupons & campaigns.
Sensitive: partially (external webhook endpoint, paid API quota).
Docs: ADR 0034, 0082, 0084, 0085, 0086, 0125; specs 0034, 0090, 0091, 0165.

## Domain: Loyalty program

Responsibilities:
- One program per business; mutable cycle with a dated close.
- Accrual (X per block of $Y), rewards catalog, terms per country.
- Card design and stamp image; audit events; expiry job.

Relevant code:
- `D/loyalty-program.ts`, `D/loyalty-program/`
- `packages/domain/src/components/loyalty/card-preview.tsx` (shared UI)
- `M/app/api/loyalty-program/`, `M/app/api/loyalty-terms/`, `M/app/api/internal/loyalty-expiry/`, `M/app/backoffice/loyalty/`
- `C/app/api/public/loyalty/`
- `tests/e2e/loyalty-*.spec.ts`

Tables: `loyalty_program`, `loyalty_program_event`, `loyalty_reward`, `terms_template`, `loyalty_asset_upload`, `loyalty_asset_cleanup`.
External systems: R2, Vercel cron (`apps/merchant/vercel.json`).
Used by: Counter, Merchant onboarding, Consumer wallet.
Sensitive: moderately (customer balances).
Docs: ADR 0020, 0027, 0028, 0036, 0122; specs 0024, 0079, 0099.

## Domain: Counter (mostrador)

Responsibilities:
- Staff scans the consumer QR, records a sale (cart or quick), which accrues stamps/points.
- Reward redemption from an append-only log; balances are never edited.
- Automatic verdict on the coupon the client chose.
- Idempotent on `clientRequestId`.

Relevant code: `M/server/counter.ts`, `M/server/counter/`, `D/counter/core.ts`, `M/app/api/counter/` (`_auth.ts`, `resolve`, `grant`, `redeem`, `coupon-state`, `coupon-remove`), `M/app/backoffice/counter/`, `tests/e2e/counter-*.spec.ts`.
Tables: `order`, `order_item`, `reward_redemption`, `coupon_redemption`, `campaign_coupon`.
Depends on: Loyalty program, Catalog, Customers (projection), Coupons & campaigns, Push notifications, consumer coupon selection (`D/consumer/`).
Sensitive: **yes** (value-granting operations, staff authorization, idempotency).
Important rules: idempotency cannot rely on `NOT EXISTS` (ADR 0054).
Docs: ADR 0014, 0016, 0053, 0054, 0119, 0120; specs 0030, 0055, 0121, 0153, 0154.

## Domain: Coupons and campaigns ("marketing")

Responsibilities:
- Prebuilt campaign templates, one live run per template per business.
- One coupon per client per campaign, valid until the campaign's `ends_at`.
- Welcome coupon on pass install (all plans); cross-sale triggered by purchase.
- Marketing tick; results.

Relevant code:
- `D/marketing/` (`templates.ts`, `enabled-campaigns.ts`, `welcome-*`, `cross-*`, `coupon-issue.ts`, `plan-gate.ts`, `push-delivery.ts`)
- `M/server/marketing/`, plus `M/server/marketing-*-support.ts` test support
- `M/app/api/marketing/`, `M/app/api/internal/marketing-tick/`, `M/app/backoffice/marketing/`
- `.github/workflows/marketing-tick.yml`

Tables: `campaign`, `campaign_location`, `campaign_tick_audience`, `campaign_coupon`, `campaign_push`, `campaign_turn`, `welcome_device`, `cross_decision`, `cross_candidate`, `valley_window`, `valley_detection`, `consumer.pass_placement`.
Depends on: Billing/entitlements (`plan-gate`), Catalog, Consumer wallet (pass locations), Push notifications.
Sensitive: moderately (value issued to customers, push volume).
Important rules:
- Only the `welcome` and `cross` templates are enabled. `COMPOSER_ENABLED`, `PROXIMITY_PLACEMENT_ENABLED` and `CROSS_ON_DEMAND_ENABLED` are `false` in `D/marketing/enabled-campaigns.ts` (ADR 0115).
- Welcome is outside the plan brake (ADR 0112).
- Cross-sale is triggered by a purchase (ADR 0117).

Docs: ADR 0091–0094, 0098, 0099, 0112, 0115, 0117; specs 0107, 0138, 0143, 0145; `docs/notificaciones/` (cross-sale algorithm and fairness).

## Domain: Consumer wallet and enrollment

Responsibilities:
- One-tap enroll into a merchant's program.
- Consumer login with Google/Apple OIDC only (custom code, not better-auth).
- One identity pass per consumer: Apple PassKit, Google Wallet or PWA pass.
- "My benefits": coupons, coupon selection, notices, marketing opt-out.

Relevant code:
- `C/app/(consumer)/` (`wallet`, `enroll/[programId]`, `c/[webViewToken]`), `C/app/api/public/` (`enroll`, `auth`, `session`, `wallet` incl. `passkit/v1`, `consumer`), `C/server/`
- `D/consumer/` (enrollment, identity, session, `oauth/`, coupons, coupon-selection, notices, cross-offers)
- `D/wallet/` (apple, passkit, google, google-object, google-callback, pass-locations)

Tables: `consumer.{consumer_account,consumer_identity,consumer_session,program_membership,wallet_pass}`.
External systems: Apple PassKit + APNs, Google Wallet API, Google and Apple OIDC.
Depends on: Loyalty program, Customers (projection), Brand.
Sensitive: **yes** (consumer authentication, OAuth state, PII, least-privilege DB role).
Important rules:
- The consumer app runs as Postgres role `checkpass_consumer` with explicit grants (`packages/db/drizzle/0060_rol_del_cliente.sql`); per-consumer isolation is a `WHERE consumer_id` in code.
- Re-enroll does not touch the profile (ADR 0051).

Docs: ADR 0031–0033, 0051, 0103, 0107–0111; specs 0028, 0029, 0117, 0118, 0119, 0130; `docs/wallet/`, `docs/wallet-go-live.md`.

## Domain: Push notifications

Responsibilities:
- Wallet pass push queue with priority and cooldown; Web Push (custom VAPID implementation).
- Transport chosen by notice class; notification budgets in one place.
- Queue worker triggered externally by cron-job.org (ADR 0118).

Relevant code: `M/server/wallet/` (push, push-worker, push-plan, push-budget, push-channel, push-transports, apns), `D/push/`, `D/notifications/limits.ts`, `D/marketing/push-delivery.ts`, `M/app/api/internal/wallet-push/`, `C/app/api/public/push/`.
Tables: `consumer.{wallet_push_device,wallet_push_queue,web_push_subscription}`.
External systems: APNs, Google Wallet, Web Push endpoints, cron-job.org.
Used by: Counter, Coupons & campaigns.
Sensitive: moderately (cross-business planning; see `wallet-push-worker-planner-isolation.test.ts`).
Docs: ADR 0037–0040, 0116, 0118; specs 0037, 0038, 0139, 0141, 0142.

## Domain: Customers (merchant CRM view)

Responsibilities:
- Paginated client list read from a projection table that is written in the same transaction as enroll/sale.
- Per-business counter; lifecycle stages.

Relevant code: `M/server/customers/` (`list`, `query`, `reader`), `D/customers/projection.ts` (written from `D/consumer/enrollment.ts` and `M/server/counter/`), `M/app/api/customers/`, `M/app/backoffice/customers/`.
Tables: `business_customer`, `business_customer_count`.
Sensitive: **yes** (tenant isolation enforced at DB level: `set_config('role','customer_reader')` + `app.business_id` RLS, `M/server/customers/reader.ts`; migrations `0053`, `0054`).
Docs: ADR 0100–0102; specs 0108–0110.

## Domain: Staff, permissions and PIN

Responsibilities:
- Only the owner manages staff.
- Seven per-object permissions: `brand, catalog, counter, locations, loyalty, marketing, staff` (`packages/db/src/permissions-catalog.ts`).
- `handle@slug` identifier; 6-digit PIN with lockout; deactivation keeps the record and closes the session.

Relevant code: `M/server/staff*.ts`, `M/server/api-permission.ts`, `packages/db/src/permissions-catalog.ts`, `M/app/api/staff/`, `M/app/api/merchant/auth/staff/`, `M/app/backoffice/staff/`.
Tables: `business_membership` (role CHECK `owner|staff`), `staff_pin_lockout`.
Sensitive: **yes** (authorization).
Docs: ADR 0008, 0044, 0055, 0079, 0080; specs 0043, 0086, 0087.

## Domain: Billing and plans

Responsibilities:
- Stripe Checkout and webhook (with an event-claim step); plan change; immediate downgrade without refund.
- A failed payment blocks access but does not lower the plan.
- Entitlements via `can()` / `limitOf()`.

Relevant code: `M/server/billing/`, `M/server/stripe-config.ts`, `D/entitlements/`, `D/business-status.ts`, `M/app/api/billing/`, `M/app/api/stripe/webhook/`, `M/app/backoffice/subscription/`.
Tables: `subscription`, `stripe_webhook_event`.
External systems: Stripe.
Used by: Locations, Coupons & campaigns (plan gates).
Sensitive: **yes** (money).
Important rules: `status` and `plan` are separate axes (ADR 0073).
Docs: ADR 0058–0061, 0063, 0073; specs 0063, 0064, 0072. Stripe gotchas: `.claude/skills/gotchas-del-repo/SKILL.md`.

## Domain: Platform admin

No implementation. `apps/platform` contains only a health route. Planned in ADR 0003, ADR 0106 (`admin.` subdomain), spec 0008 (historical).

---

## Cross-cutting areas

- **Merchant authentication / authorization:**
  - `M/server/auth.ts` (better-auth: magic link, `merchant_auth` schema)
  - `M/server/auth-guards.ts` (pages: `requireBackofficeSession`, `requireOwner`)
  - `M/server/api-owner.ts` (`requireApiOwner`), `M/server/api-permission.ts` (`requireApiPermission`), `M/app/api/counter/_auth.ts`
- **Tenant isolation:** the business always comes from the session membership, never from the request (`api-owner.ts`, `api-permission.ts`); `operatorBusiness` and `assertLocationInBusiness` in `D/counter/core.ts`; DB-level RLS for the customer list.
- **Host routing:** `M/proxy.ts`, `D/hosts.ts` (ADR 0106). Merchant rewrites `/api/public/*` to the consumer origin (`apps/merchant/next.config.ts`).
- **Database:** `packages/db/src/schema/` (schemas `merchant_auth`, `core`, `consumer`), `packages/db/drizzle/` (66 migrations), `packages/db/src/client.ts`.
- **Images / R2:** `D/r2.ts`, `D/assets/`, `packages/domain/src/lib/image-formats.ts`. Rule (`CLAUDE.md` §Codigo): routes never serialize R2 `*ObjectKey` to the browser; DTOs expose the public `*Path`.
- **Scheduled jobs:** all `M/app/api/internal/*` routes check `CRON_SECRET`.
- **Shared UI:** merchant UI kit `M/ui/` (`tokens.css`; ADR 0123) enforced by `tools/ui-guard.ts`; `packages/domain/src/components/`.
- **i18n:** `packages/domain/src/i18n/` (only `es`). Copy rules in `apps/merchant/COPY.md`.
- **Email:** `M/server/email/` (Resend over fetch, console provider).

## Known architectural ambiguities

1. **Hidden shared kernel:** `D/counter/core.ts` hosts generic helpers (`CounterError`, `pgErrorCode`, `rowsOf`, `parseUuid`, `operatorBusiness`). Billing (`M/server/billing/webhook-apply.ts`), Locations and others import it, so the "counter" name does not describe its scope.
2. **`packages/domain` has no tests of its own.** Its behavior is tested from `apps/merchant/src/server/*` (including Neon suites for consumer logic), so ownership of a test is not visible from the code's location.
3. **Flat `apps/merchant/src/server/`:** 329 entries, many `*-support.ts` test helpers at the root mixed with production modules. A domain's code is easier to find by filename prefix than by directory.
4. **Overloaded terms:**
   - "reward" means a loyalty reward (`loyalty_reward`, `reward_redemption`) and also a campaign reward (`D/marketing/reward-input.ts`, `api/marketing/rewards/results`).
   - "wallet" means the pass in `D/wallet/` and push delivery in `M/server/wallet/`.
   - Coupons are stored in marketing tables, redeemed at the counter and listed by `D/consumer/`.
5. **Dormant marketing code:** valley, at_risk, balance, composer and proximity have code, tables and `skipIf` tests but are disabled (ADR 0115). An agent may change them without any effect being visible.
6. **No e2e coverage** for billing/subscription, staff, customers, locations, marketing, the consumer PWA or enroll. Those rely on unit and Neon suites.
7. **Geoapify leftovers:** the adapter was deleted (spec 0155), but `provider='geoapify'` values remain handled in `M/server/locations/core.ts`.
