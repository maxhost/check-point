# 0242 CP2a.2 — sales-units API

Task `sales-units-api-0242`; base `993390ca29edbec8d33f220557b93fdb5cc9c343`. Candidato de código congelado y probado: `65ce09c235ba10ab65a6ede1a5e2a8be77201637`. El commit documental posterior añade únicamente esta evidencia Neon.

Implementación en los seis paths reservados: configuration/http/error/business-contract, suite business-sales-units y este handoff. GET/PUT se integran en businessHttp actual con requireApiPermission('business'), sin scope POS. Las respuestas sales-units son private,no-store también ante fallos guard/body/revisión/DB. GET sin fila devuelve kg/revision1 sin insertar. PUT exige únicamente salesMassUnits/revision; validaciones422 invalid_sales_units incluyen fields.salesMassUnits. Unidades/revisión se guardan bajo el mismo mutex business-config y la revisión de regional/fiscal, en una transacción. No cambia datos regionales/fiscales.

unit_in_use consulta solo productos actuales mass del mismo negocio y devuelve id/name/pricingUnit autorizados mediante metadatos opcionales tipados BusinessError. No consulta snapshots/historia. La barrera0105 no cambia: **negativo canónico mass y carrera con catálogo pendientes de CP2c**, cuando se active masa. No se certifican ahora ni se usan fixtures imposibles.

## Evidencia offline

Node24.20.0 / pnpm11.4.0, dependencias propias, lockfile sin cambios, sin env heredado. Tipos domain/db/merchant PASS; lint focal PASS; prettier focal PASS; git diff --check PASS; ui-guard contra base PASS (un archivo vigilado, sin aumentos).

Guardias modules-boundary/between/literals: 24 PASS/2 FAIL de backlog conocido: expenses/server/immediate.neon.integration.test→stock/count; core literals en backoffice-context-controller, backoffice-context-refresh, checklist-context-resource, analytics/evaluation/policy-simulation y analytics/lifecycle/index. Ningún offender añadido por este diff; guardias sin editar. Un intento inicial de filtro --project merchant falló antes de ejecutar por nombre de proyecto incorrecto; se corrigió la selección por paths.

## Prueba DB real

Suite propia Request→businessHttp→guard→DB, sin mocks permisos: GET default sin escritura, creación, rechazos/rollback sin fila inicial, validaciones y campos ajenos, revisión compartida regional/fiscal en ambas direcciones, dos PUT concurrentes, staff business/owner, 401/403, aislamiento B/A y rollback de fallo DB real (overflow de revisión integer controlado solo en fixture). Teardown elimina mundos, usuarios owner/staff y sesiones y comprueba ausencia de filas propias. Tras transferencia explícita de CI al task, se ejecutó:

```sh
source ~/.nvm/nvm.sh && nvm use
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/business-sales-units.neon.integration.test.ts --no-file-parallelism
```

Resultado sobre SHA65ce09c2: wrapper exit0, migracionesCI aplicadas correctamente; **1 archivo PASS, 6 casos PASS, 0 skips, 0 retries**, 47.02s total (45.20s suite). Incluye teardown exitoso con aserciones de ausencia de negocios, usuarios owner/staff y sesiones propios. El único stderr business_request_failed es el fallo DB inducido esperado (overflow integer), cuya respuesta503 segura y rollback se comprobaron. Aviso wrapper: NEON_CI_CONSUMER_DATABASE_URL ausente en env privado; esta selección no utiliza el oráculo consumer y no omite ninguno de sus seis casos. No se leyó env local/PROD ni se imprimieron secretos. Al cerrar wrapper, comprobación lsof desde /private/tmp: cero procesos con cwd del WT.

Sin push/PROD, sin schema/guards/tooling/deps/UI. Sin servidores propios. Retiene fixes hasta aceptación; factory y QA/integración corresponden al coordinador.
