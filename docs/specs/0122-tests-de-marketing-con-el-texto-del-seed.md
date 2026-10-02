---
spec: 0122
fecha: 2026-10-02
estado: cerrada
resumen: Dos suites de marketing esperan el texto en voseo que sus propios seeds ya no siembran desde la unificacion de copy; la asercion vuelve a reflejar lo que el seed escribe.
disjunta: si
archivos: apps/merchant/src/server/marketing-push-delivery.neon.integration.test.ts, apps/merchant/src/server/marketing-welcome-landing.neon.integration.test.ts
---

# 0122 — Tests de marketing con el texto de su seed

> Pedido del owner el 2026-10-02. Hallazgo del implementador de la 0121, re-medido por el orquestador.

## Problema

- `marketing-push-delivery-support.ts:64` siembra `body: "¡Vuelve! · 2x1 en picadas"` (tuteo, commit
  `4a69db7`/`f3982ef`), y `marketing-push-delivery.neon.integration.test.ts:69,76` sigue esperando
  `"¡Volvé! · 2x1 en picadas"`. Rojo en HEAD.
- `marketing-welcome-support.ts:65` siembra `message: "Únete hoy y recibe un regalo en tu próxima visita"`,
  y `marketing-welcome-landing.neon.integration.test.ts:51` espera
  `"Sumate hoy y en tu próxima visita te llevás un regalo"`. Rojo en HEAD.
- En los dos casos el test aseverá que **el mensaje sale igual a como entro**; el literal esperado es una
  copia del seed que quedo vieja. La voz correcta ya esta decidida en `apps/merchant/COPY.md` (tuteo), asi
  que se corrige la **asercion**, no el seed.

## Alcance

**Entra:** los tres literales esperados (`push-delivery` 69 y 76, `welcome-landing` 51) pasan a ser
exactamente el texto que siembra su support.

**No entra:**
- Las plantillas predeterminadas en voseo de `packages/domain/src/server/marketing/templates.ts`
  (126, 203, 254) contra `COPY.md`: es texto de producto; va al owner aparte.
- Las otras 4 suites rojas reportadas por la 0121 (backoffice-pages, wallet-push, marketing-refresh,
  marketing-valley).
- Cualquier cambio a codigo de produccion o a los support.

## Diseño

Reemplazo literal. Ningun otro cambio. Si al correr aparece otro rojo en estas dos suites, se transcribe
y se para: no se arregla.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/marketing-push-delivery.neon.integration.test.ts` | editar (2 literales) |
| `apps/merchant/src/server/marketing-welcome-landing.neon.integration.test.ts` | editar (1 literal) |

**Disjunta?** Si (la 0121 toca `counter-integration-support.ts`).

## Definition of Done

- [ ] `rg -n 'Volvé|Sumate hoy' apps/merchant/src/server/marketing-push-delivery.neon.integration.test.ts apps/merchant/src/server/marketing-welcome-landing.neon.integration.test.ts` → vacio.
- [ ] `tools/neon-test.sh` sobre las dos suites → verdes, salida transcripta. **Nunca contra `DATABASE_URL`.**
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [ ] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `packages/domain/src/server/consumer/enroll-landing.ts:63`: `message: campaign.message` → `message: ""` (la landing deja de llevar el texto de la oferta) | `marketing-welcome-landing.neon.integration.test.ts`, en el `toEqual` de `welcomeOffer` con el `message` en el diff. **A medir, no predicho** |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora antes de medir → etiqueta `MUTATION` →
medir y transcribir → revertir con `diff` contra copia limpia. Leer la asercion del rojo.

**Condicion de corte:** dos vueltas seguidas de «el fix abrio la siguiente» → se corta y va al owner.

## Declarado AFUERA

- La asercion de `push-delivery` no tiene mutacion propia en esta spec (presupuesto 1).

## Handoff

UN implementador, revision liviana del orquestador (reemplazo literal en tests, sin codigo de produccion).

## Abierto

Nada.
