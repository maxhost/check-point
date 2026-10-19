# 0242 CP2d.3b — QA independiente: PASS

Candidato congelado `da0726a976d8fc783f10038506fd595c269f9ac9`, autor `8fa28a66db233f93c4eec53218303c5ae51d25b4`, integración previa `bed0df4c`, base del fix `e72b9d2d1a7807bcd8b20cfde948cec306d3eeb6`. Worktree QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`. QA nuevo, sin implementación ni subdelegación. Único cambio QA: este informe.

## Evidencia propia

Directorio externo `/private/tmp/checkpass-pos-0242/create-uncertain-recovery-qa-evidence/`: identity.log, config.log, runtime.log, pnpm.log, reproduce.log y focal.log. Node24.20.0, pnpm11.4.0, hooks `.githooks`. Identidad confirmada antes de pruebas; hashes de lockfile, ambas configuraciones Vitest y tsconfig merchant coinciden con evidencia final del autor.

- Script ajeno ejecutado sin modificarlo desde el WT QA: `node /private/tmp/checkpass-pos-0242/uncertain-retry-evidence/reproduce.cjs`, EXIT0. Observado: afterLost=uncertain, afterForbidden=uncertain, generated=1, sentKeys=[synthetic-key-1,synthetic-key-1]. Otra llamada create no envía ni genera UUID2. El fallo inicial TSX preservado por coordinador es setup y queda excluido de la señal de producto.
- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-order-commands.test.ts apps/merchant/src/modules/pos/ui/measured-order-cache.test.ts`: EXIT0, 56/56, dos archivos, cero skips/retries. Transporte real hasta fetch mocked; conserva las 46 regresiones previas.
- Revisión independiente del diff y helper/cache: flag privado por intento POST; recuperación403/422/409 conserva ambigüedad, error completo y captura/body/UUID. Primer4xx definitivo permite intención posterior; PUT incierto→version_conflict conserva revisión. DTO utilizable limpia flag antes de facade; cache_revision_ahead conserva receivedOrder/summary y estado conflict. Identidad/epoch/401/context_changed retiran como antes. API pública intacta; no GET, autoretry ni persistencia nuevos.

## Gates reutilizados y límites

Diff vacío autor→candidato para helper/tests, cache/tests, lockfile y las tres configuraciones anteriores. Revisados identity-final.log, types.log, lint.log, format.log y guard.log del autor en `/private/tmp/checkpass-pos-0242/create-uncertain-recovery-evidence/`: merchant typecheck, ESLint, formato de sus tres paths y UIguard EXIT0 compatibles con este candidato. UIguard: una fuente productiva sin aumentos; advertencia MODULE_TYPELESS_PACKAGE_JSON existente. Fallo inicial de tipos por fixture corregido no cuenta como PASS; solo resultado final se reutiliza. No se amplía batería tras PASS focal.

La prueba aísla contexto/transporte: no certifica auth nativa, DB, commit real ni idempotencia del servidor. Sin DB/env/wrapper/browser/build/fullverify/M0/M1/servidores/túnel/3201/push/PROD ni cambios de artefactos ajenos o de otro WT.

Inspección ps inicial: EPERM sandbox, avisado inmediatamente al coordinador. Escalación acotada propia EXIT0 mostró solo shell/rg transitorios de esa inspección; ninguna sesión de checks ni proceso persistente propio. No checks pendientes. El commit QA solo empaqueta este informe y no cambia la identidad del producto probado.
