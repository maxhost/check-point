# 0242 CP1b.3 — QA independiente: PASS

Revisión nueva de entrega y combinación sobre candidato congelado `46d1d9b0929c4bd62a3f567e1bfbb0a7e43fb30a`, base `e12216feb0809fb276b86fbb5a531bce26599764`, entrega `00ce3546a8293dd89544b07d7ac928265f5fcd39`, producto/SQL `65119bd183f1fa9e6e648389f704061ba127860e`, fixtures `34d9203eae829a69f8f1b0e21b7ba48be69874dd`. Worktree QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, inicialmente limpio. Leídos AGENTS, protocolos, ficha completa vigente, anexo de precisión/compatibilidad y handoff de37líneas. Sin implementación ni cambios de guardias, estado, índices o refs principales.

## Revisión del contrato y diff

- Drizzle declara cuatro columnas numeric(24,9) con representación string y ocho metadatos NOT NULL/default unit/unit/unit/mass-si-1. Las seis barreras conservan quantity positiva/integral/INT32, centavos y rango anterior, y metadata unit coherente. Core conserva el rango signed de su antiguo numeric(12,2); POS conserva además su CHECK no negativo. No se habilita captura negativa ni masa/precisión comercial nueva.
- POS stringify en insert/update; counter valida quantity con el helper unit aceptado y cambia su cast a numeric. Los casts de puntos/sellos siguen integer. DTO/HTTP y eventos V1–V3 mantienen quantity number. Importes de línea/totales y JSON financieros sin cambios.
- JSONdiff recursivo semántico0102→0103: solo cuatro tipos, ocho columnas completas, seis checks e id/prevId. FKs, índices, IDs estructurales y demás tablas iguales; sin lectura textual completa del snapshot ni drift aceptado. Journal añade solo0103; no se edita historia.
- Catálogo movido íntegro: solo import de support y dos URLs relativas. Decoder cambia únicamente provider de fixture recipes→provider-a y formato. Unit-expand cambia exactamente las dos aserciones DB autorizadas a padded9; HTTP/DTO/eventos/rollback/retry intactos. Fixture pos-measurement cambia solo quantity1→string. No cambian guardias ni oráculos.
- El test antes/después crea clones propios con tipos/checks antiguos afectados; ejecuta las18sentencias canónicas por selección de tabla y sustitución exclusiva del identificador cualificado. Es una prueba acotada de preservación, complementada por wrapper canónico, catálogo real, metadatos/constraints/FKs/índices reales y flujo POS/core real; no revierte tipos compartidos ni toca fixturesM0.

## Evidencia reproducida

Node24.20.0, pnpm11.4.0, Vitest4.0.18. SHA256 lock `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; drizzle.config `e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc`; merchant vitest.config `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`; SQL0103 `370a8472343161f0dc2e551c72d4b7868316286fc75a5bb8fa193e6eab58873b`, coincidentes con handoff.

Desde raíz, tras `source ~/.nvm/nvm.sh && nvm use`:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/quantity-storage-expand.neon.integration.test.ts src/modules/pos/server/unit-expand-compat.neon.integration.test.ts src/modules/pos/server/catalog-storage-expand.neon.integration.test.ts src/modules/modules-fk.neon.integration.test.ts --no-file-parallelism
pnpm --filter @mi-pasaporte/db --filter @mi-pasaporte/domain --filter @mi-pasaporte/merchant typecheck
git diff --check
```

CI exclusiva mediante wrapper, migración canónica confirmada y hash contrastado por test: EXIT0, cuatro archivos,16/16PASS,0skips,82.31s. Storage3 incluye preservación de IDs/dinero/JSON, precio core negativo histórico, extremos máximo/0, defaults y rechazos de cantidad/rango/precisión/NaN/metadata. Lectores6 cubren listado/nota/adición, INT32×0, precio máximo×1, overflow422 con rollback completo, cierre con/sin pase/cupón y replay sin duplicar; core mantiene dinero exacto y eventos legacy number. Catálogo4 confirma ruta movida y contrato real; FK3 incluye control positivo y ausencia de core→módulo. Los afterAll terminaron y sus aserciones verificaron ausencia de owners/consumers/negocios/esquemas propios. Types db/domain/merchant y diff-check EXIT0.

Desde apps/merchant, con Node24:

```sh
pnpm exec vitest run src/server/module-events/decode-measured.test.ts src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts
```

Decoder68/68 y principal10/10PASS. Comando combinado EXIT1:92PASS/2FAIL de94,0skips,3.02s. Between falla solo por expenses/immediate→stock/count; literals solo por backoffice-context-controller.test, backoffice-context-refresh.test, checklist-context-resource.test, policy-simulation.test y analytics/lifecycle/index. `git diff --exit-code 00efff81 HEAD -- <esos seis paths>` EXIT0; sus bytes son anteriores al encargo. Guardias idénticas a base e12216fe. Cero offender nuevo0242: ni test catálogo en core ni provider recipes. No se declara PASS global de guardias.

Un primer comando QA de tests puros desde raíz con config merchant encontró0archivos (EXIT1); corregida únicamente invocación/CWD, produjo los94casos anteriores. No cuenta como cobertura. Se conserva también el ENOENT de fixture/0casos del autor descrito en handoff; no se reinterpretó como PASS ni se cambió SQL para corregirlo. Lint/formato focal del autor reutilizados por identidad del código; sin repetición global ceremonial.

## Límites y liberación

ConsumerURL ausente según wrapper: no certifica oráculo del rol consumer. PostgreSQL conserva semántica typmod; checks certifican representación legacy almacenada, no un parser textual arbitrario. M0/M1/control archivado/build/browser/global verify no ejecutados; smoke del control y nuevo freeze siguen pendientes antes de M1. Sin local/PROD, secretos expuestos, servidores lanzados ni migraciones inversas.

Inventario final `ps` inicialmente bloqueado por sandbox; repetido con escalación readonly acotada y autorizado:0vitest/drizzle/neon-test/servidores de este worktree. Servidores visibles pertenecen a checkouts ajenos, conservados. Todos los comandos propios completados, teardown CI incluido; CI liberada al coordinador. Único archivo escrito por QA: este informe. PASS acotado a CP1b.3 y su combinación congelada; no certifica publicación ni activación mass/V4.
