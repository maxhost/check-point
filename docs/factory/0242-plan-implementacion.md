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

### Implementador A: esquema y dominio de cantidades

Writer único de `packages/db/src/schema/{business,catalog,order}.ts`, schema modules/pos, migrations/journal; tipos/financial; eventos types/decode/publish. Puede extender paths concretos de `packages/domain/src/financial`, tipos puros de medida, core orders/acreditación, POS line/settlement, Recetas/Stock/analytics cuando les toque. Reservas enumeran archivos reales, no la notación abreviada de esta página.

Expand columnas/tipos/snapshots, legacy unit/legacy type, precisión/factores y validación. Nuevo input financiero exacto y V4 tolerado por todos decoders, lectores y consumidores. Preservar replay V1/V2/V3 y dinero histórico. Contrato de base de composición; ningún cast integer sobre masa ni interpretación como piezas. Revisar todas escrituras catálogo/importación y lecturas de tarifas.

### Implementador B: auth/contexto y transporte POS

Ámbitos `server/backoffice-*` solo si cambia contrato genérico, `modules/contract|route-table|dispatch`, `panel-request` y POS posRequest/cache/console/printing/route metadata. Añadir política genérica de scope, sin POS literal en core; usar provider0238 para seed y eliminar GET sesión propio. Cubrir cada ruta POS/consumer settings, no solo consola.

Congelar scope/cuerpo/UUID antes await, epochs y caché monotónica; 409scope antes de dominio, private/no-store. No tocar cookies/Better Auth config, pool o permisos globales para obtener cifras mejores. La escritura de permisos/destinos de retiro corresponde a CP3, evitando colisión con A.

**Dependencias/QA:** B puede avanzar con DTO existente adaptado hasta integrar cantidades; A no activa producerV4/mass hasta que decoder/consumidores/UI estén listos. QA independiente focal de dinero y auth, negativos cookieA/B, revoked/PIN/email/billing/módulo/local. Integración local y nuevo SHA de contrato probado antes CP2.

## CP2 — POS completo, catálogo/business y servidor de venta

### A: backend POS + cadena de efectos

Crear/editar/listar/cerrar/anular sobre contratoV2, createRequestId idempotente y campos tipo/etiqueta. Reusar locks de POS/Mesas y transacción cierre. Respuesta canonical para caché; agregado de lista sin descargar todas líneas. QR mínimo mantiene efectos/eligibilidad. Adaptar cupones de masa a referencia tarifaria y mostrar bonificación concreta; reglas prose no se parsean.

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

Registro de evidencia: SHA/base/runtime/lock/config/buildID/schema/fixture, checks y intentos fallidos/skips/límites. No confundir QA documental de esta etapa con QA de entrega o combinación del producto futuro. No marcar implementada ni reutilizar PASS de0238/M1 para POS.

## Handoff tras clear

Leer primero `docs/estado/gpt.md`, handoff0242, spec/contratos/ADR y este plan. Confirmar refs/registros; no reconstruir desde memoria del chat. Reconciliar con trabajo nuevo en dev sin switch/pull de oficio. Las reservas de código se crean al iniciar CP0; no hay workers de implementación pendientes ni WT operativos creados por el mapeo.
