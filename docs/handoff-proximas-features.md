# Handoff — próximas features tras clear

## Punto de partida

Actualizado el 2026-10-15, después de la promoción autorizada de0231. **0230 y0231 terminadas, con QA independiente y promoción a main local.** No retomarlas como implementaciones pendientes.0228/0229 también habían cerrado antes.

Antes de este handoff, main y dev apuntan a **`d1e0710ff90454518d1b27d2678ff85ec047e11b`**. Este cierre solo añade documentación a dev; usar su HEAD real como base y comprobar refs al volver. Main recibió0231 por avance directo verificado, manteniendo el checkout principal en dev. Sin push, deploy ni operación PROD. Las tres reservas0231 están retired y sus worktrees/ramas se retiraron con factory sin force; solo queda el checkout principal y no hay tarea factory activa.

Evidencia0231: candidato de producto `3ec389fb528ebe13921f9b623a076d9d7993ed2c`, [informe QA](factory/0231-qa.md) en `04fca7fa5638a1ba53b108abb8a5edbe2052aeac`, [contrato y cierre local](factory/0231-implementation-contract.md), [entrega core](factory/0231-core.md), [entrega Rentabilidad](factory/0231-profitability.md). QA independiente:20/20 DB,50/50 unitarios/registro/fronteras y tipos DB/Merchant PASS; evidencia de autores reutilizada por identidad sin sumar casos solapados. Es backend sin pantallas. SPEC0231 y ADR0147 contienen las decisiones cerradas de Equipo sin acceso, selección de locales y costos/sueldos mensuales.0230 quedó en main previamente en `9e23b5fe`; ver [QA0230](factory/0230-0231-qa.md).

El owner pide clear para trabajar en otra cosa con el mismo flujo de agentes. Esperar el nuevo encargo; no empezar R1 automáticamente ni reabrir decisiones cerradas.

## Entornos y migración local posterior

Owner aclaró que dev-business.checkpass.club corresponde al entorno local por túnel y Vercel usa producción. Un fallo anterior GETstock/items503 con PostgreSQL42703 se debió a que local seguía en0083 mientras el código requería0084: CI de pruebas no actualiza la app local.

Local ya está alineado **hasta0087,88 entradas de journal**. El coordinador ejecutó el migrador local protegido antes de integrar0231: EXIT0, seis tablas nuevas presentes, cero membresías staff sin identidad y hashes del journal iguales al SQL0086 `ad70104c9a922682e321a0a176925f59f902f698bdd3ecaf236ca714739a0357` y0087 `e2ecf908d47dbcbefccce942f5d27309020411741bdb3c97a0b48c8f4f4f901a`. Sin reset/seed ni modificación de permisos/credenciales; no equivale a smoke UI/POS. Configuraciones seleccionadas conservadas fuera del repo en `/private/tmp/checkpass-specs/{local,ci}-selected.env`, modo0600; no imprimir valores ni copiarlas indiscriminadamente.

Al entregar una feature con migración, comprobar también que la base usada por la app local tiene el esquema del código. QA en una DB aislada no sustituye esa alineación. Las operaciones PROD siguen requiriendo autorización explícita por caso. Conservar EXPAND0227 y flag de consumo; no aplicar contract ni seed de rollout por inferencia.

## Proceso para la próxima feature

Leer AGENTS.md, docs/TRABAJO-EN-PARALELO.md, docs/AGENT-WORKFLOW.md, docs/VERIFICACION.md y sólo el bloque vigente de docs/estado/gpt.md; contexto funcional pertinente, Node24 antes de comandos.

- Coordinador + **dos implementadores que también corrigen + QA independiente**. Sin subdelegación/reviewers extra por defecto; máximo tres worktrees operativos.
- Dev es base/integración. Preparar spec/contrato cerrado cuando corresponda y fichas con base exacta, paths, checks y recursos; reservar índices por commit local y recursos mediante tools/factory.ts antes de código.
- Repartir tareas independientes; un writer para esquema/journal/exports compartidos y DB reservada también durante teardown. Sin merges textuales de snapshots. UI modular en modules/<id>/ui, kit/copy y contratos HTTP existentes; no alterar guardias para evitar rojos.
- Checks proporcionales, entrega por SHA, QA independiente y luego combinación exacta. Reutilizar evidencia compatible; no PASS por skips/retries ni verify global por ceremonia. Mantener el host despierto durante pruebas de presupuesto; la suspensión contaminó diagnósticos anteriores.
- DB tests según AGENTS y wrapper protegido tools/neon-test.sh, sin credenciales PROD ni confundir CI de pruebas con DB de la aplicación. Antes de operaciones, identificar destino local/CI/PROD y respetar el alcance explícito del owner.
- Avanzar automáticamente hasta candidato concreto con QA completo PASS; pedir autorización final de merge a main local. Push/deploy/migración PROD nunca implícitos. Tras merge autorizado, factory integrate/cleanup sin force y sin tocar trabajo ajeno.

## Pendientes y trabajo ajeno

Encargo R1 previo pendiente: **solo SPEC0232 + ADR0148**, recetas independientes y combos; no se empezó ni se reservó código. Owner había pedido esperar a los implementadores0231 y ahora pide otro contexto. No existe respuesta a la pregunta de archivar una receta usada: recomendar bloquear y mostrar productos que la usan; preguntar y esperar antes de redactar. Si retoma R1, leer su encargo, specs0227/0228/0230 (Compatibilidad R1), ADR0138/0139/0145, modelos/servidores de Recetas y eventos/consumo; del plan solo «Recetas independientes y combos» y «R1 — huecos cerrados con el owner». Receta con identidad/revisiones propias por comercio, composición versionada producto→recetas con cantidad decimal, combo sin combos/subrecetas, ambas revisiones vigentes al cierre, archivo/nombre activo único sin case y migración actual×1 son decisiones cerradas. Resolver técnicamente captura consistente al cierre, procedencia del consumo compartido por línea, vista previa, HTTP nuevo y retirada de rutas antiguas, migración/corte compatible con costos congelados0230. No UI ni implementación/migración generada; ninguna edición INDEX/TASKS/estados. No reabrir decisiones ya dadas.

El handoff anterior registró una credencial CI expuesta por contexto del driver y rotación pendiente; no se comprobó su rotación durante0230/0231. Es la contraseña compartida por NEON_CI_DATABASE_URL y NEON_CI_DATABASE_URL_UNPOOLED; consumer es distinta. No imprimir valores, prefijos ni objetos del driver. Logs redactados/restringidos; no iniciar una rotación por inferencia.

Hay modificaciones ajenas en docs/estado/claude.md y docs/estado/claude-historico.md y artefactos/skills no versionados previos. También son ajenos/no versionados `docs/plan-margen-ganancia-2026-10-14.md` y `docs/investigacion-medios-de-pago-ecuador-2026-10-15.md`. No editarlos, stagearlos, descartarlos ni incluirlos en el cierre GPT. El owner excluyó INDEX, TASKS y docs/estado de este trabajo; se respetó. Reconciliar estado real al retomar, sin tratar gpt.md antiguo como una tarea pendiente por encima de refs/handoffs actuales.

## Prompt de retoma

«Lee docs/handoff-proximas-features.md y el bloque vigente de docs/estado/gpt.md. Retomamos el proceso con dos implementadores, coordinación y QA independiente. Las nuevas features son: [descripción del owner]. Prepara contratos/reservas y continúa hasta QA completo PASS; pide autorización para main local al final. Sin push ni operaciones PROD.»
