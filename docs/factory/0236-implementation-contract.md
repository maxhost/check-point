# 0236 — Contrato de implementación local de Gastos

El owner pidió pasar a implementar con el flujo agéntico y autorizó expresamente la lectura PROD previa. Mandan [SPEC0236](../specs/0236-gastos-registro-de-pagos.md), [ADR0151](../adr/0151-gastos-y-eventos-autosuficientes.md) y, para eventos, ADR0152 §4. La nueva autorización amplía el encargo documental a UI/backend, esquema/migración preparada y pruebas focales locales/CI. **No autoriza push, deploy ni migración/escritura PROD.** No editar INDEX/TASKS ni estados de Claude.

## Comprobación previa y base

Lectura autorizada 2026-10-17T03:55:08.839Z, fuente `e5e85b6a44f77783c38927e36dd8fa68f58bbcdc`, endpoint con huella `bf545fdce7a0`; transacción RepeatableRead, `transaction_read_only=on`. Las tres tablas0231 tienen0 filas, activaciones profitability0, miembros con permiso profitability0; sin dependencias externas inesperadas ni funciones en el esquema viejo. Tablas core de medios/comisiones presentes; journal96. Eventos:2 sale.closedv2, locales no nulos. Delivery histórico profitability:1 skipped,0 claims; no obligación pendiente. No se leyó información personal ni se ejecutaron escrituras/retries. Evidencia saneada y lector guardado en `/private/tmp/checkpass-gastos-implementation/prod-readonly.json` y `prod-readonly.cjs`.

Se mantiene el supuesto de tablas vacías para preparar la migración; su ejecución PROD tendrá preflight fresco y autorización propia. Preservar core.historical_event_handler y toda identidad/evento histórico exigidos por0150. No DROP CASCADE indiscriminado.

Dev es base/integración; workers parten del commit de este contrato en worktrees propios. Main local avanzó únicamente al candidato documental a82d179d ya aprobado por QA para retirar los dos worktrees documentales limpios. No se publicó. Reservas concretas y SHAs de ejecución quedan en factory/handoffs, sin actualizar checkouts por detrás de sus pruebas.

## Contrato común

HTTP es exactamente la tabla de0236: context, concepts, entries/draft y draft-photo, confirmación de lote, listado, PUT/DELETE por gasto. DTO completo, `amountMinor` entero decimal en texto, día DATE local y zona como procedencia, moneda/unidad congeladas, categoría/concepto/nombre, isFixed, local UUID o null explícito, autor/revisión/tombstone. Owner por rol; staff requiere expenses. UI denegada404 y API403 según despachadores actuales. Sin dependencia de POS/Equipo/Stock/Recetas ni permiso ajeno.

La UI de referencia es Stock: dictado/foto → borrador editable → confirmación; mismo kit/tuteo, sin CSS ni nuevos componentes del kit. Foto en File[] del modal hasta ACK del lote, reanálisis/error; descartar al guardar/cancelar/desmontar, sin R2 ni persistencia de contenido. No convertir incertidumbre IA en pagos inventados. Conceptos se emparejan contra contexto del mismo comercio y se corrigen antes de guardar; la categoría no determina fijo/variable.

Nuevo esquema expenses.concept/expense/expense_revision; operación UUID por petición, revisión UUID por línea y mutación, digest semántico y respuesta durable para retry aun después de cambios posteriores. Transacción de lote/pagos/revisiones/eventos; error técnico revierte todo. Eventos completos v1, source_id revisión, location_id nullable, tombstone completo al borrar, sin consumidor AN ficticio. Append genérico obligatorio para G, conserva flag/contratos de sale.closed; filtros sale.closed en corte/pending Stock y filtro opcional de retry/pendingSummary en callers existentes. No implementar AN.

## A — servidor, esquema y eventos

Task `gastos-core-0236`: writer exclusivo de `packages/db/` (esquema, exports y UNA migración/journal/snapshot nuevo), servidor/tareas IA/normalizador/tipos/manifest de expenses y tests backend. Asignación explícita de esquema/migración y framework de eventos limitada a0236. También retiro completo de profitability, tres registros modulares, contratos/hook de sueldo que queden sin consumidor y fixtures/tests afectados del framework. Paths nominales completos en factory; solicitar ampliación antes de otro archivo.

Responsable de detectar y resolver primero el rojo remoto Stock descrito abajo, preservando el oráculo de concurrencia. Luego implementar datos/guards/rutas/IA/eventos, generalización mínima y retiro. No borrar comisiones core ni cobertura vigente: reubicar commission-arithmetic.test.ts. Actualizar tests que fijan el módulo viejo por el comportamiento nuevo aprobado, sin aflojarlos ni ocultar fallos. Migraciones ya aplicadas no se reescriben; migraciones históricas mantienen su cobertura pertinente al esquema actual.

El export de UI acordado es `ExpensesConsole` en `modules/expenses/ui/expenses-console.tsx`; A escribe su entrada en ui-registry. B no toca registros. Los tipos puros de API vivirán en `expenses/types.ts`; A comunica sus exports concretos a B antes de cerrar adaptadores. Si tipos/build requieren el archivo UI todavía no entregado, se declara esa dependencia; el gate del candidato combinado debe resolverla, no dar PASS ficticio.

Handoff `docs/factory/0236-core.md`: SHAs, paths, pruebas reales/fallos/skips, migración preparada y orden de corte revisable. Sin operaciones PROD.

## B — interfaz y pruebas de interacción

Task `gastos-ui-0236`: writer exclusivo de `apps/merchant/src/modules/expenses/ui/`, `tests/e2e/expenses.spec.ts`, `tests/e2e/expenses-input.spec.ts` y `tests/e2e/support/expenses-fixture.ts`; handoff `docs/factory/0236-ui.md`. No kit/guardias/CSS/core/registro, no Neon. Puede avanzar contra dobles del HTTP cerrado y después comprobar cableado real en combinación.

Registro con filtro de fechas/local, estado vacío útil sin carga inicial, alta por dictado/foto, revisión/corrección completa, edición/borrado en meses pasados y errores/conflictos recuperables. Check fijo visible sin paso obligatorio. Distinguir selección local pendiente de todo el negocio null. No mostrar sueldo/conceptos antes de permiso. Reutilizar speech/entrada de fotos y componentes de Merchant sin importar lógica de otro módulo.

Aplicar impeccable en modo Operate preservando la composición del kit y el modelo Stock que el owner fijó en0236; las decisiones de producto ya están cerradas, no abrir entrevista/rebranding ni producir opciones visuales ajenas al encargo. Leer el piso de craft antes de editar UI. Una inspección conjunta desktop/mobile y una confirmación de correcciones como máximo, sin ciclos de pulido. La skill no amplía los paths ni el número de agentes del flujo.

## Coordinación, recursos y QA

- Dos implementadores que corrigen; QA independiente sobre entregas/candidato congelados. Sin subdelegación ni reviewers extra por defecto. Coordinador único writer de este contrato/spec/ADR/estado GPT, sin INDEX/TASKS/estado Claude.
- Node24, dependencias propias y configuración seleccionada; nunca copiar/enlazar env productivos. Credenciales solo memoria, logs de claves/metadatos sin valores/prefijos.
- A reserva `db:modules-ci`, entorno protegido seleccionado `/private/tmp/checkpass-recipes-margin/0234-ci.env`; DB únicamente `tools/neon-test.sh`, DDL aislado/serial `--no-file-parallelism`, reserva también durante teardown. B no usa DB; puertos propios43130/43131, QA43132 cuando se asigne.
- Pruebas decisivas de0236: alta confirmada/rollback evento, conceptos entre pagos, segunda edición histórica/source UUID y tombstone, día/mes comercial, todo negocio null, owner/staff/tenant negativos reales, idempotencia, foto efímera, venta/corte Stock conservados y migración focal sin datos/dep inesperada. No suites enteras por ceremonia.
- Estáticos/formato/fronteras del ámbito cambiado, pruebas focales por autor; build Merchant y recorrido integrado una vez sobre combinación exacta. Presupuesto0mutaciones, sin verify global ni gates de publicación sin push autorizado. No PASS por skips/retries.
- Entrega commit propio limpio; coordinador factory deliver, QA de entrega y de combinación diferenciadas, factory accept solo con SHA/evidencia. Main local recibe candidato después de QA/gates proporcionales; cleanup solo con aceptación/ancestro main y sin procesos/pendientes.

## Rojo remoto previo

`pnpm ci:status` al iniciar: main db3175d rojo en run38998852554, paso Unit + integración Neon, `stock/stock-consumption.neon.integration.test.ts:315`: esperaba `count_changed`, observó ModuleError de consumo pendiente. El test coordina cierre nuevo durante drenaje con handler bloqueado y presupuesto de retry; esto identifica el camino, **no prueba la causa**. A debe reproducir focalmente e investigar error/cableado/presupuesto antes de cambiarlo. No aumentar retries, aceptar dos errores indistintos ni cambiar una aserción para esconderlo. El candidato debe dejar resuelto el caso antes de considerarlo listo; la CI remota no se sondea después de publicar.

## Cierre esperado

Gastos funcionando en candidato local revisable, DoD0236 con evidencia focal de entrega/combinación y migración preparada/probada en CI protegida. No publicar ni ejecutar migración PROD. Fuera de alcance siguen Analíticas/estimados/punto de equilibrio, Smart Menu, medios/comisiones, reparto y comprobantes persistidos.
