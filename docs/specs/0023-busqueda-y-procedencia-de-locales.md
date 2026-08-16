---
spec: 0023
fecha: 2026-08-11
estado: implementada
resumen: Alta y edición de locales con Geoapify como autocomplete único (Mapbox retirado por costo, 2026-08-16) y procedencia persistente de la ubicación.
disjunta: no
archivos: apps/merchant, packages/db, packages/contracts, pruebas y docs
---

# 0023 — Búsqueda y procedencia de locales

> **Cierre 2026-08-16 — Geoapify único, Mapbox retirado por costo.** Geoapify resuelve
> POIs y direcciones perfectamente en producción; su fallback Mapbox se eliminó porque el
> autocomplete de Mapbox facturó USD 5 por una sola consulta (ver ADR 0025, actualización
> 2026-08-16). El contrato `verifyLocation`/`LocationProvider` sigue siendo provider-neutral
> para reintroducir otro proveedor sin migrar locales. Los apartados que mencionan Mapbox
> abajo describen el diseño original; hoy sólo Geoapify está activo.

## Problema

El owner debe encontrar su comercio o una dirección válida aunque el proveedor de POIs no
cubra bien su zona. A la vez, Mi Pasaporte necesita guardar coordenadas verificadas y
conocer su origen para operar check-ins y permitir correcciones futuras.

## Alcance

**Entra:**

- Geoapify como autocomplete único de POIs y direcciones, limitado al país del local.
  (El fallback automático a Mapbox del diseño original se retiró por costo el 2026-08-16;
  ante un error técnico de Geoapify la UI conserva el campo y muestra un aviso para
  reintentar, sin consultar un segundo proveedor.)
- Validación server-side de país, dirección y coordenadas antes de crear o editar un local.
- Persistencia de dirección normalizada, coordenadas, proveedor, ID externo, fuente,
  instante de verificación, atribución y snapshot permitido.
- Historial inmutable de verificaciones de ubicación y UI para reemplazar una ubicación.
- Variables de entorno separadas por proveedor, claves públicas restringidas por origen y
  claves privadas sólo en servidor.

**No entra:**

- Directorio público, API de places propia, corrección comunitaria, deduplicación entre
  negocios o sincronización masiva de POIs.
- Búsqueda paralela o ranking fusionado Geoapify/Mapbox.
- Mapas embebidos, rutas o geofencing/check-in real.
- Replicar o almacenar contenido que los términos de un proveedor no autoricen.

## Diseño funcional

```text
Paso 1: owner escribe el nombre del local o dirección
  └─ Geoapify muestra resultados de POI/dirección del país elegido

Paso 2a: owner selecciona resultado Geoapify
  └─ servidor valida y guarda ubicación + procedencia geoapify

Paso 2b: Geoapify falla técnica o remotamente
  └─ el mismo control conserva el texto y muestra un aviso para reintentar
       (sin fallback a un segundo proveedor — Mapbox retirado por costo 2026-08-16)
```

El owner siempre conserva el control del nombre del negocio y local. La copia normalizada
de dirección no sobrescribe esos nombres. Tras selección, la UI muestra la dirección,
proveedor que la verificó y una acción para cambiarla antes de guardar.

Cuando el resultado es un POI, la dirección canónica se construye desde sus componentes
postales (calle, código postal, localidad y país), nunca a partir del nombre del POI. El
nombre mostrado por el proveedor se conserva sólo en el snapshot de procedencia.

## Modelo y contratos

La implementación sustituye referencias específicas a Mapbox por un modelo neutral:

```text
location
  id, business_id, name, address_label, longitude, latitude, country_code,
  active_location_verification_id, timestamps

location_verification
  id, location_id, source, provider, provider_place_id,
  normalized_address, longitude, latitude, country_code,
  provider_snapshot, attribution, verified_at, superseded_at
```

- `source`: `owner_submitted`, `provider_verified` o futuro `platform_verified`.
- `provider`: `geoapify`, `mapbox` o `null` para datos aún no verificados.
- `active_location_verification_id` apunta a una verificación válida del mismo local.
- Coordenadas son valores numéricos con precisión definida en contrato, no texto libre.
- Toda consulta del servidor recibe el `country_code` ya validado contra el catálogo de
  países soportados; no confía en el filtro del navegador.
- El contrato `LocationSearchProvider` expone `suggest` y `verify`; Geoapify y Mapbox son
  adaptadores intercambiables. La UI no conoce tokens secretos ni endpoints privados.

## Archivos previstos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/components/address-autofill*` | selector Geoapify y fallback automático Mapbox ante fallo técnico |
| `apps/merchant/src/app/api/onboarding/business/route.ts` | validar proveedor/país en servidor y persistir la procedencia neutral |
| `apps/merchant/src/app/backoffice/**/locations/**` | reutilizar el selector al crear o editar local |
| `apps/merchant/src/server/location-providers/**` | crear contrato y adaptadores Geoapify/Mapbox |
| `apps/merchant/src/server/schema.ts`, migraciones | migrar `mapbox_feature_id` al historial de verificación |
| `apps/merchant/.env.example`, `docs/DEPLOY-OWNER-TEST.md` | documentar variables y restricciones de claves por proveedor |
| pruebas unitarias, integración y E2E | cubrir cadena de búsqueda, fallback y persistencia |

## Definition of Done

- [ ] Geoapify devuelve POIs y direcciones para el país seleccionado con un autocomplete
  accesible y responsive.
- [x] Sólo se consulta Geoapify; ante un error de Geoapify la UI conserva el único campo y
  muestra un aviso para reintentar (Mapbox retirado por costo 2026-08-16).
- [x] El servidor valida país, respuesta y coordenadas de Geoapify; ninguna coordenada
  arbitraria enviada por el navegador crea o modifica un local.
- [ ] Cada local conserva una ubicación activa y su historial de procedencia: fuente,
  proveedor, ID externo cuando exista, dirección normalizada, coordenadas, atribución y
  fecha de verificación.
- [ ] Editar una ubicación crea una nueva verificación, no destruye la anterior; el local
  siempre apunta a una única verificación activa.
- [ ] La migración conserva los datos Mapbox actuales y elimina nombres de campos
  específicos de proveedor del modelo canónico.
- [ ] Tokens públicos están restringidos por origen; secretos no se exponen al cliente,
  repositorio ni logs.
- [ ] Se cumplen términos de almacenamiento/atribución de cada proveedor antes de activar
  su adaptador en producción.
- [ ] Format, lint, typecheck, unitarias, integración, E2E móvil y build pasan; revisión
  independiente emite PASS.

## Plan de pruebas

- [ ] Unidad: normalizar selección de Geoapify y Mapbox; rechazar país no soportado,
  coordenadas fuera de país y respuesta incompleta.
- [x] Unidad: `verifyLocation` rechaza país no soportado antes de llamar al proveedor,
  normaliza la verificación de Geoapify con su procedencia y rechaza una selección sin
  proveedor válido. (El caso de fallback Mapbox se eliminó junto con el adaptador.)
- [ ] Integración: crear local por cada proveedor y comprobar `location_verification`,
  procedencia y referencia activa; una actualización conserva el historial.
- [ ] Integración: solicitud manipulada con proveedor, ID, país o coordenadas falsos es
  rechazada por servidor.
- [ ] E2E móvil: buscar POI Geoapify; simular su error y comprobar que el control conserva
  el campo y muestra el aviso de reintento; crear y editar un local desde el backoffice.
- [ ] Benchmark manual: al menos 100 consultas representativas de Ecuador y los países
  soportados, con tasa de hallazgo de POI y dirección por proveedor documentada antes de
  activar el flujo para todos los owners.

## Abierto

- Definir el umbral de precisión y radio aceptado para el check-in por tipo de local.
- Definir el texto y ubicación de atribución de Geoapify/OSM en UI y API futura.
- Decidir si el owner puede fijar manualmente un pin tras dos validaciones fallidas; no se
  habilita hasta tener controles antiabuso y auditoría.
