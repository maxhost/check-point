# 0242 CP2a.5 — catálogo v2 servidor

Base: `c822e40c8343694cfe6639b4e5854d61be2db7eb`. Código entregable: `68030da912c86a51ae5721b9bd5057aebe88f6cc`. Rama/worktree: `catalog-v2-server-0242`, `/private/tmp/checkpass-pos-0242/catalog-v2-server-0242`. El commit de cierre solo documenta evidencia; no cambia código probado. Sin push/PROD, cambios de esquema/barreras, dependencias ni lockfile.

## Contrato y paths

GET/POST/PUT existentes seleccionan contrato2 por `X-Catalog-Contract: 2`, conservan guards y responden private,no-store también en errores. DELETE conserva owner-only y payload; con header2 también protege éxito/error con caché privada. DTO explícito sin claves privadas; v1 conserva shape y rechaza tarifas/medidas incompatibles antes de proyectar números. V2 usa parsers exactos y permite conservar únicamente la tarifa unit histórica idéntica al snapshot bloqueado. Arrays/objetos no se coaccionan a unidad. Revisión esperada se coteja bajo mutex business-config y lock producto; conflicto incluye `product` autorizado. Medida/precio/visibilidad y revisión comparten writer/transacción existente. Merchant inyecta callback genérico con la misma tx, incluso old==new; errores/excepciones revierten todo. Solo constraints temporales de producto conocidas se traducen a upgrade_required.

Archivos: domain `server/catalog/{core,products,validation,measured-contract,measured-contract.test}.ts` y barrel `server/catalog.ts`; merchant `app/api/catalog/{route,_auth}.ts`, `product/route.ts`, `product/[id]/route.ts`; `modules/recipes/server/model/common.ts`; suites `modules/{pos,recipes}/server/catalog-v2.neon.integration.test.ts`; este handoff. Scope de la suite Recipes ampliado por coordinador para fixture/proveedor real y mutex sin violar fronteras POS. Sin helper core ni cambios de guardias.

Auditoría publicación: saveComposition, fanoutRecipe desde writeRecipe y cutoverR1 pasan por lockRecipes; helper adquiere business-config antes de recipes-r1. No nuevos publishers ni bases/UI. DTO/listado en core, contrato/medidas en measured-contract, validadores de pertenencia en validation; products conserva writer atómico e imágenes y queda en300 líneas. No segundo algoritmo de dinero.

## Evidencia observable

Node24.20.0/pnpm11.4.0; dependencias propias, env privado seleccionado, sin env productivo copiado. CI exclusiva solo mediante tools/neon-test.sh, `--no-file-parallelism`, `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env`. Wrapper mantiene interlock antiPROD y migraciones vigentes. Aviso de env sin rol consumer: no se seleccionó ni certificó ese rol.

Logs completos fuera del WT: `/private/tmp/checkpass-pos-0242/catalog-v2-server-logs/`. run-check.py registra SHA/comando/stdout+stderr/exit real desde el inicio; configs/scripts privados conservados allí. Identidad del código y reutilización:

| Log | SHA | Resultado |
| --- | --- | --- |
| `ci-68030da9.log` | 68030da9 | POS HTTP real9PASS/0FAIL/0SKIP, EXIT0; auth/tenant/DELETE owner, cache, tarifas/revisión/no-op/conflicto/carrera, high legacy, barreras activas, callback/rollback/503 |
| `ci-a12ed237.log` | a12ed237 | Recipes2PASS y POS8PASS/1FAIL,0SKIP, EXIT1; único fallo caché DELETE corregido por delta68030da9 y repetido arriba. Recipes no usa DELETE; proveedor real old==new y mutex compartido con catálogo/config/publicación PASS |
| `ci-882d0831.log` | 882d0831 | Regresiones revisiones6PASS, catálogo7PASS, sin-email6PASS; POS1FAIL/8SKIP y fallo beforeAll; Recipes2PASS. Corrida completa21PASS/1FAIL/8SKIP, EXIT1; nunca aprobación global |
| `pure-a12ed237.log` | a12ed237 | Contrato puro5PASS/0FAIL/0SKIP, EXIT0; exactitud/padding/rango/history, snapshots, DTO sin leaks, revisión/unidades estrictas, constraints conocidas |
| `types-a12ed237.log` | a12ed237 | domain/db/merchant PASS, EXIT0 |
| `merchant-68030da9.log` | 68030da9 | Tipo del delta merchant PASS, EXIT0 |
| `lint-882d0831.log`, `format-882d0831.log`, `diff-882d0831.log` | 882d0831 | Focales completos PASS; delta parser/tests en lint-revision/format-revision y DELETE en lint-delete-68030da9/lint-format-delete-68030da9/diff-68030da9 PASS |
| `guards-a12ed237.log` | a12ed237 | 24PASS/2FAIL, EXIT1: backlog expenses→stock/count y cinco core literales exactos; cero nuevos offenders |
| `ui-guard-882d0831.log` | 882d0831 | PASS, sin aumentos; delta posterior sin UI |
| `cleanup-a12ed237-fixed.log` | a12ed237 | Orphan exacto retirado y asserts users/sessions/memberships vacíos1PASS, EXIT0 |
| `processes-68030da9.log` | 68030da9 | Cero procesos propios persistentes; inspección misma excluida, EXIT0 |

Las regresiones de882d0831 son compatibles: cambios posteriores endurecen parser inválido, corrigen montaje de tests y envuelven DELETE header2. Los tests pertinentes a esos deltas se repitieron; no se declara una corrida integral verde a partir de corridas rojas. Puros se ejecutan explícitamente con `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/catalog-v2-server-logs/pure.config.mjs` (config y comando completos preservados).

## Fallos corregidos, teardown y límites

Primera fixture staff[] violó CHECK y dejó user antes de fallar membership; sustituida por permiso business válido. Orphan exacto `counter-int-25e18611-a8bb-4a33-8aef-152750534809`, origen en ci-882d0831.log, retirado por test/config privados vía wrapper, solo DELETE por ese ID. Primer intento cleanup-a12ed237.log falló lectura por schema incorrecto antes del DELETE, EXIT1; segundo usa tablas ORM reales y confirma ausencia. Test503 fuera describe movido dentro; caché DELETE corregida conservando aserción. QA encontró coerción array→unidad; parser exige string y negativos array/objeto PASS. Primer lint falló por import residual y formato al separar suites por cierre sobrante; corregidos y logs preservados. Guardias iniciales22PASS/4FAIL por fixture Recipes en POS, trasladada al scope ampliado. No se modificaron tests para ocultar fallos del producto.

Suites propias verifican en afterAll ausencia de negocios/owners/staff/sesiones; sin errores de teardown en las corridas finales. Orphan inicial resuelto; cero procesos propios persistentes, no servidores/túneles iniciados. Git EPERM en index.lock se resolvió con escalación solo add/commit propios; ps ordinario bloqueado se verificó read-only escalado.

No se certifican aún escrituras mass/precisión real, retirada de unidad en uso ni carreras mass: barreras0102/0103/0105 permanecen activas hasta CP2c. Sí se observó rechazo seguro409 de intentos mass/precisión con rollback y revisión intacta. Base publicada incompatible se captura con referencias reales, sin FK imposibles ni retirar barreras; callback real rechaza unit→unit. Request→rutas Next→guard/cookie/sesión→DB reales; no servidor HTTP desplegado/browser/build/fullverify. Un callback simulado prueba excepción/rollback; regresiones históricas sustituyen R2/IA según sus fixtures existentes. Sin nuevos efectos externos. Retengo fixes hasta aceptación; factory/QA/integración corresponden al coordinador y QA independiente.
