# 0242 CP2b.5 — QA independiente de creación V2

Veredicto: **PASS acotado CP2b.5 creación V2 y su combinación en el candidato indicado**, sin hallazgos de producto. Evidencia compuesta compatible: diez casos completos más un caso focal posterior; no se declara una corrida completa nueva de once casos ni PASS global de guardias. QA nuevo, sin subdelegación ni cambios de producto/tests. Único path de escritura QA: este informe.

## Identidad y alcance

Base de combinación `89df00e2`; implementación `5ab9cecc7399fad6bfc7c634481a3e70f05c28a1`; candidato inicial `a63d583eddc1d6c089203981b0df238179a9ec2b`. Segunda revisión inspeccionada `3694a47401cac4ca31490ac6809631611fcce14a`, incorpora correcciones exclusivas de tests `a196856f62fd4243edf43a1ea205d82ced5e5558` y documentación. `git diff --exit-code 5ab9cecc HEAD -- measured-create.ts measured-capture.ts routes.ts` con paths completos: EXIT0; producto idéntico. WT propio `/private/tmp/checkpass-pos-0242/pos-qa-0242`.

Candidato final congelado `be856dab501ad8e6b87c7e0cd06666391690442b`, entrega autor `6122839404f9c93916867e33804e1abb496593f0`, revisión final de tests `2f2891163f0730c1a9b50edad238865a826a9e90`. Handoff final leído y contrastado. Delta cfcb0752→be856dab únicamente handoff; diff de tres archivos de producto contra5ab nuevamente EXIT0. Código de listado aceptado presente en la base de combinación, sin cambios de writer/readers ajenos.

Solo POST orders negocia creación2; V1 ausente/1 conserva writer anterior. Sin PUT/listado/cierre/grant/migraciones/kit. Lectura de AGENTS, protocolos, ficha y contrato0242 §1/3. No DB/env/wrapper propios; CI exclusiva del autor.

## Revisión de invariantes

- Dispatcher conserva guard y scope antes del handler; negociación de contrato precede body/dominio. HTTP mantiene201 y private,no-store; permiso POS suficiente.
- Lock módulo compartido → lock intención business/request → replay propio antes de catálogo/local/mesa/etiqueta. Huella distinta409; misma intención recupera ID y DTO canónico actual, incluso editado/cerrado/anulado. Sin catch indiscriminado23505; unique0106 sigue respaldo.
- Nueva captura: mutex compartido `business-config/` antes de moneda/fila business SHARE, mesa/local y producto SHARE ordenado. Configuración y productos autoritativos se leen dentro de transacción; catálogo/configuración usan el mismo mutex. Locks de toggle, mesa y local revisados contra writers existentes, sin inversión encontrada.
- Mesa real determina nombre/local; tenant, estado, Mesas y ocupación se revalidan. Local explícito activo y propio; null requiere único activo. Counter genera etiqueta desde ID persistido y replay no la recrea.
- Dinero/cantidad usan núcleo racional y adaptador de tarifa unit legacy confiable; nueva cantidad conserva límites V2. Precio0 válido, null no disponible. Posición/ID por línea, sin merge por producto; snapshots abiertos no inventan finanzas congeladas. Productos no tienen flag activo: disponibilidad local es el estado comercial aplicable.
- Barreras0102/0103/0105 intactas; solo23514 con tres nombres precisos de barrera POS se traduce a upgrade. Sin habilitar masa canónica, preparar no acredita/cierra ni emite efectos financieros.

## Evidencia QA independiente

Node24.20.0; sin secretos/env. Logs externos al WT:

- `/private/tmp/0242-create-qa-types.log`: `pnpm --filter @mi-pasaporte/merchant typecheck`, EXIT0 sobre candidato inicial. Código integrado compatible por identidad de producto.
- `/private/tmp/0242-create-qa-pure-initial.log`: suite pura entregada inicialmente4FAIL/0PASS por DATABASE_URL ausente en construcción de `availableAtCounter` → getDb. Fallo conservado y clasificado setup de test, no PASS inicial.
- `/private/tmp/0242-create-qa-pure-isolated.log`: reproducción independiente fueraWT,5PASS/0FAIL/0SKIP, EXIT0. Cuatro proyecciones originales más caso QA200 líneas unit distintas, quantity máxima con tarifa0 y overflow422 exacto. Artefactos `/private/tmp/0242-create-qa-pure.test.ts`, `/private/tmp/0242-create-qa-vitest.config.ts`. Mock único: `availableAtCounter` devuelve undefined porque tx entrega filas preseleccionadas; no certifica SQL/tenant/local. Primer intento del harness externo falló antes de descubrir tests por import absoluto de mocks Vitest; se corrigió usando globals, sin tocar producto. La dependencia real SQL se conserva en integración.
- `/private/tmp/0242-create-qa-final-pure.log`: sobre candidato `cfcb0752a4978ffba381d970abcf239c09a1a75b`, suite entregada final5/5PASS,0SKIP,EXIT0; reproduce el mapeo de tres barreras23514 y propagación por identidad de23514 desconocido/23505 de intención. Producto/tests idénticos al candidato final.
- `git diff --check`: EXIT0. Los paths de dos guardias rojos, offenders y dependencia stock/count son idénticos a base de combinación89df00e2; su diff por paths es vacío. No se declara PASS de esas guardias.

## Evidencia autor revisada

Directorio `/private/tmp/checkpass-pos-0242/create-evidence/`:

- `5ab9cecc-neon.log(.exit)`: primera CI3PASS/7FAIL, EXIT1. Timeouts5s, expectativas de tarifa canónica con ceros obsoletas y contaminación de local archivado al interrumpirse el caso previo. Preservado; no se cuenta como PASS.
- `5ab9cecc-unit.log`: fallo puro de setup anterior; `3b91166c-unit.log`:76PASS tras aislar solo construcción de visibilidad. Mock elimina getDb para proyección/algebra; no sustituye negativos SQL reales.
- Diff5ab→a196: únicamente mock puro, timeout60s de suite Neon y expectativas tarifa `1000000000`/`7` canónicas, manteniendo total monetario `14.00`. Cambios justificados, sin debilitar lógica/constraints ni simular callbacks imposibles.
- `revision2-neon.log`: suite real10/10PASS,0SKIP,97.47s, EXIT0; migración wrapper aplicada. Cubre guard401403/scope, permisoPOS, tenant, cuatro tipos, vacío/0/V1, carreras POST simultáneas e intención distinta, conflicto sin mutación, tarifa legacy con cantidad nueva estricta, replay tras edición/cierre/anulación/catálogo/local/mesa archivados, autoridad/ocupación/mesa inexistente/módulo apagado, producto ajeno/sin precio/no disponible/inexistente, revisión final obsoleta, cero efectos de preparación y espera comercial determinista observando advisory lock no otorgado. Teardown de mundos/owners sin fallos. La prueba posterior a INSERT se añade abajo, sin repetir los diez casos por ceremonia.
- `a196856f-static.log(.exit)`: tipos db/domain/merchant, lint/formato y UIguard pertinentes EXIT0. `a196856f-unit-guards.log(.exit)`:100PASS/2FAIL de102, siete archivos. Dos rojos baseline de modules-boundary-between (test expenses→stock/count) y modules-boundary-literals (cinco paths previos core); no se afirma PASS global ni se modifica guard para esconderlos.

- `rollback-neon.log(.exit)` sobre2f289116:1PASS/10excluidos deliberadamente por filtro,19.24s,EXIT0. Proxy intercepta únicamente insert de líneas, preserva tx/conexión real, comprueba cabecera y ejecuta INSERT de primera línea válida antes de SELECT1/0. SQL22012 esperado llega a503; tras rollback desaparecen cabecera y línea. Se restaura spy en finally, misma intención se crea correctamente con dos líneas y replay estable. Sin DDL/triggers/filas imposibles ni callback transaccional simulado. AfterAll final verifica ausencia explícita de businesses/users/sessions. Este caso acredita fallo SQL durante inserción; no se presenta como fallo natural de catálogo o del último INSERT.
- `2f289116-affected.log(.exit)`: tipos merchant, lint/formato de tests y77/77puros PASS/0SKIP,EXIT0. `2f289116-processes.log`:0procesos propios autor; CI cedida al coordinador. Pruebas QA finalizadas sin procesos propios.

## Límites y entrega

La validación comercial de última línea sucede antes del INSERT; el caso añadido cubre separadamente el rollback posterior con SQL real. No quedan pendientes de esta entrega. Los dos rojos amplios baseline permanecen explícitos y no equivalen a fallos introducidos por creaciónV2. Sin certificación de masa canónica, cierre/grant, toda la aplicación, release o PROD. Sin browser/build/fullverify/M0/M1, servidores/túneles/push. Factory, aceptación e integración corresponden al coordinador.
