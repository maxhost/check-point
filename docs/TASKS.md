# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook `Stop` que
bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista
en pantalla. No "deberia andar". El auto-reporte no es evidencia.

**Este archivo contiene SOLO el arco en ejecucion** (regla instaurada por la spec 0066, ya cerrada).
Lo diferido, parado o pospuesto vive en **`docs/PARQUEADO.md`** (el unico lugar donde buscar
pendientes); el relato historico completo esta en **`docs/archivo/`** — `TASKS-historico-2026-09-16.md`
(7.185 lineas: todo lo anterior a la 0066) y `spec-0066-implementacion.md` (los tres pasos, la
bitacora de mutaciones y el PASS del revisor de esa spec).

**Ultima actualizacion: 2026-09-17.** Estado real en una linea: **specs 0067 y 0068
`implementadas`**, commit `a0f66ea` **pusheado** (HEAD == origin/main), **CI verde leida de
`/check-runs`**, **produccion truncada y migrada a 35**, y el **proceso recortado por el ADR 0071**
(spec chica, un implementador y un revisor por spec, gates una vez, filas de INDEX de 3 lineas).
**EL ARCO 2 ESTA EN EJECUCION: la spec 0069 esta `cerrada` y su implementador fue despachado.**

## ⇥ EN EJECUCION AHORA — spec 0069, el wizard de alta es API (2026-09-17)

**`docs/specs/0069-el-wizard-de-alta-es-api.md`, estado `cerrada`**, con su fila en `INDEX.md`.
Es la **2a tajada del ADR 0070**. Entrega API y contrato, **cero pantallas** (§16).

**Plantilla elegida MIDIENDO, no por costumbre (ADR 0071):** `TEMPLATE.md`, la larga. Las tres
condiciones de la chica fallan dos: toca **varios dominios** (onboarding, loyalty, imagenes,
brand-kit, location-providers) y **si lleva migracion** (`0035`, la columna de categoria).

**Las tres decisiones de producto las contesto el owner el 2026-09-17, ANTES de escribir la
prosa** (que es justo lo que el ADR 0071 vino a ordenar):

1. **Las 15 categorias `gcid:`** propuestas, tal cual.
2. **Sello placeholder generado por codigo (opcion A):** SVG con la inicial del negocio en
   **negro no puro (`#1A1A1A`)** — textual del owner: «el cuadrado donde se sella siempre es
   blanco, entonces asi sera visible».
3. **QR pelado, no el poster** —en el wizard todavia no hay color ni logo, eso es la parte
   «avanzada» del onboarding— **pero con descarga como imagen**, para que el comerciante lo
   guarde en el telefono hasta imprimirlo o armar el poster despues.

**Tres cosas se MIDIERON y corrigen documentos que ya estaban escritos** (regla: lo que se le
pasa a un subagente como insumo es una afirmacion propia):

- **El ADR 0070 se equivoca con el placeholder.** Dice que alcanza con implementarlo dentro de la
  ruta publica «y lo reciben todos los consumidores sin tocar ninguno». **Falso:**
  `client-view.ts:81-83` devuelve `stampImagePath: null` sin sello, o sea **la URL nunca se
  construye y la ruta nunca se llama**. Escrito solo ahi seria codigo muerto.
- **El ADR 0070 §14 dice que Mexico toca dos listas. Toca UNA:** la segunda
  (`app/onboarding/page.tsx:18`) la **borro la 0067**.
- **`counter/core.ts` NO se toca, y la primera version de la spec lo afirmaba mal.** Su docblock
  dice que `programDTO` expone «only the public stamp path» y **ese campo no existe** en lo que
  devuelve. Queda como hallazgo, no como trabajo.

**Verificado ejecutandolo, no asumido:** `sharp` 0.35.3 (ya es dependencia) rasteriza el SVG del
QR — Node 24.20.0, vips 8.18.3, un SVG de 2.421 bytes → **PNG 1024×1024 de 50.316 bytes**. La
descarga no cuesta una dependencia nueva.

**Los barridos del DoD se corrieron contra el arbol ANTES de cerrar** (leccion de la 0067, que
cerro con cuatro criterios imposibles). **Dos criterios nacieron mal y se corrigieron:** el
conteo de categorias por `rg 'gcid:'` (que tambien cuenta comentarios y el default `gcid:store`,
asi que no puede dar el numero exacto → pasa a ser una asercion del unit), y la afirmacion de que
la 0069 era «la unica spec abierta del INDEX», que es **falsa**: hay tres borradores viejos
(0003, 0007, 0009). Sigue siendo disjunta, pero por el motivo medido — los `archivos` de la 0003
son `packages/**` y **`packages/` no existe** (el workspace es `apps/*`), y la 0007 y la 0009
declaran «rutas concretas por definir». La 0009 ademas es **otro QR**: el fijo por local.

**→ LO PROXIMO, EN ORDEN:**

1. **Esperar al implementador** (despachado en background). Al volver: **reproducir la señal
   decisiva** de su informe, no todas sus mediciones.
2. **UN revisor independiente en contexto fresco**, con presupuesto y condicion de corte escritos.
   Solo un `PASS` verificable permite marcar la spec `implementada`.
3. **Cerrar la re-medicion del ADR 0071** con los numeros reales.

**RE-MEDICION DEL ADR 0071 — en curso.** Baseline a batir, de la spec 0068: implementador paso 1
**18 min / 71 tools / 179k** · revisor **9 / 40 / 106k** · implementador cerrando el FAIL **8 / 18
/ 208k** · paso 2 reanudado **6,8 / 17 / 238k** · revision final **4,4 / 17 / 137k** = **~46 min y
868k tokens** de subagentes. Se anota el `duration_ms`, el `tool_uses` y el `subagent_tokens` de
**cada** notificacion, y **el numero real vuelve al ADR 0071 aunque contradiga la promesa** de
~60 → ~25 min. No cuenta como mejora bajar el tiempo salteando mutaciones o la revision.

### Numeros de la re-medicion, a medida que llegan (2026-09-17)

| Etapa | Tiempo | Tools | Tokens |
|---|---|---|---|
| **Implementador 0069** (toda la spec, un solo agente) | **29,1 min** | **141** | **316k** |
| **Revisor 0069** (PASS de primera, sin ciclo de FAIL) | **11,2 min** | **59** | **183k** |
| **TOTAL 0069** | **40,3 min** | **200** | **498k** |

**Contra el baseline de la 0068** (que fueron CINCO despachos: implementador, revisor,
implementador cerrando el FAIL, implementador reanudado, revision final): **~46 min y 868k**.
El implementador solo de la 0069 hizo **toda** la spec —15 archivos, migracion, 5 mutaciones
ejecutadas y el contrato— en **29,1 min y 316k**, o sea **~64% de los tokens del arco 0068
completo en UN despacho**. El numero final se escribe cuando cierre el revisor, y **va al ADR
0071 aunque contradiga la promesa**.

**Gates REPRODUCIDOS por el orquestador** (no citados del agente, regla de la señal decisiva):
`typecheck --force` 3/3 sin cache · `lint` exit 0 · `format:check` OK · `test` **1088 passed / 0
failed** · `test` con `.env.integration.local` (esta en la RAIZ del repo) **199 files, 1478
passed / 0 failed** en 174 s · `build --force` 3/3 sin cache · `rg MUTATION` **vacio** · **cero
`.tsx` tocados**.

**Los dos tests preexistentes que el implementador modifico fueron auditados por el orquestador
y son legitimos:** pinneaban exactamente lo que la §D5 cambia a proposito, y las aserciones
nuevas son **mas fuertes** —`loyalty-program.test.ts` pasa de `null` a la ruta exacta y conserva
el `not.toHaveProperty('stampImageObjectKey')`; el `.neon` **agrega** la asercion de que una
version que no matchea sigue dando `null`—. No es un test ablandado para que pase un gate.

## ⇥ EN PRODUCCION (2026-09-17) — commits `fde3757` + `34cb98b`

**Autorizado por el owner.** Estado verificado, no asumido:

- **Commit `fde3757`** (la 0069, 36 archivos) y **`34cb98b`** (el fix del fixture de marketing),
  los dos **pusheados**: `git rev-parse HEAD` == `origin/main`.
- **MIGRACION 0035 APLICADA A PRODUCCION.** Proyecto `mi-pasaporte`, rama **`main` =
  `br-curly-silence-ax8acywm`** (la `default`, **confirmada por API antes de tocar nada**).
  **Verificado por SQL, no por el mensaje de `drizzle-kit`:** migraciones **35 → 36**,
  `core.business.category_gcid` existe como `text NOT NULL DEFAULT 'gcid:store'`, y las **3
  semillas** de `core.terms_template` intactas (son las que el wizard usa como terminos).
  La `0035` es **un solo `ALTER TABLE ADD COLUMN`**: no crea ni borra tablas.
- **Se migro ANTES de pushear, a proposito.** Vercel despliega con el push y el codigo nuevo lee
  esa columna; al reves habria una ventana con produccion tirando `42703`.
- **Vercel: `success`** para `fde3757`.
- **Las rutas nuevas responden en produccion**, probadas por HTTP contra `www.` (el apex hace
  308): `/api/onboarding/prefill` → **401 `{"code":"unauthorized"}`**, `/api/loyalty-program/qr`
  → **401 `{"code":"unauthorized"}`**, `/api/onboarding/program` → **405** en GET (es POST-only).
  Los tres codigos son **los que declara el contrato**.

**El contrato para la UI esta pusheado: `docs/specs/0069-contratos-de-api.md`.**

**CI VERDE, LEIDA DE `/check-runs` PARA EL SHA EXACTO `34cb98b`** (nunca `/status`, que aca
miente): `verify: completed -> success`, `total: 1`, **`no-success: 0`**. Los **18 pasos** en
`success`, leidos uno por uno — incluidos **«Migrar la rama Neon de CI»** (la `0035` aplica
limpia) y **«Unit + integracion Neon»**.

**Eso cierra el unico riesgo que quedaba declarado de la 0069:** el test del glifo del sello
placeholder mide pixeles opacos y se escribio en macOS; se declaro «pendiente de la primera
corrida de CI» por si en Linux faltaban fuentes. **Corrio en Linux y paso.**

### La CI se puso ROJA y NO era la 0069 — era una bomba de tiempo

7 archivos `.neon` de **marketing** rojos en un commit que no toca marketing. **No era una
regresion.** `createCampaign` (`marketing-integration-support.ts:78`) defaulteaba `startsAt` a
`Date.now() - 24 h` —**reloj real**— mientras esos tests corren el tick con un `NOW` **fijado** en
`2026-09-16T12:00:00Z`. Pasadas 24 h del `NOW` fijado, la campaña «todavia no empezo» y el tick
devuelve `{campaigns: 0, enqueued: 0}`. **Detono a las 12:00 UTC del 2026-09-17 y habria puesto
roja la CI de cualquier commit.**

**La prueba decisiva:** `marketing-tick.neon` **paso** en local a las 08:17 UTC y **fallo** en
local a las 14:18 UTC del mismo dia, **sobre el mismo arbol, sin un cambio de codigo**. La
variable era el reloj. El re-run del job fallo **identico** (determinista, no flake), y `rg` no
encuentra **un solo import** de lo que toco la 0069 dentro de `marketing/`.

**Arreglado en `34cb98b`**: el default pasa a un instante fijo anterior a cualquier `NOW` de la
suite. Verificado **26 h despues del `NOW` fijado** —la condicion exacta que los rompia—: los 7
archivos **7/7 y 31 tests**, la suite completa **1479 passed / 0 failed**, typecheck/lint/format/
build verdes sin cache. **El caso completo esta en `docs/LECCIONES.md`.**

## ⇥ LA SPEC 0069 ESTA `implementada` — PASS de revisor independiente (2026-09-17)

**PASS**, con 3 hallazgos declarados y **ninguno bloqueante**. Un solo ciclo: el revisor no
abrio FAIL. La condicion de corte no se aplico (ninguna vuelta termino en «el fix abrio la
siguiente»).

**Gates finales, corridos por el orquestador DESPUES de sus propios cambios** (el PASS del
revisor no cubria lo que el orquestador toco despues): `typecheck --force` 3/3 sin cache ·
`lint` exit 0 · `format:check` OK · **`test` con Neon: 199 files, 1479 passed / 0 failed** ·
`build --force` 3/3 sin cache · `rg MUTATION` **vacio** · **cero `.tsx`**.

### Lo que el revisor cazo y el orquestador ARREGLO (con su mutacion propia)

**El filtro por `(businessId, programId)` de la ruta publica del sello NO tenia oraculo.** El
revisor quito ese `eq()` y **23 tests pasaron igual**: un negocio podia leer el sello de otro y
la suite no lo veia. El orquestador agrego el test de aislamiento en
`loyalty-stamp-placeholder.neon.integration.test.ts` y **probo que muerde** con la mutacion
**O1** (`stamp.ts`, shasum limpio `37379485f888a7943003b390b0a964e5d9de5fd0`): rojo
**`AssertionError: expected { kind: 'stamp', …(1) } to be null`**, y **un solo test rojo**, lo
que confirma que nada mas lo cubria. Revertida con `diff` vacio y shasum coincidente.

**El docblock de `brand-kit/qr.ts` afirmaba lo contrario de lo medido, y se corrigio el CODIGO,
no solo el comentario.** Decia que el `density: 600` «evita el borde dentado». **Medido por el
orquestador** sobre el SVG de un enroll real (`viewBox 0 0 47 47`): `sharp` rasteriza el vector
**directo al tamaño del `resize`**, asi que fijarle `density` lo obliga a rasterizar a 392×392 y
despues **agrandar**, que es lo que introduce el dentado. **Sin `density`: 0 pixeles intermedios
en 24.407 bytes. Con `density: 600`: 38.273 pixeles intermedios en 42.557 bytes.** Se quito la
opcion: el QR que el comerciante imprime sale mas nitido y **~40% mas liviano**.

### DECIDIDOS POR EL OWNER el 2026-09-17 — ya no son hallazgos

1. **El `accrual` del wizard queda en `{ per_purchase, grant: 1 }`** («un sello por visita»).
   **Decision del owner, textual: «accrual lo dejamos como esta».** Lo habia elegido el
   implementador y se le llevo como hallazgo; ahora es decision suya. Sigue siendo **editable**
   desde el editor de programa de siempre (`saveProgram` reescribe la mecanica en cada guardado),
   asi que el wizard fija un punto de partida, no algo permanente.
2. **El sello placeholder queda como se implemento**, y eso incluye que se vea en **TRES**
   pantallas, una de ellas **del consumidor**: con `stampImagePath` siempre no nulo,
   `card-preview.tsx:46` renderiza la inicial donde antes el slot quedaba vacio, y eso alcanza
   `steps/step-review.tsx`, `steps/step-card-design.tsx` y **`app/(consumer)/wallet/
   program-card.tsx:39`, la tarjeta del cliente final**. Se le mostro al owner la tercera —que la
   lista del implementador omitia y cazo el revisor— y respondio: **«sello placeholder dejalo
   como lo implementaste»**. Decision suya, con el efecto en la tarjeta del consumidor a la
   vista.
3. **`POST /api/onboarding/business` responde sin `code`**, contra la convencion del contrato
   0067 («todo error responde `{error, code}`»). Se dejo como estaba; el contrato lo **declara
   como estado actual**. Candidato a `PARQUEADO` fila 56.
4. **Esa misma ruta con cuerpo no-JSON revienta en 500 sin `code`** (el `request.json()` esta
   fuera del `try`). Hay un test que lo pinnea **como limite** para que el dia que se arregle se
   ponga rojo. **Matiz del revisor:** ese test usa `rejects.toThrow()` sin matcher, asi que
   tambien pasaria si rechazara por otro motivo.
5. **`counter/core.ts:167-169` sigue mintiendo:** su docblock dice que `programDTO` expone «only
   the public stamp path» y ese campo **no existe** en lo que devuelve. Declarado fuera de
   alcance en la spec.
6. **El split de `schema/billing.ts`** (el hook `file-size` corta en 300 y `business.ts` llegaba
   a 308) **no estaba en la tabla de archivos de la spec**. El revisor verifico por `diff` que
   es un **movimiento puro**, sin cambio semantico, y que el barrel re-exporta.

### Declarado y NO perseguido (intentado antes de declararse)

- **`?v=00` es alias de `?v=0`** (el guard es `/^[0-9]+$/` + `Number()`): mismo contenido bajo
  claves de cache distintas. No es fuga ni 404 indebido — desperdicio de cache.
- **`403 not_owner` / `503 qr_unavailable` y los 403/409/503 del programa no tienen test.**
  Verificados leyendo los sitios de `throw` alcanzables y el mapeo de `codeForStatus`;
  ejercitarlos pedia un owner sin negocio y una inyeccion de falla de base — fuera del
  presupuesto de 4 mutaciones.
- **La precedencia del 400 de categoria** que afirma el contrato §2 es cierta en el codigo pero
  no tiene oraculo.
- **El rasterizado del glifo del placeholder** se midio en macOS; el test asevera un piso de 1%
  y un techo de 50% de pixeles opacos, asi que **si en CI (Linux) faltaran fuentes ese test es
  ROJO y no un falso verde**. Pendiente de la primera corrida de CI, no declarado imposible.

### Lo que FALTA y es paso del orquestador, no del agente

- **La migracion `0035` esta aplicada SOLO en la rama de integracion** (`br-shy-king-axu5s3ze`).
  **Produccion NO se toco.** Aplicarla es paso posterior al commit, y se confirma con el owner.
- **Verificar la CI con `/check-runs`** —nunca con `/status`, que en este repo miente— para el
  sha exacto, despues del push.

**SIN COMMITEAR (el owner no lo autorizo todavia): 34 archivos** — todo el codigo de la 0069,
sus tests, la migracion `0035`, `docs/specs/0069-el-wizard-de-alta-es-api.md`,
`docs/specs/0069-contratos-de-api.md`, `docs/INDEX.md`, `docs/adr/0071-*` (la re-medicion) y este
`docs/TASKS.md`. **Verificado con `git status --short | wc -l` → 34.**

---

**Lo anterior al arco 2 esta detallado abajo, en «ARRANCA ACA LA SESION QUE SIGUE».**

**→ LA SPEC 0067 ESTA `implementada`** (2026-09-17): **cuatro pasos, cuatro `PASS`** de revisor
independiente, cada uno en contexto fresco. **Nada esta commiteado ni pusheado: eso lo autoriza el
owner.**

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit `9086c9a`, autorizado por el owner. **Verificado
con `git rev-parse HEAD` y `git rev-parse origin/main` dando el MISMO sha**, no por asumirlo (esta
cabecera ya mintio dos veces en sesiones anteriores). 91 archivos, +24.149 / -2.747.

**→ EL PROCESO CAMBIO: ADR 0071, aceptado por el owner el 2026-09-17.** Spec chica
(`docs/specs/TEMPLATE-CHICA.md`, nuevo) para cambios de **un dominio, sin migraciones y sin
decision de producto abierta**; decisiones del owner **antes** de la prosa; **UN implementador y
UN revisor por spec**, no por paso; filas de `INDEX` de **3 lineas**; **gates completos una vez
por spec**. `CLAUDE.md` puntos 2, 4 y 7 actualizados. **No se toco el protocolo de mutaciones ni
la revision independiente**: en esta misma spec el revisor cazo un oraculo inexistente y la fuga
sobrevivia a 1027 tests. El ADR lleva los numeros medidos y **se re-mide contra la proxima spec
chica**.

**El paso 2 NO lleva spec nueva**: ya es el §4 de la 0068, `cerrada`. Escribir otra seria la
duplicacion que el 0071 vino a cortar. La plantilla chica estrena en el proximo trabajo nuevo.

**→ LA SPEC 0068 ESTA `implementada` (2026-09-17), con `PASS` de revisor independiente sobre la
spec ENTERA.** Entregado: `GET /api/staff`, `email` fuera del `StaffDTO`, `requireStaffOwner`
adentro del `try` en 4 rutas, el borrado de `emailOTP`, y en el contrato `§2-bis`, `§4-bis` y los
oraculos por superficie. **Nada commiteado: eso lo autoriza el owner.**

**Gates corridos por el ORQUESTADOR sobre el estado final** (cadena con `&&`, o sea exit 0 en cada
paso): `typecheck --force` · `lint` · `format:check` · `test` **1018 passed / 355 skipped / 0
failed** · `build --force` · `rg -n MUTATION apps tools` **vacio**. Los dos barridos del DoD, exit
1. Integracion del revisor: **8 archivos / 53 tests / 0 failed**, incluidos `magic-link.neon` y
`auth-start.neon` (sacar `emailOTP` no toco el link magico).

**14 mutaciones en total, ninguna sobrevivio sin explicacion**: 6 del implementador, 5 del revisor,
3 del orquestador. Las dos que valieron el ciclo:

- **El `FAIL`**: el DoD pedia un oraculo contra la fuga del email sintetico y **no existia** para
  `…/pin/regenerate` ni `…/status`. La fuga escrita **por fuera** de `toStaffDTO`
  (`{...toStaffDTO(…), email}`) pasaba `typecheck`, **1027 tests** y los 4 `.neon` — TypeScript
  rechaza el exceso de propiedades pero **no** el spread. Cerrado con
  `staff-status.neon.integration.test.ts` (nuevo) y +5 lineas en `staff-pin-change.neon`.
- **El oraculo que iba a quedar VACUO**: sin el plugin, los 9 paths de `emailOTP` dan 404 **por
  inexistentes**, asi que el test viejo seguia verde sin probar nada. Se mudo a
  `Object.keys(auth.api)`; reponer el plugin lo pone rojo **por la clave**
  (`to not include 'signInEmailOTP'`), y el revisor probo ademas que los 2 `disabledPaths` que
  quedan son guard vivo (sin la entrada, el path da **500**, no 404).

**PRIMERA MEDICION DEL ADR 0071:** paso 1 **18 min** (implementador fresco) → paso 2 **6,8 min**
(mismo implementador **reanudado**, sin re-leer el repo) → revision final **4,4 min**. La palanca
grande es el contexto, no los comandos.

**COMMITEADA Y PUSHEADA el 2026-09-17** — commit **`a0f66ea`**, autorizado por el owner. 26
archivos, +1.528 / −190. **Verificado con `git rev-parse HEAD` y `git rev-parse origin/main` dando
el MISMO sha**, no por asumirlo.

**CI VERDE, VERIFICADA CON `/check-runs` (2026-09-17).** Sha `a0f66ea`: **`verify: completed ->
success`**, `total checks: 1`, **`no-success: 0`**. Pasos leidos uno por uno del job
`105111713508`: `lint`, `typecheck`, **«La integracion Neon tiene que correr, no skipearse»**,
**«Migrar la rama Neon de CI»**, `Unit + integracion Neon`, `playwright install`, `test:e2e`,
`build`, `format:check` — **los 18 en `success`**. Nunca se uso `/status`, que aca miente.

**→ PRODUCCION LIMPIADA Y MIGRADA (2026-09-17), ejecutado por el agente via MCP de Neon.**

**Objetivo confirmado con el owner en el momento, no solo el permiso:** proyecto `mi-pasaporte`
(`red-violet-38772073`), rama **`main` = `br-curly-silence-ax8acywm`**, la `default`/`primary`.
**NO** se toco ninguna rama de integracion.

**Dos hallazgos que se midieron ANTES de truncar, y que el owner decidio:**

1. **Habia 4 suscripciones de Stripe VIVAS** en la base (`plan: plus`, `status: active`, con
   `customer` y `subscription` id): A1, A3 Test ×2 y Negocio B. **El owner dijo «elimina, no te
   preocupes por Stripe»** — asi que los ids se perdieron con el truncate. Si alguna seguia viva
   del lado de Stripe, sus webhooks llegan sin fila que matchee. **CERRADO por el owner el
   2026-09-17: «olvidate de las suscripciones, es sandbox».** No es deuda y no vuelve a listarse
   — no hay facturacion real que perseguir.
2. **`core.terms_template` no es dato de prueba: es SEMILLA**, insertada por la migracion
   `0004_polite_turbo.sql:97`. Truncarla la borraba **para siempre** (esa migracion ya figura
   aplicada, `db:migrate` no la re-ejecuta) y `GET /api/loyalty-terms/templates` habria quedado
   devolviendo `[]`. **El owner eligio EXCLUIRLA del truncate.** Verificado antes de ejecutar que
   la exclusion es efectiva: **`terms_template` no tiene NINGUNA FK** —ni entrante ni saliente—,
   asi que el `CASCADE` no podia alcanzarla.

**Ejecutado:** `TRUNCATE` de `core.*` + `merchant_auth.*` menos `core.terms_template`, con
`RESTART IDENTITY CASCADE`. **Verificado por SQL:** las 2 tablas de `merchant_auth` y las 28 de
`core` en **0 filas**; `core.terms_template` con sus **3** semillas.

**Migraciones aplicadas a PRODUCCION con `drizzle-kit migrate`** (no con SQL crudo, para que el
journal no quede mintiendo): **32 → 35**. Verificado por SQL, no por el mensaje de la herramienta:
`merchant_auth.password_reset_attempt` **ya no existe** (0033), `merchant_auth.auth_start_attempt`
**existe** (0034), `core.business.slug` **existe** y `core.business_membership.pin_hash`
**existe** (0032).

**`consumer.*` TAMBIEN TRUNCADO, por decision del owner (2026-09-17).** El script acordado
alcanzaba solo `core.*` + `merchant_auth.*`, y 7 tablas de `consumer` habian quedado con filas
porque **no tienen FK a lo truncado** (el `CASCADE` no las alcanzaba): eran identidades de
consumidor y pases de Wallet apuntando a programas ya inexistentes. Se verifico antes de ejecutar,
con la misma diligencia que cazo `terms_template`, que **ninguna migracion siembra datos en
`consumer.*`** (`rg 'INSERT INTO "consumer"' drizzle/*.sql` → vacio), asi que no habia semillas que
perder.

**ESTADO FINAL DE PRODUCCION, verificado por SQL:** de las 43 tablas de `core`, `merchant_auth` y
`consumer`, **la unica con filas es `core.terms_template` (3 semillas)**. Todo lo demas en **0**.

**LAS RAMAS DE NEON: NINGUNA ESTA SIN USO, asi que no se borro ninguna.** Medido: `ci-integration`
(`br-icy-hat-axsfqc8k`) es la que uso la CI verde de `a0f66ea` hace minutos, y
`spec-0065-marketing` (`br-shy-king-axu5s3ze`) es a la que apunta `.env.integration.local`, o sea
**toda la suite `.neon` local**. Borrar cualquiera rompe CI o los tests de integracion. La segunda
tiene TTL hasta **2026-10-15**.

## ⇥ ARRANCA ACA LA SESION QUE SIGUE (handoff del 2026-09-17, post-`/clear`)

**Todo lo anterior esta CERRADO y verificado.** Commit `a0f66ea` pusheado (HEAD == origin/main),
**CI verde leida de `/check-runs`** (`verify: completed -> success`, 18 pasos en `success`),
**produccion limpia y migrada a 35**. Lo unico sin commitear es este `docs/TASKS.md`.

### Lo que hay que hacer: el ARCO 2 (2ª spec del ADR 0070)

**ES API, NO PANTALLA. Confirmado con el owner el 2026-09-17** y es textual del ADR 0070 §16: «la
UI la construye el owner por fuera, con ChatGPT, asi que lo que se construye aca es la capa de
logica y los endpoints». El nombre del ADR —«el wizard de 3 pantallas»— engaña: lo que se entrega
son **los endpoints que esas 3 pantallas consumen** mas **el contrato HTTP escrito** (forma de
`0067-contratos-de-api.md`). Una spec de este arco que liste un archivo de pantalla como «crear»
esta mal alcanzada.

**Contenido segun el corte de 4 specs ya confirmado:** logica de pantallas 2 y 3, categoria
`gcid:`, paises + Mexico, sello placeholder, programa activo, y **el QR**. Consume `server/slug.ts`
y la migracion del `slug`, **ya aplicadas en produccion**.

**Plantilla:** evaluar contra las tres condiciones del ADR 0071 (un dominio, sin migraciones, sin
decision de producto abierta). **Probablemente NO califique** —toca varios dominios y puede pedir
esquema—, o sea `TEMPLATE.md`. **Decidirlo midiendo, no por costumbre.**

### Y LA RE-MEDICION DEL ADR 0071 — el owner la pidio explicitamente contra ESTE arco

El ADR 0071 promete **de ~60 min a ~25** y se cerro con la condicion escrita de re-medirse. **Como
se mide, para que la comparacion sea honesta:**

**Baseline de la spec 0068** (lo que hay que batir): implementador paso 1 **18 min / 71 tools /
179k tokens** · revisor **9 min / 40 / 106k** · implementador cerrando el FAIL **8 min / 18 /
208k** · paso 2 con el implementador **reanudado** **6,8 min / 17 / 238k** · revision final **4,4
min / 17 / 137k**. **Total subagentes ~46 min y 868k tokens**, mas la orquestacion.

**Que anotar en el arco 2:** el `duration_ms`, el `tool_uses` y el `subagent_tokens` que devuelve
**cada** notificacion de subagente, y cuantos ciclos hubo. **Comparar contra el baseline de arriba
y escribir el numero REAL en el ADR 0071**, aunque contradiga la promesa. Si no bajo, el ADR se
corrige con lo medido — un ADR que promete y no se re-mide es exactamente la clase de afirmacion
sin verificar que este repo persigue.

**Lo que NO cuenta como mejora:** bajar el tiempo salteando mutaciones o la revision independiente.
En la 0068 el revisor cazo un oraculo que no existia y la fuga sobrevivia a 1027 tests; ese ciclo
**se paga**.

### Deuda viva, por si aparece en el camino

- **`PARQUEADO.md` fila 56** — el gate de email verificado cubre **2 superficies de API de 11**.
  Mientras viva, un owner sin verificar crea sucursales, sube marca, arma campañas y **abre un
  checkout de Stripe**. Las decisiones de contenido ya estan tomadas; falta el cuando.
- **`PARQUEADO.md` fila 57** — `core.business.status` no existe; pedido del owner para la 3ª spec.
- ~~**Stripe**~~ — **CERRADO el 2026-09-17, no es deuda.** El owner: «olvidate de las
  suscripciones, es sandbox». Las 4 suscripciones truncadas eran de prueba: no hay facturacion
  real. **No re-listar.**
- **Las ramas de Neon no se borraron porque ninguna esta sin uso** (ver arriba). Lo que tiene
  sentido es **renombrar** `spec-0065-marketing`, no borrarla.

## ⇥ HANDOFF 2026-09-17 — LO QUE HACE LA SESION QUE VIENE, EN ORDEN

**La 0067 esta CERRADA del todo**: `implementada`, commit `9086c9a` pusheado, **CI verde verificado
con `/check-runs`** (el paso «Migrar la rama Neon de CI» incluido: las tres migraciones aplicaron
limpias). No hay nada a medias de ese arco.

**El owner dio estas tres instrucciones el 2026-09-17. Estan en orden y no hay que repreguntarlas:**

### 1. HECHO — la spec 0068 esta `cerrada` (2026-09-17)

`docs/specs/0068-cierre-de-la-api-de-identidad.md`, con su fila en `docs/INDEX.md`. **Nada de
codigo escrito todavia**: lo que hay es la spec.

**Las cuatro decisiones que la bloqueaban las contesto el owner el 2026-09-17:**

1. **Alcance recortado a staff.** Palabras del owner: «como estamos en proceso de reconversion
   todo a API diferentes, mas seguras, yo tocaria solo lo que faltaba de staff para completar lo
   que faltaba del arco 1». → **el gate de email en las otras 9 superficies SALE de la spec** y
   vive en `docs/PARQUEADO.md` **fila 56**, con sus dos decisiones de contenido **ya tomadas**
   (si al `status='active'`, si a los `code` en 401/403): lo unico que falta es cuando.
2. **`email` sale del `StaffDTO`.** Confirmado.
3. **Negocio con `status` + suscripcion `free` de base.** Medido, y son dos cosas distintas: la
   **suscripcion free YA existe** en toda alta (`api/onboarding/business/route.ts:155` inserta
   `plan:'free'`, `status:'active'`), y **`core.business.status` NO existe** — los `status` del
   esquema son los de `business_membership`, `location` y `subscription`. Es esquema nuevo, la
   0068 no toca esquema → `PARQUEADO.md` **fila 57**, para la **3ª spec** (entitlements).
4. **`code` en los 401/403.** Confirmado; aplica a las superficies parqueadas en la fila 56.

**Lo que la re-medicion corrigio de lo que decia este archivo** (regla: lo que se le pasa a un
subagente como insumo es una afirmacion propia, y se re-mide antes de despachar):

- **Las superficies de API del owner son 11, no 6.** Las 6 del encargo eran `api/staff/*`, el
  `PATCH` del slug, `api/billing`, `api/locations`, `api/marketing` y `api/catalog`. **Las 5 que
  faltaban**: `api/brand`, `api/brand/logo-upload` (que **ni siquiera resuelve owner**: solo
  sesion), `api/loyalty-program`, `api/loyalty-program/stamp-upload` y `api/loyalty-terms/templates`.
- **Hallazgo nuevo, no estaba en ningun doc:** los tres `ownerBusiness` (`brand.ts:32`,
  `catalog/core.ts:73`, `loyalty-program.ts:51`) **no filtran `memberships.status='active'`**, que
  `ownerContext` si filtra, y loyalty ordena `desc` donde los otros ordenan `asc`. Es la deriva
  que el docblock de `locations/_auth.ts:8` decia estar evitando.
- **El contrato ya MIENTE hoy**: sus «Convenciones» declaran que las cuatro rutas de staff
  envuelven «todo lo que toca la base, incluida la resolucion de la sesion», y en **4** de ellas
  el guard esta fuera del `try`. Arreglarlo es lo que vuelve cierto al documento.

**Sondas ejecutadas** (archivo temporal de vitest, **borrado**, `git status` limpio):
`Object.keys(auth.api)` da **44** endpoints con `emailOTP` puesto, incluidos `signInEmailOTP` y
`sendVerificationOTP` — por eso el oraculo del punto (4) se asevera sobre la instancia en vez de
sobre un 404 que quedaria vacuo. Y los **endpoints core de password** de better-auth siguen
montados: `request-password-reset` → **400 `RESET_PASSWORD_DISABLED`**, `reset-password` y
`change-password` → 400 de validacion, `set-password` → 404. Ninguno autentica: **declarado
afuera de alcance**.

**Los barridos del DoD se corrieron contra el arbol ANTES de cerrar** (leccion de la 0067, que
cerro con cuatro criterios imposibles): dos nacieron mal y se corrigieron — el conteo de archivos
de un barrido, y un `rg` sobre el contrato que **no puede dar cero** porque la palabra `email`
tambien esta en el cuerpo de `auth/start`.

### 1-bis. El encargo original del owner, para referencia — tres puntos, un solo dominio

No es el wizard todavia. Es cerrar la deuda que dejo la 0067, y el owner la aprobo agrupada asi:

- **(a) `GET /api/staff`** reusando `listStaff` (`server/staff.ts:100`, hoy **sin ningun consumidor de
  produccion**), **mas su fila en `docs/specs/0067-contratos-de-api.md`**, mas la fila que falta de
  `POST /api/staff/[userId]/status`. **Por que primero: sin esto la UI que el owner construye por
  fuera NO puede listar el equipo**, y `regenerate` y `status` son inalcanzables para cualquier
  integrante creado antes de la sesion actual (su `userId` solo sale del 201 del alta).
  **TRAMPA ESCRITA DE ANTEMANO:** `StaffDTO` lleva `email`, que es el sintetico `@staff.invalid`. Un
  `GET` que lo serialice le devuelve al navegador **el mismo contacto falso que motivo borrar la
  consola**. O se omite del DTO, o el contrato lo marca como no-contacto.
- **(b) Unificar el gate de email verificado en un `requireApiOwner`** que usen las **seis**
  superficies de API. Hoy lo tienen dos (`api/staff/*` y el `PATCH` del slug). **Medido:** no existe
  un cuello de botella unico para API — `requireOwner` de `server/auth-guards.ts` es guard de
  **paginas** y contesta con `redirect()`, que sobre un POST es un **307**; por eso `api/billing`,
  `api/locations`, `api/marketing` y `api/catalog` escribieron cada uno el suyo con `ownerContext`.
  **En el mundo del ADR 0070 el guard de paginas ya no es la puerta**, asi que hoy un owner sin
  verificar puede crear sucursales, subir marca, armar campañas y abrir un checkout de Stripe.
  **Falso consuelo a evitar:** `billing-routes-auth.neon` NO cubre esto — su seed pone
  `emailVerified: true`. **Incluir tambien**: mover `requireStaffOwner` ADENTRO del `try` en
  `api/staff/route.ts`, `.../pin/regenerate` y `.../business/slug`, que hoy queda afuera y hace que un
  fallo de base salga como **500 sin `code`** en vez del `503` que el contrato declara.
- **(c) Borrar `emailOTP` de `server/auth.ts`** — el owner pregunto y se le confirmo con medicion:
  **hay una sola instancia de better-auth en el repo** (el consumidor no tiene la suya) y `emailOTP`
  existe **solo** para el reset de contraseña (`sendVerificationOTP` → `passwordResetEmail`), que ya
  no existe. Se va tambien `passwordResetEmail` de `server/email/channel.ts`.
  **OJO:** al sacar el plugin, sus **9** rutas pasan a dar 404 por inexistentes en vez de estar
  bloqueadas por `disabledPaths`, asi que **`merchant-auth-disabled-paths.test.ts` tiene que reflejar
  eso** — ese test hoy pinnea la lista de 9.

**Antes de cerrar esa spec: correr CADA criterio de DoD que sea un comando contra el arbol.** La 0067
se cerro con **cuatro** criterios imposibles de cumplir y el caso ya esta en `LECCIONES.md`.

### 2. EJECUTAR el borrado de la base — el owner autorizo que lo haga el agente, via MCP

**Autorizacion explicita del owner (2026-09-17), con dos recortes que cambian el procedimiento:**

- **SOLO DATOS, NO SCHEMAS.** Truncar filas; **no** tocar tablas, tipos ni columnas.
- **STRIPE FUERA DE ALCANCE: «ya esta resuelto».** El **PASO 0** (exportar ids) y el **PASO 1**
  (checklist de Stripe) de `tools/wipe-database.sql` **NO se ejecutan**. Esto **anula** la regla de
  «Stripe va primero» para esta corrida — y la anula el owner, no el agente.
- Se ejecuta con **MCP de Neon** (`mcp__neon__run_sql`), no con `psql`.

**Lo que SI hay que hacer, y con cuidado:** el script vive en `tools/wipe-database.sql`; su **PASO 2**
arma la lista de tablas de `core.*` + `merchant_auth.*` y hace
`TRUNCATE … RESTART IDENTITY CASCADE` (linea 103), y el **PASO 3** verifica por SQL. **Confirmar
contra que proyecto y que rama se corre ANTES de ejecutar** (el proyecto es `mi-pasaporte`,
`red-violet-38772073`; **la rama de integracion `br-shy-king-axu5s3ze` NO es produccion**), contar
filas antes, ejecutar, y **transcribir los `select count(*)` en cero**. Es destructivo e irreversible:
la regla del harness pide preguntar antes de invocar un tool destructivo aunque haya autorizacion
previa — **confirmar el objetivo con el owner en el momento, no el permiso.**

### 3. Recien despues: la 2ª spec del arco (el wizard de 3 pantallas + el QR)

Consume `server/slug.ts` y la migracion del `slug` que la 0067 dejo lista.

### ~~Sin commitear al cerrar esta sesion~~ → YA COMMITEADO (`b2fef3d`, 2026-09-17)

Los 3 archivos de documentacion (`CLAUDE.md` con la correccion de `/status` → `/check-runs`,
`docs/LECCIONES.md` y `docs/TASKS.md`) entraron en el commit **`b2fef3d`**, que **esta pusheado**:
`git rev-parse HEAD` y `git rev-parse origin/main` dan el mismo sha (verificado el 2026-09-17, no
asumido).

**Lo que hay sin commitear AHORA (2026-09-17, sesion de la 0068) son 4 archivos, todo
documentacion:** `docs/specs/0068-cierre-de-la-api-de-identidad.md` (nuevo), `docs/INDEX.md` (su
fila), `docs/PARQUEADO.md` (filas 56 y 57) y este `docs/TASKS.md`. **El owner no autorizo ese
commit todavia.**

## ⇥ EN EJECUCION: EL ALTA DEL COMERCIO ES UN WIZARD (ADR 0070)

**Leer primero:** `docs/adr/0070-el-alta-del-comercio-es-un-wizard-de-tres-pantallas.md` (321
lineas). Las secciones **11-17 son decisiones del owner del 2026-09-16**. **No repreguntar nada de
ahi.**

> **Las dos reglas que gobiernan TODO este arco:**
>
> **(§16) Se entrega API y endpoints, NO interfaz.** La UI la construye el owner por fuera, con
> ChatGPT. El entregable son **dos** piezas: los endpoints **y el contrato HTTP escrito**. El
> orquestador ya se salteo esto una vez (caso en `docs/LECCIONES.md`; regla en `CLAUDE.md`).
>
> **(§17) La UI vieja de lo que se refactoriza se BORRA** — «no dejar rastros viejos». Y la limpieza
> de enlaces muertos es **parte** del borrado: tres de las referencias que arrastra la 0067 son los
> `redirect` del guard de acceso, que apuntados a una ruta borrada dan **404 en vez de rebote**.
>
> **Costo aceptado por el owner mientras dure el arco: el producto no tiene entrada por navegador,
> asi que NO hay QA de pantalla.** La verificacion es por HTTP, con las respuestas transcriptas.
> Es la excepcion explicita a «gana la pantalla», y se declara en cada spec.

### Los 4 puntos, cerrados

1. **Verificacion de email** — no bloquea el alta; bloquea **todo lo posterior al wizard** y es el
   **primer paso del onboarding**. Motivo del owner, que es de negocio y no de seguridad: «hoy
   Staff es gratis, pero va a pasar a ser parte del plan de pago quizas».
2. **Slug** — no sigue al nombre. Se cambia por **accion explicita** con chequeo de disponibilidad.
3. **PIN** — hasheado; **5 fallos → 15 min, 3 mas → 1 h, el siguiente → 24 h**; el owner lo ve
   **una sola vez** al generarlo y despues **solo puede regenerarlo**.
4. **Pais** — prellenado pero el selector ofrece **siempre la lista completa** (VPN). No hay caso
   de pais no soportado: **por ahora solo LATAM**.

### El arco se corta en CUATRO specs (propuesta del orquestador, NO acordada con el owner)

El ADR 0070 no entra en una spec sola. Orden propuesto, por dependencia:

| Spec | Que | Estado |
|---|---|---|
| **0067** | **Identidad sin contraseña** — owner por email + link magico, staff por `handle@slug` + PIN, gate de email verificado, slug del negocio, borrado del arco de recuperacion y de la UI vieja, wipe de la base | **`implementada` — 4 pasos, 4 `PASS`, commit `9086c9a` pusheado y CI verde (2026-09-17)** |
| 2ª | **El wizard de 3 pantallas + el QR** — logica de pantallas 2 y 3, categoria `gcid:`, paises + Mexico, sello placeholder, programa activo | no existe |
| 3ª | **Capa de entitlements** — `can()` / `limitOf()`, migrar los 3 call-sites que ya divergieron | no existe |
| 4ª | **Onboarding derivado** — checklist calculado de los hechos de la base, sin columna `onboarding_step` | no existe |

**Corte de 4 specs confirmado por el owner el 2026-09-16.** Se serializan en ese orden: la 2ª consume
`server/slug.ts` y la migracion del `slug` que deja lista la 0067.

**Por que 0067 va primera:** owner y staff comparten **hoy** la misma pantalla de login
(`login-form.tsx:49`) y el staff se crea con `signUpEmail` + contraseña (`staff.ts:119`). La
identidad es una sola rebanada vertical; partirla deja la app en un estado intermedio roto.

### HALLAZGO 8 — `start` tiene la MISMA preimagen y NO se toco

`POST /api/merchant/auth/start` con un email conocido `@staff.invalid` cae en la rama del link
magico, **emite token y gasta cupo igual**. El fix es **una linea** con el predicado que ya esta en
el arbol. No se aplico porque cambia una rama del contrato que el revisor ya valido y que es **el
oraculo de la mutacion #4**: es alcance que decide el owner. Se le pregunto al revisor si coincide o
si es el mismo bloqueante en otra puerta — **esa respuesta decide si el paso 3 es `PASS`.**

### DECISIONES DEL OWNER, no del orquestador (ninguna tomada)

1. **EL MAS IMPORTANTE — el gate de email verificado cubre 2 superficies de API de 6.** Medido:
   `rg 'emailVerified|email_not_verified' apps/merchant/src/app/api/` solo aparece en
   `api/staff/_auth.ts:50`. **No lo tienen** `api/billing/_auth.ts`, `api/locations/_auth.ts`,
   `api/marketing/_auth.ts`, `api/catalog/_auth.ts` ni `api/brand`: los cuatro resuelven owner con
   `ownerContext` y nada mas. **En el mundo del ADR 0070 —la UI la construye el owner por fuera y
   consume API— `requireBackofficeSession` deja de ser la puerta**, asi que un owner sin verificar
   puede crear sucursales, subir marca, armar campañas y abrir un checkout de Stripe: literalmente
   «todo lo posterior al wizard» que el ADR §11 manda bloquear. No es bloqueante porque el DoD pide
   «una ruta owner-only» (singular) y eso se cumple. **Ojo con el falso consuelo:**
   `billing-routes-auth.neon` NO falsifica esto — su seed pone `emailVerified: true`, asi que nunca
   ejercita el caso.
2. **El `503 staff_unavailable` no cubre la resolucion de sesion en 3 rutas** (`api/staff/route.ts`,
   `.../pin/regenerate`, `.../business/slug`): `requireStaffOwner` esta **fuera** del `try`.
   **El revisor aplico la CONDICION DE CORTE** —es la segunda vuelta de la misma clase de hallazgo,
   el paso 2 ya cazo lo mismo en las otras dos rutas— y por regla va al owner en vez de abrir otra
   ronda. Arreglo si se toma: mover `requireStaffOwner` adentro del `try` en las tres.
3. **`app/page.tsx` ya no rebota la sesion viva a `/backoffice`** (forzado por el bucle real).
4. **`emailOTP` quedo vivo y sin uso**: su superficie HTTP esta cerrada (los 9 paths en
   `disabledPaths`, medido contra la fuente), pero es configuracion muerta.
5. **Cambiar el slug cambia el identificador de login de todo el staff sin aviso.** El revisor midio
   que **no** hay cascada de bloqueos (el 401 sale antes de `registerPinAttempt`): es problema de
   comunicacion, no de disponibilidad.
6. **`staff-console.tsx`** sigue perdiendo la credencial del integrante en cada alta.
7. Los cupos del rate limit (20/IP/h, 5/email/h, 10/email/dia) **los eligio el implementador**.



Reproducido por el orquestador, no citado del agente: `typecheck` 3/3 **sin cache**, `lint` exit 0,
`format:check` OK, `test` **1013 passed / 343 skipped / 0 failed**, y **`build` 3/3 successful sin
cache** —lo que mas podia romperse al borrar pantallas—. `rg MUTATION` vacio. **Los dos barridos de
la §7-bis dan VACIO.**

**Las cuatro mutaciones (#3, #4, #5, #6) salieron ROJAS por la asercion correcta**, corridas al final
y de a una. **La #6 no quedo verde**, que era el riesgo declarado: el guard **si** tiene oraculo de
destino (`expected '/login' to be '/'`).

**El TERCER barrido mal escrito del DoD, y la spec ya quedo corregida.** Pedia que
`rg 'PASSWORD_RECOVERY_ENABLED|forgot-password|merchant-recovery'` diera cero, y es **imposible**:
devuelve exactamente `server/slug.ts:35` y `server/slug.test.ts:114`, que son la palabra **reservada**
que la §1 de la misma spec manda tener en `RESERVED_SLUGS` con piso aseverado. Quitarla violaria la §1
y liberaria un slug que tiene que seguir reservado. Van **tres** defectos de la misma familia
(§7-bis corrigio los dos primeros): **el patron es escribir un barrido `rg` como DoD sin correrlo
contra el arbol**. Candidato a `LECCIONES.md` cuando cierre el arco.

**Lo que el implementador resolvio y hay que mirar con cuidado** (esta en el encargo del revisor):

- **El gate no podia mandar a `/onboarding?v=1`** como decia la spec §3, porque esa ruta **se borra
  en este mismo paso**. Eligio `/?e=email_not_verified`, por el mismo canal `?e=` que ya usa
  `staff_disabled` y que ya esta en la tabla de codigos de rebote del contrato.
- **Habia un bucle de redireccion REAL y no lo abrio el gate**: `app/page.tsx` rebotaba la sesion
  viva a `/backoffice`, y con los tres `redirect` del guard yendo a `/`, el caso «sesion sin
  membresia» cerraba `/` → `/backoffice` → `/`. Lo resolvio **borrando** ese rebote. **Es un cambio
  de comportamiento que el owner no pidio** y va como hallazgo, no como aceptado.
- **Como sale el owner del rebote**: consumir el link magico **verifica el email** (medido en
  better-auth 1.6.26). **Si eso fuera falso, el producto queda cerrado con llave.** Es lo mas
  importante de la revision del paso 3.
- **`emailAndPassword: false` NO da 404**: better-auth sigue montando `/sign-in/email` y contesta
  **400**. Su primer test asertaba 404, salio rojo, y **corrigio el test contra la medicion, no al
  reves**.

### HALLAZGOS DEL PASO 2 — A DECIDIR POR EL OWNER, no estan tomados

1. **`app/backoffice/staff/staff-console.tsx` quedo obsoleta y el paso 2 NO la toco** (tenia
   prohibido tocar `app/` fuera de `api/`). Sigue pidiendo email + contraseña, el servidor
   los ignora, y **no muestra el PIN**, que se ve una sola vez: usada tal cual, da de alta al
   integrante y pierde su credencial. Es UI vieja de lo que se refactoriza, o sea candidata
   al borrado del ADR 0070 §17 en el paso 3.
2. **El cambio de PIN rechaza `newPin === currentPin` con 400 `pin_unchanged`.** Es lectura
   del «cambio obligatorio», no una regla que el owner haya escrito. Si prefiere permitirlo,
   es una linea.
3. **¿El PIN se evalua tambien cuando hay un bloqueo vivo?** Hoy si: el guard esta adentro
   del `UPDATE` atomico y consultarlo antes seria el read-then-write que la spec prohibe.
   Cuesta un hash por intento bloqueado y regala tiempo de respuesta constante. La spec §4
   escribe «sin evaluar el PIN»; el codigo cumple lo observable, no el orden.
4. **El `DEFAULT` volatil del slug sigue vivo** (hallazgo 1 del paso 1). El paso 2 no toca la
   ruta del alta del negocio, asi que la decision sigue abierta para el paso 3.

## HALLAZGOS DEL PASO 3 — A DECIDIR POR EL OWNER, no estan tomados

1. **El DoD de la spec pide un barrido que es IMPOSIBLE de dejar en cero, y esta vez es la §1 la que
   lo hace imposible.** `rg -n "PASSWORD_RECOVERY_ENABLED|forgot-password|merchant-recovery"
   apps/merchant/src` devuelve **exactamente dos lineas**: `server/slug.ts:35` y
   `server/slug.test.ts:114`, que son la palabra **reservada** `"forgot-password"` que la propia
   spec §1 manda tener en `RESERVED_SLUGS` (y que el test asevera con piso, por PASS del paso 1).
   No se toco: quitarla violaria la §1 y liberaria un slug. Los otros dos barridos —los que la
   §7-bis declara como los que corre el revisor— **dan VACIO**.
2. **`emailOTP` quedo vivo y ya no sirve para nada.** Su unico `type` configurado es
   `forget-password`, sus 9 paths siguen en `disabledPaths` y su unico consumidor server-side
   (`server/recovery/*`) se borro en este paso. Lo mismo `passwordResetEmail` en
   `server/email/channel.ts`. **No se toco porque la spec enumera exactamente que cambia en
   `auth.ts`** («sacar `emailAndPassword`, sumar `magicLink`, ampliar `disabledPaths`») y sacar un
   plugin es superficie de producto. Si el owner lo quiere fuera, son ~25 lineas y el guard de
   `disabledPaths` hay que reescribirlo (sin plugin, esos 9 paths dan 404 igual y el test dejaria
   de discriminar).
3. **Cambiar el slug cambia el identificador de login de TODO el staff** (`handle@slug`). Es
   inherente a que el ADR 0070 §5 los haga el mismo identificador. El `PATCH` no avisa, no pide
   confirmacion y no da periodo de gracia. Esta declarado en el contrato §8.
4. **`POST /api/merchant/auth/start` con el email SINTETICO de un integrante** (`@staff.invalid`)
   entra en la rama del email conocido e intenta mandarle un mail a un dominio que por RFC 2606
   nunca resuelve. No abre sesion (el invariante se sostiene) y el buzon no existe, pero segun el
   proveedor la respuesta puede ser un 503 en vez de un 200 — o sea un canal fino para distinguir
   un `user` de staff de uno de owner. No se filtro a proposito: filtrar seria agregar una regla
   que el owner no pidio.
5. **El `DEFAULT` volatil del `slug` sigue vivo** (hallazgo 1 del paso 1, ahora exigible). Ya hay
   una ruta que escribe el slug, asi que el `DEFAULT` cumplio su funcion; mientras viva, **una ruta
   que se olvide del slug no falla, se lleva un `b-…` de URL publica**. Quitarlo sigue costando los
   15 errores de tipo que midio el orquestador en el paso 1.
6. **Los cupos del rate limit de `start` (20/IP/h, 5/email/h, 10/email/dia) los eligio el
   implementador, no el owner.** La spec solo pide «rate limit por IP». Estan en el contrato §5 y
   pinneados por `auth-start.test.ts`; moverlos es una linea.
7. **`app/backoffice/staff/staff-console.tsx` sigue obsoleta** (hallazgo 1 del paso 2, sin cerrar):
   pide email + contraseña, el servidor los ignora y no muestra el PIN. El paso 3 **no** la borro:
   la spec enumera que pantallas se borran y esa no esta. Es candidata al §17 en la spec del wizard.

### Lo que el paso 3 declara AFUERA (sin oraculo, a proposito)

- **La entregabilidad del mail** del link magico: se verifica que se **encola** por el canal
  (`EMAIL_PROVIDER=console` en los tests), no que llegue a una bandeja. Ya lo declaraba la spec.
- **El QA de pantalla**: no existe, y a partir de este paso **tampoco existe la pantalla**. La
  verificacion por `curl` contra un preview **no se corrio**: exige un deploy y este trabajo no se
  commitea ni se pushea.
- **La carrera de dos `start` simultaneos con el mismo email desconocido**: el codigo la resuelve
  con el unico de `merchant_auth.user` (el perdedor cae en la rama del email conocido) pero
  **racearla de verdad no se hizo** — mismo criterio que la carrera del PIN.
- **El limite heredado de `merchant-session.ts`**: su `serializeCookie` no replica los fallbacks de
  `__Secure-`/`__Host-`. Hoy es inocuo y el paso 3 lo reusa tal cual, sin tocarlo.

## ESTADO DEL ARBOL (reescrito entero el 2026-09-17, al cerrar la 0067)

- **La 0067 esta COMMITEADA Y PUSHEADA**: commit `9086c9a`, 91 archivos, +24.149 / -2.747.
  **Verificado con `git rev-parse HEAD` y `git rev-parse origin/main` dando el mismo sha** — no por
  asumirlo: esta cabecera ya mintio dos veces en sesiones anteriores por dar el push por hecho.
- **CI VERDE, leido del endpoint correcto.** `/check-runs` del sha: `verify: completed -> success`,
  cero checks que no sean `success`. Pasos leidos uno por uno: `lint`, `typecheck`,
  **«Migrar la rama Neon de CI» → success** (las tres migraciones `0032`/`0033`/`0034` aplicadas
  limpias en CI, incluida la que **dropea** `merchant_auth.password_reset_attempt`),
  `Unit + integracion Neon`, e2e, `build`, `format:check`.
  **`/status` NO sirve para esto y ya esta corregido en `CLAUDE.md`**: devolvio `success` con la CI
  todavia corriendo porque ahi solo publica Vercel (caso en `LECCIONES.md`).
- **Aquellos 3 archivos de documentacion YA se commitearon** en `b2fef3d`, pusheado (HEAD ==
  origin/main, verificado). **Lo que queda sin commitear hoy** son 4, todos documentacion: la spec
  0068, su fila en `docs/INDEX.md`, las filas 56 y 57 de `docs/PARQUEADO.md` y este
  `docs/TASKS.md` — **el owner no autorizo ese commit todavia**.
- **El arbol de codigo esta LIMPIO**: la sesion de la 0068 **no toco una sola linea de
  `apps/`**. La unica sonda que se corrio (`Object.keys(auth.api)` y los 4 endpoints core de
  password) vivio en un archivo temporal que **se borro**, verificado con `git status` vacio.
- **`rg -n MUTATION apps packages tools`: VACIO.** Las 6 mutaciones del presupuesto mas las 4 extra
  declaradas se corrieron de a una y se revirtieron con `diff` vacio contra copia limpia.
- **Las migraciones NO estan aplicadas en PRODUCCION**, solo en CI y en la rama de integracion
  (`br-shy-king-axu5s3ze`). Produccion se toca con el borrado de datos que el owner autorizo
  (seccion 2 del handoff), y ahi se **confirma el objetivo en el momento** antes de ejecutar.
- Gates de root con Node 24 (v24.20.0) sobre el arbol commiteado: `typecheck` 3/3 sin cache, `lint`
  exit 0, `test` **1017 passed / 344 skipped / 0 failed**, `format:check` OK, `build` 3/3 sin cache.
  Con el env de integracion: **182 archivos / 1349 passed / 0 failed**.
- **`drizzle-kit check` → `Everything's fine`; `generate` → `No schema changes`**: sin drift entre el
  esquema y los snapshots.
- La spec 0065 (campaña de proximidad) sigue **cerrada** — QA del owner en verde. La 0066
  (reparacion del harness), **implementada con PASS**. Deuda declarada en `docs/PARQUEADO.md`.

## ⇥ BITACORA DE MUTACIONES — SPEC 0069 (abierta 2026-09-17, ANTES de medir)

**Punto de retorno.** Copia limpia de cada archivo en `/tmp/clean-*.ts`. Si una mutacion queda
viva: `cp /tmp/clean-<x>.ts <archivo>` y verificar el `shasum` de abajo. **`qr/route.ts` es `??`
(sin commitear): `git checkout` NO lo salva, solo la copia de `/tmp`.**

| # | Archivo | `shasum` limpio | Invariante que ataca | Alcance de la medicion | Resultado EJECUTADO |
|---|---|---|---|---|---|
| 1 | `apps/merchant/src/app/api/onboarding/business/route.ts` | `95637e027dc54283f3feaa6a40980370bb01fb80` | la categoria del alta se valida contra la lista curada (`isBusinessCategory`) | `onboarding-business.neon.integration.test.ts` | **ROJO** — «una categoria fuera de la lista ("gcid:inventado") responde 400 y no escribe nada»: `AssertionError: expected 201 to be 400`. Verificado ademas por SQL: la corrida mutada dejo una fila `core.business` con `category_gcid = 'gcid:inventado'` (huerfana, borrada despues). 10 failed / 1 passed — las otras 9 son COLATERAL del «un negocio por owner» (409) y no se arreglaron |
| 2 | `apps/merchant/src/server/loyalty-program/client-view.ts` | `d23d6846c78b421e104f87b7dcc4bb8b4afe0161` | `stampImagePath` se emite SIEMPRE, con sello o sin el (si no, el placeholder es codigo muerto) | `loyalty-client-view.test.ts`, `loyalty-program.test.ts`, `loyalty-stamp-placeholder.neon` | **ROJO 5 tests / 18 passed**: «un programa SIN sello expone un path NO nulo» y «un sello REMOVIDO … usa su version» (`expected null to be '/api/public/loyalty/…'`), «el consumidor hereda el path del sello» (idem — o sea que la propagacion a `consumer/programs.ts` esta cubierta), `loyalty-program.test.ts > never serializes the internal stamp key` y el `.neon` «el programa SIN sello expone un stampImagePath no nulo» |
| 3 | `apps/merchant/src/server/loyalty-program/stamp.ts` | `37379485f888a7943003b390b0a964e5d9de5fd0` | una version que NO matchea es 404, nunca placeholder (un sello real no puede verse tapado por la letra) | `loyalty-stamp-placeholder.neon`, `loyalty-stamp.neon` | **ROJO 3 tests / 5 passed**: «con un sello puesto > una version VIEJA sigue siendo 404, NO el placeholder» (`expected { kind: 'placeholder', …(1) } to be null`), «sin sello, una version que no es la vigente ya es 404» (`expected 200 to be 404` — el status de la RUTA) y el `loyalty-stamp.neon` heredado |
| 4 | `apps/merchant/src/app/api/public/loyalty/[businessId]/[programId]/stamp/route.ts` | `c47740a9513fe2e628c86426efb204274aef1ea9` | la ruta publica NUNCA serializa `stampImageObjectKey` (ni en cuerpo ni en header) | `loyalty-stamp-route.test.ts` | **ROJO 1 test / 6 passed** — «NUNCA serializa la clave interna de R2: ni en el cuerpo ni en un header»: `expected 'cache-control: …' not to contain 'loyalty/biz-1/prog-1/8f3c2a'`, con el `+ x-stamp-object-key: loyalty/biz-1/prog-1/8f3c2a` en el diff. La fuga se escribio por un HEADER, que es el canal que un oraculo que solo mira el cuerpo no ve |
| 5 | `apps/merchant/src/app/api/loyalty-program/qr/route.ts` | `a645e440ef491dedcbb656805454ec7a6baabbea` | el `programId` sale de la SESION, nunca del query (aislamiento entre negocios) | `loyalty-qr.neon.integration.test.ts` | **ROJO 1 test / 6 passed** — «el programId del QUERY se ignora: A no alcanza el programa de B»: `Expected "…/enroll/f7a630fa-…" / Received "…/enroll/8ef1d3eb-…"`, o sea el QR del negocio B. El oraculo DECODIFICA el QR (sharp + jsqr), no mira «vino un SVG» |


**Las 5 se corrieron de a una, se revirtieron con `cp` desde la copia limpia de `/tmp` y el `diff`
contra esa copia dio VACIO; el `shasum` posterior coincide con el de la tabla en los 5 casos.**
`rg -n MUTATION apps tools` → **vacio** (exit 1).

**Condicion de corte (ADR 0062): NO se aplico** — ninguna vuelta termino en «el fix abrio la
siguiente». Las 5 salieron rojas a la primera y por la asercion correcta.
### Nota sobre los `shasum` de la tabla de arriba

Los `shasum` de la bitacora son el **punto de retorno DURANTE la ronda de mutaciones** y siguen
siendo validos como tales (las 5 se revirtieron y el `shasum` posterior coincidio en los 5 casos).
**Despues** de la ronda, tres archivos cambiaron por el gate de `lint`/`typecheck` —ninguno por
una mutacion— y su `shasum` actual es otro:

- `apps/merchant/src/server/loyalty-program/client-view.ts` → `68817d52870852f41f912a5813a25b0a1ad46faf`
  (`void stampImageObjectKey;` para el `no-unused-vars`, idiom de `wallet/push-transports.ts:46`)
- `apps/merchant/src/server/onboarding/program-defaults.test.ts` → `fb8d67e23c27c9a89a1912c85c334800d46d5e6c`
- `apps/merchant/src/server/loyalty-qr.neon.integration.test.ts` → `03d6aff8e46d6608aeb2804f1efb288fd58b0b89`

## ⇥ ESTADO DE LA SPEC 0069 (implementador, 2026-09-17) — FALTA LA REVISION INDEPENDIENTE

**La spec 0069 esta IMPLEMENTADA por el implementador y NO marcada como `implementada`: eso lo
decide un revisor independiente con un `PASS` verificable (ADR 0071 §3).** El `estado` de su fila
en `docs/INDEX.md` sigue en `cerrada` a proposito.

**Entregado** (18 archivos de `apps/` + 1 doc nuevo; **cero `.tsx`**, barrido con
`git status --short | grep -c '\.tsx'` → **0**):

- Migracion **`0035_categoria_del_negocio.sql`** (generada con `drizzle-kit generate`, con su
  snapshot y su fila de journal) + `category_gcid` en `schema/business.ts`.
  **Aplicada a la rama de INTEGRACION** (`br-shy-king-axu5s3ze`) con `db:migrate` y verificada por
  SQL (`information_schema.columns` → `text`, `NOT NULL`, default `'gcid:store'::text`).
  **NO aplicada a produccion**: eso es paso del orquestador DESPUES del PASS.
- `lib/business-categories.ts` (las 15 `gcid:` + `isBusinessCategory`), Mexico en
  `SUPPORTED_COUNTRIES` (9 paises, **una** lista), `GET /api/onboarding/prefill`,
  `POST /api/onboarding/program` + `server/onboarding/program-defaults.ts`,
  `server/loyalty-program/stamp-placeholder.ts`, el path del sello **siempre** en `client-view.ts`,
  `stampForPublicProgram` distinguiendo los dos `null`, la ruta publica sirviendo el placeholder, y
  `GET /api/loyalty-program/qr` (SVG/PNG 1024²/descarga) con `renderEnrollQrPng`.
- **`docs/specs/0069-contratos-de-api.md`** — el contrato HTTP normativo, 5 endpoints con todos sus
  `code`, mas la declaracion de estado actual de las 4 rutas de `/api/loyalty-program` sin `code`.

**Split obligado por el hook `file-size`:** `schema/business.ts` llegaba a **308** lineas al sumarle
la columna, asi que `subscription` y `stripe_webhook_event` se mudaron a
**`schema/billing.ts`** (nuevo) y el barrel `server/schema.ts` lo reexporta. Mismo motivo por el que
`staff-pin.ts` ya vivia aparte. Verificado sin drift: `drizzle-kit check` → «Everything's fine» y
`drizzle-kit generate` → «No schema changes».

**Gates corridos una sola vez al final** (Node **v24.20.0**, scripts de root):
`typecheck --force` **3/3 sin cache** · `lint` **exit 0** · `format:check` **OK** ·
`test` **122 files / 1088 passed / 390 skipped / 0 failed** · `test` **con el env de integracion**
**199 files / 1478 passed / 0 failed** · `build --force` **3/3 sin cache** (las 3 rutas nuevas
aparecen en el manifiesto) · `rg -n MUTATION apps tools` **vacio**.

**Dos tests preexistentes se CORRIGIERON contra el contrato nuevo (no se borraron), y hay que
mirarlo en la revision:** `loyalty-program.test.ts` («never serializes the internal stamp key»)
aseveraba `stampImagePath: null` sin sello, y `loyalty-stamp.neon.integration.test.ts` aseveraba
`stampForPublicProgram(...) === null` sin sello. Las dos pinneaban **justo lo que la §D5 cambia**.

