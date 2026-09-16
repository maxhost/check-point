# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook
`Stop` que bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido,
cosa vista en pantalla. No "deberia andar". El auto-reporte no es evidencia.

Ultima actualizacion: 2026-09-16 (**FASE A EN PROD** — `9fd9625`; falta solo el Actions secret `MARKETING_TICK_ENDPOINT`. **FASE B: B1 COMMITEADA EN `a0573a6`, NO PUSHEADA** — 5 gates verdes, 156 archivos / 1097 tests. **PROXIMO PASO EXACTO: escribir el test unit de las rutas HTTP** (401 sin sesion, 403 de staff, mapeo de `CampaignError` a status) copiando el patron de `locations-routes.test.ts` — es lo unico que falta para cerrar el item de aislamiento del DoD de B1. Recien despues: B2 (resultados + audience-preview) y B3 (las 3 pantallas). Se encontro y corrigio una BOMBA DE TIEMPO preexistente de la fase A (el tick no escribia `not_before`). Ver «FASE B (BACKOFFICE DE CAMPAÑAS)» → sub-seccion B1.)

**ESTADO REAL (bloque reescrito ENTERO el 2026-09-15, tarde):**

- **ARCO DE SUSCRIPCION: CERRADO.** Spec 0064 `implementada`, commit `ca2d746`, QA del owner en prod en
  verde. O-2/O-3/O-4 aceptadas por el owner. Diagnostico vigente: `A3 Test`
  (`e9c96528-5f3e-4952-b283-7434ec867b4f`) sigue diferido al **13-10**; si ese dia no aterriza en
  `free` limpio, arrancar por O-3. **Tarea 55** (intervalo anual → mensual) sigue pendiente y no es
  este arco. El barrido de las 60 specs (0058/0059/0010/0018/0022 → `implementada`) esta hecho y
  commiteado en `ea996c3` y anteriores.

- **ARCO DE MARKETING: EMPEZADO — DOCUMENTOS ESCRITOS Y SPEC CERRADA, NADA DE CODIGO, SIN COMMITEAR
  (2026-09-15).**
  - **ADR 0064** (`aceptada`): el motor arranca por **audiencias** (fase 1), el reactivo del 0018 es
    la fase 2; **un tipo de campaña = una spec + un ADR**; los $20 compran el motor **sobre la base
    propia**; el cupon es un efecto; medicion por ADR 0021.
  - **ADR 0065** (`aceptada`): proximidad por wallet = **turno rotativo** (5 dias) con **separacion
    geografica** (400 m), ≤5 turnos activos + ≤3 de utilidad por pase, 1 por negocio, FIFO, cooldown
    30 d, cuota 50 concurrentes, holdout 10 %, clase `pass_refresh` silenciosa.
  - **Spec 0065: `cerrada` otra vez (2026-09-15, noche), despues de la revision adversarial.** Tres
    revisores independientes con dimension acotada y presupuesto escrito: **FAIL unanime, 16
    bloqueantes**, mas un **17.º que NINGUN revisor cazo y salio de correr el SQL**: contra un indice
    **parcial**, `on conflict (a,b) do nothing` **pelado** falla con `there is no unique or exclusion
    constraint matching the ON CONFLICT specification` — hay que repetir el `where` del indice, y sin
    eso **el tick reventaba en su primera corrida**. Todos corregidos.
    **LOS 17 SE VERIFICARON EMPIRICAMENTE ANTES DE BAJARLOS A LA SPEC.** El owner pregunto
    explicitamente si se habia hecho, y la respuesta honesta en ese momento era **«no, solo 2»** — el
    resto se habia bajado confiando en la cita del revisor, que es justo lo que `CLAUDE.md` prohibe.
    Verificacion: el arbol por lectura directa de cada `archivo:linea`, y las afirmaciones de
    Postgres contra una **rama Neon efimera con PG 18** — el `23505` del retry del worker con
    `attempts` **quedando en 0** y la fila clavada en `sending` (que es lo que lo vuelve un reintento
    infinito), el fallo del `on conflict` y su arreglo, `GREATEST` ignorando NULL, el check «todo o
    nada» mordiendo, y la vigencia abierta pasando. **Un hallazgo de subagente es una afirmacion de
    exito como cualquier otra.**
    **Las dos preguntas de producto las cerro el owner el mismo dia:** (1) puerta compartida →
    **se muestran las DOS cosas fusionadas** en un texto («{negocio}: te faltan 2 sellos · 2x1 en
    picadas»), funcion pura `composeRelevantText`, `cap` 120 y si no entra **se cae el saldo entero**
    (no se trunca); Apple **no documenta** limite de `relevantText`, asi que **donde corta la
    pantalla bloqueada es un item de QA**, no un numero inventado. (2) **Merito con balanza DESDE EL
    DIA UNO** → **ADR 0066**, que supersede la decision 4 del ADR 0065: se rankea por **lift**
    (`tasa_colocados − tasa_holdout`), no por tasa cruda — el argumento numerico del 0065 era
    correcto pero refutaba la tasa cruda, no el merito —, con encogimiento hacia el promedio global
    (α = 20) para que el debutante arranque **en el medio y no ultimo**, y FIFO de desempate. Los cuatro hallazgos que mas duelen: el unico parcial del turno estaba por
    **campaña** cuando el ADR dice por **negocio** (dos campañas del mismo negocio le daban al
    cliente dos ventanas seguidas); `push-worker.ts:60` colapsa toda clase desconocida a
    `transactional`, o sea que el carril `pass_refresh` moria **antes** de su planner con typecheck
    en verde; el «`PATCH` de Google» se citaba con articulo definido y **no existe** en el arbol
    (solo hay POST: token exchange y `addMessage`); y el barrido estatico del opt-out era **vacuo**
    (buscaba `marketing_opt_out_at`, la ortografia que el codigo que escribe nunca contiene).
    Ademas: el cooldown lo quemaban los turnos **cancelados** (pausar un dia para corregir un typo
    dejaba a toda la audiencia bloqueada 30 dias), no habia donde guardar los conteos de exclusion
    del tick (el DoD «el motivo se cuenta en resultados» no tenia oraculo posible → tabla nueva
    `campaign_tick_audience`), la mutacion del webhook **no mordia** (mover el `update` despues del
    commit deja el estado final identico), `requireBackofficeSession` es un guard de **pagina** que
    hace `redirect()` (en un POST da 307, no 403), y `locations` no llegaba al pase editando solo
    `apple.ts`/`google.ts` (el input lo llenan tres call-sites via `provider.ts`).
  - **Spec 0065 — contenido de producto (sin cambios, lo que el owner cerro)**: compositor + tick + pase + cupon + resultados + configuracion del
    consumidor + freno por plan, en 4 fases. **El owner cerro los dos items que faltaban
    (2026-09-15):** (1) el opt-out vive en una **seccion de Configuracion** del portal
    (`/wallet/settings`), un interruptor por negocio, sin tocar lo transaccional ni el saldo del
    pase; (2) el freno por plan es **BLOQUEO DURO** al bajar —«debe desactivar las campañas activas
    como sucede con los locales»—, **no** la pausa automatica que el orquestador habia escrito: se
    calca `decidePlanChange` con una guarda nueva `downgrade_blocked_campaigns` + `deactivateCount`,
    despues de la de locales. **La pausa defensiva del webhook sobrevive como decision del
    ORQUESTADOR** (no del owner) para el plan que llega a `free`/`none` sin pasar por nuestra ruta
    —dashboard de Stripe o impago—, que es el agujero que ya costo dos rondas en la 0063 (ADR 0060);
    si el owner prefiere que ahi sigan corriendo, es una linea.
  - `INDEX.md` con las tres filas; specs **0003** y **0017** anotadas (reencuadrada / reemplazada).
  - **Correccion del orquestador que va al owner:** al retomar dije que el ADR 0057 §1 (OTP antes de
    ampliar el re-enroll) «se gatillaba» con el motor. **Falso**: el canal entrega al **pase
    instalado**, no al numero; la verificacion no cambia a quien le llega. Escrito en el ADR 0064 §8.

- **MEDICIONES DE ESTA SESION (caras de rehacer — estan en el ADR 0065 con fuente; aca el resumen):**
  - Apple: `locations` **≤10** por pase; `maxDistance` es clave **del pase** y **solo achica**
    («smaller of this or the default»); nuestro pase es `storeCard` → radio ~100 m, `relevantText`
    por ubicacion, **`relevantDate` NO soportado**.
  - Google: el campo es **`merchantLocations`** (`locations` deprecado, «not supported to trigger
    geo notifications»), radio fijado por Google, exige **dwell**, **sin texto por ubicacion**, 10 por
    clase + 10 por objeto. ~150 m y 4/dia son **fuentes secundarias** (no load-bearing). Un
    integrador (Splio) reporto la funcion «temporalmente no disponible» en Android.
  - **Ninguna plataforma reporta impresiones** → la exposicion solo se controla al colocar, y el
    merito por resultado en proximidad esta sesgado (necesita holdout).
  - Nuestro codigo: `message_updated_at` es la **unica** etiqueta de «el pase cambio»; el
    `changeMessage` solo notifica si `latest_message` cambia (refresco silencioso posible);
    `rotate.ts` encola `transactional`, que **posterga campañas** → hace falta el carril
    `pass_refresh`; `public/sw.js` ya tiene `push` y `notificationclick` (el Web Push SI es medible;
    la URL es constante, va con la spec de push). `PLAN_LOCATION_LIMITS`: free 1, plus 3.
  - Datos: no hay tabla de campañas; `core.order` + `order_item` + `product.unit_cost` dan RFM y
    margen; no hay email, fecha de nacimiento, opt-out, check-in ni **categoria del negocio**;
    `phone_verified_at` **NO** es siempre null: lo escribe la recuperacion por OTP
    (`consumer/recovery/internal.ts:206`, `verify.ts:178`, pinneado en
    `consumer-recovery.neon.integration.test.ts:137/188/445`). La frase vieja salia de un docblock
    de la spec 0028 (`schema/consumer.ts:17`) que quedo viejo — cazado por la revision adversarial.

- **DECISIONES DEL OWNER EN ESTA SESION (literal, ya bajadas a los ADR):** fase 1 audiencias / fase 2
  reactivo · un spec+ADR por tipo de campaña, hoy solo proximidad · $20 = base propia, red cruzada =
  otro precio a futuro · cupon SI como efecto («hoy 2x1 solo para ti en cervezas») · composicion
  estilo Talon.One · ventana 5 dias · 400 m · 5 turnos activos · cuota por negocio (numero del
  orquestador) · merito con balanza (piso para debutantes) · sin email · fecha de nacimiento mas
  adelante · slot por puerta, no por barrio.

**ESTADO DE LA IMPLEMENTACION (2026-09-15, noche — A1+A2 COMMITEADAS EN `ddd64d2`, NO PUSHEADO; los 4
tests de cierre de A2 quedan por commitear):**

- **FASE A1 (schema + migracion `0031`): IMPLEMENTADA Y VERIFICADA POR EL ORQUESTADOR.** Falta el PASS
  de un revisor independiente. Archivos: `schema/campaign.ts` (nuevo, 162 l.), `schema/campaign-turn.ts`
  (nuevo, 252 l. — `campaign_turn` ⇄ `coupon_redemption` son FKs **circulares**, tienen que vivir en el
  mismo archivo y el lado forward necesita `(): AnyPgColumn =>` o `tsc` tira `TS7022`), `schema/consumer.ts`
  (` M`, **298/300 — la proxima fase que lo toque lo parte**), `schema.ts`, y
  **`drizzle/0031_secret_the_santerians.sql`** + `meta/`.
  **Los 5 gates de root en VERDE, corridos por el orquestador:** `typecheck` 3/3, `lint` limpio,
  `format:check` «All matched files use Prettier code style!», `test` **`Tests 727 passed | 221 skipped
  (948)`**, `build` exit 0.
- **LA MIGRACION YA ESTA APLICADA en la rama Neon `spec-0065-marketing`** (`br-shy-king-axu5s3ze` — es la
  vieja `spec-0063-billing`, **renombrada**, misma conn, misma host: `.env.integration.local` no cambio de
  credencial). `drizzle.__drizzle_migrations` = **32** filas, `hash` = `27d2c73f…`, y `db:migrate`
  re-corrido no reporta nada pendiente. Expira el **2026-10-15** (Neon la borra sola).
  **`ci-integration` NO necesita el paso manual que decia la spec: `ci.yml` corre `pnpm db:migrate` en cada
  corrida** (spec 0062, «Migrar la rama de CI en cada corrida»). El item «orquestador aplica 0031 antes de
  la fase A» era ademas **imposible de cumplir en ese orden** — la migracion la genera la fase A.

- **UN BLOQUEO REAL QUE CAZO EL IMPLEMENTADOR Y VERIFICO EL ORQUESTADOR (no se acepto de palabra):** la
  spec fijaba el check de `pass_placement.relevant_text` en **≤ 60** y el `cap` de `composeRelevantText`
  en **120**, en dos secciones distintas del mismo documento. **El 60 no era cosmetico:** es el cap de
  `utilityText` **solo**, y esa columna guarda tambien el texto **compuesto** — el ejemplo literal del
  owner («Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el domingo») mide **68 caracteres**,
  asi que **todo** `slot_kind = 'both'` habria muerto con `23514` en produccion, y `both` es el perfil
  **central** de la audiencia, no un borde. Corregido a **120** y **verificado con oraculo contra la rama**,
  no por lectura: 68 chars **ACEPTA**, 121 chars **`23514` check_violation (MUERDE)**, sonda revertida
  (0 filas). La 0031 se **regenero** (no estaba commiteada, salia gratis) y el `diff` contra la vieja es de
  **exactamente una linea**. La linea 183 de la spec quedo corregida con su nota al pie.
  *(Misma familia que el ADR 0054: un documento afirmando dos cosas incompatibles, y la que estaba en la
  tabla del modelo de datos era la foto ANTERIOR a la decision del owner del mismo dia.)*

- **HALLAZGO VERIFICADO PARA LA FASE A5 (integracion), anotado antes de que muerda:** `dropBusiness`
  (`server/counter-integration-support.ts:210`) borra `rewardRedemptions` → `orders` → `programMemberships`
  → `businesses` **en ese orden y a proposito**, porque esas FKs no cascadean. `campaign_turn.membership_id`
  y `.consumer_id` siguen el **mismo** patron (`no action`, calcado de `reward_redemption` — verificado
  leyendo `schema/reward-redemption.ts:48-61`), asi que **cualquier test que siembre turnos y llame a
  `dropBusiness` va a explotar por FK**: hay que borrar `coupon_redemption` y `campaign_turn` **antes** de
  las membresias. `pass_placement.consumer_id` **si** cascadea, ese no molesta.

- **DECISIONES DE DETALLE DEL IMPLEMENTADOR EN A1 (declaradas, todas reversibles, ninguna toca un
  invariante):** `coupon_cost_snapshot` como `numeric(12,2)` (la spec decia `numeric` pelado; se alineo con
  la columna origen); FKs sin accion declarada → `no action`, salvo `coupon_redemption.business_id` que va
  **cascade** calcando `reward_redemption`; `campaign_turn.business_id` **sin FK** (es la denormalizacion que
  la spec anota); los «≤ N» de `name` y `coupon_label` bajados a `CHECK`; y **cuatro indices que la spec no
  enumera** (`coupon_redemption` por campaña y por negocio+fecha, `pass_placement` por negocio y por turno),
  todos aditivos y justificados por una consulta que la spec si pide.

- **FASE A2 (funciones puras): CERRADA — codigo verde y TABLA DE MUTACIONES COMPLETA (9/9 + 6 sondas por docblock + 4 tests nuevos).**
  El implementador **MURIO a mitad de la medicion** (se corto la sesion, nunca entrego handoff). Archivos
  creados, todos `??` bajo `apps/merchant/src/server/marketing/`: `placement-plan.ts`, `utility-text.ts`,
  `relevant-text.ts`, `merit.ts`, mas `placement-plan-cases.ts` y los tests `placement-plan.test.ts` (7),
  `placement-slots.test.ts` (4), `relevant-text.test.ts` (6), `utility-text.test.ts` (9), `merit.test.ts` (4).
  **Los 9 casos (a)-(i) de la spec existen.** Gates de root corridos por el orquestador **despues** de
  sanear el arbol: `typecheck`/`lint`/`format:check` VERDES y **`Tests 757 passed | 221 skipped (978)`**
  — el baseline antes de A2 era **727**, o sea **+30 y cero regresiones**.

- **RESCATE DE LA MUTACION ABANDONADA (2026-09-15, noche) — hecho, no pendiente.** El agente murio con
  **M2 puesta** en `placement-plan.ts:191`. Protocolo aplicado en este orden: (1) **`ListAgents` ANTES de
  tocar nada** — ningun subagente vivo, o sea abandonada y no en uso; (2) `marketing/` es **untracked**, asi
  que **`git checkout` no habria hecho nada**: copia a `/tmp/placement-plan.MUTADO-M2.ts` primero
  (`shasum` mutado `0f1ec366c9c54a7496f04c06ed5cb611e20c6139`); (3) **se COMPLETO la medicion en vez de
  perderla** — la mutacion seguia puesta, asi que se corrio ahi mismo; (4) revertida, `diff` contra la copia
  mutada de **exactamente una linea**, `grep MUTATION` **vacio**, `shasum` limpio
  `a1454541da0c1baeded94ea5af6edc6acd1c9002`.
  *(La leccion de `CLAUDE.md` que esto ejercita: el resultado ya ejecutado de una mutacion se pierde si se
  revierte sin medir. Aca no se perdio.)*

  **BITACORA DE MUTACIONES DE A2** — `id | archivo | shasum limpio | invariante | alcance | RESULTADO`:

  | id | archivo | invariante que ataca | resultado EJECUTADO |
  |---|---|---|---|
  | M2 | `placement-plan.ts` (limpio `a1454541…`) | «1 turno por negocio» | **ROJO (c)**, y **solo** (c). Corrida contra los **dos** archivos que pueden verla: `placement-plan.test.ts` 1 rojo, `placement-slots.test.ts` verde. Asercion leida (no solo «es rojo»): `expected [ 'turn-c1', 'turn-c2' ] to deeply equal [ 'turn-c1' ]` — habla de la **propiedad**, no del setup |
  | M1 | `placement-plan.ts` | regla de 400 m | **ROJO (b) y SOLO (b)** — `expected [ 'turn-a', 'turn-b' ] to deeply equal [ 'turn-a' ]`. Coincide con la prediccion |
  | M3 | `placement-plan.ts` | contar holdouts en el `< 5` | **ROJO (e)**, 1 solo. Muere en la PRIMERA asercion (`placement-plan.test.ts:104`): `expected … to have a length of 6 but got 5` — el holdout se comio uno de los 5 cupos y el 6.º turno nunca se activo. Habla de la propiedad. **No llega a la asercion de `placements`**, o sea que el test pinnea «el holdout no ocupa cupo» pero la mitad «no aparece en el pase» no la mide ESTA mutacion |
  | M4 | `placement-plan.ts` | el cooldown se evalua al ACTIVAR (el guard existe y muerde) | **ROJO (i)**, 1 solo — `expected [ { turnId: 'turn-i', …(8) } ] to deeply equal []`. Coincide |
  | M5 | `placement-plan.ts` | dedupe al reves (utilidad gana) | **ROJO (h)**, 1 solo, en el OTRO archivo (`placement-slots.test.ts`) — `expected 'utility' to be 'both'`. Coincide |
  | M6 | `relevant-text.ts` | truncar en vez de descartar el saldo | **DOS ROJOS**, los dos en `relevant-text.test.ts`: «drops the balance ENTIRE» (`expected 'Bar La Esquina: te faltan 2 sellos · …' to be 'Bar La Esquina: 2x1 en picadas hasta …'`) y «never returns more than the cap» (`expected 19 to be 20`). La prediccion decia uno |
  | M7 | `merit.ts` | rankear por tasa cruda | **ROJO (d)**, 1 solo — `expected 0.275 to be less than 0.08333…`: el ejemplo del ADR 0065 se lo lleva A (+3) en vez de B (+8). Coincide |
  | M8 | `merit.ts` | quitar el encogimiento | **DOS ROJOS**: (a) `expected 1 to be less than 0.6000…` y ademas «treats an empty side as 0, never NaN» (`expected 0.3 to be close to 0.1`). **M7 y M8 NO son indistinguibles** — cada una cae en un rojo distinto, contra lo que paso en la spec 0055 |
  | M9 | `merit.ts` | debutante al fondo (`defaultScore: -Infinity`) | **ROJO (b)** — `expected [ 'proven', 'weak', 'debutante' ] to deeply equal [ 'proven', 'debutante', 'weak' ]`. Coincide |
  | M9b | `merit.ts` | variante MAS PLAUSIBLE que `-Infinity`: `defaultScore: 0` | **ROJO (b)** tambien, pero por **otra asercion**: `expected +0 to be 0.15000…` (la linea `toBe(globalLift(rows))`), no por el ranking — con esas filas el debutante en 0 **sigue quedando en el medio**. Sonda extra del orquestador: dice **cual** de las dos aserciones del test hace el trabajo en cada caso |

  **PRE-REGISTRO DE LAS 8 PENDIENTES — ESCRITO ANTES DE MUTAR (2026-09-15, cierre de A2).** Punto de
  retorno: todos los archivos estan **COMMITEADOS en `ddd64d2`**, asi que a diferencia del rescate de M2 el
  `git checkout` SI existe. Restauracion de cualquiera:
  `git checkout -- apps/merchant/src/server/marketing/<archivo>` y despues `shasum` contra el baseline de
  abajo. Corrida: `node ../../node_modules/vitest/vitest.mjs run src/server/marketing/` desde `apps/merchant`
  (**los 5 archivos de test juntos, 459 ms** — el alcance es el directorio entero, no el archivo esperado:
  `relevant-text.ts` lo consume `placement-plan.ts` y `truncateText` lo consumen los dos).
  **Baseline verde re-medido hoy: `Tests 30 passed (30)`, 5 archivos.**

  | id | archivo:linea | edicion exacta |
  |---|---|---|
  | M1 | `placement-plan.ts:197` | `< limits.minSeparationMeters` → `< 0` (deja `tooClose` usado: sin lint rojo colateral) |
  | M3 | `placement-plan.ts:215` | comentar `if (holdout) continue;` (el holdout pasa a ocupar slot) |
  | M4 | `placement-plan.ts:183` | `limits.cooldownDays * DAY_MS` → `0 * DAY_MS` (el piso queda en `now`: el guard nunca dispara) |
  | M5 | `placement-plan.ts:248` | insertar `if (shared) continue;` (gana la utilidad, no el turno) |
  | M6 | `relevant-text.ts:50` | `truncateText(campaignOnly, cap)` → `truncateText(composed, cap)` |
  | M7 | `merit.ts:45-48` | `liftOf` devuelve solo `rate(placedPurchases, placedN)` (tasa cruda) |
  | M8 | `merit.ts:67` | `return liftOf(stats);` (sin encogimiento) |
  | M9 | `merit.ts:108` | `defaultScore: average` → `defaultScore: -Infinity` (debutante al fondo) |

  **PRESUPUESTO Y CONDICION DE CORTE, declarados en el encargo (`CLAUDE.md`, ADR 0062 + la instruccion del
  owner del 2026-09-13):** estas 8, mas **una sonda por cada docblock de los 4 modulos que afirme un
  invariante** — ese conjunto **ya esta enumerado** (abajo, D1..D6) despues de leer los cuatro archivos.
  **Clase de error que tienen que cazar: un invariante declarado —en la spec o en un docblock del codigo
  nuevo— que NINGUN test pinnea, con una regresion PLAUSIBLE** (el cambio que haria un implementador
  distraido), no una evasion adversarial escrita a proposito. **Una sola vuelta:** lo que quede sin oraculo
  se **DECLARA** en la spec y en este archivo y pasa al QA o a la integracion de A5; no se abre una vuelta 2
  ni se persigue un hallazgo que no sea riesgo de produccion.

  **SONDAS POR DOCBLOCK NORMATIVO (D1..D6) — enumeradas LEYENDO los 4 modulos, no de memoria.** Cada una
  ataca una frase que el codigo AFIRMA y que la tabla de mutaciones de la spec no podia ver, porque la tabla
  se escribio antes de que esos comentarios existieran (`CLAUDE.md`: la tabla se escribe desde el diseño):

  | id | docblock que afirma el invariante | edicion exacta |
  |---|---|---|
  | D1 | `placement-plan.ts:168-171` «fallar una condicion solo SALTEA ese candidato — sigue `queued`; eso es lo que hace de los 400 m una separacion y no una purga» | `if (tooClose) continue;` → `break` |
  | D2 | `placement-plan.ts:172-173` «el holdout se sortea DESPUES de los filtros, por eso un retenido es un turno que SI se habria colocado» | mover `const holdout = input.random() …` al tope del `for` |
  | D3 | `placement-plan.ts:151-153` «desempate final por `turn_id` para que dos corridas sobre los mismos datos den el mismo orden aunque el driver devuelva las filas mezcladas» | el ultimo `return` de `byMerit` → `0` |
  | D4 | `placement-plan.ts:264-265` «el orden es irrelevante: es un conjunto» | quitar los dos `.sort()` de `differs` |
  | D5 | `placement-plan.ts:93-94` «techo duro del pase: Apple acepta 10 `locations`, Google 10 por objeto» | quitar `.slice(0, limits.maxSlots)` |
  | D6 | `merit.ts:70-75` «el promedio global es POOLED: pesa a cada negocio por su volumen en vez de dejar que uno con dos turnos mueva el prior igual que uno con dos mil» | `globalLift` devuelve el promedio simple de `liftOf` por fila |

  **La columna «esperado» era la PREDICCION de la spec, no un resultado.** Se ejecutaron las 8 y se
  transcribio lo que paso: **las 8 dieron rojo**, y en dos casos (M6, M8) el rojo fue **doble** donde la
  prediccion decia uno. Ninguna resulto indistinguible de otra.

  **RESULTADO DE LAS SONDAS POR DOCBLOCK (D1..D6): LAS SEIS VERDES. Ese es el hallazgo del ciclo.**
  Seis invariantes que el codigo nuevo AFIRMA en un comentario y que **ningun test pinneaba** — exactamente
  la familia que `CLAUDE.md` describe (la tabla de mutaciones se escribe desde el diseño, asi que no ve lo
  que el codigo termino afirmando). **Cuatro son riesgo de produccion y se cerraron con un test cada uno;
  dos se DECLARAN** (abajo). Los cuatro tests nuevos se **midieron**, no se predijeron:

  | id | 1a vuelta (sin test) | test nuevo | 2a vuelta (con el test) |
  |---|---|---|---|
  | D1 | VERDE 30/30 | `(D1) skips the too-close candidate and keeps walking the queue` | **ROJO** `expected [ 'turn-a' ] to deeply equal [ 'turn-a', 'turn-c' ]` (y arrastra tambien al de D2: el `break` se come igual a `turn-c`) |
  | D2 | VERDE 30/30 | `(D2) draws the holdout AFTER the filters, so a skipped turn burns no draw` | **ROJO**, diff leido entero: `turn-c` pasa de `true` a `false` — el turno filtrado por los 400 m se comio el sorteo. Habla de la propiedad |
  | D4 | VERDE 30/30 | `(D4) does not refresh when the SAME set comes back in another order` | **ROJO** `expected true to be false` |
  | D6 | VERDE 30/30 | `(D6) pools the global lift: two turns do not move the prior like a thousand` | **ROJO** `expected 0.6 to be close to 0.2021926` |

  **Por que D4 y D6 importan mas de lo que parecen:** sin el `sort` de `differs`, un `select` que devuelva
  las mismas filas en otro orden marca `refresh = true` **en cada tick** → reescritura del pase,
  `message_updated_at` nuevo y una fila de `pass_refresh` por corrida, para siempre. Y la asercion que
  cubria D6 era **TAUTOLOGICA**: `expect(table.defaultScore).toBe(globalLift(rows))` compara la funcion con
  ella misma y queda verde bajo cualquier agregacion — el test nuevo usa un **valor hardcodeado**
  (`0.2021926`) y ademas las filas viejas (dos negocios de 50 turnos) daban **el mismo numero** pooled que
  por promedio simple, o sea que con ese fixture la propiedad era inobservable.

  **LOS DOS QUE SE DECLARAN, con el limite verificado y no supuesto (condicion de corte: una vuelta):**
  - **D3 — el desempate final por `turn_id` no tiene oraculo.** Sin el, `Array.sort` (estable en V8) deja
    el orden de entrada, que viene del driver sin `order by` total: entre candidatos con **identico** score
    y **identico** `queued_at` al milisegundo gana uno arbitrario. Las dos elecciones son validas; no hay
    invariante roto, solo reproducibilidad. **No es riesgo de produccion → se declara y se sigue.**
  - **D5 — el techo `maxSlots = 10` es INALCANZABLE con los limites default, MEDIDO.** Sonda temporal
    (`zz-probe-d5.test.ts`, corrida y **borrada en el mismo turno**, `ls | grep -c zz-probe` = 0): con **30
    candidatos `queued` y 30 de utilidad** el plan da **5 activaciones y 8 slots** — `utilitySlots` 3 +
    `maxActiveTurns` 5 = 8 < 10. El `.slice(0, maxSlots)` es una defensa que no puede disparar sin bajar
    otro limite; escribirle un test exigiria un `limits` artificial que no prueba nada del producto. **Esto
    es una medicion, no un razonamiento sobre el codigo.**

  **BASELINE PARA AUDITAR EL ARBOL — RE-MEDIDO en el handoff (no copiado del mensaje anterior).** Si una
  sesion fresca corre `shasum` y algo no coincide, **alguien dejo una mutacion puesta**; si coincide todo,
  el arbol esta limpio. Al 2026-09-15 noche, con los 5 gates en verde:

  ```
  6b72c2b46b23fa235dc6dc2fae5f3c3daa6d9d1d  marketing/merit.ts
  f9a592f9558844fd31e84fd9daa3f44b49358006  marketing/merit.test.ts
  a1454541da0c1baeded94ea5af6edc6acd1c9002  marketing/placement-plan.ts
  ccaf5424fe397fe60896dad59d1dee8dc17598cc  marketing/placement-plan.test.ts
  ffbb4f260a0e84dfd09ae834fdc1ca4b2d0fad97  marketing/placement-plan-cases.ts
  f27d84f61e9e5659d686a7c56952543739c92e00  marketing/placement-slots.test.ts
  07bd89db64da1a9f0ffaacd3288f5d9d2b7141b8  marketing/relevant-text.ts
  7769450d2f4da0f560b2ea1da88cc6ea1849d4b4  marketing/relevant-text.test.ts
  7f269930bfdff8bb997e3b8976a0f58c5782aefc  marketing/utility-text.ts
  048e063a0198f0b7935386c83f94b38d46e23c0a  marketing/utility-text.test.ts
  ```
  **RE-MEDIDOS al cerrar las mutaciones (2026-09-15, noche): los 4 fuentes `.ts` estan IDENTICOS al baseline
  anterior** —ninguna mutacion sobrevivio, y como A1/A2 estan commiteadas en `ddd64d2` el `git checkout` de
  emergencia SI existe para estos archivos— y **cambiaron los 3 archivos de test** que recibieron los casos
  D1/D2/D4/D6 (`merit.test.ts`, `placement-plan.test.ts`, `placement-slots.test.ts`). `grep -rn MUTATION
  marketing/` **vacio**.
  Comando: `shasum apps/merchant/src/server/marketing/*.ts`
  **Los shasum de A1 del handoff anterior estan PODRIDOS y no se usan** — `campaign-turn.ts` cambio despues
  (el check de `relevant_text` 60→120) y la 0031 se regenero con otro nombre. Los vigentes de A1 se re-miden
  con `shasum apps/merchant/src/server/schema/campaign*.ts`.

  **TAMAÑOS RE-MEDIDOS DESPUES DE PRETTIER (preguntados AL HOOK y con un control que da `EXIT=2` sobre un
  archivo de 447 lineas, para probar que discrimina), sobre los ` M` Y los `??` del alcance:**
  `placement-plan.test.ts` **224**, `placement-slots.test.ts` **129**, `merit.test.ts` **76** — los tres
  `EXIT=0` y holgados. Los de A1/A2, sin cambios:
  `placement-plan.ts` **284/300** y `schema/consumer.ts` **298/300** — **la proxima fase que los toque los
  parte, no los extiende.** El resto holgado: `merit.ts` 138, `utility-text.ts` 102, `relevant-text.ts` 51,
  `campaign.ts` 162, `campaign-turn.ts` 252.

  **DECISION DEL ORQUESTADOR (EJECUTADA): las 8 que faltaban NO se re-despacharon, las termino el
  orquestador a mano** (`CLAUDE.md`, corolario (f) de la 0064: reanudar un encargo muerto sale mas caro que
  terminarlo). **Confirmado en la practica: 8 mutaciones + 6 sondas + 4 re-corridas = ~5 min de reloj**, una
  linea y una corrida de 460 ms cada una. La fila de bitacora se escribio **ANTES** de mutar (el pre-registro
  de arriba).

  **GATES DE ROOT AL CERRAR A2 (corridos por el orquestador, Node `v24.20.0`):** `typecheck` **3/3**,
  `lint` limpio, `format:check` «All matched files use Prettier code style!», `test`
  **`Tests 761 passed | 221 skipped (982)`** — el baseline de A2 era **757**, o sea **+4 y cero
  regresiones** —, `build` **exit 0**. El directorio `marketing/` solo: **34 passed (34)** en 456 ms.

**FASE A3 (carril `pass_refresh`): DESPACHADA a un implementador el 2026-09-15 (noche), DESPUES de cerrar
A2.** Serializada: **un solo implementador a la vez sobre el arbol** (dos se pisan los gates). Archivos de su
alcance, todos **trackeados y limpios** al despachar (o sea que el `git checkout` de emergencia SI existe para
ellos): `wallet/push-plan.ts` (58 l.), `wallet/push-worker.ts` (120), `wallet/push-channel.ts` (130),
`wallet/google.ts` (211), `wallet/push-transports.ts` (186), `wallet/push.ts` (**285/300 — si su cambio lo
pasa, se parte, no se extiende**), y los tests `server/push.test.ts` (208) y `server/wallet-push.test.ts` (216).

- **Lo que el orquestador verifico EN EL ARBOL antes de escribir el encargo** (no se paso ninguna cita de la
  spec sin abrirla): `push-worker.ts:60` es literalmente
  `klass: r.klass === "campaign" ? "campaign" : "transactional",` sobre la union de `push-plan.ts:10`;
  `push-channel.ts` tiene la interfaz en :19, `FakeCall` en :26, `FakePushChannel` en :35 y `RealPushChannel`
  en :61; en `google.ts` las dos unicas salidas son POST (`googleAccessToken` ~:105 y `postGoogleMessage`
  ~:137) y el molde puro es `buildAddMessageRequest` (:74), ya testeado en `wallet-push.test.ts:199`;
  `planTransports` tiene **3 consumidores** — `deliverTransports` (`push-transports.ts:171`) y **4 aserciones**
  en `push.test.ts` (:167, :175, :184, :192). El check de `class` de la cola **ya acepta `pass_refresh`**
  desde A1 (`schema/consumer.ts:291`, `0031_…sql:140`): A3 **no** toca schema ni genera migracion.
- **RENAME AUTORIZADO POR LA SPEC (no es «editar un test para que pase»):** `TransportPlan.google` →
  `googleAddMessage`, mas `googlePatch`. La forma `{apple, googlePatch, googleAddMessage, webPush}` es la
  **literal** del plan de pruebas, y es lo que vuelve imposible confundir un PATCH con un `addMessage` — el
  agujero exacto que el DoD prohibe (`sendGoogle(serial, {header:'',body:''})` deja el fake registrando
  `{kind:'google'}` igual que un PATCH: test verde, notificacion real al consumidor).
- **COSTURON A3↔A4, declarado por el orquestador ANTES de implementar:** el **contenido** del cuerpo del
  PATCH (`merchantLocations` + modulos por turno) es de **A4**. En A3 la firma es
  `patchGoogleObject(serialNumber, patch: Record<string, unknown>)` y A4 llena el cuerpo. **Esto es
  andamiaje con dueño: su fila que lo consume es A4, aca escrita** (`CLAUDE.md`: nada de andamiaje sin su
  tarea).
- **FUERA DE A3, a proposito:** la integracion Neon end-to-end del carril y el item del coalescing/retry
  («a lo sumo un `pass_refresh` vivo por consumidor; una fila devuelta a `pending` no rompe contra el
  coalescing») dependen del **aplicador**, asi que quedan en **A5** — que es donde la spec ya los agrupa.
  No se invento alcance para completar la simetria.
- **PRESUPUESTO ESCRITO EN EL ENCARGO (ADR 0062 + la instruccion del owner del 2026-09-13):** las **3**
  mutaciones que nombra la spec (restaurar el ternario con default `transactional`; tratar `pass_refresh`
  como `transactional` en `planConsumerDrain`; devolver el fan-out de `campaign`) **+ a lo sumo 4 sondas**
  sobre docblocks nuevos que afirmen un invariante — la familia que caza los bloqueantes de verdad (4 en la
  fase D1, **6 en A2**). Clase de error: invariante declarado sin oraculo, con regresion **plausible**.
  **Condicion de corte: UNA vuelta**; lo que quede se declara y pasa al revisor.
- **Baseline que el implementador tiene que igualar o superar:** `test` de root
  **`761 passed | 221 skipped (982)`**. Un numero menor es una regresion.

**A3 — EL IMPLEMENTADOR MURIO SIN HANDOFF; LO TERMINO EL ORQUESTADOR A MANO (2026-09-16, madrugada).**
`CLAUDE.md`, corolario (f) de la 0064: reanudar un encargo muerto sale mas caro que terminarlo. **Codigo
completo y los 5 gates en verde**; la bitacora de mutaciones la corre el orquestador porque el implementador
no entrego ninguna.

**AUDITORIA DEL ARBOL AL HEREDAR, en el orden del protocolo:** (1) **`ListAgents`** — ningun subagente vivo,
o sea abandonado y no midiendo; (2) `git status --short` → 7 ` M` + 4 `??`; (3) `grep -rn MUTATION
apps/merchant/src` **vacio**. **Pero `grep MUTATION` solo ve mutaciones ETIQUETADAS**, asi que eso no alcanza
— y el oraculo que si alcanza aparecio solo: el implementador habia dejado **`/tmp/a3-clean/SHASUMS.txt`**
(23:45) con 10 archivos, y **los 10 coinciden exactamente con el arbol actual**. Eso convierte «no parece
haber mutaciones» en **verificado**. El unico archivo ausente de esa lista es
`wallet-pass-refresh-worker.test.ts` — el que nunca termino (ver abajo).
*(La leccion que esto ejercita: el `shasum` que se registra ANTES de mutar es el unico punto de retorno que
existe. Aca salvo la auditoria de una sesion que heredo el arbol sin handoff.)*

**UN ROJO QUE ERA DEL TEST, NO DEL CODIGO — y el reflejo de borrarlo habria tapado un oraculo.**
`wallet-pass-refresh-worker.test.ts:109` aseveraba `expect(queueUpdates).toEqual([])` con el comentario
«nada se postergo por el cooldown». **Estaba rojo contra codigo correcto:** ese colector junta **todo**
`update().set()`, y la `campaign` que el caso siembra escribe legitimamente su `latest_message` y su
`last_push_at`. El oraculo de verdad es la linea de arriba (`summary` = `{sent: 2, rescheduled: 0}`), que
**pasaba**. Se reemplazo por la asercion **mas fuerte** —los dos writes de la campaña y **nada mas**, o sea
que el refresco no escribio ninguno—, que ademas pinnea una propiedad que la version vieja no pinneaba.
Queda anotado que **ese test lo escribio el orquestador**, no el implementador: el revisor independiente de
la fase A tiene que mirarlo con esa etiqueta.

**LO QUE ENTREGO EL IMPLEMENTADOR (auditado leyendo el diff entero, no su resumen — no dejo ninguno):**
`push-plan.ts` (`NoticeClass` de tres miembros + `CLASS_RANK` para que el comparador sea **total**, que con
dos clases era un ternario y con tres deja de ser un orden estricto; `pass_refresh` siempre `send` y **sin
tocar el reloj**), `push-worker.ts` (`parseQueueClass` **puro y exportado**, exhaustivo, clase desconocida
**tira**), `push-channel.ts` + `google.ts` (`patchGoogleObject` en la interfaz, el fake y el real;
`buildPatchObjectRequest` puro calcado de `buildAddMessageRequest`; `patchGoogleLoyaltyObject` con
`method: "PATCH"`), `push-transports.ts` (`TransportPlan` con `googleAddMessage` **y** `googlePatch`
separados, mas el rename en las 4 aserciones de `push.test.ts`), `push.ts` (guarda `silent`: sin
`latest_message`, sin `message_updated_at`, sin `last_push_at`, **sin preempcion**) y **`push-text.ts`
nuevo** — partio `push.ts` de **285 a 253** en vez de extenderlo, que es lo que pedia el limite.
**+16 tests: `777 passed | 221 skipped (998)`** contra el baseline de **761**.
**El test del CABLEADO es el mas valioso y no estaba en el plan de pruebas:** extraer `parseQueueClass`
convirtio un comportamiento («el refresco llega al planner como refresco») en una decision («el mapeo dice
refresco») y dejo el call-site de `selectDue` sin oraculo — el hueco exacto de la tarea 38. Lo cerro
mockeando `../db` y corriendo `runPushWorker` de verdad.

**BITACORA DE MUTACIONES DE A3 — PRE-REGISTRO ESCRITO ANTES DE MUTAR.** Los 4 archivos a mutar estan ` M`
(trackeados **y modificados**): ahi `git checkout` **no es el camino, se llevaria tambien el trabajo no
commiteado**. Copia limpia en `/tmp/a3-clean/` y restauracion con `diff` contra ella. `shasum` limpios:
`push-plan.ts 1e694d81…`, `push-worker.ts 17a1650b…`, `push-transports.ts 7b802af4…`, `push.ts 96009e20…`.
Presupuesto del encargo: **3 mutaciones de la spec + 4 sondas por docblock nuevo**; clase de error, un
invariante declarado sin oraculo con regresion plausible; **corte en una vuelta**.

| id | archivo | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|
| M1 | `push-worker.ts` | el call-site de `selectDue` no colapsa la clase | **ROJO, 1 solo — y SOLO el del cableado**: `wallet-pass-refresh-worker.test.ts`, `expected {sent,rescheduled,…} to deeply equal {sent: 2, rescheduled: +0}`. **Los unitarios puros quedan TODOS VERDES.** Esa es la medicion del hueco de la tarea 38: extraer `parseQueueClass` cerro la decision y dejo el cableado sin oraculo; el test que lo tapa es el unico que muerde aca, y **no estaba en el plan de pruebas de la spec** |
| M2 | `push-plan.ts` | `pass_refresh` no avanza el reloj | **ROJO, 4** (los 3 de `planConsumerDrain` + el del cableado). Aserciones leidas: `expected { kind: 'reschedule' } to match object { kind: 'send', row: { id: 'ref' } }` — habla de la propiedad. M2 ⊃ el sintoma de M1, pero M1 tiene un rojo que **solo** el cableado ve: **no son indistinguibles** |
| M3 | `push-transports.ts` | el fan-out de `pass_refresh` no es el de `campaign` | **ROJO, 2**: el unit del fan-out y —lo que importa— el de entrega, `expected [ 'apple', 'google' ] to deeply equal [ 'apple', 'google-patch' ]`. **Ese rojo es exactamente el que el `{kind:'google-patch'}` del fake existe para producir**: sin ese miembro, `addMessage` y `PATCH` eran indistinguibles y el test habria pasado mandando una notificacion real |
| P1 | `push-plan.ts` | el comparador es TOTAL para tres clases | **ROJO, 1**: `expected [ 'txn', 'camp', 'ref-a', 'ref-b' ] to deeply equal [ 'txn', 'ref-a', 'ref-b', 'camp' ]` — con dos ternarios, `campaign` se le adelanta al refresco |
| P2 | `push-plan.ts` | el desempate por `id` no depende de la estabilidad del sort | **ROJO, 1** — cae en el **mismo test** que P1 pero con otro recibido: `[ 'txn', 'ref-b', 'ref-a', 'camp' ]` (se desordenan los dos refrescos empatados, no las clases). **Distinguibles**, contra lo que paso en la spec 0055 |
| P3 | `push-transports.ts` | «nada setea los dos flags de Google a la vez» | **ROJO, 2**: `expected [ 'apple', 'google', 'google-patch' ] to deeply equal [ 'apple', 'google-patch' ]`. La propiedad **es universal sobre las clases**, pero `planTransports` tiene exactamente **4 `return`** y los cuatro estan pinneados con `toEqual` exacto, asi que queda cerrada **por exhaucion** — no hace falta un test nuevo, y eso es una conclusion medida, no un razonamiento |
| P4 | `push.ts` | la guarda `silent` | **ROJO, 2**: el de entrega (`expected [ { latestMessage: '', …} , …] to deeply equal []`) **y el del cableado** (`expected [4 items] to deeply equal [2 items]`). Ese segundo rojo lo produce **la asercion que el orquestador escribio para reemplazar la rota**: o sea que el reemplazo no fue tapar un rojo, **agrega un oraculo que antes no existia**. Medido, no afirmado |

**RESULTADO DE A3: LAS 7 MUTACIONES ROJAS, ninguna indistinguible de otra, y el arbol restaurado con
`shasum` identico al limpio en los 4 archivos** (`push-plan.ts 1e694d81…`, `push-worker.ts 17a1650b…`,
`push-transports.ts 7b802af4…`, `push.ts 96009e20…`), `grep -rn MUTATION apps/merchant/src` **vacio**.
Restauracion con `diff` contra `/tmp/a3-clean/` en cada vuelta — nunca `git checkout`, porque los 4 estaban
` M` y se habria llevado tambien el trabajo no commiteado.
**Los 5 gates de root, re-corridos DESPUES de restaurar:** `typecheck` 3/3, `lint` limpio, `format:check` ok,
`test` **`777 passed | 221 skipped (998)`** (baseline 761 → **+16, cero regresiones**), `build` exit 0.
**Tamaños preguntados AL HOOK sobre TODO el alcance (` M` y `??`), post-prettier, todos `EXIT=0`:**
`google.ts` **262**, `push.ts` **253** (bajo de 285 al partirse), `push-transports.ts` **250**,
`push.test.ts` 215, `wallet-pass-refresh.test.ts` 175, `push-channel.ts` 163,
`wallet-pass-refresh-deliver.test.ts` 153, `push-worker.ts` 143, `wallet-pass-refresh-worker.test.ts` 120,
`push-plan.ts` 102, `push-text.ts` 51.
**AVISO PARA A4, que toca los DOS archivos mas gordos de este alcance:** `google.ts` queda con **38 lineas
de margen** y `push-transports.ts` con **50**. A4 tiene que llenar `patchGoogle` (`push-transports.ts:~105`,
hoy manda `{}` a proposito) y el objeto de Google con `merchantLocations`. **Si no entra, se parte — no se
extiende**, y conviene decidirlo ANTES de escribir, no cuando el hook avise.

**LO QUE QUEDA DECLARADO DE A3 (intentado, no supuesto):**
- **El cuerpo del PATCH es `{}` hoy.** No es un hueco disimulado: no existe ningun productor de filas
  `pass_refresh` todavia (el aplicador del tick es de **A5**), asi que ninguna fila de produccion llega aca.
  Su dueño es **A4**, con la fila escrita arriba. Lo que **no** se verifico —y no se podia sin credenciales
  de Google— es si la API acepta un `PATCH` con cuerpo vacio; es irrelevante hoy y deja de serlo en A4, que
  es cuando el cuerpo se llena.
- **`parseQueueClass` TIRA ante una clase desconocida, y eso mata el drain de TODOS los consumidores de esa
  corrida**, no solo la fila mala. Es lo que la spec pide literalmente («clase desconocida → error, no
  `transactional`») y el check de la base ya restringe la columna a los tres valores, asi que solo dispara
  ante un drift schema↔codigo. **Se declara como decision de la spec, no como hallazgo.**
- **La integracion Neon end-to-end del carril y el item del coalescing/retry siguen en A5**, como se declaro
  al despachar. A3 no las toco.

**FASE A4 (`locations`/`merchantLocations` en el pase): DESPACHADA el 2026-09-16 (madrugada), despues de
cerrar A3.** Serializada: un solo implementador a la vez. Alcance: `wallet/provider.ts` (145 l.),
`wallet/apple.ts` (207), `wallet/google.ts` (**262/300**), `wallet/push-transports.ts` (**250/300**), los
**tres** call-sites de emision y un lector nuevo de `consumer.pass_placement`.

- **VERIFICADO EN EL ARBOL POR EL ORQUESTADOR antes de encargar** (los tres archivos abiertos, no la cita de
  la spec): `passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts:62-69` —**el unico de los tres que hoy
  pasa `latestMessage`**—, `apple.pkpass/route.ts:31-36` y `google/route.ts:33-38`. Eso confirma el trap de
  la spec: **`latestMessage?` es opcional y dos de los tres call-sites lo omiten sin que nada se queje**, asi
  que el campo de ubicaciones entra **REQUERIDO** o el pase se sirve sin ubicaciones con los 5 gates verdes.
- **DOS TRAMPAS QUE EL ORQUESTADOR MIDIO Y BAJO AL ENCARGO, para que no se descubran a los golpes:**
  (1) `location.latitude`/`.longitude` son **`numeric(10,7)`** (`schema/business.ts:174-175`), asi que **el
  driver las devuelve como STRING** y Apple/Google esperan numeros — un `latitude: row.latitude` pasa
  `typecheck` y produce `"latitude": "-34.6083"`, que el telefono ignora: **fuga silenciosa con todo en
  verde**, la familia mas caracteristica de este repo. (2) **Las dos columnas son NULLABLE**, asi que una
  ubicacion sin geocodificar no puede entrar al pase. Las dos con test pedido.
- **SPLIT DECIDIDO ANTES DE ESCRIBIR (no cuando el hook avise):** lo que A4 agrega no entra en `google.ts`.
  Corte mapeado por el orquestador: las lineas **1–115** son los constructores **puros** y **122–262** son
  red + JWT; moviendo los puros a `google-object.ts` quedan ~115 y ~150. Precedente de A3: `push-text.ts`
  con re-export desde `push.ts`. **Y el aviso de la 0064: los 11 errores que quedaron en aquel cierre eran
  imports huerfanos de archivos a medio partir** — `typecheck` va inmediatamente despues del movimiento,
  antes de agregar nada.
- **El cuerpo del `PATCH` que A3 dejo en `{}` es de A4**, con la funcion nombrada (`patchGoogle` en
  `push-transports.ts`): el andamiaje tenia dueño escrito y aca se cobra.
- **PRESUPUESTO: a lo sumo 6 mutaciones** — 4 obligatorias (`locations` en vez de `merchantLocations`;
  escribir `maxDistance`; no filtrar la ubicacion sin coordenadas; pasar la latitud como string) **+ 2
  sondas** por docblock. Clase de error: invariante declarado sin oraculo, regresion plausible. **Corte en
  una vuelta.** Al encargo se le escribio ademas **por que** existe el presupuesto: en A2 las sondas
  encontraron 6 huecos reales y en A3 las 7 mutaciones dieron 7 rojos, pero la 0064 se comio una sesion con
  14 mutaciones donde **las primeras 4 ya habian dado todo el valor**.
- **Baseline a igualar o superar:** `test` = **`777 passed | 221 skipped (998)`**.

**A4 — EL IMPLEMENTADOR MURIO SIN HANDOFF (segunda muerte consecutiva); LO CERRO EL ORQUESTADOR A MANO
(2026-09-16).** `CLAUDE.md`, corolario (f) de la 0064: dos muertes seguidas son la señal de dejar de
despachar. **A5 la hace el orquestador**, y a un agente solo se le manda lo que sea de verdad independiente.

**AUDITORIA AL HEREDAR — y la diferencia importante con A3:** `ListAgents` sin subagentes vivos,
`grep -rn MUTATION apps/merchant/src` **vacio**, y los **5 gates en VERDE** (`typecheck` 3/3, `lint` limpio,
`format:check` ok, `test` **`797 passed | 221 skipped (1018)`** = **+20** sobre 777, `build` exit 0).
**Pero este implementador NO dejo `shasum` baseline ni copias en `/tmp`**, asi que —a diferencia de A3, donde
su propio `SHASUMS.txt` coincidia con el arbol— **no existe oraculo que diga «no sobrevive ninguna mutacion
sin etiquetar»**. La auditoria se hizo **leyendo el diff entero**, que es lo que reemplaza al handoff ausente.

**LO QUE ENTREGO (auditado leyendo el codigo, no un resumen — no dejo ninguno):**
- **`provider.ts`**: `passLocations: PassLocation[]` **REQUERIDO** (no opcional), con el porque escrito en el
  docblock: `latestMessage?` es opcional y **por eso dos de los tres call-sites nunca lo pasaron**.
- **`pass-locations.ts` (nuevo, 97 l.)**: el tipo del pase + `toPassLocations` **pura**. Caza las dos trampas
  que el orquestador habia medido y **una tercera que no estaba en el encargo**: `Number(null)` y `Number("")`
  son **`0`**, un numero finito, asi que un guard de `Number.isFinite` **solo** habria puesto la puerta sin
  coordenadas **en el ecuador** en vez de descartarla. El chequeo de vacio va primero y sobre el **string**.
- **`pass-locations-store.ts` (nuevo, 76 l.)**: el unico lector de `pass_placement`, con `join` a
  `core.location` (la tabla no tiene coordenadas) y **`order by` explicito** (`computed_at`, `location_id`)
  — sin el, el corte de ≤10 elegiria un subconjunto distinto en cada corrida sobre los mismos datos.
- **`google-object.ts` (nuevo, 192 l.)**: el split que el orquestador propuso, ejecutado. `google.ts` bajo de
  **262 a 166**. **`buildLoyaltyObject` hace `...buildObjectPatch(input)`**, o sea que la emision y el
  refresco silencioso **no pueden discrepar** sobre lo que muestra el pase: es una sola fuente.
- **`apple.ts`**: `locations` ≤ 10, **sin `maxDistance`** (es clave del pase y **solo achica** el radio).
- **`push-transports.ts`**: el cuerpo del `PATCH` que A3 dejo en `{}` ahora se lee **en el momento de
  entregar** (`googleObjectPatchFor`), no se acarrea en la fila de la cola — un refresco que espero en la cola
  manda el estado del pase **al salir**, no al encolarse. Y manda los arrays **completos** (incluido «Ultima
  novedad») para que el refresco no borre el ultimo aviso transaccional bajo semantica de reemplazo.
- **20 tests nuevos.** El del **CABLEADO** es el que mas importa y es de **comportamiento, no un barrido
  estatico**: importa los handlers reales de las tres rutas y asevera que cada una llama al lector **con su
  propio consumer id** y pasa el resultado sin tocarlo. `typecheck` ya prohibe omitir el campo; lo que ningun
  tipo caza es un call-site que pase `[]`, una lista vieja o **el consumidor equivocado** — eso lo cierra este
  test. (`CLAUDE.md`, tarea 38: tres guards estaticos, tres evadidos.)
- Los cambios en `wallet.test.ts` y `wallet.neon.integration.test.ts` son **una linea cada uno**
  (`passLocations: []` en el fixture), forzados por el campo requerido: no es editar un test para pasar.

**BITACORA DE MUTACIONES DE A4 — PRE-REGISTRO ESCRITO ANTES DE MUTAR.** **Tres de los cuatro archivos son
`??`**, donde `git checkout` **no hace nada** (no hay blob), y `apple.ts` es ` M`, donde **se llevaria tambien
el trabajo no commiteado**: copia limpia en `/tmp/a4-base/` y restauracion con `diff` contra ella.
`shasum` limpios: `apple.ts 29e0b8b1…`, `google-object.ts 0f1dd5f1…`, `pass-locations.ts 7523d7e3…`,
`pass-locations-store.ts a34fa888…`. Presupuesto: **4 obligatorias + 2 sondas**, corte en una vuelta.

| id | archivo | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|
| M1 | `google-object.ts` | el campo es `merchantLocations`, no el `locations` deprecado | **ROJO, 7** — el mas ancho de A4, y se explica porque `buildLoyaltyObject` hace `...buildObjectPatch()`: **una sola linea gobierna la emision Y el refresco**. Aserciones leidas: `expected true to be false` en «does NOT use the deprecated `locations` field» y `expected { locations: [] } to deeply equal { merchantLocations: [] }`. Incluye el test de **entrega** del `PATCH` |
| M2 | `apple.ts` | no se escribe `maxDistance` | **ROJO, 2** — `expected [ 'latitude', 'longitude', …(2) ] to deeply equal [ 'latitude', 'longitude', …(1) ]`: el test asevera **las claves exactas** de cada ubicacion, asi que caza el agregado y no solo el valor |
| M3 | `pass-locations.ts` | la puerta sin coordenadas se descarta | **ROJO, 1 — pero NO en el test que el nombre sugiere.** Cae en «drops a non-numeric coordinate» (`expected [ { locationId: 'loc-1' } ] to deeply equal []`), y el test «DROPS a door without coordinates» queda **VERDE**. Motivo verificado leyendo los dos casos: el segundo siembra solo `null`, y `null` lo descarta **`isFinite` igual** (`null?.trim()` → `undefined`, `Number(undefined)` → `NaN`). **La atribucion del docblock estaba al reves** → corregida (ver hallazgos) |
| M4 | `pass-locations.ts` | las coordenadas salen como NUMEROS, no strings del driver | **ROJO, 2** — `expected 'string' to be 'number'`, mas el test de entrega del `PATCH`. Es la trampa que el orquestador habia medido antes de encargar (`numeric(10,7)` → string) y **tiene oraculo** |
| P1 | `pass-locations.ts` | el chequeo de vacio va sobre el STRING | **ROJO, 1 — y es EL MISMO test con LA MISMA asercion que M3: las dos mutaciones son INDISTINGUIBLES** desde la suite. Es el caso de la spec 0055 repitiendose, y solo se ve ejecutando las dos: el plan las daba por distintas |
| P2 | `pass-locations-store.ts` | el `order by` explicito hace estable el corte de ≤10 | **VERDE 52/52 — no hay oraculo, Y su justificacion era FALSA.** Ver hallazgos: el corte de ≤10 **no puede truncar** |

**DOS HALLAZGOS DE A4, los dos de la familia del ADR 0054 (un docblock afirmando algo falso) y los dos
CORREGIDOS EN EL CODIGO, no solo anotados:**
1. **La atribucion de los dos guards de coordenadas estaba invertida.** El docblock decia que sin el chequeo
   de vacio sobre el string «una puerta sin coordenadas aterrizaria en el ECUADOR». **Falso:** `null` lo
   descarta `Number.isFinite` igual. El unico caso que **solo** ese chequeo caza es el string **vacio**
   (`Number("") === 0`, finito) — y una columna `numeric` **no puede contener `""`**, asi que ese guard es
   defensivo contra una fuente futura, **no** contra el esquema de hoy. Se queda (es gratis) pero ahora esta
   documentado como defensivo y no como load-bearing, con la indistinguibilidad M3↔P1 escrita al lado.
   *(`CLAUDE.md`: que un test muerda no dice QUE propiedad pinnea — la atribucion equivocada es tan peligrosa
   como la ausencia de test.)*
2. **El `order by` del lector no tiene oraculo y su «por que» era inalcanzable.** El docblock decia que sin el
   «el corte de ≤10 elegiria un subconjunto distinto en cada corrida». **No puede pasar:** el planner tope en
   **≤3 utilidad + ≤5 turnos = 8 puertas**, medido en la **sonda D5 de la fase A2** (30 candidatos → 8 slots),
   asi que el `.slice(0, 10)` de los builders **nunca trunca**. El `order by` se queda como determinismo
   cosmetico y **se DECLARA como tal**, en vez de inventarle un test con base de datos para una propiedad que
   ningun usuario puede observar. **Es la medicion de A2 pagando dividendos en A4.**

**RESULTADO DE A4: 5 de 6 mutaciones rojas, 1 verde (P2, declarada), M3↔P1 indistinguibles, arbol restaurado
con `shasum` identico al baseline en los 4 archivos** (`apple.ts 29e0b8b1…`, `google-object.ts 0f1dd5f1…`,
`pass-locations.ts 7523d7e3…`, `pass-locations-store.ts a34fa888…`), `grep -rn MUTATION apps/merchant/src`
**vacio**. Restauracion con `diff` contra `/tmp/a4-base/` — **tres de los cuatro eran `??`**, donde
`git checkout` no habria hecho nada.
**Los 5 gates de root, re-corridos DESPUES de restaurar y de corregir los dos docblocks:** `typecheck` 3/3,
`lint` limpio, `format:check` ok, `test` **`797 passed | 221 skipped (1018)`** (baseline 777 → **+20, cero
regresiones**), `build` exit 0.
**Tamaños al HOOK sobre TODO el alcance, post-prettier, todos `EXIT=0`:** `wallet-pass-locations.test.ts`
**271**, `push-transports.ts` 256, `apple.ts` 228, `wallet-pass-refresh-deliver.test.ts` 201,
`google-object.ts` 192, `wallet.test.ts` 189, `wallet.neon.integration.test.ts` 181, `google.ts` **166**
(bajo de 262 con el split), `push-channel.ts` 164, `provider.ts` 162,
`wallet-pass-locations-wiring.test.ts` 147, `pass-locations.ts` 104, `pass-locations-store.ts` 81, las tres
rutas 85/52/46.

**LO QUE QUEDA DECLARADO DE A4 (intentado, no supuesto):**
- **El `order by` del lector no esta pinneado** (hallazgo 2). No se le escribe test porque la propiedad que
  justificaria el test es inalcanzable con los limites default.
- **Nadie verifico contra Google de verdad** que un `PATCH` con `merchantLocations` + `textModulesData`
  reemplace en vez de fusionar. Por eso el cuerpo manda **los arrays completos** (incluido «Ultima novedad»),
  que es correcto **bajo las dos semanticas** — o sea que el limite esta **acotado y neutralizado**, no
  simplemente aceptado. Lo que no se puede cerrar sin credenciales de Google queda para el QA del owner.
- **El radio real de Apple** (la razon por la que no se escribe `maxDistance`) es un dato de QA en telefono,
  no un numero que se pueda testear aca. Ya estaba declarado en el ADR 0065.

**FASE A5 (audiencia + aplicador + endpoint del tick + workflow + integracion Neon): IMPLEMENTADA Y
MEDIDA POR EL ORQUESTADOR A MANO (2026-09-16).** Como estaba decidido: A3 y A4 murieron sin handoff y
`CLAUDE.md` corolario (f) dice que dos muertes seguidas son la señal de dejar de despachar.
**Falta el PASS del revisor independiente sobre la fase A entera.**

**LO QUE SE ESCRIBIO (todo `??` salvo tres archivos ` M`):**
- `marketing/audience.ts` (163) — `decideTurnEligibility` PURO con los **seis** motivos de exclusion y el
  ORDEN de evaluacion declarado, `attributableLocation` (compartida con la bolsa de utilidad) y
  `summarizeAudience` (los 5 conteos de `campaign_tick_audience`).
- `marketing/audience-store.ts` (235) — paso 1: campañas vivas, puertas usables, candidatos, el
  `on conflict … where status in ('queued','active')` y la foto de audiencia.
- `marketing/turn-lifecycle.ts` (107) — pasos 2 y 3 en **una sentencia cada uno**, con la precedencia de
  `cancel_reason` explicita.
- `marketing/placement-store.ts` (243) + `marketing/utility-store.ts` (223) + `marketing/placement.ts`
  (168) — paso 4: lecturas, bolsa de utilidad y el APLICADOR (lock por consumidor, plan puro, escritura).
- `marketing/tick.ts` (179) — la corrida entera: lock, pasos, resumen, log JSON.
- `marketing/driver-values.ts` (25) — `toDate`/`requireDate` (ver hallazgo 2).
- `app/api/internal/marketing-tick/route.ts` (30, `maxDuration = 60`) + `.github/workflows/marketing-tick.yml`
  (`0 */6 * * *` + `workflow_dispatch`, secrets `MARKETING_TICK_ENDPOINT` / `CRON_SECRET`).
- Tests: `marketing/audience.test.ts` (15 casos), `marketing-tick-route.test.ts` (4), y **seis** archivos de
  integracion Neon — `marketing-tick` (audiencia, activacion, fusion `both`, log, IDEMPOTENCIA),
  `marketing-placement` (holdout fuera del pase, cuota dentro de una corrida, skip bajo el lock, opt-out que
  NO apaga la utilidad), `marketing-merit` (el CABLEADO del merito), `marketing-cancel` (los 6 motivos +
  pausar/reanudar no quema la audiencia), `marketing-outcome` (los 4 resultados), `marketing-refresh`
  (`pass_refresh` de punta a punta con `FakePushChannel`, coalescing, `passesUpdatedSince`), mas los soportes
  `marketing-integration-support` / `marketing-read-support` / `marketing-world-support`.
- ` M`: `marketing/merit.ts` (`loadBusinessTurnStats` pasa a recibir la transaccion),
  `wallet/pass-locations.ts` (se **extrajo** `toLatLng`, para que «una puerta sin coordenadas se descarta»
  siga viviendo en UN solo lugar ahora que el tick tambien lo aplica) y `wallet-push-integration-support.ts`
  (`enqueue` acepta `pass_refresh`).

**LOS 5 GATES DE ROOT, corridos por el orquestador (Node `v24.20.0`):** `typecheck` 3/3, `lint` limpio,
`format:check` ok, `build` exit 0, y `test` **con las env de integracion**:
**`Tests 1062 passed (1062)`, 150 archivos**. Sin las env (que es como se midio el baseline de A4):
**`816 passed | 246 skipped (1062)`** contra **797 | 221 (1018)** de A4 → **+19 unit y +25 de integracion,
cero regresiones**. `grep -rn MUTATION apps/merchant/src` **vacio**.

**TRES HALLAZGOS REALES DE A5, los tres CORREGIDOS EN EL CODIGO y encontrados por un test, no por lectura:**
1. **Drizzle renderiza la columna SIN CALIFICAR en un select de UNA sola tabla, asi que una subconsulta
   correlacionada se ata en silencio a la columna homonima de la tabla INTERNA.**
   `exists (select 1 from consumer.wallet_pass wp where wp.consumer_id = ${programMemberships.consumerId})`
   compilo a `wp.consumer_id = "consumer_id"` —verificado con `.toSQL()`, no deducido—, que Postgres resuelve
   contra `wallet_pass`: la subconsulta **dejo de estar correlacionada** y paso a significar «¿existe algun
   pase en toda la base?». **Todos los consumidores daban `hasPass = true`** con typecheck verde y filas de
   aspecto plausible. Lo cazo el seed que incluye un consumidor **sin** pase. Los dos lectores con
   subconsultas correlacionadas (`audience-store`, `utility-store`) se reescribieron como **SQL crudo con
   alias explicito** (`m.consumer_id`), con el porque en el docblock.
2. **`db.execute(sql…)` devuelve los valores CRUDOS del driver: un `timestamptz` llega como STRING**, mientras
   el query builder lo mapea a `Date`. El generico de `execute<T>` es una **asercion**, no un chequeo, asi que
   `enrolledAt: Date` paso typecheck y murio en runtime con `candidate.enrolledAt.getTime is not a function`.
   De ahi sale `marketing/driver-values.ts`, por el que cruza toda fecha leida con SQL crudo. Booleanos e
   `integer` **no** lo necesitan (medido con una sonda: el driver ya devuelve `true`/`false` y numeros).
3. **`campaign_tick_audience` reventaba con `23505` si dos corridas compartian `ran_at`** (pk
   `(campaign_id, ran_at)`), o sea que «el tick es idempotente» valia **salvo que lo corras dos veces con el
   mismo reloj** — justo el matiz que el DoD existe para prohibir. Pasa a `on conflict … do update`: dos
   corridas con el mismo `ran_at` son la MISMA foto.

**BITACORA DE MUTACIONES DE A5 — el pre-registro se escribio ANTES de mutar.** **Todos los archivos del
alcance eran `??` salvo tres**, asi que **`git checkout` no existia para la mayoria**: copia limpia en
**`/tmp/a5-clean/`** con su `SHASUMS.txt`, y restauracion con `diff` contra ella en cada vuelta.
**Presupuesto declarado antes de empezar: las 5 mutaciones que la spec nombra para A5 + 5 sondas sobre
docblocks nuevos que afirmen un invariante. Clase de error: invariante declarado sin oraculo, con regresion
PLAUSIBLE. Corte: UNA vuelta.** Alcance de cada corrida:
`node ../../node_modules/vitest/vitest.mjs run src/server/marketing` desde `apps/merchant` con las env de
integracion; **baseline verde re-medido: `Tests 77 passed (77)`** (78 al cerrar, con el test que agrego P5).

| id | archivo | edicion exacta | resultado EJECUTADO |
|---|---|---|---|
| M1 | `audience-store.ts` | sacar ` where status in ('queued','active')` del conflict target | **ROJO, 5** (+12 skipped por el `beforeAll` caido). Asercion leida: `there is no unique or exclusion constraint matching the ON CONFLICT specification` — habla de la propiedad, y es **el 17.º bloqueante de la revision adversarial ahora pinneado** |
| M2 | `placement.ts` | borrar el `quota.set(...)` que avanza el conteo | **ROJO, 1 — y solo el de cuota**: `expected { campaigns: 1, enqueued: 3, …(6) } to match object { enqueued: 3, activated: 2 }` (activo 3 donde la cuota era 2) |
| M3 | `tick.ts` | **1er intento**: `pg_try_advisory_xact_lock(...)` → `select ${namespace} is not null` | **ROJO POR EL MOTIVO EQUIVOCADO**: `42P18 could not determine data type of parameter $1`. La mutacion no era la propiedad, era SQL invalido. *(La leccion de `CLAUDE.md` en vivo: un rojo se LEE, no se cuenta.)* |
| M3b | `tick.ts` | `pg_try_advisory_xact_lock(...)` → `select true as locked` | **ROJO, 1**: `expected { campaigns: 1, enqueued: 1, …(6) } to deeply equal { skipped: 'tick_in_flight' }` — el tick trabajo en vez de saltar |
| M4 | `placement-store.ts` | cooldown: `['active','done']` → `['active','done','cancelled']` | **ROJO, 1** — el de pausar/reanudar: `expected { campaigns: 1, enqueued: 1, …(6) } to match object { enqueued: 1, activated: 1 }`. Un turno cancelado volvia a quemar el cooldown |
| M5 | `turn-lifecycle.ts` | `order by o.created_at asc` → `desc` | **ROJO, 1**: `expected '471b0e43…' to be '31be964e…'` — eligio la ULTIMA orden de la ventana, no la primera |
| P1 | `audience.ts` | `reachable` contado desde la decision (`total − not_reachable`) en vez de `hasPass` | **VERDE 77/77 la primera vez → el docblock afirmaba algo sin oraculo.** El caso del unit no distinguia las dos lecturas. **Se agrego el unico caso que las separa** (opt-out **y** sin pase: la decision corta antes de `not_reachable`, asi que la version mutada lo contaria como alcanzable) → **ROJO**: `expected { total: 6, reachable: 5, …} to deeply equal { total: 6, reachable: 4, …}` |
| P2 | `placement.ts` | mover las activaciones DESPUES de escribir `pass_placement` | **VERDE 77/77, y el docblock era FALSO.** Decia que el orden era load-bearing «porque `pass_placement.turn_id` es una fk»: la fk solo exige que la fila EXISTA (existe, `queued`), y las dos escrituras viven en la MISMA transaccion, asi que nadie puede observar una sin la otra. **Docblock corregido en el codigo**, con el resultado de la sonda escrito al lado |
| P3 | `audience-store.ts` | `wp.consumer_id = m.consumer_id` → `wp.consumer_id is not null` | **ROJO, 2** (el hallazgo 1, ahora con oraculo): `to match object { total: 8, reachable: 7, …}` y `{ enqueued: 1, activated: 1 }` |
| P4 | `placement-store.ts` | `parseSlotKind` default → `return "utility"` | **VERDE 77/77 — se DECLARA**, igual que `parseQueueClass` en A3: es un tripwire contra un drift schema↔codigo y el `check` de la base ya restringe la columna a tres valores. No hay entrada alcanzable que lo dispare |
| P5 | `utility-store.ts` | agregar `and m.marketing_opt_out_at is null` a la bolsa de utilidad | **VERDE 77/77 → invariante del OWNER sin oraculo** («el opt-out no apaga la utilidad»). **Se escribio el test** (un negocio donde el consumidor se dio de baja de promociones conserva su puerta de utilidad con el saldo) → **ROJO**: `expected [ [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ] ]` |

**Resultado: 6 rojas de entrada, 3 sondas verdes que destaparon trabajo real (dos se cerraron con un test
nuevo cada una, una se declara), 1 mutacion invalida detectada por LEER su rojo.** Arbol restaurado con
`diff` contra `/tmp/a5-clean/` en cada vuelta.

**LO QUE QUEDA DECLARADO DE A5 (intentado, no supuesto):**
- **`cancel_reason = 'membership_gone'` es INALCANZABLE hoy, y esta MEDIDO, no argumentado**:
  `campaign_turn.membership_id` es `not null` con fk **NO ACTION**, asi que borrar una membresia con un turno
  vivo falla con **`23503`** (`campaign_turn_membership_id_program_membership_id_fk`) — hay un test que lo
  asevera. Volverlo alcanzable es un cambio de esquema (fk a `set null`/cascade), o sea **otra migracion**:
  se declara en vez de tacharlo del DoD en silencio. *(Ojo al leer el error: drizzle lo envuelve, el SQLSTATE
  vive en `error.cause.code`; `error.code` da `undefined` y el test pasaria por el motivo equivocado.)*
- **La rama «vuelve a `pending`» de `wallet/push.ts` no la dispara ninguna entrada alcanzable de esta suite**:
  un 403 de APNs se **registra** en la fila y la fila igual cierra como `sent` (medido: el primer intento de
  test fallo con `expected 'sent' to be 'pending'`). Lo que el test pinnea es el ESTADO que esa rama produce
  —dos `pass_refresh` vivos para un consumidor, que es justo lo que un unico parcial haria fatal— y no la rama.
- **Una campaña cuyo `ends_at` ya paso pero sigue en `active` NO cancela sus turnos vivos** (el paso 3 mira
  `status`, como dice la spec). El turno corre hasta que su ventana vence. Es lo literal del diseño, pero no
  estaba escrito en ningun lado.
- **`campaign_tick_audience` no distingue los seis motivos: la tabla tiene cinco columnas** (`total`,
  `reachable`, `no_location`, `opt_out`, `cooldown`), asi que `not_dormant` y `live_turn` **no se guardan**.
  Es el modelo de datos que la spec fijo; la fase B tiene que saberlo al escribir la pantalla de resultados.
- **El tick entero corre en UNA transaccion** (ADR 0067) y eso tiene un costo escrito ahi.
- **Un flaky PREEXISTENTE y AJENO**: 1 de 3 corridas completas fallo en
  `consumer-recovery.neon.integration.test.ts` (`expected 'accepted' to be 'failed'`). **No es de A5**:
  reproducido **en aislamiento** (1 de 3 corridas del archivo solo) y ya diagnosticado en este mismo archivo
  (un `select` sin `order by` + `.at(-1)` sobre dos filas del mismo telefono, spec 0032).

**BASELINE PARA AUDITAR EL ARBOL — RE-MEDIDO en el handoff, no copiado.** Si una sesion fresca corre
`shasum` y algo no coincide, alguien dejo una mutacion puesta. Comando:
`shasum apps/merchant/src/server/marketing/*.ts apps/merchant/src/server/marketing-*.ts apps/merchant/src/app/api/internal/marketing-tick/route.ts apps/merchant/src/server/wallet/pass-locations.ts`

```
d1626c05f3f9637cb53b95352477236457d5c90c  marketing/audience-store.ts
1325e74895f27d1ff758a31ad4abff8637563f8f  marketing/audience.test.ts
8b984673ed738d5f110589d5ffec9a1255c0191d  marketing/audience.ts
58d8bd1199f0d46e97f0f57f1323b1c0f6757b79  marketing/driver-values.ts
a8a5deee40738bb8a73f7b23fef1ee62894e23af  marketing/merit.ts
58929e53a1be3890a8bfc3c5aac4354c1b9b6d89  marketing/placement-store.ts
c3229050c78c07843fbf429174ee8d9f9b15fff9  marketing/placement.ts
12464cb4e6a74610efb3776b6645498f29194d9a  marketing/tick.ts
3a9c5304ce42377f97d5d459e36f12410731f5d5  marketing/turn-lifecycle.ts
7b5450da3d69de97c0987e1271b45a98352d7cf2  marketing/utility-store.ts
078c8aa59546ccce40c4b24a24f470b1969761d3  marketing-cancel.neon.integration.test.ts
80f915df3ffec036edc2baa1d1a4c759e9d99a03  marketing-integration-support.ts
3f3a3d6bf97f61173b12404e2dd112ab3478a0d8  marketing-merit.neon.integration.test.ts
4d14ccd60509070c3348d0c5aabed67d52fb959c  marketing-outcome.neon.integration.test.ts
7b88e4f9798676047abf283801c420557a04bf9f  marketing-placement.neon.integration.test.ts
6433c0c160b5c346f1a6871b2033c53e762bf6ab  marketing-read-support.ts
5683f19b26740dca53b6d6b923e15d702d875e7e  marketing-refresh.neon.integration.test.ts
5a36e3b37233448cd4f273036f39d3844c1eda6c  marketing-tick-route.test.ts
7056ba32118a96857c483c63a7011f924f3b77f8  marketing-tick.neon.integration.test.ts
0d851dfc77ae977952e655d22822c824a4dc10d4  marketing-world-support.ts
46ba2c9d8376470d68c36382b37423de1374e96b  marketing-tick/route.ts
a0e66841c2073574214c03523c44bfad90cf2562  wallet/pass-locations.ts
```
*(Los de A1/A2/A3/A4 sin tocar siguen valiendo; `merit.ts` y `pass-locations.ts` CAMBIARON en A5, asi que sus
hashes viejos estan podridos y son los de arriba.)*

**TAMAÑOS PREGUNTADOS AL HOOK** (`echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh`),
post-prettier, sobre TODO el alcance (` M` **y** `??`), **todos `EXIT=0`**: `placement-store.ts` 243,
`audience-store.ts` 235, `utility-store.ts` 223, `audience.test.ts` 206, `tick.ts` 179, `placement.ts` 168,
`marketing-merit` 165, `audience.ts` 163, `marketing-placement` 145, `merit.ts` 144, `pass-locations.ts` 122,
`marketing-read-support` 114, `turn-lifecycle.ts` 107, `marketing-world-support` 90, `route.ts` 30,
`driver-values.ts` 25, y los de integracion 286/273/271/229/193/76. **El hook DISCRIMINA, y se probo con un
`EXIT=2` real:** `marketing-placement.neon.integration.test.ts` habia quedado en **320** y el hook lo marco →
**se PARTIO** (salio `marketing-merit.neon.integration.test.ts` + el soporte `marketing-world-support.ts`),
no se extendio.

**LO QUE SIGUE, en orden:**
1. **Revisor independiente sobre la FASE A entera** (`docs/AGENT-WORKFLOW.md`), con el presupuesto escrito en
   el encargo. Tiene que saber que **dos archivos de test y tres docblocks los escribio o corrigio el
   ORQUESTADOR, no un implementador**: `wallet-pass-refresh-worker.test.ts` (A3), los dos docblocks de A4
   (`pass-locations.ts` / `pass-locations-store.ts`) y **todo A5**.
2. **Recien con el PASS**: commitear lo que falte, `git push`, verificar el commit status del **sha exacto**
   (`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status --jq '.state'`) y aplicar la migracion
   `0031` a **prod** por MCP.
3. **SECRETS — VERIFICADO, NO RELATADO DE LA SPEC: falta UNO SOLO, y NO se toca Vercel.** La spec decia
   «secrets `MARKETING_TICK_ENDPOINT` y `CRON_SECRET`». Al chequearlo (`GH_TOKEN= gh secret list`):
   **`CRON_SECRET` ya existe como Actions secret del repo desde el 2026-08-15**, y las corridas de
   `wallet-push-cron.yml` **salen `success` cada ~hora** (`gh run list --workflow=wallet-push-cron.yml`),
   lo que prueba que ese secret **coincide con el de Vercel** — si no, el endpoint devolveria 401 y el paso
   fallaria. O sea: **lo unico que el owner tiene que crear es `MARKETING_TICK_ENDPOINT`**, en
   **GitHub → Settings → Secrets and variables → Actions** (NO en Vercel: el workflow vive en Actions
   porque el plan Hobby ya gasto sus 2 crons).
   **Valor exacto, medido: `https://www.checkpass.club/api/internal/marketing-tick` — CON `www.`**
   El apex hace **308** a `www` (`curl` contra el endpoint de wallet-push: apex → 308 + `location`,
   `www` → 401 «No autorizado», o sea la ruta contesta), y el workflow asevera `test "$code" = "200"` con
   un `curl` **sin `-L`**: cargado con el apex quedaria **rojo para siempre** y el tick nunca correria, con
   pinta de secreto mal puesto. Sin el secret, el workflow **sale en 0 sin hacer nada** (mismo patron que
   `wallet-push-cron`), asi que la ausencia tampoco se ve como error.
   **Ojo con el orden: el endpoint solo existe en prod DESPUES del push + deploy**, asi que cargar el
   secret antes es inofensivo pero el `workflow_dispatch` de prueba recien vale despues del deploy.
4. Fases B (backoffice), C (cupon) y D (consumidor + freno por plan).

**PROMPT PARA RETOMAR:** «Arco de marketing, spec 0065 — **la revision adversarial YA SE HIZO y la spec
esta `cerrada`**; **NO la vuelvas a correr** (la condicion de corte declarada era una vuelta). **LA FASE A
ESTA COMPLETA: A1, A2, A3, A4 y A5 implementadas, medidas por mutacion y con los 5 gates en verde.** A1-A4
estan commiteadas (`ddd64d2`, `96c6215`, `47879b9`, `437d9c6`); **A5 se commitea en esta sesion**. **NADA
DE LA FASE A ESTA PUSHEADO**, asi que prod NO tiene este codigo ni la migracion `0031`.

**EL PRIMER PASO AL RETOMAR ES EL REVISOR INDEPENDIENTE SOBRE LA FASE A ENTERA** (`docs/AGENT-WORKFLOW.md`),
con **presupuesto y condicion de corte escritos en el encargo** (`CLAUDE.md`, ADR 0062 y la instruccion del
owner del 2026-09-13). Tiene que saber que **A3, A4 y A5 las cerro el ORQUESTADOR a mano** —sus dos
implementadores murieron sin handoff— y que por lo tanto **dos archivos de test y tres docblocks no pasaron
nunca por un segundo par de ojos**: `wallet-pass-refresh-worker.test.ts` (A3, asercion reemplazada), los dos
docblocks corregidos de A4 (`pass-locations.ts`, `pass-locations-store.ts`) y **todo A5**.
Antes de encargar, releer la seccion de A5 de este archivo (hallazgos, limites declarados y bitacora de
mutaciones) y `docs/specs/0065-campana-de-proximidad-por-wallet.md`; **no re-medir lo medido**.

**Trampas ya verificadas, no las redescubras:**
- **Drizzle no califica la columna en un select de una tabla**, asi que una subconsulta correlacionada
  escrita con `${tabla.columna}` se ata a la columna homonima de la tabla INTERNA y deja de correlacionar
  (hallazgo 1 de A5, con `.toSQL()` de testigo). En este modulo esas consultas van en SQL crudo con alias.
- **`db.execute` devuelve strings donde el query builder devuelve `Date`** (hallazgo 2 de A5 →
  `marketing/driver-values.ts`).
- **La exclusion del tick es GLOBAL**: toda suite de integracion nueva que corra el tick necesita su propio
  `lockNamespace`, o le contesta `tick_in_flight` a las demas (ADR 0067).
- `dropBusiness` + turnos: borrar `coupon_redemption` y `campaign_turn` ANTES de las membresias, y cortar
  primero `campaign_turn.outcome_redemption_id` (el par de fks es CIRCULAR). Ya esta resuelto en
  `marketing-read-support.ts`.
- El planner tope en **≤3 utilidad + ≤5 turnos = 8 puertas**: cualquier test que espere que el `maxSlots=10`
  trunque algo prueba un caso inalcanzable (medido en la sonda D5 de A2).
- **Un flaky preexistente y AJENO** vive en `consumer-recovery.neon.integration.test.ts` (1 de 3 corridas):
  `select` sin `order by` + `.at(-1)`. No es de esta fase y ya esta diagnosticado aca.

**Con el PASS del revisor:** commitear, `git push`, verificar el commit status del **sha exacto**
(`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status --jq '.state'`, nunca «prod esta verde»),
aplicar la `0031` a prod por MCP y **pedirle al owner UN solo Actions secret**:
`MARKETING_TICK_ENDPOINT = https://www.checkpass.club/api/internal/marketing-tick` (con `www.`; el apex
hace 308 y el workflow no sigue redirects). `CRON_SECRET` **ya esta cargado y funcionando** — verificado,
no supuesto. Despues siguen las fases B, C y D.»

## REVISION DE LA FASE A — DIMENSION 1 (TICK Y COLA): **FAIL, 4 INVARIANTES SIN ORACULO** (2026-09-16)

Bitacora completa en `/tmp/revision-fase-a-tick.md`. Sondas guardadas en `/tmp/revision-a-tick-probes/`
(`marketing-probe-s1`, `marketing-probe-s2`) — **estan FUERA del arbol a proposito**: el hook
`no-mutations-left.sh` es CIEGO a los archivos-sonda, asi que una sonda olvidada sobrevive a la sesion sin
que ningun gate chille.

**El revisor murio** (14a muerte de este arco) dejando **R4 puesta** en `placement-store.ts` y las dos sondas
untracked en el arbol. **El punto de retorno funciono y el protocolo se aplico en el orden correcto:**
(1) `ListAgents` → no habia subagente vivo, o sea mutacion ABANDONADA, no viva; (2) `git status --short` →
` M` sobre un archivo **commiteado**, asi que `git checkout` era un punto de retorno real; (3) **se MIDIO
antes de revertir** —la mutacion ya estaba montada y revertir primero habria tirado la unica corrida gratis
(`CLAUDE.md`)—; (4) revert + `diff` contra `/tmp/a5-clean/` (exactamente una linea) + `shasum` identico al
baseline.

**LOS 4 HALLAZGOS, TODOS REPRODUCIDOS POR EL ORQUESTADOR.** R1 y R2 venian de la bitacora del revisor muerto,
o sea que eran **afirmaciones, no verificaciones**: se re-ejecutaron. Alcance de cada corrida:
`node ../../node_modules/vitest/vitest.mjs run src/server/marketing` desde `apps/merchant` con
`set -a; . ./.env.integration.local; set +a`. **Baseline limpio: 13 archivos / 78 tests VERDE.**
Ninguno de los cuatro es un BUG: el codigo es correcto. Lo que falta es el oraculo — la familia del ADR 0054
(un documento afirmando un invariante que ningun test pinnea), que en este repo ya fue bloqueante cuatro veces.

| id | archivo:linea | invariante declarado que nadie pinnea | resultado EJECUTADO |
|---|---|---|---|
| R1 | `marketing/merit.ts:113-116,124` | docblock: «A `coupon_redeemed` outcome counts as a purchase — leer solo `'purchase'` contaria una campaña cuyo cupon funciono como si nadie hubiera venido» | `in ('purchase','coupon_redeemed')` → `= 'purchase'`: **VERDE en los 13 archivos**. Afinado al verificar: `marketing-outcome:177` SI pinnea que el tick **escribe** `coupon_redeemed`, pero `marketing-merit:82` solo siembra `purchase`/`none` → lo que no tiene oraculo es que el merito lo **CUENTE**. El riesgo aterriza en prod **cuando entre la fase C** (hoy `coupon_redemption` solo lo inserta el support de test) |
| R2 | `placement-store.ts:43-52` | docblock `:24-27`: el `union select consumer_id from consumer.pass_placement` «is not decoration — it is how a door LEAVES the pass when its turn expires, since by then the consumer has no live turn left to find them by». Es la clausula del DoD [A] «el pase deja de llevar esa ubicacion en el siguiente refresco» | borrar el `union`: **VERDE en los 13 archivos**. La sonda **S1** lo caza: `AssertionError: expected [ { …(5) } ] to deeply equal []` — sobrevive una fila `slotKind:'turn'` con el `turnId` del turno **YA VENCIDO**. Control: S1 sobre codigo limpio **PASA**. **La puerta se queda en el pase para siempre, en silencio** |
| R3 | `audience-store.ts:82` | docblock `audience.ts:50-55`: «Both conditions belong to the ENQUEUE filter… a door that is archived or ungeocoded would otherwise be queued and cancelled in the SAME run, FOREVER (a cancelled turn does not hold the partial unique, so the next run re-inserts it)» | sacar `eq(locations.status,"active")`: **VERDE en los 13 archivos**. La sonda **S2** lo caza: `expected [1,1,1,1] to deeply equal [0,0,0,0]`, con `PROBE_S2` mostrando `enqueued:1, cancelled:1` en **las DOS** corridas → el bucle infinito que el docblock predice, **reproducido**. Control: S2 limpio **PASA** (`0,0,0,0`). La mitad «sin coordenadas» SI tiene caso (`doorNoCoords`); la mitad **«archivado» no aparece en ningun enqueue** |
| R4 | `placement-store.ts:236-240` | docblock `:226-228` + texto literal del DoD [A]: «la cuota de turnos activos **no-holdout**» | sacar `eq(campaignTurns.holdout,false)`: **VERDE en los 13 archivos**. Ningun test mezcla holdouts y cuota en el **mismo** negocio. *(Medida por el orquestador sobre la mutacion abandonada, antes de revertirla.)* |

**Lo que NO se hizo, y por que:** el presupuesto del encargo era **6 mutaciones, clase «invariante declarado
sin oraculo con regresion plausible», corte en UNA vuelta**. Se ejecutaron **4 y las 4 dieron hallazgo**, asi
que abrir la 5a y la 6a era inercia — es la instruccion literal del owner del 2026-09-13 (las primeras 4 ya
habian dado todo el valor). **La dimension se cierra en FAIL y no se reabre.**

**FIX (pendiente, barato y ya especificado):** promover **S1** y **S2** a tests del alcance; agregar al seed de
`marketing-merit` un turno `done` con `outcome='coupon_redeemed'` (R1); y un caso de cuota con holdouts del
**mismo** negocio (R4). Los cuatro se cierran ejecutando su mutacion contra el fix y transcribiendo el rojo.

**Estado del arbol al escribir esto:** `git status --short` **vacio**, `grep -rn MUTATION apps/merchant/src`
**vacio**, sin sondas en el arbol, y los 22 `shasum` del baseline de A5 **intactos** (re-medidos, no copiados).

**QUEDA de la fase A:** dimension 2 (**el pase**: `placement-plan`, `relevant-text`, `utility-text`,
`utility-store`, `wallet/pass-locations*`, `apple`/`google`/`provider` y las 3 rutas de emision) y dimension 3
(**carril `pass_refresh` + schema/migracion `0031`**). Se corren **de a una**: comparten arbol y rama Neon, y
el advisory lock del tick es **global** (ADR 0067) — dos suites simultaneas se contestan `tick_in_flight`.


## REVISION DE LA FASE A — DIMENSION 2 (EL PASE): **FAIL, 2 HALLAZGOS DE LA MISMA FAMILIA** (2026-09-16)

Bitacora completa en `/tmp/revision-fase-a-pase.md`. **El revisor murio** (15a muerte del arco) con **M3 puesta**
en `wallet/pass-locations-store.ts` y sin resultado. Mismo protocolo que en la dimension 1 y en el mismo orden:
`ListAgents` (sin subagente vivo → mutacion ABANDONADA), `git status --short`, **medir ANTES de revertir**, revert
y `shasum` contra el que el propio revisor habia registrado (`6a9f07e8…`, identico). **Ojo con un detalle que casi
muerde: `docs/TASKS.md` estaba ` M` con trabajo del orquestador sin commitear** — un `git checkout` ancho se lo
habria llevado. Se restauro **solo** el archivo mutado.

**Baseline limpio re-medido:** `src/server/wallet` **13 archivos / 84 tests VERDE**; `src/server/marketing`
**13 / 78 VERDE**.

| id | archivo:linea | invariante atacado | resultado EJECUTADO |
|---|---|---|---|
| M1 | `wallet/provider.ts:136-139` | DoD [A] #3 «el cableado llega al pase: el JSON servido por las tres rutas lleva las ubicaciones» | forzar `passLocations: []` camino a `buildApplePkpass`: **VERDE 84/84**. **HALLAZGO** — el pase se sirve **sin `locations`** (geofence apagado) con typecheck, lint y los 84 tests de wallet en verde |
| M1b | `app/api/public/wallet/apple.pkpass/route.ts:40` | *(añadida por el orquestador al verificar M1)* el docblock afirma «Required makes `typecheck` the oracle for the wiring of all three» | sacar `passLocations:` del call-site: **`typecheck` ROJO**, `error TS2345 … Property 'passLocations' is missing … but required in type 'PassBuildInput'`. **El docblock ES CIERTO** |
| M2 | `marketing/utility-store.ts` | el docblock ⚠️ dice que el alias explicito `m.` del `exists` correlacionado es load-bearing | sacar la calificacion `m.`: **ROJO 1/78**, `- "slotKind": "turn"` / `+ "slotKind": "both"` en `marketing-tick.neon:223`. **SIN hallazgo: el invariante SI esta pinneado** |
| M3 | `wallet/pass-locations-store.ts:53` | DoD [A] #3; el docblock dice que este es «The ONLY reader of `consumer.pass_placement`» | `leftJoin(campaignTurns)` → `innerJoin`: **VERDE en los DOS alcances (84/84 y 78/78)**. **HALLAZGO** — asi, **toda puerta de UTILIDAD (`turn_id` null) desaparece del pase en silencio** y 162 tests siguen verdes |

**EL HALLAZGO ESTRUCTURAL (M1 + M3 son uno solo): el DoD [A] #3 esta cerrado con tests que MOCKEAN justo lo que se
puede romper.** `wallet-pass-locations-wiring.test.ts` mockea el store entero y `wallet-pass-locations.test.ts`
prueba solo el mapper puro, asi que **ni el SQL de `passLocationsForConsumer` ni el tramo `provider.ts` → builders
tienen oraculo de comportamiento**. Es textualmente la leccion de la tarea 38 en `CLAUDE.md`: extraer la decision a
una funcion pura convierte una propiedad de COMPORTAMIENTO en una de DECISION **y deja el CABLEADO sin oraculo** —
y ahi mismo esta escrito que un revisor reintrodujo el bug exacto con UNA linea y los 5 gates verdes.

**LA PRECISION DE ATRIBUCION, que salio de verificar el hallazgo ajeno en vez de citarlo (`CLAUDE.md`):** el
revisor listo el docblock de `PassBuildInput.passLocations` como «invariante atacado», lo que se lee como «el
docblock es falso». **No lo es** — M1b lo demuestra ejecutandolo. Typecheck **si** pinnea que los tres call-sites
*pasen* el campo; lo que nadie pinnea es que el valor *sobreviva* de `provider.ts` a los builders. La distincion
cambia el fix: no se corrige un comentario, se agrega el oraculo de comportamiento que falta.

**Presupuesto:** el encargo decia **MAX 4 mutaciones, corte en UNA vuelta**. Se ejecutaron 4 (M1, M1b, M2, M3),
2 dieron hallazgo y 1 confirmo que el invariante estaba cubierto. **La dimension se cierra en FAIL y no se reabre.**

**FIX (pendiente):** un oraculo de comportamiento **end-to-end** que vaya de `pass_placement` (por SQL) al JSON
servido, **sin mockear el store**, para al menos una ruta de Apple y una de Google. Muerde con M1 **y** con M3.


## REVISION DE LA FASE A — DIMENSION 3 (`pass_refresh` + SCHEMA/MIGRACION): **FAIL, 2 HALLAZGOS — Y BUENAS NOTICIAS VERIFICADAS** (2026-09-16)

Bitacora completa en `/tmp/revision-fase-a-refresh.md`. **El revisor murio** (16a muerte) con **M3 puesta** en
`marketing/placement.ts` y sin resultado. Mismo protocolo: `ListAgents` (sin subagente vivo → ABANDONADA),
**medir ANTES de revertir**, revert nombrando el archivo y `shasum` contra el baseline de A5
(`c3229050…`, identico). `docs/TASKS.md` seguia ` M` con trabajo sin commitear y **no se toco**.

### LO QUE SE VERIFICO LIMPIO (y es lo mas caro de esta dimension, porque descarta bloqueantes de PRODUCCION)

- **V1 — la migracion `0031` reproduce EXACTAMENTE el schema, con oraculo real y no por lectura:**
  `drizzle-kit generate` contra una copia del directorio de migraciones en `/tmp` (config sonda, borrada despues)
  devolvio **`No schema changes, nothing to migrate 😴`**. O sea: 0000..0031 == `src/server/schema.ts`.
- **V2 — los guards de la `0031` existen EN LA BASE** (rama `spec-0065-marketing`, `__drizzle_migrations` = **32**):
  el unico parcial `core_campaign_turn_business_consumer_live_unique (business_id, consumer_id) WHERE status in
  ('queued','active')` —**por NEGOCIO**, que es lo que el ADR pedia y la revision adversarial habia cazado mal—,
  los 11 `check` de `core.campaign`, los 2 de `pass_placement` (incl. `char_length(relevant_text) <= 120`), y las
  **fks CIRCULARES en las dos direcciones**.
- **V3 — LA TRAMPA DE `CLAUDE.md` ESTA EVITADA, verificado en la base y no supuesto.** `pg_indexes` sobre
  `consumer.wallet_push_queue` devuelve **solo** la pk y dos indices NO unicos: **no hay ningun unico parcial**.
  El coalescing vive en `placement.ts:100-112` como `insert … select … where not exists (… status in
  ('pending','sending'))`, que es **la forma correcta**. El fallo documentado —fila clavada en `sending`,
  `attempts` sin subir, re-reclamada para siempre— **no aplica**.
- **M1 — EL SOSPECHOSO PRINCIPAL QUEDA LIMPIO.** `wallet-pass-refresh-worker.test.ts` es el test cuya asercion
  **reescribio el orquestador** sin segundo par de ojos. Restaurando el ternario viejo (`… ? "campaign" :
  "transactional"`) **en el call-site**, muerde: `- "sent": 2 / + "sent": 1`, `- "rescheduled": 0 / + "rescheduled": 1`
  (`wallet-pass-refresh-worker.test.ts:107`). **Habla de la propiedad y es el unico oraculo de ella: funciona.**

### LOS 2 HALLAZGOS

| id | archivo:linea | invariante declarado que nadie pinnea | resultado EJECUTADO |
|---|---|---|---|
| M2 | `wallet/push-channel.ts:109-115` | docblock `:23-32`: «a `PATCH`, NOT an `addMessage` … sin este metodo un refresh implementado como `sendGoogle(…)` registraria `{kind:'google'}`, **pasaria todos los tests** y le haria sonar el telefono al consumidor donde la spec exige silencio». Es el DoD [A] #1 («no envia `addMessage`») | reemplazar el `PATCH` por `addMessage`: **NO MUERDE NADA** — 75 passed (identico al control), `typecheck` EXIT=0, `lint` EXIT=0. El barrido lo explica: `grep` de `pushChannelFromEnv|patchGoogleLoyaltyObject|RealPushChannel` **no aparece en ningun `.test.ts`**; `patchGoogleLoyaltyObject` tiene **un unico llamador en todo el arbol**, que es la linea mutada. **En prod (`WALLET_PUSH_CHANNEL=real`) cada `pass_refresh` le sonaria el telefono al consumidor, con los 5 gates verdes** |
| M3 | `marketing/placement.ts:100-112` | DoD [A] #2 «hay a lo sumo **UN** `pass_refresh` vivo por consumidor» + el comentario normativo del coalescing | **borrar ENTERO el `where not exists`: VERDE 6/6.** Causa medida y leida del stdout del control: el test `coalesces: a pending refresh is never duplicated by another run` **nunca llega al insert** (`refreshes: 0` ⇒ `applyPlan` salio por `if (!plan.refresh) return 0`). **Y el comentario del propio test es FALSO**: dice «Force a real change of the set» pero solo borra filas de `wallet_push_queue`, que no tiene relacion con `pass_placement`, que es lo unico que mira `differs()` |

**M3 es el peor de los 8 hallazgos de la fase A**, y no por su consecuencia sino por su forma: **hay un test que se
llama como si cubriera la propiedad, no la cubre, y su comentario explica por que la cubre con una razon falsa.**
Eso no es un hueco pasivo — desalienta activamente a escribir el test que falta. Es `CLAUDE.md` literal: *un
comentario mentiroso no espera a que alguien lo lea mal, lo induce.*

**Presupuesto:** MAX 4, se ejecutaron **3** (M1, M2, M3) mas 4 verificaciones estaticas/contra-base. Se cierra en
3 porque la 4a era inercia: la dimension ya tiene su veredicto y las tres verificaciones duras (migracion, indices,
coalescing) salieron limpias. **FAIL, y no se reabre.**

**Lo que NO se alcanzo a correr: la suite completa** (`pnpm run test` con env de integracion), que era el unico
chequeo de gates independiente de los tres revisores. El baseline del orquestador sobre estos mismos bytes es
**1062 passed / 150 archivos** y el arbol esta byte-identico (hashes verificados), pero **eso es un limite
declarado, no una medicion del revisor.**


## FIX DE LOS 8 HALLAZGOS DE LA REVISION DE LA FASE A — HECHO, 5 GATES VERDES (2026-09-16)

**Ninguno de los 8 era un bug: el codigo de produccion NO se toco en este delta.** Lo que faltaba era el
oraculo. **`git diff --stat` de codigo de produccion: vacio** — solo tests.

### La tabla, EJECUTADA (cada par mutacion↔test se corrio y se transcribio; ninguno se predijo)

| # | hallazgo | donde se cerro | mutacion → resultado LEIDO |
|---|---|---|---|
| R1 | `merit.ts` cuenta `coupon_redeemed` como compra, sin oraculo | `marketing-merit.neon…`: caso nuevo que asevera `loadBusinessTurnStats` **por valor exacto** con una historia sembrada 100 % en `coupon_redeemed` | `in ('purchase','coupon_redeemed')` → `= 'purchase'`: **ROJO**, `- "placedPurchases": 3 / + 0`, `- "holdoutPurchases": 1 / + 0` |
| R2 | el `union` con `pass_placement` es como una puerta SALE del pase | **archivo nuevo `marketing-lifecycle.neon…`** (sonda S1 promovida) | borrar el `union`: **ROJO**, `expected [ { …(5) } ] to deeply equal []` |
| R3 | el filtro `status='active'` del local pertenece al ENQUEUE | idem, 2.º caso (sonda S2 promovida) | sacar `eq(locations.status,"active")`: **ROJO**, `expected [ 1, 1, 1, 1 ] to deeply equal [ 0, 0, 0, 0 ]` |
| R4 | la cuota cuenta turnos **no-holdout** | `marketing-placement.neon…`: holdouts **YA activos** + cuota 2 + 2 alcanzables | sacar `eq(campaignTurns.holdout,false)`: **ROJO**, `activated: 0` donde la fila limpia da 2 |
| M1-d2 | el tramo `provider.ts` → builders no tiene oraculo de comportamiento | **archivo nuevo `wallet-pass-locations-e2e.neon…`**, sin un solo mock: fila en la base → `pass.json` deszipeado y JWT de Google decodificado | `passLocations: []` en los DOS builders: **ROJO 2/3** (`expected [] to have a length of 2`), **y el test del LECTOR queda verde** — atribucion correcta |
| M3-d2 | el SQL de `passLocationsForConsumer` no tiene ningun oraculo | idem | `leftJoin` → `innerJoin`: **ROJO 3/3**, `to have a length of 2 but got 1` — la puerta de UTILIDAD es la que se pierde |
| M2-d3 | `RealPushChannel.patchGoogleObject` → `patchGoogleLoyaltyObject` sin oraculo | **archivo nuevo `wallet-push-channel-real.test.ts`** (`vi.mock` de `./wallet/google`, el canal REAL via `pushChannelFromEnv`) | llamar `postGoogleMessage` en vez del `PATCH`: **ROJO 1/3**, `Number of calls: 0`; los otros 2 casos **verdes** → discrimina los dos endpoints |
| M3-d3 | el coalescing `where not exists` sin oraculo, con un test que decia cubrirlo | `marketing-refresh.neon…`: los DOS casos ahora fuerzan un cambio real del conjunto | borrar el `where not exists`: **ROJO 2/2**, `to have a length of 1 but got 2` y `of 2 but got 3` |

### Tres cosas que salieron de EJECUTAR en vez de razonar (y que valen mas que los fixes)

1. **La primera version del test de R4 pasaba con la mutacion puesta.** Motivo medido:
   `loadBusinessActiveTurns` **solo siembra el contador al arrancar la corrida**; dentro de la corrida el
   planner lo avanza en memoria. Holdouts creados **en** la corrida bajo prueba nunca llegan a esa query, asi
   que el caso tenia que sembrar turnos holdout **ya `active`**. Escrito en el docblock del test.
2. **El oraculo obvio del coalescing era falso.** Se intento aseverar `summary.refreshes === 1` para probar
   que la corrida habia llegado al `insert`: **`refreshes` cuenta filas realmente INSERTADAS**, asi que el
   coalescing lo deja en 0 **igual que el `return` temprano** — los dos casos son indistinguibles por ahi. El
   oraculo real es otro: la fila de `pass_placement` que el test borra **vuelve**, y solo el cuerpo del
   aplicador la escribe.
3. **Dos rojos fueron por el motivo equivocado y se cazaron LEYENDO la asercion, no contandola:**
   `No transactions support in neon-http driver` (era `getDb()`, el driver HTTP; la transaccion se pide con
   `withDbTransaction`) y un `"undefined: te faltan 2 sellos"` sembrado por el propio test porque
   `seed.business.name` no existe en el tipo `Seed`. **Ninguno de los dos era del codigo de produccion.**

### El comentario mentiroso que se corrigio, que era el peor de los 8

`marketing-refresh…` decia «Force a real change of the set so the planner asks for a refresh again» mientras
borraba filas de **`wallet_push_queue`**, que `differs()` ni mira. Por eso los dos tests que decian pinnear el
coalescing **nunca llegaban al `insert`** y quedaban verdes con el `where not exists` **borrado entero**. Ahora
la intencion vive en una funcion nombrada (`forceRefreshWanted`) que borra `consumer.pass_placement`, que es lo
que el planner SI compara. *(`CLAUDE.md`: un comentario mentiroso no espera a que alguien lo lea mal, lo induce.)*

### Gates sobre el arbol FINAL

`typecheck` **3/3**, `lint` EXIT=0, `format:check` EXIT=0, `build` EXIT=0, y `test` con las env de integracion:
**153 archivos / 1072 tests / 0 failed / 0 skipped** (venia de **150 / 1062**: +3 archivos y +10 tests, que son
exactamente los escritos aca; **ningun test preexistente perdido**). `grep -rn MUTATION apps/merchant/src` vacio.

**Tamaños PREGUNTADOS AL HOOK** (todos `EXIT=0`), con **control** `onboarding/page.tsx` → **`EXIT=2`**, o sea que
discrimina: `marketing-refresh` 256, `wallet-pass-locations-e2e` 205, `marketing-placement` 204,
`marketing-merit` 201, `marketing-lifecycle` 88, `wallet-push-channel-real` 77.

**Hashes RE-MEDIDOS (baseline para la proxima auditoria):**
```
82560494c5f21e2234fb0d709943d57ed94f6ab4  marketing-lifecycle.neon.integration.test.ts
549a12059d06af5f9d693e5a45a749d196a106e1  wallet-pass-locations-e2e.neon.integration.test.ts
63d21e853a68fdfe3e86d00325509840891c889c  wallet-push-channel-real.test.ts
0842e00b70289c8994e4cc8f1c3694b1aa959620  marketing-merit.neon.integration.test.ts
5b4a8a42f7a54d741ae21dbb0ab4d1e29fe631f9  marketing-placement.neon.integration.test.ts
deb926bbd6df10310cba5b44dd2e4040145abeef  marketing-refresh.neon.integration.test.ts
```
*(Los 22 hashes de A1..A5 siguen valiendo: el codigo de produccion no se toco.)*

**LO QUE SIGUE:** commit → `git push` → verificar el commit status del **sha exacto** → migracion `0031` a prod
por MCP → el Actions secret `MARKETING_TICK_ENDPOINT` (con `www.`) → **QA del owner con el pase en un telefono
real**, que es el unico oraculo que falta y ninguna mutacion ve.


## PRUEBA ADVERSARIAL DE LOS 8 TESTS NUEVOS — EN CURSO, 1 DE 8 CERRADO (2026-09-16)

**Pedido del owner (literal):** «vas a hacer un agente = un test, revisas ese resultado, cierras, luego otro
agente = otro test, y asi hasta cerrar los 8 para evitar que te ates a un loop infinito de pruebas».
La pregunta de cada vuelta es UNA: **¿se puede romper el invariante dejando ese test VERDE?**
Presupuesto por test: **MAX 3 evasiones, UNA vuelta, y el fix NO se re-ataca.**

**EJECUTOR: el ORQUESTADOR, no un agente — y el motivo hay que escribirlo.** Se despacharon agentes de fondo y
**murieron CUATRO veces seguidas por fin de sesion**, la ultima **sin producir nada** (sin bitacora, sin mutacion,
arbol limpio). La estructura que pidio el owner (uno por vez, presupuesto, cerrar antes del siguiente) **se
respeta igual**; lo unico que cambia es quien la ejecuta. *(`CLAUDE.md`: si un encargo ya murio dos veces, no lo
despaches una tercera.)*

### ESTADO DE PROD (para que la proxima sesion no lo re-derive)

**Commit `9fd9625` PUSHEADO, `Vercel: success` verificado para el SHA EXACTO, y migracion `0031` APLICADA A
PROD y verificada por SQL** (`__drizzle_migrations` 31 → **32**; las 5 tablas nuevas; `marketing_opt_out_at`
presente; el unico parcial **por negocio** presente; **0 indices unicos peligrosos** en `wallet_push_queue`;
`core`+`merchant_auth` 28 → 33, o sea crecieron por las nuevas y no se perdio ninguna).
**Falta SOLO el Actions secret `MARKETING_TICK_ENDPOINT = https://www.checkpass.club/api/internal/marketing-tick`**
(con `www.`), que lo carga el owner. Sin el, el workflow sale en 0 sin hacer nada: el tick **no corre solo
todavia**, y eso es lo esperado. **QA del owner EN CURSO.**

### TEST 1/8 — R1 `counts a COUPON REDEMPTION as a purchase in the stats`: **EVADIBLE, 1 HALLAZGO REAL**

Bitacora: `/tmp/prueba-test-r1.md`.

| id | evasion | resultado EJECUTADO |
|---|---|---|
| E1 | `in ('purchase','coupon_redeemed')` → `is not null` | **MUERDE los 2 tests**: `- "placedPurchases": 3 / + 4`. El caso SI distingue «cuenta el cupon» de «cuenta cualquier outcome». Sin hallazgo |
| E2 | → `= 'coupon_redeemed'` (se reemplaza en vez de sumar) | **el caso bajo ataque queda VERDE**; lo caza su hermano del mismo archivo (`expected [ 'queued' ] to deeply equal [ 'active' ]`). **PARCIAL, se DECLARA**: el caso siembra 100 % cupones, asi que en aislamiento no separa «cuenta las dos» de «cuenta solo el cupon»; la otra mitad la pinnea el test de orden. La cobertura existe repartida en dos casos — no se duplican fixtures por eso |
| E3 | borrar `.where(eq(campaignTurns.status, "done"))` | **EVADE: archivo entero VERDE 2/2. HALLAZGO REAL** |

**E3, y por que importa:** sin ese filtro un turno **VIVO** —que todavia no tiene resultado— se cuenta como
exposicion, asi que el negocio queda 1 compra sobre 2 turnos (**50 % donde corresponde 100 %**) y su merito se
hunde por campañas que ni terminaron. **El VERDE se LEYO, no se supuso:** sonda scratch con 1 turno `done` +
1 `active` del mismo negocio → `SONDA_DONE {"placedN":2,"placedPurchases":1,…}` con la mutacion contra
`{"placedN":1,…}` en el control limpio. Sin esa medicion, una mutacion que quizas no cambia nada se disfraza de
hallazgo. Sonda **borrada** del arbol. Ningun test lo veia porque los fixtures de los otros dos **no tienen
turnos vivos** para el negocio que aseveran — coincidencia de los datos, no cobertura.

**CERRADO** con el caso `counts only FINISHED turns: a live one is not an exposure yet`
(`marketing-merit.neon.integration.test.ts`, **274 lineas, hook `EXIT=0`**). **E3 ahora muerde ESE caso y solo
ese** (`- "placedN": 1 / + 2`), los otros dos verdes → atribucion correcta. **3/3 en limpio.**

### LO QUE QUEDA DE ESTA TANDA (7 tests)

2. R2 `takes the door OUT of the pass when the turn expires` (`marketing-lifecycle`)
3. R3 `does not queue-and-cancel an ARCHIVED door on every run` (`marketing-lifecycle`)
4. R4 `does NOT let a holdout eat the business quota` (`marketing-placement`)
5. M1-d2 el tramo `provider.ts` → builders (`wallet-pass-locations-e2e`)
6. M3-d2 el SQL de `passLocationsForConsumer` (`wallet-pass-locations-e2e`)
7. M2-d3 el `PATCH` del canal real (`wallet-push-channel-real`)
8. M3-d3 el coalescing (`marketing-refresh`)

**SIN COMMITEAR:** el caso nuevo de R1 en `marketing-merit.neon.integration.test.ts`. Se commitean los 8 juntos
al cerrar la tanda (el owner puede pedir uno por test). El arbol quedo **sin mutaciones y sin sondas**
(`grep MUTATION` vacio, `find zz-*` vacio).


## FASE B (BACKOFFICE DE CAMPAÑAS) — ARRANCADA (2026-09-16)

**El owner eligio la fase B por sobre sembrar una campaña en prod para QA.** Motivo que hay que tener a mano:
**hoy NO existe ninguna ruta ni pantalla que CREE una campaña** —verificado en el arbol: lo unico que inserta en
`core.campaign` es el support de tests, y `backoffice/demo/campaigns` son los mocks viejos de la spec 0017 que
esta spec deja superados—, asi que el tick en prod no tiene nada que hacer y **el geofence no se puede QA-ear
hasta que exista el compositor**. Eso es exactamente lo que la fase B desbloquea.

**La spec 0065 ya especifica la fase B: no hace falta spec nueva.** Seccion «Backoffice — rutas y API» y
«Resultados», mas el journey del owner en «Diseño». **6 items [B] del DoD.**

### EL CORTE EN TRES (cada uno termina en algo verificable)

- **B1 — el motor de estado y sus rutas.** `marketing/campaign-input.ts` (validacion pura),
  `marketing/campaign-transitions.ts` (tabla de transiciones pura), `marketing/campaign-store.ts` (SQL),
  `app/api/marketing/_auth.ts` y las rutas `POST /api/marketing/campaigns`, `PATCH …/[id]`,
  `POST …/[id]/{activate,pause,end,archive}`. Cierra los items [B] del ciclo de vida.
- **B2 — la lectura.** `marketing/results.ts` (DTO con la calidad de cada campo, ADR 0021),
  `GET /api/marketing/audience-preview` y `GET /api/marketing/campaigns/[id]/results`, + `listCampaigns`.
- **B3 — las pantallas.** `/backoffice/marketing` (listado), `new` (compositor), `[id]` (detalle + resultados)
  y el tile «Campañas» de `/backoffice`, que hoy cae en el mock de demo (`backoffice/page.tsx:41-44`).

### B1 — EN CURSO: LAS DOS PIEZAS PURAS HECHAS Y MEDIDAS, FALTA EL STORE Y LAS RUTAS

**Hecho (todo `??`, sin commitear):**
- `marketing/campaign-transitions.ts` (65 l.) — la tabla del ciclo de vida, pura. 4 acciones x 5 estados = 20
  pares: **7 permitidos, 13 que deben dar 409**.
- `marketing/campaign-input.ts` (253 l.) + `marketing/campaign-values.ts` (8 l.) — validacion campo por campo.
  El cupon se trata como **TRIO indivisible** (etiqueta + costo + tope), incluso en el `PATCH`: nombrar una de
  sus claves reemplaza el cupon entero, porque mandar solo `couponCost` construiria el estado a medias que el
  check de la base prohibe. Los `check` de la `0031` ya protegen los datos; **esta capa existe para dar 400
  `validation` con el error al lado del campo**, no para proteger la base.
- `marketing/campaign-lifecycle.test.ts` (~215 l.) — **16 tests, VERDE**.

**El test recorre la tabla en las DOS direcciones a proposito:** asevera los 7 pares permitidos **y** que los
otros 13 dan `null`. Uno que solo listara los permitidos quedaria verde si alguien **agregara** una transicion,
que es el error que importa (un `ended` volviendo a `active` re-encola una audiencia que ya corrio).

**Mutaciones EJECUTADAS (no predichas):**
| id | edicion | resultado |
|---|---|---|
| B1-M1 | agregar `"ended"` a los `from` de `activate` | **ROJO 2**: `expected [ …(8) ] to deeply equal [ …(7) ]` y `expected 'active' to be null` |
| B1-M2 | `given.length < 3` → `< 1` en el cupon (acepta a medias) | **ROJO 1**: `expected { Object (couponCost) } to have property "couponLabel"` |

**TROPIEZO QUE VALE ESCRIBIR — `git checkout` NO revirtio las mutaciones porque los archivos son `??`.** Es la
trampa que `CLAUDE.md` ya documenta («mutar un archivo untracked deja a git sin nada a que volver») y se piso
igual. Se deshicieron **a mano** (eran 2 lineas conocidas) y **recien despues** se saco la copia limpia, que es
el orden inverso al correcto. **Copia en `/tmp/faseb-clean/` con estos `shasum`** — punto de retorno de la
proxima sesion, y lo unico que existe para archivos nuevos:
```
ddd122e3f7134fbcee6b3e908cd1740dc4f286f2  campaign-input.ts
da355fa99667d22f5298186f68f381b05f1f05b4  campaign-lifecycle.test.ts
4eece07adf9459f6ca9ad92309713b48d3557466  campaign-transitions.ts
effffad2aa69abbf3c58fca97a39e7dc774f2ef4  campaign-values.ts
```

**FALTA de B1:** `marketing/campaign-store.ts` (SQL: create + update + get + listado + transiciones, todo con
scope por `business_id` y **404 para id ajeno**), `app/api/marketing/_auth.ts` (copiar el patron de
`app/api/locations/_auth.ts`) y las 6 rutas. Despues: 5 gates y su test de integracion.
**`activate` exige ademas ≥ 1 local activo ASIGNADO y con coordenadas, y plan `plus` (402 `plan_not_allowed`).**
**Cancelar los turnos de una campaña pausada/terminada NO lo hace la ruta: lo hace el paso 3 del TICK**, y la
respuesta de la ruta tiene que decirlo («los turnos activos se retiran en el proximo refresco»).

### B1 — **COMPLETA, 5 GATES VERDES** (2026-09-16). SIN COMMITEAR.

**Archivos (todos `??` salvo `placement.ts`):** `marketing/campaign-transitions.ts` (65 l., tabla pura),
`marketing/campaign-input.ts` (253) + `campaign-values.ts` (8) (validacion pura), `marketing/campaign-store.ts`
(245, CRUD + scope), `marketing/campaign-actions.ts` (141, las 4 transiciones + guards de `activate`),
`app/api/marketing/_auth.ts` (76) y las 6 rutas. Tests: `campaign-lifecycle.test.ts` (16 unit),
`marketing-campaigns.neon…` (142) + `marketing-campaign-actions.neon…` (203) + `marketing-campaigns-support.ts`
(65) = **8 de integracion**. **Todos al hook `file-size`: `EXIT=0`.**

**Gates sobre el arbol final:** `typecheck` 3/3, `lint` 0, `format:check` 0, `build` 0, y `test` con env de
integracion **156 archivos / 1097 tests / 0 failed** (venia de 153 / 1072: +3 archivos y +25 tests).

**Mutaciones EJECUTADAS (presupuesto 3 + 2 de las piezas puras):**
| id | edicion | resultado |
|---|---|---|
| B1-M1 | `"ended"` agregado a los `from` de `activate` | ROJO 2 (`expected […8] to deeply equal […7]`, `expected 'active' to be null`) |
| B1-M2 | cupon aceptado a medias | ROJO 1 (`to have property "couponLabel"`) |
| B1-M3 | sacar el scope por negocio de `getCampaign` | ROJO 1 (`another owner's campaign is a 404`) |
| B1-M4 | sacar `isNotNull(latitude)` de `usableDoors` | **1a corrida VERDE 8/8 — evasion del TEST.** El caso ponia las DOS columnas en null, asi que el `isNotNull(longitude)` restante ya lo cazaba: **cualquiera de las dos mitades se podia borrar sin que nada mordiera**. Se agregaron un local con **solo latitud** null y otro con **solo longitud** null (las columnas son nullables independientemente). **Re-ejecutada → ROJO 1** |
| B1-M5 | `planAllows` siempre `true` | ROJO 1 (`a free business gets 402`) |

### DOS COSAS ENCONTRADAS AL HACER B1 QUE NO SON DE B1

1. **UN `delete` TAUTOLOGICO EN MI PROPIO TEARDOWN, que borraba la tabla entera.** La primera version del
   teardown «ayudaba» al cascade con `delete(campaignLocations).where(eq(campaignLocations.campaignId,
   campaignLocations.campaignId))`. **`.toSQL()` lo mostro:**
   `delete from "core"."campaign_location" where "campaign_id" = "campaign_id"` — una tautologia que **borra las
   puertas de TODOS los negocios de la base**, y que ya habia corrido 8 veces contra la rama efimera compartida.
   No rompio nada solo porque ninguna otra suite estaba leyendo esas filas en ese momento. **Se saco entero: la
   fk es `on delete cascade`.** *(Leccion: una condicion `col = col` typechea, lintea y se lee como un filtro.)*
2. **BOMBA DE TIEMPO PREEXISTENTE DE LA FASE A, no un flaky.** `marketing-refresh` fallaba con
   `expected +0 to be 1` en `summary.sent`. **Mecanismo señalado en el codigo y medido en la base, no supuesto:**
   `claimRow` (`push.ts:84`) exige `not_before <= now`; el test congela `NOW = 2026-09-16T12:00:00Z` y llama al
   worker con `NOW + 60s`, pero el tick insertaba la fila **sin** `not_before`, tomando el default `now()` de la
   base = **reloj real** (medido: `not_before` `14:04Z` contra un worker en `12:01Z`). O sea: **verde antes de
   las 12:00 UTC de la fecha congelada, rojo despues, y rojo para siempre desde el dia siguiente.** Paso
   literalmente en esta sesion: la suite completa dio 1072/1072 a las 08:00 UTC y 1 failed a las 14:00 UTC.
   **Fix: el tick escribe `not_before` con SU reloj** (`placement.ts`). En produccion los dos instantes son el
   mismo, asi que no cambia el comportamiento; en test los desacopla. `marketing-refresh` **6/6**.

**COMMITEADO en `a0573a6`, NO PUSHEADO** (igual que el resto de la fase A/B: se pushea recien con el PASS del revisor de la fase completa, o cuando el owner lo pida explicitamente como hizo con la fase A). **FALTA de B1 (declarado, no omitido):** el test UNIT de las rutas HTTP (401 sin sesion, 403 de staff, mapeo de
`CampaignError` → status, y que cada ruta de accion llame a SU accion). El patron a copiar es
`locations-routes.test.ts` (mockea `./auth` y `./staff`). **Las suites de integracion lo declaran en su docblock:
ejercitan el STORE, no la capa HTTP.** Sin ese test, el item [B] de aislamiento («staff no puede crear ni
activar → 403») NO esta cerrado.

**Copia limpia + `SHASUMS.txt` en `/tmp/faseb-clean/`** — obligatorio para estos archivos: son `??` y
`git checkout` **no revierte nada** sobre ellos (ya se piso una vez en esta sesion).

### PATRONES DEL REPO RELEVADOS ANTES DE ESCRIBIR (no inventar idioma)

- **`requireOwner` NO sirve para una ruta API: hace `redirect()`** (en un POST da 307, no 403) — ya lo habia
  cazado la revision adversarial de la spec. El patron real de las rutas es un `_auth.ts` por carpeta con
  `ownerContext(session.user.id)` (`server/staff.ts:38`, devuelve `{id, currencyCode}` del negocio del owner
  **activo**), una clase de error con `status`+`code`, y `readJson`. Modelo a copiar: `app/api/locations/_auth.ts`.
- **El plan se lee de `core.subscription`** via el patron de `locations/shared.ts:93` (`planLocationLimit`
  selecciona `plan` Y `pending_plan`). Para el 402 `plan_not_allowed` de `activate` alcanza `plan === 'plus'`.
  **Ojo de alcance:** ese 402 es del DoD **[D]**, pero la RUTA es de B — se implementa aca y el revisor de la D
  cierra el item.
- Los checks de la base ya prohiben lo invalido (`name` 1..80, `message` 1..60, `dormant_days` 7..365, cupon
  **todo o nada**), asi que la validacion del input es para dar **400 `validation` por campo** con un mensaje
  util, no para proteger la base.


## ARCO EN CURSO — **EL MOTOR DE PUBLICIDAD Y MARKETING** (decidido por el owner, 2026-09-15)

**Estado: ADR 0064/0065/0066 escritos, spec 0065 `cerrada` y revisada, FASE A EN IMPLEMENTACION.** El
detalle vivo esta en el bloque ESTADO del tope; esta lista es solo el arco completo.

1. ~~Commit de los docs~~ **HECHO** (`8764368`).
2. ~~Owner confirma opt-out + freno por plan~~ **HECHO (2026-09-15): spec 0065 `cerrada`.**
3. ~~**Revision adversarial de la spec**~~ **HECHA Y CERRADA (2026-09-15, noche): tres revisores, FAIL
   unanime, 16 bloqueantes + un 17.º que salio de correr el SQL, todos corregidos y verificados
   empiricamente.** La condicion de corte declarada era **una** vuelta. **No se reabre.**
4. **Fase A (fundacion) — EN CURSO, partida en A1..A5** (ver ESTADO arriba). **A1..A5 CERRADAS Y MEDIDAS.**
   A2: 9 mutaciones + 6 sondas + 4 tests nuevos. A3: 7 mutaciones. A4: 6 mutaciones (5 rojas, 1 verde
   declarada) + 2 docblocks falsos corregidos. **A3 y A4 las cerro el orquestador a mano porque sus dos
   implementadores murieron sin handoff** — `CLAUDE.md` corolario (f). **A5 TAMBIEN ESTA CERRADA** (audiencia + aplicador +
   endpoint del tick + workflow + 6 archivos de integracion Neon): 5 mutaciones de la spec + 5 sondas por
   docblock → 6 rojas, 3 sondas verdes que destaparon trabajo real (2 cerradas con un test nuevo, 1
   declarada) y 3 hallazgos corregidos en el codigo. **Lo que sigue es el revisor independiente sobre la
   fase A entera**, que tiene que saber que A3, A4 y A5 las cerro el orquestador a mano.
   **El item viejo «aplicar la migracion `0031` en `ci-integration` antes» queda ANULADO**: `ci.yml` ya
   corre `pnpm db:migrate` en cada corrida (spec 0062), y el orden era ademas imposible — la migracion
   la **genera** la fase A.
5. Fases B (backoffice), C (cupon) y D (consumidor + freno por plan) de la misma spec 0065.
6. Los demas tipos de campaña, **cada uno con su spec y ADR**, en este orden tentativo (no decidido
   por el owner): reactivacion por push (ya tiene oraculo: `sw.js`), le-falta-un-sello / premio sin
   canjear, local nuevo, franja muerta, aniversario de alta, categoria abandonada, ticket bajo,
   cumpleaños (exige pedir la fecha).

**Lo que ya existe y NO se rediseña:** cola `wallet_push_queue` (ADR 0037), transportes (0038/0039),
ruteo por clase (0040), atribucion por local (0042). **Lo que la spec 0065 agrega a esa
infraestructura:** la clase `pass_refresh` y `locations`/`merchantLocations` en el pase.

**CABO SUELTO DE BILLING que entra en la 0065:** frenar campañas al bajar de plan (fase D).

## HISTORIA: ADR 0063 ACEPTADO + SPEC 0064 (la seccion de abajo quedo escrita cuando la spec era borrador)

**El owner cerro D3 (2026-09-13, literal):** «Sin reembolso, no devolvemos plata. indicamos cuando le conviene para
aprovechar el plan completo, si baja ahora, pierde acceso inmediato.» → **ADR 0063 aceptado**: la baja es
**INMEDIATA**, sin devolver ni acreditar, y el diferimiento se reemplaza por un **aviso** («te conviene volver el
dia X», 2 dias antes de la renovacion). Fila en `docs/INDEX.md` en el mismo commit.

**VERIFICADO ANTES DE ESCRIBIR EL ADR (no supuesto):**
- **`subscriptions.cancel` trae `prorate` en `false` por default** (documentado en
  `esm/resources/Subscriptions.d.ts` de `stripe@22.5.0`): cancelar sin parametros es **exactamente** lo que el owner
  pidio. No hay que escribir nada para «no devolver».
- **El motivo de haber preguntado dos veces:** el prorrateo de Stripe **acredita saldo en el customer**, NO devuelve
  plata a la tarjeta — un reembolso real es otra llamada contra el cargo. Son productos distintos. **Con esta
  decision no se usa ninguno.**
- **La fecha de renovacion ya se sabe derivar** (`items.data[0].current_period_end` del `retrieve`,
  `billing/derive-rules.ts:79`): el aviso no necesita infra nueva.
- **Falta superficie de gateway:** `subscriptions.cancel` **no esta** en `StripeGateway` (hoy `retrieve|update|list`)
  y **`invoices` no se toca en ningun lado**. Los dos hay que agregarlos, con su fake.

**SPEC 0064 EN BORRADOR** (`docs/specs/0064-baja-inmediata-y-los-datos-del-cobro.md`): la baja inmediata + el aviso +
los **4 huecos de UI del QA** (etiqueta del intervalo, modal de confirmacion del cambio de intervalo, fecha de
renovacion, importe cobrado + link al recibo). **Riesgo escrito ANTES de implementar: el defecto que origino todo esto
NO lo caza una mutacion** —ningun invariante estaba roto, cada regla cumplia su contrato y la COMPOSICION era
incoherente—, asi que el plan de pruebas exige un caso que recorra la secuencia completa y asevere que **lo que se
cobra y lo que se puede usar coinciden**.

**LA SPEC 0064 QUEDO `cerrada` EL MISMO DIA: el owner contesto las tres preguntas de producto.**
1. **NO EXISTE la baja diferida** (literal: «no hay baja diferida […] cancela en el momento, no hay reanudar, no hay
   diferido, se cae HOY si doy de baja HOY, sin devolver dinero»). → **se BORRA `app/api/billing/resume/route.ts`**,
   su boton, sus tests y el `resume` de la tabla de ofertas. **El bug D4 desaparece con la ruta: no se arregla codigo
   que no va a existir**, y la 4a pregunta (por que fallaba) se cae sola.
2. **El recibo es el de la ULTIMA FACTURA PAGADA** («claro que la ultima que tiene pagada»).
3. **El aviso vive EN EL MODAL** de la baja, no como cartel permanente de la seccion.

**UNA DECISION QUEDA ETIQUETADA COMO DEL ORQUESTADOR, NO DEL OWNER** (regla de `CLAUDE.md`; se puede rechazar): si la
cancelacion a fin de periodo llega **desde el dashboard de Stripe** —cosa que Stripe permite y nuestro webhook recibe
igual—, la app **la registra y la informa**, sin ofrecer reanudar. `min(vigente, pendiente)` se queda **solo** para
ese caso.

**ENTRA IGUAL:** que el `catch` de las rutas que llaman a Stripe **registre la causa**. Hoy `cancel/route.ts:135`
descarta el error entero y un 503 no deja rastro ni en los logs. Es un defecto propio y la ruta de cancelar se queda.

**EL ERROR FANTASMA DEL TIPO GENERADO — el owner pidio cerrarlo, no heredarlo, y entro al DoD de la 0064.**
`.next/types/validator.ts` es GENERADO, tiene **un bloque por ruta** que importa su `route.js` (verificado en el
validator actual, lineas 293-305) y **`tsc` lo typechequea**: si se borra `resume/route.ts` y el bloque queda,
`typecheck` falla nombrando **un archivo que borramos a proposito**. **Lo que el build regenera es el VALIDATOR, no
la ruta** — se deriva del arbol, asi que sale sin el bloque; la redaccion anterior («el proximo build lo regenera»)
se podia leer como que la ruta vuelve, y no. **No explota en CI ni en Vercel** porque `.next/` esta gitignoreado y
alla se buildea de cero: **el fantasma es solo de una maquina con `.next` tibio**, que es justo donde alguien lo
persigue a mano. **Obligatorio:** borrar la ruta y el validator en el MISMO paso, `typecheck` verde, y `grep resume`
vacio sobre el validator regenerado. **Y un HOOK nuevo** que borre el validator cuando referencia una ruta
inexistente, **con prueba de que muerde y de que discrimina** (no tocar un validator sano).

**`A3 Test` (`e9c96528…`) quedo con la baja diferida al 13-10 y, sin `resume`, sin salida por la app.** Es un negocio
de PRUEBA, asi que no bloquea, pero **la migracion de los que ya esten diferidos al desplegar es parte del DoD.**

## RESPUESTAS DEL OWNER A LOS 3 PUNTOS ABIERTOS (2026-09-13) — LO DECIDIDO Y LO QUE SIGUE ABIERTO

**DECIDIDO (literal del owner):**
- **F2 punto 4:** «poner el importe cobrado, fecha de renovacion, link para descargar el recibo de stripe». Alcance
  cerrado. Junto con los otros tres huecos de F2 (etiqueta «Plus anual/mensual», modal de confirmacion del cambio de
  intervalo, fecha de proximo pago) van a la spec nueva.
- **D3, la direccion:** la baja pasa a ser **INMEDIATA**. El owner ademas quiere un aviso del tipo **«te conviene
  regresar el dia X»** (2 dias antes de la renovacion) para que el merchant no cancele desperdiciando lo pagado.

**ABIERTO, Y NO SE ESCRIBE COMO DECIDIDO HASTA QUE EL OWNER LO DIGA:**
- **¿El reembolso va, o el aviso lo REEMPLAZA?** La frase («si reembolso, de hecho, lo mejor es poder ponerle "te
  conviene regresar el dia X"») admite las dos lecturas y la diferencia es plata.
- **Y un hecho de Stripe que hay que verificar ANTES de prometer «reembolso»:** cancelar con prorrateo en Stripe
  acredita **saldo a favor en el customer**, no devuelve la plata a la tarjeta; un reembolso real es otra llamada
  (`refunds`) contra el cargo. **Son dos productos distintos para el merchant** y hay que medirlo, no suponerlo.

**CORRECCION DEL ORQUESTADOR A UNA PREMISA DEL OWNER (D4):** el owner dijo que con la baja inmediata «ya no hay
reanudar» y que el bug deja de importar. **Es cierto para NUESTRO flujo y falso para el estado:** el boton de cancelar
del **dashboard de Stripe** setea `cancel_at_period_end`, y nuestro webhook escribe `pending_plan='free'` igual —es
exactamente el motivo por el que existe el ADR 0060 y la columna `downgrade_requested_at`—. O sea que **la baja
programada puede seguir APARECIENDO aunque la app no la cree nunca**, y hay que decidir que hace la app cuando llega.

## QA DEL OWNER, 2a TANDA (2026-09-13): 21 CASOS OK, **1 BUG REAL (D4)**, 1 INCONSISTENCIA DE DISEÑO (D3) Y 4 HUECOS DE UI (F2)

**VERDES:** A1-A3, B1-B2-B4, C1-C4, D1-D3, E1-E3, F1-F3, G1-G2, H. **`MERCHANT_PUBLIC_ORIGIN` quedo seteada y el
Checkout anda** (el 503 de la tanda anterior, cerrado). **B5 quedo SIN MARCAR** — hay que preguntarlo.

### B3 — RESPONDIDO CON DATOS, no con una lectura del codigo
El owner no podia saber si el plan lo escribio el webhook. **Verificado por SQL sobre
`core.stripe_webhook_event`:** la compra de las 13:11 dejo `checkout.session.completed` (procesado 13:11:43.958) y
`customer.subscription.created` (procesado 13:11:44.578), y el `last_event_at` de la fila coincide. **El plan lo
escribio el webhook.** De paso: los `invoice.paid` entran y salen con `ignored_reason='event_type_not_handled'`, que
es la allow-list funcionando.

### D4 — **BUG REAL EN PROD: «Reanudar suscripcion» falla siempre** («No pudimos confirmarlo con Stripe»)
Negocio afectado: `A3 Test` (`e9c96528-5f3e-4952-b283-7434ec867b4f`), `sub_1UFDC4A9Vc14QXDyLAy78CsX`, que quedo con
`pending_plan='free'` y `pending_plan_at=2026-10-13`.
- **El 503 sale de `app/api/billing/resume/route.ts:81`**, dentro de un `catch { }` que envuelve
  `subscriptions.update(id, { cancel_at_period_end: false, cancel_at: null })`.
- **NO HAY EVENTO NUEVO en `stripe_webhook_event` despues de las 13:14**, o sea que la llamada a Stripe **fallo**;
  no es que haya andado y la UI mintiera.
- **DEFECTO DE DIAGNOSTICABILIDAD, y es lo primero a arreglar: el `catch` NO registra el error de Stripe.** Descarta
  el objeto entero, asi que ni los logs del server tienen la causa. Un 503 que esconde su motivo obliga a ir al
  dashboard de Stripe para algo que el server ya sabia.
- **HIPOTESIS, NO DIAGNOSTICO (no escribirla como causa sin evidencia):** Stripe podria estar rechazando mandar
  `cancel_at` y `cancel_at_period_end` en la MISMA llamada. **No esta verificado** — los `.d.ts` de la version
  instalada no documentan la restriccion y el fake de los tests no la reproduce (seria el caso de «verificar el TIPO
  no es verificar la API», `CLAUDE.md`). **La evidencia decisiva es el log de Stripe** (Developers → Logs, filtrado
  por esa `sub_`), que trae el mensaje exacto del error.
- **`cancel` (D1) SI anda**, y manda solo `cancel_at_period_end: true`. Esa asimetria es lo que hace la hipotesis
  plausible, pero plausible no es medido.

### D3 — INCONSISTENCIA DE DISEÑO QUE LEVANTO EL OWNER. **ES DECISION SUYA, NO ESTA TOMADA**
El comportamiento actual es el especificado (por eso el caso esta ✅), pero el owner observa —y tiene razon— que
**paga Plus hasta el 13 de octubre y sin embargo tiene que archivar locales HOY**. Su propuesta: que la baja sea
**inmediata**, y que el modal lo diga («bajar de plan es inmediato, perderas las funciones Plus»).
**Por que esta como esta:** `effectiveLocationLimit = min(plan vigente, plan pendiente)` existe para que no se pueda
desarchivar hasta 3 y aterrizar en `free` con 3 activos — el estado que la spec entera prohibe
(`locations/core.ts:84-89`). **El costo de la propuesta, que el owner tiene que decidir:** cancelar ya significa que
el merchant **pierde el periodo ya pagado**, salvo que se reembolse prorrateado. **NO SE IMPLEMENTA NADA HASTA QUE EL
OWNER ELIJA.** Sale ADR + cambio de spec: toca Stripe (cancelar ya vs a fin de periodo), la regla del tope y el texto
del modal. El owner menciono ademas «frenar las campañas de marketing» al bajar: eso es alcance NUEVO, fuera de 0063.

### F2 — CUATRO HUECOS DE UI, y **tres son de la SPEC, no del implementador** (verificado: la spec nunca los pidio)
1. **No dice «Plus anual» ni «Plus mensual»: muestra «Plan activo».** El intervalo no se presenta en ningun lado.
2. **El cambio de intervalo NO tiene modal de confirmacion**: se aplica al apretar. La spec no lo pidio, y **cobra
   inmediato** (`always_invoice`), asi que es plata sin confirmar.
3. **No se muestra la fecha de proximo pago/renovacion**, ni en mensual ni en anual.
4. **No hay forma de saber en la app que el cobro de la diferencia se hizo.**
Los tres primeros son **omisiones de la spec 0063**; el cuarto es una pregunta de producto (¿se muestra el importe
cobrado? ¿un link al recibo de Stripe?). **Ninguno se implementa sin que el owner lo defina.**

## QA DEL OWNER EN CURSO — 1o HALLAZGO: FALTA `MERCHANT_PUBLIC_ORIGIN` EN VERCEL (config, no codigo)

**Caso C (downgrade bloqueado) cerrado por el owner: TODO OK.** Es el corazon de la spec — modal en vez de boton
gris, el conteo de locales a archivar, el link, «Confirmar» deshabilitado, y habilitado al archivar.

**BLOQUEANTE DEL QA, y no es un bug: `/api/billing/checkout` contesta 503 `origin_not_configured`** («El pago no esta
configurado todavia»). **Causa localizada en el codigo, no supuesta:** `publicOrigin()` en
`app/api/billing/checkout/route.ts:112` tira ese 503 cuando `process.env.MERCHANT_PUBLIC_ORIGIN` **no existe**, y ese
guard corre ANTES de cualquier logica de plan — por eso no depende del negocio.
- **Afecta a TODO upgrade, no solo a A1: el caso B de los 9 `free` esta bloqueado por lo mismo.**
- **El valor correcto es `https://www.checkpass.club`** — medido: el apex hace **308** a `www`
  (`curl -I https://checkpass.club/backoffice`).
- **Hay que setearla en Vercel (Production) Y REDESPLEGAR:** las envs se inyectan por deploy.
- **CAUSA RAIZ DE POR QUE NADIE LA SETEO: la env es NUEVA de esta spec ([R2-I10]) y NUNCA SE DOCUMENTO EN
  `.env.example`.** Corregido en este commit, con el motivo de por que es 503 y no un fallback.
- **Es 503 a proposito, no un descuido:** con la `idempotencyKey` fija, un fallback a
  `new URL(request.url).origin` dejaria las `*_url` de Stripe clavadas al primer dominio usado por 24 h.
- **Ojo con A1 ademas:** esta en `plus` SIN suscripcion de Stripe, asi que su caso es el **E** (salida del estado
  muerto → `free`), no el B. El 503 tapo eso.

**PENDIENTE DE CONFIRMAR ANTES DE SEGUIR CON B y F: si `STRIPE_ENVIRONMENT` en prod es `test` o `live`.** No se
puede leer desde aca. **Si es `live`, el upgrade y el cambio mensual→anual cobran plata REAL** — y el anual cobra
**inmediatamente** (`always_invoice`, ADR 0058).

## SESION C — EJECUTADA EL 2026-09-12: COMMIT + MIGRACION A PROD + PUSH. FALTA EL QA DEL OWNER

**1. COMMIT `5e4534c6c86fe007f537b477bb8b93a0390b6927`** («feat: spec 0063 fase D2 — UI de suscripcion, D8 y el
oraculo de fuga acotado»), con los 5 gates re-corridos sobre los bytes exactos: `test` con integracion **127
archivos / 921 tests / 0 failed / 0 skipped** · `typecheck --force` 3/3 `0 cached` · `lint` · `format:check` ·
`build --force` 3/3 `0 cached`. Arbol sin mutaciones.

**2. MIGRACION `0030` APLICADA A PROD Y VERIFICADA POR SQL** (proyecto Neon `mi-pasaporte`, rama default). **Orden
respetado: PRIMERO migrar, DESPUES pushear** — al reves `planLocationLimit` pide una columna inexistente y los 11
negocios pierden el modulo Locales.
- **Chequeo PREVIO, que es lo que la hacia segura:** `business_duplicados = 0`, asi que el `CREATE UNIQUE INDEX`
  sobre `business_id` no podia fallar; y las 5 sentencias son **aditivas** (columnas nullable + el indice).
- **Verificado DESPUES:** `pending_plan, pending_plan_at, downgrade_requested_at, last_event_at` presentes ·
  `core_subscription_business_unique` = 1 · `ignored_reason` en `stripe_webhook_event` = 1 ·
  `__drizzle_migrations` = **31** (venia de 30) · **y los datos intactos: 11 filas de `core.subscription`, 11
  negocios, 21 usuarios en `merchant_auth`.**

**3. PUSH A `main` HECHO** con el workaround del `GH_TOKEN` invalido del entorno: `06062d9..5e4534c`.

**HALLAZGO GRANDE DEL PUSH, Y CAMBIA EL ALCANCE DEL QA: viajaron 50 COMMITS, no uno.** El remoto estaba en
`06062d9`, o sea **ANTES de la spec 0063 entera**. Las fases A, B, C y D1 estaban commiteadas **solo en local** y
nunca se habian desplegado. **Prod pasa de no tener nada de cambio de plan a tener la feature completa de una vez**,
asi que el QA no puede mirar solo la UI de la D2: tiene que cubrir tambien las 5 rutas, el webhook y el claim.

**4. DEPLOY VERDE PARA EL SHA EXACTO: `state = success`** — `GH_TOKEN= gh api
repos/maxhost/check-point/commits/5e4534c6c86fe007f537b477bb8b93a0390b6927/status --jq '.state'`. Es la regla de
`CLAUDE.md` cumplida: se verifica el sha que se va a probar, no que «prod este verde». **Prod corre este commit.**

**LO UNICO QUE FALTA: EL QA DEL OWNER.** Y por lo del push, el alcance es la spec **completa**, no solo la D2:
upgrade free→plus por Checkout, downgrade con bloqueo duro por locales activos, el modal de condiciones, la baja
programada y su «Reanudar», el cambio mensual→anual, la salida del estado muerto, y la tarjeta de la home.
**Recordar el estado real de prod al probar:** 11 negocios, todos `active`, con planes `free` y `plus`.

## ⛔ EL BUCLE DEL ORACULO DE FUGA SE CORTA — DECISION PEDIDA AL OWNER EL 2026-09-12

**El owner freno la sesion y pregunto, textual: «se supone que armaste una feature que permite hacer upgrade o
downgrade de un plan y estas implementando UI. Porque tenes tantos problemas para esto?».** La pregunta es correcta y
el diagnostico es este:

**LA FEATURE ESTA HECHA.** Upgrade = Checkout de Stripe; downgrade = `decidePlanChange` + modal + 409 del servidor.
Fases A, B, C y D1 **commiteadas con PASS**; el codigo de la D2 escrito y funcionando.

**LO QUE CONSUMIO LAS ULTIMAS HORAS ES UN SOLO TEST:** el que prueba que la pagina no filtra
`stripe_customer_id`/`stripe_subscription_id` al navegador. Van **SEIS vueltas** de oraculo, cada una cazada por un
revisor plantando una fuga mas exotica que la anterior (un `Proxy` que devuelve el secreto en la 1a lectura; un
string en base64 como `type` del elemento). **Y hay una SEPTIMA ya empezada:** el revisor cortado dejo plantada una
fuga en `notice` gateada a `params.done === "cancel"` — un TERCER estado que el oraculo no cubre.

**EL DEFECTO DE PROCESO, Y ES DEL ORQUESTADOR, NO DE LOS REVISORES:** `CLAUDE.md` exige que toda afirmacion tenga
oraculo probado por mutacion, pero **«esto no filtra nada por ningun canal» es una afirmacion UNIVERSAL: no existe un
conjunto finito de mutaciones que la demuestre.** Siempre hay un canal mas. **El bucle no tiene condicion de corte y
el orquestador nunca se la puso** — los revisores hicieron exactamente lo encargado. El riesgo REAL se cerro en la
primera vuelta (el DTO omite las claves + el test de que el HTML no las contiene); todo lo posterior exige que
alguien escriba a proposito `key={row.stripeCustomerId}`.

**EL OWNER LO APROBO** (2026-09-12, textual: «si, cortamos el bucle y vamos con session C para poder acabar de
cerrar esto»). **HECHO:** (1) el limite quedo **DECLARADO** en el ADR 0062 (§Limite declarado) y en el docblock del
propio test —que cierra todo error PLAUSIBLE y NO la afirmacion universal—; (4) la regla bajo a `CLAUDE.md`: **una
propiedad universal se cierra con un oraculo acotado MAS un limite declarado**, con la señal de alarma explicita
(«si dos rondas seguidas terminan en *el fix abrio la preimagen siguiente*, el bucle no termina solo»). Quedan (2) el
commit y (3) la sesion C.

**ATENCION AL ORDEN DE DESPLIEGUE (esta escrito en la spec y ya fue un bloqueante): SE MIGRA PRIMERO Y SE PUSHEA
DESPUES.** Al reves, `planLocationLimit` pide una columna que no existe y **los 11 negocios de prod pierden el modulo
Locales**.

**Y LO QUE EL OWNER TIENE QUE SABER AL DECIDIR:** esto se commitea y se despliega **SIN el PASS** que el plan pedia.
Los cambios de las sesiones A, B-bis y B-ter **tienen sus mutaciones ejecutadas en rojo** una por una, pero **ningun
revisor independiente firmo el delta completo** — la ultima revision quedo cortada a mitad. Lo que si esta cerrado
con PASS son las fases A, B, C y D1, ya commiteadas.

### 15a MUERTE (3a del ciclo B), 2026-09-12 — arbol restaurado y VERIFICADO

El revisor de la B-ter murio con **R-A puesta** en `page.tsx` (`??`). `ListAgents` → no estaba vivo. La mutacion,
**etiquetada y atribuida**. **`diff` contra `/tmp/b-ter-clean/page.tsx` ANTES de restaurar:** mostro exactamente sus
dos hunks (el `notice` gateado al `?done=cancel` y el `stripeCustomerId` agregado al estado) y nada mas. Restaurado
por `cp`: `diff` = 0, `shasum` `a9381ca449be4845c6e6daff5115084c8ea0b3dc`, `grep MUTATION` = **0**. Los otros 4
shasums del baseline, identicos. **Su bitacora quedo en `/tmp/revision-b-ter.md` y su veredicto NO existe.**

## SESION B-ter — DELTA ESCRITO, 5 GATES VERDES, RE-REVISION ACOTADA (CORTADA POR EL OWNER)

Bitacora `/tmp/sesion-b-ter.md`; encargo `docs/encargo-sesion-b-ter.md`; bitacora del revisor
`/tmp/revision-b-ter.md`. **Cierra el bloqueante (6a preimagen) y los menores, cada uno con su mutacion EJECUTADA:**

- **El oraculo de props pasa a un HELPER, `expectCrossesExactly` (`billing-pages-support.ts`), y se corre COMPLETO
  en CADA estado.** Hace las cuatro: `type`, `key`, UNA lectura (`structuredClone`) y `toEqual` de TODAS las props.
  **El helper no es estilo: es lo que hace que repetir el conjunto entero salga MAS BARATO que recortarlo** — y el
  recorte («no entra en el archivo») fue exactamente la 6a preimagen.
- **DOS `it` separados, y la razon esta MEDIDA:** adentro del mismo `it` el primer rojo corta y el 2o estado **no se
  evalua** (la fuga del `key` solo exhibia el secreto del primero). **Y los dos estados ahora se siembran con
  `custId`/`subId` REALES**: sin eso, lo mejor que podia exhibir una fuga del `key` en el estado bloqueado era el
  string `"null"`.
- **Mutaciones, con la asercion leida y el `it` en que cae:** fuga en `notice` gateada al bloqueado → ROJO **solo en
  el `it` nuevo** (`- "notice": null` / `+ "notice": "cus_secret_SIXTH_S1"`); fuga en `downgradeBlock.message`
  conservando el «2» → ROJO; `<main>` envolviendo la consola → ROJO `expected 'main' to be [Function
  SubscriptionConsole]`; fuga del `key` → **ROJO 2, uno por `it`**, con **dos secretos reales distintos**
  (`cus_props_27bf91c1` y `cus_bloq_27bf91c1`).
- **Menor 3 cerrado:** 4o caso del test de foco — con una tecla que no es Tab el handler sale ANTES del
  `querySelectorAll`, asi que se asevera `seen` **vacio**. Borrar el guard → ROJO 1/4, solo ese caso.
- **Docs:** ADR 0062 (6 vueltas; requisito 4 reescrito; **se corrige a si mismo por 2a vez** — la version anterior
  declaraba aplicado un requisito que no lo estaba y citaba una asercion inflada), INDEX, items 8 y 12 de la spec y
  el docblock de `page.tsx`. **Y el §Hallazgos punto 2 de la spec, que era un LIMITE FALSO** («queda sin oraculo que
  apretar el boton ABRA el modal»): `billing-click-probe.test.ts` lo pinnea y muerde, y **el item 11 del MISMO
  archivo ya lo afirmaba** — la spec se contradecia consigo misma.

**5 GATES VERDES:** `test` con integracion **127 archivos / 921 tests / 0 failed / 0 skipped** (+2) · `typecheck
--force` 3/3 `0 cached` · `lint` · `format:check` · `build --force` 3/3 `0 cached`. Tamaños AL HOOK sobre todo el
alcance, control `onboarding` EXIT=2: todos EXIT=0.

**CASI-ACCIDENTE QUE VALE LA REGLA: al separar los `it` el archivo quedo en 301 lineas, VIOLANDO el limite — y el
hook `file-size` NO disparo porque es PostToolUse y las ediciones fueron por script.** Lo cazo la medicion manual.
Se recupero hoisteando el literal del DTO (duplicado en los dos `it`) a un `const` del `describe`: **296 lineas,
preguntado AL HOOK**. Siguen en 300 exactas `billing-offers.test.ts` y `billing-store.neon…`.

**NUEVO BASELINE (copias en `/tmp/b-ter-clean/`):** `page.tsx` `a9381ca4` · `confirm-dialog.tsx` `2add27d4` ·
`confirm-dialog-focus.test.ts` `50f304c8` · `billing-pages.neon…` `11bf7648` · `billing-pages-support.ts`
`d690a0b0`. **SI ESTA SESION SE CAE:** `ListAgents`, `grep -rn MUTATION apps/merchant/src`, comparar esos 5 shasums
y leer las bitacoras.

## VEREDICTO DE LA RE-REVISION DE LA B-bis: **FAIL** — 1 bloqueante + 4 menores. SIGUE SIN HABER PASS ⇒ NO SE COMMITEA

Bitacora en `/tmp/revision-b-bis.md` (202 lineas). **13 mutaciones, OCHO fuera de toda tabla** (pedia 2). Los 5
numeros de los gates **reproducen exactos** (127/919/0/0, `typecheck --force` 3/3 `0 cached`, `build --force` 3/3).
**Higiene verificada por el ORQUESTADOR al recibir:** `grep MUTATION` = 0, sin `zz-*`, los 4 shasums == baseline
(`d2cf8bdc` / `2add27d4` / `ccb82ac5` / `648468e2`), `git status --short` con las mismas 23 entradas.

**BLOQUEANTE — LA SEXTA PREIMAGEN ES DEL DELTA MISMO: el 2o estado NO es oraculo de VALOR.** El requisito 4 que el
ADR 0062 estrena dice «el conjunto se repite en CADA ESTADO». **No esta aplicado**: el 2o estado asevera `key` y
`downgradeBlock`, nada mas — **verificado por el orquestador leyendo el archivo**, son 8 lineas. Dos mutaciones, las
dos **VERDES 44/44**:
- **S1:** un secreto en **otra prop** (`notice`), **gateado al estado bloqueado** — nulo en el estado 1, asi que pasa
  el `toEqual` entero, y el 2o no lo mira. **Y ademas se IMPRIME en el HTML** (`<p class="toast success">…`), asi que
  cruzaba por los dos caminos con la suite en verde.
- **S2:** el secreto **dentro de `downgradeBlock.message`**, conservando el «2» que `expect.stringContaining("2")`
  exige. **Es la misma prop que el item m1 declaro cerrada:** la mutacion anterior mordia por la CLAVE de mas, esta
  demuestra que **el VALOR nunca estuvo pinneado**. Y no llega al HTML (el modal esta cerrado en la carga): invisible
  para todo.

**Es FUGA, no limite** (sonda Q3: un string plano en una prop permitida viaja por el wire).

**CONSECUENCIA DOCUMENTAL, Y ES LO MAS GRAVE: el ADR 0062 («los cuatro puntos estan APLICADOS al arbol y con su
mutacion en ROJO ejecutada»), la fila de `docs/INDEX.md` y el item 8 de la spec AFIRMAN MAS DE LO QUE EL ARBOL
SOSTIENE.** Lo escribio el orquestador en la B-bis, en el mismo commit en que estrenaba el requisito 4. **Septima vez
de esta familia en esta spec, y la primera cometida DENTRO del documento que existe para prohibirla.**

**MENORES:**
1. **El seed del 2o estado no tiene NINGUNA clave interna**, asi que ni el `key` ni `downgradeBlock` pueden exhibir un
   secreto real: lo mejor que dan es el string `"null"` (React coacciona: `key = '' + config.key`). **Respuesta
   explicita del revisor a la pregunta del encargo: SI, ese estado necesita un secreto sembrado
   (`custId(…)`/`subId(…)`) para ser un oraculo honesto.**
2. **Transcripcion inflada:** el ADR y el INDEX citan `expected 'cus_secret_ZZ9' to be null` «en los DOS estados»;
   en el 2o la asercion real es `expected 'null' to be null`. Se lee como mas de lo que hubo.
3. **El guard `event.key !== "Tab"` no tiene oraculo NI declaracion** (S3 → VERDE 32/32 al borrarlo). La lista «lo
   que este test NO mira» solo nombra el `useEffect`. Impacto bajo hoy: el modal no tiene inputs.
4. **`element.type`: LIMITE CON SALVEDAD, no fuga** — y el criterio esta medido, no razonado. El canal existe
   (`createElement(base64(secreto))` sale al wire con `key` null y clon limpio), pero en ESTA pagina no es explotable
   en silencio: S6 da 13 rojos. **La salvedad: ningun rojo nombra la propiedad** (hablan del `structuredClone` o del
   markup). El ADR *nombra* `type` y cierra dos de sus tres partes. Cerrarlo es 1 linea, o declararlo.

**LO QUE EL DELTA HIZO BIEN, verificado y no asumido:** **m2 es la unica pieza exacta sin resto** (S5 → ROJO con el
camino literal `props.offers.leak: [object Map]`, y las sondas confirman la justificacion palabra por palabra); el
item 12 cita sus tres aserciones **literalmente correctas**; y **S4 (`first`/`last` invertidos → ROJO 2/32) prueba que
el test de foco ya no es tautologico**. Las 5 re-ejecuciones (B1 en los dos estados, m1, m4, m5, R18) reproducen,
cada una roja en UN test distinto.

**HALLAZGO FUERA DE ALCANCE (es de la D2, y es un LIMITE FALSO):** el §Hallazgos punto 2 de la spec 0063 dice «queda
sin oraculo que apretar el boton ABRA el modal (`setConfirming(true)`, una linea)». **Es falso: hay un test que lo
pinnea y MUERDE** (ROJO 1/29, `expected false to be true`), y **el item 11 del MISMO documento lo afirma** — la spec
se contradice consigo misma. Residual viejo que una fase posterior ya saldo.

**SIGUE: sesion B-ter.** El fix del bloqueante **no cabe** en `billing-pages.neon…` (**299/300 medido al hook**), asi
que el corte se decide ANTES: la salida barata es un helper en `billing-pages-support.ts` (**114 lineas, margen de
sobra**) que reciba el elemento y el objeto esperado y haga las tres cosas (lectura unica, `key`, `toEqual` completo),
llamado desde los DOS estados — cierra el requisito 4 y BAJA lineas del test en vez de subirlas.

### 14a MUERTE (2a de la B-bis), 2026-09-12 — arbol SANO, y la re-revision YA ENCONTRO DOS FUGAS DEL DELTA

**El revisor murio con S4 puesta** en `confirm-dialog.tsx` (` M`). **Restauracion del orquestador, con comandos:**
`ListAgents` PRIMERO (no estaba vivo) → `grep MUTATION` = 1 linea **etiquetada y atribuida** → **`diff` contra
`/tmp/rev-bbis-clean/` ANTES del `cp`** (mostro exactamente `first`/`last` invertidos, nada del trabajo no
commiteado) → `diff` = 0, `shasum` `2add27d4…`, `grep MUTATION` = 0. Los otros 3 shasums, identicos.
**Se perdieron las mediciones de S3 y S4** (filas abiertas, sin resultado): se rehacen. Revisor RETOMADO por
`SendMessage`, contexto intacto. **SIN VEREDICTO TODAVIA.**

**LO QUE YA MIDIO, Y ES CONTRA EL DELTA DEL ORQUESTADOR (bitacora `/tmp/revision-b-bis.md`):**
- **Las 5 re-ejecuciones REPRODUCEN** (B1 en los dos estados, m1, m4, m5, R18), cada una roja en UN test distinto,
  con la asercion leida. Y los 5 numeros de los gates reproducen exactos (127/919, 3/3, `0 cached`).
- **S1 — SEXTA PREIMAGEN, y es del delta de la sesion B-bis: el 2o estado NO repite el conjunto de aserciones**,
  solo mira `downgradeBlock`. Un secreto en `notice` **gateado al estado bloqueado** (nulo en el estado 1, asi que
  pasa el `toEqual` entero) deja **44/44 VERDE** — y la sonda Q3 midio que un string plano en una prop permitida
  viaja por el wire. **Peor: tambien se IMPRIME en el HTML** (`<p class="toast success">cus_secret_SIXTH_S1</p>`) y
  la suite seguia verde. Fix **intentado, no declarado**: una linea, `expect(html).not.toContain("cus_")` en ese
  test → rojo con la fuga, verde 6/6 limpio.
- **S2 — `message` quedo pinneado con `expect.stringContaining("2")`, que NO es valor exacto:** un secreto adentro
  del `message` conservando el «2» deja **44/44 VERDE**, y esa fuga **no llega al HTML** (el modal esta cerrado en
  la carga), asi que tampoco la ve el test del markup. **Es la misma prop que el item m1 declaro cerrada: V2 mordio
  por la CLAVE de mas, S2 demuestra que el VALOR sigue abierto.** El orquestador habia marcado ese matiz en el
  encargo y el revisor lo cerro con mutacion en vez de con lectura.
- **Q1 — `element.type` es un canal del wire que el oraculo no mira** (un `type` en base64 sale al wire y el test
  del HTML tampoco lo ve). Pendiente de que el revisor lo clasifique fuga vs limite.
- **Limites MEDIDOS (no declarados):** `_debugStack` (el wire emite los frames del `createElement`, no el `Error`
  inyectado) y `ref` (React 19 lo pasa como prop, pero **Flight lo rechaza**: «Refs cannot be used in Server
  Components»).

## SESION B-bis — DELTA DE CORRECCION ESCRITO, 5 GATES VERDES, RE-REVISION ACOTADA EN CURSO

Bitacora en `/tmp/sesion-b-bis.md`; encargo del revisor en `docs/encargo-sesion-b-bis.md` (bitacora suya en
`/tmp/revision-b-bis.md`). **Cierra los 6 items del FAIL de la sesion B, cada uno con su mutacion EJECUTADA:**

- **B1, el bloqueante — el canal `element.key`:** `expect(element.key).toBeNull()` en los DOS estados. Mutacion
  → **ROJO 2/6**, `expected 'cus_secret_ZZ9' to be null`, **y el test del HTML queda VERDE** — que es exactamente
  por que la quinta preimagen era invisible: un `key` no se renderiza.
- **m1 — el `toEqual` pinneaba UN SOLO ESTADO:** se agrega el 2o (`downgradeBlock` NO nulo) en «con 2 locales
  activos…». Mutacion → **ROJO**, `+ "customer": null`. **Matiz que se le paso al revisor para que lo audite: el
  seed de ese test no tiene `stripeCustomerId`, asi que la fuga medida fue un `null` — el `toEqual` mordio por la
  CLAVE de mas, no por el valor.**
- **m2 —** el comentario de `nonPlainPaths` decia que caza instancias y el `structuredClone` se lo llevo (el clon
  aplana el prototipo). Reescrito, y el limite queda MEDIDO: Flight **rechaza** instancias y `Object.create(null)`.
- **m3 —** `page.tsx` y el item 8 de la spec describian el oraculo de la TERCERA vuelta. Corregidos.
- **m4 y m5 — el test de foco era TAUTOLOGICO y cubria un tercio.** Reescrito a **3 casos** con
  `tabDesde(activo, shiftKey)`. **Cada mutacion pone rojo un test DISTINTO:** selector ⇒ test 1; sacar
  `activeElement === last` ⇒ test 2 (`expected "vi.fn()" to not be called at all`); borrar la rama del shift+Tab
  ⇒ test 3 (`to be called 1 times, but got 0 times`).
- **ADR 0062 reescrito** (5 vueltas, 4 requisitos) + fila de `docs/INDEX.md` + el docblock de `confirm-dialog.tsx`.
  **El ADR ahora se corrige a si mismo:** su 1a version afirmaba en absoluto que contra un `toEqual` del objeto
  entero no pasa nada, **sin nombrar SOBRE QUE lo cerraba**, y esa omision fue por donde entro la 5a preimagen.

**5 GATES VERDES sobre los bytes finales:** `test` con integracion **127 archivos / 919 tests / 0 failed / 0
skipped** (+2 tests, los dos casos nuevos del foco) · `typecheck --force` 3/3 `0 cached` · `lint` · `format:check` ·
`build --force` 3/3 `0 cached`. **`typecheck` cazo un error real de esta tanda** (`TS2339: Property 'key' does not
exist` — el cast del elemento no lo tenia): vitest no typechequea, asi que las mutaciones corrieron igual y el gate
fue lo unico que lo vio. Tamaños al hook sobre ` M` + `??`: todos `EXIT=0`, control `onboarding` `EXIT=2`.
**TRES al filo: `billing-pages.neon…` 299, `billing-offers` 300, `billing-store` 300.**

**NUEVO BASELINE (copias limpias en `/tmp/b-bis-clean/`):** `page.tsx` `d2cf8bdc` · `confirm-dialog.tsx` `2add27d4`
· `billing-pages.neon…` `ccb82ac5` · `confirm-dialog-focus.test.ts` `648468e2`. **SI ESTA SESION SE CAE:**
`grep -rn MUTATION apps/merchant/src`, comparar esos 4 shasums y leer las dos bitacoras.

## VEREDICTO DE LA SESION B: **FAIL DE BAJA SEVERIDAD** — 1 bloqueante + 5 menores. NO HAY PASS ⇒ NO SE COMMITEA

Bitacora del revisor en `/tmp/revision-sesion-b.md` (147 lineas). **Los DOS cambios de la sesion A son correctos y
MUERDEN** (E4, E5 y R18 re-ejecutadas por el revisor, las tres ROJAS con la asercion leida). El FAIL no dice «el
trabajo esta mal»: dice que **la afirmacion de cierre esta sobredimensionada** y que hay un canal MEDIDO que el
oraculo no ve. **9 mutaciones, 4 de ellas VERDES — y las 4 estaban FUERA de toda tabla**, que es donde esta el valor
en esta spec desde la fase B.

**Higiene verificada por el ORQUESTADOR al recibir (no relatada):** `grep MUTATION` = 0, sin `zz-*`, los **6 shasums
== baseline**, `git status --short` identico al de apertura, disco 39 GB.

**B1 — BLOQUEANTE: HAY QUINTA PREIMAGEN DE LA FUGA, Y ES EL `key` DEL ELEMENTO.** El oraculo lee `element.props`;
**Flight serializa el ELEMENTO** (`type`, `key`, `props`). **Re-corri la sonda del revisor yo mismo** (`node
--conditions=react-server /tmp/flight-probe3.cjs`) y reproduce exacto: con `createElement("div",{key:secret,...})`,
`element.props` = `{"plan":"plus"}` y **`element.key` = `"cus_secret_ZZ9"`**, que **no esta en props ni en su
`structuredClone`** — y el wire sale `0:["$","div","cus_secret_ZZ9",{"plan":"plus"},…]`, o sea **`sendsSecret=true`**.
La mutacion N1 (`key={row.stripeCustomerId}`) deja **VERDE 15/15**, incluido el test del HTML que asevera
`not.toContain("cus_")`. **Es FUGA, no limite.** El ADR 0062 y el docblock del test afirman «contra un `toEqual` del
objeto entero no hay clave de mas, valor de mas ni transformacion que pase»: **cierto para las props, falso para el
elemento.** **Fix INTENTADO Y MEDIDO por el revisor (no declarado): `expect(element.key).toBeNull()`** → limpio
VERDE 6/6, con N1 ROJO `expected 'cus_props_da6aaa75' to be null`.

**LOS 5 MENORES** (el revisor encontro 5; **el detalle de los 3 del revisor del delta NO es recuperable** y lo dijo
explicitamente en vez de inventar tres — los menores que sobreviven en `/tmp` son de la ronda anterior y estan
cerrados):
1. **El `toEqual` pinnea UN SOLO ESTADO.** N2 → VERDE 44/44 con la fuga dentro de `downgradeBlock`, que en el estado
   sembrado es `null`. No esta declarado en ningun lado.
2. **`billing-pages.neon…:167-169` afirma que `nonPlainPaths` caza «instancia» y YA NO LO HACE** — lo perdio el
   propio `structuredClone` de la sesion A (**verificado por mi con la sonda P3: el clon pasa de prototipo `Leak` a
   `Object.prototype`**). NO es fuga (Flight rechaza instancias: «Only plain objects…»), es un **docblock que afirma
   un invariante que el codigo dejo de tener**. Es la familia que esta spec ya pago cuatro veces.
3. **`page.tsx:37-43` y el item 8 de la spec siguen describiendo el oraculo de la TERCERA vuelta** (allow-list de 8
   claves + valores planos), que el ADR 0062 declara insuficiente. La sesion A corrigio el docblock de
   `confirm-dialog` y el item 12, **y se dejo estos dos**.
4. **El test de foco NO pinnea «desde el ULTIMO focusable», que es lo que dice su titulo.** N4 → VERDE 32/32 sacando
   `document.activeElement === last`; con esa mutacion **ningun Tab hacia adelante funciona** en el modal. Causa
   medida: el stub `get activeElement(){ return seen.at(-1) }` es **tautologico**.
5. **La mitad hacia atras (shift+Tab) no tiene oraculo ni declaracion.** N3 → VERDE 32/32 borrando la rama entera.
   El item 12 de la spec y este archivo dicen «la trampa de foco TIENE ORACULO»: **es mas de lo que hay** — o sea
   que la correccion del limite falso que hizo la sesion A **quedo sobredimensionada al reves**. El docblock del
   componente se salva porque habla del SELECTOR.

**SIGUE: ronda de correccion (sesion B-bis)** — cerrar B1 con el fix medido, y los 5 menores (los 1 y 5 exigen
INTENTAR antes de declarar limite, que es justo el error que se esta corrigiendo). Despues, revision acotada a esos
cambios. **El commit sigue bloqueado por decision del owner hasta que haya PASS.**

### HALLAZGO DE HARNESS (no de codigo): `tasks-fresh.sh` BLOQUEA EN BUCLE mientras corre un subagente que muta

**Sintoma medido esta sesion: tres turnos seguidos bloqueados por el mismo hook**, cada uno nombrando el archivo
que el revisor acababa de tocar (`confirm-dialog.tsx`, despues `page.tsx` dos veces).

**Mecanismo, leido en el hook y no supuesto** (`.claude/hooks/tasks-fresh.sh`): toma lo que `git status --porcelain`
reporta como cambiado bajo `apps/*/src` y compara **mtime contra `docs/TASKS.md`** (`[ "$entry" -nt docs/TASKS.md ]`).
Un revisor vivo **muta y restaura** el mismo archivo muchas veces, y **cada `cp` le bumpea el mtime**: por
construccion el codigo queda siempre mas nuevo que `TASKS.md`, y el hook bloquea aunque `TASKS.md` se acabe de
actualizar. **No distingue «el orquestador toco codigo y no actualizo el estado» de «hay un subagente midiendo».**

**No se toca el hook con una revision en curso** — un guard no se afloja en caliente, y `CLAUDE.md` exige probar que
un hook MUERDE contra un estado que debe bloquear. **Queda como tarea, con la forma del fix ya pensada:** el hook ya
resolvio un falso positivo parecido (un `git checkout` bumpeaba el mtime de archivos intactos; se arreglo mirando
`git status` en vez del mtime de todo `src`). Aca el archivo **si** esta cambiado, asi que el discriminante no puede
ser ese: lo honesto es que el hook **ignore los archivos que tienen una `MUTATION` etiquetada puesta** (son
transitorios por definicion, y `no-mutations-left.sh` ya los cubre) o que compare contra el mtime del archivo
**sin** contar las restauraciones. **Al implementarlo: correrlo contra un estado que DEBE bloquear y verificar el
`exit 2` Y el mensaje** — un `exit 0` puede significar «paso» o «nunca miro nada», y desde afuera son iguales.

### ⚠ HAY UN REVISOR VIVO MUTANDO — NO REVIENTES SUS MUTACIONES

**Si `no-mutations-left.sh` te marca una `MUTATION`, PARA.** El revisor de la sesion B esta corriendo (`ListAgents`
→ `running`) y su encargo es, justamente, mutar estos archivos. Cortarle una mutacion a un agente vivo lo hace
transcribir un resultado falso, que es peor que el rojo que el hook previene.

**EL ORDEN, SIEMPRE:** (1) **`ListAgents`** — si el subagente figura como `running`, la mutacion puede estar VIVA y
**no se toca**; (2) **re-leer el archivo** (`grep MUTATION` + `shasum`), porque puede estar **ya revertida**;
(3) **solo si el agente esta muerto Y la mutacion sigue puesta**, restaurar. Las dos respuestas posibles —viva, o ya
revertida— prohiben tocarla, y ninguna se sabe sin mirar.

**Y OJO CON EL TERCER HOOK, `verify.sh`, QUE ES EL MAS PELIGROSO DE LOS TRES: bajo una mutacion viva los TESTS DAN
ROJO, y el hook te dice «Arreglalo».** Paso a las 21:18 con **S4** puesta (`first`/`last` invertidos): 2 rojos en
`confirm-dialog-focus.test.ts` — que es **exactamente lo que S4 existe para medir**. El «arreglo» obvio seria tocar
el test para que pase, o sea **destruir el oraculo para tapar una medicion en curso**; el propio hook lo prohibe en
su ultima linea («No edites ni borres tests para que pasen»). **Un gate rojo bajo una mutacion viva NO SE ARREGLA:
SE ESPERA.** El discriminante es el mismo de siempre: `ListAgents` + `grep MUTATION` + `shasum`. Con el subagente
`running` y el hash distinto del baseline, ese rojo **no habla del producto**.
**Y la variante que salio dos minutos despues: `verify.sh` puede pegarle al TYPECHECK, no solo a los tests.** Con
**S5** puesta (un `Map` anidado en `offers`) tiro `TS2353: 'leak' does not exist in type 'SubscriptionOffers'` —
un error que **describe la mutacion con precision** y por eso se lee como un bug real de tipos. Mismo discriminante,
misma conducta: esperar.

**YA PASO CUATRO VECES EN ESTA SESION, y en NINGUNA correspondia tocar nada:**
- **20:30 — `confirm-dialog.tsx:86` (N4):** el hook la reportaba y el arbol ya estaba **LIMPIO** (`grep` = 0,
  `shasum` = `553dec19…`). Foto vieja.
- **20:32 — `page.tsx:73` (N5):** **VIVA**, con el subagente `running`. Etiquetada (`MUTATION`) y **atribuida**
  («revisor sesion B, spec 0063») — que es lo unico que hay que verificar antes de dejarla en paz.
- **20:35 — `page.tsx:71` + `:166` (N1-bis) y `billing-pages.neon…:157` (sonda S-FIX-1):** al mirar, **los TRES
  archivos limpios** y los tres `shasum` == baseline. **El revisor las habia revertido el solo.** Foto vieja otra vez.
- **21:18 — `confirm-dialog.tsx:86` (S4, revisor de la B-bis): VIVA**, subagente `running`, hash `0fd0638b…` ≠
  baseline `2add27d4…`. Y esta vez **ademas disparo `verify.sh` con 2 tests rojos** (ver el parrafo de arriba).
**Dos de tres eran fotos viejas: el reflejo de «restaurar apenas el hook reclama» habria pisado trabajo ajeno las
dos veces**, y la tercera habria cortado una medicion viva.

**COMANDOS EXACTOS DE RESTAURACION (no reconstruyas nada a mano), para cuando el revisor TERMINE:**

```sh
cd /Users/maxi/claude-workspace/check-point
# el diff ANTES del cp no es opcional: tiene que mostrar SOLO la mutacion
diff /tmp/rev-b-clean/page.tsx           apps/merchant/src/app/backoffice/subscription/page.tsx
cp   /tmp/rev-b-clean/page.tsx           apps/merchant/src/app/backoffice/subscription/page.tsx
shasum apps/merchant/src/app/backoffice/subscription/page.tsx        # DEBE dar 963efe9ce5e80a627c22cc634ff487a9b9439cd7

diff /tmp/rev-b-clean/confirm-dialog.tsx apps/merchant/src/app/components/confirm-dialog.tsx
cp   /tmp/rev-b-clean/confirm-dialog.tsx apps/merchant/src/app/components/confirm-dialog.tsx
shasum apps/merchant/src/app/components/confirm-dialog.tsx           # DEBE dar 553dec1982e8bd6e5419fe3bbc34a03154dfe3c0

# OJO: el baseline de `confirm-dialog.tsx` CAMBIO con la sesion B-bis. El limpio de HOY es
#   2add27d40e400b21f168e7e86a907805ccddda36  (copia en /tmp/rev-bbis-clean/ y /tmp/b-bis-clean/)
# y el `553dec19…` de mas arriba es el de la sesion A, ANTERIOR al delta. Restaurar con el viejo
# revierte en silencio el trabajo de la B-bis: usá /tmp/rev-bbis-clean/.

# el revisor tambien sondea el TEST de props (`??`, asi que `git checkout` tampoco sirve aca)
diff /tmp/rev-b-clean/billing-pages.neon.integration.test.ts apps/merchant/src/server/billing-pages.neon.integration.test.ts
cp   /tmp/rev-b-clean/billing-pages.neon.integration.test.ts apps/merchant/src/server/billing-pages.neon.integration.test.ts
shasum apps/merchant/src/server/billing-pages.neon.integration.test.ts   # DEBE dar abc751a0f0c96bfdaf0188b9f9f7128e8d7a12e8
```

**Por que el `diff` primero, y por que son DOS peligros distintos:**
- `page.tsx` es **`??` (untracked): `git checkout` sobre el NO HACE NADA** — no hay blob. La copia en `/tmp` es el
  UNICO punto de retorno que existe.
- `confirm-dialog.tsx` es **` M` (tracked y modificado): ahi `git checkout` SI hace algo, y es lo peor** — se
  llevaria tambien el docblock corregido de la sesion A, y se veria como si hubiera funcionado.

**TRAMPA CON LAS COPIAS LIMPIAS:** hay dos carpetas. Las de `page.tsx` son identicas (`963efe9c…` las dos), pero
**la `confirm-dialog.tsx` de `/tmp/sesion-a-limpio/` es `206dc246…`, ANTERIOR al docblock corregido**. Para
restaurar ese archivo usá **siempre** la de `/tmp/rev-b-clean/` (`553dec19…`).

### 13a MUERTE DE LA SPEC (1a de la SESION B), 2026-09-12. El arbol quedo SANO y la bitacora a disco lo salvo

**El revisor de la sesion B murio con la mutacion N4 PUESTA** en `app/components/confirm-dialog.tsx` (un archivo
` M`, el caso peor: ahi `git checkout` SI hace algo y se lleva tambien el trabajo no commiteado). **Auditoria y
restauracion del orquestador, con comandos, no relatada:**
- **`ListAgents` PRIMERO** (la regla de `CLAUDE.md`: el reclamo del hook es una foto vieja y «viva» vs «abandonada»
  no se sabe sin mirar): el subagente **NO estaba vivo**. No se corto ninguna medicion en curso.
- `grep -rn MUTATION apps/merchant/src` → 1 linea, **etiquetada y atribuida** (`MUTATION N4 (revisor sesion B…)`).
  La convencion de etiquetar es lo unico que separo «mutacion abandonada» de «bug real del producto».
- **`diff` contra la copia limpia ANTES de restaurar:** mostro **exactamente** la mutacion (1 linea + 2 de
  comentario) y nada mas. Recien ahi el `cp`. Post: `diff` = 0, `shasum` `553dec19…`, `grep MUTATION` = 0.
- **LO QUE SE PERDIO NO ES EL ARBOL, ES LA MEDICION:** la fila de N4 estaba abierta (bien) pero **sin resultado**,
  asi que N4 hay que **rehacerla**. Es exactamente el modo de falla que `CLAUDE.md` ya documenta: el hook te salva
  el arbol, no la medicion.

### SESION A — HECHA (2026-09-12). Bitacora en `/tmp/sesion-a-0063.md`; copias limpias en `/tmp/sesion-a-limpio/`

**Auditoria al entrar, con comandos:** `grep MUTATION` vacio, sin sondas `zz-*`, los hashes del baseline identicos,
41 GB libres en disco, Node `v24.20.0`. Sobrevivieron `/tmp/barrido-d2.md`, `/tmp/revision-delta-d2.md`,
`/tmp/zz-focus-probe.test.ts` y `/tmp/fix-d2-base/`.

**(1) BLOQUEANTE CERRADO — `structuredClone` en el test de props** (`billing-pages.neon.integration.test.ts`, 273 →
281 lineas, hook `EXIT=0`). `const props = structuredClone(element.props)` es la UNICA lectura y las 3 aserciones
leen el clon. **Re-ejecutadas las dos preimagenes, no heredadas del revisor:**
- **E4** (getter con estado en `offers.downgrade.endpoint`, 1a lectura → el secreto) → **ROJO**, y la asercion habla
  de la propiedad: `- "endpoint": "/api/billing/cancel"` / `+ "endpoint": "cus_secret_ZZ9"` en el `toEqual`.
- **E5** (`Proxy` sobre `offers.downgrade`) → **ROJO** `DataCloneError: #<Object> could not be cloned`, en el propio
  `structuredClone`.
- Control limpio **6/6 VERDE**. Las dos restauradas con `cp` + `diff` (0 lineas) + `shasum` `963efe9c` + `grep
  MUTATION` = 0.

**(2) EL LIMITE FALSO DE LA TRAMPA DE FOCO, CERRADO** — `app/components/confirm-dialog-focus.test.ts` **CREADO** (95
lineas tras prettier, hook `EXIT=0`): render real con `renderToStaticMarkup` + `parse()` de
`next/dist/compiled/node-html-parser` + el `onKeyDown` y el `ref` REALES. **VERDE 1/1 en 12 ms, cero paquetes.**
Mutacion **R18** (selector → `"button, input, select, textarea"`, sobre un archivo ` M`: restaurado por `cp` del
`/tmp`, con `diff` mostrando **exactamente la mutacion** y `shasum` `206dc246`) → **ROJO** con la asercion literal
(`+ "BUTTON:Confirmar"`, y sin `A:tus locales`). **Corregidos los DOS lugares donde el limite falso estaba escrito:**
el docblock de `confirm-dialog.tsx` y el item 12 de la spec 0063. Es el patron de la 0057, y esta vez el limite lo
habia declarado el ORQUESTADOR.

**(3) LOS 5 GATES, CORRIDOS SOBRE LOS BYTES ACTUALES (no heredados):** `test` con integracion **127 archivos / 917
tests / 0 failed / 0 skipped** (venia de 126/916: **+1 archivo, +1 test**, ninguno perdido) · `typecheck --force` 3/3
`0 cached` · `lint` `EXIT=0` · `format:check` «All matched files use Prettier code style!» · `build --force` 3/3
`0 cached`.

**Barrido de tamaños al HOOK sobre TODO el alcance (` M` **y** `??`, 17 archivos), con control que discrimina
(`onboarding/page.tsx` → `EXIT=2`):** todos `EXIT=0`. **Dos clavados en 300 exactas —`billing-offers.test.ts` y
`billing-store.neon.integration.test.ts`—: lo proximo que se les sume necesita el corte decidido ANTES.**
(`billing-reconcile-page.neon…` ya no esta en el limite: quedo en 214 tras el corte.)

**Hashes al cierre de la sesion A:** `page.tsx 963efe9c` · `subscription-console 82388cbb` · `settle-free eeaa9e0c` ·
`pages.neon` **`abc751a0`** (CAMBIO: trae el `structuredClone`) · `support d48533a3` · `confirm-dialog`
**`553dec19`** (CAMBIO: el docblock corregido) · `confirm-dialog-focus.test.ts` **`79473252`** (NUEVO).

### FASE D2 IMPLEMENTADA — LOS 5 GATES CORRIDOS POR EL ORQUESTADOR (2026-09-12), NO RELATADOS

- **`test` con integracion: 124 archivos / 910 tests / 0 failed / 0 skipped.** Venia de 121/872 al cierre de la D1:
  **+3 archivos, +38 tests, ningun preexistente perdido.** **Y el 910 es exactamente el numero que el implementador
  habia PREDICHO para el gate que no pudo correr: reprodujo.**
- **`typecheck --force`: 3/3, `cache bypass, force executing`, `0 cached`.** `lint` y `format:check` verdes.
  **`build --force`: 3/3, `0 cached`.**
- **El cuelgue de la 7a muerte esta CERRADO, y el oraculo no es una lectura del codigo: es que la suite pasa CON las
  env de integracion y `0 skipped`** — o sea que `billing-pages.neon.integration.test.ts` corre de verdad (antes: >12
  min sin una linea de salida).
- **Tamaños al hook, con control que discrimina (`onboarding/page.tsx` → `EXIT=2`):** los 11 archivos en `EXIT=0`.
  **DOS EN 300 EXACTAS, CERO MARGEN: `billing-reconcile-page.neon…` y `billing-offers.test.ts`** — la mina recurrente
  de esta spec. Lo proximo que se les sume necesita corte decidido ANTES.
- **Un numero que el orquestador leyo mal y aca queda corregido:** reporto el build como «0 cache miss» creyendo que
  habia replayado de cache. Era el **grep equivocado**: con `--force` turbo no dice `cache miss` sino
  **`cache bypass, force executing`**. El build si compilo. El error era del medidor, no del gate.

### LO QUE EL IMPLEMENTADOR REPORTA Y EL ORQUESTADOR NO VERIFICO TODAVIA — VA AL REVISOR

**11 mutaciones ejecutadas, y TRES SALIERON VERDES: invariantes que el mismo habia declarado en docblocks.** Las tres
cerradas, segun su handoff:
- **S7, LA FUGA, y es el hallazgo de la fase:** la pagina bajando la **fila cruda** dejaba **66/66 VERDE**.
  **`renderToStaticMarkup` NO emite el payload RSC**, asi que las props de un componente CLIENTE nunca llegan al
  markup: su test pinneaba «la consola no IMPRIME las claves», no «la pagina no las PASA». **Es el hueco de
  `choosePushPromptView` otra vez —la decision pinneada, el cableado no— y el render que la spec exigia justo para
  cerrarlo resulto ser un PROXY de la propiedad.** Cerrado inspeccionando las props del elemento; re-ejecutada da 1
  rojo con asercion literal. **ESTO ES LO PRIMERO QUE TIENE QUE AUDITAR EL REVISOR.**
- **S8** (allow-list del `?done=`): verde → cerrado, y **muerde por la forma ESCAPADA** (`&lt;script`), asi que la
  asercion ingenua no habria disparado.
- **S11** (`BLOCK_FALLBACK`): verde → cerrado.
- **S9 queda VERDE y DECLARADO** (la lectura de la pagina sin lock; el bloqueo duro es el 409 de la ruta, que ya tiene
  oraculo). **Un limite declarado: el revisor lo verifica intentandolo.**

**LA HIPOTESIS DEL ORQUESTADOR SOBRE EL CUELGUE ERA FALSA, y el implementador la FALSIFICO con un oraculo.** No era
auto-deadlock de `FOR UPDATE`: era un **ciclo de imports por la factory del `vi.mock`** (factory →
`billing-pages-support` → la pagina → `auth-guards`, factory sin terminar). **Lo probo con `vitest list`, que solo
COLECTA y tambien colgaba** — eso descarta cualquier causa de ejecucion. **>12 min → 1,46 s** con un solo cambio. Se
le habia pasado explicitamente marcada como hipotesis y no como diagnostico, y por eso se testeo en vez de creerse.

**HALLAZGO DE PROCESO QUE EL IMPLEMENTADOR SE AUTO-REPORTO, pudiendo esconderlo:** muto `cancel-dialog.tsx`
(**untracked**) **sin copia limpia previa** y encima corrio un **`git checkout` pelado**. Se recupero solo porque era un
edit de 2 lineas escrito en esa sesion. Es textualmente el modo de falla de `CLAUDE.md`. Recien despues saco copias de
los 7 archivos (`/tmp/limpio2-*`).

**FOCOS PARA EL REVISOR:** (1) **S7 y si el fix cierra la propiedad o sigue siendo proxy** — la pregunta es «¿el
usuario recibe las claves?», no «¿el markup las imprime?»; (2) las **dos salidas** del estado «`plus` con la
suscripcion muerta» juntas (D8 + boton de D10), que ningun revisor vio; (3) el **limite S9** declarado; (4) los
**dos archivos en 300 exactas**; (5) **mutaciones FUERA de la tabla** — en las fases B, C y D1 ahi estuvo todo el
valor, y en la D2 ya aparecieron 3 de 3 huecos asi.

### INCIDENTE DE ENTORNO, NO DE CODIGO: EL DISCO SE LLENO AL 100% Y TODO ROJO ERA MENTIRA

**Los 124 archivos «FAIL» en 2,29 s sin correr un solo test eran `ENOSPC: no space left on device`.** Bloqueo tambien
al implementador y **al propio harness**: cada llamada de Bash necesita escribir su archivo de salida antes de ejecutar,
asi que **fallaba hasta `df`**. Es el rojo por el motivo equivocado en su forma mas total — 124 rojos que no hablan del
codigo.

**Causa medida: 8.382 directorios temporales de vite/vitest ABANDONADOS** en el `T` del sistema (~1 MB cada uno,
~9 GB), escombro de las corridas que se colgaron. **Se purgaron 7.901 (los de mas de 30 min, para no pisar una corrida
viva de otra sesion): 143 MB → 8.726 MB libres.** **NO se toco `.turbo`** (16 GB, gitignoreado, verificado con
`git check-ignore`) ni `.pnpm-store`: no hizo falta, y borrar 16 GB en la maquina del owner no estaba en ningun
encargo.

**REGLA OPERATIVA QUE SALE DE ACA:** un cuelgue de vitest no es gratis — **deja ~1 MB de basura por corrida en el temp
del sistema**, y esta spec colgo muchas veces. Si aparecen rojos masivos y absurdos (todos los archivos, en segundos,
«no tests»), **mirar `df -k /` ANTES de leer una sola asercion.**

### 6a MUERTE DE LA SPEC (1a de la D2), 2026-09-12. El arbol quedo SANO y el log a disco lo salvo

**Auditoria del orquestador, con comandos, no relatada por el agente:**
- `grep -rn MUTATION apps/merchant/src` **vacio**: no dejo ninguna mutacion puesta.
- **`/tmp/barrido-d2.md` SOBREVIVIO** — la regla de escribir cada fila a disco apenas se termina, cobrada por
  segunda vez en esta spec. De ahi salio el estado exacto sin reconstruir nada del arbol.
- **`pnpm run typecheck` tiene EXACTAMENTE UN ROJO Y NO ES UN BUG:**
  `subscription/page.tsx(19,37): error TS2307: Cannot find module './subscription-console'` — el archivo que faltaba
  escribir. Diagnostico leyendo la asercion, no adivinando.
- **Tamaños al hook** (con control `onboarding/page.tsx` → `EXIT=2`, o sea que discrimina): `billing/view.ts` **257**,
  `subscription/page.tsx` **196**, `billing-store.neon.integration.test.ts` **300** — los tres `EXIT=0`.

**YA ESTA (verificado, no relatado):** el **residual R2 CERRADO** — los 24 literales fijos de
`billing-store.neon.integration.test.ts` derivados a `subId(tag)`/`custId(tag)`. **El diff no toca ninguna propiedad:**
la unica linea de `expect` que cambio es `toBe("cus_conservado")` → `toBe(custId("conservado"))`, el mismo hecho con
literal derivado. Y `subscriptionOffers` en `billing/view.ts` (la tabla de 12 filas de D7 como funcion pura, la leccion
de `choosePushPromptView` aplicada) + el barrel + `subscription/page.tsx` con D8 cableado.

### 7a MUERTE DE LA SPEC (2a de la D2), 2026-09-12. **TODO EL CODIGO DE LA D2 ESTA ESCRITO; FALTA LA EVIDENCIA**

**Arbol SANO** (`grep MUTATION` vacio) y `/tmp/barrido-d2.md` sobrevivio otra vez. **Ya esta escrito:** las 3 paginas
de `subscription/`, la home con la tarjeta, el onboarding ([R2-I8], **469 antes y 469 despues**, medido al hook las dos
veces: violacion PREEXISTENTE sin crecer), `billing-offers.test.ts` (20 verdes) y
`billing-pages.neon.integration.test.ts` + su support. **`confirm-dialog.tsx` ENSANCHADO** (`description` →
`ReactNode` + `confirmDisabled?`) en vez de una 2a copia de la trampa de foco: los 7 consumidores pasan strings y
`typecheck` queda verde sin tocar ninguno. Ratificado por el orquestador.

**BLOQUEANTE MEDIDO POR EL ORQUESTADOR, y es lo unico que importa ahora: `billing-pages.neon.integration.test.ts` SE
CUELGA INDEFINIDAMENTE.** Lo escribio (279 lineas) y **nunca lo corrio**.
- **>12 minutos sin UNA SOLA linea de salida**, proceso node al **0,0% de CPU** (bloqueado en I/O). Dos corridas, igual.
- **CONTROL que lo convierte en hallazgo y no en sospecha: `billing-store.neon.integration.test.ts`, MISMA invocacion,
  corre en 16s y da 5/5 VERDE.** O sea: el metodo esta bien, **cuelga ESE archivo**. (Y de paso ese control confirma
  el fix del residual R2.)
- **La rama efimera NO quedo envenenada:** `pg_stat_activity` sin transacciones colgadas ni esperas de lock.
- **Los `60_000` de sus `it` NO salvan:** el cuelgue no llega a disparar el timeout del test.
- **Amenaza a CI (spec 0062 corre estos archivos alla): un archivo que cuelga no hace fallar CI, lo clava hasta el
  timeout del runner.** Es peor que un rojo: un rojo dice que propiedad se rompio, un cuelgue sin salida no dice nada
  y es indistinguible de «es lento».
- **HIPOTESIS, NO DIAGNOSTICO** (no se señalo el codigo que lo produce, asi que no vale como causa): auto-deadlock de
  lock — la pagina toma `lockBusiness` (`FOR UPDATE`) dos veces. Es la familia de la S7 de la D1, que se cerro con
  `FOR UPDATE NOWAIT` (`55P03`) para que el timeout se vuelva una asercion que nombra la propiedad.

**OPERATORIA DE CORRIDA, aprendida hoy a los golpes:** `pnpm --filter … exec vitest` **se cuelga en su deps-check** (10+
min sin lanzar nada). Lo que funciona: desde `apps/merchant`, `set -a; . ../../.env.integration.local; set +a` y despues
`node ../../node_modules/vitest/vitest.mjs run <path>`. **`--reporter=basic` NO existe en vitest 4** y hace fallar la
corrida por la flag, no por el test. En macOS no hay `timeout`.

**FALTA:** cerrar el cuelgue (con el archivo CORRIENDO como oraculo, no «deberia andar»), las mutaciones **S1-S8**
(en curso, ver abajo) y el resto del barrido.

### PUNTO DE RETORNO DE LAS MUTACIONES EN VUELO (2026-09-12) — leelo ANTES de tocar `billing/view.ts`

El implementador esta corriendo S1-S8 **una por una y bien ETIQUETADAS**. El orquestador lo verifico en vivo: vio
`// MUTATION S1 (implementador)` y despues `// MUTATION S2 (implementador)` en `billing/view.ts`, con **2 rojos en
`billing-offers.test.ts`** que **se leen como un bug del producto** («un `past_due` con baja programada pierde el
aviso de cobro») y **no lo son**: son el oraculo de S1 mordiendo. **La convencion de etiquetar funciono: sin la
etiqueta, esos dos rojos se perseguian como bug.** No se reventaron — `CLAUDE.md` es explicito: una mutacion de un
subagente que **todavia esta midiendo** no se corta, porque lo hace transcribir un resultado falso.

**EL AGUJERO QUE HABIA, Y QUE EL ORQUESTADOR CERRO:** `billing/view.ts` esta **` M` (trackeado Y MODIFICADO)** y **no
habia ninguna copia limpia en `/tmp`**. Es el peor caso de los tres que `CLAUDE.md` enumera: ahi el `git checkout` de
emergencia **si hace algo, y es lo peor que puede hacer** — se lleva tambien las **124 lineas** no commiteadas de
`subscriptionOffers`, y **se ve como si hubiera funcionado**.

**RESTAURACION, si aparece una mutacion abandonada en `billing/view.ts`:**

```
cp /tmp/view-LIMPIO-d2.ts apps/merchant/src/server/billing/view.ts
shasum apps/merchant/src/server/billing/view.ts   # tiene que dar e64fa56b...
```

**NO uses `git checkout` sobre ese archivo.** Y antes de restaurar, `diff` contra la copia y mira que lo unico que se
vaya sea la mutacion.

- **Copia limpia: `/tmp/view-LIMPIO-d2.ts`** — `shasum` **`e64fa56babc1935d840a27332d5f58a66ef21427`**, **260 lineas**.
- **Tomada en una ventana sin mutaciones y VERIFICADA SEMANTICAMENTE, no solo por ausencia de la etiqueta:** las
  guardas en el orden correcto (`PAYMENT_PENDING_STATUS` en la 229 **antes** de `scheduled` en la 232, o sea S1 bien
  revertida) y el guard de status muerto presente (`!DEAD_STRIPE_STATUS.has` en la 256, o sea sin S2). Hash re-medido
  en el momento de escribir esta linea.
- **Un hash que el orquestador etiqueto mal y aca queda corregido:** `e64fa56b…` se anoto primero como «mutado» y es
  el **LIMPIO** (el agente habia revertido S1 entre el `grep` y el `shasum`). El mutado con S2 era `c9f13745…`. Se
  corrige porque **un baseline podrido no falla ruidoso**: la proxima sesion corre la auditoria, ve el mismatch y
  concluye «alguien dejo una mutacion puesta» — el sintoma exacto que la auditoria existe para descartar, fabricado
  por el propio doc.

**TRAS RETOMARLO — cerrado y verificado por el orquestador, no relatado:** `subscription-console.tsx` aterrizo y con eso
**`typecheck` volvio a VERDE** (el `TS2307` era el archivo que faltaba, no un bug), y el **hallazgo del docblock falso
esta cerrado**: `server/billing-offers.test.ts` **CREADO** con las 12 filas de D7 + precedencia + anti-degeneracion
(**20 tests verdes**), y el docblock de `subscriptionOffers` ahora apunta ahi. **Los 3 gates del Stop hook (`typecheck`,
`lint`, `test`) corridos por el orquestador: `EXIT=0`.**

**CORTE DE ARCHIVO RATIFICADO POR EL ORQUESTADOR (no estaba en el encargo, y el implementador lo trajo a ratificar en vez
de decidirlo solo — que es lo correcto):** el oraculo de `subscriptionOffers` NO entra en `billing-view.test.ts`. **El
numero se verifico, no se acepto:** 230 + 161 menos el preambulo que se colapsaria da **~381** contra el limite de 300,
asi que la conclusion se sostiene con margen (el implementador reporto 370; el exacto depende de cuanto preambulo se
funde y no cambia la decision). Sibling, patron que esta spec ya uso 12 veces.

**UNA MINA PUESTA, la de siempre en esta spec:** `subscription-console.tsx` quedo en **271** (hook `EXIT=0`) y todavia
falta cablear el modal. **Quedan 29 lineas de margen; si las pasa, el corte lo decide el orquestador ANTES.**

**LO QUE EL HOOK `verify.sh` NO PUEDE VER, y el orquestador si:** bloqueo el fin de un turno por el `typecheck` rojo
mientras el subagente **estaba escribiendo ese mismo archivo**. Es el caso analogo al que `CLAUDE.md` ya documenta para
`no-mutations-left.sh`: **el hook no distingue «trabajo vivo» de «trabajo abandonado», y el orquestador si.** Escribir
`subscription-console.tsx` a mano habria puesto dos escritores sobre un archivo y le habria hecho transcribir un
resultado falso al agente. **Lo correcto fue esperar** (el rojo se cerro solo a los 210s, cuando el agente aterrizo el
archivo), no satisfacer al hook pisando trabajo en vuelo.

**EL HALLAZGO DE LA AUDITORIA, y es la familia de la D1 otra vez: `subscriptionOffers` afirma en su docblock «ES
NORMATIVO, y cada fila tiene su caso en `billing-view.test.ts`» — y `billing-view.test.ts` esta BYTE A BYTE IGUAL AL
BASELINE (`ec73641c…`).** O sea: codigo de produccion con CERO tests y una frase prometiendo lo contrario — «el estado
mas peligroso posible» de la fase B, con el agravante que `CLAUDE.md` documenta: **un docblock mentiroso no es pasivo,
INDUCE errores de metodo.** Despachado al implementador retomado con prioridad sobre el JSX que le faltaba.

**Gates RE-MEDIDOS en el handoff (2026-09-12), no copiados:** `typecheck` y `build` forzados (`0 cached`), `lint` y
`format:check` verdes; `pnpm test` con `.env.integration.local` → **121 archivos / 872 tests / 0 failed / 0 skipped**.

**LO QUE FALTA DE LA D2:** `backoffice/subscription/{page,subscription-console,cancel-dialog}` (ninguno existe, ya
verificado), **D8** (reconciliacion al abrir la pagina — `reconcileFromStripe` ya existe en `billing/store.ts` desde la
fase B, lo que falta es el CABLEADO), `backoffice/page.tsx` (tarjeta + `realModules` + presentacion de
`none`/`canceled`), `onboarding/page.tsx` ([R2-I8], hoy todavia manda `businessId` en el body y no manda `from`) y el
**render del HTML** con `renderToStaticMarkup` (`billing-view.test.ts` pinnea el DTO y las dos allow-lists, pero **no
tiene render**: verificado).

**UN ITEM DE ESTA LISTA ESTABA SALDADO Y LA LISTA LO NEGABA — es la regla de `CLAUDE.md` sobre residuales heredados,
cobrada sobre este mismo archivo.** Decia que faltaba `backoffice/locations/page.tsx` (tope efectivo) y **ya usa
`effectiveLocationLimit(row?.plan, row?.pendingPlan)` desde la fase A** (`git log -1 --` sobre el archivo → `6921c94`).
Lo cazo el orquestador al preparar el encargo de la D2, chequeando la lista con `grep` en vez de despacharla. **Y por
eso se re-verificaron los cinco hermanos uno por uno** —los tres archivos de `subscription/` no existen, D8 no esta
cableado, el render no existe, el onboarding sigue mandando `businessId`— que es exactamente lo que la regla pide: si un
item de una nota vieja resulto obsoleto, sus hermanos son sospechosos.

**EL ENCARGO DE LA D2 ESTA EN `docs/encargo-fase-d2.md`** (whitelist de archivos, corte de archivos ya decidido por el
orquestador, protocolo de mutaciones, gates y el handoff exigido). **DESPACHADO a un implementador el 2026-09-12.**

**TRES COSAS QUE EL ENCARGO DE LA D2 TIENE QUE LLEVAR, y las tres se ganaron caro en la D1:**
1. **El barrido de docblocks va DESDE EL INICIO, no al final.** En la D1, cuatro rondas de revision encontraron **un**
   bloqueante cada una —los cuatro de la misma familia— y despues **un barrido sistematico encontro NUEVE en una
   pasada**. Ya es regla en `CLAUDE.md`.
2. **El revisor de la D2 tiene que vigilar LAS DOS SALIDAS** del estado «`plus` con la suscripcion muerta»: la spec dice
   que cuelga de «D8 **o** el boton de D10», **D10 quedo en la D1 y D8 va en la D2, asi que ningun revisor las vio
   juntas.**
3. **Verificar que la D1 no rompio el onboarding** — `checkout` ahora ignora el `businessId` del body y usa
   `ownerContext`. En teoria coincide porque el onboarding rechaza un segundo negocio por usuario, **pero eso es un
   razonamiento, no una medicion**: va con oraculo.

**RESIDUALES DE LA D1 (menores del revisor, ninguno bloqueante):** un `it` que carga **cuatro** oraculos y cuyo titulo
nombra uno (la atribucion existe en el archivo; **en CI solo se ve el titulo**), y
**`billing-store.neon.integration.test.ts` de la fase B con 24 lineas de literales FIJOS** — el mismo modo de falla que
en la D1 envenveno la rama efimera y dejo la suite muriendo **en el seed**, indistinguible de un bug.

**PENDIENTE DEL OWNER, sin bloquear:** ~32 negocios huerfanos en la rama efimera de corridas abortadas (no bloquean;
borrarlos es borrado en una base y la decision es suya), y el chequeo en Stripe de que al agotar los reintentos de cobro
la suscripcion quede en **`unpaid`** y no cancelada — sin eso el ADR 0059 no se cumple.

## FASE D — DESPACHADA EN DOS ENCARGOS SERIALES (decision del ORQUESTADOR, no del owner)

**D1 (servidor) DESPACHADA a un implementador el 2026-09-11.** D2 (UI) todavia no: depende de que las rutas existan.

### EL IMPLEMENTADOR DE LA D1 MURIO A MITAD (3a muerte de la spec) y se lo RETOMO desde su transcripcion

**Nada se perdio y el arbol quedo SANO. Esto lo verifico el orquestador con comandos, no lo relato el agente:**
- `grep -rn MUTATION apps/merchant/src` **vacio** y los 3 `shasum` del baseline de la fase C **identicos**.
- `typecheck` (forzado, `0 cached`), `lint` y `build` (forzado) **verdes**.
- `pnpm test` con `.env.integration.local`: **113 archivos / 827 tests / 0 failed / 0 skipped**, **identico al cierre
  de la fase C** — o sea que mudar el doble de Stripe a `billing-stripe-fake.ts` **no perdio ni un test preexistente**,
  que era el riesgo principal de ese refactor.
- **El build EMITE las dos rutas nuevas** (`/api/billing/cancel`, `/api/billing/settle-free`) y el validador generado
  de Next las acepta. Importa porque `settle-free` es `export const POST = downgradeToFree` importado de
  `../cancel/route`, y un export extra en un `route.ts` es justo lo que Next rechaza: **verificado en
  `.next/types/validator.ts` y en `app-paths-manifest.json`, no leyendo codigo.**
- **Lo unico ROJO: `format:check`** sobre `billing-integration-support.ts`.

**ESTADO PELIGROSO, dicho sin maquillaje: hay codigo de produccion con CERO tests y los gates en verde.** Es
textualmente lo que la fase B llamo «el estado mas peligroso posible». Lo que aterrizo: `billing-stripe-fake.ts`,
`billing-integration-support.ts` (refactorizado a 151 con reexports), `_auth.ts`, `cancel/route.ts`,
`settle-free/route.ts`. **Lo que falta es la mayor parte del encargo:** `resume`, `interval`, **la edicion de
`checkout`** (sigue siendo el de prod: lee `businessId` del body y usa `new URL(request.url).origin`, asi que los DoD
de `MERCHANT_PUBLIC_ORIGIN` y «ninguna ruta actua sobre un negocio nombrado en el body» estan ABIERTOS y M6 no tiene
contra que morder), los 3 archivos de test, la edicion de `locations-races`, y **las 5 mutaciones (M5, M6, M14, M17 y
re-ejecutar M1), ninguna corrida todavia**.

**UNA MINA PUESTA, que es la de la fase C otra vez:** `billing-stripe-fake.ts` quedo en **299/300** medido **con el
hook y post-prettier**. Una linea de margen. Lo proximo que se le sume lo pasa; el corte lo decide el orquestador.

### 2a MUERTE DEL MISMO IMPLEMENTADOR (4a de la spec). Retomado otra vez; el arbol quedo sano y AVANZO MUCHO

**Auditoria del orquestador, con comandos:** `grep MUTATION` **vacio**, los 3 `shasum` del baseline **identicos**,
`typecheck` (forzado, `0 cached`) y `lint` **verdes**, y `pnpm test` con integracion en **115 archivos / 852 tests / 0
failed / 0 skipped** — venia de 113/827, o sea **+2 archivos y +25 tests sin perder ningun preexistente**.

**Ya estan las CINCO rutas** (`_auth.ts`, `checkout` editada, `cancel`, `resume`, `interval`, `settle-free`), el barrel,
`billing-routes.test.ts` (18 tests, con el barrido del filesystem y su piso de archivos) y
`billing.neon.integration.test.ts` (7 tests).

**BLOQUEANTE DE TAMAÑO, y es EL DE LA FASE C REPETIDO: `billing.neon.integration.test.ts` esta en 303 y YA VIOLA el
limite.** Preguntado **al hook**, no a `wc`: `EXIT=2`, con control sobre `billing-routes.test.ts` (294, `EXIT=0`) que
prueba que discrimina. Los 5 gates no lo cazan porque `file-size` es **PostToolUse, no Stop**. **Corte decidido por el
orquestador y por NATURALEZA, no por tamaño:** los dos tests de `interval` salen a
`billing-interval.neon.integration.test.ts` — D9 es su propia seccion de diseño, con sus propios modos de falla, y es
**el unico consumidor de `updateError`/`updateParams` del fake**.

**El otro rojo:** `format:check` sobre `interval/route.ts`.

**LOS DOS ROJOS YA ESTAN CERRADOS (verificado por el orquestador, arbol en vuelo):** el corte se aplico
—`billing.neon.integration.test.ts` **303 → 251** y `billing-interval.neon.integration.test.ts` **137**, los dos
preguntados **al hook** y **post-prettier**, `EXIT=0`— y `format:check` esta **verde**. Falta confirmar con la suite
que la mudanza no perdio ningun test: tiene que dar **116 archivos / 852 tests**, no menos.

**LO QUE FALTA, y es donde esta el valor:** `billing-routes-auth.neon.integration.test.ts` (staff activo y
desactivado x 5 rutas con **sesiones reales**), la edicion de `locations-races` (las dos carreras), **las 5 mutaciones
—M5, M6, M14, M17 y re-ejecutar M1—, NINGUNA corrida todavia**, y la seccion «Decisiones del IMPLEMENTADOR de la fase
D1» en la spec. **Sin las mutaciones no hay evidencia de que nada de lo escrito tenga oraculo.**

**M1 es la que mas importa:** en fase A dio 3 rojos en `locations.test.ts` pero su mitad de concurrencia quedo verde
porque la carrera **no existia** — la escribe esta fase. **Si con M1 puesta la carrera nueva sigue verde, es un
hallazgo**, no un detalle: querria decir que no pinnea lo que su nombre dice.

### 3a MUERTE DEL MISMO IMPLEMENTADOR (5a de la spec), Y ESTA VEZ MURIO CON UNA MUTACION PUESTA

**`billing/store.ts` aparecio modificado — y era la mutacion M14.** La cazo `grep -rn MUTATION` en el acto **porque
estaba bien ETIQUETADA** (`// MUTATION M14 — el stripe_subscription_id NO se limpia.`). Es exactamente el escenario de
la spec 0055 que `CLAUDE.md` documenta: sin la etiqueta, esos 4 rojos se leian como un bug real del producto («el
`settle-free` no limpia el id»). **La convencion funciono.**

**M14 — EJECUTADA por el ORQUESTADOR (2026-09-11), no predicha: CONFIRMADA y MAS AMPLIA que la hipotesis. 4 rojos en 3
archivos**, corrida contra **los 7 archivos que pueden verla**:
- `billing-store.test.ts` → **2 rojos**: `escribe las 7 columnas de la spec y NO stripe_customer_id` →
  `expected [ 'downgradeRequestedAt', …(6) ] to deeply equal [ 'downgradeRequestedAt', …(7) ]`; y `limpia el id de
  Stripe y el intervalo, y deja free / active`.
- `billing-store.neon.integration.test.ts` → **1 rojo**: `settleToFree escribe el SET de D10 y CONSERVA el customer` →
  **`expected 'sub_muerta' to be null`**, literalmente el id que no se limpio.
- `billing.neon.integration.test.ts` → **1 rojo**: el test de D10.
- **LA HIPOTESIS ATRIBUIA MAL:** decia «desde `none`, despues de bajar a free, `checkout` procede». El test que nombra
  si se pone rojo, **pero falla en la comparacion del `SET`, ANTES de llegar al paso del `checkout`** — el oraculo que
  muerde es el **conjunto exacto de claves**, que es justo lo que la spec dice que es load-bearing porque la propiedad
  de D10 es una **AUSENCIA**.
- **Revertida con `shasum` verificado:** `9038c1a7…` (mutada) → `73902c5dbe9a0edf300c81131011ab5470aeeaa2` (identica al
  blob de git). `grep MUTATION` vacio.

**EL ROJO QUE DEJO NO ES UN BUG — ES UN `23505` POR LITERALES COMPARTIDOS, y es la trampa que `CLAUDE.md` ya documenta
en OTRA columna.** La suite completa da **117 archivos / 860 tests con 1 rojo** en `locations-races`. Diagnostico
hecho **leyendo la asercion**, no adivinando:
- **Aislado el archivo pasa 4/4**; en la suite falla. **Y falla en un test DISTINTO segun la corrida** (suite completa:
  `a cancel concurrent with the webhook`; 7 archivos juntos: `eight simultaneous reactivations`). **Esa
  no-determinacion es la firma de una colision, no de un bug.**
- Muere en el **seed** (`locations-integration-support.ts:58`), o sea en el setup y **antes de cualquier asercion de
  comportamiento**: `duplicate key value violates unique constraint "core_subscription_customer_unique"`,
  `Key (stripe_customer_id)=(cus_race) already exists.`
- **El par exacto:** `billing-webhook.neon.integration.test.ts:213` (fase B, con PASS) y
  `locations-races.neon.integration.test.ts:191` usan **los mismos literales `cus_race`/`sub_race`**, y el unique es
  **GLOBAL** (`schema/business.ts:250`). Vitest paraleliza archivos. Se arregla en el archivo NUEVO, no en el que tiene
  PASS, y **se verifica con la suite completa**: aislado ya pasaba.
- **Consecuencia que importa: la carrera de los 8 desarchivados nunca corrio limpia dentro de la suite**, asi que el
  verde aislado no vale hasta que la suite entera este verde.

**Estado del arbol ya revertido, verificado por el orquestador:** `typecheck` (forzado, `0 cached`), `lint` y
`format:check` **verdes**; los 3 `shasum` del baseline **identicos**; `grep MUTATION` **vacio**. Ya estan
`billing-routes-auth.neon.integration.test.ts` (5 tests, incluye `owner DESACTIVADO` — mas de lo que pedia el DoD) y
`locations-races` extendido a 4 tests.

**FALTA:** el `23505`, **M5 / M6 / M17 y re-ejecutar M1** (M14 ya esta hecha), la seccion «Decisiones del IMPLEMENTADOR
de la fase D1» en la spec (**verificado con `grep`: todavia no existe**) y el handoff.

### EL `23505` ESTA CERRADO — Y APARECIO ALGO PEOR: LA SUITE DE INTEGRACION SE VOLVIO FLAKY

**El arreglo del `23505` entro bien:** `locations-races` ya deriva sus literales (`cus_${tag}`/`sub_${tag}`) y
**NO se toco** el archivo de la fase B que tiene PASS. Correcto.

**Pero la suite completa NO esta verde de forma estable, y NO es un bug ni una regresion.** Evidencia, toda de
corridas propias del orquestador:
- **Tres corridas seguidas de `pnpm run test` fallaron en TRES CONJUNTOS DISTINTOS de archivos:** (1) `locations-races`;
  (2) `billing-webhook-claim` + `billing-webhook-writes` (fases C y B, **con PASS**); (3) `counter-redeem` +
  `counter-redeem-surfaces` (**spec 0055 — esta fase no los toco ni de cerca**).
- **La causa no es una asercion: es `NeonDbError: Error connecting to database: TypeError: fetch failed`.**
- **Aislados pasan todos.** Corridos los 4 sospechosos juntos: **4 archivos / 19 tests, 19/19 verdes.**
- `grep MUTATION` **vacio** y los `shasum` del baseline **identicos** en el momento de cada corrida: no hay mutacion
  puesta que lo explique.

**Lectura:** la rama efimera de Neon se satura con la suite completa. Esta fase sumo **3 archivos de integracion
nuevos** (`billing.neon`, `billing-routes-auth.neon`, `billing-interval.neon`) **y dos tests de concurrencia que
disparan 8 requests simultaneos**, y eso volteo el equilibrio. *(Lo que esta MEDIDO es la lista de sintomas de arriba;
que la causa raiz sea saturacion y no una intermitencia de Neon es la lectura mas probable, no algo verificado —
cerrarlo pide correr la suite con concurrencia limitada y comparar.)*

**POR QUE ESTO IMPORTA MAS QUE EL BUG QUE NO ERA:**
1. **Un oraculo flaky es PEOR que ninguno.** Un rojo intermitente se le atribuye a lo ultimo que alguien toco — es
   exactamente el modo de falla que todo `CLAUDE.md` existe para prevenir, ahora del lado de la infraestructura.
2. **Un VERDE tampoco prueba nada mientras dure esto**: la proxima corrida puede estar verde por suerte, y un handoff
   que reporte «5 gates verdes» sin decir esto estaria afirmando exito sobre una señal que no es estable.
3. **Amenaza a CI**: la spec 0062 corre estos archivos en CI. Si la saturacion es la causa, CI va a empezar a fallar
   por motivos que no son del codigo — y ahi el default de quien mire es perseguir un bug que no existe.

**NO se arregla dentro de esta fase sin decidirlo**: acotar la concurrencia de vitest para los `.neon.integration`, o
serializarlos, es una decision que toca al harness de tests de todo el repo (y a la spec 0062). **Queda como hallazgo
para el owner**, y mientras tanto la regla operativa es: **un rojo de integracion se re-corre AISLADO antes de
creerle**, y el handoff de la D1 tiene que declarar esto explicitamente en vez de reportar un verde de una sola
corrida.

### FASE D1 IMPLEMENTADA Y EN REVISION INDEPENDIENTE (2026-09-11). SIN PASS: nada commiteado, nada desplegado

**El implementador entrego tras 3 muertes.** Lo de abajo **NO es su relato: son las corridas del orquestador.**

- `grep MUTATION` **vacio**; los 3 `shasum` del baseline de la fase C **identicos**; **`locations/core.ts` y `store.ts`
  identicos a git**, o sea que M1 y M14 quedaron bien revertidas.
- **Tamaños PREGUNTADOS AL HOOK** (no `wc`), con control que discrimina: `billing-stripe-fake.ts` **299** `EXIT=0`,
  `billing.neon.integration.test.ts` **299** `EXIT=0`, `billing-routes.test.ts` 294, `locations-races` 288, `_auth.ts`
  237. **Coinciden con lo declarado** — por primera vez en esta spec un tamaño reportado reprodujo.
  **Pero dos archivos quedan a UNA linea del limite: lo proximo que se les sume necesita corte decidido antes.**
- `typecheck` (forzado, `0 cached`), `lint`, `format:check`, `build` (forzado, `0 cached`): **los cuatro verdes**.
- `pnpm test` con integracion, **DOS corridas**: **117 archivos / 860 tests / 0 failed / 0 skipped** las dos (venia de
  113/827: **+4 archivos, +33 tests, ningun preexistente perdido**).

**LO MEJOR DEL HANDOFF, y conviene no perderlo: en M6 el implementador reporto que 5 de sus 8 rojos eran POR EL MOTIVO
EQUIVOCADO** (morian en `DATABASE_URL no esta configurada` y en `invalid input syntax for type uuid: ""`), y que el
oraculo real son 3 en `billing-routes-auth.neon…` con `checkout: expected 409 to be 403`. Es exactamente la regla de
`CLAUDE.md` aplicada por quien podria haberla escondido.

**DOS COSAS QUE EL ORQUESTADOR NO DA POR BUENAS Y QUE VAN AL REVISOR:**
1. **La suite es FLAKY y el verde puede ser suerte.** Antes del ultimo tramo hubo **tres corridas fallando en TRES
   conjuntos DISTINTOS** de archivos (incluidos dos de la spec 0055, que esta fase no toca) con
   `NeonDbError: fetch failed` —no una asercion— y todos verdes aislados. Ahora da 2/2 verde **pero los `fetch failed`
   SIGUEN EN LA SALIDA de la corrida verde**, absorbidos por reintentos. **No esta cerrado: esta tapado.** Amenaza a CI
   (spec 0062 corre estos archivos alla).
2. **UN NUMERO DEL HANDOFF NO REPRODUCE.** Declaro que tras limpiar la rama efimera «quedan **14 negocios** … **y 3 sin
   fila de suscripcion**». **Medido por SQL: 11 negocios y 11 filas de `core.subscription`** (9 `free/active` + 2
   `plus/active`), o sea **cero sin fila**. La parte sustantiva —la copia de prod sobrevivio— **si reproduce**, y los
   schemas estan intactos (core 23 tablas, consumer 10, merchant_auth 5). **Aviso honesto: yo medi DESPUES de dos
   corridas completas, asi que la rama se movio entre su medicion y la mia** — puede ser benigno. Lo re-mide el revisor.
   Y de paso: **borro 48 filas de una base por su cuenta**; que confirme que no se llevo nada real.

**Los otros cuatro focos que se le pidieron al revisor:** el **costo declarado** de `store.ts` (dice que la 6.a funcion
lo lleva a 314 y `EXIT=2` — esta spec ya tuvo dos bloqueantes por costos falsos); que el **test que se modifico para que
M6 mordiera** no haya aflojado el guard (¿queda un caso con `businessId` AJENO?); **`_auth.ts` con `decideUnderLock` y
`billingStateResponse` adentro** (un archivo llamado `_auth` que decide planes bajo lock miente sobre su contenido); y
**mutaciones fuera de la tabla** — en las fases B y C ahi estuvo todo el valor.

### EL REVISOR TAMBIEN MURIO, Y CON M5 PUESTA SOBRE UN ARCHIVO UNTRACKED (modo de fallo NUEVO)

**`grep MUTATION` la cazo** (`// MUTATION M5 (revisor)`) en `app/api/billing/cancel/route.ts`. **Pero ese archivo
todavia NO esta commiteado (`??`), asi que `git checkout` no revierte NADA: no hay blob.** Es el salvavidas que todo el
mundo asume y que sobre un untracked no existe.

**Se reconstruyo a mano y se VERIFICO contra un oraculo, no se adivino:** la mutacion habia reemplazado el paso 2 por
`const downgradeRequestedAt = now;`; el original es
`const { downgradeRequestedAt } = await scheduleDowngrade(tx, businessId, { now });`. **La reconstruccion da
`1fa5bbf9d80ee940d00c35d1655b462c99f9a911`, identico al `shasum` limpio que el implementador habia dejado en su
handoff** — byte a byte la original. Confirmado ademas por comportamiento: `billing.neon.integration.test.ts` **6/6
verdes**, incluidos los dos que M5 pone rojos.

**Sin ese numero en el handoff no habia oraculo** y el arbol quedaba con una mutacion indistinguible de codigo
legitimo. **Ya esta como regla en `CLAUDE.md`:** el `shasum` se registra ANTES de mutar y se escribe en el handoff,
sobre todo si el archivo es NUEVO; y antes de mutar se mira `git status --short`, porque si sale `??` conviene sacar
copia a `/tmp` primero. **En esta fase eso aplica a casi todo**: las 5 rutas, `_auth.ts`, `billing-stripe-fake.ts` y
los 4 archivos de test nuevos son untracked.

**Arbol tras el revert, verificado:** `grep MUTATION` vacio; `typecheck` (forzado, `0 cached`), `lint` y
`format:check` verdes; los 3 `shasum` del baseline identicos; `locations/core.ts` y `store.ts` identicos a git.

## FASE D1 (servidor): **PASS DEL REVISOR INDEPENDIENTE** (2026-09-12). COMMITEADA. Falta la D2

**NADA DESPLEGADO: no se pusheo y la migracion `0030` NO esta aplicada a prod**, solo a la rama efimera.

**Lo de abajo son corridas del ORQUESTADOR, no el PASS relatado** — un PASS tampoco se toma por bueno sin correr los
comandos:
- `grep MUTATION` **vacio**, sin sondas, los **6 hashes de rutas identicos** al baseline y el baseline de la fase C
  intacto.
- **Los 5 gates**: `typecheck` y `build` **forzados** (`0 cached`), `lint`, `format:check` → verdes. `pnpm test` con
  integracion: **121 archivos / 872 tests / 0 failed / 0 skipped** (la fase C cerro en 113/827: **+8 archivos, +45
  tests, ningun preexistente perdido**).
- **Tamaños RE-MEDIDOS al hook en el momento de escribir esto**, con control (`onboarding/page.tsx` → `EXIT=2`): los 17
  archivos en `EXIT=0`. **Sin margen: `billing-routes.test.ts` 300, `billing.neon…` 299, el fake 299.**

**El PASS cerro lo que el barrido abrio:** los **10 oraculos discriminan** —cada mutacion pone roja **1 de 47**, o sea
solo su propia propiedad— y ninguno es proxy. La evidencia completa, en `docs/re-revision-d1-fase-d1.md` y
`docs/barrido-d1-fase-d1.md`.

**LO QUE ESTA FASE DEJA COMO METODO, y es lo que hay que llevarse a la D2:** cuatro rondas de «un bloqueante por vez»
encontraron 4; **un barrido sistematico de los docblocks encontro 9 en una pasada**. La regla ya esta en `CLAUDE.md`.

### MENORES DECLARADOS POR EL REVISOR, ninguno bloqueante — RESIDUALES PARA LA D2

1. **Un `it` carga CUATRO oraculos y su titulo nombra uno.** El orquestador lo detecto leyendo el log del revisor y
   dijo tres; **el revisor lo verifico y eran cuatro** (S11 el orden, S12 la clave, B4 el `cancel_at` y **S13** las tres
   columnas). **Las cuatro estan pinneadas y cada asercion lleva su comentario nombrando su mutacion**, asi que la
   atribucion existe en el archivo: **lo que engaña es el TITULO, que es lo unico que se ve en CI.** Se cierra
   partiendolo en cuatro `it` o renombrandolo.
2. **`billing-store.neon.integration.test.ts` (fase B) conserva literales FIJOS** — verificado por el orquestador: **24
   lineas** con `sub_`/`cus_` a mano. El fix de raiz cubrio los 5 archivos de la D1; ese **no** consume `livePlusState`
   y **mantiene vivo el modo de falla que envenveno la rama**. Fuera del alcance de la D1; es el hermano del hallazgo
   que esta ronda cerro.
3. El docblock de produccion de `isDeterministicRejection`/`isCardError` **promete mas de lo que esas dos ramas
   compran**: bajo el escenario que invoca (un `instanceof` roto por otra copia del modulo) el error **igual traeria
   `type`**, asi que lo cubre la primera rama. Nada falso, pero la justificacion es mas ancha que el guard.
4. **Un limite declarado CON su intento, que es como corresponde:** la mitad entre-ARCHIVOS del aislamiento del sufijo
   no la ejercita nada. El revisor intento acotarlo y **desistio por una razon concreta**: la sonda exigia dejar dos
   `*.test.ts` bajo `src/`, donde la suite los corre — y el ya dejo una suelta una vez. **La mitad load-bearing (entre
   CORRIDAS) si la verifico empiricamente**: tras el timeout de S7m, `billing.neon` sola da **6/6 verde**, o sea que el
   modo de falla **desaparecio, no se mitigo**.

**LO QUE SIGUE: la FASE D2 (UI + D8 + D10 + render del HTML).** Y el aviso que la particion creo y sigue vigente: la
spec dice que la salida del estado «`plus` con la suscripcion muerta» cuelga de «**D8 o el boton de salida de D10**».
**D10 quedo en la D1 y D8 va en la D2, asi que ningun revisor las vio juntas: el de la D2 tiene que vigilar las DOS.**

**Y DESPUES del PASS de la D2, el orden de despliegue, al reves del reflejo natural:** migracion `0030` a prod **ANTES**
del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y los 11 negocios
pierden el modulo Locales; el `next build` NO lo caza porque esas paginas son `force-dynamic`), y **`MERCHANT_PUBLIC_ORIGIN`
seteada en Vercel** (Production y Preview) antes de pushear.

### LA RAMA EFIMERA ESTABA ENVENENADA. Limpiada por el orquestador, con el minimo necesario

**El S7 del revisor timeouteo, su `finally` no corrio y dejo filas huerfanas.** Medido por SQL: la rama tenia **43
negocios y 26 filas de `core.subscription`** contra los **11/11** de la copia de prod. **Desde entonces
`billing.neon.integration.test.ts` moria EN EL SEED con el arbol byte a byte limpio** — el sintoma exacto que la
convencion de literales unicos existe para evitar, y **indistinguible de un bug de codigo**.

**Se borraron SOLO 3 filas** —las de literales **FIJOS** (`cus_ciclo`, `cus_orden`, `cus_determinista`), las unicas que
**chocan** contra el unique global— y **se verifico que la copia de prod quedo intacta** (14/14 antes y despues). Las
demas huerfanas tienen literal aleatorio: son basura, **no bloquean**, y se dejaron. **Oraculo del arreglo, no
supuesto: `billing.neon…` vuelve a dar 6/6 VERDE.**

**CAUSA RAIZ, y es del implementador contra su propia regla:** `billing.neon.integration.test.ts` es **el unico
archivo de integracion nuevo con literales de Stripe FIJOS**, contra **su decision 10**. `billing-interval` esta a
medias. Mientras sigan fijos, **cualquier corrida abortada vuelve a envenenar la rama**. Despachado.

**Y quedan ~32 negocios huerfanos acumulados de corridas abortadas** (no bloquean). **Decision del owner** si se
limpian: es borrado en una base, aunque sea la rama efimera.

### 5a MUERTE DEL REVISOR, con S9 puesta — Y LA COPIA EN `/tmp` FUE LO QUE LA SALVO

**El revisor murio a mitad del BARRIDO** (habia llegado al menos a S9), con `// MUTATION S9 (revisor, barrido)` en
`cancel/route.ts:170`, que borraba las ramas `rawType` y `statusCode` de `isDeterministicRejection`. Archivo
**untracked**: `git checkout` no servia.

**EL ORQUESTADOR INTENTO RECONSTRUIRLA A MANO Y NO CONVERGIO.** Cuatro candidatos plausibles, **ninguno** dio el hash.
**Lo que la salvo fue la copia que el propio revisor habia dejado en `/tmp`** (`/tmp/mut-backup-cancel.ts`) — la regla
que se escribio en `CLAUDE.md` hace dos rondas, **cobrada**. Restaurado y verificado:
`1fa5bbf9d80ee940d00c35d1655b462c99f9a911`, exacto.

**Y el detalle que vale mas que el incidente: el mejor candidato era ESTRUCTURALMENTE CORRECTO** (la rama `rawType` y
el rango 4xx) **pero habria perdido el comentario** que explica por que se mira `rawType` y no `instanceof` («sobrevive
a un bundler que renombre clases»). **El hash lo cazo.** «Casi igual» habria degradado el archivo **en silencio**, que
es la clase de daño que nadie ve despues. **Corolario: el `shasum` no es burocracia — es lo que convierte una
reconstruccion en verificacion, y lo que distingue «restaure el archivo» de «escribi algo parecido».**

**Arbol tras restaurar, verificado:** `grep MUTATION` **vacio**, ninguna sonda en `src/`, los otros **nueve hashes
identicos** al baseline, `typecheck` (forzado) y `format:check` **verdes**, y los 3 guards de
`billing-cancel-guards…` —los oraculos de B1, B2 y B4— **en verde, 3/3**.

**CAMBIO DE METODO PEDIDO AL REVISOR, porque cinco muertes ya son un patron y no un accidente:** que **escriba cada
fila del barrido a `/tmp/barrido-d1.md` apenas la termina**, en vez de acumularla en su contexto. Es la regla del
propio repo —lo que tiene que sobrevivir va a un archivo, no a la conversacion— aplicada al trabajo del agente. Si se
cae otra vez, la lista sobrevive y se levanta del disco en vez de reconstruirse del arbol.

### B4 + LOS 4 MENORES CERRADOS. EN RE-REVISION, y esta vez el encargo es el BARRIDO SISTEMATICO

**Corridas del orquestador:** `grep MUTATION` **vacio**, ninguna sonda en `src/`, **los 5 gates verdes** (`typecheck` y
`build` forzados, `0 cached`) y **119 archivos / 864 tests / 0 failed / 0 skipped**. **Tamaños al hook con control que
discrimina**: `_auth` **244**, `checkout` **161**, `billing-cancel-guards…` **194**, `billing-interval.neon…` **188**,
`billing-routes.test.ts` **300**, `billing.neon…` **300**, fake **299** — todos `EXIT=0`. **Los tres ultimos sin
margen.**

**B4 pinneado** en `billing-cancel-guards…` (149 → 194), con el docblock ampliado al **ciclo `cancel`/`resume`** y la
calibracion del revisor conservada. **MUT-J corrida contra la SUITE COMPLETA: 1 rojo**,
`expected { cancel_at_period_end: false } to deeply equal { …, cancel_at: null }` — la asercion es sobre **lo que se le
PIDIO a Stripe**, no sobre el setup.

**El menor 1 se cerro como corresponde: PINNEANDO en vez de declarando, y el intento fue primero.** `has_more` se monta
**sin tocar el fake** (que esta en 299), sobre la suscripcion ya sembrada. **MUT-I: 1 rojo, suite completa,
`expected 200 to be 409`.** Ahora **las tres** condiciones de `interval_ambiguous` que el docblock enumera tienen
oraculo — antes eran dos de tres con el comentario afirmando las tres.

**Los otros tres menores:** el doc **cercano** alineado con el lejano; el docblock de `readBody` nombra a sus
llamadores **reales** (`checkout` e `interval`) **y deja escrito que la frase vieja fue la que indujo el verde por el
motivo equivocado** — o sea que el error quedo documentado donde lo va a leer el proximo, no solo corregido; y el
«299/300» re-medido a **300, cero margen**.

### EL ENCARGO DE ESTA RE-REVISION ES DISTINTO, Y ES LA REGLA NUEVA PUESTA A PRUEBA

**Cada ronda encontro exactamente UN bloqueante mas, siempre de la misma familia y siempre fuera de la tabla.** No hay
ninguna razon para creer que B4 fue el ultimo. Asi que el encargo ya **no** es otra ronda de mutaciones sueltas: es
**listar TODAS las afirmaciones de invariante de los docblocks del codigo nuevo de la D1 y mutar cada una**, y entregar
la **lista completa** con el resultado ejecutado de cada fila — rojo con su asercion literal, o **verde**. Los verdes
son el trabajo que falta.

**Y con el limite explicito:** si el barrido no entra en su presupuesto, que **priorice y lo diga**, pero que **no lo
declare completo si no lo esta**. Un barrido que afirma «no hay mas» sin haberlas mirado todas es el guard roto de la
tarea 38: **da seguridad que no tiene**.

### 2o FAIL DEL REVISOR: **B4**, CUARTO bloqueante de la MISMA familia. Despachado

**Lo que el delta arreglo esta BIEN y el revisor lo verifico**: B1, B2 y B3 cerrados con oraculos que muerden **por el
motivo correcto**, cada mutacion roja **solo en su propio test** (37-38 verdes al lado), y los 7 menores checan. B4 no
es una falla de esos arreglos: es otro docblock que nadie habia mutado.

**Auditoria del orquestador:** `grep MUTATION` **vacio**, ninguna sonda en `src/`, y los **cinco hashes identicos** al
baseline (`checkout` `98e4e7c9`, `resume` `4e396b5e`, fake `fc553527`, `_auth` `06b1e16a`, `interval` `65fe4f3c`).
Gates del revisor: **119 archivos / 863 tests / 0 skipped** y los 5 en `EXIT=0`.

**B4 — `resume` limpia `cancel_at`, el docblock dice que eso es lo que hace que «reanudar reanude de verdad», y nada lo
pinnea.** `MUT-J` (sacar `cancel_at: null`) → **38/38 VERDE** contra los 7 archivos que pueden verla. **Verificado por
el orquestador con `grep`:** `resume/route.ts:64-66` afirma exactamente eso y `cancel_at: null` esta en la 67.
**Consecuencia, no cosmetica:** con un `cancel_at` **explicito** —el del dashboard, el actor por el que existe el ADR
0060— un `resume` que no lo limpia deja a Stripe con la baja viva mientras `clearPendingPlan` borra las tres columnas
**incluida `downgrade_requested_at`**; el webhook repone `pending_plan` pero **no la marca**, y al cerrar el periodo el
`deleted` llega sin marca → **`plan='none'`**: el owner que reanudo termina bloqueado. **Calibracion honesta del
revisor, conservada:** si el `cancel_at` lo genero nuestro propio `cancel_at_period_end`, Stripe lo limpia solo; el
guard es load-bearing **para el explicito**, que es el caso que el docblock nombra. **Ya pinneado** (~20 lineas); corte
decidido: va a `billing-cancel-guards…` (**149**, tiene lugar), ampliando su docblock al ciclo `cancel`/`resume`.

**LOS 4 MENORES**, y dos son de la familia «el numero/el texto viejo»: `MUT-I` verde (`has_more` es la tercera
condicion de `interval_ambiguous` y **no tiene oraculo**, mientras el docblock afirma las tres); **se corrigio el doc
LEJANO y no el CERCANO** (la spec ya dice «el costo es real, la imposibilidad no», pero el comentario de
`createCustomer` en `checkout/route.ts` sigue con la version vieja); el docblock de `readBody` (`_auth.ts:101`) **nombra
a `cancel`, `resume` y `settle-free`** —**verificado por el orquestador: los unicos llamadores son `interval` y
`checkout`**—; y el docblock de `billing-cancel-guards…` dice «299/300» de un archivo que esta en **300**.

### EL PATRON DE FONDO, que ya no es de esta fase sino del METODO → bajado a `CLAUDE.md`

**Cuatro bloqueantes consecutivos, los CUATRO de la misma familia, los CUATRO de mutaciones FUERA de la tabla.** La
tabla se escribe **desde el diseño**, asi que no ve lo que el codigo **termino afirmando**: esos cuatro docblocks no
existian cuando se escribio el plan de pruebas. **Regla nueva:** al cerrar una fase, **listar los comentarios del
codigo nuevo que afirman un invariante y mutar cada uno**; los que queden verdes son el trabajo que falta.

**Con dos agravantes de esta misma fase:** (1) B4 vivia en un docblock que **el delta anterior acababa de editar** para
cerrar un menor — tocar un comentario no lo verifica, y la mano que lo edita es la que menos lo duda; y (2) **un
docblock falso no es pasivo: causa errores de metodo.** El de `readBody` es la frase que hizo que la primera sonda se
escribiera contra `cancel` y **saliera VERDE por el motivo equivocado**. Un comentario mentiroso no espera a que
alguien lo lea mal: **lo induce.**

### B3 CERRADO. EN RE-REVISION FINAL con el MISMO revisor (2026-09-11). Sigue SIN PASS

**Corridas del ORQUESTADOR, no el relato:** `grep MUTATION` **vacio**, **ninguna sonda suelta en `src/`**, baseline de
la fase C intacto, `checkout/route.ts` de vuelta en `98e4e7c9…`. **Los 5 gates verdes** (`typecheck` y `build`
forzados, `0 cached`) y `pnpm test` con integracion en **119 archivos / 863 tests / 0 failed / 0 skipped** (venia de
118/862). **Tamaños al hook con control que discrimina**: `billing-checkout-guards…` 97 `EXIT=0`; siguen sin margen
`billing-routes.test.ts` **300**, `billing.neon…` **300** y el fake **299**.

**B3 cerrado en `billing-checkout-guards.neon.integration.test.ts`** (97 lineas). MUT-K corrida por el implementador
**contra la suite completa**: **1 solo rojo en 119 archivos**, con el diff literal
(`checkout:<id>:month` esperado vs `checkout:<id>:month:1789151976243` recibido) — la asercion habla de **las claves**.
La decision 3 del orquestador **ahora apunta a su oraculo**.

**Y el implementador le encontro un DEFECTO REAL a la sonda del revisor antes de adoptarla:** dejaba que el fake
devolviera el literal fijo `cus_creado_por_el_checkout`, que **se escribe en `core.subscription`** — cuyo unique de
customer es **GLOBAL** —, asi que habria chocado con el test de `checkout` de `billing.neon…` al correr en paralelo.
Ahora sale de un `randomUUID()`. **Es el `23505` que ya costo una vuelta en esta fase, cazado esta vez ANTES de
pagarlo** — o sea que la leccion viajo. Y agrego una asercion gratis: **el intervalo SI forma parte de la clave**.

**LO QUE LE QUEDA A LA RE-REVISION FINAL** (su pasada anterior quedo a mitad): verificar que las sondas de B1/B2/B3
pinnean lo que dicen y no una version debilitada; que `cancel` **realmente** no lee el body (si lo leyera, la
explicacion del «verde por el motivo equivocado» seria falsa y el oraculo nuevo estaria mal atribuido); **mutar** los
menores que tocaron produccion y el fake (`idempotencyKey` del customer, separacion de canastas); y juzgar los
**docblocks nuevos** de `gateway.ts` y `resume`, que afirman cosas — **el ADR 0054 ya mordio CINCO veces en esta spec**.

### B3 — LA CLAVE FIJA DEL `checkout` NO TIENE ORACULO. Tercer bloqueante de la MISMA familia. Despachado

**El revisor murio a mitad de la re-revision con MUT-K puesta; la termino el ORQUESTADOR.** Todo lo de abajo son
corridas propias.

**MUT-K** (romperle la clave fija al Checkout agregandole `:${Date.now()}`) → **la suite ENTERA queda VERDE: 118
archivos / 862 tests, CERO rojos.**

**No es estilo: es una decision DECLARADA de esta spec.** §Decisiones del orquestador punto 3 dice «**la clave fija se
conserva**», y el docblock de `confirmAtStripe` en `cancel/route.ts` la usa como **contraejemplo normativo** («con una
clave FIJA —el patron que `checkout` usa y esta spec denuncia»—). Hay texto en **produccion** razonando sobre esa
propiedad y **nada la sostiene**. Es B1/B2 otra vez: ADR 0054.

**No es un limite — ya esta pinneado y VERIFICADO EN LAS DOS DIRECCIONES**, que es el estandar de este repo:
- con MUT-K → **ROJO**, `expected [ …(2) ] to deeply equal [ …(2) ]` sobre `fake.sessionKeys`: la asercion habla de
  **la propiedad**, no del setup;
- con el codigo limpio → **VERDE**, 1/1.

**Corte decidido por el orquestador antes de despachar:** va a **`billing-checkout-guards.neon.integration.test.ts`**
(nuevo), hermano del `billing-cancel-guards`. **No entra en los existentes: `billing.neon…` y `billing-routes.test.ts`
estan en 300 EXACTAS —cero margen— y el fake en 299.**

**LA TRAMPA NUEVA, y es peor que la del untracked: `checkout/route.ts` esta TRACKED Y MODIFICADO (` M`).** Ahi el
`git checkout` de emergencia **si hace algo — y es lo PEOR que puede hacer: borra tambien el trabajo del
implementador**, no solo la mutacion. La del untracked no revierte nada y se nota; esta revierte de mas y **se ve como
si hubiera funcionado**. Se reconstruyo a mano y se verifico contra el oraculo: **`98e4e7c9aa7228b96338ebe32871ff37de6ac37c`**,
identico al que el implementador habia dejado en su handoff. **Tercera vez en esta fase que ese numero es lo unico que
separa una reconstruccion de una adivinanza.**

**La sonda del revisor quedo FUERA del arbol** (en `/tmp`): era un `.neon.integration.test.ts` suelto en `src/server/`
que la suite **corre**, o sea un contaminante con forma de test.

### DELTA DEL FAIL CERRADO — EN RE-REVISION con el MISMO revisor (2026-09-11). Sigue SIN PASS

**Nada commiteado del codigo, nada desplegado.** Lo de abajo son corridas del ORQUESTADOR, no el relato del
implementador.

- `grep MUTATION` **vacio**; baseline de la fase C **intacto**; `locations/core.ts` y `store.ts` **identicos a git**.
- **Los 5 gates verdes**: `typecheck` y `build` **forzados** (`0 cached` los dos), `lint`, `format:check`, y
  `pnpm test` con integracion en **118 archivos / 862 tests / 0 failed / 0 skipped** (venia de 117/860).
- **Tamaños al hook CON CONTROL que discrimina** (`onboarding/page.tsx` 469 → `EXIT=2`):
  `billing-routes.test.ts` **300**, `billing.neon…` **300**, `billing-stripe-fake.ts` **299**,
  `billing-cancel-guards…` 149 — todos `EXIT=0`. **Los tres primeros sin margen real.**

**LOS DOS BLOQUEANTES, pinneados** en `billing-cancel-guards.neon.integration.test.ts` (nuevo, 149 lineas, literales
unicos con `randomUUID`): MUT-A → `expected null to be 'free'` sobre `pendingPlan` **leido por SQL**; MUT-D →
`expected [] to include 'subscriptions.update:sub_vivo…'`. **Cada mutacion roja solo en su propio test**, o sea
atribucion verificada. Las dos revertidas con `shasum` identico.

**EL HALLAZGO MAS VALIOSO DEL DELTA, y es una familia NUEVA: un VERDE por el motivo equivocado.** Al pinnear el menor
3 (`readBody`), la primera sonda mandaba el request sin body a **`cancel`** — que **no llama a `readBody`**. **MUT-B
quedaba VERDE**, y se leia como «el guard no hace falta». Es el **espejo** de la regla que ya esta en `CLAUDE.md` («un
ROJO puede ser por el motivo equivocado»): **un VERDE tambien puede serlo, y es peor, porque un verde no invita a
mirar**. Con el oraculo corregido a `interval` (que si lee el body): `expected 503 to be 400`. **Lo encontro el
implementador solo, y lo reporto en vez de quedarse con el verde.**

**Los otros menores:** `gateway.ts` corregido a las 3 funciones que existen (+ la celda de §Archivos compartidos);
el texto de `store.ts` ahora dice **el costo es real, la imposibilidad no**; `resume` **nombra la ventana** del ADR
0060 y el renglon a re-mirar (`derive.ts:222`); **`customers.create` gana `idempotencyKey`** con oraculo; el fake
**separa las canastas** (`sessionKeys`/`customerKeys`/`updateKeys`); y el «14 / 3 sin fila» reconocido como error
propio. Declarados en §Archivos los 4 archivos que faltaban en la tabla.

**LO QUE SE LE PIDIO A LA RE-REVISION, porque tres menores TOCARON PRODUCCION Y EL FAKE:** que **mute** el
`idempotencyKey` del customer y la separacion de canastas —la leccion de la fase B es que «un vocabulario que crece sin
oraculo seria un agujero nuevo introducido arreglando un menor»—, que **verifique que `cancel` realmente no lee el
body** (si lo leyera, la explicacion del verde seria falsa y el oraculo nuevo estaria mal atribuido), y que juzgue los
**docblocks nuevos** de `gateway.ts` y `resume`, que son texto que **afirma** cosas — ADR 0054, que en esta spec ya
mordio cuatro veces.

### REVISOR INDEPENDIENTE: **FAIL** (2026-09-11). 2 bloqueantes, los DOS del tipo ADR 0054. Despachados

**Sin PASS: nada se marca implementada, nada commiteado, nada desplegado.** El revisor **no encontro bugs en el
codigo**: los dos bloqueantes son **invariantes que la spec y los docblocks declaran y que ningun test pinnea**, y los
dos vienen **demostrados cerrables** —el revisor escribio la sonda, verifico que muerde por el motivo correcto y la
borro—, asi que **no hay ningun limite que declarar**.

**AUDITORIA DEL ARBOL TRAS LA REVISION, corrida por el orquestador:** `grep MUTATION` **vacio**, **los 5 hashes de las
rutas IDENTICOS al baseline** (`_auth` `06b1e16a`, `cancel` `1fa5bbf9`, `settle-free` `eeaa9e0c`, `interval`
`65fe4f3c`, `resume` `95cebd10`), sin sondas colgadas y `git status` igual al de antes. **El revisor limpio perfecto —
y el baseline de abajo es lo que permitio verificarlo en vez de suponerlo.**

**B1 — el guard `createdNow` del revert de `cancel` no tiene NINGUN oraculo.** `MUT-A` (sacarlo) → **35/35 VERDE**. Es
la decision 3 del implementador, con un docblock de 8 lineas afirmando que sin ella «un revert borraria una baja
legitima… exactamente el daño que [R1-B3] existe para impedir». Los dos tests que parecen cubrirlo son **los dos
primeros pedidos** (`createdNow === true`), o sea **indistinguibles con y sin el guard**. Sonda de ~25 lineas, sin
paquetes: con MUT-A da `expected null to be 'free'`.

**B2 — «`settle-free` sobre una suscripcion VIVA programa la baja en Stripe» no tiene oraculo.** `MUT-D` (romper el
alias y settlear SIEMPRE en local) → **35/35 VERDE**: ningun test llama a `settle-free` con una suscripcion viva.
**El daño es de plata** —dejar de cobrarle a un negocio el plan que Stripe le sigue facturando— y **el barrido del
filesystem no lo ve**, porque mira que exista el `export POST`, no el cuerpo.

**CORTE DECIDIDO POR EL ORQUESTADOR ANTES DE DESPACHAR:** `billing.neon.integration.test.ts` esta en **299/300**
(preguntado al hook), asi que **cualquier** linea nueva lo pasa. Los dos tests van a
**`billing-cancel-guards.neon.integration.test.ts`**, cortado **por naturaleza**: los dos pinnean las dos decisiones
que protegen **una baja legitima de ser destruida**.

**LO MEJOR DE LA REVISION, otra vez fuera de la tabla:** de 7 mutaciones, **MUT-A y MUT-D quedaron VERDES** (los dos
bloqueantes) y **MUT-F** —sacarle `status='active'` a `ownerContext`, corrida contra **la suite entera**— dio **1 solo
rojo en 117 archivos**, en `billing-routes-auth.neon`. O sea que ese filtro **si tiene oraculo propio, y antes de esta
fase no lo tenia en NINGUNA parte del repo**: `api/staff/*` y `api/locations/*` dependen de el y ninguno muerde. Es un
aporte neto de la D1.

### CORRECCION A UNA AFIRMACION DEL ORQUESTADOR: los `fetch failed` NO eran reintentos absorbidos

Este archivo decia que la suite seguia escupiendo `fetch failed` dentro de corridas verdes «absorbidos por
reintentos», y que el flaky estaba «tapado, no cerrado». **Era falso, y lo falsifico el revisor. Verificado por el
orquestador con `grep`, no aceptado de palabra:**
- Esos `fetch failed` salen de **`merchant-auth-disabled-paths.test.ts:32`**, que pone a proposito
  `process.env.DATABASE_URL ??= "postgresql://user:pass@localhost/db"`. Son **benignos**, preexistentes de la spec
  0046, y **no tocan la rama de Neon**.
- **No hay ninguna capa de retry**: `grep -niE "retry|reintent|backoff|attempt" server/db.ts` no devuelve **nada**. La
  hipotesis de «absorbidos» no tenia mecanismo.
- **El flaky SI es real, pero es OTRO y es AJENO a esta fase**: 1 de 3 corridas del revisor fallo **por una
  ASERCION**, en `consumer-recovery.neon.integration.test.ts` (spec 0032). **Causa raiz:** ese archivo usa `phones[4]`
  en **dos** tests y el segundo hace el `select` de `otpDeliveries` **sin `order by`** y despues `.at(-1)`
  (lineas 269, 350, 366-367 — verificado). Con dos filas para ese telefono, **el orden del heap decide**. Es una
  moneda al aire, preexistente.
- **Riesgo de CI (spec 0062): real y doble** — ese `.at(-1)` sin `order by`, y el compute de la rama efimera con
  `suspend_timeout_seconds: 0` mientras ~27 archivos arrancan en paralelo contra un compute que puede estar frio.
  **El revisor declara que NO reprodujo** los `fetch failed` contra Neon, con los intentos hechos escritos.

**Leccion de metodo, y es del orquestador contra si mismo:** «absorbidos por reintentos» era una **explicacion
inventada para un sintoma**, escrita en este archivo y relatada al owner sin buscar el mecanismo. Un `grep` de una
linea la habria matado. Es el ADR 0054 del lado del diagnostico: **un sintoma no es una causa, y nombrar una causa
plausible se siente igual de bien que haberla verificado.**

### CERRADO: el `*/` de un glob dentro de un comentario de bloque (vale guardarlo, es sutil)

Al corregir el menor 1, `server/billing/gateway.ts:42` quedo con la ruta **`app/api/billing/*/route.ts` DENTRO de un
bloque `/** … */`**: el `*/` del glob **cerraba el comentario ahi mismo** y toda la prosa que seguia se parseaba como
codigo. `typecheck` daba `TS1443` x10 + `TS1160: Unterminated template literal`, `lint` un `Parsing error`, y **19
archivos de test caian con `esbuild: Expected ";" but found "stripeContext"`**.

**No era una mutacion** —`grep MUTATION` vacio y los dos hashes en el baseline—, era un defecto real. **Arreglado**
escribiendo `app/api/billing/<ruta>/route.ts`. **Verificado por el orquestador tras el fix:** `typecheck` (forzado,
`0 cached`), `lint` y `format:check` **los tres verdes**, y el balance del archivo en **3 `/**` / 3 `*/`**.

**LO QUE CONVIENE NO PERDER, porque es lo traicionero del caso: `format:check` NO lo caza.** Prettier formatea igual un
archivo que parsea mal de esta forma, asi que «formato verde» no dice nada. Los gates que muerden son **`typecheck` y
`lint`** —y el sintoma mas ruidoso (19 archivos de test rojos) apuntaba a `checkout/route.ts`, que **no tenia nada que
ver**: era la cascada de un import.

### EL DELTA DEL FAIL, EN CURSO

**Ya aterrizo `billing-cancel-guards.neon.integration.test.ts`** —el corte por naturaleza que decidio el orquestador—
con **los dos tests de los bloqueantes**: `un REINTENTO de cancel que falla determinista NO borra la baja ya pedida`
(B1) y `` `settle-free` sobre una suscripcion VIVA programa la baja EN STRIPE, no en local`` (B2). **149 lineas,
preguntado al hook: `EXIT=0`.**

**Falta:** verificar que las dos sondas MUERDEN leyendo la asercion (MUT-A esta corriendo ahora; MUT-D despues),
transcribir las dos filas a la tabla de la spec, y los **7 menores** — de los cuales dos son ADR 0054 del lado del
comentario: el docblock de `gateway.ts` lista **cuatro funciones que no existen** (`cancelSubscription`,
`resumeSubscription`, `changeInterval`, `createCheckoutSession` — las rutas llaman a `gateway.subscriptions.update`
directo) y la §Archivos compartidos de la spec lo repite.

**Despues del delta: RE-REVISION con el MISMO revisor**, que conserva el contexto de toda la fase D1.

### ~~BASELINE DE `shasum` DE LOS ARCHIVOS UNTRACKED~~ — **OBSOLETO: ya estan COMMITEADOS**

> **AVISO (handoff 2026-09-12):** los 11 archivos que este bloque listaba **entraron en `8effb1b`**, asi que **ya no son
> untracked y `git checkout` vuelve a funcionar sobre ellos** — el motivo entero por el que existia este baseline
> desaparecio. **No lo uses como referencia: usa `git`.** Se conserva solo como historico de la D1.

**Re-medido en el momento de escribirlo, no copiado del bloque anterior.** El del fake **habia quedado viejo**
(`df152f8f…`) porque el implementador lo edito al cerrar el menor 6 — un cambio **legitimo**, no una mutacion, pero un
baseline podrido es exactamente el veneno que `CLAUDE.md` documenta: la sesion fresca corre la auditoria, ve el
mismatch y concluye «alguien dejo una mutacion puesta».

**Ninguno de estos archivos esta commiteado**, asi que **`git checkout` sobre cualquiera no hace nada** y esta lista es
lo unico que permite distinguir «mutado» de «legitimo». `grep MUTATION` estaba **vacio** al medir.

- `app/api/billing/_auth.ts` -> `06b1e16a624f90bb3854474da70e1a3c1bf427fd`
- `app/api/billing/cancel/route.ts` -> `1fa5bbf9d80ee940d00c35d1655b462c99f9a911`
- `app/api/billing/interval/route.ts` -> `65fe4f3c3c071636d247495ee2fef7fc58d6d0bc`
- `app/api/billing/resume/route.ts` -> `95cebd1091a4287efff5bc7be20351c45b1ff7c7`
- `app/api/billing/settle-free/route.ts` -> `eeaa9e0cbe64281c0463d53451d117d2e5377bf3`
- `server/billing-cancel-guards.neon.integration.test.ts` -> `e6d90da9c60e513a099bbee288cc9646aabbd843`
- `server/billing-interval.neon.integration.test.ts` -> `605d98ce61339d32299edc1b9672921fa8207bcf`
- `server/billing-routes-auth.neon.integration.test.ts` -> `30446c3cf8aecdb26dcc234048bda4a911d217ee`
- `server/billing-routes.test.ts` -> `a9f37644dde32c1f4303b35e7a48635d2d6f6ab0`
- `server/billing-stripe-fake.ts` -> `fc5535270ac77700095ab70c38eead89800f6843`
- `server/billing.neon.integration.test.ts` -> `df19f535173e946a7a48a5551630eb1ca74db9bd`

**⚠️ DOS ARCHIVOS EN 300 EXACTAS — cero margen.** Medido al hook: `billing-routes.test.ts` **300** (`EXIT=0`),
`billing.neon.integration.test.ts` **300** (`EXIT=0`), `billing-stripe-fake.ts` 299, `billing-cancel-guards` 149. El
hook muerde en **>300**, asi que pasan por un pelo, pero **la proxima linea que se le sume a cualquiera de los dos lo
rompe** — y `file-size` es **PostToolUse, no Stop**: los 5 gates NO lo cazan. Es el bloqueante que costo la 3a pasada
de la fase C. **Avisado al implementador; si le falta agregar algo ahi, el corte lo decide el orquestador.**

**LOS HASHES Y TAMAÑOS DE ARRIBA SE MUEVEN MIENTRAS EL IMPLEMENTADOR TRABAJA — no los copies al handoff.** Ya paso
dentro de esta misma sesion: re-medi el baseline y **tres hashes habian cambiado** por ediciones legitimas de los
menores. **Todo numero que vaya al handoff o a un doc se re-mide al cerrar, despues de la ultima pasada de prettier y
preguntandole AL HOOK, con un control que demuestre que discrimina.**

**LO QUE SIGUE:** PASS/FAIL del revisor → (si PASS) commit de la D1 → **fase D2 (UI + D8 + render del HTML)**, cuyo
revisor tiene que vigilar **las dos salidas** (D8 **y** el boton de D10), porque la particion las mando a fases
distintas y ningun revisor las ve juntas.

<details><summary><b>HISTORICO: la mutacion M1 que estuvo viva durante la sesion (ya revertida, verificado)</b></summary>

### ~~MUTACION VIVA~~ — **YA NO VALE. Historico del 2026-09-11; el arbol esta LIMPIO desde entonces**

> **AVISO (handoff 2026-09-12): NO hay ninguna mutacion puesta.** Verificado: `grep -rn MUTATION apps/merchant/src`
> **vacio**, sin sondas en `src/`, arbol commiteado en `8effb1b`. Este bloque se conserva como historico **porque su
> titulo original decia lo contrario y un punto de retorno que miente manda a perseguir un fantasma** — que es
> exactamente el sintoma que la auditoria existe para descartar. Lo de abajo es la foto de aquel momento.

**Si estas leyendo esto en una sesion fresca, NO es un bug y NO persigas el rojo.** El implementador de la D1 esta
**corriendo** (verificado, no supuesto) y va por las mutaciones en orden. Estado al momento de escribir esto:

- **M17 — ya REVERTIDA** por el implementador: `payment_behavior: "error_if_incomplete"` volvio a
  `app/api/billing/interval/route.ts:75` y no queda etiqueta `MUTATION` en ese archivo. **Ojo con ese archivo: es
  UNTRACKED, asi que una mutacion ahi NO tiene blob de git contra el cual revertir** — se deshace a mano leyendo la
  etiqueta. Vale para las 5 rutas nuevas mientras no se commiteen.
- **M1 — PUESTA AHORA MISMO** en `apps/merchant/src/server/locations/core.ts:98`
  (`// MUTATION M1 — el tope ignora pendingPlan.`): `effectiveLocationLimit` devuelve `current` y se comio el guard de
  `pendingPlan` **y** el `[R1-N8]` del string vacio.
  - **Ese archivo SI esta trackeado**, asi que se revierte con `git checkout apps/merchant/src/server/locations/core.ts`.
  - **`shasum` LIMPIO (blob de git): `869a842a8e417eba2aa25e0771aa838865108199`.** Mutado ahora:
    `6a6766698415f4314fd574cc4062728abb93a3aa`. **Si la sesion se cayo, reverti y verifica contra el limpio.**

**El orquestador NO la revirtio a proposito:** el hook `no-mutations-left.sh` la marco, pero cortarla bajo un agente
vivo lo haria transcribir un resultado falso — y una fila de mutacion mal medida es justo lo que esta spec ya pago tres
veces. La mutacion esta **etiquetada y atribuida**, que es lo que la convencion pide; lo que NO puede pasar es que
sobreviva a la sesion.

</details>
**UNA DECISION DEL IMPLEMENTADOR QUE VIVE SOLO EN UN COMENTARIO:** `settle-free` es un **alias literal** del handler de
`cancel` — el argumento (D10 dice que es la MISMA rama de `decidePlanChange`, y lo que decide si se toca Stripe es la
FILA y no la URL) es bueno, pero **no esta en la spec**. Se le pidio bajarla a una seccion «Decisiones del
IMPLEMENTADOR de la fase D1», calcada de la que ya existe para la fase B. Mismo pedido para `_auth.ts`, que quedo en
**237** lineas contra las **51** del `app/api/locations/_auth.ts` que la spec manda calcar: si la diferencia es
contrato normativo escrito, se declara; si es alcance que crecio, es un hallazgo.

**Por que se parte, y es una decision del orquestador que el owner puede revertir:** la fase D como estaba escrita son
~12 archivos (5 rutas + `_auth.ts` + 3 de UI + 3 paginas editadas + 4 de test) sobre una spec de 1553 lineas. **En esta
spec ya murieron dos agentes a mitad de fase** (el implementador de la B y el implementador y el revisor de la C), y un
agente que muere a mitad de una mutacion deja un rojo indistinguible de un bug real. Partirla acota el radio.

- **D1 (servidor, en curso):** `app/api/billing/_auth.ts` + las 5 rutas (`checkout` editada, `cancel`, `resume`,
  `interval`, `settle-free`), `billing-routes.test.ts`, `billing.neon.integration.test.ts`,
  `billing-routes-auth.neon.integration.test.ts`, `locations-races.neon.integration.test.ts` (editar).
  Mutaciones **M5, M6, M14, M17** + **re-ejecutar M1**.
- **D2 (UI, pendiente):** `backoffice/subscription/{page,subscription-console,cancel-dialog}`, **D8** (reconciliacion al
  abrir la pagina), `backoffice/page.tsx` (tarjeta + presentacion de `none`/`canceled`), `backoffice/locations/page.tsx`,
  `onboarding/page.tsx` ([R2-I8]), y el **render del HTML** con `renderToStaticMarkup` (el DoD de que los tres campos
  sensibles no salen en el markup).

**AVISO PARA EL REVISOR DE LA D2, porque la particion crea un riesgo que la fase entera no tenia:** la spec (~linea
1214) dice que la salida del estado «`plus` con la suscripcion muerta» cuelga de «**D8 o el boton de salida de D10**».
D10 cae en D1 y D8 en D2, asi que **ninguno de los dos revisores ve las dos salidas juntas**. El revisor de la D2 tiene
que verificar las DOS.

**CORTES DE TAMAÑO DECIDIDOS ANTES DE DESPACHAR** (la spec exige que los decida el orquestador, no el implementador a
mitad de la tarea). Tamaños re-medidos hoy con el hook, no copiados:
- **`billing-integration-support.ts` 297/300 y la fase D TIENE que extender el fake** (hoy `checkout.sessions.create` y
  `customers.create` tiran «La fase B no crea…», y `subscriptions.update` ignora los params y no puede fallar — M17 lo
  necesita). Corte: **`billing-stripe-fake.ts` nuevo** con el doble de Stripe; el archivo viejo lo **reexporta**, asi que
  ningun test de las fases B/C —que tienen PASS— cambia de import.
- **`store.ts` 295/300 y `billing-store.neon.integration.test.ts` 300 exactas: PROHIBIDOS.** Las 5 funciones que las
  rutas consumen ya existen. Si una ruta necesita algo mas, es un hallazgo para el orquestador, no un corte del
  implementador.
- Los tests de integracion de la D1 van en **tres** archivos, cortados **por naturaleza** y no por tamaño: las 5 rutas
  contra Neon / staff activo y desactivado con **sesiones reales** (el unit con `ownerContext` mockeado no ve esa
  distincion) / las dos carreras en `locations-races`.
- **`onboarding/page.tsx` esta en 469** (preexistente, sobre el limite): el hook va a dar `EXIT=2` en cuanto se lo
  toque. Es la D2 y no es una violacion nueva — pero el edit de [R2-I8] no puede hacerlo crecer.

**AUDITORIA DEL ARBOL ANTES DE DESPACHAR, corrida por el orquestador (no relatada):** `grep -rn MUTATION
apps/merchant/src` **vacio**; los tres `shasum` **identicos** al baseline de mas abajo; y la rama efimera de Neon
**VIVA con la migracion `0030` puesta** — verificado corriendo `billing-store.neon.integration.test.ts`, **5/5 verdes**,
que es el unico chequeo que distingue una rama sana de una borrada (el `.env` se lee igual en los dos casos).

<details><summary><b>HISTORICO de la fase B (auditoria del arbol heredado: el primer implementador murio a mitad y dejo el arbol ROJO con codigo de produccion sin un solo test)</b></summary>

**AUDITORIA DEL ARBOL HEREDADO, corrida por el orquestador — no relatada por nadie:**
- **`grep -rn MUTATION apps/merchant/src` VACIO.** Era lo primero a chequear: un implementador muerto a mitad de sus
  mutaciones deja un rojo indistinguible de un bug real del producto (paso en la spec 0055 con `counter/core.ts`).
- **`pnpm run typecheck` ROJO, 3 errores.** Uno es `billing-applicability.test.ts(27,5)`: el test de fase A quedo sin
  actualizar contra la firma nueva de `assessEventApplicability` (la de m1). Los otros dos son
  `billing/webhook.ts:108` y `:113` — se le pasa el `db` crudo donde la firma pide forma de transaccion
  (`NeonHttpQueryResult` sin `oid` contra `QueryResult`). **Al implementador se le advirtio explicitamente que NO lo
  arregle con un cast:** eso apaga el typecheck que el contrato compro.
- **Escribio codigo de produccion y CERO tests.** Creados `billing/applicability.ts` (145), `billing/store.ts` (284),
  `billing/webhook-apply.ts` (216), `billing/webhook.ts` (181); modificados `billing/derive.ts` (248),
  `billing/index.ts` y `app/api/stripe/webhook/route.ts`. **Es el estado mas peligroso posible**: en cuanto el
  typecheck se ponga verde, queda codigo sin oraculo que parece terminado.
- **`billing/webhook-apply.ts` NO esta en la tabla §Archivos de la spec** — split no declarado. Se le pidio la fila
  con el motivo, como ya se hizo con `derive-rules.ts` y `applicability.ts`. Un archivo que nadie declaro se lee como
  alcance inventado.
- **`store.ts` esta en 284 lineas**, a 16 del limite de 300: lo que se le sume parte el archivo.

</details>

**FASE B DE LA SPEC 0063: PASS DEL REVISOR INDEPENDIENTE (2026-09-11, en 2 pasadas). COMMITEADA en `cf9f7ff`
(`feat: spec 0063 fase B — webhook y store, con PASS de revisor`). **Faltan la fase C (D12, nueva) y la D (la vieja C).**
NADA DESPLEGADO A PROD: no se pusheo y la migracion 0030 NO esta aplicada a prod — solo a la rama efimera
`spec-0063-billing`.**

**FASE C (D12 / ADR 0061): PASS DEL REVISOR INDEPENDIENTE (2026-09-11, en 3 pasadas: PASS con 5 menores → FAIL del
delta por 1 bloqueante → PASS final sin hallazgos abiertos). COMMITEADA en `71499f5`. Falta la FASE D.**
**NADA DESPLEGADO A PROD:** no se pusheo y la migracion `0030` sigue sin aplicarse a prod — solo a la rama efimera.

**DOS AGENTES MURIERON A MITAD EN ESTA FASE** —el implementador y despues el revisor—, asi que el estado de abajo es
el que el ORQUESTADOR verifico corriendo comandos, no el que relato nadie. **Si esta sesion tambien se cae, lo primero
al volver es repetir esa auditoria** (`grep -rn MUTATION apps/merchant/src` + `shasum` de los archivos mutados): un
agente muerto a mitad de una mutacion deja un rojo indistinguible de un bug real del producto.

**Baseline de `shasum` para esa auditoria — RE-MEDIDO al cerrar la fase C (2026-09-11), arbol limpio en `a85a7d8`:**
- `billing/claim.ts` → `edb7b41473e555c677556d2a3f14382dba97d9a4`
- `billing/webhook.ts` → `36163aef06cc066d622c7d95eeba446ed0113770`
- `app/api/stripe/webhook/route.ts` → `a5c0b68bfd3a9786ce368185e434c3a94dc7f090`

**El de `claim.ts` habia quedado VIEJO en este archivo** (`877dcc4f…`, de antes de extraer `claimStatement`), y es el
peor lugar posible para un numero podrido: una sesion fresca corre la auditoria, ve el mismatch y concluye que el
arbol esta mutado — **persiguiendo un bug que no existe**, que es exactamente el sintoma que la auditoria existe para
descartar. Cazado al hacer el handoff, re-midiendo. Es la misma familia de los tres errores de la fase C que ya estan
en `CLAUDE.md`.

**Tamanos, re-medidos con el hook (`file-size.sh`), los seis en `EXIT=0`:** `billing/claim.ts` 171,
`billing/webhook.ts` 158, `billing-claim.test.ts` 61, `billing-webhook-claim.neon.integration.test.ts` 262,
`billing-webhook.neon.integration.test.ts` 273, `billing-webhook-support.ts` 101.

**AUDITORIA DEL ARBOL HEREDADO, corrida por el orquestador — no relatada por nadie:**
- **`grep -rn MUTATION apps/merchant/src` VACIO** y `shasum` identico al baseline en los dos archivos mutados.
- **`typecheck` VERDE** al heredarlo (a diferencia de la fase B, donde vino rojo con 3 errores).
- **Escribio codigo de produccion Y su test**: `billing/claim.ts` (141), `billing/webhook.ts` (158, era 201),
  `billing-webhook-claim.neon.integration.test.ts` (296, 5 tests), `route.ts` (+`maxDuration = 10`), `billing/index.ts`.
  Ninguno sobre 300. **No es el estado peligroso de la fase B** (produccion sin oraculo).
- **Lo que le faltaba: las mutaciones y los gates.** Los corrio el orquestador.

**MUTACIONES M20-M23: LAS CUATRO CONFIRMADAS** (ejecutadas y transcriptas, no predichas):
- **M20** (sacar el lease) → 2 rojos. Uno prueba de paso el **`retrieve` duplicado** que D12.e dice que desaparece.
- **M21** (contestar 200 en `in_flight`) → **3 rojos**. **Era la mas importante de la fase —el bug que D12 existe para
  prevenir— y TIENE oraculo.**
- **M22** (colapsar el tri-estado) → **2 rojos**.
- **M23** (invertir la comparacion del lease) → 3 rojos. **La prediccion de la fila era FALSA: NO es indistinguible de
  M20** (M20 borra el lease, M23 lo invierte; rompen mitades distintas). Otra vez: se ejecuta y se transcribe.

**EL ERROR DEL ORQUESTADOR QUE CAZO EL REVISOR, y es la regla de `CLAUDE.md` incumplida por quien la hace cumplir:**
M21 y M22 se transcribieron como «2 rojos» y «1 rojo» **porque se corrieron contra UN SOLO archivo de integracion**,
el nuevo. Re-ejecutadas sobre los dos dan **3 y 2**. M20 si acotaba el alcance en su texto; M21 y M22 no. **Y la fila
de M22 sacaba una conclusion del numero equivocado** («el rojo mas angosto de los cuatro, y eso es correcto»). Es una
SUBESTIMACION —no una cobertura inventada—, pero es exactamente «no se predice, se EJECUTA y se transcribe», y el
numero viajo a este archivo. Corregido en los dos lados.

**LAS 4 MUTACIONES DEL REVISOR, FUERA DE LA TABLA (MUT-R1 a R4), que es donde estuvo el valor:**
- **MUT-R4** responde la sospecha del orquestador sobre si el `ageEventRow` le saco filo al test de la fase B:
  **no** — reintroducir el §Problema-4 exacto da 5 rojos e incluye ese test.
- **MUT-R2** demuestra que la desigualdad `ventana > maxDuration` muerde **en el borde** (`60 > 60` es falso).
- **MUT-R1 y MUT-R3 quedaron VERDES: dos afirmaciones de docblock sin oraculo.** MUT-R1 (`sql\`now()\`` → `new Date()`)
  **no era un limite** —el revisor demostro que se pinnea con `toSQL()` sin base ni paquetes— asi que se cerro.
  MUT-R3 (el caso «no hay fila») **se DECLARA como no pinneado en el codigo**, con el motivo y el renglon a re-mirar.

**EL BLOQUEANTE DE LA RE-REVISION, y es la TERCERA vez en esta fase que un numero se relata sin re-medir:** el
orquestador reporto el archivo del claim en **299**/300 lineas («queda margen»). Eran **309**: se midio ANTES de la
ultima pasada de prettier y no se volvio a mirar. El revisor no lo cazo con un `wc` sino **corriendo el hook del
propio repo** (`file-size.sh` → `EXIT=2`), con control sobre otro archivo para probar que discrimina. O sea que **el
archivo creado para respetar el limite de 300 acabo violandolo**, y los 5 gates no lo cazan porque `file-size` es
PostToolUse, no Stop. **Arreglado moviendo los dos tests que NO tocan la base** —la cota de la ventana y el chequeo de
forma— a `billing-claim.test.ts` (61 lineas; el de integracion queda en 262, los dos con el hook en `EXIT=0`). El corte
final no es por tamaño sino **por naturaleza**: sin base ni env, ahora corren SIEMPRE en vez de colgar de un archivo
que en la mayoria de las corridas se skipea entero. Verificado que la mudanza no perdio ningun test: **113 archivos
(+1) y los MISMOS 827**, y el unitario corre con `DATABASE_URL` desarmada.

**UN ROJO FALSO AL CERRAR MUT-R1, que vale mas que el fix:** la primera version del test nuevo llamaba a `getDb()`
adentro de `claimStatement` y moria con `DATABASE_URL no esta configurada` en cualquier corrida sin las env de
integracion. **Se veia como el guard mordiendo y era el entorno** — y ademas habria roto toda corrida sin esas env.
Se arreglo inyectando el ejecutor por parametro; el rojo real ahora es
`expected 'insert into "core"."stripe_webhook_ev…' to contain 'set "received_at" = now()'`.

**ALCANCE QUE APARECIO AL CORRER LOS GATES, no al leer codigo — y se declaro en §Archivos en vez de colarlo:** el
contrato nuevo puso **rojos dos tests de la fase B** en `billing-webhook.neon.integration.test.ts`. **Que se rompan es
evidencia de que el cambio es real, no cosmetico.** (1) `un retrieve que falla… y el reintento la procesa`: la
propiedad del §Problema-4 no cambia, pero el reintento va **fuera** de la ventana del lease (se envejece la fila por
SQL, que es lo que el paso del tiempo hace en prod). (2) `dos entregas SIMULTANEAS…`: esperaba `[200, 200]`, ahora es
`[200, 409]`, y **su comentario declaraba como «LIMITE MEDIDO» justo lo que D12 cierra**, asi que se reescribio entero
en vez de retocarle el numero. `ageEventRow` subio a `billing-webhook-support.ts` al aparecer el segundo consumidor.

**GATES CORRIDOS POR EL ORQUESTADOR, no auto-reportados:** typecheck **forzado** (`TURBO_FORCE=true`, `0 cached`),
lint, format:check, build **forzado**, y `pnpm test` con `.env.integration.local`: **113 archivos / 827 tests / 0
fallados / 0 skipped** (la fase B cerro en 111/821: **ningun test preexistente perdido**).
`grep MUTATION` vacio.

**ARRANCAR LA FASE D DESDE ACA.** Base de integracion: la rama efimera `spec-0063-billing` (`br-shy-king-axu5s3ze`),
credenciales en `.env.integration.local` (gitignored), migracion `0030` YA aplicada — **pero corre algo antes de
creerle al `.env`**: una rama borrada y una sana son indistinguibles desde el archivo. **Ese archivo tiene SOLO las 3
variables `NEON_INTEGRATION_*`, no las 5 `STRIPE_*`**: los tests usan `vi.stubEnv`, y el revisor verifico que eso no
produce un verde por el motivo equivocado (el test de firma invalida asevera el texto literal `"Firma invalida."`,
distinguible del de «Webhook no configurado»).

**GATES CORRIDOS POR EL ORQUESTADOR, no auto-reportados:** typecheck **forzado** (`TURBO_FORCE=true`, `0 cached` — un
cache hit no es evidencia), lint, format:check, build forzado, y `pnpm test` con `.env.integration.local`:
**111 archivos / 821 tests / 0 skipped**. `grep MUTATION` vacio. **Ningun archivo NUEVO sobre 300 lineas** (los 5 que
pasan son preexistentes: `onboarding/page.tsx` 469, `consumer-recovery` 447, etc.). **Ningun test preexistente
perdido**: `billing-applicability.test.ts` 9→9 `it(`, `locations-plan-cap.test.ts` 7→7.

**LO QUE HAY QUE LEER DE ESTA FASE ANTES DE EMPEZAR LA C, porque los dos bloqueantes NO eran bugs de codigo:**
1. **B1 — un comentario de produccion afirmaba un invariante que ningun test pinnea.** El docblock de `claimEvent`
   decia en mayusculas «UNA SOLA ENTREGA GANA EL CLAIM». **Falso para el solape**: el claim commitea antes del
   `retrieve` ([R1-M1] lo exige), asi que dos entregas solapadas ganan las dos y la segunda contesta `{received:true}`
   sin `duplicate`. Vale para la reentrega **SECUENCIAL**, que es el reintento de Stripe y el bug del §Problema-4. El
   comentario del TEST estaba bien acotado; el de PRODUCCION no, y estaba tres lineas arriba del statement.
2. **B2 — EL MAS CARO, y es el ADR 0054 en su version mas dificil de ver: una IMPOSIBILIDAD afirmada de mas.** El costo
   declarado para cerrar el solape («un lock explicito o una columna `processing_at` con lease») **era falso**: el lease
   entra en la columna **`received_at` QUE YA EXISTE**, como un predicado mas en el **mismo** `setWhere` — sin columna,
   sin migracion, sin lock, sin violar [R1-M1]. Medido sobre Neon con control por el revisor, por el implementador y por
   el orquestador. Y el `EXPLAIN` da los **dos** predicados en el **mismo nodo post-lock**
   (`Conflict Filter: ((processed_at IS NULL) AND (received_at < (now() - '00:01:00'::interval)))`), asi que el lease
   **no rompe la premisa del ADR 0054**: es un guard que se re-evalua, no un pre-chequeo.
   **Y la leccion de metodo: el ORQUESTADOR relato ese costo al owner y lo bajo a este archivo SIN verificarlo**, y
   encima apoyaba una recomendacion («aceptar el limite»). Es la regla de `CLAUDE.md` —un limite que reporta un
   subagente no se relata ni se documenta sin verificarlo— violada por quien la tenia que hacer cumplir. Lo cazo el
   revisor.
3. **Lo mejor de la revision fue una mutacion que NO estaba en la tabla: MUT-B, anular la ASIMETRIA** del guard de
   adopcion (que corriera tambien cuando `subscription.id === row.stripeSubscriptionId`). Demostro que **las DOS
   mitades de m1 tienen oraculo**, no solo la benigna: 2 rojos unit + **2 de integracion por SQL** (`una cancelacion
   hecha desde el DASHBOARD termina en none` → `expected 'plus' to be 'none'`). La pregunta que la genero —«¿esta
   pinneada la mitad peligrosa o solo la que el test nombra?»— es la que conviene repetir en la fase C.
4. **Un oraculo puede estar sostenido por OTRO guard del que uno cree** (M16): la primera version de esa mutacion
   quedaba verde porque el guard de adopcion la frenaba. Y en M16/M19 hubo que **reordenar las aserciones** para que el
   rojo no quedara atribuido al valor de retorno en vez de a la fila.

**DECISIONES DEL OWNER, LAS DOS RESUELTAS EL 2026-09-11:**
1. **RESUELTA: el item del DoD del claim se CIERRA implementandolo, no reescribiendolo.** El owner
   eligio cerrar el solape. **Entra como FASE C (spec 0063 §D12, ADR 0061); lo que era la fase C
   —rutas + UI + D8 + D10— pasa a ser la FASE D.** Renumerado ya en la spec y en `docs/INDEX.md`.
   **Y al diseñarlo aparecio el hallazgo que justifica el ADR: el lease de la fase B, implementado
   tal como estaba escrito, habria sido una REGRESION.** Su trade-off declarado decia que un
   reintento rechazado por el lease «esperaria al reintento siguiente»; pero ese rechazo contesta
   `{duplicate:true}` con **HTTP 200**, y para Stripe cualquier 2xx es entrega exitosa: **no hay
   reintento siguiente**. Un evento cuya primera entrega muriera no se habria procesado NUNCA — el
   bug del §Problema-4, por la puerta de atras, y **peor que no hacer nada** (hoy el solape deja el
   estado final correcto porque el `UPDATE` es idempotente). Arreglo: el claim pasa a **tres**
   resultados — `claimed` (sigue), `already_processed` (**200** `{duplicate:true}`, sin cambios) e
   `in_flight` (**409**, para que Stripe reintente).
   **La leccion de metodo, que es la de `CLAUDE.md` en su variante mas dificil —el COSTO declarado,
   en SEGUNDA vuelta:** ese parrafo habia nacido *corrigiendo* un limite sobredimensionado (el
   implementador dijo que costaba una columna nueva; era falso) y, al corregirlo, **fijo un precio
   nuevo que tampoco se verifico**. Sub-corregir se siente como rigor y deja el mismo agujero mas
   chico. Estuvo escrito en la spec, en este archivo y en `docs/INDEX.md`, y sostenia una
   recomendacion del orquestador («aceptar el limite»). Lo cazo el orquestador recien al explicarle
   el trade-off al owner, o sea tarde.
   **Pregunta del owner que vale conservar:** si el timestamp que Stripe manda en cada entrega no
   alcanza. No: `event.created` es del EVENTO e identico en las dos entregas (por eso el guard de
   orden no las distingue), y el `t=` de la firma **si** es por entrega (verificado en
   `stripe@22.5.0`, `esm/Webhooks.js:208`) pero no aporta nada sobre `received_at` — **un timestamp
   dice CUANDO empezo la primera, no si sigue viva**, que es el dato que falta. El lease es una
   apuesta, y la respuesta no-2xx es lo que hace que **perder la apuesta sea gratis**.
2. **RESUELTA el 2026-09-11 por decision explicita del owner → ADR 0060.** El drift estaba en **DOS** ADR, no en uno
   (`0059 §5` **y** `0058 §12`, linea 109) **y ademas en la fila del 0059 en `docs/INDEX.md`** — los tres decian que
   el `deleted` «esperado» se reconoce por `pending_plan='free'`. **El owner autorizo explicitamente editar los ADR
   viejos** (que por convencion son inmutables) para dejar el aviso al inicio, y pidio el ADR nuevo. Hecho:
   - **`docs/adr/0060-la-baja-esperada-se-prueba-con-una-marca-que-solo-escribimos-nosotros.md`** (nuevo). Supersede
     **un solo punto** de cada uno: el CAMPO del discriminante, que pasa a ser **`downgrade_requested_at`**. **La
     decision de producto NO cambia** — un `deleted` inesperado sigue yendo a `none` y bloqueando, con sus dos salidas.
   - **Los dos ADR viejos llevan el aviso AL INICIO**, con el formato «que YA NO VALE / que SIGUE VIGENTE», mas una
     anotacion en linea en el punto exacto para que no se lea aislado.
   - **`docs/INDEX.md`**: fila nueva del ADR 0060 + corregida la del 0059.
   - **Documenta lo que el codigo YA hace** (migracion `0030` + fases A y B con PASS): no es trabajo pendiente.

**FILAS QUE HEREDA LA FASE D (del revisor, ninguna bloqueante):**
- **`no_subscription_row`, `no_customer` e `ignored` no tienen oraculo** (solo `no_subscriptions`, via M16). El delta no
  empeoro nada —corrigio un valor engañoso—, pero la fase D **traduce esos cuatro motivos a lo que ve el owner**, asi
  que va una fila ahi. **El revisor YA DEMOSTRO que se puede pinnear** (escribio una sonda de ~35 lineas y la borro):
  **no hay limite que declarar.**
- **Presupuesto de tamaño casi agotado:** `store.ts` en **295**/300 y `billing-store.neon.integration.test.ts` en
  **300** exactas. Lo proximo que se le sume a cualquiera de los dos **parte el archivo** — y la fase D consume
  `scheduleDowngrade` y `reconcileFromStripe`.
- **Endurecimiento, no defecto:** si un mismo `sub_X` resolviera a dos negocios distintos, `applySubscriptionState`
  chocaria `core_subscription_stripe_unique` → `23505` → 500 → Stripe reintenta para siempre. No alcanzable por el actor
  del que m1 defiende.
- **Las decisiones del IMPLEMENTADOR de la fase B estan en una seccion propia de la spec** (4 entradas), etiquetadas
  como suyas. **La 4a —la forma de `scheduleDowngrade`, pasos 2 y 4 de D6 con `coalesce`— la consume la fase D.**

**LO QUE SIGUE:** **fase D** — 5 rutas + `_auth.ts` + UI + D8 + D10 + render del HTML + `locations-races`;
mutaciones **M5, M6, M14, M17** y **re-ejecutar M1** (su mitad de concurrencia no existia en fase A: la carrera de
desarchivado es el `locations-races.neon.integration.test.ts` de esta fase) → revisor independiente → despliegue.

**Lo que la fase D consume de las anteriores, y conviene leer antes de despachar:** la 4a entrada de §Decisiones del
IMPLEMENTADOR de la fase B (la forma de `scheduleDowngrade`, pasos 2 y 4 de D6 con `coalesce`), y la nota de la spec
(~linea 1183) de que la dependencia real es «**D8 o el boton de salida de D10**» — el revisor de la fase D tiene que
vigilar **las dos salidas**, no solo D8.

**Y DESPUES del PASS final, el orden de despliegue, al reves del reflejo natural:** migracion `0030` a prod **ANTES**
del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y los 11 negocios
pierden el modulo Locales; el `next build` NO lo caza porque esas paginas son `force-dynamic`), y setear
**`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview) antes de pushear.

**Pendiente del owner, sin bloquear:** el chequeo en Stripe de que al agotar los reintentos de cobro la suscripcion
quede en **`unpaid`** y no cancelada (Billing → Manage failed payments). Sin eso el ADR 0059 no se cumple.

**ESTADO PREVIO (2026-09-11, noche). Los 2 bloqueantes y los 4 menores del FAIL atendidos; el delta en
RE-REVISION con el MISMO revisor (conserva el contexto de toda la fase B, incluida MUT-B).**

**Lo que corrigio el implementador, y que de los menores salio mas de lo esperado:**
- **B1 / B2** como se describe abajo.
- **El menor (1) era mas amplio de lo que el revisor reporto: la lista normativa falsa estaba en TRES lugares**, no
  dos — `webhook.ts:22`, D5.a de la spec **y un item del DoD que repetia la lista vieja**. Los tres corregidos a los
  cinco campos reales (`type`, `id`, `created`, `data.object.id`, `api_version`), con la nota de que `api_version`
  describe al SOBRE, no al contenido.
- **El menor (3) toco PRODUCCION, no solo texto:** `ReconcileOutcome` gana `no_subscription_row` y `store.ts` lo
  devuelve cuando falta **la fila** (antes decia `no_customer`, que mandaba a diagnosticar otra cosa). `store.ts` paso
  de 284 a **295** lineas. Por eso la re-revision tiene que correr los gates y una mutacion sobre
  `reconcileFromStripe` (M16): **un vocabulario que crece sin oraculo seria un agujero nuevo introducido arreglando un
  menor.**
- **El menor (4) crecio a 4 entradas:** el implementador agrego por su cuenta la forma de `scheduleDowngrade` (pasos 2
  y 4 de D6 con `coalesce`) **porque la consume la FASE C y no estaba escrita en ningun lado**. Van en una seccion
  nueva de la spec, «Decisiones del IMPLEMENTADOR de la fase B, NO del owner ni del orquestador».

**EVIDENCIA NUEVA, verificada por el orquestador con su propia corrida (no relatada):** el `EXPLAIN` del claim **con el
lease** da `Conflict Filter: ((stripe_webhook_event.processed_at IS NULL) AND (stripe_webhook_event.received_at <
(now() - '00:01:00'::interval)))` — **los dos predicados en el MISMO nodo post-lock**, o sea que el lease **no rompe la
premisa del ADR 0054**. Eso no estaba en el analisis original y es lo que hace que la opcion de cerrar el solape sea
tecnicamente limpia, no solo barata.

**Gates que reporta el implementador al cerrar:** los 5 verdes, `pnpm test` con `.env.integration.local` →
**111 files / 821 passed / 0 skipped**, `grep MUTATION` 0, ningun archivo sobre 300 lineas.

**ESTADO PREVIO (2026-09-11, noche). Los 2 bloqueantes del FAIL corregidos y verificados en el arbol. Sin PASS: nada se marca `implementada`, nada commiteado, nada desplegado.**

**Verificado leyendo el arbol, no el relato:**
- **B1 corregido** en `billing/webhook.ts`: el docblock del claim ahora tiene un bloque «QUE GARANTIZA ESTE GUARD Y QUE
  NO», acotado a lo **medido** contra Neon, que **nombra que la version anterior afirmaba «UNA SOLA ENTREGA GANA EL
  CLAIM» y que eso es falso para el solape** (ADR 0054 del lado del comentario). Separa el «SI» (reentrega SECUENCIAL,
  el reintento de Stripe, el bug del §Problema-4, lo que muerde con M3/M7) del solape.
- **B2 corregido** en la spec (bloque «HALLAZGO DE LA FASE B», ~linea 1140): dice que el costo declarado era falso, que
  viajo a `docs/TASKS.md`, y escribe el statement real con el predicado sobre `received_at`. `docs/TASKS.md` ya tenia su
  propia correccion escrita por el orquestador.
- Arbol QUIETO (3 `shasum` iguales en dos pasadas consecutivas), **typecheck VERDE**, `grep MUTATION` **vacio**.

**LO QUE SIGUE, EN ORDEN:** (1) handoff corto del implementador con que cambio por cada punto; (2) **RE-REVISION del
delta con el MISMO revisor** (conserva el contexto de toda la fase B, incluida MUT-B); (3) con el PASS, **commit de la
fase B**; (4) **fase C** (5 rutas + UI + D8 + D10 + render del HTML + `locations-races`; mutaciones M5, M6, M14, M17 y
**re-ejecutar M1**) → revisor; (5) despliegue, con el orden invertido de siempre: **migracion `0030` a prod ANTES del
push** y `MERCHANT_PUBLIC_ORIGIN` seteada en Vercel antes de pushear.

**DOS DECISIONES ABIERTAS DEL OWNER, las dos planteadas y ninguna resuelta:**
1. **El solape del claim**, ahora con el PRECIO REAL (un predicado en el `setWhere`, sin migracion): aceptar el limite y
   **reescribir el item del DoD**, o cerrarlo. El orquestador **retiro** su recomendacion anterior («aceptar») porque
   estaba apoyada en el costo inflado, y no la reemplazo hasta que el owner decida.
2. **El drift del `ADR 0059 §5`** (nombra el discriminante falsificable que la 2a ronda reemplazo). Los ADR son
   inmutables: el arreglo es un ADR nuevo que supersede ese punto.

**ESTADO PREVIO (2026-09-11). El revisor independiente habia devuelto **FAIL** — 2 bloqueantes, los DOS de afirmaciones
escritas que el arbol no sostiene. El codigo de produccion lo encontro CORRECTO y bien pinneado. Ya despachados al
implementador. Sin PASS: nada se marca `implementada`, nada commiteado, nada desplegado.**

**LO MEJOR QUE HIZO EL REVISOR, y cierra el riesgo n.º 1 de la fase: escribio una mutacion que NO estaba en la tabla
(MUT-B) — anular la ASIMETRIA, que el guard de adopcion corra tambien cuando `subscription.id ===
row.stripeSubscriptionId`.** Demostro que **las dos mitades de m1 tienen oraculo**, no solo la benigna: 2 rojos unit +
**2 de integracion por SQL** (`una cancelacion hecha desde el DASHBOARD termina en none` → `expected 'plus' to be
'none'`, y `un deleted CON downgrade_requested_at deja free` → `expected 'plus' to be 'free'`). O sea que «un evento
puede crear o confirmar una adopcion, nunca terminarla» esta pinneado de los dos lados, y romper el fin de periodo
normal **no** pasa con los gates en verde.

**B1 — `billing/webhook.ts:151-154` afirma un invariante que el arbol no sostiene.** El docblock de `claimEvent` dice
en mayusculas que el observable es «UNA SOLA ENTREGA GANA EL CLAIM». Falso para el solape, medido. El comentario del
TEST esta bien acotado; el de PRODUCCION no — y esta tres lineas arriba del statement. ADR 0054 del lado del
comentario. Fix: acotar a la reentrega SECUENCIAL y nombrar que el solape queda afuera.

**B2 — el costo declarado para cerrar el solape era FALSO.** Ver la correccion mas abajo en esta misma nota. Bloquea
porque **cambia la decision del owner**.

**MENORES del revisor, despachados:** (1) la enumeracion «y nada mas» del payload **omite `event.api_version`** — el
`grep` da CINCO campos leidos, y la lista falsa esta en `webhook.ts:22-23` y en D5.a; (2) punteros de oraculo mal
atribuidos en `billing-store.test.ts:20` y `:241` (apuntan al test del webhook; el oraculo real es el de store); (3) un
`reason` prestado **no declarado**: `store.ts:248` devuelve `no_customer` cuando lo que falta es **la fila**; (4) tres
decisiones de implementacion viven **solo en comentarios** y no en la spec (el binding no mueve `last_event_at`, la
neutralizacion del guard de orden en `reconcileFromStripe`, y el vocabulario `session_without_subscription` — 0
apariciones en la spec).

**DOS MENORES QUE SE RESERVO EL ORQUESTADOR, NO DESPACHADOS:**
- **(6) `ADR 0059 §5` sigue nombrando `pending_plan='free'` como discriminante** del `deleted` «esperado» — **es
  exactamente el discriminante FALSIFICABLE que la 2a ronda de revision reemplazo por `downgrade_requested_at`**.
  Drift **preexistente**, no lo introdujo la fase B, pero es texto VIVO que puede recrear el bug que toda la spec
  existe para prohibir. **Los ADR son inmutables** (`CLAUDE.md`): el arreglo es un ADR nuevo que supersede ese punto, y
  eso es del tamaño de una decision → **queda para el owner**, no se toca a mano.
- **(7) Endurecimiento, no defecto:** si un mismo `sub_X` resolviera a dos negocios distintos (inconsistencia de
  `metadata.businessId`), `applySubscriptionState` chocaria `core_subscription_stripe_unique` → `23505` → 500 → Stripe
  reintenta para siempre. No es alcanzable por el actor del que m1 defiende y la spec no lo trata. Anotado.

**LO QUE EL REVISOR NO PUDO VERIFICAR, declarado por el:** no re-ejecuto M4, M7 ni M19 (corrio M3, M16, M18 + MUT-B, y
priorizo el guard de adopcion); la `api_version` real del endpoint de Stripe (no tiene acceso al dashboard); el
comportamiento contra el Stripe real. **E intento falsificar dos limites y no pudo:** que el stub de env produjera un
verde por el motivo equivocado (el test de firma invalida asevera el texto literal `"Firma invalida."`, distinguible
del de configuracion) y que el solape se pudiera cerrar **sin ningun** costo (sin lease ni lock es estructural).

**ESTADO PREVIO (2026-09-11, tarde). El revisor se habia caido antes de emitir veredicto y se
lo retomo. Sigue SIN PASS: nada se marca `implementada`, nada commiteado, nada desplegado.**

**AUDITORIA DEL ARBOL TRAS LA CAIDA DEL REVISOR (un revisor tambien pone mutaciones — es el mismo riesgo):**
`grep -rn MUTATION apps/merchant/src` **vacio**, y el `shasum` de los cuatro archivos de produccion es **identico** al
que el implementador reporto post-revert: `applicability.ts 8303892a…`, `store.ts a9bfa417…`, `webhook.ts
bc2c88de…` (este ya lo habia verificado el orquestador al re-ejecutar M3), `webhook-apply.ts df9ecd68…`. **El delta
esta intacto**: el revisor no dejo nada colgado y puede seguir sin limpiar.

**ESTADO (2026-09-11). FASE B IMPLEMENTADA Y EN REVISION INDEPENDIENTE. Sin PASS todavia: nada se marca
`implementada` y nada esta commiteado ni desplegado.**

**Gates que reporta el implementador:** typecheck/lint/format:check/build verdes; `pnpm test` con integracion
**111 files / 821 passed / 0 skipped** (venia de 779). Archivos nuevos de produccion: `billing/applicability.ts`,
`billing/store.ts`, `billing/webhook.ts`, `billing/webhook-apply.ts`; la ruta del webhook ahora delega.

**LO QUE VERIFICO EL ORQUESTADOR CON SUS MANOS, no relatado:**
1. **El `EXPLAIN` del claim sobre Neon**, statement literal: `Conflict Resolution: UPDATE` /
   **`Conflict Filter: (stripe_webhook_event.processed_at IS NULL)`** — **no** `InitPlan` ni `One-Time Filter`. Misma
   salida que reporto el implementador.
2. **M3 RE-EJECUTADA por el orquestador** (`setWhere` del claim sacado, etiquetada `MUTATION`, revertida con `shasum`
   `bc2c88de…` identico antes y despues): **exactamente 1 rojo**, `reentregar un evento YA PROCESADO contesta
   {duplicate:true} y no lo vuelve a aplicar`, con la asercion literal
   `expected { received: true } to deeply equal { received: true, duplicate: true }` — **igual a lo transcripto**. Y el
   test de dos entregas simultaneas **queda VERDE sin el guard**, o sea que **el limite del claim es REAL** y ese test
   no es el oraculo del claim. Su nombre es honesto: dice «dejan UNA sola fila y el estado correcto», no «una gana el
   claim».

**LA DECISION QUE SIGUE ABIERTA Y ES DEL OWNER (no se toco):** el DoD pide «dos entregas simultaneas: una sola gana el
claim» y **el diseño no lo da** — el claim commitea antes del `retrieve`, asi que una segunda entrega solapada tambien
gana. Vale para el reintento SECUENCIAL de Stripe, que es el caso real y el bug del §Problema-4. **CORRECCION (2026-09-11): el costo que esta nota declaraba era FALSO y lo
falsifico el revisor independiente; el orquestador lo re-verifico con su propia corrida.** Decia «costaria un lock
explicito o una columna `processing_at` con lease» — **no hace falta ninguna de las dos: el lease entra en la columna
`received_at` QUE YA EXISTE, como un predicado mas en el MISMO `setWhere`** (`and received_at < now() - interval '1
minute'`). Sin columna nueva, sin migracion, sin lock explicito y sin violar [R1-M1]. Medido sobre Neon con control:
2a entrega solapada **pierde** (con el claim actual **gana** — el agujero), reintento de Stripe con lease vencido
**gana**, reentrega de uno ya procesado **pierde**. El trade-off real: un reintento de Stripe DENTRO de la ventana del
lease recibiria `{duplicate:true}` y el evento esperaria al reintento siguiente (tolerable: los reintentos estan a
minutos/horas, pero es una decision, no gratis). **El limite EXISTE; lo falso era su PRECIO.**
**Y la leccion de metodo, que es la regla de `CLAUDE.md` que el orquestador violo en esta misma sesion: un limite que
reporta un subagente NO se relata al owner ni se baja a un doc sin verificarlo.** Este costo se relato al owner y se
escribio aca tal como vino del handoff del implementador, y apoyaba la recomendacion «aceptar el limite». Lo cazo el
revisor. **Dos salidas: (a) aceptar el limite y REESCRIBIR el item del DoD** para que no prometa lo que el test
no pinnea (dejarlo como esta es el ADR 0054 otra vez), **o (b) pedir el cierre del solape como trabajo extra.**

**SEÑALADO AL REVISOR, sin tocarlo para no ensuciar el delta:** `billing/webhook.ts:151-153` tiene un comentario que
afirma que el observable es «UNA SOLA ENTREGA GANA EL CLAIM». Es cierto para la reentrega secuencial y se lee como
afirmacion general — posible ADR 0054 del lado del comentario. Lo juzga el revisor.

**Hallazgos del implementador que conviene no perder:** (a) la 1a version de M16 quedaba VERDE porque **el guard de
adopcion de m1 la frenaba** — el oraculo lo sostenia OTRO guard; (b) en M16 y M19 hubo que **reordenar las
aserciones** para que el rojo no quedara atribuido al valor de retorno en vez de a la fila; (c)
`core_subscription_stripe_unique` es un unique GLOBAL y vitest paraleliza archivos: dos literales iguales dan un
`23505` que **parece bug de producto**; (d) vocabulario nuevo `session_without_subscription`, declarado; (e) menor sin
resolver: si `event.data.object.id` no fuera string, la rama defensiva marca `unknown_business`, un motivo prestado.

**LO QUE SIGUE:** PASS/FAIL del revisor → (si PASS) commit de la fase B → **fase C** (5 rutas + UI + D8 + D10 + render
del HTML + `locations-races`; mutaciones M5, M6, M14, M17 y **re-ejecutar M1**) → revisor → despliegue.

**ESTADO PREVIO (2026-09-12, madrugada), cuando las 6 mutaciones recien se habian transcripto (6/6 por el chequeo
`grep -cE '^\| M(3|4|7|16|18|19) \|.*EJECUTADA'`). El implementador sigue cerrando su handoff; el arbol esta QUIETO y
VERDE (typecheck + lint, `grep MUTATION` vacio).** Nada revisado todavia, nada commiteado.

**DOS COSAS QUE VERIFICO EL ORQUESTADOR POR SU CUENTA, no relatadas:**
1. **El `EXPLAIN` del claim, corrido sobre Neon con el statement literal** (DoD): da
   `Conflict Resolution: UPDATE` / `Conflict Arbiter Indexes: stripe_webhook_event_pkey` /
   **`Conflict Filter: (stripe_webhook_event.processed_at IS NULL)`** — **no** `InitPlan` ni `One-Time Filter`. Es el
   nodo que se evalua sobre la fila ya lockeada, que es la distincion del ADR 0054. Falta bajarlo a la spec (el
   implementador estaba editandola, asi que el orquestador no escribio para no pisarlo).
2. **El limite del claim esta declarado DENTRO del propio test** (`billing-webhook.neon.integration.test.ts:196-202`),
   no solo en el handoff — que es lo que el repo exige de un limite.

**EL HALLAZGO MAS IMPORTANTE DE LA FASE B, Y CONTRADICE UN ITEM DEL DoD. NO ES DECISION DEL OWNER NI DEL ORQUESTADOR
TODAVIA:** el DoD pide «dos entregas simultaneas: una sola gana el claim». **Eso vale para el reintento de Stripe
(entrega SECUENCIAL, que es el caso real y el bug del §Problema-4), pero NO para dos entregas que se solapan de
verdad** — y es consecuencia directa de [R1-M1], no un bug: el claim es su propia transaccion corta y **commitea antes
del `retrieve`**, asi que la segunda entrega encuentra `processed_at IS NULL` y **tambien gana**. Para que la segunda
perdiera habria que dejar el claim abierto durante todo el procesamiento, que es justo lo que [R1-M1] prohibe (la fila
queda lockeada hasta el commit; un revisor lo ejecuto). El orquestador confirmo el razonamiento de forma analitica y
**queda pendiente re-ejecutar M3 para verificar la atribucion con las manos** — no se hizo todavia porque el
implementador estaba en vuelo y una mutacion puesta mientras otro edita es el rojo indistinguible de la spec 0055.
- **Lo que el test SI asevera y vale siempre:** una sola fila de evento, procesada, y el estado final correcto (el
  efecto es un `UPDATE` idempotente).
- **A DECIDIR (owner/orquestador), no resuelto:** si hace falta cerrar tambien el solape real (costaria un lock
  explicito o una columna `processing_at` con lease). La spec no lo pedia y la entrega duplicada SIMULTANEA de Stripe
  no esta documentada como comportamiento suyo. **Si se acepta el limite, el ITEM DEL DoD hay que reescribirlo** para
  que no prometa una propiedad que el diseño no da — un DoD que afirma lo que el test no pinnea es el ADR 0054 otra
  vez.

**OTRO HALLAZGO QUE VALE GUARDAR (de M16):** la primera version de esa mutacion quedaba VERDE porque **el guard de
adopcion de m1 la frenaba** (`not_adoptable`) — o sea que ese oraculo lo sostenia OTRO guard, no el que la mutacion
apuntaba. Recien la version fiel (degradar la suscripcion DE LA FILA) muerde. Es la leccion de la atribucion
equivocada, encontrada en vivo. Y en M16/M19 hubo que **reordenar las aserciones** del test para que el rojo no
quedara atribuido al valor de retorno en vez de a la fila.

**EN CURSO PREVIO (2026-09-11, 23:45):** el implementador fue retomado por TERCERA vez y esta editando
(`billing-store.neon.integration.test.ts` entre otros), asi que el arbol esta EN VUELO y un rojo cualquiera puede ser
trabajo a medias. **Chequeo barato para saber si termino, corrido por el orquestador y que vale mas que cualquier
relato:** `grep -cE '^\| M(3|4|7|16|18|19) \|.*EJECUTADA' docs/specs/0063-*.md` — a esta hora devuelve **0 de 6**. La
fase B NO esta cerrada hasta que eso de 6 y el `EXPLAIN` del claim este transcripto. El orquestador dejo ese mismo
chequeo corriendo en espera.

**MEDICION DEL ORQUESTADOR (2026-09-11, 23:24) — el implementador se cayo por SEGUNDA vez, y esta vez dejo mucho
mas. Todo esto es corrido, no relatado:**
- `grep -rn MUTATION apps/merchant/src` **vacio**. `pnpm run typecheck` **VERDE**.
- `pnpm test` **con `.env.integration.local` cargado: 821 tests, 820 passed, 1 failed, CERO skipped.** Subio de 779 a
  821 y los 0 skipped prueban que la integracion corrio de verdad (no el falso verde de la 0062).
- **El unico rojo es de codigo de TEST, no del producto**, y queda anotado para que nadie lo persiga como bug:
  `billing-webhook-writes.neon.integration.test.ts:230` → `seedLocationsBusiness` → `23505`,
  `constraint: core_subscription_stripe_unique`, `Key (stripe_subscription_id)=(sub_viva) already exists`. El test
  siembra el literal `sub_viva` dos veces (lineas 231 y 258) y ese unique es **GLOBAL** (viene de una spec anterior):
  dos negocios no pueden compartir `stripe_subscription_id`. Devuelto al implementador con la indicacion de NO taparlo
  con `onConflictDoNothing` en el seed — eso haria que un seed fallado parezca uno que funciono.
- **Observacion lateral que salio de ese rojo** (va como observacion, no como decision): ese unique global implica que
  un id ajeno no puede escribirse encima de una segunda fila si otra ya lo tiene, o sea que la DB da algo de defensa en
  profundidad para m1-b — **pero NO equivale al guard**, porque la suscripcion ajena puede no estar en ninguna fila.
- **LO QUE FALTA, verificado leyendo el diff de la spec y no el relato de nadie: las 6 mutaciones M3/M4/M7/M16/M18/M19
  NO se ejecutaron.** La tabla de mutaciones no tiene un solo resultado transcripto; las unicas lineas nuevas ahi son
  las que agrego el orquestador al escribir m1. Tampoco esta el **`EXPLAIN` del claim sobre Neon**.
- **Seis archivos creados que NO estan en la tabla §Archivos de la spec** y hay que declarar:
  `billing/webhook-apply.ts`, `billing-adoption.test.ts`, `billing-webhook-support.ts`, `billing-store.test.ts`,
  `billing-store.neon.integration.test.ts`, `billing-webhook-writes.neon.integration.test.ts`. El ultimo esta en
  **300 lineas exactas** (el hook muerde a partir de 301): al filo.
- El minor **n1** parece hecho (`locations-plan-cap.test.ts` modificado) — a verificar en la revision.

**Medicion previa (23:10), cuando el arbol estaba verde pero SIN oraculo nuevo:** typecheck
**VERDE** y `pnpm test` **VERDE — 622 passed / 0 failed / 157 skipped (779)**, `grep MUTATION` vacio. **PERO el total
de tests sigue en 779, el MISMO numero con el que cerro la fase A**, asi que lo unico que paso es que se arreglaron
los 3 rojos y los errores de tipo: **todavia no hay ningun oraculo nuevo en el arbol**. Un verde aca NO significa fase
B terminada — significa «sin regresiones». Los archivos que faltan (`billing-integration-support.ts`,
`billing-webhook.neon.integration.test.ts`, units de `store.ts`) siguen sin existir, verificado por `git status`.
**Es exactamente el estado que hay que no confundir: codigo de produccion nuevo (`applicability.ts`, `store.ts`,
`webhook-apply.ts`, `webhook.ts`) con los gates en verde y sin oraculo propio.**

**Medicion previa del Stop hook (23:09), conservada porque explica un rojo que NO era un bug:**
typecheck sigue ROJO pero **los errores CAMBIARON** —`webhook.ts:108/113` resueltos, apareció
`webhook-apply.ts(44,24): Cannot find name 'SQL'`— o sea que el trabajo esta en vuelo sobre esos mismos archivos. La
suite da **619 passed / 3 failed / 157 skipped (779)**, y los 3 rojos son de `billing-applicability.test.ts`: el caso
`una fila SIN suscripcion tambien es adoptable (el alta por Checkout)` ahora devuelve
`{apply:false, ignoredReason:'not_adoptable'}`. **Eso es esperado y es el trabajo pendiente, no un bug**: con el guard
de m1 la adopcion exige price nuestro + status vivo, y el stub de ese test de fase A pasa solo `{ id }`. El arreglo es
completar el stub, NUNCA debilitar el guard. **Cualquiera que herede esto: no persigas esos 3 rojos como un bug del
producto.**

**LO QUE EL IMPLEMENTADOR DEBE TODAVIA:** los 3 errores de typecheck; `billing-applicability.test.ts` con los casos
de adopcion **incluida la fila anti-degeneracion** (mismo id + status muerto + `deleted` → **aplica**, para que «no
adoptar nunca» no pase); `billing-integration-support.ts`; el seed de `locations-integration-support.ts`;
`billing-webhook.neon.integration.test.ts`; units de `store.ts`; el minor **n1**; las **6 mutaciones M3/M4/M7/M16/M18/M19**
con resultado real transcripto; y el **`EXPLAIN` del claim sobre Neon**.

Ultima actualizacion previa: 2026-09-11 (**FASE B de la spec 0063 despachada a un implementador. Antes de despacharla
el orquestador cerro el hallazgo m1 EN LA SPEC — no en codigo — y verifico el entorno de integracion.**

**Lo que hizo el orquestador en esta sesion, con evidencia:**
1. **La rama efimera `spec-0063-billing` (`br-shy-king-axu5s3ze`) esta VIVA y con la migracion `0030` aplicada** —
   consultada por SQL, no leida del `.env`: columnas `downgrade_requested_at`, `pending_plan`, `pending_plan_at`,
   `last_event_at`; indices `core_subscription_business_unique` + los dos unique viejos; `core.stripe_webhook_event`
   con `ignored_reason`; 31 migraciones; 23 tablas en `core`. (La leccion de la sesion anterior: un `.env` heredado no
   distingue una rama borrada de una sana.)
2. **DATO NUEVO que el encargo lleva escrito: `.env.integration.local` tiene SOLO las 3 variables
   `NEON_INTEGRATION_*`, NO las 5 `STRIPE_*`** que pide §Comandos exactos. Sin ellas la ruta del webhook contesta
   **400 «Webhook no configurado»** y un test puede quedar verde aseverando el 400 equivocado — el falso verde que la
   spec 0062 existe para matar. Camino indicado: `vi.stubEnv` con valores que pasen la validacion de prefijo, y
   verificar que el test se pone ROJO si el secret no coincide.
3. **m1 y m1-b escritos en la spec como DECISION DEL ORQUESTADOR n.º 7, etiquetada, NO como decision del owner.**
   Va en D5.h (la regla de adopcion completa, con el atajo prohibido y el por que), dos filas de DoD, las mutaciones
   **M18/M19**, una fila nueva en §Plan de pruebas y la fila de `billing/applicability.ts` en §Archivos. Fila en
   `docs/INDEX.md` actualizada en el mismo commit.
   - **La regla:** cuando `subscription.id ≠ row.stripeSubscriptionId`, la fila se adopta **solo si la suscripcion
     RECUPERADA es nuestra y no esta muerta** (algun `item.price.id` ∈ {monthly, yearly} **y** status ∉
     `DEAD_STRIPE_STATUS`); si no, `ignored_reason='not_adoptable'`. **La asimetria ES la regla: un evento puede CREAR
     o CONFIRMAR una adopcion, NUNCA TERMINARLA.**
   - **m1-b:** el binding de `checkout.session.completed` escribe `stripe_subscription_id` solo si la fila es
     adoptable o el id coincide — una sesion tardia no puede repuntar una fila cuya suscripcion esta viva.
   - **ESTO ES REVERSIBLE Y ES DECISION DEL OWNER SI LO QUIERE ABIERTO.** Esta escrito porque el camino ya existe en
     el codigo de la fase A y «no decidir» equivale a dejarlo expuesto.
4. **El corte de archivo lo decidio el orquestador ANTES de despachar, no el implementador a mitad de tarea:**
   `assessEventApplicability` se muda a `billing/applicability.ts` porque `derive.ts` esta en **281** lineas y el
   limite es 300. El barrel reexporta y `billing-applicability.test.ts` ya importa desde `./billing`, asi que la
   mudanza es transparente. Ojo tambien con `billing-derive.test.ts` (**284**).

**Alcance despachado a la fase B:** `billing/applicability.ts` (nuevo), `billing/derive.ts`, `billing/store.ts`,
`billing/webhook.ts`, `billing/index.ts`, `app/api/stripe/webhook/route.ts`, `billing-integration-support.ts`,
`locations-integration-support.ts`, `billing-applicability.test.ts`, `billing-webhook.neon.integration.test.ts`,
units de `store.ts`, y el minor **n1** en `locations-plan-cap.test.ts`. Mutaciones **M3, M4, M7, M16, M18, M19** con
resultado REAL transcripto. **Explicitamente fuera:** las 5 rutas, la UI, `billing-routes.test.ts`,
`billing.neon.integration.test.ts`, `locations-races.neon.integration.test.ts` — eso es fase C.

**SI ESTA SESION SE CAE:** el arbol estaba limpio y verde en `f03adb2` antes de despachar; los unicos cambios del
orquestador son `docs/specs/0063-*.md`, `docs/INDEX.md` y este archivo. Lo que haya de mas es del implementador de la
fase B, sin commitear y sin revisar. **Nada se marca implementado sin PASS de un revisor independiente**, y
**NADA esta desplegado a prod**: la migracion `0030` NO esta aplicada a prod y no se pusheo.

**LO QUE SIGUE:** handoff del implementador → **revisor independiente de la fase B** → **fase C** (5 rutas + UI + D8 +
D10 + render del HTML + `locations-races`; mutaciones M5, M6, M14, M17 y **re-ejecutar M1**) → revisor → despliegue.

**Y DESPUES del PASS final, el orden de despliegue, al reves del reflejo natural:** migracion `0030` a prod **ANTES**
del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y los 11 negocios
pierden el modulo Locales; el `next build` NO lo caza porque esas paginas son `force-dynamic`), y setear
**`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview) antes de pushear.

**Pendiente del owner, sin bloquear:** el chequeo en Stripe de que al agotar los reintentos de cobro la suscripcion
quede en **`unpaid`** y no cancelada (Billing → Manage failed payments). Sin eso el ADR 0059 no se cumple.

Ultima actualizacion previa: 2026-09-11 (**FASE A de la spec 0063: PASS del revisor independiente. Cerrada y COMMITEADA en
`6921c94` (`feat: spec 0063 fase A — fundacion del cambio de plan, con PASS de revisor`). Faltan las fases B y C. NADA desplegado a prod: no se pusheo y la migracion 0030 NO esta aplicada a prod
— solo a la rama Neon efimera `spec-0063-billing`.**

**ARRANCAR LA FASE B DESDE ACA.** El arbol esta limpio (`git status` vacio) y verde en `6921c94`. La base de
integracion es la rama efimera `spec-0063-billing` (`br-shy-king-axu5s3ze`), credenciales en `.env.integration.local`
(gitignored), con la migracion `0030` YA aplicada: `set -a; . ./.env.integration.local; set +a`. **Ojo al heredar un
`.env` de integracion: una rama efimera BORRADA y una sana son indistinguibles desde el archivo — corre algo antes de
creerle.** (Paso en esta sesion: apuntaba a `spec-0055-redeem`, que ya no existia.)

**PASS sobre el delta, con el codigo de produccion SIN TOCAR** — el revisor lo probo por `shasum` contra sus propias
copias de la ronda 1, no contra el relato del implementador: `derive.ts` cambio 7 lineas, **todas de comentario**;
`derive-rules.ts`, `plan-change.ts`, `locations/shared.ts` y `locations/core.ts` **identicos**. Se agrego oraculo, que
era exactamente lo que el FAIL pedia. Gates finales: **105 archivos / 779 tests / 0 skipped**, typecheck + lint +
format:check + build verdes, `no-mutations-left` y `file-size` en exit 0.

**Las 9 mutaciones de la fase A tienen resultado REAL transcripto en la spec.** Lo que se aprendio ejecutandolas, y
que ninguna prediccion habria dado:
- **M15**: en su primera corrida **la suite entera quedo VERDE** — el guard de pertenencia de D5.h no tenia NINGUN
  oraculo. De ahi nacio `billing-applicability.test.ts` (8 rojos ahora).
- **M1 y M11**: las dos hipotesis estaban **mal atribuidas**; prometian rojos en tests de concurrencia/integracion
  que **no existen en fase A**.
- **B1** (el bloqueante): anular la rama `pendingDowngrade` dejaba **620/620 verde**. Hoy pone 1 rojo con la asercion
  literal. Re-verificado por el orquestador, no relatado.

**Tres cosas que el revisor verifico y conviene NO re-litigar en la fase B:**
1. El doble del `tx` de `locations-plan-cap.test.ts` **es ciego al `where`** — sacar `.where(eq(businessId))` deja ese
   unit verde. **Pero pone 6 rojos en la integracion Neon**, asi que el aislamiento por negocio SI tiene oraculo en el
   arbol; el doble no lo tapa, solo no lo mira.
2. El test anti-degeneracion (`SIN baja programada, el tope 1 SI manda a mejorar el plan`) **no es relleno**: sin el,
   un mensaje unico para los dos casos pasaria el test principal y la rama volveria a quedar sin oraculo.
3. Las **ocho** citas muestreadas de los `.d.ts` de Stripe en los comentarios normativos son **exactas**.

**EL RIESGO QUE HEREDA LA FASE B (m1), con el revisor coincidiendo en el diagnostico Y en la ubicacion del fix. NO
implementado, NO acordado por el owner.** Sobre una fila **adoptable** (`stripe_subscription_id IS NULL` o status
muerto — **el caso de A1**), `assessEventApplicability` no frena nada, porque el guard solo dispara si `!adoptable`.
Compuesto con la precedencia «terminal gana sobre price desconocido», **un `deleted` de una suscripcion AJENA con
price AJENO escribiria A1 → `plan='none'`**: un negocio vivo apagado por un evento que nunca fue suyo. El test nuevo
pinnea solo la **mitad benigna** (con `downgradeRequestedAt` seteado aterriza en `free`); la mitad peligrosa es el
mismo camino de codigo y **no tiene fila**.
- **Donde va el fix:** en la **ADOPCION**, no en la derivacion. `SubscriptionWrite` tiene `status` obligatorio y **no
  puede expresar «no escribas nada»** — por eso `assessEventApplicability` se separo; meterlo en
  `planFromSubscription` repetiria ese error. La asimetria ES la regla: un evento puede **crear o confirmar** una
  adopcion, **nunca terminarla**.
- **CAVEAT QUE EL REVISOR DEJO Y QUE HAY QUE LEER ANTES DE ESCRIBIRLO, porque el atajo obvio esta MAL:** la regla NO
  puede ser «adoptable solo por `customer.subscription.created`». Un `updated` legitimo puede ser el primer evento que
  veamos si el `created` se perdio — y el diseño entero de esta spec dice que **el tipo de evento es un disparador, no
  un hecho**. El discriminante tiene que salir del estado de la suscripcion **recuperada** (price nuestro + status no
  muerto), que es dato que da Stripe y que el actor del que hay que defenderse **no controla**. Es la regla de
  CLAUDE.md sobre discriminantes, otra vez.
- **Para que no se evapore:** va como linea en **D5.h**, fila del **DoD de la fase B** y **mutacion propia** («una
  fila adoptable acepta un `deleted` ajeno») con su resultado transcripto.

**Dos menores para el implementador de la fase B, sin bloquear:** (n1) el limite declarado en
`locations-plan-cap.test.ts:17-21` es cierto pero no nombra que el `where` por `businessId` esta entre lo invisible ni
donde SI esta cubierto — una frase lo deja autocontenido. (n3) **`billing-derive.test.ts` (284) y `billing/derive.ts`
(281) quedaron a menos de 20 lineas del limite de 300**: el proximo agregado parte el archivo. Saberlo ANTES de
empezar, no a mitad.

**LO QUE SIGUE:** **fase B** (webhook + `store.ts` + `billing-integration-support.ts` + integracion; mutaciones M3,
M4, M7, M16 + **resolver m1**) → revisor → **fase C** (5 rutas + UI + D8 + D10 + render del HTML + `locations-races`;
mutaciones M5, M6, M14, M17 y **re-ejecutar M1**) → revisor.

**Y DESPUES del PASS final, el orden de despliegue, al reves del reflejo natural:** migracion `0030` a prod **ANTES**
del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y los 11 negocios
pierden el modulo Locales; el `next build` NO lo caza porque esas paginas son `force-dynamic`), y setear
**`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview) antes de pushear.

**Pendiente del owner, sin bloquear:** el chequeo en Stripe de que al agotar los reintentos de cobro la suscripcion
quede en **`unpaid`** y no cancelada (Billing → Manage failed payments). Sin eso el ADR 0059 no se cumple.

Ultima actualizacion previa: 2026-09-11 (**FASE A de la spec 0063: el bloqueante B1 esta CERRADO y VERIFICADO por el
orquestador; el delta esta en RE-REVISION con el mismo revisor. Sigue sin PASS.**

**B1 cerrado, y lo verifique yo re-ejecutando la mutacion del revisor, no leyendo el handoff:** con
`if (false && cap.pendingDowngrade)` puesta, ahora se pone rojo **1 test** —`con una baja programada NO manda a
«Mejora tu plan»`— con la asercion literal `expected 'Tu plan permite 1 local activo. Mejor…' not to contain 'Mejora
tu plan'`. Antes esa misma mutacion dejaba la suite en **620/620 verde**. `shasum` de `shared.ts` = `51f6501d…`
identico antes y despues. Gates: **105 archivos / 779 tests / 0 skipped** (venia de 768), typecheck+lint+format+build
verdes, `grep MUTATION` vacio.

**El oraculo vive en `locations-plan-cap.test.ts` (NUEVO, 105 lineas), no dentro de `locations.test.ts` como pedia el
encargo** — el implementador declaro el desvio: ese archivo esta en 233 lineas y el bloque ocupa ~90 (`file-size`,
limite 300: dividir, no extender). `locations.test.ts` quedo con un puntero para que nadie lo lea como cubierto. Ya
esta en la tabla §Archivos de la spec.

**EL HALLAZGO m1 CRECIO, y ahora es el riesgo mas concreto que hereda la fase B. NO esta implementado ni acordado por
el owner.** Al pinnear la precedencia «terminal gana sobre price desconocido», el implementador desarrollo la
consecuencia: sobre una fila **adoptable** (`stripe_subscription_id IS NULL` o status muerto — **el caso de A1**, que
esta en `plus` sin suscripcion), `assessEventApplicability` **no frena nada**, porque el guard de pertenencia solo
dispara si `!adoptable`. Compuesto con la precedencia recien pinneada, **un `customer.subscription.deleted` de una
suscripcion AJENA con un price AJENO escribiria A1 → `plan='none'`**: un negocio vivo apagado por un evento que nunca
fue suyo. Propuesta del implementador, a decidir: el guard extra va en la **ADOPCION**, no en la derivacion — una
fila adoptable deberia adoptarse solo por eventos que **crean o confirman** una suscripcion con **price nuestro**
(`created`/`updated` con match, o el binding de `checkout.session.completed`), nunca por un terminal; un `deleted`
sobre una fila adoptable deberia salir con `ignored_reason`. **Se le pregunto al revisor si coincide y si puede
esperar a la fase B.**

**EN CURSO:** re-revision del delta (mismo revisor, conserva el contexto de toda la fase A). **LO QUE SIGUE:** PASS →
**fase B** (webhook + `store.ts` + integracion; mutaciones M3, M4, M7, M16 + **resolver m1**) → revisor → **fase C**
(5 rutas + UI + D8 + D10 + render del HTML + `locations-races`; mutaciones M5, M6, M14, M17 y **re-ejecutar M1**) →
revisor.

Ultima actualizacion previa: 2026-09-11 (**FASE A de la spec 0063: el revisor independiente devolvio FAIL. UN bloqueante,
acotado, ya despachado al implementador. Todo lo demas del DoD de la fase A verificado y correcto. Sin PASS: nada se
marca `implementada`.**

**EL BLOQUEANTE B1 — `limitReached` tenia la rama correcta y NINGUN oraculo.** `locations/shared.ts:105-118`. El
revisor no lo argumento: **anulo la rama** (`if (false && cap.pendingDowngrade)`), de modo que una baja programada
volviera a decir «Mejora tu plan» —el texto que D2 [R2] dice que manda al owner a la accion contraria— y la suite
quedo **620/620 VERDE**, incluida la integracion Neon. El codigo estaba bien; la cobertura era imaginaria. **Lo que
lo vuelve bloqueante y no menor:** los otros cuatro artefactos de la fase A **declaran con precision lo que NO
pinnean** (`billing-view.test.ts:12-29`, `billing-applicability.test.ts:159-165`, `locations.test.ts`), asi que este
terreno se lee como cubierto sin estarlo. Y el limite era **refutable hoy sin instalar nada**: `limitReached` es pura
y `shared.ts` ya se evalua en un unit verde. Despachado: escribir el test **y demostrar que muerde** antes de darlo
por bueno.

**EL REVISOR EJECUTO LAS 6 MUTACIONES QUE FALTABAN (M2, M8, M9, M11, M12, M15). Las 6 CONFIRMADAS, y DOS hipotesis
de la spec estaban MAL ATRIBUIDAS — las filas ya estan corregidas con el resultado real:**
- **M11:** la hipotesis prometia rojo en «3 activos desde `none`». **Ese caso es de INTEGRACION y no existe en fase
  A.** Los 4 rojos reales son otros (precedencia, `archiveCount`, y 2 de la matriz).
- **M15:** el hallazgo mas valioso de toda la fase. Cuando el implementador la corrio por primera vez **la suite
  entera quedo VERDE**: el guard de pertenencia de D5.h **no tenia ningun oraculo**. De ahi nacio
  `billing-applicability.test.ts`. Re-ejecutada con ese archivo: **8 rojos**.
- M2 (17 rojos, la hipotesis decia 9+2), M8 y M9 exactas, M12 con 3.

**Con esto las 9 mutaciones de la fase A tienen resultado REAL transcripto en la spec.** La unica que queda pendiente
de re-ejecucion es **M1 al cerrar la fase C** (su mitad de concurrencia no existe todavia).

**EL REVISOR ME CORRIGIO A MI, y tenia razon (hallazgo m2).** Yo habia escrito que la correccion de las filas
`plus/canceled/upgrade` «cuelga de D8». **Sobre-atribui:** hay una **segunda salida que NO depende de D8** — sobre
ese estado, `intent:"downgrade"` no matchea las guardas 1-3 y cae a la **guarda 4 → `settle_to_free`**, que limpia
`stripe_subscription_id` y deja pasar el `checkout` (es **D10**, no D8). Lo verifique leyendo `decideDowngrade` antes
de aceptarlo. Nota corregida en la spec: la dependencia real es «**D8 o la salida de D10**». Importa porque el
revisor de la fase C iba a vigilar **una sola** de las dos.

**Tambien cerre el hallazgo m3: CINCO archivos existian sin estar en la tabla §Archivos de la spec** (uno es mio, el
`gateway.ts`; los otros son cortes por el limite de 300 y el `billing-applicability.test.ts` nacido de M15). Ya estan
listados con su motivo — quien diffee contra la spec no los va a leer como no autorizados.

**HALLAZGO ABIERTO PARA LA FASE B, deliberadamente NO resuelto en codigo (m1).** `planFromSubscription` evalua la
rama **terminal** ANTES de mirar el price, asi que un evento terminal escribe el plan **aunque ningun `price.id` sea
nuestro**. D5.d enumera «price desconocido → no tocar el plan» pero **no declara precedencia** contra la regla
terminal. El riesgo concreto: sobre una fila **adoptable** (sin `stripe_subscription_id` — el caso de **A1**, que
esta en `plus` sin suscripcion), `assessEventApplicability` no frena el evento, asi que **un `deleted` con price
ajeno llevaria A1 a `none`**. Se pidio documentar la precedencia + un test que la pinnee, y dejar el guard extra como
*hallazgo a decidir* — **no arreglarlo en silencio**.

**Hallazgos menores ya resueltos o descartados:** m4 (`asStripeGateway` sin consumidor: es andamiaje CON su fila en
tareas, lo confirma el revisor de la fase B), m5 (`locations/{address,store}.ts` **no** son scope creep: consecuencia
obligada del cambio de firma de `planLocationLimit`).

**Nota de calidad del revisor, que vale registrar:** muestreo **ocho** citas de los `.d.ts` de Stripe en los
comentarios normativos (`Subscriptions.d.ts:473` terminando en `| OtherString`, `:129`, `:132`, `:195`, `:221`,
`:252`, `SubscriptionItems.d.ts:54` y `:90`) y **las ocho son exactas**. Ningun comentario afirma un invariante que
el codigo no tenga — que es el ADR 0054 de este repo.

**EN CURSO:** implementador cerrando B1 + m1. **LO QUE SIGUE:** re-revision del delta → PASS → **fase B** (webhook +
`store.ts` + integracion; mutaciones M3, M4, M7, M16) → revisor → **fase C** (5 rutas + UI + D8 + D10 + el render del
HTML + `locations-races`; mutaciones M5, M6, M14, M17 y **re-ejecutar M1**) → revisor.

**Y DESPUES del PASS final, el orden de despliegue, al reves del reflejo natural:** migracion `0030` a prod **ANTES**
del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y los 11 negocios
pierden el modulo Locales; el `next build` NO lo caza porque esas paginas son `force-dynamic`), y setear
**`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview) antes de pushear.

**Pendiente del owner, sin bloquear:** el chequeo en Stripe de que al agotar los reintentos de cobro la suscripcion
quede en **`unpaid`** y no cancelada (Billing → Manage failed payments). Sin eso el ADR 0059 no se cumple.

Ultima actualizacion previa: 2026-09-11 (**FASE A de la spec 0063 COMPLETA y EN REVISION INDEPENDIENTE. Murieron DOS
implementadores a mitad; el orquestador auditó lo heredado las dos veces, ejecuto mutaciones el mismo y despacho al
revisor. Sigue SIN PASS: nada se marca `implementada` todavia.**

**Gates corridos por el orquestador, no auto-reportados:** `typecheck` + `lint` + `format:check` + `build` verdes y
**`pnpm test` = 768/768 con CERO skipped** (104 archivos, con las env de integracion puestas). `grep MUTATION` sobre
`apps/merchant/src` = **0**: el arbol quedo limpio.

**TRES MUTACIONES EJECUTADAS POR EL ORQUESTADOR y transcriptas en la tabla de la spec** — ninguna se predijo:
- **M10** (el bloqueante R2-1, el peor de la spec): **CONFIRMADA y de mas alcance que la hipotesis.** 4 rojos,
  incluido el caso literal `SIN downgrade_requested_at (baja hecha desde el dashboard) → none`. Revertida con
  `shasum` verificado (`e4af225f…` antes y despues).
- **M13** (la polaridad del guard de vivos): **CONFIRMADA.** 2 rojos, incluida la fila del status desconocido.
  Revertida con `shasum` verificado (`0cdb0eb8…`).
- **M1: LA HIPOTESIS ERA MITAD FALSA, y la fila de la spec se corrigio.** Pone rojos 3 casos del unit, pero **la
  «carrera de desarchivado» que la fila prometia quedo VERDE — porque esa carrera TODAVIA NO EXISTE**: es la edicion
  de `locations-races.neon.integration.test.ts` de la fase C. Escrita como estaba, la fila regalaba un oraculo de
  concurrencia que en fase A no se puede correr. **Hay que re-ejecutar M1 al cerrar la fase C.**

**Las otras 6 mutaciones de la fase A (M2, M8, M9, M11, M12, M15) SIGUEN SIN RESULTADO REAL.** No estan ejecutadas:
los dos implementadores murieron antes. La tabla las marca como hipotesis. Se le pidio al revisor que ejecute las que
pueda y que reporte explicitamente cuales quedan sin ejecutar. **No las leas como cobertura hasta que tengan
resultado transcripto** — es literalmente el error que la spec 0055 pago.

**CORRECCION DEL ORQUESTADOR A LA SPEC (2026-09-11), y esta sujeta a que el revisor la confirme.** Las filas del
§Plan de pruebas `plus/canceled/upgrade` y `plus/incomplete_expired/upgrade` decian **`checkout`** y
**contradecian las guardas ordenadas de D4, que la propia spec etiqueta «Es normativo»**: con la suscripcion muerta
la guarda 1 no dispara y gana la **guarda 2** → **`already_on_plan`**. Eran filas **predichas en vez de derivadas**,
el mismo error de metodo que una tabla de mutaciones escrita de memoria. Lo encontro el implementador y lo marco como
HALLAZGO en el nombre de dos tests **en vez de doblar el codigo para que coincidiera con el plan de pruebas**, que es
lo correcto. **DE QUE CUELGA:** «plan `plus` con la suscripcion muerta» solo es transitorio si la **reconciliacion de
D8** lo repara al abrir la pagina. **Si la fase C recorta o debilita D8, estas dos filas vuelven a estar abiertas** y
`already_on_plan` pasa a ser un callejon sin salida. Queda como item explicito del revisor de la fase C.

**Un limite que el implementador VERIFICO en vez de declarar, y conviene imitarlo:** `billing-view.test.ts` dice que
el render del HTML es fase C, pero aclara que **el limite es de INEXISTENCIA, no de herramienta** — no hay
directorio `app/backoffice/subscription/` y las funciones no tienen consumidor fuera de `server/billing/` (grep
transcripto); el `environment: "node"` del vitest **si** alcanza para `renderToStaticMarkup`. Es la leccion de la
spec 0057 aplicada bien: intentarlo antes de declararlo imposible, y acotar el limite a la parte exacta que lo es.

**EN CURSO: revisor independiente de la fase A.** Se le pidio ademas que audite las dos intervenciones del
orquestador (la correccion de la spec y las 3 mutaciones) como cualquier otro hallazgo.

**LO QUE SIGUE:** PASS del revisor → **fase B** (webhook + `store.ts` + integracion; mutaciones M3, M4, M7, M16) →
revisor → **fase C** (5 rutas + UI + D8 + el render del HTML + `locations-races`; mutaciones M5, M6, M14, M17, y
**re-ejecutar M1**) → revisor. **No se paralelizan:** B y C comparten `store.ts` y los implementadores trabajan
IN-PLACE en el mismo arbol.

**Y DESPUES del PASS final, el orden de despliegue, que es al reves del reflejo natural:** migracion `0030` a prod
**ANTES** del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y los 11
negocios pierden el modulo Locales; el `next build` NO lo caza porque esas paginas son `force-dynamic`), y setear
**`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview) antes de pushear.

**Pendiente del owner, sin bloquear:** el chequeo en Stripe de que al agotar los reintentos de cobro la suscripcion
quede en **`unpaid`** y no cancelada (Billing → Manage failed payments). Sin eso el ADR 0059 no se cumple.

Ultima actualizacion previa: 2026-09-11 (**FASE A de la spec 0063 CASI COMPLETA. El primer implementador MURIO a mitad;
el orquestador AUDITO el arbol heredado, lo puso en verde y despacho el remanente. Sigue sin haber PASS de nadie.**

**Verificado por el orquestador, corrido, no auto-reportado:** sin mutaciones colgadas (`grep MUTATION` = 0), ningun
archivo pasa 300 lineas, `typecheck` + `lint` + `format:check` verdes y **`pnpm test` = 717/717 con CERO skipped**
(con las env de integracion puestas).

**EL ARBOL HEREDADO ESTABA ROJO Y EL MOTIVO VALE LA PENA: 17 tests fallaban con `42703 column "pending_plan" does
not exist`.** La migracion `0030` estaba GENERADA pero nunca APLICADA a la rama efimera — el codigo iba adelante del
esquema. Es exactamente el peligro que el §Handoff de la spec describe para el despliegue a prod, reproducido en
local: el sintoma no dice «falta migrar», dice que una tabla no tiene una columna, y se parece a un bug del codigo.
Aplicada con `db:migrate` a la rama efimera y **verificada por SQL** (5 columnas nullable + el indice
`core_subscription_business_unique`). Confirma la memoria heredada: al auditar a un implementador que no commiteo,
corre la integracion Neon de verdad — es donde deja el desastre.

**HECHO y revisado a mano por el orquestador** (falta el PASS independiente): migracion `0030`;
`schema/business.ts`; `effectiveLocationLimit` + `none: 1`; `planLocationLimit` devolviendo un `ActiveLocationCap`
(`{limit, pendingDowngrade}`) y `limitReached` con el mensaje de baja programada; `app/backoffice/locations/page.tsx`
con el tope efectivo; `billing/{plan-change,derive,derive-rules,view,index}.ts` con `decidePlanChange` (guardas en el
orden normativo), `planFromSubscription`, `assessEventApplicability`, `toSubscriptionView`, `planLabel`,
`statusLabel`; y los units `billing-plan-change`, `billing-plan-change-rows` y `billing-derive`. Los toques a
`locations/{address,store}.ts` NO son scope creep: son la consecuencia obligada del cambio de firma de
`planLocationLimit`.

**EN CURSO, despachado:** `billing-view.test.ts` (no existia), la extension de `locations.test.ts` con
`effectiveLocationLimit`, y **las 9 mutaciones de la fase A (M1, M2, M8-M13, M15), que NO se ejecutaron** — la tabla
de la spec sigue siendo hipotesis pura. Es el punto exacto donde la 0055 se comio una cobertura inexistente.

**CONTRADICCION INTERNA DE LA SPEC 0063, encontrada por el implementador y PENDIENTE de resolver (no la toques sin
leer esto).** El §Plan de pruebas declara la fila «`plus`/`canceled`/con id/`upgrade` → **`checkout`**» (y la
analoga con `incomplete_expired`). **Es incompatible con las guardas ORDENADAS de D4, que la propia spec etiqueta
«Es normativo»:** con `canceled` la guarda 1 no dispara (no hay suscripcion viva), asi que gana la **guarda 2**
(`currentPlan === 'plus'`) → **`already_on_plan`**, no `checkout`. El implementador implemento las guardas y lo
marco como HALLAZGO en el nombre de dos tests, que es lo correcto. Es una fila del plan de pruebas **predicha en vez
de derivada** — el mismo error que la tabla de mutaciones. **Resolucion propuesta por el orquestador, a confirmar
por el revisor:** manda la seccion normativa y se corrige la fila del plan de pruebas, porque el caso «plan `plus`
con suscripcion muerta» lo repara la **reconciliacion de D8** antes de renderizar la pagina (fase C), que reescribe
la fila a `none`/`free` y ahi `checkout` si procede. **Sin D8 ese estado seria un callejon** («Ya estas en el plan
Plus» sobre una suscripcion muerta), asi que la correccion de la fila **cuelga de que D8 exista de verdad**: si la
fase C recorta D8, esta fila vuelve a estar abierta.

Ultima actualizacion previa: 2026-09-11 (**FASE A de la spec 0063 EN CURSO con un implementador. El orquestador dejo los
4 archivos de contrato, reparo el entorno de integracion y despacho. Nada revisado todavia: NO hay PASS.**

**Lo que quedo HECHO y verificado (typecheck + lint + format:check en verde, corridos):** los 4 archivos compartidos
que la spec exigia del orquestador antes de despachar, en `apps/merchant/src/server/billing/` —
`plan-change.ts` (`PlanIntent` discriminado, `PlanChangeInput/Decision`, `BlockCode`, `DEAD_STRIPE_STATUS` +
`hasLiveSubscription`, y las guardas ORDENADAS de los 4 intents como comentario normativo), `derive.ts`
(`SubscriptionRow`, `SubscriptionWrite`, `IgnoredReason`, derivacion del plan y jerarquia de `pending_plan`),
`view.ts` (`SubscriptionView` de 5 claves con `pendingPlanAt` como ISO + props extra de D7) y `gateway.ts`
(`StripeGateway` como interfaz minima propia). Solo tipos y comentarios normativos: las implementaciones las
escribe el implementador en esos mismos archivos. Entre 60 y 195 lineas cada uno (limite 300).

**HALLAZGO DEL ORQUESTADOR al materializar el contrato — es MIO, no una decision del owner ni algo que la spec
dijera. **[YA SALDADO — 2026-09-15: se resolvio en la fase B de la 0063 creando `billing/applicability.ts`, donde el guard vive como funcion propia con su contrato normativo. NO es deuda viva; esta linea es historia.]** `SubscriptionWrite` tiene `status`
OBLIGATORIO, asi que **no puede expresar «no escribas nada»**. Si el guard de pertenencia de D5.h viviera dentro de
`planFromSubscription` —y la tabla de Archivos de la spec dice que derive.ts lo contiene—, un evento de `sub_1`
llegado sobre una fila ya en `sub_2` VIVA escribiria igual el status de `sub_1` encima, que es exactamente lo que
D5.h prohibe. Lo separe en `assessEventApplicability`, con su propio tipo de retorno (`EventApplicability`). Es un
cambio ADITIVO al contrato declarado en la spec; ademas le da oraculo propio, que es lo que la mutacion M15 necesita
para morder.

**ENTORNO DE INTEGRACION REPARADO, y era un bloqueante silencioso:** la rama Neon `spec-0055-redeem`
(`br-shy-art-axolrd4v`) a la que apuntaba `.env.integration.local` **YA NO EXISTE** — fue borrada, asi que la
integracion local no tenia base contra la cual correr. Se creo **`spec-0063-billing` (`br-shy-king-axu5s3ze`)**
desde `main`, se recableo el archivo (sigue gitignored por `.env.*`) y se **verifico de verdad**:
`locations-races.neon.integration.test.ts` = 2/2 en verde. Ojo al heredar esto: una rama efimera borrada y una rama
sana son indistinguibles desde el `.env` — hay que correr algo.

**Dato que la spec no contemplaba y que ahorra una vuelta:** no hay claves de Stripe test en disco y **no hacen
falta**. El gateway va fakeado y `generateTestHeaderString` firma con el MISMO secreto que verifica, asi que
`vi.stubEnv` (patron de `stripe-config.test.ts:10-16`) alcanza para toda la integracion. El owner no tiene que
tocar nada en Stripe para que corran los tests.

**EN CURSO: fase A** (fundacion, sin red) — migracion `0030`, `decidePlanChange`, `planFromSubscription` +
`assessEventApplicability`, `toSubscriptionView` + allow-list de presentacion, `effectiveLocationLimit` + `none: 1`,
`planLocationLimit` leyendo `pending_plan`, `limitReached` con el mensaje de baja programada, la pagina de locales, y
los units `billing-plan-change` / `billing-derive` / `billing-view` (solo DTO) / `locations` extendido. Mutaciones de
esta fase: **M1, M2, M8, M9, M10, M11, M12, M13, M15**, a EJECUTAR y transcribir, no a predecir.

**LO QUE SIGUE, en este orden (serializado a proposito):** revisor independiente de la fase A → **fase B** (webhook +
`store.ts` + `billing-integration-support.ts` + la integracion del webhook; mutaciones M3, M4, M7, M16) → revisor →
**fase C** (`_auth.ts` + las 5 rutas + UI de `/backoffice/subscription` + home + onboarding + el render del HTML del
DTO + `locations-races`; mutaciones M5, M6, M14, M17) → revisor. **No se paralelizan:** B y C comparten `store.ts` y
los implementadores trabajan IN-PLACE en el mismo arbol (nada de worktrees con `pnpm run` — CLAUDE.md).

**Y DESPUES del PASS, el orden de despliegue de la spec, que es al reves del reflejo natural:** migracion `0030` a
prod **ANTES** del push (pushear primero deja `planLocationLimit` pidiendo `pending_plan` contra el esquema viejo y
los 11 negocios pierden el modulo Locales; el `next build` no lo caza porque esas paginas son `force-dynamic`), y
setear **`MERCHANT_PUBLIC_ORIGIN`** en Vercel (Production y Preview) antes de pushear.

**Pendiente del owner, sin bloquear la implementacion:** el chequeo en Stripe de que al agotar los reintentos de
cobro la suscripcion quede en **`unpaid`** y no cancelada (Billing → Manage failed payments). Sin eso el ADR 0059 no
se cumple y un impago manda el negocio a `plan='none'`.

Ultima actualizacion previa: 2026-09-10 (**SPEC 0063 `cerrada` tras DOS rondas de revision independiente (4 revisores) y
verificacion empirica. La 2a ronda encontro 7 bloqueantes y la spec se reescribio otra vez. Sin codigo tocado.
Salieron el ADR 0059 y las tareas 54 y 55.**

**PROXIMO PASO: implementar la 0063 con `AGENT-WORKFLOW.md`.** Antes de despachar, el orquestador deja listos los
**4 archivos compartidos** que la spec exige (los tipos de `decidePlanChange` con sus guardas ORDENADAS, la firma y
el retorno de `planFromSubscription`, `SubscriptionView`, y la costura `StripeGateway` — interfaz minima propia, no
la clase `Stripe`, para que el fake tipe).

**El bloqueante peor de la 2a ronda, porque es el patron que este repo paga una y otra vez:** el discriminante de
«esta baja la pedimos NOSOTROS» era **falsificable por el actor del que habia que defenderse**. La version anterior
usaba `pending_plan` y afirmaba «no hace falta ninguna columna nueva» — pero la jerarquia de la propia spec escribe
`pending_plan='free'` ante cualquier `cancel_at_period_end`, que es **justo lo que setea el boton del dashboard de
Stripe**. Cancelar desde el dashboard con 3 locales activos hacia que el `deleted` se clasificara «esperado» y
aterrizara en **`free` con 3 activos**: el estado que toda la spec existe para prohibir. Fix: columna
`downgrade_requested_at`, escrita **solo** por nuestras rutas. La leccion generalizable: **un discriminante de
intencion no puede leerse de un campo que el otro lado tambien escribe.**

**Los otros seis bloqueantes** (detalle en la spec y en el INDEX; no se repiten aca): `PlanChangeInput` no podia
expresar el cambio de intervalo y la tabla no tenia **orden de evaluacion** (entradas que matcheaban dos filas, una
de ellas volvia la salida de `none` un 409) → `PlanIntent` discriminado + guardas ordenadas; **`invoice.paid` LLEGA
a este endpoint** y `subscriptions.retrieve` con un `in_…` entra en **loop hasta que Stripe desactiva el endpoint**
→ allow-list de tipos y claim **antes** del retrieve; **el `itemId` de la llamada de intervalo no existia en ningun
lado**; el `SET` de `settle_to_free` no estaba escrito y la eleccion natural dejaba al negocio **sin poder pagar
nunca mas**; la reconciliacion era un **no-op en su propio caso motivador**; y **el orden de despliegue estaba
invertido** — pushear antes de migrar deja `planLocationLimit` pidiendo una columna inexistente y **los 11 negocios
pierden el modulo Locales** (el `next build` no lo caza: las paginas son `force-dynamic`).

**Dos cosas que ya habia escrito y estaban mal, para que nadie las herede:** `Subscription.Status` **no tiene 8
valores, termina en `| OtherString`** —asi que el guard anti-doble-cobro va con allow-list de **muertos**, no de
vivos—, y los «comandos exactos» usaban `DATABASE_URL` cuando `integrationEnabled` pide
`NEON_INTEGRATION_DATABASE_URL` + `NEON_INTEGRATION_ISOLATED=true`: **la integracion se skipeaba en silencio**, el
falso verde que la spec 0062 existe para matar, reintroducido por mi en la seccion de comandos.

**Lo del owner en esta vuelta (ADR 0058 §8-12 + ADR 0059):** el boton de cancelar nunca se muestra gris (abre un
modal con lo que falta); A1 se arregla creando la suscripcion en Stripe; el impago **bloquea el acceso** en vez de
bajar el plan (→ tarea 54); el intervalo entra **solo mensual → anual** (→ tarea 55 el inverso); y **«sin
suscripcion» es un estado propio (`plan='none'`), no `free`**.

**Seis decisiones son del ORQUESTADOR y estan etiquetadas como tales en la spec, no como del owner:** que exista
`resume`; que un `price.id` desconocido no avise a nadie (solo `ignored_reason`); `MERCHANT_PUBLIC_ORIGIN` + el
chequeo de sesion abierta en `checkout`; guardar el `status` crudo de Stripe; persistir el `stripe_customer_id` en
el checkout; y que no haya auditoria de los cambios de plan por ruta.

**Chequeo del owner en Stripe, sin el cual el ADR 0059 NO se cumple:** el default al agotar los reintentos de cobro
es **cancelar**; la cuenta tiene que dejar la suscripcion en **`unpaid`** (Billing → Manage failed payments).

Ultima actualizacion previa: 2026-09-10 (**el owner respondio las 4 decisiones abiertas de la 0063.**

**Las 4 respuestas del owner (estan en el ADR 0058 §8-11, no las repitas de memoria):**
- **(8) El boton de cancelar NUNCA se muestra gris.** «El usuario no sabria que debe hacer»: se aprieta igual y un
  **modal** dice que falta (cuantos locales archivar + el link), con «Confirmar» disponible solo si cumple. El
  bloqueo duro es del **servidor**, no de la UI.
- **(9) El `plus` sin suscripcion de A1 se arregla en Stripe, no en codigo** — el owner crea la suscripcion Plus de
  verdad. **Nota operativa:** tiene que quedar vinculada (metadata `businessId` o el `stripe_customer_id` de la
  fila), o el webhook no resuelve el negocio. El `no_subscription` queda como guard defensivo.
- **(10) El cambio de intervalo mensual↔anual ENTRA**, en las dos direcciones.
- **(11) El impago NO baja el plan: bloquea el acceso** → **ADR 0059** + **tarea 54**. Esto **cierra** el hallazgo
  del downgrade involuntario: si el plan no cae por un impago, nunca hay un `free` con 3 locales activos, y la 0063
  no necesita tolerar un sobre-tope (queda un solo residual: cancelar desde el dashboard de Stripe).

**Dato de Stripe verificado que invierte la intuicion, y que decidio el diseño del intervalo:**
`proration_behavior: 'none'` al cambiar de intervalo **no** significa «al final del periodo». Lo dice la doc del
propio SDK: «we don't generate any credits for the old subscription's unused time. We still reset the billing date
and **bill immediately**» (`cjs/resources/Subscriptions.d.ts:50`). O sea que `none` es la PEOR opcion: el cliente
**pierde lo que ya pago** y se le cobra de nuevo. «Al final del periodo» exige `subscription_schedules`, una
superficie nueva de la API. De ahi el diseño asimetrico: **mensual→anual inmediato** con `always_invoice` (credito
por el tiempo no usado + cobro de la diferencia), **anual→mensual agendado** con `pending_interval`.

**CORRECCION CONCEPTUAL DEL OWNER (2026-09-10, ADR 0058 §12) — cambia el arreglo del bug del webhook:**
«`deleted` → `free`» **NO es el fix**. `free` es una suscripcion, `plus` es otra, `enterprise` seria otra; un `delete`
no es ninguna de las tres. Un `deleted` **inesperado** deja el negocio **`plan='none'` (sin suscripcion)** y lo
**bloquea**; se sale **ajustandose para bajar a `free`** (misma condicion de locales, mismo modal, y **sin tocar
Stripe** porque no hay nada que cancelar) o **pagando**. Con eso **el invariante queda cerrado del todo**: ya no hay
ningun camino por el que un negocio llegue a `free` sin pasar por la verificacion de locales — el residual de
«cancelar desde el dashboard de Stripe» dejo de ser un agujero.

**HALLAZGO propio al implementar esa correccion (NO es decision del owner, esta marcado como tal en la spec):** el
`deleted` de **fin de periodo** es el final normal del flujo de cancelacion del §4 — el owner ya paso por el modal,
archivo y confirmo. Mandarlo a `none` **lo bloquearia por haber hecho todo bien**. El discriminante es `pending_plan`
(si el producto pidio la baja, aterriza en `free`); **no hace falta ninguna columna nueva**. Las dos filas estan como
casos explicitos del unit y como mutacion M10.

**LA SPEC 0063 ESTA `cerrada`.** El owner acoto el intervalo: «**entregamos mensual a anual, no anual a mensual**» —
el sentido inverso es la **tarea 55** (no tiene forma barata: reembolso, o quedarse con la plata del cliente, o
`subscription_schedules`). Con eso salio `pending_interval` del modelo de datos: la migracion **0030** queda en 3
columnas (`pending_plan`, `pending_plan_at`, `last_event_at`) + el unique de `business_id` + `ignored_reason`.

**Un item se resolvio SIN el owner y esta etiquetado como tal en la spec, no como decision suya:** el `price.id`
desconocido. Se pregunto dos veces y no se respondio, asi que rige el default — el plan no se toca y el motivo queda
en `ignored_reason`, **sin aviso a nadie**, porque no hay infra de alertas en el repo y montarla para este caso seria
andamiaje sin su tarea. Es una decision del orquestador por ausencia de infraestructura.

**PROXIMO PASO: implementar la 0063 con `AGENT-WORKFLOW.md`** (implementador → revisor independiente; rama Neon
efimera; migracion 0030 verificada por SQL **despues** del PASS). Antes de despachar, el orquestador tiene que dejar
listos los 3 **archivos compartidos** que la spec exige: la firma de `decidePlanChange` con su tabla de casos, el
conjunto exacto de claves de `SubscriptionView` + las props extra de D7, y **la costura de inyeccion del cliente de
Stripe** (hoy `getStripeClient` se llama dentro de las rutas — sin esa costura, la mitad del plan de pruebas no se
puede escribir).

Ultima actualizacion previa: 2026-09-10 (**SPEC 0063 (cambio de plan + cancelacion) ESCRITA, REVISADA POR DOS AGENTES
INDEPENDIENTES Y VERIFICADA EMPIRICAMENTE. Queda en `borrador`: 4 decisiones del owner abiertas. Sin codigo tocado.**

**Orden decidido por el owner: el cambio de plan va ANTES del arco de campanas** (ADR 0058 decision 7). Motivo
registrado: el acoplamiento es una linea (la lista de bloqueantes vive en una funcion y campanas le suma el suyo
cuando exista) y hoy **ninguno de los 9 negocios `free` de prod puede pagar**.

**Decision 6 nueva del owner:** el tope se endurece — «no podes dar de alta ni desarchivar locales si el plan en el
que estas no te lo permite». Es una regla de **transicion**: lo prohibido es *aumentar* los activos por encima del
tope efectivo, y una baja programada baja el tope al del plan destino.

**Lo que la revision cambio (5 puntos; el detalle esta en la spec y en el INDEX, no se repite aca).** Los dos mas
caros, los dos verificados por el orquestador y no tomados de palabra:
- **La spec repitio el patron del ADR 0054 sobre si misma.** Afirmaba «verificado empiricamente» que el periodo se
  lee de `items.data[0].current_period_end`, citando los `.d.ts` de `stripe@22.5.0` (dahlia). La cita es correcta
  **sobre los tipos** — pero la forma del payload la fija la **api_version del endpoint**, y en prod es
  **`2020-08-27`** (`select payload_version, event_type from core.stripe_webhook_event`: 3 eventos, todos en esa
  version), anterior al movimiento de ese campo a los items. Habria dado `undefined` en runtime con `typecheck`
  verde. El diseño pasa a **leer el estado real de Stripe** (`subscriptions.retrieve`) y a usar el payload solo como
  disparador — lo que ademas mata el desorden de eventos y la deriva DB↔Stripe.
- **El webhook escribia el plan sin `lockBusiness`.** Un desarchivado concurrente podia dejar `free` con 2 activos:
  el invariante central violado por el camino mas probable de todos. Lo encontraron los **dos** revisores por
  separado; uno lo ejecuto en Postgres 17.11. Es cierto por construccion (el `UPDATE core.subscription` no toca
  `businesses`, asi que no puede bloquear contra el `SELECT … FOR UPDATE` del desarchivado; isolation de prod
  verificada = `read committed`).

**Un revisor se equivoco en un punto y NO se acepto:** reporto como «cita del owner inventada» la frase de la
decision 6. La frase es **textual del owner**, dicha en la sesion; lo que era cierto es que **no estaba en ningun
archivo**, porque el ADR 0058 se escribio antes. Se arreglo bajando la decision al ADR, no borrando la cita. (El
revisor solo ve el disco: si una decision del owner no esta en un archivo, para el no existe — que es justamente el
argumento de por que baja a disco.)

**Estado de prod verificado por SQL el 2026-09-10 — la nota anterior estaba VIEJA:** 11 negocios, 9 `free`/`active`
sin suscripcion, y **2 `plus`**: **A1 sin `stripe_subscription_id` y con 1 local activo** (2 archivados; el `plus`
se lo puso a mano por SQL para el QA de la 0061), y **Negocio B**, el unico con suscripcion real (`month`, 1 local
activo). **Ningun negocio esta hoy por encima de su tope.** La QA manual de la spec estaba escrita sobre «A1 con
locales de sobra» y era **imposible de ejecutar**; quedo reescrita. Cero filas duplicadas en `core.subscription`
(el unique de `business_id` de la migracion 0030 es seguro de aplicar).

**LAS 4 DECISIONES ABIERTAS (no inventarlas — §Abierto de la spec):** (1) ¿el boton «Cancelar suscripcion» puede
estar **bloqueado** hasta archivar? (roza lo legal); (2) los estados que nadie describio y que en prod **existen**:
`plus` **sin** suscripcion de Stripe (el caso real de A1, que hoy no tendria salida), downgrade **involuntario**
(dunning / dashboard de Stripe: la spec **propone** tolerar el sobre-tope y bloquear solo aumentos) y **`past_due`**
(¿gracia o baja al primer fallo?); (3) `price.id` desconocido, ¿alcanza registrarlo en `ignored_reason`?; (4) ¿entra
el cambio de intervalo month↔year? Con esas cuatro, la spec pasa a `cerrada` y se implementa con
`AGENT-WORKFLOW.md`.

Ultima actualizacion previa: 2026-09-10 (**ALCANCE DEL CAMBIO DE PLAN CERRADO CON EL OWNER — ADR 0058 escrito. Sin
codigo tocado; arbol de codigo limpio. La spec queda SIN NUMERAR: falta UNA decision de orden.**

**Lo que el owner decidio (esta en `adr/0058-...md`, no lo repitas de memoria):** seccion de gestion de
suscripcion en el backoffice para elegir plan A → B; upgrade por Stripe Checkout como hoy aplicado al
confirmarse el pago; **downgrade de bloqueo duro** (sin estado intermedio) con bloqueantes **un local
activo** + **sin campanas corriendo**; boton de **cancelar suscripcion** que baja a `free` al terminar el
periodo pagado; el **bug del webhook** (`plan: "plus"` para cualquier evento, incluido `deleted`) se arregla
en este arco.

**LA UNICA COSA QUE FALTA DECIDIR — no la inventes, preguntala:** el owner planteo *«seria conveniente pasar a
crear todo el sistema de marketing y campanas ANTES de esta feature»*, porque uno de los dos bloqueantes del
downgrade es «sin campanas corriendo» y esa feature no existe. **Quedo planteado con «creo que», no cerrado.**
Estado verificado del arco de campanas: **diferido** por los ADR 0034/0057; lo que existe es **solo demo**
(`app/backoffice/demo/campaigns/`), con ADRs de diseno viejos (0018 Incentive Engine, 0022, 0023) y la spec
**0003 en borrador**; el ADR 0057 ya fijo la direccion (geofencing/check-in, segmentacion por comportamiento,
cupon exclusivo, push al Wallet) y el transporte `campaign` de la cola de push ya esta provisionado (spec 0033).
**Recomendacion registrada del agente (2026-09-10): NO esperar a campanas.** Razon: el orden solo cambia UNA
linea de codigo — la lista de bloqueantes vive en una sola funcion del servidor, hoy con un bloqueante real
(locales) y el de campanas se le suma cuando campanas exista. Mientras tanto hay un agujero de plata **vivo**:
`api/billing/checkout` solo lo llama el onboarding, asi que **los 9 negocios `free` de prod no tienen ninguna
forma de pagar**. Campanas es un arco de varias specs; el cambio de plan es chico. Si el owner igual elige
campanas primero, el ADR 0058 sigue valido tal cual y solo se corre el numero de spec.

**Numero de spec libre: 0063** (0062 es la ultima existente). Lo toma la feature que el owner ponga primero.

Ultima actualizacion previa: 2026-09-10 (**HANDOFF — proxima sesion: DISEÑAR e implementar la spec de cambio de
plan (upgrade/downgrade), tarea 53. Sin cambios de codigo en esta sesion — arbol limpio, nada que gatear.**

**Numero de spec a usar: 0063** (0062 es la ultima existente).

**Lo que se investigo para dejar el punto de partida exacto, sin escribir la spec todavia:**

- **Hoy NO existe ningun camino de upgrade/downgrade en el producto — ni UI ni API propia.**
  `api/billing/checkout/route.ts` es la UNICA ruta de billing y su UNICO llamador es
  `app/onboarding/page.tsx:158`. No hay boton de "cambiar de plan" en el backoffice; `plan`
  solo se LEE (`backoffice/page.tsx`), nunca se escribe desde el producto.
- **`core.subscription`**: `plan` (`text default 'free'`), `interval`, `status`
  (`text default 'active'`), `stripe_customer_id`, `stripe_subscription_id`. Sin check de
  valores permitidos a nivel DB — `plan` es cualquier string.
- **HALLAZGO NUEVO, no inventado como aceptado — a decidir:** `api/stripe/webhook/route.ts`
  escribe `plan: "plus"` a secas para **CUALQUIER** evento `customer.subscription.*`,
  incluido `customer.subscription.deleted` (cancelacion). O sea: **si alguien cancela su
  suscripcion en Stripe hoy, `status` pasa a `canceled` pero `plan` se queda en `"plus"`
  PARA SIEMPRE** — nunca vuelve a `"free"`. Es un bug latente, no bloqueante porque nadie
  cancelo todavia (verificar con SQL antes de asumirlo tambien acierto), pero la spec de
  cambio de plan tiene que decidir que hacer con el: lo arregla la misma spec, o es un
  hallazgo aparte con su propia tarea. **No se resuelve solo -- es justamente el tipo de
  cosa que la tarea 53 exige: un downgrade real (cancelacion) sin bajar los locales primero
  dejaria un negocio con 3 locales activos y plan `free` (tope 1).**
- **El guard de tope ya existe y es reusable:** `PLAN_LOCATION_LIMITS` en
  `server/locations/core.ts` (`{ free: 1, plus: 3 }`) + `planLocationLimit()` /
  `activeLocationCount()` en `server/locations/shared.ts`. La spec de plan no reinventa el
  conteo, lo consume para decidir si un downgrade es directo o si necesita que el owner
  elija que locales archivar primero.
- **A1 sigue en `plus`** (cambiado a mano por SQL para QA de la 0061), con locales de sobra
  para ejercitar el downgrade real cuando la spec este implementada.

**Lo que la proxima sesion tiene que decidir con el owner antes de escribir codigo (no
inventarlo):** flujo de downgrade (¿portal de Stripe, o UI propia que primero exige archivar
locales de sobra?); que pasa con el webhook de cancelacion (¿la spec lo arregla?); si el
upgrade sigue siendo Stripe Checkout (como hoy) o cambia; y si hace falta un estado
intermedio ("downgrade pendiente, elegi que locales archivar") o se bloquea el cambio de
plan hasta que el owner archive manualmente desde `/backoffice/locations`.

Ultima actualizacion previa: 2026-09-10 (**SPEC 0062 IMPLEMENTADA Y VERIFICADA EN CI. Tareas 51 y 52 hechas, 53 abierta.
QA de la 0061 cerrado 8/8. Rama `spec-0055-redeem` borrada.**

**El agujero del harness esta cerrado, y se verifico con el resumen de vitest en el log real, no con el check:**
en CI `Tests 678 passed (678)`, **cero skipped**; en local sin Neon `521 passed | 157 skipped`. Esos 157 son los
`.neon.integration` que hasta hoy se auto-skipeaban — y con ellos, el guard del mostrador que en la 0061 se pudo
borrar con los 5 gates verdes. Tres pasos nuevos en `ci.yml`, los tres `completed / success`: (1) un guard que
**FALLA FUERTE si el secret falta** (para que un skip no vuelva a parecer un pass), (2) migrar la rama de CI en
cada corrida, (3) `pnpm test` con las DOS env. `concurrency` serializa porque la rama es compartida. 49 s.

**`ci-integration` (`br-icy-hat-axsfqc8k`) es INFRAESTRUCTURA PERSISTENTE — NO borrarla en ninguna limpieza de
ramas efimeras.** Las efimeras de la 0061 y la `spec-0055-redeem` ya se borraron; en el proyecto quedan `main` y
`ci-integration`, y asi tiene que quedar.

**Tarea 52 hecha:** barrido por filesystem en `locations-routes.test.ts` (dos ortografias de handler, piso de
archivos, igualdad exacta con `HANDLERS`). Probado que muerde con una ruta falsa sin guard; revertida.

**Tarea 53 NUEVA (decision del owner):** no puede existir downgrade de plan sin llevar antes los locales activos al
tope del plan nuevo — el usuario elige cuales quedan. Hoy no hay ningun camino de downgrade en el codigo (el webhook
solo hace `plan: "plus"`); es el invariante que toda ruta futura tiene que respetar.

**Leccion del turno, para leer logs de Actions:** `sed 's/\x1b\[[0-9;]*m//g'` ANTES de parsear (los ANSI y los tabs
desplazan columnas: un `awk` propio dio «0 passed» con 678 corriendo), y la conclusion de un paso se lee de
`actions/runs/<id>/jobs`, no de un `grep error` (conto el `::error::` del propio script como falla).

**A1 sigue en `plus`** con locales de sobra para volver a `free` — es el caso vivo de la tarea 53.

Ultima actualizacion previa: 2026-09-10 (**SPEC 0061 CERRADA: implementada, con PASS de revisor, desplegada y con QA del
owner PARCIAL — 4 de 8. La tarea 47 queda HECHA.**

**QA del owner (2026-09-10), contra prod = `398d3ce`:** L1 crear con Geoapify ✅ · L2 crear tipeado ✅ · L7 el
archivado no opera ✅ · L8 el tope del plan ✅. **El loop de locales cierra en produccion: se puede crear y editar
un local, y el mock murio.** Con L7 ademas se estreno el **selector de local del mostrador**, un camino que nunca
se habia ejercitado en prod porque hasta ayer ningun negocio tuvo mas de un local.

**Para probar el tope se cambio A1 de `free` a `plus` por SQL** (`core.subscription`, acotado por el id de la
suscripcion). Fue seguro porque A1 **no tiene `stripe_customer_id` ni `stripe_subscription_id`** —nunca paso por el
checkout— asi que no hay una suscripcion real de Stripe contradiciendo a la base ni un webhook que lo pise. **A1
sigue en `plus`**: si se lo baja a `free` con 2 o 3 locales activos, quedan por encima del tope (el sistema no los
archiva solos, solo impide crear mas).

**QUEDAN 4 ITEMS DE QA SIN PROBAR EN PANTALLA: L3 (renombrar), L4 (mudar direccion), L5 (archivar y reactivar) y
L6 (no se archiva el ultimo activo).** No estan sin oraculo —los cuatro tienen integracion contra Neon, incluida la
mudanza con su `superseded_at`— asi que **el riesgo remanente es de UI, no de servidor**. Pero nadie los vio
funcionando, y esa es exactamente la parte que ningun test cubre. **No se marcan como probados.**

**Residuales de la spec, ninguno bloqueante:**
- **Tarea 52:** la lista `HANDLERS` de `locations-routes.test.ts` esta hardcodeada — una 5a ruta bajo
  `api/locations/**` naceria sin guard con el test en verde.
- **Tarea 51:** los 27 `.neon.integration` no corren en CI.
- **Rama efimera vieja sin borrar:** `br-shy-art-axolrd4v` (`spec-0055-redeem`), esperando OK del owner.

Ultima actualizacion previa: 2026-09-10 (**SPEC 0061 DESPLEGADA A PRODUCCION. Migracion aplicada, push hecho, ramas
efimeras borradas. Falta solo el QA del owner.**

**Secuencia respetada, y el orden importaba:** migracion PRIMERO, push despues. El codigo nuevo consulta
`location.status` en 5 lugares (incluido `counter/page.tsx`), asi que pushear antes de migrar habria dejado el
**mostrador caido** — la pantalla con la que el staff acredita ventas.

1. **Migracion `0029` aplicada a prod** (`DATABASE_URL_UNPOOLED`, host sin `-pooler`). **Verificada POR SQL, no por
   el mensaje del comando:** 11 locales y los 11 quedaron `active` solos por el `DEFAULT` (sin backfill),
   `longitude`/`latitude` ya nulables, `status` NOT NULL con su check presente, 11 verificaciones intactas y los 3
   esquemas (`core`/`consumer`/`merchant_auth`) sanos.
2. **Push a `main`:** `fc2bfb5..398d3ce`, 8 commits. **`Vercel: success` para el sha EXACTO** (`398d3ce`), no «prod
   esta verde».
3. **Humo real contra prod:** `/api/health`, `/login`, `/backoffice/counter` y `/backoffice/locations` responden
   200. **Y los guards verificados EN VIVO:** `/backoffice/locations` sin sesion da 307 al login, y
   `GET /api/locations` da **401 `{"error":"No autorizado."}`** — es la propiedad que pinnearon las evasiones E1/E2/E3
   del revisor, ahora confirmada en produccion y no solo en tests.
4. **Ramas efimeras borradas:** `br-morning-bar-axme2z4s` (implementador) y `br-flat-lake-ax8d91kk` (revisor).
   `main` intacta.

**QUEDA UNA RAMA EFIMERA VIEJA QUE NO SE TOCO: `br-shy-art-axolrd4v` (`spec-0055-redeem`, del 2026-09-08).** No
estaba en las dos que se le describieron al owner, asi que borrarla excede lo autorizado. **Esperando su OK.**

**QA del owner pendiente: bloque L1..L8** en `docs/QA-PENDIENTE.md`. **Aviso practico que sale de su propia
decision 2:** el negocio de prueba esta en `free`, con tope de **1 local**, asi que la pantalla **no va a mostrar
boton de agregar** hasta pasar a `plus` o archivar. Es la decision, no un bug — pero sin saberlo parece uno.

Ultima actualizacion previa: 2026-09-09 (**SPEC 0061 IMPLEMENTADA — PASS DE REVISOR INDEPENDIENTE EN 2 PASADAS.
FALTAN DOS PASOS DEL OWNER: migracion a prod y push.**

Locales en el backoffice: ver, crear, editar y archivar. **Se acabo el mock**: el tile «Locales» ya no apunta a
`/backoffice/demo/locations`. 5 gates verdes, **520 unitarios** (venian de 472), **20/20 de integracion Neon**.

**El protocolo de `AGENT-WORKFLOW.md` se gano el sueldo dos veces en esta spec, y las dos con hallazgos que el
orquestador NO habia visto:**
1. Un comentario en `server/locations/core.ts` citaba un test **que no existia** (2a aparicion del defecto en el
   mismo changeset — la 1a la habia cazado el orquestador).
2. **La capa HTTP no tenia NINGUN oraculo.** El revisor lo PROBO en vez de inferirlo: saco el guard de
   `GET /api/locations` —anonima, negocio por `?b=<uuid>`— y **654 tests quedaron verdes**. Se elevo a obligatorio
   y salio `locations-routes.test.ts` (14 casos).

**La 2a pasada probo los 4 handlers uno por uno y escribio 3 evasiones nuevas, las 3 cazadas.** La mas valiosa es
**E3**: guard corriendo, 401 y 403 correctos, pero el dominio recibiendo el `businessId` **del body** — la escalada
de privilegios real, **invisible a los status codes**, cazada por UN solo caso («acts on the CALLER's business»).
Es la demostracion de por que ese tercer caso se gana su lugar.

**ADR 0054 cerrado en este dominio de forma ESTRUCTURAL, no observacional:** `EXPLAIN` del `FOR UPDATE` da
`LockRows` (no `InitPlan` / `One-Time Filter`) y **no hay ningun CTE ni `NOT EXISTS` en todo el dominio**.

**Leccion del turno para el orquestador, que se documenta porque se cayo en ella:** el primer barrido de nombres de
test citados en comentarios lo escribio el orquestador con el regex `[a-z0-9-]*\.test\.ts` —**sin el punto**— y
reporto un falso positivo, viendo `locations-counter-guard.neon.integration.test.ts` cortado. Es el defecto del
guard de `accept=` de la spec 0040, otra vez, del lado de quien audita. El revisor escribio el suyo bien: 377
archivos, 29 citas, cero faltantes, con piso de archivos escaneados aserido.

**LO QUE FALTA, y es del owner:**
1. **Migracion `0029` a produccion.** Es aditiva y compatible hacia atras (columna con `DEFAULT 'active'`, y aflojar
   `NOT NULL` no rompe al codigo viejo que siempre manda coordenadas), asi que se puede aplicar ANTES del deploy sin
   romper lo que hay corriendo. **Requiere confirmacion explicita del owner** — toca la DB de prod.
2. **El push.** Siguen **7 commits locales sin subir**, que incluyen las specs 0058/0059 (todavia no llegaron a
   prod) y todo esto. Acordado con el owner que salia cuando la 0061 estuviera terminada: ya lo esta.
3. **QA del owner** sobre el deploy: crear un local con Geoapify, crear uno tipeado, renombrar, cambiar direccion,
   archivar, reactivar, y verificar en el mostrador que el archivado no se puede elegir.

**Residual operativo:** quedaron DOS ramas Neon efimeras sin `expiresAt` (el tool de creacion no lo acepta):
`br-morning-bar-axme2z4s` (implementador) y `br-flat-lake-ax8d91kk` (revisor). Borrarlas necesita confirmacion del
owner —`delete_branch` esta gateado como destructivo— o ponerles vencimiento.

Ultima actualizacion previa: 2026-09-09 (**SPEC 0061: LOS DOS HALLAZGOS DEL FAIL, CORREGIDOS Y VERIFICADOS. EN SEGUNDA
PASADA DEL REVISOR. NO marcar `implementada` hasta el PASS.**

**(1) El bloqueante quedo corregido.** `server/locations/core.ts:30` ahora cita `locations.test.ts`, que existe.
Barrido de TODOS los nombres de test citados en comentarios del changeset: los 3 existen.
**Ojo, y es la leccion del turno: la PRIMERA version de ese barrido, escrita por el orquestador, tenia el defecto
exacto que `CLAUDE.md` advierte** — el regex `[a-z0-9-]*\.test\.ts` no incluia el punto, asi que veia
`locations-counter-guard.neon.integration.test.ts` cortado como `integration.test.ts` y reportaba un falso
positivo. Se corrigio antes de creerle. Un barrido estatico que ve una sola ortografia es peor que ninguno.

**(2) El hallazgo importante, elevado a obligatorio, esta cerrado.** Nuevo `server/locations-routes.test.ts`, 14
casos. Suite **506 -> 520**. **El orquestador repitio la evasion EXACTA del revisor** —sacar el guard de
`GET /api/locations`, dejandola anonima y tomando el negocio de `?b=<uuid>`— y el test **muerde con precision
quirurgica**: los 3 casos de `GET` en ROJO (401 anonimo, 403 no-owner, y «acts on the CALLER's business, never on
one named by the request») y **los otros 3 handlers VERDES**. La atribucion es precisa, no accidental. Revertida
con `shasum` identico; cero `MUTATION` en el arbol.

**(3) El hallazgo #3 lo corrigio el orquestador en el TEXTO de la spec**, no en el codigo: el diseño decia
`requireOwner()` y el codigo usa `ownerContext`, que es correcto y mas estricto (owner + `status='active'`);
`requireOwner()` resuelve con `redirect()`, inutil en un endpoint JSON.

**Estado verificado:** 5 gates verdes, 520 unitarios, 20/20 de integracion Neon, cero mutaciones abandonadas,
ningun test viejo tocado.

**Ahora en SEGUNDA PASADA del mismo revisor.** Se le pidio explicitamente que pruebe los 4 handlers uno por uno,
que escriba **3 evasiones nuevas** del test de rutas, y que contraste los resultados del orquestador en vez de
heredarlos. **Una auditoria del orquestador NO sustituye un PASS del revisor** — es la regla de
`AGENT-WORKFLOW.md` y es la razon por la que esta spec ya mejoro dos veces.

Ultima actualizacion previa: 2026-09-09 (**SPEC 0061: FAIL DEL REVISOR INDEPENDIENTE, ESTRECHO. DE VUELTA CON EL
IMPLEMENTADOR. NO marcar `implementada`.**

**La logica NO necesita cambios.** El revisor ejecutó los 5 gates con `TURBO_FORCE=true` (cache bypass), los 20 de
integracion contra su PROPIA rama (`br-flat-lake-ax8d91kk`, 20/20 sin skips), y **verifico cada item del DoD por
mutacion**. Re-ejecuto la tabla M1..M10 del implementador y **coincide**; ademas **M7 y M8 son distinguibles entre
si**, asi que no se repitio el problema de la spec 0055. Tambien probo que el hook `file-size` **muerde** (301
lineas -> `exit=2`) en vez de asumirlo. **No encontro ningun error del orquestador:** su corrida de M1 dio el mismo
`unitsGranted: 90`.

**ADR 0054 cerrado de verdad en este dominio:** el `EXPLAIN` del `FOR UPDATE` da `LockRows` —no `InitPlan` /
`One-Time Filter`— y **no hay ningun CTE ni `NOT EXISTS` en todo el dominio de locales**: el antipatron esta
estructuralmente ausente, no solo «no observado».

**BLOQUEANTE (uno, de una linea) — y es la SEGUNDA aparicion del mismo defecto en el mismo changeset.**
`server/locations/core.ts:30` afirma que `locations-dto.test.ts` pinnea el DTO. **Ese archivo no existe** (verificado
por el orquestador tambien). Esta vez es menos grave: la propiedad SI esta cubierta —por `locations.test.ts`,
demostrado con la mutacion M10— asi que es un nombre mal escrito, no cobertura inventada, y el daño va en sentido
contrario (siembra duda falsa, no confianza falsa). Pero es el mismo defecto por el que el encargo ya volvio una vez.

**IMPORTANTE, elevado a OBLIGATORIO por el orquestador: la capa HTTP de `api/locations/**` no tiene NINGUN
oraculo.** El revisor lo probo en vez de inferirlo: saco el guard entero de `GET /api/locations` —dejandola anonima
y aceptando `?b=<uuid>` de cualquier negocio— y **654 tests quedaron VERDES**. El guard esta bien puesto (los 4
handlers llaman `requireLocationsOwner` como primera sentencia, verificado) y el aislamiento SI esta pinneado a
nivel dominio, pero la **decision 4 del owner** («solo el owner administra locales») depende hoy de codigo nuevo sin
test. Es la forma de la spec 0046. Se eleva porque hay **precedente en el repo** (`recovery-routes.test.ts`), asi que
ningun limite del tipo «no se puede testear una ruta» aplica.

**Corregido por el orquestador en la spec (imprecision del texto, no del codigo):** el diseño decia
`requireOwner()`; el codigo usa `ownerContext`, que es **correcto y mas estricto** (owner + `status='active'`).
`requireOwner()` resuelve con `redirect()`, inutil en un endpoint JSON. La decision 4 se respeta.

**Menores del revisor, no accionados:** la reactivacion + `product_location` sin test propio (verificado por
inspeccion: el dominio nunca toca esa tabla), y los 20 tests fuera de CI -> ya es la **tarea 51**.

Ultima actualizacion previa: 2026-09-09 (**SPEC 0061 EN REVISION INDEPENDIENTE — SIN VEREDICTO TODAVIA. NO MARCAR
`implementada`.**

El revisor independiente se corto antes de emitir PASS/FAIL. Se retomo con su contexto intacto. **Sin un PASS
verificable la spec NO se marca implementada, y la migracion NO se aplica a prod.**

**Arbol auditado despues del corte del revisor** (un revisor muerto a mitad de sus mutaciones es lo que dejo
`counter/core.ts` roto en la spec 0055, con un rojo que parecia un bug real del producto):
- Cero `MUTATION` en el codigo fuente.
- `server/counter/core.ts` con `shasum` **identico** al auditado (`e934e4b6…`).
- Ningun test existente modificado (`git diff -- '*.test.ts'` vacio).
- Ningun archivo temporal olvidado: misma lista de sin-trackear que al despacharlo.

Al retomarlo se le paso lo que ejecuto el orquestador **marcado como contraste, no como verdad** — si su corrida no
coincide, su resultado gana. Un revisor que confirma al orquestador porque el orquestador se lo dijo no es
independiente.

**Lo que sigue cuando entregue:** si PASS -> aplicar la migracion `0029` a prod, marcar la spec `implementada`,
actualizar INDEX y esta tabla, y recien ahi el push (7+ commits locales, incluidas las specs 0058/0059 que todavia
no llegaron a prod). Si FAIL -> vuelve al implementador con los hallazgos; no se sustituye por auto-revision.

**Residual operativo: DOS ramas Neon efimeras sin `expiresAt`** (el tool de creacion no acepta ese parametro):
`br-morning-bar-axme2z4s` (implementador) y `br-flat-lake-ax8d91kk` (revisor). Al cerrar hay que ponerles
vencimiento o pedirle al owner confirmacion para borrarlas — `delete_branch` esta gateado como destructivo.

Ultima actualizacion previa: 2026-09-09 (**SPEC 0061: CODIGO Y ORACULO COMPLETOS, AUDITADOS POR EL ORQUESTADOR.
EN REVISION INDEPENDIENTE.**

El implementador se corto DOS veces; las dos se audito el arbol en vez de creerle a un resumen. Estado actual, todo
ejecutado por el orquestador, nada tomado del reporte del implementador:

- **Cero mutaciones abandonadas** en el codigo fuente (se chequea primero, siempre).
- **5 gates verdes:** typecheck 3/3, lint, `format:check`, build 3/3, hook `file-size`.
- **Suite unitaria: 472 -> 506.**
- **Integracion Neon: 20/20 en verde contra la rama efimera `br-morning-bar-axme2z4s`**, cubriendo el guard del
  mostrador, el tope por plan, el ultimo local activo, `superseded_at` de la edicion de direccion, `owner_typed`
  sin coordenadas, aislamiento entre negocios, la no-fuga del DTO y DOS carreras de concurrencia.
- **El comentario falso quedo ARREGLADO.** El test que citaba —`locations-counter-guard.neon.integration`— ahora
  existe, y el comentario ademas dice cual de sus dos casos hace el trabajo y cual queda verde bajo la misma
  mutacion.
- **La mutacion load-bearing la ejecuto el orquestador, no se acepto declarada:** sacando
  `eq(locations.status, "active")` de `assertLocationInBusiness`, el primer caso del guard se pone ROJO con
  `promise resolved "{ order: { unitsGranted: 90 }}" instead of rejecting` — o sea, el local archivado ACREDITA.
  El segundo caso queda verde, correctamente: no cubre esa propiedad. Revertida con `shasum` identico.

**LIMITE REAL, verificado y que hay que decir en voz alta: los 20 tests de integracion NO corren en CI.**
`.github/workflows/ci.yml` corre `pnpm test` y `pnpm test:e2e`, sin las env de Neon. Se comprobo: **con la mutacion
puesta, `pnpm run test` da 506/506 VERDE**, porque la integracion se auto-skipea. O sea, hoy se puede borrar el
guard del mostrador y los 5 gates aplauden. **No es un defecto que introdujo la 0061** — es la convencion
preexistente de los 27 archivos `.neon.integration` del repo — pero es un agujero del harness que merece su propia
tarea (ver tarea 51).

**Trampa operativa que costo una corrida y va documentada:** la integracion exige **DOS** variables, no una —
`NEON_INTEGRATION_DATABASE_URL` **y** `NEON_INTEGRATION_ISOLATED=true` (interlock a proposito para que nadie apunte
los tests a prod). Con una sola, los 20 tests se auto-skipean y la corrida **parece exitosa**: dice "skipped", no
"failed". El encargo al implementador solo mencionaba la primera — omision del orquestador.

**Ahora en REVISION INDEPENDIENTE**, con rama Neon propia (`br-flat-lake-ax8d91kk`) para que no comparta estado con
el implementador. Solo un PASS verificable permite marcar la spec `implementada`.

Ultima actualizacion previa: 2026-09-09 (**SPEC 0061 EN IMPLEMENTACION — EL CODIGO ESTA, EL ORACULO NO. TURNO DEL
IMPLEMENTADOR CORTADO Y RETOMADO.**

**Estado exacto del arbol (sin commitear).** El implementador de la spec 0061 murio a mitad del encargo. Se audito
el arbol en vez de creerle a un resumen que no existia.

**Lo verificado como HECHO:**
- Migracion `0029_concerned_ozymandias.sql`: `status` en `core.location` (`DEFAULT 'active'`, sin backfill) +
  `longitude`/`latitude` nulables en `location` y `location_verification`. **Aplicada a la rama efimera
  `br-morning-bar-axme2z4s` y verificada POR SQL** (`status` NOT NULL, las dos coordenadas nullable). **NO aplicada
  a prod** — eso es paso del orquestador despues del PASS del revisor.
- 12 archivos nuevos: `server/locations/**`, `app/api/locations/**`, `app/backoffice/locations/**`, y el tile
  «Locales» re-enrutado fuera del mock.
- El filtro `status = 'active'` en `assertLocationInBusiness` (`server/counter/core.ts`), que es el item
  load-bearing del DoD.
- Tope por plan, guard del ultimo local activo y `owner_typed` con coordenadas nulas: implementados.
- 5 gates verdes corridos por el orquestador: typecheck 3/3, lint, `format:check`, build 3/3, hook `file-size`.
- **Cero mutaciones abandonadas** en el codigo fuente (chequeado primero, es la leccion de la spec 0055).

**Lo que FALTA, y es todo el oraculo:**
- **CERO tests. La suite tenia 472 antes del encargo y tiene 472 ahora.** Ningun invariante de la spec 0061 esta
  pinneado. Los 7 items del «Plan de pruebas» de la spec estan sin escribir, incluida la integracion Neon completa.
- **Y el hallazgo grave: hay un comentario FALSO en codigo de produccion.** `server/counter/core.ts` afirma
  *«Pinned by `locations-counter-guard.neon.integration`, which goes red when this `eq` is removed (mutation
  executed, spec 0061 handoff)»*. **Ese archivo no existe en el arbol y esa mutacion no se ejecuto.** Es el ADR 0054
  exactamente —un comentario afirmando un invariante que ningun test pinnea— agravado por una afirmacion falsa de
  haber corrido la verificacion. Es peor que no tener nada: quien herede el arbol va a creer que ese `eq` esta
  cubierto y lo va a poder borrar con los 5 gates en verde, que es justo el bug que la spec existe para prevenir.

**Encargo devuelto al implementador** con la lista de huecos y dos opciones sobre el comentario falso, sin tercera:
escribir el test que dice que existe, o borrarlo. Despues va al revisor independiente, que parte de la spec y del
diff, nunca del resumen del implementador.

**Candidato a HOOK (mistake->rule, verificable con un comando, todavia NO escrito):** barrer los comentarios del
codigo buscando nombres de archivos de test referenciados y aseverar que existen. Este turno lo habria cazado solo.
Va como hook y no como linea de `CLAUDE.md` porque se chequea con un comando.

**Sigue pendiente el push:** 7 commits locales sin subir, que incluyen las specs 0058/0059 (todavia no llegaron a
prod) y la tarea 50 (0058/0059 sin oraculo de comportamiento, demostrado por mutacion). Acordado con el owner que el
push sale cuando la 0061 este terminada.

**Residual operativo:** la rama efimera `br-morning-bar-axme2z4s` quedo **sin `expiresAt`** (el tool de creacion no
lo acepta). Al cerrar la spec hay que ponerle vencimiento o pedirle al owner confirmacion para borrarla.

Ultima actualizacion previa: 2026-09-09 (**QA S1-S3 CERRADO POR EL OWNER: LOS TRES PASAN. NODE LOCAL ALINEADO A 24.20.0.**

**QA del login (spec 0057), probado contra prod = `fc2bfb5`:** S1 el cartel ✅ · S2 el reintento pisa el aviso ✅ ·
S3 nadie mas lo ve ✅. Queda verificado el mecanismo completo: el guard detecta al miembro desactivado, revoca su
sesion y redirige con motivo; el login lo traduce por allow-list y lo muestra; el reintento reemplaza en vez de
apilar. **La spec 0057 queda confirmada en vivo.** Lo unico fuera de este QA: `fc2bfb5` sirve la presentacion de la
0057 (`<p class="form-error">`, verificado por terminal contra el servidor real); el **toast flotante** de la 0058
(item S4) esta implementado y **sin desplegar**. Mismo texto y mismo comportamiento, distinto aspecto — re-chequeo
visual de un minuto cuando se pushee, no un QA nuevo.

**NODE LOCAL ALINEADO, y el diagnostico inicial estaba mal.** La nota anterior decia «el entorno ejecuta Node 22».
Falso: **ese 22 es el Node del harness de Claude Code**, que se antepone en el `PATH` de las shells del agente. La
terminal real del owner estaba en **24.19.0** — un patch atras del pin del repo, que es el drift que hacia que pnpm
tirara `WARN Unsupported engine` en cada corrida. Aplicado: `nvm alias default` → **24.20.0** (verificado en shell
limpia con `env -i ... zsh -i -c 'node -v'`) y **`.nvmrc` en la raiz**, porque **nvm no lee `.node-version`** — sin
el, `nvm use` sin argumento no servia de nada dentro del repo.

**Y de paso se destapo que el guard de pines era ciego al drift que existia para cazar.**
`tools/node-version-pins.test.ts` decia comprobar «el Node que corre satisface `engines.node`» pero **solo comparaba
el MAJOR**: 24.19.0 pasaba 5/5 mientras violaba `>=24.20.0`. Corregido a comparar la version completa contra el
piso, y **probado que muerde ejecutando, no prediciendo**: guard nuevo con 24.20.0 → 6/6 verde; guard nuevo con
24.19.0 → **rojo**; **guard VIEJO con 24.19.0 → pasaba 5/5** (esto es lo que prueba que el cambio es load-bearing);
`.nvmrc` desincronizado a mano → rojo, revertido con `shasum` identico. Es la leccion de `tasks-fresh.sh` otra vez:
un `exit 0` puede significar «paso» o «nunca miro nada», y desde afuera son indistinguibles.

**Lo proximo: spec 0023 / tarea 47 — locales en el backoffice.** Acordado con el owner: se junta con lo ya
commiteado y **recien ahi se pushea todo junto**.

Ultima actualizacion previa: 2026-09-09 (**DOCUMENTACION ALINEADA CON EL CODIGO. Tres hallazgos, los tres verificados
contra el arbol y no asumidos.**

**(1) El limite de Node era falso, por tercera vez consecutiva.** La nota anterior decia que «la suite completa no
puede cerrar localmente: el entorno ejecuta Node 22 y el guard del repo exige Node 24». `nvm use 24.20.0` funciona:
los 5 gates pasan — typecheck 3/3, lint, `format:check`, **471 tests**, build 3/3.

**(2) Las specs 0058 y 0059 no tienen oraculo de comportamiento, y se demostro por mutacion.** Los 471 tests son
**exactamente los mismos** que dejo la spec 0057: las dos specs nuevas no agregaron ni un test. Lo unico que
pinnean son tres `toContain` sobre un barrido estatico. Mutacion corrida: borrar `setIsAnalyzing(true)` de
`use-brand-logo.ts` apaga «Preparando imagen…» para siempre —el **DoD #1** de la 0059— y **los 5 gates quedan
VERDES**. Revertida con `shasum` identico. Es la tarea 38 otra vez. Ver tarea 50.

**(3) `implementada` en el frontmatter no significa implementado.** Barrido de DoD abiertos en specs marcadas
`implementada`: **8 specs con casilleros sin tildar** (0023, 0032, 0038, 0039, 0043, 0045, 0055, 0056). De esas se
verificaron DOS contra el arbol; **las otras seis siguen sin auditar y no hay que asumir que son solo higiene** —
esa suposicion es justo la que fallo aca. La **0032 SI esta implementada** (`server/otp/{core,provider,clicksend,
twilio,fake}.ts`, `server/recovery/`, `(consumer)/recover/` y sus tests): sus casilleros son higiene. La **0023 era
optimista de verdad**: no existe ninguna ruta de locales en el backoffice, `AddressAutofillField` se usa solo en el onboarding,
y el tile «Locales» del backoffice real enruta al **mock** de la spec 0015. Un local se crea una vez y no se puede
editar nunca. Re-etiquetada `implementada parcialmente` → tarea 47.

**Alineacion aplicada:** specs 0011-0020 anotadas con su estado real (cuales quedaron superadas y cuales **siguen
siendo el destino real** de un tile del backoffice: 0015 locales, 0017 campanas, 0020 analiticas); spec 0023
corregida; 9 filas viejas de la tabla «Siguiente» reescritas (1, 4, 7, 8, 9, 10, 25, 26, 27 — las tres ultimas
decian `pendiente` para specs que estan `implementada`, y la 27 decia «PROXIMA FEATURE»); 4 filas nuevas (47, 48,
49, 50); INDEX sincronizado en el mismo commit.

**Lo proximo acordado con el owner: la tarea 48 — spec del refresco en vivo de `/wallet`.**

Ultima actualizacion previa: 2026-09-08 (**SPECS 0058 Y 0059 IMPLEMENTADAS LOCALMENTE, PENDIENTES DE REVISION INDEPENDIENTE.**
El hallazgo de `api/billing/checkout` queda cerrado como no aplicable: solo existe en onboarding, donde se crea el
owner antes de llegar a Stripe y el staff aún no puede existir. El toast flotante cierra S4. La 0059 agrega feedback
«Preparando imagen…» y cámara trasera móvil para logo/sello/producto. `typecheck`, `lint` y `format:check` pasan; la
suite completa no puede cerrar localmente: el entorno ejecuta Node 22 y el guard del repo exige Node 24.)

**Decisiones nuevas (ADR 0057 / spec 0059):** la tarea 41 queda aceptada temporalmente y
agenda OTP para endurecer el re-enroll en el futuro. Las tareas 43 y 45 quedan implementadas
localmente: logo, sello y producto muestran «Preparando imagen…» y en móvil ofrecen «Tomar
foto» con la cámara trasera. Pendiente de revisión independiente antes de marcarlas hechas.

**Los dos FAIL fueron por EL MISMO defecto, y ninguno era del codigo de produccion: un LIMITE DECLARADO SIN
INTENTARLO.** Primero «el aviso no se puede testear, vitest de merchant corre en `node` sin jsdom» — falso, se
pinnea con `react-dom/server`. Corregido el limite, la version nueva decia «queda afuera la interaccion, requiere
disparar un evento» — **tambien falso**, se pinnea con un stub de `useState`, ~45 lineas, cero paquetes. Las dos
veces el revisor lo demostro **escribiendo el test**, y la segunda ademas probo con una mutacion que **se podia
romper el DoD exacto CON LOS 5 GATES VERDES**. Yo habia propagado el primer limite falso a `INDEX.md` y a esta
nota sin verificarlo.

**Lo que quedo en `CLAUDE.md` (mistake→rule), y es lo que mas vale de esta spec:** un limite declarado es una
afirmacion como cualquier otra y se verifica **intentandolo**; y su corolario, que costo la segunda vuelta:
**sub-corregir un limite se SIENTE como rigor** y deja el mismo agujero mas chico. La cuarta version del limite
quedo partida en dos categorias —«alcanzable pero fuera de alcance» vs «inalcanzable con este andamiaje»— para que
nadie pueda esconder un «no lo intente» adentro de un «no se puede».

**Los tests nuevos declaran su alcance DENTRO del archivo:** `login-form-retry.test.ts` se etiqueta como **proxy**,
dice que no renderiza React y que lo load-bearing es que el handler escriba en el mismo slot que siembra
`initialError`. Su stub **recorre los exports de React** y bloquea todo hook que no sea `useState` con un error que
nombra las dos causas posibles: hook legitimo, o **el bug de la tarea 38 volviendo dentro de un efecto**. 471 tests
(venian de 469).

**QA del owner pendiente: bloque S1..S3** en `docs/QA-PENDIENTE.md`. S4 quedo decidida: toast flotante; el reintento
lo reemplaza con el error de credenciales en vez de apilar ambos avisos.

Ultima actualizacion previa: 2026-09-08 (**QA DEL OWNER SOBRE EL CANJE: 7 de 8 items PASAN. El unico que falta (C2,
sellos con arrastre) esta BLOQUEADO POR DATOS, no por codigo. Sale la spec 0057 + ADR 0055 del hallazgo C8.**

**RESULTADO DEL QA (owner, en prod sobre el commit `a9cbf3f`):** C1 canje de Puntos ✅ · C3 premio que no alcanza ✅ ·
C4 dispensa ✅ · C5 push ✅ · C6 catalogo en el `i` del wallet ✅ · C7 historial del dia ✅ · C8 staff desactivado ✅.
**El loop del producto cierra en produccion: se puede canjear.**

**C2 (sellos con arrastre) — PENDIENTE, bloqueado por datos.** El negocio de prueba (Taj Bakery) tiene un programa
de **Puntos** activo, y el indice `core_loyalty_program_one_operational` permite **UN solo** programa `active`/
`closing` por negocio. Para probar Sellos hay que cerrar el actual. **Se le explico al owner el camino por la UI y
NO se toco por SQL a proposito:** el ADR acordado con el fija que el cierre es **siempre fechado**, nunca un
«desactivar» inmediato, y hacerlo por atras se saltearia el evento de auditoria (`loyalty_program_event`). El
camino: panel «Cierre del programa» → fin de acumulacion ahora → fecha final de canje 2-3 min despues → confirmar
→ esperar el vencimiento → recargar `/backoffice/loyalty` (el `programForOwner` hace self-heal a `inactive` al leer)
→ ya deja crear el programa de Sellos.

**HALLAZGO C8, y era mas grande que el toast que el owner pidio.** Reporto: «no me deja loguearme con staff
desactivado asi que esta correcto, pero deberiamos poner un toast que diga "Miembro del staff desactivado" por que
hoy no muestra nada». Al investigar el mecanismo (no de palabra): **better-auth autentica contra `merchant_auth`,
que no sabe nada de `core.business_membership`**, asi que el staff desactivado con la contraseña correcta **se
loguea CON EXITO y se le crea una sesion nueva**; recien despues `requireBackofficeSession` lo rebota a `/login`
**sin parametro ni motivo**. O sea: (1) el silencio que el owner vio, y (2) **una sesion viva de un miembro
desactivado**, que contradice a `setStaffStatus` —que al desactivar borra explicitamente todas las sesiones del
usuario— porque el siguiente login las vuelve a crear.

**SPEC 0057 + ADR 0055, cerradas e IMPLEMENTADAS (en revision independiente, sin commitear).** El guard revoca la
sesion **y despues** redirige con motivo (`?e=staff_disabled`); el login pasa a server component que traduce el
motivo **por allow-list** (el valor crudo del query param nunca llega al DOM) + `login-form.tsx` cliente. La
decision de seguridad esta en el ADR y es explicita: **se acepta a proposito que el mensaje revele el estado de la
cuenta, porque solo lo ve quien YA probo conocer email y contraseña** — no abre ningun canal de enumeracion.
Gates verdes: **467 tests** (venian de 453). Las 4 mutaciones corridas; el implementador declaro que (b) «no
revocar» y (c) «revocar despues del redirect» son **indistinguibles** (mismo test, mismo mensaje) porque
`redirect()` lanza — declarado en vez de fingir dos oraculos.

**Dos decisiones del owner ya saldadas por la spec 0058, pendientes solo de revisión independiente:**
1. **`api/billing/checkout` no requiere cambio.** Se probó la trazabilidad: su único llamador es el onboarding,
   luego de crear la membresía owner; el staff solo se crea después y detrás de `requireOwner`. No hay upgrade desde
   el producto ni acceso desde mostrador, por lo que el hallazgo anterior no era alcanzable.
2. **El aviso es un toast flotante.** Login conserva un único estado de mensaje: el reintento limpia el toast previo
   y el error de credenciales lo reemplaza, por lo que nunca se apilan.

**LA 0057 VOLVIO EN FAIL DEL REVISOR INDEPENDIENTE, y el hallazgo bloqueante fue MIO: escribi un LIMITE FALSO
en esta nota y en `docs/INDEX.md`.** Habia relatado que «el error de credenciales pisa al aviso» no tiene oraculo
porque vitest de merchant corre en `environment: "node"` sin jsdom. **Es cierto solo para la INTERACCION.** El
**renderizado del aviso** —que es el DoD #1 y el pedido literal del owner— **si es pinneable, con CERO dependencias
nuevas**: el revisor lo demostro escribiendo el test con `react-dom/server` (`renderToStaticMarkup`, React 19.2.8),
mockeando solo el cliente de auth, y paso 2/2 bajo el mismo `environment: "node"` — funciona gracias al
`esbuild.jsx` que el propio implementador habia agregado. Lo borro para no implementar por su cuenta.

**Es exactamente el patron del ADR 0054 —un documento afirmando un invariante que el test no pinnea— y esta vez lo
escribi yo, tomando la declaracion del implementador sin verificarla.** La leccion no es «el implementador
exagero»: es que **un limite declarado es una afirmacion como cualquier otra y necesita su verificacion**. Un
limite sobredimensionado se ve virtuoso (parece honestidad) y hace exactamente el mismo daño que un `[x]` inflado:
le regala a quien hereda el arbol la creencia de que algo no se puede probar.

**Segundo hallazgo que tambien habia relatado mal: (b) «no revocar» y (c) «revocar despues del redirect» NO son
indistinguibles.** Las separa `pnpm run typecheck`: con (c), `tsc` da `TS18047: 'session' is possibly 'null'` en la
linea muerta (exit 2); con (b) sale 0. La afirmacion valia para vitest, no para los gates.

**Resto del FAIL (importantes):** la tabla de mutaciones de la spec sigue siendo una **prediccion** con los
checkboxes en `[ ]` —la regla que la propia 0055 dejo en `CLAUDE.md`— y ademas predice **dos tests que no existen**
((a), (b) y (c) enrojecen el MISMO `it`); un comentario en `auth-guards.ts:70` afirma «one way to kill sessions in
the product, not two», falso (existen `revokeSessionsOnPasswordReset` y el `/sign-out` de better-auth); y la tabla
«Archivos» de la spec quedo vieja (no lista `login-notice.ts` ni `vitest.config.ts`, y lista `globals.css` que no
se toco). **Todo en correccion.**

**SEGUNDO FAIL DEL REVISOR (2a pasada), un solo bloqueante — y es EL MISMO ERROR UN NIVEL MAS ABAJO: la
correccion del limite TAMBIEN estaba sobredimensionada.** El limite reescrito decia que el «pisa» queda afuera
«porque requiere disparar un evento y vitest de merchant corre en `node` sin jsdom». El revisor aplico la regla
que este mismo changeset acababa de escribir en `CLAUDE.md` por su hallazgo anterior —*antes de decir que no se
puede testear, intentalo*— y **lo testeo**: ~45 lineas, **cero paquetes nuevos**, `vi.mock("react")` con un
`useState` controlable, invocar `LoginForm(props)` como funcion, caminar el arbol hasta el `<button>` y disparar
su `onClick`. **Paso 1/1.** Y probo que muerde con la mutacion **(h)** (el aviso viejo gana): su probe rojo
**mientras los 5 gates quedan VERDES**. Es decir: **hoy se puede romper el DoD #5 exacto y todo el harness
aplaude.**

**La leccion, agregada a `CLAUDE.md`: sub-corregir un limite se SIENTE como rigor** (se acoto, se admitio parte) y
deja el mismo agujero mas chico. La pregunta no es «¿suena honesto?» sino «¿intente exactamente esto que estoy
declarando imposible?».

**Todo lo demas de la 1a pasada quedo CONFIRMADO por el revisor, reproduciendolo:** las **7 filas** de la matriz
de mutaciones reproducen una por una; (c) da `TS18047` en la linea y columna exactas; el test de render es
load-bearing —lo cerro con una **(g2)** propia, mejor que la (g) del implementador porque (g) muerde el lint y
(g2) no: typecheck y lint verdes, unico rojo `login-form.test.ts`—; la tabla «Archivos» y las «Consecuencias
asumidas» estan bien. **Menores nuevos:** el comentario dice «the plugin's `/sign-out`» y `/sign-out` es ruta
**core** de better-auth, no del plugin (`grep -c` da 0 en los 6 archivos de `emailOTP`); y `login-form.test.ts`
no cubre el prop **ausente** (`undefined`), solo `null`.

**EN CURSO — el implementador esta cerrando los hallazgos de las dos pasadas.** Ya entro
`login-form-retry.test.ts`: el arbol esta en **471 tests** (venian de 469) con los 5 gates verdes, y el archivo
**se declara a si mismo como PROXY en su encabezado** —dice que NO renderiza React (stubea `useState`, llama a
`LoginForm(props)` como funcion y dispara el `onClick` a mano), que lo load-bearing es «el handler escribe en el
MISMO slot que siembra `initialError`», y que lo decorativo es el re-render real, el batching y el orden de hooks
bajo Strict Mode—. Es la regla de `CLAUDE.md` sobre proxies aplicada donde sirve: en el archivo, no en un handoff
que nadie relee. Falta la 3a pasada del revisor. Ya aparecio `login-form.test.ts` (el test de
render que el revisor demostro posible) y el arbol esta en **469 tests**, lint limpio. Corrio ademas mutaciones
que no estaban en el plan: una **(g)** «el form ignora `initialError`», que es justo el oraculo del cableado que
faltaba. Cuando termine **vuelve a revision independiente**: un FAIL no se cierra con auto-revision del mismo
agente (`AGENT-WORKFLOW.md`).

**NOTA OPERATIVA para quien herede esto — dos caras del mismo problema, y la segunda es peor:**
1. **Los hooks `Stop` se disparan cuando un subagente esta a mitad de una mutacion.** El `no-mutations-left.sh`
   cazo la (b) **en vuelo**. **No revertir a mano:** pisarle el arbol al agente le rompe su propia verificacion
   por `shasum` y lo hace reportar resultados falsos. Se comprueba si sigue vivo (`ListAgents`) y se espera.
2. **NINGUN resultado de gate vale si se toma mientras el subagente edita.** Paso aca: corri `pnpm run test`
   con el implementador todavia trabajando y dio **1 rojo**; tres corridas posteriores dieron **63/63 y 471
   passed**, y el agente seguia vivo todo el tiempo. **No era la suite: era mi verificacion corriendo contra un
   arbol a medio escribir.** Perdi el nombre del test que fallo, asi que **no se afirma la causa** — solo que no
   reprodujo en 3 corridas. Es el mismo genero que la mutacion abandonada: un rojo cuyo sintoma miente sobre su
   origen. **Regla: antes de creerle a un gate, verificar que no haya subagentes corriendo.**

**Lo que el revisor SI verifico y quedo limpio:** el codigo de produccion es correcto; `Object.hasOwn` en la
allow-list es load-bearing (escribio 2 evasiones propias, `in` y `?? null`, y las dos caen con `__proto__` y
`constructor`); el cambio de `vitest.config.ts` es **solo de tests** (Next compila con SWC y el `build` forzado
pasa igual) y es load-bearing (sin el, 3 tests dan `ReferenceError: React is not defined`); si el `DELETE` falla
**falla cerrado** (la excepcion sube, Next da 500, el `return` con sesion valida es inalcanzable); y la revocacion
es efectiva de inmediato porque `auth.ts` no configura `session.cookieCache`.

Ultima actualizacion previa: 2026-09-08 (**SPEC 0055 (CANJE, TAREA 44) IMPLEMENTADA, CON PASS DE REVISOR INDEPENDIENTE,
COMMITEADA, MIGRADA A PROD, PUSHEADA Y DESPLEGADA. El loop del producto CIERRA: ya se puede canjear.**
Commit `a9cbf3f` en `main`, **`Vercel: success` verificado para ESE sha exacto** (no «prod esta verde») con
`gh api repos/maxhost/check-point/commits/a9cbf3f/status`.

**Migracion `0028` aplicada a la rama default de Neon y verificada por SQL, con foto antes/despues:** `core`
22→23 tablas (solo `reward_redemption`), **`consumer` 10 y `merchant_auth` 5 sin cambios**; 5 programas, 11
membresias y 7 ordenes **intactos**; FK de `reward_id` en `SET NULL` (`confdeltype = n` — el que la mutacion (c)
probo que carga peso), indice unico presente, 5 checks, y el flag `redeem_allow_insufficient` en `false` para los
5 programas: **sin migracion de datos**, como pedia §5.

**LO QUE FALTA: el QA del owner.** Esta escrito en `docs/QA-PENDIENTE.md` como bloque nuevo **C1..C8**, con los 3
casilleros del DoD que quedaron **abiertos a proposito** (el `i` del wallet, el render del historial y el QA
manual): son comportamiento de UI y **ningun barrido estatico los pinnea** (leccion de la tarea 38). Se dejan
abiertos en vez de marcarlos con una excusa. Ojo con **C4**: con la dispensa activa **no hay tope** — es
consecuencia directa de la decision §9 del owner, esta pinneado por un test, y si al verlo no le gusta, es otra spec.

**Numeros finales:** 5 gates de ROOT verdes (`typecheck`, `lint`, `test` **453 passed**, `format:check`, `build`)
+ **48/48 de integracion Neon** (27 del canje, 21 de regresion — las 8 carreras del grant de la 0056 siguen verdes).

**PENDIENTE MENOR: borrar la rama Neon efimera `spec-0055-redeem` (`br-shy-art-axolrd4v`).** `delete_branch` esta
gateado como destructivo y **pide confirmacion del owner** — no se borro sola.

**LO QUE ESTA SESION DEJO EN EL HARNESS (mistake→rule, los dos probados por mutacion):**
1. **`tasks-fresh.sh` NUNCA bloqueo un turno en toda su vida.** Guardaba con `[ -d src ] || exit 0` y `src/` no
   existe en la raiz de este monorepo (vive en `apps/*/src`): salia en 0 siempre, mientras `CLAUDE.md` y este
   archivo citaban su existencia como garantia. Arreglado y **ya bloqueo varios turnos reales**.
2. **`no-mutations-left.sh` (nuevo)** — bloquea el turno si queda una mutacion etiquetada. Nacio porque un
   implementador murio con una aplicada (su rojo parecia un bug real del producto: «un miembro `disabled` puede
   operar el mostrador») y **despues cazo a otro con una en CODIGO DE PRODUCCION** —un push encolado en el camino
   de fallo, fuera de la transaccion— **antes de que se commiteara**.
3. **Regla nueva en `CLAUDE.md`:** que un test MUERDA no dice QUE propiedad pinnea; la atribucion equivocada es tan
   peligrosa como la ausencia de test. Una fila «mutacion X → rojo el test Y» **no se predice, se EJECUTA**.

**CUATRO agentes murieron sin handoff en esta spec** (2 implementadores, 1 revisor, 1 de la pasada de tests). Las
cuatro veces se auditó el arbol antes de asumir nada; dos de esas veces habia una mutacion puesta.

Ultima actualizacion previa: 2026-09-08 (**SPEC 0055 (CANJE, TAREA 44): PASS DEL REVISOR + LOS 3 HUECOS DE TEST CERRADOS
Y VERIFICADOS POR MUTACION. TODO VERDE. FALTA: commit, migracion a prod, push y QA del owner.**

**Numeros finales, corridos por el orquestador:** 5 gates de ROOT verdes (`typecheck`, `lint`, `test` **453 passed
/137 skipped**, `format:check`, `build`) + **48/48 de integracion Neon** = 27 del canje (`counter-redeem` 7,
`-races` **8**, `-guards` 8, `-surfaces` 4) + 21 de regresion. Coincide con el criterio que esta nota dejo escrito
antes de la pasada: `-races` subio de 7 a 8 (entro el test del DoD 8) y el total del canje de 26 a 27.

**EL CUARTO AGENTE MURIO — y esta vez el hook lo cazo.** El implementador de la pasada de tests murio con una
mutacion aplicada **en codigo de PRODUCCION** (`redemptions.ts`: un push encolado en el camino de FALLO y fuera de
la transaccion). `no-mutations-left.sh` —escrito hoy, a raiz de que el implementador del backend hizo exactamente
lo mismo— dio `exit 2` nombrando archivo y linea. **Sin ese hook, esa mutacion se commiteaba**: el arbol quedaba
mandando un push fantasma en cada canje rechazado, y su sintoma habria parecido un bug de producto. Revertida a
mano (el archivo es untracked, no habia `git checkout` posible) y verificada por `shasum`.

**Los 3 huecos, cerrados y cada uno probado por mutacion POR EL ORQUESTADOR** (el implementador murio antes de
probar ninguno, y en este repo un test sin su mutacion no es evidencia):
1. **DoD 8 — «con la dispensa activa no hay tope»**: test nuevo de 5 canjes concurrentes sobre saldo 0 → 5 filas
   con `units_debited = 0`. Mutacion: ponerle un tope a la dispensa → **rojo solo ese test**, con el mensaje
   «no redemption may be rejected: the dispensation renounces the cap». Pinnea una **decision del owner**, no un
   invariante tecnico: quien lo vea rojo esta por revertir producto, y el test se lo dice.
2. **El guard de fuga de DTO que el revisor habia EVADIDO 2 de 3 veces**: ahora es allow-list positiva sobre el
   conjunto exacto de claves. **Reproduje las dos evasiones exactas** (`stampKey` = clave real de R2 con otro
   nombre, `config` = el jsonb entero con otro nombre) y el guard nuevo las caza **nombrandolas** en el diff de la
   asercion. Antes las dos pasaban en verde.
3. **La asercion de «sin push»** que faltaba en el canje bloqueado. Mutacion: encolar el push en el camino de fallo
   → **rojas las dos** aserciones hermanas.

Todas las mutaciones revertidas y verificadas por `shasum`; `no-mutations-left.sh` en 0.

**PROXIMO PASO — REQUIERE OK DEL OWNER, no se hace solo:** (1) commit; (2) `db:migrate` de la `0028` sobre la rama
**default** de Neon (hoy solo esta en la efimera `spec-0055-redeem`) + verificacion por SQL de que `core`/`consumer`/
`merchant_auth` quedaron intactos; (3) push a `main`; (4) verificar que **prod tenga EL COMMIT** con
`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status --jq '.state'` → `success`; (5) recien ahi, QA del
owner. **La spec NO se marca `implementada` todavia**: su DoD 21 exige la migracion aplicada y verificada en prod.

**Limite declarado:** el PASS del revisor es sobre el estado ANTERIOR a estos 3 fixes. Los fixes son solo-tests
(mas correcciones de comentarios) y los verifique por mutacion uno por uno, pero **no hubo una segunda pasada
independiente sobre ellos**. Queda dicho, no tapado.

**EL HALLAZGO GRANDE DE LA REVISION — la propia spec 0055 afirmaba algo FALSO sobre su plan de pruebas, y era del
genero exacto del ADR 0054.** La spec predecia que sacar el `FOR UPDATE` ponia roja «la carrera de mismo
`clientRequestId`». **Es falso: esa carrera queda VERDE sin el lock** — para ese caso el **indice unico solo ya
alcanza**, porque el `23505` aborta y revierte el `UPDATE` del saldo (no hay `ON CONFLICT DO NOTHING`; esa es
justo la diferencia con el bug del 0054). Lo verifico el revisor **y lo re-verifique yo ejecutandolo**: las 4
carreras siguen verdes y lo que se rompe es el test de **8 concurrentes** (1 exito → **8 exitos**). Ademas las
mutaciones (a) y (b) resultaron **indistinguibles**: mismo conjunto rojo. El `FOR UPDATE` **si** es load-bearing,
pero su oraculo es otro test del que la spec decia. **Nadie lo habria notado**: la suite estaba verde y el nombre
del test sonaba a que cubria el lock. Corregido en la spec (con el texto viejo tachado a proposito, porque el error
es instructivo), en el JSDoc de `redemptions.ts` —que es donde alguien lo va a leer— y como regla nueva en
`CLAUDE.md`: **una fila «mutacion X → rojo el test Y» no se predice, se EJECUTA y se transcribe.**

**Evidencia que produjo el revisor (la que ningun implementador entrego):** las 5 mutaciones corridas in-place con
`shasum`, ninguna dejada puesta. (c) da UNA sola roja, la predicha (`23503` sobre el FK). (d) da 3 rojas, y de
yapa se verifico que la **segunda red** tambien muerde: el check de tabla `reward_points_cost IS NOT NULL OR
accrual_kind = 'stamps'`. (e) confirmada. **El anti-falso-verde de la spec se sostiene**: las aserciones de las
rojas son sobre la **fila del log**, no sobre el saldo.

**DoD: 18 de 23 con evidencia observable.** Los que NO: (8) «con la dispensa activa no hay tope» —declarado en
prosa, sin test: si alguien lo "arregla" creyendo que es un bug, nada se pone rojo—; (19) el `i` del wallet y (20)
el render del historial —comportamiento de UI, sin oraculo automatizado, van al QA manual del owner—; (21) la
migracion en prod, **correctamente pendiente por protocolo**; (12) parcial, le falta aseverar «sin push».

**EN CURSO — pasada de tests focalizada** (avanzo: ya toco `-races` —hueco 1— y `-surfaces` —hueco 2—) con los 3 huecos: (1) el test del DoD 8; (2) el guard de fuga de DTO, que
**promete mas de lo que cubre y el revisor lo EVADIO en 2 de 3 intentos** —agregando `stampKey` (clave real de R2
con otro nombre) y `config` (el jsonb entero con otro nombre) el test seguia VERDE—, se convierte en allow-list
positiva sobre el conjunto exacto de claves; (3) la asercion de «sin push» que falta.

**Estado de referencia para comparar cuando termine la pasada** (medido por el orquestador, con la rama efimera):
**453 unit** (`pnpm run test`, 136 skipped) + **26 de integracion Neon del canje** (`counter-redeem` 7, `-races` 7,
`-guards` 8, `-surfaces` 4) + **21 de regresion** (`counter`, `counter-idempotency` —las 8 carreras del grant—,
`counter-guards`, `consumer/programs`). Los 5 gates de ROOT en verde. Si al cerrar la pasada estos numeros bajan,
algo se rompio; si el de `-races` no sube, el test del DoD 8 no entro.

**Menores ya cerrados por el orquestador:** el comentario del caso 25 de `redeem-state-cases.ts` decia que el DTO
«no serializa `target` todavia» cuando en el mismo diff pasó a serializarlo (mismo genero que el ADR 0054) — y al
corregirlo el hook `file-size` me freno a MI en 302 lineas, asi que el comentario se ajusto a 296. Y este archivo
tenia dos bloques duplicados textualmente (error mio al insertar), deduplicado.

Ultima actualizacion previa: 2026-09-08 (**SPEC 0055 (CANJE, TAREA 44): BACKEND + UI COMPLETOS Y VERDES. FALTA EL
REVISOR INDEPENDIENTE. SIN COMMITEAR, SIN PUSHEAR.**

**REVISION EN CURSO — el revisor esta corriendo las mutaciones (a)/(b)/(d) sobre `redemptions.ts` y
`redeem-plan.ts` en este momento.** SIN VEREDICTO TODAVIA. **Tres agentes murieron sin handoff en esta spec** (dos
implementadores y el revisor una vez). Cada muerte se auditó antes de asumir nada, y el arbol quedo verificado
limpio: `no-mutations-left.sh` en 0, **453 unit + 26 de integracion Neon**, los mismos numeros que antes de
despachar al revisor —o sea, ninguna mutacion sin etiquetar quedo puesta—. **Al revisor se le cambio el metodo:
entrega por BLOQUES (mutaciones → DoD → veredicto), no un handoff unico al final**, porque un bloque entregado vale
mas que una revision completa que se pierde.

**REVISOR INDEPENDIENTE DESPACHADO** sobre el diff completo (backend + UI), con el encargo de producir el la
evidencia de las mutaciones **(a) FOR UPDATE, (b) pre-read fuera de la transaccion, (c) reward_id NOT NULL,
(d) points_cost nulo**, que ningun implementador entrego. La (e) ya esta demostrada (ver mas abajo). Se le advirtio
explicitamente que `pnpm run test` **NO es oraculo de la integracion**: sin env los Neon corren skipped y la suite
sale verde igual.

**Desbloqueo de Sellos cerrado** dentro del alcance autorizado: `rawTarget` quedo como **UNA sola definicion** en
`counter/core.ts` (la consumen `redeem.ts` y `programDTO`), y el DTO expone unicamente `target` **crudo**, nunca el
jsonb. B lo verifico por mutacion: agregar `configuration` al DTO → rojo; agregar `stampImageObjectKey` → rojo
**aunque su valor fuera `null`**, porque el guard asevera sobre el NOMBRE de la clave en el serializado y no sobre
un valor presente por casualidad. Ademas sondeo el cableado `resolveScan → rewardState` (con `target` → `canRedeem`
true; sin `target` → `unavailable`, deshabilitado, ni tira ni habilita) con una sonda descartable que borro.

**Comentario corregido por el orquestador:** `ProgramRow.configuration` decia «NEVER serialized: `programDTO` is an
allow-list and does not include it», y con `target` ya en el DTO esa frase se leia ambigua. Ahora dice exactamente
cual es la unica clave que sale y que sumar una segunda es una decision, no un detalle. **No es cosmetica:** el peor
bug de este repo (ADR 0054) nacio de un comentario que documentaba un invariante falso y de que alguien le creyo.

**Gates de ROOT tras todo lo anterior, corridos por el orquestador: los 5 en verde — 453 tests.**

**Pasada B (UI) entregada:** modo Canjear en la consola de mostrador (`redeem-panel.tsx` nuevo, para no engordar
`counter-console.tsx`/`stages.tsx` contra el tope de 300), configuracion avanzada `redeemAllowInsufficient` en el
paso 4 del wizard (viaja en el PUT y se hidrata al editar), y en el wallet el boton `i` que ahora abre una hoja con
**Terminos** + **Catalogo de premios** (`TermsModal` quedo INTACTO, no se reuso como contenedor: tiene titulo y copy
hardcodeados). Historial del dia con el canje distinguido (`entryKind`, signo `-`, etiqueta del premio). Gates de
ROOT verdes: **453 tests** (venian de 421). El estado por premio salio como funcion pura `rewardState` en `types.ts`
con **tabla de 28 casos**, probada por 4 mutaciones con `shasum` de ida y vuelta.

**El bloqueo que B paro bien, y por que se destrabo:** el modo Canjear de **Sellos** no se podia pintar porque
`programDTO` no serializa `configuration.target` — sin eso la UI no sabe el tope de la tarjeta. B se detuvo en vez
de inventarlo (el encargo le prohibia tocar `src/server/**`). **No era una decision de producto:** la spec dice
textual que Sellos muestra «el progreso `stamps_count` / `target`», asi que el dato TIENE que llegar al cliente —
mecanismo ya decidido. Autorizado con tres condiciones: (1) el `target` va **crudo**, no normalizado, para que
cliente y server validen con la MISMA semantica (si el cliente normalizara, podria pintar «Canjeable» donde el
server responde `422 invalid_program` — la trampa `Number(null) === 0`); (2) **nunca** el `configuration` jsonb
entero, que `programDTO` promete ser allow-list; (3) correr la integracion de superficies y **confirmar que sigue
aseverando lo que promete**, no solo que pasa.

**Aceptado tal cual del handoff de B, para que no se rehaga:** la duplicacion consciente entre `rewards-modal.tsx`
y `rewardState` (son decisiones distintas —el mostrador decide habilitacion con dispensa, el wallet solo muestra
cuanto falta— y cruzar backoffice→consumer seria peor), y el historial del dia (es la seccion «Historial del dia»
de la spec, no alcance nuevo).

**Sin oraculo, declarado y NO tapado con un regex** (leccion de la tarea 38): el **cableado** de la UI — que el panel
renderice el estado que devuelve `rewardState`, que la consola postee el premio seleccionado, y que el
`clientRequestId` sea el del escaneo. Es comportamiento, no sintaxis. Va al QA manual del owner.

**El implementador del backend murio DOS VECES sin dejar handoff.** Las dos veces se auditó lo que quedó en disco
antes de asumir nada, y la segunda vez eso pagó:

**EL HALLAZGO DE LA SESION — el implementador murio CON UNA MUTACION APLICADA.** `counter/core.ts` tenia el filtro
`status = 'active'` de `operatorBusiness` **borrado**, con el comentario `// MUTATION (e): the status filter is gone.`
todavia puesto. La integracion daba 25/26 con **un rojo que parecia un bug real del producto** («un miembro
`disabled` puede operar el mostrador»). No lo era: era la mutacion (e) a medio correr. Se barrio el arbol entero
buscando `MUTATION` (era la unica), se restauro el filtro y el archivo volvio a 26/26. **Efecto lateral util: ese
rojo accidental ES la evidencia de que la mutacion (e) muerde**, que era uno de los 5 items de evidencia pedidos.
**Regla nueva para todo encargo de implementador: si interrumpis, NUNCA dejes una mutacion aplicada en el arbol** —
un rojo de mutacion y un rojo de bug son indistinguibles desde afuera, y el default de quien lo hereda es creerle al
sintoma.

**Verificado por el orquestador, corriendo los comandos (no de palabra):**
- `file-size`: limpio en los 31 archivos tocados/nuevos (mayor `counter-redeem-guards.neon.integration.test.ts` 274;
  `redemptions.ts` 273; **`grant.ts` BAJO 298→286**).
- Gates de ROOT en Node 24.20.0: `typecheck` 3/3, `lint` limpio, `test` **421 passed**, `format:check` limpio.
- **Integracion Neon del canje: 26/26** en 4 archivos (`counter-redeem` 7, `-races` 7, `-guards` 8, `-surfaces` 4),
  contra la rama efimera `spec-0055-redeem`. Incluye las 4 carreras de mismo `clientRequestId` (un solo debito),
  las 8 concurrentes con saldo para uno, `insufficient_override` bajo concurrencia, el snapshot sobreviviendo a
  `saveProgram`, y `target` 0/ausente → 422.
- **Regresion del dominio: 21/21** (`counter` 10, `counter-idempotency` 10 —las 8 carreras del grant siguen verdes—,
  `counter-guards`, `consumer/programs`).
- Migracion `0028_fixed_maestro.sql` aplicada a la rama efimera y verificada por SQL (19 columnas, nullables y
  defaults correctos). **Todavia NO aplicada a la rama default (prod)** — eso va despues del PASS.
- Sin fugas de `*ObjectKey`/`qr_token` en los DTOs nuevos; `resolve` reusa el `toRewardDTO` compartido.

**PROXIMO PASO:** (1) que llegue la pasada B (UI: modo Canjear, config avanzada del wizard, catalogo en el `i` del
wallet); (2) **revisor independiente** sobre todo el diff — le queda la evidencia de las mutaciones **(a) FOR UPDATE,
(b) pre-read fuera de la transaccion, (c) reward_id NOT NULL, (d) points_cost nulo**, que el implementador nunca
entrego (la (e) ya esta demostrada, ver arriba); (3) con el PASS: migracion a la rama default de Neon, push, y QA del
owner **verificando antes que prod tenga EL COMMIT** a probar.

**HALLAZGO DEL HARNESS, arreglado y ya probado en vivo: `.claude/hooks/tasks-fresh.sh` NUNCA bloqueo un turno.**
Guardaba con `[ -d src ] || exit 0` y `src/` **no existe en la raiz de este monorepo** (vive en `apps/*/src`): salia
en 0 siempre, mientras `CLAUDE.md` y este archivo citaban su existencia como garantia. Arreglado (resuelve el glob),
**probado por mutacion** (sobre un cambio real en `apps/platform/src` el hook nuevo da `exit 2` nombrando el archivo
y el viejo da `0` sobre el estado identico; restaurado con `shasum`), y **desde entonces ya bloqueo un turno real de
esta sesion** — el primero de su vida. Regla agregada a `CLAUDE.md`: `exit 0` puede significar «paso» o «nunca miro
nada», y desde afuera son indistinguibles.

**DOS HOOKS NUEVOS/ARREGLADOS ESTA SESION, los dos probados por mutacion (nunca "deberia andar"):**
- `tasks-fresh.sh` — (1) arreglado el guard `[ -d src ]` que lo hacia un no-op en este monorepo; (2) **afinado para
  no acusar en falso**: miraba el mtime de TODO el arbol de src, y un `git checkout -- <f>` que restaura un archivo
  le bumpea el mtime sin cambiar una linea — denunciaba archivos INTACTOS (paso en vivo, con el archivo que use de
  victima para probar el otro hook). Ahora cruza el mtime **contra lo que git reporta como cambiado**. Probado en
  tres direcciones: intacto-con-mtime-nuevo → 0 (el viejo daba 2), modificado-de-verdad → 2 nombrando el archivo,
  y tras actualizar TASKS.md → 0. *Un guard que acusa en falso entrena a ignorarlo, que es la otra forma de no
  servir para nada.*
- `no-mutations-left.sh` — **NUEVO**. Bloquea el turno si queda una mutacion etiquetada (`MUTATION`) en el arbol.
  Nace del implementador que murio con la mutacion (e) puesta. Declara su limite en el propio archivo: **solo ve
  mutaciones ETIQUETADAS**, no es un detector de codigo mutado — es el cierre de la convencion que los encargos
  exigen. Probado: arbol limpio → 0, mutacion puesta → 2 nombrando el archivo, restaurado → 0.

**Contratos del orquestador** (los exige «Archivos compartidos» de la spec) en
`docs/specs/0055-contratos-del-orquestador.md`: `RewardDTO` **extiende** el `toRewardDTO` existente en vez de crear un
segundo DTO de premio, y `planRedemption` con su **tabla de 24 casos** como oraculo del unit.)

**Lo hecho como orquestador antes de despachar** (lo exige la seccion «Archivos compartidos» de la spec): los dos
contratos compartidos quedaron fijados en `docs/specs/0055-contratos-del-orquestador.md` — (1) **`RewardDTO`**: se
EXTIENDE el `toRewardDTO` que ya existia en `client-view.ts` con el `id` que le faltaba, en vez de crear un segundo
DTO de premio (dos lugares que deciden lo mismo divergen: es el mecanismo de la fuga de `*ObjectKey` de la 0025 y de
las listas MIME duplicadas 4 veces); (2) **`planRedemption`**: firma, orden de evaluacion normativo y **tabla de 24
casos** como oraculo del unit, incluidos los casos trampa (`Number(null) === 0` → canje gratis ilimitado; `points_cost`
nulo; y el caso 24, que separa «el programa permite la dispensa» de «esta operacion la uso»). Rama Neon efimera
`spec-0055-redeem` (`br-shy-art-axolrd4v`) creada; credenciales en `.env.integration.local` (gitignored).

**El implementador del backend murio sin dejar handoff.** Se auditó lo que quedó en disco antes de asumir nada
(leccion ya escrita en memoria: al heredar trabajo sin commitear, correr los chequeos uno mismo):
`file-size` limpio en los 25 archivos tocados (mayor: `redemptions.ts` 273; `grant.ts` **bajo** 298→286);
gates de ROOT en Node 24.20.0 verdes (**421 tests**, venia de 385); migracion `0028_fixed_maestro.sql` aplicada a la
rama efimera y verificada **por SQL** (las 19 columnas de la spec, con nullables y defaults correctos); sin fugas de
`*ObjectKey`/`qr_token` en los DTOs nuevos; y `redeem-plan.ts`/`redemptions.ts`/`redeem.ts` fieles al anexo
(`FOR UPDATE` real, idempotencia bajo el lock, y el `UPDATE` escribe `plan.balanceAfter` **literal**, sin aritmetica
en SQL que pueda discrepar con el unit).

**EL HUECO, Y ERA INVISIBLE EN EL VERDE: no existe NINGUN test de integracion Neon del canje.** Como todos los
`*.neon.integration.test.ts` corren *skipped* sin env, `pnpm run test` sale verde con 421 tests igual — la ausencia
**no se ve en el reporte de la suite**; se detecto buscando el archivo por nombre. Falta tambien la evidencia de las
5 mutaciones. Es justo la mitad que carga el peso del DoD: sin la carrera concurrente aseverada **por SQL**, el canje
tendria el mismo agujero que el ADR 0054 documento en la acreditacion. El implementador fue retomado con su contexto
intacto y la lista exacta de lo que falta.

**PROXIMO PASO:** (1) que llegue la integracion Neon + mutaciones; (2) despachar la **pasada B: UI** (modo Canjear en
la consola, config avanzada en el paso 4 del wizard, catalogo de premios en el `i` del wallet) — se despacha DESPUES
a proposito, porque las mutaciones rompen codigo fuente in-place y dos agentes corriendo gates sobre el mismo arbol
en ese momento producen rojos que no significan nada; (3) **revisor independiente** sobre todo; (4) recien con el PASS,
migracion a la rama default de Neon y push.

**HALLAZGO DEL HARNESS, ya arreglado: `.claude/hooks/tasks-fresh.sh` NUNCA bloqueo un turno en toda su vida.**
Guardaba con `[ -d src ] || exit 0`, pero `src/` **no existe en la raiz de este monorepo** (vive en `apps/*/src`):
salia en 0 siempre, mientras `CLAUDE.md` y este archivo citaban su existencia como garantia de que el estado no queda
viejo. Arreglado (resuelve el glob en vez de asumir la ruta) y **probado por mutacion**: sobre un cambio real en
`apps/platform/src`, el hook nuevo da `exit 2` nombrando el archivo y el viejo da `0` sobre el estado identico; el
archivo se restauro con `shasum` verificado. Regla agregada a `CLAUDE.md`: un hook es un guard, y `exit 0` puede
significar «paso» o «nunca miro nada» — desde afuera son indistinguibles.)

Ultima actualizacion previa: 2026-09-08 (**SPEC 0056 IMPLEMENTADA, CON PASS DE REVISOR INDEPENDIENTE, PUSHEADA Y
DESPLEGADA. El bug de doble acreditacion esta CERRADO en prod** — commit `a322ac7` en `main`, `Vercel: success`
verificado por `gh api repos/maxhost/check-point/commits/a322ac7/status`, y la verificacion post-deploy por SQL
(MCP Neon, `red-violet-38772073`, rama default) dio **0 filas**: ninguna `program_membership` con
`points_balance`/`stamps_count` distinto de la suma de `units_granted` de sus ordenes. El bug no llego a corromper
datos reales; no hace falta reparar nada. El fix es la linea que la spec predijo (fuera el `ON CONFLICT
(business_id, client_request_id) DO NOTHING`) + el JSDoc de `persistGrant` reescrito, que era el que documentaba
el invariante falso. **La carrera se reprodujo sobre `neon-http`, no solo en el Postgres local de la sonda**:
con el `ON CONFLICT` repuesto, `points_balance` da 40/60/80 donde debe haber 20. La condicion de reapertura de
la spec NO se disparo — el 23505 aborta el statement y revierte el bump tambien sobre HTTP, y el `EXPLAIN` del
plan real sobre Neon confirma `InitPlan` + `One-Time Filter` (el ADR 0054 queda demostrado, no argumentado).
Test nuevo `counter-idempotency.neon.integration.test.ts` (10 casos). Auditoria del DoD: **ningun test viejo del
dominio ejercia concurrencia** — el "is idempotent by client_request_id" de 0030 era ciego por partida doble (es
secuencial, y sus dos aserciones —respuesta de la API y conteo de ordenes— son justo las que seguian bien con el
bug). **PROXIMO PASO: implementar la spec 0055 (canje, tarea 44)**, que ya esta `cerrada` y nace con
`withDbTransaction`. Nota: el implementador de la 0056 murio con el proceso y no dejo handoff — el orquestador
re-verifico todo antes de mandar a revision.)

Ultima actualizacion previa: 2026-09-07 (**SOLO DOCS, CERO CODIGO TOCADO. Spec 0055 (canje, tarea 44) cerrada punta a
punta con el owner + ADR 0053. Al escribirla en detalle, una revision independiente del PLAN (no del codigo, que
todavia no existe) dio NO PASA y encontro algo mas grande que la spec: un BUG DE PRODUCCION en la acreditacion
(spec 0030) que la 0055 iba a copiar. Reproducido a mano por mi (Postgres 17 en Docker efimero, NO Neon, NO
prod): `persistGrant` puede acreditar DOS VECES el mismo `client_request_id` bajo concurrencia, porque el
`NOT EXISTS` de idempotencia se planea como `InitPlan`/`One-Time Filter` (se evalua UNA vez, ANTES del lock) y
no bajo `EvalPlanQual` como decia el comentario del codigo. Sale como ADR 0054 + **spec 0056 (tarea 46, `cerrada`,
fix de una linea ya verificado): va ANTES que el canje**, decision del owner. La 0055 se corrigio el mismo dia
para nacer con `withDbTransaction` en vez del patron roto. Commit `93caac7`, local, SIN PUSHEAR.**

**PROXIMO PASO AL RETOMAR: la spec 0056 esta cerrada del todo** (implementada, PASS, pusheada, desplegada,
verificacion post-deploy en 0 filas). **Implementar la spec 0055** (canje, tarea 44), que ya esta `cerrada` y
nace con `withDbTransaction`: no hace falta cerrar nada con el owner para arrancarla.

Ultima actualizacion previa: 2026-09-05 (**QA DEL OWNER CORRIDO CASI ENTERO. 15 de 17 items PASAN. Los 2 que fallan son
EL MISMO: el canje no existe (tarea 44). Commit `e79305b` hecho y SIN PUSHEAR; prod sigue en `8f52d36`, que es lo
que se probo.**

**EL RESULTADO QUE CAMBIA UNA DECISION DE ARQUITECTURA — bloque A3, y salio por el lado barato:** en un Android real,
subir una foto de **galeria** en marca **abre el cropper** y **el fallback no se disparo ni una vez**. O sea el picker
de Android entrega algo decodificable (JPEG ya convertido) y **HEIC crudo NO llega**. Eso es exactamente la condicion
que el **ADR 0047 §4** dejo escrita para reabrir el decoder HEVC en WASM, y **no se cumplio** → **ADR 0052: cerrado, no
diferido.** Se evitan 1-2 MB de WASM con LGPL-3.0. **El fallback se conserva igual**, porque su justificacion nunca fue
Android sino que el cropper es best-effort (0047 §1). Era el ultimo residual de arquitectura de la spec 0040.

**EL HALLAZGO GRANDE — bloque B2: el canje no existe, y la causa raiz vale mas que el sintoma (tarea 44).**
El owner reporto que el mostrador solo tiene venta/venta rapida. **Verificado en el codigo, no de palabra:**
`app/api/counter/` tiene solo `resolve` y `grant`, `server/counter/` no tiene ningun `redeem`, y la UI ofrece
exactamente dos acciones. Los premios **si** existen y estan persistidos (`core.loyalty_reward`, migracion `0019`):
**el owner puede configurar recompensas que nadie puede canjear.** La causa: **las specs 0030 y 0036 se delegaron el
canje MUTUAMENTE.** La 0036 §8 dice *«La ejecucion del canje es de la 0030»*; la 0030 dice *«Solo acreditacion; el
canje es otra feature, otra URL»*. **Las dos cerradas, las dos coherentes consigo mismas — el agujero esta ENTRE
ellas, que es donde ningun revisor de spec mira.** No es regresion ni implementacion incompleta. Necesita spec propia.

**Lo demas que dejo el QA:**
- **Tarea 45 (nueva):** en Android el selector ofrece **solo galeria, nunca camara**; en iPhone si aparece «Tomar
  foto». Verificado: **no hay atributo `capture` en ningun archivo del repo**. Las 3 superficies usan
  `accept={isTouch ? "image/*" : …}` — en iOS eso da el menu con camara, en **Android 13+ Chrome lo rutea al Photo
  Picker del sistema, que es solo galeria**. Ademas el texto de ayuda del catalogo promete «podes tomar una foto», que
  en Android es **falso**.
- **`/wallet` no se actualiza en vivo** (B1.4): con el portal ya abierto hay que cerrarlo y volverlo a abrir para ver
  el saldo nuevo. **No es un bug nuevo: es la tarea 25 / spec 0031, que sigue `pendiente`** — el QA confirma que el
  hueco es visible para el usuario, no teorico.
- **PREGUNTA ABIERTA DEL OWNER, y es buena (B3.2): «¿que pasa si NO agrego el pase al wallet? ¿como se si las
  notificaciones push funcionan?»** Por el ADR 0040 lo transaccional sale **solo** por wallet, con fallback a Web Push
  **si no hay pase alcanzable** (`consumerHasReachableWallet`) — nunca los dos, que es lo que mato el duplicado de la
  0038. Asi que sin pase **deberia** llegar por Web Push. **Ese camino nunca se probo en vivo**: es un hueco del QA,
  no un bug conocido. Quedo como item nuevo en `QA-PENDIENTE.md`.
- **Confirmado que NO es regresion:** una sola notificacion en iOS y en Android (B3), y llega por wallet. En Android
  tardo bastante. En iOS llega por Wallet y no dentro del icono de inicio — el owner lo declaro aceptable.

**Fila 32 corregida (estaba vieja):** decia `pendiente (spec CERRADA)` cuando la spec 0036 esta `implementada` en su
frontmatter y en `INDEX.md`, con la migracion `0019` aplicada. Se detecto investigando el B2.

**Estado del repo:** `main` = **`e79305b`** (tareas 42 y 38, 4 revisiones independientes), **commiteado y SIN PUSHEAR**.
Prod sigue en `8f52d36`, que es el commit contra el que se corrio este QA — o sea los resultados de arriba son validos.
Node 24.20.0, 385 tests, 5 gates verdes.)

Ultima actualizacion previa: 2026-09-05 (**TAREAS 42 y 38 CERRADAS — deuda de cobertura y desacople del instructivo iOS.
CUATRO revisiones independientes: PASS, FAIL, FAIL, **PASS**. Los 3 bloqueantes arreglados, el diseño del guard
cambio por completo a raiz del 3ro, y los 3 importantes del 4to tambien estan resueltos. Codigo SIN COMMITEAR,
esperando OK del owner. 5 gates verdes, tests 370 -> 385.
EL PROXIMO PASO SIGUE SIENDO EL QA DEL OWNER: `docs/QA-PENDIENTE.md`.**

**Por que estas dos y no otra cosa:** no hay ninguna spec en `cerrada` esperando implementacion (verificado recorriendo
el frontmatter de las **52** specs de `docs/specs/` — 53 `.md` menos `TEMPLATE.md`: 12 `cerrada`, todas fundacionales de
agosto y ya construidas; 7 `borrador`, material historico). De los residuales, la **41** necesita decision del owner y la **43** —que abri en esta sesion— tambien.
Las 42 y 38 eran las unicas dos desbloqueadas: mecanicas, sin decision abierta, sin migracion y sin secreto nuevo.

**DESVIO DE PROTOCOLO DECLARADO, no escondido:** `CLAUDE.md` dice que ninguna tarea toca codigo sin su spec cerrada, y
estas dos **no tienen spec**. Se implementaron directo (precedente: la 0045). Lo que reemplaza al oraculo de la spec es
**la mutacion**: los 3 tests nuevos se probaron ROMPIENDO el codigo, uno por uno, y ademas se verifico que los tests
VIEJOS **no** los cubrian. Si el owner quiere el PASS formal de revisor independiente, falta esa pasada.

**LAS 4 MUTACIONES CORRIDAS (in-place en el repo real, con backup y `shasum -c` de vuelta — nada de worktrees, por el
gotcha de `pnpm` de `CLAUDE.md`):**
1. Borrar `if (!resolved) cleanup()` del probe → cae **solo** el test nuevo (2). Los 11 viejos verdes.
2. Sacar el `within(attempt(), timeoutMs, null)` → caen **los 2** tests nuevos por `Test timed out` y **ninguno** de los
   11 viejos. Esto **confirma el reporte del revisor**: el timeout total no tenia oraculo.
3. Devolver el gate de VAPID arriba del branch de iOS → rojo. (El numero exacto de esa asercion cambio dos veces
   al crecer los comentarios del archivo; la version final del test ya no compara posiciones, ver mas abajo.)
4. Meter `export const metadata = { manifest: "…" }` en `enroll/[programId]/page.tsx` → el barrido se pone rojo
   nombrando el archivo.

**LA LECCION DE LA SESION, y costo TRES revisiones aprenderla: un barrido estatico NO puede pinnear una propiedad
de COMPORTAMIENTO.** La tarea 38 pedia garantizar que *en iOS Safari, sin VAPID, el instructivo de instalacion se
renderiza*. Escribi **tres guards** sobre la forma de `push-prompt.tsx` y **tres revisores independientes rompieron los
tres**, cada vez con los 5 gates en verde:

| # | guard | como lo evadieron |
|---|---|---|
| 1 | `indexOf(branch) < indexOf(gate)` | un 2do gate arriba con otra ortografia (`vapidPublicKey === null`); el `indexOf` enganchaba el bueno de abajo |
| 2 | `matchAll` + `toHaveLength(1)` | **5 formas**: llaves, `Boolean(x) === false`, hoist a un `const`, comentario señuelo, y `const showInstallHint = …` (un refactor idiomatico, no un ataque) |
| 3 | mini-parser: "el primer `return` del cuerpo devuelve `<IosInstallHint>`" | la clave metida **DENTRO de la condicion** (`isIos && !isStandalone && vapidPublicKey`), que ningun chequeo de ORDEN puede ver; y gatear `<PushPrompt>` **en el llamador** (`qr-tab.tsx`). Ademas disparaba en **4 refactors legitimos** |

**El diagnostico del 3er revisor es el entregable real de todo esto:** *"la forma sintactica es un proxy, y todo proxy
tiene preimagen"*. Cada ronda yo parcheaba la evasion puntual y aparecia una familia nueva — que es exactamente el
"misma correccion dos veces a mano" que `CLAUDE.md` prohibe.

**EL FIX: la decision se extrajo a una funcion pura y dejo de ser un problema de sintaxis.**
`lib/push-prompt-view.ts` → `choosePushPromptView({isIos, isStandalone, vapidPublicKey, pushSupported})` devuelve
`"install-hint" | "push-optin" | "nothing"`. `PushPrompt` solo **renderiza el veredicto**. El oraculo pasa a ser una
tabla de 9 casos (`lib/push-prompt-view.test.ts`) — sin dependencia nueva, sin DOM, sin nada que evadir *desde adentro
de la decision*. Tests 373 → **382**.

**Verificado con las 2 evasiones bloqueantes + la clasica, todas ROJAS ahora:** clave dentro de la condicion (al
principio y al final), hoist con `!== null`, gate de VAPID movido arriba, y el gate en el llamador. Y los **4 falsos
positivos** del mini-parser desaparecieron con el (apostrofo suelto en copy JSX, metodo shorthand, getter, y extraer
el JSX a un helper anidado) — verificados uno por uno.

**LO QUE QUEDA SIN CUBRIR, DECLARADO EN EL PROPIO TEST en vez de tapado con un regex:** (a) que `PushPrompt` **cablee**
el veredicto fielmente — necesita un entorno DOM de test, que es una **decision con una dependencia colgada**
(`environment: "node"` + `*.test.ts` es deliberado en este paquete) y **no la tomo yo**; (b) que un llamador no gatee
`<PushPrompt>` — ahi si quedo un proxy en `enroll-install-hint.test.ts`, **etiquetado como proxy**: cuenta que
`vapidPublicKey` aparezca exactamente 4 veces en `qr-tab.tsx`.

**4a REVISION: PASS, 0 bloqueantes — y los 3 importantes que trajo ya estan arreglados.** El revisor ataco las 4
superficies del diseño nuevo y **no pudo romper la decision**: meter la clave en `choosePushPromptView` (arriba, dentro
de la condicion, hoisteada) y gatear desde `qr-tab.tsx` dan rojo. Lo que si rompio cae **entero dentro del hueco que el
propio test declara**, y por eso no lo conto como bloqueante — pero conviene tenerlo escrito sin maquillaje:

- **EL HUECO DECLARADO ES DE UNA LINEA, medido y no estimado.** `setIsIos(ios && vapidPublicKey !== null)` en el
  `useEffect` reintroduce **el bug exacto** de la tarea 38 con los 5 gates verdes. Idem
  `return vapidPublicKey ? <IosInstallHint/> : null` en el cableado, e `if (!accentColor) return null` adentro de
  `IosInstallHint` (que lo blanquea en `/wallet` y en ningun otro lado, porque el enroll si pasa `accentColor`).
  **Que quede claro: la tarea 38 entrega EL FIX verificado por lectura, no una GARANTIA.** Cerrar eso necesita entorno
  DOM de test = dependencia nueva = **decision pendiente del owner**.

**Los 3 importantes, arreglados:**
1. **La tabla tenia un agujero real: `isIos:false, isStandalone:true` (PWA de Android instalada) no estaba en ninguna
   de sus 4 formas** — el caso central de la spec 0037. `if (!isIos && isStandalone) return "nothing"` mataba el opt-in
   dejando los 9 tests verdes. Cerrado con 2 filas + 1 test. Tambien se cerro el otro sobreviviente que reporto
   (`isIos && !isStandalone && !pushSupported`), que pasaba porque el fixture fija `pushSupported: false`. Tests
   382 → **385**, y las 3 mutaciones verificadas en rojo.
2. **El comentario del proxy de `qr-tab` atribuia mal su propia fuerza.** Lo que bloquea el gate en el llamador NO es
   el conteo `== 4` sino el `toContain` de la linea exacta + las 80 columnas de prettier (envolver el elemento fuerza
   un reflow y el string deja de matchear). El revisor lo probo con un gate que usa **otro identificador**
   (`pushEnabled`), que el conteo no ve y el `toContain` si caza. Reescrito: ahora dice cual mitad hace el trabajo,
   cual es decorativa, y declara la limitacion aceptada (renombrar el prop lo pone rojo).
3. **La nota al pie decia que se pinnea "el llamador" y solo se barre `qr-tab.tsx`.** `wallet/wallet-shell.tsx`, que es
   quien renderiza `<QrTab>`, no lo pinnea nada. Corregido el texto — **no se agrego otro barrido**: seria mas
   whack-a-mole de proxies, que es justo lo que esta sesion aprendio a no hacer.

**Y la linea (d) de `CLAUDE.md` se corrigio por 3a vez, con la observacion mas fina de las cuatro revisiones:** decia
que extraer la decision resuelve una propiedad de comportamiento. **No la resuelve** — la convierte en una propiedad de
DECISION y deja el cableado sin oraculo, que es exactamente donde entra la mutacion de una linea de arriba. La regla
ahora dice eso, y agrega que un proxy debe declarar **cual de sus partes hace el trabajo**.

**PASS DE REVISOR INDEPENDIENTE (2026-09-05), con 2 hallazgos importantes que SE ARREGLARON antes de cerrar.** El
revisor corrio los 5 gates por su cuenta con `TURBO_FORCE=true` (sin cache), reprodujo las 4 mutaciones con los numeros
exactos, verifico el estado de prod y dejo el arbol byte-identico (`shasum -c` sobre 6 archivos). 0 bloqueantes.

1. **IMPORTANTE — cometi el MISMO error que acababa de cazar, una linea mas abajo.** Escribi que sin VAPID el iPhone se
   quedaba «sin instructivo en ningun lado». **Falso desde la spec 0051:** `enroll-confirmation.tsx` renderiza
   `<IosInstallHint>` directo, gateado solo por `isIosSafariBrowser()`. O sea: detecte que el item (2) de la tarea 38
   estaba desactualizado por una spec posterior, y **no aplique esa misma sospecha al item (1)**, cuya premisa estaba
   viciada igual. El fix de codigo es correcto igual —es el que propuso el revisor de la 0050— pero el POR QUE escrito
   era mentira. Corregido en la fila 38, en este bloque y en el comentario de `push-prompt.tsx`.
2. **IMPORTANTE — el test de orden era EVADIBLE. Tardo TRES versiones en quedar bien, y las dos primeras las rompio
   un revisor, no yo.** (i) El `indexOf(branch) < indexOf(gate)` original se evadia metiendo un 2do early-return
   arriba con otra ortografia (`vapidPublicKey === null`) y dejando el bueno abajo: **11 passed con el bug puesto**.
   (ii) Lo "arregle" contando los gates con `matchAll` + `toHaveLength(1)` — y **una RE-REVISION lo evadio de 5 formas
   mas**, todas con los 5 gates verdes: llaves (`if (…) { return null; }`), `Boolean(x) === false` (el parentesis
   interno rompe el regex), hoistear el booleano a un `const` (la clave deja de estar en el `if`), un comentario
   señuelo, y —la peor— `const showInstallHint = isIos && !isStandalone`, que **no es un ataque sino un refactor que
   cualquiera haria**. Causa raiz: endureci UN lado de la comparacion y deje el otro ancla como `indexOf`; y del lado
   del gate seguia siendo una lista negra de ortografias. (iii) La 3ra version dejo de buscar texto y asevera la
   **forma**: *el primer `return` del cuerpo de `PushPrompt` devuelve `<IosInstallHint>`*, salteando cuerpos de
   funciones anidadas. **Y esa version, en su primer intento, perdio la mutacion ORIGINAL** —acote el span a "despues
   de `enable()`" y el gate original vivia ARRIBA de `enable()`— con una justificacion falsa escrita al lado
   (`rules-of-hooks` lo cazaria: no, `enable` no es un hook). Se detecto corriendo la mutacion vieja contra el test
   nuevo, que es exactamente para lo que sirve re-correr las mutaciones viejas. **Version final verificada con 7
   mutaciones, todas rojas.**
3. Menores atendidos: comentario desactualizado en `enroll-confirmation.tsx` (afirmaba como general algo cierto solo de
   su rama no-iOS) y el conteo de specs de este bloque (decia 40, son 52).
4. **Menor NO atendido, anotado a proposito:** `lib/crop-image-decode.test.ts` quedo en **exactamente 300 lineas**, que
   es el `LIMIT` del hook `file-size.sh` (dispara con `> 300`). Pasa, pero sin margen: **el proximo test que entre ahi
   obliga a dividir el archivo, no a extenderlo.**
5. **Precision del revisor que conviene no perder:** `if (!resolved) cleanup()` **no tiene efecto con ningun
   presupuesto de produccion** — los 3 llamadores usan el default de 8000 ms y la linea 144 vacia `live` a mas tardar
   en `t = step = 4000`. La red solo se activa con `timeoutMs <= 1`, que es lo que usa el test. El test pinnea la
   linea, no su valor en prod; la tarea 42 pedia exactamente eso.

**LA CORRECCION QUE SALIO AL VERIFICAR: la tarea 38 pedia una cosa que ya estaba hecha.** El item (2) —«nada pinnea que
la pagina del enroll siga sin enlazar el manifest»— lo resolvio la **spec 0051** despues de que se escribiera el
hallazgo: el barrido de `enroll-install-hint.test.ts` ya recorre `page.tsx` y chequea `manifest:` **y** las dos
ortografias de `rel=manifest`. No se dio por hecho leyendo el archivo: se confirmo con la mutacion 4. **Un residual
heredado puede estar saldado por una spec posterior — verificarlo antes de trabajarlo.**

**Lo unico que cambio de COMPORTAMIENTO** (todo lo demas son tests): en `push-prompt.tsx`, el
`if (!vapidPublicKey) return null` bajo debajo del branch `isIos && !isStandalone`. Si faltaran `WEB_PUSH_VAPID_*`, un
iPhone en Safari **vuelve a ver** el instructivo de instalacion **en `/wallet`**, que es la unica superficie que lo
alcanza solo via `PushPrompt`. **La confirmacion del enroll nunca estuvo en riesgo:** desde la spec 0051 renderiza
`<IosInstallHint>` directo, gateado solo por `isIosSafariBrowser()`. Hoy no muerde (VAPID esta en prod desde la 0037),
asi que **el QA de `QA-PENDIENTE.md` no cambia**.

**Sin ADR:** no hay decision de arquitectura nueva — el fix (1) es literalmente el que el revisor de la 0050 propuso y
que la tarea 38 ya tenia escrito, y restituye el desacople que el codigo pre-0050 declaraba a proposito en su comentario.

**Estado del repo:** `main` = `8f52d36` pusheado; **prod tiene ESE commit** (`gh api .../commits/8f52d36/status` →
`success`) y `checkpass.club/api/health` → **200** (via redirect 308 del apex a `www`). Sin commitear: los 3 archivos de
codigo/tests de esta sesion + el handoff de la sesion anterior (`CLAUDE.md`, `docs/TASKS.md`, `docs/QA-PENDIENTE.md`).
Node 24.20.0. Gates: lint, typecheck 3/3, format:check, test **373 passed/100 skipped**, build 3/3 — los 5 en exit 0.)

Ultima actualizacion previa: 2026-09-05 (**SESION LARGA DE QA + 5 SPECS IMPLEMENTADAS. Todo pusheado y desplegado
(`8f52d36`, Vercel `success`, health 200). Tests 259 -> 370. PROXIMO PASO: el QA del owner, con checklist en
`docs/QA-PENDIENTE.md`.**

**EMPEZAR POR `docs/QA-PENDIENTE.md`** — es el checklist vivo del owner, con lo que falta probar y lo que ya se
probo y anda. No re-preguntar: esta todo ahi.

**LAS 5 SPECS DE LA SESION, todas con PASS de revisor independiente:**
1. **0040** cropper 1:1 en las 3 superficies de subida (FAIL -> correccion -> PASS).
2. **0050** el icono instalado abre el wallet del consumidor (ADR 0048).
3. **0051** instalar desde la confirmacion del enroll (ADR 0049) — **QA del owner: FUNCIONA**.
4. **0052** el probe de decode caia en falso fallback con archivos de galeria en iOS.
5. **0054** el re-enroll usa los datos guardados y avisa con un toast (ADR 0051, revierte la 0053).

**LOS 3 HALLAZGOS DE FONDO QUE SALIERON AL ESPECIFICAR, mas valiosos que los sintomas que los destaparon:**
- **El `start_url` per-consumidor del ADR 0039 §5 NUNCA funciono** (ni desde `/wallet`): un `<link rel=manifest>`
  se pide SIN credenciales salvo `crossorigin="use-credentials"`, que prod no tiene. Nacio asi; el QA no lo cazaba
  porque abrir `/wallet` sin sesion se confunde con "todavia no me loguee". Fix: el token viaja en la URL del
  manifest (ADR 0048).
- **El guard del `accept` era CIEGO a `accept="..."`** y tapaba 2 listas angostas mas (4a y 5a aparicion del mismo
  bug) con el test en verde diciendo "no hay ninguna otra". Ya es linea de `CLAUDE.md`.
- **Tarea 41: el enroll entrega una SESION COMPLETA a quien conozca un telefono ya registrado, sin verificarlo.**
  Preexistente, sin saldar, **pendiente de decision del owner**.

**DOS ERRORES MIOS DE ORQUESTACION, registrados para no repetirlos:**
1. **Se hizo QA contra un build viejo**: commitee la 0040 y NO la pushee, y le pase al owner un checklist que decia
   "confirmar prod verde" en vez de "confirmar que prod tenga ESTE commit". Dos items del QA fueron invalidos.
   **Regla: antes de pedir QA, verificar el commit status del sha exacto.**
2. **Documente como "decision aceptada" algo que el owner nunca aprobo** (que el 409 actualizara el nombre y despues
   rechazara). Lo dedujo del orden del codigo y lo escribi en la spec y el ADR como si estuviera acordado. El owner
   lo rechazo dos veces: la primera corregi solo el caso rechazado, la segunda hubo que revertir entero (ADR 0050
   supersedido por el 0051). **Regla: lo que el owner no dijo explicitamente no se escribe como decision suya.**

**Estado del repo:** `main` = `8f52d36`, pusheado, deploy verde. Node 24.20.0. **370 tests** (5 gates verdes).
Rama Neon efimera viva con `expires_at`: `spec-0053-name-refresh` (`br-curly-wind-axe411rr`).

Ultima actualizacion previa: 2026-09-02 (**SPEC 0040 IMPLEMENTADA con PASS de revisor independiente. Codigo SIN COMMITEAR
en el arbol, esperando OK del owner. PROXIMO PASO: QA en vivo con telefono real + commit.**

**Que se logro:** cropper 1:1 con drag+zoom en las 3 superficies de subida (logo de marca, sello, producto). Tests
**259 → 310**. Los 5 gates verdes. **Sin migracion** y sin secreto nuevo.

**EL PROTOCOLO DE `AGENT-WORKFLOW.md` SE CUMPLIO ENTERO Y VALIO LA PENA:** implementacion → revisor independiente
**FAIL con 5 hallazgos** → ronda de correcciones → **re-review PASS** (28 mutaciones muertas en un worktree de
`/tmp`, arbol intacto). **El FAIL no fue ceremonia** — cazo cuatro cosas reales:
1. **El fallback de decode estaba ASUMIDO, no probado.** `canDecodeImage` no tenia un solo test, y el criterio de
   la spec lo prohibia con todas las letras ("probado de verdad, forzando el fallo de decode — no asumido").
2. **El guard nuevo del `accept` era CIEGO a `accept="..."`** (el regex solo veia la forma con llaves `{...}`), asi
   que tapaba dos listas angostas mas en `demo/brand/page.tsx` y `demo/loyalty/page.tsx` — **4a y 5a aparicion** del
   mismo bug que `CLAUDE.md` ya documenta de las specs 0033 y 0039. Un guard ciego es peor que ninguno: da una
   seguridad que no tiene.
3. **Faltaba la mitad del pinneo del DoD**: revertir `use-catalog-image` a `startsWith("image/")` dejaba la suite verde.
4. **Un `isAcceptedImageType` nuevo que toleraba `file.type === ""` AFLOJO marca y sello sin ganar nada.** Se
   justificaba diciendo que si no "el server nunca llega a olfatear los bytes" — **falso, verificado**: los 3 presign
   validan contra `ACCEPTED_IMAGE_CONTENT_TYPE_SET`, que no contiene `""`, asi que ese archivo moria igual, solo que
   mas tarde y con peor mensaje. Revertido.

**DESVIO DE LA SPEC AUTORIZADO POR EL ORQUESTADOR (queda registrado, no se arreglo en silencio):** la decision 5
decia que el server distingue el camino estricto **por el presign**. Se implemento con el flag `cropped` en el
**payload de guardado**, porque el bound se aplica al GUARDAR, no al presignar → por presign habria que persistirlo
= migracion en 3 tablas que la spec no lista. El revisor auditó el modelo de confianza: **no existe input que
consiga un bound mas permisivo que los 50 MP de hoy**; los 3 validators tiran 422 con el flag no-booleano o fuera
de `replace`. `normalizeImage` quedo parametrizado: **4.2 MP** con recorte, **50 MP** en el fallback.

**Chunk diferido verificado contra manifests reales** (no de palabra): `static/chunks/1-5vd4y9_pvjp.js` (27K) aparece
solo en los 3 `react-loadable-manifest.json` y esta **ausente** de `build-manifest.json`. `react-easy-crop` se importa
en **un solo** modulo.

**RESIDUAL DEL OWNER, Y ES EL QUE IMPORTA: QA EN VIVO CON EL TELEFONO REAL** (el que produjo el bug de la 0039).
Subir una foto de galeria en **marca**, encuadrarla, verla guardada, y **registrar si aparecio el cropper o si cayo
al fallback**. Ese es el dato que decide el **ADR 0047 §4**: si el fallback se dispara, HEIC crudo llega de verdad y
se reevalua el decoder HEVC en WASM; si no, el tema queda cerrado. Ningun test local lo reproduce.

**Otro criterio NO cerrado, dicho sin maquillaje:** la mitad *cliente* del "blob cuadrado ≤2048". Lo probado es que
el pipeline del server no rompe la cuadratura (dimensiones leidas de los bytes de ambas variantes con `sharp`). Que
el `toBlob` de un navegador real PRODUZCA ese blob no es reproducible sin navegador, y **el server no valida
cuadratura a proposito** (ADR 0047 §3: el cropper es UX y ahorro de bytes, NO un control de seguridad).

**SEGUIMIENTO → SPEC PROPIA, no se arreglo aca:** un picker que reporta `contentType: ""` para una foto real **no
puede subir**. Preexistente, no regresion (los 3 presign nunca aceptaron `""`). Opciones para esa spec: deducir el
tipo por extension/bytes antes del presign.

**GOTCHA CORREGIDO (mistake→rule): `pnpm fetch` NO hacia falta.** `CLAUDE.md` decia "cuando se agreguen dependencias
nuevas, correr `pnpm fetch`". Con el store local al repo, **el propio `pnpm add` ya lo poblo** — verificado:
`.pnpm-store/v11/index.db` contiene `react-easy-crop@6.2.3` y `normalize-wheel@1.0.1`. Correr `pnpm fetch` de mas
habria PURGADO `node_modules` (y disparado el gotcha del `Already up to date` con la raiz vacia) a cambio de nada.

**Estado del repo: codigo SIN COMMITEAR** (24 modificados + 7 untracked), main verde, Node 24.20.0, 310 tests.

Ultima actualizacion previa: 2026-09-02 (**SPEC 0040 CERRADA + ADR 0047 — LISTA PARA IMPLEMENTAR. Nada de codigo
tocado todavia. PROXIMO PASO: implementarla con el protocolo de `AGENT-WORKFLOW.md`.**

**Que es:** cropper de imagen en el cliente, recuadro **1:1** con drag+zoom (touch y desktop), en las 3
superficies de subida (logo de marca, sello del programa, producto de catalogo). Ultima spec pendiente del
backlog: las otras 8 en `borrador` son specs fundacionales de agosto, material historico.

**EL HALLAZGO QUE CAMBIO EL DISEÑO (y obligo a un ADR nuevo): los navegadores NO pueden decodificar HEIC.**
Chrome, Firefox y Edge no licencian **HEVC** (esta bajo patente); Safari si, pero solo porque delega en el
decoder del SO. Un cropper NECESITA mostrar la imagen para que el usuario la encuadre — si el navegador no
puede decodificarla, no hay nada que dibujar. Y HEIC es el formato de las fotos de galeria de **Android** e
iPhone: es el caso exacto que ya costo **dos rondas de QA** (specs 0033 y 0039) y que esta en `CLAUDE.md`. Un
cropper obligatorio lo rompia por tercera vez.

**Por eso va el ADR 0047, que ENMIENDA el punto 2 del ADR 0041** (los ADR son inmutables: si la decision
cambia, va uno nuevo). El 0041 prometia que con el cropper el server volvia a un `limitInputPixels` estricto
**global**. No es alcanzable: mientras exista el fallback —y es obligatorio— por ese camino entra una foto
entera. El cropper pasa a ser **best-effort** y el estricto aplica solo al camino con recorte.

**Se evaluo y DESCARTO convertir HEIC en el browser** (fue la idea del owner, y es la salida correcta si el
costo cerrara): implica embarcar un decoder HEVC en WASM. `heic2any` 2.59 MB pero **sin publicar desde
2023-03-29**; `libheif-js` 6.1 MB y `heic-to` 23.2 MB, ambos **LGPL-3.0**. Aun diferido son 1-2 MB reales que
paga el usuario de Android justo cuando espera ver su foto, con una licencia cuya obligacion de relinkeo queda
difusa en un bundle propietario — y **sin saber todavia con que frecuencia llega HEIC crudo** (los pickers de
Android a veces entregan JPEG ya convertido). **Reapertura CONDICIONAL al QA, no agendada** (ADR 0047 §4).

**LAS 6 DECISIONES, cerradas con evidencia:**
1. **Aspecto 1:1 en las tres.** No es preferencia — lo decidio el CSS: `.brand-logo img` 56×56, `.stamp-preview
   img` 54×54 y `.catalog-image-preview` 120×120 **ya usan `object-fit: cover`**. El recorte cuadrado YA ocurre,
   a ciegas y al centro; el cropper solo se lo da al usuario. (A verificar al implementar: el logo tambien va al
   pase de Wallet y al afiche del brand kit.)
2. **`react-easy-crop` 6.2.3, UNA sola** (verificado en el registry: publicada 2026-07-24, unica dep
   `normalize-wheel`, peer react >=16.4 → ok con React 19). Se descarta el "dos librerias segun plataforma" del
   ADR 0041: la deteccion siempre falla en hibridos (notebooks tactiles).
3. **Fallback por COMPORTAMIENTO, no por user-agent:** se intenta decodificar y si falla se sube el original.
   Pregunta lo unico que importa y sigue andando el dia que un navegador agregue HEIC.
4. **Salida WebP q0.85, borde 2048** (= el `MAX_OUTPUT_EDGE` que el server ya usa). **Ojo con el alpha:** el
   respaldo es **PNG** en logo/sello (transparencia) y JPEG solo en catalogo — un PNG transparente que caiga a
   JPEG sale con fondo negro.
5. **`limitInputPixels` parametrizado:** 4.2 MP en el camino con recorte, 50 MP en el fallback. Elegir mal solo
   puede terminar en un rechazo, nunca en aceptar algo mas grande.
6. **Orden: marca → QA en telefono real → sello → catalogo.** Ese QA produce el dato que decide el ADR 0047 §4.

**DEUDA METIDA EN EL ALCANCE a pedido del owner:** el `accept` del catalogo en desktop esta hardcodeado angosto
(`"image/png,image/jpeg,image/webp"`) mientras marca y sello usan `ACCEPTED_IMAGE_ACCEPT_ATTR` — **tercera**
aparicion del mismo bug que `CLAUDE.md` ya documenta de las specs 0033 y 0039. Ademas `use-catalog-image.ts`
valida con `file.type.startsWith("image/")` en vez del set compartido, mas laxo que sus dos pares.

**OJO AL IMPLEMENTAR:**
- **Dependencia nueva** → correr **`pnpm fetch`** con red despues de agregarla, o la proxima sesion offline
  falla. Y despues de `pnpm fetch`, acordarse del gotcha del `Already up to date` con `node_modules` vacio.
- El cropper es **UX y ahorro de bytes, NO un control de seguridad**: ninguna validacion del server se relaja.
- El criterio del fallback exige **probarlo forzando el fallo de decode**, no asumirlo.

**Estado del repo:** todo pusheado, `main` verde, prod 200, Node 24.20.0, 259 tests. Sin trabajo a medias.)

Ultima actualizacion previa: 2026-09-02 (**SPEC 0049 IMPLEMENTADA: Node en 24.20.0, las 4 fases aplicadas, cada una
con su corrida de CI en `success`. Prod desplegada y sana. Punto de retorno.**

**Lo que se logro:** el repo corre la **ultima Active LTS (24.20.0)**, la version dejo de estar duplicada sin
control en 4 lugares, y la migracion a Node 26 quedo reducida a cambiar un numero. Tests **254 → 259**.

**Lo que NO se hizo, a proposito: NO se migro a Node 26** (ver ADR 0046). Es la ultima estable de Node
(26.8.1), pero **Vercel solo ofrece 24.x/22.x/20.x**: con local y CI en 26 y prod en 24, el CI dejaria de
probar lo que se despliega. Node 24 tiene soporte hasta **2028-04-30**, no hay urgencia.

**Las 4 fases, cada una un commit + una corrida verde:**
1. `72dd8cf` pin a **24.20.0** (`.node-version` + `engines >=24.20.0 <25`). Prod no cambio: Vercel ya servia
   la ultima 24.x, o sea el pin local estaba MAS VIEJO que produccion. CI: `node: v24.20.0` (verificado en el
   log de `setup-node`, no inferido).
2. `7e180d0` **`@types/node` 24.10.1 → 24.13.3** + lockfile. Era la fase con mas riesgo real (tipos nuevos
   pueden romper `typecheck` sin tocar codigo): **no paso**, typecheck 3/3 sin cache, sin bajar ningun tipo ni
   tapar nada con `any`.
3. `f90324f` **guard anti-drift** como 4º project de vitest (`tools/`), 5 chequeos. **Probado rompiendolo**:
   desincronizar `.node-version` falla; desincronizar `@types/node` de UNA app falla nombrandola
   (`expected 'apps/platform: 22' to be 'apps/platform: 24'`).
4. `b9bf954` **actions al dia** (`checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6`). El warning de Node
   20 **desaparecio de las anotaciones** (verificado con `gh run view`, que es lo que pedia el criterio — que
   el CI pase no alcanzaba).

**EL FALSO VERDE QUE SE CAZO EN LA FASE 3, y como:** el guard **no corria** y la suite daba verde igual. Causa:
**el `include` de un project de vitest se resuelve relativo al DIRECTORIO DE SU CONFIG, no a la raiz** — con
`include: ["tools/**/*.test.ts"]` en `tools/vitest.config.ts` buscaba en `tools/tools/`. Se detecto **porque el
conteo de tests no subio** (seguia en 254). Leccion general: al sumar tests, el conteo es el oraculo de que
efectivamente corren; un test que no corre pasa siempre.

**GOTCHA NUEVO, ya en `CLAUDE.md` (mistake→rule): despues de `pnpm fetch`, `pnpm install --offline` MIENTE.**
Dice `Already up to date` y deja el `node_modules` de la RAIZ vacio (sin symlinks ni `.bin`), asi que
`typecheck`/`build` fallan con **`sh: turbo: command not found`** — parece turbo roto y es un link faltante.
`--force` tampoco alcanza. Fix verificado: `rm -f node_modules/.modules.yaml
node_modules/.pnpm-workspace-state-v1.json && pnpm install --offline` (los paquetes siguen en
`node_modules/.pnpm`, o sea sigue siendo 100% offline). Paso de verdad en esta sesion al re-calentar el store
tras la Fase 2. **`.pnpm-store` quedo re-calentado y verificado**: `node_modules` reconstruido sin red y los 5
gates verdes.

**Verificacion final (salida real, Node 24.20.0):** lint, typecheck, build y format:check exit 0; test
**259 passed** / 96 skipped; e2e **5 passed / 1 skipped**. Prod: `checkpass.club/api/health` **200**, commit
status `Vercel: success`, `vercel project ls` sigue en **24.x**.

**AGENDADO — FASE 5, Node 26. Disparador de DOS condiciones, manda la segunda:**
(a) Node 26 entra en LTS el **2026-10-28** (calendario oficial) y (b) **Vercel lo ofrece** en Project Settings.
La (a) sin la (b) no habilita nada. Chequeo sin entrar al dashboard: `vercel project ls` (columna Node Version).
**Cuando se dispare:** cambiar `.node-version`, `engines`, `@types/node` y el dashboard — el guard de la Fase 3
dice cual falto. Verificar ademas **`sharp`** (binarios nativos por version de Node) y hacer un **preview
deploy** antes de promover.

**Desvio de protocolo declarado:** el owner delego las decisiones y pidio implementar directo, asi que esta
spec **NO paso por revisor independiente** como manda `AGENT-WORKFLOW.md` (la 0047 si). El oraculo fue el CI
por fase (4 corridas en `success`) mas la prueba negativa del guard. Si se quiere el PASS formal, falta esa
pasada.

**HALLAZGO REAL DEL GUARD, EN SU PRIMER USO: el Stop hook (`.claude/hooks/verify.sh`) venia corriendo los
gates en Node 22, no en el 24 que pide el repo.** El guard lo cazo apenas se instalo (`expected '22' to be
'24'`) y bloqueo el fin del turno. **No es un falso positivo ni un test mal escrito: el hook llevaba tiempo
verificando contra un runtime DISTINTO del de CI y produccion**, o sea su verde no decia nada del verde de
GitHub. Causa: el shell del hook arranca en el Node del sistema y `verify.sh` nunca hacia `nvm use` (el gotcha
de `CLAUDE.md` estaba documentado para las corridas a mano, pero el hook quedo afuera). **Fix aplicado en
`verify.sh`, no en el test** (editarlo para que pase es exactamente lo que prohibe el propio hook): carga nvm
y hace `nvm use "$(cat .node-version)"` antes de los gates. Verificado: shell nuevo sin el fix -> `v22.22.2`;
con el fix -> `v24.20.0`. Y probado que NO anulo el guard: con `@types/node` en 26 el hook bloquea con
`HOOK_EXIT=2` nombrando la app (`expected 'apps/merchant: 26'`), restaurado deja pasar con 0. Si nvm no esta o
la version no esta instalada, no se silencia nada: sigue con el Node que haya y el guard falla, que es la
señal correcta.

**EL GUARD YA SE PROBO SOLO CONTRA UN CASO REAL, no de laboratorio: Dependabot PR #8** (`@types/node`
24.13.3 → **26.4.0**). El CI del PR quedo en **failure** por el guard —`expected 'apps/consumer: 26' to be
'apps/consumer: 24'`— **antes de llegar a `main`, sin que nadie lo revisara a mano**. `main` siguio en
`success`. **PR #8 CERRADO** con comentario explicando el motivo y linkeando el ADR.

**Por que se cerro (no es "quedarse atras"):** `@types/node` no es Node, es la **descripcion de la API de Node
para TypeScript**. Su major debe seguir al Node que CORREMOS, no al ultimo publicado. Con tipos de 26 sobre
runtime 24, TS acepta APIs que en produccion **no existen**, sin error de compilacion, fallando recien en
runtime. Mergearlo habria INTRODUCIDO un riesgo que hoy no existe.

**Regla `ignore` agregada en `.github/dependabot.yml`** para majors de `@types/node`, asi la propuesta no vuelve
cada semana. **SE LEVANTA en la Fase 5**, al migrar a Node 26 — esta escrito en el comentario del archivo y en
el ADR 0046 para que no se olvide.

**Los otros 4 PRs de Dependabot NO tienen este problema** (turbo, playwright, typescript-eslint,
@types/react-dom): ninguno toca la version de Node. Quedan **abiertos**, sin revisar — decision del owner.

**Efecto lateral bueno del re-link de pnpm:** el lockfile tenia **dos** `@types/node` (la vieja 24.10.1 seguia
referenciada por `@types/node-forge`); quedaron consolidadas en 24.13.3.

**Limite conocido (menor, no bloqueante):** `tools/` no esta cubierto por `pnpm typecheck` (turbo corre los
tsconfig de las 3 apps), asi que un error de tipos en el guard no lo caza el gate — vitest transpila sin
chequear tipos. El guard igual falla en runtime si se rompe.)

Ultima actualizacion previa: 2026-09-02 (**PLAN DE MIGRACION DE NODE ESCRITO: ADR 0046 `aceptada` + spec 0049
`borrador`. Nada de codigo tocado todavia — falta cerrar 2 decisiones abiertas. Punto de retorno.**

**EL HALLAZGO QUE CAMBIA EL PEDIDO: "subir a la ultima estable" NO es ir a Node 26.** Datos verificados el
2026-09-02 contra `nodejs.org/dist/index.json`, el `schedule.json` oficial y la cuenta real de Vercel — no de
memoria:

| Version | Estado | Fechas |
|---|---|---|
| **26.8.1** | Current | salio 2026-08-26 · **LTS el 2026-10-28** · EOL 2029-04-30 |
| 25.9.0 | **EOL** | murio 2026-06-01 |
| **24.20.0** | **Active LTS** (Krypton) | maintenance 2026-10-20 · EOL **2028-04-30** |

**Vercel solo ofrece 24.x (default) / 22.x / 20.x. Node 26 NO existe como runtime ahi**
(`vercel.com/docs/functions/runtimes/node-js/node-js-versions`). `vercel project ls` confirma que
`check-point` corre **24.x**, igual que los otros 9 proyectos de la cuenta. **El techo no es negociable desde
el repo:** no hay `engines` ni `.node-version` que haga desplegar Node 26.

**Por eso el ADR 0046 decide seguir la LTS de Vercel, no la Current de Node.** El argumento decisivo es el
**skew, no la novedad**: si local y CI corren 26 y produccion corre 24, **el CI deja de probar lo que se
despliega** — seria reintroducir, en silencio y con todo en verde, el mismo problema del que este repo acaba
de salir con 0047/0048. Y no hay urgencia: Node 24 tiene soporte hasta **2028-04-30**.

**Estado real del repo: la version esta escrita en 4 lugares y NADA verifica que coincidan.**

| Lugar | Hoy | Objetivo |
|---|---|---|
| `.node-version` | `24.19.0` | `24.20.0` |
| `package.json` → `engines.node` | `>=24.15.0 <25` | `>=24.20.0 <25` |
| `@types/node` (×3 apps) | `24.10.1` | `24.13.3` |
| Vercel Project Settings | `24.x` | `24.x` (**sin cambio**) |

Ese drift es el costo que hace cara la migracion a 26 cuando llegue; el guard de la Fase 3 es el entregable
que la vuelve barata.

**Spec 0049 — 4 fases ahora + 1 agendada, cada una un commit con su verificacion y su rollback** (separadas a
proposito: si el CI se pone rojo, tiene que quedar claro cual cambio lo hizo):
1. Pin a **24.20.0** (`.node-version` + `engines`). Riesgo bajo. **Prod NO cambia**: Vercel ya sirve la ultima
   24.x. Lo que se corrige es que local y CI dejen de probar contra una version MAS VIEJA que la desplegada.
   Prerrequisito: `nvm install 24.20.0` (la maquina solo tiene 24.15.0 y 24.19.0).
2. **`@types/node` → 24.13.3. LA FASE MAS RIESGOSA, y no es obvio:** tipos mas nuevos pueden romper
   `typecheck` sin que cambie una linea de codigo. Si pasa, NO se baja el tipo ni se tapa con `any`. Es ademas
   **la unica fase que mueve el lockfile** → exige `pnpm install` con red y despues **`pnpm fetch`** para
   re-calentar `.pnpm-store` (sin eso, la proxima sesion bajo codex/Auto falla el install offline).
3. **Guard anti-drift** sobre los 4 pines (+ el de pnpm, que tambien esta duplicado: `packageManager` en
   `package.json` vs `version: 11.4.0` hardcodeado en `ci.yml`). **Se prueba rompiendolo a proposito** —
   un guard que nunca falla es decorativo.
4. Actions al dia: `checkout@v4→v7`, `setup-node@v4→v7`, `pnpm/action-setup@v4→v6` (ultimas verificadas por
   `gh api`). Mata el warning de Node 20. **Es un salto de 3 majors de terceros = la mayor superficie de la
   spec**, por eso va sola y al final. OJO: es el runtime DE LAS ACTIONS, no el del proyecto — cosas distintas
   que se parecen.
5. **Node 26: AGENDADA, no se ejecuta.** Disparador de DOS condiciones: (a) 26 en LTS el **2026-10-28** y
   (b) **Vercel lo ofrece** en Project Settings. **Manda la (b)**: la (a) sin la (b) no habilita nada.
   Verificable con `vercel project ls` (columna Node Version) sin entrar al dashboard.

**PENDIENTE ANTES DE IMPLEMENTAR — 2 decisiones abiertas del owner (la spec sigue en `borrador`):**
(1) **Forma del guard**: script + step de CI, o un 4º project de vitest. **Recomendado: vitest**, porque asi
corre con `pnpm test` y por lo tanto tambien en el **Stop hook** — el drift lo introduce un agente editando un
pin, y vitest es el unico de los dos que lo caza en ese mismo turno. (2) **Si se ejecutan las 4 fases o se
corta despues de la 3**: la 4 es la de mayor superficie y menor beneficio (saca un warning).)

Ultima actualizacion previa: 2026-09-02 (**EL CI ESTA VERDE. Specs 0047 y 0048 IMPLEMENTADAS. Corrida `33579163212`
en `success` — la PRIMERA verde en 101 corridas de CI, desde que el workflow existe (2026-08-12). Punto de
retorno.**

```
lint ✓  typecheck ✓  test ✓  playwright install ✓  test:e2e ✓  build ✓  format:check ✓
```

Ningun paso saltado. **Por primera vez el repo tiene un gate de CI que efectivamente verifica.** Antes: 100
corridas, 100 en failure, muriendo en ~25s en el paso 1 (`format:check`) sin ejecutar nada mas — un CI
decorativo detras del cual cualquier regresion de tipos, test roto o build caido habria pasado sin ser vista.

**Que faltaba (spec 0048): el workflow nunca instalaba los browsers de Playwright.** `pnpm install
--frozen-lockfile` trae el paquete `@playwright/test`, pero los binarios se bajan aparte a
`~/.cache/ms-playwright`, vacio en un runner limpio. Fix = un step
`pnpm exec playwright install --with-deps chromium` antes de `test:e2e`. **Solo chromium**:
`playwright.config.ts` no declara `projects`, asi que corre con el default (instalar los tres seria regalar
minutos de CI en cada push). **`--with-deps`** porque el runner de Ubuntu no trae las libs del sistema.
**Sin cache de `~/.cache/ms-playwright` a proposito**: ahorraria ~20-30s pero suma una pieza que puede dar
falsos verdes con una key vieja, y el problema que se estaba arreglando era justamente un CI que mentia. Se
puede medir despues, ahora que hay un tiempo real de corrida (2m0s) contra el cual comparar.

**LOS TESTS E2E ESTABAN SANOS — verificado corriendolos, no razonandolo.** Se ejecutaron con browser real por
primera vez (ni en CI ni en esta maquina habian corrido nunca): **5 passed, 1 skipped en 5.3s**. Los 2 que el
CI daba por rojos (`analytics`, `loyalty`) pasan sin tocarles una linea: era exclusivamente el browser
faltante. Ningun test fue editado ni borrado para conseguir el verde.

**El unico skip de la suite NO es deuda: es opt-in deliberado.** `loyalty-real.spec.ts` se saltea con una
condicion explicita y documentada en el propio archivo — exige `E2E_MERCHANT_BASE_URL`, `E2E_MERCHANT_EMAIL`,
`E2E_MERCHANT_PASSWORD` y `E2E_LOYALTY_MUTATION_TEST=true`, con el motivo escrito: "requiere owner de prueba
nuevo y aislado de la rama de desarrollo". **Muta datos reales**, asi que no se enciende en CI a proposito:
sin owner de prueba aislado, escribiria contra un entorno real desde cada push. Es el unico `test.skip` de
`tests/e2e/` (verificado por grep).

**GOTCHA LOCAL QUE CUESTA MEDIA HORA SI NO SE SABE: los e2e no arrancan si 3000/3001/3002 estan ocupados.**
La suite levanta las 3 apps en puertos FIJOS (consumer 3000, merchant 3001, platform 3002, hardcodeados en el
script `dev` de cada `package.json`). Si algo mas los ocupa, Playwright choca con `EADDRINUSE` y aborta
**antes de ejecutar un solo test** — el error no menciona puertos de entrada y se parece a un problema de
Playwright. Paso de verdad en esta sesion: `next dev` de **otros dos proyectos** (`gym-app` en 3000 desde el
31/ago, `55mas` en 3001) tenian los puertos tomados. Diagnostico: `lsof -nP -iTCP:3000 -sTCP:LISTEN` y
`lsof -a -p <pid> -d cwd -Fn` para ver de que proyecto es. Y **el cache de browsers YA ESTABA** en la Mac
(`~/Library/Caches/ms-playwright`, con el `chromium_headless_shell-1200` que el runner reclamaba): estos
tests se podian correr en local desde siempre, lo que faltaba era correrlos.

**Estado del repo:** todo pusheado a `main` (`c7e64cf`). Nada pendiente de estas dos specs.

**Deuda conocida que queda, sin spec todavia (no bloquea nada):** las GitHub Actions tiran warning de
deprecacion de Node 20 (`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4` forzadas a
correr en Node 24). Estuvo explicitamente fuera de alcance de 0047 y 0048. Y sigue en pie el **pendiente del
owner de la spec 0046**: alta del remitente en Resend + envs en Vercel + QA en vivo del recovery.)

Ultima actualizacion previa: 2026-09-01 (**Spec 0047 (deuda de formato y CI rojo) IMPLEMENTADA con PASS de revisor
independiente — punto de retorno. FALTA UNA COSA: pushear y confirmar que la corrida de CI queda en `success`,
que es el criterio que cierra el problema de fondo.** Flujo `AGENT-WORKFLOW.md` completo (spec cerrada por el
orquestador → implementador → revisor → 1 fix → re-revision del delta → PASS).

**Que se arreglo:** el CI corria `pnpm format:check` como PRIMER paso y fallaba, asi que
`lint`/`typecheck`/`test`/`test:e2e`/`build` NUNCA se ejecutaban en GitHub. Se formatearon los **19** archivos
versionados en deuda (0028/0031/0032/0041/0045), se agrego el script `format` que faltaba en el root
(`prettier --write .` — su ausencia era la causa estructural de que la deuda se acumulara), y `format:check`
paso a ser el **ULTIMO** step de `ci.yml` (sigue siendo bloqueante, pero ya no tapa las fallas que importan).

**Las 2 decisiones que estaban abiertas en el borrador, cerradas por el orquestador con evidencia:**
(1) **`.claude/settings.local.json` va a `.prettierignore`, no se formatea** — `git check-ignore -v` lo resuelve
contra el ignore global del usuario (`~/.config/git/ignore`), o sea es untracked y **nunca llega a GitHub**. Eso
explica la discrepancia que nadie habia atado: el log de CI decia `19 files` y el `format:check` local decia `20`.
Ojo: desaparecio del `format:check` por el `.prettierignore`, NO por estar untracked — **prettier no mira git,
escanea el filesystem**. (2) **Prevencion (c), ambas**: reordenar el CI + hook.

**Hook nuevo `.claude/hooks/format-on-write.sh`** (`PostToolUse` en `Write|Edit`, registrado DESPUES de
`file-size.sh` para que el aviso de tamaño se siga viendo). Es el fix estructural (mistake→rule): cada escritura
sale formateada y la deuda no se re-acumula. **Sale 0 SIEMPRE y en silencio** — es higiene, no un gate; un exit≠0
bloquearia ediciones validas (parse error transitorio a mitad de una edicion multi-paso, prettier ausente).

**LOS 3 GOTCHAS DEL HOOK, todos verificados corriendolo, no razonados:**
- **Prettier resuelve `.prettierignore` desde el CWD, NO desde la ruta del archivo.** Con `cwd=/tmp`,
  `prettier --write <ruta absoluta>` **reescribe** `.claude/settings.local.json` — es decir, un hook ingenuo
  reintroduce en cada sesion justo la deuda que esta spec saca. Por eso el hook hace `cd` a la raiz
  (`CLAUDE_PROJECT_DIR`, con fallback que busca `.prettierignore` hacia arriba).
- **NO se pasa `--ignore-path`** (la spec original lo pedia; se corrigio). En Prettier 3 el default es
  `{.gitignore, .prettierignore}`; fijar la flag perderia el `.gitignore`. Sin ella el hook aplica exactamente
  el mismo criterio que `pnpm format:check`.
- **Guard de contencion (hallazgo del revisor, corregido en 2ª ronda): sin el, el hook reformatea archivos de
  OTROS proyectos con la config de prettier de este** (reproducido con `/tmp/otro-proyecto/x.ts`). Se normalizan
  ambos paths con `fs.realpathSync` (cubre relativos, `..`, trailing slash, symlinks y el `/tmp`→`/private/tmp`
  de macOS) y si el archivo cae fuera de la raiz, sale 0 sin tocar nada.

**Verificacion (salida real, corrida por el revisor por su cuenta):** `format:check` **exit 0**, lint exit 0,
typecheck **3/3 sin cache** (`TURBO_FORCE=true`, `0 cached`), test **254 passed** (identico al baseline — no bajo),
build exit 0. **El diff de los 19 es SOLO formato**, probado con dos oraculos independientes: (a)
`prettier(git show HEAD:<f>) == worktree` byte a byte, **19/19** —concluyente, porque prettier es funcion pura del
AST—, y (b) comparacion de token stream con el parser de TypeScript. Ningun archivo paso las 300 lineas del hook
`file-size` (maximos: `recovery/deliver.ts` 263, `step-preview.tsx` 253). **Falso verde descartado**: se
desformateo a proposito un archivo de `apps/merchant/src` y `format:check` lo cazo, o sea el `.prettierignore` no
se ensancho de mas. El hook se probo adversarialmente (formatea lo del repo desde 2 caminos de raiz y CWD ajeno,
deja intactos los ignorados y todo lo de afuera, exit 0 en 8 casos degenerados) y se verifico que **no es
decorativo** corriendo la version SIN guard sobre el mismo caso.

**RIESGO ABIERTO QUE ESTA SPEC DESTAPA (no es fallo suyo): `pnpm test:e2e` va a correr de verdad en GitHub por
primera vez.** Estaba oculto detras del `format:check` rojo y **nunca se ejecuto ni en esta maquina ni en CI**.
`npx playwright test --list` confirma que compila: **6 tests en 4 archivos** (`health`, `analytics`, `loyalty`,
`loyalty-real`), levantan 3 dev servers y `loyalty-real` toca DB. **Si la corrida post-push sale roja en
`test:e2e`, no es regresion de 0047 — es la deuda que 0047 saca a la luz, y va a su propia spec.**

**PUSH HECHO** (commit `8e0d7c0`; el push subio 4 commits — la implementacion de 0046 tambien estaba sin
pushear). El gotcha de `GH_TOKEN` invalido del `CLAUDE.md` sigue vigente y el fix documentado funciono tal cual:
`export GH_TOKEN=; gh auth switch --hostname github.com --user maxhost` y despues
`GH_TOKEN= git -c credential.helper='!gh auth git-credential' push origin main`.

**RESULTADO DEL CI (corrida `33575852432`): ROJO. El ultimo criterio de aceptacion de 0047 NO se cumplio y
migro a la spec 0048.** Pero el arreglo funciono en lo que importaba: **`lint`, `typecheck` y `test` corrieron
y pasaron en GitHub POR PRIMERA VEZ** (antes el job moria en el step 1 y no verificaba nada). El job ahora
muere en `test:e2e`, y `build`/`format:check` no llegan a correr.

```
lint ✓  typecheck ✓  test ✓  test:e2e ✗ ← corta aca  build -  format:check -
```

**Causa, verificada: el workflow nunca instala los browsers de Playwright.** `grep -n playwright
.github/workflows/*.yml` no devuelve NINGUNA linea. `pnpm install --frozen-lockfile` instala el paquete
`@playwright/test@1.57.0`, pero los binarios se bajan aparte a `~/.cache/ms-playwright`, que en un runner
limpio esta vacio → `Error: browserType.launch: Executable doesn't exist ... chrome-headless-shell`.
De 6 tests: **3 pasan** (los que no abren browser), **2 fallan**, 1 sin explicar todavia (probablemente
skippeado — hay que confirmarlo, un test que se auto-saltea en silencio es un gate que no gatea).

**ESTO ES DEUDA DESTAPADA, NO REGRESION DE 0047** — es exactamente el riesgo que la spec 0047 anticipo por
escrito antes del push. Y ojo con la lectura facil: **el fallo es de infraestructura del runner y NO dice nada
sobre si los e2e pasan.** Nunca corrieron con browser, ni en CI ni en esta maquina. Arreglar la instalacion
puede destapar fallas reales de los tests; el verde no esta garantizado. No se reproduce en local (aca los
browsers ya estan bajados), asi que la unica señal valida es la corrida de Actions.

**PROXIMO PASO: spec 0048 (`borrador`, escrita, INDEX actualizado) — el step de `playwright install` en
`ci.yml`.** Decisiones abiertas ahi: que browsers instalar (`playwright.config.ts` no declara `projects`, hay
que confirmar contra cual corre de verdad antes de elegir entre `chromium` y los tres), si entra caché de
`~/.cache/ms-playwright`, y que hace `loyalty-real.spec.ts` (toca DB) sin `DATABASE_URL` en CI. Regla dura
heredada de `CLAUDE.md`: **ningun test e2e se edita ni se borra para conseguir el verde.**)

Ultima actualizacion previa: 2026-08-30 (**Spec 0046 (recovery de owner/staff por OTP al email) IMPLEMENTADA con
PASS de revisor independiente (en 2 rondas: FAIL → fixes → PASS) + migración `0027` aplicada y verificada en
PROD — punto de retorno.** Flujo `AGENT-WORKFLOW.md` completo. Spec `implementada`, INDEX actualizado.

**EL HALLAZGO QUE IMPORTA (bloqueante del revisor, ronda 1): las rutas propias de better-auth salteaban TODA
la protección.** El orquestador había blindado `/api/merchant/recovery/*` (gate, rate-limit persistente,
chequeo de staff deshabilitado, auditoría), pero el catch-all **preexistente** `app/api/auth/[...all]/route.ts`
publica TODOS los endpoints del plugin `emailOTP` — una puerta con candado al lado de una pared abierta. El
revisor lo demostró end-to-end contra la rama Neon: con el gate APAGADO `/api/auth/email-otp/request-password-reset`
devolvía 200 y entregaba el OTP; un **staff deshabilitado** recibía el código y **cambiaba su contraseña**; una
ráfaga de 8 mandaba **8 emails** contra un cap de 3/h, con **0 filas de auditoría**. **Fix:** `disabledPaths`
en `getMerchantAuth()` con los 9 paths HTTP del plugin. Verificado en `node_modules` (`dist/api/index.mjs:164-166`)
que se aplica en el `onRequest` del router (→404) y **NO** afecta las llamadas server-side `auth.api.*`, que es
lo que usan nuestras rutas. **Lección general: agregar un plugin de better-auth agrega SUPERFICIE HTTP por el
catch-all — no alcanza con envolverlo en una ruta propia.**
Otros 3 fixes de la ronda 1: `middleware.ts` (matcher `/forgot-password`) para el **503 real** de la página —un
server component de Next NO puede fijar status—; `audit(...,"reset_ok")` en try/catch (un fallo de log ya no
reporta 503 sobre una contraseña YA cambiada, que dejaba al usuario reintentando con un OTP consumido); e
intervalo explícito en el `FILTER` de `email_day`.
**Qué se construyó:** plugin `emailOTP` de better-auth en `server/auth.ts` (OTP de 6 dígitos, `expiresIn`
600s, `allowedAttempts` 3, `disableSignUp: true` para que `/sign-in/email-otp` no auto-cree cuentas, y el
callback `sendVerificationOTP` envía SÓLO para `type === "forget-password"`); contrato `EmailChannel`
(`server/email/{channel,console,resend,provider}.ts`) con **Resend por `fetch` a `https://api.resend.com/emails`,
SIN dependencia npm** — espeja el patrón de `ClickSendOtpChannel` (decisión del orquestador: mismo contrato
y proveedor que pide el ADR 0045, sin la fricción del store offline de pnpm); orquestación
`server/recovery/{internal,merchant-recovery}.ts` (gate, normalización, rate-limit persistente, enumeración,
mapeo de errores); tabla nueva `merchant_auth.password_reset_attempt` (migración **aditiva** `0027_good_drax`,
generada con `db:generate`, no a mano); rutas `api/merchant/recovery/{request,reset}`; UI `/forgot-password`
de 2 pasos + link desde `/login`; envs documentadas en `.env.example`.
**HALLAZGO CRÍTICO verificado en `node_modules` (no asumido):** better-auth 1.6.26 `resetPasswordEmailOTP`
revoca sesiones **sólo si `emailAndPassword.revokeSessionsOnPasswordReset === true`** (leído en
`dist/plugins/email-otp/routes.mjs`). Sin ese flag el DoD "sesiones revocadas" NO se cumple aunque todo lo
demás ande. El flag está puesto y la revocación quedó verificada contra DB real.
**Decisiones de seguridad que la spec no detallaba:** (a) si el envío de email falla, `/request` igual
responde 200 — si el error saliera sólo para cuentas reales, el fallo del proveedor se volvería un oráculo de
enumeración; (b) la validación de contraseña corta ocurre ANTES de canjear el OTP para no quemar un código
válido; (c) `isRecoverable` deja recuperar al owner sin membership todavía (onboarding a medias) pero no al
staff cuyo único membership está `disabled`.
**Gates finales (corridos, salida real):** typecheck **3/3**, lint limpio, unit **254** (213 previos + 41
nuevos; los del consumidor 0032 intactos), build **3/3** (`ƒ Proxy (Middleware)` presente). **Integración Neon
5/5** en rama efímera `spec-0046-merchant-recovery` (`br-holy-wave-ax5s6c9w`, off prod): entrega del código +
fila de auditoría con IP hasheada, email desconocido no envía nada, código incorrecto rechazado, **cambio de
contraseña + TODAS las sesiones previas revocadas + login viejo falla y el nuevo anda**, y el cap horario
aplicado desde la DB. Anti-fuga verificada por grep de un build con sentinel: `RESEND_API_KEY` **0 archivos**
en `.next/static`.
**Revisor independiente: PASS (ronda 2).** Corrió los 4 gates **sin caché** (`--force`, `0 cached`) +
integración 5/5 por su cuenta; reprodujo el escenario del staff deshabilitado end-to-end (ahora 404 + 0 emails
+ **la contraseña vieja sigue siendo válida**); y —lo más valioso— **comprobó que el test del guard no es
tautológico** construyendo un `betterAuth` SIN `disabledPaths`: los 9 paths dan 400/200, ninguno 404, así que
los strings son rutas reales. Además leyó el **chunk edge compilado** para confirmar que
`process.env.PASSWORD_RECOVERY_ENABLED` **no quedó inlineado en build-time** (gotcha clásico del edge
middleware): el flag se evalúa en runtime.
**Migración `0027_good_drax` APLICADA Y VERIFICADA EN PROD por SQL** (host unpooled; 27→28 migraciones;
`merchant_auth` 4→5 tablas con `password_reset_attempt`: 5 columnas, 3 índices, CHECK de `kind`;
`core`(22)/`consumer`(10) intactos; los 18 usuarios existentes sin tocar).
**Residuales (menores, del revisor, ninguno bloqueante):** (a) con el gate ENCENDIDO pero sin
`RESEND_API_KEY`/`EMAIL_FROM` la página da 200 con panel oscuro en vez de 503 (las 2 rutas API sí dan 503; el
middleware sólo mira el flag); (b) oráculo de **timing** en `/request` —sólo las cuentas reales pagan el
round-trip a Resend— acotado por 3/h y 5/día por email; (c) el cap por IP no está serializado (el advisory
lock es por email), así que una ráfaga concurrente desde una IP contra emails distintos puede pasar levemente
el 10/h; (d) `/reset` sin rate-limit propio, acotado por `allowedAttempts: 3` × 5 OTP/día ⇒ ≤15 intentos
diarios contra 10⁶.
**PENDIENTE DEL OWNER (bloquea el uso, no el código):** (1) alta del **remitente en Resend** (verificar
`checkpass.club`) + cargar en Vercel `PASSWORD_RECOVERY_ENABLED=true`, `EMAIL_PROVIDER=resend`,
`RESEND_API_KEY`, `EMAIL_FROM` — **sin esto `/forgot-password` responde 503 a propósito**; (2) **QA en vivo**:
pedir reset del propio email, recibir el OTP, cambiar la clave, re-loguear y confirmar que las sesiones viejas
murieron.
**Ramas Neon efímeras BORRADAS** con OK del owner: `spec-0046-merchant-recovery` (`br-holy-wave-ax5s6c9w`) y
la residual `spec-0043-staff` (`br-quiet-mouse-axp5nlrh`, arrastrada de la sesión anterior). `list_branches`
verifica que **solo queda `main`** (default/primary = prod).

**HALLAZGO GRANDE DE ESTA SESIÓN, FUERA DE 0046 → spec 0047 `borrador`: EL CI ESTÁ ROJO Y NO VERIFICA NADA.**
`.github/workflows/ci.yml` corre `pnpm format:check` como **primer** paso y falla con 20 archivos sin
formatear; como Actions corta al primer exit≠0, **`lint`, `typecheck`, `test`, `test:e2e` y `build` NUNCA se
ejecutan en GitHub**. Verificado, no inferido: 3 corridas seguidas en `failure` sobre `main` (`33329183454`,
`33328757578`, `33328440371`) y el log termina en `Code style issues found in 19 files`. Los 20 archivos son
de specs viejas (0028/0031/0032/0041/0045) — **ninguno de 0046**, que quedó formateado. Agravante: **no existe
el script `format` (escritura) en el `package.json` de root**, sólo `format:check` — causa estructural de que
la deuda se acumulara. **Ojo al implementarla:** el formateo puede empujar un archivo sobre las 300 líneas del
hook `file-size` (le pasó a `merchant-recovery.test.ts` en esta sesión, hubo que dividirlo) → dividir, no
exceptuar. Y `test:e2e` **nunca corrió en esta máquina**: podría estar roto sin que nadie lo sepa.)

Ultima actualizacion previa: 2026-08-30 (**ADR 0045 + spec 0046 CERRADA: recovery de owner/staff por OTP al
email (Resend) — lista para implementar.** Owner/staff hoy NO tienen recuperación de contraseña
(`auth.ts` no configura olvido); el email ya es su identidad en better-auth. Diseño cerrado con el
owner: OTP de 6 dígitos al email con el plugin `emailOTP` de better-auth (posee el OTP y el set de
contraseña — hashing + revocación de sesiones correctos, NO se toca `account.password` a mano),
**Resend** como proveedor activo detrás de un contrato `EmailChannel` intercambiable (ahí vive el
"cambiar de canal a futuro"; SMS para owner/staff queda como costura, no se construye). Resistente a
enumeración, rate-limit persistente por email/IP (tabla nueva `merchant_auth.password_reset_attempt`,
migración 0027), gate `PASSWORD_RECOVERY_ENABLED` (off → 503). El OTP del **consumidor** (SMS, spec
0032) queda intacto y aislado. Spec disjunta (única otra abierta, 0031, no solapa). **Próximo paso:
implementar 0046** con el protocolo `AGENT-WORKFLOW.md` (implementador → revisor independiente; rama
Neon efímera para el test de integración). **OJO implementador:** verificar la API del plugin
`emailOTP` contra la versión instalada de better-auth leyendo `node_modules` — no asumir de memoria
(regla del `AGENTS.md` de merchant). Dependencia nueva `resend` → correr `pnpm fetch` en terminal con
red antes de la sesión de implementación bajo codex/Auto (gotcha del store offline en `CLAUDE.md`).
Nada commiteado aún de 0046 salvo los docs de esta sesión.)

Ultima actualizacion previa: 2026-08-30 (**QA en vivo del owner sobre `checkpass.club` CERRADO + fix de CORS
de Geoapify — punto de retorno.** El owner completó los pasos de dashboard (Vercel `BETTER_AUTH_URL`
+ CORS de R2) y corrió el QA en producción: **landing (0045), creación de staff, login de staff y scan
del mostrador — todo funciona.** Registro/login/subidas de imagen andan en el dominio custom.
**Bloqueante encontrado y resuelto en el QA: el buscador de direcciones/locales (Geoapify) daba 401 y
después CORS.** Diagnóstico (verificado por terminal, no adivinado): la clave pública
`NEXT_PUBLIC_GEOAPIFY_API_KEY` restringida por origen devuelve un `Access-Control-Allow-Origin` **FIJO**
(un solo dominio, sin `Vary: Origin`, sin echo del `Origin`) → por CORS sólo servía `check-point-pied.vercel.app`;
desde `www.checkpass.club` el browser bloqueaba. **Fix (owner, sin código): quitó TODAS las Allowed
Origins de la clave pública → Geoapify responde `*` → el autocomplete anda desde cualquier dominio.**
Verificado en vivo por el owner. Sin cambios de código en esta sesión (`git status` limpio → no
corresponde gate). Gotcha completo + comando de diagnóstico + fix durable pendiente (Opción B: proxear
por el server con `GEOAPIFY_API_KEY`) documentados en `CLAUDE.md` (Gotchas). **Residual/backlog:** spec
Opción B (proxy server-side del autocomplete) para no depender de la clave pública sin restricción; y
spec 0032 (recovery OTP) sigue pendiente de env vars/provider. Nada por commitear salvo estos docs.)

Ultima actualizacion previa: 2026-08-30 (**Fix de dominio custom `checkpass.club` (trustedOrigins de
better-auth) — punto de retorno; QA en vivo es el próximo paso.** El owner reportó que registrarse
desde `checkpass.club` fallaba. Diagnóstico: **no era Neon** (Neon es solo la DB; su "trusted domain"
es de *Neon Auth*, producto que este repo no usa) — la auth es **better-auth**, que sólo confía en
`BETTER_AUTH_URL`; en Vercel esa env var seguía apuntando al dominio viejo. Fix en código
(`server/auth.ts`): `trustedOrigins = [BETTER_AUTH_URL, ...BETTER_AUTH_TRUSTED_ORIGINS.split(",")]`
(env nueva opcional, coma-separada, acepta comodines de better-auth tipo `https://*.vercel.app`;
retrocompatible — sin la env nueva se comporta igual que antes). Documentado en `.env.example`.
**Gates:** typecheck 3/3, lint, build 3/3. Commit `11c5f26` en `main`.

**Acción pendiente del OWNER en dashboards (no bloquea código, son pasos manuales):**
1. **Vercel** → Environment Variables (Production) → `BETTER_AUTH_URL=https://checkpass.club`
   (+ opcional `BETTER_AUTH_TRUSTED_ORIGINS=https://www.checkpass.club,https://*.vercel.app`) →
   **redeploy**. Esto es lo que arregla el registro/login.
2. **R2 (Cloudflare)** → bucket → CORS → agregar `https://checkpass.club` (+ `www`) a
   `AllowedOrigins` con métodos `GET,PUT`. Necesario porque las subidas de imagen (logo/producto/
   sello) hacen `PUT` **directo del navegador** a la URL firmada (`use-brand-logo.ts`,
   `use-catalog-image.ts`, etc.) — sin este CORS, subir imágenes falla en el dominio nuevo.

## Ahora

**Spec 0046 (recovery de owner/staff por OTP al email) CERRADA end-to-end (2026-08-30):** implementada,
PASS de revisor independiente en 2 rondas, migración `0027` en PROD, ramas Neon efímeras borradas, docs
sincronizados. **Lo único que falta es del owner: Resend + 4 envs en Vercel + QA en vivo** (detalle en la
última actualización). Antes de esto, el QA de `checkpass.club` ya había cerrado OK (landing 0045, staff y
mostrador 0043, Geoapify destrabado).

**Lo próximo recomendado: spec 0047 (`borrador`) — el CI está rojo y no verifica nada.** Es el ítem de
mayor palanca: barato, mecánico, sin cambio de comportamiento, y devuelve el gate de CI que hoy no existe.

Pendiente (no bloquea lo ya cerrado):
- **Spec 0046 (recovery owner/staff por OTP al email) — IMPLEMENTADA, PASS del revisor, migración `0027`
  en PROD.** ADR 0045. Detalle completo en la última actualización arriba. **Lo único que falta es del
  owner:** alta del remitente en Resend + las 4 envs en Vercel (`PASSWORD_RECOVERY_ENABLED=true`,
  `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`), QA en vivo, OK para borrar la rama efímera
  `br-holy-wave-ax5s6c9w`, y autorizar el commit. Hasta que carguen las envs, `/forgot-password` responde
  **503 a propósito** (la feature queda oscura).
  Nota: al final NO hizo falta la dependencia npm `resend` (el adaptador usa `fetch`, como los canales SMS),
  así que el `pnpm fetch` de re-warm del store fue innecesario para esta spec.
- **Spec 0047 (deuda de formato + CI rojo) — `borrador`, candidata a lo próximo.** Descubierta en esta
  sesión. **Es el trabajo de mayor palanca pendiente:** hoy el CI de GitHub no verifica NADA porque muere
  en `format:check`. Es higiene mecánica (20 archivos + un script + prevención), sin cambio de
  comportamiento, y devuelve el gate de CI. Ver `docs/specs/0047-deuda-de-formato-y-ci-rojo.md`; la única
  decisión abierta es la prevención (reordenar gates / hook de formato / ambas).
- **Backlog — spec Opción B (proxy server-side de Geoapify):** hoy el autocomplete pega directo del
  navegador con la clave pública SIN restricción de origen (scrapeable). El fix durable es proxearlo
  por el server del merchant con `GEOAPIFY_API_KEY` (same-origin, cero CORS, clave oculta). Requiere
  spec cerrada antes de tocar código. No urgente — el `*` funciona.
- **Spec 0032 (recovery OTP):** sigue pendiente de env vars/provider (detalle abajo).

Checklist de QA — specs ya verificadas en vivo (✅) y la que falta:
- ✅ **Spec 0045 (landing):** entrar a `checkpass.club` sin sesión → landing → "Acceder"/"Crea tu
  negocio"; con sesión → `/backoffice`.
- ✅ **Spec 0043 (staff):** owner crea staff → login en otro dispositivo → consola de mostrador
  (sin ver marca/programa/catálogo/personal) → escanear y acreditar → historial del día → desactivar.
- **Spec 0032 (recovery OTP):** requiere ANTES cargar en Vercel `RECOVERY_ENABLED=true` +
  `OTP_HMAC_SECRET`(≥32B) + `OTP_ENCRYPTION_KEY`(base64 32B) + credenciales ClickSend/Twilio.
  Camino barato sin cargar saldo: **ClickSend da $2 AUD de crédito trial** al registrarse (14 días,
  alcanza para varios OTP a Ecuador; dejar `CLICKSEND_FROM` vacío) — o Twilio trial (SMS gratis sólo
  a número verificado). Sin esto, `/recover` responde 503 (oscuro a propósito).

Ultima actualizacion previa: 2026-08-30 (**Spec 0045 (landing de entrada) IMPLEMENTADA — punto de retorno.**
Spec chica: la raíz `/` (checkpass.club) redirigía directo al wizard de registro de negocio. Ahora, sin
sesión, `/` muestra una **landing mínima** (estructura, sin diseño; reusa `panel/button`) con "Acceder"
(→ `/login`) y "Crea tu negocio" (→ `/onboarding`); con sesión sigue yendo a `/backoffice`. Login y
registro ya existían y se enlazan. Único archivo: `app/page.tsx` (de redirect a landing). Sin ADR (no
hay decisión de arquitectura). **Gates:** typecheck 3/3, lint, unit 213, build 3/3. Implementado directo
por el orquestador (cambio de 1 archivo, bajo riesgo, sin ciclo implementador/revisor). Commit `fe8e68d`
en `main`. **Residual:** diseño real de la landing (fuera de alcance). **Contexto:** el owner está
configurando el dominio `checkpass.club` en Vercel. Detalle en `docs/specs/0045-*.md`.)

Ultima actualizacion previa: 2026-08-30 (**Spec 0043 (login de staff + consola de mostrador) IMPLEMENTADA con
PASS de revisor independiente + migración `0026` aplicada y verificada en PROD — punto de retorno.**
Tajada del borrador 0005 (ADR 0044): que el **personal** opere el mostrador sin ver el resto del
backoffice. Flujo `AGENT-WORKFLOW.md`: spec cerrada con el owner → **implementador** (subagente) →
**revisor independiente FAIL** (1 bloqueante: la subpágina `backoffice/brand/kit/page.tsx` había quedado
con el guard viejo sin chequeo de rol → un staff la veía por URL) → orquestador la migró a `requireOwner`
y verificó por barrido que **ninguna** página de backoffice usa ya `getSession` inline → **PASS efectivo**;
además resolvió el menor (alta de staff borra el user better-auth si falla el insert de membership, para no
"quemar" el email). **Qué se construyó:** rol `staff` sobre `business_membership` (CHECK `role in
('owner','staff')` + columna `status active|disabled`, migración aditiva `0026`); guard compartido
`server/auth-guards.ts` (`requireBackofficeSession`/`requireOwner` — owner-only redirige staff a la
consola, NO a onboarding); `server/staff.ts` (alta vía better-auth `signUpEmail` **sin propagar la cookie
del owner**, listar, activar/desactivar = `status` + revocar sesiones, sin borrar al user → preserva
auditoría), rutas `api/staff/*` owner-only con aislamiento por negocio; UI `backoffice/staff` (reemplaza el
mock `demo/staff`); consola `backoffice/counter` reencuadrada = **historial de acreditaciones del día del
negocio** (`server/counter/history.ts` `listTodaysAccreditations`, zona horaria del negocio) + botón
Escanear que lanza el flujo 0030 **intacto**. Las páginas owner-only (brand/loyalty/catalog/home/brand-kit)
pasan por `requireOwner`. **Sin canje de cupones** (0006) ni staff atado a local (fuera de alcance).
**Gates:** typecheck 3/3, lint, unit **213**, build 3/3, **integración Neon 5/5** en rama efímera
`spec-0043-staff` (`br-quiet-mouse-axp5nlrh`, off prod). **Migración `0026_cynical_mister_fear` aplicada y
verificada por SQL en PROD** (26→27; `business_membership` gana `status` + 2 CHECK; memberships existentes →
`active`; `core`(22)/`merchant_auth`(4)/`consumer`(10) intactos). **Residuales (menores, no bloquean):** (a)
**QA en vivo del owner** — crear un staff, entrar en otro dispositivo, ver sólo la consola, escanear+acreditar,
desactivarlo y confirmar que pierde acceso; (b) el historial muestra las acreditaciones del negocio (todos
los operadores) — si el owner prefiere "solo las mías" es un filtro por `operator_user_id`; (c) las páginas
mock `demo/*` siguen sin guard de rol (se gatearán al volverse reales); (d) rama efímera `spec-0043-staff`
sin borrar (auto-expira o pedir al owner). Commit + push a `main` en esta sesión. **Próximo paso: revisar
el siguiente spec pendiente** — 0040 (cropper) o los fundacionales restantes (0003 Incentive Engine es el
keystone no construido; 0006/0007/0009 dependen de él). Detalle de diseño abajo.)

Ultima actualizacion previa: 2026-08-30 (**Spec 0032 (recuperación passwordless por OTP SMS) IMPLEMENTADA con
PASS de revisor independiente + migración `0025` aplicada y verificada en PROD — punto de retorno.**
Sesión de review + hardening: el árbol ya traía la implementación del implementador (sin commitear) y
el owner pidió auditarla. **Se hallaron 4 bugs graves + 3 menores y se corrigieron todos con el flujo
`AGENT-WORKFLOW.md`** (orquestador implementa → revisor independiente PASS → aplica a prod). **Los 4
graves:** (1) **idempotencia replayaba un challenge muerto** — tras un fallo de envío el SELECT de
replay matcheaba la delivery `failed`/challenge `invalidated` y devolvía 202 con un `challengeId` que
jamás verificaba; fix: el replay exige `c.status='pending' AND c.expires_at>now` y los índices
`otp_delivery_phone_client_request_unique` + `otp_delivery_challenge_kind_unique` pasan a **parciales**
(`WHERE status in ('sending','accepted','unknown')`) para que una `failed` libere la clave. (2) **un
reenvío fallido mataba el código inicial válido** — `deliverReservation` compartía la rama de error;
fix: sólo invalida el challenge si `kind='initial'`. (3) **sin corrida de integración** (el implementador
nunca la corrió — se probó al correrla: cazó un **fixture roto**, el test 5/24h backdateaba `accepted_at`
en vez de `reserved_at` y se auto-rate-limitaba por 3/h). (4) **`withDbTransaction` abría/cerraba un Pool
WS por request** → singleton por connection string en `server/db.ts` + guard de `webSocketConstructor`.
**Menores:** `RECOVERY_COUNTRIES` a fuente única `lib/recovery-countries.ts` (server+cliente); helper
`establishRecoveredSession` (revoke+`rotatePassCredentials`+sesión) reusado por verify-wallet y profile
(mata la duplicación de la rotación); país del perfil desde el challenge, no del body. **Además** el
implementador había dejado 2 archivos >300 líneas → split: `schema/otp.ts` (otp fuera de
`schema/consumer.ts`) y `consumer/recovery/{internal,deliver,verify}.ts` + barrel `recovery.ts` (patrón
del repo). **Gates verdes:** typecheck 3/3, lint, unit **198**, build 3/3, **integración Neon 10/10** en
rama efímera `spec-0032-recovery-fixes` (`br-flat-lab-axtggvs8`, off prod `main`, con `expiresAt` →
auto-borra, sin gate destructivo). Los 2 tests de regresión nuevos viven en archivo separado
`consumer-recovery-failure.neon.integration.test.ts` (dividir, no extender). **Revisor independiente:
PASS** — corrió los 4 gates + integración 10/10 por su cuenta, verificó los 7 hallazgos arreglados
uno por uno, la anti-fuga (ningún `*_hash`/`*token`/ciphertext/teléfono en DTO/log), la atomicidad
(revoke+rotate+sesión en una tx interactiva con `FOR UPDATE`), la carrera de alta sin overwrite; 3
menores no-bloqueantes nuevos (alta nueva sin colisión rota+encola push no-op —paridad con el original—;
`rotate.ts` usa `now()` de SQL; `otpProviderName` loguea 'clicksend' en modo `console` dev). **Migración
`0025_narrow_mephistopheles` (regenerada limpia, reemplazó el `0025_pretty_madame_web` del implementador)
APLICADA Y VERIFICADA EN PROD por SQL** (`db:migrate` host unpooled; 25→26 migraciones; `consumer` 8→10
tablas; ambos índices parciales presentes en `otp_delivery`; `core`(22)/`merchant_auth`(4) intactos).
**Residuales:** (a) **QA en vivo del owner — PENDIENTE (se decidió NO bloquear por esto).** Camino barato
sin cargar saldo: **ClickSend da $2 AUD de crédito trial al registrarse** (14 días; alcanza para varios
OTP a Ecuador; **dejar `CLICKSEND_FROM` vacío** para que use número compartido y evitar rechazo de
sender-ID alfanumérico a EC — el código sólo manda `from` si está seteado), o **Twilio trial** (SMS gratis
sólo a número verificado, hasta 5). Para activarlo hay que **cargar en Vercel**: `RECOVERY_ENABLED=true`,
`OTP_HMAC_SECRET`(≥32B), `OTP_ENCRYPTION_KEY`(base64 de 32B, `openssl rand -base64 32`), y las credenciales
del provider (`CLICKSEND_USERNAME`/`CLICKSEND_API_KEY` o las de Twilio). Con `RECOVERY_ENABLED=false`
(default) `/recover` responde 503 y la feature queda oscura. Checklist QA: SMS real a un operador
ecuatoriano + recuperar en otro teléfono y ver morir el QR/portal viejo + onboarding de número nuevo;
(b) el archivo de integración **base** sigue en 447 líneas (>300, del implementador) — split mecánico
como follow-up; (c) los 3 menores no-bloqueantes del revisor. **`RECOVERY_ENABLED=false` por defecto** →
la feature queda oscura en prod hasta que el owner cargue secretos y la active. Commit + push a `main` en
esta sesión (`d72997f` + `4b2db73`). **Próximo paso de la próxima sesión: revisar el siguiente spec
pendiente** — candidato natural **spec 0040** (cropper de imagen en el cliente, `borrador`, implementa
ADR 0041; el owner lo tenía como "trabajo futuro para retomar cuando se priorice"), o alguno de los
borradores fundacionales `0001`–`0009` (siguen en `borrador` hasta validar arquitectura). Empezar leyendo
la spec candidata + su ADR, cerrar diseño con el owner si hace falta, y recién ahí `AGENT-WORKFLOW.md`.
Detalle de diseño abajo.)

Ultima actualizacion previa: 2026-08-17 (**Spec 0032 (recuperación passwordless por OTP SMS) CERRADA con
el owner + ADR 0013 revisado — solo diseño, sin código, punto de retorno.** Decisiones cerradas:
CheckPass Club genera/verifica OTP propio; `OtpChannel` transporta SMS común mediante
`ClickSendOtpChannel` o `TwilioOtpChannel`, **ClickSend activo inicialmente**, Twilio seleccionable
por entorno, **sin fallback automático**; seam preparado para futura selección global/por país en
admin de plataforma (nunca owner). **Recovery solamente**: el enrolamiento 0028 sigue sin SMS por
costo. Número existente → prueba posesión, verifica la única cuenta de ese teléfono, revoca todas
las sesiones, rota atómicamente QR+web token+Wallet devices+Web Push mediante 0033 y crea sesión
nueva. Número inexistente → mismo OTP/respuesta, ticket HttpOnly de 15 min → onboarding corto
nombre/apellido/país → cuenta ya verificada, sin membresía; carrera con alta concurrente recupera la
cuenta única, sin merge ni overwrite. OTP: 6 dígitos CSPRNG, HMAC + ciphertext AES-256-GCM para
reenviar el mismo código, 5 min, 2 intentos; SMS inicial + **un** reenvío después de 60s; challenge
nuevo invalida anterior. Límites Postgres por teléfono, sin IP: 3 entregas/h y 5/24h (inicial y
reenvío cuentan). Países soberanos de América salvo Guyana/Surinam + España; PT Brasil, ES países
hispanos, EN angloparlantes/fallback. UI `/recover`, soporte placeholder sin acción. WhatsApp,
selector admin, francés/criollo y soporte WhatsApp quedan fuera. **Docs sincronizados:** spec 0032
`cerrada`, ADR 0013 `aceptada` (supersede Telnyx/Twilio Verify), INDEX/ARCHITECTURE/HANDOFF. **Árbol
incluye además el rebrand app-wide a CheckPass Club de esta sesión**, ya verificado antes con
typecheck 3/3, lint y wallet unit 7/7. **Próximo paso después de `/clear`: implementar 0032 con
`docs/AGENT-WORKFLOW.md`** (implementador → revisor independiente; migración aditiva + rama Neon
efímera; ClickSend y Twilio reales son QA manual, nunca exponer secretos). Spec no disjunta:
serializar `consumer.ts`, `wallet/rotate.ts` y `enroll-form.tsx`.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0041 (brand kit — afiche de enrolamiento por local)
IMPLEMENTADA con PASS de revisor independiente + migración `0024` aplicada y verificada en PROD —
punto de retorno.** Flujo `AGENT-WORKFLOW.md` completo (implementador → revisor independiente PASS →
orquestador aplica a prod y cierra). **Contexto de la sesión:** el árbol ya traía trabajo parcial de
sesiones previas cuyos agentes en background murieron con el cierre de sesión (patrón observado 3×:
los agentes async NO sobreviven el corte de sesión); el server-side de atribución + dominio
`brand-kit/*` + helpers `qr-render` ya estaban en disco. El orquestador **completó el trabajo
directamente** (cada Write aterriza en disco, sobrevive el crash): wizard de 3 pasos
(`brand-kit-wizard.tsx` + `steps/{step-template,step-brand-check,step-preview}.tsx`), **5 plantillas**
por rubro (`templates/template-{bar,lodging,retail,services,minimal}.tsx` + `parts.tsx`/`types.ts`),
`poster-preview.tsx`, `page.tsx` server (sesión→negocio→`getBrandKitData`, estados guía sin
programa/sin logo), link "Generar afiche" en `brand/page.tsx`, estilos + `@media print` A4/A5
(aislamiento por `visibility`, `@page` inyectado) en `globals.css`, migración **`0024_absurd_romulus.sql`**
(aditiva: ADD COLUMN `origin_location_id` uuid nullable + FK `set null` cross-schema consumer→core +
índice), test de integración de atribución en **archivo separado** (`consumer-enrollment-attribution.neon.integration.test.ts`
— el hook `file-size` bloqueó extender el base: dividir, no extender), y un test que **ancla
`qr-render` contra la salida REAL de `qrcode`** (`brand-kit/qr.test.ts` — confirmado: `qrcode` emite
`stroke="#000000"` + `viewBox`; los helpers operan sobre eso, no un fixture inventado). Fixes de gate:
`MembershipRow.originLocationId?` interno (opcional; el DTO `membershipResponse` NO lo serializa —
`consumer.test.ts` lo pinnea), quitados `eslint-disable` de reglas no configuradas
(`@next/next/no-img-element`/`react/no-danger`). **Estilos de QR (3, sin dep):** negro / teñido con
primary / logo al centro a **EC-H**. **`renderQrSvg` parametrizado** por el orquestador
(`payload,ec="M"` default → el pase intacto; el afiche pide `"H"`). **Gates verdes:** typecheck 3/3,
lint, unit **187/76-skip** (24 nuevos brand-kit+kit), build 3/3. **Integración Neon en rama efímera
`spec-0041-brand-kit` (`br-silent-rice-axvr9ctw`, off prod):** atribución **4/4** (loc válido→origin;
sin loc→null; ajeno→null y alta creada; re-alta 409 conserva) + enroll base **9/9** (la 1ª corrida tuvo
un timeout aislado por cold-start del compute 0.25 CU, NO un assert — re-corrido tibio 9/9). **Revisor
independiente: PASS** — corrió los 5 gates + integración **13/13** por su cuenta, verificó el DoD ítem
por ítem, la anti-fuga (`logoObjectKey`/`origin_location_id` fuera de todo DTO), el aislamiento por
negocio del `loc` (validado contra `program.businessId`, no lanza), la no-regresión del pase y la
migración aditiva; sin bloqueantes ni importantes, 2 menores (newline de `_journal.json` preexistente;
escaneo del QR impreso = QA en vivo). **Migración `0024` APLICADA Y VERIFICADA EN PROD por SQL**
(`db:migrate` host unpooled; 24→25 migraciones; `consumer` 8 tablas; `origin_location_id` uuid nullable
+ FK `set null` + índice; `core`(22)/`merchant_auth`(4) intactos). **Commit `f82a551` pusheado a `main`**
(con el fix `GH_TOKEN=`+`gh auth switch maxhost` de CLAUDE.md; 38 archivos). **Rama efímera
`spec-0041-brand-kit` (`br-silent-rice-axvr9ctw`) BORRADA** con OK del owner. **Único residual: QA en
vivo del owner** sobre el deploy de Vercel: recorrer el wizard con 2+ locales, cambiar color/headline,
probar los 3 estilos de QR, A4/A5, imprimir a PDF, **escanear el QR impreso** y verificar por SQL que
`origin_location_id` quedó en el local. Detalle de la spec (diseño) abajo.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0041 (brand kit — afiche de enrolamiento por local)
CERRADA con el owner + ADR 0042 aceptado — solo diseño, sin código, punto de retorno.** Sesión de
definición de spec (no se tocó código de producto). El owner pidió retomar el **brand kit**: un
generador en el backoffice de "Marca" del afiche imprimible con el QR que los consumidores escanean
en el local para enrolarse. Se ancló todo al código real (mapa por subagente Explore): hoy el QR de
enrolamiento **no se genera en ningún lado** (la ruta `/enroll/<programId>` existe y está brandeada,
0028/0039, pero no hay superficie que dibuje el QR), el enrolamiento **no guarda de qué local vino**
(solo la venta lo tiene, `order.location_id`, 0030) y **un negocio tiene un solo programa operativo**
(índice único) → "Marca ↔ programa" es 1:1, sin selector de programa. **Decisión de fondo (ADR
0042): la atribución por local es una dimensión UNIVERSAL de todo evento de valor** (alta, venta,
acumulación, canje futuro), capturada de dos fuentes — **counter** para eventos del operador
(venta/acumulación ya cubiertas por `order.location_id`; el canje, que aún NO existe como
transacción, nacerá con `location_id`) y **QR escaneado** para el alta self-service. "Separar stats
por local" = `GROUP BY location_id`; el **tablero** es otra feature. **Spec 0041 (cerrada)
implementa la primera pieza:** wizard de 3 pasos (elegir plantilla → chequear logo/colores → preview
editable) en `/backoffice/brand/kit`; **5 plantillas** curadas por rubro pintadas con logo+colores de
marca; **QR server-side** reusando `renderQrSvg` (lib `qrcode`, SVG, **sin dep nueva**) a **EC nivel
H**, con estilos básicos dep-free (negro / teñido de marca / **logo al centro**); salida = **HTML/SVG
+ CSS `@media print` A4/A5** → "Guardar como PDF" del navegador (sin librería de PDF); alcance
**Global o por local** (oculto con 1 local), el QR por local codifica `/enroll/<programId>?loc=<localId>`;
**atribución del alta** = nueva columna nullable **`origin_location_id`** en `program_membership`
(FK `set null`, migración aditiva ~`0024`), validada contra el negocio del programa (un `loc` ajeno
se ignora, el alta nunca se rompe), sin pisar en re-alta idempotente. **Decisiones del owner
cerradas:** un solo programa por marca; PDF por impresión del navegador (A4+A5); 5 plantillas por
rubro; textos/CTA con default por `kind` editables en el preview; wizard; estilos de QR básicos sin
dep. **Estado de docs:** ADR 0042 escrito (`aceptada`), spec 0041 `cerrada`, INDEX actualizado (filas
0042 + 0041). **`disjunta: no`** — único punto de contacto con specs abiertas: `brand/page.tsx`
(comparte con la 0040/cropper, ambos aditivos → serializar esa edición si 0040 corre en paralelo);
0032 (OTP) no toca `program_membership` ni el enroll. **Próximo paso: implementar la spec 0041** con
el protocolo de `AGENT-WORKFLOW.md` (implementador → revisor independiente; rama Neon efímera para la
integración de atribución `origin_location_id` + migración `0024` verificada). Sin dependencias
nuevas → no hace falta re-warmear el store de pnpm. **Residual heredado pendiente: QA en vivo del
owner de la spec 0031** (checklist Manual, ver entrada previa). Detalle de la 0031 abajo.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0031 (micro-portal del consumidor) IMPLEMENTADA en
código, gates + integración Neon verdes, commiteada y pusheada a `main` para QA en vivo del owner
— punto de retorno.** Se construyó la experiencia de dos pestañas sobre `(consumer)/wallet`:
`wallet-shell.tsx` (estado de pestaña en cliente + gate de pestaña inicial por opt-in de push),
`bottom-nav.tsx`, `programs-tab.tsx` (tarjeta por membresía ordenada por última actividad, filtro
"ver cerrados", `terms-modal.tsx` de T&C), `program-card.tsx`/`points-card.tsx` (Sellos reusa
`CardPreview` reubicado a `components/loyalty/`, Puntos usa colores+logo de marca), `qr-tab.tsx`
(QR + Wallet + PushPrompt). Query nuevo `listConsumerPrograms` (`server/consumer/programs.ts`) con
DTO anti-fuga R2 (reusa `toClientProgram`, sin `*ObjectKey`) + aislamiento por `consumerId`;
`push/subscriptions.ts` gana `hasWebPushSubscription` (aditivo, único punto de contacto). **Sin
migración ni secreto nuevo** (usa tablas ya en prod). **Gates verdes:** typecheck 3/3, lint, unit
163/72-skip (nuevos `programs.test.ts` + `programs-tab.test.ts`), build 3/3, format:check limpio
en los archivos de la spec. **Integración Neon 3/3** de `listConsumerPrograms` en rama efímera
`spec-0031-programs` (`br-lucky-night-axoyd81l`, off prod `main`): branding por-negocio, orden por
última actividad, aislamiento (`[]` para otro consumidor), detección de Web Push. **El test de
integración cazó un bug de su propio fixture** (insertaba un programa `status:"closing"` sin la
ventana de cierre → violaba el check `loyalty_program_closing_window_check`); se corrigió el
fixture agregando `earningEndsAt`/`redemptionEndsAt` (assertions intactas). **Commit `cb647d9` pusheado a
`main` para QA en vivo del owner.** **Revisor independiente (`AGENT-WORKFLOW.md`): PASS** — corrió
por su cuenta los 5 gates (typecheck 3/3, lint, unit 163/72-skip, build 3/3) + integración Neon 3/3,
verificó el DoD ítem por ítem, la no-fuga de `*ObjectKey` (test que pinnea el DTO), el aislamiento
por `consumerId` de sesión, la no-regresión de "Mi QR", la reubicación de `card-preview.tsx` y la
legitimidad del fix de fixture; **sin bloqueantes ni importantes**, solo 2 menores cosméticos (test
de aislamiento con B sin membresía propia; `readableTextColor` calculado solo contra el primary del
degradé). **Con el PASS, la spec 0031 pasa a `implementada`** (frontmatter + INDEX + DoD marcados).
**Rama Neon efímera `spec-0031-programs` borrada** (con OK del owner). **Único residual: QA en vivo
del owner sobre el deploy de Vercel** (checklist Manual del Plan de pruebas: 2 membresías reales,
una Puntos y una Sellos, en iOS/Android instalado desde el home). Detalle previo de la spec (diseño)
abajo.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0031 (micro-portal del consumidor) CERRADA con el
owner — solo diseño, sin código, punto de retorno.** Sesión de definición de spec (no se tocó
código). Se **reencuadró la 0031**: nació como "notificación + landing en vivo", pero ese
mecanismo YA está implementado end-to-end (verificado en código, no asumido): `counter/orders.ts`
encola la fila `transactional` en `consumer.wallet_push_queue` DENTRO de la misma transacción del
grant (CTE `pushq`, spec 0030), y el worker + ruteo por clase (0033/0038/0040) la entrega por pase
o Web Push. Así que la "landing en vivo" pre-pase se cae del alcance sin reemplazo. La 0031 pasa a
ser el **contenido rico del micro-portal** que el ADR 0039 §4 le había reservado: la superficie
instalable `(consumer)/wallet` (hoy shell mínimo QR+botones, spec 0037) se convierte en experiencia
**estilo iOS con nav inferior de 2 pestañas**. **Decisiones cerradas con el owner:** (1) pestaña
**"Programas"** = una tarjeta por `program_membership`, ordenadas por **última actividad** (la usada
más recientemente arriba = `MAX(core.order.created_at)` por membership, fallback `enrolledAt`, SIN
migración); **Sellos** reusa `CardPreview` (spec 0027) con `filled=stampsCount` real; **Puntos** —que
nunca tuvo diseño propio (columnas `card*` son Sellos-only)— usa colores de marca + **logo** del
negocio en tarjeta grande compuesta; **ícono info → popup de T&C** (`termsMarkdown`, texto plano SIN
parser de markdown —el repo no tiene ninguno, CLAUDE.md desaconseja deps—; el popup es contenedor
extensible a futuro); **filtro** "Ver programas cerrados" (default solo `active`, revela
`closing`/`inactive` atenuados). (2) pestaña **"Mi QR"** = el contenido actual (QR + `WalletButtons`
+ `PushPrompt`), sin regresión. (3) **Gate de pestaña inicial:** "Mi QR" primero hasta que el
consumidor confirma notificaciones, luego "Programas" (señal = suscripción Web Push:
`hasWebPushSubscription` para SSR sin flash + callback `onSubscribed` en `PushPrompt`; el gate elige
default, NO bloquea —ambas pestañas tocables desde la nav—). **Query nuevo** `listConsumerPrograms`
(`server/consumer/programs.ts`) con DTO anti-fuga R2 (reusa `toClientProgram`, sin `*ObjectKey`, test
por entidad) + aislamiento por `consumerId` de sesión. **`card-preview.tsx` se reubica** a
`components/loyalty/` (sus estilos viven en `globals.css` del layout raíz → aplican en la ruta del
consumidor sin tocar nada). **Sin migración ni secreto nuevo.** Estado de docs: spec 0031 `cerrada`,
INDEX actualizado. Nada commiteado aún (commit autorizado por el owner en esta sesión). **Próximo
paso: implementar la spec 0031** con el protocolo de `AGENT-WORKFLOW.md` (implementador → revisor
independiente; rama Neon efímera para el test de integración de `listConsumerPrograms`). **Disjunta**
frente a 0032/0040 —único punto de contacto: agrega `hasWebPushSubscription` a `push/subscriptions.ts`,
aditivo—. Sin dependencias nuevas → no hace falta re-warmear el store de pnpm.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0023 (búsqueda y procedencia de locales) — Mapbox
retirado por costo, Geoapify único proveedor, QA en vivo del owner CERRADO, punto de retorno.**
El owner reportó que Geoapify resuelve locales/direcciones perfectamente en producción (incl.
Ecuador) y que el fallback Mapbox facturó USD 5 por una sola consulta de autocomplete. Se
eliminó el adaptador server `verifyMapbox`, el componente `address-autofill-mapbox.tsx`, la
plomería `renderMapboxFallback`/`useMapboxFallback` (ante error de Geoapify el campo ahora se
conserva y muestra aviso de reintento, sin segundo proveedor) y los estilos/env/docs de Mapbox.
El contrato `verifyLocation`/`LocationProvider` (`apps/merchant/src/server/location-providers.ts`)
sigue provider-neutral por si hiciera falta reintroducir otro proveedor sin migrar locales
existentes. ADR 0025 (enmienda 2026-08-16) + spec 0023 (→ `implementada`) + INDEX +
`DEPLOY-OWNER-TEST.md` actualizados. Gates: typecheck 3/3, lint, **unit 159 passed/69 skipped**
(integración Neon skip sin DB local). Sin migración nueva (columna `provider` ya permisiva).
**Commit `dfb4080` pusheado a `main` y QA en vivo del owner sobre Vercel: positivo.** Nada
pendiente de esta spec — queda como residual menor el E2E móvil del onboarding (cubierto por QA
manual). Secretos `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`/`MAPBOX_SERVER_ACCESS_TOKEN` en Vercel ya no
se leen y el owner puede borrarlos cuando quiera.)
Ultima actualizacion (sesión previa): 2026-08-16 (**Specs 0037 (Web Push iOS+Android), 0038 (ruteo por clase, ADR
0040) y 0039 (branding de la landing) — QA en vivo del owner CERRADO, todo funcionando, punto de
retorno.** Las tres se implementaron con el flujo `AGENT-WORKFLOW.md` (implementador → revisor
independiente PASS, gates + integración Neon en rama efímera por su cuenta) y después pasaron una
ronda de QA real del owner en el deploy, con varias enmiendas post-QA hasta quedar verde — el
detalle completo de cada iteración está en el frontmatter/cuerpo de cada spec (`docs/specs/003{7,8,9}-*.md`),
no se repite acá.

**Resumen de lo que quedó funcionando (verificado por el owner):**
- **Web Push iOS + Android** (0037): landing de Safari con instructivo "añadir a inicio" (sin botón
  "Abrir Compartir" — no existe API iOS para eso); subject VAPID normalizado a `mailto:`
  (`normalizeVapidSubject`) tras un 403 de Apple por subject sin esquema.
- **Ruteo por clase** (0038, ADR 0040): un aviso `transactional` sale **solo por wallet**, con
  **fallback a Web Push** si el consumidor no tiene pase alcanzable — nunca los dos a la vez (mata
  el duplicado que el QA de iOS había encontrado). Opt-in de Android (botón "Activar
  notificaciones") en la confirmación del enroll.
- **Branding de la landing** (0039): logo + color de marca en `/enroll/[programId]` y su
  confirmación, con texto por luminancia (`readableTextColor`) y card del instructivo iOS coherente
  con cualquier acento (`tint`/`shade` en `lib/brand-color.ts`). `/wallet` queda neutro (arco 0031).
- **Dos bugs de subida de imagen cazados y corregidos en el mismo QA** (afectan marca+sello+catálogo,
  comparten `lib/image-formats.ts` y `server/assets/image.ts`): (a) `image/jpg` (alias no-IANA que
  reportan varios selectores Android) faltaba en `ACCEPTED_IMAGE_CONTENT_TYPES`; (b) `normalizeImage`
  rechazaba toda imagen > 2048×2048 en vez de achicarla — una foto de cámara de teléfono (~12MP)
  daba 422 en el guardado. Fix: `MAX_INPUT_PIXELS=50MP` + el `resize` ya existente ahora sí achica.
  Guardado como **paliativo**: la solución de fondo (recortar/reducir en el CLIENTE antes de subir,
  para no tener que subir el límite de decode del server) quedó documentada como **ADR 0041 + spec
  0040** (`borrador`, sin implementar — trabajo futuro).

**Gates finales de la sesión:** typecheck 3/3, lint, **unit 159**, build 3/3, prettier — todos
verdes. Todo commiteado y pusheado a `main` (hasta `7ac5e90`).

**Nada pendiente de push.** Las specs 0037/0038/0039 quedan `implementada` con QA real cerrado. La
0040 queda `borrador` (diseño documentado, sin código) para retomar cuando se priorice.)
Ultima actualizacion base: 2026-08-16 (**spec 0037 (Web Push, iOS + Android) IMPLEMENTADA con PASS de revisor independiente + migración `0023` aplicada y verificada en prod — punto de retorno.** Flujo `AGENT-WORKFLOW.md` completo: implementador → **revisor independiente PASS** (sin bloqueantes; 1 importante no-bloqueante + 1 menor, ambos resueltos por el orquestador — ver abajo) → orquestador aplicó a prod y cerró la spec. Dominio nuevo `server/push/*`: `vapid.ts` (JWT VAPID ES256 RFC 8292 con `node:crypto`, mismo patrón que APNs 0033), `webpush-crypto.ts` (cifrado RFC 8291/8188 `aes128gcm` con `createECDH`/`hkdfSync`/`aes-128-gcm`), `webpush-channel.ts` (canal `WebPushChannel` real/`fake` intercambiable, 201/202=ok, 404/410→`WebPushGoneError`→borra la fila), `subscriptions.ts` (upsert por `endpoint`, borrado, lectura, DTO anti-fuga `webPushSubscriptionResponse` sin `endpoint`/`p256dh`/`auth`, `purgeConsumerSubscriptions`, fan-out `deliverWebPush`). Tabla `web_push_subscription` en **`schema/web-push.ts`** (split para el hook file-size; barrel `schema.ts` actualizado). Fan-out del transaccional movido a **`wallet/push-transports.ts`** (`deliverTransports` = apple+google+webpush; push.ts quedó 253 líneas) y threadeado por `push.ts`/`push-worker.ts` (`webPushChannel` opcional; el cooldown cuenta el aviso multi-transporte como UNO — una sola fila de cola se cierra). `rotate.ts` purga las `web_push_subscription` **plegado en el CTE de rotación** (atómico con la rotación del token + el borrado de devices — fix del orquestador tras el hallazgo importante del revisor; antes era un statement separado). Ruta `POST /api/public/push/subscribe` (sesión 0028; asocia SIEMPRE al consumidor de la sesión; 401 sin sesión, 400 body inválido; respuesta sin keys). PWA: `public/sw.js` (push+notificationclick, scope raíz) + **manifest DINÁMICO** en `app/(consumer)/wallet/manifest.webmanifest/route.ts` (start_url=`/c/[webViewToken]` por-consumidor — un archivo estático en `public/` NO puede llevar el token per-consumidor que exige el ADR 0039 §5, ver Hallazgos). UI: `(consumer)/push-prompt.tsx` (registro SW + prompt por plataforma: **iOS Safari NO intenta suscribir**, solo instructivo + escape hatch al botón Wallet ya presente; iOS PWA standalone / Android piden permiso tras gesto) + `wallet/page.tsx` (link al manifest via `metadata`, `apple-mobile-web-app-capable`, `<PushPrompt>`). **Cripto verificada contra el vector del Apéndice A del RFC 8291 byte-a-byte** (oráculo externo CLAUDE.md). Gates: **typecheck 3/3, lint, unit 136** (6 nuevos: VAPID JWT, vector RFC 8291, DTO sin keys, platform), **build 3/3**, **integración Neon 19/19** (6 nuevos web-push + 13 wallet-push de regresión, sin romperse). **Migración `0023_round_shape.sql`** (NO 0022 — ya existía; generada con drizzle-kit, aditiva: solo `CREATE TABLE consumer.web_push_subscription` + FK cascade + unique(endpoint) + idx(consumer)). **Migración aplicada + verificada por SQL en rama Neon efímera `br-patient-feather-ax1dsw2s` (spec-0036, reusada — ver Hallazgos)**: `web_push_subscription` 9 cols/3 idx, `core`(22)/`merchant_auth`(4) intactos. **Revisor independiente: PASS** — corrió los 5 gates por su cuenta + integración 6/6, verificó el vector RFC 8291 contra `rfc-editor.org`, la no-fuga de keys, el aislamiento por sesión, el fan-out con un solo cooldown, el purge y los dos contextos de iOS; único punto de diseño (purge no atómico) marcado importante-no-bloqueante. **El orquestador resolvió los dos hallazgos** (importante: purge plegado al CTE de `rotate.ts` → atómico; menor: docstring de `webpush-crypto.ts` apuntaba a un test inexistente) y re-verificó: typecheck 3/3, lint, unit 136, build 3/3, integración web-push 6/6 en la rama `br-spring-dawn-axu7nv1z`. **Migración `0023` APLICADA Y VERIFICADA EN PROD por SQL** (`db:migrate` con host unpooled; 23→24 migraciones; `consumer` 7→8 tablas; `web_push_subscription` 9 cols + 3 idx + FK cascade + check `platform`; `core`(22)/`merchant_auth`(4) intactos). **Commit `e734750` pusheado a `main`** (con el fix `GH_TOKEN=`+`gh auth switch maxhost` de CLAUDE.md). **Ramas Neon efímeras viejas borradas** (9 de specs 0030/0033/0034/0036, con OK del owner; queda solo la default de prod `br-curly-silence-ax8acywm`) → cuota liberada. **Hallazgos/residuales:** (a) el manifest es dinámico, no estático — el ADR 0039 §5 exige `start_url` con el `web_view_token` per-consumidor (para que la rotación deje el ícono en 404), imposible en un archivo estático de `public/`; `public/sw.js` sí es estático como pide la spec; (b) **quota de ramas Neon EXCEDIDA** — no se pudo crear una rama efímera nueva (`branches limit exceeded`); hay ~10 ramas efímeras viejas de specs 0030/0033/0034/0036 sin borrar; `delete_branch` está gateado (destructivo) → **el owner debe borrar las ramas viejas**; se reusó la rama de spec-0036 (ya cerrada, expira 2026-08-18) como workspace, el test limpia sus filas en `afterAll`; (c) **QA real iOS/Android queda como residual** (canal `fake` cubre el gate; falta suscribir en Android real + acreditar + ver la notificación con browser cerrado, y en iOS real añadir a inicio + abrir PWA + permiso + notificación + escape hatch); (d) **secreto nuevo VAPID** `WEB_PUSH_VAPID_PUBLIC_KEY`/`_PRIVATE_KEY`/`_SUBJECT` a cargar en Vercel (sin claves el canal queda deshabilitado, no se ofrece el prompt). — Sesión previa (diseño): )
Ultima actualizacion (sesión previa, diseño): 2026-08-15 (**spec 0037 (Web Push, iOS + Android) CERRADA — solo diseño, sin código, punto de retorno.** Sesión de definición de spec con el owner (no se tocó código). Se reencuadró la 0037: **incluye iOS, no solo Android** (revisa el punto 2 del ADR 0038). Se escribió **ADR 0039** (supersede el "solo Android" de 0038). Decisiones cerradas con el owner: **(1)** en iOS la Push API solo existe con la página **instalada como PWA en el home** (16.4+) y el permiso/suscripción **solo se pueden pedir dentro de la PWA standalone, nunca en Safari** → el flujo iOS vive en **dos contextos**: landing de Safari (registro 0028 → instructivo "añadir a inicio" + **escape hatch** "solo dame mi pase" que muestra el botón de Apple Wallet sin instalar, para no gatear el canal wallet ~90% detrás de la instalación) y el **micro-portal** (PWA) donde se suscribe; **(2)** el micro-portal **se construye ahora** = la página post-registro **ya existente** `(consumer)/wallet` (`page.tsx`/`wallet-cta.tsx`) hecha instalable con `manifest.webmanifest` + `public/sw.js` — su contenido rico sigue siendo la spec 0031, así que la 0037 **deja de depender de 0031** para el mínimo instalable; **(3)** el token del portal = **`web_view_token` existente** (`consumer_account`, magic-link `/c/[webViewToken]`), que ya rota junto al `qr_token` en `rotatePassCredentials` (`wallet/rotate.ts`) al recuperar cuenta (0032) — la 0037 **extiende esa rotación para purgar también las `web_push_subscription`** (simetría con "borra devices"; ícono viejo → 404, notifs viejas cortadas); **(4)** cripto **`node:crypto` sin dependencia** (VAPID JWT ES256 = mismo patrón que el JWT de APNs de 0033; cifrado RFC 8291/8188 `aes128gcm` con `createECDH`/`hkdf`/`aes-128-gcm` **verificado contra el vector del Apéndice A del RFC 8291** = oráculo externo que exige el CLAUDE.md; evita `web-push` y su re-warm del store de pnpm); **(5)** dimensión de transporte de la cola = **fan-out a todos los transportes para el transaccional** (opción (b), sin columna `transport` explícita; la selección wallet/webpush llega con el productor de campañas). Motivación asimétrica documentada: iOS gana Web Push por el **valor del portal** (el pase de Apple ya notifica rico), Android por el **contenido rico de la notificación** (banner de Google genérico). Migración aditiva prevista **`0022`** (`web_push_subscription` en esquema `consumer`, con `platform`). Anclado a código real verificado por grep: `web_view_token` (`schema/consumer.ts:38`, único), `rotatePassCredentials` (`wallet/rotate.ts`), ruta `/c/[webViewToken]`, página `(consumer)/wallet`, `public/` hoy solo tiene `wallet-logo.png`. **Estado de docs:** ADR 0039 escrito, spec 0037 `cerrada`, INDEX actualizado (fila 0039 + 0037 a `cerrada`). Nada commiteado aún (commit autorizado por el owner en esta sesión). **Próximo paso: implementar la spec 0037** con el protocolo de `AGENT-WORKFLOW.md` (implementador → revisor independiente; rama Neon efímera; migración `0022` verificada). **Serializar con la spec 0031** (comparten la página del portal). Sin dependencias nuevas → no hace falta re-warmear el store de pnpm para este trabajo.)

Ultima actualizacion previa: 2026-08-15 (**spec 0033 (canal de push del pase de Wallet) IMPLEMENTADA con doble PASS de revisor independiente — punto de retorno.** Cuarta rebanada del camino A (ADR 0031), prerequisito técnico duro de la 0031. Dominio `server/wallet/*` extendido: cola `wallet_push_queue` como **outbox transaccional** escrito en el mismo `WITH` de `persistGrant` (0030) — grant con rollback → sin fila; retry idempotente → sin duplicado; **worker** `/api/internal/wallet-push` (cron + dispatch inline best-effort) que drena con **prioridad transaccional>campaign** y **cooldown por-consumidor** (`planConsumerDrain` puro + reloj inyectable), **claim race-safe** (`pending→sending` con `UPDATE … RETURNING`) y **reaper** de filas `sending` huérfanas (`not_before` dobla como deadline de reclamo, `STALE_CLAIM_MS`) para el at-least-once del ADR 0037. **Web service PassKit** `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log; auth `ApplePass` vs `auth_token_hash` en tiempo constante; **rate-limit por serial, no IP** → 429). **APNs** = JWT **ES256** con `.p8` sobre HTTP/2 nativo (verificado con la pública en unit), **sin paquetes nuevos**; **Google** `addMessage` con el mismo service account; canal **`PushChannel`** intercambiable (`fake` cubre el gate, APNs/Google reales = QA residual). `rotatePassCredentials` (rota `qr_token`+`web_view_token`, borra devices, encola re-emisión; lo invoca la 0032). Anti-fuga: DTOs allow-list, ningún `push_token`/`qr_token`/`web_view_token`/`token_hash`/`auth_token_hash` serializado (test por entidad). **Flujo agéntico completo (`AGENT-WORKFLOW.md`):** implementador → revisor independiente **FAIL** (1 bloqueante: camino del worker sin test que lo ejecute; 1 importante: sin reaper de `sending`) → pase de corrección → **re-review PASS**. Gates verdes (typecheck 3/3, lint, prettier, **unit 118**, build 3/3) + **integración Neon 21/21** (worker 6 + wallet-push 6 + regresión wallet 4 + counter 5) en ramas efímeras. **Migración `0021` aplicada y verificada por SQL en prod** (22 migraciones; 3 columnas nullable en `consumer_account` + `wallet_push_device` + `wallet_push_queue` con índices/checks; `consumer` 5→7 tablas; `core`(22)/`merchant_auth`(4) intactos). **Externo del owner (no bloquea):** cargar los 3 secretos `APPLE_APNS_*` en Vercel (la `.p8` ya la generó, Team `SN489AVGUD`) + QA en Android/iPhone real. **Falta el `git push` a `main`** (commit local; outward-facing, espera OK del owner — recordar el fix `GH_TOKEN=` de CLAUDE.md). **Fast-follow menor:** los DTOs `walletPushDeviceResponse`/`walletPushQueueResponse` están testeados pero aún sin ruta que los consuma (sin fuga viva; su superficie llega con la 0031). **Próxima feature: spec 0031** (notificación + landing en vivo + dashboard "Ver mis programas"), que ahora consume este canal. Residuales de la 0033 documentados; ramas Neon efímeras auto-expiran 2026-08-18.)

Ultima actualizacion previa (0030): 2026-08-15 (**spec 0030 (acreditación en mostrador) CERRADA — QA en vivo del owner completo, punto de retorno.** Implementada con PASS de revisor independiente (`AGENT-WORKFLOW.md`) + verificada end-to-end por el owner sobre el deploy: enrolamiento por QR real (`/enroll/<programId>` de Fybeca 3), escaneo desde `/backoffice/counter`, venta rápida ($30 → 100 pts, `floor(30/3)×10`) y venta detallada (producto del catálogo "Café con leche" $5 → 10 pts, saldo acumulado 110), todo verificado por SQL contra prod. **Cuatro rondas de enmiendas post-QA, cada una con gates verdes y pusheadas a `main`:** (1) commit `eb4c9a8` — toast "Cliente identificado" al resolver, preview en vivo de puntos/sellos por venta (referencia no editable, misma fórmula que `computeAccrual`), fix de estilo del buscador/inputs (WebKit los pintaba grises por falta de `background`/`color` explícito); (2) commit `610ad31` — se quitó el reinicio automático a los 4s de la pantalla de confirmación (muy poco tiempo para leer el resultado); ahora el reinicio es 100% manual vía botón "Escanear siguiente". Spec actualizada con la enmienda. **El permiso de cámara repetido en cada ingreso es comportamiento del navegador** (ej. Safari iOS pregunta cada vez salvo "Permitir" fijado en Configuración del sitio), no accionable desde el código — documentado, no bloqueante. **Pendiente explícito, no de la 0030:** la notificación al consumidor en su teléfono (paso 6 del flujo) es la **spec 0031**, que depende de la **spec 0033** (canal de push del pase de Wallet) como prerequisito técnico. **Próximo paso: implementar la spec 0033** — hoy es stub/borrador, así que el primer paso de la próxima sesión es cerrar su diseño técnico con el owner antes de codear.)

## Ahora

Que esta pasando ahora mismo y cual es el proximo paso. Si una sesion se cae, la
siguiente arranca leyendo este bloque.

La V1 de Mi Pasaporte está planificada para consumidor, comercio y administrador de
plataforma: wallet/QR, backoffice y wizard, app de operación, ruleta, métricas y
rutas/eventos curados. La propuesta de arquitectura está documentada en
`docs/ARCHITECTURE.md` y ADRs 0011–0017. El lanzamiento del entorno está ordenado en
`docs/SCAFFOLD-PLAN.md`. La Spec 0010 de scaffold está `cerrada` e implementada: el árbol
estaba en disco pero sin instalar ni verificar. En esta sesión se resolvió el bloqueo de
red, se fijó Node 24.19.0 + pnpm 11.4.0, se generó y versionó `pnpm-lock.yaml`, y se
corrieron los controles con resultado verde real (frozen install, format:check, lint,
typecheck, unit 3/3, build 3/3, contrato health exacto + 405). Se corrigieron dos defectos
del árbol que nunca se habían ejecutado: la config de Vitest 4 (`test.projects` en
`vitest.config.ts` en vez del removido `vitest.workspace.ts` con `--workspace`) y el alcance
de Prettier (`.prettierignore` para no reformatear docs de producto). Falta el PASS del
revisor independiente. Las specs de producto siguen en `borrador` hasta validar la arquitectura, incluyendo
entrega/costo de OTP en Ecuador. La Spec 0003 fue rediseñada alrededor de un Incentive
Engine interno (ADR 0018): reglas tipadas, efectos, presupuestos, versiones y simulación;
no se implementará un DSL libre ni lógica especial por pantalla.

El remoto canónico es `https://github.com/maxhost/check-point.git`, documentado en
`docs/REPOSITORY.md`. La rama de publicación acordada es `main`; la autenticación local de
GitHub debe revalidarse antes del primer push. El commit inicial local `6467628` está listo
para publicar; el intento de conexión no resolvió `github.com` desde este entorno.

Handoff guardado en `docs/HANDOFF.md`. Se aceptó ADR 0019: Mi Pasaporte conserva la
estructura accesible de UI y cada negocio publica branding limitado y validado para sus
superficies. La primera feature de producto es la Spec 0011, `cerrada`: un prototipo QA
consumer sin backend para probar en teléfono QR → permiso de ubicación → validación
simulada → recompensa → wallet guest temporal. Requiere URL HTTPS temporal para que el
teléfono pueda conceder geolocalización. La arquitectura y stack transversal siguen
pendientes de validación antes de cerrar las features reales de V1.

El 2026-08-12 se cerraron las tareas 18 (Spec 0024, programa de fidelización real) y 19
(Spec 0025, marca real y assets R2): gates locales verdes (typecheck 3/3, unit 22/23 con
1 skip por env, lint, build 3/3), fix de fixture e2e (`tests/e2e/support/demo.ts`,
seed-once para que `sessionStorage` sobreviva a `page.reload()` sin pisar el estado que
persiste la app), push a `main` (`b576a4b`) y QA manual en vivo sobre el deploy de Vercel
confirmado por el owner. La Spec 0024 sigue `en curso` en su frontmatter — cerrarla
formalmente pide el PASS del revisor independiente de `AGENT-WORKFLOW.md`, que esta sesión
no corrió. La Spec 0025 se marcó `implementada` a pedido explícito del owner con 3 de 6
casilleros de su DoD sin marcar (casos límite de subida, concurrencia, e integración
R2/Neon + E2E de `brand`, inexistente); no hubo PASS de revisor independiente tampoco.

El 2026-08-12 se revisó la feature de fidelización (Spec 0024) contra el comportamiento
deseado del Owner. Decisión confirmada: el cierre fechado es el único mecanismo de apagado
(no se agrega «desactivar» inmediato). Se cerraron los huecos production-grade en ADR 0028
y se implementaron localmente con gates verdes (ver tarea 18). La integración Neon se corrió contra una rama de test
aislada y efímera (creada y borrada vía Neon MCP), la migración 0010 se aplicó a `main` de
producción con `drizzle-kit migrate` (verificada) y el código se pusheó (`1887db8`). El único
residual es el E2E `loyalty-real.spec.ts`, que requiere un entorno desplegado con un owner de
prueba sembrado (`E2E_MERCHANT_BASE_URL`/`EMAIL`/`PASSWORD`).

El 2026-08-13, durante el QA en vivo del programa de fidelización, el owner reportó que «los
términos seleccionados al crear no persisten al editar». Diagnóstico: el texto sí persistía
(`terms_markdown`), pero el modelo de **checkboxes de plantilla** se reseteaba al reabrir la
edición y, peor, re-marcar una plantilla **duplicaba** su texto (ya incrustado en el markdown).
Contradecía el intento de la spec 0024 («partir de una plantilla y editar el texto antes de
guardar»). Fix production-grade (UI): las plantillas dejan de ser selección persistente y pasan
a ser botones **«+ Insertar»** que copian su texto ya renderizado (variables resueltas contra el
formulario vivo) al textarea editable; al guardar sólo viaja `[{ text }]`. Round-trip idéntico al
editar, sin duplicación ni estado fantasma. Typecheck 3/3, unit de loyalty 6/6, e2e sin impacto
(usan el textarea directo). El servidor sigue aceptando cláusulas por `templateId` (no-breaking).

Segunda ronda de QA (2026-08-13), cinco ajustes UX del programa (todo UI, sin tocar el servicio):
(1) el textarea de términos crece con el contenido (`AutoGrowTextarea`) y arranca alto; (2) el
TOS guardado respeta saltos de línea y espacios al mostrarse (`white-space: pre-wrap` en
`.published-term`); (3) los inputs `datetime-local` de cierre traen `min` (fin de acumulación ≥
ahora en la zona del negocio; canje ≥ fin de acumulación) para no ofrecer fechas pasadas; (4) los
errores de cerrar/cancelar/cargar salen como **toast de error** (`Toast kind="error"`), no debajo
del formulario; (5) el modal de confirmación se cierra siempre al confirmar (antes quedaba abierto
si el cierre fallaba). Typecheck 3/3 y unit de loyalty 6/6 verdes.

Tercera pasada de pulido visual (2026-08-13, sólo CSS + una clase): la tarjeta de «programa en
cierre» gana jerarquía —`.closing-summary` pasa de `<dl>` por defecto (con sangría del navegador)
a panel con etiquetas en mayúsculas atenuadas y valores prominentes—; el botón «Cerrar programa»
deja de tener borde sin fondo y pasa a texto rojo sin borde con subrayado en hover
(`.close-program-link`).

Cuarto ajuste (2026-08-13): el formulario de cierre deja de ser inline (`.transition-fields`
colgado bajo el botón) y pasa a una pantalla propia con el mismo formato del editor —nuevo
`program-closing.tsx` como `section.panel.loyalty-panel`—. `page.tsx` alterna vista/editor/cierre
y el header cambia título y la X para volver, igual que en «Editar». `ProgramView` queda sólo con
la vista activa y el enlace «Cerrar programa» que abre esa pantalla.

Quinto ajuste (2026-08-13): el mensaje único «Indica una ventana futura válida en la zona horaria
del negocio» era confuso porque cubría tres fallas distintas. `validateClosingWindow` ahora lanza
un mensaje específico por caso (fechas inválidas / fin de acumulación no futuro / fin de canje no
posterior al fin de acumulación); test unitario actualizado a los textos nuevos.

Revisión independiente (2026-08-13, `AGENT-WORKFLOW.md`) sobre la feature completa: veredicto
FAIL estrecho (sin bloqueantes) por dos IMPORTANTES, ya resueltos y reverificados contra Neon
real: (1) **atomicidad de auditoría** —el cambio de estado y el evento eran dos round-trips;
ahora cada transición es un CTE `UPDATE … RETURNING` + `INSERT event` en una sola sentencia, y
la creación usa `db.batch` (rollback ante el índice único), ver enmienda ADR 0028—; (2) **tests
del núcleo** —se agregaron índice único (`23505`→`409`) y autorización (`403`) al test de
integración—. MENORES arreglados de paso: JSON inválido → `400` (antes `503`), guard de fecha de
`cancelClose` movido al `WHERE` (elimina TOCTOU), `isUniqueViolation` recorre `.cause`. Gates:
unit 25/25, typecheck 3/3, lint, e integración Neon 3/3 (rama aislada efímera, creada y borrada
vía MCP). MENORES no accionados hoy (documentados, no bloqueantes): `ownerBusiness` ordena
`desc` vs `asc` en brand —inalcanzable con 1 negocio/owner—, validación de formato de
`stampImageObjectKey` (reservado hasta R2), y `program_kind` como literal en inglés en términos.

Re-revisión independiente (2026-08-13): **PASS**. Verificó los arreglos contra el código real
del driver (`db.batch` = transacción en neon-http; semántica CTE de Postgres) y confirmó los dos
IMPORTANTES resueltos correcta y suficientemente; solo MENORES no bloqueantes. Con el PASS
verificable, la **Spec 0024 pasa a `implementada`** (frontmatter + INDEX + DoD marcados; commit
`50228a7`). Cierra la tarea 18 como production-grade. Único residual documentado: el E2E real
automatizado (`loyalty-real.spec.ts`) sustituido por QA manual en vivo del owner (crear/editar/
cerrar/cancelar/ciclo completo/términos con saltos de línea, todo OK sobre el deploy de Vercel).

**Cierre de sesión 2026-08-13 — punto de retorno.** Fidelización (0024), marca+R2 (0025) y
diseño de sello en R2 (0026) quedan **`implementada` con PASS de revisor independiente** y QA
manual del owner; migraciones aplicadas a prod (última: `0012`), gate verde (typecheck 3/3, lint,
unit 28/9-skip), todo pusheado a `main` (`629d15f`). **La próxima feature es la tarea 21 / spec
0027** (wizard de creación + diseño visual de la tarjeta de Sellos): la spec está en BORRADOR con
los requisitos del owner; **el primer paso de la próxima sesión es cerrar la sección «Abierto» de
`docs/specs/0027-…md` con el owner** (modelo de datos, degradé, si la edición es wizard, defaults
de color) y recién entonces implementar con el protocolo de `AGENT-WORKFLOW.md`. Patrón
reutilizable ya disponible: pipeline de imagen en `server/assets/image.ts` y el de assets R2 con
borrado diferido (marca/sello); las features nuevas se verifican con rama Neon efímera + revisor
independiente antes de `implementada`.

**Actualización 2026-08-13 — spec 0027 CERRADA.** Se resolvieron las seis decisiones abiertas con
el owner (columnas dedicadas nullable con checks hex/ángulo a nivel DB, no jsonb; degradé lineal de
**ángulo configurable**; crear **y editar** por wizard; preview con `round(target/2)` sellos;
defaults de color derivados de la marca; Puntos sin diseño, columnas `null`). Se escribió **ADR
0030** (modelo de datos de la tarjeta), se pasó la spec 0027 a `cerrada` en INDEX (`disjunta: sí` —
ninguna spec abierta toca loyalty) y se ancló la spec técnica al código real (mapa de archivos:
create+update comparten `PUT`, colores no son secretos → van al DTO, splits por `file-size`).

**Implementación 2026-08-13 (spec 0027, en revisión).** Hecho: 4 columnas `card_*` + 5 checks
hex/ángulo/pareja en `schema/loyalty.ts` (migración **`0013_broad_turbo`**); `validateCardDesign`
(server, 422 por caso) y `CardDesignInput` en `core.ts`; `saveProgram` escribe las columnas en
INSERT/UPDATE; `ownerBusiness` ahora expone los colores de marca al cliente para los defaults; UI
reescrita como **wizard** (`program-editor.tsx` contenedor + `steps/{units,stamp-basics,card-design,
terms,review}.tsx`), `CardPreview` puro-props compartido (`card-preview.tsx`) con helpers
`cardBackground`/`filledCount`, hook `use-card-design.ts` (split para no cruzar `file-size`), CSS
del wizard/tarjeta en `globals.css`. Tests: `card-preview.test.ts` (helpers), `loyalty-card-design.
test.ts` (validación), integración `loyalty-card-design.neon.integration.test.ts`. **Verificación:**
typecheck 3/3, lint, Prettier, **unit 33/10-skip**, **integración Neon 6/6** en rama efímera
(`br-cold-mountain`, auto-expira), **migración `0013` aplicada + verificada en prod** (columnas +
checks presentes) y **build 3/3** (turbo, Node 24). **Pendiente para `implementada`:** PASS de
revisor independiente (`AGENT-WORKFLOW.md`) y QA manual en vivo del owner sobre el deploy.

**Fix de entorno 2026-08-13 (build local).** El `pnpm build` fallaba en `/_global-error`
(`useContext` null) — diagnosticado mal al principio como «Node 22 vs 24». Causa real: el harness de
dev inyecta `NODE_ENV=development` en el proceso, y `next build` con ese valor mezcla los builds
dev/prod de React y revienta el prerender. No es del repo (ningún dotfile lo setea; con `env -i` el
build pasa) ni de la feature (falla en `main` limpio). **Fix durable:** `NODE_ENV=production` en el
script `build` de los tres apps (no-op en Vercel, que ya es production) + local alineado a Node
24.19.0 vía nvm (`.node-version`) + corepack pnpm 11.4.0. Verificado: `pnpm build` = 3/3 con
`NODE_ENV=development` en el entorno.

**Cierre del arco — Spec 0027 IMPLEMENTADA (2026-08-13).** Se corrió el **revisor independiente**
(`AGENT-WORKFLOW.md`), que ejecutó los gates por su cuenta (typecheck 3/3, lint, unit 33/10-skip,
build 3/3, Prettier, file-size) y verificó el DoD ítem por ítem, la no-fuga de `*ObjectKey`, la
coherencia server↔checks de DB, la atomicidad de `saveProgram` y la ausencia de tests borrados:
**veredicto PASS**, sin bloqueantes ni importantes (solo menores informativos). El **QA manual en
vivo del owner pasó perfecto**. Con PASS + QA, la Spec 0027 pasa a `implementada` (frontmatter +
INDEX + DoD marcados; tarea 21 → `hecho`). Commits en `main`: `4388662` (feature) + `967a080` (fix
build). **La próxima feature es el wallet consumer que consumirá la tarjeta** (spec propia; reusar
`CardPreview` puro-props ya preparado para portarse).

**Pivote de posicionamiento 2026-08-14 — ADR 0031/0032, camino A.** Antes de arrancar el
"brand kit" (afiche imprimible con QR) se hizo un parate estratégico: el QR de "sumarse al
programa" no tenía flujo detrás (no existe enrolamiento ni wallet consumer). Se decidió
**merchant-first**: Mi Pasaporte es una herramienta de fidelización/marketing para comercios,
con la **Wallet nativa (Apple/Google) como superficie de consumidor** —no una app propia de
descubrimiento (esa "red Foursquare × Niantic" se **difiere** a una fase futura encendida
sobre densidad)—. Los juegos/AR/notificaciones son de **esta** etapa (tier Plus). **ADR 0031**
(posicionamiento + identidad de consumidor: cuenta única con N membresías, **identidad
compartida / membresías aisladas**, driver de analítica por-owner scopeada por negocio;
supersede la "red curada" de 0003 y reencuadra 0019). **ADR 0032** (dónde vive: esquema pg
propio **`consumer`**, auth **phone-OTP purpose-built**, DB única compartida, hospedado por
ahora en el backend de `apps/merchant`; refina 0012). La spec 0004 quedó **reencuadrada**.

El caso de uso del owner (Marcos escanea en "La Gringa" → landing nombre+apellido+teléfono →
OTP → QR personal + "Añadir a Wallet"; el encargado escanea el QR, arma carrito y otorga
puntos/sellos; el consumidor recibe aviso en el pase o la landing se actualiza) se **rebanó en
4 specs**: **0028** identidad+enrolamiento (**CERRADA**, lista para implementar), **0029** pase
de Wallet, **0030** acreditación en mostrador, **0031** notificación+landing en vivo (las tres
en `borrador`/stub). **El próximo paso es implementar la spec 0028** con el protocolo de
`AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de `implementada`). El
**brand kit** queda **downstream**: su afiche recién tiene valor cuando el QR resuelve (0028+).
Nada de esto está commiteado aún (docs sin código). Dependencia dura de 0030: un **catálogo
económico de productos** (specs 0002/0021, en borrador).

**Ajuste 2026-08-14 — OTP diferido, 0028 sin proveedor.** Se decidió que el enrolamiento (0028)
**no verifica** el teléfono ni envía SMS: crea la cuenta con `phone_verified_at = null`
(gratis, sin fricción), porque el valor se acredita contra el **QR al portador**, no contra el
teléfono, y un SMS a Ecuador cuesta ~$0.25–0.34. Aclaración: "OTP" no es un SMS más caro —lo
caro son las *Verify API*; nuestro OTP es DIY (envío crudo). La **verificación/recuperación por
OTP** se movió a la **spec 0032** (nueva, `borrador`), que se quedó con la investigación de
proveedores (Twilio EC $0.339/BR $0.0599/ES $0.0875; Plivo más barato; Telnyx/Bird/AWS por
verificar; WhatsApp-auth más barato en BR/ES; Brasil ~10 semanas de alta de sender; España
registro CNMC desde 2026-09-15). Diseño agnóstico ya fijado: interfaz **`OtpChannel.deliverOtp`**
(SMS o WhatsApp bajo el mismo contrato) + canales `Console`/`Fake` para dev/test. **Consecuencia:
la 0028 queda implementable y lanzable HOY sin ningún proveedor de SMS** —el próximo paso sigue
siendo implementarla, ahora sin bloqueo de proveedor—. El ADR 0032 se ajustó (verificación
diferida); el ADR 0013 lo consume la 0032, no la 0028.

**Spec 0028 IMPLEMENTADA (2026-08-14) — identidad de consumidor y enrolamiento (camino A, 1ª
rebanada).** Primera noción de consumidor de plataforma: esquema pg `consumer` con 4 tablas
(`consumer_account` con teléfono E.164 único **sin verificar** + `qr_token` opaco; `program_membership`
aislada por `business_id`, unique `(consumer_id, program_id)`; `consumer_session` opaca con
`token_hash` sha256, cookie `HttpOnly` 30d; `enroll_attempt` para el rate-limit). Rutas públicas
`POST /api/public/enroll/:programId` (crea-o-reusa cuenta sin pisar perfil, membresía, abre sesión)
y `GET /api/public/enroll/me` (scopeado a la cookie); landing `(consumer)/enroll/[programId]`.
**Tres decisiones del owner (2026-08-14) bajadas a la spec antes de codear:** (1) reenrolar el
**mismo** programa con el mismo teléfono → **`409 already_member`** con CTA a recuperación (spec 0032),
sin duplicar membresía ni reabrir sesión (el teléfono no verificado no reabre acceso a una tarjeta
emitida en otro dispositivo — eso pasa por 0032); (2) **rate-limit 3 intentos/hora por teléfono**
(no por IP, para no bloquear al 4º cliente de la WiFi del local) → `429`; (3) enrolamiento permitido
en `active` **y** `closing`, solo `inactive`/inexistente → `404`. **Verificación:** implementador +
**revisor independiente PASS** (`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, lint,
prettier, **unit 46/19-skip** con 10 nuevos, build 3/3) e **integración Neon 9/9** en ramas efímeras
propias (no-fuga de `qr_token`/`token_hash`, aislamiento por negocio, seguridad del token de sesión
verificados). **Migración `0014_peaceful_harpoon` aplicada a prod** (`drizzle-kit migrate`;
verificado por SQL: esquema `consumer` con 4 tablas + 10 índices + 3 FK incl. cross-schema a
`core.loyalty_program`; `core`(14)/`merchant_auth`(4) intactos; 15 migraciones registradas). Ramas
Neon efímeras borradas. **Residual (post-deploy):** QA manual en teléfono sobre Vercel. Menores no
bloqueantes documentados por el revisor (TOCTOU del rate-limit ante concurrencia exacta del mismo
teléfono; intento contado también en 404/409 → consume slot del propio atacante; `23505` por colisión
de `qr_token` ~2⁻²⁵⁶ → 503) — todos dentro de los límites que la spec acepta y endurece la 0032.
**La próxima rebanada del camino A es la spec 0029** (pase de Wallet Apple/Google + push), bloqueada
por un ADR de proveedor de Wallet por escribir; reusa el `qr_token` ya emitido.

**Ronda QA 2026-08-14b sobre la spec 0028 (enmienda) — implementada + PASS.** QA en vivo del owner
sobre el deploy detectó tres ajustes (todo landing/UX + 1 columna): (1) **selector de país** con
banderita (emoji derivado del ISO) + código, **lista estática empaquetada** (`src/lib/countries.ts`
+ `countries.data.ts`, ~239 países; NO API ni tabla en DB — decisión del owner), número local que
compone el E.164; **default = país del negocio** (`core.business.country_code`, ISO-2; fallback `EC`);
(2) **`country_iso`** persistido para analítica (columna nullable en `consumer_account`, migración
**`0015_yummy_tusk`** aditiva; validado contra la lista → `422` si es desconocido; se guarda al crear,
**no se pisa en reuso**; entra al DTO, sin filtrar `qr_token`/`token_hash`); (3) **aviso de
recuperación movido al formulario** (junto al teléfono). **Implementador + revisor independiente
PASS**; gates verdes (typecheck 3/3, lint, prettier, unit 50→**53**, build 3/3) + integración Neon
9/9 en ramas efímeras. **Menor 1 resuelto post-PASS por el orquestador** (con tests): `composeE164`
evita duplicar el código si se pega un internacional con `+`, sin despojar dígitos pelados (colisión
Brasil dial `55`/DDD `55`). **Migración `0015` aplicada a prod y verificada** (`country_iso` text
nullable; `core`/`merchant_auth` intactos). El QR sigue sin renderizar a propósito (es la 0029).

**Cierre de sesión 2026-08-14 — punto de retorno.** La **spec 0028 (identidad de consumidor +
enrolamiento) + su enmienda 2026-08-14b (selector de país + `country_iso`)** quedan
**`implementada` con doble PASS de revisor independiente y QA manual del owner en vivo**: registro
real de **Marcos (`+49…`)** y **Julio (`+55…`/`country_iso=BR`)** sobre el deploy de Vercel,
verificados por MCP — selector de país OK, E.164 sin duplicar código, `country_iso` persistido.
Migraciones **`0014` + `0015` en prod**; commits **`b1f60d1`** (feature) + **`341f230`** (enmienda
país) en `main`. Gate verde (typecheck 3/3, lint, prettier, unit 53, build 3/3). Ramas Neon
efímeras borradas. **La próxima feature es la tarea 23 / spec 0029** (pase de Wallet Apple/Google +
canal de push): está en `borrador`/stub y **el primer paso es escribir el ADR de proveedor de
Wallet** (Apple PassKit / Google Wallet) que hoy la bloquea, y recién después cerrar la spec con el
owner. Reutiliza el `qr_token` ya emitido por la 0028 (no hay que re-emitirlo).

**Spec 0029 CERRADA + ADR 0033 + stub 0033 (2026-08-14) — punto de retorno.** Se cerró el
diseño del pase de Wallet con el owner. Decisión central (**ADR 0033**): **UN pase de identidad
"Mi Pasaporte" por consumidor** (no uno por comercio), **emisor único** Mi Pasaporte, en **Apple
Wallet (iOS, PassKit) y Google Wallet (Android)**; el **barcode lleva el `qr_token` global** de
la 0028 y **el comercio desambigua al escanear** (una sola credencial para todos los programas).
El pase es **casi estático — sin progreso por-programa**; enlaza a **"Ver mis programas"** (web)
vía un **`web_view_token` dedicado y revocable** (magic-link). Ciclo de vida = identidad (no
expira por cambio de programa; solo se rota ante pérdida de dispositivo). **Notificaciones
scopeadas por conjunto de destinatarios** (miembros de un negocio), no por el pase compartido: un
no-miembro no es alcanzable hasta que lo escanean. **Se desarrolla y verifica sin pagar Apple**:
`WalletProvider` intercambiable (`apple`/`google`/`console`/`fake`), firma **self-signed** del
`.pkpass` en tests + issuer **gratuito** de Google (modo demo); el install en iPhone real difiere
el $99 y queda como QA residual, no gate del PASS. La **spec 0029** quedó `cerrada` y `disjunta`
(dominio `wallet/*` nuevo; migración aditiva **`0016`**: `wallet_pass` + `web_view_token`). Se
separó el **canal de push a la spec 0033** (`borrador`: web service PassKit + APNs + `PATCH`/
`addMessage` de Google + rotación). Dos decisiones se mudaron a specs vecinas: **auto-enrolamiento
por escaneo + resolución del QR desambiguada por negocio → spec 0030**; **dashboard rico "Ver mis
programas" → spec 0031**. **Bloqueo externo del owner (no bloquea implementar):** dar de alta
Apple Developer ($99, solo para iOS real) y Google Cloud + Wallet API + issuer (gratis; guía
paso a paso acordada para el momento de implementar). **Próximo paso: implementar la spec 0029**
con el protocolo de `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de
`implementada`). **Antes de codear bajo codex: re-warmear el store de pnpm** (`pnpm fetch` en
terminal con red) porque la 0029 suma un paquete nuevo (render de QR / firma PKCS#7). Nada de
esto está commiteado aún (solo docs).

**Spec 0029 IMPLEMENTADA (2026-08-14) — pase de Wallet Apple/Google (camino A, 2ª rebanada).**
Se renderiza el `qr_token` de la 0028 y se lo hace portable en Wallet nativa. Dominio nuevo
`apps/merchant/src/server/wallet/*` con `WalletProvider` intercambiable (`apple`/`google`/`fake`,
seleccionado por entorno; 503 sin secretos): **Apple** arma `pass.json` storeCard + `manifest.json`
(sha1 por archivo) + firma **PKCS#7** con `node-forge` (cert real en prod, **self-signed en test**)
+ zip con `fflate`; **Google** arma el JWT RS256 de guardado con `node:crypto` nativo (sin lib).
Barcode = `qr_token` en ambos; branding Mi Pasaporte, sin progreso por-programa (ADR 0033). Rutas
públicas `GET /api/public/wallet/{apple.pkpass,google}` (401 sin sesión, crea-o-reusa **una** fila
`wallet_pass` por proveedor, runtime nodejs), `GET /c/[webViewToken]` (magic-link revocable → abre
sesión → `/wallet`, 404 si inexistente/revocado) y página `(consumer)/wallet` (QR SVG server-side +
ambos botones con detección UA y fallback + lista mínima "Ver mis programas"; el `done` de enroll
enlaza ahí). Ganchos de la 0033 provisionados (`webServiceURL` + `authenticationToken`, hash en
`wallet_pass.authTokenHash`). **Migración aditiva `0016`** (`web_view_token` en `consumer_account`
+ tabla `wallet_pass`); el backfill del NOT NULL se editó a mano (nullable → base64url por fila con
`gen_random_bytes(32)` → NOT NULL → unique). Paquetes nuevos agregados con red por el orquestador
(`qrcode`, `node-forge`, `fflate`, `@types/*`) — store caliente, lockfile versionado. **Anti-fuga**
blindada: DTOs por allow-list, ninguno serializa `qr_token`/`web_view_token`/`token_hash`/
`auth_token_hash`; test por entidad. **Implementador + revisor independiente PASS**
(`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, eslint, unit 60/23-skip con 7 de
wallet, build 3/3) + integración Neon **4/4** (wallet) y **9/9** (regresión 0028) en rama efímera
`br-small-surf-ax7jt3lk`. **Migración `0016` aplicada y verificada por SQL en efímera y en prod**
(17 migraciones; `web_view_token` NOT NULL/único/URL-safe, las 2 cuentas —Marcos+Julio— backfilleadas
con tokens distintos ≠ `qr_token`; `wallet_pass` + 3 uniques; `core`(14)/`merchant_auth`(4) intactos).
**Mistake→rule:** `drizzle/meta/` agregado a `.prettierignore` (json generado por drizzle-kit fallaba
`format:check` desde 0012). **Residuales aceptados** (no gate): install en iPhone real ($99, alta
Apple Developer del owner) + QA manual en **Android real** (issuer demo gratuito). **La rama Neon
efímera `br-small-surf-ax7jt3lk` sigue viva** (borrado gateado como destructivo — pendiente de
confirmación del owner). **Falta el `git push` a `main`** (commit local hecho; el push a `main` es
outward-facing y espera OK del owner; recordar el fix de `GH_TOKEN=` de CLAUDE.md). **La próxima
rebanada del camino A es la spec 0030** (acreditación en mostrador + auto-enrolamiento por escaneo);
depende del catálogo económico (0002/0021). El **canal de push del pase** es la spec 0033.

**Wallet en vivo (2026-08-14) — QA del owner en dispositivos reales, ambos pases en prod.**
**Google Wallet** verificado en **Android real** (issuer demo gratuito bajo cuenta Gmail
personal —la org GCP bloquea keys de SA vía `iam.disableServiceAccountKeyCreation`—; class
`3388000000023188934.mipasaporte_identity` `approved`; secretos `GOOGLE_WALLET_ISSUER_ID`/
`GOOGLE_WALLET_SA_JSON` en Vercel; script one-time `scripts/google-wallet/provision-class.mjs`).
**Apple Wallet** verificado en **iPhone real** con **certificado Pass Type ID real** (Apple
Developer personal, Team `SN489AVGUD`, `pass.com.checkpass.identity`, `.p12` con `-legacy` +
WWDR G4; 5 secretos `APPLE_*` en Vercel): el `.pkpass` instala y se agrega. Material de firma
local en `.secrets-apple/` (gitignoreado + **pre-commit hook** que aborta el commit de secretos,
verificado). Enmienda UX (commit `72081e5`): la confirmación de alta muestra los **dos botones de
Wallet directos** (componente compartido `WalletButtons`), sin paso extra. Checklist de go-live:
`docs/wallet-go-live.md`. **Residuales, cada uno su hilo:** (1) **diseño/arte** de los pases
(Google `heroImage` / Apple `strip` + logo/colores finales) — atado al rebrand **CheckPass**;
(2) **publishing access de Google** para salir de demo (gratis, ~2 días, post-arte); (3) pasaje
de la cuenta Apple **personal → organización** (regenerar cert); (4) **canal de push** = spec
0033. **Costos:** Google $0; Apple $99/año (ya pago hasta noviembre).

**Catálogo de productos CERRADO — spec 0034 + ADR 0034 (2026-08-14) — punto de retorno.**
Antes de implementar la spec 0030 (acreditación en mostrador, su prerequisito duro) se cerró
el catálogo con el owner. **Distinción clave:** el "catálogo económico" eran DOS cosas
distintas — (a) catálogo de **productos** (precio/coste), lo que 0030 consume; (b) catálogo
de **beneficios** (cupones/premios), motor de campañas. Se separaron: **ADR 0034** + **spec
0034** cierran el catálogo de **productos**; la **0002 quedó reencuadrada** (su marca/staff/
programa/negocio ya están implementados por 0025/0016/0024/0022) y la **0021 (beneficios)
diferida** con las campañas (andamiaje sin consumidor hoy). Decisiones del owner bajadas al
ADR/spec: catálogo **global por negocio con visibilidad opt-out por local**
(`available_all_locations` + `product_location`); **precio y coste opcionales** (sin precio,
el staff tipea el monto al escanear); el **valor en puntos NO vive en el producto** — lo
define el programa por **equivalencia `$X = Y puntos`** (se implementa en 0030, no en 0034);
**categorías gestionadas y libres** por negocio; **sin estados** (borrado directo, la
historia vive en el snapshot de 0030); **snapshot en la acreditación** para que editar/borrar
el catálogo no altere el wallet; **`currency_code` por negocio** (ISO 4217, default por país);
imágenes a R2 (pipeline de ADR 0029, DTO sin `*ObjectKey`); superficie real en
`/backoffice/catalog` (nueva tarjeta de nav), esquema `core` (`product`/`product_category`/
`product_location`), migración aditiva. La **spec 0034 quedó `cerrada` y `disjunta`**. Nada
commiteado aún (solo docs). **Próximo paso: implementar la spec 0034** con el protocolo de
`AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente), o 0030 en paralelo (0034 la
desbloquea). Re-warm del store de pnpm si se suma algún paquete.

**Spec 0034 IMPLEMENTADA (2026-08-14) — catálogo de productos del negocio.** Primer catálogo
real: dominio nuevo `apps/merchant/src/server/catalog/*` (barrel `catalog.ts` +
`core`/`validation`/`image`/`cleanup`/`products`/`categories`, todos < 300 líneas) sobre el
esquema `core` (`product` con precio/coste `numeric(12,2)` opcionales + checks `>=0 or null`,
`product_category` con unique `(business_id, lower(name))`, `product_location` para la
visibilidad opt-out, + `product_asset_upload`/`_cleanup` del pipeline de imagen). **`currency_code`
por negocio** en `business` (migración **`0017_opposite_cassandra_nova`**, backfill por país vía
CASE coherente con `lib/currencies.ts`; default `USD`). Rutas `api/catalog/**` (list/producto
CRUD/categoría CRUD/moneda + prep de subida **business-scoped** `product/image-upload` —soporta
imagen en el create, patrón diferido de stamp) + `api/public/catalog/[productId]/image`. UI real
en `backoffice/catalog/*` (lista mobile-first, editor con categoría inline + visibilidad por
local + imagen diferida, gestor de categorías, selector de moneda, estado vacío, `ConfirmDialog`,
toasts) + tarjeta "Catálogo" en el home. **El valor en puntos NO vive acá** (lo pone el programa
por equivalencia en 0030). **Anti-fuga blindada:** `toProductDTO` allow-list, ningún endpoint
serializa `image_object_key`; test unit + integración por entidad. **Implementador + revisor
independiente PASS** (`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, eslint,
prettier, **unit 70** con 10 nuevos, build 3/3) + **integración Neon 6/6 catálogo y 99/99 total**
(regresión de brand/consumer/wallet/loyalty verde) en rama efímera `br-rapid-moon-axlw221y`
(auto-expira 2026-08-17). **Migración `0017` aplicada a prod y verificada por SQL** (18
migraciones; 5 tablas `product*`; `currency_code` sin nulls, backfill AR→ARS/EC→USD/BR→BRL;
`core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). **Sin paquetes nuevos** (reusa
`server/assets/image.ts`), no hizo falta re-warm de pnpm. **Menores del revisor (no bloquean):**
la ruta de prep es `product/image-upload` (business-scoped, no `[id]/…`); `requireOwner` da 403
para sesión sin negocio (más correcto que 401). **Residual:** QA manual del owner sobre el deploy
(subida R2 en vivo + crear/editar/borrar producto/categoría + restringir por local). Commit
`3ca3f98`, pusheado a `main`.

**Enmienda 2026-08-14b (QA del owner) — moneda→Marca + rework de UI del catálogo, PASS.** Cuatro
ajustes sin cambio de esquema: (1) **la moneda pasó del catálogo a Marca** —se deriva del país
en el alta (`currencyForCountry` en `POST /api/onboarding/business`) y se edita en
`/backoffice/brand` (`saveBrand` la persiste, `currencyCode` opcional → conserva si falta); el
catálogo solo la lee; se borró `PUT /api/catalog/currency`, `updateCurrency` y `validateCurrencyCode`
(la validación ISO vive ahora en `brand/validation.ts`)—; (2) **catálogo con pestañas**
Productos/Categorías; (3) producto con form propio, categoría inline; (4) **buscador + filtro por
categoría** en Productos. Split por `file-size`: `brand/page.tsx` se dividió en `regional-fields.tsx`
+ `use-brand-logo.ts`. **Implementador + revisor independiente PASS**; gates verdes (typecheck 3/3,
lint, prettier, **unit+integración 100/100** con round-trip de moneda en Marca, build 3/3). Sin
migración. **Commit local hecho; falta `git push`.** **La próxima rebanada del camino A es la spec 0030**
(acreditación en mostrador), ahora **desbloqueada** por el catálogo.

**Spec 0035 IMPLEMENTADA (2026-08-14) — imágenes de stock para productos (ADR 0035).** Sobre la
imagen del catálogo (0034) se sumó una biblioteca de fotos gratis: botón **"Elegir de biblioteca"**
→ modal `StockPicker` (buscar on-submit + "cargar más") → elegir → preview desde la URL del
proveedor + atribución "Foto de Pexels.com · Autor: <nombre>"; al Guardar el servidor baja la foto
**por id** (anti-SSRF: allow-list `images.pexels.com` + `redirect:error` + tope 5 MB),
`normalizeImage` → R2, y persiste la atribución. Dominio `server/stock/*` (interfaz
`StockPhotoProvider` intercambiable: `pexels` + `fake` por `STOCK_PROVIDER`; la **API key nunca va
al cliente**, búsqueda proxeada `GET /api/catalog/stock/search`, 503 sin key). `resolveImageChange`
unifica keep/replace/remove/stock con rollback + borrado diferido. **Migración `0018`** (4 columnas
de atribución nullable en `core.product`; DTO las expone, **sigue sin serializar `image_object_key`**).
**Implementador + revisor independiente PASS**; gates (typecheck 3/3, lint, prettier, **unit+integración
106/106** con anti-SSRF unit + atribución→DTO en integración con `fake`, build 3/3). **Migración `0018`
aplicada y verificada por SQL en prod** (19 migraciones; `core`(19)/`consumer`(5)/`merchant_auth`(4)
intactos). **Residual (go-live):** setear `PEXELS_API_KEY` en Vercel (el owner ya tiene la key) + QA
manual (buscar/elegir/guardar/reeditar contra R2 real). **Con esto el catálogo (0034+0035) queda
cerrado; la próxima rebanada del camino A es la spec 0030** (acreditación en mostrador), desbloqueada.

**Cierre de sesión 2026-08-14 — punto de retorno. Catálogo (0034 + 0035) CERRADO con QA en vivo
del owner.** Estado en `main` (último commit `5f1ec5b`), árbol limpio, gate verde (typecheck 3/3,
lint, unit 75/31-skip; integración 106/106 y build 3/3 corridos en la sesión). En prod: migraciones
`0017` (catálogo + `currency_code`) y `0018` (4 columnas de atribución de stock) aplicadas y
verificadas por SQL (19 migraciones; `core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). Commits
de la sesión: `3ca3f98` (spec 0034), `69e04f5` (enmienda moneda→Marca + UI), `4ea982a`/`445d937`
(pulidos UI), `336426d` (spec 0035 stock), `5f1ec5b` (input mobile cámara/galería + HEIC). **Todo
con doble PASS de revisor independiente** (0034, enmienda 0034b, 0035) salvo los pulidos de UI
puros y el último ajuste HEIC (aditivo, cubierto por la regresión de integración). **La moneda vive
en Marca** (`/backoffice/brand`), derivada del país en el alta; el catálogo la lee. **Buscador de
stock**: `PEXELS_API_KEY` ya seteada por el owner y QA en vivo OK. **Rama Neon efímera
`br-rapid-moon-axlw221y` (auto-expira 2026-08-17)** — no requiere borrado manual. **Próxima sesión:
implementar la spec 0030 (acreditación en mostrador / tarea 24)** con el protocolo de
`AGENT-WORKFLOW.md`: es `borrador`/stub, así que **el primer paso es cerrar la spec con el owner**
(consola de staff: escanear QR del consumidor → carrito con productos del catálogo → otorgar
puntos por equivalencia `$X = Y puntos` / sellos por reglas; **auto-enrolamiento por escaneo** y
resolución del `qr_token` global desambiguada por el negocio, heredado del ADR 0033). Depende de
0028 (hecha) y del catálogo (hecho). Re-warm del store de pnpm si sumara algún paquete.

**Spec 0036 CERRADA + ADR 0036 (2026-08-14) — mecánica de acumulación + premios del programa;
prerequisito duro de 0030.** Antes de implementar la acreditación en mostrador (0030) se cerró con
el owner **cómo se otorga y qué se canjea**, que hoy el programa no define. **Wizard extendido:**
(3) el paso de términos gana un **bloque de mecánica** — otorgar `X` unidades por bloque de `$Y`
de compra, **por bloques enteros con `floor` y sin arrastre** (compra $7 con `10 pts cada $3` → 20
pts, el $1 se pierde); Sellos elige `por compra` (1 sello/transacción) o `por monto`, Puntos
siempre `por monto`; con **ejemplo en vivo**. (4) **paso de premios** nuevo — tabla `loyalty_reward`:
Sellos = completar → **1 premio**, Puntos = **1..N canjes** con **costo en puntos** auto-sugerido/
editable y **$-equivalente en vivo**; tres tipos: producto del catálogo (0034, trae nombre/precio/
imagen), premio libre (texto), % de descuento. (5) preview con **métrica de valor** ("por cada $1 en
premios, ~$N en ventas"; en Sellos `per_purchase`, "N compras por premio"). **Decisiones clave:** el
costo en puntos ES el gasto-objetivo, **aritmética calculada, no IA** (descartada por no
determinista); **sin catálogo de redención separado** (juega contra "operar en 30 min"); **sin regla
global de mínimo de gasto** (ya está en el costo de cada premio); la **ejecución del canje es de
0030**, acá solo se **define**. **Modelo (ADR 0036):** 3 columnas `accrual_*` nullable + checks en
`loyalty_program` (criterio de ADR 0030) + tabla `loyalty_reward` relacional; migración aditiva
**`0019`**, sin `DELETE` destructivo (los programas de prueba quedan "sin mecánica" hasta editarse;
el owner autorizó descartarlos). **Fast-follow explícito fuera de la spec:** imagen del premio libre
(el premio-producto ya trae imagen del catálogo). **Disjunta: no** (0030 abierta consume estas tablas
→ serializar antes de 0030). Nada commiteado aún (solo docs). **Próximo paso: implementar la spec
0036** con el protocolo de `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de
`implementada`), y recién después cerrar/implementar 0030. Sin paquetes nuevos previstos.

**Spec 0033 CERRADA + ADR 0037 (2026-08-15) — canal de push del pase de Wallet; punto de
retorno.** Antes de implementar el push (prerequisito técnico duro de la 0031) se cerró el diseño
con el owner. **Decisión central (ADR 0037):** el push **no** se envía inline desde el request —
se **encola** en `wallet_push_queue` **dentro de la misma transacción** que el grant de 0030
(*outbox transaccional*: grant con rollback → sin aviso; grant idempotente → sin aviso duplicado),
y lo drena un worker. **Dos clases con prioridad:** `transactional` (acreditación 0030 — inmediata,
**preempta**, saltea cooldown) y `campaign` (marketing — **feature futura, solo provisionada**:
enum + prioridad + cooldown ya diseñados, sin productor), con **cooldown por-consumidor** (un
`transactional` empuja el `not_before` de un `campaign` en cola a `ahora+cooldown`). Esto
materializa el escenario del owner: Comercio B (acreditación) preempta a Comercio A (campaña), que
sale minutos después. **Un solo slot "Última novedad"** en el pase compartido; cada fila de la cola
es su propia notificación (**Apple**: campo con `changeMessage` + APNs pull vacío; **Google**:
`addMessage`). **Dispatch inmediato best-effort** tras el commit + **worker de cron**
(`/api/internal/wallet-push`) como red de seguridad/retry/campaña. **4 decisiones del owner
(2026-08-15):** (1) campo "Última novedad" + cola con prioridad; (2) **registro de dispositivo**
(`wallet_push_device`) para APNs; (3) la **rotación** del pase (rotar `qr_token`+`web_view_token`,
invalidar dispositivos, re-empujar) la **dispara la recuperación por OTP de la 0032** — la 0033
entrega el mecanismo `rotatePassCredentials`; (4) **auth por token del pase** (`ApplePass` vs
`auth_token_hash`) + **rate-limit por serial, NO por IP** (mismo criterio que 0028: NAT de carrier
+ el fetch lo dispara iOS; el límite es anti-DoS, no authz). **Web service PassKit** en
`/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log). **APNs = JWT ES256 con la
`.p8` sobre HTTP/2 nativo → SIN paquetes nuevos** (ni re-warm del store de pnpm). **Externo (hecho
por el owner):** APNs auth key `.p8` generada en Apple Developer (Team `SN489AVGUD`, entorno
**Both** sandbox+prod, scope unrestricted) — faltan 3 secretos en Vercel (`APPLE_APNS_KEY_P8`
base64 / `APPLE_APNS_KEY_ID` / `APPLE_APNS_TEAM_ID`); Google no suma nada (mismo service account).
**Migración aditiva `0021` de esta spec** (3 columnas en `consumer_account` + `wallet_push_device`
+ `wallet_push_queue`). **Disjunta: no** — el enqueue toca `counter/orders.ts` (0030, implementada)
y `rotatePassCredentials` lo consume la 0032 (abierta) → **serializar 0032/0031 después**. Nada
commiteado aún (solo docs: ADR 0037 + spec 0033 + INDEX). **Próximo paso: implementar la spec
0033** con `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente; el push real se verifica
end-to-end con el canal `fake`, APNs/Google reales quedan como QA residual).

## Siguiente

| # | Tarea | Spec | Estado | Notas |
|---|---|---|---|---|
| 1 | Validar propuesta de stack y publicar remoto GitHub | ADR 0011–0017 | **hecho** — fila VIEJA, corregida 2026-09-09. `main` está publicado en `maxhost/check-point` y el deploy de Vercel corre por commit; el push funciona con el fix de `GH_TOKEN` documentado en `CLAUDE.md` |
| 2 | Crear y cerrar Spec 0010 de scaffold | 0010 | hecho | Spec cerrada el 2026-08-10; sin comportamiento de producto |
| 3 | Implementar scaffold con protocolo de agentes | 0010 | en revisión | Implementado y verificado localmente (gates verdes); `pnpm-lock.yaml` versionado. Canonical `test:e2e` requiere puerto 3001 libre; falta PASS/FAIL independiente |
| 4 | Cerrar alcance y arquitectura técnica de V1 | 0001–0009 | **hecho** — cerrado por el ADR 0057 (2026-09-08). 0001/0005/0006 quedaron `deprecada`, 0008 diferida y 0009 pendiente de rediseño dentro de campañas; 0003 y 0007 siguen como roadmap |
| 5 | Implementar prototipo QA consumer v0.1 | 0011 | en revisión | Rutas y QR local implementados; format, lint, typecheck, unit y build verdes. Pendientes E2E del nuevo flujo, QA manual HTTPS en teléfono y PASS independiente |
| 6 | Implementar onboarding demo de owner y negocio | 0012 | en revisión | Wizard mock implementado en merchant; typecheck y format verdes. Pendientes unit/E2E, QA manual y PASS independiente |
| 7 | Implementar home demo del Backoffice owner | 0013 | **hecho (demo) / superada** — fila VIEJA, corregida 2026-09-09. El backoffice real es `app/backoffice/page.tsx`; el mock sigue servido en `/backoffice/demo` |
| 8 | Implementar pantalla demo de Marca | 0014 | **superada por la spec 0025** — fila VIEJA, corregida 2026-09-09. Marca real en `app/backoffice/brand/` con assets en R2 |
| 9 | Diseñar e implementar Locales demo | 0015 | **hecho (demo), y el demo SIGUE SIENDO EL DESTINO REAL** — corregido 2026-09-09. El tile «Locales» del backoffice real enruta a `/backoffice/demo/locations`. No hay locales reales: ver tarea 47 |
| 10 | Implementar Staff demo | 0016 | **superada por la spec 0043** — fila VIEJA, corregida 2026-09-09. Staff real en `app/backoffice/staff/` con alta, desactivación y login |
| 11 | Refactorizar la fundación UI de merchant demo | 0018 | en revisión | Componentes reutilizables, código muerto y confirmaciones nativas eliminados; format, lint, typecheck, unit, build y E2E local 3/3 verdes. Falta PASS independiente |
| 12 | Implementar Programa de fidelización demo | 0019 | en revisión | Acceso propio; activar/desactivar Puntos o Sellos y configurar unidades, objetivo e imagen de sello mock. Gates locales verdes; E2E nuevo pendiente de ejecución local y PASS independiente |
| 13 | Implementar Analíticas owner demo multirubro | 0020 | en revisión | Dashboard universal con lentes Bar/Restaurante, Hotel y Retail; gates locales verdes. Pendientes E2E local y PASS independiente |
| 14 | Rediseñar wizard demo desde objetivos de negocio | 0003, 0017, ADR 0022 | en revisión | Flujo Constructor (objetivo editable) → Fechas/horarios → Revisión; requisitos explícitos para POS, duración y directorio; feedback sin incentivo |
| 15 | Diseñar e implementar Catálogo único de beneficios | 0021 | diferido | **Diferido con las campañas (ADR 0034).** Es el catálogo de **beneficios** (cupones/premios), no el de productos. Sus consumidores (wizard de campañas + Incentive Engine) no existen; revive con esa fase. El catálogo de **productos** que sí se necesita hoy es la tarea 30 / spec 0034. |
| 16 | Implementar registro y autenticación real de Owner | 0022 | hecho | Registro/login, alta de negocio/local, Stripe Checkout y webhook implementados y desplegados; QA manual contra Neon y gates locales verdes. El selector final de planes es carrusel con Plus mensual por defecto. |
| 17 | Implementar búsqueda y procedencia de locales | 0023 | hecho | **Geoapify único; Mapbox retirado por costo (2026-08-16).** El owner confirmó en vivo que Geoapify encuentra locales/direcciones perfectamente (incl. Ecuador); el fallback Mapbox se eliminó porque su autocomplete facturó USD 5 por una sola consulta. Se borró el adaptador server (`verifyMapbox`), el componente `address-autofill-mapbox.tsx`, la plomería `renderMapboxFallback`/`useMapboxFallback` (ahora ante error de Geoapify el campo se conserva y muestra aviso de reintento) y los estilos/env/docs de Mapbox. Contrato `verifyLocation`/`LocationProvider` sigue provider-neutral para reintroducir otro proveedor sin migrar locales. ADR 0025 + spec 0023 + INDEX + DEPLOY-OWNER-TEST actualizados. Gates: **typecheck 3/3, lint, test 159 passed/69 skipped** (integración Neon skip sin DB local). Migración 0003 ya aplicada; sin cambios de schema (columna `provider` sigue permisiva). **Pusheado a `main` (`dfb4080`) y QA en vivo del owner sobre Vercel: positivo — Geoapify encuentra locales/direcciones correctamente en producción, sin Mapbox.** Spec 0023 cerrada. |
| 18 | Implementar programa de fidelización real y términos | 0024 | hecho | Ciclo mutable Puntos/Sellos, TOS editables y cierre fechado (ADR 0027) + endurecimiento production-grade (ADR 0028): cancelar cierre (`PATCH`), auditoría por eventos (`loyalty_program_event`), fin del éxito falso (`RETURNING`+409), normalización de `configuration`, last-write-wins. `schema.ts`/`loyalty-program.ts`/página divididos por el límite de tamaño. Gates locales verdes; **integración Neon verde** (schema + ciclo de vida completo + auditoría + 409) contra rama de test aislada; **migración 0010 aplicada a `main` de producción** (11 migraciones registradas, tabla+índices verificados) y **código pusheado** (`1887db8`) el 2026-08-12. Residual: el E2E `loyalty-real.spec.ts` queda listo pero pendiente de correr contra el entorno desplegado con owner de prueba. QA en vivo 2026-08-13: fix de persistencia de términos al editar (plantillas como botones «+ Insertar» que copian texto renderizado al textarea, sin duplicación) + ronda de UX. Endurecimiento post-revisión (auditoría atómica, tests de núcleo, 400/TOCTOU) y **PASS de revisor independiente**; Spec 0024 → `implementada` (commit `50228a7`). |
| 19 | Implementar marca real y assets R2 | 0025 | hecho | Nombre, colores, timezone y logo privado procesado/servido desde R2; reemplaza el mock de Marca. Gates locales verdes, pusheado a `main` (`b576a4b`) y QA manual en vivo confirmado por el owner el 2026-08-12. Spec cerrada a `implementada` a pedido del owner. 2026-08-13: **revisión independiente** (FAIL estrecho) resuelta — fuga de `logo_object_key` en `/api/brand` (ahora DTO sin la clave), JSON malformado → `400` (antes 503), UUID inválido → `404`, y tests agregados: `normalizeLogo` SVG/oversize + integración Neon (`409` optimista/`403`/`422`) verde en rama efímera. Concurrencia real **a futuro** (>1 owner). Núcleo de seguridad verificado correcto por el revisor. **Re-revisión: PASS** — 0025 al mismo estándar que 0024. |
| 20 | Diseño de sello del programa de fidelización en R2 | 0026 | hecho | Input para subir el diseño de la imagen del sello (modalidad Sellos): PNG/JPEG/WebP, **conserva transparencia** (decisión B del owner 2026-08-13; la tarjeta pinta los recuadros en blanco), borrado diferido a Guardar (igual que marca). Spec **cerrada** + **ADR 0029** (módulo de imagen compartido `server/assets/image.ts`; tabla `loyalty_asset_upload` paralela; `brand.ts` se divide). Implementación por fases: **(a) hecha** — `server/assets/image.ts` (`normalizeImage`, conserva alfa) extraído y `brand.ts` dividido (`brand/core|validation|cleanup`, 221 líneas), sin cambio de comportamiento (unit 26/26 + integración brand 3/3 verde en rama efímera). **(b–e) hechas**: columnas `stamp_image_object_key`/`stamp_image_version` + tablas `loyalty_asset_upload`/`loyalty_asset_cleanup` (migración `0012`); módulo `loyalty-program/stamp.ts` (upload firmado, procesamiento con `normalizeImage` que conserva alfa, resolución del cambio con rollback y borrado diferido, cron de limpieza, lectura pública); endpoints `POST /stamp-upload`, `stampAction` en el `PUT`, `GET /api/public/loyalty/.../stamp`; el `GET` del programa **oculta** `stampImageObjectKey` y expone `stampImagePath`; UI: campo de sello en el editor (solo Sellos) con subir/quitar diferido (`use-stamp-upload.ts`). Verificado: unit 7/7, typecheck 3/3, lint, integración Neon **9/9** en rama efímera, **migración 0012 aplicada a prod** (verificada). **Revisión independiente: PASS** (2026-08-13, sin bloqueantes ni importantes); se agregó un test que blinda que el `GET` nunca serializa `stampImageObjectKey`. Spec 0026 → `implementada`. Menores diferidos (URL firmada sin content-length, huérfano bajo edición concurrente del mismo owner — atado a la concurrencia a futuro; test de rollback con mock de R2). Residual: QA manual del camino de subida R2 en vivo (como en marca). Pulido QA 2026-08-13: botón "Quitar" del sello ahora al lado del preview (fila flex) y de tamaño normal, no full-width. |
| 22 | Identidad de consumidor y enrolamiento (esquema `consumer`, landing pública sin verificar, membresía aislada) | 0028 | hecho | Esquema pg `consumer` (4 tablas) + `POST /api/public/enroll/:programId` (crea-o-reusa cuenta **sin verificar**, `phone_verified_at=null`; **`409 already_member`** con CTA a recuperación al reenrolar el mismo programa; **rate-limit 3/h por teléfono** → `429`; enrola en `active`/`closing`, `inactive`→`404`) + `GET /enroll/me` scopeado + `program_membership` aislada por `business_id` + sesión opaca (`token_hash` sha256, cookie `HttpOnly` 30d) + `qr_token` opaco (nunca serializado). Landing `(consumer)/enroll/[programId]`. **No envía SMS** (OTP diferido a la 0032). Implementador + **revisor independiente PASS**; gates verdes (typecheck 3/3, lint, prettier, unit 46/19-skip, build 3/3), integración Neon 9/9 en rama efímera, **migración `0014` aplicada a prod y verificada por SQL**. Ramas efímeras borradas. Residual: QA manual en teléfono sobre el deploy. |
| 23 | Pase de Wallet (Apple / Google): UN pase de identidad por consumidor | 0029 | hecho | UN pase "Mi Pasaporte" por consumidor (**ADR 0033**), emisor único, barcode = `qr_token` global, sin progreso por-programa, enlace "Ver mis programas" (`web_view_token` dedicado revocable). Dominio `server/wallet/*` (`WalletProvider` apple/google/fake), rutas `GET /api/public/wallet/{apple.pkpass,google}` (401 sin sesión, crea-o-reusa 1 fila/proveedor, 503 sin secretos) + `/c/[webViewToken]` (magic-link → sesión → `/wallet`, 404 revocado) + página `/wallet` (QR SVG + ambos botones UA + lista mínima). Paquetes: `qrcode`, `node-forge` (PKCS#7 + self-signed en test), `fflate` (zip), JWT Google con `node:crypto`. Anti-fuga blindada (DTOs allow-list, test por entidad). **Implementador + revisor independiente PASS**; gates (typecheck 3/3, eslint, unit 60/23-skip, build 3/3) + integración Neon 4/4 (wallet) + 9/9 (regresión 0028) en rama efímera; **migración `0016` aplicada y verificada por SQL en efímera y en prod** (17 migraciones; `web_view_token` NOT NULL/único/URL-safe/≠`qr_token`, backfill de las 2 cuentas; `wallet_pass` + 3 uniques; `core`/`merchant_auth` intactos). Mistake→rule aplicado: `drizzle/meta/` a `.prettierignore` (json generado). **QA en vivo del owner 2026-08-14: Google verificado en Android real** (issuer demo gratuito, class `approved`) **y Apple verificado en iPhone real** (cert Pass Type ID real, Team `SN489AVGUD`, WWDR G4; `.pkpass` instala). Ambos en prod. Enmienda UX: botones de Wallet directos en la confirmación de alta (componente `WalletButtons` compartido). Checklist de go-live en `docs/wallet-go-live.md`. **Residuales (fuera de 0029):** diseño/arte del pase, pasaje cuenta Apple personal→org (regenerar cert), publishing access de Google (salir de demo). Push = tarea 28/spec 0033. |
| 32 | Mecánica de acumulación + premios del programa (wizard extendido) | 0036 | **hecho** — la fila decía `pendiente` y estaba VIEJA: la spec 0036 figura `implementada` en su frontmatter y en `INDEX.md`, y la migración `0019_kind_guardsmen.sql` con `loyalty_reward` está aplicada. Detectado al investigar el QA B2 (2026-09-05) | **OJO, lo que esta tarea NO entrega: el canje.** Define premios y mecánica; ejecutarlos es la **tarea 44**, que no existía porque las specs 0030 y 0036 se lo delegaron mutuamente. Notas originales: **spec CERRADA (2026-08-14) + ADR 0036.** Prerequisito duro de la tarea 24 / spec 0030. Extiende el wizard: paso 3 gana la **mecánica de acumulación** (`X` por bloque de `$Y`, `floor` sin arrastre; Sellos `por compra`/`por monto`, Puntos `por monto`; ejemplo en vivo) en 3 columnas `accrual_*` nullable + checks; paso 4 **premios** (`loyalty_reward`: producto catálogo / libre / % descuento; Puntos con **costo en puntos** = gasto-objetivo calculado, auto-sugerido/editable + $-equivalente; Sellos 1 premio); paso 5 preview con **métrica de valor**. Migración aditiva `0019`. El canje se **ejecuta** en 0030 (acá solo se define). Imagen del premio libre = fast-follow. Implementar con `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente). |
| 24 | Acreditación en mostrador (consola web móvil, puntos/sellos por reglas) + auto-enrolamiento por escaneo | 0030 | hecho | **IMPLEMENTADA + QA EN VIVO DEL OWNER COMPLETO (2026-08-15) con PASS de revisor independiente.** Dominio `server/counter/*` (core/resolve/grant/orders) + rutas `api/counter/{resolve,grant}` (+ `_auth.requireOperator`) + UI `/backoffice/counter` (page server + counter-console/stages/sale-forms/qr-scanner; scanner `BarcodeDetector`+`jsqr`; venta detallada/rápida; Confirmar deshabilitado al 1er tap; reinicio **manual** vía "Escanear siguiente", sin temporizador). Otorgamiento **atómico** vía CTE guardado (`persistGrant`: bump con guard `NOT EXISTS(order)` + `ON CONFLICT DO NOTHING`) e **idempotente** por `unique(business_id, client_request_id)` — sin doble-bump bajo concurrencia real (verificado por el revisor con sonda 8-way). Anti-fuga: DTOs allow-list, ningún `qr_token`/`token_hash`/`web_view_token`/`auth_token_hash` serializado (test). Migración aditiva **`0020_harsh_venus`** aplicada y verificada por SQL en prod (21 migraciones; `core.order`/`order_item` + saldo en `program_membership`; `core`(22)/`consumer`(5)/`merchant_auth`(4) intactos). Paquete nuevo `jsqr`. Gates: typecheck 3/3, lint, prettier, **unit 106/44-skip**, build 3/3, integración Neon **8/8** counter + **25/25** regresión en rama efímera. **QA real verificado por SQL:** venta rápida $30→100pts y venta detallada (Café con leche $5→10pts) sobre Fybeca 3 en prod, saldo final 110. **Enmiendas de QA pusheadas** (`eb4c9a8` toast+preview+estilos, `610ad31` reinicio manual). La notificación (paso 6) = spec 0031, que depende de la **spec 0033** (push del pase). **Modelo:** saldo por membresía (`points_balance`/`stamps_count`) + `core.order`/`order_item` owner-facing (ledger de auditoría). **Disjunta: no** — crea las tablas que la spec 0031 lee → serializar 0031 después. |
| 25 | Micro-portal del consumidor: Programas y Mi QR | 0031 | **hecho** — fila VIEJA, corregida 2026-09-09: la spec 0031 figura `implementada` en su frontmatter y en `INDEX.md`. La «landing en vivo» quedó **fuera de alcance explícitamente y sin reemplazo**; el refresco de `/wallet` que el owner vio en el QA B1.4 es la tarea 48 |
| 28 | Canal de actualización y push de Wallet | 0033 | hecho | **IMPLEMENTADA (2026-08-15) con doble PASS de revisor independiente (flujo `AGENT-WORKFLOW.md`: implementación → revisor FAIL por worker sin test + sin reaper → corrección → re-review PASS).** Cola `wallet_push_queue` (outbox transaccional en el `WITH` de `persistGrant`), worker `/api/internal/wallet-push` con prioridad transaccional>campaign + cooldown + claim race-safe (`sending`) + reaper de huérfanas; web service PassKit `/v1/*` (auth `ApplePass`, rate-limit por serial→429); APNs JWT ES256 con `.p8` sobre HTTP/2 nativo (sin paquetes nuevos); Google `addMessage`; `PushChannel` intercambiable (`fake` cubre el gate); `rotatePassCredentials` (lo usa 0032). Anti-fuga por entidad. Gates: typecheck 3/3, lint, prettier, unit 118, build 3/3 + integración Neon 21/21. Migración **`0021`** aplicada y verificada por SQL en prod (22 migraciones; `consumer` 5→7; `core`(22)/`merchant_auth`(4) intactos). Residuales: 3 secretos `APPLE_APNS_*` en Vercel + QA Android/iPhone real (canal `fake` cubre el gate); DTOs de las 2 entidades sin ruta consumidora aún (llega con 0031). Falta `git push` a `main` (espera OK del owner). Notas de diseño previas: **PRÓXIMA FEATURE — spec CERRADA (2026-08-15) + ADR 0037.** Prerequisito técnico duro de la spec 0031. **Cola `wallet_push_queue` (outbox transaccional en el grant de 0030)** con prioridad `transactional`>`campaign` y cooldown por-consumidor (ADR 0037); dispatch inmediato best-effort + worker de cron `/api/internal/wallet-push`. **Un slot "Última novedad"** en el pase (Apple: `changeMessage`+APNs pull vacío; Google: `addMessage`). **Web service PassKit** `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log; auth `ApplePass` vs `auth_token_hash`; **rate-limit por serial, no IP**). **APNs = JWT ES256 con `.p8` sobre HTTP/2 nativo, SIN paquetes nuevos.** `wallet_push_device` para registros. **Rotación** `rotatePassCredentials` (rota `qr_token`+`web_view_token`, invalida devices, re-empuja) que **invocará la 0032**. Migración aditiva **`0021`**. **Externo hecho:** `.p8` generada (owner); faltan 3 secretos `APPLE_APNS_*` en Vercel. **Disjunta: no** (enqueue en `counter/orders.ts` de 0030; `rotatePassCredentials` lo usa 0032 → serializar). Implementar con `AGENT-WORKFLOW.md`; push real = QA residual (canal `fake` cubre el gate). |
| 27 | Recuperación de cuenta y verificación por OTP SMS | 0032 | **hecho** — fila VIEJA (decía «PRÓXIMA FEATURE»), corregida 2026-09-09. Verificado en el árbol: `server/otp/{core,provider,clicksend,twilio,fake}.ts`, `server/recovery/`, `(consumer)/recover/` y sus tests. Los casilleros del DoD de la spec quedaron sin tildar, pero el código está |
| 33 | Web Push (notificaciones de navegador, iOS + Android) | 0037 | hecho | **IMPLEMENTADA + PASS de revisor independiente + QA en vivo del owner CERRADO (2026-08-16).** Dominio `server/push/*` (VAPID JWT ES256, cifrado RFC 8291 verificado vs el Apéndice A), tabla `web_push_subscription`, PWA (`public/sw.js` + manifest dinámico), UI `push-prompt.tsx`/`ios-install-hint.tsx`. Migración `0023` aplicada y verificada en prod. Post-QA: subject VAPID normalizado a `mailto:` (`normalizeVapidSubject`, Apple daba 403 sin esquema) e instructivo iOS rehecho (sin botón "Abrir Compartir", pasos numerados). Detalle completo en `specs/0037-web-push-notificaciones-android.md`. |
| 34 | Ruteo de notificación por clase de aviso (transaccional=wallet, fallback Web Push) + opt-in Android en la confirmación | 0038 | hecho | **IMPLEMENTADA + PASS de revisor independiente + QA en vivo del owner CERRADO (2026-08-16).** ADR 0040: `transactional` sale solo por wallet, con fallback a Web Push si no hay pase alcanzable (`consumerHasReachableWallet`) — nunca los dos a la vez (mata el duplicado hallado en el QA de iOS). `campaign` conserva el fan-out provisional. Botón "Activar notificaciones" en Android en la confirmación del enroll. Sin migración. Detalle en `specs/0038-ruteo-de-notificacion-por-clase-y-opt-in-android.md`. |
| 35 | Branding de la landing de enrolamiento (logo + color de marca) | 0039 | hecho | **IMPLEMENTADA + PASS de revisor independiente + QA en vivo del owner CERRADO (2026-08-16).** Logo del negocio (ruta pública sin exponer `logoObjectKey`) + color de marca en botones, con texto por luminancia (`readableTextColor`); card del instructivo iOS coherente con cualquier acento (`tint`/`shade`, `lib/brand-color.ts`). `/wallet` queda neutro (arco 0031). Post-QA se cazaron y corrigieron **2 bugs de subida de imagen que afectan también sello y catálogo** (comparten `lib/image-formats.ts`/`server/assets/image.ts`): alias no-IANA `image/jpg` faltante, y `normalizeImage` rechazaba fotos de teléfono >2048² en vez de achicarlas (fix paliativo `MAX_INPUT_PIXELS=50MP`; la solución de fondo —recorte en el cliente— quedó en **ADR 0041 + spec 0040**, tarea 36). Detalle en `specs/0039-branding-de-la-landing-de-enrolamiento.md`. |
| 36 | Recorte de imagen en el cliente antes de subir (cropper drag+zoom, mobile+desktop) | 0040 | hecho (QA en vivo del owner PENDIENTE) | **IMPLEMENTADA (2026-09-02) con PASS de revisor independiente en la 2ª pasada** (flujo `AGENT-WORKFLOW.md`: implementación → revisor **FAIL** por 5 hallazgos → corrección → re-review **PASS**). Cropper 1:1 `react-easy-crop` 6.2.3 en `app/components/image-cropper.tsx`, montado con `next/dynamic({ssr:false})` desde las 3 superficies; helper puro `lib/crop-image.ts` (`canDecodeImage`, `decideImageChoice`, `cropImageToBlob` con canvas inyectable). **SIN MIGRACIÓN**: el flag `cropped` viaja en el payload de guardado, no en el presign (desvío de la decisión 5 autorizado por el orquestador — por presign habría que persistirlo en 3 tablas). `normalizeImage` parametrizado: **4.2 MP** en el camino con recorte, **50 MP** en el fallback. Gates: lint, typecheck 3/3, prettier, build 3/3, **tests 259 → 310**. **Chunk diferido verificado contra manifests reales**: `static/chunks/1-5vd4y9_pvjp.js` (27K) sólo en los 3 `react-loadable-manifest.json`, **ausente** de `build-manifest.json`. **Lo que el FAIL cazó:** (1) el fallback de decode estaba *asumido* y el criterio lo prohibía explícitamente; (2) el guard del `accept` era ciego a `accept="…"` y tapaba **2 listas angostas más** en `demo/brand` y `demo/loyalty` — 4ª y 5ª aparición del bug de `CLAUDE.md`; (3) revertir `use-catalog-image` a `startsWith("image/")` dejaba la suite verde; (4) un `isAcceptedImageType` que toleraba `file.type == ""` **aflojó marca y sello** sin ganar nada (los 3 presign rechazan `""` igual). El revisor de la 2ª pasada mató **28 mutaciones** en un worktree de `/tmp`. **RESIDUAL DEL OWNER: QA en vivo con el teléfono real de la 0039** — subir una foto de galería en marca, encuadrarla, verla guardada, y **registrar si apareció el cropper o si cayó al fallback**: ese es el dato que decide el **ADR 0047 §4** (reabrir o cerrar el decoder HEVC en WASM). No cerrado tampoco: la mitad *cliente* del blob cuadrado ≤2048 (el server no valida cuadratura **a propósito**, ADR 0047 §3). **Seguimiento → spec propia:** un picker que reporta `contentType: ""` no puede subir (preexistente, no regresión). `pnpm fetch` **NO hace falta**: el store local ya quedó caliente con `react-easy-crop@6.2.3` (verificado en `.pnpm-store/v11/index.db`). Detalle en `specs/0040-recorte-de-imagen-en-el-cliente.md`. |
| 26 | Brand kit (afiche imprimible con QR de enrolamiento) | 0041 | **hecho** — fila VIEJA (decía «sin spec aún»), corregida 2026-09-09. La spec 0041 figura `implementada` en su frontmatter y en `INDEX.md` |
| 29 | Rebrand CheckPass Club + diseño visual de los pases de Wallet | — | parcial | **Marca decidida y cambio app-wide hecho en el commit de cierre de 0032:** UI consumer/merchant, metadata, PWA, notificaciones, Wallet y provisionador Google usan CheckPass Club. Se conservan package names e IDs técnicos históricos por compatibilidad. **Pendiente:** abrir spec para arte final de pases (Google `heroImage` + logo; Apple `strip` + logo/icon + colores), servir assets desde dominio estable y actualizar la Loyalty Class real antes del publishing access. |
| 21 | Wizard de creación + diseño visual de la tarjeta de fidelización | 0027 | hecho | **PRÓXIMA FEATURE — spec CERRADA (2026-08-13), lista para implementar.** Wizard por pasos para crear **y editar** (Puntos: unidades → TOS → preview/activar; Sellos: básicos → diseño de tarjeta → TOS → preview/activar). Diseño de tarjeta (Sellos): fondo 1 + fondo 2 opcional en **degradé lineal de ángulo configurable** + color de borde, **preview en vivo** con `round(target/2)` sellos puestos; reutiliza la imagen de sello de 0026. Las 6 decisiones abiertas cerradas con el owner: **columnas dedicadas nullable** (no jsonb) con checks hex/ángulo a nivel DB (ADR **0030**), defaults derivados de la marca, Puntos sin diseño (columnas `null`). Requiere **migración `0013` aditiva** + `CardPreview` compartido + splits por `file-size` (`use-loyalty-program.ts`, `program-editor.tsx` → `steps/*`). Implementar con protocolo `AGENT-WORKFLOW.md`: rama Neon efímera + revisor independiente antes de `implementada`. |
| 30 | Catálogo de productos del negocio | 0034 | hecho | **IMPLEMENTADA (2026-08-14) con PASS de revisor independiente.** Catálogo de **productos** en `core`: `product`/`product_category`/`product_location` (+ `product_asset_upload`/`_cleanup`) + `currency_code` en `business`. Global por negocio, **visibilidad opt-out por local**; **precio/coste opcionales** (el valor en puntos lo pone el programa por equivalencia); **categorías libres**; **sin estados** (borrado directo); imágenes a R2 (pipeline ADR 0029, DTO sin `*ObjectKey`, test por entidad). Dominio `server/catalog/*`, rutas `api/catalog/**` + `api/public/catalog/[productId]/image`, UI `/backoffice/catalog` + tarjeta de nav. Gates (typecheck 3/3, eslint, prettier, **unit 70**, build 3/3) + **integración Neon 6/6 + 99/99 total** en rama efímera; **migración `0017` aplicada y verificada en prod** (18 migraciones, backfill de moneda por país, `core`/`consumer`/`merchant_auth` intactos). Residual: QA manual del owner en deploy. Falta `git push` a `main` (espera OK del owner). Desbloquea la spec 0030. |
| 47 | **No existe gestión de locales en el backoffice** — el tile «Locales» enruta a un mock | **0061** (cierra la parte abierta de la 0023) | **HECHO (2026-09-09) — implementada con PASS de revisor independiente en 2 pasadas.** 5 gates verdes, **520 unitarios** (venian de 472), **20/20 de integracion Neon**. La 1a pasada dio FAIL y encontro dos cosas que nadie mas habria visto: un comentario citando un test inexistente, y que **la capa HTTP no tenia NINGUN oraculo** (sacar el guard de `GET /api/locations` dejaba 654 tests verdes) → salio `locations-routes.test.ts`. La 2a pasada probo los 4 handlers uno por uno y escribio **3 evasiones nuevas, las 3 cazadas** — la mas valiosa, E3: 401 y 403 correctos pero el dominio recibiendo el `businessId` del body, o sea la escalada de privilegios real, invisible a los status codes. **Falta: migracion `0029` a prod + QA del owner.** Antes de la spec: **spec CERRADA (2026-09-09)** con el protocolo de `AGENT-WORKFLOW.md`. Las 5 decisiones del owner estan tomadas y las consecuencias derivadas confirmadas. Migracion aditiva: columna de estado en `core.location` (`DEFAULT 'active'`, sin backfill) + coordenadas **nulables** en `location` y `location_verification`. **El item load-bearing del DoD es el filtro `status = 'active'` en `assertLocationInBusiness`** (`server/counter/core.ts:78`): sin el, una pestana vieja o un link `?location=<uuid>` en favoritos sigue acreditando y canjeando contra un local archivado, aunque la UI ya no lo ofrezca | **Destapado el 2026-09-09 al alinear docs con el código.** La spec 0023 figuraba `implementada` con **7 de 9 DoD sin marcar**; el árbol confirma que el estado era optimista: `app/backoffice/` no tiene ninguna ruta `locations`, `AddressAutofillField` se usa **sólo** en `app/onboarding/page.tsx`, y `backoffice/page.tsx:80` manda `locations` a `/backoffice/demo/locations` (mock de la spec 0015). O sea: **un local se crea en el onboarding y nunca más se puede editar.** Falta también la procedencia versionada (`location_verification`). La 0023 quedó re-etiquetada `implementada parcialmente` |
| 48 | **`/wallet` no se actualiza en vivo** — hay que cerrar y reabrir el portal para ver el saldo nuevo | **0060** | **spec en `borrador`** (2026-09-09) — 4 decisiones abiertas del owner | Confirmado por el owner en el QA **B1.4**. **No es una regresión ni un olvido:** la spec 0031 sacó la «landing en vivo» de su alcance **explícitamente y sin reemplazo** («si el owner más adelante quiere un resultado en vivo, es una spec nueva — no entra acá»). Hoy el consumidor recibe el push, abre el ícono y ve el saldo viejo hasta recargar |
| 49 | **La clave pública de Geoapify quedó sin restricción de origen** — fix operativo, no durable | — | pendiente (necesita spec) | Para destrabar el CORS (ACAO fijo, un solo dominio) el owner quitó **todas** las Allowed Origins: la clave es hoy usable desde cualquier sitio contra la cuota diaria. El DoD «tokens públicos restringidos por origen» de la 0023 está por lo tanto **falso en producción, a propósito**. Fix durable ya identificado en `CLAUDE.md` (Opción B): proxear el autocomplete por el server del merchant con `GEOAPIFY_API_KEY`, same-origin, la clave nunca viaja al cliente |
| 53 | **Cambio de plan (upgrade/downgrade) + cancelar suscripcion** | ADR **0058**, spec **0063** | **spec 0063 `cerrada` (2 rondas, 4 revisores). EN IMPLEMENTACION: fase A en curso, sin PASS de nadie todavia.** Contratos compartidos escritos y en verde; rama Neon efimera `spec-0063-billing` creada y verificada (la vieja `spec-0055-redeem` estaba borrada). Fases B y C pendientes, serializadas. Orden decidido: va ANTES de campanas | **Decisión del owner (2026-09-10):** al bajar de plan, el usuario tiene que **elegir qué locales siguen activos** para entrar en el tope del plan nuevo; **no se puede hacer downgrade sin llevar primero los locales activos al número que ese plan permite.** Hoy NO hay ningún camino de downgrade en el código —el webhook de Stripe solo hace `plan: "plus"` al completar el checkout— así que no es un bug vivo, es un **invariante que toda futura ruta de downgrade (webhook de cancelación, UI de cambio de plan) tiene que respetar**. Sin esto, un `plus` con 3 locales que cae a `free` queda con 2 por encima del tope y el sistema no sabría cuál dejar. Quedó demostrado en la práctica: A1 está en `plus` con locales de sobra para volver a `free`. **AMPLIADO 2026-09-10 — el owner cerro el alcance completo, esta en el ADR 0058:** una **seccion de gestion de suscripcion** en el backoffice para elegir plan A → B; **upgrade por Stripe Checkout** como hoy, aplicado al confirmarse el pago; **downgrade de bloqueo duro** (sin estado intermedio: si no cumple, no se ejecuta — primero archiva y elige cuales quedan), con bloqueantes **un local activo** + **sin campanas corriendo**; **boton de cancelar suscripcion** que baja a `free` al terminar el periodo pagado; y **el bug del webhook se arregla en este mismo arco**. **Dos hallazgos a decidir, NO acordados con nadie** (detalle en el ADR 0058): (a) el chequeo al apretar cancelar **no** sostiene el invariante, porque mientras siga en `plus` reactivar locales hasta 3 es valido (`locations/store.ts:70` mide contra el plan **vigente**) y al cerrar el periodo queda `free` con 3 activos → hay que sostenerlo tambien en el webhook; (b) la **premisa del ADR 0056 queda invalidada** — no restringio checkout por rol porque «no existe una UI de upgrade posterior», y esta seccion la crea; la ruta no filtra ni rol ni `status` y el staff vive en la misma tabla, asi que un staff **incluso desactivado** podria cambiar el plan (ya estaba anotado como abierto en la fila de la spec 0057) |
| 54 | **El impago bloquea el acceso (backoffice + cuenta + mostrador)** | ADR **0059**, spec pendiente | pendiente (necesita spec; NO entra en la 0063) | **Decision del owner (2026-09-10), nacida de una pregunta abierta de la 0063:** si llega la fecha de cobro y no paga, se esperan **3 reintentos en la misma semana** y despues **se bloquea el acceso** con un modal que pide pagar para rehabilitar. **El plan NO baja y los locales no se tocan** — por eso el «downgrade involuntario» deja de existir y el invariante de locales de la 0063 se sostiene sin tolerar sobre-tope. Disparador = el estado de Stripe (`unpaid`, o `past_due` con `next_payment_attempt: null`), **no** un contador propio. **Va aparte de la 0063 a proposito:** el bloqueo vive en `requireBackofficeSession`, el guard compartido de 8 paginas **y del mostrador** (`backoffice/counter/page.tsx:16`) — un bug ahi deja a TODOS los comercios afuera de su panel, es el radio de daño mas grande del producto. **Chequeo previo obligatorio en Stripe:** el default al agotar reintentos es **cancelar** (lo que haria caer el plan a `free` y el ADR no se cumpliria); la cuenta tiene que dejar la suscripcion en **`unpaid`** (Billing → Manage failed payments). **Estado interino hasta que esta tarea se implemente:** un moroso conserva `plus` y el acceso completo — igual que hoy, no es una regresion; y un negocio en `plan='none'` (sin suscripcion) queda con el tope en 1 pero sigue operando. **AMPLIADA 2026-09-10 (ADR 0058 §12 / 0059 §5): el bloqueo tiene DOS causas con salidas distintas** — impago (`status='unpaid'`, salida = pagar) y **sin suscripcion** (`plan='none'`, salidas = bajar a `free` ajustandose, o pagar). **Requisito que es el mas facil de romper:** el bloqueo **tiene** que dejar pasar `/backoffice/subscription` y `/backoffice/locations`, o el comercio no puede ejecutar sus propias salidas (pagar, o archivar para bajar a free). La **salida** a `free` la entrega la spec 0063 (`settle_to_free`); lo que falta aca es el **bloqueo**. |
| 55 | **Cambio de intervalo anual → mensual** | ADR **0058** §10, spec pendiente | pendiente (recorte explicito del owner el 2026-09-10; NO entra en la 0063) | El owner puso el cambio de intervalo en alcance en las **dos** direcciones y despues lo acoto: «**entregamos mensual a anual, no anual a mensual**». El motivo tecnico esta verificado en la doc del SDK de Stripe: el sentido inverso no tiene forma barata. Hacerlo «ahora» exige **devolver ~11 meses en credito** (el owner excluyo los reembolsos) o usar `proration_behavior: 'none'`, que **no** es «al final del periodo» — «we don't generate any credits for the old subscription's unused time. We still reset the billing date and **bill immediately**» (`cjs/resources/Subscriptions.d.ts:50`), o sea que el cliente **pierde lo que ya pago y se le cobra de nuevo**. Agendarlo al fin del año exige **`subscription_schedules`**, una superficie nueva de la API. La 0063 deja el rechazo explicito (`interval_downgrade_unsupported`, 409) en la **funcion pura**, asi que cuando esta tarea se haga hay un solo lugar donde cambiarlo y ya tiene su fila en la tabla de casos. |
| 52 | **La lista `HANDLERS` de `locations-routes.test.ts` esta hardcodeada: una 5a ruta naceria sin guard con el test en verde** | — | **hecho (2026-09-10)** — barrido por filesystem que deriva `METHOD /path` de cada `route.ts` (las dos ortografias: `export async function` y `export const`), asevera un piso de archivos y exige igualdad exacta con `HANDLERS`. **Probado que muerde:** una ruta falsa `zz-mutation/route.ts` sin guard lo puso rojo nombrandola (`- "GET /api/locations/zz-mutation"`); revertida, 15/15, `file-size` en 0 | Hallazgo MENOR del revisor en la 2a pasada, con el fix ya identificado: un `readdir` que asevere que la lista cubre todos los `route.ts` bajo `api/locations/**`. Hoy los 4 coinciden exacto, asi que no es un defecto vivo. Es la forma de la leccion de la spec 0046 («si sumas un plugin, suma sus paths») y del barrido MIME: un allow-list que no ve una superficie nueva da seguridad que no tiene |
| 51 | **Los 27 archivos `.neon.integration` NO corren en CI: se puede borrar un guard de producción con los 5 gates en verde** | **0062** | **hecho (2026-09-10) — VERIFICADO en la corrida real** `34529269621`: en CI `Tests 678 passed (678)`, **cero skipped**; en local sin Neon `521 \| 157 skipped`. Los 157 que se skipeaban corren. 33 archivos `.neon.integration` en `✓`, ninguno `↓`. Los 3 pasos nuevos `completed / success` por la API de jobs. Integración: 49 s | **Verificado por mutación el 2026-09-09, no argumentado:** con `eq(locations.status, "active")` sacado de `assertLocationInBusiness`, `pnpm run test` da **506/506 VERDE** — el único oráculo es la integración Neon, que se auto-skipea sin `NEON_INTEGRATION_DATABASE_URL` + `NEON_INTEGRATION_ISOLATED`, y `.github/workflows/ci.yml` no las setea. Afecta a TODO el repo, no a la spec 0061. Decisión del owner: si CI corre contra una rama Neon efímera (cuesta plata y hay que manejar secretos) o si se acepta el límite y se documenta |
| 50 | **0058 y 0059 no tienen oráculo de comportamiento** — su única cobertura es un barrido estático de strings | 0058, 0059 | pendiente | **Demostrado por mutación el 2026-09-09, no argumentado:** borrar `setIsAnalyzing(true)` de `use-brand-logo.ts` apaga «Preparando imagen…» para siempre —que es el **DoD #1** de la 0059— y **los 5 gates quedan verdes** (471/471, typecheck, lint), porque `expect(source).toContain("Preparando imagen…")` sólo ve el string en el archivo. Es el patrón de la tarea 38 otra vez. La técnica que lo cierra ya existe en el repo: `login-form-retry.test.ts` (spec 0057) stubea `useState` con `vi.mock("react")`, ~45 líneas y cero paquetes |


## Hecho

| Fecha | Que | Verificado con |
|---|---|---|
| 2026-08-08 | Documentacion de Idea 01: Pasaporte local jugable (web) | Revision del archivo en raiz |
| 2026-08-08 | Refinamiento de Idea 01: Mi Pasaporte, wallet de fidelizacion gamificada | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 02: Humbly, planes por actividad | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 03: servicios confiables para el hogar en Cuenca | Revision del archivo en raiz |
| 2026-08-08 | Comparacion de tres ideas y recomendacion provisional | Revision del analisis y formulas de ingreso |
| 2026-08-08 | Investigacion de referentes y patrones de Mi Pasaporte | Revision de fuentes oficiales, casos y hoja de ruta |
| 2026-08-09 | Investigación de competencia local/nacional de fidelización, QR y promociones | Revisión de sitios y precios públicos de competidores |
| 2026-08-09 | Plan V1, roadmap, ADRs y nueve specs de producto en borrador | Revisión de documentos en `docs/` |
| 2026-08-09 | Protocolo de trabajo con agentes y plantilla de spec reforzada | Revisión de `AGENT-WORKFLOW.md` y plantilla |
| 2026-08-10 | Separación de arquitectura transversal y specs de feature | Revisión de `ARCHITECTURE.md` y spec 0004 |
| 2026-08-10 | Ciclo de vigencia de activos y retención guest definido | Revisión de ADR 0005 y DoD de spec 0004 |
| 2026-08-10 | Alcance de programas, campañas y eventos por negocio definido | Revisión de ADR 0006 y specs 0002/0003 |
| 2026-08-10 | Alcances de permiso y auditoría con snapshots definidos | Revisión de ADR 0007 y spec 0001 |
| 2026-08-10 | Owner definido como único administrador de merchant staff | Revisión de ADR 0008 y spec 0001 |
| 2026-08-10 | Cierre de local y validación de beneficios definidos | Revisión de ADR 0009 y specs 0002/0003/0006 |
| 2026-08-10 | Dominios de acceso de consumidor, plataforma y comercio separados | Revisión de ADR 0010 y spec 0001 |
| 2026-08-10 | Modelo de campañas compuesto mediante Incentive Engine definido | Revisión de ADR 0018 y Spec 0003 rediseñada |
| 2026-08-10 | Handoff para fase de arquitectura | Revisión de `docs/HANDOFF.md` |
| 2026-08-10 | Repositorio remoto canónico documentado y commit inicial local creado | `git log --oneline -1` muestra `6467628` |
| 2026-08-10 | Scaffold instalado y verificado: lockfile, install congelado, format/lint/typecheck, unit 3/3, build 3/3, contrato health exacto + 405, Playwright verde | Comandos corridos con Node 24.19.0 / pnpm 11.4.0 |
| 2026-08-10 | Diseño v0.1 de wallet contextual por comercio | Revisión manual: cover compacto, promoción futura, puntos, cupones, canjes y progreso de Bar Demo |
| 2026-08-10 | Diseño v0.1 de llegada desde QR y check-in | Revisión manual: pantalla simple, beneficios visibles y CTA único con explicación de ubicación |
| 2026-08-12 | Fix de fixture e2e: `seedDemo` con semántica seed-once (clave y tipo importados de la app) | `pnpm test:e2e` 5 passed / 1 skipped; antes fallaba en `loyalty.spec.ts` tras `page.reload()` |
| 2026-08-12 | Programa de fidelización real desplegado (Spec 0024, ADR 0027) | Gates locales (typecheck 3/3, unit 22/23, lint, build 3/3) + QA manual en vivo del owner sobre Vercel |
| 2026-08-12 | Marca real y assets R2 desplegados (Spec 0025) | Gates locales (typecheck 3/3, unit 22/23, lint, build 3/3) + QA manual en vivo del owner sobre Vercel |
| 2026-08-13 | Wizard de creación/edición + diseño visual de tarjeta de Sellos (Spec 0027, ADR 0030) | Gates (typecheck 3/3, lint, unit 33/10-skip, build 3/3) + integración Neon 6/6 + migración 0013 en prod + PASS de revisor independiente + QA manual del owner. Commits `4388662`/`967a080` |
| 2026-08-14 | Pase de Wallet Apple/Google (Spec 0029, ADR 0033, camino A 2ª rebanada) | Dominio `server/wallet/*` (provider apple/google/fake), rutas `wallet/{apple.pkpass,google}` + `/c/[token]` + página `/wallet` (QR SVG + botones). Gates (typecheck 3/3, eslint, unit 60/23-skip, build 3/3) + integración Neon 4/4 wallet + 9/9 regresión 0028 + **PASS de revisor independiente** + migración `0016` aplicada y verificada por SQL en efímera y **en prod**. Commits `4e4ba0b`/`72081e5`. |
| 2026-08-14 | Wallet en prod: Google en Android real + Apple en iPhone real (QA del owner) | Google Wallet (issuer demo gratis, class `approved`, secretos en Vercel) guarda el pase con QR en Android; Apple Wallet (cert Pass Type ID real, Team `SN489AVGUD`, WWDR G4, 5 secretos `APPLE_*`) instala el `.pkpass` en iPhone. Ambos vistos en pantalla por el owner. Setup en `docs/wallet-go-live.md`; secretos locales en `.secrets-apple/` (gitignore + pre-commit hook) |
| 2026-08-14 | Identidad de consumidor y enrolamiento (Spec 0028, camino A 1ª rebanada) | Esquema `consumer` (4 tablas) + rutas `enroll`/`me` + landing; `409 already_member`, rate-limit 3/h por teléfono, `closing` habilitado. Gates (typecheck 3/3, lint, prettier, unit 46/19-skip, build 3/3) + integración Neon 9/9 + **PASS de revisor independiente** + migración `0014` aplicada y verificada en prod (esquema `consumer` 4 tablas/10 índices/3 FK; `core`/`merchant_auth` intactos). Residual: QA manual en teléfono |
| 2026-08-14 | Catálogo de productos del negocio (Spec 0034, ADR 0034) | Dominio `server/catalog/*` + esquema `core` (`product`/`product_category`/`product_location` + upload/cleanup) + `currency_code` en `business`; rutas `api/catalog/**` + imagen pública; UI `/backoffice/catalog` + tarjeta de nav; anti-fuga `*ObjectKey`. Gates (typecheck 3/3, eslint, prettier, unit 70, build 3/3) + **integración Neon 6/6 catálogo + 99/99 total** + **PASS de revisor independiente** + migración `0017` aplicada y verificada por SQL en prod (18 migraciones; backfill de moneda por país; `core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). Residual: QA manual del owner en deploy. Pusheado (`3ca3f98`); enmienda moneda→Marca + UI (`69e04f5`); fix botón (`4ea982a`) |
| 2026-08-14 | Imágenes de stock para productos (Spec 0035, ADR 0035) | Buscador Pexels server-proxied + import a R2 diferido anti-SSRF (allow-list host + `redirect:error` + tope) + atribución persistida; interfaz `StockPhotoProvider` (`pexels`/`fake`). Dominio `server/stock/*`, ruta `api/catalog/stock/search`, modal `StockPicker`. DTO sin `image_object_key`. Gates (typecheck 3/3, eslint, prettier, **unit+integración 106/106**, build 3/3) + **PASS de revisor independiente** + migración `0018` aplicada y verificada por SQL en prod (19 migraciones; esquemas vecinos intactos). Residual: `PEXELS_API_KEY` en Vercel + QA manual |
| 31 | Imágenes de stock para productos (buscador Pexels) | 0035 | hecho | **IMPLEMENTADA (2026-08-14, ADR 0035) con PASS de revisor independiente.** Botón "Elegir de biblioteca" + modal `StockPicker` (buscar on-submit + "cargar más") en el editor de producto; interfaz `StockPhotoProvider` intercambiable (`pexels`+`fake` por `STOCK_PROVIDER`), búsqueda **server-proxied** (`GET /api/catalog/stock/search`, la API key nunca al cliente, 503 sin key), import **por id anti-SSRF** (allow-list `images.pexels.com` + `redirect:error` + tope 5 MB) → `normalizeImage` → R2, diferido a Guardar; atribución persistida (4 columnas en `core.product`, migración `0018`) y mostrada ("Foto de Pexels.com · Autor: X"). DTO sin `image_object_key`. Gates (typecheck 3/3, lint, prettier, unit+integración **106/106** con anti-SSRF unit + atribución→DTO, build 3/3); **migración `0018` en prod verificada por SQL** (19 migraciones; esquemas vecinos intactos). Residual go-live: `PEXELS_API_KEY` en Vercel (owner ya la tiene) + QA manual. Cierra el catálogo (0034+0035). |
| 37 | El icono de inicio de iOS instalado DESDE el enroll abre el form de registro, no `/wallet` | 0050+0051 | hecho (QA en vivo del owner PENDIENTE — es el oraculo del link inyectado) | **HALLAZGO DE QA DEL OWNER (2026-09-05), bug real en prod, NO es de la 0040.** **Sintoma:** instalar "Agregar a inicio" siguiendo el instructivo iOS de la confirmacion del enroll y tocar el icono → cae en el form de registro del programa en vez de la landing `/wallet`. **Causa raiz (verificada en codigo):** el manifest se declara en UN solo lugar, `(consumer)/wallet/page.tsx` (`manifest: "/wallet/manifest.webmanifest"`); la pagina `(consumer)/enroll/[programId]/page.tsx` **no lo declara** (solo tiene `export const dynamic`), pero es donde se renderiza el `IosInstallHint` (`enroll-form.tsx:124`). Sin manifest enlazado, iOS usa **la URL actual** como `start_url` del icono. **Lo que esto anula:** el manifest dinamico calcula `start_url = /c/<webViewToken>` justamente para **re-bootstrapear la sesion** en el PWA standalone de iOS (ADR 0039 §5: iOS le da un cookie jar separado). Instalando desde el enroll —que es EL camino natural, el instructivo esta ahi mismo— ese mecanismo **nunca corre**. **Ojo al especificar:** enlazar el manifest en la pagina del enroll hace que iOS pida `/wallet/manifest.webmanifest` al agregar a inicio; hay que confirmar que la cookie de sesion viaja en ese fetch (si no, `start_url` cae al `/wallet` sin token y el re-bootstrap tampoco pasa). Territorio de las specs 0037/0039, no de la 0040. **AL ESPECIFICAR APARECIO LA CAUSA DE FONDO, PEOR QUE EL SINTOMA (ADR 0048):** un `<link rel="manifest">` se pide **sin credenciales** salvo `crossorigin="use-credentials"`, que prod NO tiene — verificado en el HTML servido. O sea el manifest nunca recibio la cookie, `start_url` cae a `/wallet` **siempre**, y el re-bootstrap por `/c/<token>` del ADR 0039 §5 **nunca funciono, tampoco desde `/wallet`**. Nacio asi; el QA en vivo no lo cazo porque abrir `/wallet` sin sesion se confunde con "todavia no me loguee". Arreglar solo el sintoma habria dejado el icono abriendo `/wallet` sin sesion. **Fix: el token viaja en la URL del manifest (`?c=`)**, no en la cookie. Se descarto `crossorigin="use-credentials"`: falla en silencio hacia el estado roto. **Lo que YA estaba bien y NO se toca:** el instructivo iOS ya vive en `/wallet` y ya es condicional (`qr-tab` → `PushPrompt` → `isIos && !isStandalone`), e `isIosSafariBrowser()` ya detecta standalone por las dos vias. Ver `specs/0050-...md`. **IMPLEMENTADA (2026-09-05) con PASS de revisor independiente A LA PRIMERA.** Tests **310 → 325**. `generateMetadata()` en `/wallet` emite `?c=<token>`; la ruta valida con `resolveWebViewToken` y **ya no lee la cookie ni como fallback**; el enroll perdio el instructivo y gano un CTA a `/wallet`. **El test que importa NO es de lectura:** arma un `NextRequest` real, aseveras `headers.get("cookie") === null`, y el mock de `next/headers` TIRA si alguien llama `cookies()` → contra el codigo viejo explota con `next/headers cookies() must not be read here`. **Probe adversarial del revisor:** 12 payloads (`https://evil.tld`, `//evil.tld`, `%00`, `../../`, `javascript:`, `?c=` repetido, 20 KB) → 14/14 con `start_url === "/wallet"`, cero reflejo; ademas los tokens son `randomBytes(32).toString("base64url")`, asi que el alfabeto guardado no puede tener `"`, `\`, `/`, `.` ni `%`. **Premisa del ADR 0048 confirmada en el fuente de Next 16.3.0** (`lib/metadata/metadata.js:291-297`): `crossOrigin: "use-credentials"` solo con `VERCEL_ENV === 'preview'`. **Trampa cazada por el implementador:** dejar el `PushPrompt` en iOS habria REINTRODUCIDO el instructivo por la puerta de atras (`push-prompt.tsx:121` lo devuelve cuando `isIos && !isStandalone`) — cortocircuitado y pinneado. **RESIDUAL DEL OWNER: QA en iPhone real** — enrolarse, llegar a `/wallet`, agregar a inicio DESDE AHI, abrir el icono → wallet con sesion, y en standalone SIN instructivo. **VEREDICTO DEL QA DEL OWNER (2026-09-05): el MECANISMO funciona (el icono abre el wallet) pero el FLUJO es inaceptable** — obligar a navegar a `/wallet` para recien ahi ver el instructivo agrega dos pasos. Orden del owner: la confirmacion del enroll vuelve a ser el lugar de instalacion, con el icono abriendo el wallet correcto → **ADR 0049 + spec 0051** (el 201 del enroll devuelve `walletManifestPath` y la confirmacion lo inyecta como `<link rel=manifest>`; seguro porque viaja en la misma respuesta que ya setea la cookie de sesion — la sesion se emite SOLO en el 201, verificado en la ruta). **0051 IMPLEMENTADA (2026-09-05) con PASS a la primera, tests 325 → 340.** El 201 devuelve `walletManifestPath` (helper `walletManifestPathFor` compartido con `generateMetadata` de `/wallet`, un solo productor de la forma); `enroll-confirmation.tsx` (split por file-size, 276+88) inyecta el `<link rel=manifest>` solo en "done" con cleanup, y restaura el bloque pre-0050: hint iOS **directo** (desacoplado de VAPID — resuelve la mitad enroll de la tarea 38) + `PushPrompt` Android intacto. **Invariante blindado por mutacion:** path en la rama de error → 5 tests rojos. El revisor confirmo que la sesion del 201 es preexistente y que esa sesion YA leia el token via el HTML de `/wallet` → el campo no amplia poder. 6 tests de la 0050 muertos AUTORIZADOS por la spec §3 (pinneaban el flujo revertido). **RESIDUAL DEL OWNER: QA en iPhone real** — enrolarse → UNA pantalla (felicitacion + instructivo + Apple Wallet) → agregar a inicio → el icono abre MI wallet. Si Safari ignora el link inyectado → plan B del ADR 0049 (confirmacion server-renderizada). |
| 39 | Re-enrolarse con un telefono ya registrado: que hacer con el nombre tipeado | 0053+0054 | hecho (QA en vivo del owner PENDIENTE: ver el toast) | **HALLAZGO DEL QA DE LA 0051 (2026-09-05).** El owner se enrolo como "Logan Wolf" y el pase de Apple salio como "Cliente iOS 4". **Verificado por SQL en prod:** el enroll de las 21:32 UTC creo la membresia sobre la cuenta `+593998877654321`, creada el 2026-08-16 con nombre "Cliente iOS 4" (QA anterior) — `enroll()` reutiliza la cuenta por telefono y el nombre tipeado en el form **se descarta sin avisar**. El pase es fiel a la base (`buildPassJson` arma el titular con first/last de la cuenta y `organizationName/description/logoText = "CheckPass Club"`). **Decision pendiente del owner, 3 opciones:** (a) el re-enroll actualiza el nombre de la cuenta; (b) el form detecta la cuenta existente y muestra "ya tenes cuenta" con el nombre guardado; (c) se deja como esta y se documenta. El arte visual del pase (logo/strip/colores reales en vez del placeholder) ya esta agendado en la tarea 29. |
| 40 | El cropper no aparece con archivos de la GALERIA en iOS (ni siquiera PNG) — falso fallback del probe | 0052 | hecho (QA en vivo del owner PENDIENTE) | **HALLAZGO DEL QA DE LA 0040 EN IPHONE REAL (2026-09-05), con el dato que absuelve a casi todo: con la CAMARA el cropper funciona perfecto; con la galeria (Photo Library) el modal no aparece nunca, ni con un PNG.** O sea: chunk, react-easy-crop, canvas y guard de tipos andan — el falso negativo esta en `canDecodeImage`. Dos quirks conocidos de WebKit como sospechosos: `img.decode()` que rechaza espuriamente aunque `onload` haya disparado con dimensiones reales (y nuestro probe le da veto: `catch → false`), y/o la carga flaky por blob URL de archivos del Photo Library (si no responde, `choose()` CUELGA). Fix por capas en `specs/0052-...md`: decode() pierde el veto, retry con data URL, timeout de 8s, y el probe devuelve el src utilizable para que el cropper consuma el MISMO camino que funciono. **OJO: el dato del ADR 0047 §4 sigue abierto** — el fallback de galeria en iOS era este bug, no HEIC crudo; falta el QA de Android con la 0052 desplegada. |
| 42 | Deuda de cobertura de la 0052: dos lineas del probe sobreviven a la mutacion | — | **hecho (2026-09-05)** — las 2 lineas quedaron con oraculo, cada test probado ROMPIENDO el codigo | **CERRADO.** Los 2 tests van en `lib/crop-image-decode.test.ts` (11 → 13). **(1) Timeout TOTAL:** el camino que las rodajas por paso no cubren es `FileReader` OK + el `<img>` del data URL que nunca contesta — `probeSrc(dataUrl)` (linea 148) se espera **pelado**, sin rodaja propia, asi que `attempt()` no settlea nunca y solo el timeout total lo cierra. **(2) `if (!resolved) cleanup()`:** unica ventana en que la carrera total se pierde con el object URL todavia vivo — `step` tiene piso de 1 ms (`Math.max(1, …)`), asi que con presupuesto 0 el timer total vence ANTES de que `attempt` llegue a su propio `revoke`. **Mutacion verificada in-place (backup + `shasum -c`, sin worktree):** borrar `if (!resolved) cleanup()` → cae **solo** el test (2) (`expected [] to deeply equal [blob:…]`); sacar el `within(attempt(), timeoutMs, null)` → caen **los 2** por `Test timed out` y **ninguno de los 11 viejos**, que es exactamente lo que el revisor habia reportado. **NO se toco `image-decode-probe.ts`** (solo tests). **Las 2 observaciones de UX/costo de la misma revision siguen abiertas y NO se resolvieron aca** (son decision del owner, ver tarea 43): hasta 8 s sin ninguna señal en pantalla, y el fallback real paga un base64 de hasta ~6,7 MB de string antes de rendirse. Notas originales: **HALLAZGO DEL REVISOR DE LA 0052.** Dos lineas de `lib/image-decode-probe.ts` estan **sin oraculo** (borrarlas deja los 15 tests en verde): (1) el **timeout TOTAL** (linea ~154) — las rodajas por paso cubren todo lo testeado, pero el codigo lo necesita igual: el revisor escribio un test scratch del unico camino descubierto (`FileReader` resuelve OK pero el `<img>` del data URL NUNCA contesta, porque `probeSrc(dataUrl)` no tiene rodaja propia) y confirmo que solo el timeout total lo cierra; (2) **`if (!resolved) cleanup()`** (~155), red de seguridad para un exito tardio que perdio la carrera. Sumar esos 2 tests. **Ademas, 2 observaciones de UX/costo de la misma revision:** durante hasta 8s no hay ninguna señal en pantalla mientras el probe trabaja (si el QA del iPhone reporta "tarda y no pasa nada", es esto), y el fallback real ahora paga un base64 de hasta 5 MB antes de rendirse (un HEIC en Chrome hace blob→error, lee ~6,7 MB de string, falla y recien ahi cae al fallback). |
| 43 | El probe de decode no muestra ninguna señal en pantalla (hasta 8 s) y el fallback paga un base64 de ~6,7 MB | — | pendiente (decision del owner) | **HALLAZGO A DECIDIR, NO ACORDADO CON NADIE.** Las 2 observaciones de UX/costo que el revisor de la 0052 dejo junto a la deuda de cobertura, separadas aca porque **no son deuda de tests**: la 42 se cerro y estas siguen abiertas. (1) **Sin señal en pantalla:** entre que el usuario elige la foto y que aparece el modal pueden pasar hasta **8 s** (`DECODE_PROBE_TIMEOUT_MS`) sin spinner ni texto. Es el sintoma exacto que el checklist de QA (`QA-PENDIENTE.md` A2) pide anotar como «tarda y no pasa nada» — si el owner lo reporta, **es esto, no un bug nuevo**. (2) **Costo del fallback real:** un HEIC en Chrome hace blob→error y recien despues lee el archivo entero a base64 (~6,7 MB de string para una foto de 5 MB) para fallar de nuevo. Se paga en el camino que **siempre** falla. Opciones a decidir, ninguna elegida: (a) spinner/texto mientras el probe corre; (b) bajar el presupuesto total; (c) saltear el retry por data URL cuando el `type` del archivo ya es HEIC/HEIF (los unicos que ningun navegador salvo Safari abre); (d) aceptarlo como esta. **Depende del dato del QA A3 (Android)**: si HEIC crudo no llega desde Android, (c) casi no tiene a quien ahorrarle nada. |
| 44 | **El canje no existe: el loop del producto no cierra.** Brecha entre dos specs cerradas, no una regresión | 0055 | **hecho (2026-09-08)** — implementada con PASS de revisor independiente, commit `a9cbf3f`, migracion `0028` aplicada a prod y verificada por SQL, pusheada y **`Vercel: success` para ese sha**. 453 unit + 48 de integracion Neon. Falta solo el **QA del owner** (`QA-PENDIENTE.md`, bloque C1..C8); 3 casilleros del DoD abiertos a proposito por ser comportamiento de UI sin oraculo | **HALLAZGO DEL QA DEL OWNER (2026-09-05), bloque B2, y es el mas importante de la sesion: es el corazon del producto.** El owner reporto que el mostrador solo ofrece venta/venta rapida y que no hay forma de escanear para entregar una recompensa y descontar los puntos o resetear los sellos. **Verificado en el codigo, no de palabra:** `app/api/counter/` tiene solo `resolve` y `grant`; `server/counter/` tiene core/grant/history/orders/resolve y ningun `redeem`; la UI (`counter/stages.tsx`) ofrece exactamente dos acciones, ambas de venta. Los premios SI existen y estan persistidos (tabla `core.loyalty_reward`, migracion `0019`, `loyalty-program/rewards.ts` con validacion por tipo) — o sea el owner **puede configurar** recompensas que **nadie puede canjear**. **LA CAUSA RAIZ, que vale mas que el sintoma: las dos specs se delegaron el canje MUTUAMENTE y ninguna lo construyo.** La spec 0036 §8 dice textual *«La ejecucion del canje es de la 0030»*; la spec 0030 dice en su `resumen` *«Solo acreditacion; el canje es otra feature»* y en el cuerpo *«Descontar puntos / resetear la tarjeta de sellos es otra feature, otra URL»*. **Las dos estan cerradas y las dos son internamente coherentes**: el agujero esta ENTRE ellas, que es donde ningun revisor de spec mira. No es un bug ni una implementacion incompleta. **Nada que decidir todavia: necesita spec propia** (que descuenta, atomicidad e idempotencia como en `persistGrant`, auditoria en `core.order` o tabla nueva, quien puede canjear, que pasa con saldo insuficiente, y el reset de la tarjeta de sellos vs. el decremento de puntos). |
| 45 | En Android el selector de imagen ofrece SOLO galeria, nunca la camara | — | pendiente (necesita decision + spec chica) | **HALLAZGO DEL QA DEL OWNER (2026-09-05), bloque A3, lateral al dato que se buscaba.** En el iPhone el selector muestra «Tomar foto»; en Android solo deja elegir de la galeria. **Verificado en el codigo:** no existe el atributo `capture` en **ningun** archivo del repo (`grep -rn capture apps/merchant/src/app` → vacio). Las 3 superficies usan `accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}`. En iOS, `accept="image/*"` produce el menu nativo con «Tomar foto»; en **Android 13+ Chrome rutea `image/*` al Photo Picker del sistema, que es solo galeria y no tiene camara** — mismo atributo, comportamiento distinto por plataforma. **Efecto colateral ya visible:** el texto de ayuda del catalogo promete *«Podes tomar una foto o elegir una de tu galeria»* (`product-image-field.tsx`, dentro de `{isTouch && …}`), que en Android es **falso**. Fix candidato: un input/boton aparte con `capture="environment"`, decision del owner porque agrega UI a las 3 superficies. |
| 46 | **BUG DE PRODUCCION EN LA ACREDITACION (spec 0030): `persistGrant` puede acreditar DOS VECES el mismo `client_request_id`** | 0056 | **hecho (2026-09-08) — implementada con PASS de revisor independiente, COMMITEADA Y SIN PUSHEAR: el bug sigue vivo en prod hasta el deploy** (no hay migracion; el deploy ES el fix). Evidencia que no genero el modelo: (1) **la carrera se reprodujo sobre `neon-http`** —reponer el `ON CONFLICT` da `points_balance` 40/60/80 donde debe haber 20— asi que la **condicion de reapertura de la spec NO se disparo**: el 23505 aborta y revierte el bump tambien sobre HTTP; (2) `EXPLAIN` del plan real sobre Neon = `InitPlan` + `One-Time Filter` (el ADR 0054 queda demostrado, no argumentado); (3) mutacion roja 4/4 corridas; (4) 5 gates verdes + 15/15 de regresion del dominio counter. **El probe `neon-http` es la mitad DETERMINISTA del oraculo** (con el `ON CONFLICT` puesto el 23505 es imposible → el loop agota los 12 intentos y falla siempre); los 8 races son la mitad probabilistica (cazan entre 3 y 7 de 8): **no borrar ese test por lento**. **Auditoria del DoD: ningun test viejo del dominio ejercia concurrencia** — el "is idempotent by client_request_id" de 0030 era ciego por partida doble (secuencial, y sus dos aserciones —respuesta de la API y conteo de ordenes— son justo las dos cosas que seguian bien con el bug). **Verificacion post-deploy corrida (2026-09-08, commit `a322ac7`, Vercel `success`): 0 filas** — ningun saldo por SQL diverge de la suma de `units_granted` de sus ordenes; el bug no llego a corromper datos reales. Limite declarado en el test: solo cubre `mode: "quick"` — el `detailed` (con rollback de `core.order_item`) lo verifico el revisor a mano, no quedo pinneado | **HALLAZGO DE LA REVISION INDEPENDIENTE DE LA SPEC 0055 (2026-09-07), y REPRODUCIDO A MANO contra la forma real de `persistGrant` en Postgres 17 (Docker efimero, NO Neon, NO prod).** La idempotencia de 0030 descansa en el `NOT EXISTS` del CTE `bumped`, y `orders.ts:66-71` documenta que EvalPlanQual lo re-evalua bajo concurrencia. **Es falso.** El `EXPLAIN` muestra que ese `NOT EXISTS` no correlacionado se planea como **`InitPlan` + `One-Time Filter`**: se evalua UNA sola vez, ANTES de tomar el lock de fila. El guard de saldo si esta en el `Filter` del scan y ese si se re-evalua — por eso el bug pasa desapercibido. **Reproducido:** saldo 100, dos requests concurrentes con el MISMO `clientRequestId`, +40 cada uno → **saldo final 180** con **UNA sola** fila en `core.order` que dice `balance_after = 140`. El `ON CONFLICT DO NOTHING` se traga el segundo INSERT y **oculta el dano**: la API responde 'reintento idempotente, saldo 140' mientras el saldo real es 180. La UI mintea el `requestId` en el escaneo (`counter-console.tsx:90`) y lo mantiene estable, asi que el disparador realista es un reintento de red o un doble submit, no un caso de laboratorio. **FIX VERIFICADO (misma sonda): quitar el `ON CONFLICT (business_id, client_request_id) DO NOTHING`.** El 23505 aborta el statement entero y revierte el bump → saldo 140, 1 orden; y `grant.ts:270` **ya** captura 23505 y re-lee, asi que el camino de reintento no cambia. El reintento SECUENCIAL sigue devolviendo 0 filas sin debitar ni explotar. **Falta:** confirmarlo sobre **neon-http** (la sonda fue Postgres local) y un test de integracion que asevere **el saldo por SQL**, no la respuesta de la API (que en este caso miente). La spec 0055 arrastra el mismo patron al **debito**, donde en vez de regalar puntos los **destruye** — por eso se corrige antes de implementarla. |
| 41 | Re-enroll de teléfono existente abre la sesión de esa cuenta | — | **aceptado temporalmente (ADR 0057)** | Reutilizar la cuenta sin mutarla y enrolarla al nuevo programa es el comportamiento deseado (0054). Se acepta por ahora que el 201 abra su sesión; antes de ampliar este flujo se suma OTP para probar posesión del teléfono. |
| 38 | El instructivo iOS quedo acoplado a que VAPID este configurado + falta guard del manifest en el enroll | — | **hecho (2026-09-05)** — (1) desacoplado y pinneado; (2) YA estaba cubierto, verificado por mutacion | **CERRADO, con una correccion a la nota original.** **(1) Desacople hecho:** en `push-prompt.tsx` el `if (!vapidPublicKey) return null` bajo **debajo** del branch `isIos && !isStandalone`, que ahora se evalua primero. Efecto: si faltaran `WEB_PUSH_VAPID_*`, un iPhone en Safari sigue viendo el instructivo de instalacion **en `/wallet`**, que es la unica superficie que lo alcanza solo via `PushPrompt`. Es el fix candidato que proponia el revisor, tal cual. Pinneado con una tabla de casos sobre una funcion pura (ver abajo); el barrido estatico de `server/enroll-install-hint.test.ts` quedo SOLO para el llamador, etiquetado como proxy. **El guard se rehizo TRES veces y las 3 primeras versiones las rompieron revisores independientes** (detalle y tabla en el bloque de cabecera). La cuarta y definitiva **no es un barrido**: la decision se extrajo a `lib/push-prompt-view.ts` (`choosePushPromptView`, funcion pura que devuelve `"install-hint" | "push-optin" | "nothing"`) y el oraculo es una tabla de casos en `lib/push-prompt-view.test.ts`. `PushPrompt` quedo renderizando el veredicto. Lo que el guard NO cubre esta declarado dentro del propio test, no tapado: el cableado del veredicto (necesita entorno DOM, decision pendiente del owner) y el gateo desde un llamador (proxy etiquetado como tal en `enroll-install-hint.test.ts`, que cuenta las 4 apariciones de `vapidPublicKey` en `qr-tab.tsx`). **(2) La nota estaba desactualizada: el guard del manifest en el enroll YA EXISTE.** Lo agrego la spec 0051 despues de escribirse este hallazgo: `enroll-install-hint.test.ts` barre `enrollTreeFiles()` —que incluye `page.tsx`— y asevera `not.toContain("manifest:")` + `not.toMatch(/rel=["{]"?manifest/)` (las dos ortografias JSX) con piso de 3 archivos. **No se creyo al archivo: verificado por mutacion** — agregar `export const metadata = { manifest: "…" }` a `enroll/[programId]/page.tsx` pone el barrido en rojo nombrando el archivo (`page.tsx: expected … not to contain 'manifest:'`). Notas originales (**OJO: la premisa del item (1) tambien quedo desactualizada por la spec 0051 — donde dice que el usuario de iOS se queda «sin instructivo en ningun lado», leáse «no lo ve EN `/wallet`»; la confirmacion del enroll lo muestra igual**): **HALLAZGOS DEL REVISOR DE LA 0050, no bloqueantes.** (1) **`push-prompt.tsx:82` hace `if (!vapidPublicKey) return null` ANTES del check de `isIos && !isStandalone` de la linea 121.** El codigo que la 0050 borro del enroll renderizaba `<IosInstallHint>` **directo**, y su comentario declaraba ese desacople a proposito ("stands for the portal/pass even when `vapidPublicKey` is null"). Al mover el instructivo a la unica superficie que lo sirve via `PushPrompt`, si faltaran `WEB_PUSH_VAPID_*` el usuario de iOS se queda **sin instructivo en ningun lado**. Hoy no muerde (VAPID en prod desde la 0037) y la spec 0050 prohibia rediseñar `PushPrompt`, por eso no fue FAIL — pero es una dependencia nueva no declarada. Fix candidato: mover el early-return de `vapidPublicKey` DEBAJO del branch de iOS. (2) **Nada pinnea que la pagina del enroll siga sin enlazar el manifest**, cosa que el ADR 0048 dice explicitamente que no debe hacer: un `manifest:` "servicial" ahi reintroduce el bug original. Una linea mas en el barrido de `enroll-install-hint.test.ts` lo cubre. |
| 2026-08-14 | Mecánica de acumulación + premios del programa (Spec 0036, ADR 0036) — **implementada localmente, PASS de revisor, sin commitear** | Programa de fidelización gana mecánica (`accrual_mode`/`accrual_grant`/`accrual_block_amount` + 5 checks en `core.loyalty_program`) y premios (tabla `core.loyalty_reward`: `catalog_product`/`custom`/`discount`, `points_cost`, `position` + 4 checks). Server: `loyalty-program/{accrual,rewards,persistence}.ts`, `validateAccrual`/`validateRewardsInput`/`resolveRewards`, `computeAccrual`=floor(total/Y)×X sin arrastre, `saveProgram` atómico (create=`db.batch`; edit=CTE `updated/logged/deleted/inserted` con reescritura de premios condicionada al guard `status='active'`), DTO `toClientProgram`+`toRewardDTO` con `accrual`+`rewards`+`imagePath`, **sin fuga de `*ObjectKey`**. Wizard: paso mecánica en términos (`accrual-fields.tsx`, ejemplo en vivo), paso premios nuevo (`step-rewards.tsx`, $-equivalente en vivo), métrica de valor en review. Gates **corridos por el revisor independiente**: typecheck 3/3, lint, prettier del scope, **unit 93/36-skip** (+21 nuevos), build 3/3, **integración Neon 10/10** en rama efímera propia del revisor (atomicidad con guard, aislamiento por negocio 422, checks de DB rechazan inválidos, hidratación de programa legacy). Migración `0019_kind_guardsmen` verificada en Neon efímero **y aplicada+verificada en prod por SQL** (20 migraciones; 3 columnas accrual + 5 checks; tabla `loyalty_reward` + 4 checks; `core`(20)/`consumer`(5)/`merchant_auth`(4) intactos). **Único residual: QA manual del owner en vivo. Prerequisito duro desbloqueado para la spec 0030.** |
| 2026-08-14 | QA del owner en vivo sobre spec 0036 — 3 refinamientos de UX del wizard (prod) | (1) Copy del $-equivalente en el paso de premios más claro: recuerda la tasa arriba ("Tu tasa: 100 Puntos por cada BRL 5,00") y cada premio explica el cálculo trazable ("El cliente gasta ≈ BRL 5,00 para juntar 100 Puntos y ganar este premio"), commit `9ce0acc`. (2) Auto-sugerencia del costo en puntos: al elegir/cambiar un producto del catálogo, el costo se re-siembra para que el gasto cubra el precio del producto (`suggestPointsCost` = ceil(price/block)×grant, redondeo al siguiente bloque $Y; editable), commit `7262321` (+6 unit). (3) Preview de valor más potente: venta absoluta por canje en cada premio + reencuadre "Generás un X% más en ventas de lo que regalás" + aviso en rojo si un premio regala más de lo que genera (ratio<1), commit `b779874`. Gates verdes cada vez (typecheck, lint, unit 96/36-skip, build 3/3). Todo UI/derivado; sin cambios de contrato ni datos. |
| 2026-08-15 | Acreditación en mostrador (Spec 0030, camino A 3ª rebanada) — **implementada + PASS de revisor independiente** | Dominio `server/counter/*` + rutas `api/counter/{resolve,grant}` + UI `/backoffice/counter` (scanner `BarcodeDetector`+`jsqr`, detallada/rápida, Confirmar 1-tap). Otorgamiento atómico (CTE guardado `persistGrant`: bump `NOT EXISTS(order)` + `ON CONFLICT DO NOTHING`) e idempotente por `unique(business_id, client_request_id)`; sonda 8-way del revisor = 1 orden, sin doble-bump. Anti-fuga allow-list (test). Gates: typecheck 3/3, lint, prettier, **unit 106/44-skip**, build 3/3, integración Neon **8/8** counter + **25/25** regresión en rama efímera. **Migración `0020_harsh_venus` aplicada y verificada por SQL en prod** (21 migraciones; `core.order`/`order_item` + saldo en `program_membership`; `core`(22)/`consumer`(5)/`merchant_auth`(4) intactos). Paquete `jsqr`. Residual: QA manual del owner en teléfono. Commit local; falta `git push` a `main` (espera OK del owner) |
| 2026-08-15 | **Spec 0030 (acreditación en mostrador) CERRADA con el owner — punto de retorno** | Revisión del doc `specs/0030-…md` (estado `cerrada`, `Abierto` sin bloqueos) + fila en INDEX. **Comportamiento cerrado punta a punta:** consola web móvil `/backoffice/counter` (URL del backoffice, cámara del teléfono, bookmarkable, auth `merchant_auth`) → escanea el QR → resuelve/**auto-enrola** la membresía del negocio (ADR 0033) → toggle **venta detallada** (carrito del catálogo 0034 → total) / **venta rápida** (importe + nota, **inmutable** — sin edición, para no ensuciar la estadística de producto) → `computeAccrual` (0036) → otorga. **4 decisiones del owner ratificadas (2026-08-15):** (1) **solo acreditación**, el canje es otra feature/URL/mecánica (fuera del alcance); (2) la **orden ES el ledger de auditoría** en `core`, **owner-facing** (analítica del negocio, no se expone al consumidor); (3) **idempotencia en dos capas** — DB `unique (business_id, client_request_id)` **+** UI que deshabilita Confirmar al primer tap; (4) **`location_id` siempre registrado** (fijable por `?location` en el bookmark). **Modelo nuevo:** saldo por membresía (`points_balance`/`stamps_count` en `consumer.program_membership`) + `core.order`/`order_item` con snapshot; otorgamiento atómico (CTE 0024/0028). **QR:** `BarcodeDetector` + fallback JS (**re-warm del store de pnpm antes de codear**). **La notificación (paso 6) es la spec 0031** (0030 emite el evento; 0031 entrega + landing en vivo) → **serializar 0031 después de 0030**. Dependencias duras satisfechas (0028/0029/0034/0036 implementadas). **Prod limpio de programas** (crear uno con mecánica para probar). **Próximo paso: implementar 0030** con `AGENT-WORKFLOW.md`. |
| 2026-08-15 | **Spec 0033 (canal de push del pase de Wallet) CERRADA con el owner + ADR 0037** | Revisión de los docs: ADR **0037** (cola `wallet_push_queue` como **outbox transaccional** en el grant de 0030; prioridad `transactional`>`campaign` + cooldown por-consumidor; slot "Última novedad"; dispatch inmediato best-effort + worker de cron) + spec **0033** `cerrada` (`Abierto` sin bloqueos) + filas en INDEX. **Alcance cerrado:** web service PassKit `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log; auth `ApplePass` vs `auth_token_hash`; **rate-limit por serial, no IP**), **APNs JWT ES256 con `.p8` sobre HTTP/2 nativo (sin paquetes nuevos)**, `addMessage`/`PATCH` de Google (mismo service account), `wallet_push_device`, y `rotatePassCredentials` (lo invoca la 0032). Migración aditiva `0021`. **Externo:** owner generó la APNs auth key `.p8` (Apple Developer, Team `SN489AVGUD`, entorno Both, scope unrestricted); faltan 3 secretos `APPLE_APNS_*` en Vercel. **Disjunta: no** (enqueue en `counter/orders.ts` de 0030; serializar 0032/0031). Solo docs, sin commitear |
| 2026-08-15 | **QA en vivo del owner sobre spec 0030 — cerrado punta a punta, cierra el camino A hasta la acreditación** | Owner probó el flujo real sobre el deploy: creó QR de enrolamiento manual apuntando a `/enroll/<programId>` de Fybeca 3, "Test 1 Cliente" se auto-enroló al ser escaneado, venta rápida ($30 → 100 pts) y venta detallada (Café con leche $5 → 10 pts) verificadas por SQL contra prod (saldo final 110, `floor(total/3)×10` exacto en ambas, `order_item` con snapshot correcto). **Cuatro hallazgos de UX resueltos en dos rondas, gates verdes cada vez, pusheadas a `main`:** (1) `eb4c9a8` — toast "Cliente identificado" al resolver el QR (antes saltaba directo al form), preview en vivo no editable de cuántos puntos/sellos otorga la venta actual (mismo cálculo que `computeAccrual`, solo informativo), fix de estilo de los inputs del mostrador (WebKit los pintaba grises sin `background`/`color` explícito, parecían deshabilitados); (2) `610ad31` — se quitó el reinicio automático a los 4s de la pantalla "hecho" (dejaba muy poco tiempo para leer el resultado); ahora es 100% manual vía "Escanear siguiente". Spec 0030 actualizada con la enmienda. **Permiso de cámara repetido en cada ingreso: no es bug del código** — comportamiento propio del navegador (ej. Safari iOS pregunta cada vez salvo que se fije "Permitir" en Configuración del sitio), documentado en el commit, no accionable desde la app. **Con esto la 0030 queda 100% cerrada, sin residuales técnicos.** La notificación al consumidor en su teléfono (paso 6 del flujo) sigue siendo la **spec 0031**, que depende de la **spec 0033** (canal de push del pase de Wallet) como prerequisito técnico. **Próximo paso: cerrar el diseño de la spec 0033 con el owner** (hoy stub/borrador) e implementarla con `AGENT-WORKFLOW.md`. |

| 2026-08-15 | Canal de actualización y push de Wallet (Spec 0033, ADR 0037, camino A 4ª rebanada) — **implementada + doble PASS de revisor independiente** | Cola `wallet_push_queue` (outbox transaccional en el `WITH` de `persistGrant`; rollback→sin fila, retry idempotente→sin dup) + worker `/api/internal/wallet-push` (cron + dispatch inline best-effort) con prioridad transaccional>campaign + cooldown por-consumidor (`planConsumerDrain` puro, reloj inyectable) + claim race-safe (`pending→sending` `UPDATE…RETURNING`) + reaper de filas `sending` huérfanas (`not_before` = deadline de reclamo, `STALE_CLAIM_MS`). Web service PassKit `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve 200/304/log; auth `ApplePass` vs `auth_token_hash` en tiempo constante; rate-limit por serial→429). APNs JWT ES256 con `.p8` sobre HTTP/2 nativo (verificado con la pública en unit), Google `addMessage` (mismo SA), `PushChannel` intercambiable (`fake`). `rotatePassCredentials` (rota `qr_token`+`web_view_token`, borra devices, encola re-emisión; old qr_token deja de resolver). Anti-fuga por entidad (`push_token`/tokens nunca serializados). **Flujo `AGENT-WORKFLOW.md`:** implementador → revisor **FAIL** (worker sin test ejecutable + sin reaper) → corrección → **re-review PASS**. Gates: typecheck 3/3, lint, prettier, **unit 118**, build 3/3 + **integración Neon 21/21** (worker 6 + wallet-push 6 + wallet 4 + counter 5) en ramas efímeras. **Migración `0021` aplicada y verificada por SQL en prod** (22 migraciones; 3 col nullable + 2 tablas + índices/checks; `consumer` 5→7; `core`(22)/`merchant_auth`(4) intactos). Residual: 3 secretos `APPLE_APNS_*` en Vercel + QA Android/iPhone real. Commit local; falta `git push` (espera OK del owner) |

| 2026-08-15 | QA en vivo del owner sobre la 0033 (push del pase) — 3 fixes en prod + spec 0037/ADR 0038 abiertos | (1) **Deploy en Vercel Hobby**: el cron `*/5` de `wallet-push` era el 3º y sub-diario → Hobby rechazaba el deploy entero (máx 2 crons, solo diario), Production clavado en el commit previo. Fix: se quitó el cron nativo de `vercel.json`; el push del momento se dispara **inline con `after()`** (Next 16, no lo congela Vercel) y la red de reintentos la cubre un **scheduler externo gratis** (`.github/workflows/wallet-push-cron.yml` o cron-job.org) contra el endpoint ya autenticado por `CRON_SECRET`. Al pasar a Pro se re-agrega el cron nativo. Commit `d345263`, deploy **verde**. (2) **Google `addMessage` con `messageType: TEXT_AND_NOTIFY`** (sin eso agrega el aviso al pase en silencio, sin notificación). Commit `8566ca9`. (3) **Mensaje como frase completa** "Se acreditaron X puntos en tu cuenta 🎉" (antes "+X puntos"). Commit `3758a94`. Verificado por SQL en prod: 2 grants → cola `sent`, `attempts=0`, `last_error=null`; notificación llegó al Android real del owner. **Límite de Google confirmado:** el banner de Android es genérico ("Mensaje nuevo / Presiona para ver el pase"), el emisor no controla ese texto (el aviso rico va dentro del pase); en iOS el `changeMessage` sí se ve en la notificación. Eso motivó la **spec 0037 (Web Push, solo Android) + ADR 0038** (dos transportes wallet/browser). Gates verdes cada commit (typecheck 3/3, lint, unit 118, build 3/3) + integración 21/21. |

| 2026-08-15 | QA en vivo del owner del push de Wallet (0033) VALIDADO en iOS + Android + fix del token estable (PASS de revisor) | **iOS (iPhone real):** con pase fresco, push al instante + "Última novedad" con texto rico "Novomundo: Se acreditó 1 sello en tu cuenta 🎉". **Android real:** ídem vía Google (`TEXT_AND_NOTIFY`). La latencia de un 2º push seguido = throttling de background de APNs (Apple), no bug. **Bug encontrado y arreglado production-grade:** el `authenticationToken` se re-acuñaba en cada emisión/serve → re-agregar el pase divergía el hash guardado del token instalado → **401** → iOS no podía tirar el pase (quedaba "—"). Fix: token **estable por pase** (`wallet_pass.auth_token`, migración aditiva **`0022`**, generado una vez en `ensureWalletPass`, reusado en emisión/serve, re-mint eliminado; `authorizePass` en tiempo constante + fallback legacy + backfill hacia adelante). Implementador + **revisor independiente PASS**; gates (typecheck 3/3, lint, prettier, **unit 130**, build 3/3) + integración Neon **17/17** en ramas efímeras (incluye test de estabilidad re-emisión). **Migración `0022` aplicada y verificada por SQL en prod** (23 migraciones; `auth_token` presente; `core`(22)/`consumer`(7)/`merchant_auth`(4) intactos). Enmiendas de observabilidad previas del QA: last_error de APNs/Google registrado; frase completa; `TEXT_AND_NOTIFY`. Ramas efímeras auto-expiran 2026-08-18. Residual menor (revisor): pase legacy que no aplique el backfill se re-agrega una vez. |

## Descartado (y por que)

Los caminos descartados importan: sin registro, se reintentan.

| Que | Por que no |
|---|---|

### REVISION DE LA D2, EN VUELO: EL FIX DE S7 TIENE UN HUECO MEDIDO (fila R3)

Bitacora viva del revisor: **`/tmp/revision-d2.md`** (se escribe fila por fila; sobrevive a la muerte de la sesion).
Baseline suyo: los 4 archivos del alcance **66/66 VERDE**. Lleva 4 filas ejecutadas, todas del FOCO 1 (S7).

- **R1 confirma el diagnostico del implementador y ademas prueba que el markup era proxy:** con la pagina bajando la
  fila cruda, el test nuevo da ROJO con asercion literal sobre las claves (`stripeCustomerId`,
  `stripeSubscriptionId`, `downgradeRequestedAt`) — **y el test del HTML queda VERDE**. O sea que el render, que la
  spec pedia justo para cerrar el cableado, no ve la fuga.
- **R3 ES EL HALLAZGO: el fix NUEVO tampoco cierra la propiedad.** Pasando las claves dentro de un **`Map`**
  (`leak={new Map([["customer", row.stripeCustomerId]])}`) la suite da **6/6 VERDE**. Causa medida:
  **`JSON.stringify` de un `Map` devuelve `{}`, pero el serializador Flight de React SI manda Map/Set.** El guard
  mira el stringify, no lo que viaja. **Preimagen conocida, o sea proxy — la 2a vez que S7 se cierra con algo que
  parece cubrir la propiedad y no la cubre.** Las otras dos evasiones (objeto plano anidado R2, elemento React R4)
  si muerden.
- **Pendiente del encargo:** rehacer R10, cerrar S7 (decidir FAIL vs limite acotado, y si el fix correcto es
  inspeccionar con el serializador real en vez de `JSON.stringify`), las **dos salidas** del estado muerto juntas,
  el **limite S9** intentandolo, los **dos archivos en 300 exactas**, y el barrido de docblocks.

### LA 8a MUERTE DEJO UNA MUTACION PUESTA, Y EL PUNTO DE RETORNO FUNCIONO

El revisor murio con **R10 puesta** en `app/backoffice/subscription/subscription-console.tsx:223` — `from:
"subscription"` borrado del body del checkout. **Archivo untracked: `git checkout` no revertia nada.** Restaurado
desde su `/tmp/d2-clean/` con el protocolo entero: el `diff` mostro **exactamente una linea** y el `shasum` quedo en
`fb793cbd6fdca6a8c580067b419ba883f22f8dd1`, **identico al baseline que el propio revisor habia registrado** — eso lo
convierte en verificacion y no en apuesta. Las dos copias independientes (`/tmp/d2-clean/` y las `/tmp/limpio2-*` del
implementador) coinciden en hash. `grep -rn MUTATION apps/merchant/src` vacio.

**EL COSTO NO FUE EL ARBOL, FUE LA MEDICION: R10 se ejecuto y su resultado se perdio**, porque la bitacora se escribia
DESPUES de medir. Se rehace, no se transcribe de memoria. Y R10 importa: el docblock de al lado afirma que sin ese
`from` «el que paga aterriza en la home del backoffice» — si queda verde, es otro invariante declarado sin oraculo.

### SI ESTA SESION SE CAE CON UNA MUTACION DEL REVISOR PUESTA — COMANDO EXACTO, NO RECONSTRUIR NADA

El revisor esta midiendo AHORA, asi que el hook `no-mutations-left.sh` puede cazarle una mutacion **viva**. **El hook no
distingue «viva» de «abandonada»; vos si.** Si el revisor sigue trabajando: verificar que este etiquetada
(`MUTATION <id> (revisor)`) y **NO revertirla** — cortarla bajo un agente vivo lo hace transcribir un resultado falso,
que es peor que el rojo que el hook previene. Si el revisor esta muerto, restaurar:

```
cd /Users/maxi/claude-workspace/check-point
D=/tmp/d2-clean; A=apps/merchant/src
# 1) SIEMPRE diff primero: lo unico que debe irse es la mutacion
diff $D/app_backoffice_subscription_subscription-console.tsx $A/app/backoffice/subscription/subscription-console.tsx
# 2) restaurar y 3) verificar el shasum contra la tabla de abajo
```

| copia limpia en `/tmp/d2-clean/` | destino bajo `apps/merchant/src/` | `shasum` limpio |
|---|---|---|
| `app_backoffice_subscription_page.tsx` | `app/backoffice/subscription/page.tsx` | `d758744b279082e590f00a7022c1f266e4a086c7` |
| `app_backoffice_subscription_subscription-console.tsx` | `app/backoffice/subscription/subscription-console.tsx` | `fb793cbd6fdca6a8c580067b419ba883f22f8dd1` |
| `app_backoffice_subscription_cancel-dialog.tsx` | `app/backoffice/subscription/cancel-dialog.tsx` | `636163ef84f9ee96573487d163caa59fdcd39dfc` |
| `app_components_confirm-dialog.tsx` | `app/components/confirm-dialog.tsx` | `67f6441fedd2b0e8a32b8f943bb553ec889fd385` |
| `app_onboarding_page.tsx` | `app/onboarding/page.tsx` | `6749abe6e5a73d572deb1022c1fbf5c9e2a655b8` |
| `server_billing_view.ts` | `server/billing/view.ts` | `e64fa56babc1935d840a27332d5f58a66ef21427` |

**Hashes RE-MEDIDOS al escribir esta tabla** (no copiados de un mensaje anterior: un baseline podrido hace que la
sesion fresca vea un mismatch y concluya «quedo una mutacion», el sintoma exacto que la auditoria existe para
descartar). Los cuatro primeros y `view.ts` son **untracked o modificados**: `git checkout` no sirve — sobre `??` no
revierte nada y sobre ` M` se lleva tambien el trabajo no commiteado.

### EL HOOK CAZO UNA MUTACION VIVA (R9) Y NO SE TOCO — EL CASO QUE `CLAUDE.md` DESCRIBE, EN VIVO

Al cerrar el turno, los tres hooks del Stop se quejaron a la vez de `app/backoffice/subscription/page.tsx`:
`no-mutations-left` vio `// MUTATION R9 (revisor): la lectura del estado SIN lockBusiness`, y `verify` tiro **lint
rojo** (`'lockBusiness' is defined but never used`). **Era R9 VIVA: el revisor estaba midiendo el limite S9 justo en
ese archivo** — el limite que se le pidio verificar INTENTANDOLO en vez de leyendolo.

**No se reverto ni se «arreglo» el lint, y esa fue la decision correcta por dos motivos, no uno:** (1) cortar una
mutacion bajo un agente que mide lo hace transcribir un resultado falso; y (2) el fix «obvio» del lint era **borrar el
import de `lockBusiness`**, o sea meter un bug real —la pagina leyendo sin lock— mientras se tapaba la medicion. **El
rojo de lint no era un defecto: era la mutacion.** Se confirmo que estaba **etiquetada y atribuida** antes de decidir,
y que el agente estaba `running` (no abandonado) — esa es la distincion que el hook no puede hacer y el orquestador si.

**Desenlace: el revisor la revirtio solo, y verificado contra el baseline** — `shasum` de `page.tsx` en
`d758744b279082e590f00a7022c1f266e4a086c7`, `diff` contra `/tmp/d2-clean/` **vacio**, `grep MUTATION` vacio, y **lint
VERDE re-corrido**. O sea que los tres reclamos del hook eran una **foto vieja** de un arbol que ya estaba limpio.

**REGLA OPERATIVA: ante un reclamo del Stop hook sobre una mutacion, el primer comando no es `git checkout` — es
preguntar si el subagente esta VIVO** (`ListAgents`) y **re-leer el archivo**, porque entre que el hook corre y que vos
lees pueden haber pasado los dos: que la mutacion ya no este, o que siga viva y midiendo. Las dos respuestas prohiben
tocarla; ninguna se sabe sin mirar.

### EL LIMITE S9 ESTA FALSIFICADO, Y LO CERRO UNA SONDA DE ~50 LINEAS SIN INSTALAR NADA

El implementador declaro S9 como limite aceptado: la pagina lee el estado sin lock y «solo lo pinnearia una carrera;
el bloqueo duro es el 409 de la ruta, que ya tiene oraculo». **Falso, y el revisor lo demostro ESCRIBIENDOLO** — el
patron exacto de la spec 0057, tercera vez en este repo:

- **R9** (`readBillingState` sin `lockBusiness`, alcance 66 tests): **VERDE 66/66.** Reproduce lo que el implementador
  declaro — ningun test del alcance lo pinnea. Ahi terminaba su analisis.
- **La sonda de carrera** (`zz-race-probe.neon.integration.test.ts`, ~50 lineas, **0 paquetes nuevos**, 4,2 s): un
  escritor en vuelo toma `lockBusiness`, escribe el `SET` de `settle_to_free` y **retiene el commit 1,5 s** mientras el
  render arranca en paralelo. **Con el lock: VERDE 1/1. Con R9 puesta: ROJO 1**, literal
  «expected '<main class="merchant-shell">…' to contain 'Tu suscripción terminó'». O sea: **sin lock la pagina
  renderiza —y ofrece operaciones sobre— un estado que una operacion ya commiteada superó.**

**El lock es load-bearing Y TIENE ORACULO POSIBLE: el limite no era real, era el intento que no se hizo.** Falta
decidir con el revisor si la sonda se promueve a test del alcance (y en que archivo, porque los dos candidatos estan
en 300 exactas).

**Y la sonda se auto-cazo un rojo por el motivo equivocado, que es la otra mitad del merito:** su primera version
aseveraba `not.toContain("Plan Plus")` y daba **ROJO con el lock puesto** — porque la tarjeta de upgrade lleva
`aria-label="Plan Plus"`. Lo encontro **leyendo la asercion**, no viendo el color. Sin eso, la fila habria concluido
«sin lock se rompe» desde un rojo que hablaba del setup.

**R8 bis** cerro la fila que faltaba: con el `catch` ancho sacado, el literal `Error: Stripe no contesta` se propaga
fuera del render → **el render MUERE en vez de degradar**, y la asercion habla de la propiedad.

### DOS COSAS QUE NO PUEDEN SOBREVIVIR A LA REVISION (y una el hook NO la ve)

1. **`apps/merchant/src/server/zz-race-probe.neon.integration.test.ts` es SCRATCH y debe borrarse al cerrar.** Esta
   auto-documentado como tal en su encabezado, pero **`no-mutations-left.sh` es CIEGO a el**: ese hook solo grepea la
   etiqueta `MUTATION`, asi que **un archivo-sonda entero puede sobrevivir a la sesion sin que ningun gate chille** —
   es andamiaje sin tarea, justo lo que `CLAUDE.md` prohibe. Queda anotado aca porque el doc es el unico guard que
   tiene.
2. **R10 esta PUESTA otra vez en `subscription-console.tsx:223`** (`{ interval: billingInterval }`), etiquetada y con
   el revisor `running`: **es la re-ejecucion que se perdio en la 8a muerte. NO TOCARLA.** Si esta sesion muere, la
   tabla de restauracion de mas arriba tiene el comando y el `shasum` limpio (`fb793cbd…`).

**PENDIENTE ESTRUCTURAL (mistake→rule, a hacer CUANDO CIERRE LA REVISION, no antes):** extender
`no-mutations-left.sh` para que tambien vea **archivos-sonda scratch** (untracked bajo `apps/*/src` con `SONDA` o
`SCRATCH` en las primeras lineas). Verificado leyendo el hook: hoy grepea **solo** `MUTATION|MUTACION` — y lo declara
en su propio encabezado, honestamente. **No se toca ahora a proposito:** con el revisor midiendo, la sonda esta
legitimamente viva y el hook nuevo bloquearia cada turno hasta que termine. Al implementarlo, correrlo contra un
estado que **debe** bloquear y verificar el `exit 2` **y** el mensaje — un `exit 0` puede significar «paso» o «nunca
miro nada».

## VEREDICTO DE LA REVISION DE LA D2: **FAIL** — 3 BLOQUEANTES, 7 MENORES

**La revision SI se completo, aunque el agente murio sin devolver su mensaje final (9a muerte): el veredicto entero
esta en `/tmp/revision-d2.md`, escrito fila por fila.** Eso es exactamente para lo que existe la disciplina de bajar a
disco — el artefacto sobrevivio a la muerte que se llevo el contexto. **Muerte LIMPIA, verificada por el
orquestador:** `grep MUTATION` vacio, las dos sondas scratch (`zz-race-probe`, `zz-click-probe`) **borradas por el
propio revisor**, y los 6 archivos de `/tmp/d2-clean/` **byte-identicos** al baseline (`diff` vacio en los 6).

**Gates del revisor:** `test` con integracion **124/910, 0 failed, 0 skipped** (1 corrida completa + 16 dirigidas);
`typecheck --force` 3/3 `0 cached`; `lint` y `format:check` verdes. **`build` NO re-corrido, y lo declara:** el arbol
quedo byte-identico al estado en que el orquestador lo corrio `--force` 3/3. Es un limite declarado **correctamente**,
con el hash como respaldo.

### LOS 3 BLOQUEANTES

1. **S7 NO ESTA CERRADO: el fix tiene una preimagen IDIOMATICA.** Ya se sabia que un `Map` lo evade (R3). **R12 es
   peor: `leak={Promise.resolve(row)}` deja 6/6 VERDE — y ese es el idiom de Next 15**, la propia pagina recibe
   `searchParams` asi. Flight serializa promesas; `JSON.stringify` de una promesa da `{}`. O sea que el guard mira el
   stringify y no lo que viaja. **Tercera vuelta de S7 y la tercera vez que el cierre es un proxy.**
   **Fix ya verificado por el revisor: allow-list POSITIVA de las 8 props de la consola (9 lineas con prettier)** —
   mismo patron que la spec ya exige para el DTO de R2. Muerde con R3 **y** con R12.
   **Residual R13, razonado y NO ejecutado —hay que ejecutarlo—:** un `Map`/`Promise` **anidado dentro de una prop
   permitida** no lo caza ni la allow-list ni el stringify. El cierre completo pide ademas **rechazar valores
   no-planos dentro de las props**.
2. **R6: `ignored` contando como CONFIRMADO deja 13/13 VERDE.** Lo afirman el docblock de `reconcileOnOpen` y la
   decision 6 de la spec; nada lo pinnea.
3. **R10: el `from: "subscription"` de la consola no tiene oraculo (38/38 VERDE), y el limite que lo justificaba es
   FALSO.** El implementador declaro «lo unico que lo cerraria es simular el click»; la **sonda del click** del
   revisor (`vi.mock("react")` sobre `useState`, se camina el arbol que devuelve `SubscriptionConsole(props)` y se
   **invoca** el `onClick`; **0 paquetes nuevos, sin jsdom, 35 ms**) muerde con R10 **y** con R11. Cierra **las dos
   mitades**: que el modal abra y que el body lleve el `from`. **Es la spec 0057 por cuarta vez.**

### LOS 7 MENORES (ninguno se cierra sin oraculo o sin declaracion explicita)

4. **S9 aceptado sin intentarlo** — la sonda de carrera discrimina (ver seccion propia).
5. **`billing-view.test.ts` afirma «el CABLEADO lo pinnea el render y solo el» — es FALSO por la propia medicion S7
   del implementador.** Un docblock mentiroso no es pasivo: induce el error.
6. **R19: el body del onboarding no tiene oraculo (66/66 VERDE)** — ningun test importa ese modulo y el test «la D1 no
   rompio el ALTA» **transcribe el body A MANO**, o sea que pinnea la copia, no el codigo.
7. **R18: la afirmacion de accesibilidad del `confirm-dialog`** (la trampa de foco con `[href]` y sin botones
   `disabled`, «no por casualidad») **no tiene oraculo ni declaracion** — 31/31 VERDE.
   **→ CERRADO en la SESION A (2026-09-12): `confirm-dialog-focus.test.ts`, y R18 lo pone ROJO. El «limite declarado»
   con el que se habia cerrado este item era FALSO — no se habia intentado.**
8. **La consola imprime «Plan Sin plan» para `none`**, el string exacto que la home dejo de imprimir por la decision
   3. Medido: la primera sonda aseveró `toContain("Plan Sin plan")` y **paso**.
9. **«SALIDA 2» postea a `/api/billing/cancel` pero ejercita `SETTLE_FREE`:** son la misma funcion solo por
   `settle-free/route.ts:24` (`export const POST = downgradeToFree`). **Aliasing que el test no enuncia ni pinnea** —
   es el hallazgo del alias de la D1 otra vez.
10. **TRES archivos en 300 exactas.**

### CORRECCION DE UN NUMERO QUE EL ORQUESTADOR YA HABIA RELATADO: SON TRES, NO DOS

Se reporto «dos archivos en 300 exactas»; **son TRES**: `billing-offers.test.ts`, `billing-reconcile-page.neon…` y
**`billing-store.neon.integration.test.ts`**, que se paso porque es un archivo **modificado** (ya estaba en 300 antes
del residual R2) y solo se midieron los dos nuevos. **Re-medido AL HOOK, con control:** los tres `EXIT=0` a 300
lineas, `LIMIT=300` en `file-size.sh`, y el control (`onboarding/page.tsx`, 469) da `EXIT=2` → el hook discrimina.
**Cero margen en los tres: una linea mas y bloquea.**

### DECISION DEL ORQUESTADOR SOBRE EL CORTE (era su llamado, y el revisor lo delego bien)

`CLAUDE.md` manda **dividir, no extender**. Dos de los tres fixes aterrizan en archivos sin margen, asi que:

- **El oraculo de R10 va a un ARCHIVO NUEVO** (la sonda del click promovida, p.ej. `billing-console-click.test.ts`).
  No toca ningun archivo en 300 y es el corte mas barato que existe.
- **`billing-reconcile-page.neon.integration.test.ts` se PARTE por tema, no por linea:** sus 7 `it` se apoyan en ~93
  lineas de setup compartido, asi que **el setup se extrae a `billing-pages-support.ts`** (89 lineas, tiene margen) y
  **las dos SALIDAS del estado muerto (D8 lineas 214+ y D10 lineas 241+) mas el ALTA del onboarding (276+) se mudan a
  un archivo propio** — queda `reconcile`-especifico lo de 94-172, y **las dos salidas juntas en un archivo que las
  nombra**, que es justo el FOCO 2 que ningun revisor habia visto junto. El oraculo de R6 entra en el que queda.
- **`billing-store.neon…` y `billing-offers.test.ts` no se tocan en este delta** (ningun fix cae ahi). Quedan
  anotados: **lo proximo que les sume una linea decide su corte ANTES de escribirla.**

## DELTA DE CORRECCION DE LA D2 — HECHO POR EL ORQUESTADOR, 5 GATES VERDES, 8 MUTACIONES EJECUTADAS (2026-09-12)

**Por que lo hizo el orquestador:** el implementador del delta murio (10a muerte) **limpio y con el bloqueante 3
cerrado** (`billing-click-probe.test.ts`, 4/4, M1/M2/M3 muerden con asercion literal; bitacora en
`/tmp/delta-d2.md`). Con diez agentes muertos y el owner esperando, seguir despachando era el camino lento.

### Que cerro cada hallazgo

| # | hallazgo | cierre | oraculo ejecutado |
|---|---|---|---|
| B1 | S7 proxy (Map R3, Promise R12, anidado R13) | `billing-pages.neon…`: **allow-list positiva de las 8 props** + **`nonPlainPaths`** (recorre hasta el fondo y rechaza Map/Set/Promise/Date/instancias, devolviendo EL CAMINO) | **R3 y R12 ROJO** «expected [ Array(9) ] to deeply equal [ Array(8) ]»; **R13 ROJO** «expected [ 'props.offers.leak: [object Map]' ] to deeply equal []»; **R13b (Promise anidada) ROJO** idem. Los otros 2 archivos que renderizan quedan verdes (no inspeccionan props): alcance escrito |
| B2 | R6 `ignored` sin oraculo | test nuevo en `billing-reconcile-page.neon…`: suscripcion AJENA viva sobre fila viva → `foreign_subscription` → `ignored` → aviso y fila intacta (premisa verificada en `applicability.ts:94-99`) | **R6 ROJO** «to contain 'No pudimos confirmar tu suscripción c…'» — 1 rojo en el archivo que lo pinnea, los otros 2 verdes |
| B3 | R10/R11/R19 cableado del click | `billing-click-probe.test.ts` (del implementador) | M1/M2/M3 ROJO con asercion literal (ver `/tmp/delta-d2.md`) |
| m4 | S9 sin intentar | **carrera promovida** a `billing-dead-state.neon…`: escritor toma `lockBusiness`, escribe `settleToFree`, retiene el commit 1,5 s; el render arranca en paralelo | **R9 ROJO** «not to contain 'Bajar a Free'» (sin lock la pagina ofrece bajar un plan que ya bajo); con lock VERDE |
| m5 | docblock falso de `billing-view.test.ts` | corregido: el cableado lo pinnea la inspeccion de props, NO el render | — (docblock) |
| m6 | body del onboarding a mano | el probe lo pinnea (M3); el test del ALTA ahora lo dice | M3 ROJO |
| m7 | R18 accesibilidad del `confirm-dialog` | ~~LIMITE DECLARADO en el docblock, acotado a la interaccion del Tab~~ **EL LIMITE ERA FALSO y no se habia intentado: `confirm-dialog-focus.test.ts` lo pinnea con el DOM que `next` ya bundlea (SESION A)** | R18 → ROJO |
| m8 | «Plan Sin plan» | consola: `offers.noPlan ? offers.plan : \`Plan ${offers.plan}\``; asercion `not.toContain("Plan Sin plan")` en SALIDA 1 | **M8 ROJO** «not to contain 'Plan Sin plan'» (5 archivos que importan la consola: 1 rojo) |
| m9 | alias `cancel`/`settle-free` no enunciado | SALIDA 2 llama **`CANCEL`** (el endpoint que las offers dan a un `plus` muerto) y pinnea `expect(SETTLE_FREE).toBe(downgradeToFree)` + `offers.downgrade.endpoint === "/api/billing/cancel"` | **ALIAS ROJO** «expected [Function POST] to be [AsyncFunction downgradeToFree]» (5 archivos que importan la ruta: 1 rojo) |
| m10 | tres archivos en 300 | `billing-reconcile-page.neon…` **partido por tema** → `billing-dead-state.neon.integration.test.ts` (las 2 SALIDAS + ALTA + carrera S9); reconcile queda en **214** | tamaños al hook abajo |

**Un ajuste al corte decidido:** «extraer el setup al support» NO era posible — los `vi.mock` no pueden vivir ahi y
las paginas tampoco (ciclo de imports que cuelga la coleccion, documentado en el support). El corte real fue mover el
segundo `describe` a un archivo propio con su preambulo repetido, que es el patron que ya usan los otros dos.

### Gates sobre el arbol FINAL (byte-identico al medido: hashes abajo)

- **`test` con integracion: 126 archivos / 916 tests / 0 failed / 0 skipped** (venia de 124/910: +2 archivos —
  `billing-click-probe`, `billing-dead-state`— y +6 tests; ninguno preexistente perdido).
- **`typecheck --force` 3/3 `0 cached`. `build --force` 3/3 `0 cached`.** `lint` y `format:check` verdes.
- `grep -rn MUTATION apps/merchant/src` vacio; ninguna sonda `zz-*`.

**Tamaños AL HOOK post-prettier, control `onboarding/page.tsx` → `EXIT=2`:** pages.neon **294**, reconcile-page
**214**, dead-state **234**, console **274**, page.tsx **203**, view.test **234**, confirm-dialog **128**,
click-probe **285**, **offers.test 300 y store.neon 300 (intactos, cero margen — siguen anotados)**.

**Hashes limpios RE-MEDIDOS (baseline para la proxima auditoria):** `page.tsx` `963efe9ce5e80a627c22cc634ff487a9b9439cd7`
· `subscription-console.tsx` `82388cbb16f4fe279469b84b7513c4e20fef377d` · `settle-free/route.ts`
`eeaa9e0cbe64281c0463d53451d117d2e5377bf3`. Copias en `/tmp/fix-d2-base/`.

**QUEDA:** PASS del revisor del delta → commit → (D3 pendiente de la spec) → migracion `0030` a prod. Nada pusheado.

### LOTE 3 DEL DELTA (2026-09-12, tras la 11a muerte): EL REVISOR ENCONTRO E2 Y SE CERRO POR VALOR EXACTO

El revisor del delta murio **limpio** (arbol byte-identico, sin mutaciones ni sondas) y con bitacora en
`/tmp/revision-delta-d2.md`. Antes de morir construyo un **oraculo de que manda Flight de verdad** (sonda
`/tmp/flight-probe.cjs` sobre `react-server-dom-webpack`): manda Map/Set/Promise/TypedArray/getters/toJSON/strings;
NO manda props extra de arrays, claves Symbol ni no-enumerables. Con eso midio dos evasiones nuevas:
- **E1** (array con prop extra bajo `offers`): VERDE — **limite, no fuga** (Flight no lo manda).
- **E2 — RESIDUAL REAL: un secreto CODIFICADO (base64) bajo la clave permitida `notice` pasaba la allow-list de claves,
  `nonPlainPaths` y el substring, y Flight SI lo manda.** Tercera preimagen de S7, y la mas obvia en retrospectiva:
  todo guard por forma o por substring tiene una preimagen por transformacion.

**Cierre (orquestador): las 8 props se pinnean POR VALOR EXACTO con `toEqual` del objeto entero** (subscription
literal, `offers` via la funcion pura, y los 6 escalares con su valor sembrado). Contra eso no hay clave de mas, valor
de mas ni transformacion que pase. `nonPlainPaths` se conserva por el mensaje (dice el camino) y se movio a
`billing-pages-support.ts` para no pasar de 300. **Ejecutado contra el fix, alcance 3 archivos (15 t):**
- **E2 → ROJO 2** (`- "notice": null` / `+ "notice": "Y3VzX0UyX3NlY3JldG8="`; el 2o rojo es el test del `?done=`, que
  ya no ve su texto — honesto, es la misma mutacion).
- **E1 → ROJO 1** (`+ "leak": []`) — lo que era limite ahora tambien muerde.
- **R13 (re) → ROJO 1** (`props.offers.leak: [object Map]`).
Restauraciones por `diff` + `shasum` (`page.tsx` sigue en `963efe9c…`). typecheck --force 3/3, lint y format verdes.

**Hashes RE-MEDIDOS:** `billing-pages.neon.integration.test.ts` `f5324d3eb8952516b76f926ab5ff6e0acf09cc92` (273 lineas al hook) ·
`billing-pages-support.ts` `d48533a330c1d77446ac6821d60d86c0add779d2` (114). Copias en `/tmp/fix-d2-base/`.

**Lo que el revisor NO alcanzo y queda para la reanudacion:** re-ejecutar R6 y R9 por su cuenta, S9 x3, el intento
de R18, regresiones del recorte, higiene final. Su bitacora tiene las filas abiertas.
**Gates sobre el arbol final del lote 3 (re-corridos, no heredados):** `test` con integracion **126 / 916 / 0 failed / 0
skipped**; `build --force` 3/3 `0 cached`; `typecheck --force` 3/3; `lint` y `format:check` verdes. **Revisor del delta
RETOMADO** (SendMessage, contexto intacto) con la lista exacta de lo pendiente y el aviso de que su copia de
`pages.neon`/`support` quedo vieja.

## VEREDICTO DEL REVISOR DEL DELTA (12a muerte, pero TERMINO): FAIL DE BAJA SEVERIDAD — Y EL PLAN DE CIERRE POR SESIONES

Bitacora completa en `/tmp/revision-delta-d2.md`. Arbol auditado tras la muerte: `grep MUTATION` vacio, sin `zz-*`,
los 5 hashes (`963efe9c 82388cbb f5324d3e d48533a3` + settle-free `eeaa9e0c`) iguales al baseline. **El hook
`tasks-fresh` marco 3 archivos «tocados»: fue el revisor RESTAURANDOLOS (mtime nuevo, contenido identico).**

**Bloqueante (E4/E5, cuarta preimagen de S7, la mas fina):** `toEqual` lee cada prop DOS veces (`nonPlainPaths` +
`toEqual`); **Flight las lee UNA**. Un getter con estado o un `Proxy` que devuelve el secreto solo en la primera
lectura deja 15/15 VERDE y Flight manda el secreto (sonda `/tmp/flight-probe2.cjs`: `"endpoint":"cus_secret_ZZ9"`).
**Fix de 1 linea, verificado por el revisor:** `structuredClone(element.props)` como UNICA lectura y las aserciones
sobre el clon → E4 ROJO (`toEqual`), E5 ROJO (`DataCloneError: #<Object> could not be cloned`). Control limpio 6/6.

**R18: EL LIMITE QUE DECLARO EL ORQUESTADOR ERA FALSO** (patron de `CLAUDE.md`, esta vez cometido por el orquestador).
La trampa de foco SI se pinnea sin paquetes: `node-html-parser` viene bundleado en `next` (`querySelectorAll` + motor
CSS), render real + el `onKeyDown`/`ref` reales, **45 lineas, 12 ms**. Mutar el selector a `"button, input, select,
textarea"` da ROJO: `expected [ 'BUTTON:Cancelar', …(1) ] to deeply equal [ 'A:tus locales', 'BUTTON:Cancelar' ]`.
**Sonda guardada en `/tmp/zz-focus-probe.test.ts`** (borrada del arbol por el revisor). Se promueve en la sesion A.

**Cerrado por el revisor:** R6 ROJO 1 y R9 ROJO 3/3 re-ejecutados por su cuenta; S9 limpio 6/6, piso justificado
(`toContain("Mejorar a Plus")` + `plan === "free"` por SQL: el `!state` no puede dar verde falso). **3 menores: el
detalle murio con el agente** — se recuperan en la sesion B con un revisor acotado.

### PLAN DE CIERRE POR SESIONES (propuesto al owner el 2026-09-12; 12 muertes y ~5 h acumuladas)

- **SESION A — HECHA el 2026-09-12 (detalle arriba, al principio de este archivo).** (1) `structuredClone` + E4/E5
  re-ejecutadas en ROJO ✔; (2) `confirm-dialog-focus.test.ts` promovido, R18 en ROJO, los dos lugares del limite
  falso corregidos ✔; (3) 5 gates verdes (127/917) ✔; (4) **commit de checkpoint: EL OWNER LO RECHAZO.** Respuesta
  literal (2026-09-12): «hace el commit ahora si esta listo. pero si todavia no tenemos el pass del revisor,
  entonces no». **No hay PASS ⇒ no se commitea.** El riesgo que el commit iba a cubrir SIGUE ABIERTO: 16 archivos
  son `??` y no hay blob al que volver, asi que **toda mutacion de la sesion B exige copia en `/tmp` + `shasum`
  ANTES de tocar nada** — es el unico punto de retorno que existe.
- **SESION B — TERMINADA con veredicto FAIL de baja severidad** (1 bloqueante + 5 menores; detalle al principio de
  este archivo). Sobrevivio una muerte (la 13a de la spec) y se retomo por `SendMessage` con el contexto intacto.
  **Falta una SESION B-bis de correccion + re-revision acotada antes de que exista un PASS.** **SI ESTA SESION SE CAE:** el arbol quedo limpio
  (`grep MUTATION` = 0, sin `zz-*`, los 6 shasums == baseline del encargo) y con los 5 gates verdes; lo primero que
  hace la que hereda es `grep -rn MUTATION apps/merchant/src`, comparar esos 6 shasums y **leer la bitacora**.
- **SESION C (~30 min):** migracion `0030` a prod (Neon, `db:migrate`, verificar por `run_sql`), push con el fix de
  `GH_TOKEN`, y QA del owner contra el sha exacto (`gh api …/commits/<sha>/status` = `success`).
- **Despues, sin apuro:** extender `no-mutations-left.sh` para ver archivos-sonda (hoy ciego), con prueba de que muerde.

## HANDOFF 2026-09-12 — GATE VERDE, ADR 0062 ESCRITO, LISTO PARA `/clear`

**Gate del handoff, RE-CORRIDO sobre los bytes actuales (no heredado):** `typecheck` VERDE · `lint` VERDE ·
`test` con integracion **126 archivos / 916 tests / 0 failed / 0 skipped**. Higiene: `grep MUTATION` vacio, sin
sondas `zz-*`, y los 5 hashes iguales al baseline (`page.tsx 963efe9c`, `console 82388cbb`, `settle-free eeaa9e0c`,
`pages.neon f5324d3e`, `support d48533a3`).

**Se bajo a disco lo aprendido:** **ADR 0062** — «lo que cruza al cliente se pinnea por VALOR EXACTO y en UNA SOLA
LECTURA», con las cuatro vueltas del oraculo de S7 y por que las tres primeras estaban verdes sin cerrar nada. Fila en
`docs/INDEX.md` en el mismo commit. **Mistake→rule en `CLAUDE.md`:** (1) la regla del oraculo que debe leer igual y la
misma cantidad de veces que el consumidor real; (2) el gotcha de que **`node-html-parser` viene bundleado en `next`**,
que es lo que falsifico el limite de R18 que habia declarado el orquestador.

**NADA COMMITEADO TODAVIA.** 15 archivos de codigo (`??` en su mayoria) + docs. El commit de checkpoint es el primer
paso de la sesion A y **espera confirmacion del owner**.
