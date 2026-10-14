---
adr: 0146
fecha: 2026-10-14
estado: aceptada
resumen: Promedio móvil local separado del último costo, inicializado una vez desde éste y ponderado atómicamente al comprar; consumos pendientes no impiden la compra ni provocan recálculo posterior.
---

# 0146 — Costo promedio ponderado por local

## Contexto

Spec0228, pieza 1.1, pisoL2 dinero. Etapa 0/spec0227 y ADR0145 ya ofrecen ledger por local, par `stock.item_location` como lock, último costo local y consumo durable posterior al cierre. Compras sueltas y entradas comparten `applyPurchase`; el costo vigente actual se elige por fecha de compra. Recetas calcula con enteros escalados. El owner decide costo de cálculo del insumo = promedio ponderado móvil por local; su uso nuevo en el costo del producto queda fuera de esta pieza.

Decisiones del owner recogidas **antes** de redactar: orden de registro, inicialización desde último costo local, precio nuevo con saldo anterior no positivo, compras sin precio conservan costo/null, consumo/conteo no alteran costo, primera compra con precio estima stock positivo sin costo. Enteros escalados y precisión6/redondeo existente aprobados. El owner corrige la propuesta de rechazar por pendientes: intentar aplicarlos antes, registrar la compra igual si quedan y usar el saldo disponible, aceptando la imprecisión. No atribuirle un límite medido del error.

Precio aprobado expresamente: **«El precio de compra es lo que pagó el comerciante, IVA incluido. No se desglosa ni se resta IVA, y no se lee ningún dato fiscal del comercio».** Esta decisión define la entrada del cálculo; no agrega procesamiento fiscal.

## Decisión

1. Persistir `weighted_average_unit_cost numeric(14,6) NULL` en el par `(business_id, item_id, location_id)`, con constraint no negativo. Mantener `last_unit_cost` con su significado existente; promedio distinto y fuente para futuros cálculos. No escribir costo global ni mezclar locales. DTO Stock agrega `weightedAverageUnitCost` como decimal string6/null; el cableado de Recetas y UI nueva quedan para otra pieza.
2. Inicializar una vez desde `last_unit_cost` del propio par, sin replay ni lectura global. Marcador `weighted_average_initialized_at timestamptz NULL` distingue costo desconocido inicializado de pendiente de inicializar. Copia, marcador y escrituras quedan bajo lock compatible. Cero es conocido; null desconocido y nunca significa «volver a copiar en cada compra». Par nuevo sin compra parte de null.
3. Compra con precio, saldo anterior `S > 0` y costo `C` conocido: `(S × C + Q × P)/(S + Q)`, `Q > 0`, `P = total pagado/Q`. Con `S <= 0` o `C` desconocido, usar `P`, incluso si saldo final sigue negativo; en stock positivo desconocido es estimación aprobada de existencias anteriores. Sin precio, conservar costo/null; precio cero sí participa. Consumo/conteo, saldo cero y retry de consumo nunca resetean ni ponderan costo.
4. Enteros `S3/Q3`, `C6`, `T2`; ponderación `roundDiv(S3 × C6 + T2 × 10^7, S3 + Q3)`, reset `roundDiv(T2 × 10^7, Q3)`. Aportar el total exacto evita redondear precio antes de ponderar. Persistir a escala6 por compra, mitades lejos de cero como `decimal.ts`; conservar validación de límites. Nada de float, IVA neto, impuestos deducidos o datos fiscales.
5. Serializar compras bajo locks existentes insumo→par y orden estable entre insumos. Leer saldo anterior de movimientos aplicados **antes del insert**; cálculo, movimiento y promedio/marcador comparten transacción. Entrada multi-línea conserva todo o nada y orden enviado para repeticiones. `occurred_at` es informativo para el promedio, sin replay; el orden efectivo es el de aplicación bajo locks, no una promesa de FIFO entre requests.
6. Antes de transacción, un intento de retry de consumos del comercio/local, presupuesto máximo2s, por compra o entrada completa. No mantener locks POS/compra durante ese intento. Si falla, agota presupuesto o quedan pendientes, continuar: tomar saldo disponible bajo lock, registrar compra y guardar promedio. No validar corte de conteo ni devolver rechazo por pendientes; un consumo posterior sólo cambia cantidad. La aproximación queda aceptada; **no recalcular promedio al recuperar el consumo**.
7. Conservar autorización, aislamiento y validaciones ordinarias; «no rechazar compras» aplica al atraso/fallo del aplicador, no a escrituras ajenas, archivadas, inválidas o indisponibilidad de su propio commit. No crear idempotencia de compras distinta del contrato actual. Mantener la durable de consumo, que no toca costo.
8. Futuro rollout aditivo: columnas, corte verificable/drain de writers antiguos, inicialización retomable con locks/marcador y validación local; luego activar writer nuevo. No convivir indefinidamente con compras antiguas que no ponderan ni inicializar de nuevo sobre un promedio ya activo. Mantener ledger/último costo para rollback. Cada operación PROD/push requiere permiso separado; este ADR no autoriza ni ejecuta código o migraciones.

## Alternativas y consecuencias

- Reutilizar `last_unit_cost` para promedio: desdibuja su significado, dificulta comprobar la apertura y confunde consumidores existentes. Campo separado permite transición explícita sin cambiar aún el costo del producto.
- Reconstruir historial para apertura: descartado por respuesta del owner; se toma último costo local. No presentar la apertura como promedio histórico reconstruido.
- Recalcular por `occurred_at`: descartado; compras atrasadas participan al registrarse. Serialización y redondeo móvil pueden producir diferencias por orden, según regla aprobada.
- Rechazar compra hasta completar pendientes: recomendación expresamente corregida. Se privilegia registrar una compra válida; puede quedar un promedio diferente del que daría un saldo ya actualizado, y la recuperación no lo repara retroactivamente. No cuantificar como garantizado el tamaño del error.
- Cambiar costo al consumir/contar: descartado por respuesta del owner. El conteo puede aumentar stock al costo vigente y consumo puede llevarlo a negativo; próxima compra con precio y saldo no positivo usa precio nuevo.
- Guardar null sin marcador y reseed mediante `coalesce`: confunde apertura pendiente con costo realmente desconocido. Marcador técnico hace la inicialización de una sola vez comprobable y retomable.

## Estado y límites

Diseño aceptado, decisiones del owner en spec0228, sin hallazgos de producto bloqueantes. **Entrega sólo spec/ADR**, base `39d00edfca6347773c03a015a2ffcd1a1d38b0dd`; ninguna afirmación de implementación, migración ni QA funcional. No INDEX/TASKS/estados, publicación, costo congelado en venta ni lectura nueva del costo del producto. SQL/corte de writers y pruebas focales se ejecutarán en el encargo de implementación; no alterar contratos/costos de otras piezas por inferencia.
