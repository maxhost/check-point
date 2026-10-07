# System overview

Current architecture of CheckPass Club as of 2026-10-06 (commit `7d92027`). This describes
what exists, not a target. Items marked UNCERTAIN could not be confirmed from the repository.

Note: `docs/ARCHITECTURE.md` is the original **proposal** (it says "pendiente de validación")
and does not match the implementation. See "Known architectural ambiguities" below.

## Runtime components

pnpm 11.4 + Turborepo monorepo (package name `mi-pasaporte`), Node 24, TypeScript,
Next.js 16 App Router, React 19.

| Component | Path | Serves | Notes |
|---|---|---|---|
| Merchant app | `apps/merchant` | `business.checkpass.club` | Owner/staff backoffice (`src/app/backoffice/*`), signup (`src/app/[locale]/(merchant)/business`), counter, all merchant APIs (76 `route.ts`), internal cron endpoints, Stripe and OpenAI webhooks. Only app with a proxy (`src/proxy.ts`) and crons (`vercel.json`). |
| Consumer app | `apps/consumer` | `my.checkpass.club` | Customer PWA: `(consumer)/wallet`, `enroll/[programId]`, `c/[webViewToken]`; public API under `src/app/api/public/*` (26 routes) including Apple PassKit web service `wallet/passkit/v1/*`. `/` redirects to `/wallet`. Own Vercel project (ADR 0109, spec 0117). |
| Public site | `apps/public` | `www.checkpass.club` / apex | Marketing landing, `explorar`, `lugares/[slug]`, `negocios`, legal pages, sitemap; 308 redirects for legacy paths (`src/legacy-routes.ts`). No API routes. Vercel project configured in the dashboard (`docs/despliegue-publico.md`). |
| Platform app | `apps/platform` | — | Health route only. No auth, no deploy config. Platform admin is planned (ADR 0003, ADR 0106). |
| `packages/domain` | `packages/domain/src` | library | Shared server logic (`server/`: consumer, wallet, push, marketing, catalog, loyalty-program, brand, counter core, entitlements, r2, stock, hosts), `lib/`, `i18n/`, `components/loyalty/card-preview.tsx`. |
| `packages/db` | `packages/db` | library | Drizzle schema (`src/schema/*.ts`), connection (`src/client.ts`), permissions catalog, 66 SQL migrations in `drizzle/`. |

Dev ports: consumer 3000, platform 3002, public 3003. The merchant `dev` script has no `--port`
flag, so it also defaults to 3000 (UNCERTAIN how it is run locally; `docs/DEPLOY-OWNER-TEST.md`
says 3001). e2e starts its own servers on 3100–3102 (`tests/e2e/support/ports.ts`).

## Frontend / backend boundary

- Server logic runs in Next route handlers and server components. Browsers never access the DB.
- The merchant app rewrites `/api/public/*` to the consumer origin (`apps/merchant/next.config.ts`; ADR 0109).
- Team convention (ADR 0114, ADR 0123): screens/CSS/e2e are one agent's zone, API/server/packages/tooling another's. The written HTTP contract is the boundary. Contracts are spread across 24 annex specs named `docs/specs/NNNN-contratos-de-api.md`, plus "contrato HTTP" sections inside feature specs. See `.glados/contracts/http-contracts.md`.

## Persistence

- Neon Postgres via Drizzle ORM (`packages/db/drizzle.config.ts`, `schemaFilter: merchant_auth, core, consumer`).
- `getDb()` uses neon-http; `withDbTransaction()` uses a neon-serverless WebSocket `Pool` for interactive transactions (`packages/db/src/client.ts`).
- Migrations: `pnpm db:migrate` runs drizzle-kit against `DATABASE_URL_UNPOOLED`.
- Postgres roles:
  - `checkpass_consumer`: least privilege, used by the consumer app (`drizzle/0060_rol_del_cliente.sql`).
  - `customer_reader`: RLS on `app.business_id` (`drizzle/0053_listado_de_clientes.sql`, `0054_contador_de_clientes.sql`).
- `DATABASE_URL` in local env files points to the **production** branch. Tests use a separate Neon branch, `ci-integration` (`tools/neon-test.sh`, spec 0062).

## Authentication and authorization

- **Merchant:**
  - better-auth with the magic-link plugin (owner) and a `merchant_auth` schema (`apps/merchant/src/server/auth.ts`, `src/app/api/auth/[...all]`).
  - Staff log in with `handle@slug` + 6-digit PIN with lockout. The session is minted through better-auth's internal adapter (`src/server/staff-pin.ts`, `src/server/merchant-session.ts`).
  - Guards:
    - pages: `requireBackofficeSession`, `requireOwner` (`src/server/auth-guards.ts`)
    - account APIs: `requireApiOwner` (`src/server/api-owner.ts`)
    - delegable APIs: `requireApiPermission` (`src/server/api-permission.ts`)
    - counter: `src/app/api/counter/_auth.ts`
- **Consumer:** custom Google/Apple OIDC (`packages/domain/src/server/consumer/oauth/*`, `apps/consumer/src/app/api/public/auth/*`), with a `consumer_session` cookie and the `__Host-cp_oauth` state cookie. No better-auth.
- **Platform:** none.
- **Tenant isolation:** the business id is derived from the session membership server-side. The customer list adds DB-level RLS.

## Background jobs

| Job | Trigger | Endpoint |
|---|---|---|
| Loyalty expiry | Vercel cron `5 5 * * *` | `/api/internal/loyalty-expiry` |
| Asset cleanup | Vercel cron `17 5 * * *` | `/api/internal/assets-cleanup` |
| Marketing tick | GitHub Actions, every 6 h (`.github/workflows/marketing-tick.yml`) | `/api/internal/marketing-tick` |
| Catalog import reconcile | GitHub Actions, every 5 min (`.github/workflows/catalog-import-reconcile.yml`) | `/api/internal/catalog-imports/reconcile` |
| Wallet push worker | cron-job.org, every 10 min from 07:00 to 18:00 (ADR 0118; external, not in repo) | `/api/internal/wallet-push` |
| OpenAI callback | OpenAI webhook | `/api/internal/catalog-imports/provider-callback` |

All internal endpoints are merchant routes guarded by `CRON_SECRET`. GitHub Actions and
cron-job.org are used because of Vercel Hobby cron limits (`gotchas-del-repo` skill).

## External integrations

| System | Where | Purpose |
|---|---|---|
| Stripe | `apps/merchant/src/server/billing/`, `stripe-config.ts`, `app/api/stripe/webhook` | Subscriptions, checkout, webhook |
| Apple Wallet (PassKit) + APNs | `packages/domain/src/server/wallet/{apple,passkit,apple-art}.ts`, `apps/merchant/src/server/wallet/apns.ts`, consumer `api/public/wallet/passkit/v1/*` | Identity pass, pass updates |
| Google Wallet | `packages/domain/src/server/wallet/google*.ts`, `tools/google-wallet-callback.ts` | Identity pass, save callback |
| Web Push (custom VAPID) | `packages/domain/src/server/push/` | PWA notifications |
| Google / Apple OIDC | `packages/domain/src/server/consumer/oauth/` | Consumer login |
| Resend | `apps/merchant/src/server/email/` | Magic links, transactional email |
| Cloudflare R2 (S3 API) | `packages/domain/src/server/r2.ts` | Logos, product and loyalty images, import files |
| Google Places | `apps/merchant/src/server/places/google.ts` | Business/location lookup at signup |
| OpenAI | `apps/merchant/src/server/catalog-import/providers/` | AI catalog extraction (async + webhook) |
| Pexels | `packages/domain/src/server/stock/` | Stock product photos |
| Neon | `packages/db` | Postgres |
| Vercel | `apps/*/vercel.json`, dashboard | Hosting, crons, firewall (ADR 0124) |
| GitHub Actions / cron-job.org | `.github/workflows/`, ADR 0118 | Scheduled triggers |

## Important data flows

1. **Enroll:**
   - A consumer scans a merchant QR (brand kit poster) and lands on `my.checkpass.club/enroll/[programId]`.
   - They log in with OIDC; a `program_membership` is created and the `business_customer` projection is written in the same operation.
   - An identity pass is issued (Apple, Google or PWA).
   - Pass install triggers the welcome coupon (ADR 0099).
2. **Counter sale:**
   - Staff scans the consumer QR (`api/counter/resolve`) and records a sale (`api/counter/grant`): order rows, loyalty accrual, customer projection, coupon verdict and redemption, cross-sale decision.
   - Push is queued (`wallet_push_queue`) and delivered by the wallet-push worker.
3. **Billing:** Stripe Checkout → webhook (`stripe_webhook_event` claim) → `subscription` → entitlements gate locations and campaigns.
4. **Catalog import:** upload to R2 → OpenAI background job → signed callback or 5-minute reconciler → additive product write.

## Shared infrastructure

- Turborepo tasks (`turbo.json`); root `vitest.config.ts` aggregates app projects plus `tools/`.
- Playwright (`playwright.config.ts`, `tests/e2e/`, chromium; one webkit snapshot spec).
- Lint: ESLint flat config (`eslint.config.mjs`). Formatting: Prettier.
- Merchant UI kit `apps/merchant/src/ui/` with `tools/ui-guard.ts` ratchet.

## Known architectural ambiguities

1. **`docs/ARCHITECTURE.md` contradicts the code.** It lists things that do not exist:
   - packages `packages/auth`, `packages/contracts`, `packages/ui`
   - three better-auth configs and `consumer_auth`/`platform_auth` schemas
   - SMS OTP via ClickSend/Twilio (only leftover `consumer.otp_*` tables and a CHECK in `drizzle/0025_*.sql` remain)
   - Sentry, Upstash, `core.job_runs`

   ADRs are more current than this document.
2. **`docs/despliegue-publico.md` is outdated:** it says `my.` points to the merchant project, but ADR 0109 / spec 0117 gave consumer its own project.
3. **Consumer server logic lives in `packages/domain`,** but its tests (including the Neon suites) live under `apps/merchant/src/server/`. Requests can reach consumer endpoints via the merchant rewrite.
4. **Mapbox leftovers:** `turbo.json` lists Mapbox env vars and a Mapbox dependency is declared, but `src` does not use it (UNCERTAIN whether it is still needed).
5. **Merchant dev port:** both merchant and consumer `dev` default to 3000.
6. **Platform is a placeholder app** in the workspace, typecheck and test graph, with no product code.
7. **The wallet-push trigger is outside the repo** (cron-job.org). Its schedule is only documented in ADR 0118.
8. **Integration suites skip silently** unless run through `tools/neon-test.sh` (or CI with secrets). A plain `pnpm test` shows them as `skipped`, not failed.
