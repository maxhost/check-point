---
spec: 0187
fecha: 2026-10-09
estado: cerrada
resumen: Administrar mesas en modal propio de Locales y elegir mesa registrada con ocupación en POS, conservando texto libre y API0182.
disjunta: no
archivos: apps/merchant/src/app/backoffice/locations/locations-console.tsx, apps/merchant/src/app/backoffice/locations/location-tables.tsx, apps/merchant/src/app/backoffice/pos/pos-tables.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-types.ts, tests/e2e/tables.spec.ts, tests/e2e/support/tables-harness.tsx, tests/e2e/pos.spec.ts
---

# 0187 — Mesas en Locales y POS

L2 (ADR0129), sesión principal sin subagentes. Encargo2026-10-09 leído entero,
contrato0182 y ADR0131 completos. Dev local, sin merge/push. Un dominio mesas.

## Problema

LocationsConsole tiene Editar/Archivar pero ninguna UI para API de mesas.
PosEditor contexto usa solo tableLabel y payloadsin tableId; tiposUI no exponen
tableId del DTO0182. API/DB ya implementadas y live, no se editan.

## Diseño y alcance

Locales consulta sesión, failclosed para business.posEnabled; botón Mesas junto
a Editar en locales activos; archivados también pueden administrarse por API y
tienen botón Mesas junto a Reactivar. Modal independiente Mesas · local, GET
filtraactive; creación POST{name}, renombre PATCH{name}, quitar POSTstatusarchived.
Input1..60 con trim, Confirmar guarda inmediatamente, cancelar abandona input;
cerrar solo cierra modal, sin guardado general. Quitar requiere confirmación en
el mismo modal. Busy bloquea cierre/acciones y ref evita doble write. Respuesta
actualiza lista; éxito ConfirmationToast compartido; errores HTTPerror literales.
Carga/reintento, aislamiento por local con montaje keyed y cleanup de respuestas.
Modal Editar intacto; ni plazas ni orden ni archivadas ni reactivación de mesas.

POS GET/api/pos/tables?locationId durante contexto editor, sinpoll. Lista de
botones nombre/Libre u Ocupada; ocupada por otraorden deshabilitada, propiaorden
elegible. Selección almacena tableId y nombre; texto libre siempre disponible.
Dirty/baseline/discard/conflict incluyen tableId. Cambiar mesa en orden abierta
usa mismo selector dentro de modalCambiar mesa y aplica borrador solo conListo;
PUTguardar confirma. POSTmesa registrada manda tableId; libre omiteid enPOST,
PUTlibre manda null explícito para desligar. Enlace guardado sobrevivereaperturas.

Console incrementa revisión de mesas ante table_occupied/unknown_table para
refrescar lista; errorliteral mostrado, borrador/productos conservados. Selector
indica seleccionada no disponible y bloquea avance/guardar si mesa desapareció
o está ocupada porotra. Carga/error de mesas no impide texto libre; auth401/403
usa onError existente del POS. Sinlocal no consulta. Cleanup/contexto evita
respuesta local anterior. DTOtablesUi conserva id/name/openOrderId; no seatsUI.

Permisos mismos de0182: owner locales según encargo; POSoperator. Todo id en
URL/cuerpo es selección del usuario; negocio deriva de sesión servidor. Errores
400/401/403/404/409/422/503 por posRequest, error literal; códigos solo refresco.
table_name_taken/table_has_open_order/too_many_tables/invalid_input no borran
input/lista. No endpoints nuevos, DB/servidor/API/kit/printing/reservas fuera.

## Definition of Done

- [ ] CRUDmodal e2e: filtraarchivadas, confirma guarda; cancela no escribe;
      duplicado/ocupada conservan estado; POSoff oculta Mesas; Editar intacto.
- [ ] POSe2e: elige libre, ocupadas bloqueadas; POSTtableId, releer ocupación;
      PUTcambio y null a libre; ocupado/archivado refresca y muestra errorliteral.
- [ ] Respuestas tardías/contextos aislados; dobles acciones bloqueadas.
- [ ] Typecheck/lint/ui-guard/format:check y e2e dosflujos en0; capturas vistas.
- [ ] Handoff/estadoGPT, dev commits chicos, sin merge/push/zonasClaude.

## Mutaciones y límites

L2sin adversariales; API0182 tiene oráculos previos. Suitee2e con API simulada,
QA owner y gateglobal antesdelive pendientes. No escrituras DBreal ni migraciones.
Disjunta no: tocaPOS0183-0186 implementados, solo sesiónprincipal esta tarea.
Abierto: nada.
