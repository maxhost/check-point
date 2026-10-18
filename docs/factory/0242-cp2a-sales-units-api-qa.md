# 0242 CP2a.2 — QA independiente sales-units API

Candidato congelado: `5128d67bad276e9f9523f358a5f055cd019fb3fb`, limpio al iniciar; base aceptada `9b462a7a`, entrega `d60f70859967891e307dc9a8ebd4d6c1b72ca556`, ambas ancestros comprobados. Worktree/rama QA: `/private/tmp/checkpass-pos-0242/pos-qa-0242`, `pos-qa-0242`. Único archivo escrito por QA: este informe. Sin cambios de producto, tests, guardias, refs de integración ni índices comunes.

## Revisión de aceptación

Sin hallazgos bloqueantes en el diff de seis archivos respecto de la base aceptada. Contrastados ficha, contrato0242 §2, handoff, implementación, suite y dependencias pertinentes:

- GET/PUT usan el catch-all business existente y `requireApiPermission(request, "business")` real, antes de interpretar body o acceder al dominio. Conservan owner/staff business y no introducen scope POS.
- GET proyecta exclusivamente `salesMassUnits/revision`; sin fila devuelve kg/revisión1 mediante SELECT, sin inserción.
- PUT solo acepta las dos claves previstas, lista no vacía de kg/lb/g sin repetición y revisión entera positiva. Datos ajenos, fiscalidad/moneda/timezone incluidos, producen422 `invalid_sales_units` con `fields.salesMassUnits` antes de escribir.
- Comparación, consulta de unidades usadas, incremento y escritura quedan dentro de `withDbTransaction`, bajo el mismo advisory mutex `business-config/<businessId>` que regional/fiscal. La inserción inicial también se revierte ante conflicto. Regional/fiscal no cambian en este diff; sus escrituras conservan las unidades y comparten la revisión.
- La consulta `unit_in_use` limita por businessId autorizado, `soldByWeight=true` y pricingUnit fuera de la lista solicitada. Solo lee productos actuales; no consulta ni elimina historia/snapshots. Metadatos de error previstos: id/name/pricingUnit de esas filas, sin selección del tenant desde body.
- El envoltorio aplica `private, no-store` a respuestas sales-units de éxito, guard, body, revisión, método no despachado y fallo DB. El catch devuelve503 seguro sin filtrar detalles de DB; el log solo registra el tipo de error. `BusinessError` añade metadatos tipados sin modificar `CounterError`.
- `MassUnit` se importa/reexporta desde domain, sin definición duplicada. No hay imports ni nombres nuevos de módulos concretos en business/core. No hay cambios de schema, UI, tooling, dependencias ni guardias.

La barrera `product_sale_measure_legacy_check` de migración0105 permanece intacta. **El negativo con producto mass canónico y la carrera con el writer catálogo siguen pendientes de CP2c**: este PASS no certifica ese gate final ni habilita masa. No se montó una fixture imposible.

## Evidencia e identidad

QA local: Node24.20.0, pnpm11.4.0, dependencias del worktree. PASS de `pnpm --filter @mi-pasaporte/merchant typecheck`, eslint y prettier focales de los cinco archivos TypeScript cambiados, `git diff --check 9b462a7a..HEAD` y `node tools/ui-guard.ts --base 9b462a7a` (1 archivo vigilado, sin aumentos). Exit0 en todos. Aviso no bloqueante de Node sobre MODULE_TYPELESS_PACKAGE_JSON al ejecutar ui-guard.

La evidencia del autor corresponde al código `65ce09c235ba10ab65a6ede1a5e2a8be77201637`: tipos domain/db/merchant, lint/formato/ui-guard PASS y Neon real **1 archivo/6 casos PASS, 0 skips, 0 retries, 47.02s**. QA inspeccionó la suite completa, harness de sesiones/teardown, configuración Vitest y wrapper antiPROD. Comprobó diff vacío entre ese SHA y candidato en los cinco TS de la entrega, DB, lockfile, wrapper/config/setup y harness/guards relevantes; los cambios combinados del candidato pertenecen a Recetas ya aceptado y no alteran este camino. El handoff posterior solo amplía evidencia documental.

No existe archivo de log raw persistido. El autor recuperó del historial de herramientas la salida original de sesión90030: chunk0bdfa9 (HEAD65ce09c2/inicio), c24f54 (migración/RUN) y699293 (exit0 final). QA recibió y contrastó con la suite los seis nombres de casos y los totales originales:6 tests/45196ms,1 archivo PASS,6 casos PASS, duración47.02s (setup15ms/import1.72s/tests45.20s). El coordinador recibió la misma salida recuperada; no se atribuye una ruta de log inexistente.

La suite recorre Request→businessHttp→guard→DB, sin mock de permisos: default sin escritura; rollback de inserción inicial; creación e invalidación de revisiones entre los tres writers; validaciones y campos ajenos sin efectos; dos PUT de igual revisión con un ganador; owner/staff,401/403 y aislamiento B/A; fallo DB real por overflow integer con503 seguro y rollback. El teardown verifica ausencia de negocios, owners/staff y sesiones propios. Los seis casos tienen aserciones efectivas; no hay retries configurados ni casos omitidos en la corrida entregada.

Ejecución del autor mediante `tools/neon-test.sh src/modules/pos/server/business-sales-units.neon.integration.test.ts --no-file-parallelism`, con env privado seleccionado y CI exclusiva asignada por coordinador; migraciones aplicadas. El aviso de ausencia de consumer URL no elimina casos de esta selección. El stderr de fallo DB inducido es esperado. QA no recibió recurso DB/env y no ejecutó wrapper, migración ni acceso DB adicional.

Guardias heredadas:24 PASS/2 FAIL de backlog (expenses→stock/count y cinco literales core), declaradas por autor. El diff no modifica esos archivos ni guardias y no introduce offenders. No se afirma fullverify PASS. No se ejecutaron build/browser/M0/M1 ni batería global por ceremonia.

## Cierre

Veredicto: **PASS para CP2a.2 y su combinación en el candidato indicado**, con los gates mass/carrera expresamente pendientes de CP2c. Sin hallazgos que requieran corrección ni duda concreta que justifique repetir CI. Sin push/PROD. Cero procesos con cwd del worktree comprobado mediante lsof desde `/private/tmp`; se entrega commit documental limpio.
