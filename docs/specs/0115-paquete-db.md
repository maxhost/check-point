---
spec: 0115
fecha: 2026-09-30
estado: implementada
resumen: Fase 1 del ADR 0107 — el esquema, el cliente de base, el catalogo de permisos, drizzle.config y las migraciones salen de apps/merchant a packages/db (@mi-pasaporte/db); los 285 archivos que importan se reescriben al paquete, sin shims; cero cambio de comportamiento, probado con drizzle-kit generate («sin cambios») y los sha256 de las 58 migraciones identicos.
disjunta: si
archivos: packages/db/**, pnpm-workspace.yaml, pnpm-lock.yaml, package.json (root), tools/neon-test.sh, .github/workflows/*.yml (solo si nombran la ruta), apps/merchant/{package.json,next.config.ts,tsconfig.json,vitest.config.ts,drizzle.config.ts,drizzle/**}, apps/merchant/src/** (solo lineas de import), vitest.config.ts, docs/**
---

# 0115 — Fase 1: `packages/db`

> ADR 0107, fase 1. Refactor mecanico: **ningun cambio de comportamiento**. Plantilla grande por tocar infraestructura
> de build, migraciones y el despliegue de merchant.

## Problema

El esquema (`apps/merchant/src/server/schema.ts` + `schema/*`, 28 archivos), el cliente (`server/db.ts`), la config de
drizzle (`apps/merchant/drizzle.config.ts`) y las migraciones (`apps/merchant/drizzle/`, 0000–0058) viven en merchant;
285 archivos los importan, mas 30 `vi.mock` (medido 2026-09-30 con el patron de la DoD, que es preciso: en merchant no hay otro modulo llamado `db`, `schema` ni `permissions-catalog`). La app del cliente (fase 2) no puede usarlos sin importar merchant.
El esquema depende de un solo archivo externo: `server/permissions-catalog.ts` (`schema/membership.ts:14`), que no
importa nada y lo usan 8 archivos.

## Alcance

**Entra:**
1. `packages/db` = `@mi-pasaporte/db` (`private`, `"type": "module"`, exporta **fuente TS**): `src/schema.ts` +
   `src/schema/*` (movidos tal cual), `src/client.ts` (el `server/db.ts` actual), `src/permissions-catalog.ts`,
   `drizzle.config.ts` (rutas relativas al paquete), `drizzle/` (**las 59 migraciones + `meta/` movidas byte a byte**,
   `git mv`), scripts `db:generate` / `db:migrate`, `typecheck`, y `vitest.config.ts` si alguna prueba se mueve.
   Entradas del paquete (`exports`): `.` (client + tipos), `./schema`, `./schema/*` (hay imports a subrutas: `schema/catalog-import`, `schema/welcome-device`, `schema/web-push`), `./permissions-catalog`.
   Dependencias: `drizzle-orm`, `@neondatabase/serverless` (mismas versiones), `drizzle-kit` en dev.
2. `pnpm-workspace.yaml` suma `packages/*`; `pnpm install --offline` (el store esta en el repo) y se commitea el
   lockfile. Si `--offline` no alcanza por DNS, se declara y se frena (no `pnpm fetch`: CLAUDE.md).
3. **Codemod de imports** en `apps/merchant/src/**` (incluidos los tests): todo import de `server/db`,
   `server/schema`, `server/schema/*` y `server/permissions-catalog` pasa a `@mi-pasaporte/db`,
   `@mi-pasaporte/db/schema` o `@mi-pasaporte/db/permissions-catalog`. **Sin archivos puente** en merchant (ADR 0107
   §1). Los `vi.mock("./db")` / `vi.mock("../db")` de los tests se reescriben al nuevo specifier — es el MISMO modulo,
   cambia su nombre: no se tocan aserciones.
4. `apps/merchant`: dependencia `"@mi-pasaporte/db": "workspace:*"`; `next.config.ts` `transpilePackages:
   ["@mi-pasaporte/db"]`; tsconfig/vitest resuelven el paquete; se borran `drizzle.config.ts`, `drizzle/` y los
   scripts `db:*` de merchant.
5. Root: `db:migrate` → `pnpm --filter @mi-pasaporte/db db:migrate`; `tools/neon-test.sh` y cualquier workflow que
   nombre `apps/merchant/drizzle` o el filtro de merchant para migrar, actualizados; `vitest.config.ts` de root suma el
   paquete si tiene tests.
6. Docs que nombran la ruta vieja de migraciones o `db:migrate` de merchant: `CLAUDE.md` no; la skill
   `gotchas-del-repo` y `docs/despliegue-publico.md` si aplica — solo la ruta.

**No entra:** cambiar una sola linea de logica, del esquema o de una migracion; paquetes de dominio (fase 2);
`apps/consumer` (fase 2); roles de Postgres (fase 3).

## Definition of Done

- [ ] `shasum -a 256` de cada archivo de `drizzle/*.sql` y `drizzle/meta/*`: la lista antes (desde `apps/merchant`) y
      despues (desde `packages/db`) es **identica** (el hash de drizzle en `__drizzle_migrations` depende del .sql).
- [ ] `pnpm --filter @mi-pasaporte/db exec drizzle-kit generate` → «No schema changes, nothing to migrate» (el
      esquema movido es el mismo que describe la 0058).
- [ ] `tools/neon-test.sh src/server/<una suite>` corre: aplica migraciones sin pendientes y la suite pasa.
- [ ] `rg -l 'from "(\.{1,2}/)+(server/)?(db|schema|permissions-catalog)(/[^"]*)?"' apps/merchant/src` → vacio, y
      `rg -l 'vi\.mock\("(\.{1,2}/)+(server/)?(db|schema)' apps/merchant/src` → vacio. Corridos antes de cerrar la
      spec sobre el arbol viejo: **285** y **30** archivos (los dos patrones muerden).
- [ ] `ls apps/merchant/drizzle apps/merchant/drizzle.config.ts` → no existen.
- [ ] Gates: typecheck, lint, test (**mismo numero de archivos y de tests que antes**: anotar las dos cifras),
      format:check, build (`TURBO_FORCE=1`), `test:e2e`.
- [ ] `pnpm install --frozen-lockfile` desde root (lo que corre Vercel) funciona con el lockfile commiteado.

## Plan de pruebas y verificación

Es un movimiento: el oraculo no son tests nuevos sino **igualdad**. Presupuesto: **3 mutaciones** que prueban que los
oraculos de igualdad muerden:

| # | Mutacion | Oraculo | Guard hermano |
|---|---|---|---|
| M1 | cambiar un `notNull()` de una columna en `packages/db/src/schema/*` | `drizzle-kit generate` deja de decir «No schema changes» (y se descarta lo generado) | typecheck puede o no verlo: la fila exige el generate |
| M2 | un byte en `packages/db/drizzle/0058_*.sql` | la comparacion de sha256 da distinto | ninguno |
| M3 | dejar un import a `./db` en un archivo de merchant | el primer `rg` de la DoD lo encuentra (y el typecheck falla) | typecheck: la fila mide el `rg` |

Conteo de tests: `pnpm run test` antes (sobre el HEAD de partida) y despues; cifras iguales o se explica cada diferencia.

## Handoff requerido

Un implementador y un revisor. Push y deploy de merchant los hace el orquestador tras el PASS; se verifica
`/api/health` y un login en `business.` en PROD.

## Abierto

Nada que bloquee.
