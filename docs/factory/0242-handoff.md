# 0242 — Handoff para retomar después de clear

## Reanudación del18oct: expansiones unit y cálculo puro de Recetas aceptados

Owner exige entregables pequeños y **agentes nuevos/contexto vacío por bloque aceptado**, incluidos QA. Gratis/2x1 no aplican a líneas por peso; decisión cerrada. CP0 aceptado: contratos329c7917, LISTAc379c9a8, flujos8dca14ee y sus QA. Después se aceptaron financiale9d409ac/QA9a4a52a6, scope servidor1af3d7f3/QA0b52df93, lectores unit8624cda8/QA745bff45 y cliente scopeb0127037/QA7f9dce96. Ver sus fichas/handoffs/QA y el bloque vigente de estado. No confundir M0 descriptivo con POSV2/M1.

Catálogo ad9df221/QA98ab4e39, decoder96195674/QA63cd3c97 y quantity storage00ce3546/QA6cb655d8 ya aceptados/integrados.0102/0103 aplicadas a CI y, por root trasQA, a local protegida. Recetas storage0104 285662df/QA646b12b5 también aceptado e integrado (3CI+34puras, tipos/estáticosPASS); root aplicó0104 local despuésQA antes de integrar:105 migraciones, health3201 HTTP200. Main locale7454217 por FF, sin push/PROD. Dos regresiones nuevas de fixtures se corrigieron en00ce sin tocar guardias: prueba catálogo ahora en modules/pos/server y provider de decoder genérico; solo queda backlog00efff81 probado.

Expansor puro41d2aaa2/QA8287f8fb aceptado e integrado sobre13140830:125 focales+122 escenarios propios, tipos/lint PASS y solo2 guardias backlog. Ronda actual: [captura/procedencia](0242-cp1c-recipes-captured.md) por nuevo autor recipes_captured_cp1c_impl en WTdata basee7454217 conCIexclusiva; sin subscriptions/runtime. [Base financiera de analytics](0242-cp1c-analytics-basis.md) entregada9bc8f49f por autor nuevo (115pruebas,tipos/lintPASS), QA nuevo analytics_basis_cp1c_qa sobre0a699913 en WTQA sinDB. [Lector analytics](0242-cp1c-analytics-reader.md) preparado para otro autor después de aceptar base pura, todavía no reservado. Viejo WTpos-ui retirado limpio por factory después de aceptación/main; QApos-qa permanece y se continúa para cada revisión nueva. Ver estado vigente para fuentes/reservas. No iniciar otro writer schema ni DB concurrente. Archivo control/RAW/fixtures M0 intactos,43242 libre;3201/túnel/demos preservados.

La precisión nueva y mass/V4 siguen dormidas hasta CP2c compatible; las expansiones físicas mantienen barreras temporales. El resto del handoff es contexto histórico del mapeo: sus afirmaciones de preparación sin código no describen las entregas ya aceptadas.

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
