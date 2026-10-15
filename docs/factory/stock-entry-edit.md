# Entrega Stock: precio obligatorio y saldos ocultos

- TaskID/reserva: `stock-entry-edit` (nombre operativo conservado).
- Base `dev`: `0ef18bb2f4a680100a8cc39b338d53cd3766b020`.
- Commit de producto comprobado: `601b5393197cdc4d0a0f36d2332403680f17a782`.
- Rama/worktree: `factory-stock-edit`, `/private/tmp/checkpass-stock-edit/factory-stock-edit`.

El owner canceló expresamente la edición de entradas, sus revisiones, la revaloración de datos y cualquier migración. El alcance aprobado final se limita a ocultar temporalmente los saldos actuales y exigir precio al registrar compras nuevas. Sin spec ni ADR nuevos.

## Cambios

- `stock/ui/stock-summary.tsx`: flag interno `SHOW_CURRENT_BALANCES = false`; conserva íntegro el código del listado superior. El aviso de consumos pendientes y su botón de actualización siguen disponibles. No se retiró el componente ni se cambió el historial.
- `docs/PARQUEADO.md`: nota breve del owner del 2026-10-15 para rediseñar la UI de saldo actual por insumo/local; sin reformatear el documento antiguo ni implementar el rediseño.
- `stock/ui/stock-input-modal.tsx`: precio total marcado obligatorio, error por campo vacío y copy coherente para Manual y revisión IA de audio/texto/fotos. Se indica que una compra gratis requiere escribir `0` explícitamente.
- `stock/ui/stock-types.ts`: `entryLines` rechaza precio vacío en cualquier línea. Cero explícito es válido; los borradores sin precio y las líneas nuevas siguen vacíos, sin autocompletar cero. Conteos utilizan su validación separada de cantidades.
- `stock/server/purchase-price.ts` y `stock/server/routes.ts`: comprobación de presencia en las dos rutas públicas de compra antes de llamar a sus escritores (que contienen el drenaje y la transacción). Se lee cada body una vez y se reenvía sin convertir sus precios.
- Tests focales en `stock/ui/stock-types.test.ts` y `stock/server/purchase-price.test.ts`.

## Contrato HTTP

`POST /api/modules/stock/entries` requiere `totalCost` en **cada** línea y `POST /api/modules/stock/items/:itemId/purchases` requiere `totalCost` en el body. Ausente, `null`, string vacío o espacios producen `422 price_required`; las entradas añaden índice `line` (base cero) y mensaje visible «Línea N: Completa el precio total. Si fue gratis, escribe 0.». `0`, `"0"` y `"0.00"` están presentes y continúan hacia la validación numérica existente.

La validación de formatos, cantidades, límites, unidades, pertenencia y permisos sigue a cargo de las capas existentes. El dispatcher mantiene owner/personal con permiso `stock`. `POST …/adjustments` sigue admitiendo el conteo sin precio.

Los escritores internos `recordEntry`, `recordPurchase`, `applyPurchase`, `parsePurchaseCost` y los algoritmos de promedio no se modificaron. Conservan la representación de costos históricos desconocidos y sus callers internos. Sin cambios de datos, backfill, SQL, esquema, core, Recetas, kit, tooling, INDEX, TASKS o estados.

## Evidencia y límites

Checks sobre el contenido del commit de producto indicado, en este worktree con Node `v24.20.0`. Cada comando Node se ejecutó precedido de `source ~/.nvm/nvm.sh && nvm use`.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: exit 0.
- `pnpm exec eslint apps/merchant`: exit 0.
- `pnpm exec vitest run apps/merchant/src/modules/stock/ui/stock-types.test.ts apps/merchant/src/modules/stock/server/purchase-price.test.ts`: 2 archivos, 36 tests PASS (15 payload/UI helpers + 21 presencia/handlers), sin skips ni retries. Los handlers se invocan con escritores mock: verifican que faltantes se rechazan antes de llamarlos, que cero se reenvía y que el conteo no requiere precio. No son pruebas DB ni de autorización completa.
- Prettier aplicado solo a los archivos de código propios; `git diff --check` correcto. PARQUEADO conserva su formato previo.

No se accedió a DB ni se ejecutaron Neon, browser, e2e, build o verify global. La visibilidad y los recorridos reales del modal quedan para QA del owner; no se afirma PASS funcional en browser. No hay servidores o procesos persistentes propios, push ni integración en dev/main. Este handoff se añade después del commit de producto comprobado.

## Cómo probar en browser

1. Abre `/backoffice/stock`: el listado superior de saldos no aparece; el historial permanece. Si hay consumos pendientes, su aviso y «Actualizar stock» deben seguir visibles.
2. Registrar stock → Nuevo stock → Manual: completa insumo/cantidad y deja precio vacío. Debe mostrar el error y bloquear Guardar compra. Completa un precio y guarda; repite con `0` explícito si fue gratis.
3. Analiza audio/texto o fotos sin precio reconocido: en revisión exige completar el precio de cada línea antes de guardar, sin rellenarlo con cero.
4. Registrar stock → Ajustar stock: el conteo sigue sin campo ni requisito de precio.

Siguiente paso: revisión independiente del coordinador sobre el candidato congelado y QA browser del owner. La edición de entradas quedó cancelada, no pendiente de implementación.
