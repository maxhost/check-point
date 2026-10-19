# 0242 CP2c.2 — QA independiente de contexto mínimo QR

Resultado: **PASS** para CP2c.2 sobre candidato congelado `9cf014a54048ba4b3951c373da6ad43daf9636be`, base integrada `85047c91`. Entrega autor final `94aee107c1ced78a042d81fa8f7ab24fc4ceead9`; handoff final leído. Producto/tests CP2c.2 idénticos al freeze probado `86bd56fd34eb9765a7703229cf460397a72d1e36` y al primer candidato QA `995a8704cc5eeac8e86a9431a9470cb96fe6ddc7`. Desde995 solo se adjuntaron handoff y ficha de ensamblado; diff de producto vacío. Sin hallazgos reproducibles.

## Alcance observado

- `resolveScanContext` extrae sin cambio la secuencia token/local/programa/identidad/membresía/proyección/last_scan. Conserva programa active|closing, inserción con proyección y recuperación real de23505; existe una sola actualización last_scan por llamada. Core no importa ni nombra módulos POS/Recipes/Stock.
- `resolveScan` legacy enriquece el contexto con catálogo/shortcuts/rewards y conserva DTO, orden de consultas y efectos previos. El adapter mínimo llama directamente al contexto y coupon-state; no ejecuta legacy y luego elimina campos.
- `resolveMeasuredScan` devuelve allowlist explícita comprobada como `PosResolveV2`, también en objetos anidados y cupón: sin QR/token, cuenta extra, rawconfiguration/objectKey/catálogo/rewards/shortcuts. `blockAmount` conserva string|null; fechas ISO, rule textual y verdict existentes se proyectan sin interpretar prosa ni seleccionar/canjear.

## Evidencia compatible reutilizada

Autor sobre `86bd56fd`: `/private/tmp/cp2c-86bd56fd-neon.log`, wrapper CI `tools/neon-test.sh`, DB real: **4/4 PASS, 0 skips, EXIT0**, 39.95s. Se revisó el test correspondiente: first/repeat scan, saldos/efectos/proyección, spies de funciones reales para ausencia de catálogo/shortcuts/rewards, carrera auténtica con23505, negativos local/token/programa/tenant, closing y estados de cupón. `used_today` se prepara con venta real antes de medir ausencia de efectos del scan.

El afterAll ejecutado aserta ausencia de negocios, consumers, programMemberships, owners/users y sesiones; usa IDs propios y helpers de teardown. No se atribuyen a esta corrida assertions adicionales de business membership/proyección del commit posterior `cfa29424`, que no se ejecutaron contra DB y fueron revertidas por `114e8d6a`; el producto final restaura exactamente86bd. No se crearon integrantes staff/sesiones en esta suite.

Manifest `/private/tmp/cp2c-resolve-evidence-20261018.txt`: lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`, root Vitest `a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea`, merchant Vitest `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`; coinciden en candidato QA. Reutilizados tipos3/lint/formato/UIguard/puro de870 y tipos3/lint/formato86, cuya única diferencia era fixture used_today. Fallos iniciales de project Vitest y null type fixture se conservan en manifest, excluidos del PASS.

## Reproducción QA

Node24.20.0/pnpm11.4.0, candidato `995a8704`:

- `pnpm exec vitest run apps/merchant/src/modules/pos/server/measured-resolve.test.ts`: **1/1 PASS, 0 skips, EXIT0**, 144ms. Log `/private/tmp/cp2c-qa-995a8704-pure.log`.
- `pnpm --filter @mi-pasaporte/db --filter @mi-pasaporte/domain --filter @mi-pasaporte/merchant typecheck`: **PASS, EXIT0** (db/domain/merchant). Log `/private/tmp/cp2c-qa-995a8704-types3.log`.

QA no abrió env ni operó wrapper/DB. No fullverify ni browser/build por ceremonia. Esta entrega no conecta rutas: guard/scope/header/no-store/autorización HTTP requieren ensamblado y pruebas HTTP posteriores; no se certifican por tests directos. Barreras masa/corte Counter/PWA/canje directo permanecen fuera del alcance.

La comprobación final de identidad/diff se realizó después de terminar ambos checks, sin actualizaciones concurrentes. QA no dejó procesos propios pendientes. Este PASS corresponde al contexto/adapter; la ficha de ensamblado HTTP adjunta sigue siendo trabajo posterior.
