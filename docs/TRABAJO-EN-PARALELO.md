# Trabajo en paralelo: Claude y GPT sobre `main`

Reglas comunes de los dos agentes ([ADR 0114](adr/0114-claude-y-gpt-trabajan-en-paralelo-sobre-main.md)).
Las lee GPT desde `AGENTS.md` y Claude desde `CLAUDE.md`. Si algo de acá choca con un prompt, pregúntale al owner.

## 1. Al empezar

```sh
git pull --ff-only
pnpm ci:status
```

Si el último `main` está rojo, se arregla **primero**, y lo arregla el dueño de la zona que falla (§5).
Después lee tu estado: `docs/estado/gpt.md` (GPT) o `docs/estado/claude.md` (Claude).

## 2. Cada uno en su árbol, sobre `main`

- **GPT:** `~/Documents/claude-workspace/check-point/` (checkout de `main`).
- **Claude:** su worktree (`tools/worktree-new.sh <nombre>`).
- Sin ramas de feature ni PR. Commits chicos, push en el día.

## 3. Cómo se pushea

```sh
git pull --rebase
git push
```

El hook `.githooks/pre-push` (común, se instala una vez con `pnpm hooks:install`) corre en todo push a `main`:
`node tools/check-numbers.ts` (números de spec/ADR duplicados) y `pnpm verify` (gates según lo que cambió; si el
push es solo de docs, solo `format:check`). **Si da rojo, no se pushea.** `git push --no-verify` solo con OK
explícito del owner.

## 4. Reservar un número de spec/ADR

Antes de escribir código: escribe la spec (y su fila de `docs/INDEX.md`), commitea y **pushea solo eso**. El
número queda tuyo. Si al hacer `pull --rebase` aparece otro con tu número, renumera **la tuya** (la que no está
en `origin/main`).

## 5. Zonas

| Zona | Dueño | Globs |
|---|---|---|
| Pantallas | GPT | `apps/*/src/app/**` fuera de `app/api/**` |
| Estilos y estáticos | GPT | `**/*.css`, `apps/*/public/**` |
| e2e | GPT | `tests/e2e/**`, `playwright.config.*` |
| API | Claude | `apps/*/src/app/api/**` |
| Servidor | Claude | `apps/*/src/server/**` |
| Paquetes y migraciones | Claude | `packages/**`, `**/drizzle/**` |
| Tooling, hooks y CI | Claude | `tools/**`, `.githooks/**`, `.claude/**`, `.github/**` |

La frontera es el **contrato HTTP escrito** (ADR 0070): si una pantalla necesita un dato que la API no da, se
pide en el contrato, no se toca el servidor del otro. El hook no bloquea por zona (git no sabe quién pushea):
se respeta por regla y se declara en el handoff.

## 6. Rotura cruzada

Si tu cambio rompe un test de la zona del otro:

- **Arreglo mecánico** (texto, lista de campos, clases): lo arreglas tú en el mismo push.
- **Si no:** anótalo en el estado del otro (`docs/estado/<otro>.md`) y avisa al owner. **Nunca se pushea rojo.**

## 7. Estado por agente

- `docs/estado/claude.md` — lo escribe solo Claude.
- `docs/estado/gpt.md` — lo escribe solo GPT.
- `docs/TASKS.md` arriba solo los enlaza; lo de abajo es histórico.

Cada uno reescribe **su** bloque ESTADO entero al cerrar, después del commit del trabajo y con su sha.

## 8. Conflictos en `INDEX.md` o `PARQUEADO.md`

Conserva **las filas de los dos**. Nunca borres una fila del otro para resolver un conflicto. Si la misma fila
cambió en los dos lados, queda la versión con el estado más nuevo (no dupliques la fila).
