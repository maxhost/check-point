# 0242 CP2c.2 — contexto mínimo de escaneo

Base `f02b6a23ab146c8a0f1944e5a419dfb973fd0527`; ref/worktree `scan-context-0242`, `/private/tmp/checkpass-pos-0242/scan-context-0242`. Freeze probado `86bd56fd34eb9765a7703229cf460397a72d1e36`; revisión previa al documento `114e8d6a9052cd2e8488d139b2a8651732ec5c9b`, con diff de árbol vacío respecto del freeze probado. Entrega final: commit que incorpora este handoff; SHA comunicado al coordinador.

`server/counter/resolve-context.ts` concentra el mismo programa acreditable, identidad, membresía/autoenrolamiento con proyección, reread23505 y actualización única de last_scan. `resolve.ts` reutiliza ese contexto y conserva su enriquecimiento legacy, shape y orden; reexporta accreditableProgram. Barrel `counter.ts` exporta el helper genérico. Core no importa ni nombra módulos.

`modules/pos/server/measured-resolve.ts` ofrece `resolveMeasuredScan(business, qrToken, selectedLocationId?) : Promise<PosResolveV2>`; construye allowlist explícita y conserva blockAmount string|null sin conversión monetaria. Cupón reutiliza la lectura/veredicto actuales, mantiene rule textual y serializa validUntil ISO. No resuelve catálogo, rewards ni shortcuts y no ejecuta resolveScan completo. No cambia selección/canje, compras, pagos, ledger, visitas ni otros beneficios. La ruta V2 queda pendiente de ensamblado separado, al liberar routes.ts del writer PUT; no se tocó HTTP, esquema, UI ni activación de masa.

## Evidencia focal

Node24.20.0, pnpm11.4.0, Vitest4.0.18. Lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; configuración Vitest versionada sin cambios. Manifest completo fuera del worktree: `/private/tmp/cp2c-resolve-evidence-20261018.txt`.

- Tipos de db/domain/merchant, ESLint y formato focales: EXIT0 sobre freeze86bd. Logs `/private/tmp/cp2c-86bd56fd-{types3,lint,format}.log`.
- Prueba pura: EXIT0, 1/1 PASS, 0 skips sobre870b54b6; su fuente y adapter no cambiaron después. Allowlist ante propiedades privadas adicionales, dinero mayor que precisión JS, regla, veredictos/estados y error previo a lectura de cupón. Log `/private/tmp/cp2c-870b54b6-pure.log`.
- UIguard: EXIT0 sin aumentos; fuentes aplicables idénticas al freeze. Log `/private/tmp/cp2c-870b54b6-uiguard.log`.
- CI exclusiva transferida por coordinador tras teardown de update. Única corrida DB: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh --app merchant src/modules/pos/server/measured-resolve.neon.integration.test.ts --no-file-parallelism`. EXIT0 sobre86bd: **4/4 PASS, 0 skips, 39.95s**. Migración idempotente del wrapper satisfactoria. Log completo `/private/tmp/cp2c-86bd56fd-neon.log`.
- Casos reales: alta inicial y repetición sin duplicar membresía/saldo/efectos de compra/last_visit; proyección y last_scan; carrera que observa23505 real; programas active/closing e inválido; token/local ajeno/desconocido/archivado; aislamiento de tenant; cupón none/hint/selected válido/selección expirada/used_today, identidad y rule conservadas. Spies sobre funciones reales confirman cero llamadas mínimas a businessCatalog/purchaseShortcuts/loadProgramRewards. Legacy conserva catálogo/rewards y amount numérico histórico. Used_today se prepara mediante venta real existente; solo la lectura posterior se compara contra sus efectos ya establecidos.

AfterAll borra IDs propios y verifica ausencia de negocios, consumers, program_memberships, owners y sesiones. No se crearon staff ni sesiones auth. Proyecciones y business_memberships se eliminan por FK cascade. No limpieza por prefijo. Reserva CI retenida hasta completar ese teardown. Comprobación final de CWD bajo todo el worktree: **0 procesos** (`/private/tmp/cp2c-final-processes-20261018.log`). No servidores propios.

## Límites y fallos conservados

Sin afirmaciones de auth/scope/header/no-store HTTP, browser/build/fullverify/M0/M1/cierre E2E o activación de masa. El env seleccionado no trae NEON_CI_CONSUMER_DATABASE_URL: aviso conservado; esta suite directa no ejecuta el oráculo de rol. No PROD, push, túnel, puerto3201 ni artefactos ajenos.

Primer Vitest falló setup por filtro de proyecto inexistente y primer typecheck detectó tipo nullable en el test; corregidos antes del freeze, con logs originales conservados fueraWT. Después de4PASS se añadió innecesariamente logging y dos asserts de teardown en `cfa29424`; su typecheck falló porque business_membership no tiene id y **no se ejecutó DB**. Revert local propio `114e8d6a` restaura exactamente árbol86bd; no se repitió DB ni se reutiliza ese intento como PASS. Logs del intento: `/private/tmp/cp2c-cleanup-{lint,types}.log`.

Siguiente paso: coordinador registra entrega/devuelve reserva CI; QA nuevo independiente sobre candidato congelado. Autor conserva fixes. Sin operación factory ni edición de estados/índices por el worker.
