---
spec: 0228
fecha: 2026-10-14
estado: implementada
resumen: Costo promedio ponderado móvil de cada insumo en cada local, actualizado al registrar compras con decimales exactos y sin impedirlas por consumos pendientes.
disjunta: no; comparte escritura, locks y esquema Stock con etapa 0 y el futuro consumidor del costo
archivos: packages/db/src/schema/modules/stock.ts, packages/db/drizzle/**, apps/merchant/src/modules/stock/**
---

# 0228 — Pieza 1.1: costo promedio ponderado por insumo y local

Piso **L2: dinero**. ADR0144, ADR0146 y `docs/VERIFICACION.md`. **Entrega documental solamente:** no autoriza código, migraciones, merge, push ni operaciones PROD. Usa la etapa 0 implementada en spec0227; no vuelve a repartir stock ni generar consumos históricos.

## Problema

La etapa 0 guarda `last_unit_cost` en `stock.item_location`. `stock/movements.ts:148-224` selecciona la última compra con precio por `occurred_at, created_at, id`; compras sueltas y entradas comparten ese writer. El saldo por local es la suma del ledger (`stock/items.ts:114-130`), que ya incluye los consumos aplicados. `recipes/cost.ts` usa enteros escalados y recibe un costo por unidad; su lectura de costo del producto no se cambia en esta pieza.

El costo de cálculo del insumo debe pasar al promedio ponderado móvil por **comercio + insumo + local**. Es la base para mostrar después cuánto cuesta producir un producto; mostrar o conectar ese nuevo costo del producto queda fuera.

## Preguntas y respuestas del owner

Se preguntó y se esperaron las respuestas antes de redactar. Fórmula y ámbito local ya estaban decididos; no se reabrieron. La columna de recomendaciones registra lo propuesto, no decisiones adicionales del owner.

| Pregunta / recomendación presentada                                                                                                 | Respuesta del owner                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. ¿Orden de registro y `occurred_at` informativo, sin recalcular hacia atrás? Recomendado: sí.                                     | Acepta orden de registro; fecha informativa, sin recálculo retroactivo.                                                                                                                                                             |
| 2. ¿Valor inicial desde historial o último costo local? Recomendado: último costo existente.                                        | Partir del último costo existente de cada local.                                                                                                                                                                                    |
| 3. ¿Con stock anterior ≤ 0, usar el precio nuevo, incluso si el saldo final sigue negativo? Recomendado: sí.                        | Aceptado.                                                                                                                                                                                                                           |
| 4. ¿Compra sin precio conserva costo; si era desconocido, sigue desconocido? Recomendado: sí.                                       | Aceptado.                                                                                                                                                                                                                           |
| 5. ¿Consumo y conteo conservan el costo, también al llegar a saldo cero? Recomendado: sí.                                           | Aceptado.                                                                                                                                                                                                                           |
| 6. ¿Primera compra con precio y stock positivo desconocido inicializa todo el saldo a ese precio, como estimación? Recomendado: sí. | Aceptado como estimación.                                                                                                                                                                                                           |
| 7. ¿Drenar consumos antes de comprar y rechazar temporalmente si quedan pendientes? Recomendado: drenar y rechazar.                 | **Corrige la recomendación:** intentar aplicar pendientes de ese local; si alguno sigue pendiente, registrar igual y calcular con el stock disponible en ese momento. Acepta la imprecisión porque son raros y se reintentan solos. |
| ¿Mantener enteros escalados, costo a 6 decimales y redondeo existente?                                                              | Aceptado.                                                                                                                                                                                                                           |

Respuesta expresa sobre precio: **«El precio de compra es lo que pagó el comerciante, IVA incluido. No se desglosa ni se resta IVA, y no se lee ningún dato fiscal del comercio».** No inferir una cota numérica del error aceptado ni que todo pendiente se resuelva durante la compra.

## Alcance y diseño

### Fuente y almacenamiento

- Agregar `weighted_average_unit_cost numeric(14,6) NULL` a `stock.item_location`, con `CHECK NULL o >= 0`. La clave y FKs compuestas existentes `(business_id, item_id, location_id)` conservan aislamiento. `NULL` significa costo desconocido; `0.000000` es costo conocido cero. No usar la columna global legada de `stock.item` como fallback.
- El promedio reemplaza al último costo **como fuente de cálculo del insumo**. `last_unit_cost` conserva su significado actual de última compra con precio por fecha; no renombrarlo ni reinterpretar su historial. La conexión de Recetas al promedio se hará en otra pieza; esta no modifica `recipes/cost.ts` ni su consulta del producto.
- Agregar marcador técnico `weighted_average_initialized_at timestamptz NULL`: distingue un promedio desconocido ya inicializado de un par aún no inicializado. El marcador no es una fecha comercial ni orden de movimientos. Inicializar una sola vez bajo lock de par copiando exactamente `last_unit_cost` local, incluidos cero y null; futuras escrituras y reejecuciones no vuelven a copiarlo. Par nuevo sin compras: promedio null, marcador establecido al inicializarlo, sin costo inventado.
- Saldo `S` sigue derivado de movimientos aplicados de ese par; no agregar otro cache de cantidades. Costos y saldo de un local no se combinan con otros, incluidos locales archivados.

### Regla de compra y aritmética

Usar cantidades en unidad base después de convertir kg→g o l→ml como hoy. `S` = saldo **anterior** al movimiento; `C` = promedio actual; `Q > 0` = cantidad comprada; `T >= 0` = importe total pagado tal como se cargó; `P = T/Q` = precio por unidad. Compras con `totalCost: 0` tienen precio; ausencia o null significa sin precio.

| Condición                             | Promedio después de comprar                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sin precio, con cualquier saldo/costo | Conservar `C`, también null. Sumar `Q` al ledger.                                                        |
| Con precio y `S <= 0`                 | `P` redondeado a 6, aunque `S + Q <= 0`. No aplicar la fórmula con peso negativo.                        |
| Con precio, `S > 0` y `C` null        | `P` redondeado a 6 para todo el saldo resultante; estimación aprobada, no evidencia del valor histórico. |
| Con precio, `S > 0` y `C` conocido    | `(S × C + Q × P) / (S + Q)`.                                                                             |

Implementar con `bigint`, `fromDb`, `formatDecimal` y `roundDiv` de `decimal.ts`: `S3`, `Q3` a escala 3; `C6` a escala 6; `T2` a escala 2. Para la rama ponderada, **`C6nuevo = roundDiv(S3 × C6 + T2 × 10^7, S3 + Q3)`**. El término de compra usa el total pagado exacto; no redondear primero `P` y luego multiplicarlo por `Q`. Para inicializar o resetear: **`roundDiv(T2 × 10^7, Q3)`**. Redondeo una vez al persistir cada compra, a 6 decimales, mitades lejos de cero; no redondear a centavos el costo unitario ni usar float. Conservar validaciones de límites existentes para importes, cantidades y precio unitario; el resultado debe entrar en `numeric(14,6)`.

Ejemplo comprobable: saldo `10.000 unit`, promedio `2.000000`, compra `5.000 unit` por `20.00` (`P = 4`). Nuevo saldo `15.000`, promedio `40/15 = 2.666667`. Consumir `3.000` deja `12.000` y conserva `2.666667`; contar `8.000` deja `8.000` y conserva ese costo. Una compra sin precio también lo conserva.

Orden de registro significa aplicación serial bajo el lock de ese par; `occurred_at` no participa ni dispara replay. Dentro de una entrada, procesar las líneas en su orden enviado; si repiten un insumo, cada línea ve el saldo/costo actualizado por la anterior. No prometer orden de llegada de requests concurrentes: vale el orden efectivo de sus transacciones.

### Transacción, pendientes y reintentos

1. Autenticar, validar módulo/permiso `stock`, pertenencia, local, insumos y payload como hoy. Antes de la transacción de compra, intentar aplicar consumos pendientes **del comercio y local elegidos**, una vez por compra suelta o entrada completa, con presupuesto máximo de 2 s. Reutilizar retry durable y su unicidad; no mantener locks de compra, pares ni POS durante ese intento. Fallo, timeout o pendientes remanentes no impiden continuar.
2. En la transacción existente de compra/entrada, conservar orden de locks insumo→par, IDs ordenados en entradas, compatible con consumidor/conteo de etapa 0. Inicializar el par si corresponde, leer `S` **antes de insertar** y calcular con `C` bajo ese lock. Lectura, movimiento, nuevo promedio y marcador/`updated_at` pertenecen a un único commit. Entradas completas siguen siendo todo o nada.
3. El cálculo usa el ledger visible al leer `S` bajo lock, incluso si quedan ventas pendientes. Un consumo que logró aplicarse antes se incluye; uno posterior no. No reservar corte ni exigir que se complete, no devolver `consumption_pending`/`count_changed` por este motivo, ni trasladar al POS una espera por Stock. Si otro consumo compite durante la compra, queda ordenado antes o después por el lock de par.
4. Reintento tardío de consumo suma únicamente su delta: **no recalcula ni corrige retroactivamente el promedio de la compra**. Consumo y ajuste conservan costo y marcador; no borrar el costo al agotar stock. La incidencia de pendientes conserva la representación Stock existente.

«Una compra nunca se rechaza» se refiere al **fallo/atraso del aplicador de consumo**. Conserva rechazos normales por payload inválido, permiso/módulo, insumo/local ajeno o archivado y límites; un fallo de la propia transacción DB no se presenta como compra durable exitosa. No agregar idempotencia de compras ni prometer deduplicar una compra nueva enviada otra vez; sí conservar idempotencia existente de consumo.

### Contrato y transición futura

- Mantener rutas, bodies y statuses existentes: `POST /api/modules/stock/items/:itemId/purchases`, `POST /api/modules/stock/entries`, lecturas/creación/edición/conteo de insumos. `locationId`, cantidad y `totalCost` mantienen contrato; no agregar endpoint para editar manualmente el promedio.
- Agregar al DTO localizado `ItemDTO` de Stock `weightedAverageUnitCost: string(6)|null`, independiente de `lastUnitCost`. Respuestas de compras/entradas/conteos y lista devuelven el valor del mismo par; no exponer el marcador interno. Permisos/errores `{ error, code }` y aislamiento de spec0227 se conservan. Sin UI nueva ni lectura nueva del costo del producto en este encargo.
- Implementación futura: expandir columnas sin cambiar datos históricos; establecer un corte verificable de writers antiguos antes de inicializar y activar el writer nuevo. Inicialización local bajo locks compatibles, retomable por marcador, con validación por par contra el último costo existente del corte. No continuar escribiendo compras con un writer antiguo que sólo actualiza último costo después de activar el promedio. No replay del historial, reparto entre locales, respaldo en costo global ni creación de compras/consumos de apertura. Conservar ledger y último costo para rollback; no recalcular un promedio ya inicializado al reanudar. Fases/SQL se concretan al implementar con journal único y permisos PROD separados; no se ejecutan aquí.
- Fuera: IVA desglosado o neto, datos fiscales, costo congelado en venta, lectura nueva del costo del producto, transferencias, costos fijos y reparación retroactiva por pendientes. Esta pieza no requiere consultar información tributaria ni cambiar POS/core.

## Archivos y paralelismo

Implementación futura: un writer de `packages/db/src/schema/modules/stock.ts` y migraciones/journal; un responsable Stock para `numbers.ts`, `movements.ts`, `entries.ts`, `items.ts`, `local.ts` y tests focales. Revisar compatibilidad con `consumption.ts`/conteo sin cambiar su regla de costo. Quien conecte el costo futuro de Recetas consume este contrato y no reabre cálculo ni comparte escritura del promedio. Reservar DB de prueba para migración/integración; no paralelizar cambios incompatibles sobre locks/esquema. No imports del core hacia Stock ni dependencias nuevas del POS.

**Scope de esta entrega:** únicamente esta spec y `docs/adr/0146-costo-promedio-ponderado-por-local.md`; sin INDEX, TASKS, estados ni archivos ejecutables.

## Definition of Done

- [x] Cada par conserva promedio inicial local y actualiza correctamente al comprar en orden de registro, con cantidades exactas y costo a 6 decimales.
- [x] Compras/entradas atómicas; una falla del aplicador no impide registrar una compra válida; retries de consumo nunca vuelven a ponderar.
- [x] Compra sin precio, saldo no positivo, costo desconocido, precio cero y conteos/consumos respetan las reglas aprobadas; locales/comercios aislados.
- [x] DTO Stock distingue promedio y último costo; Recetas/POS y datos fiscales permanecen fuera de esta pieza.
- [x] Inicialización una sola vez y checks focales de aceptación/combinación con evidencia del SHA/entorno; coordinador marca implementada sólo tras QA pertinente.

## Pruebas pertinentes

Plan para la implementación, **no pruebas de producto ejecutadas en esta entrega**. Reutilizar suites Stock/entrada/decimal/consumo; nuevos tests bajo proyecto merchant. Errores a detectar: saldo leído después de compra, float/redondeo intermedio, doble ponderación, pérdida por concurrencia y mezcla de locales/comercios. Presupuesto focal inicial 20 min; ante rojo del alcance corregir y repetir checks afectados, sin batería global ni mutaciones obligatorias.

1. Unitarios de fórmula: ejemplo `10 @ 2 + 5 @ 4 → 2.666667`; saldo `0.001 @ 0`, compra `0.006` por `0.01` → `1.428571` (redondear precio antes daría `1.428572`); mitades a 6 decimales y límites existentes. Saldo anterior cero/negativo (incluido saldo final negativo), `C = null` con stock positivo, precio cero y compra sin precio con costo conocido/null. Sin división por cero ni costo negativo.
2. Integración por compra suelta y entrada real: una compra con `occurredAt` pasado pondera ahora; líneas repetidas ponderan serialmente; conversiones kg/g y l/ml usan base correcta; error de una línea o fallo DB revierte movimientos **y** promedio de toda entrada. Precio pagado con IVA no se divide/resta y ninguna consulta fiscal participa.
3. Consumo/conteo conservan el costo incluso al llegar a cero/negativo; consumo repetido o reintento tardío no lo modifica. Dos compras concurrentes producen un resultado de su serialización válida, sin perder cantidad/costo; compra contra consumo se ordena por par sin deadlock ni bloqueo del cierre POS por drenaje.
4. Pendiente real anterior: intento exitoso antes de comprar usa el saldo reducido. Fallo/timeout del aplicador deja pendiente durable y compra registrada con saldo disponible; recuperación posterior modifica cantidad pero mantiene exactamente el promedio ya guardado. Entrada multi-línea hace un solo intento por local y no añade rechazos de conteo a compras.
5. Dos locales del mismo comercio y otro comercio: saldos/costos diferentes; compra en uno no cambia los otros, IDs ajenos mantienen 404. Local archivado rechaza compra normal; conteo permitido de etapa 0 conserva costo.
6. Inicialización: copia exacta de último costo **local**, incluyendo null y cero; marcador impide reseed aun si cambió último costo; nuevos pares sin compra siguen null; validación preserva movimientos/importes y no genera consumo histórico.

En implementación: Node24; DB sólo mediante `tools/neon-test.sh` y configuración CI/desarrollo protegida; tipos/lint/formato/frontera pertinentes. No pruebas con `DATABASE_URL` PROD ni anuncio de PASS por skips/retries.

## Handoff y abierto

Base documental `39d00edfca6347773c03a015a2ffcd1a1d38b0dd`. Preguntas/respondidas arriba; ADR0146 registra almacenamiento, serialización y aproximación aprobada. **Sin hallazgos de producto abiertos ni respuestas inferidas:** el mensaje original repetido/truncado no agrega alcance. Restan implementación, SQL/corte de writers, medición y QA, por encargo separado; son trabajo futuro, no decisiones bloqueantes de esta spec. SHA de entrega y verificaciones documentales se informan fuera del documento. Sin código, migraciones ejecutadas, índices/estados comunes ni publicación.

## Implementación y aceptación — 2026-10-14

Implementación autorizada posteriormente por el [handoff0228/0229](../handoff-0228-0229-implementacion.md), conservando las decisiones funcionales anteriores. Producto combinado verificado `07393f2cacbad43cc3d92fd98b028ab1f8ff8a70`, entrega A `bc9b29bd674452e11f70943f06850be0d2bb277e` y B `4b25cfabf857c480400c475f4aaa2d4a61579b35`; [informe QA independiente](../factory/0228-0229-qa.md), [entrega A](../factory/0228-stock.md), [entrega B](../factory/0229-brand.md). QA funcional y combinación PASS:29DB afectados y1probe fiscal bruto independientes,77unitarios, tipos/lint/guardias y build Merchant; browser23 y visual390/1280, API/DBMarca20, DDL3 y regresiones compatibles de autores según identidad registrada. Cierre documental final comprobado separadamente; ningún PASS por skips/retries ni cambios de presupuestos.

Migración0084 aplicada sólo a CI protegida; conserva EXPAND0227, flag de consumo y costo bruto IVA incluido. No publicación, seed ni migración PROD. Owner autorizó el merge a main local del candidato9b7b323f el2026-10-14; integración completada sin publicación ni operaciones PROD. Las restricciones iniciales de entrega documental describen el encargo original; esta implementación se autorizó por el handoff citado, sin habilitar funciones fiscales futuras.
