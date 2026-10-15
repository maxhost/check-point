---
spec: 0230
fecha: 2026-10-14
estado: implementada
resumen: Congelar el costo de ingredientes de cada consumo para conservar el costo histórico de la venta, con lectura completa, incompleta o pendiente.
disjunta: no; depende de 0227/0228 y comparte esquema, locks y aplicador Stock con R1 y etapa 6; documentalmente independiente de 0231
archivos: packages/db/src/schema/modules/stock.ts, packages/db/drizzle/**, apps/merchant/src/modules/stock/**, apps/merchant/src/modules/recipes/server/consumption*.ts
---

# 0230 — Pieza 2: costo de lo vendido

Piso **L2: dinero**; ADR0144/0145/0146 y política de `docs/VERIFICACION.md`. **Este encargo entrega solo esta spec:** sin código, ADR nuevo, migraciones generadas, índices/estados comunes, push ni operaciones PROD. Diseño del núcleo cerrado; los límites externos de terminalización y conversión monetaria se documentan abajo sin ampliar este alcance. Las pruebas siguientes son aceptación futura, no resultados ejecutados.

## Problema

`recipes/server/consumption.ts` expande la revisión capturada por `sale.closed` y llama a `stock/consumption.ts`. El aplicador inserta cantidades negativas por orden/línea/insumo, bajo locks insumo→par local y dentro de la transacción que confirma la entrega. No guarda costo: el CHECK de `stock.movement` exige `total_cost IS NULL` para consumos. El promedio disponible es `stock.item_location.weighted_average_unit_cost numeric(14,6)`, donde null es desconocido y cero es conocido cero. Compras, conteos y recetas posteriores no deben cambiar cuánto costó lo ya vendido.

Verificación documental/código sobre base `20a6dd6397b9bcbf203b0ca28b51bd5bccd7cada`: main local `120ecbc968468db489ea0d76295de7cdbdb058ce` contiene 0227/0228; la referencia guardada `origin/main` es `54dbff34e53500ca4e37b0ed75575fce7411c8e9` y no contiene `stock/consumption.ts`. El [handoff](../handoff-proximas-features.md) registra ausencia de push/deploy/migración PROD. Esto respalda que esas piezas siguen locales; **no es inspección de la DB PROD ni comprobación actual del remoto**. No se hizo fetch ni consulta PROD. Local/CI sí pueden tener consumos anteriores sin snapshot de costo.

## Preguntas y respuestas del owner

Preguntas presentadas y respondidas antes de redactar. Lo técnico especificado después es diseño propuesto para cumplirlas, no respuestas adicionales atribuidas al owner.

| Pregunta y recomendación presentada | Respuesta del owner |
|---|---|
| 1. ¿Costo al aplicar el consumo, bajo lock, aunque entre una compra después del cobro? Recomendado: sí, sin recálculo posterior. | «1, 3 y 4: de acuerdo con tu recomendación». |
| 2. ¿Costo null para insumo sin precio y venta parcial con insumos faltantes? Recomendado: sí, distinto de cero. | «2: de acuerdo. 0 = costo conocido cero, null = desconocido». |
| 3. ¿Guardar costo unitario6 y factor separados; derivar importe y redondear al sumar venta, frente a guardar importe redondeado por movimiento? Recomendado: campos separados. | Aceptado en la respuesta conjunta a 1/3/4, con la corrección monetaria que sigue. |
| 4. ¿Guardar y ofrecer función de servidor con tests, sin ruta HTTP nueva? Recomendado: sí; SM-datos define lectura agregada. | Aceptado en la respuesta conjunta a 1/3/4. |
| 5. ¿Cómo distinguir venta sin consumo de costo cero? Recomendado inicialmente: estados distintos, nunca cero por defecto. | «solo tres estados para la venta y para cada línea: completo, incompleto (con la lista de productos sin receta y de insumos sin precio; Stock o Recetas apagados cuenta como sin receta) y pendiente (consumo no aplicado todavía). Si falla definitivamente, es incompleto. Nunca $0 por falta de movimientos». |

Corrección expresa: **«Redondeo: no a “centavos” sino a la unidad mínima de la moneda del comercio (businesses.currency_code; COP o CLP a enteros). El costo unitario sigue con 6 decimales en cualquier moneda. Revisá que las escalas actuales (numeric(14,6) y numeric(12,2)) alcancen para COP y dejalo escrito».**

Decisiones previas que no se reabren: costo de cada consumo = promedio del insumo en su local × factor; factor1 hasta etapa6; congelación permanente; costo de línea/venta por suma de sus consumos; compra por lo pagado con IVA incluido, sin leer datos fiscales; ningún bloqueo, demora ni dato nuevo en POS.

## Alcance y diseño

### Snapshot, columnas y CHECKs

Agregar a `stock.movement`, **sin defaults que inventen snapshots históricos**:

| Columna | Tipo y significado |
|---|---|
| `consumption_unit_cost` | `numeric(14,6) NULL`: promedio local de la primera aplicación exitosa, antes de multiplicar por el factor. Null desconocido, `0.000000` conocido cero. |
| `consumption_loss_factor` | `numeric(12,6) NULL`: factor congelado; el writer nuevo siempre guarda `1.000000`. Null identifica consumo legado sin snapshot. |
| `consumption_currency_code` | `text NULL`: moneda del comercio leída al aplicar, congelada junto con el costo. |
| `consumption_minor_units` | `smallint NULL`: escala de salida de esa moneda, congelada para que lecturas futuras no cambien el redondeo histórico. |

Los campos moneda/escala son diseño técnico para conservar el significado del importe; no una función de conversión. No agregar importe de consumo a `total_cost`: sigue NULL, reservado a compras según su contrato actual. No guardar un total redondeado por movimiento: perdería precisión en la suma y duplicaría datos derivados. Cantidad, costo y factor separados permiten auditar el cálculo y aplicar etapa6 sin volver a cambiar esas columnas.

CHECKs nuevos, además de preservar unicidad, FKs e invariantes actuales:

- En compras/ajustes, los cuatro campos nuevos son NULL.
- En consumo, o los cuatro campos son NULL (legado sin snapshot), o factor/moneda/escala son no nulos y costo es conocido o NULL. No permitir costo sin metadatos ni metadatos parcialmente presentes.
- Costo conocido: finito y `>= 0`; factor presente: finito y `>= 1`, dentro de la precisión declarada. Excluir explícitamente `NaN` e infinitos, sin confiar solo en comparaciones numéricas. Moneda: tres letras mayúsculas; escala: `0` o `2` para las monedas ofrecidas hoy. La aplicación valida el código contra el catálogo de monedas; un código fuera de esa política no recibe escala2 silenciosamente.
- Conservar `quantity < 0`, `total_cost IS NULL`, `counted_quantity IS NULL` y referencias origen no nulas en consumo. No alterar `location_id` nullable de la fase EXPAND0227 ni ejecutar su contract por inferencia.

### Aplicación, locks e idempotencia

1. Conservar suscriptor, revisión capturada y transacción asíncrona de entrega. El cierre no lee costos ni espera locks de Stock. Una falla de snapshot revierte únicamente aplicación y confirmación de delivery; el cierre sigue confirmado y la obligación sigue durable.
2. Conservar locks KEY SHARE de insumos y FOR UPDATE de pares `(business_id, item_id, location_id)`, todos en orden estable. Después de bloquear, consultar consumos existentes y separar los nuevos. `lockItemLocations` hoy devuelve void: ampliar la lectura interna bajo esos mismos locks para obtener el promedio; no leerlo antes ni desde otro local. Respetar inicialización única0228; no copiar costo global ni volver a inicializar el promedio para reconstruir una venta.
3. Solo si hay movimientos realmente nuevos, leer moneda/escala del comercio una vez para la entrega, leer el promedio local bajo lock y guardar costo/null, factor1 y esos metadatos monetarios en todos los inserts de esa entrega. Un retry compuesto solo por movimientos existentes no lee ni revalida la moneda actual. La compra y el consumo quedan ordenados por el lock: si compra primero, vale el promedio posterior; si consumo primero, vale el anterior. `occurred_at` sigue siendo fecha de cierre, no una búsqueda retrospectiva. No garantizar FIFO por llegada de requests.
4. Mantener índice único `(business_id, source_order_id, source_line_id, item_id)` para `kind='consumption'`. Una reentrega conserva el costo, factor y moneda **ya guardados**, incluidos null y cero. Esos campos NO se comparan con valores actuales ni se actualizan en conflicto: no forman parte del snapshot de entrada del evento. Sí mantener conflicto ante diferencias de local, producto, cantidad, fecha o usuario. No rellenar silenciosamente un consumo legado ni uno desconocido tras una compra posterior.
5. Inserción de todos los movimientos y `delivery.applied` siguen siendo atómicos, sin resultado parcial persistido. Conservar chequeo de cantidad insertada frente al chunk y conflicto explícito; no convertir una colisión inesperada en éxito. Un rollback no congela nada: el siguiente intento usa el costo vigente de su primera aplicación que logre commit.

Compras, conteos, cambios/borrado de receta y etapa6 posteriores no escriben estos snapshots. Un insumo archivado presente en revisión sigue consumiéndose como0227.

### Decimales, moneda y límites

Usar `bigint` y utilidades `decimal.ts`, nunca float. Cantidad absoluta `Q3`, costo `C6` y factor `F6` producen `E15 = Q3 × C6 × F6`. Sumar `E15` conocidos de los movimientos de la línea/venta **antes de redondear**. Importe final a escala `m`: `roundDiv(sum(E15), 10^(15-m))`; mitades lejos de cero. Una línea puede mostrar su suma redondeada; el total de venta se calcula desde sus consumos exactos, nunca sumando subtotales ya redondeados. La suma de subtotales visibles puede diferir una unidad mínima del total.

Ejemplo0228: promedio `2.666667`, consumo `3.000`, factor `1.000000` → costo exacto `8.000001`. USD → `8.00`; COP/CLP → `8`. Para detectar redondeo prematuro: dos aportes USD `5.005` suman `10.010` → `10.01`, aunque redondearlos por separado daría `10.02`; dos aportes COP `0.5` suman `1`, no `2`.

`packages/domain/src/lib/currencies.ts` ofrece24 monedas, sin política compartida de decimales de cálculo. Política de esta pieza: **COP/CLP/JPY/PYG → 0; restantes ofrecidas → 2**. COP0 es regla operativa expresamente pedida por el owner; **no es afirmación ISO4217**. El [listado oficial SIX](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml), publicado2026-09-17 y consultado2026-10-14, asigna COP2, CLP/JPY/PYG0 y2 a las demás ofrecidas. No delegar COP a `Intl` ni cambiar formateadores o catálogo global en esta pieza. La escala de entrada/almacenamiento de compras continúa2 aunque la salida de consumo sea0.

Los límites actuales son monetarios nominales, independientes del país:

- `numeric(14,6)` admite hasta `99,999,999.999999` por unidad base; `100,000,000` no entra. Sirve, por ejemplo, para un insumo COP a `50,000,000.000000` por unidad, y para cantidades en g/ml con precios unitarios mucho menores; no garantiza todo precio posible en COP.
- `numeric(12,2)` admite hasta `9,999,999,999.99` por compra. Comprar100 unidades a COP50 millones = COP5 mil millones entra en ambas columnas; una compra por COP10 mil millones no entra aunque el precio unitario sí quepa. Conservar rechazo422 de los límites actuales en compra, sin truncar, ampliar columnas ni convertir monedas silenciosamente. Esta revisión no aprueba cobertura universal COP ni cambia contratos de compra.
- El total derivado de venta usa BigInt sin limitarse a la columna `total_cost` de una compra; no persistirlo ahí ni pasar por `number`. No hay un producto monetario persistido susceptible de desbordar esa columna. Factor futuro respeta su precisión; su cálculo real queda fuera.

El snapshot monetario evita reinterpretar movimientos aplicados si cambia `businesses.currency_code`. Marca hoy permite editar esa moneda (`packages/domain/src/server/brand.ts`) sin convertir el promedio Stock. La conversión del promedio ante cambios de moneda, incluidos cambios entre cierre y aplicación, es una limitación heredada fuera de0230: se congela el valor nominal y la moneda disponibles al aplicar, sin afirmar que ese valor haya sido convertido ni que cambiar una etiqueta convierta dinero. No se añade bloqueo ni detección de ese cambio en este núcleo.

### Lectura de servidor y tres estados

Sin HTTP nuevo, UI ni cambios a respuestas POS. Entrada interna de servidor en `modules/recipes/server/consumption-cost.ts`, testeable, para una venta/local: `{ businessId, locationId, sourceOrderId, saleContext? }`; contexto opcional tipado e inmutable con líneas `{ sourceLineId, productId|null }`, proporcionado por un futuro consumidor autorizado. No aceptar identidad de comercio de un navegador ni importar POS. Validar local del comercio (ajeno/inexistente404); consultas de movimientos, eventos y entregas siempre filtradas por comercio y local. El helper no concede acceso público: su futuro caller debe autenticar/autorizar. No requiere que los módulos estén encendidos hoy para leer un hecho histórico que ya fue capturado.

El wrapper de Recetas consulta evento `sale.closed`, sus referencias/revisiones capturadas y delivery para conocer líneas esperadas, omisiones y avance. Recetas ya declara `requires: [stock]`: carga/expande sus revisiones y entrega al lector/evaluador `modules/stock/server/consumption-cost.ts` una cobertura tipada por línea (`sourceLineId`, `productId`, receta conocida/ausente/desconocida, consumos esperados con `itemId` y cantidad), más estado genérico de entrega. Stock consulta únicamente su ledger y core genérico: no importa Recetas ni sus tablas ni POS. El wrapper abre una transacción read-only con snapshot consistente REPEATABLE READ y pasa el mismo `tx` a Stock; evento, delivery, revisiones y movimientos se leen de una misma versión confirmada, evitando mezclar una entrega anterior con filas posteriores. Nunca receta actual ni promedio actual en la lectura. La revisión vacía también cuenta como sin receta. Desactivación posterior no vuelve incompleta una venta ya aplicada: manda elegibilidad del cierre, no activación de hoy. Sin evento (flag apagado o venta anterior), el contexto opcional permite enumerar líneas, pero no inventar receta, costo ni elegibilidad; sin contexto devolver incompleto con razón `sin_informacion` y listas vacías. `saleContext` nunca sustituye ni modifica el evento persistido si este existe. Una lista vacía en ese caso significa falta de información, no ausencia comprobada de productos faltantes.

Salida conceptual de venta y de cada línea: `state: completo|incompleto|pendiente`, `currencyCode`, `minorUnits`, `knownCost: decimal string|null`, `missingRecipes: [{ sourceLineId, productId|null }]`, `missingPrices: [{ itemId, sourceLineIds }]` y `reasons`. Metadatos monetarios nullable si no hay snapshot confiable. `knownCost` es la suma conocida parcial: **null si no existe ningún consumo con costo conocido**, incluso si no hay movimientos; `0` con la escala pertinente solo deriva de una suma de consumos conocidos: puede provenir de costos exactamente cero o del redondeo de costos positivos; nunca de ausencia de consumos conocidos. En `completo`, esa suma es el costo total; en los demás estados nunca presentarla como total definitivo. No generar un resultado completo mezclando monedas; una discrepancia es incompleto con razón monetaria y sin suma entre monedas.

| Estado público | Regla por línea |
|---|---|
| `pendiente` | Hay consumo esperado de una revisión capturada y su delivery recuperable aún no está aplicado; incluye processing y fallos reintentables. |
| `incompleto` | Producto/línea sin receta, módulos apagados al cierre (se lista como sin receta), insumo con snapshot costoNULL, snapshot legado ausente, ausencia de información o fallo definitivo identificado. Nunca convertirlo en cero por suma vacía. |
| `completo` | Cobertura aplicada de los consumos esperados y todos tienen costo conocido, con metadatos consistentes. Un cero completo requiere consumos conocidos: pueden valer cero o sumar un positivo que redondee a cero. |

Precedencia de venta mixta como diseño técnico: `pendiente` mientras exista alguna línea con aplicación recuperable pendiente; acompañar las listas de faltantes ya conocidos. Sin pendientes, `incompleto` si alguna línea lo es; `completo` solo si todas tienen cobertura completa. Una línea sin receta es incompleta aunque otra espere aplicación. Deduplicar insumos faltantes y conservar referencias a todas sus líneas. No agregar estados públicos para legacy, fallo, módulos apagados ni ausencia de evento: son razones dentro de los tres aprobados.

**Límite existente:** el retry actual tiene `pending/processing/applied/skipped`, diagnóstico `application_failed` y reintentos sin tope terminal; el diagnóstico por sí solo NO significa fallo definitivo. Conservarlo como pendiente recuperable. No inventar un límite de intentos ni transformar un error técnico temporal en incompleto definitivo. Un `skipped` explícito con razón terminal distinta de `modules_disabled` se lee incompleto; la creación de esa señal/transición queda fuera. La regla del owner se conserva si un productor terminal futuro la emite, sin implementar aquí quien abandona reintentos.

Fila propuesta para `docs/TASKS.md`, **solo dentro de esta spec, sin editar TASKS**: «SM-datos: consumir `recipes/server/consumption-cost.ts`, que delega al lector Stock, para lecturas históricas por rango/local, conservando estados, moneda, faltantes y suma exacta; el helper0230 queda deliberadamente sin consumidor de producción hasta esa pieza». Los tests del helper pertenecen a0230; no crear ruta muerta de anticipación.

### Compatibilidad R1, etapa6 y migración

R1 modifica expansión/revisiones y sus referencias; esta pieza cobra las cantidades expandidas ya normalizadas del contrato `applyConsumption`, sin depender de receta simple ni de su revisión actual. R1 consolida un insumo repetido dentro de una línea antes del insert para conservar unicidad línea/insumo; su procedencia/composición se diseña en R1 sin alterar los costos ya congelados. Se implementa después de0230 por compartir aplicador, no en paralelo sobre ese writer. Etapa6 aportará factor vigente a movimientos nuevos; factores menores que1 no se aplican según el plan, no se revalorizan movimientos anteriores. No implementar conteos/factor real ahora.

**Hace falta migración aditiva**, sin número SQL asignado ni archivo generado en este encargo; coordinar journal único con0231 al implementar. **No hace falta ni se permite backfill monetario:** no reconstruir precios históricos desde promedio actual ni generar consumos para ventas pasadas. Filas previas conservan los nuevos campos NULL, se leen incompletas por snapshot ausente y nunca se rellenan en reentrega. El nuevo writer distingue snapshot desconocido (factor1, moneda/escala presentes, costoNULL) de legado (todoNULL).

Antes de activar, comprobar entorno, esquema0228 e inicialización una vez, inventariar consumos existentes y retirar/drenar writers de consumo antiguos mediante corte verificable. Un pendiente aún sin movimientos se valorará al aplicar con el writer nuevo; una entrega vieja ya aplicada conserva lo que tiene. Validar conservación de cantidades, origen y `total_cost`; mantener EXPAND0227 y flag actuales. No permitir convivencia indefinida con writer antiguo que siga insertando consumos sin snapshot. Rollback preserva columnas/valores y no autoriza revalorizarlos al reactivar. Cada operación PROD requerirá su autorización específica fuera de este encargo.

Fuera: R1/combos, costo actual por producto1.3, comisiones/medios de pago, packaging, cupones, conteos/factor real6, IVA/datos fiscales, nómina/fijos0231, pantallas, Smart Menu y punto de equilibrio. No ampliar permisos, core ni POS para consultar sus tablas desde Stock.

## Archivos y paralelismo

Implementación futura: writer Stock de esquema/migración, `consumption.ts`, lectura bajo locks en `local.ts`, helper de servidor, aritmética y tests focales; adaptación mínima del caller Recetas solo si el contrato la requiere. Un writer para journal/snapshots, serializado con0231; DB aislada reservada también durante teardown. R1 y etapa6 no modifican simultáneamente aplicador/snapshot. El wrapper Recetas y su test son paths propios de0230; Stock recibe cobertura tipada y nunca consulta tablas Recetas. El contexto del consumidor SM-datos se contrata antes de conectarlo; ningún import Stock→POS ni core→Stock.

Scope documental presente: **solo `docs/specs/0230-costo-de-lo-vendido.md`**. Base/worktree/reserva son de la ficha operativa, no autorización de implementación. Dos implementadores y QA independiente; no subdelegación ni reviewers adicionales.

## Definition of Done

- [ ] Cada consumo nuevo congela promedio local, factor1, moneda y escala al aplicar sin bloquear POS.
- [ ] Compra/conteo/receta posteriores y reentrega preservan el snapshot, incluidos cero y null.
- [ ] Lectura de línea/venta suma exacto, redondea por moneda y distingue solo completo/incompleto/pendiente, con faltantes y sin cero desde ausencia de movimientos.
- [ ] Migración aditiva conserva ledger y diferencia legado sin inventar costos históricos; journal asignado al implementar.
- [ ] Aceptación focal de entrega/combinación por QA con SHA/entorno identificados; sin productor terminal ni conversión monetaria añadidos por inferencia.

## Pruebas pertinentes

Plan de implementación futura, **no pruebas de producto ejecutadas aquí**. Reutilizar suites Stock0227/0228 y decimal; Node24, tipos/lint/fronteras pertinentes. DB solo `tools/neon-test.sh` con CI/desarrollo protegido y DB reservada; DDL aislado sin concurrencia de archivos. Sin verify global por ceremonia ni PASS por skips/retries.

1. Costo congelado: aplicar consumo, comprar después con otro precio y cambiar/contear/archivar receta; costo/factor/moneda originales intactos. Compra que gana lock antes de aplicación cambia el primer snapshot; compra posterior no. Rollback no deja snapshot ni entrega aplicada parcial.
2. Insumo sin precio: costoNULL/factor1 y lectura incompleta con insumo faltante; otro conocido aporta suma parcial. Primera compra posterior no rellena costoNULL. Costo conocido0 sí produce cero; COP0.25 conocido y cobertura completa produce `completo`, `knownCost: "0"` al redondear a la unidad mínima; ausencia total de importes conocidos, incluidos todos desconocidos, produce null.
3. Factor1 y decimales: `3 × 2.666667 = 8.000001`; USD8.00, COP/CLP8; mitades a escala0/2 y dos aportes5.005 sin redondeo intermedio. Venta desde movimientos exactos, sin sumar subtotales ya redondeados. Límites14,6/12,2 con ejemplos COP y rechazo sin truncar; suma de venta puede superar límite de compra sin overflow.
4. Reentrega idéntica después de compra/cambio de factor: una sola fila por origen y mismos campos; costo no participa en comparación contra valores actuales. Cambio de cantidad/local/producto/fecha/usuario produce snapshot conflict. Claims concurrentes no duplican ni aplican parcialmente.
5. Estados por línea/venta: sin receta/puntero, revisión vacía, módulos apagados al cierre, flag/evento ausente con/sin contexto; pendientes, processing/claim abandonado y application_failed recuperable. Venta mixta conserva precedencia/listas; un skipped explícitamente terminal se lee incompleto, sin crear productor ni umbral. Lectura consistente ante aplicación concurrente; contexto opcional no sustituye el evento; wrappers respetan Recetas→Stock. Nada nuevo en POS ni dependencia de entrega para cerrar/liberar mesa.
6. Dos locales del mismo comercio y otro comercio: promedios/snapshots/sumas distintos, IDs ajenos404, filtro de evento/local y contexto sin filtraciones. Local archivado conserva costo y lectura; insumo archivado aún consume como0227.
7. Migración: consumos legados quedan sin snapshot; purchases/adjustments rechazan metadatos de consumo; CHECKs rechazan metadatos parciales/negativos/NaN/Infinity/factor<1. Snapshot nuevo desconocido se distingue del legado. Cambio monetario posterior no reinterpreta snapshot; un retry sin inserts no depende de la moneda actual, incluso si ya no está soportada. El test de primera aplicación verifica que la moneda/escala se leen una vez; no promete conversión del promedio previo.

## Handoff y abierto

Entrega documental basada en `20a6dd6397b9bcbf203b0ca28b51bd5bccd7cada`. Preguntas/respondidas registradas arriba; verificaciones realizadas: lectura de contratos/esquema/locks/retry, refs locales y capacidades decimales; consulta del listado monetario oficial. Sin pruebas de producto, migraciones ejecutadas ni acceso PROD. SHA final y checks documentales se informan al entregar, fuera del propio documento.

**Límites externos no bloqueantes del núcleo0230:**

1. **Productor de fallo definitivo:** owner pide incompleto en ese caso; el modelo genérico admite skipped/terminalReason, pero hoy el retry no produce una señal terminal de fallo.0230 conserva `application_failed` como pendiente recuperable y lee incompleto un terminal explícito si lo produce otro flujo futuro. No incorpora productor, umbral, permisos ni operación de abandono; decidirlos sería otro alcance y no condiciona congelar/leer costos ahora.
2. **Conversión ante cambio de moneda:** Marca permite cambiar `currency_code`, no convierte promedios y el evento no captura moneda.0230 congela moneda/escala y valor nominal disponibles en la primera aplicación exitosa; no convierte el promedio anterior ni detecta su moneda original. El snapshot protege movimientos ya aplicados frente a ediciones posteriores. Soportar conversión/cambio con datos previos, incluido el intervalo cierre→aplicación, requiere otro encargo; no se aprueba aquí ninguna equivalencia monetaria ni política de conversión.

El número de migración se asigna al implementar en coordinación con0231. Diseño técnico cerrado, incluida precedencia de los tres estados, wrapper modular y límites exteriores. Esta spec no atribuye al owner decisiones sobre terminalización ni conversión. El owner autorizó posteriormente implementar0230; el coordinador asigna contrato/reserva de código antes de escribir y marca implementada solo después de QA pertinente. Esta actualización documental no genera migración ni publica.

## Aceptación de implementación local

El owner autorizó posteriormente lanzar al implementador. Producto `fe5fb583106b801e7341a80cbc10062b0259e856`, entrega `119740b72775bfa5120291b8b353e621e8aba6b0`; [evidencia del autor](../factory/0230-stock.md). QA independiente sobre `c9d733cfdf9caffd407482139b3ec764ed0a1ffe`: 5/5 DB y 31/31 unitarios/fronteras, sin skips ni retries; regresiones0227/0228 y DDL0085 reutilizados por identidad de fuentes, configuración y SQL. La combinación con documentación0231 conserva exactamente el código probado; [informe combinado](../factory/0230-0231-qa.md).

0085 aplicada a CI y, por coordinación, a la base local protegida: 86 entradas de journal, cuatro columnas verificadas y hash SQL `7e17ff9b5b45f828b83c93a1082f02b1953625d6535b0555044df201e079c0fe` coincidente. Sin backfill monetario, reconstrucción histórica, HTTP/UI nuevos ni operaciones PROD. Esta aceptación no autoriza push o migración de producción.
