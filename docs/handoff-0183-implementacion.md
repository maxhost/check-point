# Handoff — Spec 0183

Estado: código local con PASS automatizado independiente; QA físico y gate global pendientes.
Spec cerrada: [0183](specs/0183-pos-escanear-pase-y-confirmar-cobro.md).
Plan: [plan 0183](plan-0183-pos-cobro.md). No merge ni push.

## Cambios y ownership

Implementador dedicado: implement_0183; root orquestó y retiró al final una
variable sin uso detectada por ESLint. El implementador agotó su cuota después
de completar código y corrida final, antes de escribir este handoff.

Archivos de producto: pos-console/editor/checkout/coupon/ticket, nuevos
pos-payment, pos-payment-preview y test, pos-scan; pos.spec y fixture
pos-counter-harness. Única excepción de kit: ui/dialog.tsx, variante fullscreen
expresamente autorizada por owner en conversación y spec antes del código
(03b9306). No servidor, API, migraciones, paquetes, tooling ni CSS de pantallas.

QR identifica desde cámara, vuelve a Pedido y conserva cliente/beneficio en
memoria. Cobrar abre modal fullscreen, revalida puntualmente, muestra cálculo
en centavos/base/extras y permite Cancelar sin cerrar. Quitar beneficio excluye
solo localmente. Cierre incierto mantiene UUID/cuerpo y bloquea navegación;
hay guard síncrono, generaciones, timeout y recuperación por operación/código.
Resultado usa snapshot servidor; base y extras sumados/separados correctamente.
Por decisión posterior del owner, no hay campo Código del pase ni lector manual.

## Evidencia ejecutada

- Baseline navegador: 21 fallos previos /18 pasan (2.5min), mayormente controles
  retirados por ajustes previos. Adaptaciones conservan oráculos de caché,
  snapshots y aislamiento. Suites usan configuración temporal sin webServer,
  porque dev:local del owner ocupa el lock de Next; no se apagó ese ambiente.
- Corrida final implementador: POS + counter-mobile + counter-coupon-verdict,
  **80/80 pasan, 17.7s**. Log /private/tmp/0183-complete-e2e.log.
- Preview: **28/28 pasan**; root repitió Vitest (236ms total) al continuar.
- Typecheck implementador: **6 paquetes pasan, 3.408s** (log 0183-typecheck.log).
- Root lint de todos los archivos tocados detectó únicamente invalidCoupon
  sin uso; se retiró y lint de checkout pasó. Revisor repetirá lint completo.
- Prettier de archivos de entrega verde; ui-guard --base471b821 sin aumentos
  (8 archivos tracked); números y diff-check verdes.
- Neon existente, root mediante tools/neon-test.sh con interlock de CI:
  **close/races/reuse: 11/11 pasan, 58.87s**. Sandbox falló conexión al migrar;
  fuera del sandbox pasó. No se usó DATABASE_URL de producción.
- Kit Chromium/WebKit: **50 pasan/8 snapshots fallan**. Reproducción temporal
  del Dialog anterior de 03b9306 confirmó hashes baseline==actual para las ocho
  combinaciones motores × claro/oscuro ×390/1280. Referencias anteriores difieren
  por overlay; no se actualizaron. Log 0183-kit-baseline.log guarda ocho equal:true.
- Fullscreen con contenido largo en viewport reducido 320×400 pasa: Cancelar
  alcanza viewport mediante scroll/foco. Esto simula espacio con teclado;
  no sustituye QA de teclado/cámara físicos.
- Root Merchant Webpack build verde en copia aislada. Default Turbopack falla
  onboarding.css al abrir puerto interno (EPERM), también escalado. Logs
  0183-isolated-webpack.log y 0183-isolated-turbopack-escalated.log.

## Gate global registrado (sin PASS global)

Root ejecutó pnpm verify --base471b821 en copia aislada de fuentes y dependencias,
con env LOCAL previamente validada por check-env.ts. Git metadata enlazada solo
para lecturas de verify. No se modificó .next del owner. Log
/private/tmp/0183-global-verify.log. Foto anterior al retiro de variable sin uso
y a la última finalización del implementador: no certifica bytes finales.

| Gate | Resultado |
| --- | --- |
| typecheck / ui-guard | Verde |
| lint | Rojo: variable sin uso de checkout, corregida después |
| formato global | Rojo: server/loyalty-terms-render.neon.integration.test.ts fuera de zona |
| unitarios globales | 2435 pasan/1028 omitidos; rojo por dos workers que no arrancaron (close/reuse) |
| build | Rojo EPERM de Turbopack; Webpack Merchant verde aparte |
| e2e global | 236 pasan/21 omitidos/18 fallan: 10 tours Ayuda duplicado y8 referencias kit |
| Neon related merchant/consumer | 436 y35 pasan, respectivamente |

No se afirma causa verificada para todo fallo global: kit sí tiene baseline
comparativo; tours ya documentados, fuera de esta entrega. No arreglar servidor
o regenerar referencias para hacer este gate verde. No publicación con gate rojo.

## DoD y pendientes

Flujo, dinero, errores, carreras, cámara simulada y regresiones: evidencia en
80 e2e/28 preview, por confirmar independientemente. Capturas vistas por root:
0183-pedido-390, cobro-390, cobro-320 y dialog-320-keyboard; capturas posteriores
con animaciones desactivadas eliminan estado de transición de botones.

- [x] Revisor independiente: spec/diff, comandos propios, seguridad/aislamiento,
      dos mutaciones (UUID nuevo en retry; close en Cancelar), hashes/restauración.
- [ ] QA owner con pase/cupón local ficticio o real, cámara y teclado físicos.
- [ ] Resolver gates globales antes de live; no estado implementada ni PASS total.

Cambios ajenos gotchas/LECCIONES y ruta consumer c/[webViewToken] preservados;
otros commits de Claude durante sesión conservados. No incluirlos en staging.

## Cierre de revisión y corrección

Implementación03fad03 y corrección76ff4ed, solo dev local.
[Revisión independiente](revision-0183-pos-cobro.md): PASS automatizado.
El FAIL inicial comprobó seis vías de recuperación incompleta tras GET503:
request_reused/version_conflict/pos_order_not_open por Cancelar→Cobrar o
Reintentar revisión. Root agregó barrera persistente hasta recuperar snapshot;
Quitar cliente tampoco permite omitirla. GET exitoso requiere revisión antes de
nuevo intento. Seis regresiones permanentes comprueban versión4, importe20 y
UUID nuevo solamente después de recuperación/revisión.

Revisor:86/86e2e,6/6reproducer, checks y buildMerchant final verdes;
28preview y11Neon independientes previos. Las dos mutaciones previstas
fallaron en sus oráculos y se restauraron con hashes idénticos.
Root:6regresiones verdes, typecheck6/lint/formato de fuentes/diff verdes.
Su corrida81tests dio80verdes/1fallo wizard en nombre accesible de heading;
repetición puntual pasó1/1, mismo caso pasó en86independientes. Intermitencia
registrada sin causa demostrada; no ocultar ni llamar verde a aquella corrida.
Logs0183-final-e2e.log y0183-wizard-final.log bajo/private/tmp.

Root repetición global limitada: unitarios2435verdes/1036skip con4workers,
sin errores de arranque; lint global verde. Formato global sigue rojo en el
archivo servidor ajeno señalado. Estos resultados actualizan los respectivos
fallos previos de verify; no convierten gateglobal en PASS. Pendientes físicos
y de publicación conservados; spec sigue cerrada.

## Ajuste visual L1 — identificar cliente

Mini plan anterior al código1660b87. Durante resolve el modal mantiene pantalla
intermedia con C oficial (path de consumer/public/checkpass-icon.svg), pulso
suave y motion-reduce; anuncio Identificando cliente solo sr-only. Cancelar
permanece disponible. Sin demora artificial ni cambios de kit/dinero/contrato.
Resolve exitoso vigente publica Toast compartido Cliente identificado; siguiente
escaneo limpia aviso, cancelar/error/respuesta tardía no publican éxito.

Pruebas específicas3/3,2.1s (loading/éxito, cancelar+tardío, error/auth).
Log/private/tmp/0183-loading-tests.log. Verificación incluye animación pulse,
reduced-motion none, logo y Cancelar dentroviewport, ausencia de toastprematuro.
Capturas390px vistas:0183-identificando-cliente.png y
0183-cliente-identificado-toast.png. Typecheck6paquetes verde3.177s,
ESLint y Prettier específicos/diff verdes. Guardglobal contra1660b87 rojo por
archivos ajenos prueba-impresora; countFile antes/después de pos-scan y
pos-payment registra increases:[] en ambos. Espec principal conserva
QA físico/gateglobal pendiente; no nueva revisión independiente exigida L1.

## Corrección L1 — toast fuera de pantalla

Owner vio loading pero no aviso. Regla globals.css4366 counter-flow.toast hacía
estático el Toast de PosScan al final del pedido. La prueba anterior comprobaba
visibilidad CSS, insuficiente para viewport. Mini plan6b31c78 antes del código.
pos-scan usa utilidades fixed explícitas y posición superior centrada; mismo
Toast, mensaje/duración/resolve intactos. Sin CSS/kit nuevos.

Regresión pedido20líneas/390×600 antes:ROJO viewport ratio0,
/private/tmp/0183-toast-before.log. Después:3/3verdes1.9s (pedido largo,
loading/éxito/reducedmotion, cancelar/tardío),0183-toast-after.log. Posición
computed fixed y aviso dentroviewport verificados. Captura toast-pedido-largo
vista. ESLint/Prettier/diff y typecheck6verdes3.029s. Local, no publicación;
pendientes principales0183 conservados.

## Ajuste L1 — patrón único de confirmación

Mini plan1a8e83d anterior al código. ConfirmationToast en app/components adapta
Toast compartido sin cambios de kit/CSS. Estilo de Producto añadido: cápsula
oscura tokenizada, mobile bottom24 centrado y desktop md top6/right6. Sin
className público: nuevos avisos reutilizan presentación única. Cliente y
Producto consumen el mismo adaptador, conservan4000/1400ms respectivamente.
Patrón documentado en design-system, con ejemplo de uso y estados accesibles.

Cinco pruebas específicasverdes2.8s: comparación de estilos/geometría cliente
vsproducto a390/1280, pedido largo, loading/éxito y cancelartardío. Log
/private/tmp/0183-confirmation-tests.log. Capturas cliente390/1280 vistas;
producto también capturado. ESLint/Prettier/typecheck6/diff verdes; countFile
base1a8e83d sin incrementos en los tres archivos de producto (nuevo incluido).
Cambio L1 local, sin subagentes/gateglobal/push. QA y pendientes anteriores
conservados.
