# R1 — contrato de implementación de SPEC0232 / ADR0148

Fecha: 2026-10-15. El owner autorizó lanzar dos implementadores y QA independiente después del PASS documental. Base de preparación: `fbc903b728c11ba1bbd6e74a73796a5fa292a388` en dev. Este contrato y el ajuste documental P1 son trabajo del coordinador. La autorización de R1 incluye código, migración y comprobaciones locales/CI protegidas; no incluye push ni operaciones PROD. Se mantienen excluidos INDEX, TASKS y estados comunes. El owner autorizó posteriormente completar R1, pasar QA y hacer merge a main local; después implementar P1, pasar su QA y hacer también merge a main local. No se vuelve a pedir esa aprobación local.

## Fuentes y alcance

Mandatos funcionales: [SPEC0232](../specs/0232-recetas-independientes-y-combos.md), [ADR0148](../adr/0148-recetas-independientes-y-composiciones-versionadas.md), compatibilidad0230 y handoff vigente. El texto «solo documental» de la entrega original describe esa entrega; este encargo posterior autoriza implementarla. No se implementan P1, P3, 1.3, Smart Menu ni UI nueva. P1 solo recibe una actualización de spec/ADR por el coordinador.

Dos implementadores que también corrigen; sin subdelegación ni reviewers adicionales. Dev es integración. Se reutilizan los tres worktrees aceptados mediante `factory continue`; no se retiran ni se fuerzan ramas. Cada worker espera la base y paths asignados antes de escribir. Coordinador opera reservas, integra entregas y mantiene este contrato.

## Interfaces compartidas A → B

`apps/merchant/src/modules/recipes/server/contracts.ts` exporta DTOs y `MAX_RECIPE_LINES`. Servicios propios de Recetas, sin imports desde POS ni core hacia módulos:

- `server/library.ts`: `listLibrary`, `createRecipe`, `readLibraryRecipe`, `updateRecipe`, `archiveRecipe`, `listRecipeRevisions`, `listMigrationRenames`.
- `server/compositions.ts`: `listProducts`, `readComposition`, `saveComposition`, `previewComposition`, `listCompositionRevisions`.

Primer argumento `businessId: string`; ID crudo `unknown` cuando la ruta lo necesita; body `Record<string, unknown>` para escrituras; consultas de lista `URLSearchParams`. Las listas retornan el envelope completo `{recipes|products|revisions|renames,nextCursor}`. Las operaciones puntuales retornan DTO directo y B agrega `{recipe}`, `{composition}` o `{preview}` según la spec. Errores `ModuleError` y HTTP completos de0232; no inventar un segundo contrato de validación.

Tablas previstas en recipes: `recipe`, `recipe_line`, `recipe_revision`, `product_composition`, `composition_revision`, `sale_resolution`, `consumption_source`, `migration_mapping`. Exports previstos: `recipeEntities`, `independentRecipeLines`, `independentRecipeRevisions`, `productCompositions`, `compositionRevisions`, `recipeSaleResolutions`, `recipeConsumptionSources`, `recipeMigrationMappings`. Conservar exports/revisiones legadas para decoder y corte, sin mantener API antigua en producción.

## A — esquema, dominio y consumo

Reserva continuada `docs-r1-0232`; worktree `/private/tmp/checkpass-r1-0232/r1-0232-spec`. Writer exclusivo de esquema/migración/journal y del aplicador compartido Stock. Paths exactos se registran con factory antes de código. Incluyen esquema Recipes/exports DB/migraciones, servicios de contrato/library/compositions y helpers bajo `recipes/server/model`, legado de dominio `recipes.ts/read.ts/cost.ts` y sus tests, `recipes/server/consumption*`, `stock/consumption.ts`, lector monetario Stock y regresiones correspondientes. Tools de rollout propios únicamente bajo `tools/recipes-r1`.

A implementa preflight y nombres deterministas con manifiesto retomable; no declara duplicados cero sin medir. Conserva EXPAND0227, aplica corte del puente de recetas y soporte de revisiones antiguas. Produce primero un fundamento compilable de esquema/DTOs/servicios y lo entrega por SHA para que B pueda integrar sus adaptadores; no comparte un checkout mutable ni genera snapshots/journal en paralelo. Después completa resolución, consolidación/procedencia, decoder y regresión0230.

## B — HTTP, dictado/foto y retirada del legado UI

Reserva continuada `docs-p1-0233`; worktree `/private/tmp/checkpass-p1-0233/p1-0233-docs`, reutilizado para R1. Scope de código: `recipes/server/routes.ts` y pruebas HTTP, `recipes/draft.ts` y pruebas de texto/foto/IA, `recipes/ai-tasks.ts` y test, `recipes/manifest.ts`, `recipes/ui`, `modules/ui-registry.ts`. Retira pruebas e2e/fixtures que exclusivamente ejercían la UI eliminada; limpia el import/branch Recetas del harness genérico `tests/e2e/support/modules-ui-harness.tsx` preservando los otros módulos. No modifica kit, guardias ni excepciones de frontera.

B puede desarrollar rutas con mocks contra las firmas acordadas mientras A prepara el fundamento. La integración real y suites DB esperan el SHA de A; si hay contrato faltante vuelve al coordinador, no crea stubs de producción. El borrador usa nombre de receta sin producto/local y conserva normalización/confirmación. Rutas antiguas dan404; no aliases. La eliminación de pruebas de UI obsoleta se explica por ADR0070§17 y se sustituye por cobertura HTTP, sin ocultar fallos.

## QA, recursos y aceptación

Reserva continuada `docs-qa-0232-0233`; worktree `/private/tmp/checkpass-qa-0232-0233/qa-0232-0233`. QA escribe solo `docs/factory/0232-implementation-qa.md` y artefactos propios, no implementa los archivos certificados. Revisa entregas y luego combinación congelada con SHA/entorno identificados. También revisa documentalmente el ajuste de0233/0149; su PASS anterior no cubre el alcance nuevo.

Presupuesto inicial focal de20min por candidato, cero mutaciones por defecto. No verify global por ceremonia. Reutilizar tipos/lint de autores por identidad, repetir checks afectados por cambios/fallos. Señales decisivas: migración×1, duplicados/mapping, archivo/nombre/tenant, cierre real antes/después de editar receta/composición, combo con insumo compartido, decimales/Q6→Q3, procedencia+ledger+delivery atómicos y retry con costo0230 intacto. Dos locales y otro comercio se prueban con datos reales aislados. Un skip/retry no es PASS.

DB solo `tools/neon-test.sh`, Node24 y configuración CI seleccionada fuera del repo; no usar ni imprimir DATABASE_URL de PROD. El coordinador reserva `db:recipes-r1-ci` para un solo writer, también durante DDL/teardown. A pide turno antes de usar DB; B y QA esperan liberación explícita. DDL aislado con `--no-file-parallelism`. Nada de migraciones o tests concurrentes sobre la misma DB. La app local se alineará con la migración antes de entregar, usando el migrador local protegido y configuración seleccionada; no equivale a smoke de UI.

Cada entrega: commits propios, checkout limpio, comandos/resultados y límites en `docs/factory/0232-{model,http}.md`; coordinación registra factory deliver/accept. Fallos vuelven al autor, sin crear reviewers extra. Candidato final se integra en dev con QA pertinente. Con PASS del candidato R1, promover a main local y hacer factory integrate/cleanup conforme a la autorización explícita posterior del owner. Luego preparar contratos/reservas de implementación P1 desde la base integrada; P1 termina también en main local tras QA. Cada push y operación PROD sigue requiriendo permiso propio.
