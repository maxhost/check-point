---
adr: 0122
fecha: 2026-10-04
estado: aceptada
resumen: El programa de fidelizacion (ver, crear, editar, imagen del sello, plantillas de condiciones) y su QR NO exigen email verificado. Basta sesion activa + membresia activa del comercio de la sesion + ser owner o staff con el permiso `loyalty` + comercio operativo. Retirar el programa y cancelar el retiro siguen exigiendo owner verificado. Reemplaza §1 del ADR 0076 (crear ≠ editar) y, para el programa, el motivo de negocio del ADR 0070 §11.
---

# 0122 — El programa no exige email verificado

## Contexto

Con el ADR 0121 el programa salio del wizard y el permiso de alta (ADR 0076 §2) quedo sin funcion (spec 0156). Al
revisar su borrado aparecio que, sin el permiso, un owner sin verificar podria **crear** su programa pero no
**editarlo** (`programEditDenied`, ADR 0076 §1), y que ademas no podia ni **verlo** (`GET /api/loyalty-program`, la
imagen del sello y las plantillas de condiciones usan `requireApiPermission`, cuyo paso 4 exige email verificado al
owner). Se le presentaron al owner dos hallazgos (PARQUEADO #72 y #73).

## Decision

Palabras del owner (2026-10-04):

> «se puede crear el programa sin verificar email, tenemos que actualizar esto, solo necesitas una sesion activa y ser
> owner de la marca de la sesion. es decir un usuario x no puede crear o editar el programa del comercio y. [...] a no
> ser que tengas los permisos en staff» — «el qr si se podra mostrar y usar sin email verificado.»

1. Ver, crear y editar el programa, subir la imagen del sello y leer las plantillas de condiciones: guard
   `requireApiPermissionSinGateDeEmail(request, "loyalty")` — pasos 1 (sesion), 2 (membresia activa del negocio de la
   sesion: un usuario de X no alcanza el programa de Y), 3 (owner, o staff con `loyalty`) y 5 (negocio operativo). Sin
   paso 4 (email).
2. El dominio (`saveProgram`) deja de tener regla de email: se borra `programEditDenied`.
3. El QR (`GET /api/loyalty-program/qr`) queda como esta: ya usaba ese guard (spec 0075).
4. **No cambia** (no lo pidio el owner, y es destructivo): `DELETE` (retirar) y `PATCH` (`cancel-close`) siguen con
   `requireApiOwner` (owner verificado).

## Consecuencias

- Cierra PARQUEADO #72 y #73.
- El email verificado sigue exigido en el resto de las superficies delegables del owner (staff, locales, marca,
  campañas, catalogo, billing) — el motivo de negocio del ADR 0070 §11 se mantiene ahi.
- Lo implementa la spec 0156 (parte C).
