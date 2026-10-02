---
spec: 0127
fecha: 2026-10-02
estado: implementada
resumen: Dos suites de PassKit siguen esperando el `204` de antes del piso de marca de `listUpdatedSerials` (`7275abb`); pasan a usar el tag que devuelve el servidor, como hace el iPhone.
disjunta: si
archivos: apps/merchant/src/server/wallet-push.neon.integration.test.ts, apps/merchant/src/server/marketing-refresh.neon.integration.test.ts
---

# 0127 — Tests de PassKit con el piso de marca

> Pedido del owner el 2026-10-02 («resolvamos el spec de wallet-push»). El comportamiento del codigo NO cambia:
> el piso de marca de `7275abb` se conserva.

## Problema

- `packages/domain/src/server/wallet/passkit.ts:128` — `PASS_BRAND_UPDATED_AT = Date.parse("2026-10-01T15:28:00Z")`
  (`1790868480000`), y `:159-162` toma `t = max(messageUpdatedAt ?? 0, PASS_BRAND_UPDATED_AT)` por pase. Lo agrego
  `7275abb` («Refresh existing Apple passes after brand change») para que todo iPhone re-baje el pase con la marca
  nueva. Ningun test se actualizo.
- `wallet-push.neon.integration.test.ts:199` espera `null` en el primer poll sin tag («Nothing changed yet → 204»);
  ahora devuelve `{ lastUpdated: '1790868480000', serialNumbers: [serial] }`. Rojo reproducido por el orquestador.
- `marketing-refresh.neon.integration.test.ts:181-185` pide con `passesUpdatedSince: String(NOW)` y
  `NOW = 2026-09-16` (`:50`), anterior al piso: `t = piso > NOW` → devuelve el serial y el `toBeNull` falla.

## Alcance

**Entra:** las aserciones de `listUpdatedSerials` de esas dos suites.

**No entra:** `passkit.ts` (el piso se queda), los relojes `NOW` de las suites, cualquier otro test.

## Diseño

El iPhone hace un ida y vuelta: manda el `lastUpdated` que le dio el servidor la vez anterior. Los tests pasan a
hacer lo mismo en vez de inventar un tag:

1. **`wallet-push`, en lugar de `:199`:** el primer poll sin tag devuelve
   `{ lastUpdated: "1790868480000", serialNumbers: [pass.serialNumber] }` (`toEqual`: pinnea el piso), y un
   segundo poll con `passesUpdatedSince: first.lastUpdated` devuelve `null` (lo que la linea vieja queria decir:
   «nada cambio desde el tag del dispositivo»). El resto del caso (`:202-218`) queda igual: `changedAt` es el reloj
   real, posterior al piso.
2. **`marketing-refresh`, `:181-185`:** el poll de «despues» usa `passesUpdatedSince: listed!.lastUpdated` en vez de
   `String(NOW.getTime())`, y sigue esperando `null`.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/wallet-push.neon.integration.test.ts` | editar |
| `apps/merchant/src/server/marketing-refresh.neon.integration.test.ts` | editar |

**Disjunta?** Si.

## Definition of Done

- [x] `tools/neon-test.sh` sobre las dos suites, de a una → verdes, conteos transcriptos. Nunca contra `DATABASE_URL`.
      Si `marketing-refresh` da el rojo intermitente `{"skipped":"tick_in_flight"}`, re-correrla sola y transcribir
      las dos corridas; no se arregla aca.
- [x] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [x] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `passkit.ts:159-162`: sacar el piso (`const t = r.messageUpdatedAt?.getTime() ?? 0;`) | `wallet-push.neon.integration.test.ts:201`, en el nuevo `toEqual` del primer poll. **Medido:** recibe `{ lastUpdated: '0', serialNumbers: [serial] }` (sin piso, `t = 0` y un poll sin tag no filtra), NO `null` como decia esta fila antes de medir; el rojo es por el valor del piso. Revertida |

**Protocolo:** `shasum` limpio → fila de bitacora antes de medir → etiqueta `MUTATION` → medir y transcribir →
revertir con `diff` contra copia limpia. Leer la asercion del rojo.

## Declarado AFUERA

- Mientras el reloj de `marketing-refresh` sea anterior al piso, el tag que pone el tick (`message_updated_at = NOW`)
  queda tapado por el piso en el `lastUpdated`; el caso `:172-176` sigue pinneando `messageUpdatedAt = NOW` en la fila.
- El piso es permanente: no hay fecha de retiro (no la pidio nadie).

## Handoff

UN implementador; revision liviana del orquestador.

## Abierto

Nada.
