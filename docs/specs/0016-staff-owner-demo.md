---
spec: 0016
fecha: 2026-08-10
estado: cerrada
resumen: Owner gestiona Staff demo: invita, reenvía acceso, asigna permisos, archiva y elimina miembros sin backend.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0016 — Staff del owner demo

## Alcance

**Entra:** listado Staff; crear con nombre/email; permisos fixture; reenviar email de
acceso simulado; archivar (revoca acceso) y eliminar con confirmación; activos/archivados
separados y toasts. UI usa el término **Staff**.

**No entra:** email real, contraseñas, Better Auth, backend, roles reales, auditoría,
autorización ni borrado de identidad real.

## Diseño técnico

Ruta `/backoffice/demo/staff`, Client Component y fixtures en `sessionStorage`. Permisos
demo: `Operar check-in`, `Canjear beneficios`, `Ver campañas`. Archivar conserva la ficha
pero muestra “Sin acceso”; eliminar la retira sólo del mock tras confirmación.

## Definition of Done

- [ ] Owner crea Staff con nombre, email y permisos.
- [ ] Puede reenviar email mock de acceso/cambio de contraseña.
- [ ] Puede cambiar permisos fixture.
- [ ] Puede archivar, quitar acceso y ver archivados separados.
- [ ] Puede eliminar Staff mock con confirmación.
- [ ] Diseño responsive consistente, toasts, tests/build y PASS independiente.

## Abierto

No hay bloqueos para el mock. Email, auth y permisos reales se implementan después.
