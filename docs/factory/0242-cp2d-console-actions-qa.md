# 0242 CP2d.8 — QA independiente de acciones de consola

Dictamen **FAIL** sobre candidato congelado `675e2d9ea47cea9caadd9578edb28645c4bfbdcb` (base de integración `7c3fc09d`; entrega autor `007b1d2797ef7ba9d357964dce53b447c708880b`; base autor `2bd56ab2bd173c34274b432da53c4c269fec3654`). Worktree/ref propio `/private/tmp/checkpass-pos-0242/pos-qa-0242`, `pos-qa-0242`. Requiere corrección del autor y nueva revisión del caso afectado antes de aceptar este incremento.

## Hallazgo bloqueante: el remount real invalida la captura retenida

Esperado: respuesta perdida de POSTvoid mantiene body/version/id y captura; un remount de la misma identidad no resuelve la incertidumbre ni retira la intención. Solo recuperación explícita o retiro real de identidad permiten liberar el bloqueo.

Observado: `usePosContext` marca su ref `active=false` al desmontarse. `measuredVoidOwner` conserva el owner del mismo identity, con su cliente/captura originales, aunque el nuevo montaje entregue un cliente nuevo. La captura de `createPosClient` sigue leyendo el ref del hook desmontado: antes de cualquier fetch, lanza `DiscardedPosIntent`. `MeasuredVoidAction.withdrawn` lo clasifica como retiro real y `retire` borra la intención y la caché. El retry queda en `phase=retired`, `canLeave=true`, `cache.context=null`, con solo un fetch total. La UI queda sin recuperación del mismo intento; otro montaje puede construir un owner limpio aunque el resultado del POST original siga desconocido. Categoría: producto/interacción, preservación de operación incierta.

Reproducción independiente con el `createPosClient` real, sin editar producto: crear cliente cuyo lector refleja exactamente el lifecycle active del hook; confirmar abierta y simular respuesta perdida; desmontar owner y marcar lector original inactivo; montar mismo identity con cliente fresco; comprobar reutilización del owner; reintentar. Se esperaba mantener/reconciliar el intento incierto y se observó retiro. Config/test externos `qa-remount.config.mjs` y `qa-remount.test.ts`, evidencia `qa-remount.log` y `qa-remount-identity.json` en `/private/tmp/checkpass-pos-0242/console-actions/`. Comando `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/console-actions/qa-remount.config.mjs`: EXIT1, 1 test fallido, 0 skips/retries, Node24.20.0. Es una reproducción del transporte/lifecycle, no una ejecución de Next/auth.

La prueba browser existente de remount solo desmonta `MeasuredConsoleContent`: su cliente global permanece activo, por lo que no ejerce este contrato. La corrección y regresión deben pertenecer al autor; conservar la captura original no basta si depende de un hook retirado. No equiparar un falso remount con retiro real de tenant/identidad, ni liberar unknown al perder esa captura.

## Evidencia compatible revisada

Se verificaron SHA256 de los seis archivos de código/tests contra `evidence-identity.json`: todos coinciden con `513b0afd304f608db1a31b5c37d8f778cad77420`; producto coincide con fuente congelada `891ffd9d81dfc00e461177aaf0ef5bb34d4048bd`. Lockfile `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`, tsconfig merchant, Vitest y ESLint también coinciden. El candidato incorpora estos mismos archivos, sin cambio de entry/default/producción ni helpers aceptados.

Se revisaron comandos, exits y logs reales de autor: tipos merchant PASS en513b0afd; lint/formato/UIguard PASS en891ffd9d y lint/formato de archivos corregidos PASS en513b0afd; unit7/7 y browser15/15 PASS en513b0afd, 0 skips/retries. Config browser hash `26c71b0e2acfcbb8b26d69ae3228abf77666755798255002bc695b5e3125ee42`, Chromium harness de componentes, workers1/retries0, cliente V2 real hasta fetch interceptado. No se repitió la batería compatible por ceremonia. Estos PASS no cubren ni neutralizan el hallazgo de lifecycle real.

Inspección de código y casos cubiertos: prepare de ajustes tras listado usable; hook/ticket aceptados, gesto separado choose/print y fix choose-error sin fallback; documento y feedback retirados por orden/id/version/status/contexto. Impresión no emite comandos monetarios. Void congela body/version/id/capture antes de await, doble confirmación comparte Promise, timeout/DTO inválido conservan incertidumbre, 403 posterior no la libera dentro del lifecycle cubierto, conflicto exige GET de revisión explícito y cancelar no escribe. DTOvoid canónico se proyecta a la misma PosCache/fachada con ventana local explícita, sin GET postwrite. Se revisó aislamiento por identidad y callbacks tardíos; la limitación del registry es la descrita arriba.

Capturas externas del autor `confirm-390.png` y `detail-1280.png` ABIERTAS por QA: confirmación única, texto y botones legibles, detalle/total coherentes, sin desbordamiento visible. Se reutiliza su inspección agrupada completa390/1280 y aserción de overflow; no se afirma cobertura visual nueva de todos los estados.

## Fallos, límites y cierre

Fallos iniciales del autor preservados: tipos EXIT2 por mock genérico, browser EXIT1 11/14 por selector ambiguo; fixture de total corregida y caso adicional de selección explícita. No se convierten esas corridas en PASS. La primera ejecución focal QA contenía una aserción situada después del cleanup explícito; se corrigió solo ese test externo y se repitió. La evidencia final captura el estado observado antes del cleanup y confirma el mismo retiro indebido.

Sin DB/env/wrapper/Next/server/build/fullverify/M0/M1, hardware/papel/BLE real, auth/DB nativos ni masa canónica certificada. No se tocó3201, túnel, demos, refs/estados/factory ni producto. Preview mantiene gate localdevelopment/posV2; este dictamen no autoriza integración ni publicación. Solo se modifica este informe.

`ps` inicial EPERM se avisó al coordinador y se resolvió con escalación propia acotada/read-only: sin procesos QA vivos, salvo la consulta y rg mismos. Vitest terminó sin servidor. Git diff/check limpio antes del informe. Worktree limpio tras commit documental; ningún push/PROD.
