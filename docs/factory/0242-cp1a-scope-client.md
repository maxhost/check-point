# 0242 — CP1a cliente POS: contexto, transporte y recuperación

Estado: preparada; ejecutar tras aceptación de scope servidor y reserva concreta. Nuevo implementador con contexto vacío. Una entrega funcional de cliente sobre DTO unit actual; no rediseño visual ni cantidades medidas. El autor conserva correcciones hasta aceptación y termina su bloque.

## Entrada y objetivo

Servidor optional aceptado1af3d7f3/QA0b52df93 sobre8a9b76f9; financiale9d409ac/QA9a4a52a6 ya compatible. La base exacta se fija por factory al despachar, no por estos SHAs históricos. Leer AGENTS/protocolos, anexo0242 §3, ADR0154, esta ficha y contratos/contexto POS pertinentes; no históricos de estado. No subdelegar.

POS consume el BackofficeProvider existente: core, módulos compartidos y ticket de intención. Con seed autorizado listo, cero GET propio de sesión o módulos al entrar. Mientras módulos están loading/restricted/unavailable no inventar permiso; distinguir loading de retirada. Un provider presente con core retirado nunca vuelve a props/lectura legacy ni emite peticiones sin scope. La compatibilidad sin provider solo sirve a consumidores/harness anteriores explícitos; no es escape para una sesión retirada.

Toda petición de consola, catálogo/detalle, guardar/anular, QR/cupones, preparar/cerrar/recuperar, mesas, impresión y ticket-settings captura scope antes del primer await y lo envía por panelRequest. No introducir cache de autoridad ni alterar cookies/pool/guards. Usar APIs públicas actuales del provider; no añadir un módulo al enum genérico de recursos. El backend sigue optional hasta CP3.

## Paths del encargo

- `apps/merchant/src/modules/pos/ui/pos-types.ts`
- `apps/merchant/src/modules/pos/ui/pos-context.tsx` nuevo si conviene aislar adaptación/provider local
- `apps/merchant/src/modules/pos/ui/pos-context.test.ts` nuevo
- `apps/merchant/src/modules/pos/ui/pos-cache.ts`
- `apps/merchant/src/modules/pos/ui/pos-cache.test.ts` nuevo
- `apps/merchant/src/modules/pos/ui/pos-console.tsx`
- `apps/merchant/src/modules/pos/ui/pos-payment.ts`
- `apps/merchant/src/modules/pos/ui/pos-payment-state.ts`
- `apps/merchant/src/modules/pos/ui/pos-payment-actions.ts`
- `apps/merchant/src/modules/pos/ui/pos-printing.ts`
- `apps/merchant/src/modules/pos/ui/pos-tables.tsx`
- `apps/merchant/src/modules/pos/ui/ticket-settings.tsx`
- `tests/e2e/pos-context.spec.ts` nuevo
- `tests/e2e/pos-printing.spec.ts`, solo caso de ajuste tardío al revocar sesión: sustituir heading local anterior por retiro/navegación documental401 y conservar aserción de que ticket tardío no revive UI
- `tests/e2e/support/pos-context-fixture.tsx` nuevo
- `apps/merchant/src/modules/pos/server/pos-context-native.neon.integration.test.ts` nuevo, solo fixtures/inspección/teardown propios del smoke
- `tools/pos-measurement/scope-client-smoke.mjs` nuevo, runner nativo explícitamente asignado
- `docs/factory/0242-cp1a-scope-client-handoff.md`

Solicitar antes de editar cualquier path adicional. La reserva heredada de otras entregas no amplía esta lista. No core/context-controller/panelRequest, backend de producto/schema, kit/guardias/otros tooling/deps, editor/rediseño/peso/V4/estado/índices. La suite fixture y el runner nuevos están asignados expresamente para el smoke nativo; importar helpers de setup existentes sin modificarlos y usar IDs propios. Nunca reutilizar un test de componente como evidencia nativa.

## Invariantes y aceptación

Cache privada por ámbito scope+local, épocas/generaciones y versión monotónica. Respuesta tardía de A no se presenta ni repuebla caché después de cambio/retirada. Cambio de ámbito retira historial, orden, borrador, cliente, cupón, pago y ticket; mismo ámbito con actualización de provider conserva formulario/selección/borrador y evita cascadas/refetches. Evitar que un error tardío del ámbito anterior retire el nuevo.

401/scope409 retiran por protocolo compartido;403/402 conservan motivos y restricciones vigentes. Conflicto de versión no es cambio de ámbito: mantiene borrador y recuperación actual. Backend sigue autoridad. Scope409 no se reintenta con otra identidad ni convierte escritura fallida en éxito; retiro/navegación documental una sola vez, sin reload loop. Errores asíncronos de mesas, impresión y settings participan también.

Antes de cerrar se congelan orden/UUID/cuerpo/scope; closeUncertain conserva ese mismo intento para reintento explícito. No regenerar UUID, cambiar cuerpo o adoptar scope nuevo después de await. Retirada bloquea acciones, invalida respuestas pendientes y no mezcla recuperación entre negocios. Conserva total0 y ausencia de medios/pagos cuando corresponde. Impresión/dispositivo y callbacks no sobreviven como ticket de otro ámbito.

Pruebas decisivas: seed ready sin GET sesión/módulos extra y un GET listado; loading→ready sin petición prematura; provider retirado sin fallback; A→B con lecturas/QR/cierre/impresión pendientes sin aplicar A; cambios de scope con mismo user/business también aíslan; callbacks tardíos no retiran B; cache monotónica;401/402/403/scope409/conflicto diferenciados; reintento incierto idéntico; remount/StrictMode sin dobles writes; guardar y cerrar publican DTO sin GET detalle extra. Enumerar todos los callsites posRequest para demostrar cobertura, también settings.

Componente browser prueba interacción/transporte con APIs controladas; no acredita sesión nativa. Antes de aceptación debe existir smoke real sobre build/start propio y CI protegida: entrada desde seed, lectura con scope y negativo intenciónA/cookieB409 sin efectos, con retiro observable. Acordar fixture/runner nativo al principio si falta una pieza para ese smoke; no dejarlo como sorpresa al final. No repetir campaña M0 ni prometer M1; benchmark contemporáneo es CP4.

## Checks, recursos y continuidad

Node24; types merchant, tests focales puros/context/cache y browser de interacción, guard UI/boundaries pertinentes, lint/formato/diff. Reutilizar evidencia compatible y reproducir señal afectada; sin verify global ceremonial. Escalación sandbox acotada para Git/browser propio si hace falta, avisar bloqueo inmediato. No push ni PROD.

Skill impeccable ya aplicada por coordinación: context cargado sobre pos-console; refinamiento acotado permitido con implementación actual como autoridad. Leer harden/optimize y craft-floor antes de editar UI. No ejecutar init/rediseño ni tocar artefactos ajenos del skill. Cambios visuales siguen laboratorio/kit y pertenecen a CP2, no a esta entrega.

Reserva de ejecución: puerto43242, CI exclusiva incluido teardown y harness0242-scope-client. Evidencia nueva en `/private/tmp/checkpass-pos-0242/scope-client`; preservar archivo control M0, RAW, configuración y fixtures anteriores. Build/start nuevo en su WT, sin atribuirle BUILD_ID del control archivado. Handoff con base/SHA/runtime/config/lock/build/schema/fixture, comandos/resultados/fallos/skips/límites y procesos. QA independiente nuevo sobre candidato congelado; siguiente bloque otro contexto limpio.
