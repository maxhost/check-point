---
spec: 0015
fecha: 2026-08-10
estado: cerrada
resumen: Owner gestiona locales demo: ve, añade, edita y archiva locales con búsqueda y mapa de Mapbox.
disjunta: no
archivos: apps/merchant, .env.example, pruebas merchant y e2e, docs
---

# 0015 — Locales del owner demo

## Alcance

**Entra:** listado de locales de la marca; alta, edición de nombre/dirección; búsqueda
de dirección y mapa Mapbox; archivar locales activos con confirmación; separación visual
de activos y archivados; estado demo persistido en `merchant-demo`.

**No entra:** backend, autorización real, geocodificación propia, operación de staff,
QR, campañas, borrado definitivo ni acceso a datos de otros negocios.

## Diseño técnico

Ruta `/backoffice/demo/locations`. Cada local demo tiene id no predecible, nombre,
dirección, coordenadas Mapbox, estado `active|archived` y fechas fixture. El owner sólo
ve activos al inicio; archivados aparece en sección secundaria. Archivar exige
confirmación y muestra toast; no borra historia.

El formulario de alta/edición contiene nombre, dirección y una superficie de mapa
placeholder con marcador fixture. El contrato visual deja espacio para búsqueda,
resultado y selección de Mapbox; la integración real y el token público
`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` se incorporan junto con backend/configuración, nunca
con un token secreto en browser.

## Definition of Done

- [ ] Owner puede ver locales de su marca, nombre y dirección.
- [ ] Owner puede añadir y editar nombre/dirección de locales con UI preparada para Mapbox.
- [ ] Owner puede archivar locales activos y verlos separados de los activos.
- [ ] Alta/edición no guarda sin selección de dirección Mapbox.
- [ ] Responsive, toasts accesibles, tests, build y PASS independiente.

## Abierto

No hay bloqueos para el demo. Mapbox real queda explícitamente diferido a la feature de
backend/configuración.
