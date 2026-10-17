---
spec: 0235
fecha: 2026-10-16
estado: implementada
resumen: Negocio reúne medios y comisiones, configuración regional y datos fiscales en core; el POS conserva su selector y congela la comisión al cerrar.
disjunta: no; comparte cierre POS, eventos, permisos, onboarding y esquema con las piezas financieras; Gastos va después
archivos: core de pagos y Negocio; POS; comisiones de profitability; Marca y onboarding; esquema y migración preparada; ADR0150
---

# 0235 — Negocio y medios de pago en core

Spec CHICA; ADR0144, nivel L2 por dinero, aislamiento y futura migración PROD. Diseño cerrado con respuestas previas del owner; **implementación local verificada**, autorizada después del encargo documental original. [QA y candidatos combinados](../factory/0235-qa.md), [entrega core y rollout](../factory/0235-core.md), [entrega UI](../factory/0235-ui.md). Sin push, deploy ni migración PROD; el retiro físico de los adaptadores de transición y recuperación sigue condicionado al corte/drenaje operativo. Conserva el congelado del [ADR0149](../adr/0149-pagos-y-comisiones-congelados-al-cierre.md) y los contratos financieros de [0233](0233-medios-de-pago-y-comisiones.md), sustituyendo su propiedad modular y aplicación posterior para los cierres nuevos.

## Problema

Los medios del comercio viven en `pos.payment_method` y nacen al encender POS; la configuración y el resultado de comisión pertenecen a `profitability`. Eso impide que un comercio sin POS gestione sus medios como configuración propia. Marca mezcla identidad con Regional y Fiscal bajo el permiso `brand`. «Configuración» es otro espacio: owner, módulos y sus paneles; se conserva.

Verificación documental y de código sobre `971772c2e78b3a5e0625270d74cd74717aa42968`: catálogo en `core.payment_method_catalog`; `pos.payment_method_initialization`, `onEnable: initializePaymentMethods`, rutas de `payment-routes.ts` y provider `payment_method`; `pos.order_payment` con FK comercio/medio y proveedor `pos`; revisiones y resultados en `profitability`; UI POS carga medios en `pos-payment-actions.ts`. Marca contiene ambos formularios, pasos de zona/moneda en su tour y acceso desde el checklist. No se consultó PROD en este encargo.

### Respuestas del owner antes de redactar

Se citan literalmente las respuestas recibidas para esta spec:

1. «Sí: medios al crear el comercio; los actuales conservan todos sus medios e ids.»
2. «Sí: permiso `business`, ruta `/backoffice/business`. Owner siempre; staff solo con el permiso; sin otorgarlo por `brand`.»
3. «Sí, comisión dentro de la transacción de cierre, con una condición: ninguna condición de negocio (medio sin configurar, moneda distinta del fijo, etc.) puede revertir ni bloquear el cierre; se guarda marcada y la venta cierra. Solo una falla técnica de la base revierte, como ya pasaría sin comisión. Dejalo escrito con su test.»
4. «Sí: 0 provisional con “Sin configurar” (coincide con mi decisión de P1). Ese estado tiene que viajar hasta Analíticas y Smart Menu como aviso, no como margen real.»

También quedan cerradas las decisiones del encargo: Negocio es core y no se apaga; menú sin agrupar; comisión dentro de cada medio y por comercio; Marca conserva nombre, logo y colores; Regional y Fiscal se mudan y desaparecen de Marca. `profitability` se renombrará a `expenses` en el encargo posterior de Gastos, en serie.

## Alcance y diseño

### Negocio, permisos y formularios

`/backoffice/business` es una pantalla core con tres secciones: **Medios de pago**, **Configuración regional** y **Datos fiscales**. Un ítem «Negocio» en el menú, sin nuevo agrupamiento. Owner entra siempre; staff necesita `business`, tanto en página como en API. Se agrega `business` al catálogo core, selector de Equipo y capacidades de sesión. Ninguna fila de membresía recibe backfill, tampoco quienes tienen `brand`; la fila owner conserva permisos vacíos y su acceso deriva del rol.

Regional conserva zona IANA y moneda; Fiscal conserva `chargesVat`, `saleVatRate` y `recoversPurchaseVat`, validaciones y efectos actuales, sin cambiar cobros ni convertir importes. Sus datos siguen en `core.business`; no se copian ni se reinician. Sus GET/PUT pasan al guard `business`. La API de Marca deja de exponerlos y rechaza intentos de modificarlos con `brand`; no basta ocultar inputs. Marca mantiene identidad, logo, paleta, vista previa y afiche con sus permisos actuales. Escrituras de branding y negocio actualizan solo sus columnas, con revisión optimista propia para impedir que un borrador de una pantalla pise cambios de la otra.

Medios muestra lista activa/archivada, alta desde catálogo aplicable al país o medio libre, archivo y comisión en cada entrada. Catálogo solo lectura, sin tasas sugeridas; país sin catálogo usa la base existente. Formas `none | percent | fixed | percent_and_fixed`; solo aparecen los componentes aplicables. Se conserva la forma inmutable por ID, nombre de 1–120 caracteres, unicidad activa y Efectivo estable, único y no archivable. Archivar preserva historia y revisiones. Un cambio de país no repone ni reemplaza medios; la inicialización ocurre una sola vez al crear el comercio, en su transacción, y nunca en un GET ni al encender POS.

### Datos, cierre y estados monetarios

Destino: `core.payment_method`, `core.payment_method_initialization`, `core.commission_revision` y `core.payment_commission`; catálogo ya core. Las tablas migran con sus IDs, timestamps, restricciones, funciones/triggers y datos; `pos.order_payment` sigue en POS y su FK apunta al medio core. Se agrega `core.sale_commission`, evidencia mínima e inmutable por cierre, no otro sistema de ventas: único `(business_id,source_provider_id,source_order_id)`, local, cobrado, moneda/unidad, estado/razones y total/original/ajuste de comisión. Se inserta en la misma transacción incluso con pagos[] y flag OFF; neto0 deja evidencia explícita con total0 completo, sin pago ficticio. Reader nuevo usa esta cabecera y sus resultados por pago; cabecera ausente jamás prueba cero. Sin backfill de cabeceras para historia. No hay FK/import core→POS ni core→otro módulo. Origen de venta/pago es una referencia opaca con proveedor; comisión no exige `profitability` ni publicación de eventos encendidas.

Un servicio core recibe dentro de la transacción de cierre comercio, origen/proveedor, orden, local, moneda/unidad y pagos normalizados validados por el productor. Captura **una sola vez** las revisiones vigentes comprometidas, con el mismo punto MVCC de las referencias de recursos del cierre; persiste identidad de revisión o ausencia explícita, parámetros, base, porcentaje, originales, ajustes y resultado. El publisher reutiliza esa captura, no vuelve a buscar una tarifa. Captura/persistencia de comisión ocurren incluso si `MODULE_EVENTS_ENABLED` está apagado. POS llama core, conserva su selector al cobrar y cambia su fuente de lectura; no muestra tarifas ni requiere `business` para usar un medio activo.

Se mantiene: base cobrada tras descuento, pagos mixtos distintos, fijo una vez por medio positivo, fórmula exacta `amount × percent / 100 + originalFixed`, HALF_UP final a unidad mínima y originales/deltas auditables. USD9 al2,5% + fijo0,10 produce0,325 original y0,33 operativo; no capar fijo al cobrado. Neto0 conserva pagos[] y comisión0 cierta. La UI mixta nueva sigue fuera de alcance; el contrato ya admite la lista. «Recibido» y cambio no son base de comisión.

Toda edición crea revisión inmutable y actualiza su puntero en la misma transacción; `expectedRevisionId` evita pisar ediciones. Una venta nueva conserva su revisión y resultado para siempre. Ediciones, cambios monetarios y reintentos no rellenan ausencias ni recalculan cierres anteriores. Histórico sin evidencia sigue sin dato; no se generan comisiones para ventas pasadas.

| Situación de comisión al cerrar                            | Resultado durable y presentación                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `none` o componentes aplicables explícitamente0            | Cero conocido; `configured:true`, sin aviso de ausencia.                                                                                                                                                                                         |
| Componente aplicable ausente                               | Solo ese componente usa0; se calcula lo conocido. `configured:false`, `commission_unconfigured`, «Sin configurar», importe **provisional**. Sin ningún componente:0 provisional, nunca margen real.                                              |
| Fijo original no cero de otra moneda                       | Venta cierra; `commission:null`, `commission_currency_mismatch`, estado incompleto. Sin conversión ni cero inventado; `configured` conserva la presencia real de componentes y puede ser true. Fijo explícito0 no invalida un porcentaje válido. |
| Otra configuración no aplicable o referencia inconsistente | Venta cierra con resultado incompleto/null y razón explícita, evidencia de la referencia capturada y sin tarifa sustitutiva. No se oculta como0 ni se toma una revisión posterior.                                                               |
| Histórico positivo sin snapshot/evento aplicable           | «Sin dato», null; sin backfill ni cálculo retroactivo.                                                                                                                                                                                           |

**Ninguna condición de negocio de la comisión bloquea o revierte el cierre.** La función de cálculo devuelve resultados marcados para esos casos; no usa excepciones para rechazarlos. Una falla técnica de DB al leer/persistir/confirmar revierte toda la transacción, como cualquier fallo DB del cierre. Se conservan las validaciones POS existentes de medios propios/activos, suma de pagos e idempotencia: esta regla no acepta un pago inválido.

Snapshot y lectura core conservan `state`, `configured`, `reasons`, importe nullable/provisional, moneda/unidad, revisión y originales/ajustes. Cualquier ausencia, incompatibilidad o pendiente impide presentar el total como costo de comisión completo o margen definitivo. Analíticas y Smart Menu recibirán esa calidad de dato; **sus pantallas, proyecciones y cálculos no se implementan acá**. Que una tarifa se edite después no quita el aviso del cierre previo.

### Contratos HTTP

Sesión/pertenencia y comercio derivados del guard; nunca del body. DTOs sin secretos ni datos de otros comercios; errores `{error,code}`. UUID ajeno o inexistente404; sin sesión401 y permiso insuficiente403. Catálogo y medios usados al cobrar son metadata pública operativa, sin tasas.

| Ruta                                                                                 | Acceso y contrato                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/business/payment-methods?status=active\|all`                               | `business`; `{methods:[{id,name,chargeShape,isCash,status,commission}],defaultMethodId}`. `commission` conserva DTO0233: revisión, porcentaje, fijo original/normalizado/ajuste, moneda/unidad y configured.                                                                                                                                                  |
| `GET /api/business/payment-method-catalog`                                           | `business`; `{countryCode,source:'country'\|'base',entries:[{id,name,chargeShape,isCash,initiallySuggested}]}`. No siembra.                                                                                                                                                                                                                                   |
| `POST /api/business/payment-methods`                                                 | `business`; `{catalogId}` o `{name,chargeShape}`; `201 {method}`. No precarga tasas; duplicado409.                                                                                                                                                                                                                                                            |
| `POST /api/business/payment-methods/:id/archive`                                     | `business`; `200 {method}`, idempotente; Efectivo409 `cash_required`.                                                                                                                                                                                                                                                                                         |
| `PUT /api/business/payment-methods/:id/commission`                                   | `business`; `{expectedRevisionId:null\|uuid,expectedCurrencyCode?:string,percent?:string\|null,fixed?:string\|null}`. Reemplaza componentes aplicables, crea revisión; `200 {commission}`. Conflicto409 `commission_revision_conflict`; configuración inválida422 `invalid_commission` en **esta edición**, sin afectar cobros. Límites/precisión0233.        |
| `GET, PUT /api/business/regional`                                                    | `business`; GET `{timezone,currencyCode,revision}`; PUT esos campos con revisión esperada. Validación actual422; conflicto409.                                                                                                                                                                                                                                |
| `GET, PUT /api/business/fiscal`                                                      | `business`; GET `{chargesVat,saleVatRate,recoversPurchaseVat,revision}`; PUT esos campos con revisión esperada. Misma validación fiscal actual; conflicto409.                                                                                                                                                                                                 |
| `GET /api/modules/pos/payment-methods`                                               | Se **conserva** como consumidor mínimo con permiso `pos`: `{methods:[{id,name,chargeShape,isCash,status}],defaultMethodId}`, activos, fuente core, sin comisión ni administración. POS apagado conserva su guard modular.                                                                                                                                     |
| `GET /api/business/sale-commissions/:sourceProviderId/:sourceOrderId?locationId=:id` | `business`; local propio obligatorio, DTO0233 de lectura con `state,currencyCode,minorUnit,total,originalTotal,totalNormalizationAdjustment,payments,reasons`; pagos con `configured` y razones. Origen/local ajeno404; ausencia devuelve sin dato. Consumidores internos futuros usan el servicio core bajo su propio guard, no heredan permiso de pantalla. |

Precisión técnica de integridad durante implementación: si `fixed` no es null, `expectedCurrencyCode` es obligatorio y representa la moneda que editó el usuario. El servidor compara esa expectativa con la moneda actual bajo el mismo lock de Configuración regional, antes de crear la revisión. Un cambio concurrente devuelve409 `commission_currency_conflict`, sin guardar importe ni revisión; UI conserva el borrador y exige refresco/acción explícita, sin reinterpretar nominalmente un fijo en otra moneda. No cambia la política general de monedas ni bloquea el cierre de ventas.

POST cierre POS conserva cuerpo/respuesta0233, selector, Efectivo predeterminado, pagos[] con neto0 y retry con la misma clave/pagos. No agrega información de tarifas al DTO POS. Fuente core valida pertenencia/estado y conserva snapshots de nombre/forma. Los detalles de transición, provider y retiro de endpoints están en ADR0150.

### Retiro, tour y checklist

Del POS salen propiedad/seed de medios, `onEnable` de inicialización y provider `payment_method`; catálogo y administración dejan `payment-routes.ts` (GET catálogo, POST medios, POST archivo). Se conserva GET mínimo para el selector y provider `sale_settlement` solo mientras lo necesite la lectura histórica. `payment-methods.ts`/`payment-catalog.ts` se trasladan o eliminan; el adaptador final POS consume core, sin duplicar reglas ni tablas.

De `profitability` salen `server/commissions/{config,apply,read}.ts`, `commission-arithmetic.ts` y las tres rutas `commissions`, `commissions/:methodId`, `sale-commissions/:sourceOrderId`; sus tablas/esquema se trasladan. Sale la suscripción para ventas nuevas; únicamente la recuperación de deliveries históricos se mueve a core hasta terminar pendientes. Se quitan textos de comisión del manifiesto donde corresponda; costos fijos, sueldos y renombre a `expenses` quedan para Gastos.

De Marca salen `regional-fields.tsx`, `fiscal-fields.tsx`, sus imports/estado/payloads/validadores particulares, secciones y anchors regionales. Se trasladan formularios/validaciones a Negocio, sin perderlos ni reutilizar un DTO Brand que filtre Fiscal. Del tour salen el paso `regional`, tareas `change-timezone`/`change-currency`, fases/copys/anchors relacionados y la promesa de guardar datos de negocio con «Guardar marca». Se conserva orientación de nombre/logo/colores/guardar/ayuda; el progreso `brand` existente no se reinicia.

Checklist conserva su ítem y destino `brand` para branding; copy y navegación ya no prometen Regional/Fiscal. Se actualizan `server/onboarding/`, mapa de enlaces y tests que fijaban cinco pasos. Negocio presenta las tres secciones sin añadir otro requisito de alta ni un nuevo tour persistido en esta pieza. Se eliminan enlaces, handlers y redirects obsoletos al retirar compatibilidad; no redirects a rutas borradas. Settings no se modifica.

## Archivos y paralelismo

Ámbitos de implementación: `packages/db/src/schema/payment-methods.ts`, esquema core de comisiones, exports y migración/journal; `permissions-catalog.ts` y guardias/sesión/Equipo; `apps/merchant/src/server/` para medios/comisiones y alta; `app/api/business/`, `app/backoffice/business/`, navegación; contratos de captura/publicación; módulos POS/profitability; Marca y onboarding; helper financiero core. No importar módulos desde core ni modificar el kit/guardias para evadir límites UI.

Se implementó con writer único de esquema/captura/aritmética y contrato HTTP común; UI y backend en worktrees propios, con QA independiente y combinación posterior. DB CI y teardown exclusivos; migraciones aisladas. Gastos va después de integrar esta pieza; Analíticas tiene ADR propio. El [contrato de implementación](../factory/0235-implementation-contract.md) registra paths y recursos, sin reservas implícitas de PROD.

## Definition of Done

- [x] Negocio core con tres secciones, acceso owner y delegación business, sin backfill ni acceso fiscal/regional por brand.
- [x] Medios core inicializados al alta; selector POS conservado y funcional, catálogo/archivo/Efectivo invariantes.
- [x] Revisión y resultado congelados en cierre; condiciones de negocio de comisión permiten commit marcado; fallo técnico DB revierte atómicamente.
- [x] Migración verificada en CI con los22 medios y2 pagos del baseline **y crecimiento posterior**, IDs/snapshots/referencias; transición y pendientes probados sin POS sin medios. Conservación también comprobada al migrar la base local; ejecución PROD pendiente.
- [x] Provisional/incompleto/sin dato diferenciados y transportables hasta futuros consumidores; nunca margen definitivo con aviso.
- [ ] Retiro físico completo de adaptadores de ubicación/onEnable y aplicador histórico: requiere certificar corte/drenaje PROD. El candidato final ya retira las seis rutas administrativas y su helper temporal; Marca/tour/checklist coherentes, sin destinos rotos y Settings intacto.
- [x] QA focal de entrega y combinación sobre SHA/entorno identificados; operaciones PROD solo con autorización posterior propia.

## Pruebas pertinentes

**Pruebas de implementación ejecutadas y detalladas en los handoffs/QA enlazados arriba.** Se reutilizaron casos0233 y se cubrieron los riesgos siguientes; sin suites enteras ni mutaciones por ceremonia. Node24, estáticos de ámbitos afectados y selección focal; DB únicamente `tools/neon-test.sh`, CI protegida reservada, DDL sin concurrencia y `--no-file-parallelism`.

1. Migración CI con4 comercios,22 medios,4 marcadores y al menos2 pagos enlazados, más un pago nuevo durante transición: IDs/valores y FK sin huérfanos idénticos, `pos` histórico conservado, nuevos `core`; capturas/pagos legados recuperan el mismo snapshot. Añadir revisiones, resultados y delivery pendiente aunque PROD baseline tenga0; revisión vieja sigue aplicando después de corte y no duplica. UPDATE/DELETE posteriores siguen rechazados por triggers core; identidad del medio no se puede alterar y sus funciones no dependen de esquemas de módulo.
2. Binario puente antes/después del cambio de esquema y binario final: selector siempre obtiene medios; vieja sesión UI de cobro conserva GET/cierre; creación de comercio con POS apagado siembra una vez. Retry de alta/migración/encendido no duplica ni repone archivados. Retiro final sin rutas/redirects colgantes.
3. Cierre POS positivo con medio core, descuento y mixtos: pagos/base/snapshot/resultados/cabecera atómicos; Efectivo por defecto, neto0 pagos[], selector no desaparece para positivo; staff solo `pos` cobra sin permiso business ni tasas visibles. Neto0 con flag OFF persiste cabecera core y reader devuelve0 completo sin evento/pago ficticio; cabecera ausente devuelve sin dato, identidad/local ajeno404. Retry conserva una sola cabecera y no inserta pagos0.
4. Cerrar con revisiónA, editar aB y reintentar misma venta: conserva ID/porcentaje/resultadoA; otro cierre tomaB. Config ausente al cerrar queda ausente aunque se complete después. Carrera edición/cierre captura una única versión comprometida y publisher reutiliza esa referencia; flag OFF no desactiva comisión core.
5. **Casos de negocio no bloquean:** sin componentes => commit venta+0 provisional/aviso; parcial => usa componente conocido; fijo moneda distinta => commit venta+null/razón, sin conversión; referencia inconsistente => commit marcado sin tasa inventada. Comprobar fila cerrada y acreditación, no solo retorno de helper. Reader preserva estados/razones; ninguna proyección puede declarar margen real con ellos. Inyectar fallo DB al guardar comisión/COMMIT: rollback de venta, pagos, acreditación y comisión; retry idempotente sin duplicados.
6. Aislamiento entre dos comercios: listar/configurar/archivar/cerrar/leer comisión con IDs/locales cruzados falla sin filtración ni escritura cruzada; FK compuesta protege medio/pago. Archivo Efectivo rechaza; otro medio archivado conserva historia.
7. Owner con permisos[] entra y edita Negocio; staff business sí, brand solo no accede ni a API fiscal/regional ni puede escribir esos campos por `/api/brand`; pos solo accede a metadata operativa. CHECK DB admite business con forma válida y sigue rechazando formas inválidas/null; catálogo app rechaza permisos desconocidos. Sin backfill de membresías.
8. Recorrido UI focal de las tres secciones, campos por forma de cobro, Marca completa sin Regional/Fiscal, tour sin anchors huérfanos y checklist apuntando a branding. Ediciones concurrentes Marca/Negocio no pisan columnas. No cambiar el comportamiento fiscal/monetario ni la navegación Settings.

## Handoff y abierto

Entrega documental cerrada; el checklist de implementación queda pendiente. Presupuesto de revisión de estos documentos:0 mutaciones, sin DB ni suites; formato, números, diff y correspondencia de citas/paths. SHA/checks de entrega se informan en el handoff al coordinador, sin marcar implementación.

Hallazgos técnicos separados de decisiones del owner:

- El CHECK `business_membership_permissions_check` ya valida forma genérica (0078/ADR0139), no una lista de permisos. `business` cumple. Darlo de alta en catálogo y verificar el CHECK vigente satisface su admisión; no volver a una whitelist ni generar un ALTER innecesario. Si el esquema PROD real difiere, se reconcilia explícitamente antes del corte.
- Los conteos22/2 son el baseline del encargo; la operación paralela de publicación ya reportó3 pagos. No son cotas ni una nueva medición de esta tarea: el preflight de implementación cuenta y conserva **todo** lo existente al corte.
- Política general de cambio de moneda, forma de Peigo y validación de precios por moneda siguen como hallazgos previos a decidir aparte; no se atribuyen al owner decisiones nuevas.

Fuera: implementación de Gastos/renombre, Analíticas/Smart Menu, generalizar eventos, propinas, anulaciones, diferidos, comisión por local/profesional, UI nueva de pagos mixtos y procesamiento real de pagos.
