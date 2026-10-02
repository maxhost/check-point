---
spec: 0134
fecha: 2026-10-02
estado: implementada
resumen: Las 4 suites Neon que tienen roja la CI de `main` (PARQUEADO #69) se ponen al dia con cambios intencionales: voseo de billing-state, campos del mostrador (spec 0121), politicas del rol del cliente (migracion 0060) y el boton «Bajar a Free» leido por su DOM y no por su string.
disjunta: si
archivos: apps/merchant/src/app/api/billing/state/billing-state.neon.integration.test.ts, apps/merchant/src/server/counter-redeem-surfaces.neon.integration.test.ts, apps/merchant/src/server/customers-migration.neon.integration.test.ts, apps/merchant/src/server/billing-pages.neon.integration.test.ts
---

# 0134 — CI de `main` verde: las cuatro suites Neon

> Pedido del owner el 2026-10-02. Cierra PARQUEADO #69. Solo tests: ningun cambio de producto.

## Problema (reproducido con `tools/neon-test.sh` el 2026-10-02: 4 failed / 17 passed, uno por archivo)

1. `billing-state.neon.integration.test.ts:134` espera `"Verificá tu email para gestionar la suscripción."`; el codigo
   dice «Verifica» (tuteo, `4a69db7`, `apps/merchant/COPY.md`).
2. `counter-redeem-surfaces.neon.integration.test.ts:133` asevera las claves EXACTAS de `resolved.catalog` como
   `["categories","products"]`; la spec **0121** (mostrador) extiende `catalog` con `habitualProductIds: string[]` y
   `lastPurchase: {items:{productId,quantity}[]} | null` a proposito (`apps/merchant/src/server/counter/resolve.ts:113-116`).
3. `customers-migration.neon.integration.test.ts:47-60` asevera la lista EXACTA de `pg_policies` de
   `business_customer_count` y `loyalty_program`; la migracion **0060** (`packages/db/drizzle/0060_rol_del_cliente.sql`,
   ADR 0110) agrego `consumer_app_select|insert|update` (rol `checkpass_consumer`) en `business_customer_count` y
   `consumer_app_select` en `loyalty_program`.
4. `billing-pages.neon.integration.test.ts:220` asevera el tag literal
   `<button class="archive-button" type="button">Bajar a Free</button>`; el rediseño `e7e95cc` cambio las clases
   (`subscription-console.tsx:224-233`). Lo que el caso protege (ADR 0058 §8) es que el boton ESTA y NO esta
   deshabilitado con `canCancel === false`.

## Alcance

**Entra:**
1. Literal «Verifica tu email para gestionar la suscripción.».
2. La allow-list exacta de `catalog` suma `habitualProductIds` y `lastPurchase` (sigue siendo `toEqual` exacto). Si el
   caso resuelve con local, asever tambien las claves de cada item de `lastPurchase.items` (`productId`, `quantity`); si
   resuelve sin local (`lastPurchase: null`), declararlo en un comentario.
3. La lista exacta de politicas suma las 4 de `checkpass_consumer` (con su `cmd`, `roles` y `qual` reales), con un
   comentario que cite la migracion 0060 / ADR 0110. Sigue siendo `toEqual` exacto: una politica nueva no prevista
   tiene que seguir dando rojo.
4. El caso del boton lee el HTML con `node-html-parser` (ya usado en el repo; `catalog/image-capture.test.ts`), busca el
   `<button>` cuyo texto es «Bajar a Free» y asevera que existe, que su `type` es `button` y que NO tiene el atributo
   `disabled`. El resto del caso («2 locales activos») no cambia.

**No entra:** codigo de produccion, otras suites, PARQUEADO #67/#68.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/app/api/billing/state/billing-state.neon.integration.test.ts` | editar |
| `apps/merchant/src/server/counter-redeem-surfaces.neon.integration.test.ts` | editar |
| `apps/merchant/src/server/customers-migration.neon.integration.test.ts` | editar |
| `apps/merchant/src/server/billing-pages.neon.integration.test.ts` | editar |

**Disjunta?** Si.

## Definition of Done

- [x] Las 4 suites verdes con `tools/neon-test.sh <los 4 archivos>` (transcripto).
- [x] `pnpm verify` en verde (tabla final transcripta). Toca solo tests de `apps/merchant/src/**` → Neon related.
- [x] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `subscription-console.tsx:229`: `disabled={busy}` → `disabled={busy \|\| !canCancel}` (el reflejo que el owner rechazo, ADR 0058 §8) | `billing-pages` «con 2 locales activos el botón de bajar NO se deshabilita» |
| M2 | `resolve.ts`: agregar al `catalog` devuelto una clave extra `debug: true` | `counter-redeem-surfaces`, la allow-list exacta de `catalog` |

**Protocolo:** `shasum` limpio → bitacora antes de medir → etiqueta `MUTATION` → medir y transcribir → revertir con
`diff`. Leer la asercion del rojo.

## Declarado AFUERA

- Ampliacion aceptada al implementar: la consulta a `pg_policies` ordena por `tablename, policyname` (sin eso el
  `toEqual` exacto no es determinista con varias politicas por tabla).
- `counter-redeem-surfaces` resuelve sin local: no fija las claves de `lastPurchase.items`.

- La lista exacta de politicas no se muta (es una consulta a `pg_policies`; una mutacion exigiria una migracion).

## Handoff

UN implementador; revision liviana del orquestador.

## Abierto

Nada.
