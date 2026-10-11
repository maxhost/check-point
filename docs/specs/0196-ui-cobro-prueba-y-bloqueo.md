---
spec: 0196
fecha: 2026-10-10
estado: implementada
resumen: U1–U3 del contrato 0189, selección de plan y período, cambio, cancelación programada, reanudación, prueba y bloqueo.
disjunta: no
archivos: apps/merchant/src/app/backoffice/subscription/**, apps/merchant/src/app/backoffice/{layout,page}.tsx, apps/merchant/src/app/page.tsx, tests/e2e/billing-ui.spec.ts, tests/e2e/support/billing-harness.tsx
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
El rebote del personal `/?e=payment_required` explica que debe contactar al
propietario; nunca imprime códigos desconocidos. Suspensión conserva prioridad
sobre bloqueo de cobro, como exige 0189 §D4.
Kit existente, sin nuevas piezas ni CSS. Etiquetas Free/Gratis del plan retiradas.

## Archivos

Consola, tarjeta, modal y helpers; layout y etiqueta de inicio. Arnés y suite
E2E con API doblada. Ajustes mecánicos de textos/campos en pruebas existentes.
Colisiona con 0189 ya mergeada; no depende de 0195.

## Definition of Done

- [x] E2E de planes/períodos, cambio confirmado, cancelación/reanudación y errores.
- [x] Prueba/bloqueo y vista responsive 390/1440 sin overflow.
- [x] Typecheck, lint, formato, ui-guard y pnpm verify ejecutados con Node 24.

Implementada localmente; QA del owner y gate general E2E pendientes. No se
afirma `pnpm verify` verde ni autorización para publicar.

## Verificación real (2026-10-10)

Playwright con configuración temporal sin webServer (conflicto con Next dev
existente en 3200/3201), landing en localhost3003 y arneses reales con API doblada:
landing + ticket-settings + billing-ui **18/18**. Billing UI aporta 11 casos.
Layout de acceso 4/4; entrada por bloqueo 2/2; pruebas de cobro existentes 12/12
y guardias de layout 5/5. Los casos de entrada y prioridad de suspensión se
añadieron tras verify y pasaron junto con typecheck, lint y ui-guard finales.
Capturas 390/1440 de la suite vistas, sin overflow. Evidencias temporales:
`/private/tmp/0196-e2e-final.log`, `/private/tmp/0196-verify.log`.

`pnpm verify --base HEAD`, una corrida con Node 24:

| Gate | Resultado | Segundos |
|---|---|---|
| typecheck | ok | 4.3 |
| lint | ok | 9.5 |
| ui-guard | ok | 0.9 |
| format:check | ok | 30.3 |
| test | 2465 passed, 1067 skipped | 64.6 |
| build | 4 apps correctas | 30.0 |
| test:e2e | rojo: servidor dev existente impide arranque | 2.4 |
| neon related merchant | 37 passed, 4 failed por etiqueta Plan Plus anterior | 26.6 |
| neon related consumer | omitido: sin cambios consumer | — |

Tras actualizar solo las etiquetas esperadas, `tools/neon-test.sh
src/server/billing-reconcile-page.neon.integration.test.ts`: **5/5** en la base
de CI. Registro `/private/tmp/0196-neon-recheck.log`. No se repitió todo verify.
Cambios en pruebas de zona Claude limitados a textos/campos del contrato (§6).

## Mutaciones

Dos: quitar plan del checkout; texto de baja inmediata. Fallar por aserción
E2E específica y revertir contra copia limpia con diff.

Ejecutadas y revertidas: M1 falla por objeto de checkout sin `plan: base`;
M2 falla porque el modal no contiene «seguirá activa hasta el final del período
actual». Ambas exit 1 con una prueba fallida por su aserción; SHA256 del archivo
restaurado idéntico al limpio. Bitácora previa a cada medición y salida en
`/private/tmp/0196-mutations.md`, `0196-M1.log`, `0196-M2.log`.

## Declarado afuera

Cobro real de Stripe y QA final del owner; producción sin cambios.

## Handoff

Comandos y SHA en estado GPT. Reserva local en dev, sin push por ADR 0128.

## Abierto

Sin decisiones pendientes; aplica ADR 0134.
