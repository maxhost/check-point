# 0242 CP1c.1 — entrega del expansor racional dormido

Autor implementador nuevo, WT `/private/tmp/checkpass-pos-0242/pos-recipes-exact-0242`, rama/task `pos-recipes-exact-0242`. Base `866378195898e4c216f678aa9446c61387b6ce59`; código verificado y congelado `478264f170e4b0d8b74702a0e7a2eb799d9af4b0`. El commit posterior de este handoff solo añade documentación; su HEAD identifica la entrega completa. Factory deliver/accept/integración quedan al coordinador, QA independiente pendiente.

## Cambio y contrato

Solo tres paths asignados: `apps/merchant/src/modules/recipes/server/model/expand-measured.ts`, su `.test.ts` y este handoff. `expandMeasuredComposition(components, revisions, sale, basis)` expande una única línea. `sale` contiene quantity Decimal y LineMeasure; `basis` obligatoria contiene basisQuantity/basisUnit/conversionVersion. No resuelve receta actual, precio ni base inferida. El modo por defecto `quantitySource:'capture'` valida captura nueva; `quantitySource:'trusted-unit-snapshot'` es explícito, exclusivo unit y usa el helper existente INT32. No ampliar ese modo a HTTP. El expansor legado y su rango safeInteger permanecen intactos.

Factor, receta efectiva, aportes y consolidado usan racionales BigInt reducidos. Resultado: `factor:ExactRatio`, fuentes con `recipeQuantityRatio` y `exactQuantityRatio`, ingredientes con `exactQuantityRatio`, y proyecciones de compatibilidad `recipeQuantity` Q3 / `exactQuantity` Q6 / `allocatedQuantity` Q3. Consolidado `quantity` Q3 es el ledger futuro. `roundingReason` y `rounding` comparan el racional con Q3, incluso si Q6 oculta la diferencia. Mayor residuo exacto por productos cruzados, empate recipeId/recipeRevisionId como legacy. Sumar solo por insumo dentro de esta línea; unidades de insumo inconsistentes fallan.

Snapshots internos validan numeric(14,3) positivo sin pasar por parser de producto. Masa/base usan captura nueve decimales y rango existentes. Base unitaria es discreta. Referencias faltantes/ajenas, revisiones duplicadas y componentes repetidos fallan; no hay fallback. Ledger se limita a numeric(14,3) después de consolidar/redondear (mitades lejos de cero), sin coerción Number. Cualquier proyección puede ser cero conservando ambos racionales y procedencia; ledger cero informa `rounded_to_zero`, sin movimiento ni costo inventado. Este helper no escribe DB, no publica V4 y no está conectado a consumidores.

## Evidencia reproducible

Runtime: Node24.20.0 (`source ~/.nvm/nvm.sh && nvm use` antes de comandos Node), pnpm11.4.0, Vitest4.0.18, dependencias propias offline. Sin env/DB heredada, Neon, build, browser ni servidores.

SHA256 de configuración intacta:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | 4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821 |
| vitest.config.ts | a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea |
| apps/merchant/vitest.config.ts | 073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81 |
| apps/merchant/tsconfig.json | aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0 |
| packages/domain/tsconfig.json | 716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861 |

Comandos desde raíz del WT, precedidos de activación Node24:

- `pnpm exec vitest run apps/merchant/src/modules/recipes/server/model/expand.test.ts apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts apps/merchant/src/modules/pos/financial-measures.test.ts apps/merchant/src/modules/pos/measure-contract.test.ts apps/merchant/src/modules/pos/unit-expand-compat.test.ts`: **125 PASS**, 5 archivos, 0 fallos/skips; nuevo expansor21, antiguo5, medidas28+43+28. Última corrida15:38:53 del18oct2026 local.
- `pnpm --filter @mi-pasaporte/merchant typecheck` y `pnpm --filter @mi-pasaporte/domain typecheck`: EXIT0, incluida repetición tras última modificación del test.
- `pnpm exec eslint apps/merchant/src/modules/recipes/server/model/expand-measured{,.test}.ts`: EXIT0, 0 warnings.
- `pnpm exec prettier --write apps/merchant/src/modules/recipes/server/model/expand-measured{,.test}.ts`, verificación final `--check` más handoff y `git diff --check`: sin diferencias/fallos.

Casos decisivos: base1unit coincide con todos los campos legacy (componentes/revisiones/reparto/empate/ledger0), safeInteger legacy máximo permanece; venta1g/base1lb da factor100000/45359237 y ambos racionales no terminantes; capturas kg/lb/g equivalentes y cambio solo priceUnit dan idéntico consumo; consolidación antes de redondear y reparto estable al permutar; residuos diferentes que comparten Q6 reciben atribución correcta; positivo diminuto conserva razones con recipeQuantity/Q6/ledger0; razón de redondeo persiste cuando Q6 coincide con Q3; base/capturas/snapshots/refs/unidades inválidos fallan; máximo ledger admitido, overflow de producto y overflow solo al redondear fallan.

Incidencias corregidas antes de congelar: selección inicial Vitest `--project apps/merchant/vitest.config.ts` no coincide con nombre del proyecto (startup, sin pruebas); ejecución por rutas resuelta. Primer focal124:123PASS/1FAIL por wrapper de fixture que aplicaba base por defecto al intentar pasar undefined; negativo ahora invoca API directamente. Primer lint cinco unused-vars en helper de comparación del test; sustituido por `toMatchObject` contra resultado legacy completo. Ningún retry/skip cuenta como aprobación de esos fallos; última corrida íntegra arriba.

## Guardias y límites

`pnpm exec vitest run apps/merchant/src/modules/modules-boundary.test.ts apps/merchant/src/modules/modules-boundary-between.test.ts apps/merchant/src/modules/modules-boundary-literals.test.ts`: **23 PASS / 3 FAIL**, tres archivos rojos. No se declara módulos verdes ni se cambia guardia. Offenders observados:

- Principal: `server/catalog-storage-expand.neon.integration.test.ts → modules/pos/server/pos-integration-support.ts`.
- Between: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`.
- Literales adicionales respecto a excepciones esperadas: backoffice-context-controller.test.ts3, backoffice-context-refresh.test.ts1, onboarding/checklist-context-resource.test.ts1, analytics/evaluation/policy-simulation.test.ts2, analytics/lifecycle/index.ts1, catalog-storage-expand.neon.integration.test.ts1, module-events/decode-measured.test.ts1.

Todos los paths de offenders son idénticos a base (`git diff --exit-code 866378195898e4c216f678aa9446c61387b6ce59 -- <paths anteriores>` EXIT0); ninguno apunta a mis archivos nuevos. Los dos fixtures0242 se corrigen en candidato ajeno A46d1d9b según coordinador: no se copiaron aquí. Los demás son backlog ajeno; QA de combinación debe distinguirlos y verificar A al aceptar.

No migraciones/schema, persistencia de razones, publication/captured/consumption/Stock/analytics, UI/auth/kit/tooling/deps/estados/índices ni wiringV4. Esta entrega no autoriza habilitar masa ni V4. Persistir razones/base y adaptar consumidores requiere otro autor/contexto.

Todas las sesiones de checks terminaron; no hubo servidores. `ps -axo` no permitido por sandbox, informado al coordinador. `lsof -a -d cwd +D <WT> -F pc` solo mostró los propios procesos transitorios lsof, sin procesos persistentes con cwd en WT. Árbol limpio tras commit documental; sin push/PROD ni cambios de refs principales.
