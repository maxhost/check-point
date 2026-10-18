# 0242 — Handoff para retomar después de clear

## Reanudación del18oct: expansiones unit y cálculo puro de Recetas aceptados

Owner exige entregables pequeños y **agentes nuevos/contexto vacío por bloque aceptado**, incluidos QA. Gratis/2x1 no aplican a líneas por peso; decisión cerrada. CP0 aceptado: contratos329c7917, LISTAc379c9a8, flujos8dca14ee y sus QA. Después se aceptaron financiale9d409ac/QA9a4a52a6, scope servidor1af3d7f3/QA0b52df93, lectores unit8624cda8/QA745bff45 y cliente scopeb0127037/QA7f9dce96. Ver sus fichas/handoffs/QA y el bloque vigente de estado. No confundir M0 descriptivo con POSV2/M1.

Catálogo ad9df221/QA98ab4e39, decoder96195674/QA63cd3c97 y quantity storage00ce3546/QA6cb655d8 ya aceptados/integrados.0102/0103 aplicadas a CI y, por root trasQA, a local protegida. Recetas storage0104 285662df/QA646b12b5 también aceptado e integrado (3CI+34puras, tipos/estáticosPASS); root aplicó0104 local despuésQA antes de integrar:105 migraciones, health3201 HTTP200. Main local993390ca por FF, sin push/PROD. Dos regresiones nuevas de fixtures se corrigieron en00ce sin tocar guardias: prueba catálogo ahora en modules/pos/server y provider de decoder genérico; solo queda backlog00efff81 probado.

Expansor puro41d2aaa2/QA8287f8fb y base financiera analytics9bc8f49f/QAa2580a80 aceptados. Después: lector analyticsbe66d39e/QA373d6917 (4CI+2seleccionadas,12purasQA); captura/provenance637ae1f2/QA70d82a5b (aceptación funcional con completa10PASS/1FAILtimeoutNeon y foco1PASS/4excluidos, NO full11PASS); traductor POS6dc4b621/QA740af13f (192PASS, tipos/lint). Ver handoffs/QA para evidencia compuesta y fallos preservados. Captura corrige dos bugs reales de replay; rawV4 no tiene filasPOS/core, no es cierre E2E.

Hook aceptado: autor03cab45d/QA9ad94226 sobre030dd657, código61dca744,4puras+6CI finales PASS. QA detectó y cerró bug real de recetas duplicadas [A,A] frente[A,B]. Primera CI1PASS/4timeouts preservada; no se reetiqueta. Main localb109a365 tras identidad con QA; WT measurement-hook retirado por factory limpio/0procesos. Hook no llamado por catálogo/importación todavía.

Derivado ya aceptado: autor28728305/QA6c3ff0ec sobreefd067cf,37puras+4CI97.80s PASS sin skips, parentJSONB completo/replay con delivery real, legacy intacto. Sin cierre E2E. WT recipes-events retirado factory tras mainafbe2ce4.

Metadatos0105 ya aceptados: autor d2554387(código30c68434)/QA9df585d6 sobrea15e3b9a,5CI25.63s+46puras/tipos PASS, guardias24PASS/2FAIL backlog, SQL/JSONdiff aditivo solo2tablas. Root migró LOCAL protegida despuésQA antes de integrar:106migraciones/EXIT0; health3201 HTTP200. Defaults unit y configkg, mass dormido por barrera temporal. WT catalog-measure-storage retirado factory limpio/0procesos/main993390ca. Sin PROD.

Ronda actual A: measured-delivery-0242 NUEVO autor measured_delivery_cp1c_impl baseafbe2ce4, congelado dd47524f40ba683a3bafc8243b351efdc8c8456a.122puras/tipos3/lint/formato PASS; CI EXCLUSIVA autor en curso (nuevo gate+legacy consumo/costo/origins). Ficha conexión de consumidores/costo medido/envelope compartido. Ampliación root/factory/ficha solo3 callers handler→dispatch+version en analytics-origins/modelconsumption tests, asserts intactos. No producer4 ni mass operativo.

QA NUEVO measured_delivery_cp1c_qa en pos-qa-0242, congelado temprano d7cbf500ce0b2531cd6916cd40926c211168f95e (main993+dd475), SIN DB, sin informe final hasta handoff/evidencia y candidato actualizados porroot. Único reporte0242-cp1c-measured-delivery-qa.md.

Ronda actual B: sales-units-api-0242 NUEVO autor sales_units_api_cp2a_impl base993390ca, ficha0242-cp2a-sales-units-api.md comprometida41bfaa37/reserva previa. API GET/PUT deunidades/revisión compartida/guardbusiness/no-store sin UI ni catálogo. OFFLINE hasta transferenciaCI: DB exclusiva A. Negativo realunit_in_use sobremass y carrera catálogo quedanCP2c por barrera temporal0105; no debilitarconstraint ni fabricarfixtureimposible. Seguir contrato final antescierre.

Viejos tasks/WT pos-ui,pos-recipes-exact,pos-data,pos-metrics,measurement-hook,recipes-events,catalog-measure-storage retirados limpios factory tras aceptación/main; no reutilizar IDs. M0/control/RAW privados preservados,3201/túnel/demos intactos.

Owner ve error repetido “Selected model is at capacity” EN ESTE CHAT PRINCIPAL; no atribuirlo exclusivamente a un subagente ni prometer resuelto. Se usó openai-docs y guía oficial de sobrecarga como explicación compatible, no diagnóstico exacto UI. Root no puede cambiar modelo del chat y no cambió modelos/config. Continúa encargo; guardar checkpoints y preservar entregas. Queda bastante del plan, sin ETA fiable.

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
