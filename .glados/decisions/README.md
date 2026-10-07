# Decisions

Architecture and product decisions are recorded as ADRs in **`docs/adr/`** (121 files on
2026-10-06, numbered `0001`–`0125` with gaps). They are the source of truth; GLaDOS onboarding
did not copy or create any ADR.

- **Index:** `docs/INDEX.md` has one row per ADR/spec (what it is, why it matters, status).
  Search it with `rg`; do not read it whole (373 lines).
- Each ADR has a one-line `resumen:` in its frontmatter: `rg -n "^resumen" docs/adr`.
- **Specs** (`docs/specs/`, 188 files) carry the state of each feature
  (`estado: borrador | cerrada | implementada | anexo | deprecada | ...`).
  - Templates: `docs/specs/TEMPLATE.md` (full) and `TEMPLATE-CHICA.md` (single domain, no
    migration, no open product decision).
- **Deferred work:** `docs/PARQUEADO.md` is the only list of parked/postponed items.
- **Owner's words:** before asking the owner something, search `docs/TASKS.md`,
  `docs/PARQUEADO.md` and the relevant ADR (`CLAUDE.md` §Verificacion). An ADR overrides a
  code docblock.
- **Incident history:** `docs/LECCIONES.md` records the dated case behind each harness rule.
- **Known numbering issues:** some numbers are duplicated across specs (e.g. two `0055-*`, two
  `0099-*`, two `0101-*` files). `node tools/check-numbers.ts` detects new duplicates.
- `docs/ARCHITECTURE.md` is the original proposal and is stale in places; prefer the ADRs.
