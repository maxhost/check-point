# 0242 P4 — retirada funcional y UI sin consumidores

P3a aceptado `241089a4`, entrega QA `63ac5b1e`, writers HTTP antiguos bloqueados.
Autor nuevo en WT/ref `pos-ui-card-0242`, reserva continuada homónima. Base:
commit documental de esta ficha. Trabajo independiente de P3b: **sin DB**;
el otro autor es writer exclusivo de esquema/journal/DBCI.

Objetivo: terminar la retirada legacy de0242, manteniendo UI punto1 aceptada,
scanner real, históricos/saldos y acceso Clientes. Sin rediseño ni capturas.

## Scope inicial

- `apps/merchant/src/app/backoffice/backoffice-navigation.tsx`:
  retirar acceso móvil Mostrador fuera de operación; usar manifiesto/enlaces
  autorizados para operación. Clientes conserva counter. No rutas POS en core.
- `apps/merchant/src/app/backoffice/staff` y
  `apps/merchant/src/server/onboarding/checklist.ts`,
  `apps/merchant/src/app/backoffice/onboarding/onboarding-checklist.tsx`:
  copy Clientes, defaults de venta por módulo operativo habilitado, tours sin
  Mostrador/canje directo. No activar módulo ni conceder permiso automáticamente
  si está apagado. Recomendación inicial de alta viene de registro/manifiesto.
- `apps/merchant/src/modules/staff-defaults.ts`, `staff-defaults.test.ts`:
  helper puro genérico para defaults autorizados, sin literal de módulo en core.
- `apps/merchant/src/app/backoffice/counter/` archivos explícitos EXCEPTO page.tsx:
  `counter-console.tsx`, `counter-home.tsx`, `location-gate.tsx`, `stages.tsx`,
  `done-stage.tsx`, `sale-forms.tsx`, `coupon-panel.tsx`, `redeem-panel.tsx`,
  `redeem-state-cases.ts`, `cart.ts`, `cart.test.ts`, `types.ts`, `types.test.ts`,
  `points-preview.tsx`, `qr-scanner.tsx`, `coupon-ui.test.ts`.
  Extraer lo compartido antes de borrar UI, conservando dominio server/counter.
- Nuevos compartidos `apps/merchant/src/sales-contract.ts` y
  `apps/merchant/src/components/qr-scanner.tsx`. Traslado funcional sin cambiar
  cámara ni kit. Actualizar consumidores modernos, especialmente
  `modules/pos/ui/measured-editor-customer.tsx` y `pos-types.ts`.
- Bajo `apps/merchant/src/modules/pos/ui/`, archivos antiguos explícitos:
  `pos-console.tsx`, `pos-editor.tsx`, `pos-cart.tsx`, `pos-checkout.tsx`,
  `pos-scan.tsx`, `pos-coupon.tsx`, `pos-ticket.tsx`, `pos-payment.ts`,
  `pos-payment-actions.ts`, `pos-payment-state.ts`, `pos-payment-preview.ts`,
  `pos-payment-preview.test.ts`, `pos-payment-financial-preview.test.ts`,
  `pos-printing.ts`, `pos-print-feedback.tsx`.
  No borrar transporte/cache/tablas/documento de impresión/printing exacto aún
  consumidos por MeasuredConsole. No tocar measured-console/list/card ni entry.
- `apps/merchant/src/server/locations-counter-surface.test.ts`: sustituir
  cobertura de consola retirada por cobertura vigente pertinente, con motivo.
- `apps/merchant/src/app/backoffice/loyalty/steps/step-rewards.tsx` y
  `program-view.tsx`: retirar ofrecimiento directo/canje insuficiente; preservar
  datos/configuración histórica y payload, sin añadir emisión PWA ni canje POS.
- `docs/factory/0242-p4-retirement-handoff.md`.

Los harness/tests E2E antiguos aún importan UIs retiradas: inventariar y proponer
paths exactos antes de cambiarlos. Portar recorridos pertinentes a UI/contratos
vigentes con mapping de cobertura; no quitar negativos para obtener verde. P6
mantiene conversión de suites HTTP V1, fuera de este writer inicial.

Ampliación autorizada tras inventario y antes de editar: `server/counter.test.ts`
actualiza import compartido conservando pruebas; `modules/pos/ui/use-pos-close-navigation.ts`
se retira si no tiene consumidor vigente. Bajo `tests/e2e/support/`:
`counter-harness.tsx`, `pos-counter-harness.tsx`, `tables-harness.tsx`,
`pos-context-fixture.tsx`, `pos-payment-methods-fixture.tsx`. Bajo `tests/e2e/`:
`pos.spec.ts`, `tables.spec.ts`, `pos-context.spec.ts`, `pos-payment-methods.spec.ts`,
`counter-mobile.spec.ts`, `counter-coupon-verdict.spec.ts`, `pos-printing.spec.ts`.
No existen counter.spec.ts/pos-counter.spec.ts en esta base. Mantener cobertura
vigente con contratos nuevos y dejar mapa de sustitución de pruebas obsoletas.

Hallazgo de conexión posterior a QA P3a: `modules/pos/ui/ticket-settings.tsx`
es consumidor productivo y usa usePosContext sin contractVersion2. Scope ampliado
para adoptar explícitamente contrato2 ahí y verificar GET/PUT con scope original,
sin autoactivar impresión ni debilitar guard/owner. No cambiar default global del
transporte para esconder consumidores antiguos. Este cierre de compatibilidad se
certifica en QA P4; el PASS P3a no cubría la pantalla cliente de ajustes.

Ampliación tras ejecución real de cobertura sustituta: `tests/e2e/pos-connected-console.spec.ts`
adapta selección de tipo/detalles al diálogo aceptado del punto1; conserva negativos,
importe/caché/intención y elimina duplicación de happy path en otras suites.
Ampliación adicional: `tests/e2e/pos-measured-editor.spec.ts` adapta botones y
diálogos de local/tipo/nota aprobados, manteniendo payload/retry/conflictos,
snapshots/unidades y monedaCOP; sin tocar el producto aceptado por selectores.

Defecto funcional diferencial reproducido al portar mesas: table_occupied409 y
unknown_table422 necesitan refrescar mesas, permitir elegir otra y conservar líneas,
sin abandonar una operación incierta ni reenviar bajo otra identidad. Ampliación
explícita a `modules/pos/ui/measured-editor-model.ts`, su `.test.ts`,
`measured-pos-editor.tsx`, `measured-order-commands.ts` y su `.test.ts` para corregir
ese recovery vigente. No es rediseño: usar controles existentes y conservar
negativos de mesas, intención/captura congelada y scope. Caso browser en tables.spec.

Ampliación por cobertura moderna ejecutada (42PASS/12FAIL previos, sin atribuir
suite verde): `tests/e2e/pos-measured-payment.spec.ts` y
`pos-measured-ticket.spec.ts` adaptan formato/copy/ubicación de regla y documento
oculto para impresión. Conservar efecto económico/cambio/revalidación/regla íntegra
en su ubicación vigente y separación de gestos/unsupported. Si es fallo de producto,
no relajar aserción. `app/backoffice/loyalty/loyalty-tour-step.ts` retira copy de
ofrecimiento de canje sin saldo, preservando ancla/datos históricos.

Defecto funcional confirmado al conservar regla íntegra: editor y cupón compacto
no la mostraban. Scope ampliado `modules/pos/ui/measured-coupon.tsx`; mantener
cobro compacto habitual, mostrar regla completa en review tras revalidación y
en el editor cliente (path ya asignado), con expansión accesible si larga. Usar
kit existente, sin parsear reglas ni cambiar efecto económico/revalidación.

## Checks y entrega

Tipos/lint/UIguard focales, búsqueda de consumidores y pruebas proporcionales de
default/permiso/navegación/QR. Browser simulado solo interacción pertinente, sin
capturas. No certificar DB/hardware/M1. Commit propio limpio y handoff con paths
realmente retirados, helpers conservados, cobertura sustituida y límites.
QA independiente sobre entrega/combinación antes de avanzar main local.
Sin kit/guardias/tooling/migraciones, servidores3201/túnel, push ni PROD.
