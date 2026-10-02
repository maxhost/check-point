---
spec: 0125
fecha: 2026-10-02
estado: cerrada
resumen: `tools/google-wallet-callback.ts` manda `reviewStatus: "UNDER_REVIEW"` en el PATCH (Google rechaza editar una clase aprobada sin eso) e imprime el mensaje de error de Google cuando falla.
disjunta: si
archivos: tools/google-wallet-callback.ts, tools/google-wallet-callback.test.ts
---

# 0125 — El script del callback de Google Wallet manda `reviewStatus`

> Pedido del owner el 2026-10-02 («arreglemos esto tools/google-wallet-callback.ts»).

## Problema

- `tools/google-wallet-callback.ts:43` (`planCallback`) arma el PATCH solo con `{ callbackOptions: { url } }`.
  **Medido 2026-10-02** contra la clase real (`approved`): Google responde `HTTP 400` con
  `Invalid review status "APPROVED". Use "UNDER_REVIEW" instead.` y no cambia nada. El mismo PATCH con
  `reviewStatus: "UNDER_REVIEW"` dio `HTTP 200`, y al releer la clase quedo `approved` con el callback puesto.
  Precedente en el repo: `scripts/google-wallet/provision-class.mjs` ya lo manda (commit `e02a9f2`).
- `:117-118`: cuando el PATCH falla, imprime solo `HTTP <codigo>`; el motivo de Google (que no trae
  credenciales) se pierde, y hubo que escribir un script aparte para leerlo.
- El docblock (`:1-15`) recomienda `www.`; el owner decidio `my.` (la ruta vive en la app del cliente).

## Alcance

**Entra:**
1. `planCallback` devuelve `body: { callbackOptions: { url }, reviewStatus: "UNDER_REVIEW" }` cuando hay que hacer PATCH.
   `noop` no cambia.
2. Si el GET o el PATCH no son `ok`, imprimir tambien `error.message` del cuerpo JSON de Google (si lo hay).
   Nunca la service account ni el token.
3. Docblock: la URL de ejemplo pasa a `https://my.checkpass.club/api/public/wallet/google/callback`, y una linea que
   explique por que va `reviewStatus` (Google lo exige para editar una clase aprobada y la re-aprueba sola).
4. El test: la expectativa del PATCH incluye `reviewStatus: "UNDER_REVIEW"`.

**No entra:** `provision-class.mjs`, la app, re-aplicar el callback en Google (ya esta puesto: un `--apply` hoy da `noop`).

## Archivos

| Archivo | Accion |
|---|---|
| `tools/google-wallet-callback.ts` | editar |
| `tools/google-wallet-callback.test.ts` | editar |

**Disjunta?** Si.

## Definition of Done

- [ ] `pnpm exec vitest run tools/google-wallet-callback.test.ts` → verde.
- [ ] Dry-run (sin credenciales): `GOOGLE_WALLET_ISSUER_ID=338 node tools/google-wallet-callback.ts https://my.checkpass.club/api/public/wallet/google/callback`
      imprime un PATCH que contiene `"reviewStatus":"UNDER_REVIEW"`.
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`, `build`.
- [ ] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 1. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `planCallback` vuelve a devolver `body: { callbackOptions: { url } }` (sin `reviewStatus`) | `tools/google-wallet-callback.test.ts`, el `toEqual` del caso de PATCH. A medir |

**Protocolo:** `shasum` limpio → fila de bitacora antes de medir → etiqueta `MUTATION` → medir y transcribir →
revertir con `diff` contra copia limpia. Leer la asercion del rojo.

## Declarado AFUERA

- **El PATCH real contra Google no se re-ejecuta**: el callback ya esta puesto y `--apply` daria `noop`. La
  evidencia contra la API real es la del 2026-10-02 (400 sin el campo, 200 con el campo, clase releida `approved`).
- El camino de impresion del error no tiene test (es `main`, con red); se verifica por lectura.

## Handoff

UN implementador; revision liviana del orquestador.

## Abierto

Nada.
