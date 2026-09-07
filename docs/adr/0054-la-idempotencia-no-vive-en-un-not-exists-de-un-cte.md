---
adr: 0054
fecha: 2026-09-07
estado: aceptada
resumen: La idempotencia de la acreditación (0030) descansaba en que EvalPlanQual re-evaluara un `NOT EXISTS` dentro de un CTE; se verificó que es FALSO (Postgres lo planea como InitPlan + One-Time Filter, una sola vez, antes del lock) y que produce doble acreditación con el mismo `client_request_id` concurrente. Fix mínimo del código vivo: quitar el `ON CONFLICT DO NOTHING` para que el 23505 aborte y revierta. Estándar hacia adelante: todo flujo que mute saldo usa transacción interactiva (`withDbTransaction`) con `SELECT … FOR UPDATE`, y el índice único queda como red, no como mecanismo.
---

# 0054 — La idempotencia no vive en un `NOT EXISTS` de un CTE

> Nace de la revisión independiente del plan de la **spec 0055** (canje). Corrige un
> invariante de la **spec 0030** que estaba mal documentado *y* mal implementado, y fija el
> patrón para el canje y para todo flujo futuro que mueva saldo. Lo implementan la **spec
> 0056** (fix del grant) y la **spec 0055** (canje).

## Contexto

`orders.persistGrant` (spec 0030) resuelve el otorgamiento en **un solo statement** con CTEs:
un `UPDATE` que incrementa el saldo sólo si `NOT EXISTS` una orden con ese
`(business_id, client_request_id)`, un `INSERT` de la orden con `ON CONFLICT DO NOTHING`, y el
outbox del push. El comentario del código (`orders.ts:66-71`) afirmaba que, bajo concurrencia
exacta, el segundo escritor bloquea en el lock de fila y **re-evalúa su qual `NOT EXISTS`
(EvalPlanQual)** contra la orden ya presente, y por eso el saldo nunca se incrementa dos veces.

**Es falso, y se verificó ejecutándolo** (Postgres 17, contenedor efímero local; no Neon, no
prod):

- El `EXPLAIN` del statement muestra que ese `NOT EXISTS` **no correlacionado** se planea como
  **`InitPlan` + `One-Time Filter`**: se evalúa **una sola vez, antes de tomar el lock**. El
  guard que sí vive en el `Filter` del scan —y que sí se re-evalúa bajo EPQ— es el de saldo,
  que en el grant no existe: por eso nunca se notó.
- Carrera reproducida: saldo 100, dos requests concurrentes con **el mismo**
  `clientRequestId`, +40 cada uno → **saldo final 180**, con **una sola** fila en `core.order`
  que dice `balance_after = 140`.
- El `ON CONFLICT DO NOTHING` **oculta el daño**: el segundo `INSERT` se traga en silencio, el
  statement devuelve cero filas, el llamador re-lee y responde *«reintento idempotente, saldo
  140»* mientras el saldo real es 180.

El disparador no es de laboratorio: la consola mintea el `requestId` **en el escaneo**
(`counter-console.tsx:90`) y lo mantiene estable hasta el reset, así que un reintento de red o
un doble submit solapado es exactamente el caso para el que la idempotencia existe.

Y el patrón estaba por replicarse en el **canje** (spec 0055), donde el mismo bug no regala
puntos: **los destruye**.

## Decisión

### 1. El `ON CONFLICT DO NOTHING` se va del statement del grant (fix mínimo del código vivo)

Sin él, el duplicado concurrente levanta `23505`, que **aborta el statement completo y revierte
el incremento**. Verificado en la misma sonda: saldo 140, una orden. `grant.ts:270` **ya**
captura `23505` y re-lee la orden existente, así que el camino de reintento no cambia; y el
reintento **secuencial** sigue devolviendo cero filas sin incrementar ni fallar (ahí el
`NOT EXISTS` sí alcanza, porque no hay carrera).

Es el cambio más chico que corrige el bug, y por eso es el que toca código vivo (spec 0056).
**No** se reescribe el grant entero bajo la urgencia de un bug.

### 2. Todo flujo NUEVO que mute saldo usa transacción interactiva

`withDbTransaction` (`db.ts:36`, ya existente y documentado *«for flows that must hold a
row/advisory lock across steps»*): **`SELECT … FOR UPDATE` → decidir en TypeScript con la
función pura → escribir**. El canje (spec 0055) nace así.

Dos razones, y la segunda es la que más pesa en este repo:

- **La corrección deja de depender de una propiedad del planner.** Que un qual se re-evalúe o
  no bajo EPQ depende de cómo Postgres eligió planear la subconsulta — no está en el contrato,
  no se ve en el código, y ningún test unitario lo mira. Con el lock tomado explícitamente, la
  serialización es una instrucción, no una inferencia.
- **La función pura pasa a ser el decisor real.** En la variante de un solo statement, la
  aritmética vive en el SQL (`GREATEST(...)`) y `planRedemption` es una re-implementación
  paralela: los unit tests pueden estar todos verdes mientras el SQL debita otra cosa. Es
  exactamente el hueco que la spec 0055 declaraba sin cubrir, y la misma trampa que
  `CLAUDE.md` documenta para la tarea 38 (*extraer convierte una propiedad de comportamiento en
  una de decisión y deja el cableado sin oráculo*). Con la transacción interactiva, el valor
  que decide la función pura **es** el que se escribe.

El costo aceptado: el canje usa el pool WS en vez de `neon-http`, y conviven dos patrones en
`server/counter/*` hasta que el grant migre (deuda anotada, no urgente — con el fix (1) el
grant es correcto).

### 3. El índice único es la red, no el mecanismo

`unique (business_id, client_request_id)` se conserva en las dos tablas y **es lo único que
detuvo el daño** en la carrera reproducida. Pero un índice único no puede impedir un débito o
un incremento: sólo la fila duplicada. La idempotencia la sostiene el lock; el índice es el
backstop que convierte un bug silencioso en un `23505` ruidoso.

### 4. Los tests de idempotencia aseveran el SALDO por SQL, no la respuesta de la API

En la carrera reproducida la API respondía el saldo *correcto según el log* mientras la fila
tenía otro. Un test que verifique la respuesta HTTP —o que cuente filas de auditoría— queda
**verde con el bug**. La aserción tiene que ser el `points_balance`/`stamps_count` leído por
SQL después de la carrera.

## Consecuencias

- La acreditación en producción está **corrompiendo saldos en silencio** hasta que se aplique
  (1). Prioridad por encima del canje (decisión del owner, 2026-09-07).
- Todo test de idempotencia existente que sólo mire la respuesta o el conteo de órdenes es
  **sospechoso**: pasaba con el bug presente.
- La verificación se hizo en **Postgres local**, no sobre `neon-http`. La spec 0056 exige
  reproducir la carrera y su fix en una **rama Neon efímera** antes de tocar prod.
- Hacia adelante, "atómico e idempotente" deja de ser una afirmación de comentario: se
  demuestra con una carrera que asevera el saldo, o no se afirma.
