# 0242 CP2c.5 — QA independiente de acreditación medida

Resultado: **PASS del servicio interno y su combinación congelada**, sin hallazgos bloqueantes. No certifica cierre E2E ni una corrida Neon integral de 19 casos verdes.

Identidad: candidato `7d6f01868754c7bfd1a97fdfa4f9ac902c4dc15a`, combinación de dev `21334872` y autor `6ff74300044840cc1d961a438960fe42e22b2848`; base del autor `c0abf18f1ece78facb99095d6dce8e102b88cc30`. Worktree QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`. Node24.20.0, pnpm11.4.0, hooks `.githooks`; lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Única escritura versionada QA: este informe. No producto, tests del repositorio, factory, estados ni refs principales modificados.

## Revisión del contrato y código

- Firma interna con `DbTransaction` y snapshots autorizados; el caller conserva lock/versión POS, validación/persistencia de pagos, recursos, comisión, evento y commit. Reutiliza `accrualContext`; no autoriza desde HTTP ni autoenrola.
- Reutiliza locks campaign→campaign_coupon→business_customer. Lookup de request bajo esos locks y antes de selección/veredicto/decisión; clave existente produce409 `request_reused`. No reconstruye settlement desde core ni captura indiscriminadamente23505. El replay cerrado pertenece al futuro caller y su snapshot POS. Se exige pushQueueId nuevo antes de extras/redención.
- Metadata del cupón bloqueado alimenta la decisión existente; producto propio prevalece sobre elección del operador. Target explícito debe corresponder a fuente/producto. Gratis/2x1 mass rechaza409 antes de core/extras/redención/clear; selección implícita conserva líneas unit elegibles en mezcla. Porcentaje/fijo admiten masa; origen campaign_coupon y target de línea se conservan. Sin cupón/exclusión local no ejecuta clearSelection.
- Settlement procede del núcleo financiero exacto y pagos del caller. Acumulación usa collected neto; el writer recibe snapshots originales y gross por posición, con settlement exacto. Core writer→extras→store de redención→clearSelection usan el mismo tx; redención guarda discount/collected/currency normalizados. No parsea rule, no cambia elegibilidad ni grant legacy, no añade ledger ni compras duplicadas.
- Variante nueva usa bigint para cociente y multiplicación, acepta entero normalizado minor0 y dos decimales, valida grant positivo/int32 y resultado int32 antes de Number. Block mantiene formato numeric(12,2). `computeAccrual(number)` y sus callers permanecen intactos, incluido su resultado histórico para0.30/0.10.

## Evidencia reproducida en la combinación

Logs y test externo independiente en `/private/tmp/checkpass-pos-0242/evidence-measured-accredit-qa/`:

| Comando | Resultado |
| --- | --- |
| `pnpm --dir apps/merchant exec vitest run src/modules/pos/server/measured-accredit.test.ts src/modules/pos/measured-benefit.test.ts` | exit0;50PASS,0skip |
| `pnpm --filter @mi-pasaporte/domain typecheck` | exit0 |
| `pnpm --filter @mi-pasaporte/merchant typecheck` | exit0 |
| `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/evidence-measured-accredit-qa/vitest.config.mjs` | exit0;1PASS,0skip |

La señal independiente construye settlement unit JPY/COP con collected `8` y USD con `8.00`: los tres acumulan80 con block0.10 y9 con grant3/block2.50. Comprueba0.30÷0.10=3 mientras legacy=2; net0 per_amount=0 y per_purchase=7 tanto `0` como `0.00`; frontera2147483647 válida, siguiente unidad y grant fuera de rango rechazados; block/total9999999999.99 válidos y block10000000000.00 rechazado. Primer intento externo falló por fixture QA con conversionVersion=null; corregido usando UNIT_MEASURE. Log original `independent-fixture-failure.log` preservado, clasificado setup, sin cambio de producto.

## Evidencia compatible reutilizada

Inspeccionados manifiesto y logs del autor en `/private/tmp/checkpass-pos-0242/evidence-measured-accredit/`. Hashes finales de servicio `347c426813fbcaa3f05ca25708245d00380eea4f39b4bb7feef9dc3f75b16323` y helper `470092c1bde1e2035c14b2af20b1af1afe8be6f972cbe3b6be06d982ee0851b5` coinciden con QA. Sin diff desde base autor en primitivas locks/verdict/orders/benefit/financial/measures revisadas; combinación solo añade los seis paths del encargo respecto a dev.

Neon exclusivamente wrapper y configuración seleccionada del autor: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env bash tools/neon-test.sh src/modules/pos/server/measured-accredit.neon.integration.test.ts --no-file-parallelism`, rama CI aislada, reserva exclusiva mantenida durante teardown. QA no recibió DB/env/wrapper ni abrió una nueva corrida DB.

- Primera corrida:13PASS/6FAIL/0skip; fixtures discount/custom/extras infringían `core_campaign_coupon_reward_product_kind_check`. No son seis defectos del servicio ni una corrida verde.
- Segunda:18PASS/1FAIL/0skip; fallo antes del servicio por fixture fijo sin currency, constraint `core_campaign_coupon_reward_currency_check`.
- Primer focal repitió fallo porque sustitución textual no aplicada. Focal corregido con USD:1PASS/18 filtrados, exit0. Los filtrados no cuentan como ejecutados. Se reutilizan18 casos reales anteriores y1 focal corregido; **no19PASS integral**.
- Los18 casos cubren porcentaje, gratis,2x1,custom,extras,net0; exclusión local; no seleccionado/expirado/ajeno/target/insuficiente/mass; cap vigente, rollback posterior a acreditar y carrera del mismo cupón/key con único efecto. El focal aporta fijo. La fixture corregida guarda currency USD compatible con negocio USD. Servicio idéntico entre corridas; helper posterior agrega rama de entero y conserva rama USD de dos decimales, comprobada además por puros finales reproducidos. Esta compatibilidad permite reutilizar evidencia sin equiparar skips con PASS.
- Tipos db/domain/merchant del autor, lint/formato/UIguard exit0 reutilizados. Guardias14PASS/2FAIL de backlog sin offenders nuevos: expenses→stock y literales previos backoffice/context/onboarding/analytics. No se afirma guardia global verde ni se modificaron tests/guardias para ocultarlo.

Teardown de corridas reutilizadas terminó sin fallo; aserciones verifican ausencia de negocios, membresías owner, owners, sesiones merchant owner, consumidores, membresías y pushes propios. Fixtures no crearon staff/sesiones adicionales. Wrapper avisa ausencia de `NEON_CI_CONSUMER_DATABASE_URL`: **rol consumer no certificado**. Ningún secreto/env productivo leído ni copiado por QA.

## Límites y entrega

Mass positiva solo decisión/algebra pura; mass negativa sintética antes de storage. No certifica orden mass canónica ni HTTP/cierre/pagos reales. Sin browser/build/fullverify/M0/M1/PROD/push ni migraciones productivas. Sin ampliación de batería por ceremonia. Autor conserva fixes; aceptación/integración/cleanup corresponden al coordinador.

Todos los checks QA terminados,0sesiones de herramientas pendientes. Inspección CWD con `lsof -a -d cwd +D /private/tmp/checkpass-pos-0242/pos-qa-0242 -Fn` desde `/private/tmp`: sin coincidencias, exit1, sin stderr;0procesos propios retenidos. Informe se entrega en commit propio; comprobación final de checkout y whitespace se comunica con su SHA.
