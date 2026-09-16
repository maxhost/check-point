---
adr: 0067
fecha: 2026-09-16
estado: aceptada (decision del ORQUESTADOR al implementar la fase A5 de la spec 0065; el owner puede revertirla)
resumen: El paso 0 del tick de marketing pide un `pg_try_advisory_lock` de SESION, y esta base de codigo no puede sostener uno: `getDb()` es el driver HTTP (una conexion por request) y el pool de WebSocket solo fija un cliente mientras dura una TRANSACCION. Asi que el tick entero corre dentro de UNA transaccion interactiva que toma `pg_try_advisory_xact_lock`, se libera sola al commit y no deja ningun `unlock` que se pueda filtrar. El costo es real y se declara: los `select … for update` por consumidor quedan tomados hasta que la corrida termina, asi que un tick largo bloquea a quien escriba `consumer_account`. A la escala de hoy (dos crons diarios, un tick cada 6 h, una base chica) es el canje correcto; el dia que no lo sea, la salida es fijar una conexion de sesion, no aflojar el lock. La exclusion es GLOBAL por diseño, y eso obliga a un unico costurón de test: `lockNamespace`, que la produccion nunca pasa.
---

# 0067 — El tick de marketing se serializa con un lock de transaccion, no de sesion

## Contexto

La spec 0065 (paso 0 del tick) pide: «Un tick por vez: `pg_try_advisory_lock(<clave fija>)`; si no
lo obtiene, responde 200 con `{skipped: 'tick_in_flight'}`». No es decorativo: la cuota por negocio
se cuenta bajo el lock del **consumidor**, que no cubre el conjunto contado, asi que dos ticks
solapados lockean consumidores distintos, ambos leen 49 y activan: 51.

Un `pg_try_advisory_lock` pelado es un lock de **sesion**: vive hasta que se lo libera o hasta que
la conexion muere. Eso exige que **todas** las sentencias de la corrida viajen por la **misma**
conexion, y este repo no lo puede prometer:

- `getDb()` devuelve el driver **HTTP** de Neon (`drizzle-orm/neon-http`): cada sentencia es un
  request, potencialmente por otra conexion.
- `withDbTransaction` usa el pool de **WebSocket**, que fija un cliente **solo mientras dura la
  transaccion** (`server/db.ts`).

## Decision

El tick entero corre dentro de **una** `withDbTransaction`, y el paso 0 toma
**`pg_try_advisory_xact_lock(hashtextextended('marketing_tick', 0))`**. Si no lo obtiene, devuelve
`{skipped: 'tick_in_flight'}` sin escribir nada. El lock se libera en el commit.

## Consecuencias

- **El costo, declarado:** los locks de fila (`select … for update` por consumidor, paso 4) se
  sostienen hasta el final de la corrida. Un tick largo bloquea a quien escriba esas filas. A la
  escala de hoy es aceptable; cuando deje de serlo, la salida es una conexion de sesion fijada
  (exponer el `Pool` de `db.ts` y tomar el lock de sesion ahi), **no** un lock mas debil.
- **Un beneficio no buscado:** la corrida es atomica. Un fallo a mitad no deja turnos activados sin
  su `pass_placement`.
- **La exclusion es GLOBAL**, y eso rompe las suites en paralelo: cada archivo de integracion siembra
  su propio negocio pero comparte la base, asi que con una sola clave se contestan
  `tick_in_flight` entre si (**medido**: 17 rojos en la corrida completa, cero en aislamiento). Por
  eso `TickOptions` lleva **`lockNamespace`**, un costurón de test —el unico de este modulo que puede
  debilitar una garantia de produccion— documentado como tal: la ruta llama a `runMarketingTick()`
  sin argumentos, y la suite que asevera el skip usa el default de produccion.
