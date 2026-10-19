# 0242 CP2b.4 — listado agregado V1/V2

Base `aa58db729da8f25b7f4f2448c36955d1314ce89a`; rama `pos-list-v2-0242`, WT `/private/tmp/checkpass-pos-0242/pos-list-v2-0242`. Producto congelado `f62609ef8f8ac00ea5e0f0f5b7e4d0ce0d58f4fa`; código final `3d0a9ce2` incorpora después únicamente expectativa SQL legacy y teardown propio autorizados/reservados por coordinador. Cierre documental posterior sin delta de código. Cinco archivos TS propios más este handoff; ningún otro path.

`listPosOrders` conserva caller/default V1 y añade overload con cuarto argumento2. V2 entrega version/saleType/orderLabel/lineCount; GETorders V2 sigue sin cablear. SaleType nulo usa solamente el FK real de mesa. V1 conserva total de snapshots en centavos históricos, itemCount representable y saleTotal exclusivamente del core enlazado; ignora settlement/totalSnapshot como autoridades V1. V2 cerrado prioriza settlement.collected aun sin pase, luego core.total, captura cerrada explícita totalSnapshot o snapshots unit legacy. Anulada conserva bruto/snapshot y saleTotal null. Abiertas normalizan originales exactos a moneda actual, sin usar totalSnapshot como autoridad ni volver a normalizar dinero congelado.

SQL agrupa órdenes seleccionadas del negocio y devuelve numerador/máximo exactos, flags y contadores; no descarga líneas individuales ni arrays, tampoco financial.lines del settlement (solo tres escalares y existencia). Tres SELECT constantes, sin N+1, paginación, truncamiento de abiertas ni índices nuevos. Coeficientes CASE derivados de gramsFactor/ratios y LCM: numerador SUM NUMERIC de q×10^9×p×10^9×100×coeficiente; denominador LCM×10^18. Sin división/redondeo monetario SQL; trunc solo valida escala/integralidad. BigInt/rational/normalizedGross/assertMoneyRange comunes normalizan una vez. Sin nueva política financiera, esquema/cache/backfill. V1 valida metadata unit/tarifa2dec antes de Number; incompatibles409, rango422.

## Evidencia y límites

Node24.20.0/pnpm11.4.0; dependencias propias existentes, hooksPath `.githooks`/pre-push vigente. Logs completos privados fuera del WT: `/private/tmp/checkpass-pos-0242/pos-list-logs/`; `check.py` conserva SHA/comando/stdout/stderr/exit real.

| Check/log | SHA | Resultado |
| --- | --- | --- |
| pure-75a38447.log | 75a38447 | 9PASS/0FAIL/0SKIP; producto idéntico final |
| types-merchant-3d0a9ce2.log | 3d0a9ce2 | PASS EXIT0 |
| types-domain-90d0dad4.log / types-db-90d0dad4.log | 90d0dad4 | PASS EXIT0; paquetes sin cambios posteriores |
| final-static-3d0a9ce2.log | 3d0a9ce2 | Cinco TS lint/formato/diff PASS EXIT0 |
| ui-guard-75a38447.log | 75a38447 | Dos archivos sin aumentos, EXIT0; producto idéntico final |
| module-boundaries-90d0dad4.log | 90d0dad4 | 24PASS/2FAIL EXIT1, backlog sin nuevos ofensores |
| neon-f62609ef.log | f62609ef | Nueva5PASS, legacy7PASS/1FAIL,0SKIP; wrapper EXIT1 preservado |
| neon-case11-6386c2a5.log | 6386c2a5 | CASO11 1PASS/7filtrados EXIT0; no corrida total |
| neon-case11-teardown-3d0a9ce2.log | 3d0a9ce2 | CASO11 1PASS/7filtrados y afterAll propio PASS EXIT0 |
| owner-cleanup-3d0a9ce2.log | 3d0a9ce2 | Cleanup privado acotado 1PASS EXIT0; detalle abajo |

DB únicamente mediante `tools/neon-test.sh`, env CI seleccionado privado y reserva exclusiva transferida por coordinador, serial `--no-file-parallelism`. Primera selección: measured-summary.neon.integration.test.ts + pos-orders.neon.integration.test.ts. Repeticiones posteriores solo pos-orders con `-t "CASO 11"`; siete filtrados no se contabilizan como PASS nuevos. Los cinco nuevos y siete legacy anteriores tienen identidad compatible con código final. Wrapper avisa ausencia de URL consumer-role; ese oráculo no formó parte de estas suites ni se certifica.

Nueva suite5PASS: owner/staff/locales, vacía/antigua/todas abiertas, orden, tenant, producto borrado, fallback FK, día local/DST ambas horas/90d inclusivo, cierres reales sin cliente USD/COP y V1 histórico0.98 frente V2 frozen1, legado/anulada sin ingreso, volumen200×30. AfterAll verifica negocios/owner/staff/sesiones vacíos. VALUES mass aislados verifican nueve conversiones, mezcla/9dec/no terminante/0/rango/metadata inválida/umbralesUSD-COP y equivalencia financial, incluido0.499→USD0.50/COP0 sin doble redondeo. Sin masa canónica ni barreras retiradas: activación CP2c pendiente. Contrastes puros gross/net y defensa voided+settlement son entradas sintéticas de proyección, no un cierre canónico.

Fallo inicial CASO11: expectativa cruda8.00 frente storage0102 numeric24,9=8.000000000, sin diferencia monetaria. Coordinador amplió scope exclusivamente para adaptar expectativa exacta (6386c2a5), después para eliminar/verificar owner/extraUsers/sesiones en afterAll propio (3d0a9ce2); soporte global intacto. Dos owners de corridas anteriores se identificaron por ventanas reales exclusivas, identidad exacta del seed y ausencia de relaciones, revisados por coordinador antes de autorizar DELETE por dos IDs capturados. Runner privado por wrapper: mismatch aborta transacción antes de DELETE y conserva ambos usuarios/sesiones; transacción válida revalida con lock, elimina exactamente ambos y verifica usuarios/sesiones0 dentro y después de commit. IDs/datos solo privados; hashes de runners/config/captura en maintenance-artifacts.sha256. Lecturas iniciales fallidas de identificación se preservan y no se presentan como PASS. CI liberada al coordinador tras este cleanup.

Backlog guardias separado: expenses/server/immediate.neon.integration.test.ts→stock/count.ts; cinco core literales extra: backoffice-context-controller.test.ts(3),backoffice-context-refresh.test.ts(1),onboarding/checklist-context-resource.test.ts(1),analytics/evaluation/policy-simulation.test.ts(2),analytics/lifecycle/index.ts(1). Guardias sin editar. Git/ps ordinarios dieron EPERM, avisados inmediatamente y resueltos con escalaciones propias para índice/commits de rama propia y lectura de procesos; sin refs principales modificadas.

Sin HTTP/read/catalog/inputs/schema/UI/guard/tooling/deps/estados, browser/build/fullverify/M0/M1/3201/túnel/demo/push/PROD. Dominio directo no certifica guard/scope HTTPV2: ensamblado y QA HTTP posteriores. Entrega limpia sin procesos propios persistentes; autor conserva fixes. QA nuevo independiente, factory/aceptación/integración del coordinador pendientes.
