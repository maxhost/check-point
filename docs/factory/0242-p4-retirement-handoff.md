# 0242 P4 — retirada funcional y UI legacy

Autor: `pos-ui-card-0242`, base `44a3d604`. Contrato inicial y ampliaciones del
coordinador hasta `956fd53f`. Entrega: SHA del commit que contiene esta ficha.
Sin DB, migraciones, kit, guardias, tooling, servidor3201, túnel, push ni PROD.
QA independiente y combinación pendientes; esta ficha no certifica publicación.

## Resultado y alcance real

- Eliminados los16 archivos explícitos de consola Counter (excepto `page.tsx`,
  que conserva el redirect ya entregado en P3a). Eliminados los14 archivos POS
  V1 explícitos (incluido su hook de impresión huérfano), más `use-pos-close-navigation.ts`.
  Desaparecen UI de acreditación rápida/detallada y canje directo, y sus previews
  y tablas de estado exclusivamente legacy. No se retiró dominio server/counter.
- Scanner trasladado idéntico a `src/components/qr-scanner.tsx`: cámara,
  BarcodeDetector/jsQR, callbacks y cleanup sin cambio. El consumidor real es
  `measured-editor-customer.tsx`. `src/sales-contract.ts` conserva CounterProduct,
  CartLine y firmas de helpers compartidos; no transporta redención UI retirada.
- Conservados sin cambio pos-context, pos-cache, tablas y printing/documentos
  exactos. `PosPrintFeedback` sigue compartido por editor/ticket modernos, con
  contrato estructural en vez de depender del hook V1 eliminado.
- Navegación móvil usa enlaces operativos autorizados del manifiesto y módulos
  activos; Clientes conserva clave `counter`. No hay rutas/id POS en core.
- Alta de equipo recomienda el permiso `startPage` del primer módulo operativo
  habilitado en el registro; en otro caso Clientes. No activa módulos ni cambia
  permisos de integrantes existentes. Un estado de módulos no cargado usa Clientes;
  selección de módulo que ya se apagó no se envía. Helper puro en `staff-contract.ts`
  por instrucción del coordinador: la frontera impide importar un nuevo helper
  core desde `modules/staff-defaults.ts`; no se añadió excepción a la guardia ni
  reexport artificial. Se corrigió omisión preexistente de analytics en el orden
  de permisos, detectada por el oráculo de catálogo cerrado.
- Tours/copy dicen Clientes y revisión de accesos. Checklist deja de tener una
  excepción a una pantalla Counter retirada. Programa no ofrece configuración ni
  resumen de canje insuficiente; el tour declara suspensión. Se conserva el
  estado/payload histórico de `redeemAllowInsufficient`, saldos y registros.
- `ticket-settings.tsx` usa explícitamente contrato2: su GET/PUT productivo había
  quedado en1 después del corte HTTP. No se cambió el default del transporte ni
  se relajó la barrera de P3a. `usePosTables` recibe cliente2 de ambos consumidores
  actuales (editor y diálogo); su transporte/cache permanece intacto.

## Diferenciales encontrados al portar negativos

1. `table_occupied`409 / `unknown_table`422 del editor moderno no refrescaban mesas;
   el primero dejaba un conflicto sin salida. Ahora sólo esos rechazos definitivos
   invalidan la caché de mesas, incrementan su revisión y retiran la selección
   rechazada conservando líneas/nombre y mensaje. La persona vuelve a elegir.
   Un retry de create incierto que responde409 sigue incierto: no se libera una
   nueva intención ni se otorga acceso tras403/cambio de identidad.
2. Las reglas completas del cupón no estaban visibles en el editor ni durante
   revisión tras revalidación. Se muestran en el editor y en checkout al cambiar
   beneficio; si superan160 caracteres se expanden con botón del kit accesible.
   No se interpreta el texto ni se cambian cálculo/targets. Checkout habitual
   conserva su presentación compacta.

## Evidencia y ejecución

Node24.20.0, pnpm11.4.0, dependencias/lockfile de la base, Chromium Playwright
1243. Configuración de harness en `/private/tmp/p4-playwright.config.cjs`,
sin webServer/DB, retries0, screenshots/trace off. Se retiraron también calls
explícitas screenshot de las cuatro specs modernas autorizadas, conservando sus
interacciones/aserciones/viewport. Las pruebas son browser de componentes con
HTTP simulado; no certifican Next/auth/DB/cámara física/impresora física/M1.

- Unit focal:198 casos/16 archivos PASS, incluyendo staff/tours, navegación,
  helpers, editor/commands/payment/caché moderna y impresión exacta/transporte.
  `pos-cache.test.ts`:3 casos adicionales PASS.
- Types UI, ESLint de archivos modificados, Prettier y UIguard focal: ver cierre
  al pie tras la última corrida. No se modificaron tests para eludir guardias.
- Primera corrida browser en sandbox no pudo iniciar Chromium por MachPort
  `bootstrap_check_in Permission denied(1100)`: fallo de entorno, no PASS.
  La misma ejecución fuera del sandbox fue autorizada por auto-review.
- Corridas exploratorias encontraron selectores previos a UI punto1. Se adaptaron
  las specs existentes antes de usar su cobertura; no se cambió producto para
  acomodar esos selectores. No se certifican aquellas corridas parciales rojas.
- Un transform para retirar screenshots eliminó temporalmente bloques de tests.
  Se detuvo, se restauraron todos los casos y se verificaron contra `44a3d604`:
  connected6/6 llamadas test y31/32 expect; editor10/10 y46/46;
  payment10/10 y37/37; ticket10/10 y37/37. Mismos nombres, ningún ausente,
  mismos1/4/1/1 cambios de viewport; calls screenshot1/2/1/1→0.
  La evidencia de cierre corresponde sólo a la fuente restaurada.
- `modules-boundary.test.ts` PASS. `modules-boundary-literals.test.ts` conserva
  fallo preexistente ajeno: context-controller.test3, context-refresh.test1,
  checklist-context-resource.test1, analytics/evaluation/policy-simulation.test2,
  analytics/lifecycle/index1. Ninguno de esos archivos se editó. No se declara
  batería global verde ni se cambió whitelist.

## Matriz de sustitución de cobertura

Los nombres/prefijos siguientes son selectores `--grep` reproducibles. Las suites
Counter/POS V1 desaparecen por contrato410; un recorrido de ese circuito no es
una prueba válida de la UI V2. No se tocaron suites HTTP antiguas reservadas a P6.

Claves de evidencia actuales:

| Clave | Archivo y caso/invariante vigente |
| --- | --- |
| NAV | counter-mobile.spec: `Clientes and authorized operation` (6 combinaciones permiso/módulo) y pos-printing.spec `staff creation recommendation` (on/off). |
| QR | counter-coupon-verdict.spec: `shared camera resolves once` (válido/inválido), un POST scoped2, tracks cerrados, cancelación, exclusión local, regla íntegra/expansión. |
| CTX | pos-context.spec: seed sin GETsession/módulos; loading no inventa permisos; scope409; mismo ámbito conserva borrador; nuevo ámbito descarta A tardío. |
| EDIT | pos-measured-editor.spec: `cuatro tipos`, `captura mass`, `local requiere descarte`, `version conflict`, `catalog conflict`, `recovery misma clave`, `identidad cambia`, `canónico recuperado cerrado`, salida explícita y COP. |
| PAY | pos-measured-payment.spec: anonymous/frozen retry, zero, revalidation/full rule, mass free blocked/exclusion, conflict explicit review, late QR, COP change, scope retirement, mixed source target. |
| METHODS | pos-payment-methods.spec:100% USD/COP sin métodos/pagos, retiro de cliente carga métodos/cobro positivo, buffers insuficientes/negativos/precisión/parcial/vacío. |
| TICKET | pos-measured-ticket.spec: documento exacto, gesto, doble toque, unsupported/cancel/write failure, error ajustes, closed/voided y respuestas retiradas/tardías. |
| ACTION | pos-console-actions.spec: preparación/imprimir sin writes monetarios, ajustes off/error, void cancel/doble/ambiguo/conflict/malformed/missing/withdraw/scope/late; dirty conserva nota. |
| CONNECT | pos-connected-console.spec: create/cancel/retry UUID/cuerpo/result/cache sinGET, pickup guardar/reabrir, conflicto conserva intención, identidad A→B, viewports. |
| TABLE | tables.spec:7 recorridos Locales conservados, más ambos rechazos V2 table_occupied/unknown_table con refresco/líneas/segunda selección, todas ocupadas y nombre libre sólo cuando corresponde (Mesas vacío/apagado). |
| CACHE | pos.spec conserva ambos casos puros; pos-cache.test y measured-order-cache.test cubren epochs/versiones/lista/history/mesas/proyección canónica sinGET. |
| COMMAND | measured-order-commands.test:40 negativos/resultados/ambigüedad/401/403/409/422/408/5xx/retire/DTO parcial/versión superior; measured-editor-model.test incluye ambos rechazos de mesa y retry incierto. |
| SESSION | measured-payment-session.test:17 casos; captura congelada, doble, revisión de misma orden, DTO ajeno, timeout, ámbito, personas tardías,403 incierto,408/500/503, JSON ilegible, scan fallido no anónimo, cero, métodos cacheados. |
| PREVIEW | measured-payment-preview.test:8 casos exactos unidad/peso, target source, gratis/2x1 inválidos en masa, descuento fijo/%, acumulación y cambio normalizado. |
| PRINT | printing/index.test y build/build-measured/escpos:BLE/Serial, filtro/olvido, errores por causa, opciones y contenido exacto. |

Cada grupo original se asigna a su invariante, incluyendo negativos. Las diferencias
propias de un wizard/quickgrant/canje retirado se indican explícitamente.

| Original (archivo: nombre o familia de casos) | Sustitución / razón |
| --- | --- |
| counter-mobile: Mostrador móvil oculta navegación/acciones | NAV; ACTION mobile dirty y EDIT phone/desktop. Tabs Venta rápida/Canjear retirados. |
| counter-coupon: consulta/reescaneo no consumen, café único bonificado | QR un resolve sin write de venta; PAY mixed source target; PREVIEW decisiones exactas. No autoañadir producto por lectura: el editor actual conserva líneas explícitas. |
| counter-coupon: cupón rojo/motivo/Quitar/no enviado | QR inválido/motivo/exclusión local; PAY mass blocked y exclusión sin remover cupón global. |
| counter-coupon:2x1 precio/rechazos M4/coupon_not_selected | PREVIEW 2x1/targets; SESSION revisión y error. La captura manual de precio del grant retirado ya no existe (catálogo sin precio no se puede añadir en EDIT). |
| counter-coupon: éxito separa venta/extras | TICKET resultado real, PREVIEW acumulación y datos exactos. No se representa GrantResponse legacy. |
| pos: crear/editar snapshots/lineId/ticket/cerrar anónimo | EDIT version/snapshots; CONNECT create/close; TICKET exacto. |
| pos: conflicto/anulación confirmada | EDIT/CONNECT conflicto; ACTION cancel/double/canonical void. |
| pos: cobro con pase sóloPOS/UUID/cuerpo idéntico | PAY frozen retry/scoped2; SESSION captured wire y ninguna repetición automática. |
| pos: cupón inválido quitable/error close orden abierta | QR inválido; PAY exclusión/conflict; SESSION 4xx y ambiguo. |
| pos: activación/desactivación bloqueada por órdenes | No cambia activación backend; sus tests de módulos existentes son el oráculo. NAV/METHODS no activan módulos; no se certifica write de activación con mocksV1. |
| pos: módulooff permiso/nav staff | NAV6 + defaults2 + CTX loading. |
| pos: pérdida permiso no llama Counter | CTX retiro sin fallback ni I/O posterior; COMMAND identity/401/contextChanged. |
| pos: catálogo/ranking/categorías/búsqueda/cantidades | EDIT local/búsqueda/frecuentes sinGET y captura; catálogoV2 `frequentProductIds`. |
| pos: familia POS scenario validaciones | EDIT sin precio disabled/cero/masa/nota; PREVIEW parcial/medidas exactas. Precio manual V1 retirado. |
| pos: snapshots duplicados/producto borrado | EDIT `local requiere descarte... snapshot anterior separado` + unit snapshots congelados. |
| pos: caché crear/editar/volver/abrir sinGET | CONNECT create/canonical list/pickup y CACHE versiones/lista. |
| pos: detalle una vez/recarga versión | CACHE newer version y comandos canónicos; ACTION noGET y selección de orden. |
| pos: catálogo por local/borrador | EDIT `local requiere descarte` con búsqueda sin llamadas; CACHE clave por local. |
| pos: respuesta A no desplaza mesaB | CTX scopeA/B tardío; COMMAND epoch/capture; TABLE Locales respuestas tardías. |
| pos: lectura503/transport conserva copia; auth retira datos | COMMAND errores definitivos vs ambiguos y CACHE epoch; CTX retiro. No se porta transporteV1 de su consola. |
| pos: lecturas concurrentes/generaciones | Caso puro original conservado en pos.spec; CACHE deduplicación. |
| pos: close/void retiran abierta/reconcilian/reabren sinGET | CONNECT close/list sinGET; ACTION canonical void; CACHE proyección closed/voided. |
| pos: anulación relee/exige revisar cambio | ACTION void conflict/recovery ownership. |
| pos: signedout/revoked/otherbusiness limpia | CTX ámbito retirado/A→B; COMMAND401/contextChanged/retire. |
| pos: historial no revierte escritura/contexto | Caso puro original conservado y CACHE. |
| pos: conflicto sin snapshot bloquea hasta revisión | SESSION wrong-order/explicit parent review y ACTION missing/malformed recovery. |
| pos: XInicio/no refresh; filas compactas; ancho/X/caché | NAV y CONNECT viewports/reopen; ACTION mobile. Layout anterior sustituido por UI punto1 aceptada. |
| pos: prioriza mesa/acciones/ticket | EDIT4tipos; ACTION ticket/void; TICKET. |
| pos: wizard3pasos/quitar/deshacer/cero | EDIT captura/unidades/cero y salida explícita; wizardV1 retirado. |
| pos: Dialog móvil largo/teclado/acciones | PAY approved checkout phone/desktop conserva interacciones/overflow sin capturas. |
| pos: cancelar/reabrir cliente/cambio/doble | PAY frozen/remount; CONNECT cancel/reopen; SESSION doble. |
| pos: cliente hint/used_today sin cupón | SESSION raw selection/strict wire; PREVIEW no beneficio; UI de hint/used_today permanece en editor sin ofrecer canje. |
| pos: familias beneficio usa snapshot/base/extras | PREVIEW kernel exacto y PAY mixed source target; TICKET resultado snapshot. |
| pos: nueva selección/review/limpia recibido/exclusión mismoid | PAY revalidation; SESSION personaA/B y targets; QR exclusión local no write global. |
| pos: recibido insuficiente/negativo/precisión/vacío | METHODS buffers, PAY parcial/COP y PREVIEW. |
| pos: capturas Pedido/cobro | Se retira evidencia de imagen por instrucción; EDIT/PAY mantienen viewport/overflow e interacción. |
| pos: cámara duplicada/stop/cancel | QR scanner real trasladado, HTTPV2 y todos tracks cerrados. |
| pos: resolve/revalidation tardíos no reemplazan persona | QR cancel + measured-customer-model cancelar/conservar/doble/401/403/epoch; PAY late QR; SESSION late A/B. |
| pos: guardar mismaorden cliente/dirty | SESSION adopta cliente/revalida sin resolve; ACTION dirty precuenta/nota; EDIT preserve views. |
| pos: familias coupon-state/close failure sin éxito ni autoreenvío | SESSION definite/ambiguous/failedscan; COMMAND4xx/408/5xx; PAY review; ACTION auth/scope. |
| pos: timeout congela y bloquea navegación | PAY frozen/remount; CONNECT Salir disabled; COMMAND uncertain locks. |
| pos: familias invalid benefit/cupón expirado rollback/exclusión | PREVIEW invalid target/mass; PAY changed rule y exclusión; QR inválido. Writes/rollback DB son P3/P6, no se simulan como evidencia. |
| pos: scannererror/cancel/auth | measured-customer-model401/403/cancel/epoch; QR tracks/cancel; SESSION failed explicit scan no anónimo. |
| pos: recuperación fallida por familia/vía | SESSION403 tras ambiguo, wrongDTO/timeout/unreadable; ACTION malformed/missing/withdraw/scope/late; COMMAND immutable retry. |
| pos: C animada/toast/posición/estilo responsive | UI anterior retirada. QR mantiene identificación única y sin éxito tras cancelación; EDIT/PAY viewports. No exige volver al estilo aceptado anterior. |
| pos: descarte confirmar/cancelar | EDIT inspección/salida y local descarte explícito; SESSION/COMMAND bloqueo incierto. |
| pos: Pedido actualizado sólo al guardar | CONNECT sólo feedback guardado tras canónico; EDIT callbacks tardíos/closed recovery. |
| pos: badge retiro conserva pedido | QR quitar cliente no toca session draft; measured-customer-model remove/cancel; PAY late customer. |
| pos: nota crear/editar/conservar/borrar/conflicto/readonly | EDIT nota/vistas/revisión conflict y snapshots; CONNECT conflicto conserva intención; TICKET closed/voided sólo muestra snapshot. |
| pos: acción/icono móvil manifiesto | NAV usa moduleNavigation/manifest; core mantiene acción checkpass:module-primary existente. |
| pos: trial operation rutas/días | TrialNotice no se editó; se retira fixture de consolaV1. No es evidencia nueva de billing/entitlements. |
| pos-printing: BLE gesto/doble/segunda sin lista | TICKET gesto/doble + PRINT BLE sync/filtro/reuse. |
| pos-printing: sin impresora BLE/Serial; notfound/olvidar | PRINT causas/BLE/Serial/forget; TICKET selection/retry; ACTION choose y late. |
| pos-printing: familias cancelled/writefail/notfound | PRINT causas diferenciadas; TICKET cancelled/writefailure/retry. |
| pos-printing: unsupported y opciones documento | TICKET documento oculto exacto antes de window.print; PRINT build opciones y fallback. |
| pos-printing: settings pendiente/error/no defaults | ACTION prepara despuéslista/ajustes off/error; TICKET configuración error/retry. |
| pos-printing: autorización/tardío tras revocar/salir | CTX409 retira; TICKET identity/order/version/status/unmount; ACTION late selection. |
| pos-printing: dirty bloquea imprimir | ACTION mobile dirty usa borrador exacto sin writes: comportamiento actualizado0242; no reintroduce restricciónV1. |
| pos-printing: printingEnabled open/detail | ACTION off/error no bloquea venta; TICKET disabled. Nuevo pos-printing prueba GET/PUTV2 owner/noowner, sin autoactivar módulo. |
| payment-methods: cash/card exactpayload viewports | PAY efectivo/cambio/strict payload, METHODS tarjeta/importe exacto sin recibido,100% y buffers; SESSION strict wire. |
| payment-methods: COP rounded/100% no métodos | METHODS USD/COP100% y PAY currency0; PREVIEW exact money. |
| payment-methods: quitar cliente0→positivo | METHODS caso específico carga unGET métodos y close sin membership/coupon. |
| payment-methods: exclusión0→positivo/preservar método | PAY exclusión explícita; SESSION prepared methods reusable/identity clear. |
| payment-methods: cambiar destino gratis0→positivo | PREVIEW stable source targets; PAY mixed target y SESSION prepare según neto. Selección explícita de source reemplaza productId ambiguo V1. |
| payment-methods: uncertain congela método/pagos/UUID | PAY frozen retry + SESSION deep freeze y403 incierto. |
| tables:7 recorridos Locales | Conservados con todos negativos y sólo se retiraron calls de screenshot. |
| tables: mesa libreviaja/ocupación/id al cambiar | EDIT4tipos tableId; CACHE actualiza ocupación canónica sinGET. |
| tables: nombre libre conserva input/null; sinMesas | TABLE casos vacío/apagado guardan nombre explícito y tableIdnull; no se restaura wizardV1. |
| tables: todasocupadas no nombre/avanzar | TABLE caso explícito todas ocupadas: botón ocupado disabled, sin nombre libre, guardar disabled y0writes. |
| tables: tableoccupied/unknown refresca/líneas | TABLE ambos testsV2 portados íntegros + COMMAND nuevos negativos table/uncertain. |
| tables: local elegido/texto sólo si no mesas | EDIT local explícito + TABLE gestión de locales/tardíos + tabla porlocal del CACHE; no asume Query de Counter retirada. |
| counter/types tests: canRedeem/rewardState/matriz insuficiente | UI y helpers retirados por suspensión explícita. Dominio/históricos quedan; no se portan como botones activos del POS. |
| counter/cart/coupon tests y pos/payment-preview tests | Sustituidos por EDIT, PREVIEW exacto/SESSION y PRINT; import compartido de server/counter.test conserva cartTotal/balance/unitLabel7casos. |

## Límites y siguientes pasos

No se certifican HTTP legacy pendientes P6, DB/P3b, hardware, rendimiento M1,
PWA emisión/canje o copy PWA. No se amplió funcionalidad hacia esas superficies.
El rechazo literal preexistente de frontera queda identificado para coordinador;
no fue escondido como PASS. QA debe inspeccionar matriz y decidir si alguna rama
positiva específica requiere browser adicional; los negativos diferenciales de
mesas, ámbitos, pagos, cámara y comandos se mantienen ejecutables.

## Cierre de comprobaciones

- Selección browser de93 casos en12 specs:92 PASS y1 fallo de fixture móvil
  (contenido sin shell buscaba el botón Nueva orden oculto en390). Se corrigió
  el helper para emitir el mismo evento público del manifiesto en ese harness;
  caso focal1/1 PASS y suite afectada completa6/6 PASS, sin retries/skips.
  No se llama93/93 a la primera corrida; los87 casos no afectados conservan su
  evidencia y los6 afectados se verifican sobre el helper corregido.
- Unit198/198 + pos-cache3/3 PASS; typesUI, ESLint, Prettier y UIguard
  (18 archivos, sin aumentos) PASS. Detector Impeccable: `[]`.
- Selección adicional pos-measured-cart:3 casos funcionales PASS, excluido sólo
  `inspección agrupada` porque conserva calls screenshot fuera de este scope.
  No se declara suite cart completa. No hubo captura en esta entrega.
- `git diff --check` limpio. Búsqueda de imports consumidores Counter/types,
  Counter/scanner y consolas/payment/checkoutV1: cero. Sólo queda Counter/page.
- Proceso: harness efímeros cerrados por afterAll/finally; sin Next/3201/túnel.

Comando browser de la selección93:
`pnpm exec playwright test --config=/private/tmp/p4-playwright.config.cjs counter-mobile.spec.ts counter-coupon-verdict.spec.ts pos-context.spec.ts pos-payment-methods.spec.ts pos-printing.spec.ts pos.spec.ts tables.spec.ts pos-measured-editor.spec.ts pos-measured-payment.spec.ts pos-measured-ticket.spec.ts pos-console-actions.spec.ts pos-connected-console.spec.ts --grep-invert 'native Next'`.
Corrección focal: mismo comando con sólo `pos-connected-console.spec.ts`.
Configuración temporal: testDir absoluto del WT, workers1, retries0,
headlesstrue, reporterlist, screenshot/traceoff, sin webServer.
Logs locales: `/private/tmp/p4-browser-final.log`,
`/private/tmp/p4-connected-final.log`, `/private/tmp/p4-unit-final.log`,
`/private/tmp/p4-cache-unit.log` y `/private/tmp/p4-*-final.log`.

Siguiente paso: QA independiente sobre el SHA de entrega y después combinación.

