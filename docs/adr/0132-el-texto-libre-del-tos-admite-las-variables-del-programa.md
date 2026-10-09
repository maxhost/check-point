---
adr: 0132
fecha: 2026-10-09
estado: aceptada
resumen: Una clausula de texto libre del TOS del programa deja de tener allowlist vacio y admite todas las variables que el servidor emite para ese programa (`termsVariables`), resueltas al guardar; una variable que no se emite sigue siendo 422. Reemplaza el limite «el texto libre no admite variables» de las specs 0078/0081.
---

# 0132 — El texto libre del TOS admite las variables del programa

## Contexto

El owner, 2026-10-09, intento activar un programa de Puntos en dev-business («Joyas de Cutilan», MX) y
recibio 422 «Revisa los datos del programa». Causa medida (log temporal en `PUT /api/loyalty-program`):
`La variable {{program_kind_label}} no está permitida.`

El panel inserta la plantilla del pais como TEXTO LIBRE (`clauses: [{ text }]`) y su `insertTemplate`
solo reemplaza 4 variables (`business_legal_name`, `program_name`, `program_kind`, `country_code`). Las
plantillas actuales (spec 0081) usan las 12, y el renderer le daba al texto libre allowlist vacio
(limite declarado en `0078-contratos-de-api.md` y `0081-contratos-de-api.md` §6.3). Resultado: con las
semillas de hoy, ningun programa nuevo se puede crear desde el panel.

## Decision

Opcion elegida por el owner (2026-10-09, «Servidor resuelve»): en `renderedTerms`, una clausula sin
`templateId` usa como allowlist las claves de `termsVariables(input, business, locales)`. Los valores
salen del programa que se esta guardando, asi que el texto legal refleja la mecanica final aunque se
haya cambiado despues de insertar la plantilla.

Una clausula con `templateId` conserva el allowlist de su fila. Una variable que no se emite (desconocida,
de local sin locales activos, o de dinero en `per_purchase`) sigue siendo 422.

## Descartadas

- **La pantalla resuelve las 12 variables:** duplica el diccionario en el navegador y congela los valores
  al momento de insertar (si despues cambia la acumulacion, el TOS queda viejo).
- **Ambas:** mas superficie; se puede sumar despues si se quiere mostrar el texto ya resuelto.

## Consecuencias

- El comercio sigue viendo las `{{llaves}}` en el cuadro de texto del panel (zona de GPT): el texto
  publicado sale resuelto.
- Un TOS personalizado ahora se re-renderiza con los datos del programa en cada guardado, igual que uno
  de plantilla, para las variables que use.
- Test: `loyalty-terms-render.neon.integration.test.ts` («texto libre: … ADR 0132»).
