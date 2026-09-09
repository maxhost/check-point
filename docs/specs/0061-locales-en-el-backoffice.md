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

## Abierto

**Decisiones del owner. La spec no se cierra hasta que estén resueltas.**

1. **¿Se puede eliminar o archivar un local, o la v1 es solo crear y editar?**
   Las tres opciones tienen costos distintos y conviene verlos juntos:
   - **Solo crear/editar** — cero migración, es lo más barato.
   - **Archivar** — necesita una **migración** (`core.location` **no tiene** columna de
     estado) y hay que decidir qué pasa en cada lugar que lista locales: el `LocationGate`
     del mostrador, la visibilidad de productos, el brand kit.
   - **Borrar** — el esquema ya lo soporta y preserva la historia: `order.location_id` y
     `reward_redemption.location_id` son `ON DELETE SET NULL`, igual que
     `program_membership.origin_location_id`. **Pero `product_location` es `CASCADE`**: al
     borrar un local se pierde silenciosamente su configuración de visibilidad de productos.

2. **¿Hay tope de locales, y depende del plan?** Hoy `subscription.plan` es `free`/`plus` y
   nadie tiene más de uno. ¿Free puede abrir sucursales o eso es Plus? Es una decisión
   comercial con plata atrás, y si hay tope hay que decidir qué ve el owner al chocarlo.

3. **Al editar la dirección, ¿se re-verifica siempre contra Geoapify?** O sea: ¿el owner
   puede guardar una dirección tipeada a mano sin elegir una sugerencia? La 0023 fijó que
   ninguna coordenada arbitraria del navegador crea o modifica un local; confirmá que eso
   sigue valiendo para la edición.

4. **¿Quién puede administrar locales: solo el owner, o también el staff?** Hoy `requireOwner`
   existe y el staff está limitado al mostrador (spec 0043).

5. **¿Qué se muestra de la procedencia?** El historial de verificaciones queda guardado. ¿El
   owner lo ve (cuándo se verificó, con qué proveedor), o es solo auditoría interna?
