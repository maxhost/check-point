# 0242 — Handoff para retomar después de clear

## Reanudación del18oct: CP0 aceptado; CP1a preparado

Owner exige entregables manejables y **agentes nuevos/contexto vacío por bloque aceptado**, incluidos QA. Gratis/2x1 no aplican a líneas por peso; decisión cerrada. Contratos puros A329c7917/QA7fc88bad, LISTA M0 Bc379c9a8/QA80b32497 y flujos8dca14ee/QA9ee475dc aceptados e integrados en dev. Combinación congelada a5cbd20c:53/53 pruebas puras,2/2 instrumentales y tipos merchant PASS; habilita CP1. M0:36 muestras listado y18flujos+3smokes válidos, evidencia durable CI y fallos/límites preservados en [handoff flujos](0242-cp0-flows-handoff.md) y [QA](0242-cp0-flows-qa.md). No certifica POSv2/M1/PROD. Servidores propios detenidos, fixtures/control/RAW privados conservados.

Siguientes entregas con nuevos autores: [financial puro](0242-cp1a-financial.md) sin DB y [scope servidor](0242-cp1a-scope-server.md) con CI exclusiva; base/paths/reservas en factory y estado vigente. Cliente/seed/cache será otro contexto. No schema/UI enCP1a; no activar mass/V4 antes de cierre y consumidores completos. El resto conserva contexto histórico del mapeo previo; las afirmaciones de preparación sin código no describen las entregas CP0 ya aceptadas.

## Objetivo actual

Preparar y revisar spec/contratos/plan del **rediseño integral del POS**, usando el laboratorio aprobado como referencia. Usuario pidió agentes y rendimiento production grade. Se ejecutó mapeo con2agentes read-only y revisión documental independiente. Todavía no se implementó producto ni se crearon worktrees de código, DB o servidores de producto.

## Orden de lectura al retomar

1. AGENTS.md y bloque vigente docs/estado/gpt.md; protocolos paralelos/workflow/verificación.
2. `docs/specs/0242-pos-unificado-y-venta-por-peso.md`.
3. `docs/specs/0242-contratos-pos-y-medidas.md` y ADR0155.
4. `docs/factory/0242-plan-implementacion.md` y `0242-performance.md`.
5. `docs/factory/0242-qa-documental.md` (resultado/limitaciones) y mapa actual solo para paths pertinentes.
6. Laboratorio `docs/design-explorations/2026-10-18-mostrador/index.html`, decisiones y versionesv001–v004 como referencia; no copiar su aritmética JS ni su CSS al producto.

## Hechos y decisiones que no deben perderse

- Un POS con lista de abiertas/cerradas/anuladas, creación/editor/confirmación/QR/cobro/resultado/impresión y conflictos. Mostrador tipo venta; deja de existir consola independiente.
- Mesa, Retiro, Delivery: confirmar guarda abierta; cobrar solo al cerrarla. Retiro/Delivery etiqueta obligatoria como Mesa. Mostrador no pide mesa ni paso manual Guardar, pero usa órdenes/ledger actuales.
- Negocio habilita kg/lb/g; catálogo checkbox por peso y tarifa por unidad elegida; captura manual sin balanza. Medidas/tarifas/snapshots exactos en toda cadena, legacy unit.
- Móvil CTA/total final único en pie; escritorio catálogo+orden. Kit/tokens/guardia merchant, tuteo. No reemplazar impresión/estados inciertos por happy path del mockup.
- **PWA/emisión de cupones de premio fuera**. El owner decidió **suspender canje directo de premios por ahora** al retirar legacy. Conservar saldos/registros. No implementar ni mantener un canje directo oculto por asumir continuidad.
- Cupones existentes con reglas visibles para revisión humana, sin parsear texto ni nuevas exclusiones por contenerpeso. Ver contrato final para cantidad bonificada de masa: no adivinarla desde precio.
- Fidelización de compras cobradas afuera y Agenda/otros rubros quedan diferidos. Los escenarios de cita en maqueta no autorizan construir Agenda en esta entrega.
- Cliente/cupón de orden abierta siguen temporales; no copiar persistencia de simulación a DB.

## Hallazgos técnicos

- Producto mapeado `5f9cb2b2af49fa45850c059ef33f8bb69ea15172` dev; reserva docsec454681. Confirmar nuevoHEAD al iniciar implementación, no usar el SHA viejo como candidato.
- Mejora de carga es0238/ADR0154, no0239. POS aún hace GETsession→orders. Ya hay contextoporRequest/seed/pool compartido. Adoptar scopeKey en cliente+servidorPOS antes de dominio y conservar guards; no cookieCache/global auth cache.
- Event sale.closed vigente llega aV3; medidas emitenV4 con replay1–3. Cantidades hoyint en POS/core y consumers usan BigInt de enteros.
- Counter controla también Clientes/entry staff y dominio compartido. Retirar pantalla/API sin migrar accesos rompe operación; no borrar código por nombre.
- Business real es `/api/business/[...path]`, regional/fiscal con revisión compartida. Sales-units es recurso nuevo con la misma concurrencia; catálogo tiene rutas existentes y revisión de venta nueva definida en contrato.
- Datos/finanzas/eventos ya tienen transacciones/idempotencia/aftercommit; conservar garantías, no inventar otro ledger.

## Verificación y límites

La QA de esta etapa es **documental/estática**; no valida rendimiento/DB/auth de implementación inexistente. CP0 debe congelar M0/contratos ejecutables y fichas antes de implementar. DB solo tools/neon-test.sh CI protegida; reservar schema/journal y teardown. Dos implementadores + QA en3WT, coordinador único de estados/índices/integración.

CI remoto main observadoROJO90ebe18f (verify Unit+Neon), antecedente ya conocido. No se arregló por esta tarea documental. No publicar candidato sin tratar los gates aplicables a release. Push/PROD necesitan autorización explícita por caso. Mainlocal no es publicación.

## Trabajo ajeno y procesos

Checkout dev no se cambió de rama. Había artefactos .agents/.claude/.codex/.github y apps public/consumer de Impeccable sin seguimiento; preservarlos. `.impeccable/config.json` tiene excepciones puntuales de fuente/texto añadidas en conversación previa; no mezclarlas en cambios de producto ni resetearlas.

Laboratorio se sirve desde una carpeta temporal propia en localhost4387; fuente persistida en docs/design-explorations. Su disponibilidad tras clear no es garantía del handoff: index.html funciona como archivo local. Servidor3201/túnel/demos previos intactos. No detener procesos ajenos.

## Prompt de reanudación

«Retoma0242 desde docs/estado/gpt.md y docs/factory/0242-handoff.md. Lee spec, contrato, QA documental y plan. Confirma refs/factory, inicia CP0 con dos implementadores y QA según las fichas; conserva alcance POS/peso/auth/performance y retiro legacy, PWA fuera y canje directo suspendido. No push ni PROD.»
