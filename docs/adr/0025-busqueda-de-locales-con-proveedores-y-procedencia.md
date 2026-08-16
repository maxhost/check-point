---
fecha: 2026-08-11
resumen: Geoapify es el buscador único de POIs y direcciones y conserva procedencia por local. El fallback Mapbox se descartó por costo (2026-08-16); el contrato queda listo para otro proveedor si hiciera falta.
estado: aceptada
---

# ADR 0025 — Búsqueda de locales con proveedores y procedencia

> **Actualización 2026-08-16 — Mapbox retirado por costo.** En producción Geoapify
> resuelve POIs y direcciones perfectamente para los mercados iniciales, incluido Ecuador.
> Mapbox se conservaba sólo como fallback ante un fallo técnico de Geoapify, pero su
> autocomplete tiene un tope bajo y facturó USD 5 por una sola consulta. Se elimina el
> adaptador y el fallback Mapbox del flujo. El contrato de búsqueda/validación sigue siendo
> provider-neutral (`LocationProvider`, `verifyLocation`), de modo que un proveedor
> alternativo puede reintroducirse sin migrar locales existentes. Lo que sigue describe el
> diseño original de dos proveedores; hoy sólo Geoapify está activo.

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
  → error técnico de Geoapify: fallback automático a Mapbox con el mismo texto
  → selección y validación permanente de Mapbox
  → local canónico de Mi Pasaporte + procedencia de ubicación
```

- **Geoapify** es el autocomplete principal para POIs y direcciones. No se consulta
  Mapbox en paralelo ni por cada tecla.
- Mapbox sólo se invoca si la petición de Geoapify falla técnica o remotamente. La UI conserva
  el mismo campo y consulta automáticamente Mapbox con el texto ya escrito, mostrando carga
  dentro del control. Una respuesta válida, incluso sin resultados, no activa Mapbox.
- Mapbox se limita a geocoding de dirección, no a buscar el nombre de un comercio.
- El país elegido por el owner limita ambas consultas y el servidor vuelve a validarlo.
- El nombre del negocio/local es `owner_submitted`; una respuesta de proveedor sólo
  normaliza/verifica la ubicación.
- La dirección canónica excluye el nombre de POI/comercio aunque el autocomplete lo muestre.
  Se compone de calle, código postal, localidad y país; el resultado original del proveedor
  permanece únicamente en el snapshot de procedencia.
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
- El usuario conserva un único campo de dirección y no debe repetir texto ni decidir entre
  proveedores ante un fallo técnico.
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
