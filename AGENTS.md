# AGENTS.md

Instrucciones para GPT/Codex en este repo. Claude lee `CLAUDE.md`; las reglas comunes están en un solo lugar.

## Lectura obligatoria antes de empezar

1. **`docs/TRABAJO-EN-PARALELO.md`** — cómo trabajas en paralelo con Claude sobre `main`: rutina de inicio,
   cómo pushear, reservar número de spec, zonas, rotura cruzada.
2. **`docs/estado/gpt.md`** — tu estado. Lo escribes tú, y solo tú.

## Lo indispensable

- **Tu árbol:** `~/Documents/claude-workspace/check-point/` (checkout de `main`).
- **Tu zona es la UI:** pantallas (`apps/*/src/app/**` fuera de `app/api/**`), CSS, `apps/*/public/**` y
  `tests/e2e/**`. API, servidor, paquetes, migraciones y tooling son de Claude: lo que necesites de ahí se pide
  en el contrato HTTP.
- **Node 24:** corre `nvm use` (sin argumento; hay `.nvmrc`) antes de cualquier comando.
- **Al empezar:** `git pull --ff-only` y `pnpm ci:status`. Si `main` está rojo en tu zona, eso va primero.
- **Antes de pushear:** `git pull --rebase`. El hook `pre-push` corre `pnpm verify` y bloquea si da rojo.
  `--no-verify` solo con OK del owner. Una sola vez por clon: `pnpm hooks:install`.
- **Nunca uses `DATABASE_URL` para tests: es la base de PRODUCCIÓN.** Las suites `.neon.integration` van con
  `tools/neon-test.sh [archivo]`.
- **Copy:** `apps/merchant/COPY.md`. Se tutea (nada de voseo).
- **Specs:** ninguna tarea toca código sin su spec cerrada en `docs/specs/`, escrita con `TEMPLATE-CHICA.md`
  (un dominio, sin migraciones, sin decisión de producto abierta) o `TEMPLATE.md`. Reserva el número
  pusheando la spec y su fila de `docs/INDEX.md` antes del código.
- **Marca `hecho` solo con verificación real:** test que pasa, comando corrido, pantalla vista.
