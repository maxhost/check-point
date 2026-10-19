# 0242 — CP2d.7 primera conexión funcional de consola V2

Estado: preparada. Autor NUEVO/contexto vacío. Dependencias aceptadas: editor, caché/comandos, cobro y HTTP de lecturas/create/update/close. Base y reserva las fija el coordinador antes de código. Este bloque adelanta la primera conexión real, según instrucción del owner; no esperar ticket/impresión ni activar masa. No subdelegar.

## Resultado y límites

Conectar listado V2 → abrir/crear → editor → cobro → resultado canónico → vuelta al listado con las piezas aceptadas, sin duplicar sus máquinas de estados ni aritmética. Lista abiertas/cerradas/anuladas, selección/local y error/vacío/carga accesibles. Sesiones de editor y cobro viven en el padre por orden e identidad real y conservan intención durante cambios de vista. La misma PosCache y su fachada aceptada sirven lecturas y respuestas de comandos; no mapa alternativo ni GET postwrite para actualizar el resultado. Contexto listo del provider, contrato2, cero GET inicial propio de sesión/módulos. No Number como autoridad para masa/precios/dinero.

Montaje local incremental: mantener entrada legacy por defecto. Dentro del módulo, PosScreen pasa previewEnabled solo cuando NODE_ENV=development a un entry cliente; este selecciona la consola nueva con query posV2=1 únicamente cuando previewEnabled es true. La query no concede permisos: mismo server screen, provider, guard/scope y APIs existentes. No rutas core nuevas ni bypass de auth; producción conserva entrada legacy hasta paridad/cutover posterior. No feature flag global ni nueva infraestructura. Mostrar alcance local de vista previa sin dar por implementada impresión/anulación todavía. Ticket, impresión y enlace de anulación son incrementos posteriores.

Resultado básico usa orden cerrada canónica, total exacto y acreditación/saldo ya recibidos; no inventa regrant ni adapta DTO a legacy. Cobro incierto bloquea salir/seleccionar/crear otra orden; recuperación conserva instancia/body/UUID/capture. Error en callback de resultado no vuelve a cobrar. Error de acceso403 bloquea acciones actuales sin borrar la intención incierta de la misma identidad; solo retiro real/401/scope cambiado retira sesiones. Respuestas tardías y órdenes cerradas/anuladas ajenas nunca sobrescriben otro borrador ni vuelven a abierta.

Antes de código, presentar API/ownership/flujo, montaje local y receta de prueba nativa. No copiar los cientos de líneas de consola legacy; separar vista de listado si el tamaño lo requiere, sin framework nuevo. Kit/COPY/tuteo, referencia0242 y skill Impeccable ya aplicada; leer harden/craft-floor desde principal si faltan archivos no versionados en WT, sin init ni recargar contexto global.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/pos-screen.tsx, solo montaje del entry local compatible.
- apps/merchant/src/modules/pos/ui/pos-entry.tsx.
- apps/merchant/src/modules/pos/ui/measured-console.tsx.
- apps/merchant/src/modules/pos/ui/measured-order-list.tsx.
- apps/merchant/src/modules/pos/ui/measured-order-cache.ts, solo opción explícita para proyectar una respuesta terminal nueva en la ventana local del historial, sin alterar default de callers anteriores.
- apps/merchant/src/modules/pos/ui/measured-order-cache.test.ts, regresiones de esa proyección y límites de día/replay.
- tests/e2e/pos-connected-console.spec.ts.
- tests/e2e/support/pos-connected-console-harness.tsx.
- tests/e2e/support/pos-connected-console-fixture.ts.
- apps/merchant/src/modules/pos/server/console-native.neon.integration.test.ts, fixture nativa propia con setup/inspect/cleanup protegidos.
- docs/factory/0242-cp2d-connected-console-handoff.md.

Extensión explícita previa a código: la fachada aceptada no añade una cerrada nueva a closedToday sin conocer el día local. Padre usa timezone del provider y now explícito para clasificar closedAt canónico real, sin asumir que todo replay recibido ahora se cerró hoy. Opción nueva conserva comportamiento default y monotonicidad, no revive lecturas pendientes ni declara fresco un historial ya invalidado. La consola puede mostrar su misma caché con peek stale sin GET automático. Probar medianoche/zona local, replay de ayer excluido y actualización de fila conocida. No ampliar al helper de cobro ni modificar aritmética.

Sin editar editor/cobro/PosCache/helpers exactos/contratos/backend de producto/legacy/kit/guardias/tooling/dependencias/schema/índices/estados. Si otra dependencia aceptada falla o falta un helper de formato compartido, presentar extensión concreta antes de editar fuera de reserva. Puertos, DB CI y configuración de runner propios se asignan explícitamente; no reutilizar sesiones privadas antiguas ni M0/control/3201/túnel/demos.

## Aceptación y evidencia

Node24, tipos merchant/lint/formato/UIguard y browser focal del flujo conectado con transporte real hasta fetch cuando se use harness. Casos decisivos: Mostrador crea antes del cobro sin Guardar manual, guardar/reabrir otro tipo, volver a lista con canónico sin GET extra, cancelar cobro deja abierta, error ambiguo y remount conservan intención y bloquean nueva selección, conflicto requiere revisión, identidadA→B descarta callbacks viejos. No repetir toda la matriz monetaria aceptada.

Obligatorio un recorrido nativo con Next/auth/HTTP/DB reales, productos unit de fixture propia y entradas privadas actuales: listado → crear → cobrar → resultado → listado, verificar un solo cierre y sus filas canónicas. Añadir cambio real de contexto con petición vieja y rechazo antes de efectos si la receta compatible existente lo permite. No afirmar auth nativa por fetch mock. Este gate es la razón de adelantar el bloque; si infraestructura impide completarlo, informar pronto al coordinador y conservar la distinción con harness, sin dar PASS del recorrido real.

Toda operación DB de fixture solo tools/neon-test.sh con CI seleccionada; setup/inspect/cleanup seriales y reserva exclusiva hasta teardown completo de negocios/owners/sesiones/procesos. Servidor nativo recibe únicamente configuración CI validada seleccionada, sin copiar env productivos ni imprimir credenciales/cookies/scope/QR. Usar receta privada compatible del piloto scope-client como referencia, no sus sesiones retiradas. Proponer receta exacta antes de arrancar DB/servidor.

Fuente congelada antes checks, no editar mientras corren. Evidencia SHA/base/config/runtime/lockfile y logs fueraWT, fallos/skips conservados. Una inspección390/1280 con capturas ABIERTAS y máximo una confirmación; preservar capturas finales fuera de carpetas que limpia el runner. Runner Chromium propio con escalación acotada autorizada por MachPort1100; gitdir/ps EPERM se avisa y resuelve sin esperar owner. QA NUEVO independiente, autor conserva fixes. Sin fullverify/M0/M1, activación mass, push ni PROD.
