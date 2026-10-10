---
spec: 0187
fecha: 2026-10-09
estado: cerrada
resumen: Administrar mesas en modal propio de Locales y elegir mesa registrada con ocupación en POS, conservando texto libre y API0182.
disjunta: no
archivos: apps/merchant/src/app/backoffice/locations/locations-console.tsx, apps/merchant/src/app/backoffice/locations/location-tables.tsx, apps/merchant/src/app/backoffice/pos/pos-tables.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-types.ts, tests/e2e/tables.spec.ts, tests/e2e/support/tables-harness.tsx, tests/e2e/pos.spec.ts
---

# 0187 — Mesas en Locales y POS

L2 (ADR 0129), sesión principal sin subagentes. Encargo del 2026-10-09,
contrato 0182 y ADR 0131 leídos completos. Dev local, sin merge ni push.
Un dominio: mesas. Sin decisiones de producto abiertas ni migraciones.

## Problema

Locales permite editar y archivar locales, pero no administrar sus mesas.
El editor POS usa únicamente el nombre libre; falta enlazar `tableId` y mostrar
la ocupación disponible en la API 0182, que ya está en live.

## Diseño y alcance

Locales consulta la sesión y muestra Mesas solo si `business.posEnabled` es
verdadero. El botón queda junto a Editar; para locales archivados queda junto
a Reactivar. El modal independiente «Mesas · local» filtra mesas activas.
Crear usa POST con `{ name }`; renombrar PATCH con `{ name }`; quitar POST de
status con `{ status: "archived" }`, previa confirmación. El nombre admite de
1 a 60 caracteres después de trim. Cada Confirmar guarda inmediatamente;
Cancelar no escribe y Cerrar únicamente cierra. Busy y una referencia síncrona
impiden dobles escrituras y cierre durante la solicitud. Se actualiza la lista
con la respuesta y se usa el toast de confirmación compartido. Montaje por id
de local y cleanup excluyen respuestas tardías. Editar no cambia. Sin plazas,
reordenamiento, vista de archivadas ni reactivación de mesas.

POS consulta GET `/api/pos/tables?locationId=...` al abrir el editor, sin polling.
El selector muestra nombre y Libre/Ocupada/En esta orden; una mesa ocupada por
otra orden no se puede elegir. La seleccionada se destaca con borde y fondo
semánticos del kit. Seleccionar conserva id y nombre; siempre hay alternativa
de texto libre. POST registrado manda `tableId`; POST libre lo omite y exige
`tableLabel`. PUT libre manda `tableId: null` explícitamente para desligar.
La firma de cambios, baseline, descarte y resolución de conflictos incluyen
el id; pasar a texto libre con el mismo nombre también es un cambio.

Cambiar mesa en una orden abierta usa el mismo selector y un borrador separado:
Cancelar no aplica, Listo aplica al editor, Guardar cambios persiste.
`table_occupied` y `unknown_table` refrescan las mesas sin perder productos ni
el error literal. Una mesa seleccionada ausente u ocupada bloquea guardar;
permite volver al paso Mesa y elegir otra o escribir un nombre. Un fallo de
lectura ofrece reintento y permite texto libre. 401/403 siguen el manejo de
sesión existente. Sin local no se consulta; cleanup aísla contextos anteriores.

Se consume el contrato 0182 sin tocar servidor, API, DB, kit ni impresión.
Owner administra mesas con el permiso existente de Locales; el operador elige
mesas con POS. El servidor deriva el negocio de la sesión. Todos los errores
HTTP muestran el campo `error` literalmente; `code` solo decide el refresco.
Duplicado, mesa ocupada, límite e input inválido conservan borrador y lista.
Reservas quedan fuera del alcance.

## Definition of Done

- [x] CRUD modal e2e: filtra archivadas, Confirmar guarda, Cancelar no escribe;
      duplicado/ocupada conservan estado, POS desactivado oculta Mesas y Editar sigue intacto.
- [x] POS e2e: elegir libre, bloquear ocupadas, POST con id y posterior ocupación;
      PUT de cambio y retorno a null; errores refrescan y conservan productos.
- [x] Respuestas tardías aisladas por local y acciones bloqueadas durante escritura.
- [x] Typecheck, lint, ui-guard, format:check y e2e de ambos flujos en 0; capturas vistas.
- [x] Handoff y estado GPT; commits en dev sin merge, push ni zonas de Claude.

## Cierre local — 2026-10-09

Ocho casos de mesas y 91 regresiones POS: 99/99 verdes. Se verifica también
el retorno a texto libre con el mismo nombre, reintento y aislamiento entre
locales. Los oráculos previos de caché conservan los endpoints originales y
cuentan aparte las nuevas lecturas de mesas. El wizard ahora espera el pedido
ya guardado: su anterior heading podía coincidir antes de terminar el POST.

Typecheck de seis paquetes, lint y formato globales, ui-guard de seis archivos
sin aumentos, check-numbers y diff --check en 0. Capturas de Locales 390/1280 y
POS 390 inspeccionadas. Comando y evidencia en
`docs/handoff-0187-mesas-locales-pos.md`.

## Mutaciones y límites

### Ajuste visual autorizado — selector en chips

El owner pide reemplazar las tarjetas de selección por chips como el badge del
topbar y corregir el borde recortado por el scroll. El selector compartido usará
una fila flexible con salto de línea, botones redondeados y nombre/estado inline.
La selección se indica con borde de 1 px y fondo suave; se elimina el ring exterior
y se añade espacio interior al listado para foco y hover. Sin cambios de lógica,
contrato ni kit. Validación: E2E de mesas existente y capturas del modal móvil y
desktop, más typecheck, lint, formato y ui-guard.

El owner pide además quitar del modal Cambiar mesa el texto «Mesa seleccionada»
y la opción «Usar nombre de mesa». Se ocultan esos detalles solo en el modal;
el paso inicial Mesa conserva su alternativa libre. Si la orden ya usa texto
libre, el modal conserva el input para editar ese nombre.

Nuevo ajuste del owner: Cambiar mesa oculta ocupadas por otras órdenes, conserva
la mesa propia y usa Guardar directo, habilitado solo con cambio válido. PUT
persiste la mesa con versión y productos de baseline; los productos aún editados
se conservan como borrador sin guardarlos accidentalmente. Éxito cierra y muestra
toast; fallo conserva modal y selección con mensaje HTTP literal.

Última regla del owner: nombre libre únicamente si GET de mesas del local
confirma lista vacía, tanto en paso Mesa como Cambiar mesa. Mesas ocupadas no
cuentan como ausencia de configuración. Durante carga/error no se ofrece nombre
libre y se bloquea avanzar/guardar contexto. Con mesas configuradas una nueva
orden exige tableId. Las órdenes antiguas libres pueden conservar sus productos
sin forzar reasignación; para cambiar mesa deben elegir una registrada.

L2 sin adversariales; API 0182 tiene oráculos previos. E2e con HTTP simulado,
UI y CSS reales. No acredita nuevas pruebas de persistencia real ni una
corrida de verify global. QA owner y publicación pendientes. Sin DB real ni
migraciones. No disjunta: toca POS 0183–0186 implementados. El encargo sin push
prevalece sobre la reserva remota. Abierto: nada.
