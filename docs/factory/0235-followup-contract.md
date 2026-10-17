# 0235 — CI previo y retiro posterior al corte

Owner: «aplica la migraciones en local. manda un agente para resolver el CI rojo, y otro para el punto4». Continúa0235/0150 y ADR0144, piso L2. Base previa e2cd4544; los workers parten del commit de esta ficha. No push, deploy, drenaje ni migración PROD autorizados. No INDEX/TASKS ni estados de Claude. Coordinador en dev, dos workers en árboles propios y QA independiente al congelar entregas; sin subdelegación.

## Base local y CI observados

Coordinador ejecutó otra vez db:local:migrate con DATABASE_URL en memoria y guard de host local:96→96; hashes0093/0094/0095 coinciden con journal y SQL. Configuración local huella16d3a8712ad6; no reset/seed ni valores expuestos. Evidencia /private/tmp/checkpass-negocio-local-migration-confirmation.json.

pnpm ci:status confirmó main5b834ca0 rojo, run38971334745: Stock stock-consumption.neon.integration.test.ts637, completed10 frente a expectativa menor que10; teardown permissions-integration-support.ts86 DELETEbusiness. No se certificó la causa. El test inyecta diez pg_sleep(0.1) con budget2000ms: primero medir si realmente induce un timeout, sin atribuirlo a red por suposición.

## Worker CI — ci-baseline-0235

Objetivo: diagnosticar ambos fallos con logs/código reales y corregir mínimamente producto, montaje o prueba según la causa. No cambiar límites ni relajar assertions para ocultar rojo. Un timeout inducido tiene que exceder deliberadamente el presupuesto y comprobar cancelación/atomicidad, sin depender de RTT; si esa es la causa, un disparador determinista preserva el requisito, no lo rebaja. Teardown: obtener pgcode/constraint/causa segura antes de corregir; no tragarse errores ni borrar datos ajenos.

Paths iniciales: apps/merchant/src/modules/stock/stock-consumption.neon.integration.test.ts; apps/merchant/src/server/permissions-integration-support.ts; docs/factory/0235-ci-fix.md. Lectura libre pertinente de runtime y logs. Si la causa requiere modificar runtime, fixtures adicionales o tooling, pedir ampliación nominal al coordinador antes de editar. No guardias/kit/migraciones nuevas por reflejo.

Ampliación nominal explícita tras evidencia: .github/workflows/ci.yml, tools/neon-test.sh, tools/neon-test-guard.test.ts y tools/verify.test.ts. El log remoto muestra40P01; workflow ejecuta pnpm test directo mientras el wrapper aísla DDL. Reproducir ese cruce, unificar CI con el wrapper y sus candados, sin exponer valores. Incluir también la suite business-failures.neon.integration.test.ts en el aislamiento: instala un trigger global de error DB aunque su nombre no contiene migration. No mover/editar ese archivo, reservado al otro worker; comprobar selección y separación del wrapper con su harness existente. No serializar toda la batería por reflejo ni relajar el teardown.

Reserva exclusiva db:modules-ci, incluida limpieza. Configuración seleccionada /private/tmp/checkpass-recipes-margin/0234-ci.env. Toda suite DB con tools/neon-test.sh y selección focal serial; guardar stdout/exit codes en archivos propios, sanitizados. Nada de DATABASE_URL PROD ni suites globales. Reproducir primero la señal decisiva; confirmar después solo los casos afectados y un vecino pertinente. No pnpm verify completo ni publicación en esta tarea.

## Worker retiro — negocio-retirement-0235

Preparar e implementar el candidato que elimina compatibilidad después del corte según0150: adaptadores de ubicación POS, onEnable/seed modular, resourceProvider payment_method legado, ramas Brand precorte y aplicación/retry históricos cuando ya no hay obligaciones. Conservar core medios/selector, capturas/resultados/lectura histórica, identidades y avisos, sin reescribir datos. No eliminar sale_settlement mientras exista su lector. No renombrar profitability ni implementar Gastos.

Paths asignados: apps/merchant/src/modules/pos/server/; apps/merchant/src/modules/profitability/server/commissions/; apps/merchant/src/modules/profitability/server/routes.ts; apps/merchant/src/server/business/; apps/merchant/src/server/module-events/; apps/merchant/src/app/api/brand/route.ts; apps/merchant/src/server/onboarding-signup.ts; apps/merchant/src/server/onboarding-signup.neon.integration.test.ts; apps/merchant/src/server/brand.test.ts; packages/domain/src/server/brand.ts y brand/validation.ts; packages/db/src/schema/commission-legacy-tables.ts; apps/merchant/src/modules/negocio-retirement.neon.integration.test.ts; docs/factory/0235-retirement.md. Pedir ampliación antes de tocar otros paths o esquema/journal. No editar spec/ADR ni fichas anteriores, UI/Settings/kit/guardias.

Ampliación nominal aprobada: apps/merchant/src/modules/resources.neon.integration.test.ts y apps/merchant/src/modules/stock-local-integration-support.ts. Cambiar los oráculos que invocaban el aplicador retirado al servicio core y sus invariantes, sin borrar la evidencia congelada. La certificación de puente/ACK permanece en e5eaa741; el candidato posterior al drenaje debe rechazar una obligación inesperada sin ACK ni cambio de estado, conservando identidades y lectura histórica. Documentar el cambio semántico, no introducir skips para esconder la retirada.

El retiro es un artefacto **condicionado**, separado del puente y del final administrativo previo. No sustituye al puente e5eaa741 ni se integra/publica como listo para PROD antes de certificar corte, ausencia de writers antiguos, pendientes y claims drenados. Preparar precondiciones SQL solo lectura y rollback al puente compatible; no ejecutar consultas/mutaciones PROD. Conservar registros/evidencias históricas aunque se retire su aplicador. Una obligación pendiente no se hace desaparecer borrando su handler ni marcándola aplicada/skipped.

Puede investigar/codificar y correr unit/tipos sin DB mientras CI tiene la reserva. Para DB pedir turno al coordinador: el recurso se transfiere solo después de teardown/fin del otro worker. Casos mínimos: selector/cierre core, ninguna inicialización al activar POS, lectura de histórico conservada y precondición que detecta pendiente/claim e impide certificar retiro; no repetir13financieros/DDL completos salvo cambio que invalide su evidencia.

## Entrega y QA

Node24 antes de comandos. Dependencias propias con tools/worktree-new.sh; no env productivo copiado/enlazado. De env solo claves/metadatos. Scope/recursos en factory. Commit propio, factory deliver, SHA/base, archivos reales, comandos/exit/skips/fallos y logs durables en handoff. No modificar pruebas para esconder fallos ni atribuir PASS a retries/exclusiones.

QA independiente por candidato congelado: una revisión focal más correcciones necesarias, cero mutaciones por defecto. Coordinador verifica identidad/evidencia e integra el fix CI tras PASS. El candidato de retiro se conserva en su rama hasta cumplir su precondición operativa; preparar código no certifica drenaje PROD. Actualizar estado propio y próximos pasos al cierre; no pedir autorizaciones de PROD antes de tener el resultado concreto revisable.
