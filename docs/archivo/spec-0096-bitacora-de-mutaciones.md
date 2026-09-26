# Spec 0096 — bitácora de seis mutaciones

Presupuesto: seis errores plausibles, una ronda. Browser UI real, HTTP controlado; no backend ni selector nativo. Copias limpias en `/tmp`; registro previo a cada medición.

## M1 — Ayuda no persiste onboarding

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/catalog-tour-controller.tsx`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/catalog-tour-controller.tsx:99`.
- SHA1 limpio: `4b78d82eadeaa5afc14da941c84ed9db2d2396e2`.
- Alcance: `tests/e2e/catalog-tour-crud.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Resultado ejecutado: exit 0, 4 passed (10.0 s); la mutación sobrevive.
- Lectura del mecanismo: `Listo`/salida llaman al cierre local; éste cambia sesión y la limpieza usa `disposeOnboardingTour`, que deliberadamente no guarda skipped. Cambiar sólo `persist` no produce POST en estos caminos. No se afirma un rojo inexistente; este objetivo queda cubierto por asserts de requests, sin demostrar que el flag sea necesario.
- Restauración: diff vacío contra copia limpia y SHA1 idéntico.

## M2 — Guardar fallido no avanza

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts:52`.
- SHA1 limpio: `4cc265476efc3db4a0c32cb314b0664beccb091c`.
- Alcance: `tests/e2e/catalog-tour-crud.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Primera medición: exit 1, 1 failed / 3 passed. El fallo fue el segundo clic bloqueado por el spotlight adelantado; el assert de fase corría antes del RAF de Driver. No se acepta ese timeout como el oráculo pretendido.
- Oráculo ajustado: esperar dos frames tras la respuesta de error antes de afirmar la fase. Se remide la misma mutación, sin ampliar el presupuesto de defectos.

## M2 — Guardar fallido no avanza

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts:52`.
- SHA1 limpio: `4cc265476efc3db4a0c32cb314b0664beccb091c`.
- Alcance: `tests/e2e/catalog-tour-crud.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Remedición válida: exit 1, 1 failed / 3 passed (14.8 s). Assert: esperaba «Guardá los datos», recibió «Operación confirmada» después de respuesta fallida.
- Restauración: diff vacío y SHA1 limpio confirmado.

## M3 — Seleccionar segunda fila conserva entidad

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts:27`.
- SHA1 limpio: `4cc265476efc3db4a0c32cb314b0664beccb091c`.
- Alcance: `tests/e2e/catalog-tour-crud.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Resultado: exit 1, 1 failed / 3 passed (14.4 s). Campo esperado «Torta», recibió «Café» al seleccionar la segunda fila.
- Restauración: diff vacío y SHA1 limpio confirmado.

## M4 — Salir no cancela importacion operativa

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/catalog-tour-controller.tsx`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/catalog-tour-controller.tsx:96`.
- SHA1 limpio: `4b78d82eadeaa5afc14da941c84ed9db2d2396e2`.
- Alcance: `tests/e2e/catalog-tour-import.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Primera medición: exit 1, 1 failed / 2 passed (15.4 s), pero PDF/salida pasó. El closure inicial no es el que usa el popover después de cambiar de fase; el rojo de fotos no demuestra cancelación. Medición descartada para ese objetivo.
- Se corrige el punto de inyección al `stop` del contexto que invocan todos los pasos, mismo defecto plausible y mismo presupuesto.

## M4 — Salir no cancela importacion operativa

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/catalog-tour-context.tsx`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/catalog-tour-context.tsx:41`.
- SHA1 limpio: `1a1f5eac3c849a911b9e377ff4622bde96a9dda8`.
- Alcance: `tests/e2e/catalog-tour-import.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Remedición: exit 1, 2 failed / 1 passed (17.2 s). PDF falla en el assert posterior a «Salir de la guía»: desaparece «Cancelar importación», que estaba visible antes; el cierre inyectado pulsó la acción operativa. El otro rojo de fotos es colateral y no se usa para demostrar el objetivo.
- Restauración: diff vacío y SHA1 limpio confirmado.

## M5 — Borrar requiere confirmacion explicita

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/use-catalog-actions.ts:31`.
- SHA1 limpio: `4cc265476efc3db4a0c32cb314b0664beccb091c`.
- Alcance: `tests/e2e/catalog-tour-delete.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Resultado: exit 1, 1 failed / 1 passed (6.1 s). Antes de confirmar, esperaba `writes=[]`, recibió `DELETE /api/catalog/product/product-second`.
- Restauración: diff vacío y SHA1 limpio confirmado.

## M6 — Fallo de progreso muestra error y reintento

- Estado previo: `?? apps/merchant/src/app/backoffice/catalog/catalog-tour-controller.tsx`.
- Mecanismo: `apps/merchant/src/app/backoffice/catalog/catalog-tour-controller.tsx:77`.
- SHA1 limpio: `4b78d82eadeaa5afc14da941c84ed9db2d2396e2`.
- Alcance: `tests/e2e/catalog-tours.spec.ts` (todo el archivo).
- Medición: pendiente; fila abierta antes de aplicar.
- Restauración: diff vacío y SHA1 limpio confirmado.
- Resultado: exit 1, 1 failed / 1 passed (9.6 s). Falta el aviso «No pudimos guardar tu progreso» después del POST fallido.

## Cierre del presupuesto

Seis defectos distintos medidos; cinco producen un rojo pertinente, M1 sobrevive por la limpieza técnica independiente del flag. M2 y M4 se remidieron tras descartar señales que no demostraban el objetivo. Todas las copias restauradas por SHA1 y diff; ningún marcador queda aplicado. No se amplía el presupuesto buscando una propiedad universal.

## Cambios legítimos después de restaurar

La segunda corrección de revisión cambia el controlador (race entre DOM del import y RAF),
por lo que su SHA final difiere del baseline de los experimentos. Las seis restauraciones
se verificaron antes de esas correcciones; no se revierte el arreglo para igualar un hash viejo.

- SHA1 final `catalog-tour-controller.tsx`: `ffad2e8c7883e0ec6836261ba7636ee0d254dfb0`.
- SHA1 final `use-catalog-actions.ts`: `4cc265476efc3db4a0c32cb314b0664beccb091c`.
- SHA1 final `catalog-tour-context.tsx`: `1a1f5eac3c849a911b9e377ff4622bde96a9dda8`.
