# 0242 — CP2d.5 cobro V2 preparado, QR y beneficio exacto

Estado: preparada, sin autor/reserva. Requiere editor CP2d.4 aceptado; autor NUEVO/contexto vacío, coordinador fija base/factory. Bloque coherente de sesión de pago y sus vistas, sin consola/listado/ticket/impresión/ruta productiva. Leer protocolos, spec0242 §2 y contrato cierre/cupón/scope, helpers exactos y flujo actual pertinente. No subdelegar.

## Resultado

Sesión de pago V2 propiedad del padre, reusable con PosOrderV2 confirmado abierto y misma PosCache/PosClient contractVersion2; props/API mínima propuesta antes código. UI de escaneo, beneficio y modal de cobro consumen esa sesión, sin estado monetario divergente ni recrear intención por rerender/unmount. Padre conserva instancia e impide cambiar orden/salir cuando closing/closeUncertain; identidad REAL retira permanentemente, respuestas tardías no restablecen otra persona/orden. Dialog cancelado conserva orden abierta y contexto temporal del cliente; salir/recargar no crea asociación persistida nueva.

QR opcional: POSTresolveV2 solo al escanear explícitamente, puede enrolar/last_scan como actual; no prefetchear ni fingir lectura pura. Reutilizar scanner existente (sin modificarlo en este bloque) y callbacks reales, sin certificar cámara física por harness. Cambiar/quitar cliente es acción explícita, retira beneficio previo y conserva líneas; respuesta tardía no lo restaura. Anónimo es válido. No_program/foreignmembership/programa revocado exige revisión o retirar cliente explícitamente, no fallback anónimo silencioso.

Antes de confirmar, revalidar coupon-state de membresía y métodos cuando corresponda usando rutas/DTO vigentes compatibles por transporte2. Comparar beneficio autoritativo con el revisado; importe/target cambiados requieren nueva revisión explícita. Cupón muestra tipo/efecto/texto íntegro de regla sin interpretarla; elegibilidad técnica la decide servidor. Quitar beneficio de esta venta es exclusión LOCAL, jamás POSTcoupon-remove global. Target sourceLineId seleccionable si mismo producto tiene snapshots distintos, validar producto propio del cupón sobre selección del operador. Gratis/2x1 no aplican targetmass, mostrar texto cerrado del owner y permitir excluir; mezclaunit elegible sí, porcentaje/fijomass sí. No pedir peso bonificado ni cambiar de línea en una selección explícita inválida.

Preview reutiliza decideMeasuredBenefit y buildFinancialAmountsFromSnapshots aceptados con originales y medidas; no algoritmo de descuento/normalización paralelo ni Number como autoridad. Acumulación sobre neto usa computeAccrualFromMoney puro exacto (módulo domain sin DB), conserva per_purchase/net0/extras vigentes; no nueva política ni simulación de reglas de texto. Total, descuento, ajuste, cantidades/unidades y puntos claros. UI no puede cobrar una versión/importe distinta al snapshot confirmado. No importar Counter legacy numeric DTO para adaptar masa a piezas.

Medios actuales y su default/estado; mismo registro de pago, no PSP nuevo. Modal ofrece el flujo existente de medio único y efectivo/recibido/cambio; no añadir split UI como feature nueva aunque servidor soporte múltiples. Buffers monetarios son strings localizados y validación exacta con moneda0/2, sin partial convertido a0/NaN ni autoridad Number. Cambio y faltante usan la semántica normalizada vigente del núcleo/preview. Net0 con línea real muestra “Cerrar venta sin cobro”, payments=[] y ningún efectivo/medio ficticio ni GETmedios necesario por cero.

Confirmar es ÚNICO comando de cierre. Congelar antes await clientRequestId/version/membership/coupon.product/target/payments/body/captura, profundamente. Double click un intento. Timeout/red/5xx/parsing/respuesta no canónica→closeUncertain, conservar mismaUUID/cuerpo/capture para reintento EXPLÍCITO; no volver a pagar con otra clave. Rechazo posterior a un cierre ambiguo no demuestra rollback previo: conservar incertidumbre hasta DTO canónico/revisión que la resuelva, igual principio del fixcreate8fa.401/scopechange retiran seguridad. PUT/save no se hace desde checkout; si orden cambió409, mostrar DTO autorizado para revisión del padre, no recomputar y reenviar solo. Not_open/unknown/cerrada por otro intento tienen salida explícita recuperando orden autorizada cuando corresponda, no doble pago. Error después commit/impresión no convierte cerrada en fallo de cobro; onClosed una vez por resultado confirmado, cache canónica sin GETdetalle/history extra en éxito.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/measured-payment-preview.ts
- apps/merchant/src/modules/pos/ui/measured-payment-preview.test.ts
- apps/merchant/src/modules/pos/ui/measured-payment-session.ts
- apps/merchant/src/modules/pos/ui/measured-payment-session.test.ts
- apps/merchant/src/modules/pos/ui/measured-payment-close.ts, controlador interno del cierre para separar tamaño/timeout/replay sin framework genérico
- apps/merchant/src/modules/pos/ui/measured-checkout.tsx
- apps/merchant/src/modules/pos/ui/measured-coupon.tsx
- apps/merchant/src/modules/pos/ui/measured-scan.tsx
- tests/e2e/pos-measured-payment.spec.ts
- tests/e2e/support/pos-measured-payment-harness.tsx
- tests/e2e/support/pos-measured-payment-fixture.ts
- docs/factory/0242-cp2d-measured-payment-handoff.md

Sin console/editor/cart/comandos/cache legacy ni helpers exactos aceptados, hooks de pago legacy, scanner Counter, backend/contratos/schema/kit/guardias/tooling/deps/estados/índices. Si hace falta dividir sesión por file-size o helper compartido, pedir extensión concreta antes editar; no duplicar framework ni copiar toda consola. El siguiente agente nuevo conectará consola/resultados/ticket por bloques.

## Gate

Node24 tiposmerchant/lint/formato/UIguard, puros de preview/transición y browser focal con transporte real hasta fetch mocked: anónimo/pase/cambio persona tardío, revalidación/cambio cupón y revisión, gratis/2x1mass rechazado sin consumir con opción excluir, mezclaunit y target explícito distinto snapshot, porcentaje/fijo y net0 con[]/sinGETmedios, moneda0/2 y cash buffers/cambio, total subminor no terminante, snapshot viejo alto; request perdida→reintento mismo cuerpo/UUID/target/scope aun remount, rechazo de recuperación conserva incertidumbre, double click, conflicto sin retry automático, contextoA→B y callback viejo no cambiaB. Reutilizar matriz exacta/servidor aceptada, no otra DB ni toda batería financiera por ceremonia. Harness no certifica auth nativa/DB/cámara ni cierre real nuevo.

Kit/COPY tuteo y estética0242 aprobada. Skill impeccable ya aplicada, context root una vez: no rerun/init/drift/artefactos ajenos; leer harden/craft-floor e incumbente antes UI. Una inspección390/1280 agrupada+máximo confirmación, capturas ABIERTAS. ChromiumMachPort1100 runner propio escalado autorizado. SIN DB/env/wrapper/Nextbuild/fullverify/M0/M1 ni activación/producción. Logs SHA/base/config/comandos/exits/fallos/skips fueraWT y0procesos/puertos. QA NUEVO independiente, fixes autor; factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
