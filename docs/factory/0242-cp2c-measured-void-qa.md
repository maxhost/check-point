# 0242 CP2c.8 — QA independiente de anulación interna V2

Resultado: **PASS focal de entrega y combinación**, sin hallazgos bloqueantes. No equivale a verify global verde, certificación HTTP/E2E ni autorización de publicación.

Candidato congelado auditado: `71ca4a95b1765f8e1212fea7a15a7c838a2ea7a2`, ref `pos-qa-0242`, worktree `/private/tmp/checkpass-pos-0242/pos-qa-0242`. Autor: `3511c9d28852b5e88604e4986363379cc8dd9441`; código `0409a46b98b6f6c9d70e552b3fc55f0024d3bb93`; base `cf0fef49ade541e3daf8770b968ed921f95d14df`. Incluye `1bac7aa8` y el ensamblado close aceptado. Entre entrega del autor y candidato solo cambian `docs/estado/gpt.md` y `docs/factory/0242-handoff.md`; ninguna fuente/configuración cambia. HEAD permaneció congelado durante la auditoría. QA solo escribe este informe.

Leídos AGENTS/protocolos ADR0144, ficha/handoff y apartados pertinentes del contrato0242 (lecturas, anulación e históricos). Revisión independiente del diff y sus dependencias de locks, kernel, readers, append, unicidad y consumidores. No se ejecutó DB: no hay env/wrapper asignado a QA. No surgió una duda concreta que justificara repetir pruebas compatibles o abrir otra batería.

## Identidad y resultados observados

Evidencia reutilizada: `/private/tmp/checkpass-pos-0242/evidence/measured-void/manifest.json`, logs completos de cada comando, `source-1.sha256`, `config-1.sha256`, `processes.json`. Ejecutados en candidato ambos `shasum -a 256 -c`: **todos OK**, ocho archivos del bloque más lockfile y siete entradas de configuración. El diff confirma que los demás archivos de producto/dependencias de la base tampoco variaron. Runtime local comprobado con `source ~/.nvm/nvm.sh && nvm use`: Node24.20.0 y pnpm11.4.0, coincidentes con manifiesto (Vitest4.0.18). No se leyó/copió env ni credenciales.

- `types-1.log`: db/domain/merchant typecheck EXIT0.
- `pure-1.log`: cinco archivos, 57 PASS, 0 skips, EXIT0. Parser estricto; masa sintética con dos originales1/2 y asignación conjunta; escalares mayores que Number seguro; decoder/negativos; readers, summaries y métricas existentes.
- `neon-1.log`: wrapper CI seleccionado, migración completada; un escenario integral ejecutado, 44.881s, 1 PASS, 0 skips, EXIT0. Auditoría del test confirma que los negativos y assertions están dentro del escenario ejecutado y teardown en finally abarca setup parcial.
- `lint-1.log`, `format-1.log`, `ui-guard-1.log`: EXIT0; cinco archivos productivos sin aumentos de guardiaUI. `app-boundary-1.log`: 4 PASS, 0 skips, EXIT0.
- `boundaries-1.log`: **EXIT1, 24 PASS/2 FAIL**. Fallos reales preservados: Expenses immediate importa Stock count; literales core adicionales en backoffice context/refresh/onboarding y analytics policy-simulation/lifecycle. Los paths infractores y guardias no cambian en este candidato; no aparecen nuevos offenders del bloque. No se declara el conjunto verde.
- Auditoría propia: manifests íntegros, revisión de código/contrato y `git diff --check` EXIT0. No se atribuyen las pruebas del autor a una nueva ejecución QA.

## Invariantes revisadas

Parser permite ausencia de versión y rechaza sintaxis inválida/campos extra; UUID se valida antes del comando. Locks conservan prefijo módulo compartido → configuración de negocio → business SHARE → POS UPDATE del tenant; abierta revalida módulo y versión antes de efectos. No inversión frente a create/PUT/close. Anulada retorna antes de módulo/catálogo/medidas/kernel/publicación; stale se transforma a DTO2 tras rollback y cerrada mantiene409. Tenant ajeno produce404 sin mutación.

Abierta lee snapshots propios con orden posición/id y locks; adaptadores históricos unit admiten tarifa1e9 sin relajar captura nueva. Un único kernel calcula cantidades/dinero exactos y asigna importes por línea; no Number monetario ni normalización individual. Vacía usa cero con precisión autoritativa, sin fabricar settlement/pagos. Línea, total, append/delivery y estado/timestamps comparten transacción.

La prueba real cubre carrera/replay con un evento, replay tras moneda/precio/nombre y módulo apagado, stale/tenant/cerrada/módulo, vacíaJPY, positivoJPY y tarifa histórica1e9. La inyección llama primero append real y luego `select 1/0` dentro de la transacción: compara estado/líneas/eventos/deliveries completos tras rollback y recupera con el mismo intento. No es un throw previo al append.

Read/list añaden join acotado por business/type/source/version2/status voided. El índice único existente business/type/source evita multiplicar órdenes. Se proyectan cinco escalares, sin payload completo/arrays ni consultas por summary. Total y moneda V2 congelados prevalecen; detalle conserva snapshots de línea tras cambios actuales; legacy1 conserva su rama histórica. La incorporación no altera la autoridad settlement de cierre ni las fórmulas de resumen anteriores; el candidato mantiene el cierre aceptado sin cambios de fuente.

Evento void2 explícito conserva fuente/local/operador/hora, líneas/posición/producto/nombre/medida/cadenas y originales exactos. Único consumidor identificado para void es el traductor analytics: acepta envelope1/2 consistente con payload y valida campos consumidos; alias legacy y writer1 permanecen. Prueba real aplica delivery core.analytics V2 y V1, con solo voided_tickets/count1/importe congelado. No cambia decoder sale.closed. Código no invoca venta, coupon/accrual, stock o comisión; escenario verifica ausencia de órdenes core/pagos/redenciones/comisiones/customer/membership/stock y de eventos de venta. No se fabrican cobros ni cancelación de citas.

## Límites y cierre

Masa positiva solo pura/sintética; creación canónica integral es unit. No HTTP/handler, Next/auth/scope, browser, build, fullverify, M0/M1, activación, migraciones nuevas ni PROD. Aviso real del wrapper: falta NEON_CI_CONSUMER_DATABASE_URL; no se ejecutó oracle del rol consumidor en esa selección merchant. No se extrapola ese alcance. Sin fallos de producto pendientes dentro del bloque.

QA no lanzó procesos persistentes. `ps` inicial devolvió EPERM de sandbox; se avisó inmediatamente al coordinador y escalación propia acotada aprobada comprobó solo shell/rg transitorios de auditoría, ningún proceso del worktree. Evidencia del autor registra también count0. Sin servidores/túneles/push. Factory/aceptación/integración y limpieza quedan al coordinador.
