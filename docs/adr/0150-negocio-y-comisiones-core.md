---
adr: 0150
fecha: 2026-10-16
estado: aceptada
resumen: Medios y comisiones pertenecen a core en Negocio; captura y resultado se congelan en la transacción de cierre, con estados incompletos que no bloquean ventas.
---

# 0150 — Negocio y comisiones en core

## Contexto y acuerdo

[Spec0235](../specs/0235-negocio-y-medios-de-pago-core.md), L2. Solo diseño documental; este ADR no autoriza implementación, migración, push ni operaciones PROD. Base examinada `971772c2e78b3a5e0625270d74cd74717aa42968`. ADR0138/0139 mantiene dependencias módulo→core; core no importa módulos ni conserva FKs hacia sus tablas. Gastos irá después, en serie, y allí se renombra `profitability` a `expenses`.

El owner decidió que medios y comisión son del comercio, se editan dentro de cada medio en un espacio core **Negocio**, junto con Regional y Fiscal trasladados desde Marca. Marca conserva identidad; Settings conserva módulos y acceso owner. Menú sin agrupar. Respuestas previas a esta redacción, citadas también en0235:

> «Sí: medios al crear el comercio; los actuales conservan todos sus medios e ids.»

> «Sí: permiso `business`, ruta `/backoffice/business`. Owner siempre; staff solo con el permiso; sin otorgarlo por `brand`.»

> «Sí, comisión dentro de la transacción de cierre, con una condición: ninguna condición de negocio (medio sin configurar, moneda distinta del fijo, etc.) puede revertir ni bloquear el cierre; se guarda marcada y la venta cierra. Solo una falla técnica de la base revierte, como ya pasaría sin comisión. Dejalo escrito con su test.»

> «Sí: 0 provisional con “Sin configurar” (coincide con mi decisión de P1). Ese estado tiene que viajar hasta Analíticas y Smart Menu como aviso, no como margen real.»

Se sustituye del ADR0149 la propiedad POS/Rentabilidad y el cálculo posterior para ventas nuevas. **Se conserva su congelado**: cada cambio crea revisión inmutable, el cierre captura una revisión comprometida o su ausencia y persiste resultado con sus parámetros. Cambiar la configuración no altera ventas anteriores. Cálculo exacto, normalización, pagos mixtos y contrato financiero0233 continúan vigentes.

## Decisión

### 1. Propiedad y esquema destino

| Tabla destino                        | Origen y conservación                                                                                                                                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core.payment_method_catalog`        | Ya core; sin cambio de propiedad, tasas ni catálogo nuevo.                                                                                                                                                                                                        |
| `core.payment_method`                | Mover `pos.payment_method`, con UUID, business_id, catalog_id, nombre, forma, efectivo, estado, timestamps, unicidades y checks.                                                                                                                                  |
| `core.payment_method_initialization` | Mover marcador POS por comercio; nuevos comercios inicializan en su alta transaccional, sin depender de POS. Mantener país/origen/fecha de los actuales.                                                                                                          |
| `core.commission_revision`           | Mover `profitability.commission_revision` sin regenerar IDs ni reescribir parámetros/originales/moneda; append-only.                                                                                                                                              |
| `core.payment_commission`            | Mover resultados existentes íntegros; ampliar para cierres core sin evento obligatorio, sin crear FK al productor.                                                                                                                                                |
| `core.sale_commission`               | Cabecera inmutable nueva de evidencia por cierre: UUID, comercio, fuente/orden opacas, local, cobrado, moneda/unidad, estado/razones y total/original/ajuste de comisión; única comercio/fuente/orden. No es una segunda tabla de ventas ni tiene FK a un módulo. |
| `pos.order_payment`                  | Se queda en POS; la FK compuesta comercio/medio apunta al mismo medio movido a core. Conservar ID de pago/orden/medio, posición, nombre/forma, importe, originales/ajustes y fecha.                                                                               |

Preferir `ALTER TABLE … SET SCHEMA` en migración transaccional: cambia ubicación preservando identidad física y FKs; verificar en CI índices, restricciones y secuencias dependientes, sin asumir que nombres viejos prueban propiedad. Mover/revincular también las funciones y triggers de las tablas trasladadas: `pos.p1_method_identity()` y `profitability.p1_immutable()` de0092 no pueden quedar como dependencias SQL del core. Las funciones de pagos/finanzas POS que siguen protegiendo sus propias tablas se conservan en POS. Mantener pruebas negativas UPDATE/DELETE e identidad después del movimiento. Ajustar exports Drizzle y nombres de constraints cuando haga falta. No copiar por nombre ni recrear medios con UUID nuevos. El módulo POS conserva solo pagos y su adaptación al servicio core.

Revisión vigente de comisión sigue usando `core.module_resource_version`, recurso `payment_method`, slot `commission`; proveedor nuevo `core`. La revisión contiene identidad del medio y su proveedor. Core resuelve la identidad histórica `pos` como alias del mismo medio **solo para lectura/captura legada**, dentro del comercio; no busca una tasa actual para reinterpretar un evento viejo. Migrar el puntero vigente a la identidad core de manera atómica preservando su `versionId`; retener referencias históricas `profitability`/`pos` necesarias para snapshots/deliveries pendientes. Nuevas configuraciones usan `core` y revisiones nuevas; no editar revisiones anteriores.

Los pagos existentes conservan **`method_provider_id = 'pos'`** como identidad histórica, incluidos sus JSON de settlement/eventos; no se hace UPDATE masivo de snapshots ni se cambian importes. Los nuevos pagos usan **`core`**; el default DB cambia para writers nuevos y cada writer lo envía explícitamente. La FK valida comercio/medio, no convierte proveedor en nuevo UUID. Las identidades `pos` y `core` identifican el mismo UUID migrado al leer medios, sin fusionar ventas/pagos ni mezclar comercios.

`core.payment_commission` conserva columnas actuales de evidencia y suma `source_provider_id` para distinguir productores. La identidad durable nueva es `(business_id,source_provider_id,source_order_id,payment_id)`; resultado y unicidad no dependen de que exista `module_event`. `event_id` queda nullable para cierres con publicación apagada y conserva valor en historia; se mantiene la unicidad histórica evento/pago cuando no es null. Las filas históricas que provienen de ventas POS reciben `source_provider_id='pos'` mediante DEFAULT al agregar la columna, por su contrato conocido, sin UPDATE ciego que viole el trigger inmutable y sin inferir configuración/resultados. No se agrega FK a `pos.order_payment` ni a órdenes POS. Lecturas separan monedas y fuente; revisiones/pagos/eventos/locales siempre filtrados por comercio.

`core.sale_commission` se inserta en el mismo commit de **cada cierre nuevo**, también con pagos[] y publicación apagada. Guarda `collectedTotal` además de contexto monetario y calidad del resultado. Neto0 explícito persiste total/original/ajuste0, estado completo, razones vacías; no crea `payment_commission` ni un pago0 que violaría sus invariantes. Cierre positivo guarda allí total completo/provisional/null según sus pagos y razones. El reader nuevo parte de esta cabecera, enlaza resultados por comercio/fuente/orden y no consulta POS; ausencia de cabecera no equivale a0. No se rellenan cabeceras históricas sin evidencia ni se recalcula su comisión; las lecturas de legado conservan sus reglas previas. Unicidad y trigger core protegen la cabecera; retry devuelve la existente, sin reescribirla.

### 2. Captura, cálculo y commit

POS entrega al servicio core los pagos validados, fuente opaca `pos`, orden/local, moneda/unidad y base cobrada del settlement autorizado. Fuente de venta y proveedor de medio son identidades distintas: una venta `pos` puede usar medio `core`. El core no consulta tablas POS. Preparar una captura común de referencias: productos/composición y punteros de comisión se leen en **un mismo punto MVCC**, incluso con publicación apagada; la comisión usa exclusivamente esa captura. Si hay evento, el publisher recibe esas referencias y las persiste, sin recapturar tarifas en otra sentencia. Mantener recursos R1 y envelopes v1/v2 compatibles, sin generalizar `module_event`.

El cálculo core es local, exacto y sin red/handlers modulares. En la misma transacción se guardan pagos/settlement, revisión capturada, base/porcentaje/fijo/moneda/originales/ajustes y resultado de cada pago, cabecera de comisión, más cierre/acreditación y evento si corresponde. Unicidad e idempotencia recuperan el resultado original antes de exigir pagos nuevos; un retry no cambia revisionId, parámetros, avisos ni fijo. Revisión ausente al cerrar sigue ausente aunque se configure antes del retry.

La función de comisión devuelve un resultado tipado para **todas las condiciones de negocio**; ausencia, incompatibilidad de moneda o configuración inaplicable no lanzan rechazo del cierre. Si una referencia/configuración resulta inconsistente, se guarda marcada con razón diagnóstica estable, sin tomar otra tarifa ni fabricar0. La comisión no introduce una validación comercial que impida cobrar. Se mantienen los rechazos POS ajenos a la comisión: monto inválido, suma incorrecta, medio ajeno/archivado, orden no cobrable o permisos insuficientes.

Una falla técnica DB de lectura/escritura/COMMIT revierte venta, pagos, acreditación, comisión y evento en conjunto. No guardar una venta durable y un resultado inventado para esconder esa falla. La implementación debe demostrar cierre persistido ante condiciones de negocio y rollback total ante error DB inducido; un test puro de aritmética no prueba ese cableado.

### 3. Calidad del dato y lectores

Conservar `FrozenCommissionResult` con `commission`, `originalCommission`, `normalizationAdjustment`, `configured`, `reasons`; reader agrega estado completo/incompleto/pendiente y total/original/ajuste. Razones conocidas continúan `commission_unconfigured`, `commission_currency_mismatch`; agregar una razón explícita de configuración/referencia inaplicable al manejar ese caso. No confundir presencia de tarifa (`configured`) con resultado utilizable.

- `none` y tasa explícita0 son cero conocido. Componentes ausentes usan0 solo para ese componente, `configured:false` y «Sin configurar»; lo cargado sí se calcula. Sin componentes da0 **provisional**, no costo/margen definitivo.
- Fijo original no cero de otra moneda conserva null/razón/incompleto; no se convierte ni aplica nominalmente, aunque `configured:true`. Fijo original0 en otra moneda aporta0 y no invalida el porcentaje.
- Sin evidencia de cobro positivo previo, módulo apagado al cierre antiguo o evento legado: sin dato/null, sin reconstrucción. Neto0 nuevo explícito permite0 cierto; no inferirlo por ausencia de filas.
- Datos nuevos se leen del resultado durable core aunque el flag de eventos esté apagado. Si falta un resultado que debería existir, devolver sin dato/incompleto, no recalcular con la revisión actual.

Analíticas/Smart Menu futuros deben transportar `configured`, razones y estado; un provisional puede mostrarse con aviso, pero no entrar como margen real/completo. Este ADR define esa obligación del contrato; no implementa agregados, proyecciones ni pantallas de esos consumidores.

### 4. Permisos y Regional/Fiscal

Alta de `business` en catálogo, normalización, capacidades de sesión, selector de Equipo y guards de Negocio. Owner accede por rol con permissions[]; staff solo si posee business. Sin backfill a staff ni a brand. El CHECK DB actual valida forma `^[a-z][a-z_]{0,39}$` y business ya cumple: verificar en migración/preflight y probar conservación de sus negativos, sin sustituirlo por catálogo cerrado. Si PROD difiere, resolver esa divergencia antes de migrar; no suponer que añadir un permiso exige ALTER en el esquema verificado.

Regional/Fiscal mantienen columnas/valores y validaciones actuales en `core.business`; solo cambian superficie, guard y responsabilidad de sus escrituras. Marca GET/PUT deja de leer/exponer/aceptar esos campos bajo brand. Cada área conserva revisión optimista sin sobrescribir columnas de otra. Negocio no es módulo, no tiene toggle ni `requires`; Settings no se toca. Tour/checklist y retiro concreto se especifican en0235.

### 5. Despliegue compatible, pendientes y retiro

La migración/despliegue se implementará y probará después; cada operación PROD tendrá autorización propia del owner. No generar ni ejecutar SQL aquí. Preflight identifica DB/SHA, cuenta filas reales, permisos/checks, punteros, eventos/deliveries, pagos y revisiones/resultados; obtiene comparación por IDs y campos sin datos personales. Baseline del encargo:4 comercios,22 medios,4 marcadores,2 pagos y0 revisiones/resultados/eventos; los conteos pueden crecer durante la operación paralela. **Conservar todos, no solo22/2.** Ningún backfill financiero de ventas viejas.

1. **Preparar binario puente**, todavía con endpoints de cobro actuales: el adaptador del módulo POS soporta ubicación vieja/nueva de las relaciones y delega a core cuando están migradas. La selección de ubicación y cada operación que las usa comparten coordinación transaccional con el corte; una operación no puede elegir `pos.payment_method` y perderla antes de su consulta. Un lock de transición compartido por operaciones afectadas y exclusivo por migración es suficiente; no locks nuevos de configuración de comisión en cada orden. Core no contiene un branch por nombre de módulo: el acceso legado queda en el adaptador POS y en migración. No exponer la administración nueva hasta terminar corte.
2. **Desplegar y verificar el puente antes del movimiento**. Comprobar READY/SHA y ausencia verificable de writers anteriores, incluidas ejecuciones en curso; no esperar una cantidad fija de minutos como prueba. Las sesiones POS abiertas conservan GET mínimo y cierre/payload/idempotencia. La fase previa sigue con la política de comisión antigua: no atribuir retroactivamente garantía core a ventas que cerraron antes del corte.
3. **Migración transaccional bajo coordinación de corte**: mover las cuatro tablas con funciones/triggers, crear cabecera core, ampliar resultado, ajustar FK/default/exports esperados, conservar y migrar punteros vigentes, inicializar únicamente comercios sin marcador y medios faltantes por alta real. Para comercios con medios/marcador no resembrar ni restaurar archivados. Habilitar la ruta core del puente solo después del commit de esquema completo; operación previa termina antes del movimiento, operación siguiente usa core. Leer IDs/valores/FKs y ausencia de huérfanos después del commit. No vistas de compatibilidad con INSERT ON CONFLICT: no equivalen a las tablas antiguas.
4. **Activar comportamiento nuevo y Negocio** con lectores compatibles: todos los cierres posteriores capturan/calculan core sin flag/subscriptor; UI POS conserva su selector. Durante el puente, endpoints antiguos de administración delegan al servicio core y al permiso business; quienes solo tienen pos o profitability ya no pueden editar tarifas/medios por esa vía. Nueva UI usa rutas core. Sin doble aplicación ni doble fuente de medios/tarifas.
5. **Pendientes históricos**: trasladar a core el aplicador compatible que usa exclusivamente payload v1/v2 y revisión capturada, conservando el subscriberId histórico `profitability`, claims, attempts, backoff y ACK. El router de retry despacha por un registro genérico de consumidores, sin importar módulos en core; esa compatibilidad identifica la suscripción histórica, no vuelve a activar un módulo. Delivery pendiente que nació elegible sigue obligado aun con módulo apagado. Skipped por apagado y cierres sin evento no se reprocesan. No crear deliveries nuevos de comisión para ventas posteriores al corte. Aplicación antigua escribe la misma identidad durable que el servicio core y verifica replay; nunca duplica ni usa puntero actual.
6. **Verificar y retirar**: probar venta nueva con medio core, congelado, calidad de resultado y reintento. Drenar y certificar que no quedan deliveries antiguos pendientes/claims activos antes de retirar su manejador. Retirar adaptador de ubicación y rutas administrativas viejas tras comprobar consumidores y sesiones actualizados; eliminar referencias/redirects obsoletos. El único endpoint POS de medios final es el GET de metadata para cobrar. Quitar `onEnable` y resourceProvider payment_method, tablas/exports propios de medios POS y comisión profitability, sin borrar pagos POS, resultados ni eventos. `sale_settlement` genérico histórico permanece solo si hay lector que aún necesita comprobar neto0; no borrarlo antes de eliminar su consumidor.

El registro genérico de retry debe admitir el delivery histórico sin requerir que `profitability` siga registrado: Gastos va después. La compatibilidad es acotada a recuperación de obligaciones existentes; no habilita eventos de otros módulos ni un broker nuevo. Si no hay pendientes, se elimina antes de concluir la implementación y no se deja andamiaje sin uso. Readers siguen aceptando referencias históricas de resultados/eventos aunque ya no haya aplicador.

Rollback de aplicación usa el **binario puente compatible con esquema core y nuevos resultados**, nunca el binario previo que solo sabe tablas POS/Rentabilidad. No mover tablas de vuelta, borrar resultados ni recalcular histórico. Antes del corte se puede volver al binario antiguo si el esquema aún no se movió; después, recuperación hacia adelante o puente. Detener publicación de eventos no apaga comisión core ni elimina obligaciones pendientes.

## Alternativas, costo y beneficio

- **Conservar medios en POS o mover UI sin datos**: mantiene dependencia funcional de POS y permisos erróneos; descartado por decisión owner.
- **Dejar aplicación posterior en core**: conserva aislamiento del cobro frente a fallos del aplicador, pero agrega pendiente/retry como obligación permanente para datos que core ya posee. Owner eligió cálculo en la transacción con resultados marcados; costo: las operaciones DB de comisión forman parte del mismo commit. No se hacen llamadas de red ni se bloquea por condiciones comerciales.
- **Cambiar provider y reescribir todos los snapshots antiguos**: alteraría evidencia congelada y payloads de retries; descartado. IDs y provider históricos se conservan; nuevos medios se consumen como core.
- **Copiar tablas como nueva fuente permanente o usar views de escritura**: introduce divergencia/dual-write o incompatibilidad con upserts existentes. Se prefiere mover las relaciones tras desplegar puente; los bloqueos del corte deben medirse en CI y acotarse operacionalmente.
- **Resolver tarifa por fecha o tarifa vigente al leer**: no prueba visibilidad del commit y cambia historia; descartado como en0149.

Beneficio: cualquier comercio administra sus medios/comisiones sin POS ni Gastos, el cierre guarda evidencia independiente del flag y los consumidores reciben su calidad real. Costo: transición coordinada de esquema/binarios, cambio del registro de recuperación histórica y separación de DTOs/permisos de Marca; sin infraestructura nueva de eventos para ventas futuras.

## Verificación y límites

Aceptación futura focal en0235: migración con datos similares a PROD y crecimiento durante corte; POS antes/después, revisiónA inalterable trasB, pendientes viejos, aislamiento, acceso owner/business y negativa brand; cierre durable ante ausencia/incompatibilidad y rollback total ante fallo DB inducido. Neto0 con flag OFF prueba cabecera durable/0 cierto y ausencia o identidad ajena nunca produce ese cero; no pago0 ficticio. Especificar y comprobar ambos caminos en el cierre real, no solo aritmética. DB solo wrapperCI protegido, DDL aislado; no suites globales por esta pieza.

Esta entrega no implementa ni ejecuta esas pruebas. Hallazgos técnicos no atribuidos al owner: el CHECK ya es genérico y los conteos PROD del prompt son históricos; se contrastarán en el preflight real. Política general de moneda, Peigo y precios por moneda siguen a decidir aparte. Gastos/renombre, Analíticas, generalización de eventos, propinas/anulaciones/diferidos y comisiones por local/profesional quedan fuera.
