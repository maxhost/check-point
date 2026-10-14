---
spec: 0227
fecha: 2026-10-13
estado: implementada
resumen: Stock por local y consumo idempotente de la receta al cerrar órdenes POS, sin bloquear ventas ni incorporar costos futuros.
disjunta: no; comparte esquemas, cierre POS, contratos Stock/Recetas y enganche genérico de módulos
archivos: packages/db/src/schema/{business,modules/stock,modules/recipes,modules/pos}.ts, packages/db/drizzle/**, apps/merchant/src/modules/{stock,recipes,pos}/**, apps/merchant/src/modules/{contract,route-table,server-registry}.ts, apps/merchant/src/server/**, apps/merchant/src/app/api/internal/**, tests/e2e/**
---

# 0227 — Etapa 0: stock por local y consumo por receta al cobrar

Piso **L2**: migración de datos reales y cierre de ventas. Usa `TEMPLATE-CHICA.md`, ADR0139/0141/0144 y ADR0145. **El encargo documental original no autorizaba implementación, migraciones ni publicación. La implementación local fue autorizada posteriormente en el handoff y por el owner; su cierre está registrado abajo.** Las decisiones de producto y el diseño técnico están cerrados. Cerrar estos documentos no autoriza por sí mismo push ni operaciones PROD.

## Problema

Stock suma movimientos por comercio y guarda `last_unit_cost` en `stock.item`. El POS ya guarda un local, aunque la columna y la API permiten `null`. Cobrar no consume insumos. Recetas guarda cantidades **por unidad del producto**: `recipes/draft.ts` ya divide entre el rendimiento antes de guardar. No existe rendimiento persistido: volver a dividir descontaría incorrectamente.

La etapa debe separar inventario por local y registrar el consumo de cierres nuevos, con cantidades congeladas, sin mensajes de stock en el POS. Es la base de costos posteriores, que no se implementan aquí.

## Preguntas y respuestas del owner

Todas las preguntas se presentaron antes de redactar. Recomendaciones y detalles de diseño siguientes no se atribuyen al owner salvo las respuestas registradas:

| Pregunta / recomendación presentada | Respuesta |
|---|---|
| 1. Insumos y recetas por comercio; saldo, movimientos y último costo por insumo + local. | Confirmado; sin promedio ponderado. |
| 2. Adaptar mínimamente entrada, ajustes, historial, saldos y consulta del costo existente en Recetas. | Confirmado. Un local: sin selector. Varios: costo para un local elegido; especificar el default. El dropdown de entrada con varios locales ya estaba confirmado en el encargo. |
| 3. Conservar local archivado e inventario, sin traslado; compras bloqueadas; órdenes abiertas consumen allí. | Confirmado, con corrección expresa: **permitir ajustes por conteo en locales archivados** para corregir negativos. |
| 4. Transferencias fuera de esta etapa, con movimientos compatibles con agregarlas después. | Confirmado. |
| 5. Permiso actual de Stock para todos los locales del comercio, sin nuevo alcance de staff por local. | Confirmado; conservar aislamiento entre comercios. |
| 6. Backfill al único local activo; con varios, mapa explícito del owner; sin destino real, no inventarlo. | «correcto, no tengo ningún comercio con más de un local ahora». Es información del owner, **no un preflight ejecutado**. |
| 7. Conservar cantidades por unidad y multiplicar por unidades vendidas; no guardar rendimiento. | Aceptado expresamente. |
| 8. Conservar lock de orden y `close_request_id`; consumo único por orden + línea + insumo, cantidades congeladas. | Confirmado. |
| 9. Cómo tratar el `location_id` actualmente nullable del POS. | «No hay orden sin local, nunca existirá». Con un local, toda orden va allí. El owner habló del selector futuro; al inspeccionar `pos/ui/pos-console.tsx` se comprobó que **ya existe** selector multi-local. Se conserva, sin UI nueva de stock. No se adopta cerrar sin consumo por falta de local. |
| 10. Receta vigente al cerrar, solo ventas nuevas; insumos archivados presentes consumen; sin reconstrucción al reactivar. | Confirmado. |
| 11. Fallo técnico de consumo no bloquea venta: evento durable y reintentos, frente a transacción conjunta que sí podría bloquearla. | Acepta evento durable. Reintentos por **cron-job.org**, job propio con `CRON_SECRET`; mantener reintento al próximo cobro y al abrir Stock. El owner configura el job. Después **aprobó cada 30 min durante las 24 h**; debe seguir barato cuando está vacío. |

Aclaración posterior: el owner aprobó drenar pendientes antes del conteo y, si falla, impedir **solo ese conteo temporalmente**. «Lo importante es que la mesa no quede bloqueada porque no se puede registrar la venta»: cobrar, pasar a `closed` y liberar la mesa nunca dependen del aplicador de Stock.

Decisiones previas que no se reabren: consumo por local de la orden; stock puede ser negativo; ningún aviso ni dato de stock en POS; producto sin receta o línea sin producto no consume; Stock o Recetas apagado al cerrar no genera consumo. Las colas truncadas del encargo no se usan para inventar reglas adicionales.

## Alcance y diseño

### Datos, precisión y compatibilidad futura

- `stock.item` conserva identidad, comercio, nombre, unidad y estado globales. Recetas continúa por producto/comercio; no se cambia su representación ni se agrega `yield`.
- Nueva `stock.item_location`: clave única `(business_id, item_id, location_id)`, `last_unit_cost numeric(14,6) NULL`, `updated_at`. Se crea bajo conflicto seguro cuando hace falta. Es también la fila de lock de cada par insumo/local: evita que dos conteos calculen del mismo saldo. Saldo = suma de movimientos **de ese par**, sin segundo cache de saldo.
- `stock.movement` agrega `location_id NOT NULL` y clase `consumption`. Compra/ajuste mantienen su semántica; consumo lleva delta negativo, costo y conteo nulos, orden/línea origen, producto y cantidad consumida congelados, usuario y fecha de cierre. Unicidad del consumo por `(business_id, source_order_id, source_line_id, item_id)`; no usar solo `clientRequestId`.
- Origen de venta mediante identificadores y contrato genérico, **sin FK/import Stock o Recetas → POS no declarado**. Los IDs congelados no se eliminan si cambia/borran receta/producto. Entradas conservan `entry_id`; origen y agrupación permiten un futuro traslado de dos movimientos sin reinterpretar compras o consumos.
- Último costo: compra **con precio** más reciente por `occurred_at`, ahora por par insumo/local. Empate determinista por `created_at, id`; compra sin precio no modifica costo. Backfill copia el costo legado al destino sin recalcular silenciosamente cifras históricas.
- Cantidades siguen decimales exactos de `modules/decimal.ts` y escala 3, dinero escala 2, costo unidad escala 6. `consumo = cantidadGuardadaPorUnidad × unidadesVendidas`; registrar el negativo de ese resultado. Ejemplo: 2.500 g / 10 pizzas ya son `250.000` g guardados; 3 pizzas consumen `750.000` g. Rendimiento lógico 1 en datos existentes, sin columna nueva. No volver a redondear/dividir por la tanda.
- Guardar el snapshot del consumo y sus referencias permite más adelante agregar cálculo ponderado y costos de venta sin repartir de nuevo inventario ni reescribir el significado del historial. No agregar hoy cálculos/caches/columnas de costos futuros sin uso.
- Validar comercio en toda lectura/escritura y referencia a local/insumo/producto. FKs compuestas comercio+ID con los índices únicos necesarios en las tablas referidas, además de guards; no confiar en UUID enviado por cliente.

- Recetas añade `recipes.revision`: ID inmutable, comercio/producto, líneas normalizadas con insumo/unidad/cantidad, fecha; guardar/borrar receta crea una revisión (vacía al borrar), sin rendimiento/costos. `core.module_resource_version` guarda puntero genérico `(business_id, resource_type, resource_id, provider_id, slot)` → `version_id`, sin FK del core a módulos. Recetas reemplaza receta vigente, inserta revisión y actualiza puntero **en una misma transacción**. Revisiones referidas por eventos no se borran con el producto. El cierre solo lee punteros/eligibilidad del core; el consumidor posterior expande la revisión exacta. Así no consulta lógica/tablas de Stock/Recetas dentro del cobro ni cambia receta al reintentar.

### Migración con backfill y preflight

1. Inventariar, sin escribir, comercios con movimientos o costo legado y locales activos; órdenes POS con local nulo; referencias cruzadas; conteos/costos por comercio y sumas por insumo. Una suma cero **no** equivale a no tener historial.
2. Un local activo: asignar **todos** los movimientos y costo legado de ese comercio a ese local. Varios: exigir mapa explícito del owner antes de ejecutar; no tomar el primero, repartir cantidades ni duplicarlas. Sin activo y con datos a migrar: resolver destino real antes del backfill. Comercio sin movimientos/costo puede permanecer sin datos locales; no inventar un local para migrar catálogo vacío.
3. **Expandir antes del código nuevo:** tablas de par local, revisiones/punteros y outbox; `location_id` nullable inicialmente; constraints de consumo compatibles. Mantener costo global legado mientras hay código viejo. Puente temporal DB: inserts antiguos sin local se asignan al único activo validado; cambios de receta regeneran revisión/puntero y compras mantienen costo local. Backfill bajo locks breves por comercio/par, con puentes ya instalados para cubrir writers en vuelo; revisionado y puntero se actualizan también atómicamente desde código nuevo. Nunca sustituir un destino ambiguo. Este puente no ejecuta consumos.
4. **Backfill y validar:** conservar número de movimientos, cantidades, importes, entrada y costos; receta inicial genera revisión idéntica, sin recalcular. POS `location_id NULL` se rellena solo con destino único comprobable; datos ambiguos/sin destino bloquean esa migración. Históricos cerrados/anulados no generan eventos. Reservar DB, journal/snapshot writer único.
5. **Deploy y activar:** nuevo código lee/escribe por local y guarda refs de revisión. Flag de operación inicialmente apagado; activar publicación/consumo de cierres nuevos únicamente después de validar schema, backfill, writers nuevos y su SHA desplegado. El flag no convierte cierres omitidos en pendientes retroactivos.
6. **Contract:** después de retirar/drain de writers antiguos, validar pertenencia/constraints y poner `NOT NULL`; retirar puente, consumidores y columna de costo global. La fuente de costo nueva es el par local; legado solo sirve al puente durante convivencia, no se suma ni se presenta como costo paralelo.

Cada fase requiere comprobación y autorización correspondiente de PROD; snapshot antes de migrar. No asumir seguridad por esperar un número fijo de segundos después del push. Rollback antes de activar conserva ruta vieja/puente; después de activar conserva eventos/revisiones y datos locales, nunca elimina consumos ya aplicados.

No se consultó PROD ni se aplicó migración en este encargo. Número SQL se asigna al implementar, después de revalidar el journal real.

### Cierre, snapshot y aplicación durable

1. POS conserva su transacción, lock `pos_order FOR UPDATE`, control de versión y único `(business_id, close_request_id)`. Reintento del mismo cierre devuelve lo ya guardado. Funciona con pase y sin pase; `voided`/edición no consumen.
2. Toda orden nueva del piloto se asocia en servidor al único local activo del comercio, aunque la UI omita `locationId`; nunca persiste nulo. Con mesa, usar su local y conservarlo al archivar. Con varios locales, conservar selector POS existente y exigir `locationId` válido del comercio en servidor. Referencia ausente/ajena da validación al crear/editar, no una orden sin local. No añadir datos de Stock al POS.
3. En el primer cierre se persiste un evento durable genérico **en la misma transacción que `closed`**. Captura ID estable de línea POS, producto, unidades, local, fecha, usuario, elegibilidad genérica de suscriptores y referencias de revisiones vigentes desde `core.module_resource_version`. El punto de captura define la versión vigente del cierre y su `closedAt`; leer todos los punteros/eligibilidad en una sentencia consistente. Guardado de receta que se confirma antes de esa lectura es visible; guardado concurrente posterior pertenece a ventas posteriores. El payload lleva `eventVersion: 1`, `sourceLineId`, `productId`, `quantity` entero y `resourceVersions: [{ providerId, slot, versionId }]`; revisiones son append-only y se conservan mientras un evento las referencia. Ausencia de puntero/receta significa sin receta. No llamar handlers ni leer tablas Stock/Recetas aquí. Posteriormente el consumidor resuelve esas revisiones inmutables y persiste sus cantidades, nunca la receta actual del retry.
4. Stock/Recetas apagado al cierre: evento sin consumidor elegible y razón terminal, sin movimientos. Sin producto/receta: no hay consumo de esa línea. Insumo archivado aún en receta sí consume. Cambios posteriores de receta, local, producto o módulos no cambian el snapshot; reactivar no crea eventos para cierres omitidos. Un pendiente capturado cuando estaban encendidos sigue siendo una obligación del cierre original, no una reconstrucción retroactiva.
5. **Después del commit**, intento acotado de aplicar pendientes del comercio, incluido el nuevo. Aplicación en otra transacción: reclama delivery, resuelve las revisiones exactas, bloquea pares insumo/local en orden estable, inserta todos sus consumos y marca aplicado, todo o nada. Un error de lectura/expansión de revisión queda pendiente sin volver a ejecutar cierre ni ocupar la mesa. Stock negativo no es error. Reintentos concurrentes usan claim/lock y unicidad: cero duplicados, sin estado «aplicado» con inserción parcial.
6. Fallo técnico al aplicar: la venta sigue cerrada y el evento sigue pendiente con intentos, `next_attempt_at` y diagnóstico sanitizado; sin avisos POS. Sin jobs que se pierdan al terminar la request: `after()` puede acelerar, **la persistencia y el cron son la garantía**. Al próximo cobro y al abrir Stock se intenta también, con presupuesto acotado; una lectura no espera indefinidamente ni da por definitivo un saldo pendiente.
7. En Stock, mostrar cantidad de consumos pendientes/incidencia y distinguir saldo calculado con aplicación atrasada; no esconder fallos ni datos de otros comercios. **Conteo:** dentro de POST de ajuste capturar corte de eventos ya confirmados para ese comercio/local, drenar hasta ese corte con presupuesto máximo de 2 s y revalidar antes de guardar; ningún token/API extra ni espera del POS. Si falta trabajo, devolver pendiente y reintentar explícitamente el ajuste. Si queda un pendiente anterior, devolver `409 consumption_pending` y no insertar ajuste. Si aparecen nuevos cierres durante la preparación, invalidar SOLO el conteo con `409 count_changed` y pedir actualizarlo; jamás bloquear cierre/mesa para esperar conteo. Validación final y saldo/ajuste se ejecutan en transacción consistente (serializable, locks de pares ordenados); un conflicto aborta/repite solo ajuste. El corte/invariante debe verificarse también frente a un close concurrente: el ajuste se ordena antes o después de ese evento, sin omitir/doblar consumo. No mantener locks POS/local del cierre durante drenaje ni borrar pendientes.

Límite técnico explícito: si falla persistir la propia venta y su evento en la DB, no puede confirmarse un cierre durable. Separar esa indisponibilidad del núcleo de un fallo del **aplicador de consumo**, que sí queda pendiente sin revertir la venta. El cierre captura únicamente referencias genéricas del core; errores técnicos de lectura de revisiones/aplicación ocurren después del commit y no afectan registro de venta, `closed` ni liberación de mesa. Sin IA ni escrituras Stock/Recetas dentro del cobro.

### Contratos HTTP y UI mínima

- Rutas continúan bajo `/api/modules/<id>/…`, permiso `stock` o `recipes`, módulo encendido; sin rutas de módulos nuevas en `app/` ni imports del core hacia un módulo.
- `GET /api/modules/stock/locations` y `GET /api/modules/recipes/locations` → `{ locations: [{ id, name, status }], defaultLocationId: string|null }`. No exigen permiso `locations`. Orden `created_at ASC, id ASC`; **default = primer activo**. Conservar elección válida mientras pantalla/sesión vive; nada nuevo en localStorage ni campo «principal» del comercio. Archivados seleccionables para consulta/conteo, nunca default de compra. Si no hay activo, default nulo y compras no disponibles.
- `GET /stock/items`, `/stock/movements`, `/stock/items/:id/movements` y lecturas `/recipes` + `/recipes/:productId` aceptan `?locationId=`; respuesta identifica local y cantidades/costos de ese local. Receta/insumos siguen globales. Lecturas Stock incluyen resumen de pendientes. Sin local enviado y un único activo: resolverlo. Con varios: error `422 location_required`, nunca total global mezclado.
- Compras sueltas, `POST /stock/entries`, ajustes agregan `locationId`; único activo puede resolverse sin selector. Compra en archivado → `409 location_archived`; conteo en archivado válido. Referencia ajena/inexistente → `404 location_not_found`; conteo con consumos anteriores pendientes → `409 consumption_pending` si no se pudieron aplicar antes, según corte confirmado; cierre nuevo durante preparación → `409 count_changed`. `/stock/items` creación/renombre/archivo sigue global; su DTO localizado usa el local seleccionado.
- Audio/foto solo generan borrador: no mover stock al analizar. La confirmación manda el local elegido con la entrada. El mismo dropdown sirve a carga manual y ajustes; cantidades/costo de receta se muestran según local, sin cambiar ingredientes ni recalcular rendimiento.
- Stock distingue movimiento de consumo y permite ver negativos, origen y pendientes. POS no agrega textos, alertas, campos ni datos de Stock.
- Nuevos errores conservan `{ error, code }`; decimales strings. DTOs sin payload interno de eventos, secretos ni stack traces.

### Job propio de reintento

`GET /api/internal/module-events/retry` (contrato genérico ADR0145), `Authorization: Bearer <CRON_SECRET>`, sin sesión de comercio. Secreto ausente/incorrecto → 401 antes de leer DB. `{ ok: true, claimed, applied, pending, failed }`, contadores y diagnóstico de infraestructura sanitizado; no devoluciones de payloads comerciales. Job separado del wallet; no GitHub Actions ni cron Vercel.

**Horario aprobado; configuración a cargo del owner:** cron-job.org minutos **0 y 30**, todas las horas/todos los días, zona **America/Guayaquil**, aviso de desactivación habilitado. Razón: también recupera ventas nocturnas sin esperar la mañana; el camino inmediato/próximo cobro/Stock da rapidez y el cron es respaldo. Con la suspensión tras 5 min documentada en ADR0118, una consulta nocturna cada 30 min permite intervalos de sueño; no prometer que Neon duerme toda la noche. Coincidir con los minutos del wallet evita despertar otra vez cuando ya corre ese job. Horario/frecuencia **aprobados**, aún no configurados en este encargo.

Sin pendientes elegibles: una consulta indexada `EXISTS`/claim vacío y retorno inmediato, sin listar comercios/recetas ni ejecutar IA. La consulta puede despertar Neon: «barato» no significa cero conexiones ni cero costo. Con pendientes: índice parcial por estado y `next_attempt_at`, batch máximo 50 y presupuesto 20 s; dejar resto para siguiente disparo. Backoff de fallos (1, 5, 15, 30 min, máximo 30) y recuperación de claims abandonados; límites son decisiones técnicas ajustables al implementar, no benchmarks. No declarar completado un evento que falla reiteradamente; incidencia visible en Stock.

## Archivos y paralelismo

- Un responsable de esquema/migración/backfill y contrato genérico; asignación explícita para core, tooling y migraciones. Un journal/snapshot writer.
- Después del contrato: un implementador Stock + adaptación UI; otro POS + consumidor Recetas y consulta de costo. No trabajar ambos sobre `stock/movements.ts`, `server-registry` o mismos registros sin writer definido.
- QA independiente para aislamiento, snapshot/retry y lote integrado. DB de desarrollo/CI reservada; ningún test contra `DATABASE_URL` PROD. Paths disjuntos no separan semántica de consumo/lock ni schema compartido.

## Definition of Done de la implementación futura

- [ ] Stock, historial, conteo y último costo corresponden al local elegido; único activo no muestra selector.
- [ ] Cobro nuevo consume exactamente la receta congelada; negativo permitido, sin UI Stock en POS ni duplicados ante reintentos.
- [ ] Fallo del aplicador deja pendiente durable y venta cerrada; se recupera por los tres disparadores.
- [ ] Archivado conserva datos, acepta conteos y consumos de órdenes ya abiertas, rechaza compras.
- [ ] Backfill conserva datos reales y no inventa local; no consumo de ventas anteriores ni retroactividad de módulos.
- [ ] Checks focales y QA de combinación aceptados; dueño configura job y confirma su primer disparo cuando se implemente. Publicación/migración esperan permisos propios.

## Pruebas pertinentes (a especificar, no ejecutadas ahora)

Reutilizar suites de cierre, locks y aislamiento existentes; agregar casos focales, sin batería universal por UI:

1. Receta originada en tanda distinta de 1 (10 pizzas/2.500 g, normalizada 250 g): 3 ventas → consumo 750 g, sin doble división; negativos y mismo insumo en dos líneas quedan correctos.
2. Retry mismo cierre, diferente clave sobre orden cerrada y dos aplicadores concurrentes: un consumo por línea/insumo; receta/módulos cambiados después no alteran snapshot. Con y sin pase.
3. Fallo al leer revisión/aplicar consumo/rollback/claim abandonado: venta closed + mesa liberada + pendiente; retry conserva referencia vigente al close y no duplica ni deja consumo parcial. Cron autorizado vacío retorna sin trabajo extra; no autorizado no toca DB.
4. Sin producto/receta; Stock/Recetas apagado al cierre; reactivación sin retroactividad; insumo archivado presente sí consume.
5. Backfill un local, mapa multi-local, datos sin destino; cantidades/importes/costo conservados; ausencia de datos no inventa local; POS histórico ambiguo se detecta.
6. Comercio ajeno/local de otro comercio → 404; saldos/costos de dos locales del mismo comercio separados; staff stock sin permiso locations usa contratos locales.
7. Conteo y consumo concurrentes/pending conforme corte/drain y validación optimista; compra vieja/sin precio no pisa costo; local archivado permite conteo y no compra.
8. QA visual del owner: selector, entrada audio/foto/manual, ajuste/historial y costo Recetas en un local y varios. Automatizar browser solo flujo nuevo que detecte un fallo plausible no cubierto por API.

## Handoff y pendientes de ejecución

**Esta entrega:** solo spec/ADR; ninguna afirmación de implementación, QA funcional o migración aplicada. Base documental `54dbff34`; SHA de entrega se informa fuera del propio documento. No editar INDEX, TASKS ni estados en este encargo.

Diseño cerrado: revisión inmutable + puntero genérico resuelve snapshot sin ejecutar Stock al cobrar; conteo drena y valida sin bloquear POS; selector POS multi-local ya existe; rollout expand/backfill/activate/contract y cron30min24h definidos. No quedan decisiones de producto bloqueantes sin respuesta.

Pendientes de ejecución, **no permisos pedidos ni trabajo hecho**: medir preflight real; resolver mapa si aparecen datos ambiguos; generar SQL/journal serialmente; owner configura cron y autoriza cada push/migración PROD. «Sin migrar de nuevo» se cumple evitando volver a repartir stock/reinterpretar historial: costos futuros pueden añadir campos/tablas sin cambiar esta base; no se implementan ahora.
Fuera: transferencias, promedio ponderado, costo congelado en venta, IVA, costos fijos, punto de equilibrio, ingeniería de menú, devoluciones/reapertura/compensaciones de ventas, stock visible en POS, permisos nuevos por local, selector multi-local nuevo del POS, reconstrucción de cierres anteriores, implementación y operaciones PROD de este encargo.

## Cierre de implementación local (2026-10-14)

Implementación autorizada ejecutada en worktrees separados con dos implementadores y QA independiente. Producto combinado `2c58a61fe600a4b20d504b9f99fa085368c2ade1`, entregas A `87deae34` y B `4a07b7e1`; [informe de aceptación y combinación](../factory/0227-qa.md). QA final PASS:17 casos DB, probe real10000 consumos/6136ms dentro20s,25 unitarios, tipos/lint/formato y buildMerchant; UI/visual y migraciones acreditadas con identidad de evidencia explícita.

Se corrigieron aplicación secuencial que no completaba eventos válidos grandes y fixture que alteraba suscriptores terminales. Batching mantiene toda/nada, snapshot/unicidad y presupuestos; cortes históricos usan un array bind. SQL expand0082/0083 aplicado sólo a CI protegida, contract probado con rollback y entregado como fase operativa revisable; flag inicialmente OFF. No push, operación PROD ni configuración de cron. Owner autorizó e integró el candidato `f3778519` por fast-forward en main local; dev sincronizada y cierre posterior sólo documental. Esta aceptación no autoriza publicación ni migración PROD.
