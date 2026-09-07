---
spec: 0056
fecha: 2026-09-07
estado: cerrada
resumen: Fix del bug de producción de la acreditación (0030) — con el mismo `client_request_id` en dos requests concurrentes, `persistGrant` incrementa el saldo DOS veces y deja una sola orden que reporta el saldo intermedio. Se quita el `ON CONFLICT DO NOTHING` para que el 23505 aborte el statement y revierta el incremento (camino de 23505 ya existente en `grant.ts`), y se agrega el test de carrera que asevera el SALDO por SQL, no la respuesta de la API.
disjunta: sí
archivos: `apps/merchant/src/server/counter/orders.ts`, test de integración Neon del dominio counter
---

# 0056 — La acreditación no puede acreditar dos veces

> Implementa el **ADR 0054**. Va **antes** que la spec 0055 (canje) por decisión del owner
> (2026-09-07): el bug está vivo en producción y el canje iba a heredar el mismo patrón.

## Problema

`orders.persistGrant` (spec 0030) promete un otorgamiento *atómico e idempotente*. **La
idempotencia no funciona bajo concurrencia**, y el modo de falla es silencioso.

El statement incrementa el saldo sólo si `NOT EXISTS` una orden con ese
`(business_id, client_request_id)`. El comentario del código (`orders.ts:66-71`) afirma que el
segundo escritor bloquea en el lock de fila y **re-evalúa ese `NOT EXISTS` bajo EvalPlanQual**.
**Falso**: al no estar correlacionado, Postgres lo planea como **`InitPlan` + `One-Time
Filter`** — se evalúa **una vez, antes del lock**. (El único qual que sí se re-evalúa es el que
vive en el `Filter` del scan; el grant no tiene ninguno.)

**Reproducido** (Postgres 17, contenedor efímero local; no Neon, no prod), con la forma real
del statement:

- Saldo 100, dos requests concurrentes con **el mismo** `clientRequestId`, +40 cada uno.
- Resultado: **saldo 180**, con **una sola** fila en `core.order` que dice `balance_after = 140`.
- El `ON CONFLICT DO NOTHING` se traga el segundo `INSERT`: el statement devuelve cero filas,
  el llamador re-lee y responde *«reintento idempotente, saldo 140»*. **La API reporta un saldo
  que no existe.**

No es un caso de laboratorio: `counter-console.tsx:90` mintea el `requestId` **en el escaneo** y
lo mantiene estable hasta el reset, así que un reintento de red, un doble submit solapado o un
back/forward disparan exactamente esto.

## Alcance

**Entra:**

- Quitar `ON CONFLICT (business_id, client_request_id) DO NOTHING` del `INSERT` de la orden en
  `persistGrant`.
- Corregir el comentario de `orders.ts` que documenta el invariante falso (es la razón por la
  que nadie lo revisó dos veces).
- **Test de integración de carrera** que asevera el **saldo leído por SQL** después de dos
  grants concurrentes con el mismo `clientRequestId`.
- Auditar los tests de idempotencia existentes del dominio counter: los que sólo miran la
  respuesta HTTP o el conteo de órdenes **pasaban con el bug presente** y hay que decir cuál
  cubre qué.

**No entra (explícito):**

- **Migrar `persistGrant` a `withDbTransaction`.** El ADR 0054 §2 fija la transacción
  interactiva para los flujos **nuevos**; con este fix el grant queda correcto. Reescribirlo
  bajo la urgencia de un bug es cambiar más superficie de la necesaria. Queda como deuda
  anotada.
- El canje (spec 0055), que nace con el patrón nuevo.
- El outbox de push, el cálculo de acumulación, la UI del mostrador: sin cambios.
- Cualquier migración de datos. **No hay**: el esquema no cambia.
- **Reparar los saldos ya corrompidos en prod.** Si el owner quiere auditarlos, es una consulta
  aparte (buscar membresías cuyo `points_balance`/`stamps_count` no coincida con la suma de sus
  órdenes); no entra en el fix.

## Diseño

### Especificación técnica

Un solo cambio de comportamiento en `server/counter/orders.ts`:

```
   INSERT INTO core."order" (...)
   SELECT ... FROM bumped
-  ON CONFLICT (business_id, client_request_id) DO NOTHING
   RETURNING id, units_granted, balance_after, accrual_kind
```

**Por qué alcanza y por qué no rompe el reintento.** Hay dos caminos distintos y sólo uno
cambia:

| Caso | Antes | Después |
|---|---|---|
| Reintento **secuencial** (la orden ya está commiteada) | `NOT EXISTS` es falso → `bumped` vacío → `ins` no inserta nada (ni siquiera hay conflicto) → 0 filas → el llamador re-lee | **idéntico** |
| Reintento **concurrente** (mismo id, en vuelo) | el segundo **incrementa igual**, su INSERT se traga en silencio → 0 filas → el llamador re-lee y **miente** | el segundo levanta **`23505`** → **el statement entero aborta y el incremento se revierte** → `grant.ts:270` lo captura y re-lee la orden del ganador |

`grant.ts` **ya** tiene el camino: `if (pgErrorCode(error) === "23505") granted = await
readOrderByRequest(...)`. No hay que escribirlo, sólo dejar de impedir que se use.

**Verificado end-to-end en la sonda local**, con el fix aplicado: carrera → `23505` en el
perdedor, **saldo 140**, una orden; reintento secuencial → 0 filas, sin incremento y sin error.

**Un statement = una transacción implícita**, así que el rollback del incremento no necesita
transacción explícita. Esto es lo que hay que confirmar sobre `neon-http` (ver pruebas).

### Arquitectura de referencia

- **ADR 0054** — la idempotencia no vive en un `NOT EXISTS` de un CTE (decisión §1 y §4).
- **spec 0030** — de la que este fix corrige un invariante; el resto de 0030 no se toca.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/counter/orders.ts` | editar — quitar `ON CONFLICT DO NOTHING` + corregir el comentario del invariante |
| `apps/merchant/src/server/counter*.neon.integration.test.ts` | editar/crear — carrera con aserción de saldo por SQL |

### Disjunta?

**Sí.** Un archivo del dominio counter y su test. La spec 0055 (canje) toca ese mismo dominio
pero **está por implementarse después, por decisión del owner**, y depende de este fix: se
serializa detrás. Sin colisión con nada implementado.

## Definition of Done

- [ ] Dos grants concurrentes con el mismo `clientRequestId` → **el saldo sube UNA sola vez**,
      verificado leyendo `points_balance`/`stamps_count` **por SQL**.
- [ ] Existe **exactamente una** `core.order`, y su `balance_after` **coincide con el saldo
      real** de la membresía.
- [ ] El reintento **secuencial** sigue siendo idempotente: misma orden devuelta, sin
      incremento, sin error 5xx.
- [ ] El push se encola **una sola vez** en la carrera (una fila `wallet_push_queue`).
- [ ] El comentario de `orders.ts` ya no afirma que EvalPlanQual re-evalúa el `NOT EXISTS`.
- [ ] **Mutación**: reponer el `ON CONFLICT DO NOTHING` pone **rojo** el test de carrera.
- [ ] Gates verdes (typecheck, lint, test, build) + regresión del dominio counter.
- [ ] **PASS de revisor independiente**.

## Plan de pruebas y verificación

- [ ] **Integración Neon (rama efímera)**: dos `persistGrant` **concurrentes** con el mismo
      `clientRequestId` (lanzados con `Promise.all`, sin serializar), y después **leer el saldo
      por SQL**. Aserciones: saldo = inicial + units (una vez), 1 orden, `balance_after` =
      saldo, 1 fila de push.
- [ ] **Integración Neon**: reintento **secuencial** → misma orden, saldo intacto.
- [ ] **Confirmar sobre `neon-http`** que el `23505` aborta y revierte el incremento (la sonda
      que encontró el bug fue Postgres local; el driver HTTP es lo que falta verificar). Si el
      rollback no ocurriera sobre HTTP, este fix **no sirve** y hay que ir a
      `withDbTransaction` también para el grant — es la condición de reapertura de esta spec.
- [ ] **Mutación** (evidencia de que el test muerde): reponer el `ON CONFLICT DO NOTHING` →
      el test de carrera tiene que ponerse **rojo**. Si queda verde, el test no está
      reproduciendo la concurrencia y no vale.
- [ ] **Regresión**: la suite de integración del counter (0030/0043) y los unit del dominio.
- [ ] **Auditar** los tests de idempotencia existentes: listar cuáles pasaban con el bug y por
      qué (mirar la respuesta HTTP o contar órdenes no distingue el caso malo del bueno).
- [ ] **Comandos exactos** (Node 24, scripts de ROOT): `pnpm run typecheck && pnpm run lint &&
      pnpm run test && pnpm run build` + integración Neon del dominio counter.
- [ ] **Verificación en prod tras el deploy**: confirmar por SQL (MCP) que no hay membresías
      cuyo saldo difiera de la suma de `units_granted` de sus órdenes.

## Handoff requerido

Implementador + **revisor independiente** con `PASS` verificable (`docs/AGENT-WORKFLOW.md`).
El revisor debe **reproducir la carrera él mismo** antes de firmar: es el único oráculo que
distingue este fix de un no-op. Sin migración: el deploy es el fix.

## Abierto

Nada bloquea. **Riesgo declarado:** que el `23505` sobre `neon-http` no revierta el incremento
(por ejemplo, si el proxy fragmentara el statement). Es lo primero que verifica el plan de
pruebas; si pasa, la spec se reabre con `withDbTransaction` como alternativa ya identificada.

**Fuera de alcance pero anotado:** los saldos que el bug ya pudo corromper en prod. Se detectan
comparando cada membresía contra la suma de sus órdenes; repararlos es decisión del owner.
