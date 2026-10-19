# 0242 CP2d.3b — conservar creación incierta

Autor NUEVO B, base `e72b9d2d1a7807bcd8b20cfde948cec306d3eeb6`, worktree `/private/tmp/checkpass-pos-0242/create-uncertain-recovery-0242`. Revisión entregada: commit que contiene este handoff; SHA exacto en `identity-final.log` dentro de la evidencia externa indicada abajo. Solo tres paths reservados: helper, pruebas del helper y este handoff. Factory/integración corresponden al coordinador; QA NUEVO independiente pendiente, autor conserva fixes.

## Cambio y contrato

Propuesta mínima aprobada por coordinador antes de código: flag privado `attempt.uncertainCreate`, sin ampliar API pública. POST ambiguo marca el intento antes de publicar `uncertain`. Un rechazo posterior de recuperación403/422/409 conserva estado incierto, intención/captura/UUID/body congelados y error completo `PosError.payload`. `create/update` siguen bloqueados y `retry` explícito utiliza la misma captura; no genera otra clave ni infiere ausencia del recurso.

Solo un DTO canónico utilizable limpia ese flag, antes de entrar a la facade. Si esta devuelve `cache_revision_ahead`, el estado sigue `conflict` y conserva `receivedOrder/summary`; recurso conocido requiere revisión, sin presentar éxito ni orden autoritativa falsa. Primer4xx sin ambigüedad mantiene rejected/conflict. PUT incierto→409version_conflict mantiene orden actual para revisión y permite una intención deliberada posterior.401/context_changed/cambio real de identidad/epoch/retire mantienen retiro. Sin GET, endpoint, retry automático, nueva caché o persistencia fuera documento.

## Evidencia y límites

Logs propios fuera WT: `/private/tmp/checkpass-pos-0242/create-uncertain-recovery-evidence/`. Node24.20.0, pnpm11.4.0, hooks `.githooks`; hashes de lockfile/config en `config.log`, identidad/comandos/exits en `identity-final.log`. Transporte real createPosClient→posRequest→panelRequest→fetch mocked: prueba de estado/captura, sin certificar auth nativa, DB ni commit/idempotencia reales del servidor.

- Focal `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-order-commands.test.ts apps/merchant/src/modules/pos/ui/measured-order-cache.test.ts`: EXIT0,56/56 tests,2 archivos,0 skips; conserva46 aceptadas. Antes del fix, las nuevas regresiones dieron6FAIL/50PASS, EXIT1 (`regressions-before.log`).
- Merchant `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0. La primera corrida detectó orderLabel opcional en un nuevo fixture PUT; corregido a string requerido, sin cambiar producto ni aserciones (`types-fixture-failure.log`, EXIT2).
- ESLint de helper y su test: EXIT0. Prettier de los tres paths: EXIT0.
- `node tools/ui-guard.ts --base e72b9d2d1a7807bcd8b20cfde948cec306d3eeb6`: EXIT0,1 fuente productiva sin aumentos; advertencia MODULE_TYPELESS_PACKAGE_JSON existente.

Casos nuevos: POST perdido→retry403/422/409 conserva intención/error y bloquea nueva UUID; posterior DTO closed resuelve el mismo recurso; input/scopeKey mutados no cambian body/headers capturados; primer403/422/409 permite nueva intención; retiro tras rechazo de recuperación por identidad/401/context_changed; DTO válido tras pérdida conserva cache_revision_ahead y libera ambigüedad; PUT perdido→version_conflict permite actualización revisada sin inferir éxito.

Sin DB/env/wrapper/browser/build/fullverify/M0/M1/servidor/túnel/3201/push/PROD. No se tocaron artefactos externos ajenos. Fallos de lectura inicial por glob zsh/ruta .ts donde existe .tsx no fueron fallos de producto. `ps` inicial fue EPERM del sandbox: escalación acotada autorizada resolvió inspección; lsof de cwd solo mostró shell/lsof transitorios de la propia comprobación, sin procesos persistentes iniciados. Lsof devolvió1 y su listado queda preservado, no se atribuye EXIT0. No quedan sesiones de comprobación activas al entregar.
