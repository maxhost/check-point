---
spec: 0213
fecha: 2026-10-12
estado: cerrada
resumen: Stock deja de ser un mock: log real, compras manuales o dictadas con revisión, y conteos manuales. Sin fotos ni Recetas.
disjunta: si
archivos: apps/merchant/src/app/backoffice/stock/**, apps/merchant/src/app/backoffice/staff/staff-form-modal.tsx
---

# 0213 — Stock: registro, compras y conteos reales

## Problema

`stock/stock-log.tsx` muestra registros ficticios y `stock/stock-input-modal.tsx` devuelve ejemplos fijos al analizar y guarda solo un resumen en React. No persiste stock ni consume los contratos0210/0212.

## Alcance

Entra: log real, entrada de compra manual o dictada, revisión editable, precio total opcional, unidades separadas, insumo existente/nuevo, un conteo manual por guardado. Retirar fotos/archivos. Todo dentro del permiso catalog y módulo stock ya definidos por API.
No entra: Recetas, Analítica, API/servidor/migraciones, fotos, dictado de conteos, administración de renombres/archivo de insumos ni publicación.

## Diseño

Contrato:0210/0212 y encargo12oct. GET `/api/modules/stock/movements?limit=200` carga últimos200, sin agrupar líneas; fecha createdAt y texto compra/conteo+insumo+cantidad/unidad+precio total opcional. Conteo muestra countedQuantity (no delta). Fechas según zona horaria de sesión cuando disponible. Vacío, carga y error/reintento explícitos.

Modal lee GET `/api/modules/stock/items` activos. Nuevo stock: Audio predeterminado, Manual alternativo. Manual/revisión permite1..30 líneas, elegir existente o nuevo con nombre1..80, cantidad>0 con hasta3 decimales, unidad g/kg/ml/l/unit compatible y precio total≥0 opcional con hasta2decimales. POST `/entries` envía itemId o newItem, quantity/unidad y totalCost o null. API convierte unidades de compras; UI normaliza coma decimal. Una entrada es atómica.

Audio: texto trim1..2000, POST `/entries/draft` `{text}`. No guarda nada. Revisión muestra líneas reales, insumos nuevos/sourceText y unparsed. Fragmentos pendientes requieren reconocimiento explícito antes de guardar; borrador vacío permite completar manualmente. Volver al texto conserva transcripción. 503/red muestra error del contrato y acceso a Manual, sin ejemplos ficticios.

Ajustar stock: solo insumo activo existente, cantidad contada≥0 y unidad compatible. UI convierte kg→g/l→ml exactamente a string decimal base y POST `/items/:id/adjustments` `{countedQuantity}`. Sin precio ni creación de insumo en conteo; una escritura por modal para evitar guardados parciales de varios conteos.

Guardar y Analizar bloquean duplicados y cierre en vuelo. Fallo mantiene borrador/error español del API; éxito de escritura cierra modal y renueva log. Fallo al recargar tras éxito no vuelve a enviar la compra. 401/402/403(module_disabled),404,409(item_archived/item_name_taken),422 y503 se presentan sin anunciar persistencia. Ajuste de foco de StaffFormModal incluye textarea/select/controles del kit en foco inicial y Tab.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/stock/stock-types.ts` | DTO y números/payloads de frontend |
| `apps/merchant/src/app/backoffice/stock/stock-log.tsx` | Log real |
| `apps/merchant/src/app/backoffice/stock/stock-input-modal.tsx` | Entrada/revisión/conteo |
| `apps/merchant/src/app/backoffice/staff/staff-form-modal.tsx` | Foco incluye inputs del modal |

Disjunta: sí, backend0210/0212 y Recetas intactos.

## Definition of Done

- [ ] Typecheck merchant, ESLint de archivos, formato y guardia UI sin aumentos.
- [ ] Comprobaciones Node de payloads: unidades, coma decimal, precio opcional/total, conteo0, límites y validaciones.
- [ ] Sin mocks ni fotos en Stock; dictado llama draft y guardar llama entries/conteos.
- Sin Chrome/e2e/verify global por preferencia explícita del owner: revisión visual y escritura real quedan en dev para el owner. No afirmar QA real no ejecutada.

## Mutaciones — presupuesto: 0

Pruebas específicas de contrato frontend. Sin pruebas contra producción.

## Declarado afuera

ProveedorLLM real, permisos/aislamiento/transacciones son verificados por backend0210/0212; no se repiten sus suites. Usuario revisa flujo real en su ambiente.

## Handoff

GPT implementa solo UI (L2); owner revisa en dev. Sin subagentes ni publicación.

## Abierto

Sin decisiones de producto abiertas para este alcance aprobado.
