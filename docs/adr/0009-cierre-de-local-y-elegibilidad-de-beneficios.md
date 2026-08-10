---
fecha: 2026-08-10
resumen: Cerrar un local no elimina programas ni campañas; desactiva su operación y los beneficios se validan contra criterios vigentes con razones visibles.
---

# ADR 0009 — Cierre de local y elegibilidad de beneficios

## Contexto

El programa de fidelización y las campañas pertenecen al negocio; un local es un lugar donde se activan. Si un local cierra, borrar entidades rompería el historial y no expresa lo que realmente ocurre: algunas campañas continúan en otras sucursales y algunos cupones dejan de tener un sitio válido de canje.

## Decisión

- Un local tiene estado operativo `active` o `closed`; cerrarlo no elimina su historial ni el programa de negocio.
- Un local cerrado deja de aceptar check-ins, acreditaciones, asignaciones y validaciones.
- El programa de fidelización del negocio continúa en sus demás locales activos. Los puntos ya acumulados siguen las reglas de vigencia del programa y pueden usarse solo en locales activos que dicho programa permita.
- Una campaña mantiene su definición global; su conjunto operativo es la intersección entre locales asignados y locales activos. Si queda sin locales operativos, pasa a `paused` con razón `no_active_locations`.
- Un cupón no se borra al cerrar un local. Al intentar usarlo, el sistema evalúa sus criterios vigentes: estado de cupón, vigencia, campaña, locales de canje permitidos y estado de cada local. Si no es canjeable, tanto consumidor como merchant staff reciben razones explícitas, por ejemplo: `local cerrado`, `campaña pausada`, `cupón vencido`.
- No hay redirección automática a otro local. Un cupón de una campaña exclusiva de un local cerrado queda no canjeable.

## Consecuencias

- La validación es una evaluación de elegibilidad, no una simple lectura de estado del cupón.
- Los cupones no canjeables mantienen historial y motivo, útil para soporte y analítica.
- El cierre de local pertenece a las specs de negocio, campaña, operación y canje; no es una regla de borrado de la spec de roles.
