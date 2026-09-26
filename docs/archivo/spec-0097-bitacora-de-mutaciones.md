# Spec 0097 — Bitácora de mutaciones

Presupuesto: seis defectos plausibles. Una ronda, de a una, sobre mecanismos implementados.
Las filas se abren antes de modificar y medir; los backups son propios del diff sin commit.

## M1 — Ayuda persiste onboarding

Archivo: `apps/merchant/src/app/backoffice/brand/brand-tour-controller.tsx`; línea limpia: 108.
SHA-1 limpio: `8d6085a955dbe2656e8386b4527d5e76b57f8699`. Backup: `/tmp/brand0097-clean/M1-brand-tour-controller.tsx`.
Oráculo: `Salir conserva`. Estado antes de medir: pendiente.

Primera medición: `persist: true` → 1 passed, exit 0. La salida manual usa disposición técnica y no entra al writer del motor; esa mutación no alcanza una escritura. Restauración comprobada. Se reemplaza por persistencia desde el callback de cierre de ayuda.

## M1 — Ayuda persiste onboarding

Archivo: `apps/merchant/src/app/backoffice/brand/brand-tour-controller.tsx`; línea limpia: 118.
SHA-1 limpio: `8d6085a955dbe2656e8386b4527d5e76b57f8699`. Backup: `/tmp/brand0097-clean/M1-brand-tour-controller.tsx`.
Oráculo: `Salir conserva`. Estado antes de medir: pendiente.

Medición del callback: **ROJO**, 1 failed, exit 1. `api.progress` esperaba `[]` y recibió `["skipped", "skipped"]`. Restauración byte a byte y SHA-1 confirmados.

## M2 — Quitar declara éxito antes de PUT

Archivo: `apps/merchant/src/app/backoffice/brand/brand-tour-state.ts`; línea limpia: 58.
SHA-1 limpio: `3674a2bf2994351c23c261bb22f05acf52e9bdf4`. Backup: `/tmp/brand0097-clean/M2-brand-tour-state.ts`.
Oráculo: `Quitar es borrador`. Estado antes de medir: pendiente.

**ROJO**, 1 failed, exit 1. Al pulsar Quitar se esperaba «Revisá la vista previa» y apareció «Marca guardada» sin PUT. Restauración byte a byte y SHA-1 confirmados.

## M3 — Fallo de PUT avanza guía

Archivo: `apps/merchant/src/app/backoffice/brand/use-brand-editor.ts`; línea limpia: 120.
SHA-1 limpio: `b44af09d4eca378ca494453d1f99e0a61b33bbc1`. Backup: `/tmp/brand0097-clean/M3-use-brand-editor.ts`.
Oráculo: `nombre conserva`. Estado antes de medir: pendiente.

Primera medición: 1 passed, exit 0. El test observaba el request recibido antes de esperar el error renderizado; podía revisar el título antes de procesar la respuesta. Se fortalece el oráculo esperando el mensaje de error real antes de comprobar que la fase no cambió.

Medición con respuesta esperada: **ROJO**, 1 failed, exit 1. Tras el error 422 renderizado, el título debía seguir «Guardá la marca» y mostró «Marca guardada». Restauración byte a byte y SHA-1 confirmados.

## M4 — Salir recarga y pierde borrador

Archivo: `apps/merchant/src/app/backoffice/brand/brand-tour-definitions.ts`; línea limpia: 159.
SHA-1 limpio: `b64f1d96129177870a3d35b48fa53ff45d6b0571`. Backup: `/tmp/brand0097-clean/M4-brand-tour-definitions.ts`.
Oráculo: `Salir conserva`. Estado antes de medir: pendiente.

**ROJO**, 1 failed, exit 1. Al salir se esperaba nombre «Borrador conservado» y se leyó «Café Inicial» después de la recarga. Restauración byte a byte y SHA-1 confirmados.

## M5 — Respuesta vieja avanza instancia nueva

Archivo: `apps/merchant/src/app/backoffice/brand/brand-tour-context.tsx`; línea limpia: 45.
SHA-1 limpio: `3fe1533939b59cc9310cefe45064825494285446`. Backup: `/tmp/brand0097-clean/M5-brand-tour-context.tsx`.
Oráculo: `una respuesta vieja`. Estado antes de medir: pendiente.

**ROJO**, 1 failed, exit 1. Resolver el ticket viejo debía conservar `change-currency:save`; pasó a `change-currency:success`. Restauración byte a byte y SHA-1 confirmados.

## M6 — Adaptador deja entrar sin brand

Archivo: `apps/merchant/src/app/backoffice/brand/page.tsx`; línea limpia: 9.
SHA-1 limpio: `30204bec186b735a13b983832ac1c2817ac8e830`. Backup: `/tmp/brand0097-clean/M6-page.tsx`.
Oráculo: `rechaza a staff sin brand`. Estado antes de medir: pendiente.

**ROJO**, 1 failed / 2 passed, exit 1. Page() resolvió el componente para staff sin brand en vez de rechazar con redirección. Restauración byte a byte y SHA-1 confirmados.

Las seis clases terminaron con un rojo por la propiedad correcta. Los dos verdes iniciales y la reparación del mecanismo/oráculo están declarados arriba; no se cuentan como prueba del invariante.
