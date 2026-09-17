---
spec: 0069
fecha: 2026-09-17
estado: implementada
resumen: 2a spec del arco del alta (ADR 0070). Entrega la API de las pantallas 2 y 3 del wizard y del QR final — categoria `gcid:` obligatoria (columna nueva), Mexico, prellenado de pais/moneda/timezone/sesgo geografico, creacion del programa desde dos campos, sello placeholder generado en servidor, y el QR descargable como SVG o PNG — mas su contrato HTTP normativo. NO entrega interfaz (ADR 0070 §16).
disjunta: si
archivos: apps/merchant/drizzle/0035_categoria_del_negocio.sql, apps/merchant/src/server/schema/business.ts, apps/merchant/src/lib/business-categories.ts, apps/merchant/src/server/location-providers.ts, apps/merchant/src/app/api/onboarding/business/route.ts, apps/merchant/src/app/api/onboarding/prefill/route.ts, apps/merchant/src/app/api/onboarding/program/route.ts, apps/merchant/src/server/onboarding/program-defaults.ts, apps/merchant/src/server/loyalty-program/stamp-placeholder.ts, apps/merchant/src/server/loyalty-program/stamp.ts, apps/merchant/src/server/loyalty-program/client-view.ts, apps/merchant/src/app/api/public/loyalty/[businessId]/[programId]/stamp/route.ts, apps/merchant/src/app/api/loyalty-program/qr/route.ts, apps/merchant/src/server/brand-kit/qr.ts, docs/specs/0069-contratos-de-api.md
---

# 0069 — El wizard de alta es API: negocio con categoria, programa, sello y QR

> **Nada de codigo empieza sin esta spec en `cerrada`.**
>
> La subespecificacion es el gatillo medido del exito fingido: ~50% en tareas vagas, 0% en
> tareas resolubles y bien definidas.

## Problema

El ADR 0070 corta el alta en un wizard de tres pantallas que termina en el QR. La spec 0067
entrego la **pantalla 1** (identidad sin contraseña) y **borro la UI vieja del wizard**
(`app/onboarding/page.tsx` ya no existe, verificado: `ls apps/merchant/src/app/` no lo lista).

Hoy, medido contra el arbol:

1. **No hay categoria de negocio.** `rg 'gcid'` sobre `apps/` y `packages/` no devuelve un solo
   hit de negocio — los matches de «categoria» que existen son del **catalogo de productos**,
   otro dominio. `core.business` no tiene la columna. El ADR §7 la declara **obligatoria**.
2. **Mexico no esta soportado.** `server/location-providers.ts:23` tiene 8 paises
   (AR BR CL CO EC UY PY PE) y ninguno es MX, asi que `isSupportedCountryCode('MX')` es `false`
   y el alta lo rechaza con 400. `lib/currencies.ts:23` **ya** mapea `MX → MXN`.
3. **No hay prellenado.** El ADR §8 pide pais por IP, timezone por dispositivo y sesgo
   lat/long para el autocomplete. No existe ninguna ruta que lo entregue.
4. **La pantalla 3 no es alcanzable con dos campos.** `PUT /api/loyalty-program` existe y crea
   (201 via `saveProgram`), pero `validateProgramInput` **exige al menos una clausula de
   terminos** (`loyalty-program/validation.ts:144`, «Añade al menos una cláusula de términos»),
   ademas de `configuration.unitName` y un `target` entero 2..50 para `stamps`
   (`validation.ts:159-171`) y **exactamente un premio** (`rewards.ts:22-26`). El wizard pide
   dos cosas: cada cuantos sellos y que premio. Sin una capa que componga, la UI de afuera
   tendria que inventar los terminos.
5. **El sello placeholder no llega a ningun consumidor por donde el ADR dice.** El ADR §«Lo que
   se midio» (2) afirma que alcanza con implementarlo dentro de la ruta publica «y lo reciben
   todos los consumidores sin tocar ninguno». **Medido: es falso.**
   `loyalty-program/client-view.ts:81-83` devuelve `stampImagePath: null` cuando
   `stampImageObjectKey` es null, o sea **la URL nunca se construye** y la ruta publica **nunca
   se llama**. Un placeholder escrito solo dentro de la ruta seria **codigo muerto**.
6. **El QR existe pero no tiene endpoint.** `brand-kit/qr.ts` (`renderEnrollQr`, nivel H) y
   `brand-kit/enroll-url.ts` estan en el arbol y hoy solo los consume el kit del backoffice
   (server components). No hay ruta HTTP que devuelva el QR, y no hay forma de descargarlo.

## Alcance

**Entra:**

- Columna `core.business.category_gcid` + migracion `0035`.
- Lista curada de categorias `gcid:` versionada en el repo (15 entradas, §D1).
- Mexico en `supportedCountryCodes`.
- `GET /api/onboarding/prefill` — prellenado + catalogo de categorias + lista completa de paises.
- `POST /api/onboarding/business` — categoria obligatoria.
- `POST /api/onboarding/program` — compone el `ProgramInput` completo desde dos campos.
- Sello placeholder generado en servidor, **y el cableado que lo hace alcanzable**.
- `GET /api/loyalty-program/qr` — SVG o PNG, con descarga.
- **El contrato HTTP normativo** (`docs/specs/0069-contratos-de-api.md`), que es entregable
  critico del arco (ADR 0070 §17): es el insumo de quien construye la UI.

**No entra** (explicito, para cortar el scope creep):

- **Ninguna pantalla.** El arco entrega API (ADR 0070 §16). Una fila de esta spec que liste un
  `.tsx` de pantalla como «crear» esta mal alcanzada — y por eso la tabla de §«Archivos» **no
  tiene un solo `.tsx`**: son `.ts` de servidor, la migracion y los dos documentos. Ese es el
  barrido que lo verifica.
- Logo, colores y sello propio: son la «marca avanzada» del onboarding (3a/4a spec).
- El poster armado del kit: el owner eligio **QR pelado** porque en el wizard todavia no hay ni
  color ni logo.
- La capa de entitlements (3a spec) y el onboarding derivado (4a spec).
- El gate de email verificado en las superficies de API que no lo tienen: vive en
  `PARQUEADO.md` fila 56. **Esta spec no lo agrega ni lo saca.**
- `core.business.status`: `PARQUEADO.md` fila 57, es de la 3a spec.

## Diseño

### D1 — Categoria: columna nueva + lista curada

Columna `category_gcid text NOT NULL DEFAULT 'gcid:store'` en `core.business`.

**El DEFAULT no es la regla de producto** — es el mismo patron ya documentado para `slug` en
`schema/business.ts:37-42`: `ADD COLUMN … NOT NULL` sobre una tabla con filas falla sin default,
y las ramas de Neon de CI e integracion **tienen filas** aunque produccion este vacia. La regla
de producto es **obligatoria en la ruta de alta**: sin `categoryGcid` valido, `400`.

`lib/business-categories.ts` exporta la lista curada y un `isBusinessCategory()`. Las 15
entradas confirmadas por el owner el 2026-09-17:

`gcid:restaurant`, `gcid:cafe`, `gcid:bakery`, `gcid:bar`, `gcid:pizza_restaurant`,
`gcid:ice_cream_shop`, `gcid:beauty_salon`, `gcid:barber_shop`, `gcid:nail_salon`, `gcid:gym`,
`gcid:pharmacy`, `gcid:grocery_store`, `gcid:clothing_store`, `gcid:pet_store`, `gcid:car_wash`.

Cada una con su `displayName` en español. El dia que Google apruebe el Basic API Access la
lista se reemplaza por la API **sin migrar un dato** (ADR §7): por eso se guarda el `gcid:`
crudo y no un enum propio.

### D2 — Mexico

Agregar `"MX"` a `supportedCountryCodes` (`location-providers.ts:23`). **Es UNA lista, no dos**:
el ADR §14 dice dos porque contaba `app/onboarding/page.tsx:18`, que la 0067 **borro**.
`COUNTRY_CURRENCY` ya cubre MX → MXN y no se toca.

### D3 — `GET /api/onboarding/prefill`

Sesion de owner requerida; **no** exige email verificado (ADR §11: la verificacion bloquea lo
posterior al wizard, no el wizard). Devuelve:

- `countries`: la lista **completa** de soportados con su nombre y moneda. Nunca recortada a lo
  detectado (ADR §14: la deteccion es sugerencia, jamas filtro).
- `suggestedCountryCode`: de `x-vercel-ip-country`, `null` si no viene o no esta soportado.
- `bias`: `{ latitude, longitude }` de `x-vercel-ip-latitude` / `x-vercel-ip-longitude`, o
  `null`. Para sesgar el autocomplete de Geoapify.
- `categories`: las 15 de §D1.

El **timezone lo resuelve el cliente** con `Intl.DateTimeFormat().resolvedOptions().timeZone` —
es exacto ahi y adivinado en el servidor. El contrato lo dice explicito para que la UI de afuera
no lo espere del endpoint.

### D4 — `POST /api/onboarding/program`: dos campos adentro, `ProgramInput` completo afuera

Entrada: `{ target: int 2..50, reward: { type: "custom", label: string } }`.

`server/onboarding/program-defaults.ts` compone el `ProgramInput` que `saveProgram` exige:

- `kind: "stamps"`, `configuration: { unitName: "sello", target }`.
- `rewards: [reward]` — exactamente uno, que es lo que `rewards.ts:22-26` pide para `stamps`.
- `clauses`: los `templateId` de las **semillas** `earning` y `redemption` de
  `core.terms_template` (`drizzle/0004_polite_turbo.sql:97-100`). `transition` **no** entra: es
  la clausula del cierre. Estas son las semillas que se excluyeron a proposito del truncate de
  produccion; si faltaran, la ruta responde `503 terms_unavailable` en vez de escribir un
  programa sin terminos.
- `stampAction: "keep"` — el wizard no sube imagen; de ahi sale el placeholder de §D5.

Reusa `saveProgram`, que **ya** nace `status: 'active'` (`schema/loyalty.ts:28`, default
`'active'`): «programa activo» no es trabajo nuevo, es una propiedad a **verificar**, no a
construir.

### D5 — Sello placeholder, y el cableado que lo hace alcanzable

`stamp-placeholder.ts` genera un SVG cuadrado con **la primera letra del nombre del negocio**,
en **`#1A1A1A`** — negro no puro, decision del owner del 2026-09-17: el recuadro del sello
siempre es blanco, asi que tiene que leerse ahi. Fondo transparente. La letra se toma con
segmentacion de grafemas del nombre ya normalizado; un nombre sin letra latina cae a `•`.

Se rasteriza con **`sharp`, que ya es dependencia (0.35.3)**. **Verificado ejecutandolo, no
asumido** (Node 24.20.0, vips 8.18.3): un SVG de QR de 2.421 bytes rasteriza a un PNG
**1024×1024 de 50.316 bytes**. No hace falta dependencia nueva. **Ojo:** `assets/image.ts`
**rechaza SVG** en la subida — el placeholder no pasa por ese pipeline, se genera en servidor.

**Lo que hace falta ademas de la ruta, y es el hallazgo que corrige al ADR:**

- `client-view.ts:81-83` debe emitir el path **siempre**, no solo con `stampImageObjectKey`.
  Sin sello, la version del path es `0` (`stamp_image_version` default `0`).
  **Es el UNICO cuello**: `rg 'public/loyalty'` sobre `apps/merchant/src` (sin tests) devuelve
  esa sola linea como constructora de la URL.
- `consumer/programs.ts` consume `clientProgram.stampImagePath` (linea 142) y hereda el arreglo;
  el implementador **verifica** que asi sea en vez de asumirlo.
- **`counter/core.ts` NO se toca.** Se midio y la primera version de esta spec lo afirmaba mal:
  `programDTO` **no serializa ningun path de sello** — su docblock (`core.ts:168`) dice que
  expone «only the public stamp path» y el objeto que devuelve **no tiene ese campo**. El
  docblock esta desactualizado; corregirlo no es alcance de esta spec (§«Abierto»).
- `stampForPublicProgram` (`stamp.ts:233-263`) hoy devuelve `null` por **dos motivos
  distintos**: sin sello, y version que no matchea. **Debe distinguirlos.** Sin sello → el
  placeholder. Version vieja → **sigue siendo 404**: si una URL cacheada y vencida sirviera un
  placeholder, un sello real recien subido se veria reemplazado por la letra, que es peor que
  el 404. Esto es un oraculo del plan de pruebas, no un detalle.

**Invariante que no se negocia:** la ruta publica **nunca** serializa `stampImageObjectKey`.

### D6 — `GET /api/loyalty-program/qr`

Sesion de owner; resuelve el programa por `programForOwner(session.user.id)` — **el programId
nunca sale del body ni del query**, igual que el slug del staff sale de la sesion (ADR §15.3).

- `?format=svg` (default) → `image/svg+xml`.
- `?format=png` → `image/png`, **1024×1024**, rasterizado con `sharp`.
- `?download=1` → agrega `content-disposition: attachment; filename="qr-<slug>.<ext>"`. El slug
  del negocio ya esta en la base. Es lo que le permite al comerciante **guardarlo en el
  telefono** hasta que lo imprima o arme el poster en el onboarding (pedido del owner).

Encodea `enrollUrl(origin, programId)` de `brand-kit/enroll-url.ts`, con el `origin` derivado
del request (no hay helper de URL por env en este repo). Nivel de correccion **H**, el que ya
usa `renderEnrollQr`. Sin programa → `404 no_program`.

### Arquitectura de referencia

ADR 0070 (§7 categoria, §8 pais, §9 onboarding derivado, §11 verificacion, §14 lista completa,
§15.3 lo que sale de la sesion, §16 API y contrato, §17 sin QA de pantalla), ADR 0071 (proceso),
ADR 0042 (esquema de URL de enroll), spec 0055 (forma del contrato).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0035_categoria_del_negocio.sql` | crear |
| `apps/merchant/src/server/schema/business.ts` | editar |
| `apps/merchant/src/lib/business-categories.ts` | crear |
| `apps/merchant/src/server/location-providers.ts` | editar |
| `apps/merchant/src/app/api/onboarding/business/route.ts` | editar |
| `apps/merchant/src/app/api/onboarding/prefill/route.ts` | crear |
| `apps/merchant/src/app/api/onboarding/program/route.ts` | crear |
| `apps/merchant/src/server/onboarding/program-defaults.ts` | crear |
| `apps/merchant/src/server/loyalty-program/stamp-placeholder.ts` | crear |
| `apps/merchant/src/server/loyalty-program/stamp.ts` | editar |
| `apps/merchant/src/server/loyalty-program/client-view.ts` | editar |
| `apps/merchant/src/app/api/public/loyalty/[businessId]/[programId]/stamp/route.ts` | editar |
| `apps/merchant/src/app/api/loyalty-program/qr/route.ts` | crear |
| `apps/merchant/src/server/brand-kit/qr.ts` | editar |
| `docs/specs/0069-contratos-de-api.md` | crear |
| tests de §«Plan de pruebas» | crear |

### Disjunta?

**Si**, y por el motivo medido — no porque sea la unica abierta, que es falso.

El INDEX tiene **tres** specs en `borrador` ademas de esta: 0003 (wizard de campañas), 0007
(tablero del piloto) y 0009 (check-in QR por local). **Ninguna colisiona**, verificado leyendo
su frontmatter: las tres son borradores previos a la arquitectura actual. Los `archivos` de la
0003 son `packages/domain/**`, `packages/db/**` y `packages/contracts/**`, y **`packages/` no
existe en el arbol** (`pnpm-workspace.yaml` declara solo `apps/*`; hay `apps/consumer`,
`apps/merchant`, `apps/platform`). La 0007 y la 0009 declaran literalmente «rutas concretas por
definir», asi que no reclaman ningun archivo. La 0009 ademas es **otro QR**: el fijo por local
para check-in, no el de enrollment del programa.

La 0067 y la 0068 estan `implementadas` y commiteadas (`a0f66ea`). La 3a y la 4a del arco **no
existen todavia**, y se serializan despues de esta por dependencia (ADR 0070).

**Aun asi se implementa con UN solo implementador** (ADR 0071 §3): «disjunta» habilita paralelo
entre specs, no entre agentes dentro de una spec.

## Definition of Done

- [ ] `BUSINESS_CATEGORIES.length === 15`, aseverado por su unit. **No** se mide con
      `rg 'gcid:'` sobre el archivo: ese barrido tambien cuenta las menciones de los comentarios
      y del default `gcid:store`, asi que no puede dar el numero exacto. Es la misma clase de
      criterio mal formado que la 0067 cerro cuatro veces (`LECCIONES.md`).
- [ ] `POST /api/onboarding/business` sin `categoryGcid` → **400**; con uno fuera de la lista →
      **400**; con uno valido → **201** y la fila tiene ese `category_gcid`.
- [ ] `isSupportedCountryCode('MX')` es `true` y un alta con `MX` persiste `currency_code = 'MXN'`.
- [ ] `GET /api/onboarding/prefill` sin sesion → **401**; con sesion → las 9 paises, las 15
      categorias, y `suggestedCountryCode` que **respeta** `x-vercel-ip-country`.
- [ ] `GET /api/onboarding/prefill` con `x-vercel-ip-country: ES` (no soportado) → `null`, y la
      lista de `countries` **sigue completa** (no se recorta).
- [ ] `POST /api/onboarding/program` con `{target, reward}` → **201**, y el programa queda con
      `status='active'`, `configuration.target` correcto, **un** premio y **dos** clausulas.
- [ ] `POST /api/onboarding/program` con `target` 1 o 51 → **422**.
- [ ] Un programa **sin** sello expone `stampImagePath` **no nulo** en `toClientProgram`, y
      `consumer/programs.ts` lo propaga.
- [ ] `GET /api/public/loyalty/<b>/<p>/stamp?v=0` sin sello → **200** `image/png`, y el cuerpo
      empieza con el magic number PNG.
- [ ] `GET /api/public/loyalty/<b>/<p>/stamp?v=<vieja>` **con** sello → sigue **404**.
- [ ] Ninguna respuesta de la ruta publica del sello contiene `stampImageObjectKey`.
- [ ] `GET /api/loyalty-program/qr` → `image/svg+xml`; `?format=png` → PNG **1024×1024**;
      `?download=1` → `content-disposition` con `attachment` y el slug del negocio.
- [ ] `GET /api/loyalty-program/qr` sin sesion → **401**; con sesion y sin programa → **404**.
- [ ] `docs/specs/0069-contratos-de-api.md` tiene una fila por **cada** endpoint nuevo o tocado,
      con todos sus `code`. Un endpoint sin fila **no esta terminado**.
- [ ] Los gates de root pasan una vez al final: `typecheck`, `lint`, `test`, `format:check`,
      `build`.

**Los criterios que son un comando se corren contra el arbol ANTES de cerrar esta spec** — la
0067 se cerro con cuatro criterios imposibles y el caso esta en `LECCIONES.md`.

## Plan de pruebas y verificación

**Presupuesto y condicion de corte (ADR 0062), escritos en el encargo:**

- **5 mutaciones**, listadas abajo. Cada una con su oraculo nombrado.
- **Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se
  corta y se declara, no se abre una tercera.
- **Clase de error que hay que cazar:** los plausibles — un placeholder que no llega, un 404 que
  se volvio 200 donde no debia, una categoria que no se valida, una clave interna que se filtra.

| # | Mutacion | Oraculo que tiene que morder |
|---|---|---|
| 1 | Aceptar cualquier string como `categoryGcid` | el test de 400 con categoria fuera de la lista |
| 2 | Volver a `stampImagePath: null` sin sello en `client-view.ts` | el test de path no nulo |
| 3 | Servir el placeholder tambien cuando la **version no matchea** | el test de 404 con version vieja |
| 4 | Serializar `stampImageObjectKey` en la respuesta publica | el test de no-filtracion |
| 5 | Tomar el `programId` del query en `/qr` en vez de la sesion | el test de aislamiento entre negocios |

**Protocolo (no se recorta, ADR 0071):** `shasum` limpio **antes** de mutar, fila de bitacora
**antes** de medir, etiqueta `MUTATION` en el codigo mutado, revertir con `diff` contra la copia
limpia. El hook `no-mutations-left.sh` **solo ve mutaciones etiquetadas**.

**Pruebas:**

- [ ] Unitaria: `business-categories.test.ts` — las 15, y que `isBusinessCategory` rechaza
      `'gcid:inventado'` y `'restaurant'` (sin prefijo).
- [ ] Unitaria: `program-defaults.test.ts` — compone dos clausulas, un premio, `unitName`, y
      rechaza `target` fuera de 2..50.
- [ ] Unitaria: `stamp-placeholder.test.ts` — primera letra correcta para `"Ángel"` y para un
      nombre no latino; el SVG contiene `#1A1A1A`; rasteriza a PNG con el magic number.
- [ ] Integracion `.neon`: alta con `MX` → `currency_code = 'MXN'`.
- [ ] Integracion `.neon`: programa creado por el wizard → `status='active'`, 2 clausulas.
- [ ] **Aislamiento:** el negocio A pide `/qr` y no puede alcanzar el programa del negocio B.
- [ ] Regresion: un programa **con** sello sigue sirviendo su imagen y su version.
- [ ] Comandos exactos (root, tras `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`):
      `pnpm run typecheck` · `pnpm run lint` · `pnpm run test` · `pnpm run format:check` ·
      `pnpm run build`.
- [ ] Un archivo suelto: `pnpm --filter @mi-pasaporte/merchant exec vitest run <path>`.

**Verificacion manual: NO HAY PANTALLA, y se declara.** Costo aceptado por el owner mientras dure
el arco (ADR 0070 §17): el producto no tiene entrada por navegador. La verificacion es **por
HTTP con las respuestas transcriptas**, incluido el `content-disposition` del QR y el
`content-type` del placeholder. Es la excepcion explicita y acotada a «gana la pantalla».

## Handoff requerido

**UN implementador para toda la spec y UN revisor independiente al final** (ADR 0071 §3), con el
formato de `docs/AGENT-WORKFLOW.md`. Los gates completos se corren **una vez por spec**. Solo un
`PASS` verificable permite marcarla `implementada`.

**Re-medicion del ADR 0071 (pedida por el owner):** se anota el `duration_ms`, el `tool_uses` y
el `subagent_tokens` de **cada** notificacion de subagente, y cuantos ciclos hubo. Baseline a
batir, de la spec 0068: **~46 min y 868k tokens** de subagentes. El numero real vuelve al ADR
0071 **aunque contradiga la promesa**. No cuenta como mejora bajar el tiempo salteando mutaciones
o la revision independiente.

## Abierto

Nada que bloquee. Las tres decisiones de producto las cerro el owner el 2026-09-17: la lista de
categorias, el placeholder generado con la inicial en negro no puro, y el QR pelado con descarga.

**Hallazgo a decidir (NO es decision del owner, no se escribe como tal):** las cuatro rutas de
`/api/loyalty-program` responden sus errores **sin `code`**, contra la convencion del contrato
0067 («todo error responde `{error, code}`»). Esta spec **no** las arregla —no es su alcance— y
el contrato 0069 lo va a **declarar como estado actual**. Candidato a la fila 56 de `PARQUEADO`.

**Segundo hallazgo a decidir:** el docblock de `counter/core.ts:168` afirma que `programDTO`
expone «only the public stamp path», y ese campo **no existe** en lo que devuelve. Es un
comentario que miente sobre un DTO —la clase de cosa que ya costo una revision en este repo—
pero arreglarlo no es alcance de esta spec.
