> ## ⚠️ BITACORA CERRADA (2026-09-15) — NO ES TRABAJO PENDIENTE
>
> Documento de TRABAJO de la spec 0064, conservado como evidencia. **El arco esta cerrado:** spec
> `implementada`, commit `ca2d746` en prod y **QA del owner en verde**.
>
> **LAS FILAS QUE DICEN «(abierta)» NO SON DEUDA: la verificacion se CORTO POR DECISION DEL OWNER**
> («no podemos quedarnos eternamente gastando tokens en cosas que no acaban»), y de ese corte salio la
> regla de presupuesto y condicion de corte de `CLAUDE.md`. Se ejecutaron 4 de 14 mutaciones y **el
> valor ya estaba extraido**: R1/R3/R4 dieron rojo por el motivo correcto (asercion leida) y R2 destapo
> el hallazgo **H2**, declarado como menor en la spec. **No re-abrir esto sin una razon nueva.**
>
> **Lo unico que hay que saber de aca:** una mutacion (R6) quedo viva cuando el revisor murio, y se
> revirtio **verificada** — `diff` contra la copia limpia mostro exactamente esa hunk y el `shasum`
> post-restauracion coincidio con el registrado ANTES de mutar. Ese numero es lo que convirtio
> «restaurar» en una operacion verificada y no en una apuesta sobre el trabajo de otro.

# Revision independiente — FASE A de la spec 0064

> Revisor independiente. **No hubo handoff del implementador** (murio dos veces): la tabla de
> mutaciones, los shasums y los limites los genero YO desde la spec y el `git diff`.
> Esta bitacora se escribe A MEDIDA que avanza. Una fila se abre ANTES de mutar.

## Estado: EN CURSO

## 0. Baseline del arbol (antes de cualquier mutacion)

- Node 24.20.0 (`nvm use` sin argumento).
- `git stash list` vacio; `grep -rn MUTATION` sobre `apps/` sin resultados → **no hay mutaciones
  heredadas vivas** de los dos implementadores que murieron.
- Gates corridos por mi: `typecheck` VERDE, `lint` VERDE, `format:check` VERDE (`/tmp/rev0064/gates1.log`).

### 0.1 Tamanos AL HOOK sobre TODO el alcance (los ` M` **y** los `??`) — 27 archivos .ts/.tsx

**CONFIRMADO el hallazgo del orquestador: CINCO archivos dan `EXIT=2`.** Y el agravante que la
pista no decia: **los CINCO los rompio ESTA fase**, ninguno venia roto de antes.

| archivo | HEAD | ahora | hook |
|---|---|---|---|
| `billing-pages.neon.integration.test.ts` | 300 | 302 | EXIT=2 |
| `billing-routes.test.ts` | 300 | 301 | EXIT=2 |
| `billing-store.neon.integration.test.ts` | 300 | 301 | EXIT=2 |
| `locations-races.neon.integration.test.ts` | 290 | 302 | EXIT=2 |
| `billing-downgrade-now.neon.integration.test.ts` | (nuevo) | 302 | EXIT=2 |

Control de que el hook DISCRIMINA: `billing-offers.test.ts` (299) y `billing-stripe-fake.ts` (288)
dan `EXIT=0`. No es un hook que falle siempre.

### 0.2 §4.b — el fantasma del validator: CUMPLIDO y verificado contra falso verde

`grep -c resume apps/merchant/.next/types/validator.ts` = **0**, y el archivo **no esta vacio**:
51 bloques `route.js`, con las 4 rutas de billing reales (`cancel`, `checkout`, `interval`,
`settle-free`). Un barrido vacio habria dado 0 igual; este no lo es.

## 1. Tabla de mutaciones

**Alcance de CADA fila: el set COMPLETO de billing** — `node ../../node_modules/vitest/vitest.mjs run
src/server/billing` desde `apps/merchant`, **con el env de integracion cargado**
(`set -a; . ./.env.integration.local; set +a`). Baseline verde: **28 archivos / 233 tests, 35 s**.
Sin ese env los 15 archivos de integracion salen SKIPPED y cualquier verde seria falso.

Copias limpias en `/tmp/rev0064/clean-<archivo>`; el driver (`/tmp/rev0064/mut.py`) **aborta si el
archivo no esta limpio antes de mutar** y **verifica el `shasum` despues de restaurar**.

| archivo | `git status` | shasum limpio | por que importa |
|---|---|---|---|
| `app/api/billing/cancel/route.ts` | ` M` | `429550c610a1dd76521424f4dcfd1d00b27dc218` | TRACKED+MODIFICADO: un `git checkout` de emergencia **se lleva tambien el trabajo sin commitear del implementador**. Restauro por copia. |
| `server/billing/facts.ts` | `??` | `de76a53523f8dc4fd0f6655c74e7ed7344793c58` | UNTRACKED: **no existe `git checkout` de emergencia**. La copia en `/tmp` es el unico punto de retorno. |
| `server/billing/view.ts` | ` M` | `a90082043f57437f344655d24831fa986da6dc81` | idem route.ts |

| id | archivo | invariante atacado (docblock que lo afirma) | resultado |
|---|---|---|---|
| R1 | route.ts | el guard `createdNow` del revert | **ROJO 1/233** — `billing-cancel-guards` › «un REINTENTO de `cancel` que falla determinista NO borra la baja ya pedida». Asercion: `expected null to be 'free'` (`pendingPlan` borrado). Habla de la propiedad. |
| R2 | route.ts | la `idempotencyKey` lleva el `downgradeRequestedAt` (no es fija) | **VERDE 233/233 — HALLAZGO BLOQUEANTE (H2).** Clave FIJA `billing:cancel:${subId}` y NADIE se entera. |
| R3 | route.ts | SIN `prorate` ni `invoice_now` | **ROJO 2/233** — `billing-cancel-guards` («`settle-free` sobre una suscripcion VIVA…», `expected { prorate: true, invoice_now: true } to be undefined`) y `billing-downgrade-now` (A-T4, `cancelParams`). |
| R4 | route.ts | `confirmAtStripe` loguea la causa del fallo de Stripe | **ROJO 1/233** — `billing-cancel-guards` › «el `catch` de `cancel` registra la CAUSA…». Asercion: `expected '' to contain 'boom-de-stripe'`. |
| R5 | route.ts | el `catch` externo loguea lo que NO es `BillingError` | (abierta) |
| R6 | route.ts | la llamada de red NUNCA ocurre con el lock tomado | (abierta) |
| R7 | route.ts | `StripeConnectionError` NO es determinista (no revierte) | (abierta) |
| F1 | facts.ts | la factura se elige por `created` MAXIMO, no `data[0]` | (abierta) |
| F2 | facts.ts | `status:"paid"` es load-bearing | (abierta) |
| F3 | facts.ts | AISLAMIENTO: que una llamada falle no borra el dato de la otra | (abierta) |
| F4 | facts.ts | `?? null` y no `\|\| null` en `receiptUrl` | (abierta) |
| F5 | facts.ts | acceso defensivo `items?.data?.[0]?.` | (abierta) |
| F6 | facts.ts | sin ids NO se llama a Stripe | (abierta) |
| V1 | view.ts | un `plus` con `interval` NULL no adivina «mensual» | (abierta) |

## 2. Hallazgos

(pendiente)
