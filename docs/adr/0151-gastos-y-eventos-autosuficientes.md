---
adr: 0151
fecha: 2026-10-16
estado: propuesta
resumen: Gastos reemplaza Rentabilidad con pagos confirmados, conceptos estables y eventos completos por revisión, sin implementar Analíticas.
---

# 0151 — Gastos y eventos autosuficientes

[Spec0236](../specs/0236-gastos-registro-de-pagos.md), L2 por dinero, aislamiento y futura migración PROD. **Entrega exclusivamente documental:** no implementa ni genera migraciones ni autoriza operaciones PROD. El producto está cerrado por el owner; este ADR propone su resolución técnica. Verificación de código sobre `45a3f2269320c8e28e202f7369a89f4fedee1009`, después de integrar N en `dev`.

## Contexto verificado

`modules/profitability/manifest.ts` todavía declara id/permiso `profitability`, nombre «Rentabilidad», sin navegación ni carga inicial. Su servidor conserva `costs`, `costs/:costId`, `costs/:costId/period`, `costs/:costId/stop`, `totals`, `people` y `locations`. `salary.ts` participa en cambios de local de Equipo. El esquema conserva `fixed_cost`, `fixed_cost_period` y `fixed_cost_allocation`: períodos mensuales, reparto y FK a `core.staff_person`. La aritmética y los intervalos corresponden a ese modelo, no a pagos sueltos.

N ya separó las comisiones: [0235](../specs/0235-negocio-y-medios-de-pago-core.md) y [ADR0150](0150-negocio-y-comisiones-core.md) mandan sobre medios, resultados y compatibilidad histórica core. El registro de servidores solo suscribe Recetas a `sale.closed`; Gastos no hereda una suscripción de Rentabilidad.

La tarea IA se declara por módulo sobre `server/ai/task.ts`. Stock reconoce `itemId` entre insumos propios y valida después contra el comercio (`stock/ai-tasks.ts`, `stock/draft.ts`); su modal conserva fotos como `File[]` en memoria y las reenvía para analizar. `server/ai/image-input.ts` valida/normaliza bytes sin guardar la foto.

`server/module-events/{publish,types,decode,retry}.ts` asume `sale.closed`; `retry.ts` decodifica toda entrega como venta. `packages/db/src/schema/module-event.ts` tiene unicidad `(business_id,event_type,source_id)`, `source_id` UUID y `location_id NOT NULL`. Las tres consultas de `stock/count.ts` solo filtran comercio/local; por eso un evento nuevo con local modificaría su corte de ventas. `modules/recipes/server/consumption-cost.ts` y `server/business/commission-read.ts` ya filtran explícitamente `sale.closed` (paths relativos a `apps/merchant/src/`).

## Decisiones de producto del owner

Fuente: [plan, únicamente F rediseñada y sus subsecciones](../plan-margen-ganancia-2026-10-14.md#f-rediseñada--gastos-medios-y-analíticas-decisiones-del-owner-2026-10-1516), respuestas del encargo del 2026-10-16 y [ADR0152 §4, bloque de eventos de Gastos](0152-analiticas-inbox-accionable.md#4-de-dónde-salen-los-datos-resúmenes-diarios-con-vocabulario-del-core). Ese bloque manda para eventos.

- Módulo «Gastos», id/permiso propio `expenses`, ítem propio del menú sin agrupar, sin carga inicial obligatoria. Solo registra gastos; Analíticas calculará estimados, punto de equilibrio y resultado.
- Dictado o foto → entradas propuestas por IA → confirmación. Ejemplos del owner: «pagué de alquiler 900», «compré una garrafa por 3.2», «pagué a Luis su sueldo 450».
- Criterio de caja: «el gasto cuenta en el mes en que sale la plata». Sueldos son nombres libres, sin alta ni FK a Equipo. Las personas sin acceso de Equipo se quedan.
- Concepto estable por categoría y nombre normalizado; «pagué a Luis», «sueldo Luis» y «Luis 450» reconocen el mismo concepto. Categorías fijas más «otro» con texto libre.
- La IA marca fijo/variable, sin deducirlo de la categoría; el check es visible y corregible, sin exigir una acción. Alquiler fijo; agua/gas consumidos variables.
- Cada gasto pertenece a un local o a «todo el negocio»; predeterminado, local actual. «Todo el negocio» se guarda **sin local (null)**. Sin reparto `equal/manual`.
- Meses pasados abiertos: «no congelemos los meses pasados y listo». Se registra, edita y borra en cualquier mes; sustituye el congelado anterior.
- Foto conservada hasta guardar para poder reanalizar; después se descarta, sin comprobante permanente ni R2.
- Se eliminan tablas/rutas/código de0231 y se crean tablas de pagos nuevas. El nombre interno pasa de `profitability` a `expenses`.
- Publicación inmediata de `expense.recorded`, `expense.updated`, `expense.deleted`, versionados y autosuficientes; updated/deleted incluyen el estado completo resultante.

## Resolución técnica propuesta

### 1. Pagos, conceptos y revisiones

El módulo vive en `apps/merchant/src/modules/expenses/`, con UI, manifiesto, tareas IA y servidor propios; esquema `expenses` en `packages/db/src/schema/modules/expenses.ts`. Los tres registros cambian su entrada; las rutas siguen el despacho genérico, sin rutas de módulo en `app/` ni imports core→módulo. El guard exige módulo encendido y owner o permiso `expenses`; no concede acceso por `profitability`, `business` ni Equipo.

| Tabla nueva | Campos e integridad |
| --- | --- |
| `expenses.concept` | UUID `id`, comercio, `category`, `name`, `normalizedName`, timestamps. Único `(business_id,category,normalized_name)`; identidad estable por comercio, sin relación con una persona de Equipo. |
| `expenses.expense` | UUID `id`, comercio, `paidOn` DATE, `paymentTimeZone`, `amountMinor` entero exacto positivo, `currencyCode`, `minorUnit`, categoría, `conceptId`, nombre libre `name`, `isFixed`, `locationId` nullable, `createdByUserId`, timestamps, revisión monotónica, `revisionId`, `deletedAt` nullable. |
| `expenses.expense_revision` | Append-only: UUID `revisionId`, comercio/gasto, número de revisión, tipo de operación, `operationId`, `lineIndex`, huella del pedido, actor y snapshot completo resultante. Únicos comercio/gasto/revisión y comercio/operationId/lineIndex. |

Categorías iniciales conservadas del código: `rent`, `gas`, `electricity`, `water`, `personnel`, `other`. «Otro» exige texto libre; todos los pagos conservan nombre libre. Categoría del pago y concepto deben coincidir. Normalizar nombre mediante Unicode, espacios y mayúsculas/minúsculas produce una clave estable; la normalización no inventa equivalencias semánticas. Dos locales pueden usar el mismo concepto: el local pertenece al pago. Elegir otro concepto al confirmar o editar cambia ese pago y crea su revisión; no renombra ni fusiona conceptos usados por otros pagos.

Monto en DB como entero exacto, por ejemplo `numeric(18,0)`, y en JSON como cadena decimal de unidades menores; nunca `number` de coma flotante. Validar positivo, moneda/unidad soportadas y rango. Reutilizar primitivas core de dinero; no conservar reparto/aritmética mensual por proximidad de nombres.

FKs compuestas comercio/concepto y comercio/local impiden referencias cruzadas; `locationId=null` representa todo el negocio. Actor y comercio derivan de sesión, no del body. `createdByUserId` no es `staff_person`. Lecturas/escrituras/revisiones siempre se acotan por comercio. Guard y DTOs completos también protegen nombres de sueldos.

### 2. Día del pago y contexto monetario

`paidOn` es un día calendario real `YYYY-MM-DD`, no un instante UTC. «Hoy» y las fechas relativas del dictado se resuelven en la zona IANA del comercio; su mes es el mes de ese día. Guardar `paymentTimeZone` captura la zona usada al confirmar; no volver a reinterpretar pagos antiguos si cambia Regional. La edición de `paidOn` usa el mismo contexto explícito del pago y publica nuevo snapshot. Alta, edición y borrado admiten cualquier mes, incluido uno pasado; no hay cierre ni congelado mensual.

Alta captura moneda/unidad del comercio. La escritura exige `expectedCurrencyCode`; una carrera con Regional devuelve409 y conserva borrador, sin reinterpretar el monto en otra moneda. Ediciones conservan moneda/unidad ya guardadas y comparan la expectativa con esa fila; no convierten pagos históricos. Una política general de conversión/cambio de moneda no se decide aquí.

### 3. IA y foto durante el borrador

`expenses/ai-tasks.ts` declara tareas síncronas para texto y foto mediante AiTask, con esquema estricto y proveedor/configuración genéricos. El camino síncrono existente usa `store:false`; no usar background con retención para estas fotos. El servidor arma contexto únicamente con conceptos, categorías, locales y contexto regional del comercio. Como `itemId` en Stock, la IA devuelve `conceptId` de la lista cuando reconoce uno; si no, `conceptId:null` y nombre propuesto. «Pagué a Luis», «sueldo Luis» y «Luis 450» deben devolver el mismo concepto de personal ya existente.

El normalizador posterior valida IDs y compatibilidad categoría/concepto contra el comercio. Una respuesta de IA no autoriza una FK ajena ni crea pagos. La revisión muestra monto, día, concepto/nombre, categoría, local y check fijo/variable; el dueño corrige coincidencias erróneas o elige un concepto nuevo antes de confirmar. La confirmación revalida todo; resuelve carreras de conceptos por la unicidad normalizada sin duplicar. No exige revisar el check para avanzar.

Fotos `File[]` y borrador viven solo en memoria del modal; no `localStorage`, IndexedDB, tabla de adjuntos ni R2. Cada análisis/reanálisis envía multipart; servidor valida/normaliza con el lector común y mantiene buffers solo durante el request. Un error de IA o confirmación conserva la foto en ese borrador. Tras ACK de guardado del lote, cancelar o desmontar el modal se eliminan referencias y se revocan URLs temporales si existen. No se persisten bytes/base64/URLs en pagos, eventos, revisiones o logs. No se promete recuperar el borrador tras recargar/cerrar el navegador.

### 4. Mutación atómica e idempotencia

Confirmar un lote guarda conceptos nuevos, pagos, revisiones y eventos en una sola transacción. `operationId` identifica el pedido; cada línea tiene `lineIndex` estable y su propio UUID de revisión. PUT/DELETE usan `lineIndex=0`, `operationId` nuevo y revisión esperada. Repetir misma operación/cuerpo devuelve resultado previo sin nuevas filas/eventos; reutilizar clave con otro cuerpo devuelve409. Comparar huella del pedido completo impide reusar un lote con líneas cambiadas. Revisión esperada evita pisar ediciones simultáneas.

Cada mutación nueva crea revisión mayor y UUID nuevo, incluso la segunda edición del mismo gasto. Borrado deja tombstone (`deletedAt`) y revisión/evento completos; deja de aparecer en gastos activos. No vacía campos, no reemplaza monto por0 y no publica solo el id. Falla DB/evento revierte toda la mutación; no responde gasto guardado sin su evento.

### 5. Eventos completos sin construir AN

Se conserva la unicidad actual de `module_event`: **`source_id=revisionId`**, no el id del gasto, para los tres tipos expense. Un retry reutiliza la misma revisión; otra edición usa otra. Envelope: comercio, tipo, `event_version=1`, source UUID y `location_id` idéntico al snapshot, nullable. Payload v1 común a los tres tipos:

```text
{ eventVersion:1, expenseId, revisionId, revision, operationId, lineIndex,
  paidOn, paymentTimeZone, amountMinor, currencyCode, minorUnit,
  category, conceptId, conceptName, conceptNormalizedName, name, isFixed, locationId,
  createdByUserId, createdAt, updatedAt, deletedAt }
```

`expenseId` corresponde al `id` del DTO de pago; `conceptName` y `conceptNormalizedName` son snapshots del nombre estable confirmado y su clave normalizada. recorded lleva revisión1/deletedAt:null; updated lleva todo el resultado posterior; deleted conserva todos los campos finales más deletedAt. `createdAt/updatedAt` son instantes; `paidOn` sigue siendo el día del pago y jamás se deriva del timestamp del evento.

El log basta para reconstruir el estado por gasto/revisión sin consultar tablas de Gastos. Al cambiar día, concepto o local, el consumidor futuro obtiene el estado anterior de su propio estado reconstruido del log y aplica el nuevo; un snapshot completo no permite sumar ciegamente cada revisión como otro pago. Identidad y revisión permiten detectar duplicados, ordenar y reconstruir después de entregas fuera de orden. Esto es una obligación del contrato para AN; no crea su proyección, métricas, resúmenes, inbox ni suscriptor.

Mínimo cambio de infraestructura previsto:

1. Añadir append transaccional genérico, con discriminación/validación por tipo y versión; `expenses` lo llama obligatoriamente en su mutación. El helper no tiene flag que omita el hecho. **`MODULE_EVENTS_ENABLED` conserva su efecto actual solo en el wrapper `publishSaleClosed`; no permite guardar un gasto sin evento.**
2. Ampliar tipos/decoder/dispatch de retry por tipo+versión. Nunca pasar expense al decoder de ventas. La ruta de venta conserva wrapper, captura de recursos/elegibilidad, payloads v1/v2, source orden y contrato de local obligatorio. No agregar captura de productos/pagos a Gastos.
3. Quitar NOT NULL de `module_event.location_id`; conservar índice y unicidad. Añadir CHECK condicional `event_type <> 'sale.closed' OR location_id IS NOT NULL` para mantener la invariante DB de ventas. NULL de Gastos representa todo el negocio. `sale.closed` sigue exigiendo UUID no nulo tanto al publicar como al decodificar; probarlo.
4. Entregas solo para suscripciones reales del tipo. Sin AN todavía, expense queda durable en el log **sin delivery ficticio**. No backfill de deliveries ni infraestructura del consumidor futuro. Preservar claims/backoff/ACK existentes.
5. Acotar explícitamente a `sale.closed` las tres consultas de `stock/count.ts`: captura, comparación del corte y búsqueda de pendientes. Así gastos locales no cambian el corte ni provocan «Hubo una venta». Sus consultas por igualdad de local siguen excluyendo NULL.
6. Permitir filtro opcional genérico por tipos en retry/pendingSummary y usar `sale.closed` en callers existentes: `modules/stock/server/routes.ts`, `modules/stock/movements.ts` y `modules/pos/server/close.ts`. Stock mantiene su alcance comercio/local; POS conserva su alcance actual por comercio. El cron genérico mantiene todos los tipos. Así no cambia el significado ni se consume el presupuesto de «consumos pendientes» con otro tipo. No hardcodear módulos dentro de core.

No cambiar el lector financiero ni la aplicación de consumo que ya seleccionan ventas. No crear suscripción AN para probar la publicación. La compatibilidad histórica de0150 no se borra porque un identificador contenga `profitability`.

### 6. Migración y retiro futuro

Los conteos PROD del owner (2026-10-16) son **evidencia histórica proporcionada**, no una consulta nueva: tablas0231 con0 filas, ningún comercio con módulo encendido y0 miembros con permiso `profitability`. El mismo encargo informa eventos encendidos en PROD desde ese día; no asumir el flag apagado del plan anterior.

**Antes de implementar**, volver a verificar PROD con autorización específica del owner: identidad de entorno/SHA, filas0231, activaciones, permisos, dependencias y estado de transición de0150. No usar el baseline como garantía actual ni consultar PROD en este encargo. Si aparecen datos/activaciones/permisos inesperados, detener el supuesto de borrado sin migración de datos y presentar el hallazgo al owner antes de diseñar su tratamiento.

Con preflight confirmado, preparar después una migración explícita: crear esquema/tablas nuevas; retirar allocations→periods→costs y FK/funciones propias dependientes, sin CASCADE ciego; eliminar esquema viejo solo si realmente queda sin dependencias. No hay filas de gastos que transformar según el baseline. No tocar medios, resultados, pagos, eventos ni obligaciones históricas trasladados a core por N. Cambiar permiso/manifiesto/registros al id nuevo sin otorgarlo por el permiso viejo ni backfill innecesario. Cada migración/operación PROD esperará autorización propia.

Eliminar carpeta/rutas antiguas, `salary.ts`, consultas/writers/totals/DTOs mensuales y sus tests exclusivos; retirar referencias al reparto, costos fijos periódicos y textos activos «Rentabilidad»/permiso viejo. Sustituir aritmética/intervalos solo si tienen uso real en pagos; borrar lo que quede sin consumidor. **Reubicar `profitability/commission-arithmetic.test.ts`: prueba el helper financiero core vigente y su cobertura no se borra al retirar la carpeta.** Conservar documentación histórica y las identidades históricas que exige0150. No redirects ni alias a rutas borradas. Conservar `core.staff_person`, personas sin acceso y APIs de Equipo. Retirar hooks genéricos `staffAction/staffPanel/staffLocationsChanged` solo tras comprobar que quedan sin consumidores; si alguno sigue usado, quitar exclusivamente la declaración/handler de Gastos.

## Alternativas y consecuencias

- Adaptar tablas0231 o mantener reparto: descartado por decisión del owner; períodos mensuales/FK personal no representan este registro de pagos.
- Usar gasto como source_id de todas sus ediciones: choca en la segunda edición; revisión UUID mantiene unicidad e idempotencia sin alterar la clave core.
- Local ficticio para todo el negocio: contradice el null del owner y falsea el corte Stock. Se permite null en el log y se preserva contrato de ventas.
- Evento delta o solo id al borrar: obliga a consultar detalle que puede haber cambiado/desaparecido. Snapshot y tombstone aumentan payload, pero mantienen replay autónomo.
- Guardar foto o reutilizar borrador como comprobante: fuera del producto acordado. Memoria limita recuperación tras cerrar el navegador, sin incorporar almacenamiento nuevo.

## Verificación y hallazgos separados

Implementación pendiente. Pruebas focales de0236: alta confirmada desde borrador y rollback atómico ante fallo de evento; dos expresiones del mismo concepto; segunda edición de mes pasado con dos source UUID distintos; cambio de día/local/concepto y tombstone completos; todo el negocio con null; owner/staff expenses y negativos de permiso/tenant; publicación durable sin AN y con flag de ventas OFF. Regresión concreta: ventas v1/v2 con local obligatorio, gasto local/null sin alterar corte ni pendientes Stock, reintento idéntico sin duplicados y clave/cuerpo distinto409. DB solo `tools/neon-test.sh` aislado; no suites enteras.

Hallazgos técnicos, **no decisiones del owner**: además de source_id/null advertidos por0152, se requieren decoder de retry discriminado y filtros explícitos de los consumidores actuales de ventas. Son ajustes mínimos descritos arriba. No apareció otra decisión de producto abierta. La política general de cambios de moneda sigue fuera; este diseño conserva snapshots sin conversión. La verificación PROD pendiente es condición de implementación, no evidencia inventada de esta entrega.

Verificación documental de este encargo: diff, paths/citas, coherencia con0236, formato y números disponibles. Presupuesto:0 mutaciones,0 DB,0 suites de producto. La revisión independiente y su SHA se registran en el handoff del coordinador; este ADR no afirma implementación ni PASS de pruebas futuras.
