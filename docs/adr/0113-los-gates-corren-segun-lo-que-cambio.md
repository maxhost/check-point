---
adr: 0113
fecha: 2026-10-02
estado: aceptada
resumen: Un solo comando, `pnpm verify`, decide que gates correr segun lo que cambio contra `origin/main`: siempre typecheck/lint/format/unit/build; e2e completos solo si se toco UI; integracion Neon SOLO de las suites que importan lo cambiado (`vitest related`), salvo cambios que el grafo de imports no ve (esquema, migraciones, configuracion), que corren Neon completo. La CI de GitHub sigue corriendo todo en cada push a `main` y no se espera: se consulta al empezar cada sesion (`pnpm ci:status`).
---

# 0113 — Los gates corren según lo que cambió

## Contexto

Medido el 2026-10-02 sobre `main` (`49c7c9e`, Node 24):

| Gate | Tiempo |
|---|---|
| typecheck (turbo, con cache) | ~10 s |
| test unit (2272 tests, 238 archivos) | 34 s |
| build (turbo, con cache) | 7 s |
| test:e2e (26 archivos, 106 tests) | 35 s |
| **suites `.neon.integration` (153 archivos)** | **~20 min** |

El costo está en Neon, no en los e2e. Correr las 153 suites por cada feature es lo que hace que un cambio de 3-5 minutos
de código espere 20 de tests (owner, 2026-10-02: «no podemos estar esperando 20 minutos solo de test cuando código lleva
3-5 minutos»).

`vitest related <archivos>` elige los tests por el **grafo real de imports**. Medido: un cambio en
`apps/merchant/src/server/marketing/template-store.ts` selecciona 11 de 153 suites Neon; uno en
`apps/merchant/src/server/counter/coupon.ts`, 11; uno en `apps/merchant/src/app/backoffice/marketing/composer.tsx`, 0.

Y la CI de `main` estaba roja (4 suites Neon en `49c7c9e`) sin que nadie lo supiera: no se esperaba la CI (decisión del
owner del 2026-09-23) y tampoco se la miraba después.

## Decisión

1. **`pnpm verify`** es el gate de toda spec y de todo push, para Claude y para GPT. Calcula los archivos cambiados
   contra `origin/main` (commits + árbol + sin seguimiento) y corre:
   - **siempre:** `typecheck`, `lint`, `format:check`, `test` (unit, todo: es barato), `build`;
   - **e2e completos** si se tocó UI (pantallas fuera de `app/api/`, CSS, `public/`, `tests/e2e/`, config de Playwright).
     Los e2e no se seleccionan: el harness compila componentes en runtime y Playwright no ve esos imports, así que una
     selección perdería tests; cuestan 35 s;
   - **Neon selectivo** (`vitest related` con la rama de CI) si se tocó servidor o `packages/domain`, en cada app afectada;
   - **Neon completo** solo ante lo que el grafo de imports no ve: `packages/db/**` (esquema, migraciones, permisos),
     SQL, configuración de vitest, `package.json`/lockfile y el propio `tools/neon-test.sh`.
2. **La CI de GitHub sigue corriendo todo** en cada push a `main` (red de seguridad). **No se espera.** Se consulta al
   **empezar cada sesión** con `pnpm ci:status` (una llamada a la API pública de GitHub): si el último `main` está rojo,
   eso es lo primero que se arregla.
3. Los protocolos de mutaciones y de revisión independiente no cambian.

## Consecuencias

- Un cambio de servidor típico: ~1-2 min de gates rápidos + ~1-3 min de Neon selectivo. Uno de UI: + 35 s de e2e. Uno
  con migración: los ~20 min, porque ahí el riesgo es real.
- El límite declarado: un acoplamiento que no pasa por imports (SQL crudo contra una tabla que otro archivo también usa,
  un trigger, estado compartido como el lock del tick) puede romper una suite no seleccionada. Lo caza la CI completa y
  se ve en el `ci:status` de la sesión siguiente.
- Reemplaza la regla «los gates son seis, se corren todos» de `CLAUDE.md`.
