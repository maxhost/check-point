# 0242 CP0 — Inventario de datos y contratos exactos

## Ficha y límites

- Tarea/reserva: `pos-data-0242`; implementador A, sin subdelegación.
- Base: `621951fc98f63e1e57b5166b93dd8ac9a911944d`.
- Worktree: `/private/tmp/checkpass-pos-0242/pos-data-0242`; rama `pos-data-0242`.
- Objetivo actual: reproducir inventario y proponer contrato puro, SQL expand y checks antes de implementar.
- Scope autorizado en esta revisión: solo `docs/factory/0242-cp0-data.md`; recurso `doc:0242-cp0-data`.
- Coordinador: único writer de spec/contrato/estado/índices e integrador; entrega factory a cargo del coordinador.
- No hay implementación, migración generada/aplicada, conexión DB, servidor, benchmark ni prueba de producto en esta entrega. Durante esta revisión el coordinador comunicó la respuesta del owner: «No aplican a productos por peso. Gratis ni 2x1». La actualización central de spec/anexo y su base cerrada están a cargo del coordinador; no se inicia producto antes de recibirlas.

Fuentes leídas: AGENTS, TRABAJO-EN-PARALELO, AGENT-WORKFLOW, VERIFICACION, MODULOS, spec0242 y anexo, ADR0155, plan/mapa/handoff0242 y código pertinente a la base. Inventario estático reproducido el18oct2026; no implica aceptación de producto ni QA de combinación.

## Paths propuestos para contrato puro CP0

Pendientes de reserva y recepción de base funcional cerrada; no se crearon estos archivos:

| Archivo nuevo propuesto | Responsabilidad |
| --- | --- |
| `packages/domain/src/measures.ts` | Barrel público puro. |
| `packages/domain/src/measures/types.ts` | Decimal, MassUnit, MeasureUnit, LineMeasure y versión de conversión. |
| `packages/domain/src/measures/decimal.ts` | Parser decimal canónico y racional BigInt; límites/escala y errores explícitos. |
| `packages/domain/src/measures/mass.ts` | Factores exactos y conversiones; conservar fuente original al presentar aproximaciones. |
| `packages/domain/src/measures/fixtures.ts` | Casos sintéticos compartidos de medidas/tarifas; sin PII ni decisiones sobre beneficio de masa. |
| `apps/merchant/src/modules/pos/contracts.ts` | DTOv2 puro de líneas, orden, resumen y catálogo. Importaciones type-only de financial/measures, sin dependencia server. |
| `apps/merchant/src/modules/pos/measure-contract.test.ts` | Factores, parsers, límites y equivalencias monetarias decisivas. |

`packages/domain/package.json` ya exporta `./*` hacia `./src/*.ts`; el barrel propuesto no exige modificar package.json ni lockfile. El proyecto Vitest de merchant incluye `src/**/*.test.ts` y no declara `test.name`: no usar `--project apps/merchant` suponiendo un nombre inexistente. No hay proyecto de pruebas domain en el config raíz actual.

## Inventario y matriz de consumidores

Paths separados por punto real de cambio; no constituyen una reserva ampliada.

| Área | Paths reales y hallazgo |
| --- | --- |
| Business | `packages/db/src/schema/business.ts`: negocio. **La revisión compartida businessConfiguration se declara en `packages/db/src/schema/sale-commission.ts`**, no en business.ts. `apps/merchant/src/server/business/configuration.ts` usa mutex `business-config/<businessId>` y revisión transaccional; `server/business/http.ts` y `lib/business-contract.ts` son las superficies del recurso nuevo. |
| Producto | `packages/db/src/schema/catalog.ts`: unitPrice/unitCost numeric(12,2), sin modo/unidad/revisión comercial. |
| Writers catálogo | `packages/domain/src/server/catalog/products.ts`: crear/editar y reemplazar productLocations; `apps/merchant/src/server/catalog-import/write.ts`: inserción de productos. Deben tomar mutex business-config antes del lock vigente y validar unidades/revisión. `catalog-import/reconcile.ts` reconcilia jobs; no escribe productos directamente. |
| Reader catálogo | `packages/domain/src/server/catalog/core.ts` serializa precios/costos con Number; `products.ts` selecciona y escribe tarifas. `server/counter/resolve-catalog.ts` y `catalog-visibility.ts` consumen catálogo operativo. V2 necesita strings; legacy debe rechazar productos no representables. |
| POS persistencia | `packages/db/src/schema/modules/pos.ts`: quantity integer, tarifa snapshot numeric(12,2), tableLabel obligatorio, sin saleType/createRequestId. Conservar settlement/locks/mesa y FKs módulo→core. |
| Core orden | `packages/db/src/schema/order.ts`: quantity integer, tarifa snapshot numeric(12,2), lineTotal numeric(12,2). `apps/merchant/src/server/counter/orders.ts` inserta cantidad con cast `::integer`. Mantener órdenes históricas sin duplicarlas como ventas POS. |
| Financial | `packages/domain/src/financial/types.ts`, `rational.ts`, `settlement.ts`, `validate.ts`, barrel `financial.ts`: FinancialInput quantity:number entero seguro; originalMoney admite hasta2dec. Reutilizar reparto/normalización; parser de tarifa9dec separado de pagos/total. |
| POS dominio | `apps/merchant/src/modules/pos/server/lines.ts`, `order-input.ts`, `orders.ts`, `read.ts`, `list.ts`, `settlement.ts`, `close.ts`: entero en parser/merge/total; DTO en read.ts convierte tarifa con Number/toFixed; list descarga líneas para resumen. Se requiere snapshot preciso, idempotencia create, agregado y DTO canónico sin GET postwrite. |
| Cupones/acreditación | `apps/merchant/src/server/counter/grant-input.ts`, `coupon-discount.ts`, `orders.ts`, `grant.ts`: buildDetailed usa Number/toFixed; cupón toma quantity:number y una unidad. Gratis/2x1 no aplican a líneas mass según respuesta owner comunicada por coordinador; porcentaje/importe siguen aplicando. Contrato central pendiente de actualización. |
| Eventos | `apps/merchant/src/server/module-events/types.ts`, `decode.ts`, `publish.ts`, `retry.ts`: tipos V1–V3; publisher exige entero. `append.ts` conserva inserción/delivery durable. Añadir V4 sin mutar ni adivinar payloads históricos; mantener producer desactivado hasta consumers listos. |
| Recetas schema | `packages/db/src/schema/modules/recipes-compositions.ts`: composition_revision/sale_resolution sin base explícita; consumption_source guarda exactQuantity numeric(20,6), recipeQuantity numeric(30,3), allocatedQuantity numeric(14,3). Necesita procedencia racional además de base capturada. |
| Recetas consumo | `apps/merchant/src/modules/recipes/server/consumption-snapshot.ts`, `consumption-event.ts`, `consumption-cost.ts`, `metrics.ts`; `server/model/expand.ts`, `captured.ts`, `publication.ts`, `input.ts`: sold entero, multiplicación BigInt, composición1unit implícita y expansión con escala6 intermedia. Captured debe leer base/versiones congeladas. |
| Stock | `apps/merchant/src/modules/stock/consumption.ts`, `consumption-money.ts`, `server/consumption-cost.ts`: ledger3 y costo pendiente/completo; no crear salida ficticia sin receta/proveedor. |
| Analytics productores | `apps/merchant/src/modules/pos/server/metrics.ts`, `best-sellers.ts`; `apps/merchant/src/modules/recipes/server/metrics.ts`: quantity de venta y unidades con costo hoy homogéneas. Separar piezas/masa y ranking por frecuencia de órdenes. |
| Analytics lectores | `packages/domain/src/analytics/metrics.ts`, `monthly-finance.ts`, `cards/index.ts`, `cards/stock.ts`; `apps/merchant/src/server/analytics/queries/index.ts`: usan units_sold/units_with_cost incluso para cobertura/márgenes mensuales. Cambiar productor solamente no basta. |
| Comisiones | `apps/merchant/src/server/business/commission-read.ts` decodifica eventos; `recipes/server/consumption-event.ts` incluye commissionMinor solo cuando eventVersion===3. Ambos deben admitir V4. |
| Permisos CP3 | `packages/db/src/permissions-catalog.ts`; `apps/merchant/src/modules/permissions.ts`; `server/staff-permissions.ts`, `staff-module-permissions.ts`, `staff-create.ts`, `staff-landing.ts`, `api-permission.ts`; `app/backoffice/staff/staff-contract.ts`. Conservar counter para Clientes, añadir pos solo a staff elegible con POS ya activo. |

Consumers UI/ticket/contexto serán inventariados por B; DTO puro se integra antes de modificar dos consumidores. La matriz anterior identifica consumidores monetarios y de medidas, no certifica que las rutas/clientes estén adoptados.

## Decisiones técnicas propuestas al coordinador

### Procedencia racional aditiva

Ejemplo decisivo: receta de1lb, captura1g. El multiplicador de consumo es100000/45359237; su expansión decimal no termina. `numeric(20,6)` no puede guardar la cantidad exacta requerida aunque se amplíe su escala. Redondear esa columna antes de consolidar insumos incumpliría el contrato.

Propuesta: racional normalizado con numerador entero string y denominador entero string positivo; operaciones BigInt y reducción por gcd. Capturar basisQuantity/basisUnit en la revisión de composición y su resolución de venta. Añadir procedencia exacta n/d a consumption_source (y al payload durable que la transporta), conservando columnas legacy como proyecciones explícitamente redondeadas para readers compatibles. Para filas viejas puede reconstruirse el racional de su decimal6 almacenado, sin afirmar recuperación de precisión histórica no existente. Para filas nuevas el racional es fuente autoritativa. Esquema/decoder deben impedir proyecciones sin fuente válida para la versión nueva.

Consolidar racional por orden/línea/insumo según ADR0148, asignar ledger3 al final con orden estable y conservar allocatedQuantity/procedencia por componente. Consumo positivo redondeado a cero conserva estado/procedencia sin movimiento ni costo completo ficticio. No usar ExactAmount financiero como medida física: su scale2 representa centavos, no gramos.

El contrato coordinado debe fijar nombres/shape de estos campos y estrategia de backfill antes de CP1; esto es propuesta técnica, no autorización de migración.

### Precisión derivada y DTO

- Una captura lb con9dec puede producir gramos con14dec. El límite9dec del parser de captura no debe aplicarse a la suma física derivada. Propuesta: totales en gramos como decimal exacto de escala derivada hasta14 para entradas válidas; conversiones a bases no terminantes permanecen racionales. Revisar capacidad del almacén analytics antes de fijar implementación.
- El anexo habla de líneasV2; producto actual usa `items`. Propuesta: `PosOrderV2.items: PosLineV2[]`, un único campo canónico, sin duplicar arrays `lines/items` accidentalmente. Coordinador congela el nombre.
- El hook genérico de cambio de medida necesita firma ejecutable/registro e inyección antes de consumers: businessId, resourceType, resourceId, oldMeasure, newMeasure y tx. Catálogo/core no deben importar Recetas. Cambiar solo unidad tarifaria de masa conserva base de composición.
- El máximo de cantidad/tarifa del anexo se valida explícitamente: numeric(24,9) por sí solo admitiría más dígitos enteros. El límite monetario vigente debe verificarse antes de DB y después de normalización; no ampliar total/pagos por ampliar tarifa.

## Propuesta expand; no ejecutada

1. Añadir configuración sales_mass_units default kg, checks de lista no vacía, sin duplicados y unidades admitidas. Reutilizar revisión/mutex existentes; snapshots históricos no bloquean retirar unidad.
2. Añadir producto sold_by_weight=false, pricing_unit=unit, sales_revision=1 y constraints de coherencia/revisión/límites; ampliar unit_price/unit_cost a numeric(24,9), conservar null y0 distintos.
3. Añadir POS sale_type/order_label, create_request_id nullable para históricos y fingerprint canónico; unique business+createRequestId. Backfill table solo con dining_table_id real; restantes legacy. Conservar tableLabel alias/transición.
4. Ampliar quantity y tarifas snapshot de ambas tablas de líneas a numeric(24,9), añadir metadatos de medida unit/unit/mass-si-1 por defecto histórico y constraints de cantidad positiva/integralidad condicional. Conservar importes monetarios/límites existentes y snapshots financieros.
5. Añadir base de composición y procedencia racional según contrato que congele coordinador. No cambiar payloads/eventos históricos ni publicar V4 por esta expansión.
6. Generar SQL/journal/snapshot serialmente con writer único al asignarse migración. En esta base el journal termina en0101; no reservar ni asumir número siguiente desde este informe. Nada destructivo/downcast.

La compatibilidad expand de aplicación exige adaptar writers/readers enteros antes de habilitar masa. La ampliación de tipo SQL puede cambiar el tipo recibido por Drizzle a string; tratarlo como cambio de contrato, no como migración transparente para binarios viejos.

## Trabajo independiente de gratis/2x1 y aceptación futura

Preparación técnica posible tras cierre y reserva: parsers/factores/racionales, DTO base, fixtures sin beneficio masa, equivalencias exactas, errores, matriz SQL/consumers y recipe M0 con B. No hace falta inventar valor de cupón para ninguna de esas piezas. Esta entrega documental respeta el requisito de spec cerrada: no inicia producto antes de recibir la base con la decisión owner incorporada. Gratis/2x1 se excluyen de líneas mass; en mixtas pueden aplicarse a una línea unit elegible, sin excluir la orden entera.

Casos decisivos futuros:1lb=453,59237g;4/lb×2lb=8;0,01/g×250g=2,50; kg/lb/g equivalentes; unit entero; tarifa0 frente a null; coma solo presentación; rechazar exponentes/NaN/infinito/overflow/escala/límites; cambio de selector preserva fuente; aproximación no reenviada como captura; normalización monedas0/2; racional de receta1lb vendido1g y consumo positivo que acaba en ledger0.000. Tras recibir contrato central cerrado, añadir negativos gratis/2x1 sobre mass, positivos unit en orden mixta y porcentaje/importe con mass.

## Checks y evidencia de esta entrega

Node observado en WT: v24.20.0, tras `source ~/.nvm/nvm.sh && nvm use`. Checkout estaba limpio antes de crear este documento. No se ejecutaron tests de producto ni consultas DB.

Se verificó descubrimiento de pruebas, **sin ejecutarlas**:

- Desde raíz, `pnpm exec vitest list --config apps/merchant/vitest.config.ts apps/merchant/src/server/financial.test.ts --json` retornó `[]`: include relativo a cwd no descubre esa suite.
- Desde `apps/merchant`, `pnpm exec vitest list --config vitest.config.ts src/server/financial.test.ts --json` descubrió10casos reales. Config no tiene nombre de proyecto; comando focal futuro: desde ese cwd `pnpm exec vitest run --config vitest.config.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts`.

Checks futuros de contrato implementado: `pnpm --filter @mi-pasaporte/domain typecheck`; `pnpm --filter @mi-pasaporte/merchant typecheck`; ESLint/Prettier focal; `node tools/check-numbers.ts`; fronteras de módulos si se cambia contrato/core. Tests DB posteriores solo `tools/neon-test.sh`, entorno protegido y reserva incluyendo teardown; DDL focal sin paralelismo. No se exige DB para el contrato puro de CP0.

Para este cambio documental corresponden diff/check de whitespace y números. La evidencia de esos checks se entrega con el SHA; no se afirma PASS monetario/tenant/eventos ni rendimiento.

## Revisión de implementación CP0 pura

La ficha/inventario anterior corresponde a la preparación inicial. Tras decisión owner y QA focal documental, coordinador asignó base cerrada `89dc1707` y amplió reserva a `packages/domain/src/measures.ts`, `packages/domain/src/measures/`, `packages/domain/src/resource-measurement.ts`, `apps/merchant/src/modules/pos/contracts.ts`, `apps/merchant/src/modules/pos/measure-contract.test.ts` y este documento. La firma genérica de resource-measurement se tomó del anexo actualizado por coordinador; no se editó contrato central ni registro de rutas.

Implementado dentro de esa reserva:

- Tipos discriminados unit/mass, parser string canónico9dec con validación previa a quitar ceros, factores exactos y racionales BigInt mediante financial/rational existente. Null y precio0 siguen distintos. Límites de tarifa/cantidad no se confunden con numeric(24,9).
- Captura inmutable fuente y vista derivada, señal approximate al mostrar un redondeo (incluido positivo diminuto mostrado como0), sin reenviar la vista como medición nueva. Gramos derivados mantienen14dec; totales físicos agrupan unit/g por separado.
- Gross original en centavos racionales y aggregate antes de redondear; helpers verifican numeric(12,2) antes de normalizar y después de normalizar moneda0/2. No se modificó settlement ni su reparto; el nuevo tipo FinancialInputV2 queda preparado para adopción CP1.
- DTOv2 puros de orden/items/resumen/catálogo/configuración/QR/cupón/create/update/close y comando congelado por copia profunda. UUID/version/cuerpo/target y scope conservan su intención aunque el borrador cambie. No acepta cantidad bonificada editable.
- Selección pura gratis/2x1: mass explícita rechazada sin fallback; implícita primera unit estable del producto; producto ausente conserva error y2x1 exige2piezas. No modifica cupón global ni implementa descuentos porcentaje/importe duplicados. Helper de combinación exige snapshot comercial coincidente y conserva identidades de settled/orphans.
- Firma ResourceMeasurementValidator genérica en Tx, sin DB ni imports de módulos; no ensamblado ni ejecución sobre catálogo. Fixtures sintéticas compartidas no siembran DB.

Verificación de fuentes implementadas: Node v24.20.0, pnpm11.4.0/lockfile heredado sin cambios; WT/base anteriores, sin variables DB ni servidores. Vitest4.0.18 desde merchant: `pnpm exec vitest run --config vitest.config.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts` terminó EXIT0 con47/47 (37nuevos y10financial existentes),2/2archivos, sin skips/retries. Corridas intermedias47/47 y48/48 tambiénEXIT0; se sustituyó una prueba trivial de callback local por la prueba de snapshot comercial, no hubo fallos ocultos ni cambio de prueba por fallo. `pnpm --filter @mi-pasaporte/domain typecheck` y merchant typecheck pasaron en la primera revisión; también pasaron tras el último helper. ESLint focalEXIT0; Prettier focal checkEXIT0. `node tools/check-numbers.ts` EXIT0 con warning MODULE_TYPELESS_PACKAGE_JSON preexistente; sin cambios a tooling/package.json para ocultarlo.

Límites: no rutas activadas, productorV4, migración, wiring UI, DB, cupón consumido, replay, consumo/stock ni M0/M1. Esta suite prueba contrato puro y regresión financial existente; no certifica aplicación completa. Próximo checkpoint debe adoptar las funciones y demostrar negativos reales/transactions. El coordinador confirmó además que analytics usa `quantity:number` en domain/types.ts y lectores monthly-finance convierten mediante Number: antes de masaV4 deben reservar métricas de masa separadas y lectores string exactos; nombres/contrato serán congelados paraCP1. No se amplió código CP0 a esos consumidores.

### Corrección solicitada por QA independiente

QA sobre `05c9b9b7` detectó una selección implícita2x1 incorrecta: primera líneaunit de cantidad1 bloqueaba otra posterior de cantidad2 del mismo producto. El resultado esperado es primeraunit elegible por cantidad; una selección explícita de cantidad1 debe seguir rechazándose sin cambiar línea. Se añadieron regresiones con y sin línea mass previa, más todasunit de cantidad1. La corrida previa al arreglo reprodujo2fallos/40casos (EXIT1), esperado target new-unit, observado coupon_quantity. El arreglo filtra elegibilidad antes de seleccionar implícitamente, conserva coupon_quantity cuando hayunit pero ninguna cantidad suficiente y measure_not_supported cuando solo haymass. Nueva corrida focal `src/modules/pos/measure-contract.test.ts`:40/40PASS, EXIT0, sin skips/retries. ESLint focalEXIT0. Typecheck merchant terminóEXIT0; no se repiten financial/domain porque sus fuentes y contratos no cambiaron. Un intento previo de preparar el test usó cwd erróneo y falló FileNotFoundError; la corrida37/37 inmediatamente posterior no incluía regresión y no se usa como evidencia de corrección. No DB ni ampliación de scope.
