# 0242 CP2a.3 — QA independiente

Resultado: PASS focal del candidato `6f217fecb2c41cc0fb1a87958be6d018e754a500`, con los límites y fallos de guardias indicados abajo. Sin hallazgos de producto pendientes en este encargo. No equivale a verify global ni autorización de publicación.

QA en WT/rama `pos-qa-0242`, contexto nuevo, sin subdelegación ni cambios de producto/tests. Candidato limpio confirmado antes del informe. Base de combinación aceptada `8b73fe4e`; entrega final del autor `51a37d830697cae770dc50af0d01e1de892d2383`, base propia `9b462a7aec57ff13028fa172c96676f864bf89b2`. Runtime local comprobado Node24.20.0/pnpm11.4.0; lockfile y dependencias sin cambios del encargo.

## Revisión independiente e identidad

Leídos AGENTS, protocolos de trabajo/verificación, ficha CP2a.3, contrato0242 §2 y diff/código pertinente. Se comprobó que create/update escriben cabecera y product_location en una transacción, con validaciones de categoría/locales y relectura autorizada dentro de ella. Update bloquea la fila y calcula salesRevision desde el estado actual; business-config precede producto/import y delete conserva ese orden. Comparación decimal sin floating point y conjuntos normalizados evitan incrementos ficticios; cambios comerciales combinados incrementan una vez. Update no escribe metadatos de medida. DTO/parser/firmas legacy permanecen intactos.

Preparación de imagen fuera de tx; conflicto por key/version antes de sustituir; rollback limpia el prefijo preparado propio y limpieza del anterior ocurre después del commit. Import permanece aditivo, con relectura/accepted/replay y nuevos unit/revisión1, sin reconciliación destructiva ni proveedor/R2 dentro de tx. El DDL temporal del test usa esquema/trigger únicos y local+negocio exclusivos de fixture para cubrir update y create; finally/afterAll retiran DDL y fixtures/owners. No debilita constraints ni modifica migraciones canónicas.

Identidades verificadas con git diff vacío: tres fuentes de producto contra `90e491d0a9ba126c3270882178596e77b14eba94`; test nuevo contra `0e0d7d6c53e864c00f2928ddeb7e7cd3e8d49b02`; dos tests legacy contra `620431e14b68ce97adbf0e58480291bd346046f7`. Desde el candidato previo `e212d378` solo cambió el handoff. QA revisó que stock→replace/uploadId conserva preparación simulada, concurrencia real,409 y cleanup propio; las seis expectativas SQL escala2→9 mantienen valores/aserciones exactas, sin alterar inputs. `git diff --check 8b73fe4e..HEAD`: PASS.

## Evidencia reutilizada

DB ejecutada exclusivamente por autor con Node24, `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env`, `tools/neon-test.sh` y `--no-file-parallelism`, reserva exclusiva incluido teardown. QA no abrió env, no ejecutó DB/wrapper/DDL ni repitió suites por ceremonia. No hay logs persistidos: origen es handoff versionado y extractos originales transmitidos por autor con sesión/chunk; QA no afirma inspección directa de logs completos.

- Inicial `90e491d0`: sesión65136/chunk2447a9, EXIT1,25PASS/4FAIL/0SKIP. Catálogo7 e importguard6 PASS reutilizables. Cuatro fallos legacy eran comparaciones SQL escala2 frente numeric(24,9); no se alegó cobertura de aserciones posteriores a esos fallos.
- Test propio corregido `0e0d7d6c`: sesión34545/chunkaa9909, EXIT0,6PASS/0FAIL/0SKIP. Cubre unit1/deltas/no-op/categoría/imagen, updates concurrentes/enlaces, tenant y guard import, rollback real posterior a cabecera tanto create como update, conflicto de imagen/cleanup propio e import aditivo concurrente/replay/omitidos. Teardown sin errores; afterAll comprueba ausencia de esquema/negocios/owners.
- Dos legacy corregidos `620431e1`: sesión88782/chunks3ab1d0+d545e8, EXIT0,10PASS/0FAIL/0SKIP. Incluyen idempotencia/relectura/categorías concurrentes/rollback y tenant/cancelación/no-op. Producto y demás suites compatibles no cambiaron.
- Tipos domain/db/merchant PASS (sesión38341/chunk54029f; merchant repetido94018/b90edb). Lint/formato focal PASS; dos legacy26135/1d30b2. Puros47PASS y12SKIP offline44324/7a6ac7; esos skips no cuentan como DB. App-boundary/ui-rules23PASS y ui-guard74archivos sin aumentos82664/679eb8.
- Guardias finales `0e0d7d6c`,79515/ee6ee2: EXIT1,24PASS/2FAIL. Backlog exacto: expenses/immediate.neon.integration.test.ts→stock/count.ts; cinco core literales en backoffice-context-controller.test.ts, backoffice-context-refresh.test.ts, checklist-context-resource.test.ts, analytics/evaluation/policy-simulation.test.ts y analytics/lifecycle/index.ts. Sin offender nuevo del encargo tras corregir fixture. No se declara guardias verdes.

Evidencia compatible final: propia6 + catálogo7 + importguard6 + import/write-races10 PASS, compuesta entre revisiones de identidad comprobada; no una corrida integral verde ni aprobación por reintento.

## Límites y cierre

R2/proveedor sustituidos; no certifica efectos externos reales. Wrapper avisó falta de rol consumer, fuera de selección y sin certificar ese rol. Mass sigue dormido; HTTPv2, hook/composición/publicación y carrera de inicio de import no asignada quedan fuera. Sin browser/build/fullverify/M0/M1 ni push/PROD.

Autor reportó wrappers terminados, DDL/fixtures/owners retirados y0procesos. QA comprobó lsof de su WT: solo inspectores temporales shell/lsof/rg,0procesos persistentes; no creó servidores/túneles/sesiones DB. Único archivo QA editable: este informe; commit documental único para entrega al coordinador.
