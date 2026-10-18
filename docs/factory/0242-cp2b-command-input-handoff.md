# 0242 CP2b.2 — entrada e intención de órdenes V2

Base `b1c986d4e203d1e3f4405a01de848787b45de8a5`. Código congelado `ca87073000712156d0a251354efff0e3e63f065c` (implementación0596bc24 y corrección de inferencia ca870730). Rama `pos-command-input-0242`, WT `/private/tmp/checkpass-pos-0242/pos-command-input-0242`. Cierre documental posterior sin delta de código. Reserva: seis helpers/tests y este handoff; sin otros archivos editados.

`measured-input.ts` ofrece `parsePosCreateV2` y `parsePosUpdateV2`: comandos completos, hasta200 líneas, UUID normalizado, contexto/tipo/etiqueta aplicable/nota, versión positiva INT32. Legacy requiere contexto existente suministrado por servicio; no puede seleccionarse en create ni autorizarse mediante un campo del body. Mesa real/counter normalizan etiqueta a cadena vacía para que la resuelva/genere el servicio. Referencias conservadas, sin resolver local/mesa ni consultar catálogo.

`measured-line-input.ts` separa `parseMeasuredLineInput` (sintaxis) de `resolveExistingMeasuredLine` (comparación obligatoria con snapshot confiable). La sintaxis de update es provisional: el futuro servicio debe resolver CADA línea existente con filas de su orden bloqueada. Los helpers no prueban pertenencia por tenant/orden ni convierten un snapshot del body en confiable. Conservar cantidad unit histórica alta solo se concede ante coincidencia exacta/canónica con esa fuente; nuevas/cambiadas usan captureQuantity. No se amplía ese parser ni se reduce el adaptador histórico. Se conservan nombre, producto, tarifa, unidad tarifaria y conversionVersion; cambio de dimensión prohibido. Nueva captura mass compatible puede cambiar quantityUnit conservando el resto. El cliente debe reenviar fuente original cuando solo cambia presentación; aquí no se inventa ni se detecta una aproximación presentada como medición deliberadamente nueva.

`create-intent.ts` ofrece `createIntentFingerprint(raw)` con parseo V2, estructura explícita de claves estables y SHA256 servidor. Conserva orden/cardinalidad/snapshots distintos del mismo producto. Incluye tipo/etiqueta aplicable/local/mesa/nota y producto/cantidad/unidad/revisión por línea; excluye createRequestId, cuya unicidad será business+createRequestId en la futura API. No depende de nombres/precios/catálogo actuales. El digest no es credencial ni certifica idempotencia DB. No muta input.

## Evidencia

Node24.20.0/pnpm11.4.0, dependencias propias existentes; hooksPath `.githooks` y pre-push presente, sin bypass. Ninguna instalación ni acceso DB/env/wrapper. Logs completos fuera del WT en `/private/tmp/checkpass-pos-0242/pos-command-input-logs/`; `check.py` y `check-revision.py` registran SHA/comando/stdout+stderr/exit real. Los comandos de verificación se ejecutaron sobre código congelado, checkout limpio.

| Evidencia | SHA | Resultado |
| --- | --- | --- |
| `pure-ca870730.log` | ca870730 | 3 archivos,72PASS/0FAIL/0SKIP, EXIT0; input create/update, prohibidos, cantidades, snapshot, legado, identidad, huella |
| `types-merchant-ca870730.log` | ca870730 | merchant typecheck PASS, EXIT0 |
| `types-domain-0596bc24.log`, `types-db-0596bc24.log` | 0596bc24 | domain/db PASS, EXIT0; delta posterior solo anotación de retorno del helper merchant |
| `lint-ca870730.log`, `format-ca870730.log`, `diff-ca870730.log` | ca870730 | seis paths lint/prettier y diff --check PASS, EXIT0 |
| `ui-guard-ca870730.log` | ca870730 | 3 archivos sin aumentos, EXIT0 |
| `boundaries-0596bc24.log` | 0596bc24 | 24PASS/2FAIL, EXIT1; backlog exacto descrito abajo, sin offender nuevo; delta posterior solo anotación de tipo |
| `processes-final-ca870730.log` | ca870730 | cero procesos propios persistentes, EXIT0 |

Backlog separado: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`; cinco core literales extra en `app/backoffice/backoffice-context-controller.test.ts` (3), `app/backoffice/backoffice-context-refresh.test.ts` (1), `app/backoffice/onboarding/checklist-context-resource.test.ts` (1), `server/analytics/evaluation/policy-simulation.test.ts` (2), `server/analytics/lifecycle/index.ts` (1). Guardias sin editar; no se declara PASS global. Primer typecheck merchant en0596bc24 falló por inferencia saleType:string; corregido con retorno tipado y repetido PASS en ca870730. Logs iniciales preservados.

Git add/commit inicial y ps ordinario dieron EPERM del sandbox; avisados inmediatamente al coordinador y resueltos por escalaciones propias autorizadas (solo índice/commits de rama propia y lectura ps). Sin refs principales modificadas.

Sin rutas/readers/writers, DB, guard/scope/locks/idempotencia transaccional, UI, dinero, migraciones ni activación mass. Sin browser/build/fullverify/M0/M1/servidor/túnel/demo/push/PROD. QA nuevo debe evaluar el candidato; autor conserva fixes. Factory/aceptación/integración a cargo del coordinador. La futura API con otro autor limpio debe aportar contexto/snapshots autoritativos y comprobar ese cableado y concurrencia por separado.
