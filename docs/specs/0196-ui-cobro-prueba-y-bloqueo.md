---
spec: 0196
fecha: 2026-10-10
estado: cerrada
resumen: U1–U3 del contrato 0189, selección de plan y período, cambio, cancelación programada, reanudación, prueba y bloqueo.
disjunta: no
archivos: apps/merchant/src/app/backoffice/subscription/**, apps/merchant/src/app/backoffice/{layout,page}.tsx, tests/e2e/billing-ui.spec.ts, tests/e2e/support/billing-harness.tsx
---

# 0196 — UI de cobro, prueba y bloqueo

## Problema

Checkout omite plan en subscription-console.tsx. CancelDialog promete baja
inmediata. Faltan dos planes, reanudación y estados de prueba/bloqueo.

## Alcance

U1–U3 de 0189. No incluye U4–U6 de 0195, servidor, migraciones ni publicación.
Mantiene reconciliación y recibos existentes.

## Diseño

GET state de 0189 §D10 entrega precios, acceso y días. Conecta = base;
Impulso = plus. Checkout manda plan, interval y from subscription. POST plan
manda to; subir explica cobro inmediato de diferencia, bajar sin devolución.
Cancelar programa al fin del período; resume revierte. Confirmar antes de cobros.
Errores 400/402/409/503 muestran mensaje del servidor; topes enlazan Locales o
Campañas según code. Red permite reintentar; busy impide dobles envíos.
Prueba usa trialDaysLeft del servidor; bloqueado solo ve suscripción y salida.
Kit existente, sin nuevas piezas ni CSS. Etiquetas Free/Gratis del plan retiradas.

## Archivos

Consola, tarjeta, modal y helpers; layout y etiqueta de inicio. Arnés y suite
E2E con API doblada. Ajustes mecánicos de textos/campos en pruebas existentes.
Colisiona con 0189 ya mergeada; no depende de 0195.

## Definition of Done

- [ ] E2E de planes/períodos, cambio confirmado, cancelación/reanudación y errores.
- [ ] Prueba/bloqueo y vista responsive 390/1440 sin overflow.
- [ ] Typecheck, lint, formato, ui-guard y pnpm verify ejecutados con Node 24.

## Mutaciones

Dos: quitar plan del checkout; texto de baja inmediata. Fallar por aserción
E2E específica y revertir contra copia limpia con diff.

## Declarado afuera

Cobro real de Stripe y QA final del owner; producción sin cambios.

## Handoff

Comandos y SHA en estado GPT. Reserva local en dev, sin push por ADR 0128.

## Abierto

Sin decisiones pendientes; aplica ADR 0134.
