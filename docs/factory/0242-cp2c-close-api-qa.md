# 0242 CP2c.7 — QA independiente del ensamblado HTTP close

Dictamen: **PASS para HTTP close V2 unit**, candidato congelado `6b9f19f2d588c12c440d739b20820ac8953717c0`, base integrada `aae9a860`, entrega autor `31f47658aa6df3b18ee75e9f1bdc2c869c25304c`, implementación `58118dd0`, base autor `8cb6439f`. QA NUEVO independiente sobre worktree asignado; solo este informe es editable. No certifica POS0242 completo, masa, void, UI ni autenticación nativa Next.

## Revisión de aceptación

- Diff de la entrega contra main integrado: exactamente tres paths autorizados. Producción cambia únicamente import y handler close de routes.ts. El handler sigue en posRoute, con scope optional y dispatcher vigente; guard completo y scope preceden negociación y dominio. No cambios en core/guards/escritores/readers/DB ni otra ruta.
- posReadContract selecciona ausente/1 legacy y2 cierre medido. Desconocido arroja409 pos_client_upgrade_required antes de ID, lectura del cuerpo o llamada al escritor. Header2 no pasa por legacy. El DTO del escritor sale directo mediante NextResponse.json, sin conversión de cantidades, tarifas, pagos, originales o cupón.
- posRoute conserva traducción CounterError/PosError y extras; dispatcher aplica private,no-store también a denegaciones y fallos. La suite real comprueba orden de rechazos, ausencia de parseo y llamadas a ambos cierres, scope inválido y módulo apagado con restauración finally.
- CI final inspeccionada: DTO2 igual al reader canónico, strings y originalAmount racional completos; replay idéntico incluidos closedAt/lineId y estado DB, una acreditación/eventoV4/pago, sin afterGrant/scheduling extra. Ausente/1 conservan DTOlegacy y no invocan medido. Tenant ajeno obtiene404 sin orden;409 version_conflict conserva exactamente ordenV2 y422 conserva settlement financiero completo, sin efectos.

## Evidencia e integración

Evidencia del autor en `/private/tmp/checkpass-pos-0242/close-api-evidence/`. QA verificó SHA256 de round2-source.sha256 y config.sha256 contra este candidato: dos fuentes, lockfile, Vitest config/setup, tsconfig y journal idénticos. No cambia ninguna fuente servidor/configuración por la integración del editor; el delta de autor a candidato solo añade UI, sus pruebas y documentación. Suite final también idéntica al blob de implementación58118dd0.

- neon-round2.log: **EXIT0,4 PASS/0 skips**, teardown sin errores. Se reutiliza esta corrida final completa. Round1 también registra4PASS/0skips y conserva hashes; QA reconstruyó en memoria el único cambio posterior del oráculo (discount:null) y obtuvo `aa887b7c5b0ddca8902ddeaa33c073bfbdf20a18605237cf9a63eac4e38bf615`, igual a source.sha256. No se mezcla un PASS con fuente mutable.
- Harness explícito de requireModuleAccess; comprobación real de módulo, dispatcher/scope/handlers/dominio/DB reales. Mock de afterGrant/after mide efectos posteriores. No se atribuye autenticación nativa Next a este harness. Teardown revisado: borra negocios, consumidores y owners propios y comprueba memberships, sesiones, clientes y colas; setup también limpia en catch. Logs no muestran fallo de teardown; processes-final.log autor registra0procesos propios.
- QA comprobó identidad de cinco fuentes del cierre interno aceptado mediante measured-close-evidence/round3-source.sha256 y configuración completa mediante config.sha256. Reutiliza matriz dinero/stock/Recipes/comisión y ensamblado unit de `0242-cp2c-measured-close-qa.md`, sin repetir DB.
- QA reprodujo en Node24.20.0 el 2026-10-18: `pnpm --filter @mi-pasaporte/merchant typecheck`: **EXIT0**, sobre ensamblado integrado; `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/pos/server/measured-read.test.ts src/modules/dispatch.test.ts --no-file-parallelism`: **EXIT0,35 PASS/0 skips**. Incluye negociación ausente/1/2/desconocido, orden guard/scope/dominio y cache privada. Sin DB/env/wrapper en QA.
- Reutilizados tipos/lint/formato/UIguard autor con EXIT0 e identidad compatible. Boundaries autor: **EXIT1,24 PASS/2 FAIL**, backlog Expenses immediate→Stock count y literales core en backoffice context/refresh, onboarding y analytics policy-simulation/lifecycle. Ningún path ofensor cambia; cero offenders nuevos. No se declara guardia global verde.

## Límites y cierre

Sin URL consumer opcional: ese rol no está certificado. La entrega conecta opt-in unit; no activa masa, voidV2, retirada/cutover ni POS completo. No browser/build/fullverify/M0/M1, servidores, push ni PROD. QA terminó checks,0 activos; scanner lsof comprobó0procesos con CWD en su worktree excluyendo únicamente el propio scanner. Sin cambios de producto/tests, factory, refs principales o estados. Autor conserva fixes; aceptación/integración/retirada corresponde al coordinador.
