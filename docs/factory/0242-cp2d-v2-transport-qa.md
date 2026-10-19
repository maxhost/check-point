# 0242 — CP2d.2 transporte V2: QA independiente

**PASS** para el candidato congelado `840cdcdbb532d9e51228d26391d7c4831425ed6e`: base aceptada `c0abf18f` (publisher y carrito) más entrega `d35e80172d7ebc06b1ac30e41726a4370cddebf7`. WT de QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, ref `pos-qa-0242`. Revisión independiente de ficha, contrato0242 §3, handoff y diff completo contra la base aceptada. Sin cambios de producto/tests ni incidencias de producto observadas.

## Identidad y evidencia reutilizada

Se verificaron los SHA256 de los seis archivos de transporte/tests, lockfile y las nueve configuraciones declaradas en `/private/tmp/checkpass-pos-0242/v2-transport-evidence/identity.json`: todos coinciden con este candidato. También coinciden los hashes de sus ocho logs. La entrega documental posterior no altera el código certificado. Se reutilizan los 46/46 tests puros del autor (panel13, contexto26, cache3, boundary4), ESLint, Prettier y UIguard con EXIT0; cero fallos/skips/retries. La corrida inicial44/44 y la advertencia existente `MODULE_TYPELESS_PACKAGE_JSON` se conservan, sin convertirla en un fallo del producto. No se repiten cache/boundary ni gates estáticos compatibles por ceremonia.

## Reproducción sobre la combinación

Node `v24.20.0`; cada comando Node/pnpm precedido por `source ~/.nvm/nvm.sh && nvm use`. Logs completos, hashes, comandos y resultados propios en `/private/tmp/checkpass-pos-0242/v2-transport-qa-evidence/identity.json`.

- `pnpm exec vitest run apps/merchant/src/app/backoffice/panel-request.test.ts apps/merchant/src/modules/pos/ui/pos-context.test.ts`: **39/39 PASS**, dos archivos, EXIT0, cero fallos/skips/retries (`transport.log`).
- `pnpm --filter @mi-pasaporte/merchant typecheck`: **PASS**, EXIT0, sobre el candidato combinado (`types.log`).
- `git diff --check`: **PASS**, EXIT0 antes del informe.

Los casos ejecutados verifican opt-in V2 y ausencia/1 con forma legacy; versión y scope copiados antes del await y conservados en reintento explícito pese a mutación de opciones/contexto; cambio A→B bloquea un reintento antes de fetch. Respuestas tardías200/401/403/409 de A se descartan sin retirar B. 401/scope409 actuales retiran una vez por respuesta;402/403/conflictos/upgrade conservan error sin retry ni downgrade. `PosError.payload` conserva products[], orden V2 y metadata completos con cantidades/precios string; constructor, orden y cantidad numérica legacy siguen compatibles.

La revisión del diff confirma extensión genérica `HeadersInit` en core, sin nombres/reglas POS nuevos allí; `X-Pos-Contract` se genera en el módulo sobre el mismo `posRequest → panelRequest → fetch`. Las pruebas de headers object/Headers/tuples verifican que `Headers.set` aplica el scope capturado al final, con comparación case-insensitive, sin duplicado/join ni mutación del caller. JSON conserva content-type y strings; FormData retira content-type manual para permitir boundary de fetch; signal y no-store permanecen. Scope malformado falla antes de red. No hay nuevas lecturas de sesión/módulos ni fetch paralelo/retry automático en el diff.

## Límites y entrega

Esto acredita transporte real hasta el boundary de fetch mocked y tipos sobre la combinación; no certifica auth nativa, HTTP/DB, navegación documental ni integración de futuros consumidores V2. No DB/env/wrapper/browser/build/fullverify/M0/M1, servidores, push ni PROD. No se ejecutaron checks ajenos al contrato. La evidencia previa aceptada de scope/HTTP mantiene su alcance original; no se presenta como una nueva certificación de autenticación de este SHA.

Sin fallos o pendientes de producto. No se iniciaron procesos persistentes; observación lsof propia registrada en `processes.json`, cero procesos persistentes con cwd del WT, excluido el observador. Estado inicial limpio; único cambio propio este informe. Factory/aceptación/integración/cleanup quedan al coordinador. Este informe no autoriza publicación.
