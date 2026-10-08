---
spec: 0170
fecha: 2026-10-08
estado: cerrada
resumen: Pantallas POS contra el contrato 0169; configuración, órdenes por mesa, cobro con o sin pase e impresión desde el kit de UI.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/**, apps/merchant/src/app/backoffice/settings/**, apps/merchant/src/app/backoffice/layout.tsx, apps/merchant/src/app/backoffice/backoffice-navigation.tsx, apps/merchant/src/app/backoffice/staff/**, tests/e2e/pos.spec.ts, tests/e2e/support/pos-counter-harness.tsx
---

# 0170 — Pantallas POS

Nivel L3. Implementación UI del encargo `docs/encargo-gpt-2026-10-08-pos.md`, spec 0169 y ADR 0130.

## Problema

- `backoffice/backoffice-navigation.tsx` no ofrece POS ni configuración del módulo.
- No existe `backoffice/pos/page.tsx`; la API 0169 no tiene pantallas.
- `staff/permission-picker.tsx` ofrece POS incluso cuando está apagado.

## Alcance

Entra: configuración en Cuenta → Configuración (solo owner), navegación condicionada al módulo y permiso,
Abiertas y Cerradas hoy, creación/edición con local activo y mesa obligatoria, catálogo y carrito,
detalle, anulación confirmada, precuenta y ticket imprimibles, calculadora de cambio, escaneo opcional,
cupón y resultado del cierre. Rama dev local, commits sin merge ni push.

No entra: servidor, API, migraciones, kit, premios, medios de pago, reportes o cambios al mostrador.

## Diseño

Contrato HTTP completo de 0169, sin variaciones. POS usa exclusivamente `/api/pos/*` para operar;
configuración usa `PUT /api/merchant/business/pos`, sesión `/api/merchant/session`.
El guard de página y navegación exige módulo y permiso; configuración exige owner.
Locales activos se cargan igual que en la página del mostrador. Controles del kit, clases Tailwind
con tokens semánticos, sin CSS nuevo. Impresión mediante variantes `print:` y `window.print()`.

Carrito mantiene cada lineId y snapshot del servidor; nuevas líneas de un producto no alteran las
existentes. PUT envía lista completa. 409 version_conflict muestra aviso y reemplaza el borrador por
la orden vigente; orden cerrada/anulada abandona la edición/cobro. Errores `{ error, code }` se
muestran con el texto del servidor; pos_disabled/missing_permission retiran las acciones.
409 pos_has_open_orders abre modal con openCount. No se persiste Recibido ni cambio.

Escáner existente sin alterar el mostrador. Resolve y sondeo del cupón cada 4 segundos por POS;
veredicto del servidor, Quitar siempre disponible para selección válida o inválida. Oferta de
producto libre exige elegir una línea existente; producto fijo usa las líneas guardadas (el POS no
modifica una orden silenciosamente al cobrar). Se puede volver a Editar si falta el producto.
Previsualización del neto usa la función informativa existente del mostrador; resultado e impresión
final usan exclusivamente sale del servidor. UUID y cuerpo congelados por intento de cierre,
reutilizados ante error de transporte; error HTTP definitivo libera el intento para corregirlo.

## Archivos

Rutas del frontmatter. No disjunta con modificaciones simultáneas en navegación o Equipo.

## Definition of Done

- [ ] e2e: crear, editar sin recalcular snapshot, conflicto de versión, imprimir, anular y cerrar sin pase.
- [ ] e2e: POS sin counter, resolver y quitar cupón, cierre con pase, error de cupón, UUID estable al reintentar.
- [ ] e2e: activación, modal por órdenes abiertas y visibilidad del permiso.
- [ ] ui-guard sin aumentos, typecheck y lint verdes.
- [ ] pnpm verify con Node 24 una vez al final y tabla en handoff.
- [ ] Revisión independiente; owner prueba pnpm dev:local antes de pasar a main.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutación | Oráculo |
|---|---|---|
| 1 | Editar omite lineId | e2e exige snapshot y lineId al PUT |
| 2 | Nuevo UUID en cada reintento | e2e compara cuerpos tras error de transporte |

## Declarado AFUERA

Cámara e impresora físicas, integración de pase/cupón real: QA del owner en pnpm dev:local.
No se declara deploy ni migración a producción.

## Handoff

Implementador y revisor independiente con evidencia según docs/AGENT-WORKFLOW.md.

## Abierto

Nada. Configuración bajo Cuenta sigue la ubicación sugerida en el encargo.
