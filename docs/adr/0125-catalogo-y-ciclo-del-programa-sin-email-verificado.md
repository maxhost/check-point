---
adr: 0125
fecha: 2026-10-05
estado: aceptada
resumen: El catalogo entero (ver, crear, editar, borrar, imagen, stock e import con IA) y retirar/cancelar el retiro del programa NO exigen email verificado. Se conservan sesion, membresia activa del comercio de la sesion, permiso (`catalog`) o ser owner donde ya lo era, y comercio operativo. Amplia el ADR 0122 y reduce otra vez el alcance del motivo de negocio del ADR 0070 §11.
---

# 0125 — Catalogo y ciclo completo del programa sin email verificado

## Contexto

El ADR 0070 §11 dejo el email verificado como requisito de todo lo posterior al wizard. El ADR 0122 lo saco del
programa (ver, crear, editar, sello, plantillas, QR) y dejo afuera retirar y cancelar el retiro. Hoy el owner no puede
cargar el catalogo ni completar el ciclo del programa sin verificar antes el email.

Medido (2026-10-05): las pantallas no traban nada; el bloqueo es solo del servidor. Todo `/api/catalog/*` pasa por
`requireApiPermission(…, "catalog")` (`api/catalog/_auth.ts:31`, `api/catalog/imports/_auth.ts:26`), cuyo paso 4 exige
email verificado al owner; los borrados duros de producto y categoria por `requireApiOwner`
(`api/catalog/_auth.ts:59`); retirar y cancelar el retiro por `requireApiOwner` (`api/loyalty-program/route.ts:147` y
`:172`). El import con IA no manda emails.

## Decision

Palabras del owner (2026-10-05):

> «Hoy no puedo cargar catalogo ni CRUD del programa de afiliado sin previamente activar el email. Deberiamos permitir
> estas dos cosas sin necesidad de verificar email.»

Ante dos preguntas, el mismo dia: catalogo → **«Todo, IA incluida»** (se le presento el riesgo: cada analisis cuesta
plata y el limite de intentos es por comercio, asi que cuentas falsas pueden gastar el cupo); retirar y cancelar el
retiro → **«Sí, abrir los dos»**.

1. Todo `/api/catalog/*` (incluido `imports/*`, `analyze` incluido): `requireApiPermissionSinGateDeEmail(request,
   "catalog")`. Siguen sesion, membresia activa del comercio de la sesion, owner o staff con `catalog`, comercio
   operativo.
2. Los borrados duros (`DELETE /api/catalog/product/:id` y `/category/:id`): `requireApiOwnerSinGateDeEmail`. Siguen
   siendo SOLO del owner (ADR 0079 §2): ningun toggle de staff los abre.
3. `DELETE` (retirar) y `PATCH` `cancel-close` de `/api/loyalty-program`: `requireApiOwnerSinGateDeEmail`. Siguen
   siendo solo del owner.

## Consecuencias

- El email verificado sigue exigido en staff, locales, marca, campañas, billing y en las superficies de la cuenta
  (ADR 0079 §8). El motivo del ADR 0070 §11 queda solo ahi.
- **Riesgo aceptado por el owner:** el gasto del import con IA queda acotado por el cupo por comercio, no por persona
  verificada. Si aparece abuso, se revisa este ADR (cupo por IP o por cuenta, o volver a gatear `analyze`).
- El inventario cerrado de exenciones (`rg 'SinGateDeEmail' apps`) crece a proposito; lo implementa la spec 0165.
