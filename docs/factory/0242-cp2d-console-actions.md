# 0242 — CP2d.8 conectar ticket, impresión y anulación a la consola local

Estado: preparada. Autor NUEVO/contexto vacío tras aceptar ticket CP2d.6. Requiere consola conectada CP2d.7 y HTTP void aceptados. Coordinador fija base, worktree y reserva antes de código. No reutilizar el autor de consola para este trabajo nuevo; fixes del bloque permanecen con su autor hasta QA.

## Resultado y contrato previo

Completar el incremento de la consola local aceptada con precuenta, resultado/ticket cerrado, reimpresión y anulación de abierta. Usar MeasuredTicket/useMeasuredPrinting y HTTP void aceptados; no duplicar builder, transportes, caché o dominio. Proponer API/ownership/estados del comando void y carga de ajustes antes de implementar. Preview local mantiene su gate development/posV2; default/producción legacy, sin cutover ni masa activada.

Hook de impresión recibe identidad real, cliente V2 y orden seleccionada. prepare solo después de lista usable y al abrir detalle/resultado; cero GETticket en camino crítico inicial. Documento/ajustes listos antes del gesto. Elegir solo selecciona; imprimir/reintentar requieren gesto separado. Resultado cerrado conocido conserva estado ante errores de impresión, nunca vuelve a acreditar/cobrar. Callbacks tardíos de otra orden/contexto no abren diálogo ni imprimen; feedback y browserDoc del mismo owner, sin ticket viejo al cambiar selección.

Anular disponible únicamente para una orden abierta autorizada, con confirmación explícita. Cancelar diálogo no escribe. Congelar id/versión/body y captura de transporte antes de await; doble toque comparte intento. POST void V2 envía versión; éxito/replay aplica orden V2 canónica a la misma PosCache/fachada con ventana de día local explícita, sin GET postwrite automático. Anulada no puede reabrirse ni cobrarse. Cerrada no ofrece anulación. Conflicto conserva orden actual para revisión, sin retry automático; 404/scope/401 manejan sus retiros existentes. 403 de la misma identidad bloquea acciones sin liberar un intento incierto.

Error de red/timeout/respuesta no canónica de void conserva incertidumbre y misma captura/body/id; no permite abandonar ni iniciar cobro/create/update/anulación de otra orden hasta recuperación explícita o retiro real de identidad. Reintento del mismo void es idempotente en servidor, no inventar UUID/clientRequestId que el contrato no acepta. Una respuesta tardía no sobreescribe el estado de otra identidad/orden. No reutilizar la máquina de cobro para anular ni introducir un framework genérico de comandos.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/measured-console.tsx, solo cableado de acciones y componentes aceptados.
- apps/merchant/src/modules/pos/ui/measured-void-action.ts, owner/controlador focal si necesario.
- apps/merchant/src/modules/pos/ui/measured-void-action.test.ts, transiciones decisivas si necesarias.
- tests/e2e/pos-console-actions.spec.ts.
- tests/e2e/support/pos-console-actions-harness.tsx.
- tests/e2e/support/pos-console-actions-fixture.ts.
- docs/factory/0242-cp2d-console-actions-handoff.md.

Sin editar entry/montaje/servidor/contratos/kit/guardias/schema/tooling/deps/estados/índices, ni helpers aceptados de ticket/impresión/editor/pago/caché. Si el file-size exige dividir una vista, proponer path concreto antes editar; no esconder rojo ni copiar consola completa. Defecto de dependencia aceptada vuelve al coordinador antes de ampliar scope.

## Aceptación y evidencia

Node24, tipos merchant/lint/formato/UIguard. Browser focal conectado con transporte real hasta fetch para observar bodies/capturas: abierta→precuenta, closed→reimpresión/resultado sin cobrar otra vez, printingEnabled/error/retry, choose sin impresión hasta gesto, tardíoA→B suprimido; anular confirm/cancel/doubleclick, éxito/replay lista/DTO canónico sin GET, stale requiere revisión, request perdida→retry idéntico/remount/403 conserva incertidumbre y bloquea navegación/nuevo cobro, contexto real retira. Verificar cero POST close/create/resolve/regrant/redención por imprimir o anular. No repetir matriz de builder, hardware ni dominio void; evidencias previas compatibles se reutilizan. Estos casos prueban cableado, no se presentan como nuevo auth/DB nativo ni venta mass canónica.

Inspección agrupada390/1280 con capturas ABIERTAS, máximo una confirmación. Preservar imágenes externas fuera del output autolimpio. Impeccable ya aplicada/contexto root una vez, leer harden/craft-floor sin init/rerun/drift; kit/COPY/tuteo. Fuente congelada antes checks, no editar con runners vivos; evidencia SHA/base/config/runtime/lock/logs/exits/fallos/skips, cero procesos. SIN DB/env/wrapper/Nextbuild/fullverify/M0/M1. Chromiumrunner propio escalado por MachPort1100 autorizado; gitdir/psEPERM avisar y resolver acotado. QA NUEVO independiente; autor conserva fixes hasta aceptación. Sin push/PROD/3201/túnel/demos ni artefactos ajenos.
