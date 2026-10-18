# 0242 CP2a.8 — QA independiente de base y costo en Recetas

Veredicto: **PASS del alcance CP2a.8 y de su combinación con catálogo aceptado**, candidato congelado `e3c0f52a1002ccae1b2d4129cd6613b80b82fcda`. No certifica CP2c ni publicación. QA nuevo/contexto vacío, sin subdelegación ni cambios de producto/tests.

## Identidad y entorno

Candidato = dev `b617c86b` + entrega `116c5a2133d8f1764de37d1920845fa617f46a20`. WT/ref `/private/tmp/checkpass-pos-0242/pos-qa-0242`, `pos-qa-0242`, limpio al empezar. Node24.20.0/pnpm11.4.0; dependencias propias, sin DB/env privado/wrapper. Único archivo escrito en repo por QA: este informe; logs/resultados fuera del WT. Protocolos, ficha completa, contrato0242 §2/4, COPY y handoff UI/QA servidor leídos. Se conservó contexto existente Operate/refinamiento con kit/COPY, sin rerun/init/drift.

`git diff 0503370a HEAD -- apps/merchant/src/modules/recipes/ui tests/e2e/recipes-basis.spec.ts tests/e2e/support/recipes-basis-fixture.ts tests/e2e/support/recipes-basis-harness.tsx pnpm-lock.yaml package.json` vacío: producto y pruebas focales son idénticos al congelado del autor. Producto UI también idéntico a `7ec17a74`; la extracción `df812b7c` precede solo a la guarda mounted después del await biblioteca. Deltas de integración pertenecen al catálogo ya aceptado; no cambian contracts/server de Recetas ni helpers de medidas, kit, panelRequest o harness-server compartido. Los checks anteriores se reutilizan por esta identidad y por la QA previa de catálogo, no se atribuyen retrospectivamente al SHA nuevo.

## Aceptación

Revisados parser compartido exacto, strings9dec/límite nuevo, unit discreta, versión fija y ausencia completa como único legacy1unit. Metadata parcial/inválida bloquea envío y ofrece consulta; adoptar revisión validada es explícito. Base de producto separada de unidad tarifaria, unidad de receta y multiplicador: preparar mass sobre producto unit sigue permitido, sin escala automática de ingredientes/precio ni alteración yieldIA. Payload nuevo explicita base y revisión; caller antiguo sin metadata conserva forma anterior.

Listado usa recipeMoney/metadata servidor: no divide costos ni recalcula margen con Number. Base y tarifa tienen etiquetas distintas; incompatible/tiny conservan null y copy operativo, faltantes conservan insumos/local y cero completo sigue siendo cero real. Único Number pertinente al diff es comprobación de presentación del multiplicador existente, no autoridad de dinero/base.

Errores409/red/5xx conservan intención y bloquean guardado hasta consulta y adopción explícita de revisión. savedBody/id/revisión y resolución de insumos sobreviven guardado parcial; no se repite biblioteca cuando solo falla composición. POST incierto consulta identidad única activa por nombre antes de adoptar; cero/múltiples coincidencias quedan bloqueadas. Revisión biblioteca conserva nombre/cantidades locales con expectedRevision remoto. Lock síncrono impide doble submit. Key por local/producto y mounted guard descartan resultado de otra instancia;401/403 retira acceso/datos. No cambios de panelRequest, constraints ni activación mass.

## Evidencia inspeccionada y reproducida

Todos los logs/capturas siguientes están en `/private/tmp/checkpass-pos-0242/`.

| Evidencia | Identidad / resultado |
| --- | --- |
| QA `recipes-qa-pure-e3c0f52a.log`: `pnpm exec vitest run src/modules/recipes/ui/recipe-types.test.ts src/modules/recipes/ui/composition-basis-draft.test.ts`, desde apps/merchant | candidato e3c0f52a estable y limpio; **26PASS/0SKIP, EXIT0**. Log stdout; identidad/comando registrados aquí, sin encabezado SHA automático. |
| QA `recipes-qa-browser-e3c0f52a.log` | encabezado SHA/cwd/UTC/Node/argv/EXIT; **5PASS/0SKIP/0RETRY, EXIT0**. Selección grep mass precisa,409composición,POST incierto,409biblioteca,respuesta tardía. |
| Autor `recipes-risk-confirm.log` | 0503370a, archivos idénticos: **18PASS/0SKIP/0RETRY, EXIT0**; inspeccionadas fixture/aserciones y salida completa. |
| Autor `recipes-types3-df812b7c.log` y `recipes-merchant-types-7ec17a74.log` | tipos3 PASS (turbo5tareas/4cache); merchant final PASS directo. Catálogo integrado tiene QA previa independiente. |
| Autor `recipes-static-798b64c8.log`, `recipes-lint-df812b7c.log`, `recipes-modal-lint-7ec17a74.log`, `recipes-risk-static-confirm.log` y formatos equivalentes | cobertura estática compuesta de archivos finales por identidad: lint/formato EXIT0. |
| Autor `recipes-uiguard-7ec17a74.log` | producto idéntico;6archivos sin aumentos, EXIT0. |
| Autor `recipes-focal-798b64c8.log` | guardias **24PASS/2FAIL**, EXIT1 real; backlog conocido siguiente, no PASS global. |
| QA `git diff --check b617c86b..HEAD` | EXIT0. |

Browser QA usó config existente con `--output /private/tmp/checkpass-pos-0242/recipes-qa-results-e3c0f52a`, `RECIPES_BASIS_VISUAL=0` y `--grep 'POST biblioteca incierto|409 biblioteca|respuesta tardía|error 409|base mass precisa'`. Chromium escalado acotado desde inicio por MachPortRendezvous1100 conocido; sin intento fallido de sandbox. Verificados POST persistido+respuesta abortada→consulta y un único POST/insumo;409biblioteca usa revisión remota y conserva nombre; respuesta biblioteca retenida tras desmontaje real del host/remonte/cambio Norte no genera PUTcomposición. Este último es lifecycle del harness con selector/editor reales, no navegación/auth nativa ni cierre del modal busy.

Capturas `recipes-{list,modal}-{390,1280}.png` abiertas las cuatro: jerarquía y textos legibles, campos base distintos de unidad de receta, multiplicador2 con base2unit explícito; scroll vertical del modal existente y controles alcanzables. No hay cambios visuales tras las capturas. Son revisión visual, no reemplazo de aserciones.

Fallos previos se preservan sin contarlos como aprobados: selectorManual inexistente; reset de422 antes de respuesta; selector de local mal anclado. Correcciones solo de test/fixture, con stockitemIDs distintos y estados completos compatibles. Guardias pendientes: import expenses immediate.neon.integration.test→stock/count y literales core en cinco archivos ya registrados por QA servidor; sin nuevos offenders ni guardias editadas.

## Límites y entrega

Harness monta RecipesConsole/RecipeModal/kit/CSS con API controlada y Next navigation mock: no certifica HTTP/guard/DB reales. Se reutiliza servidor CP2a.6 ya aceptado; no surgió duda que justifique DB. Producto mass real, precisión, cierre/ledger y producer4 siguen CP2c y barreras0105. Sin fullverify/build/M0/M1,3201,túnel,demos,push/PROD.

Auditoría read-only `lsof -a -d cwd -Fn` desde /private/tmp tras checks: EXIT0, cero procesos con CWD del WT. Harness cerró servidor/conexiones en afterAll. Sin procesos propios persistentes ni pendientes de producto. Commit documental de QA; factory/aceptación/integración/cleanup corresponden al coordinador.
