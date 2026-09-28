# Spec 0106 — revision independiente

Presupuesto: 8 mutaciones de la tabla (M1, M2, M3, M4, M5, M5b, M6, M1b) + hasta 3 propias (P1..P3),
clase de error PLAUSIBLE. Base: `f878e02` (rama `motor`, worktree `check-point-wt/motor`).
Integraciones SOLO con `tools/neon-test.sh` (rama de CI). Protocolo: fila abierta ANTES de medir,
`shasum` limpio, etiqueta `MUTATION`, reversion probada con `diff` contra copia limpia en el scratchpad.

Linea base limpia (antes de mutar): `tools/neon-test.sh` sobre 11 archivos (`marketing-reward`,
`marketing-push-delivery`, `counter-coupon-extras`, `counter-coupon-races`, `counter-coupon`,
`consumer-coupons`, `marketing-reward-results`, `marketing-coupon-issue`, `marketing-templates`,
`marketing-results`, `counter-coupon-validity`) → 11 files / 61 tests passed, 0 skipped.

## Bitacora

| id | archivo | shasum limpio | invariante | alcance | resultado EJECUTADO |
|---|---|---|---|---|---|
| M1 | `marketing/campaign-store.ts` (2 llamadas) + `marketing/template-store.ts` (1) | `f148c0a8…` / `dcdbce8a…` | producto de otro negocio → 400 (se borran las 3 llamadas a `assertOwnProduct`) | `marketing-reward` | **ROJO 3/5**: POST, PATCH y enable con producto ajeno → `Error: esperaba un CampaignError y no hubo ninguno` (el writer lo ACEPTO). Cada llamada la caza su propio caso: el cableado de las tres esta pinneado. Revertido: `diff` = 3 lineas etiquetadas; shasum vuelve a `f148c0a8…`/`dcdbce8a…`. |
| M2 | `marketing/push-delivery.ts` | `f2d0602c…` | el emisor push copia tipo/regla (se escriben `'free_product'`/`null` fijos, y unidad/valor/moneda `null` para no chocar con el CHECK) | `marketing-push-delivery` | **ROJO 1/8**: «the delivered coupon copies the WHOLE reward…» — `AssertionError` del `toEqual` sobre una fila EMITIDA (19 campos): el cupon salio sin el premio, no fue el CHECK. Revertido: `diff` = 4 lineas; shasum `f2d0602c…`. |
| M3 | `counter/coupon-extras.ts` | `7df11eff…` | kind programa↔cupon (se borra `program.kind !== unit`) | unit `counter/coupon-extras.test.ts` + `counter-coupon-extras` | **ROJO**. Unit 1/5 «refuses a program of the other unit». Integracion 1/3 «a STAMPS coupon on a POINTS program is 409…» con `promise resolved "{ coupon: … }" instead of rejecting`. Revertido: `diff` = 1 linea; shasum `7df11eff…`. |
| M4 | `counter/coupon-store.ts` | `c70b9d0d…` | la suma va en la MISMA transaccion y despues del lock (se mueve `grantCouponExtras` antes del lock y a otra transaccion) | `counter-coupon-races`, `counter-coupon-extras` | **ROJO 2/10**: `counter-coupon-races` «two operators on the same EXTRA POINTS coupon credit ONCE» `expected 97 to be 82`; `counter-coupon-extras` primer caso `expected 87 to be 82` (el reintento idempotente volvio a acreditar). Motivo: saldo. Revertido: `diff` = bloque etiquetado + la linea que reemplazo al (3b); shasum `c70b9d0d…`. |
| M5 | `consumer/coupons.ts` | `49f5077f…` | filtro por consumidor (se borra `c.consumer_id = …` de AMBAS lecturas, parametro incluido) | `consumer-coupons` | **ROJO 2/3** (ambas lecturas): `expected [ …(6) ] to deeply equal [ …(4) ]` y el caso de suspendido con 8 filas vs 2. **Variante M5h** (filtro olvidado SOLO en la lectura de historial de E3b): **ROJO 2/3** (`[ …(3) ]` vs `[ Array(1) ]`). Revertido cada una: `diff` = la(s) linea(s) etiquetada(s); shasum `49f5077f…`. |
| M5b | `consumer/coupon-status.ts` | `de980ccf…` | `unavailable` precede a `valid` | unit `coupon-status.test.ts` + `consumer-coupons` | **ROJO**. Unit 2/5 («suspended», «closed»). Integracion 1/3, diff leido: el cupon del comercio suspendido salio `valid`/`null` y PRIMERO, en vez de `unavailable`/`business_suspended` despues del valido. Revertido: `diff` = 1 linea; shasum `de980ccf…`. |
| M6 | `marketing/reward-results.ts` | `d70d92a3…` | filtro por negocio en E4 (`where true`) | `marketing-reward-results` | **Primer intento INVALIDO**: el `sed` no matcheo (indentacion de 6 espacios), el `diff` salio vacio y la corrida verde 2/2 no midio nada — descartada. **Segundo intento**: `diff` = 1 linea; **ROJO 1/2** `expected [ Array(5) ] to deeply equal [ Array(4) ]` (entro el grupo del otro negocio). Revertido; shasum `d70d92a3…`. |
| M1b | `marketing/reward-store.ts` | `236d00a8…` | `couponKinds` informa solo el extra del programa (la lectura devuelve siempre los 5) | `marketing-reward` | **ROJO 1/5**: «E1b: couponKinds tells…» con `+ "extra_stamps"` de mas. Los 4 casos de escritura verdes (la decision no se toco). Revertido: `diff` = 1 linea; shasum `236d00a8…`. |
| P1 | `marketing/placement-store.ts` | `bca2f371…` | el emisor de PROXIMIDAD copia la regla (se pasa `rule: null`) — M2 solo ve el push | `marketing-coupon-issue` | **ROJO 1/3**: «spec 0106: the coupon copies the WHOLE reward —type, product, rule—…» con `- "ruleSnapshot": "Solo tamaño mediano"` / `+ null`. Revertido: `diff` = 1 linea; shasum `bca2f371…`. |
| P2 | `counter/coupon-scan.ts` | `26a9fbb3…` | docblock: «`currencyCode`: el snapshot del cupon si el descuento es por monto» (se usa `b.currency_code` siempre) | `counter-coupon`, `counter-coupon-extras` | **SOBREVIVE**: `counter-coupon`, `counter-coupon-extras`, `counter-coupon-validity` 16/16 verdes. Ningun test emite un cupon de descuento por MONTO y despues cambia `business.currency_code` (editable: `brand.neon.integration.test.ts:89` guarda `BRL`). El codigo actual es correcto; el invariante del docblock (y el mismo `coalesce` de `consumer/coupons.ts:72`) no tiene oraculo. Revertido: `diff` = 1 linea; shasum `26a9fbb3…`. |
| P3 | `consumer/coupons.ts` | `49f5077f…` | allow-list del DTO del consumidor: sin costo ni nombre de campaña (se agrega `costSnapshot` al objeto) | `consumer-coupons` | **ROJO 1/3**: «lists ONLY the session consumer's coupons…» con `expected [ 'businessId', …(13) ] to deeply equal [ …(12) ]`, `+ "cost"`: el allow-list de claves esta pinneado. Revertido: `diff` = 2 lineas; shasum `49f5077f…`. |

Arbol al cierre: `grep -rn MUTATION apps/merchant/src` vacio; `git status` sin cambios en `apps/`.

## Otros comandos ejecutados

- Gates de root (Node 24): `TURBO_FORCE=1 pnpm run typecheck` 0 (3/3, 0 cached), `pnpm run lint` 0,
  `pnpm run test` 0 (200 files / 1978 tests passed, 660 skipped = neon), `pnpm run format:check` 0,
  `TURBO_FORCE=1 pnpm run build` 0.
- `drizzle-kit generate` (sin credenciales) → «No schema changes, nothing to migrate».

## Hallazgos

1. **BAJA, no es riesgo de produccion hoy** — P2 sobrevive: `currencyCode` del snapshot en el scan
   (`counter/coupon-scan.ts:66`) y en la lista del cliente (`consumer/coupons.ts:72`) sin oraculo.
   Arreglo: un caso de integracion que emita un descuento por `amount`, cambie la moneda del
   negocio y espere la del snapshot en scan y lista.
2. **BAJA, andamiaje sin tarea** — el `DEFAULT 'free_product'` de `0050` en los dos
   `kind_snapshot` es «solo para la ventana migracion→deploy» (`schema/campaign-turn.ts:187`), la
   ventana ya cerro y no hay fila en `TASKS`/`PARQUEADO` que lo retire: un emisor futuro que olvide
   el tipo emite `free_product` en silencio (la clase de M2). Decidir: migracion que lo quite, o
   declararlo permanente.

## Declarado y NO perseguido

- Lock del programa con `FOR UPDATE` en `coupon-extras.ts:106`: bloquea los `FOR KEY SHARE` de
  inserts que referencian el programa mientras dura el canje (latencia, no deadlock por el orden
  membresia→programa). Lectura de codigo, no medido.
- PATCH de un campo ajeno al premio sobre una campaña `extra_*` cuyo programa cambio de unidad:
  `updateCampaign` re-valida el premio arrastrado y responderia 400 en `couponKind`. Lectura de
  codigo, no ejecutado; es UX, no plata.
- Ventana migracion→deploy de `core.campaign.coupon_kind` (sin default): ya declarada por el
  implementador (`9666b2d`); cerrada, 0 campañas con cupon en prod segun `TASKS`.
- E4 zona horaria del negocio: no mutada (fuera de las 3 propias).
