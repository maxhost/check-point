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

## Checks y entrega

Tipos/lint/UIguard focales, búsqueda de consumidores y pruebas proporcionales de
default/permiso/navegación/QR. Browser simulado solo interacción pertinente, sin
capturas. No certificar DB/hardware/M1. Commit propio limpio y handoff con paths
realmente retirados, helpers conservados, cobertura sustituida y límites.
QA independiente sobre entrega/combinación antes de avanzar main local.
Sin kit/guardias/tooling/migraciones, servidores3201/túnel, push ni PROD.
