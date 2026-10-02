---
spec: 0135
fecha: 2026-10-02
estado: implementada
resumen: Implementa el ADR 0114: `docs/TRABAJO-EN-PARALELO.md` + `AGENTS.md`, hook `pre-push` comun (numeros duplicados + `pnpm verify`, modo solo-docs), estado por agente en `docs/estado/` y los hooks de Claude apuntando a `docs/estado/claude.md`.
disjunta: si
archivos: docs/TRABAJO-EN-PARALELO.md, AGENTS.md, CLAUDE.md, .githooks/pre-push, tools/check-numbers.ts, tools/check-numbers.test.ts, tools/verify.ts, tools/verify.test.ts, package.json, docs/estado/claude.md, docs/estado/gpt.md, docs/TASKS.md, .claude/hooks/tasks-fresh.sh, .claude/hooks/state-uncommitted-lie.sh
---

# 0135 — Trabajo en paralelo: hook `pre-push`, reglas y estado por agente

> Implementa el **ADR 0114** (decisiones del owner 2026-10-02: GPT sigue en `check-point/`; el hook bloquea; zonas
> como están). Tooling y docs: un dominio, sin migraciones.

## Problema

Ver Contexto del ADR 0114 (medido el 2026-10-02): no hay hooks de git (`$(git rev-parse --git-common-dir)/hooks/` solo
tiene `.sample`), no hay `AGENTS.md`, el ESTADO de `docs/TASKS.md` lo escriben los dos y choca, y nada impide números
de spec duplicados ni pushear rojo.

## Alcance

**Entra:**
1. **`docs/TRABAJO-EN-PARALELO.md`**: las 8 reglas del ADR 0114 en forma operativa y corta: rutina de inicio; árbol de
   cada uno; cómo pushear (`git pull --rebase` → `pnpm verify` lo corre el hook); reservar número; zonas (tabla con
   globs); rotura cruzada; estado por agente; qué hacer en conflicto de `INDEX.md`/`PARQUEADO.md` (conservar las filas
   de los dos, nunca borrar las del otro). ≤ 80 líneas.
2. **`AGENTS.md`** (raíz; lo lee GPT/Codex solo): ≤ 40 líneas. Remite a `docs/TRABAJO-EN-PARALELO.md` (lectura
   obligatoria) y a `docs/estado/gpt.md`, y lista lo indispensable que GPT no puede ignorar: Node 24 (`nvm use`), `pnpm
   verify`, nunca `DATABASE_URL` (es prod) para tests, `apps/merchant/COPY.md` (tuteo), la plantilla de spec, y que su
   zona es UI.
3. **`CLAUDE.md`**: UNA línea en «Flujo de trabajo» que remite a `docs/TRABAJO-EN-PARALELO.md` y a `docs/estado/claude.md`
   como el ESTADO de Claude (reemplaza la mención del bloque ESTADO de `TASKS.md` donde corresponda, sin crecer más de
   3 líneas netas).
4. **`tools/check-numbers.ts`** (autocontenido, Node 24): puro y exportado `duplicateNumbers(names: string[]): string[]`
   que recibe nombres de archivo (`0121-x.md`…) y devuelve los números repetidos; CLI que lo aplica a `docs/specs/` y
   `docs/adr/` (ignora `TEMPLATE*.md`) y sale 1 listando los duplicados con sus archivos.
5. **`tools/verify.ts`**: modo **solo-docs**. Si TODOS los archivos cambiados están bajo `docs/**` o son `*.md` en la
   raíz (`AGENTS.md`, `CLAUDE.md`, `README.md`), el plan corre SOLO `format:check` (los demás gates salen «salteado
   (solo docs)»). `planVerify` gana el campo `docsOnly: boolean`.
6. **`.githooks/pre-push`** (bash, ejecutable): si alguna ref empujada es `refs/heads/main`: corre `node
   tools/check-numbers.ts` y después `pnpm verify` (que calcula contra `origin/main`); cualquier rojo → exit 1 con un
   mensaje que diga qué falló y que el escape `--no-verify` requiere OK del owner. Con Node 24 (`nvm use` si existe).
   Pushes a otras refs: exit 0.
7. **`package.json`**: `"hooks:install": "git config core.hooksPath .githooks"`. **Y se instala** en este repo (los
   worktrees comparten `.git`).
8. **Estado por agente:** `docs/estado/claude.md` con el ESTADO vigente de Claude (lo que hoy está arriba en
   `TASKS.md` y es de Claude) y `docs/estado/gpt.md` con lo que hoy es de GPT (el bloque «SIGUIENTE TRABAJO DEL OWNER —
   TRAMA VIVA EN EL PASE DE LA PWA» y los ESTADO de 0122/0123/0130), cada uno con su encabezado. `docs/TASKS.md` arriba:
   un párrafo corto que enlaza los dos; el resto del archivo (históricos) queda como está.
9. **Hooks de Claude:** `.claude/hooks/tasks-fresh.sh` y `.claude/hooks/state-uncommitted-lie.sh` miran
   `docs/estado/claude.md` en vez de `docs/TASKS.md` (mensajes incluidos). Revisar también `pre-compact.sh`,
   `context-budget.sh` y la skill `handoff`: si INSTRUYEN escribir el ESTADO en `TASKS.md`, pasan a
   `docs/estado/claude.md`; si solo lo leen, se deja.

**No entra:** bloquear por zona (git no conoce al autor), ramas de feature, CI de GitHub.

## Archivos

Los del frontmatter.

**Disjunta?** Sí. GPT no debe tocar `docs/TASKS.md` mientras esto se implementa (lo avisa el owner).

## Definition of Done

- [x] `tools/check-numbers.test.ts` y los casos nuevos de `verify.test.ts` (solo-docs; docs + un `.ts` → NO solo-docs).
- [x] `node tools/check-numbers.ts` sobre el repo real → exit 0 (hoy no hay duplicados).
- [x] **El hook muerde** (protocolo §3 de la skill: exit y mensaje): con una spec duplicada temporal
      (`docs/specs/0134-duplicado-temporal.md`, sin commitear), correr el hook a mano simulando un push a main
      (`echo "refs/heads/main <sha> refs/heads/main <sha>" | .githooks/pre-push origin <url>`) → exit 1 y el mensaje
      nombra 0134; borrar el temporal y repetir → exit 0 (o lo que diga `pnpm verify`). Transcripto.
- [x] `git config --get core.hooksPath` → `.githooks`.
- [x] `pnpm verify --dry-run --files docs/x.md` → solo `format:check`.
- [x] `pnpm verify` del cambio (tabla transcripta).
- [x] `rg -n MUTATION apps tools packages` → vacío.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutación | Oráculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `duplicateNumbers`: comparar el nombre completo en vez del número (dos `0121-a.md`/`0121-b.md` ya no chocan) | `check-numbers.test.ts`, caso de duplicado |
| M2 | `planVerify`: un `.ts` cambiado junto a docs sigue marcando `docsOnly` | `verify.test.ts`, caso docs + `.ts` |

**Protocolo:** `shasum` limpio → bitácora antes de medir → etiqueta `MUTATION` → medir y transcribir → revertir con `diff`.

## Declarado AFUERA

- Que cada agente respete su zona: regla + handoff, sin oráculo.
- El hook se puede saltear con `--no-verify` (por diseño, con OK del owner).

## Handoff

UN implementador; revisión liviana del orquestador.

## Abierto

Nada.
