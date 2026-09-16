---
adr: 0066
fecha: 2026-09-15
estado: aceptada (decision del owner, 2026-09-15). Supersede la decision 4 del ADR 0065 («cola por rotacion pura, merito NO en fase 1») y da vuelta la alternativa que ese ADR habia descartado
resumen: El owner decidio que el merito con balanza rige DESDE EL DIA UNO en proximidad, no cuando el holdout de señal. El ADR 0065 §4 lo habia diferido con un argumento numerico CORRECTO — pero que solo aplica a la TASA CRUDA de «compro en su ventana», que premia al negocio que apunta a clientes que iban a volver solos. La forma de cumplir la decision del owner sin reintroducir ese bug es rankear por LIFT (tasa con turno menos tasa del holdout), que es exactamente la resta que separa los dos casos del ejemplo del 0065, y que existe desde el dia uno porque el holdout se retiene desde el primer turno. El problema real del dia uno no es el sesgo sino la MUESTRA: con pocos turnos el lift es ruido. Eso lo resuelve la «balanza con piso para debutantes» que el owner pidio: encogimiento (shrinkage) hacia el lift promedio global con un peso de prior, de modo que un negocio sin historia arranca EN EL PROMEDIO —no ultimo, no primero— y solo se despega cuando acumula turnos. FIFO sobrevive como desempate, asi que la cola sigue siendo determinista y auditable.
---

# 0066 — El merito en proximidad rige desde el dia uno, y se mide por lift

## Contexto

El ADR 0065 §4 decidio **cola por rotacion pura (FIFO)** y dejo el merito por resultado fuera de la
fase 1 de proximidad, con este argumento numerico (que sigue en pie y hay que conservar):

> A apunta a 100 dormidos que iban a volver solos (30 vuelven sin campaña, 33 con) y mide **33 %**;
> B apunta a 100 perdidos (2 sin, 10 con) y mide **10 %**. A gana el ranking generando **+3** contra
> **+8** de B, y el canal deriva hacia quien no lo necesitaba.

El owner, al revisar la spec 0065, decidio lo contrario: **«desde dia uno»**. La decision de producto
de fondo ya era suya desde antes («merito con balanza, piso para debutantes», ADR 0064 §6); lo que el
0065 §4 hizo fue **diferirla en este canal**, y eso lo decidio el orquestador, no el owner.

## Decision

1. **El merito rige desde el primer turno.** `planConsumerPlacement` deja de ordenar la cola por
   `queued_at asc` puro.

2. **La metrica es el LIFT, no la tasa cruda.** Por negocio, sobre turnos ya vencidos (`done`):

   ```
   lift(negocio) = compras_en_ventana / turnos_colocados  −  compras_en_ventana / turnos_holdout
   ```

   Es **literalmente la resta que separa los dos casos del ejemplo de arriba**: A da 33−30 = +3 y B
   da 10−2 = +8, asi que B gana, que es el resultado correcto. **El argumento del 0065 §4 no era un
   argumento contra el merito: era un argumento contra la tasa cruda.** El holdout se retiene desde
   el primer turno (ADR 0065 §5), asi que el insumo existe desde el dia uno; lo que no existe al
   principio es *volumen*, y eso es el punto 3.

3. **Balanza con piso para debutantes: encogimiento hacia el promedio global.**

   ```
   score(negocio) = (lift_observado · n  +  lift_global · α) / (n + α)
   ```

   con `n` = turnos vencidos del negocio y `α` = peso del prior (**α = 20 turnos, ORQUESTADOR**).
   Consecuencias buscadas:
   - un negocio **sin historia** (`n = 0`) puntua exactamente `lift_global`: entra **en el medio de
     la tabla**, no ultimo (ese es el «piso para debutantes») y no primero;
   - un negocio con **1 de 1** no le gana a uno con **40 de 50**: con `n = 1` el observado pesa 1/21;
   - a medida que acumula turnos, su propio numero manda. Eso es la «balanza».
   - `lift_global` cuando **todavia no hay ningun turno vencido en toda la plataforma** = **0**
     *(ORQUESTADOR)*; con todos los negocios en 0, el orden queda determinado por el desempate.

4. **FIFO sobrevive como desempate** (`queued_at asc`), y con el `α` de arranque es **el criterio
   efectivo durante las primeras semanas**. La cola sigue siendo determinista: dos corridas con los
   mismos datos producen el mismo orden, que es lo que la hace testeable.

5. **El score se calcula en SQL y entra INYECTADO al planner.** `planConsumerPlacement` sigue siendo
   una funcion **pura** sin DB (ADR 0065 §8): recibe `businessScores: Map<businessId, number>` como
   input. Sin esto el ranking no tiene oraculo barato.

## Consecuencias

- **Un negocio puede quedar sistematicamente ultimo** y no enterarse: el ranking no se muestra en el
  backoffice (no entra en la spec 0065). Es deuda declarada, no un olvido.
- **El lift de un negocio chico es ruidoso aunque este encogido**: con 10 turnos colocados y 1
  retenido, el segundo termino es 0 o 1, o sea 0 % o 100 %. El `α = 20` lo aplasta hacia el
  promedio, que es precisamente para lo que esta, pero **el numero no es una medicion del negocio
  hasta bien entrada la operacion**. Por eso el holdout del 10 % no se toca.
- **Sigue sin haber reporte de impresiones** (ADR 0065): el lift mide «compro en ventana», no «vio
  el pase». Un negocio en una zona de poco transito puntua bajo sin ser peor. Lo unico que lo
  corrige es que el holdout es **del mismo negocio**, asi que el sesgo de transito esta en los dos
  terminos de la resta y se cancela en buena medida. **Esta cancelacion es un argumento, no una
  medicion** — se revisa con datos reales.
- Cambia el DoD de la spec 0065: «FIFO» deja de ser la propiedad a pinnear; pasa a serlo el orden
  por score con FIFO como desempate.

## Alternativas descartadas

- **Rankear por tasa cruda de «compro en ventana».** Es el bug que el ADR 0065 §4 documento con
  numeros. Cumplir «desde dia uno» con la tasa cruda habria sido obedecer la letra y romper el fondo.
- **Esperar a que el holdout de significancia estadistica para encender el merito.** Es lo que decia
  el 0065 §4; el owner lo rechazo. El encogimiento es la version continua de esa idea: en vez de un
  interruptor que espera un umbral, el peso del dato propio crece con el dato propio.
- **Merito por cupones canjeados.** Solo existe si la campaña tiene cupon, asi que no compara
  campañas entre si.

## Referencias

- ADR 0064 §6 (el owner decide merito con balanza y piso para debutantes).
- ADR 0065 §4 (superseded por este), §5 (holdout), §8 (planner puro).
- ADR 0021 (calidad de metricas: el lift es *estimado*, no *observado*).
- Spec 0065 (implementa).
