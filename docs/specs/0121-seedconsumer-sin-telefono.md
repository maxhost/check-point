---
spec: 0121
fecha: 2026-10-02
estado: implementada
resumen: El cliente de prueba de `seedConsumer` nace sin telefono, como el cliente real desde la 0119; elimina el choque intermitente contra el unico de `phone_e164`.
disjunta: si
archivos: apps/merchant/src/server/counter-integration-support.ts
---

# 0121 — `seedConsumer` sin telefono

> Cierra la fila **#58** de `PARQUEADO.md`. Decision del owner (2026-10-02): **opcion B** — «para
> que queremos este telefono si ya no es obligatorio ni lo pedimos en el registro».

## Problema

- `apps/merchant/src/server/counter-integration-support.ts:235` siembra cada cliente con
  `` phoneE164: `+593${Math.floor(100000000 + Math.random() * 800000000)}` `` sobre
  `core.consumer_account`, que tiene un unico sobre `phone_e164`. Contra una rama Neon compartida
  que acumula filas, es una colision de cumpleaños: `NeonDbError: duplicate key value violates
  unique constraint "consumer_account_phone_unique"` (reproducido por el revisor de la 0075 en
  `marketing-merit.neon.integration.test.ts`, que aislado da verde).
- Desde la 0119 (migracion `0061`) `phone_e164` es **nullable** (`packages/db/src/schema/consumer.ts:28`)
  y el alta real no pide telefono: el cliente que siembra el helper ya no se parece al de produccion.
- Medido el 2026-10-02: **42 archivos** llaman `seedConsumer()`; **ninguno lee el telefono** del
  cliente sembrado (`rg -il phone` sobre esos 42 da solo el helper y
  `marketing-refresh.neon.integration.test.ts:158`, que habla de hacer sonar el telefono, no del
  numero). `seedConsumer` devuelve `{ id, qrToken }`, sin telefono.

## Alcance

**Entra:** borrar la linea `phoneE164` del `insert` de `seedConsumer` (queda `NULL`, el default de la
columna). Ajustar su docblock si menciona el telefono.

**No entra:**
- Los telefonos al azar de `business-status.neon.integration.test.ts:127,180,236` (son ENTRADA de
  `enroll(...)`, no del helper; cambiarlos cambia lo que prueban). Declarado abajo.
- `consumer/programs.neon.integration.test.ts:92,100` (`Date.now()` + sufijo, otro mecanismo).
- Cualquier cambio a esquema, migraciones o codigo de produccion.

## Diseño

Una linea menos en un helper de test. `business_customer.phone_e164` tambien es nullable y su unico
admite varios `NULL` (`packages/db/src/schema/business-customer.ts:53-67`), asi que la proyeccion de
clientes por negocio no choca con varios clientes sin telefono. Si algun test de los 42 resultara
depender del telefono, **se para y se informa** — no se le reinventa un telefono.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/counter-integration-support.ts` | editar (borrar la linea 235) |

**Disjunta?** Si.

## Definition of Done

- [ ] `rg -n 'phoneE164' apps/merchant/src/server/counter-integration-support.ts` → vacio.
- [ ] Las suites `.neon.integration` que llaman `seedConsumer()` corren verdes con
      `tools/neon-test.sh` (lista: `rg -l 'seedConsumer\(' apps packages -g '*.neon.integration.test.ts'`),
      salida transcripta con el conteo de archivos y tests. **Nunca contra `DATABASE_URL`.**
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`.
- [ ] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | En `seedConsumer`, `phoneE164: "+593999999999"` (telefono constante: la forma extrema de «volver a sembrar un telefono») | `marketing-merit.neon.integration.test.ts` (4 llamadas a `seedConsumer()`), con `consumer_account_phone_unique` en el mensaje. **A medir, no predicho**: si da verde, se transcribe y se declara |

M1 prueba que las suites **ven** un choque de telefono; con la linea borrada la causa no existe.

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia limpia.
**Leer la asercion del rojo**: tiene que hablar del unico de telefono, no del setup.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta y
va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **Un flake no se reproduce a pedido**: no hay oraculo de «nunca mas choca». La garantia es
  estructural (sin telefono no hay unico que violar), no estadistica.
- **Hermano de clase sin tocar:** `business-status.neon.integration.test.ts` sigue sorteando
  telefonos en un rango de 9 M. Queda como hallazgo a decidir en `PARQUEADO.md`.

## Handoff

**UN implementador, UN revisor independiente al final** (ADR 0071).

## Abierto

Nada.
