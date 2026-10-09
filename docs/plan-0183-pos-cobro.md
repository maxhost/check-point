# Plan de implementación — POS 0183

Fecha: 2026-10-09. Spec [0183](specs/0183-pos-escanear-pase-y-confirmar-cobro.md)
cerrada, L3. Este documento concreta la ejecución; todavía no implementa.
Trabajo local en `dev`, sin merge ni push, según ADR 0128 y checkpoint vigente.

## Punto de partida comprobado

- HEAD al iniciar: `88ac58c`; botones visuales en `31d21b7`.
- PosConsole selecciona la orden, administra PosCache y publica resultados.
  Actualmente `view=checkout` desmonta PosEditor; PosCheckout posee cliente,
  cupón, Recibido e intento. Ese montaje pierde el contexto al volver.
- PosCheckout consulta cupón cada 4 segundos y Quitar llama coupon-remove.
  Ambos comportamientos se reemplazan conforme a 0183, únicamente en POS.
- PosConsole.handleError trata cualquier 404 como orden ausente y cualquier
  403 como revocación general. Las operaciones de pago necesitan clasificación
  por operación/código antes de delegar; no_program/not_found de cupón no
  deben borrar una mesa, y foreign_membership exige nueva identificación.
- PosCheckout ya conserva un intento en ref y guard síncrono. Se trasladan
  esas garantías al controlador; no se conserva una segunda función de cierre.
- El fixture resolved de pos.spec.ts carece de program.accrual y otros campos
  obligatorios. Se completa contra ResolveResponse antes de probar acreditación.
- QrScanner existente emite una lectura por montaje y detiene tracks al limpiar.
  Se reutiliza sin cambiar Mostrador. Dialog admite headerAction y bloqueo de
  Escape/clic afuera; su contenedor no define límite de altura/scroll propio.
  La accesibilidad con teclado móvil requiere verificar esa capacidad temprano.
- tableId ya existe en servidor 0182; el tipo UI actual no lo declara. Mantener
  intacto el objeto devuelto al publicar/cachear; no reconstruir DTOs ni mezclar
  selección/administración de mesas en este trabajo.
- Solo cambios ajenos iniciales: gotchas-del-repo/SKILL.md y docs/LECCIONES.md.
  Se preservan fuera de los commits de esta entrega.

## Orden de ejecución y entregables

Un implementador para todos los archivos compartidos, después un revisor
independiente según [AGENT-WORKFLOW](AGENT-WORKFLOW.md). No hay trabajo concurrente
sobre consola/editor. Orquestador entrega spec, este plan, baseline y archivos
permitidos; revisor recibe spec, diff y evidencia, y emite PASS/FAIL propio.

1. **Baseline y pruebas de contrato.** Registrar SHA/diff y guardia --report.
   Ejecutar POS y regresiones de Mostrador indicadas por la spec antes de editar;
   guardar fallos previos sin atribuirlos a 0183. Completar fixtures tipadas con
   UUIDs y reglas válidas; fijar expectativas nuevas de scanner, Cancelar y
   exclusión local junto con el cambio. Conservar los oráculos de snapshot,
   caché, conflictos, anulación e idempotencia existentes.
2. **Preview puro.** Crear pos-payment-preview.ts y su test. Entrada: snapshot
   guardado, cliente/cupón, selección de producto, exclusión por id y Recibido.
   Salida: bruto/descuento/neto en centavos, elegibilidad/motivo, regla, unidades
   base/extras y cambio/faltante. Resultado discriminado para datos inválidos:
   nunca representar un error como total o acreditación cero. Reutilizar
   previewUnits/unitLabel solo después de validar kind/accrual. Fijar redondeo
   y primera línea por producto conforme a coupon-discount.ts, sin importar
   módulos servidor al cliente ni alterar helpers de Mostrador.
3. **Sesión y operaciones.** Crear controlador/hook en pos-payment.ts, instanciado
   una sola vez por PosConsole. Mantener identidad negocio/usuario/orden,
   generación de cliente/operación, resolved, couponState, producto elegido,
   exclusión, revisión pendiente, Recibido y fingerprint del snapshot/importe.
   Usar refs para guard síncrono e intento congelado, estado React para render.
   Resolve y revalidación pueden quedar obsoletos; sus respuestas y finally
   no alteran otra generación. Invalidar generaciones al salir, reemplazar
   cliente, cancelar scanner o revocar autorización. El QR vive solo durante
   la lectura/request; no guardar ni loguear el token.
4. **Scanner y Pedido.** Crear PosScan con Dialog, QrScanner y lector manual.
   Desmontar cámara en cuanto comienza resolve. Éxito vuelve a Pedido; error
   conserva cliente anterior y ofrece reintento. PosEditor recibe presentación
   de la sesión y callbacks QR/Cobrar/Quitar; conserva ownership de borrador,
   dirty/conflicto y tabs. Solo habilita operaciones con orden abierta guardada,
   no vacía y limpia. Mostrar cliente/beneficio junto al total previsto mediante
   PosCoupon; Quitar beneficio solo excluye ese id en memoria. Guardar misma
   orden conserva cliente y recalcula sobre respuesta guardada; borrador nunca
   sirve para cerrar. Durante dirty informar que hay que guardar.
5. **Modal Cobrar.** Sustituir PosCheckout por presentación controlada del Dialog.
   Mantener PosEditor montado debajo y retirar view checkout/ruta antigua de
   cierre. Abrir revalida cupón si hay cliente; fallo bloquea Confirmar. Cambios
   de cupón/veredicto presentan revisión explícita; otro id no se incorpora sin
   aceptar esa revisión. La exclusión del mismo id permanece. Limpiar Recibido
   si cambia importe; conservarlo al cancelar/reabrir con mismo snapshot/importe.
   NumberField y preview muestran cambio, regla y base/extras. Cliente ausente
   no muestra acreditación. X/Cancelar/Escape/clic afuera conservan contexto.
6. **Cierre y recuperación.** Confirmar construye una vez el cuerpo permitido y
   UUID, vinculados a orden/version/cliente/cupón. Bloquear acciones, navegación
   interna y dismissal durante closing/closeUncertain; advertir antes de salir
   por navegación/recarga mientras incierto, sin persistencia. Red/timeout/5xx
   solo permiten reenviar ese cuerpo exacto, sin revalidarlo ni transformarlo.
   Éxito usa PosOrder devuelto y publish/cache/PosResult existentes; limpia sesión.
   Clasificar fallos según tabla siguiente antes del manejador de consola.
7. **Verificación y revisión.** Correr pruebas y gates, inspeccionar capturas y
   foco, entregar diff/evidencia/DoD al revisor independiente. Corregir su FAIL
   dentro del alcance y repetir lo afectado. QA owner con pase/cupón reales en
   DB local aislada y PASS independiente son requisitos para cerrar la entrega.

## Tratamiento de fallos

| Respuesta | Acción observable |
| --- | --- |
| Red/timeout/5xx al cerrar | Modal bloqueado, mismo intento al reintentar; no edición ni nuevo cliente |
| version_conflict | Invalidar intento definitivo, recuperar snapshot y exigir revisión existente |
| pos_order_not_open | GET autoritativo; mostrar cerrada/anulada sin adjudicar cierre propio ni nuevo POST |
| request_reused | Recuperar/revisar; nuevo UUID solo con nueva confirmación explícita |
| Cupón cambiado/vencido/usado/límite/incompatible | Orden abierta, revalidar, explicar y exigir revisión/exclusión explícita |
| unknown_pos_order | Retirar esa orden y su sesión |
| coupon-state not_found / foreign_membership | Invalidar cliente; conservar orden, exigir identificar otra vez |
| no_program | Conservar orden; bloquear cobro con cliente hasta reescanear/quitar explícitamente |
| 401 / otros 403 | Revocar sesión/contexto/cámara/diálogos por guard existente |
| 422 / otros 4xx definitivos | Conservar orden y mostrar corrección; no retry ciego |

## Pruebas con resultados observables

- Preview: 11.58 recibido20 → cambio8.42; 10% de10.05 → descuento1.01/neto9.04;
  punto por cada2 →4; descuento mayor al bruto →0; neto0 por compra →grant.
  Base/extras separados; vacío opcional, insuficiente bloqueado, NaN/negativos/
  moneda incompatible/regla desconocida rechazados. Dos snapshots del mismo
  producto conservan primera línea; 2x1 con primera cantidad1 falla aunque la
  suma sea2. Producto ausente requiere corregir o excluir.
- Flujo: QR→Pedido→Cobrar→Cancelar→reabrir conserva cliente/cupón/cambio y
  conteo close=0; Quitar beneficio no llama coupon-remove; no /api/counter/**.
  Salir/recargar pierde sesión, tabs/guardar misma orden la conservan.
- Beneficios: sin cliente, sin cupón, none/hint/used_today/invalid, descuentos,
  producto fijo/seleccionable, 2x1, custom y extras; nuevo cupón exige revisión.
- Carreras: doble lectura/confirmación produce una llamada; resolve/coupon-state
  tardíos de A no pintan B ni cliente reemplazado; cancelar resolve invalida
  respuesta; auth revocada no permite que un callback reabra el modal.
- Dinero: respuesta perdida tras commit → retry UUID/body idénticos, una venta;
  errores de la tabla sin éxito falso ni degradación silenciosa de beneficio.
  Cambio de cupón externo durante intento incierto no cambia request.
- Regresión: nueva orden/wizard, Editar/Pedido, guardado explícito, snapshot,
  caché/historial, impresión guardada y Mostrador. Adaptar expectativas viejas
  de checkout y coupon-remove con referencia a 0183, sin eliminar su cobertura.
- Cámara/foco: fake scanner verifica tracks.stop; comprobar foco al abrir y al
  cancelar; capturas vistas a 390/320 px, sin overflow y acciones alcanzables.
  Teclado real/cámara reales quedan como QA explícita, no como PASS por screenshot.
- Revisor ejecuta dos mutaciones presupuestadas: UUID nuevo en retry y close en
  Cancelar; ambas deben fallar por el oráculo previsto, con hashes/restauración.

## Ambiente y gates

Inspección inicial: Node24.20.0; dev:local escucha 3200/3201, puerto local DB
55432 escucha. Eso no demuestra conexión correcta ni integridad de la base.
Playwright configura 3100/3101/3102; comprobar disponibilidad otra vez antes de
ejecutar. No apagar servidores del owner ni reutilizar ambiente sin verificarlo.
QA contra Docker/Colima local; nunca DATABASE_URL de producción. No leer/loguear
secrets. Neon solo con tools/neon-test.sh y coordinación Claude/revisor.

La primera comprobación UI debe probar altura y scroll de Dialog con teclado.
Si el kit no alcanza, documentar la capacidad faltante para Claude; no modificar
kit ni compensarlo con CSS/nativos fuera de la zona. Esa limitación bloquea el
criterio de accesibilidad hasta resolverla, no justifica marcarlo cumplido.

Ejecutar los comandos exactos de 0183: preview Vitest, POS y regresiones
Playwright, typecheck, lint/formato de archivos, ui-guard y check-numbers.
Integración existente pos-close/races/reuse con runner aislado; revisor valida
transacción/rollback conservados. Para entrega L3, pnpm verify coordinado con el
ambiente activo; registrar fallos globales previos de tours/onboarding por
separado. No declarar PASS global si siguen rojos. Un fallo de setup no prueba
una mutación ni comportamiento del producto.

## Evidencia de esta etapa

Leídos spec/checkpoint, protocolo L3, estados, contratos 0169/0182, tipos,
consola/editor/checkout/cupón/scanner/Dialog, descuento/cierre servidor y fixtures.
ci:status no pudo consultar GitHub (fetch failed): CI remoto sin verificar.
No se ejecutaron baseline funcional, suites, build ni QA en esta etapa de plan.
No hay cambios de código, despliegue ni declaración de spec implementada.
