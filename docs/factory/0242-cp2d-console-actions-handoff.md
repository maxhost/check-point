# 0242 CP2d.8 — acciones conectadas de consola local

## Revisión tras QA FAIL de lifecycle

La entrega inicial 007b1d27 fue rechazada por QA `db4030c0624e1a4a9639a2333803b871e815bdbf` sobre integración 675e2d9e. El hallazgo era real: el registro conservaba una captura cuyo lector dependía de `active` del `usePosContext` desmontado. El harness anterior mantenía su cliente singleton vivo y no cubría el source real. Los PASS históricos de abajo no resolvían ese fallo y se conservan como evidencia parcial.

Fix de producto congelado `ea3884b6dd128382dc5b420078d874d9bebee9ec`; candidato de pruebas tipadas `f134bf7dbddb88ee4f2b8bb58e93f78492778ef3`. `useMeasuredVoidAction` obtiene únicamente para void un cliente de `createMeasuredVoidClient`, construido con el `createPosClient` V2 real y las funciones estables `captureTicket/retire` del controlador del `BackofficeProvider` padre. El owner y su captura original consultan ese controlador vivo durante la intención, sin depender del lifecycle del hook de vista. No se reemplaza transporte/body en retry, no se recaptura desde otra identidad y no se ignora `DiscardedPosIntent`. El guard original sigue comprobando identidad antes/después de fetch; retiro/disposición real del proveedor deja de emitir tickets. Impresión/editor/cobro conservan su cliente de vista y sus helpers aceptados. Ningún transporte/contexto/core aceptado fue editado.

El harness ahora monta `MeasuredConsole` y `BackofficeProvider/controller` reales: remount destruye y recrea el source `usePosContext`, conservando el proveedor padre. A→B sustituye el proveedor real. El singleton de cliente fuente se eliminó. Las respuestas 401/scope del proveedor real retiran la presentación, por lo que sus aserciones observan su retirada y no un botón artificial conservado. La regresión unit usa `createPosClient` real: tras `sourceActive=false` la captura de vista original lanza `DiscardedPosIntent` sin fetch (guard intacto), mientras la captura original ligada al proveedor conserva estado uncertain/caché/bloqueo ante 403 y recupera exactamente los mismos URL/body/headers. Otro caso retira el controlador real y comprueba que una respuesta tardía no aplica orden ni caché.

Checks afectados: en ea3884b6 lint/formato de los seis paths y UIguard EXIT0; unit 8/8 y browser de anulación 8/8 EXIT0. En f134bf7d merchant typecheck, unit 8/8, lint/formato de los tres archivos de fixture corregidos y browser focal remount+retiro tardío 2/2 EXIT0. Cero skips/retries. Los cambios entre ea3884b6 y f134bf7d solo completan/comparten adaptadores de fixture no invocados (summary/inbox/checklist/verify), sin cambiar producto, bodies, estados ni specbrowser; evidencia browser 8 compatible. No se repitieron impresión, builder/hardware ni capturas/inspección visual intactos. No se interpreta aceptación funcional como aceptación visual; las divergencias UI reportadas por owner quedan para su corrección posterior según coordinación.

Logs externos con SHA/comando/runtime/lock/config/exits: `*-ea3884b6.*`, `*-1ab599bd.*`, `*-f134bf7d.*` en el mismo directorio de evidencia. Se conservan typecheck EXIT2 de ea3884b6 y 1ab599bd por adaptadores incompletos de fixture; corregidos con contrato tipado completo, sin modificar producto ni relajar checks. `evidence-fix-identity.json` fija hashes finales sin sobrescribir evidencia histórica; `processes-fix.json` confirma 0 procesos. Solo siete paths originales. Worktree limpio tras commit de handoff. No factory/refs/estados/DB/Next/push/PROD/3201/túnel. Siguiente paso: revalidación del mismo QA sobre nuevo candidato.

## Entrega inicial y evidencia histórica


FactoryID `pos-console-actions-0242`. Base `2bd56ab2bd173c34274b432da53c4c269fec3654`. Producto congelado `891ffd9d81dfc00e461177aaf0ef5bb34d4048bd`; candidato con correcciones exclusivas de fixtures/selectores `513b0afd304f608db1a31b5c37d8f778cad77420`. Esta entrega requiere QA NUEVO independiente. Autor conserva fixes; coordinador gestiona factory, integración y cleanup.

## Implementación y ownership

`measured-console.tsx` conecta sin editar `MeasuredTicket` y `useMeasuredPrinting` aceptados. El único hook de impresión recibe cliente contrato2 e identidad real; prepara ajustes después de un listado usable, fuera del camino crítico inicial. Al abrir detalle/resultado recibe la orden canónica de esa misma consola. Precuenta, resultado cerrado y reimpresión usan documento/feedback del mismo owner; elegir impresora requiere otro gesto para imprimir. Cambiar selección, versión, estado o identidad retira callbacks y documentos anteriores mediante el hook aceptado. Imprimir nunca crea/cobra/acredita/resuelve/redime. El resultado cerrado se conserva ante fallos de impresión.

`measured-void-action.ts` posee únicamente la anulación. Congela id, versión/body, transporte y epoch antes de await; doble confirmación comparte Promise. Envía POST void V2 con `{version}`, sin UUID nuevo ni clientRequestId. DTO V2 canónico del mismo id y status voided se aplica mediante `MeasuredOrderCache` a la misma `PosCache`, con `{timeZone,now}` explícito; no hay GET automático tras escribir. Cancelar confirmación no escribe. Cerrada/anulada no ofrecen anular ni cobrar.

Pending/uncertain/review bloquean navegación, selección, editor y preparación de cobro. Red/timeout/DTO no canónico conservan intención y captura originales. Un 403 posterior no resuelve incertidumbre: bloquea acciones, permite comprobación explícita del acceso y después replay idéntico. El registro focal conserva owner y caché en remount de la misma identidad, incluyendo el resultado si termina durante la ausencia. No persiste en almacenamiento del navegador; una recarga completa del documento está fuera del contrato de remount React. Cleanup limpio libera owner; cambio real de identidad, 401 o scope retirado lo retiran e invalidan respuestas tardías. El conflicto exige `Revisar orden actual`, un GET explícito, sin reintentar la escritura automáticamente; 404 definitivo retira la orden de caché.

Se reutiliza la validación canónica exportada por el helper aceptado de cierre, sin editarlo ni reutilizar su máquina de cobro. El diseño se comunicó antes de código. Se evitó ampliar scope: presentación duplicada de estado/acreditación se reemplaza por el ticket aceptado; consola 492 líneas tras formato. Los siete paths asignados son los únicos modificados: consola, controlador, su test, browser spec, dos fixtures y este handoff. Entry/preview development/posV2 siguen intactos; legacy/producción sin cambios.

## Evidencia focal

Directorio externo preservado: `/private/tmp/checkpass-pos-0242/console-actions/`. `runs.jsonl` y cada `<gate>-<SHA8>.json/.log` registran SHA/base, comando, Node24.20.0, inicio/fin, lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`, configuración browser SHA256 y exit. `evidence-identity.json` relaciona hashes de fuentes/config. Sin env ni DB.

En `891ffd9d`: eslint de los seis paths de código, Prettier y UIguard EXIT0 (`2 archivos, sin aumentos`). Producto/consola/harness permanecen idénticos en `513b0afd`; solo cambian test de controlador, spec browser y fixture de datos. En `513b0afd`: tipos merchant, lint/formato de los tres archivos corregidos, unit7/7 y browser15/15 EXIT0; cero retries y cero skips. No se presenta como PASS un runner parcial.

Comandos reproducibles desde worktree propio y Node24:

- `pnpm --filter @mi-pasaporte/merchant typecheck`.
- `pnpm exec eslint` y `pnpm exec prettier --check` con los seis paths de código asignados.
- `node tools/ui-guard.ts --base 2bd56ab2bd173c34274b432da53c4c269fec3654`.
- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/measured-void-action.test.ts`.
- `pnpm exec playwright test --config /private/tmp/checkpass-pos-0242/console-actions/playwright.config.mjs` (runner propio Chromium escalado, workers1/retries0, sin webServer Next).

Browser usa UI/cliente V2 reales hasta fetch interceptado: cabeceras contrato2/scope, cuerpos reales observados. Cubre lista usable antes de GETticket; precuenta/choose/error/retry sin comandos monetarios; selección fallida sin impresión y callbacks tardíos A→B/cambio de orden; resultado tras close y reimpresión cerrada sin close adicional; printingEnabled y recuperación de ajustes; cancelar/doble confirmación; proyección de anulada/reapertura desde caché sin GET adicional; respuesta perdida→remount→403→remount→comprobación explícita→mismo body/scope; conflicto/revisión; DTO incorrecto/replay; 404; 401/scope; void tardío tras cambio de identidad. El flujo de impresión no hizo POST y el de anulación solo POSTvoid. En resultado monetario solo el close explícito esperado.

Unit7 cubre captura/body inmutables y Promise compartida, caché/ventana local, incertidumbre sticky403, timeout/DTOincorrecto, revisión explícita, owner/caché remount y retiro tardío, 401/scope. Reutiliza evidencia aceptada de builder/hardware/dominio/HTTP y consola nativa; este browser no vuelve a certificar auth/DB/Next ni venta por masa.

Inspección agrupada de detalle y confirmación a390/1280, capturas ABIERTAS en lote inicial y única confirmación. Archivos `detail-390.png`, `detail-1280.png`, `confirm-390.png`, `confirm-1280.png`, fuera de `runner-output` autolimpiable; sin overflow. Capturas iniciales `initial-detail-*.png` preservan fixture anterior al ajuste del total.

## Fallos conservados y teardown

Primera corrida `891ffd9d`: tipos EXIT2 por genérico de mock Vitest; browser EXIT1,11/14, por selector ambiguo entre heading2 de resultado y heading3 del documento. No hubo rediseño ni relajación de comportamiento: selectores fijan nivel2; mock usa adaptador genérico tipado. Inspección detectó fixture heredada total2 con líneas4; fixture propia fija4. Se añadió un caso explícito de selección entre órdenes. Logs iniciales permanecen completos; no se contaron como aprobación. Producto sin cambios después del primer congelado.

Gitdir propio index.lock EPERM y consulta ps EPERM fueron avisados al coordinador de inmediato y resueltos con escalación acotada autorizada. Chromium se inició escalado desde la primera corrida. `processes.json` confirma 0 procesos propios después de finalizar runners y cerrar harness. Worktree se entrega limpio después del commit documental. No DB/env/wrapper/Nextbuild/fullverify/M0/M1, push/PROD,3201/túnel/demos ni artefactos ajenos. Sin pendientes de implementación; siguiente paso QA NUEVO sobre candidato congelado.
