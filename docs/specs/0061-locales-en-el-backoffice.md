---
spec: 0061
fecha: 2026-09-09
estado: borrador
resumen: El owner ve, crea y edita los locales de su negocio desde el backoffice, con Geoapify y procedencia versionada; reemplaza el mock de la spec 0015 al que hoy apunta el tile «Locales».
disjunta: sí (ninguna spec abierta toca `backoffice/locations` ni `location-providers.ts`)
archivos: `apps/merchant/src/app/backoffice/locations/**`, `apps/merchant/src/app/api/locations/**`, `apps/merchant/src/server/locations/**`, `apps/merchant/src/app/backoffice/page.tsx`
---

# 0061 — Locales en el backoffice

> **BORRADOR — no se toca código hasta que la sección «Abierto» esté vacía.**
>
> Cierra la parte abierta de la **spec 0023**, que quedó re-etiquetada
> `implementada parcialmente` el 2026-09-09. La 0023 se conserva como registro de lo que sí
> se construyó (el contrato de proveedor y la verificación server-side) y de su diseño
> original con Mapbox; **esta spec es la que se implementa**.

## Problema

**Un local se crea una sola vez, durante el onboarding, y no se puede editar nunca más.**

Verificado en el árbol, no asumido:

- `apps/merchant/src/app/backoffice/` contiene `brand`, `catalog`, `counter`, `demo`,
  `loyalty` y `staff`. **No hay `locations`.**
- `AddressAutofillField` (el autocomplete de Geoapify) se usa en **un solo archivo**:
  `app/onboarding/page.tsx`.
- El tile **«Locales»** del backoffice real (`backoffice/page.tsx:80`) enruta a
  `/backoffice/demo/locations` — **el mock de la spec 0015**, que persiste en
  `sessionStorage` y no toca la base.
- No existe ninguna ruta bajo `app/api/` que cree o modifique un local: la única es
  `api/onboarding/business/route.ts`.

Consecuencia para el owner: si se equivoca en el nombre o en la dirección al dar de alta, o
si el local se muda, **no tiene forma de corregirlo**. Y no puede abrir una segunda sucursal.

## Lo que YA existe y no hay que construir

Esto es lo que hace la spec barata, y conviene tenerlo claro antes de estimar:

| Pieza | Dónde | Estado |
|---|---|---|
| Tabla `core.location` | `server/schema/business.ts:155` | existe |
| Tabla `core.location_verification` con `superseded_at` | `server/schema/business.ts:172` | existe |
| `location.active_verification_id` | idem | existe |
| `verifyLocation()` + `isSupportedCountryCode()` | `server/location-providers.ts` | existe, con tests |
| `AddressAutofillField` (Geoapify) | `app/components/address-autofill.tsx` | existe, en uso |
| `requireOwner()` | `server/auth-guards.ts:98` | existe |

**La procedencia versionada NO necesita migración**: el modelo ya soporta «editar crea una
verificación nueva y supersede la anterior». Lo que falta es la UI, la ruta y el dominio.

## Estado real de los datos en producción (consultado por SQL, 2026-09-09)

Los **11 negocios tienen exactamente 1 local** y exactamente 1 verificación activa. Nadie
llegó nunca a dos.

**Consecuencia que hay que decir en voz alta:** el mostrador ya tiene un `LocationGate`
(`counter-console.tsx:232`) que aparece cuando `locations.length > 1` y le pide al staff
elegir en qué local está operando. **Ese camino nunca se ejercitó en producción.** El primer
negocio que cree un segundo local va a estrenarlo. No es un bug ni entra en el alcance de
esta spec, pero sí entra en su plan de pruebas.

## Alcance

**Entra:**
- Listado de los locales del negocio en `/backoffice/locations`.
- Alta de un local nuevo, con el mismo autocomplete de Geoapify y la misma validación
  server-side que el onboarding.
- Edición del **nombre** de un local.
- Edición de la **dirección** de un local, generando una verificación nueva y superseding la
  anterior (nunca destruyéndola).
- Re-enrutar el tile «Locales» de `backoffice/page.tsx` a la ruta real.

**No entra (explícito):**
- Tocar el onboarding: sigue creando el primer local como hoy.
- Cambiar el `LocationGate` del mostrador ni el ruteo de atribución (ADR 0042).
- Mapa interactivo. La 0023 lo diseñó con Mapbox y **Mapbox está retirado por costo**; el
  autocomplete de Geoapify no incluye tiles.
- Mover el autocomplete de Geoapify al server. Es la **tarea 49** (la clave pública quedó sin
  restricción de origen) y tiene su propia spec pendiente; esta spec **consume el componente
  tal como está hoy** y no empeora ni mejora esa situación.
- Visibilidad de productos por local (`product_location` ya existe y se administra desde
  Catálogo).
- **Geocodificar el texto tipeado para rellenar coordenadas.** Decisión 3: un local sin
  coincidencia de Geoapify queda sin georreferencia, no con una inventada.
- Geofencing / check-in por cercanía. Es el ADR 0057 §2 y necesita su propia spec; esta sólo
  deja el dato en condiciones de alimentarlo.

## Diseño

### Modelo de datos

**Migración aditiva, una sola:**

| Cambio | Tabla | Por qué |
|---|---|---|
| `status text NOT NULL DEFAULT 'active'` + check `in ('active','archived')` | `core.location` | Decisión 1. Hoy no hay columna de estado |
| `longitude`/`latitude` → **DROP NOT NULL** | `core.location` | Decisión 3: un local de solo texto no tiene georreferencia |
| `longitude`/`latitude` → **DROP NOT NULL** | `core.location_verification` | idem |

El `DEFAULT 'active'` deja a los 11 locales de prod activos sin backfill. Nada más cambia:
`provider`, `provider_place_id` y `attribution` ya son nulables.

### El guard del mostrador va en el SERVIDOR, no solo en la UI

**Esto es lo que hace que «un local archivado no puede operar» sea cierto y no una
intención.** Sacarlo del selector es un gate de interfaz; el que decide es el servidor.

Verificado en el árbol:

- `backoffice/counter/page.tsx:21` lista los locales con `where(eq(locations.businessId, …))`
  — **sin filtro de estado**. Un local archivado seguiría apareciendo en el `LocationGate`.
- `backoffice/counter/page.tsx:13` acepta **`?location=<uuid>`** por query param y lo
  preselecciona. Un link guardado en favoritos por el staff —que es exactamente para lo que
  existe ese parámetro— sigue cargando el id de un local ya archivado.
- `server/counter/core.ts:78` — `assertLocationInBusiness()` valida que el local **pertenezca
  al negocio** (defiende el FK contra un `?location` de otro negocio) pero **no mira el
  estado**, porque hasta esta spec no existía.

Sin el filtro server-side, una pestaña vieja del mostrador que ya tenía el local seleccionado
puede seguir **acreditando y canjeando contra un local archivado**, aunque la UI ya no lo
ofrezca. Es el patrón de «una puerta con candado al lado de una pared abierta» que ya
apareció con el plugin de better-auth (spec 0046).

**Los dos cambios son obligatorios y el load-bearing es el segundo:**

1. `counter/page.tsx` lista sólo `status = 'active'`.
2. **`assertLocationInBusiness()` suma `eq(locations.status, "active")` al `WHERE`** — y
   entonces un `locationId` archivado cae en el `422 unknown_location` que ya existe.

### Dominio, rutas y pantalla

- `server/locations/` con el dominio (listar, crear, renombrar, re-verificar dirección,
  archivar, reactivar), espejando `server/catalog/` y `server/staff/`.
- **Tope por plan en código, no en la base:** `free: 1`, `plus: 3`. `enterprise` no se crea
  (decisión 2) — sin código muerto que lo anticipe. El tope se evalúa **contando locales
  `active`** y se aplica en el servidor, no solo escondiendo el botón.
- `app/api/locations/**` detrás de `requireOwner()` (decisión 4).
- `app/backoffice/locations/` con el patrón de las otras pantallas del backoffice, y el tile
  «Locales» de `backoffice/page.tsx:80` re-enrutado a la ruta real.
- **La edición de dirección es UNA sola sentencia**: insertar la verificación nueva, marcar
  `superseded_at` en la anterior y mover `location.active_verification_id`. En varios
  round-trips queda una ventana donde el local apunta a una verificación superseded.

## Definition of Done

- [ ] El owner ve en `/backoffice/locations` los locales **activos** y **archivados** de su
      negocio, separados, y el tile «Locales» del backoffice lleva ahí (ya no al mock).
- [ ] Puede **crear** un local eligiendo la dirección en Geoapify: se guarda con coordenadas
      y `source = 'provider_verified'`.
- [ ] Puede **crear** un local con una dirección tipeada que Geoapify no encuentra: se guarda
      con `source = 'owner_typed'`, `provider = NULL` y **coordenadas nulas**. No se fabrica
      ninguna coordenada.
- [ ] Puede **renombrar** un local sin tocar su dirección ni su verificación activa.
- [ ] Puede **cambiar la dirección**: queda exactamente una verificación con
      `superseded_at IS NULL` —la nueva—, la anterior conserva su fila con `superseded_at`
      puesto, y `location.active_verification_id` apunta a la nueva.
- [ ] Puede **archivar** un local y **reactivarlo**. Al reactivar vuelve como estaba,
      incluida su visibilidad de productos.
- [ ] **No puede archivar el último local activo**: el servidor lo rechaza con un error
      explícito.
- [ ] **El tope por plan se aplica en el servidor** contando locales activos: `free` no puede
      crear un segundo, `plus` no puede crear un cuarto. Esconder el botón no alcanza.
- [ ] **Un local archivado no aparece en el selector del mostrador NI puede recibir una
      acreditación o un canje**, aunque el `locationId` llegue en el request.
- [ ] Un owner no puede listar, editar ni archivar un local de otro negocio.
- [ ] Ninguna ruta devuelve al navegador más de lo necesario del local (sin snapshots crudos
      del proveedor).
- [ ] Tests, typecheck, lint, formato y build pasan; revisión independiente emite **PASS**.

## Plan de pruebas y verificación

**Regla dura del repo: la tabla «mutación X → rojo el test Y» no se predice, se EJECUTA y se
transcribe el resultado real.** El implementador la completa corriéndola.

- [ ] **Integración Neon — la edición de dirección.** Editar y aseverar **por SQL** que hay
      exactamente una verificación con `superseded_at IS NULL`, que es la nueva, que la vieja
      sigue existiendo con su `superseded_at`, y que `active_verification_id` apunta a la
      nueva. Leer el estado final por SQL, nunca la respuesta de la API (ADR 0054).
- [ ] **Integración Neon — local de solo texto.** Crear sin coincidencia de Geoapify y
      aseverar por SQL `longitude IS NULL AND latitude IS NULL AND source = 'owner_typed'`.
      Es el DoD que la decisión 3 vuelve verificable.
- [ ] **Integración Neon — el guard del mostrador (el más importante).** Archivar un local y
      **POSTear una acreditación y un canje con ese `locationId`**, saltándose la UI: los dos
      tienen que fallar. **Mutación obligatoria:** sacar `eq(locations.status, "active")` de
      `assertLocationInBusiness` tiene que poner ese test en rojo. Si queda verde, el test no
      pinnea lo que dice pinnear.
- [ ] **Integración Neon — el tope por plan.** Un negocio `free` con 1 activo no puede crear
      el segundo; un `plus` con 3 activos no puede crear el cuarto; **archivar uno libera el
      cupo** (el tope cuenta activos).
- [ ] **Integración Neon — el último local.** Archivar el único activo tiene que fallar.
- [ ] **Aislamiento:** owner del negocio A no puede listar/editar/archivar un local de B.
- [ ] **Regresión del mostrador con 2 locales.** Crear un segundo local y verificar que el
      `LocationGate` aparece y que la acreditación queda atribuida al local elegido. **Es un
      camino que NUNCA se ejercitó en producción** (los 11 negocios tienen 1 local): no
      asumir que funciona porque el código está.
- [ ] Comandos: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`,
      `pnpm run test`, `pnpm run build` (Node 24.20.0, `nvm use`).
- [ ] **Verificación manual del owner**, en el deploy: crear un local con Geoapify, crear uno
      tipeado, renombrar, cambiar dirección, archivar, reactivar, y comprobar en el mostrador
      que el archivado no se puede elegir.

## Decisiones del owner (2026-09-09)

1. **No se elimina: se desactiva/archiva.** Pide migración — `core.location` no tiene columna
   de estado.
2. **Tope de locales por plan:** `free` = **1**, plan de pago (hoy `plus`) = **3**,
   `enterprise` (a futuro) = **sin límite**.
3. **Un local es de una de dos clases, y no se mezclan:**
   - **Georreferenciado** — la dirección se eligió de Geoapify: texto **y** coordenadas.
   - **Solo texto** — la dirección se tipeó y Geoapify no la encontró: **texto plano, sin
     ninguna georreferencia**.

   **No se fabrican coordenadas aproximadas para el caso tipeado.** Un punto inventado por
   geocodificación directa *parecería* una georreferencia sin serlo, y este repo ya pagó dos
   veces el costo de un dato que afirma algo que no es cierto (ADR 0054). Que falte es
   información; que esté mal es una mentira.
4. **Solo el owner** administra locales.
5. Pendiente de confirmar — ver «Abierto».

### Consecuencias verificadas de la decisión 3

Las coordenadas pasan a ser **nulables** en `core.location` y `core.location_verification`
(hoy son `NOT NULL` en las dos). **El radio de impacto es cero, verificado en el árbol:
nadie lee esas columnas.** Sólo se escriben, en `api/onboarding/business/route.ts`. No hay
cálculo de distancia, geofencing, mapa ni consumo en `apps/consumer` — se buscó
`haversine|distance|geofenc|ST_|radius|proximity` en las dos apps y sólo matchea
`border-radius` del CSS. El único consumidor futuro es el geofencing del ADR 0057 §2, que
todavía no existe.

Las demás columnas **no** necesitan migración: `provider`, `provider_place_id` y
`attribution` ya son nulables; `country_code` se sabe siempre (lo elige el owner);
`normalized_address` es el texto tipeado; `address_snapshot` y `provider_snapshot` son
`jsonb NOT NULL` y admiten `{}`.

Un local de solo texto se registra con `source = 'owner_typed'` y `provider = NULL`, frente
al `source = 'provider_verified'` que usan hoy las 11 filas de prod (9 Geoapify, 2 Mapbox
heredadas).

### Consecuencias verificadas de la decisión 2

Consultado por SQL en prod: **10 negocios en `free` y 1 en `plus`**, todos con exactamente
**1 local**.

- **Nadie queda por encima del tope nuevo**: la migración no necesita backfill.
- **Los 10 negocios `free` quedan EXACTAMENTE en su tope**, así que para 10 de 11 owners la
  pantalla nace sin botón de «agregar». Es la decisión, no un defecto, pero es lo que va a
  ver la mayoría y condiciona el diseño de la pantalla.
- `core.subscription.plan` sólo toma `free` y `plus`. **`enterprise` no se crea en esta
  spec**: queda como fila futura, sin código muerto que lo anticipe.

### Consecuencias derivadas — CONFIRMADAS por el owner (2026-09-09)

Se le presentaron como derivadas de sus decisiones, no como decisiones suyas, y las confirmó
una por una:

- **El tope cuenta locales ACTIVOS.** Si contara los archivados, archivar sería un callejón
  sin salida: un `plus` con 3 archivados no podría abrir ninguno.
- **No se puede archivar el ÚLTIMO local activo.** Un negocio sin local no puede operar el
  mostrador ni atribuir nada (ADR 0042). *(El owner respondió «no se puede archivar un local
  activo: correcto»; se interpreta como confirmación del enunciado que se le presentó —el
  **último** activo—, ya que la lectura literal impediría archivar cualquier cosa. Si la
  intención era otra, es lo único a corregir antes de implementar.)*
- **Un local archivado desaparece del selector del mostrador**; sólo los activos se pueden
  elegir.
- **Archivar NO toca `product_location`**: como no se borra, la visibilidad de productos
  sobrevive intacta y reactivar devuelve el local como estaba.
- **La historia queda intacta:** `order.location_id` y `reward_redemption.location_id` siguen
  apuntando al local archivado. Es un log inalterable y no pierde atribución.

**Sobre el razonamiento del owner en `product_location` —«no hay forma de canjear ni cargar
venta si el local no está activo»— la intención es correcta pero HOY no es cierta sola.**
Verificado en el árbol: `assertLocationInBusiness()` (`server/counter/core.ts:78`) valida que
el local pertenezca al negocio pero **no mira el estado**, y `backoffice/counter/page.tsx:13`
acepta el local por query param `?location=<uuid>` — justo el parámetro que existe para que
el staff guarde el mostrador en favoritos. Sin el filtro server-side, una pestaña vieja o un
link guardado siguen acreditando contra un local archivado. Por eso el guard entra en el DoD
con su mutación obligatoria (ver «Diseño» y «Plan de pruebas»). Con ese filtro puesto, el
razonamiento del owner pasa a ser cierto.

## Abierto

**Queda una. La spec no se cierra hasta resolverla.**

### ¿El owner ve de qué clase es cada local?

Con la decisión 3, la diferencia dejó de ser una etiqueta y pasó a ser **estructural**: un
local de solo texto no tiene coordenadas, y por lo tanto **no va a poder entrar en el
geofencing/check-in** del ADR 0057 cuando se construya.

**Recomendación, para confirmar o corregir:**

- **Sí se muestra la clase.** En la lista, un local sin georreferencia se ve distinto (algo
  como «sin ubicación verificada») y al editarlo se le ofrece volver a buscar en Geoapify.
  El motivo no es cosmético: es la única forma de que el owner sepa cuáles de sus locales van
  a quedar afuera del geofencing, **antes** de que esa feature exista y sea tarde.
- **No se muestra el historial de mudanzas.** Las verificaciones superseded quedan como
  auditoría interna; nadie pidió verlas y no cambian ninguna decisión del owner.
