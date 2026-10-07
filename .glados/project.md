# Project

CheckPass Club (repository package name `mi-pasaporte`; remote `github.com/maxhost/check-point`,
default branch `main`).

## Purpose

A loyalty and customer-wallet platform for local businesses (the V1 pilot targets bars,
`docs/ROADMAP-V1.md`; the QA test merchants are a bakery, a barber shop and a gym).
A business signs up, configures its brand, locations, product catalog and a loyalty program,
and its staff record sales and redeem rewards/coupons at the counter. Customers enroll with
one tap, log in with Google/Apple, and carry a single identity pass (Apple Wallet,
Google Wallet or PWA) holding their benefits from every business. Automatic campaigns
(currently welcome coupon and cross-sale) issue coupons and notifications. Businesses pay a
subscription through Stripe.

The original product goals are in `docs/ROADMAP-V1.md` and ADRs 0001–0005. The roadmap
predates the current scope (for example, games and platform admin are not built). The code
and recent ADRs are more current.

## Users / actors

- **Owner:** business account; magic-link login; manages brand, locations, catalog, loyalty, marketing, staff, subscription.
- **Staff:** `handle@slug` + PIN; per-object permissions (`brand, catalog, counter, locations, loyalty, marketing, staff`); mainly operates the counter.
- **Consumer:** customer PWA at `my.checkpass.club`; Google/Apple login; wallet pass.
- **Public visitor:** marketing site at `www.checkpass.club`.
- **Platform admin:** planned only (ADR 0003, 0106); `apps/platform` is a stub.
- **System actors:** Vercel cron, GitHub Actions schedules, cron-job.org, Stripe webhooks, OpenAI webhooks, Apple/Google wallet callbacks.

## Stack

TypeScript monorepo: pnpm 11.4 + Turborepo; Node 24 (`.nvmrc`). Next.js 16 App Router and
React 19 for all apps. Neon Postgres with Drizzle ORM; better-auth for merchants; custom OIDC
for consumers. Vitest (unit + Neon integration), Playwright (e2e), ESLint, Prettier. Hosting
on Vercel (Hobby plan constraints apply to crons).

## Repository structure

| Path | Role |
|---|---|
| `apps/merchant` | Business backoffice, counter, signup, all merchant APIs, cron/webhook endpoints. Most of the code and tests. |
| `apps/consumer` | Customer PWA and public consumer API (enroll, auth, wallet, PassKit web service, push). |
| `apps/public` | Marketing site plus legacy-path redirects. |
| `apps/platform` | Placeholder (health route only). |
| `packages/domain` | Shared server domain logic used by merchant and consumer. Has no tests of its own; it is tested from `apps/merchant`. |
| `packages/db` | Drizzle schema, DB client, SQL migrations (`drizzle/`). |
| `tests/e2e` | Playwright specs and harnesses (`support/`). |
| `tools` | Repo tooling: `verify.ts`, `neon-test.sh`, `ui-guard.ts`, `check-numbers.ts`, etc. (with tests). |
| `docs/adr`, `docs/specs`, `docs/INDEX.md` | Decisions and specs (source of truth for rules and HTTP contracts). |
| `.claude/`, `CLAUDE.md`, `AGENTS.md` | Existing agent harness (see `.glados/architecture/existing-harness.md`). |

Details: `.glados/architecture/system-overview.md`, `.glados/architecture/domain-map.md`.

## External systems

Stripe, Apple Wallet (PassKit) + APNs, Google Wallet, Web Push (VAPID), Google and Apple OIDC,
Resend, Cloudflare R2, Google Places, OpenAI, Pexels, Neon, Vercel, GitHub Actions, cron-job.org.

## Verification

Root scripts (`package.json`): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`,
`pnpm build`, `pnpm format:check`, plus `pnpm verify` (change-aware gate planner, `tools/verify.ts`).

- `pnpm test` runs Vitest across `apps/*` and `tools/`. The `*.neon.integration.test.ts`
  suites (169 files) **skip silently** unless run through `bash tools/neon-test.sh`. That
  script reads the gitignored `apps/merchant/.env.local`, refuses to run against the
  production branch, migrates the Neon `ci-integration` branch and then runs the suites.
- `pnpm test:e2e` starts three `next dev` servers on ports 3100–3102.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, migrations on the CI branch, unit +
  Neon, e2e, build and format:check on every push to `main`.
- `format:check` has no GLaDOS quality slot; Prettier runs through `pnpm format:check` and the
  `format-on-write` hook.
- **Worktrees:**
  - Install dependencies inside the worktree (`pnpm install --frozen-lockfile`, offline-capable; see `tools/worktree-new.sh`).
  - Never symlink `node_modules` from the main checkout: pnpm then tries to purge the real dependencies.
  - The `integration` check also needs `apps/merchant/.env.local` (gitignored) to be present in the worktree.
- `.glados/project.yaml` prefixes each command with `nvm use` because the repo requires Node 24
  and a fresh shell may start on another version.

## Important constraints

- **`DATABASE_URL` is production.** Never run tests or scripts against it. Integration tests
  go through `tools/neon-test.sh` only (`CLAUDE.md`, `AGENTS.md`).
- **Never print `.env` values or prefixes.** Only key names and metadata are allowed (`CLAUDE.md` §Verificacion).
- **No R2 object keys in browser responses.** Routes never serialize R2 `*ObjectKey` fields;
  they return DTOs with the public `*Path` (`CLAUDE.md` §Codigo).
- **Tenant isolation:** the business id always comes from the session membership, never from
  request input (`apps/merchant/src/server/api-owner.ts`, `api-permission.ts`).
- **Value operations** (counter grants/redemptions, coupons) are transactional and idempotent;
  balances are append-only logs (counter ADRs 0014, 0016, 0053, 0054).
- **Do not edit or delete tests to make a gate pass** (`CLAUDE.md` §Codigo, `docs/AGENT-WORKFLOW.md`).
- **When refactoring UI, delete the old UI and its references** (ADR 0070 §17).
- **Merchant UI** must pass `tools/ui-guard.ts`: use kit components and tokens, no raw
  natives, palette or arbitrary values (`docs/design-system.md`, ADR 0123).
- **Copy** uses "tú", never "vos" (`apps/merchant/COPY.md`).
- **Production migrations, Stripe, Vercel crons (Hobby limits), wallet and image formats** have
  measured gotchas in `.claude/skills/gotchas-del-repo/SKILL.md`. Read it before touching them.
- **`tools/wipe-database.sql` is destructive** and is only run with explicit owner
  authorization.
- **Two agents currently share `main`:** Claude owns API/server/packages/tooling and GPT
  owns screens/CSS/e2e (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`).
