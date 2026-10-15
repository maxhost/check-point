---
adr: 0149
fecha: 2026-10-15
estado: aceptada
resumen: Snapshot financiero normalizado por orden y línea en sale.closed v2, con descuento y origen congelados, originales y ajustes; comisión posterior independiente en Rentabilidad.
---

# 0149 — Pagos y comisiones congelados al cierre

## Contexto

[Spec0233](../specs/0233-medios-de-pago-y-comisiones.md), piso L2. Encargo solo documental, sin código ni migración generada. ADR0138/0139/0141 prohíben core→módulo y permiten importar otro módulo únicamente con `requires`; Rentabilidad0231 conserva `requires: []`. ADR0145 separa persistencia durable del cierre de aplicación posterior. 0230 congela costo al aplicar consumo; **P1 exige capturar la configuración de comisión al cerrar**, aunque el cálculo sea posterior. No extender a comisiones el instante de valoración de Stock.

Código revisado en `21a77b162669ea867eae34c9dc746c76f549cc5c`: POS no guarda total/medios; `GrantedOrder.total` es neto real autorizado, cupón devuelve descuento y lo persiste antes de retornar; `publishSaleClosed` captura punteros de productos/activación en una sentencia, payload v1 y deliveries durables; módulos declaran callbacks en `ModuleServer`, sin callback de encendido ni directorio de recursos. Rentabilidad ya existe, independientemente del estado antiguo de algún documento0231.

Owner confirma medio obligatorio solo con cobro positivo; neto0 sin medio/pagos[] y comisión0. Rentabilidad apagado al cierre positivo implica sin dato y sin reconstrucción; Smart Menu nunca lo muestra como0. Una entrada por medio/venta y fijo una vez por medio. Redondear neto final a unidad mínima, también USD, registrar ajuste y compartir monto con acreditación; no rechazar por esa fracción. Ecuador carga inicialmente1–6 del informe, Datalink opcional; Peigo fuera hasta confirmar forma, permitido como medio libre. El resto de decisiones cerradas y resúmenes fieles de las respuestas están en la spec.

Ampliación posterior acordada por el owner al cerrar P3: v2 incluye importes y descuento/origen por línea para evitar v3. Reparto global mediante proporciones acumuladas redondeadas; última cierra el total y ninguna cuota es negativa ni supera su bruto. Gratis/2x1 pertenece entero a la línea del producto elegida. Todos los importes operativos financieros se normalizan a la unidad mínima, con originales y ajustes auditables y cobrado aprobado intacto. Esta regla general se aplica a los casos similares sin nuevas consultas. Validar precios por moneda en el origen queda como hallazgo; todos USD es información del owner, no un inventario DB.

## Decisión

### 1. Propiedad de datos y contrato de recursos

Catálogo plataforma por país en core, sin tasas ni UI administrativa; medios del comercio y pagos en esquema POS; configuración/revisiones y resultados de comisión en Rentabilidad. FKs módulo→core permitidas; no FK/import Rentabilidad→POS, core→módulo ni dependencia obligatoria POS/Rentabilidad. Se preservan IDs/nombres históricos al archivar y Efectivo permanente por identidad estable.

Se agregan dos capacidades genéricas del framework, declaradas por el módulo en el registro servidor:

- `onEnable(tx,{businessId})`: callback transaccional al pasar apagado→encendido, bajo el lock genérico de activación y después de validar dependencias; antes del commit que habilita el módulo. POS lo usa para inicializar sus medios según país leyendo catálogo core. No se ejecuta en un `enabled:true` idempotente ni durante cobro. Fallo revierte activación/seed; un marcador módulo evita reponer archivados al reencender. Comercios ya activos se inicializan por migración.
- `resourceProviders`: directorio de recursos, con `resourceType` y operaciones `list(tx,businessId)`/`read(tx,businessId,resourceIds)` que devuelven IDs y metadata pública declarada. POS ofrece recursos `payment_method` con nombre/forma/estado. El framework despacha por registro; Rentabilidad consulta esa capacidad y valida comercio/IDs bajo su propio permiso. Para configurar tarifas recibe solo metadata de medios. La lectura puntual de `sale_settlement` permite únicamente el neto y su contexto monetario persistidos; no lista ventas, no obtiene líneas, pagos o clientes y no concede mutación POS. Los recursos guardados siguen consultables con productor apagado para configurar/conservar historia; sin datos devuelve lista vacía. El mismo provider ofrece lectura puntual del recurso `sale_settlement`, limitada a identidad comercio/local/orden, `collectedTotal`, moneda/unidad y `snapshotPresent`; sin líneas ni clientes. No es una API pública sin guard ni un permiso genérico de leer tablas de otro módulo.

Tipos de contrato core son genéricos (`resourceType`, proveedor, ID y metadata JSON acotada); el provider y el consumidor validan la forma de su metadata. El core no contiene nombres/IDs de módulos concretos ni importa sus implementaciones excepto por registros permitidos. No crear un segundo cache de medios como fuente de verdad ni acceder a POS mediante SQL desde Rentabilidad. `optional` puede declarar el productor conocido, pero no sustituye esta frontera ni concede importación.

El directorio es necesario porque configurar comisiones requiere conocer los medios existentes con permiso Rentabilidad, sin obligar a tener POS ni filtrar sus datos operativos. `onEnable` es necesario porque seed al primer GET incumpliría cargar al activar y añadiría escritura a una lectura. Ambos enganches se prueban mediante registro y frontera, sin excepciones en guardias.

### 2. Liquidación autoritativa del cierre

POS guarda bruto, descuento autorizado, ajuste, neto cobrado, moneda/unidad y pagos en el mismo commit de `closed`, con/sin cliente. Cantidades/precios vienen de snapshots, no catálogo actual. `Recibido`/cambio no son base de comisión. Con cliente, el flujo de acreditación/cupón sigue siendo único; su resultado alimenta el snapshot POS.

Helper monetario core genérico usa enteros/racionales y HALF_UP por minorUnit, sin importar Stock. Preservar originales G0,D0,N0=G0−D0 y cobrado aprobado N=round(N0); operar G=round(G0), D=round(D0), A=N−(G−D), con **G−D+A=N**. Guardar cada diferencia de normalización y también N−N0, sin confundir ese ajuste original con A. Importes operativos normalizados; originales/deltas de auditoría conservan precisión exacta. Comisión y pagos siguen la misma regla, sin redondear tasas como dinero ni alterar el costo unitario6 de0230.

El flujo genérico de acreditación permite un parámetro opcional de unidad de liquidación, default2 para conservar callers actuales; POS pasa la unidad de su moneda. Con cupón, aplicar redondeo antes de persistir `core.order.total` y calcular unidades. Sin cupón se entrega el mismo neto al writer. Se preserva descuento autorizado y se registra ajuste en POS/evento; core.order, pagos y acreditación comparten neto. No basta redondear después de `grantWithCouponInTx`: ya habría persistido otro valor. Esto justifica tocar el helper genérico del core; no agrega reglas ni literales POS en core.

Neto positivo exige pagos propios/activos distintos con importes originales positivos y precisión válida; la suma original debe normalizar al neto aprobado. El reparto acumulado produce pagos operativos positivos cuya suma exacta es ese neto, conservando originales/deltas y las entradas que normalizan0 solo en auditoría; una entrada por medio. Neto0 exige pagos[] y comisión0, aun sin Rentabilidad encendido, porque es un hecho explícito del snapshot nuevo. No asignar medio ficticio, fijo ni cero desde ausencia de datos legados. Validación de nuevos pagos ocurre después del branch idempotente cerrado+misma clave; el retry viejo no necesita inventar pagos para recuperar una venta cerrada.

### 2b. Descuento por línea necesario para v2

El reparto, su persistencia y el origen entran en0233. Postergarlos a P3 obligaría a cambiar el contrato cuando el primer evento v2 ya fuera durable o a reinterpretar ventas desde líneas actuales. P3 implementará premios/canjes; no se añade ese motor aquí.

Orden congelado `(position,sourceLineId)` ascendente. C(T,w) reparte enteros de unidad mínima por prefijos proporcionales HALF_UP; cuota=acumulado actual−anterior, última=T−Σanteriores. Evita el resto negativo de redondear individualmente: USD cuatro líneas0,01 y descuento0,02 →0,01/0/0,01/0. Pesos0 reciben0; total de pesos0 exige T0.

Descuento original global d0_i=D0×g0_i/G0; cuota operativa d_i=C(D,g0_i). Gratis/2x1 conserva la referencia exacta de la primera coincidencia que ya eligió el evaluador y descuenta una unidad snapshot, sin buscar otra línea del mismo producto ni repartir entre duplicadas. D0 y D quedan enteros en ese destino.

R=G−D y pesos restantes w_i=g0_i−d0_i. Si todos los brutos originales ya están alineados a minorUnit, conservar cada g_i=g0_i, r_i=g_i−d_i; repartir únicamente A mediante a_i=C(A,w_i), n_i=r_i+a_i. En esa rama A es0 o1 y el descuento queda acotado por pesos enteros y D≤G. No redistribuir brutos ya normalizados: USD dos líneas0,01/D0,01 mantienen g0,01/0,01, d0,01/0 y n0/0,01. Esta corrección técnica aplica la regla general de normalización del owner; no agrega una decisión de producto.

Si algún bruto conserva fracciones de minorUnit, usar normalización conjunta para asegurar límites: r_i=C(R,w_i), g_i=d_i+r_i, n_i=C(N,w_i), a_i=n_i−r_i. Ambas ramas garantizan importes no negativos salvo ajustes firmados, descuento≤bruto y sumas G,D,N,A con cobrado intacto. Sin cambiar precios en Catálogo. Los originales/deltas no terminantes se conservan como racional reducido con numerador/denominador/escala, no floats. Fórmulas/DTO completos en0233.

Persistir dinero/originales/ajustes/origen por línea POS con orden/pagos/acreditación/outbox en el mismo commit. Core recibe referencias opacas de línea, devuelve decisión autorizada y origen; no importa POS. Retry lee snapshot sin recalcular distribución. No backfill de ventas anteriores. Ejemplo COP probado en aceptación: originales10,40−0,60=9,80→cobrado10; operativo **10−1+1=10**, con todos los deltas auditados. COP0,60 con100%→bruto1/descuento1/neto0, pagos[].

Origen congelado `campaign_coupon` con couponId/campaignId/benefitKind y alcance/destino; reserva `program_reward` y referencia extensible para P3. No endpoint ni productor de canje de premios ahora. Descuentos no reducen cantidades de consumo: gratis/2x1 mantiene todas las unidades reales y referenciasR1.

### 3. Evento v2 y captura consistente de tarifa

Extender `SaleClosedEvent` a unión v1|v2. V2 conserva campos comunes y referencias de línea, incluidos slotsR1. Agrega dinero de orden, dinero/origen por línea y pagos: bruto, descuento atribuido, neto, ajuste firmado, originales/deltas y moneda/unidad; cada pago conserva ID, medio/proveedor/nombre/forma, importe operativo, original/ajuste y resourceVersions. La estructura escrita en0233 es el contrato de implementación. P3 no requiere v3 por estos campos.

`publishSaleClosed` se amplía de punteros exclusivamente de producto a referencias de recursos genéricos. En una sentencia MVCC captura punteros de productos y medios más elegibilidad de suscriptores. Configuración de comisión crea una revisión inmutable y actualiza su puntero en la misma transacción; cada pago captura `(providerId,slot:'commission',versionId)` del recurso medio. Ausencia de puntero queda congelada como falta de configuración. Identidad de revisión capturada manda, no una búsqueda posterior por `created_at <= closedAt`: inicio/fecha de una transacción no prueba que su commit fuese visible al cierre.

El publisher no llama handlers ni lee tablas de módulos. POS aporta dinero/pagos previamente validados; core captura referencias y persiste evento, dentro del commit de venta. La configuración puede ganar o perder el punto de visibilidad del cierre; siempre se captura una versión comprometida coherente. Sin bloqueos de órdenes abiertas ni locks de Rentabilidad dentro del cobro. Todo fallo técnico de expansión/cálculo queda en aplicador posterior; una falla de persistencia del propio commit no se finge como venta durable.

Stock/Recetas y lector0230 aceptan ambos envelopes usando los campos comunes; nunca suman comisión a consumo ni pierden procedencia R1. No cambiar payloads v1 ni agregar deliveries retrospectivos. El rollout despliega lectores compatibles, retira writers v1 y después activa publicación v2; no promete que un binario antiguo acepte v2. P1 y R1 comparten writer de estos contratos en serie.

### 4. Aplicación independiente, faltantes y conservación

Rentabilidad procesa cada pago con la revisión capturada y guarda resultado/ack en una sola transacción durable. Fórmula por pago `round(amount×percent/100+originalFixed,minorUnit)`; fijo una vez por medio usado. Conservar resultado exacto original y diferencia de normalización; si el fijo se muestra normalizado conserva también su original/delta y no se usa esa representación para un redondeo intermedio del cálculo. DTOs de configuración exponen fixed, originalFixed y fixedNormalizationAdjustment; resultados por pago exponen commission, originalCommission y normalizationAdjustment, y el total sus originales/diferencia. Múltiples medios representan transacciones distintas; sumar sus comisiones operativas finales, conservando suma original y ajuste. Pagos fraccionarios se normalizan acumuladamente en el orden enviado, persistido con position/paymentId estables, para cerrar el N aprobado; los normalizados0 no generan fijo y quedan auditados. No capar fijo al importe cobrado. Sin tarifas por local, productos o profesional.

Guardar base, moneda/unidad, referencias, parámetros y resultado permite replay idéntico, sin revalorar con tarifas vigentes. IDs de evento/pago y unicidad impiden duplicación; claim, backoff y cron existentes recuperan fallos sin frenar cobro. No depender de que `after()` termine. Un error revierte resultados/ack de ese delivery, no venta ni resultados de otro suscriptor.

Tres situaciones distintas:

- Medio `none` o tasa explícita0: cero conocido; forma con componentes ausentes al cerrar: solo esos componentes usan0, `configured:false` y aviso en Rentabilidad; los cargados sí computan. Porcentaje null con fijo0,20 produce0,20 provisional; fijo null con porcentaje2% conserva ese2%. Sin componentes cargados da0 provisional. `configured:true` exige todos los aplicables presentes, incluido cero explícito. Una tarifa creada después no rellena ese snapshot.
- Cobro positivo con Rentabilidad apagado, sin evento o legado: comisión desconocida/null, sin cálculo retroactivo ni sustitución por0. Pendiente creado cuando estaba encendido conserva su obligación aunque se apague después. El reader preserva pendiente técnico frente a `application_failed`.
- Neto0 explícito de una venta nueva: pagos[] y comisión0 cierta, sin necesitar cálculo de un suscriptor. No contradice el caso anterior de cobro positivo; ausencia de registros por sí sola no prueba neto0.

El reader usa estados completo/incompleto/pendiente, razones e importes null o provisionales según spec. No tiene que consultar POS para reconstruir ventas. Rentabilidad puede leer su historia con IDs opacos y snapshot monetario del evento; sin evidencia devuelve sin dato. POS nunca recibe comisiones ni necesita permiso Rentabilidad para cobrar. Para neto0, evento válido es evidencia principal. Cuando no hay evento, el mismo directorio permite verificar solo un cero explícito de snapshot POS persistido, incluso con POS apagado: lectura puntual `sale_settlement` bajo guard Rentabilidad/pertenencia y en la misma transacción consistente del reader. No se invoca durante cobro, no agrega hook/tabla y no reconstruye desde líneas. Ausencia, legado, fallo o contradicción de evidencia siguen sin dato; un snapshot positivo nunca autoriza calcular retroactivamente la comisión ni sustituirla por0.

Moneda/unidad quedan congeladas con evento/resultados. Fijo configurado no cero de otra moneda vuelve el resultado incompleto `commission_currency_mismatch`; no convertir, aplicar nominal ni fabricar0, y tampoco bloquear venta. Reconfigurar solo afecta cierres posteriores. Porcentaje sin fijo no necesita moneda propia. Fijo explícito0 de otra moneda aporta0 cierto sin invalidar el porcentaje ni marcar incompatibilidad; `configured` sigue determinado por presencia de los componentes aplicables. Agregados separan monedas. La política general de cambio de moneda sigue abierta fuera del encargo, como0230/0231.

### 5. Catálogo y migración

El catálogo EC contiene Efectivo, débito, crédito, Transferencia, DeUna, Payphone y Datalink, con formas del informe; iniciales los seis primeros. Peigo excluido. País sin catálogo usa lista base; no se inventa catálogo por país ni se precargan tasas. Recargo, topes y referencias históricas del informe no se convierten en afirmaciones legales ni configuración.

Migración aditiva de tablas y campos; número SQL posterior. Inicializa medios de comercios con POS activo e inicializa el marcador, sin alterar permisos ni activar Rentabilidad. Cierres previos quedan sin snapshot de pago, nunca inferidos como Efectivo. No reconstituir dinero/cupón/comisión ni modificar snapshots de costo0230, cantidades/R1 o eventos históricos. Nuevas ventas guardan snapshot incluso con flag de eventos apagado; en cobro positivo sin evento la comisión sigue desconocida. Activación funcional completa comprueba flag y contrato desplegados; preservar el flag no autoriza activarlo por inferencia.

Corte verificable de writers/UI antiguos y soporte v1/v2, no espera fija. Rollback conserva datos v2 y binario compatible de lectura/retry; no borrar resultados ni volver a un consumidor exclusivo v1. EXPAND0227 sigue vigente; no ejecutar contract, seed PROD ni migración por inferencia. Cada operación PROD requiere autorización propia.

## Alternativas y consecuencias

- **Calcular en POS o llamar a Rentabilidad al cerrar:** introduce dependencia y puede frenar cobro; descartado. Se captura referencia genérica mínima y calcula después.
- **Leer tarifa actual cuando llega el retry:** altera comisión según demora y ediciones; descartado. Es distinto del instante de costo0230 por decisión de P1.
- **Resolver por fecha de revisión:** no garantiza visibilidad del commit; descartado frente a referencia capturada atómicamente.
- **Tarifas junto a medios POS o catálogo con tasas:** rompe propiedad/permisos elegidos y promete tasas que el comercio debe configurar; descartado.
- **Rentabilidad requiere/importa POS o duplica sus tablas por SQL:** restringe módulo a POS y vulnera ADR0139/0141; se elige directorio registrado de metadata mínima y origen sin FK.
- **Dejar reparto/origen por línea para P3:** descartado porque v2 debe nacer completo y no reinterpretar ventas.0233 calcula/persiste/publica el reparto actual; P3 conserva premios/canjes.
- **Redondear cuotas individualmente y restar a la última:** puede dar descuento negativo; acumulados y bruto restante garantizan las sumas y límites.
- **Evento nuevo independiente para pagos:** duplicaría coordinación de durabilidad/orden de cierre. Se amplía el mismo evento con envelope compatible y readers explícitos.
- **Inferir efectivo/costo0 para histórico o módulos apagados:** falsea datos; no se hace. La excepción neto0 exige snapshot nuevo explícito.

Costo de esta decisión: extensión genérica de recursos/publicación y lifecycle, reader dual de eventos y snapshot POS adicional. Beneficio: cierre independiente, comisión reproducible y propiedad clara de datos/permisos. Contratos HTTP, errores, pruebas y aceptación están en la spec; no se agregan gateways de pago ni un broker nuevo.

## Estado y límites

Decisión implementada con autorización posterior del owner para implementación, QA y merge a main local. Candidato combinado `3450607ae6b9eb4ac0de4ea40be8d117108926c5`, con [QA independiente PASS](../factory/0233-implementation-qa.md) y entregas enlazadas en SPEC0233. Migraciones0091/0092 aplicadas en CI protegida y desarrollo local, sin backfill financiero; [evidencia local](../factory/0233-local-integration.md). Índices/estados comunes intactos; ningún push ni operación PROD.

Las proyecciones POS y tickets toman los importes operativos del snapshot, con ajuste firmado, sin reconstruir bruto a partir de neto normalizado y descuento original. El validator exige HALF_UP de los originales en los totales de orden; líneas mantienen sus cuotas repartidas y ajustes auditables. El provider de cero sin evento valida el snapshot antes de declararlo evidencia. La publicación local conserva su flag previo apagado; no habilita comisiones positivas conocidas sin evento.

Hallazgo del owner: validar precios según moneda en Catálogo/POS eliminaría fracciones COP/CLP; fuera de este encargo. No se presenta como un cambio realizado.

Hallazgos externos a decidir: forma de Peigo antes de incluirlo, tarifas/diferidos reales por comercio, política general de moneda y asignación futura de comisiones para Smart Menu. Ningún precio o afirmación jurídica del informe se presenta como vigente. UI definitiva, propina/servicio, anulaciones cobradas, retenciones y comisión profesional quedan fuera.
