# 0242 — Ficha preparada M0 de guardar/QR/cobro

Estado: preparada para **nuevo implementador con contexto vacío** después de aceptar entrega de listado/instrumentación. Es la siguiente entrega pequeña de CP0; no es CP1 ni rediseño. Owner pidió dividir tareas y renovar contexto por entregable. Coordinador asignará baseSHA/reserva y transferirá los recursos antes de escribir/ejecutar. No crear más worktrees.

## Entrada y fuentes mínimas

AGENTS/protocolos, esta ficha, `0242-performance.md`, handoff final de listado en `0242-cp0-ui-m0.md`, secciones pertinentes del contrato de seguridad/cierre y scripts reales entregados. Control de negocio sigue POS actual unit; no mass/v2 ni nueva funcionalidad de venta. Listado previo36muestras válidas no se repite por ceremonia y sus intentos fallidos/incompletos se preservan.

El implementador previo archivó código **WIP no ejecutado/no QA** en ref local `pos-m0-flows-wip`, commit `32df8dd67d25dd38238c3f35971a76390356faf7`, parent647bac0e, únicamente measurement.test-support, measurement.neon.integration.test y tools/pos-measurement/flows.mjs. Leer diff por SHA antes de recuperar partes dentro de la reserva. El borrador usa la primera identidad de campaña para smoke (debe separarse) y aún no añade hash de flows al freeze; no ejecutarlo sin revisar/corregir esos puntos. Ningún setup de programas/consumidores/cupones ni comando mutante se ejecutó con él.

## Objetivo y receta aceptada

Medir el recorrido **real** guardar→QR→preparar cobro→cerrar sobre build/start control y CI protegida, con login legítimo owner/staff.18flujos de campaña:2roles×QRsin cupón/10% descuento/100%neto0×3intentos, cada uno con consumidor/cupón/UUID/orden propios premanifestados. Smoke usa identidades separadas de las18. Camera puede ser determinista con token legítimo del dominio; auth/API/DB/respuestas de negocio no se interceptan.

Agregar programa/fixtures solo después del listado completo (ya concluido). Conservar efectos/órdenes cerradas hasta cleanup protegido del tenant propio; no resetear saldos/cupones por debajo del ledger. Historial creciente y estado son explícitos: esta población descriptiva no demuestra mejora A/B. M1 preparará pares equivalentes y repetirá control contemporáneo con candidato; gates estadísticos no se rebajan.

Congelar antes de campaña: sourceSHA/runner/preload/flows hashes, buildSource+BUILD_ID/archivo control, runtime/config saneada/lock/schema/manifest, inicio/fin marcadores y muestras. Reutilizar build anterior solo si fuente/config compiladas compatibles se verifican y se atribuye al SHA que realmente lo construyó; no afirmar otro build por cambiar solo el runner. Guardar todos los intentos, incluidos setup/oráculo/entorno fallidos, sin retries/skips como PASS ni descartar muestras para mejorar cifras.

## Scope previsto para reserva explícita

Reutilizar WT B y paths de harness entregados; ampliar o reservar exactamente los archivos que se necesiten antes de editar. Propuesta: measurement fixture/support/login en `apps/merchant/src/modules/pos/server`, scripts bajo `tools/pos-measurement`, runner/preload de soporte, propio `docs/factory/0242-cp0-flows-handoff.md`. No editar código de negocio para hacer que pase el benchmark; diagnóstico nuevo en dispatcher/close/client requiere asignación acotada del coordinador. No kit/guardias/migraciones/deps.

Recursos previstos: db:ci-integration exclusivo incluido teardown, localhost43242 y listener proxy43243 solo si propio, artefactos privados existentes más subcarpeta propia. La transferencia exige entrega/checkout limpio y procesos del autor anterior detenidos antes de factory continue; no borrar fixtures/control/config privada al cambiar de agente. Solo tools/neon-test.sh para DB, env seleccionado CI y antiPROD incondicional incluso NODE_ENVproduction. No copiar env productivos ni imprimir cookies/QR/scope/PII. No actuar hasta recibir la transferencia explícita.

## Aceptación y límites

Marcadores UI observables con orden/total/estado correctos y acciones autorizadas; UUID/cuerpo de cierre único por confirmación y neto0 sin medio ficticio. Registrar HTTP/SQL/request/guard/tx/COMMIT por intento y sus definiciones. Separar closeConfirmed de COMMIT y trabajo aftercommit: hook afterGrant solo mide schedule, no toda la entrega; inspeccionar delivery/pendientes/resultado durable bajo wrapper y declarar fases no observadas, nunca0ms por ausencia de señal. Un fallo aftercommit no convierte cierre confirmado en error de cobro.

Verificar efectos propios y no duplicados después mediante inspección protegida; no presentar solo APIsimulada ni componente como Next→guard→DB→UI. Autor entrega commit limpio/evidencia/handoff. QA de esta entrega será también un agente nuevo, independiente, que lee contratos y candidato congelado; reutiliza evidencia compatible y reproduce señal decisiva si hay duda. Solo después de aceptar esta entrega y su combinación con contratos/listado se cierra CP0 y se despacha CP1a. Sin push/PROD ni avance main por un CP0 parcial.
