# 0242 CP2c.7 — ensamblado HTTP del cierre V2

Implementador NUEVO B. Base `8cb6439f09ebcb5113eda8e359bf786c93ec4f39`; implementación `58118dd0` y commit documental posterior de esta entrega. Worktree `/private/tmp/checkpass-pos-0242/pos-close-api-v2-0242`. Solo tres paths reservados: import/handler close de `apps/merchant/src/modules/pos/server/routes.ts`, suite nueva `close-api-v2.neon.integration.test.ts` en ese directorio y este handoff. Sin cambios al dominio, legacy, guardias, esquema, dependencias, UI o contratos.

## Resultado

POST orders/:id/close lee `posReadContract(request)` dentro del handler protegido por el dispatcher y `posRoute`, antes del ID/cuerpo/dominio. Ausente/1 usa `closePosOrder`;2 usa `closeMeasuredPosOrder` aceptado y su DTO2 sin conversión. Desconocido devuelve409 `pos_client_upgrade_required` sin parsear cuerpo ni ejecutar cierre. Guard/scope/private-no-store y traducción canónica de errores siguen siendo los existentes. No nuevas rutas, GET adicionales, downgrade, pipeline copiado ni activación mass.

## Evidencia congelada

Directorio externo `/private/tmp/checkpass-pos-0242/close-api-evidence/`; comandos y resultados en `commands.txt`. Node24.20.0/pnpm11.4.0. `base.txt`, `implementation-sha.txt`, `config.sha256`, `source.sha256` (ronda1) y `round2-source.sha256` fijan identidad. Las dos corridas mantuvieron fuentes congeladas hasta teardown. DB exclusivamente wrapper con `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env` y `--no-file-parallelism`, reserva exclusiva hasta limpieza.

- `neon-round2.log`: **EXIT0,4 PASS,0 skips**, fuente final idéntica a58118dd0. Guard explícito del harness autoriza negocio A/B, rechaza anónimo/permiso y conserva comprobación real de módulo. Dispatcher/scope/handlers/dominio/DB son reales. Esto no certifica autenticación nativa Next. Scope inválido real corta antes de contrato/body/dominio; módulo apagado se restaura en finally. Requests rechazados no parsean cuerpo ni llaman ninguno de los dos cierres y conservan estado DB.
- Header2 sobre orden unit creada realmente por `createPosOrderV2`: DTO completo igual al reader canónico, cantidades/tarifas/totales strings, originalAmount racional y lineId conservado. Venta con pase y replay: mismo DTO/closedAt/IDs, una acreditación/eventoV4/pago y ningún nuevo afterGrant/scheduling ni cambio de estado completo en replay. No se llama legacy.
- Ausente/1 cierran órdenes propias compatibles con DTOlegacy, quantity numérica y sin contractVersion; no llaman cierre medido. Tenant B recibe404 sin DTO ni cierre de orden A. Stale409 contiene exactamente ordenV2 original con strings;422 payment_sum_mismatch conserva mensaje y settlement financiero completo. Ninguno altera estado.
- Teardown desde setup protegido por try/catch y afterAll: elimina negocios y sus memberships, owners/sesiones, consumer/membresías/cliente/colas propios y comprueba ausencia. No se crearon staff. Ambos teardowns finalizaron sin errores.
- `types-round2.log`, `lint-round2.log`, `format-round2.log`, `ui-guard.log`: **EXIT0**. `boundaries.log`: **EXIT1,24 PASS/2 FAIL**, backlog conocido de Expenses immediate→Stock count y literales core en backoffice context/refresh, onboarding, analytics policy-simulation/lifecycle. Los paths ofensores no cambian en esta entrega; cero offenders nuevos. No se tocaron guardias ni se presenta el conjunto como verde.
- `neon-round1.log`: EXIT0,4PASS/0skips con source.sha256. Tipos detectó después un campo obligatorio discount:null ausente en el oráculo financiero (`types.log`, EXIT2). Se añadió ese campo después de terminar la primera corrida y su teardown; producción no cambió. Ronda2 verificó la fuente final completa. No se reutiliza un PASS de fuente mutable.

## Reutilización y límites

`reused-close-identity.log` y `reused-config-identity.log`: SHA256 de las cinco fuentes de cierre interno aceptadas y configuración/lockfile/journal coinciden con round3-source/config de `/private/tmp/checkpass-pos-0242/measured-close-evidence/`. Se reutilizan la matriz de dinero/stock/Recipes/comisión y ensamblado unit aceptados en `0242-cp2c-measured-close-qa.md` (entrega214a5e10, QA4164 aceptado), sin repetirla en HTTP. Esta ruta no modifica esas primitivas.

Falta URL opcional consumer en configuración: no se ejecuta ni certifica ese rol. No auth nativa Next, masa positiva canónica, voidV2, retirada, cutover ni POS0242 completo. Sin browser/build/fullverify/M0/M1, servidores,3201/túnel, demos, push ni PROD. El wrapper aplica únicamente el esquema CI como parte de su interlock; no hay migración nueva.

`processes-final.log`: lsof EXIT0, **0 procesos propios con CWD en este worktree**, excluidos solo Python/shell/lsof del scanner. Todos los checks terminaron y el recurso CI puede liberarse por coordinador. Worktree y fixes conservados para QA NUEVO independiente. Factory/aceptación/integración/cleanup corresponden al coordinador; autor termina aquí su bloque.
