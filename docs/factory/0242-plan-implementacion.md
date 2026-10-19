# 0242 — Plan de implementación por checkpoints

L3; [spec](../specs/0242-pos-unificado-y-venta-por-peso.md), [contratos](../specs/0242-contratos-pos-y-medidas.md), [ADR0155](../adr/0155-pos-unificado-cantidades-y-cupones-de-premio.md). Producto mapeado5f9cb2b2; reserva documentalec454681. La base real de implementación se congela tras la entrega documental y se registra en cada ficha, no se adivina desde esta página.

## Equipo y operación

Un coordinador, **dos implementadores que también corrigen, QA independiente**. Sin subdelegación ni reviewers extra por defecto. Un máximo de3WT operativos: A, B y QA. El coordinador escribe índices/estado/contratos antes de despachar y es el integrador. Los agentes de mapeo fueron read-only y no crearon WT; no se presentan como entregas de implementación aceptadas por factory.

Cada tarea antes de código tiene ficha con objetivo, spec cerrada, baseSHA, paths explícitos sin globs, escritor/recursos, aceptación y checks. Crear WT con tools/worktree-new.sh, configuración seleccionada y Node24; reservar con factory.ts. No copiar env de producción ni enlaces generales. Asignar DB protegida incluso durante teardown. No iniciar tarea sobre paths/DB ya reservados. Lockfile/kit/journals/contrato un writer.

## CP0 — Inventario, baseline M0 y contrato ejecutable

**Entrada:** esta entrega documental revisada. Coordinador verifica refs/ci:status/factory y preserva los cambios ajenos. CI remoto de main sigue rojo90ebe18f; queda registrado, no corregir backlog por esta documentación. Antes de publicar cualquier candidato debe resolverse en su alcance de release.

- A: reproducir mapa de schema/eventos/financial/catalogo/permisos. Crear tipos puros de medidas, DTOv2, unit factors y fixtures compartidos. Propone SQL expand y matriz consumidores exacta; no publica writes V4 aún. Tests de factores/parsers/errores justificadas por dinero.
- B: inventario UI real: listados, creación/editor/revisión/QR/pago/impresión/nota/anular/cerradas, layout/provider/scope, kit y copy. Preparar harness de interacción del POS sobre contrato real y recipe de baseline con A.
- Coordinador es writer del contrato hasta congelarlo. Si falta una primitiva del kit, asignación expresa y acotada antes de editar kit; no bypass guard ni primitives manuales.
- M0 en build/start control del producto previo, fixtures sintéticas protegidas, sin PROD. Ficha de instrumentación/harness explícita autorizada para este encargo. Medir según0242-performance; guardar source/config/hashes y todos intentos, no cookies/QR/scope.

**Salida:** contratos puros commiteados, M0 reproducible, gates M1 fijados, lista exacta paths/recursos para CP1. El SHA de contrato es base compartida antes de UI/backend. No usar mocks con estado de cliente persistido que el producto no ofrece.

## CP1 — Fundamentos exactos y adopción de contexto

### Entregas pequeñas y gates de continuación

Al retomar, owner expresó preocupación por el tamaño para dos implementadores. Se conserva el equipo de dos implementadores y QA independiente, y se descompone CP1/CP2 antes de despachar código. Las descripciones por rol de abajo son ámbitos globales, no una autorización para entregar todo en un único commit/candidato. Cada subentrega tendrá ficha y reserva concreta; QA focal verifica su invariante, y solo se repiten checks afectados por correcciones. No se añade fullverify por cada corte.

| Corte | Entrega acotada | Gate antes de continuar |
| --- | --- | --- |
| CP1a | Financial puro medido y adaptadores legacy; en paralelo, política genérica de scope y transporte POS conservando DTO unit actual. | Equivalencia monetaria legacy y factores exactos; intenciónA/cookieB rechazada antes de dominio; circuito unit preservado. Sin schema ni V4 publicado. |
| CP1b | Expand aditivo y compatibilidad unit de catálogo/órdenes/core; un writer serial de esquema/journal y adaptadores necesarios para numeric:string. | Migración CI protegida, lectura/edición/cierre histórico sin truncar ni nuevos efectos. Peso y productorV4 siguen inactivos. Paths de compatibilidad enumerados antes del código. |
| CP1c | Decoders V1–V4, base/procedencia racional de Recetas y consumidores Stock/analytics exactos, en entregas sucesivas por cadena si el diff lo requiere. | Replay sin duplicación; redondeo ledger3; gramos y piezas separados por segmento. ProductorV4 permanece apagado hasta compatibilidad de todos los consumidores. |
| CP2a | Configuración business/catalog y base de composición: endpoints y UI de unidades/tarifas. | Concurrencia/revisiones, unidad en uso, cambio de modo con base explícita y formularios sin perder borrador. |
| CP2b | Listado, tipos de venta, creación/editor y guardado POSv2. | Cuatro tipos/identificadores/locales, medidas/snapshots, create idempotente, conflicto y caché; recorrido unit anterior sigue operativo. |
| CP2c | QR/cupón/pago/cierre/recuperación e impresión v2, con cadena de efectos completa. | Neto0, gratis/2x1 solo unit, carreras/reintento congelado, efectos exactos y tickets reales. Activar mass/V4 solo en candidato con todos los consumidores compatibles. |

CP1b se corta técnicamente sin romper unit: primero lectores/adaptadores para formatos anteriores y numeric:string con padding, sin DDL; después ampliar tarifas de catálogo con constraints temporales que mantienen representabilidad legacy en centavos; por último ampliar quantity/snapshots POS/core junto con writers y fixtures Drizzle. La precisión comercial nueva sigue bloqueada en DB hasta activación compatible CP2c; esa migración retirará los límites temporales junto con lectores/escritores nuevos. Cada expansión tiene un único escritor serial de schema/journal. No cambiar writers a string mientras el tipo Drizzle todavía exige integer. Fichas [lectores unit](0242-cp1b-unit-readers.md) y [cliente scope](0242-cp1a-scope-client.md) preceden esas entregas. Cada bloque siguiente usa autor nuevo, sin acumular CP1b entero en el autor del cálculo financiero.

El coordinador puede reasignar al implementador disponible un bloque independiente de backend o UI mediante nueva ficha; los roles A/B no inmovilizan capacidad en una sola capa. Un contrato aceptado y escritor exclusivo preceden cualquier reasignación. M0 sigue siendo entrada de CP1, y cada subentrega debe dejar operativa la venta unit; no se acumulan migración, toda la contabilidad y toda la UI para una única QA final. CP3/CP4 conservan sus gates de acceso/retiro y combinación/rendimiento.

**Contexto limpio por entrega, pedido explícito del owner:** tras aceptar un entregable, el siguiente bloque lo toma un agente nuevo con contexto vacío y ficha/base/paths propios, sin heredar el historial de la conversación. El autor conserva las correcciones de su entrega hasta aceptación. Dos implementaciones simultáneas y QA independiente siguen siendo el límite; se reutilizan los tres WT solo después de reconciliar commit limpio, entrega y reservas. Los handoffs y evidencias versionados son la continuidad, no una acumulación de tareas en un worker. QA de un nuevo bloque/candidato parte igualmente de contexto fresco cuando cierre su revisión anterior; no se agregan reviewers paralelos por defecto.

En CP2a/b las capacidades nuevas de peso siguen dormidas hasta cierre/consumidores compatibles: tampoco se habilitan writes operativas de catálogo o creación de órdenes mass que dejen el circuito unit inaccesible por exigir un reader v2 prematuro. Las entregas pueden incorporar contratos/UI preparados, pero la activación de masa y V4 ocurre en el combinado completo CP2c. CP1c que requiera otra expansión de procedencia/base vuelve a reservar el mismo writer serial de esquema/journal.

Al conectar consumidores medidos mediante `defineEventSubscription`/dispatch genérico, conservar explícitamente la comprobación de envelope de venta (eventVersion externo igual al payload y locationId capturado igual al envelope) antes de efectos, también para core.analytics. El camino legacy actual la hace dentro de su rama, pero el dispatch genérico no la hereda automáticamente. Esa conexión tendrá ficha/reserva propia: no ampliar el union legacy ni perder este control para aceptar V4. Captura/provenance dormidas y lectores puros no autorizan aún ese cambio de runtime.

### Implementador A: esquema y dominio de cantidades

Writer único de `packages/db/src/schema/{business,catalog,order}.ts`, schema modules/pos, migrations/journal; tipos/financial; eventos types/decode/publish. Puede extender paths concretos de `packages/domain/src/financial`, tipos puros de medida, core orders/acreditación, POS line/settlement, Recetas/Stock/analytics cuando les toque. Reservas enumeran archivos reales, no la notación abreviada de esta página.

Expand columnas/tipos/snapshots, legacy unit/legacy type, precisión/factores y validación. Nuevo input financiero exacto y V4 tolerado por todos decoders, lectores y consumidores. Preservar replay V1/V2/V3 y dinero histórico. Contrato de base de composición; ningún cast integer sobre masa ni interpretación como piezas. Revisar todas escrituras catálogo/importación y lecturas de tarifas.

### Implementador B: auth/contexto y transporte POS

Ámbitos `server/backoffice-*` solo si cambia contrato genérico, `modules/contract|route-table|dispatch`, `panel-request` y POS posRequest/cache/console/printing/route metadata. Añadir política genérica de scope, sin POS literal en core; usar provider0238 para seed y eliminar GET sesión propio. Cubrir cada ruta POS/consumer settings, no solo consola.

Congelar scope/cuerpo/UUID antes await, epochs y caché monotónica; 409scope antes de dominio, private/no-store. No tocar cookies/Better Auth config, pool o permisos globales para obtener cifras mejores. La escritura de permisos/destinos de retiro corresponde a CP3, evitando colisión con A.

**Dependencias/QA:** B puede avanzar con DTO existente adaptado hasta integrar cantidades; A no activa producerV4/mass hasta que decoder/consumidores/UI estén listos. QA independiente focal de dinero y auth, negativos cookieA/B, revoked/PIN/email/billing/módulo/local. Integración local y nuevo SHA de contrato probado antes CP2.

## CP2 — POS completo, catálogo/business y servidor de venta

### Orden vigente: integración funcional incremental

Ajuste del owner tras revisar el avance: integrar commits aceptados en main local no basta para reducir el riesgo del ensamblado. Adelantar recorridos conectados en la aplicación, con QA independiente por corte, sin esperar a tener todas las capacidades pendientes. No acumular toda la consola detrás de ticket/impresión ni reservar la primera prueba nativa para CP4.

1. Tras aceptar cobro preparado, el siguiente autor nuevo conecta una primera sección vertical: listado V2 → abrir/crear → editor → cobro → resultado canónico → vuelta al listado, usando productos unit reales, HTTP y autenticación nativa en desarrollo/CI. Mantener la sesión de intención en el padre y la misma caché; probar recuperación y cambio de contexto en esa conexión. Antes de código, ficha y contrato del montaje local; conservar la entrada legacy hasta que la nueva cubra sus capacidades, sin exponer un cambio incompleto en producción ni activar masa.
2. Conectar anulación HTTP aceptada y tickets/impresión como incrementos sobre ese recorrido. Preparar sus contratos para permitir dos implementadores en paths independientes; ningún agente acumula toda la tarea. Cada incremento comprueba la interacción nueva sobre las piezas ya aceptadas y puede integrarse localmente tras QA.
3. Retirada legacy/permisos y activación compatible mantienen su orden de seguridad. En cuanto ese corte lo permita, ejecutar una venta mass canónica completa y sus efectos reales; no postergar esa primera prueba a M1.
4. CP4 conserva regresión del conjunto, aceptación pendiente y medición M1. Su finalidad es confirmar el conjunto y medir rendimiento; los recorridos principales ya deben haberse ejecutado en los cortes anteriores. No se elimina incertidumbre por decreto ni se declara PASS de una integración aún no probada.

Las fichas existentes de cobro y HTTP void conservan scope y candidato congelado. La ficha de ticket sigue siendo un bloque independiente: deja de ser dependencia previa de la primera conexión de consola. Reservar los paths de esa conexión antes de asignarla a un agente nuevo. Sin push ni PROD autorizados.

### A: backend POS + cadena de efectos

Crear/editar/listar/cerrar/anular sobre contratoV2, createRequestId idempotente y campos tipo/etiqueta. Reusar locks de POS/Mesas y transacción cierre. Respuesta canonical para caché; agregado de lista sin descargar todas líneas. QR mínimo mantiene efectos/eligibilidad. Rechazar gratis/2x1 sobre líneas mass, conservar unit elegible en órdenes mixtas y porcentaje/importe sobre peso; reglas prose no se parsean.

Asignar y completar adapters financial/core.order, eventosV4, composición/consumo/Stock/metrics/ranking antes de habilitar peso. Idempotencia y errores aftercommit, pendientes de delivery/coste, neto0 y comisiones exactas. Reservar DB CI y migraciones solo por A.

### B: UI POS + configuración peso y tickets

Ámbitos `modules/pos/ui`, componentes shared extraídos de counter, catálogo/business y composición de Recetas para base medida, tests browser/tickets. Listado de abiertas/cerradas/anuladas, local/búsqueda,4tipos, etiquetas, línea/unidad/precio/nota, borrador y conflicto, cliente/QR/cupón/reglas, cobro resultado y recuperación, impresión/reimpresión/anular. No simplificar la máquina closeUncertain del producto al flujo optimista de la maqueta.

Móvil CTA/total único; escritorio catálogo/orden; texto200%,320/390/430/1440. Business units + checkbox por peso; tarifa precisa por unidad; captura manual; cambio selector conserva masa, aproximación visible si no terminante. Tickets reflejan tipo/etiqueta y cantidad/unidad/tarifa.

**Salida CP2:** POSv2 y venta por peso reales cubiertos en CI aislada y browser/autenticación real. Antes de activar producción, productorV4 y todos sus consumidores están en el mismo candidato compatible. No presentar solo harness como prueba Next→guard→DB→UI.

## CP3 — Migración de acceso y retiro Mostrador

A es writer único de inventario/migración de permisos y handlers legacy; B de navegación, destinos/entry staff, Clientes/copy/onboarding/tours y retirada UI/extraer componentes. El contrato de intersección (resolver genérico de entrada/permisoClientes) se integra antes de ambos.

- Inventario reproducible en desarrollo/CI; definir consulta de preflight PROD para ejecutar solo cuando owner autorice ese caso. Negocios POSapagado, counter-only, estados ambiguos y composiciones sin base se informan sin borrado/activación automática.
- Migrar staffcounter→pos en negocio con POSactivo, conservar counter como Clientes y otros permisos. Defaults de staff y fallback solo a rutas autorizadas. Módulo apagado/PIN/email/billing siguen bloqueando.
- Retirar Mostrador del menú/UI/defaults; redirect GET por registro genérico y local validado. APIs counter410 tras guard, cero efectos, no redirect POST ni aliases de débito ocultos.
- Suspender canje directo según respuesta owner; conservar tablas/saldos/eventos. PWA/emisión/vigencia/límite de premios fuera del encargo.
- Preservar históricos de acreditación/canje sin crear POSsales duplicadas. Extraer tipos/helpers de UI counter que POS aún requiere y mantener dominio común.
- Activar política contractV2/scope en cutover solo cuando todos consumidores estén listos. Viejas pestañas reciben upgrade_required; no convertir fracciones a piezas.

**Salida:** matriz de retiro cerrada con búsqueda de referencias y pruebas de rutas/históricos/Clientes/staff; no flujo alternativo de venta/grant/redeem accesible fuera POS. Cambios de migración en un journal serial.

## CP4 — M1, QA de combinación y entrega local

Congelar candidato combinado; QA desde tercerWT fresco compara spec/contrato con código y ejecuta aceptación/interacciones. Reutilizar checks de autor compatibles; repetir señal decisiva donde haya duda. No fullverify de oficio por cada checkpoint. Suites monetarias/tenant/eventos/stock se amplían por este riesgo transversal; gates de publicación siguen separados.

M1 según protocolo, fuente control contemporánea y receta congelada; auth/cookies no se debilitan. Gate estructural0GET sesión/módulos redundantes, caché/invalidation,0HTTP por peso/vistas y no GETpostwrite adicional; gate temporal de mejora y no regresión con incertidumbre explícita. P95 inconcluso no es PASS. Si M0 descubre más cuello que el alcance fijado permite, entregar diagnóstico y corregir lo asignado antes de prometer eliminación; cambios globales se vuelven contrato explícito.

Autor entrega commit limpio propio por factory deliver; QA independiente registra evidencia sobreSHA exacto; coordinador accept e integra preservando commits aceptados. QA de combinación cubre pagos/cupons/medidas/eventos/histórico/cookies/permisos/impresión y vuelta al listado. Mainlocal solo tras gates pertinentes; no publicación.

## Rollout y vuelta atrás

Expand schema/decoders, migración de datos, cliente/rutasv2, activación mass/V4 y retiro legacy en orden probado. No producir V4 para un consumidor viejo. Antes PROD: preflight, compatibilidad de abiertas/usuarios, backup y autorización explícita de cada migración/push/caso. No prometer que rollback puede bajar a enteros: un candidato de reversión debe leer medidas/V4; desactivar nuevas ventas medidas si necesario sin destruir las existentes. Nada de downcasts/borrados de ventas para volver al binario anterior.

## Checks por ámbito y evidencia

Usar comandos reales localizados al preparar cada ficha: Node24; types/lint/guard focal; `node tools/check-numbers.ts`; boundaries y módulos cuando cambia contrato/core. Vitest puro financial/measure/decode/cupon; browser e2ePOS/tickets más pruebas reales de sesión; DB solo `tools/neon-test.sh` con suite aislada y teardown reservado, no DATABASE_URLPROD. No escribir pruebas que solo repitan markup.

En cambios de contrato/core, `tools/app-boundary.test.ts` no sustituye las tres guardias de módulos `modules-boundary.test.ts`, `modules-boundary-between.test.ts` y `modules-boundary-literals.test.ts`. Separar backlog anterior demostrado de un offender nuevo0242 aunque ya estuviera en la base de un subentregable posterior; corregir ubicación/imports/fixtures sin tocar guardias ni reducir cobertura.

Registro de evidencia: SHA/base/runtime/lock/config/buildID/schema/fixture, checks y intentos fallidos/skips/límites. No confundir QA documental de esta etapa con QA de entrega o combinación del producto futuro. No marcar implementada ni reutilizar PASS de0238/M1 para POS.

## Handoff tras clear

Leer primero `docs/estado/gpt.md`, handoff0242, spec/contratos/ADR y este plan. Confirmar refs/registros; no reconstruir desde memoria del chat. Reconciliar con trabajo nuevo en dev sin switch/pull de oficio. Las reservas de código se crean al iniciar CP0; no hay workers de implementación pendientes ni WT operativos creados por el mapeo.
