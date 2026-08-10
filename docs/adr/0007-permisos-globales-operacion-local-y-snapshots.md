---
fecha: 2026-08-10
resumen: Las campañas se gestionan a nivel negocio; los permisos separan configuración global de operación local y la auditoría conserva snapshots si se eliminan fuentes.
---

# ADR 0007 — Permisos globales, operación local y snapshots de auditoría

## Contexto

Las campañas pertenecen al negocio y se activan en N locales; un empleado de local no debe alterar una regla global por accidente. A la vez, eliminar una persona, premio o campaña no puede borrar la explicación histórica de quién otorgó o canjeó algo.

## Decisión

- Crear o editar campañas exige una capacidad con alcance de **negocio**. No existe edición de una fracción local de una campaña global.
- Un `merchant_staff` restringido a locales puede ver y ejecutar únicamente campañas activas en sus locales, si tiene los permisos de lectura/operación respectivos; no puede modificar la campaña global.
- Solo el `owner` de un negocio puede conceder, modificar o revocar permisos de sus `merchant_staff`.
- Cada acción auditable guarda referencias a sus fuentes y snapshots inmutables legibles: actor, rol, negocio, local, campaña, beneficio/premio y valores relevantes. Si una fuente se elimina, su referencia puede quedar nula, pero el snapshot preserva el contexto histórico.

## Consecuencias

- La auditoría no se construye mediante joins actuales: cada registro debe ser interpretable por sí mismo.
- Premios otorgados, canjes, cambios de campaña y operaciones de staff conservan quién los realizó incluso después de borrar el staff original.
- La eliminación real exige revisar qué datos deben snapshotearse antes de permitirla; la política de privacidad/retención se definirá antes del lanzamiento.
