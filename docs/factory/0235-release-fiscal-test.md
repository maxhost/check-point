# 0235 — contratos de prueba de Marca y Fiscal

Tarea/rama `negocio-release-fiscal-test`; worktree `/private/tmp/checkpass-negocio-followups/negocio-release-fiscal-test`; base `3fbcd8a6ad969dbde01087cacd734193abfb3d11`. Código de tests inicial `573fd7c5`; ampliación de permisos `afc6b89d`; expectativa de tour actualizada en `74cf1bc3` (candidato congelado). Contrato del coordinador: `docs/factory/0235-release-fixes-contract.md` (leído del checkout principal), spec0235 y ADR0150. Solo tests y este handoff, sin runtime, guardias, kit, migración, índices ni estados. Sin push ni PROD; presupuesto0 mutaciones.

El pre-push real `/private/tmp/checkpass-negocio-release/prepush.log` mostró1 fallo fiscal-inert,4/6 de Marca,1/11 de slug y5/13 de permisos Brand/Loyalty. Causa contrastada: los fixtures aún mandaban timezone/currency/fiscal al writer Brand, que correctamente los rechaza tras0235. No se cambió el writer ni se permitió el payload antiguo para evitar el rojo.

- Fiscal-inert escribe flags por los servicios core reales `readConfiguration`/`saveConfiguration`, con revisión y comprobación explícita del resultado guardado. Mantiene todos los asserts previos: catálogo, total9.00 y segundo cobro comparable, lista/costos Stock exactos y DTO consumidor sin campos fiscales.
- Marca mantiene seis casos. Payload base solo nombre/logo/colores/revisión; revisión1→2→3 y rechazo409 con igualdad del estado persistido, ghost403, BrandError por datos inválidos y ausencia de escritura. Los roundtrips Regional/Fiscal usan Negocio real: BRL, tasa canónica15.20, retención al apagar, cero versus null, rechazo422 y revisión obsoleta409 sin cambios. Brand rechaza currencyCode, conserva Regional/Fiscal al guardar branding y no modifica la revisión de Negocio. Segundo comercio permanece idéntico para aislamiento.
- Helper nuevo `server/brand-integration-support.ts` solo monta/limpia los dos comercios propios y compone el DTO de branding. No tiene asserts ni dobles de finanzas.
- Slug: único cambio es quitar timezone del DTO Brand inline. Timezone del INSERT del comercio permanece; no cambian sus once oráculos SQL, conflictos ni negativos de acceso.

- Permisos Brand/Loyalty: los ocho casos iniciales se conservan literalmente salvo timezone del DTOBrand y el import nuevo; comparación de texto contra base dio igualdad. Los cinco de Fiscal usan ahora `/api/business` con sesiones reales y permiso business. Conservan bodyid falsificado/aislamiento y SQL exacto, valores17.25, malformed JSON400, tipos estrictos422, revisión sin cambios y carrera200/409 con snapshot completo0/null. Se añade ausencia de backfill: staffbrand conserva permissions[brand], no lee/escribe Fiscal ni Regional y Marca no los expone ni acepta; guardar branding deja Fiscal intacto. Loyalty y el control de acceso de logo-upload no se modifican.

- Browser `brand-progress.spec.ts`: solo se retira la expectativa del paso Regional ya mudado a Negocio; permanecen cuatro títulos de branding, nombre/logo, cero escrituras/uploads y progreso completed. Los otros dos casos de progreso tardío200/503, error y borrador permanecen íntegros. Ejecución focal con3casos/retries0, puertos3100–3102 propios, orígenes127.0.0.1 y configuración local descartable, sin secretos heredados ni DBNeon.

## Evidencia

Node24.20.0. Logs originales sanitizados en `/private/tmp/checkpass-negocio-release/fiscal-test-logs/`; cada comando guarda hora, ref y EXIT_CODE. Nada de valores de variables. Las dos tandas DB se ejecutaron solo después de que el coordinador transfirió explícitamente db:modules-ci tras el teardown del otro worker, configuración seleccionada `/private/tmp/checkpass-recipes-margin/0234-ci.env`.

| Check | Resultado | Log |
| --- | --- | --- |
| Prettier de los cuatro TS | EXIT0 | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/01-format.log` |
| ESLint de los cuatro TS | EXIT0 | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/02-eslint.log` |
| Merchant typecheck | EXIT0 | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/03-typecheck.log` |
| Formato/lint/tipos de ampliación permisos | Todos EXIT0 | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/04-permissions-format.log`, `05-permissions-lint.log`, `06-permissions-types.log` |
| Browser global config, primer intento | EXIT1: timeout120s/Watchpack EMFILE;0casos ejecutados | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/07-browser-brand-progress.log` |
| Browser componente, sandbox | EXIT1: Chromium MachPort IPC denegado;3lanzamientos fallidos sin asercionesUI | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/08-browser-component.log` |
| Browser componente, escalado técnicamente | 3/3 PASS, EXIT0,2.2s; retries0, sin Next global | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/10-browser-component-escalated.log` |
| Neon Fiscal1 + Marca6 | 7/7 PASS, EXIT0,36.45s, sin skips y teardown completo | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/09-neon-fiscal-brand.log` |
| Neon permisos13 + slug11 completos | 24/24 PASS, EXIT0,55.08s, sin skips y teardown completo | `/private/tmp/checkpass-negocio-release/fiscal-test-logs/11-neon-permissions-slug.log` |

Las comprobaciones estáticas se ejecutaron antes de cada commit sobre las fuentes que quedaron en573fd7c5/afc6b89d, sin cambios posteriores de código. DB y browser definitivos corresponden al mismo SHA74cf1bc3, sin cambio de fuentes durante comprobaciones. Total31/31Neon y3/3browser de componente PASS. No se ejecutaron suites globales ni se atribuye verde al pre-push completo. DB solo `tools/neon-test.sh`, configuración CI seleccionada y `--no-file-parallelism`, incluyendo teardown bajo la reserva. Publicación y resultado del hook real corresponden al coordinador.

Los intentos browser quedan separados. El primer fallo fue del arranque de Next/Watchpack, antes de ejecutar tests. Se comprobó en el fixture que el archivo navega exclusivamente al harness de componente, por lo que el coordinador autorizó una configuración operativa temporal externa que importa la versionada y omite solo sus webServerNext; mantiene mismo archivo, tres casos, workers1 y retries0. El segundo fallo fue del sandbox macOS al lanzar Chromium (MachPortRendezvousServer Permission denied/SIGTRAP), no de una aserción ni una resolución DNS de red. Tras avisar al coordinador y resolver esa restricción técnica con require_escalated, el mismo componente/harness real pasó3/3. No hubo cambios de fuente entre intentos ni retry automático, no se demostró polling y no se atribuye smokeapp a la prueba de componente. Config externa: `/private/tmp/checkpass-negocio-release/fiscal-test-logs/brand-progress.playwright.config.ts`; logos/APIs interceptados como en el fixture original. Entorno de prueba con DB/orígenes127.0.0.1, proveedores/secretos descartables y sin heredar credenciales sensibles. Puertos3100–3102 comprobados libres antes/después; landing/harness cerrado al finalizar; tres next-env.d.ts restaurados exactamente al contenido versionado.

Comandos DB definitivos (Node24 antes de ambos, sin filtros ni retries):

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/modules/brand-fiscal-inert.neon.integration.test.ts src/server/brand.neon.integration.test.ts --no-file-parallelism
NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/server/permisos-brand-loyalty.neon.integration.test.ts src/server/business-slug.neon.integration.test.ts --no-file-parallelism
pnpm exec playwright test tests/e2e/brand-progress.spec.ts --config /private/tmp/checkpass-negocio-release/fiscal-test-logs/brand-progress.playwright.config.ts --workers=1 --retries=0 --reporter=line
```

Al2026-10-17 02:58:30UTC: dos wrappersEXIT0/afterAll completos, navegador/landing y tres Next cerrados, puertos3100–3102 libres y next-env versionados. Coordinador notificado para liberar recursos. No quedan procesos propios ni falta repetir otro check del worker. Corrección limitada a contratos obsoletos; cualquier push sigue sujeto al hook original y autorizaciones del owner.
