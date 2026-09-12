# Re-revision del delta del barrido — spec 0063, fase D1 (revisor). VEREDICTO: PASS

Arbol al cerrar: `grep -rn MUTATION` vacio, ninguna sonda en `src/`, **los 11 hashes identicos
a `/tmp/rev4/`** (verificado con `diff` de las dos listas de `shasum`).

## 1. Los 10 oraculos: todos discriminan, ninguno es proxy
Alcance de cada corrida: **9 archivos** (`billing-routes`, `billing.neon`, `billing-interval`,
`billing-routes-auth`, `locations-races`, `billing-cancel-guards`, `billing-checkout-guards`,
`billing-auth-guards`, `billing-error-classification`). Baseline 47 tests.

| Mut | Resultado | Asercion literal |
|---|---|---|
| S1 | ROJO 1/47 | `billing-auth-guards > un cancel ESPERA al que tiene el lock…` → `expected 'free' to be null` |
| S3 | ROJO 1/47 | `billing-error-classification > una excepcion cualquiera es 503…` → `expected '{"error":"connect ECONNREFUSED 10.0.0…' not to contain 'ECONNREFUSED'` |
| S4 | ROJO 1/47 | `billing-checkout-guards > un negocio con suscripcion VIVA recibe 409…` → `expected 200 to be 409` |
| S6 | ROJO 1/47 | `billing-checkout-guards > un MERCHANT_PUBLIC_ORIGIN con barra final…` → `to match object` |
| S7m | ROJO | `billing-cancel-guards > la llamada a Stripe NO ocurre con el lock tomado` → `expected false to be true` |
| S9 | ROJO 1/47 | `billing-cancel-guards > el revert clasifica un 4xx por rawType y por statusCode` → `expected 'free' to be null` |
| S11 | ROJO 1/47 | `billing-cancel-guards > resume limpia el cancel_at EXPLICITO` → `expected null to be 'free'` |
| S12 | ROJO 1/47 | mismo test → la `idempotencyKey` de `resume` |
| S16 | ROJO 1/47 | `billing-interval > mensual → anual…` → la `idempotencyKey` de `interval` |
| S17 | ROJO 1/47 | `billing-interval > tarjeta rechazada: 402 y NADA aplicado` → `expected 503 to be 402` |

## 2. El hallazgo de metodo dentro de S1: REAL y bien resuelto
El oraculo final asevera **«mientras otro tiene el lock, la ruta no escribio NADA»**, leido por
`getDb()` (neon-http = otra conexion, ve lo commiteado). El `expect(terminado).toBe(false)` esta
al lado pero **no es el que muerde**: el rojo de S1 es `expected 'free' to be null`, o sea la
escritura. Verificado que la premisa es cierta: `billingStateResponse` **tambien** toma
`lockBusiness`, asi que la primera version («la ruta no termino») habria quedado verde con y sin
el guard. No volvio a caer en ella.

## 3. S7 con `FOR UPDATE NOWAIT`: la tecnica es correcta
Re-ejecute la mutacion en su forma **minima** (solo la llamada de red adentro de la transaccion,
sin el paso 4 anidado que fue lo que me auto-deadlockeo): el oraculo da
`AssertionError: expected false to be true`, **una asercion, no un timeout**. El guard
`if (lockLibre !== null) return` evita que una segunda observacion tape la primera.

## 4. S17 / S9 y el error PLANO: no es una trampa, pero es mas ancho que su docblock
El test alcanza la rama legitimamente y discrimina. Matiz honesto: bajo el escenario que el
docblock de PRODUCCION invoca —«un `instanceof` se rompe si el que construyo el error cargo otra
copia del modulo»— el error **igual traeria `type`**, asi que ese escenario lo cubre la primera
rama. Las ramas `rawType`/`statusCode` valen por el motivo que dice el docblock del TEST («lo que
llega si el SDK cambia de forma»), que es mas debil. Nada falso; el docblock de produccion es mas
ancho que lo que las ramas compran.

## 5. Higiene de literales: cerrada DE RAIZ, verificado empiricamente
`RUN_SUFFIX = randomUUID().slice(0,8)` una vez por modulo; `subId`/`custId` en el support; los
**cinco** archivos de integracion de la D1 lo consumen y **ninguno arma un id a mano**.
**La prueba que importa:** tras el timeout de S7m —el mismo escenario que la vez pasada enveneno
la rama— corri `billing.neon` sola: **6/6 VERDE**. El modo de falla desaparecio en su raiz.
Sin dependencia de orden: `subId(tag)` es estable dentro del archivo y los 14 tags son distintos
entre archivos.

## 6. Los docblocks nuevos, barridos contra el arbol
`billing-error-classification` (unit puro, corre siempre, sin `skipIf`), `billing-auth-guards`,
el de S7 (`NOWAIT`) y el de S1 (por que el primer oraculo no servia): **los cuatro afirman cosas
que el arbol sostiene**, verificadas una por una.

## Menores (ninguno bloqueante)
1. **Un `it` con CUATRO oraculos y un titulo que nombra uno.** `resume limpia el cancel_at
   EXPLICITO` carga S11 (el orden), S12 (la clave), B4 (`cancel_at`) y S13 (las tres columnas).
   Las cuatro estan pinneadas —lo verifique por mutacion— y **cada asercion tiene su comentario
   nombrando su mutacion**, asi que quien abre el archivo encuentra la atribucion. Lo que engaña
   es el titulo, que es lo que se ve en CI. Es la familia del `FOR UPDATE` de la 0055, pero mas
   leve: alli el plan afirmaba un par mutacion↔test FALSO; aca los pares son correctos y estan
   escritos.
2. **`billing-store.neon.integration.test.ts` (fase B) sigue con ~12 literales fijos**
   (`sub_idem`, `sub_muerta`, `sub_carrera`…). El fix de raiz cubre los 5 archivos de la D1;
   ese, que no consume `livePlusState`, conserva el mismo riesgo latente ante una corrida
   abortada. Fuera del alcance de la D1, pero es el hermano del hallazgo que esta ronda cerro.
3. Ver el punto 4: el docblock de produccion de `isDeterministicRejection` / `isCardError`.
4. El docblock del support afirma «vitest aisla el grafo por archivo, asi que dos archivos nunca
   comparten sufijo». Verifique que `vitest.config.ts` **no** desactiva `isolate` y que ningun
   tag se comparte entre archivos, pero **la mitad entre-archivos no la ejercita nada** (no
   construi una sonda de dos archivos para no volver a dejar tests en `src/`). La mitad
   load-bearing —entre CORRIDAS— si la verifique empiricamente (punto 5).

## Gates, corridos por mi
`pnpm test` con integracion: **121 archivos / 872 tests / 0 failed / 0 skipped**.
`TURBO_FORCE=true typecheck` (0 cached), `lint`, `format:check`, `TURBO_FORCE=true build`
(0 cached) → **los cinco EXIT=0**, Node 24.20.0.
