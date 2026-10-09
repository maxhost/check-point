---
spec: 0183
fecha: 2026-10-09
estado: cerrada
resumen: Escanear pase desde Pedido, conservar cliente y cupón solo en memoria y confirmar cierre y acreditación desde un modal de cobro con cambio y regla del programa.
disjunta: no
archivos: apps/merchant/src/ui/dialog.tsx, apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-checkout.tsx, apps/merchant/src/app/backoffice/pos/pos-coupon.tsx, apps/merchant/src/app/backoffice/pos/pos-ticket.tsx, apps/merchant/src/app/backoffice/pos/pos-scan.tsx, apps/merchant/src/app/backoffice/pos/pos-payment.ts, apps/merchant/src/app/backoffice/pos/pos-payment-preview.ts, apps/merchant/src/app/backoffice/pos/pos-payment-preview.test.ts, tests/e2e/pos.spec.ts, tests/e2e/support/pos-counter-harness.tsx
---

# 0183 — Escanear pase y confirmar cobro en POS

**L3**, por reorganizar el flujo completo de dinero, cupón y acreditación con
cancelación, concurrencia y reintentos. Owner cerró el producto en conversación.
Esta entrega es **solo especificación y checkpoint**. Después del clear, primero
se redacta el plan de implementación; todavía no se conecta ningún botón.
Implementador y revisor independientes según AGENT-WORKFLOW; no nuevo ADR:
consume las decisiones vigentes, sin cambiar arquitectura, API ni persistencia.

## Problema

- pos-editor.tsx tiene QR e impresora visuales; QR todavía no tiene acción.
- Cobrar invoca onCheckout y cambia a una pantalla separada. pos-checkout.tsx
  mezcla escanear, identificar, calcular cambio y cerrar; resolved vive dentro
  de ella y se pierde al desmontarla.
- No se puede escanear, regresar a Pedido con cliente/beneficio visibles y abrir
  después una confirmación de cobro cancelable que conserve ese contexto.
- La pantalla actual no presenta regla y cantidad de acreditación juntas.
- El cierre tiene UUID/cuerpo congelados y transacción existente: hay que
  conservar sus garantías al reorganizar la UI, sin cobro implícito.

## Decisiones del owner

1. Cliente selecciona un cupón en my.checkpass.club y muestra su QR. Tener un
   cupón no es requisito: CheckPass sin cupón permite identificar y acreditar.
2. Mesero pulsa QR desde Pedido; abre escáner; resolver identifica y valida.
3. Volver a Pedido con cliente, beneficio y total previsto. Asociación temporal
   de ese POS con esa orden: no guardada en la orden, compartida ni restaurada.
4. Cobrar abre un modal: importe, Recibido numérico, cambio, regla del programa
   y cantidad que se acreditará. Ejemplo: «1 sello por compra» / «Se acreditará:
   1 sello». Cancelar cierra y conserva contexto; no confirma nada.
5. **Confirmar cobro** es la única acción que cierra, asocia venta/cliente,
   consume el cupón y acredita puntos/sellos. Todo lo decide el servidor.
6. Salir de esa orden o recargar pierde el contexto temporal. Cambiar tab y
   cancelar el modal lo conserva. No asociar por persistencia de navegador.

## Alcance

**Entra:** conexión QR, pantalla de escáner reutilizada, contexto temporal por
orden, cliente/beneficio en Pedido, previsualización y modal de confirmación,
calculadora de cambio, errores, accesibilidad, aislamiento y reintentos.

**No entra:** acciones de la impresora nueva (sigue visual, modal de acciones
conserva impresión existente), mesas de 0182, medios de pago, propinas, pagos
parciales/divididos, fiscalidad, canje de premios, cambios de programa/Mostrador,
nuevas rutas o migraciones, modificar servidor/paquetes, ampliar kit fuera de la
variante de pantalla completa de Dialog autorizada abajo, polling de órdenes,
autosave, nuevos colores/dependencias, almacenamiento local o publicación.

## Contrato existente y límites comprobados

Fuentes de lectura: 0169, counter/types.ts, server/counter/resolve.ts,
server/counter/coupon-discount.ts, server/counter/grant-coupon.ts,
server/pos/close.ts y sus rutas. No se modifican fuentes servidor.

| Acción | Contrato | Uso |
|---|---|---|
| Resolver pase | POST /api/pos/resolve `{ qrToken, locationId? }` | ResolveResponse: nombre, membership.id, program.kind/accrual, couponState |
| Revalidar cupón | GET /api/pos/coupon-state?membershipId=… | `{ couponState }`, sin cerrar ni consumir |
| Cerrar | POST /api/pos/orders/:id/close | `{ clientRequestId, version, membershipId?, coupon?: { couponId, productId? } }` → PosOrder |
| Recuperar orden | GET /api/pos/orders/:id | Snapshot autoritativo ante conflicto/cierre ajeno |

**Importante: resolver NO es una consulta pura.** Hoy resolveScan puede crear
membresía con saldo cero/proyección de cliente y actualiza last_scan_at. Esta
spec conserva el contrato existente. «No pasa nada hasta cobrar» se concreta
sobre la **venta y sus beneficios**: no cierre, asociación persistida de la
orden, canje/consumo ni acreditación antes de confirmar. No prometer cero
escrituras en DB al escanear; exigirlo requeriría otra spec de servidor/Claude.
Cancelar no revierte el alta/visita existente del escaneo.

No usar POST /api/pos/coupon-remove para simplemente descartar el beneficio en
esta UI: esa ruta modifica la selección del cliente. La exclusión es local.
No enviar importes, cambio, regla ni unidades calculadas en el cuerpo de cierre.

### Autorización y aislamiento

Guard POS actual: sesión, negocio, permiso pos, gates existentes y módulo activo.
Local para resolve es el de la orden guardada, nunca el elegido posteriormente
en el listado. Id de orden/membership/coupon solo desde sus respuestas del mismo
contexto. No /api/counter/grant ni otros endpoints de escritura de Mostrador.
401/403 revocan contexto, diálogos y cámara; no se interpretan como error local
recuperable. Un 403 foreign_membership invalida la asociación de ese cliente y
exige nueva identificación, sin convertirlo en cobro anónimo automáticamente.

## Diseño y estados

### Propiedad del estado

PosConsole mantiene una única sesión de cobro en memoria, mediante pos-payment.ts,
para la orden abierta seleccionada. PosEditor la consume y dispara QR/Cobrar;
PosCheckout pasa a ser presentación del modal, sin otra fuente de resolved.
Separar lógica de I/O/estado, preview puro y presentación. No duplicar cálculos
entre total de Pedido y modal. Todas las operaciones async llevan generación
por orden/cliente y guard síncrono de acción: respuestas tardías no se aplican a
otra mesa, ni a cliente reemplazado, ni después de cancelar escáner/salir.

Estados: idle → scanning → resolving → ready; ready/idle → preparingPayment →
paymentOpen → closing → closed. Cancelar scanner vuelve a estado anterior;
Cancelar pago vuelve a ready/idle; fallo definitivo vuelve a paymentOpen con
error revisable. Timeout/red/5xx al cerrar → closeUncertain → retry SAME attempt.

Mantener aparte: resolved, couponState, producto elegido del beneficio, exclusión
local del cupón por id, Recibido, estado de modal/cámara, error y intento de cierre.
No conservar/loguear QR fuera del tiempo necesario para resolver. No prometer
recuperación de contexto ni de intento tras recarga: no hay persistencia nueva.

### QR y resolución

QR habilitado con orden guardada, abierta, no vacía, sin dirty/conflicto/cierre en
curso. No guarda modificaciones implícitamente: si dirty, aviso para guardar.
Escáner en Dialog del kit a pantalla completa, título «Escanear pase», X/Cancelar
y QrScanner existente. Por decisión del owner del 2026-10-09 se retira la entrada
manual «Código del pase» / «Leer pase», con su label y ayuda. Si se deniega la
cámara, explicar el error y permitir cancelar/reabrir tras habilitar el permiso;
no inventar identificación sin escaneo. Una lectura por montaje; desmontar cámara al detectar, cancelar, resolver, cambiar
orden o revocar sesión. Un guard evita dobles lecturas simultáneas.

Resolver bien sustituye contexto anterior, limpia selección local del beneficio
anterior y Recibido, cierra scanner y vuelve a Pedido. Muestra nombre y beneficio
claros cerca del listado/total, sin repetir controles ni datos internos del DTO.
Error conserva orden y contexto anterior; muestra mensaje y reintento explícito,
sin fingir escaneo exitoso. Cancelar scanner no borra cliente anterior.

«Quitar cliente» borra contexto local y restaura total bruto; «Quitar beneficio»
conserva cliente, excluye ese cupón en memoria y restaura importe/acreditación base.
Reescanear sustituye contexto. Cambiar Editar/Pedido y guardar esa misma orden
conserva asociación; recalcula sobre nuevo snapshot guardado. Si el producto
requerido desaparece o baja su cantidad, muestra el requisito y bloquea incluir
ese beneficio hasta corregir o excluirlo. No añadir productos/regalos en silencio.

### Cupón y total de Pedido

none: cliente sin cupón. hint: indicar que puede seleccionarlo en su app;
used_today: mostrar aviso y continuar sin cupón. selected inválido: mostrar razón,
no aplicar descuento; requerir excluir beneficio explícitamente antes de cobrar
sin él. Cliente sigue identificado. selected válido: mostrar etiqueta y beneficio.

free_product/two_for_one sin productId: selector de producto con ids presentes en
la orden; se requiere elección. Con productId fijo ausente: pedir editar orden o
excluir cupón. 2x1 requiere al menos 2 unidades **de la primera línea coincidente**,
como decide el servidor; no sumar snapshots diferentes para pasar la regla.

Preview pos-payment-preview.ts opera con centavos y snapshots en orden original,
sin reprecificar ni usar catálogo de resolve para sustituir líneas. Descuentos:
percent = floor((brutoCentavos × porcentaje + 50) / 100); amount = min(descuento,
bruto), misma moneda; free_product/2x1 descuentan una unidad de la primera línea
coincidente; custom/extra_* no reducen importe. Neto nunca negativo. Rechazar datos
no finitos/monedas incompatibles y mostrar error, sin convertirlos a cero válido.
No usar la suma por productId de productCart para decidir precio o elegibilidad.

program.accrual y previewUnits/unitLabel existentes determinan el preview base:
per_purchase = grant; per_amount = floor(neto / blockAmount) × grant. La regla
se muestra con moneda/unidad/singular/plural. Valores desconocidos o inválidos
no se traducen a «0» como promesa: bloquear ese cobro con cliente y explicar error.
Extra_stamps/extra_points válidos se muestran separados: acreditación base del
programa + extras del cupón (no confundir sale.unitsGranted con extras); total
previsto agregado si son de la misma unidad. Cero legítimo se muestra como cero;
orden no vacía con neto 0 puede cerrarse según contrato existente.

El importe y unidades son **previsión** del snapshot: no existe endpoint de quote
ni reserva. El modal lo señala brevemente; cierre revalida y resultado manda.
Cambios externos de programa pueden cambiar acreditación final; no ofrecer una
garantía que el contrato actual no entrega. No añadir rutas de quote en esta spec.

### Modal Cobrar

Dialog ocupa toda la pantalla, igual que el scanner. El contenido puede
desplazarse dentro del viewport disponible, también con teclado abierto.

Solo abre sobre snapshot guardado/no vacío/no conflictivo, sin cerrar. Revalidar
coupon-state al abrir si hay cliente; sin cliente no requiere esa lectura.
No sondeo nuevo periódico: lectura al resolver, al abrir modal y recuperación de
error de cupón. Una revalidación fallida bloquea confirmar hasta reintentar o
cancelar; nunca quitar beneficio ni cambiar a anónimo automáticamente.

Si cambia cupón/veredicto, mostrar actualización y nuevo preview ANTES de permitir
confirmar; limpiar Recibido cuando cambia importe. No anexar silenciosamente otro
cupón: nueva selección exige revisión explícita del mesero. La exclusión local de
un id se mantiene ante relectura del mismo; otro id vuelve a revisión.

Contenido: importe, cliente/beneficio si existen, NumberField «Recibido», cambio,
regla y «Se acreditará(n): N sello(s)/punto(s)» con desglose de extras si corresponde.
Sin cliente, no presentar acreditación ni inventar cliente anónimo. Recibido es
calculadora opcional (como 0169), no registro de pago; vacío permite confirmar.
Valor introducido debe ser finito, no negativo y tener hasta 2 decimales; si es
menor al neto, mostrar «Faltan: …» y deshabilitar Confirmar. Cálculo en centavos.
Neto/Recibido iguales → cambio 0. El cálculo no entra a API ni DB.

Cancelar/X/Escape/clic afuera antes del envío cierran y conservan cliente/cupón;
Recibido se conserva si mismo snapshot/importe al reabrir. No GET/POST de cierre
por Cancelar. Volver a abrir revalida cupón otra vez.

Confirmar cobro: una sola llamada. Mientras closing, botón cargando, sin doble
confirmación; Cancelar/X/Escape/clic afuera y edición/escaneo bloqueados. Preservar
UUID/cuerpo congelados y relación con order.id, version, membershipId y couponId.

### Cierre, concurrencia y fallos

- Éxito: usar PosOrder devuelto, cerrar modal, limpiar contexto y publicar snapshot
  mediante cache/resultado existentes. Mostrar total/acreditación finales de sale,
  con extras separados; no éxito optimista ni saldo calculado localmente.
  `sale.unitsGranted` es la base y `sale.coupon.extraUnits` el extra: sumar para
  mostrar el total, nunca restar extras de la base (contrato existente verificado
  en `server/pos/read.ts` → `counter/grant.ts::toResult`).
- Red/timeout/5xx: resultado incierto. Mantener modal y contexto bloqueados con
  «Reintentar cobro»; mismo UUID y cuerpo exacto, incluso si cupón cambió fuera.
  No otro intento, nueva orden, edición ni cliente distinto hasta resolver.
  Advertir antes de navegación/recarga mientras incierto; sin persistencia nueva.
- 409 version_conflict: no éxito, invalidar intento definitivo, recuperar snapshot
  y usar revisión de conflicto existente. Reabrir cobro exige nuevo snapshot y
  revisión; no autosave ni cierre automático sobre versión nueva.
- 409 pos_order_not_open: GET de orden. Si cerrada, mostrar resultado autoritativo;
  si anulada, mostrar anulación. No afirmar que la cerró este mesero. Sin otro POST.
- 409 request_reused: error definitivo, sin éxito falso; nuevo UUID solo tras
  recuperar/revisar y confirmación explícita, no reintento automático.
- Cupón cambiado/expirado/usado/límite/programa incompatible: rollback mantiene
  orden abierta; revalidar y mostrar motivo, nueva revisión o exclusión local
  explícita antes de otra confirmación. Nunca repetir sin cupón silenciosamente.
- 422 empty_cart/invalid_input, producto/quantity/moneda: conservar orden, explicar
  requisito, exigir corrección. 404 unknown_pos_order elimina recurso/contexto;
  no_program conserva orden pero bloquea acreditación hasta reescanear o quitar
  cliente explícitamente. GET coupon-state not_found invalida cliente, no la mesa.
- Resto de 4xx definitivos: mensaje de servidor y corrección explícita; no retry
  ciego. Manejo por operación/código para no confundir no_program con orden ausente.

El servidor 0169 conserva transacción/locks, idempotencia, rollback y afterGrant
solo tras commit. UI no envía saldo/unidades ni cambia snapshots. No nuevo efecto
por impresión, abrir modal, cambiar tab o calcular cambio.

### Accesibilidad, móvil y compatibilidad

Kit Dialog/NumberField/Button/Text, tokens/Tailwind y headerAction existente;
no nativos/eventos nativos nuevos ni CSS crudo en pantallas. El owner autorizó
explícitamente a GPT el 2026-10-09 a añadir esta variante puntual de Dialog en
el kit (excepción a la zona de Claude); los demás diálogos conservan su default.
La variante limita altura al viewport disponible y permite scroll; ocupar toda
la pantalla por sí solo no sustituye ese requisito al aparecer el teclado. Foco dentro del modal, retorno
al QR/Cobrar al cancelar, estados/errores anunciados sin duplicar anuncios.
Móvil 390 px y 320 px: sin overflow horizontal, teclado y modal con acciones
alcanzables mediante scroll. Si falta una capacidad al kit, pedirla a Claude;
no suplirla con estilos fuera de su zona. Respetar movimiento reducido.

Mostrador, nueva orden y búsqueda/sticky/footers actuales mantienen presentación.
El antiguo view checkout se reemplaza por modal POS, sin una segunda ruta de cierre.
Impresión sigue mostrando datos guardados; no incluir contexto temporal como si
fuera venta confirmada. tableId de 0182 debe preservarse como dato ajeno al cambio.

### Arquitectura de referencia

ADR 0033 (alta por escaneo), 0119 (cupón elegido y unido a venta), 0120 (veredicto
servidor), 0123 (kit/guardias), 0128 (dev/live), 0129 (L3), 0130 (POS separado de
acreditación); contratos 0169/0182 y tipos públicos existentes. Sin nueva decisión
transversal que requiera un ADR adicional.

## Archivos y responsabilidades

| Archivo | Acción |
|---|---|
| apps/merchant/src/ui/dialog.tsx | Variante fullscreen con scroll/viewport; default conservado, excepción puntual autorizada |
| pos-console.tsx | Propietario de sesión transitoria, navegación, snapshot y resultado |
| pos-editor.tsx | QR/Cobrar, cliente/beneficio y total en Pedido |
| pos-payment.ts (nuevo) | Máquina de estados, generación, revalidación y cierre idempotente |
| pos-scan.tsx (nuevo) | Vista scanner fullscreen por cámara, errores/foco; sin entrada manual |
| pos-checkout.tsx | Modal de confirmación, calculadora y regla/acreditación |
| pos-coupon.tsx | Beneficio/requisitos y exclusión local, sin coupon-remove |
| pos-ticket.tsx | PosResult: acreditación final base + extras separados desde sale, sin cambiar impresión |
| pos-payment-preview.ts / .test.ts (nuevos) | Preview puro y tablas de dinero/acreditación |
| tests/e2e/pos.spec.ts | Escenarios observables de flujo, API/errores/regresión |
| tests/e2e/support/pos-counter-harness.tsx | Fixtures que consumen contrato vigente |

Rutas abreviadas arriba son apps/merchant/src/app/backoffice/pos salvo tests;
frontmatter contiene lista completa. No tocar servidor, API, paquetes, migraciones o tooling; en el kit únicamente
Dialog para la variante fullscreen expresamente autorizada por el owner. **No disjunta** con 0170/0178/0181 (mismos componentes).
0182 servidor ya implementado: preservar DTO; UI de mesas no forma parte del cobro.
Un implementador para la feature; revisión independiente después, no edición
concurrente de archivos compartidos. Esta sesión no despacha implementación.

## Definition of Done

- [ ] QR abre scanner y detiene cámara al resolver/cancelar; doble lectura → un resolve.
- [ ] Scanner exitoso vuelve a Pedido con cliente/beneficio/preview correctos;
      no POST close ni grant, ni coupon-remove antes de Confirmar.
- [ ] Cancelar modal conserva contexto sin efectos de venta; salir pierde contexto;
      cambiar mesa/cliente no recibe respuestas tardías de otro contexto.
- [ ] Dinero/regla/unidades y extras correctos en casos de la tabla de preview.
- [ ] Confirmar envía un cierre; pérdida de respuesta reintenta misma clave/cuerpo.
- [ ] Conflictos, auth, cupón inválido y cierre ajeno no muestran éxito falso,
      ni cambian payload de reintento, ni degradan a cobro sin cliente/beneficio.
- [ ] Regresión POS nuevo/Editar/Pedido/Mostrador y UI mobile/keyboard verificadas.
- [ ] Typecheck/lint/formato/guardia/números verdes, pruebas relevantes y gate global
      registrado; pnpm verify con Node24 antes de live según ADR0128/0129.
- [ ] QA del owner con pase/cupón reales en DB local aislada y PASS independiente.
      No estado implementada por inferencia ni publicaciones sin nueva autorización.

## Plan de pruebas y verificación

**Unitarias preview (casos de entrada/salida fijados):** bruto11.58, recibido20 →
cambio8.42; recibido11.58 →0; insuficiente bloquea; vacío opcional; importe negativo/
NaN y monedas incompatibles rechazados. Descuento10% sobre10.05 →1.01/neto9.04;
descuento fijo mayor a bruto →neto0. Una compra/grant1 →1 sello; 1 punto por cada
2, neto9.04 →4; neto0/per_purchase →grant; extras muestran base+extra por separado.
Producto ausente/2x1 con1 requiere corrección; primera de dos líneas con mismo
producto/precios distintos determina descuento, sin agregarlas. Malformed accrual
no se muestra como cero normal. Esperados concretos, no tests espejo de helper.

**E2e:** sin cliente; cliente sin cupón; discount percent/amount; free_product y
2x1 fijo/no fijo; custom; extra_stamps/extra_points; none/hint/used_today/invalid.
Cancelar y reabrir conserva contexto/cambio, verifica cero cierres; nueva selección
externa exige revisión. Edición posterior conserva cliente y recalcula snapshot.
Doble confirmar; scanner duplicado; respuesta tarde de mesa A no pinta B; timeout
tras respuesta de cierre perdida reenvía mismo UUID/cuerpo; 409/404/401/403/5xx;
moneda/producto inválido; cupón cambia/expira entre revisar y confirmar. Validez no
se finge vía mocks incompatibles con servidor. Scanner fake verifica tracks.stop.
Capturas 390/320 px y teclado real con acciones alcanzables y foco de regreso.

**Servidor existente:** preservar oráculos transaccionales 0169; no cambiarlos
para hacer UI verde. Neon específico solo con tools/neon-test.sh (nunca
DATABASE_URL de producción), por revisor/Claude si el gate requiere integración.
No nueva suite servidor por conveniencia de UI.

**Comandos después de implementación (no ejecutados ahora):**

```sh
source ~/.nvm/nvm.sh
nvm use
pnpm typecheck
pnpm exec eslint apps/merchant/src/app/backoffice/pos/pos-console.tsx apps/merchant/src/app/backoffice/pos/pos-editor.tsx apps/merchant/src/app/backoffice/pos/pos-checkout.tsx apps/merchant/src/app/backoffice/pos/pos-coupon.tsx apps/merchant/src/app/backoffice/pos/pos-scan.tsx apps/merchant/src/app/backoffice/pos/pos-payment.ts apps/merchant/src/app/backoffice/pos/pos-payment-preview.ts apps/merchant/src/app/backoffice/pos/pos-payment-preview.test.ts tests/e2e/pos.spec.ts tests/e2e/support/pos-counter-harness.tsx
pnpm exec prettier --check apps/merchant/src/app/backoffice/pos/pos-console.tsx apps/merchant/src/app/backoffice/pos/pos-editor.tsx apps/merchant/src/app/backoffice/pos/pos-checkout.tsx apps/merchant/src/app/backoffice/pos/pos-coupon.tsx apps/merchant/src/app/backoffice/pos/pos-scan.tsx apps/merchant/src/app/backoffice/pos/pos-payment.ts apps/merchant/src/app/backoffice/pos/pos-payment-preview.ts apps/merchant/src/app/backoffice/pos/pos-payment-preview.test.ts tests/e2e/pos.spec.ts tests/e2e/support/pos-counter-harness.tsx
node tools/ui-guard.ts
node tools/check-numbers.ts
pnpm exec vitest run apps/merchant/src/app/backoffice/pos/pos-payment-preview.test.ts
pnpm exec playwright test tests/e2e/pos.spec.ts tests/e2e/counter-mobile.spec.ts tests/e2e/counter-coupon-verdict.spec.ts
tools/neon-test.sh apps/merchant/src/server/pos/pos-close.neon.integration.test.ts
tools/neon-test.sh apps/merchant/src/server/pos/pos-close-races.neon.integration.test.ts
tools/neon-test.sh apps/merchant/src/server/pos/pos-close-reuse.neon.integration.test.ts
pnpm verify
```

Neon coordinar con Claude/revisor, sin tocar código ni secrets del servidor.
Verify para entrega L3 coordinada sin pisar dev:local activo y antes de live.
El plan post-clear fija baseline y disponibilidad de puertos/DB; no iniciar suites
contra ambiente equivocado. No se declara PASS por la existencia de comandos.

Presupuesto de mutaciones **2**, del revisor: (1) reintento genera UUID/cuerpo nuevo
→ e2e de respuesta perdida debe fallar por igualdad de request; (2) Cancelar invoca
close → e2e cero escrituras debe fallar por conteo POST. Guardar hash/diff y bitácora,
revertir cada una; no admitir fallo de setup como prueba. Sin mutaciones ahora.

## Handoff y estado

Checkpoint: docs/handoff-0183-pos-cobro-retomar-2026-10-09.md. Tras clear leerlo y
esta spec; **primera acción funcional es armar plan de implementación**, no código.
Producción grade requiere evidencias, no omitir tests por preferencia de ajustes
L0: esta feature nueva define su verificación específica. No ejecutar tests hoy.
Spec cerrada/reservada localmente en dev; no merge/push. Revisor independiente
usa AGENT-WORKFLOW antes de marcar implementada.

## Abierto

Ninguna decisión de producto pendiente para este alcance. Límites conocidos y
cerrados: resolve tiene alta/visita existentes; previews no son quote garantizado;
cliente/cupón/intento no se restauran tras recarga; impresora visual fuera del scope.
Si owner exige consulta estrictamente sin escrituras o quote garantizado, cambia
el alcance y se solicita contrato HTTP a Claude antes de implementar esa variante.

## Ajuste visual L1 — transición de identificación (2026-10-09)

Pedido por owner después del PASS automatizado. Mini plan cerrado antes del código:

- `pos-scan.tsx` reemplaza texto visible Identificando cliente por pantalla intermedia
  fullscreen con la C oficial de CheckPass centrada, animación de pulso y
  `motion-reduce:animate-none`. Estado anunciado solo a lectores de pantalla.
  Cancelar sigue alcanzable; resolución permanece en modal hasta terminar.
- `pos-payment.ts` publica aviso Cliente identificado únicamente tras resolve exitoso
  vigente. Aviso temporal con Toast existente, descartable; nuevo escaneo limpia aviso.
  Errores y cancelaciones no generan aviso exitoso ni consumen respuestas tardías.
- Prueba puntual en `tests/e2e/pos.spec.ts`: mantener resolve pendiente, observar
  logo/loading sin texto visible ni toast prematuro; al resolver vuelve a Pedido y
  muestra toast. Cancelar sigue protegido por generaciones existentes.
- Verificar typecheck, lint/formato y guard de archivos tocados, pruebas específicas
  de transición/cancelación, captura visual. Sin suite global ni subagentes (ADR0129).

Solo presentación y aviso; sin retraso mínimo artificial, cambios de dinero,
contratos, kit, persistencia o permisos. La spec principal conserva sus pendientes.

### Corrección L1 — toast visible al volver (2026-10-09)

Owner observa toast ausente. `globals.css:4366` hace estático todo Toast bajo
counter-flow: pos-scan está al final del pedido, por lo que el aviso queda después
del contenido y fuera del viewport con pedidos largos. Corrección acordada:
reutilizar Toast existente con utilidades de posición fixed explícitas, centrado
arriba del viewport, sin CSS/kit nuevo. Regresión con pedido largo verifica aviso
realmente dentro del viewport y posición fixed tras volver del escáner. Sin
cambiar resolve, duración ni mensajes. Lint/typecheck y prueba puntual L1.

### Ajuste L1 — confirmaciones consistentes (2026-10-09)

Owner define misma apariencia que Producto añadido: cápsula oscura, móvil abajo
al centro y desktop arriba derecha. Mini plan cerrado: extraer presentación a
`app/components/confirmation-toast.tsx`, adaptador del Toast existente (sin
modificar kit). Props message/onDismiss/durationMs; sin className para evitar
variantes por pantalla. Usarlo en pos-editor y pos-scan. Móvil bottom24, desktop
md top6/right6. Mantener tiempos existentes y anuncio accesible. Documentar en
design-system que nuevos avisos de confirmación reutilizan ConfirmationToast;
errores y operaciones pendientes conservan su contrato existente.

Prueba específica compara estilos y posiciones reales de ambos avisos a390/1280,
además de regresiones loading/cancelación/pedido largo. Lint/typecheck/formato y
guardia de archivos modificados. Sin dinero/requests/CSS/kit ni suiteglobal.

### Ajuste L1 — descartar edición del pedido (2026-10-09)

Owner define botón rojo X Iconoir inline junto a Guardar cambios en Editar,
visible cuando hay borrador modificado. Mini plan cerrado antes del código:
`pos-editor.tsx` usa Button danger existente, tamaño48/circular, nombre accesible
Descartar cambios. Abre Dialog existente título Descartar cambios. Cancelar o
Escape cierran y conservan borrador/Editar. Confirmar restaura el snapshot
actual de order (mesa/local/líneas/precios/lineId), limpia eliminaciones/aviso de
producto, cierra modal, pasa a Pedido y publica ConfirmationToast Pedido
actualizado según texto explícito owner. No PUT/POST/GET al descartar; cliente y
beneficio temporales conservados. Controles bloqueados si busy. Nueva orden y
salida al listado conservan sus comportamientos. Kit/API/CSS intactos.

Prueba específica móvil: controles inline, cancelar conserva cantidades/tab y
cero escrituras; confirmar restaura snapshot/tab y toast consistente, ausencia
de Guardar cambios después. Captura visual, typecheck/lint/formato/guard
específicos; sin suiteglobal ni subagentes.

### Corrección L1 — aviso solamente al guardar (2026-10-09)

Owner corrige decisión anterior: descartar vuelve a Pedido sin toast; Pedido
actualizado corresponde solamente a Guardar cambios exitoso de orden existente.
Mini plan: retirar aviso del descarte y limpiar aviso anterior, publicarlo tras
onSave exitoso y apply(result) al volver a Pedido; fallo no publica éxito. Nueva
orden/Guardar y salir conservan flujos existentes. Adaptar oráculo descarte a
cero avisos y probar guardar fallido/exitoso. Sin kit/API/CSS/dinero nuevos.

### Ajuste visual L0 — acciones de la orden (2026-10-09)

Owner elimina Imprimir precuenta del modal Acciones de la orden. Queda Anular
con Button danger existente. Texto con borrador pasa a Guarda los cambios antes
de anular. Handler/confirmación de anulación y bloqueos busy/dirty/conflict
intactos; no tocar botón Imprimir de Pedido ni trabajo concurrente0184. Adaptar
regresión que invocaba la opción retirada, conservar render de ticket en media
print. Lint/typecheck específicos y diff; sin nueva suite global ni kit/API.

### Ajuste L1 — cápsula de cliente en Pedido (2026-10-09)

Owner pide agrupar cliente identificado en badge similar a mesa/pestañas, con
icono para quitar y confirmación. Mini plan cerrado: pos-editor sustituye nombre
suelto/Quitar cliente por cápsula con contorno y fondo seleccionado primary,
icono User y nombre legible, Xmark en Button del kit con aria-label Quitar
cliente. Grupo identificado accesible, nombre largo se ajusta sin overflow.
Dialog Quitar cliente de la orden: Cancelar/Escape conserva asociación y cupón;
confirmar Quitar cliente llama removeClient existente y cierra. Avisa que también
retira el beneficio de esta orden, sin alterar productos. Error clientError
abre la misma confirmación. Busy bloquea retiro. Solo UI detalle/Pedido, modal
Cobrar conserva su diseño, sin API/kit/CSS ni requests añadidos.

Pruebas específicas: cliente/cupón conservados al cancelar, retirados juntos al
confirmar, líneas intactas y cero solicitudes remove/grant/close. Capturas390 y
320 con nombre largo sin desborde; typecheck/lint/formato/guard de editor.

### Ajuste visual L0 — cliente como contexto, no pestaña (2026-10-09)

Owner pide ancho completo móvil, compacto desktop y menos competencia visual
con pestañas. Revisión cerrada antes del código: wrapper w-full/md:w-fit, fondo
neutral suave y borde discreto; retirar segmento verde seleccionado, icono User
en círculo neutral y textos Cliente/nombre con Text del kit. X discreta conserva
confirmación y accesibilidad. No handlers/contratos nuevos. Verificación lint/UI
typecheck y capturas mediante casos existentes; sin nueva suite global.
