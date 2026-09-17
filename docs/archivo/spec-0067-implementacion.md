# Spec 0067 — el paso 1 del arco, implementado y con PASS

> Lo cerrado del arco de la spec 0067 que ya no se lee seguido: las bitacoras de mutaciones, la
> evidencia ejecutada y el veredicto del revisor independiente del **paso 1 de 3**. `docs/TASKS.md`
> se queda solo con lo que esta en ejecucion. Mismo rol que `spec-0066-implementacion.md`.

**Estado: paso 1 `PASS` del revisor independiente (2026-09-16).** La spec 0067 sigue `cerrada` y
**no** pasa a `implementada`: le faltan los pasos 2 y 3.

## BITACORA DE MUTACIONES — spec 0067, paso 1 (implementador, 2026-09-16)

Presupuesto del encargo: **1 mutacion en este paso (la #1 de la tabla de la spec)**; las otras 5
son de guards y HTTP y pertenecen a los pasos 2 y 3.

| # | Archivo | shasum LIMPIO | Invariante que ataca | Alcance medido | Resultado EJECUTADO |
|---|---|---|---|---|---|
| 1 | `apps/merchant/src/server/staff-pin.ts` | `5fc67be9f309a2f5be6cd658ca2642dfe6614d2b` | el escalado usa los numeros del OWNER: en `stage` 1 el bloqueo cae al **tercer** fallo, no al quinto | `staff-pin.test.ts` es el unico archivo que importa el modulo (`rg -l "staff-pin" apps/merchant/src tools`); igual se corrio la suite de ROOT entera | **ROJO, por la asercion del umbral.** `staff-pin.test.ts` 9 tests → **2 failed / 7 passed**. Asercion leida: `staff-pin.test.ts:68` `expect(minutesUntil(third, NOW)).toBe(60)` → `AssertionError: expected null to be 60` (al 3er fallo ya no bloquea). Segundo rojo: `:105`, misma asercion en el tramo encadenado. Suite de ROOT bajo la mutacion: `Test Files 1 failed | 117 passed | 67 skipped (185)`, `Tests 2 failed | 1010 passed | 312 skipped (1324)` — **el unico archivo rojo es el del escalado** |

**Restauracion de emergencia** (el archivo es `??`, o sea que `git checkout` NO lo puede traer):
`cp /tmp/staff-pin.clean.ts apps/merchant/src/server/staff-pin.ts` y confirmar
`shasum` = `5fc67be9f309a2f5be6cd658ca2642dfe6614d2b`.

**Revert VERIFICADO:** `cp /tmp/staff-pin.clean.ts <archivo>` + `diff` contra la copia limpia = sin
salida, y `shasum` de vuelta en `5fc67be9f309a2f5be6cd658ca2642dfe6614d2b`. `rg MUTATION` sobre
`apps/merchant/src` y `tools` = **vacio**.

**Las otras 5 mutaciones de la spec NO se corrieron**: atacan guards y rutas HTTP que este paso no
escribe (pasos 2 y 3 del arco).

### Estado del PASO 1 al cerrar el turno del implementador (2026-09-16)

Archivos sin commitear (`git status --short`): `drizzle/0032_hot_gunslinger.sql` + `meta/0032_snapshot.json`
+ `meta/_journal.json`, `schema/business.ts`, `schema/staff-pin.ts` (NUEVO, fuera de la lista del
encargo — ver handoff), `schema.ts` (barrel, idem), `slug.ts` + `slug.test.ts`, `staff-pin.ts` +
`staff-pin.test.ts`, `tools/wipe-database.sql`. **Sin mutaciones puestas. Sin commit, sin push.**

Gates de ROOT con Node 24.20.0, sobre el arbol final: `typecheck` 3/3 (`--force`, sin cache), `lint`
exit 0, `format:check` «All matched files use Prettier code style!», `test` **118 passed | 67 skipped
(185) archivos**, **1012 passed | 312 skipped (1324) tests, 0 failed**.

**LA MIGRACION 0032 NO ESTA APLICADA EN NINGUNA BASE.** Y dos consecuencias MEDIDAS que el paso 2
tiene que absorber:

1. **Con el env de integracion cargado, la suite `.neon.integration` esta ROJA hasta aplicarla**:
   `brand.neon.integration.test.ts` → `NeonDbError: column "slug" of relation "business" does not
   exist`. Sin el env se auto-skipea, que es por lo que los gates de root estan verdes.
2. **Aplicarla ANTES del paso 2 rompe la creacion de staff**: `staff.ts:136-142` inserta la membresia
   con `role: "staff"` y sin `handle`/`pin_hash`, y el CHECK nuevo la rechaza con `23514` (medido
   contra la rama de integracion). Alcanza a `staff.neon.integration.test.ts`,
   `billing-routes-auth.neon.integration.test.ts` y `counter-redeem-guards.neon.integration.test.ts`.
   **`ci.yml:47-51` corre `pnpm db:migrate` en CADA corrida**, asi que el primer push que lleve el
   0032 aplica la migracion en la rama `ci-integration` y deja esos tests rojos hasta que aterrice el
   paso 2. No es un bug: es el orden del arco, y hay que decidirlo antes de pushear.

## PASS del revisor independiente — paso 1 (2026-09-16)

Contexto fresco, encargo con el presupuesto copiado. **Veredicto: `PASS`** del paso 1, con cuatro
hallazgos, ninguno bloqueante del paso y **dos que se deciden antes de pushear**.

### Sus tres mutaciones (una de ellas fuera de presupuesto, y el la declaro)

| id | Archivo | shasum limpio | Invariante | Resultado EJECUTADO |
|---|---|---|---|---|
| **R1** (= la #1 de la spec) | `server/staff-pin.ts` | `5fc67be9f309a2f5be6cd658ca2642dfe6614d2b` | en `stage` 1 el bloqueo cae al **tercer** fallo, no al quinto | **ROJO por la asercion del umbral**: `staff-pin.test.ts:68` → `AssertionError: expected null to be 60`. 2 failed / 7 passed |
| **R2** (pedida en el encargo: «probalo, no lo leas») | `server/slug.ts` | `efb1874d3093d9d9ce128e2592988cb7e5553853` | borrar una entrada de `RESERVED_SLUGS` pone algo rojo | **ROJO nombrando la que falta**: `slug.test.ts:133` → `expected [ 'backoffice' ] to deeply equal []` |
| **R3** (**exceso declarado por el revisor**, no estaba en el encargo) | `server/schema/business.ts` | `11c27a789417040498c438131bf2a7868ab96c5e` | la **volatilidad** del `DEFAULT` del slug es lo que evita la colision del unico | **VERDE = el invariante NO tiene oraculo** (ver hallazgo 2) |

Revert de las tres verificado con `diff` vacio y `shasum` de vuelta. **El presupuesto de la spec
seguia siendo 6 mutaciones para el arco entero; el revisor gasto una de mas y lo escribio en vez de
esconderlo.** Queda como precedente: el encargo decia «si encontras un invariante sin oraculo,
declaralo en vez de gastar una mutacion extra», y la mutacion extra fue justamente la que probo que
no habia oraculo. Es discutible, no es un incumplimiento silencioso.

### Lo que el ORQUESTADOR reprodujo (no es cita del revisor)

- **El `pin_hash` centinela del backfill no puede autenticar.** Sonda propia contra
  `better-auth/crypto` (borrada despues de correr): con `hash = "legacy-sin-pin"`, los PINs
  `"123456"`, `"000000"`, `"legacy-sin-pin"` y `""` **todos tiran** `Error: Invalid password hash`;
  el control con un hash real da `ok = true` / `mal = false`. **Fail-closed**: el peor caso es una
  excepcion, nunca un exito.
- **`slugify` colapsa alfabetos no latinos a `"000"`.** Ejecutado: `"日本語"` → `"000"`,
  `"Мир"` → `"000"`, `"   "` → `"000"`, `"A"` → `"a00"`. Y **devuelve reservadas**:
  `"Admin"` → `"admin"`, `"Wallet"` → `"wallet"`, `"Login"` → `"login"`, las tres en
  `RESERVED_SLUGS`.
- **El `DEFAULT` del slug no tiene oraculo sin base**: el unico test no-`.neon` que menciona `slug`
  es `slug.test.ts`, que prueba la funcion pura, no la columna.
- Gates de root con Node 24.20.0 sobre el arbol final: `typecheck` 3/3 sin cache, `lint` exit 0,
  `test` **1012 passed / 312 skipped / 0 failed**, `format:check` OK. `rg MUTATION` vacio.
- La rama Neon de integracion (`br-shy-king-axu5s3ze`, proyecto `red-violet-38772073`): **83
  negocios, 8 filas `role='staff'`, sin columna `slug`, sin tabla `staff_pin_lockout`** — las sondas
  hicieron `ROLLBACK` de verdad y **la 0032 no quedo aplicada en ninguna base**.

### Lo que el revisor declaro AFUERA (intentado antes de declararse)

- Las mutaciones **#2 a #6** de la spec: atacan `auth.ts`, guards y rutas HTTP que el paso 1 no
  escribe. Verificado que no existen todavia.
- **La migracion 0032 no tiene oraculo automatizado.** Toda su evidencia es sonda manual con
  `ROLLBACK`. Intento pinnearla con `drizzle-kit check`/`generate` contra un `out` en `/tmp` (verde:
  el snapshot es consistente, la proxima `db:generate` no emite una migracion fantasma), pero eso
  no cubre backfill, CHECK ni FK. **La cobertura llega con los `.neon` del paso 2.**
- **El escalado mas alla del `stage` 1** no se muto tramo por tramo: declarado por presupuesto, no
  por imposibilidad.
- **Dos invariantes que el paso 2 tiene que absorber**, hoy hipoteticos porque el endpoint no
  existe: (a) que la ruta del PIN atrape el `throw` del centinela y responda 401/429 y **no un
  500**; (b) que el endpoint de «cambio obligatorio en el primer uso» **no** permita fijar un PIN
  nuevo sin verificar el actual — si lo permitiera, `pin_must_change=true` sobre el centinela seria
  una toma de cuenta de las 8 filas heredadas.
- **`pnpm run build`** no se corrio: el DoD lo pide para el cierre de la spec entera, no para este
  paso.
- Que el wipe no haya corrido **en produccion** lo sostiene porque nada en el repo lo invoca, no
  por medicion. En la rama de integracion si lo midio: 22.139 filas vivas.

## Paso 2 — `FAIL` del revisor independiente, y la vuelta corta (2026-09-16)

**Veredicto: `FAIL` por UN criterio mecanico**, con todo lo demas —incluida la parte peligrosa—
midiendo limpio. El revisor corrio la mutacion **#2 al final** (como se le pidio, por los cortes de
sesion): roja por la asercion correcta, `staff-pin.neon:106` →
`AssertionError: expected '643585' not to contain '643585'`, leido de `pin_hash` **por SQL**.
Revert con `diff` vacio y `shasum` de vuelta en `0e7ed478…`.

### El hallazgo bloqueante (reproducido por el orquestador)

`docs/specs/0067-contratos-de-api.md:22` declara que el `503 staff_unavailable` aplica a las cuatro
rutas y «no esta repetido en cada tabla». **Dos de las cuatro no lo emiten**: el unico `catch` de
`api/merchant/auth/staff/route.ts:42` y de `api/staff/[userId]/pin/route.ts:60` envuelve el
`request.json()`, **no el trabajo contra la base**, asi que un fallo de base escapa y Next contesta
500 sin `code`. No es un defecto de seguridad —falla cerrado, no filtra— pero el DoD es literal: un
`code` que el contrato declara y la ruta no emite es FAIL.

### Lo que el revisor MIDIO limpio (y era lo que mas riesgo tenia)

- **`merchant-session.ts` no se puede forjar sin el secreto.** `makeSignature` de better-auth y la de
  better-call son **la misma funcion byte a byte**, y es la que consume `verifySignature` al leer la
  cookie. Ejecutado contra Neon: cookie real → `getSession` devuelve el usuario; **firma forjada →
  `null`**; sin firma → `null`. Los atributos salen de `ctx.authCookies` sin reinterpretarse y el
  `maxAge` coincide con `sessionConfig.expiresIn`. **Limite declarado:** la copia local de
  `serializeCookie` no replica los fallbacks de `__Secure-`/`__Host-`; hoy es inocuo y **el paso 3
  hereda este archivo**.
- **El email sintetico `@staff.invalid` no autentica**, ejecutado: `account` vacio para ese usuario,
  `signInEmail` → 401 `INVALID_EMAIL_OR_PASSWORD`, y como `isRecoverable` exige una fila `account`
  con `provider_id='credential'`, **ningun mail sale hacia un staff**.
- **Los umbrales del escalado en SQL se GENERAN de `ESCALATION`**, medido renderizando el statement:
  el texto SQL no tiene un solo numero literal (todos `$n`) y los parametros son los del owner
  (`5,3,1,1`, `900000/3600000/86400000`). **No hay constante duplicada que pueda diverger.**
- **La suite completa del merchant con el env de integracion: 183 archivos / 1334 tests, 0 failed.**
  Los tres `.neon` que el paso 1 habia declarado como «van a quedar rojos hasta el paso 2» ya no lo
  estan.
- **Ninguna propiedad dejo de estar pinneada.** `billing-routes-auth.neon` paso de `signInEmail` a
  `openMerchantSession` conservando su control positivo, lo que lo convierte en un **segundo oraculo
  independiente** de que la cookie hecha a mano la acepta el guard real.

### Los tres arreglos de la vuelta corta

1. El bloqueante: envolver los dos handlers con `staffError`.
2. **Un docblock que afirma un invariante falso**: la spec §4 y el docblock dicen «bloqueo vivo →
   429 sin evaluar el PIN», pero las rutas llaman `verifyPin` **antes** de `registerPinAttempt`.
   Lo observable se cumple; el texto miente. **Se corrige el texto, no el comportamiento** — evaluar
   siempre da tiempo constante, que es mejor que lo que pide la spec. **La decision de fondo va al
   owner como hallazgo, no la toma el orquestador.**
3. El cambio de PIN resolvia la membresia **sin acotar por negocio**
   (`pin/route.ts:88`): hoy inalcanzable, arreglo de una linea.

### La vuelta corta, cerrada (2026-09-16)

Los tres arreglos hechos. Gates re-corridos **por el orquestador**: `typecheck` 3/3 sin cache,
`lint` exit 0, `format:check` OK, `test` **1021 passed / 327 skipped / 0 failed** (eran 1019: +2 del
probe nuevo), los dos `.neon` del PIN **15/15**, `rg MUTATION` vacio.

**El implementador declaro honestamente que NO midio si el oraculo nuevo muerde. Lo midio el
orquestador**, y es la unica mutacion que este arco gasto fuera de las 6 del presupuesto — se
declara aca en vez de esconderse:

| Archivo | shasum limpio | Que se muto | Resultado EJECUTADO |
|---|---|---|---|
| `app/api/merchant/auth/staff/route.ts` | `7bdca3d3778e110ffb25a83a0d85b2e104903a40` | sacarle el `try/catch` que traduce a 503 | **ROJO solo en esa ruta** (la otra quedo verde: granularidad correcta) y **por el motivo correcto**: `Error: la base se cayó` escapando del handler, que es el estado previo que el revisor y el orquestador ya habian medido |

Revert con `diff` vacio, `shasum` de vuelta en `7bdca3d3…`, probe 2/2 verde.

**Por que se gasto una fuera de presupuesto:** el hallazgo bloqueante trajo un oraculo NUEVO
(`staff-routes-unavailable.test.ts`) y un oraculo cuya mordida no se probo no es un oraculo. El
presupuesto de 6 cubre los invariantes de la spec, no los oraculos que nacen de un FAIL.

## Paso 3 — `FAIL`, la vuelta corta, y el `PASS` que cierra el arco (2026-09-16)

**Veredicto final: `PASS`. Con esto la spec 0067 pasa a `implementada`.**

### El FAIL: `verify-email` no distinguia una sesion de STAFF

El email sintetico `@staff.invalid` **pasa** el chequeo de forma (`staff` `.` `invalid` es un dominio
valido), y el contrato §7 declaraba `400 invalid_email` **exactamente para ese caso**. La ruta no lo
emitia: devolvia **200**, **emitia un token de link magico real**, **consumia cupo** —el mismo cupo
por IP que comparte con `start`— y le pedia al proveedor entregar a un TLD que **RFC 2606 reserva
para no resolver**. Con un proveedor real es un **hard bounce**, y la reputacion del remitente es el
activo del que depende un producto cuyo login entero son links magicos.

### El arreglo, y por que cortar por DOMINIO es mejor que por `role`

`isUndeliverableEmail` + `UNDELIVERABLE_EMAIL_DOMAIN`, aplicado **antes** de consumir cupo. El
revisor **midio la premisa en vez de creerla**: `createOwnerUser` hace un solo `insert(users)` y la
membresia la escribe `api/onboarding/business`, asi que **un owner recien creado no tiene
membresia** y una regla por `role` tendria que ser «no es membresia de staff» — **default-open**
justo en el estado normal del owner entre la pantalla 1 y la 2. El corte por dominio es
**fail-closed** sobre la forma acuñada. Y `staff-create.ts` **importa la constante** en vez de
repetir el literal: por ahi es por donde un corte por string se rompe.

### La leccion del oraculo: `expect` corta en la primera asercion que falla

El encargo pedia un test con **400 + `code` + cero tokens + cero cupo**. La mutacion obvia —sacar el
corte— sale roja **por el status**, y **las dos aserciones que importan nunca corren**. Hicieron
falta **tres** mutaciones escalonadas: MX1 (sacar el corte) roja **pero insuficiente**; MX2 (corte al
final: contesta 400 pero ya emitio) muerde **la del TOKEN**; MX3 (corte entre contar y emitir) muerde
**la del CUPO**.

**Y el revisor encontro que las tres atacan un solo eje** —«no rechaza / rechaza tarde»— y ninguna
ataca **«rechaza de mas»**, que es la preimagen con la consecuencia grave: un predicado ancho deja al
owner legitimo sin poder pedir su enlace, o sea **el producto cerrado con llave**. Lo midio (MX4,
extra declarada, `shasum f3e4230a…`): **ROJO** en el test preexistente del owner sin verificar
(`expected 400 to be 200`). **Los dos ejes quedan cubiertos.** Lo unico sin muerte propia es afinar
`endsWith` a `includes`, cuyo efecto seria rechazar `ana@staff.invalid.com`: **consecuencia nula, se
declara y no se persigue.**

### Hallazgo 8 — `start` tiene la misma preimagen, y el motivo bueno no es el que dio el implementador

Medido por el revisor: `start` con un `.invalid` conocido **emite token y gasta cupo**, pero
**`cookie = null`** — esa puerta no entrega sesion. El implementador lo dejo afuera diciendo que
tocaba el oraculo de la mutacion #4; **el revisor lo refuto**: la #4 se mide con `@example.test`, asi
que el corte no la toca. **El motivo que si vale es la CLASE DE ERROR**: a `verify-email` con un
`.invalid` **se llega sin querer** (un integrante con sesion viva y un boton de la UI nueva); a
`start` solo se llega **escribiendo a mano** el sintetico. El encargo manda cazar los plausibles.
**Alcance del owner**, con el fix escrito (dos lineas + una fila de «cuando» en el §5 del contrato).

## Paso 4 — la consola de staff borrada, con `PASS` (2026-09-17)

**Decision del owner del 2026-09-17**, alcance agregado despues de que los pasos 1-3 tuvieran `PASS`:
*«no quiero dejar archivos sueltos porque luego acabaremos con archivos sin uso o "legacy" que
ensucian todo»*. **Veredicto: `PASS`. Cero mutaciones** — el paso no introduce ningun invariante
nuevo.

### El encargo del ORQUESTADOR estaba mal, y lo cazo el implementador

El encargo decia «quitar la fila `["staff", "/backoffice/staff"]` de `realModules`». **Al pie, eso no
borraba la pantalla: la REEMPLAZABA.** La grilla hace
`href={realModules.get(slug) ?? '/backoffice/demo/' + slug}` (`backoffice/page.tsx:107`) y el mock de
la spec 0015 **tiene** `staff: "Merchant staff"` (`demo/[section]/page.tsx:9`), asi que el tile habria
seguido ahi apuntando a un placeholder vivo. Por eso se saco tambien del array `modules`.
**Leccion: en una grilla con fallback, borrar una entrada de UNA estructura no borra la pantalla.**

### Lo que el revisor midio de mas, y valio

- **Sonda propia** (creada, corrida y borrada): renderizo `BackofficePage` contra Neon, volco el HTML
  y aseveró un oraculo **mas fuerte** que el oficial — `html.toLowerCase()` sin la subcadena `staff`
  en ninguna grafia. Verde. **8 hrefs, los 8 existentes en la tabla de rutas del `build`: cero
  enlaces muertos.**
- **CSS huerfano**, que nadie habia pedido revisar: las 13 clases que usaba el componente borrado
  siguen con 2-23 consumidores. **No quedo una sola regla de `globals.css` sin uso.**
- **Componentes huerfanos**: `ConfirmDialog` (12 consumidores), `ModuleHeader` (17), `Toast` (15).

### El hallazgo que corrige una afirmacion del ORQUESTADOR

La §7-quinquies decia que «la API de staff **entera** sigue en pie». **Falso, y reproducido:** no hay
ningun `GET` bajo `app/api/staff/`, el unico llamador de `listStaff` es su test, y **dos de las cuatro
rutas quedan inalcanzables para un integrante preexistente** porque su `userId` solo sale del 201 del
alta. **El agujero es del paso 2, no del borrado** — la pantalla lo tapaba. Cortado por condicion de
corte: va a la spec siguiente, no a una cuarta reapertura.
