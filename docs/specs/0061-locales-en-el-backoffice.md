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

Pendiente de cerrar «Abierto». La forma prevista, sujeta a esas decisiones:

- `server/locations/` con el dominio (listar, crear, renombrar, re-verificar dirección),
  espejando `server/catalog/` y `server/staff/`.
- `app/api/locations/**` detrás de `requireOwner()` (o del guard que decida el punto 4).
- `app/backoffice/locations/` con el patrón de las otras pantallas del backoffice.
- La edición de dirección es **una sola sentencia**: insertar la verificación nueva, marcar
  `superseded_at` en la anterior y mover `location.active_verification_id`. Si se hace en
  varios round-trips queda una ventana donde el local apunta a una verificación superseded.

## Definition of Done

- [ ] Pendiente de cerrar la sección «Abierto».

## Plan de pruebas y verificación

- [ ] Pendiente. **Regla dura del repo:** la tabla «mutación X → rojo el test Y» no se
      predice, se **ejecuta** y se transcribe el resultado real.
- [ ] **Integración Neon obligatoria** para la edición de dirección: aseverar **por SQL** que
      tras editar hay exactamente una verificación con `superseded_at IS NULL`, que es la
      nueva, y que la vieja sigue existiendo con su `superseded_at` puesto. Leer el estado
      final por SQL, no confiar en la respuesta de la API — es la lección del ADR 0054.
- [ ] **Aislamiento:** un owner no puede listar ni editar un local de otro negocio (403/404),
      con test propio.
- [ ] **Regresión del mostrador:** crear un segundo local y verificar que el `LocationGate`
      aparece y que la acreditación queda atribuida al local elegido. Es el camino que nunca
      se ejercitó en prod.

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

### Consecuencias derivadas — el owner puede vetarlas

No son decisiones suyas: se siguen de las de arriba. Van explícitas para que pueda rechazarlas.

- **El tope cuenta locales ACTIVOS.** Si contara los archivados, archivar sería un callejón
  sin salida: un `plus` con 3 archivados no podría abrir ninguno.
- **No se puede archivar el último local activo.** Un negocio sin local no puede operar el
  mostrador ni atribuir nada (ADR 0042).
- **Un local archivado desaparece del `LocationGate` del mostrador** y no se puede elegir para
  acreditar.
- **Archivar NO toca `product_location`.** Como no se borra, sus filas de visibilidad
  sobreviven intactas y reactivar el local lo devuelve como estaba.
- **La historia no se toca:** `order.location_id` y `reward_redemption.location_id` siguen
  apuntando al local archivado, así que el histórico y las analíticas no pierden atribución.

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
