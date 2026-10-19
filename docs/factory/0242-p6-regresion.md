# 0242 P6A — regresión HTTP tras el corte V2

Ficha del coordinador, previa a implementación. Autor NUEVO/contexto vacío en
WT/ref `pos-ui-card-0242`, después de aceptar P4 y continuar factory sobre el
commit documental integrado. No reactivar autores históricos para este bloque.
Spec0242 y contratos existentes cerrados; no cambiar producto para acomodar tests.

## Objetivo y corte inicial

Las suites HTTP anteriores aún omiten scope/contract2 o esperan respuestas V1.
Actualizar sus fixtures y oráculos al corte aceptado conservando casos negativos,
aislamiento, dinero, snapshots, concurrencia e idempotencia. Primero inventariar
dependencias y proponer estrategia al coordinador; después implementar por cortes.
No añadir headers globales al despachador genérico, no traducir silenciosamente
cuerpos inválidos, no eliminar assertions/casos por estar rojos.

Paths iniciales exclusivos, todos bajo `apps/merchant/src/modules/pos/server/`:

- `pos-integration-support.ts`, `pos-payment-integration-support.ts`.
- `measured-create.neon.integration.test.ts`, `measured-update.neon.integration.test.ts`,
  `measured-read.neon.integration.test.ts`, `read-api-v2.neon.integration.test.ts`,
  `close-api-v2.neon.integration.test.ts`, `void-api-v2.neon.integration.test.ts`.
- Informe propio `docs/factory/0242-p6-regresion-handoff.md`.

Scope/cookie deben representar la intención real del caller. Mantener llamadas
raw explícitas para missing/mismatch/upgrade y escalera auth. Fixture positiva V2
puede construir un comando válido explícito (note:null, UUID, unidades, revisión),
pero no reparar automáticamente una entrada negativa ni volver a capturar otra
identidad durante un reintento. Conservar lectura de filas históricas mediante
seed SQL controlado cuando el writer HTTP V1 ya está retirado. Probar V1 rechazado
sin efectos; no intentar reabrirlo. DTOs exactos deben seguir comprobando todas las
claves del contrato actual. Neto0 usa payments[], nunca efectivo ficticio.

Inventariar también consumidores transitivos del soporte (POS, Mesas, eventos,
storage-expand y pruebas Counter antiguas). Antes de editar otros archivos,
solicitar ampliación concreta de paths. No borrar dominio histórico/compartido,
editar migraciones viejas, desactivar constraints0108 ni cambiar guards/baselines.

## Recursos y aceptación

Preparación offline mientras QA anterior usa DB. CI protegida SOLO cuando el
coordinador transfiera `db:neon-ci`; incluye teardown. Exclusivamente wrapper
`tools/neon-test.sh`, configuración seleccionada privada existente, sin mostrar
secretos ni copiar env general. Suites con DDL seriales y separadas de las demás.
No Next/browser requerido en este corte; M1 usa otro writer y recursos seriales.

Node24; tipos/lint/formato pertinentes. Ejecutar suites afectadas con casos reales
y registrar cada intento/skips/fallo. La señal de aceptación inicial son los seis
archivos HTTP más soporte compatible; ampliar por impacto demostrado. QA NUEVO
independiente revisará diff/matriz y reproducirá señales decisivas en congelado.
Commit limpio sólo propio; entregar SHA al coordinador, sin factory/estados/índices.
Sin capturas, push, PROD ni tocar3201/túnel/procesos/cambios ajenos.

## Ampliación auth/tenant previa a código

Después del inventario39consumidores únicos, se asignan explícitamente también:

- `apps/merchant/src/modules/pos/server/pos-access.neon.integration.test.ts`.
- `apps/merchant/src/modules/pos/server/pos-ladder.neon.integration.test.ts`.
- `apps/merchant/src/modules/pos/server/ticket-settings.neon.integration.test.ts`.
- `apps/merchant/src/modules/pos/server/payment-methods.neon.integration.test.ts`.
- `apps/merchant/src/modules/tables/server/tables.neon.integration.test.ts`.

Conservar escalera de guard y controles positivos scoped2, aislamiento/permisos,
ajustes owner/noowner sin autoenable y locks/Mesas. No nuevo acceso entre módulos
ni cambios de guard/baseline. Los demás33transitivos siguen pidiendo ampliación
por grupo; no editar todos de forma implícita. Recursos DB aún no transferidos.

## Ampliación dinero/concurrencia previa a código

Paths adicionales exclusivos bajo `apps/merchant/src/modules/pos/server/`:
`pos-close.neon.integration.test.ts`, `pos-close-reuse.neon.integration.test.ts`,
`pos-close-races.neon.integration.test.ts`, `settlement.neon.integration.test.ts`,
`business-financial.neon.integration.test.ts`, `measured-summary.neon.integration.test.ts`.
Conservar oráculos monetarios/durables y carreras reales, errores antes/después
commit, orden de locks y UUID/cuerpo/versiones. No sustituirlos por assertions de
status aisladas ni mocks. Preparación offline permitida; DB sigue pendiente de
transferencia exclusiva al terminar QA nativa y teardown.

## Ampliación de soporte indirecto previa a código

Asignados `apps/merchant/src/modules/pos/server/business-core-support.ts` y
`apps/merchant/src/modules/pos/server/business-failures.neon.integration.test.ts`.
El soporte contiene writersHTTPV1 indirectos: adoptar V2 mediante opción explícita
capturada en setup, conservar default raw y negativos/carreras/rollback. Corregir
la clasificación de compatibilidad del inventario; no contar lectura estática como
PASS. DBCI transferida al autor P6A sólo tras teardownQA confirmado29b8592c.

## Ampliación residual HTTP previa a código

Paths asignados:

- `apps/merchant/src/modules/pos/server/pos-orders.neon.integration.test.ts`.
- `apps/merchant/src/modules/pos/server/pos-best-sellers.neon.integration.test.ts`.
- `apps/merchant/src/modules/pos/server/pos-disable.neon.integration.test.ts`.
- `apps/merchant/src/modules/pos/server/pos-disable-tables.neon.integration.test.ts`.
- `apps/merchant/src/modules/analytics-an3-events.neon.integration.test.ts`.
- `apps/merchant/src/modules/brand-fiscal-inert.neon.integration.test.ts`.
- `apps/merchant/src/modules/stock-local.neon.integration.test.ts`.
- `apps/merchant/src/modules/negocio-retirement.neon.integration.test.ts`.

Sólo adopción de fixtures HTTP al contrato vigente y conservación de los oráculos
originales; no corregir backlog no relacionado ni debilitar invariantes de eventos,
stock/analytics, marca fiscal o retiro. No alterar el checkout mientras corra el
lote congelado. Puede preparar un patch propio privado con estos paths exactos
sin crear otro worktree/configuración, para aplicarlo después del cierre del lote.

## Ampliación final de históricos/storage previa a código

Paths bajo `apps/merchant/src/modules/pos/server/`:
`catalog-storage-expand.neon.integration.test.ts`,
`quantity-storage-expand.neon.integration.test.ts`,
`catalog-measure-storage.neon.integration.test.ts`,
`order-intent-storage.neon.integration.test.ts`,
`unit-expand-compat.neon.integration.test.ts`,
`pos-migration-0079.neon.integration.test.ts`.

Preparación privada permitida mientras corre el lote congelado, sin alterar su
checkout. Conservar pruebas de SQL/migración de origen mediante clones/aislamiento
existentes, hashes y constraints; jamás retirar0108 en core real. WritersHTTPV1
positivos pasan a seed histórico SQL o V2 explícito según la intención original;
proyecciones históricas internas y rechazo HTTPV1 siguen teniendo oráculos.
Cada suite con DDL se ejecuta aislada, serial, sin otros procesos DB, incluido
teardown. No convertir pruebas de expand antiguo en afirmaciones de dormancia
vigente después de0108; separar historia de invariantes actuales.
