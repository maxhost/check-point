---
spec: 0236
fecha: 2026-10-16
estado: implementada
resumen: Gastos registra pagos confirmados desde dictado o foto, con conceptos estables y eventos completos para Analíticas futura.
disjunta: no; depende de 0235 integrada y comparte module_event, permisos y corte de conteo Stock
archivos: modules/expenses; retiro profitability; esquema modular; eventos core y conteo Stock; ADR0151
---

# 0236 — Gastos: registro de pagos

Spec CHICA, nivel L2 por dinero, aislamiento y futura migración PROD; [ADR0144](../adr/0144-factory-local-por-tarea.md), [verificación proporcional](../VERIFICACION.md). **Implementación local verificada**, autorizada por el owner después del encargo documental original. [QA de entregas y combinación](../factory/0236-qa.md), [servidor y migración](../factory/0236-core.md), [UI](../factory/0236-ui.md). Migración0096 preparada y probada solo en CI; sin push, deploy ni escrituras PROD. [ADR0151](../adr/0151-gastos-y-eventos-autosuficientes.md) contiene el diseño técnico; [ADR0152 §4](../adr/0152-analiticas-inbox-accionable.md#4-de-dónde-salen-los-datos-resúmenes-diarios-con-vocabulario-del-core) manda sobre cualquier otra mención de eventos.

## Problema

El dueño necesita registrar «pagué de alquiler 900, de agua 20, compré una garrafa por 3.2, pagué a Luis su sueldo 450»: IA propone entradas y el dueño confirma. La 0231 modela importes mensuales, períodos y reparto por local; no un registro de cada salida de dinero. Gastos será la fuente de pagos reales para Analíticas (AN), que calculará estimados, punto de equilibrio y ganancia/pérdida después.

Verificación de código sobre `45a3f2269320c8e28e202f7369a89f4fedee1009`, `dev` con [0235](0235-negocio-y-medios-de-pago-core.md) y [ADR0150](../adr/0150-negocio-y-comisiones-core.md) integrados:

- `modules/profitability/manifest.ts`: id/permiso `profitability`, label «Rentabilidad», sin navegación; `ui-registry.ts` declara `screens: {}`. Rutas `locations`, `people`, `costs*`, `totals`; `salary.ts` mantiene sueldos derivados de Equipo. Esquema `modules/profitability.ts`: `fixed_cost`, `fixed_cost_period`, `fixed_cost_allocation`, FKs hacia personas y períodos de locales; ya no declara tablas de comisión.
- `stock/ai-tasks.ts`, `recipes/ai-tasks.ts`, `server/ai/task.ts` y `stock/draft.ts`: tarea modular, IA síncrona y validación posterior contra el comercio. `stock/ui/stock-input-modal.tsx` conserva `File[]` en memoria; `server/ai/image-input.ts` solo normaliza buffers; `ai/usage.ts` registra metadatos, nunca entrada/salida.
- `server/module-events/publish.ts` publica `sale.closed`; `types.ts` fija ese tipo. `module_event.location_id` es obligatorio y la unicidad es comercio/tipo/`source_id`. `stock/count.ts` corta por comercio/local sin filtrar tipo: requiere ajuste al incorporar otros eventos.

En la entrega documental original no se consultó PROD. Baseline comunicado por el owner, leído autorizadamente el 2026-10-16: tablas0231 vacías, cero comercios con módulo `profitability` y cero miembros con ese permiso; eventos encendidos desde ese día. Son datos históricos, no evidencia suficiente para ejecutar una migración futura.

## Alcance y diseño

### Decisiones de producto cerradas y fuentes

Las decisiones siguientes pertenecen al owner: [plan, «F rediseñada» y sus subsecciones, incluidas «Preguntas de G»](../plan-margen-ganancia-2026-10-14.md#f-rediseñada--gastos-medios-y-analíticas-decisiones-del-owner-2026-10-1516), ratificadas/completadas por el encargo del 2026-10-16. Los detalles técnicos posteriores son propuesta de esta spec/ADR, no palabras atribuidas al owner.

1. «Gastos», id/permiso `expenses`, ítem propio de menú sin agrupar y sin carga inicial obligatoria; reemplaza `profitability`.
2. Eliminar tablas/rutas/código0231, `salary.ts` y FK a `staff_person`; crear registro nuevo. Las personas sin acceso de Equipo **se quedan**.
3. Dictado o foto → IA arma entradas → dueño confirma, como Stock/Recetas.
4. Caja: cuenta cuando sale la plata, aunque pague consumo anterior.
5. Sueldos con nombre libre, sin alta en Equipo; «Luis 450» y «Luis horas extras 40» pueden ser pagos distintos.
6. Concepto estable por categoría + nombre normalizado; «pagué a Luis», «sueldo Luis» y «Luis 450» reconocen el mismo concepto.
7. Categorías fijas más «otro» con texto libre.
8. IA marca fijo/variable, visible como check corregible sin obligar al dueño; no derivarlo de la categoría. Agua/gas variable, alquiler fijo.
9. Un local o «Todo el negocio», por defecto el local donde está el dueño, sin reparto. **Todo el negocio = `locationId: null`**, nunca un local elegido (owner, 2026-10-16).
10. «No congelemos los meses pasados y listo»: registrar, editar y borrar en cualquier mes; sustituye expresamente la regla previa de mes en curso (owner, 2026-10-16).
11. Foto conservada mientras se confirma/reanaliza; descartada al guardar, sin comprobante ni R2 permanente.
12. Owner accede por rol; staff necesita `expenses`, también en API, por sensibilidad de sueldos.
13. Publicar `expense.recorded`, `expense.updated`, `expense.deleted` desde ahora, completos/versionados/autosuficientes según ADR0152 §4, aunque AN no exista.
14. Estimados y punto de equilibrio los calcula AN, usando concepto y fijo/variable; no pertenecen a G.

### Registro, IA y corrección

`/backoffice/expenses` muestra registro y acceso a «Registrar gasto» mediante el kit Merchant; UI en `modules/expenses/ui/`. Manifiesto `requires: []`, permiso `expenses`, navegación propia. Módulo apagado mantiene datos pero oculta menú y bloquea API según guards existentes. No requiere POS, Equipo ni permiso `staff`; encenderlo no solicita carga inicial.

El borrador muestra cada pago con fecha, monto, categoría, concepto existente/nuevo, nombre libre, check fijo y local/«Todo el negocio». El dueño corrige cualquier campo antes de confirmar, incluidos emparejamiento de concepto y check. «Otro» exige nombre libre. Null solo proviene de elegir explícitamente «Todo el negocio»; si no se resuelve el local actual, se pide elegir sin convertirlo silenciosamente en null. En escritura `locationId` debe estar presente, UUID propio o null explícito. No escribir gastos, conceptos ni eventos al analizar; solo el registro técnico de uso IA existente. Fragmentos ilegibles o sin monto/fecha resoluble quedan pendientes de revisión, sin inventar pagos.

`expenses/ai-tasks.ts` declara `expenses.entry_text` y `expenses.entry_photo` sobre `server/ai/task.ts`; prompts/esquema/modelo del servidor. Contexto: día actual local, moneda/unidad del comercio y conceptos ya usados **de ese comercio**, con ID/categoría/nombre normalizado, como `itemId` en Stock. La IA devuelve `conceptId` existente o null y una propuesta de concepto. El normalizador comprueba pertenencia y categoría; un ID ajeno/inexistente jamás se acepta como emparejamiento. Revalida todo al guardar. Corrección: seleccionar concepto existente o crear el correcto; cambiar la asociación de ese pago no renombra ni fusiona pagos históricos.

Categorías iniciales conservan las seis existentes: `rent` (Alquiler), `gas` (Gas), `electricity` (Electricidad), `water` (Agua), `personnel` (Personal), `other` (Otro). Es una continuidad técnica de taxonomía, no una nueva decisión del owner. No usar categoría para calcular `isFixed`. Normalización determinista del nombre de concepto: Unicode normalizado, minúsculas, espacios recortados/colapsados; categoría + nombre forman la identidad única del comercio. Sin deduplicar conceptos entre comercios. Alta concurrente del mismo concepto recupera su ID único. «Personal · Luis» permite reconocer sueldo de Luis; «Personal · Luis horas extras» puede ser otro concepto corregible.

### Esquema nuevo y dinero

| Relación propuesta | Contenido e invariantes |
| --- | --- |
| `expenses.concept` | UUID, `business_id`, categoría, nombre visible estable, `normalized_name`; única comercio/categoría/nombre normalizado. No FK a Equipo. |
| `expenses.expense` | UUID, comercio, `paid_on` DATE finito, `payment_time_zone` IANA, `amount_minor` entero exacto >0, `currency_code`, `minor_unit`, categoría, `concept_id`, nombre libre, `is_fixed`, `location_id` nullable, `created_by_user_id`, timestamps, revisión creciente, UUID de revisión vigente y `deleted_at` nullable. |
| `expenses.expense_revision` | UUID nuevo por mutación y línea, gasto/comercio, revisión, tipo de operación, `operation_id`/`line_index`, huella semántica de petición, actor y snapshot completo resultante, incluido nombre normalizado del concepto. Append-only; única comercio/operación/línea y comercio/gasto/revisión. Permite replay aun tras ediciones posteriores. |

FK compuesta comercio/concepto y comercio/local cuando local no es null; categoría coincide con la del concepto. Autor sale de la sesión, comercio del guard; nunca del cuerpo. Revisión se incrementa bajo lock del gasto; transacción completa para lote, conceptos, revisiones y eventos. No confirmaciones parciales: fallo revierte todo, permitiendo corregir y reintentar.

JSON monetario usa `amountMinor` como **texto de entero decimal**, sin `Number` ni punto flotante; moneda/unidad son snapshot del comercio al registrar, compatibles con helpers financieros core. `expectedCurrencyCode` evita guardar con moneda que cambió mientras se confirma. Filas históricas conservan moneda/unidad al editarlas; su expectativa se compara con la fila, sin conversión nominal ni reinterpretación por cambios regionales. No suma de monedas ni política general de conversión en G.

`paidOn: YYYY-MM-DD` es el **día calendario del pago en zona del comercio**, no UTC ni fecha del evento. «Hoy» se resuelve con `core.business.timezone`; si no se dijo fecha, proponer hoy comercial visible/corregible, sin obligar a dictarla; fecha ambigua queda pendiente. El mes es el de `paidOn`. Guardar esa zona como procedencia del día; cambios futuros de zona no desplazan pagos guardados. No impedir meses pasados: alta tardía, edición y borrado publican su revisión completa. No agregar un campo de «mes consumido» ni congelación al cierre de mes.

### Contrato HTTP

Base `/api/modules/expenses`; despachador modular y permiso `expenses` en todas las rutas, owner por rol, módulo encendido. `Expense` devuelve `{ id, revision, revisionId, paidOn, paymentTimeZone, amountMinor, currencyCode, minorUnit, category, conceptId, conceptName, conceptNormalizedName, name, isFixed, locationId, createdByUserId, createdAt, updatedAt, deletedAt }`. Fechas/instantes JSON en ISO, local nullable explícito. Concepto devuelve `{ id, category, name, normalizedName }`. Sin campos de fotos/claves R2.

| Método/ruta relativa | Entrada → salida |
| --- | --- |
| `GET context` | `?locationId=UUID` opcional valida el contexto activo que trae UI →200 `{ currencyCode, minorUnit, timeZone, defaultLocationId, locations, categories }`. Sin contexto y con un único local disponible puede preseleccionarlo; con varios pide elegir, sin tomar el primero arbitrario. No existe local global de sesión que se pueda presumir. `defaultLocationId:null` sin resolver no selecciona «Todo el negocio», que requiere elección explícita. |
| `GET concepts` | →200 `{ concepts }`, solo conceptos del comercio usados al armar/corregir borrador. |
| `POST entries/draft` | `{ text, locationId }` →200 `{ draft: { lines, unparsed } }`; texto1–2000 caracteres. Cada línea propone `paidOn, amountMinor, category, conceptId, conceptName, name, isFixed, locationId, sourceText`; campos no resueltos null y revisión obligatoria antes de confirmar. |
| `POST entries/draft-photo` | Multipart `photos`1–3 y `locationId` (UUID o literal `business` para null) →200 mismo borrador; límites Stock:4MiB por foto,4,4MiB total antes del multipart. Validación real de bytes y JPEG normalizado con helper existente. |
| `POST entries` | `{ operationId, expectedCurrencyCode, lines }`,1–30 líneas confirmadas con campos del borrador salvo `sourceText`; `conceptId:null` crea/reusa categoría+`conceptName`. →201 `{ expenses }`; snapshot moneda/zona y autor del servidor. |
| `GET entries` | `?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=UUID\|business`; rango inclusivo de días locales, local omitido incluye todos, `business` solo null →200 `{ expenses }`, sin borrados, orden día descendente e ID estable. |
| `PUT entries/:id` | `{ operationId, expectedRevision, expectedCurrencyCode, ...campos completos de línea }` →200 `{ expense }`; no modifica autor original, moneda/unidad históricas ni otras filas del concepto. |
| `DELETE entries/:id` | JSON `{ operationId, expectedRevision }` →200 `{ expense }` con tombstone completo y `deletedAt`; no pone monto0 ni borra evidencia/eventos. |

`operationId` UUID por petición: reusar misma operación y cuerpo semántico devuelve el resultado original sin duplicar pagos/eventos; cuerpo distinto →409 `operation_conflict`. Revisión distinta →409 `expense_conflict`; retry de operación ya comprometida recupera su resultado antes del control de revisión vigente. Batch usa posición estable `lineIndex`; PUT/DELETE usan0 y revisión UUID distinta por mutación. La huella identifica método/operación, gasto objetivo cuando aplica y cuerpo semántico completo; no incluye fotos ni texto fuente.

Errores con envelope modular `{ error, code }`:400 `invalid_body`;422 `invalid_expense`/`invalid_text`/`invalid_photos` (fecha real, importe positivo exacto, categoría/check, concepto y local válidos, «otro» con texto);413 `photos_too_large`;415 `unsupported_image`;404 `expense_not_found` también para ID ajeno;409 `currency_conflict`, `expense_conflict`, `operation_conflict`;503 `draft_unavailable` o `expenses_unavailable`. Guard existente conserva401/403 `missing_permission` y403 `module_disabled`; errores no filtran entidades de otro comercio. Un fallo IA deja foto/texto y correcciones disponibles para reanalizar.

### Foto y duración del borrador

Los `File[]` viven **solo en memoria del componente del borrador**, sin localStorage, IndexedDB, DB ni R2. Se conservan durante revisión/reanálisis y ante error de confirmación. Al confirmar **todo el lote y recibir ACK**, vaciar archivos/previews/referencias; también al cancelar o desmontar el borrador. Recargar/cerrar pierde ese borrador, como Stock. Reanálisis reenvía archivos desde esa memoria. Servidor conserva buffers solo durante cada request, ejecuta IA síncrona (`store:false` ya provisto) y libera referencias al terminar; `core.ai_request` sigue guardando exclusivamente metadatos. La confirmación JSON no adjunta imagen y no guarda comprobante.

### Eventos y regresiones obligatorias

Según [ADR0152 §4](../adr/0152-analiticas-inbox-accionable.md#4-de-dónde-salen-los-datos-resúmenes-diarios-con-vocabulario-del-core) y detalle [ADR0151](../adr/0151-gastos-y-eventos-autosuficientes.md): `expense.recorded/updated/deleted` v1 incluyen gasto/revisión, día y zona del pago, monto menor/moneda/unidad, categoría, `conceptId`, `conceptName`, `conceptNormalizedName`, fijo/variable, local/null, autor y estado completo resultante. `deleted` es snapshot completo con tombstone. El evento basta por sí mismo; no necesita leer tablas de Gastos. No un delta ni una referencia a una fila que ya no exista. Para mover día/concepto/local, AN futura reconstruye el estado anterior por gasto/revisión desde el log o su propio estado, y reemplaza su efecto previo; no suma cada revisión como otro pago. No se implementa ese consumidor aquí.

`sourceId` es el **UUID de esa revisión/edición**, distinto en cada mutación y línea del lote; reintento reutiliza la revisión comprometida. Conservar la unicidad comercio/tipo/source. Generalizar `module_event.location_id` a nullable y el append a envelope discriminado/versionado, sin hardcodear Gastos en core ni construir AN. Gastos llama append **siempre en la transacción del pago**, aunque no exista consumidor o `MODULE_EVENTS_ENABLED` esté OFF; no commit de gasto sin evento. El wrapper de `sale.closed` conserva flag, payloads y local obligatorio.

Hallazgos técnicos adicionales: el retry/decodificador actual debe discriminar tipo para no deserializar un gasto como venta; no basta ampliar `publish.ts`. En `stock/count.ts`, agregar `event_type='sale.closed'` a captura, validación y pendiente del corte: los nuevos gastos de un local no representan ventas/consumos. Eventos sin local quedan fuera del filtro de local. Agregar filtro genérico opcional por tipos en retry/pendingSummary y seleccionar ventas en sus callers Stock/POS, conservando su alcance actual de comercio/local y presupuesto de consumo; cron genérico mantiene todos los tipos. No generar deliveries ficticios ni proyección/inbox/registro de métricas AN.

### Migración preparada y retiro

La condición previa a implementar se cumplió con autorización específica «Sí, autorizar solo lectura en PROD»: consulta RepeatableRead/read_only=on del 2026-10-17T03:55:08.839Z, cero filas0231, activaciones y permisos viejos, sin dependencias inesperadas. Evidencia y base en el [contrato](../factory/0236-implementation-contract.md). Antes de ejecutar0096 en PROD se requieren autorización propia y preflight fresco de identidad/SHA, conteos, permisos, dependencias y obligaciones históricas. Si cambian, detener y presentar hallazgo; no inventar backfill. La autorización de lectura ya consumida no autoriza migrar ni otra operación PROD.

Con preflight vacío confirmado se preparó y probó en CI la migración transaccional `0096_expenses_paid_register.sql`: eliminar `fixed_cost_allocation`, `fixed_cost_period`, `fixed_cost` y FKs/funciones exclusivas; crear esquema nuevo; permitir local null en eventos con restricciones por tipo; renombrar identidad de módulo/permiso en registros/validadores. No hay filas que transformar bajo ese preflight; no activar Gastos ni conceder permiso a staff por defecto. No `DROP SCHEMA profitability CASCADE`: N puede conservar adaptadores/dependencias de comisión hasta su corte/drenaje; conservarlos según ADR0150 y reportar cualquier bloqueo real. Comisiones core, pagos POS y eventos históricos quedan fuera de la eliminación.

Retirar carpeta funcional `modules/profitability`, esquema/exports viejos, `salary.ts`, `intervals.ts`, reparto/aritmética exclusivos, `people`, `costs*`, `totals`, registro/hook de sueldo y textos/permiso «Rentabilidad». No redirects a rutas borradas ni alias públicos `profitability`. Conservar `core.staff_person`, personas sin acceso, API Equipo y hooks genéricos si tienen otros consumidores; retirar contratos sin consumidor mediante evidencia. La prueba residual `profitability/commission-arithmetic.test.ts` cubre helper financiero core: trasladar esa cobertura a su ámbito correcto, no eliminarla junto al módulo. Historia/documentos ADR no se reescriben para borrar términos históricos.

Fuera: AN y resúmenes diarios, métricas/inbox, estimados, punto de equilibrio, Smart Menu, medios/comisiones, reparto entre locales, comprobantes persistidos y recurrencias automáticas.

## Archivos y paralelismo

Implementación local: `apps/merchant/src/modules/expenses/` (manifiesto, IA, validación, server y UI), retiro `profitability/`; `packages/db/src/schema/modules/expenses.ts`, exports y migración; tres registros modulares; `server/module-events/` y esquema genérico `module-event.ts`; `stock/count.ts`, callers `stock/server/routes.ts`, `stock/movements.ts`, `pos/server/close.ts` y sus casos focales. Rutas/pantallas mediante despachadores existentes, sin archivos de módulo en `app/` ni import core→módulo; [MODULOS](../MODULOS.md). Kit/guardias no se alteran para evadir checks. Copy de Merchant en tuteo.

G va **después de N**, nunca en paralelo sobre `profitability`. Writer único para esquema/eventos/contrato; UI y backend pueden separarse una vez fijado HTTP. Coordinador reserva recursos DB/migración; dos implementadores y QA independiente. Ficha operativa lleva base/worktrees/paths/puertos, sin datos volátiles aquí. La ampliación autorizada y las reservas concretas constan en el contrato y los handoffs. No se editan INDEX/TASKS/estados de Claude como parte de Gastos.

## Definition of Done

- [x] Gastos propio con flujo IA→revisión→confirmación; concepto reconocible, fijo corregible y «Todo el negocio» null; sin alta obligatoria ni sueldo ligado a Equipo.
- [x] Altas/ediciones/borrados de cualquier mes persisten dinero/día local correctos y evento completo atómico/autosuficiente; retry sin duplicados ni pérdida de segunda edición.
- [x] Owner/staff `expenses`, aislamiento, foto efímera y retiro0231 comprobados; comisiones N, personas Equipo, `sale.closed` y conteo Stock conservados.
- [x] Migración0096 preparada/probada en CI, sin ejecución PROD; QA focal de tarea y combinación sobre SHA identificado. La futura ejecución PROD requiere preflight y autorización propios.

## Pruebas pertinentes

Casos focales comprobados en la capa que detecta el defecto; reutilizar helpers de Stock y cobertura existente, sin suites enteras:

1. Borrador real con proveedor IA inyectado → corrección → alta confirmada: nada persiste al analizar; lote confirmado guarda gastos/conceptos/revisiones/eventos o revierte completo ante fallo técnico. Foto disponible al reanalizar/error, liberada tras ACK/cancelar; sin escritura R2.
2. Dos pagos «sueldo Luis»/«Luis450» reconocen el mismo concepto comercial; corregir emparejamiento cambia ese pago, ID ajeno no se valida. IA variable en agua/gas y fijo alquiler; check corregible sin paso obligatorio.
3. Editar gasto de mes pasado, incluyendo cambio de día/concepto/local, publica snapshot completo de nueva revisión; segunda edición tiene `sourceId` distinto; borrado histórico publica tombstone y alta tardía funciona. Día cerca de medianoche en zona comercial y fecha UTC diferente conserva mes de caja. Retry mismo lote/edición tras cambios posteriores devuelve resultado original; cuerpo distinto409.
4. «Todo el negocio» guarda local null en gasto/evento, sin local suplente. Gastos locales y globales no alteran corte/pending de Stock; una venta nueva sí conserva conflicto de corte. `sale.closed` mantiene local, envelopes históricos y efecto del flag; gastos publican también con flagOFF/sin AN, retry discrimina su tipo.
5. Owner permissions[] sí; staff solo `expenses` sí; staff sin él recibe404 en pantalla (`notFound` actual del despachador) y403 en API. ComercioB no lee/edita/borra gasto/concepto/local deA ni lo introduce por borrador; negativos reales y FK compuestas. Error técnico de evento no permite commit de gasto.
6. Migración CI focal con baseline vacío, conserva personas sin acceso, comisiones N y eventos; permisos/identidad vieja retirados, rutas viejas sin redirects. Cubrir preflight no vacío como parada explícita, no pérdida de filas. No ejecutar contra PROD.

Node24; estáticos/guardias solo ámbitos cambiados y tests decisivos. DB únicamente `tools/neon-test.sh` contra CI protegida, migración aislada sin writers concurrentes y `--no-file-parallelism`; QA de entrega y de combinación son evidencias distintas. Los resultados, exclusiones por selección y límites constan en QA y handoffs. IA comprobada con proveedor inyectado; no se afirma una llamada real al proveedor externo.

## Handoff y abierto

Diseño documental original sobre `45a3f2269320c8e28e202f7369a89f4fedee1009`; implementación posterior sobre contrato `6368a8c7770bc722f2c2c2719183ba6060ebea6a`. Candidato combinado **`02a69e659fc0dceb679ef4b7b3edbdce0465638b`**, QA independiente PASS: tipos/build Merchant y smoke autenticado real con CI, además de evidencia focal de ambos autores. El primer intento del smoke falló por la guía de bienvenida del fixture; cerrar la guía con su botón normal permitió completar el recorrido, sin cambios de producto ni retries automáticos. No se ejecutó verify global, push, deploy ni escritura PROD. Detalles y SHAs en [QA](../factory/0236-qa.md).

Hallazgos separados de decisiones del owner: (a) Stock y decodificador/retry requieren los ajustes mínimos de tipos descritos; (b) conteos PROD se deben revalidar autorizadamente; (c) N conserva compatibilidad condicionada al corte/drenaje, por lo que no se puede eliminar su esquema indiscriminadamente; (d) política general de cambio de moneda sigue fuera de G. Ninguna decisión de producto nueva bloqueante identificada. Si la implementación exige más infraestructura o revela datos/dependencias incompatibles con este contrato, se entrega el hallazgo aparte antes de ampliar alcance.
