---
fecha: 2026-08-11
resumen: Geoapify es el buscador principal de POIs y direcciones; Mapbox valida una dirección exacta sólo como fallback, con procedencia persistida por local.
estado: aceptada
---

# ADR 0025 — Búsqueda de locales con proveedores y procedencia

## Contexto

Mi Pasaporte necesita una ubicación persistente y verificable para cada local: es la base
del QR, el check-in y futuros controles antiabuso. La cobertura de POIs de Mapbox es
insuficiente en parte de los mercados iniciales, en particular Ecuador. El owner ya aporta
el nombre comercial y del local, por lo que el proveedor geográfico no es la autoridad
sobre la identidad comercial del negocio.

## Decisión

El flujo de alta y edición de un local usa una cadena ordenada:

```text
owner aporta nombre del negocio + nombre del local
  → Geoapify autocomplete (POI/dirección), país limitado
  → selección y validación Geoapify
  → sin resultado seleccionable: fallback visible de dirección exacta en Mapbox
  → selección y validación permanente de Mapbox
  → local canónico de Mi Pasaporte + procedencia de ubicación
```

- **Geoapify** es el autocomplete principal para POIs y direcciones. No se consulta
  Mapbox en paralelo ni por cada tecla.
- El fallback se ofrece sólo cuando Geoapify no devuelve un resultado útil y el owner
  ingresa una **dirección exacta**. Mapbox se usa para geocoding, no para buscar el nombre
  de un comercio.
- El país elegido por el owner limita ambas consultas y el servidor vuelve a validarlo.
- El nombre del negocio/local es `owner_submitted`; una respuesta de proveedor sólo
  normaliza/verifica la ubicación.
- La base conserva dirección normalizada, coordenadas verificadas, proveedor, ID externo
  si existe, fecha de verificación, atribución requerida y un snapshot permitido del
  resultado. Se conserva historial de verificaciones, no sólo el último valor.
- Una actualización de local crea una nueva verificación y mantiene la anterior para
  auditoría. La aplicación sirve su local canónico; no pretende reproducir una base de
  datos de terceros.
- Claves privadas y validaciones finales viven exclusivamente en servidor. Las claves
  públicas de autocomplete se restringen por origen y no habilitan escritura en Neon.

## Consecuencias

- Aumenta la probabilidad de encontrar comercios pequeños sin sacrificar la validación de
  una dirección real cuando el POI no exista.
- El usuario ve un camino explícito de fallback en vez de resultados mezclados o un fallo
  ambiguo.
- La dependencia queda encapsulada detrás de un contrato de búsqueda/validación, de modo
  que un proveedor puede ser reemplazado sin migrar locales existentes.
- La migración desde el campo actual `mapbox_feature_id` requiere convertirlo en una
  procedencia neutral, sin perder el historial Mapbox existente.
- El almacenamiento, atribución, retención y redistribución de cada respuesta respetan
  los términos aplicables al proveedor elegido. No se mezclan datos de un proveedor con
  una representación que sus términos no permitan.

## Relación

Complementa ADR 0017 (entrega production-grade), ADR 0024 (secretos) y Spec 0022
(registro inicial de Owner). La implementación se define en Spec 0023.
