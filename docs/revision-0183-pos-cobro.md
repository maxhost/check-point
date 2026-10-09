# Handoff — revisión independiente de spec 0183

Estado final: **PASS de implementación y verificación automatizada** sobre
`76ff4ed`; QA físico y gate global completo pendientes. Estado inicial:
**FAIL** sobre `03fad03`, conservado abajo. Revisor independiente `review_0183`;
spec completa, ADRs 0033/0119/0120/0123/0128/0129/0130, protocolo,
diff y fuentes revisados. Sin push, merge ni cambios permanentes de producto.

## Corrección y revisión final

Root corrigió el hallazgo en `76ff4ed`: `recoveryRequired` conserva la barrera
de recuperación entre Cancelar/reabrir, Reintentar revisión y Quitar cliente;
`prepare` recupera la orden antes de validar cupón y `confirm` comprueba
también esa barrera. GET exitoso publica el snapshot y obliga a revisar antes
de otro cobro. La corrección se inspeccionó independientemente, sin editarla.

Comprobación propia después de la corrección:

- Suite POS + counter-mobile + counter-coupon-verdict: **86/86**, 29.5 s,
  `/private/tmp/0183-review-fixed-e2e.log`. Los seis nuevos casos permanentes
  esperan el estado posterior a fetch, comprueban que Quitar cliente no
  elude la barrera, recuperan versión 4/importe 20 y exigen revisión antes
  de un nuevo UUID sobre esa versión.
- Reproducer independiente anterior, adaptado al comportamiento corregido:
  **6/6**, 4.9 s, `/private/tmp/0183-review-fixed-recovery.log`. Los seis
  observan GET adicional (`gets=2`) y Confirmar deshabilitado después de
  terminar la preparación. La espera positiva de habilitación usada para
  demostrar el bug se reemplazó por espera de GET/reintento y estado asentado.
- Typecheck de seis paquetes, ESLint/Prettier de los dos archivos corregidos
  y guardia sobre la entrega: verdes, logs `0183-review-fixed-*`.
- Build Merchant Webpack repetido con la corrección sincronizada a la copia
  aislada: verde, `/private/tmp/0183-review-fixed-build.log`.

No hubo nuevas mutaciones: las dos presupuestadas ya demostraron los oráculos
de idempotencia y ausencia de close al cancelar; la corrección no los alteró
y la suite completa volvió a pasar. PASS cubre código y evidencia automatizada;
no certifica QA físico ni convierte el gate global rojo en verde.

## Hallazgo inicial, corregido

`pos-payment.ts::recover` no conserva un bloqueo de recuperación cuando el
GET autoritativo falla. Después de un cierre rechazado por `request_reused`,
`version_conflict` o `pos_order_not_open`, GET de la orden devuelve 503.
El modal bloquea inicialmente Confirmar, pero **Cancelar → Cobrar** o
**Reintentar revisión** ejecutan `prepare`, que solo consulta coupon-state:
restablece `validated: true` y permite confirmar sobre el snapshot anterior,
sin GET exitoso ni revisión de una versión recuperada. El intento anterior
ya fue eliminado, por lo que un nuevo envío generaría otro UUID.

Incumple la recuperación/revisión obligatorias antes de otro intento,
especialmente la condición explícita de `request_reused`. La corrección debe
mantener el bloqueo mientras falta recuperar la orden; revalidar el cupón
no acredita haber recuperado el snapshot. No debe degradar a cobro anónimo.

Reproducción independiente, sin modificar producto:

- `/private/tmp/0183-review-reproducer/recovery.spec.ts`, últimos seis casos.
- Config: `/private/tmp/0183-review-reproducer/playwright.config.ts`.
- Log: `/private/tmp/0183-review-recovery.log`: **6/6 rojos** en
  `toBeDisabled` sobre Confirmar; cada caso observa `gets=1`, `closes=1`,
  `enabled=true`. Se espera explícitamente que termine la preparación y el
  botón llegue a habilitarse antes del oráculo; no se acepta el estado
  transitorio deshabilitado durante fetch como evidencia de protección.
- Comando: `pnpm exec playwright test --config=/private/tmp/0183-review-reproducer/playwright.config.ts --grep 'review recovery failed' --output=/private/tmp/0183-review-reproducer/results`.

Se descartaron dos intentos de diagnóstico: uno esperaba un texto reemplazado
por el error del servidor, y otro observaba el botón antes de completar fetch.
No cuentan como validación. El reproducer final sí alcanza el oráculo funcional.

## Verificaciones propias

Node 24.20.0. Logs bajo `/private/tmp/0183-review-*.log`.

| Comando / alcance | Resultado |
| --- | --- |
| `pnpm typecheck` | 6 paquetes verdes (cache existente) |
| ESLint: todos los archivos de producto/tests modificados, incluido Dialog | Verde |
| Prettier: lista completa de archivos de `03fad03` | Verde |
| `node tools/ui-guard.ts --base 03fad03^` | Verde, sin incrementos |
| `node tools/check-numbers.ts`, `git diff --check` | Verdes |
| Vitest `pos-payment-preview.test.ts` | 28/28, 402 ms |
| Playwright POS + counter-mobile + counter-coupon-verdict, config sin webServer | 80/80, 16.1 s |
| Neon close/races/reuse con `tools/neon-test.sh` | 11/11, 60.45 s |
| Merchant `next build --webpack` en copia aislada con las 10 fuentes finales sincronizadas | Verde |

Playwright y Neon inicialmente no pudieron abrir puerto/conectar desde el
sandbox; las corridas válidas son las repetidas con escalación. La primera
invocación de ESLint tenía un glob incorrecto; se corrigió con la lista real.
El primer intento de sincronizar build usó su propio cwd; se corrigió copiando
desde el repo explícitamente y se repitió build. No se tocaron los `.next` del owner.
Estas incidencias de setup no se contabilizan como resultados de producto.

No se repitió el gate global completo de 16 minutos: registrado por root en
el handoff de implementación. Root añadió unitarios globales con 4 workers
(2435 verdes) y lint global verde; formato ajeno, tours, snapshots previos del
kit y Turbopack siguen impidiendo un PASS global. Webpack no reemplaza ese gate.

## Mutaciones presupuestadas

Ambas sobre `pos-payment.ts`; ejecutadas secuencialmente con restauración en
`finally`, sin modificar tests ni aceptar fallos de setup.

| Mutación | Oráculo rojo |
| --- | --- |
| Regenerar intento también en retry: `if (!attempt.current || retry)` | Test timeout tras commit: `bodies[1] === bodies[0]` falla por UUID distinto (línea 2779) |
| Añadir `void confirm()` a Cancelar pago | Test cancelar/reabrir: conteo de close esperado 0, recibido 1 (línea 1966) |

SHA256 original y restaurado tras **cada** mutación:
`d832bbcdb23a73368940706e09e5569b969beff39f47c6cb0b89378e028feb66`.
Mutantes: `23056f85fe76bed40287624864401323060ec2bdfdfae2a97316a28ab0b1894a`
y `0aaaf0b4adde07d720a8534369092f41c4ad6acb47c8d7a3b6ce2f2a894e3457`.
Bitácora: `/private/tmp/0183-review-mutations.json`; logs
`0183-review-mutation-retry-new-uuid.log` y `0183-review-mutation-cancel-closes.log`.
Root recibió aviso de restauración antes de empezar la corrección.

## DoD y límites

- [x] Scanner simulado: doble lectura, detención de tracks, cancelar y generaciones.
- [x] Cliente/beneficio temporal, exclusión local, cero close/grant/remove antes de confirmar.
- [x] Preview: centavos, primera línea coincidente, regla, base/extras, dinero inválido.
- [x] Retry incierto con UUID/cuerpo idénticos y bloqueo de navegación; ambas mutaciones detectadas.
- [x] Regresiones POS/Mostrador y fullscreen 320×400 con acciones alcanzables por scroll/foco.
- [x] Recuperación de conflictos completa: FAIL inicial corregido en `76ff4ed` y seis regresiones permanentes verificadas independientemente.
- [ ] Gate global verde y QA owner con cámara/teclado/pase/cupón físicos en DB local aislada.

La autorización puntual de Dialog fullscreen y eliminación de entrada manual
figuran en la spec anterior al código. La variante default permanece intacta;
el problema encontrado está en la recuperación de cobro, no en esa excepción.
Auth/aislamiento, snapshot guardado, venta final autoritativa y ausencia de
persistencia local fueron revisados; no se encontraron otros incumplimientos
confirmados en esta revisión. No marcar la spec implementada por estos checks.
