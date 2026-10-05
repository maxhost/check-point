---
adr: 0121
fecha: 2026-10-04
estado: aceptada
resumen: El alta del comercio pasa a 3 pasos — (1) el negocio, buscado en Google Places (comercio o direccion) y revisado en un formulario; (2) el email, que recien ahi crea la cuenta junto con el negocio en una sola escritura; (3) confirmacion y boton al panel. Programa y QR salen del wizard. Google Places reemplaza a Geoapify en todo el merchant (alta y locales), proxeado por el servidor con SKU Essentials, sin horarios ni Time Zone API (la zona sale de las coordenadas con una libreria offline). Reemplaza §1 y §4 del ADR 0070 en lo que ordena las pantallas, y el proveedor de §8.
---

# 0121 — El alta del comercio empieza por Google Places

## Contexto

Hoy el alta (ADR 0070, spec 0067/0069) son 4 pantallas: email (crea la cuenta y abre sesion) → datos del negocio
(Geoapify para la direccion) → programa de fidelizacion → QR y confirmacion. El owner (2026-10-04) quiere bajar la
friccion: el comercio empieza buscando SU negocio en Google («Cafe platano») o una direccion («santa maria y puerto de
palos»); si elige un comercio, el formulario llega precargado para revisar; si elige una direccion, completa el resto.
El email va despues, y recien ahi se crea la cuenta. Lo posterior al wizard (verificar email, cargar catalogo,
activar programa) es otro trabajo del owner.

Medido el 2026-10-04 contra la API real con la clave del owner: `places:autocomplete` devuelve comercios con `types`
`establishment` y direcciones/intersecciones con `geocode`; Place Details con `id,formattedAddress,location,
addressComponents,types` devuelve pais (`shortText: "AR"`) y coordenadas. Sin sesgo de ubicacion, «cafe platano»
devolvio primero un cafe de Brasil.

Precios (pagina oficial `developers.google.com/maps/billing-and-pricing/pricing` y `.../places/web-service/data-fields`,
leidas el 2026-10-04): «Autocomplete Session Usage» sin cargo cuando la sesion termina en un Details; Place Details
Essentials 10.000 gratis/mes, Pro 5.000, Enterprise 1.000. `displayName` y `primaryType` son Pro;
`regularOpeningHours`, telefono y web son Enterprise; `formattedAddress`, `location`, `addressComponents` y `types` son
Essentials.

## Decision

Decisiones del owner (2026-10-04, en el chat de la sesion), con sus palabras o su eleccion entre opciones:

1. **Tres pasos:** (1) negocio, (2) email, (3) confirmacion + boton al panel. Programa y QR **salen** del wizard.
2. **Email ya registrado en el paso 2:** se descartan los datos del paso 1 y se manda el link magico, sin sesion (la
   regla de seguridad de la spec 0067 sigue: escribir el email de otro no entrega nada). Eleccion «Descartar + link».
3. **El negocio queda sin programa** al terminar el wizard hasta el checklist posterior. Eleccion «Sin programa».
4. **Google reemplaza a Geoapify en todos lados** (alta y locales del backoffice); se borra Geoapify.
5. **Datos que se traen:** los que la base guarda hoy — nombre, categoria (sugerida desde `types`), pais, direccion,
   coordenadas, id del lugar. **Sin horarios** (los hubiera llevado a Enterprise, 1.000/mes) **y sin telefono ni web**
   (no hay columna ni pantalla que los use).
6. **SKU Essentials:** el nombre sale de la sugerencia del autocomplete (`structuredFormat.mainText`), no de
   `displayName`; la categoria de `types`, no de `primaryType`. Estimado del owner y la sesion: ~8.000 altas/mes gratis.
7. **Sin Time Zone API:** la zona IANA se calcula desde las coordenadas con `@photostructure/tz-lookup` (CC0, sin
   dependencias, offline). Reemplaza al `Intl` del navegador.
8. **Busqueda:** minimo 3 caracteres + 300 ms de espera despues de la ultima tecla (el owner proponia 5; con 5 un
   comercio de 4 letras no se encuentra nunca, y las busquedas de una sesion completada no se cobran).
9. **Las coordenadas de Google se guardan** como hoy las de Geoapify; sin atribucion explicita (palabras del owner:
   «solo se guarda y ya, estamos en una etapa de pruebas»).

Decisiones tecnicas de la sesion (no del owner):

10. **Google se llama solo desde el servidor** (cierra el fix durable de PARQUEADO #49): la clave `GOOGLE_MAPS_API_KEY`
    nunca viaja al cliente.
11. **Un solo Details por alta:** el servidor firma (HMAC) el resultado del Details y el cliente lo devuelve al crear
    la cuenta o el local; el servidor verifica la firma en vez de volver a llamar a Google. Las coordenadas del
    navegador siguen sin ser un hecho.
12. **La cuenta y el negocio nacen en UNA escritura** (`db.batch`): no hay cuenta sin negocio ni negocio sin dueño.
    Medido en PROD: 0 dueños sin negocio, asi que el estado «con sesion y sin negocio» deja de tener camino de alta.

## Consecuencias

- Las rutas `POST /api/merchant/auth/start` y `POST /api/onboarding/business` se reemplazan por
  `POST /api/onboarding/signup`. Las pantallas de cuenta-primero, programa y QR del wizard se borran (ADR 0070 §17).
- `GET /api/onboarding/prefill` queda publico y solo con categorias: el pais sale de Google, la zona de las coordenadas.
- Las rutas de Places son publicas (el paso 1 no tiene sesion): el costo lo acota la cuota diaria que el owner puso en
  Google Cloud. Un abuso puede agotar esa cuota y cortar las altas del dia — limite declarado en la spec.
- Los locales ya guardados con `provider = 'geoapify'` quedan como estan.
- `GEOAPIFY_API_KEY` y `NEXT_PUBLIC_GEOAPIFY_API_KEY` se pueden borrar de Vercel despues del deploy.
