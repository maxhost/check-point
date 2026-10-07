# HTTP contracts

The repository has no single API document. HTTP contracts live as **annex specs** in
`docs/specs/`, written per feature arc and measured against the code (`file:line`). They
are the authoritative source; this file only points to them.

## Where to look

- Annex contract specs: `docs/specs/NNNN-contratos-de-api.md` (24 files, from `0067` to
  `0155`), plus `docs/specs/0055-contratos-del-orquestador.md` and
  `docs/specs/0099-el-dto-del-programa-y-el-contrato-vigente.md`.
- Feature specs with a "contrato HTTP" section: `rg -l "contrato HTTP" docs/specs`.
- **The most recent contract for an area wins.** Each annex's `resumen:` frontmatter says what it
  consolidates or supersedes (for example, `0101-contratos-de-api.md` is the current contract
  for the 15 `/api/marketing/*` routes and `POST /api/public/push/click`).
  Find candidates with `rg -n "resumen" docs/specs/*contratos-de-api.md`.
- `docs/api-faltantes.md`: marketing APIs that were verified but deliberately not implemented
  (owner decision, 2026-09-27).
- `docs/api-faltante.md`: historical onboarding gaps. Self-marked **partly outdated**; read
  `docs/ui-delta-arco-0076.md` first.

## Route surface (counts measured 2026-10-06)

- `apps/merchant/src/app/api/**/route.ts`: 76 routes.
  - Groups: marketing, catalog, merchant (auth/session), staff, internal (cron/webhooks), onboarding, counter, billing, locations, loyalty-program, places, brand, stripe, loyalty-terms, customers, auth, health.
- `apps/consumer/src/app/api/**/route.ts`: 26 under `api/public/*` (auth, session, enroll, wallet incl. PassKit `v1`, push, consumer, brands, catalog, loyalty, home) plus `health`.
- `apps/merchant/next.config.ts` rewrites `/api/public/*` from the merchant host to the consumer app.

## Rules that apply to every contract

- Responses that carry an entity never include R2 `*ObjectKey` fields; they expose the public `*Path`.
  There is one test per entity (`CLAUDE.md` §Codigo; e.g. `toClientProgram`, `brandResponse`).
- The business id is never taken from the request; it comes from the session membership.
- Under the current team split (ADR 0114), API changes are written into the contract before UI
  work consumes them.
