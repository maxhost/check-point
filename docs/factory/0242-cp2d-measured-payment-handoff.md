# 0242 CP2d.5 — sesión de cobro V2 preparada

Autor: implementador nuevo A, factory `measured-payment-0242`. Base `aae9a860916402d9e61e3d481bc23bef2a63f356`. Código congelado `e9ab5b1b` (el commit de este handoff solo añade documentación). Doce paths propios: preview/tests, session/tests, helper close, checkout/coupon/scan, browser spec/harness/fixture y este handoff. Helper close autorizado/reservado por coordinador en `7f4ad49d` antes de editarlo. Sin backend/contratos/DB/env/deps/legacy/kit/guard/estados/índices.

## Contrato para el siguiente bloque

`new MeasuredPaymentSession(client2, samePosCache, {order, historyStatus, onClosed?, onReview?, uuid?, timeoutMs?})`: exige DTO2 confirmado abierto. El padre conserva la instancia por pedido/identidad real, nunca la crea por render/modal. Las vistas `MeasuredCheckout`, `MeasuredCoupon`, `MeasuredScan` reciben `session` y se suscriben. No retiran la sesión al desmontarse. El padre consulta `canLeave` para bloquear salida/cambio de pedido durante `closing`/`closeUncertain`, y llama `retireIdentity()` al retirar la identidad real. El epoch de caché también impide capturar un cierre bajo otro ámbito.

API: `startScan/resolve`, `removeCustomer`, `selectTarget`, `excludeBenefit`, `prepare`, `acknowledgeReview`, `selectMethod`, `setReceived(string)`, `confirm`, `retry`, `cancelDialog`, `requestOrderReview` y `acceptReviewedOrder`. `getSnapshot/subscribe` permiten `useSyncExternalStore`. `preview`, `busy`, `blocked`, `canLeave` son proyecciones. El padre no debe mutar snapshots de sesión ni sustituir la sesión para abandonar un cierre incierto.

Cambiar persona retira contexto anterior; token/epoch descartan respuestas tardías. QR solo por acción explícita, sin prefetch; conserva enrolamiento/last_scan reales. Error de identificación no permite fallback anónimo silencioso: `customerReview` exige nueva lectura válida o quitar cliente explícitamente. Cancelar cobro conserva contexto temporal y orden. Excluir beneficio es local; no hay POST coupon-remove.

`prepare` revalida coupon-state y medios activos si hay cobro; cambios requieren revisión explícita. Target conserva sourceLineId y la prioridad del producto propio del cupón. Gratis/2×1 mass se rechaza; porcentaje/fijo y unit en mezcla usan helpers compartidos. Buffers cash son strings; cambio/faltante usan normalización del kernel para moneda0/2. Neto0 con línea usa `payments:[]`, texto «Cerrar venta sin cobro» y sin GETmedios.

`confirm` es único comando de cierre: UUID/version/membership/cupón/producto/target/pagos/body y capture congelados antes del await. El tipo HTTP local `MeasuredPaymentBody` corrige el desajuste actual de `PosCloseV2.payments`: wire solo methodId/amount; paymentId lo genera servidor. Doubleclick comparte promise. Timeout/red/408/5xx/parsing/noDTO mantienen intento y `closeUncertain`; `retry` explícito conserva cuerpo/capture/UUID. Un 4xx posterior, incluido403, NO demuestra rollback previo. Solo401/cambio de contexto/retirada real retiran identidad.

Conflicto definitivo: entrega DTO2 autorizado con `onReview`; padre lo presenta y llama `acceptReviewedOrder` para el MISMO pedido, después prepare y revisión. `requestOrderReview` es recuperación GET explícita si no vino DTO, sin PUT ni reenvío automático. DTO cerrado canónico del mismo pedido actualiza PosCache sin GETdetalle/historial adicional; `onClosed` una vez, fuera de clasificación de error de pago. Un callback fallido no deshace el cierre ni permite volver a cobrar. Retirada durante publicación también suprime callbacks del ámbito anterior.

## Evidencia

Node24.20.0, pnpm11.4.0; lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Config browser propia `/private/tmp/measured-payment-0242.playwright.config.cjs`, SHA256 `86c3879528856215e5e088fd42838fae809eef5a2f3a54c1f56a0a937ef2222c`: Chromium, un worker, retries0, sin Next/webServer/DB. Logs fuera del worktree, prefijo `/private/tmp/measured-payment-0242-`.

- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-payment-preview.test.ts apps/merchant/src/modules/pos/ui/measured-payment-session.test.ts`: EXIT0, 23/23, sin skips. `pure-freeze.log`. Incluye parser HTTP REAL `parseMeasuredCloseInput` sobre body emitido y regresión403 después de red; import de parser no abre DB.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0, `types-freeze.log`.
- `pnpm exec eslint` sobre los once archivos de código: EXIT0, `lint-freeze.log`.
- `node tools/ui-guard.ts --base aae9a860916402d9e61e3d481bc23bef2a63f356`: EXIT0, seis archivos sin aumentos, `guard-freeze.log`.
- `pnpm exec prettier --check` sobre los once archivos: EXIT0, `format-freeze.log`.
- `pnpm exec playwright test --config /private/tmp/measured-payment-0242.playwright.config.cjs --grep-invert 'approved checkout' --output /private/tmp/measured-payment-0242-wirefix-browser`: EXIT0, 9/9 funcionales sin retries/skips, `wirefix-browser.log`. Transporte2 REAL hasta fetch mock: headers/scope, cash parcial0/2, anónimo, QR/cambio tardío, cupón cambiado/revisión, exclusión local de gratismass, mezclaunit/target de otro snapshot, net0[], ambiguo+409 mismo body tras remount, conflicto/revisión explícita y ámbito retirado con callback tardío.
- Inspección agrupada390/1280 y una confirmación: capturas ABIERTAS, sin overflow observado. `browser-final.log`, 9/9 en esa revisión (incluye test visual); la prueba de target mixto se añadió después y pasó focal. Cambios posteriores al cierre no cambiaron checkout. El runner focal posterior limpió su outputDir anterior; quedan logs y observación, no enlazar esas imágenes como artefactos conservados.
- Exactitud adicional pura: originales subminor no terminantes, snapshots unit antiguos altos, producto del cupón prevalece, gratis/2×1 mass/mezclaunit, porcentaje/fijo/net0/per_purchase/extras, cuerpo profundamente congelado, doubleclick, wrong-order/noDTO,408/5xx, primer conflicto sin retry y A→B tardío.

Fallos registrados: primer import de fixture usaba un nivel relativo extra (0 tests), corregido; un error de tipos en Promise genérica del test, corregido. Chromium sandbox falló MachPort1100 antes de ejecutar siete casos (`browser.log`); runner propio escalado autorizado pasó. La revisión del coordinador detectó paymentId inválido en wire y retirada403 prematura; ambos corregidos con regresiones antes de freeze. No se relajaron parser/tests ni se contaron fallos/skips comoPASS. Advertencias existentes: MODULE_TYPELESS_PACKAGE_JSON del guard y NO_COLOR/FORCE_COLOR del runner.

Procesos/puertos propios:0 servidores/runner tras teardown; harness cierra su listener en afterAll. ps sandbox dio EPERM, informado de inmediato; inspección escalada autorizada (`processes.log`, `cwd.log`) encontró solo los procesos de la propia inspección, ningún proceso persistente del worktree. git add sandbox bloqueó index.lock del gitdir, informado y resuelto con stage/commit local acotados autorizados, sin bypass. Config/artefactos/logs quedan en /private/tmp, no hay servidor/túnel/puerto3201.

## Límites y siguiente paso

Preparado, NO conectado a consola/listado/editor/ruta productiva/ticket/impresión; el siguiente agente nuevo hará esa integración. QA nuevo independiente pendiente sobre candidato congelado. El harness no certifica cámara física, auth nativa, DB ni un cierre real del servidor. No se ejecutaron wrappers Neon/DB/Nextbuild/fullverify/M0/M1. Ningún push ni PROD. Conservar worktree y fixes hasta aceptación; factory/integración/cleanup los opera coordinador.
