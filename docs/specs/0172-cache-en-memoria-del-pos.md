---
spec: 0172
fecha: 2026-10-08
estado: cerrada
resumen: POS conserva órdenes, historial y catálogo en memoria; abre copias disponibles inmediatamente, sincroniza por acciones explícitas y actualiza desde respuestas de escritura sin perder versiones ni aislamiento.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-cache.ts, apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-types.ts, tests/e2e/pos.spec.ts
---

# 0172 — Caché en memoria del POS

L2, plantilla chica (ADR 0071 y 0129): un dominio, sin migraciones ni decisiones de producto abiertas.
Reservada en 69191fc; implementación autorizada por el owner después de cerrar la spec.

## Problema

- `pos-console.tsx:104–108`: volver al historial descarta la orden y ejecuta `load`; este consulta sesión y después historial (`55–67`).
- `pos-console.tsx:202–205`: abrir una mesa siempre pide su detalle, incluso si crear/guardar acaba de devolver la orden completa (`81–83`). El historial contiene resúmenes sin líneas ni versión (`pos-types.ts:39–48`).
- `pos-editor.tsx:54–76`: cada montaje pide nuevamente el catálogo del local. `pos-types.ts:85–87` usa `no-store`, sin una caché de aplicación que reutilice esas respuestas.

Estas llamadas se comprobaron por lectura del código. No se midió la latencia de DB/red ni se promete una reducción concreta en milisegundos.

## Alcance

**Entra:** caché privada en memoria durante una visita a POS; órdenes completas por ID, historial y catálogos por local; apertura inmediata cuando hay datos; deduplicación de lecturas; actualización desde respuestas de creación/edición/cierre/anulación; actualización explícita; errores, aislamiento y carreras entre lecturas/escrituras.

**No entra:** API, servidor, consultas SQL, Redis, caché compartida entre operadores, cambios al contrato 0169, WebSocket, persistencia en localStorage/IndexedDB, modo offline con cola de escrituras, dependencias nuevas, kit, CSS, cambios de diseño o caché de cupones/pases. No se precargan los detalles de todas las mesas.

## Diseño

### Propiedad y duración

Una instancia de caché pertenece a cada montaje de PosConsole; no hay singleton de módulo. PosEditor consume esa instancia mediante props. Al salir de POS, recargar o desmontar, se destruye. En React StrictMode, el montaje de prueba se limpia sin servir respuestas de una instancia desmontada. Se comparte entre historial/detalle/edición dentro de esa visita.

La sesión existente se consulta al montar. PosSession declara los campos que la API ya entrega: user.id, business.id/status/timezone y membership.status. La identidad de la caché es `(user.id, business.id)`. Sin identidad válida, sesión autenticada, negocio y membresía activos, módulo y permiso POS, no se sirve caché ni se inicia una lectura POS. Cambiar identidad vacía datos, selección y borradores antes de cargar el nuevo contexto.

Cada entrada lleva respuesta confirmada por servidor, generación y estado confirmado/invalidado. **No hay TTL, sondeo, revalidación por foco/visibilidad ni refresco periódico de sesión, historial, detalle o catálogo.** El tiempo transcurrido nunca dispara ni habilita por sí solo una lectura. Los GET mantienen `cache: "no-store"`: esta caché es explícita y privada, no la del navegador/CDN.

Regla de eficiencia de esta spec, conforme al pedido del owner: **la navegación reutiliza datos cargados; solo la primera lectura, una acción explícita de actualizar o una operación/error que necesite reconciliar estado generan HTTP**. Así, dejar historial/detalle/edición abiertos, recuperar foco y alternar entre mesas ya cargadas no mantienen la DB activa mediante consultas de fondo. Esto limita tráfico del cliente POS; otros clientes, rutas o procesos pueden consultar la DB y quedan fuera de esta garantía.

Sesión: se consulta al montar y al pulsar Actualizar órdenes. Las APIs de escritura conservan sus guardias reales; no se añade una consulta previa de sesión a cada navegación/guardado. Si otro administrador revoca acceso, la UI lo conoce al actualizar o ante la siguiente respuesta de autorización: no se promete revocación visual instantánea entre dispositivos.

### Lecturas e interfaz

| Evento | Comportamiento |
|---|---|
| Entrada inicial | Validar sesión y leer historial una vez. No leer cada detalle ni catálogo sin necesidad. |
| Volver al historial | Pintar la copia inmediatamente, sin GET si existe y no está invalidado. |
| Abrir mesa con detalle cacheado | Mostrar y permitir editar inmediatamente, sin GET si no fue invalidado, sin importar cuánto tiempo pasó. |
| Abrir mesa sin detalle | Un GET de detalle con estado de carga existente; un resumen nunca se convierte en una orden ficticia. |
| Editar/local | Reutilizar catálogo del local; pedirlo solo si falta o fue invalidado explícitamente. Sin local elegido en un negocio multilocal, no pedir catálogo. |
| Tiempo/foco/visibilidad | Cero HTTP. No registrar eventos o intervalos que refresquen datos por estas causas. |
| Actualizar órdenes | Forzar sesión y después historial; invalidar detalles/catálogos. Desde detalle volver al historial. Con borrador abierto mantener editor y forzar su catálogo, sin perder líneas/mesa/local; volver requiere Cancelar. En cobro sigue deshabilitado. No descargar todos los detalles. |

La caché se sincroniza con otros operadores **al actualizar explícitamente o al reconciliar una escritura/conflicto**. Una mesa nueva creada desde otro dispositivo aparece al pulsar Actualizar órdenes. Editar/cobrar sobre una versión antigua puede dar version_conflict: se muestra la respuesta actual antes de continuar, nunca se reenvía automáticamente. Esta regla evita consultas periódicas y hace explícita la actualización que ya ofrece la UI.

Datos invalidados por Actualizar órdenes requieren una lectura en su próximo uso. Un catálogo nuevo actualiza productos disponibles, sin recalcular líneas ya agregadas ni precios guardados. El ranking sigue siendo exactamente el de bestSellingProductIds de la respuesta, incluyendo su período de 30 días **calculado en servidor al pedirlo**; no se recalcula ni refresca por reloj en cliente.

Un historial actualizado reemplaza sus resúmenes y ordenamiento por la respuesta del servidor. Actualizar órdenes invalida todos los detalles aunque los resúmenes coincidan: el historial carece de versión. En edición, el snapshot/borrador anterior permanece; su version se conserva al guardar. Nunca se sobrescriben borradores, snapshots, cupones seleccionados o intentos de cierre desde una lectura de fondo.

### Escrituras e historial

No se simula un guardado exitoso. Crear, guardar, cobrar y anular siguen esperando confirmación HTTP. La respuesta PosOrder se publica simultáneamente como detalle y caché; volver y abrir después usa esa misma versión sin otra lectura de detalle.

El historial disponible se actualiza por ID desde la respuesta: mesa abierta se agrega/reemplaza en Abiertas, ordenadas por createdAt ascendente; al cerrar/anular se retira de Abiertas. Se calcula itemCount sumando quantity y se usa sale.total cuando existe. Tras cerrar/anular se invalida historial; historial se relee una vez como consecuencia de la operación, en segundo plano para obtener Cerradas hoy y sus límites de día desde servidor. No se calcula el día comercial ni se añade una mesa a Cerradas hoy basándose en la zona horaria del navegador. El catálogo y su ranking permanecen hasta Actualizar órdenes; cerrar una mesa no fuerza una lectura de catálogo. Tras crear/editar no hay GET automático de historial/detalle: la respuesta basta para actualizar la copia disponible.

Si todavía no había historial, no se fabrica una lista completa con una sola mesa; se conserva la orden y la siguiente entrada al historial hace su lectura inicial. Un conflicto que devuelve la orden actual actualiza detalle e invalida historial siguiendo el manejo visible existente.

PUT y cierre conservan version del snapshot editado, lineId, lista completa y la idempotencia de 0169/0170. Se puede guardar sobre una copia antigua: el servidor decide si hay conflicto. No se actualiza silenciosamente la versión enviada para hacer pasar un borrador antiguo.

Anular no recibe version en el contrato actual: antes de mostrar su confirmación se fuerza una lectura de detalle. Si cambió respecto de la copia mostrada, presentar la orden actual y pedir una nueva acción del operador; si ya no está abierta, retirar Anular/Cobrar/Editar. Error de lectura bloquea esa anulación. Permanece la carrera entre lectura y anulación propia de 0169; esta spec no incorpora control de versión al endpoint.

### Concurrencia, errores y autorización

- Deduplicar GET en vuelo por recurso y contexto; no deduplicar ni reintentar escrituras automáticamente.
- Cada escritura inicia una nueva generación para su orden/historial. Un GET iniciado antes no puede sobrescribir ni el éxito ni un conflicto posterior. No aceptar una PosOrder de versión menor a la ya confirmada. Una respuesta tardía para A nunca abre A si el operador ya seleccionó B.
- Lecturas resueltas tras desmontar, cambiar identidad o perder autorización se descartan. Al invalidar una petición, retirarla también de la deduplicación para que una lectura nueva no se una a una generación obsoleta.
- Desconexión/5xx en lecturas: conservar última copia, mantener su estado invalidado si corresponde y mostrar Alert del kit («No pudimos actualizar los datos. Puedes consultar la última versión disponible.»). Sin copia, mantener error y opción existente Actualizar órdenes. Una lectura fallida no resuelve una invalidación. Errores de escritura conservan el borrador y el comportamiento actual.
- Sesión no autenticada, identidad ausente/distinta, contexto inactivo, HTTP 401/403 (incluidos missing_permission, pos_disabled y guardias de negocio/email): vaciar caché y borradores, bloquear/ocultar acciones y usar flujo de error/autorización existente. No seguir mostrando órdenes cacheadas bajo ese contexto. Una respuesta vieja no puede repoblarlos.
- unknown_pos_order/404: eliminar detalle y resumen de ese ID, salir de su vista y mostrar error. pos_order_not_open: releer detalle según el flujo actual, actualizar caché y retirar acciones según estado.
- version_conflict con order: almacenar esa respuesta y mostrar detalle/mensaje existente, sin reenvío automático; sin order, releer antes de permitir continuar.
- Resto de códigos de 0169: mantener PosError y tratamiento existente; no traducirlos a éxito de caché. Sondeo de cupones y UUID/cuerpo congelados de cierre tras transporte/5xx quedan intactos. Una revalidación no remonta el cobro ni elimina ese intento pendiente.

### Diseño visual

Mantener DetailedSale compartido, Tailwind, tokens y componentes del kit. El estado de actualización usa Text/Alert existentes, sin nuevos controles nativos, CSS o edición del kit. No bloquear navegación por una lectura de fondo salvo comprobaciones de autorización y anulación indicadas arriba.

## Archivos

| Archivo | Acción |
|---|---|
| apps/merchant/src/app/backoffice/pos/pos-cache.ts | Crear instancia y operaciones de caché, invalidación y deduplicación. |
| apps/merchant/src/app/backoffice/pos/pos-console.tsx | Integrar lecturas, navegación, escrituras, contexto y eventos. |
| apps/merchant/src/app/backoffice/pos/pos-editor.tsx | Reutilizar catálogo por local mediante la instancia del console. |
| apps/merchant/src/app/backoffice/pos/pos-types.ts | Declarar identidad/estado de sesión ya existentes en HTTP. |
| tests/e2e/pos.spec.ts | Contar requests, demorar respuestas y comprobar caché, carreras y regresiones. |

**Disjunta: no**, comparte console/editor/types/tests con 0170 y 0171; sus nuevas ediciones se serializan. No comparte archivos de API/servidor de 0169. Docs de reserva/estado son los de GPT.

## Definition of Done

Pruebas de navegador con HTTP simulado, contadores y respuestas retenidas; avance de reloj controlado para demostrar ausencia de TTL, sin esperas reales ni medición arbitraria de FPS:

- [x] Crear → guardar → historial → abrir: datos visibles correctos y **cero GET adicionales de sesión/historial/detalle** sin pulsar Actualizar órdenes; conservar version/lineId/precios del POST/PUT.
- [x] Mesa nunca visitada: primera apertura hace exactamente un GET de detalle; segunda apertura hace cero. Dos solicitudes concurrentes comparten una lectura.
- [x] Catálogo se reutiliza al reabrir editor; otro local obtiene su propia lectura; Actualizar órdenes lo actualiza sin borrar precios/borradores y sin mezclar productos de locales.
- [x] Avanzar reloj por una hora y disparar foco/visibilidad produce **cero GET**; abrir una orden cacheada después tampoco consulta. Actualizar órdenes produce una lectura de sesión e historial, sin descargar todos los detalles; la copia del historial se ve mientras HTTP está retenido.
- [x] GET viejo retenido → PUT exitoso/conflicto → liberar GET: conservar versión nueva. Seleccionar B mientras responde A mantiene B.
- [x] Otra persona cambia orden: Actualizar órdenes permite abrir el detalle nuevo; durante edición el borrador permanece y PUT con versión vieja muestra conflicto, sin reenviar. Historial externo detecta estados cambiados y los refleja.
- [x] Cerrar/anular retira mesa de Abiertas, cachea respuesta y refresca Cerradas hoy; no reaparece por una lectura anterior. Anulación revalida antes de confirmar.
- [x] 5xx/transportes de lectura conserva copia con error, sin resolver la invalidación; 401/403/pérdida de permiso o cambio de identidad vacía datos e ignora respuestas pendientes; 404 retira mesa. Recargar inicia una caché nueva.
- [x] Botón Actualizar fuerza lecturas sin perder borrador; lectura en cobro no altera UUID/cuerpo de reintento, descuentos ni resultado monetario. Pruebas POS/Mostrador de 0171 permanecen verdes.
- [x] Node 24: pnpm typecheck; pnpm exec eslint sobre archivos tocados; pnpm exec prettier --check sobre archivos tocados; node tools/ui-guard.ts sin aumentos; node tools/check-numbers.ts; git diff --check.
- [x] pnpm exec playwright test tests/e2e/pos.spec.ts tests/e2e/counter-mobile.spec.ts tests/e2e/counter-coupon-verdict.spec.ts en ambiente aislado de pruebas/harness. Transcribir salida y conteos de requests en handoff. No ejecutar build sobre dev local activo.
- [ ] QA del owner con pnpm dev:local: crear/reabrir/editar/cobrar/anular y dos sesiones con conflicto. pnpm verify completo antes de pasar a main según ADR 0128; sin merge ni push en esta tarea.

## Mutaciones — presupuesto: 0

L2 (ADR 0129). Las carreras y versiones se prueban reteniendo respuestas HTTP y comprobando el estado visible/cuerpo real; no se exige suite adversarial nueva.

## Declarado AFUERA

- Avisos de actualización entre operadores (pedido del owner): trabajo futuro separado. No se añade webhook, canal de eventos ni sondeo como sustituto.
- No se evita la primera lectura de detalles nunca cargados ni las comprobaciones necesarias para guardar/cobrar/anular.
- No se garantizan cambios instantáneos desde otro dispositivo, funcionamiento offline ni apertura cacheada tras recarga/salida de POS. Cerradas hoy es la última respuesta del servidor: al cambiar el día o trabajar mucho tiempo, el operador usa Actualizar órdenes para sincronizarla.
- El sondeo de cupón durante un cobro activo (actualmente cada 4 segundos) sigue fuera del alcance; esta spec no promete ausencia de tráfico de ese flujo.
+- Latencia SQL y rendimiento del servidor quedan para diagnóstico de Claude si persiste demora en las primeras lecturas. No se usa DATABASE_URL de producción para pruebas.

## Handoff

Implementación por GPT en dev, commits solo de sus paths. Registrar evidencia en docs/estado/gpt.md; no marcar implementada por cerrar esta spec. QA del owner y revisión independiente según el proceso del repo antes de declarar entrega completa; no se crean subagentes para esta tarea L2. Las verificaciones anteriores de 0171 no prueban esta caché.

## Abierto

Ninguno para implementar dentro de este alcance. API 0169 disponible, sin ampliación de contrato. Implementación local verificada: 37 pruebas afectadas pasan (24,7 s), tipos/lint/formato/guardia/números verdes; pendiente QA del owner y revisión de entrega. Evidencia en docs/handoff-0172-cache-pos-2026-10-08.md.
