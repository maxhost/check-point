---
adr: 0114
fecha: 2026-10-02
estado: aceptada
resumen: Claude y GPT trabajan en paralelo sobre `main` sin ramas de feature: cada uno en su arbol (GPT en `check-point/`, Claude en su worktree), con zonas (GPT pantallas/CSS/e2e; Claude API/servidor/paquetes/migraciones/tooling; frontera = contrato HTTP), rutina de inicio (`git pull --ff-only` + `pnpm ci:status`), numero de spec/ADR reservado pusheando la spec antes del codigo, un hook `pre-push` comun que BLOQUEA si `pnpm verify` da rojo o hay numeros duplicados, y el ESTADO separado por agente. Las reglas viven en un solo documento que leen los dos (`AGENTS.md` para GPT, `CLAUDE.md` para Claude).
---

# 0114 — Claude y GPT trabajan en paralelo sobre `main`

## Contexto

El 2026-10-02, en un solo día de trabajo en paralelo:

- `main` avanzó 12 commits de GPT mientras Claude trabajaba en `motor`; el merge tocó 54 archivos.
- **Colisión de números:** los dos escribieron specs 0121-0123; las de Claude se renumeraron a 0124-0129.
- Cambios de UI/copy de GPT (`4a69db7`, `c2374a9`, `f61b163`, `e7e95cc`) dejaron rojos tests de servidor y e2e que nadie
  corrió antes de pushear; `main` quedó con la CI roja sin que nadie lo viera (PARQUEADO #69, ya arreglado).
- Conflicto repetido en el bloque ESTADO de `docs/TASKS.md` (lo escriben los dos).
- No había hooks de git ni `AGENTS.md`: GPT solo seguía lo que el owner le pegaba en cada prompt.
- Los dos commitean como «Maxi»: git no distingue al autor.

Medido además: `merge=union` en `INDEX.md` habría DUPLICADO la fila 0131 en el conflicto real del día (una fila con el
estado viejo y otra con el nuevo). Se descarta.

## Decisión (owner, 2026-10-02)

1. **Un documento de reglas** (`docs/TRABAJO-EN-PARALELO.md`), referido desde `AGENTS.md` (GPT) y `CLAUDE.md` (Claude).
2. **Rutina de inicio** de los dos: `git pull --ff-only` + `pnpm ci:status`. `main` rojo se arregla primero, por el dueño
   de la zona que falla.
3. **Cada uno en su árbol, sobre `main`, sin ramas de feature ni PR:** GPT en `check-point/`, Claude en su worktree.
   Commits chicos, push en el día, `git pull --rebase` antes de pushear.
4. **Hook `pre-push` común que BLOQUEA** (`.githooks/pre-push`, `core.hooksPath`; los worktrees comparten `.git`, así que
   una instalación cubre a los dos): rechaza números de spec/ADR duplicados y corre `pnpm verify` (si el push es solo de
   docs, solo `format:check`). Escape: `git push --no-verify`, solo con autorización del owner.
5. **Número reservado** pusheando la spec (y su fila del INDEX) antes de escribir código.
6. **Zonas:** GPT = `apps/*/src/app/**` fuera de `api/`, CSS, `apps/*/public/**`, `tests/e2e/**`. Claude = `app/api/**`,
   `src/server/**`, `packages/**`, migraciones, `tools/**`, hooks, CI. Frontera = contrato HTTP escrito (ADR 0070). Se
   respetan por regla y por handoff (git no sabe quién pushea, así que el hook no bloquea por zona).
7. **Rotura cruzada:** quien pushea arregla el test del otro si el arreglo es mecánico (texto, lista de campos, clases);
   si no, lo anota en el estado del otro y avisa al owner. Nunca se pushea rojo.
8. **Estado por agente:** `docs/estado/claude.md` y `docs/estado/gpt.md`; `docs/TASKS.md` arriba solo los enlaza.

## Consecuencias

- Ningún push a `main` sin `pnpm verify` verde (~1-3 min típicos, ADR 0113).
- Los hooks de Claude que leen el ESTADO (`tasks-fresh.sh`, `state-uncommitted-lie.sh`) pasan a `docs/estado/claude.md`.
- Una clonación nueva del repo necesita `pnpm hooks:install` una vez.
