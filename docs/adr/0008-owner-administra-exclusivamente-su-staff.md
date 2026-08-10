---
fecha: 2026-08-10
resumen: Solo el owner del negocio crea, edita, asigna, desactiva y cambia permisos de su merchant staff.
---

# ADR 0008 — Owner administra exclusivamente su merchant staff

## Contexto

El `platform_staff` presta soporte transversal, pero intervenir en el equipo interno de un comercio crea riesgo operativo y confusión sobre responsabilidad.

## Decisión

Solo el owner de un negocio puede crear, editar, asignar a locales, desactivar/reactivar y modificar permisos de sus `merchant_staff`.

`platform_admin` y `platform_staff` no pueden administrar el ciclo de vida ni permisos de `merchant_staff`, aun cuando puedan consultar datos necesarios para soporte según sus propios permisos globales.

## Consecuencias

- El owner es responsable del acceso que concede a su personal.
- La UI y API de gestión de merchant staff se restringen al owner del negocio.
- El soporte de plataforma debe orientar al owner, no ejecutar cambios de equipo en su nombre.
