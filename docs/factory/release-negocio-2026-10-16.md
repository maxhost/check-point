# Release Negocio0235 — corte directo

Estado del corte: **push completado de db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf, migraciones PROD0093–0095 aplicadas y cuatro deploys Vercel READY con ese SHA**. Comparación SQL posterior, smoke sin sesión y venta real POS de F5 PASS. Se avisó al owner que puede reanudar el uso y su cron horario; no se presume que ya lo haya reactivado. Pendiente de aceptación manual: recorrido de las tres secciones de Negocio. Los intentos fallidos y sus correcciones se conservan abajo.

## Autorización y alcance

Owner cambia el rollout: no hay usuarios usando la app, acepta el corte directo sin publicar puente. Pide: «vamos a preparar todo para push, dime cuando quieres que pare cron y cuando estes listo subes a github y aplicas en neon las migraciones». Registro2026-10-17 02:13:52UTC (2026-10-16 America/Guayaquil). Autoriza push a main y migración0093–0095 para este release, condicionados a gates, pausa confirmada del cron y cero obligaciones históricas/claims. No se ejecuta PROD mientras falte esa confirmación. No modificar variables ni configurar cron por el owner.

## Candidato y controles

Base dev82194aff, árbol negocio-release-0235 aislado de cambios documentales ajenos sin commit. Incluye entrega de retiro1dfb776b vía combinación aceptada570e169d, conservando commits y fix CI99d18e2f. Runtime idéntico a27a3befb; las diferencias nuevas son tests y un helper importado únicamente por un test. Dos implementadores y QA independiente existentes; no subdelegación ni revisores extra. Sin cambios de runtime, kit/guardias, SQL o journal por las correcciones del release.

Reserva db:modules-ci durante verify/pre-push y teardown; suites únicamente tools/neon-test.sh con configuración CI seleccionada, nunca DATABASE_URL PROD. Configuración local/CI asignada por clave, sin copiar env de PROD. Verificar gates obligatorios del SHA final y conservar log completo; no bypass. Si falla por red/DNS, detener y consultar al owner según su instrucción previa.

## Corte acordado

1. Preparar candidato congelado, QA de identidad/operación y gates de publicación. El cron sigue activo durante esta preparación.
2. Pedir pausa del job y esperar confirmación del owner. Comprobar ausencia de invocaciones/writers anteriores y obligaciones/claims de comisión antes de retirar su handler; si hay pendientes, no publicar hasta resolverlos con autorización específica.
3. Registrar baseline SQL solo lectura (journal, conteos, IDs/fingerprints/OIDs, FK y resultados). Confirmar remoto/base y ningún nuevo pendiente. Push normal a main, sin force ni bypass, desde árbol limpio exacto.
4. Aplicar0093+0094+0095 juntas con migrador oficial y host directo PROD guardado por huella; sin SQL manual separado. Mantener la app fuera de servicio hasta esquema completo y Vercel READY del mismo SHA. No asumir orden entre build y migración.
5. Comparar baseline, identidades/FK/resultados, precisión0095 y cero obligaciones/claims; comprobar Negocio/permisos, selector/cierre y comisión con una venta de prueba del owner. Reactivar cron después de comprobar el corte, a cargo del owner.

## Recuperación y límites

Antes de migrar, un fallo detiene publicación/corte. Después del movimiento, no volver al binario0092 ni revertir tablas: corregir hacia adelante o usar artefacto compatible con core revisado y autorización propia. Puente anterior queda como referencia, no como candidato a publicar automáticamente. No recalcular ventas anteriores ni borrar/reinterpretar obligaciones. El retiro conserva lectores, resultados, mapping e IDs.

## Evidencia y resultado

SHA final, nuevo pre-push, confirmación de pausa, baseline, push, migración, deploy y verificación se agregan con resultados observados; ningún PASS ni hora de ejecución se presupone.

QA independiente aceptó identidad y plan de65b5f443, fuente idéntica27a3befb, sin certificar precondiciones PROD. Lecturas PROD solo lectura02:15:39 y02:17:35UTC:93 migraciones,4 comercios,22 medios,4 pagos con provider pos,0 revisiones/resultados; deliveryprofitability skipped1 y recipes applied1, sin claims ni obligaciones de comisión; sin writers activos observados. Son instantáneas previas, no sustituyen la comprobación después de pausar cron. Baseline definitivo se captura antes del corte.

Primer verify se detuvo antes de build/navegador para completar orígenes locales explícitos; DB local ya guardada. Segundo verify con orígenes/proveedores locales: tipos6/6, lint, guardiaUI32 y formato PASS; unitarios2914PASS/2FAIL/1328skipped (DB excluida aquí). Fallos de contrato obsoleto: fixture cropped aún enviaba timezone a Marca; lista exacta de permisos omitía business. Build4apps PASS antes de detener la tanda durante navegador para corregir esos dos tests; navegador parcial y Neon no certificados por esa tanda. Ningún fallo de red/DNS ni bypass.

Ampliación nominal factory previa a editar: cropped-input-validation.test.ts y staff-permissions.test.ts. Solo se retira timezone del fixture de Marca y se añade business a la lista exacta de ocho; assertions y negativos conservados. Selección corregida63/63 PASS,1,52s; tiposMerchant posterior EXIT0, formato/diff PASS. El pre-push ejecutará verify completo sobre el SHA corregido antes de transmitir el commit; no se declara verify verde a partir de una corrección focal. Artifacts next-env generados se restauran exactamente; logs reales en /private/tmp/checkpass-negocio-release/.

## Primer pre-push y correcciones

El owner informó «Cron parado» pero pidió mantenerlo activo mientras demora el pre-push. Se reconoció la pausa anticipada y se indicó que puede reactivarlo. Se requiere una **confirmación nueva después de los gates**, sin inferirla del primer mensaje.

El comando Git usa un bloqueo adicional temporal fuera del repo: ejecuta el hook original intacto con stdin y argumentos completos, propaga errores y solo después de EXIT0 espera la confirmación nueva. Antes de retornar a Git verifica baseline PROD de solo lectura, cero obligaciones/claims y ausencia de writers. Config persistente sigue.githooks; no bypass ni replay. Wrapper revisado por QA, incluyendo rechazo de timestamps inválidos/antiguos/futuros.

Resultado real del primer intento: tipos6,6s/lint8/UIguard0,9/formato9,7 PASS; unitarios2916PASS56,2s; cuatro builds PASS20,4s. Navegador **1FAIL/446PASS/21excluidos**,127s; Neon paralelo **15FAIL/3950PASS/282excluidos**,681,62s. El wrapper no llegó a11archivos seriales por el rojo paralelo. El coordinador omitió el fallo browser en una actualización y lo corrigió al leer la tabla final. Git terminó EXIT1; remoto siguió5b834ca0. No hay fallo DNS/red observado ni transmisión.

[Contrato y ampliaciones](0235-release-fixes-contract.md). Entrega A **f150317aed11d6b007044395d478c8396d5ea9a6**, fuente f0a7a8f0: cinco suites **22/22 PASS**, sin skips, cuatro wrappers seriales EXIT0. [Handoff A](0235-release-contract-tests.md). Corrige catálogo exacto, FKs/control, deliveryv1/consumo Recipes y replay0086/0087 conservando objetos core/OIDs/hashes; no elimina negativos ni cambia SQL aplicado.

Entrega B **fca45e9c68f8ab36ed0484e47af77cac3a0ddc63**, fuente74cf1bc3: cuatro suites **31/31 PASS**, sin skips, dos wrappers seriales EXIT0; tour **3/3 PASS**, retries0. [Handoff B](0235-release-fiscal-test.md). Fiscal se prueba por Negocio/business real, Brand solo conserva branding y no recibe permiso nuevo; mantiene aislamiento, revisiones, conflictos, atomicidad, slug y lealtad. Browser usa el mismo componente/harness y mocks de siempre; no es smokeapp. Sus dos intentos de infraestructura fallidos (Next/EMFILE sin casos y Chromium IPC antes de UI) se conservan separados del resultado válido con escalación técnica; no se afirma cura de polling.

QA independiente aceptó ambas entregas exactas y su evidencia; combinación7cb270d5 conserva los commits y solo suma docs del coordinador. Recurso CI se transfirió A→B→coordinador después de cada teardown; B confirmó cierre completo2026-10-17 02:58:30UTC, sin procesos/puertos/Next propios. Se restauró el next-env generado. Evidencia real A en /private/tmp/checkpass-negocio-release-contract-tests/ y B en /private/tmp/checkpass-negocio-release/fiscal-test-logs/. Estos focos no convierten el pre-push anterior en verde: el nuevo hook completo sigue obligatorio.

## Pre-push final aprobado; espera de pausa

El segundo intento, sobred09adbd0, se detuvo conSIGTERM143 al detectar formato pendiente en el helper nuevo, antes de build/browser/Neon. La corrección db3175d2 solo cambia formato del helper; AST TypeScript idéntico, formato global EXIT0 y QA independiente aceptó ese SHA exacto. No hubo transmisión ni bypass.

El tercer intento ejecutó el hook original completo sobre **db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf**. Finalizó `verify: ok`; bloqueo adicional registró `originalHookExit: 0` a las2026-10-17T03:22:16.511Z. Log: `/private/tmp/checkpass-negocio-release/prepush-final.log`.

| Gate | Resultado | Segundos |
| --- | --- | --- |
| typecheck | PASS | 5,6 |
| lint | PASS | 8,0 |
| ui-guard | PASS | 0,9 |
| format:check | PASS | 9,4 |
| test | 2916 aprobados;1328 DB excluidos en esta fase | 53,6 |
| build | 4 aplicaciones aprobadas | 19,3 |
| test:e2e | 447 aprobados;21 omitidos | 123,1 |
| neon (full) | 3965 aprobados/282 omitidos paralelo +34 aprobados serial;0 fallos | 834,9 |

Neon ejecutó510 archivos aprobados/41 omitidos en paralelo y11/11 archivos seriales aprobados. Las omisiones se declaran por separado y no cuentan como aprobaciones. El browser global usó los servidores Next normales. Se restauró solo el `next-env.d.ts` de public generado por esas pruebas; checkout candidato limpio. La prueba serial de fallas técnicas/condiciones de negocio aprobó4/4 casos, incluida la reversión por falla DB y el cierre marcado cuando la referencia capturada es inconsistente.

Se pidió una nueva pausa al owner después de este resultado. Hasta recibirla, no se crea la señal de continuación: push detenido, esquema PROD sin cambios. Esta ficha se actualiza en dev sin agregar un push documental al candidato.

## Ejecución autorizada

Nueva confirmación expresa del owner: **«listo pausado, hace el push y las migraiones»**. Registrada a2026-10-17T03:27:25.545Z (2026-10-16 22:27:25 America/Guayaquil), posterior al hook aprobado. Se conservó la app sin uso y el cron pausado para el corte. No se configuró ni ejecutó el cron por el owner.

El bloqueo adicional ejecutó su preflight SQL solo lectura y pasó: esquema0092, cero obligaciones/claims de comisión, cero writers activos y cero referencias huérfanas. Git transmitió **5b834ca0→db3175d2**, `RELEASE_PUSH_EXIT=0`; `origin/main` confirmado como **db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf** mediante `ls-remote`. Sin force ni bypass del hook. Las correcciones documentales posteriores permanecen solo en dev.

Baseline definitivo2026-10-17T03:27:37.765Z; migrador oficial `pnpm db:migrate:prod` inició03:27:38.585Z y terminó03:27:44.805Z, **EXIT0**. Se aplicaron0093+0094+0095 en una transacción, mientras Vercel procesaba el deploy; no se desplegó puente ni se ejecutó SQL manual separado. Credencial desde el archivo PROD existente solo en memoria, endpoint protegido por huella; ningún valor de variable impreso.

Lectura SQL posterior2026-10-17T03:27:50.054Z; `check-migration.cjs after` **PASS**:

| Evidencia | Antes | Después |
| --- | --- | --- |
| Journal | 93, hasta0092 | 96, hasta0095; hashes y timestamps exactos |
| Comercios | 4 | 4; datos fiscales/regionales y membresías idénticos |
| Medios e inicializaciones | 22 y4 | 22 y4; filas/ids/OIDs conservados al mover a core |
| Pagos existentes | 4, provider pos | 4; mismos ids, importes, referencias y provider pos |
| Revisiones/resultados de comisión | 0/0 | 0/0; sin reconstrucción ni configuración inventada |
| Movimientos de stock | 38 | 38; fingerprint idéntico |
| Punteros de recursos normalizados | 8 | 8; fingerprint idéntico |
| Funciones financieras históricas | 2 | Mismos OIDs, cuerpos y tipos |
| Entregas, FK y referencias huérfanas | Historial sin claims/obligaciones;0 huérfanas | Historial/FK idénticos;0 huérfanas |

Fingerprints pre/post de medios `d71d647d37303f5d7203cd6ee0837ff3`, inicializaciones `c1549be43a6c91a423c3f87800fd6c5e`, pagos `f123c161f4406c2a75a37236951ba42c`, stock `8cab3bc31872d21e04bd966b4986a6f8` y punteros `42cd6f28e061f20bda3b9fd4bf83f946`: idénticos. No contienen datos personales. Las funciones históricas conservan OIDs566031/566040. El mapping conserva exactamente `profitability/sale.closed/commission_snapshot/pos`; `database_ready_for_retirement=true`, sin obligaciones, claims ni intentos fallidos pendientes.

Hashes SQL aplicados:0093 `f45d1aa211ade2778fec7a59df145292f7d830bce1683a84f5745f277e6fcc58`;0094 `f6627a0204b8f50e5eee9d0df7e361e6d5a869706860c445768bade339acf813`;0095 `8e4d08b62dfd4a70230335eb46fb2ccd344dd0a98b6d99a654323a7c802ba239`. Los93 registros anteriores del journal siguen idénticos.

Evidencia operativa local: `/private/tmp/checkpass-negocio-release/{release-continue.json,cron-paused.json,prod-before.json,prod-after.json,migration-prod.log,migration-result.json,vercel-release.json}`. No se ejecutaron suites contra PROD ni se consultó CI GitHub después del push.

## Deploy y comprobación final

Los cuatro deploys de producción quedaron **READY con db3175d237cdcf4ec41e32d70cc1c4f1e06ab2cf**, verificados juntos2026-10-17T03:32:02.939Z:

| Aplicación | Deploy | Hora READY UTC |
| --- | --- | --- |
| Merchant | dpl_HugPt7VRgL3pRePFRXFqmUhypPMg | 03:31:17.244 |
| Customer | dpl_21GQpFuBAJrL8x3LRKSP3sJQ27zQ | 03:29:25.102 |
| Admin | dpl_GXFHXLWZ82th16rS8pQSDpKojkcv | 03:28:20.160 |
| Public | dpl_EQ78j8Y7dJ99M83JbQece1nzfkN5 | 03:28:37.457 |

Los aliases `checkpass.club` y `business.checkpass.club` apuntan a sus deploys READY del mismo SHA, comprobado2026-10-17T03:32:01.879Z. No hubo redeploy manual ni cambios de variables en este corte.

Smoke anónimo mediante GET, **6/6 resultados esperados**: `/api/health`200; `/api/business/{regional,fiscal,payment-methods,payment-method-catalog}`401; `/backoffice/business`307 hacia `/`. Evidencia `/private/tmp/checkpass-negocio-release/prod-smoke.json`. Esta comprobación confirma salud y guardia sin sesión; **no acredita el recorrido autenticado ni un nuevo cobro real**. Los contratos de permisos/cierre/congelado fueron comprobados en CI protegida, no mediante una venta de PROD del coordinador.

Se indicó al owner que ya puede usar la app y reactivar su job cada1h. La reactivación efectiva y el recorrido manual siguen a cargo del owner. Se solicita revisar Negocio con sus tres secciones, el selector de medios del POS y una venta de prueba. Si falta un componente aplicable de comisión, el resultado esperado es provisional y marcado «Sin configurar», nunca margen real; Efectivo/none es cero conocido. El coordinador no configuró ninguna comisión ni generó una venta. No fue necesario rollback ni una publicación adicional.

## Venta real F5 después del despliegue

El owner informó: «hice la prueba con el negocio F5 cerre session, inicie de nuevo, abri una orden, la cobre». Se verificó únicamente por SQL **REPEATABLE READ READ ONLY**, `transaction_read_only=on`, a2026-10-17T03:36:51.028Z. Se encontró una sola orden de F5 cerrada después del READY del deploy Merchant; no se creó otra venta ni se llamó a reintentos. La salida/inicio de sesión es evidencia aportada por el owner, no una inspección del navegador del coordinador.

| Registro | ID o resultado |
| --- | --- |
| Comercio | `5fcaebc2-82f2-4b8c-ba5c-27a44c802c40` |
| Local | `11560a0c-e7db-4909-b19c-968ef2ada93c` |
| Orden POS | `530b45ab-11ff-49b2-b80d-8fa70a53d67e`, closed; creada03:35:28.303UTC, cerrada03:35:32.629UTC |
| Cobrado | **ARS9.50**, descuento0.00, tres líneas |
| Pago | `6d642ce3-d287-409a-aa72-3c5a234e6893`; importe9.50 |
| Medio | `41aa1364-e75e-4884-aebe-805d7cfae819`, Efectivo, activo; **method_provider_id=core**, charge_shape=none; pertenece al mismo comercio |
| Comisión por venta | `3c257494-118c-423b-b3c7-b3322c9121f9`; core.sale_commission, source_provider_id=pos, **completo, total0.00, reasons=[]** |
| Comisión por pago | `8fa8c158-f84c-450d-b641-da72314ee89b`; core.payment_commission, mismo pago/medio/evento/local, configured=true, commission0.00, reasons=[], revisiónnull |
| Evento | `857b2a82-047d-468a-887a-c3268bc2983b`, sale.closed, **versión2**, mismo comercio/local/orden; money.collected9.50ARS y pago provider core |
| Delivery | `3aa00a6f-40ad-4fb9-b4af-7611e043acb8`, **recipes/applied**, attempts1, applied03:35:33.265UTC, sin claim ni error terminal |

La comisión0.00 es **cero conocido**, correcto para Efectivo/none según spec0235 y ADR0150; no es «Sin configurar» aunque no haya revisiones de comisión. El resultado se guardó en las tablas core durante el cierre, sin delivery profitability nuevo. Esta venta no prueba una tarifa porcentual/fija ni el aviso de componentes sin configurar; esos contratos tienen evidencia CI previa y no se atribuyen a esta prueba en efectivo.

La línea `48eeabff-d09a-45c2-aa96-73cfbe953703`, producto `48659125-a8d4-4703-af06-575e4a3911b0`, capturó composición `15e22b37-626c-4e0c-9fd2-74b2d56c7891` y revisión de receta `e37f4524-18ac-4451-a437-8aa84f2e47d9`. Tiene tres fuentes de consumo, una por insumo, y estos movimientos únicos:

| Insumo | Movimiento | Consumo | Costo unitario congelado ARS |
| --- | --- | --- | --- |
| `8ad64b3a-3bd5-4d86-a951-4d76341c6b64` | `71354f41-9fcb-4d3b-8205-44b9502ee059` | -3.000 | 0.175000 |
| `cea7a845-2376-456c-b1a3-7de38730595c` | `0cdd211c-0a35-43af-9763-61ddf7b65d94` | -5.000 | 0.000220 |
| `d6865378-0c43-4959-9fe8-106b12de9edf` | `1e2367a4-34c5-4a83-a7bb-f152203733d7` | -30.000 | 0.005000 |

Las cantidades negativas coinciden exactamente con las asignaciones de recipes.consumption_source; factor de merma congelado1.000000, monedaARS y escala2. Costo exacto de **esa línea con receta**: ARS0.6761. Las otras dos líneas no capturaron composición; no se afirma costo completo ni margen de toda la venta, ni se inventa consumo para ellas.

Comprobación de consistencia entre orden/pago/medio/corecommission/evento/local y consumos **PASS**, sin duplicados en esta orden. Evidencia saneada: `/private/tmp/checkpass-negocio-release/f5-sale-after.json` y `f5-sale-verification.json`. Recorrido de Negocio/Marca, pruebas con una tasa y reactivación efectiva del cron no se presuponen a partir de este cierre POS.
