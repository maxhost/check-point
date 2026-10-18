# 0242 — M0 real de guardar, QR y cierre

**Entrega de flujos completada por autor; QA final/aceptación del coordinador pendientes.**18/18flujos de campaña y3/3smokes independientes válidos; inspección durable protegida PASS. Un smoke temprano y una inspección con fallo de oráculo permanecen conservados y separados. CP0 global y CP1 dependen del coordinador; no rediseño ni cambios de producto.

## Identidad, scope y recursos

Base transferida `c379c9a87de64aba1e264f2e1a5b1b21e1f99daa`, WT `/private/tmp/checkpass-pos-0242/pos-ui-0242`, rama/reserva pos-ui-0242. Cambios solo en suite/helperPOSmeasurement, herramientas de flow/freeze/análisis y este handoff. Sin UI/negocio/dispatcher/close/preload/kit/guard/esquema/deps. WIP32df8dd se inspeccionó y recuperó por sus tres paths; nunca se ejecutó a ciegas.

- SetupSource `7c4a7d5d2f99f5c545c24199b29846ec7ac0295c` antes de mutar; manifest con21identidades preasignadas y fuente de setup.
- Smoke02 source `5c81dadebd4fac5cc03fd7637a3f5c589f6ec269`; campaña e inspección final source `29b716cb2682a01ab8970c9a9af4ee19f03769a1`. Delta29b solo corrige representación SQL del inspector; runner idéntico a5c. Código instrumental limpio y congelado antes de cada corrida. Commit posterior solo incorpora análisis/evidencia/documentación, sin atribuirle la campaña.
- BuildSource real `6f8e1e9cecdd33930c5f055db43641d805dbe3c2`, BUILD_ID `VLV2fFFeM_dUWKnxvv7iY`; controlarchiveSHA256 `54cbc567143f7d3e2af43309810c14da6bea647ab50926534ecb4b78109ec5fe`. No build nuevo.
- Node24.20.0/pnpm11.4.0/Next16.3.0 build-start/Chromium153.0.8010.12, localhost43242→CI preparada/caliente; mismo proceso local persistente. Browsercontext nuevo por flujo; no DB suspendida ni hostingPROD.

Freeze valida manifest/config/lock/schema/buildID/archivo control, todos los hashes previamente congelados y diff COMPLETO apps/packages frente a buildSource. Allowlist EXACTA de3paths no compilados: suitePOSmeasurement y sus dos helpers; registra hash anterior/nuevo. `rg` de imports solo encontró suite→helpers y login→tipoManifest, cero producción; diffbuildSource→29b apps/packages contiene exactamente suite+fixturehelper. Runner/flows/preload y manifest se congelan aparte. `freeze.mjs --reuse-build --flows` exige flowmanifest/archive; list-only conserva operación anterior sin esos archivos. Freezes anteriores se archivan antes de sustituir raíz, jamás se recrean.

## Receta y resultados descriptivos

Receta revisada por QA antes del setup:3smokes owner×none/discount10/zero100 y18campaña owner/staff×tres variantes×3. Consumidor/membresía/cupón/UUID/etiqueta independientes, manifest escrito antes de DBwrites. UI/API v1 genera el IDorden; respuesta canónica se persiste en RAW antes de QR/cierre y se contrasta luego por SQL. Ocho líneas unit×2USD, bruto16; netos16/14,40/0 y puntos16/14/0. Sin peso disponible en control.

Cámara determinista sustituye captura/decodificación física con token legítimo del dominio; auth/API/DB/negocio reales, sin rutas Playwright ni mocksHTTP. Programa/fixtures se crearon después del listado terminado. Sin resets: historial/ledger crecen con3smokes previos y18campaña; conservados hasta cleanup propio. No A/B, mejora causal, SLA ni confianza p95.

| Rol | Cupón | n | Guardar ms | QR ms | Preparar ms | Cierre confirmado ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| owner | ninguno |3|1892,3|2362,5|1864,3|3408,0|
| owner |10%|3|1897,6|2371,2|1890,3|4479,3|
| owner |100%/neto0|3|1889,0|2382,7|1389,2|4494,0|
| staff |ninguno|3|1905,5|2398,0|1874,5|3442,8|
| staff |10%|3|1905,8|2384,5|1892,5|4504,0|
| staff |100%/neto0|3|1900,1|2398,3|1381,7|4468,3|

Son medianas de3, sin suma de medianas para fabricar trayectos. Guardar termina tras Cobrar autorizado+etiqueta+total16 visibles; QR tras cliente identificado y scanner cerrado; preparar tras Confirmar habilitado+importe neto exacto visible; closeConfirmed tras Venta cerrada visible y DTO canónico cerrado con mismoID/neto. Un close por flujo; UUID/membresía/cupón y hash del cuerpo observados, paymentsArray obligatorio. Los6neto0 de campaña envían payments=[] y no piden GETmedios;12casosconneto sí piden medios.

Campaña: **2856sql-start/2856sql-end,0erroresSQL,0erroresJS y0solicitudes externas del navegador**.18GETsesión,36GETlistado iniciados (18entrada+18refresco posterior),18GETcatálogo,18POSTcreate,18POSTresolve,18GETcoupon-state,12GETmedios y18POSTclose, además de ticket/checklist/prefetch habitual. Waterfalls/bytesencoded-decoded/navigation/longtasks de recursos observados quedan en RAW; esto no mide egress del servidor. Hay669request-start y651request-end: los18sinfinish son GETlistado posteriores alclose, con144SQL completados/0errores y18guardend. El contexto se cierra tras closeConfirmed+observadoresJSON sin esperar ese refresco; causa de cancelación no instrumentada, por lo que no afirmamos18cancelados ni0pendientes. Las18respuestasclose sí finalizan200. Limitación de completitud de ese trabajo en segundo plano, declarada sin ocultarla dentro de medianasUI.

Hay108COMMIT:18delcontexto create y90delcontexto close, que incluye transacciones posteriores al cierre. **No son108ventas.** Por cierre, el primer bracketWS BEGIN→COMMITend observado tiene medianas~2,03–3,33s; driverprimerCOMMIT~108–113ms. Requestclose, closeConfirmedUI, guard, schedule y callbackmoduleEvents son observaciones distintas. El hooktransaction no apareció: null/no observado. El bracketWS es observado, no CPU exclusiva ni toda funcióntransacción. HookafterGrant mide solo scheduling; latencia end-to-end de wallet/cross no observada, nunca0ms por ausencia.

## Efectos durables y límites de delivery

`flows-inspect-smoke 02` corregido y `flows-inspect 01` pasan1test/0skip cada uno por launcher→wrapperCI, sobre IDs del RAW y cardinalidad exacta.21órdenes cerradas propias=18campaña+3smokes;21eventossale.closed,21ledgers y exactamente1orden por membresía.14pagos=12campaña+2smokes;14redenciones=12campaña+2smokes. UUID, consumidor/membresía, neto, unidades y saldo exactos validados; neto0 sin pagos ni puntos ficticios. Ninguna otra identidad se comparte.

Snapshot final:21deliveries core.analytics applied;21recipes skipped por modules_disabled (resultado durable con módulo apagado, no tests requeridos omitidos).21outboxtransactional suppressed/intentos0;21decisionescross no_origin. No afirmar entrega física/push ni convertir esos estados en error de cobro confirmado. Pendientes/estados e instantes se guardan; no se observó duración completa de callbackswallet/cross. Límite conocido del control, no gate relajado.

## Intentos, QA previo y comprobaciones

- Preparación7c4a y delta5c81 recibieron PASSQA antes de sus ejecuciones; delta29b::text recibió PASSQA antes de campaña. QA final verifica entrega/evidencia, separado del QA de combinación.
- Setup01: wrapperCI, EXIT0,1PASS/0skip. No init/login/seed rutinarios ni copia de envPROD.
- Smoke01 source7c4a: **FAIL**,1owner/none en catálogo, completedfalse/validfalse. Nuevaorden móvil se montaba antes de terminar listado; click temprano no abrió editor y hubo timeout30s esperandoNombre de mesa. RAW conserva exactamente4GET,0POST/PUT/close/IDorden. DiagnósticoDOM read-only tras esperar filaM0/Abrir autorizado confirmó textbox+Tomarpedido con0writes. Delta5c espera esa señal antes del reloj y usa runs/salidas/tags exclusivos. Identidadsmoke no consumida se reutilizó en02, sin reset.
- Smoke02 source5c: EXIT0,3/3válidos independientes. No se repitió tras consumirlos.
- Inspecciónsmoke02 inicial: **FAIL de tipo del oráculo**, snapshot preservado antes del assert. PostgreSQLJSONB convirtió numeric14.40 a JSONnumber14.4 mientras oracle esperaba stringdecimal. Delta29b usa `o.total::text`, sin Number/redondeo ni relajar igualdad; reinspección02b read-only de mismos3IDs EXIT0,1PASS/0skip.
- Campaña01 source29b: EXIT0,18/18válidos sin retries/skips; inspeccióncampaña01 EXIT0,1PASS/0skip. Fallos previos no se cuentan como PASS.
- Typesmerchant01–06 EXIT0; eslintfocal01–07 EXIT0; node--check de flows/freeze y gitdiff--check EXIT0. Analizador nuevo ejecutado sobre evidencia real y eslint propio EXIT0. No verifyglobal, rebuild ni afirmación de CIremoto.

## Evidencia y transferencia

Artefacto saneado versionado `tools/pos-measurement/flow-baseline.json`; reproducción Node24: `node tools/pos-measurement/analyze-flows.mjs`. Incluye celdas/muestras, hashes de comandos sin cuerpos, SQL/request/commit/fases, efectos, fallos y hashes de RAW/logs/trace/manifest/freezes. No publica IDsconsumidores, tokens, cookies, PINs ni scopes. Analizador solo lee archivos; noDB ni auth.

Privados `/private/tmp/checkpass-pos-0242/private`: RAWflow-smoke-01/02 y m0-flows-01, flow-fixture.json, freeze.json29b y archivos anteriores (5c: `freeze-5c81dadebd4fac5cc03fd7637a3f5c589f6ec269-1792352018270.json`, SHA256 `25ce284aec048cfa7166e374a7b667de8df926930b9e3068ee48cf0e4ebfc5a3`), snapshotsflow-inspection, server-trace y logsflows-setup/freezes/server/smoke/campaign/inspect/types/lint/analysis. Evidencia de listado anterior intacta; list-baseline.json no se tocó.

Servidor propio PID50763 listener43242, sesiónexec7629, launcher y pnpm padres propios;43243sinlistener al iniciar. Config selected.json/ci.env y cookies anteriores intactas; DB CI y teardown siguen reservados exclusivos. No limpiar fixture/archivos ni retirarWT al cerrar; transferir por coordinador. No runner activo tras18. Para reinspección sin nueva venta: Node24 `node tools/pos-measurement/run.mjs fixture flows-inspect 01`; para smokes cerrados usar `fixture flows-inspect-smoke 02`. No relanzar campaña sobre identidades consumidas.

Cleanup NO ejecutado: conserva ownership por tenant; corta POS→ledger antes de helpers marketing→ledger/membresías→negocio→cuentaspropias, con FKs revisadas y último snapshot preservado. Toda DB exclusivamente `run.mjs fixture OP`→`tools/neon-test.sh` con CI seleccionada y antiPROD incondicional también en NODE_ENVproduction. No push/PROD/subdelegación/factorydeliver por worker; entrega y aceptación las registra coordinador.
