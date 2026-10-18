# 0242 CP1a — QA independiente de cliente POS/scope

Estado: **PASS de entrega `b0127037c0c5166eaac6f5040b631fedfc83f906` y combinación `0465a6c2312848d4dfdb2d936c692ede7758e5d5`**. Sin hallazgos pendientes de producto dentro del encargo.

QA trabaja en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, base `bb77c235`, sin cambiar refs ni ejecutar contra el worktree del autor. Fuente congelada revisada mediante blobs: `2c4ef9eb`, base de producto `7c16236f`. Contrato leído en `bb77c235`, además de protocolos, anexo0242 §3 y ADR0154. Único archivo propio: este informe.

## Revisión estática preliminar

- `createPosClient` captura identidad de época/scope antes de fetch y la verifica antes de entregar éxito o clasificar error. Una respuesta A tardía no llama a `retire` de B. Provider presente sin ticket no usa transporte legacy.
- La consola se remonta al cambiar identidad; su caché privada invalida época/generación y conserva versiones monotónicas. Las lecturas de catálogo usan clave por local. Mismo scope mantiene la instancia y el borrador.
- Consola, caché (listado/detalle/catálogo), resolve, coupon-state, payment-methods, recuperación, cierre, mesas, impresión y ticket-settings utilizan el cliente scoped. Solo el consumidor sin provider conserva GET de sesión legacy.
- El cierre conserva orden, UUID, cuerpo e instancia capturada de transporte para reintento incierto; total cero conserva `payments: []`. Conflictos de versión mantienen recuperación separada del retiro por 401/scope409; 402/403 no retiran por el transporte.
- Revisados fixtures/browser de componente y primera versión del runner/suite nativos. El browser de componente intercepta API: su evidencia no acredita autenticación nativa.

Sin hallazgo concreto de producto por esta lectura. La preparación inicial no ejecutó checks ni operaciones DB; su commit `0296ceb7` quedó explícitamente pendiente.

## Validación sobre candidato congelado

Coordinación avanzó el worktree limpio a `0465a6c2` antes de los checks. Node `v24.20.0`, pnpm `11.4.0`, lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Todos los comandos precedidos por `source ~/.nvm/nvm.sh && nvm use`.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: **PASS/EXIT0**.
- `pnpm exec vitest run apps/merchant/src/modules/pos/ui/pos-context.test.ts apps/merchant/src/modules/pos/ui/pos-cache.test.ts tools/app-boundary.test.ts`: **15/15 PASS**, cero skips.
- `pnpm exec playwright test -c /private/tmp/checkpass-pos-0242/qa-scope-client-playwright.config.ts -g 'ready seed|loading modules|scope409 settings|same scope update|same user/business|tardío|revocada|revocar|COP|payment|close|coupon|zero|cash|method'`: **16/16 PASS**, cero skips/retries, 8.6s. Config apunta exclusivamente a este checkout y a context/payment-methods/printing; workers1/retries0. Incluye cinco casos de contexto, ocho de pagos (payload a390/1280, COP, total0, cambio de cliente/beneficio, cierre incierto idéntico) y los tres negativos de impresión. Artefactos propios `/private/tmp/checkpass-pos-0242/qa-scope-client-browser`.

Primer intento browser sin escalación: **9 FAIL de setup**, todos antes de ejecutar caso (0ms), Chromium `MachPortRendezvousServer Permission denied`. Se notificó inmediatamente al coordinador; la ejecución acotada escalada pasó sin cambiar código/tests. No se cuenta ese intento como PASS ni como fallo de producto. Git también necesitó escalación para el commit propio por `index.lock`.

El diff final `2c4ef9eb..b0127037` tiene solo los cuatro paths de test impresión, runner, fixture/teardown y handoff. La UI completa es idéntica entre build `2c4ef9eb` y combinado `0465a6c2`. El combinado incluye lectores unit `8624` ya aceptados; conserva DTO legacy y no cambia el control scope/pre-handler. Se reutilizan checks compatibles del autor (lint/formato/guard UI y build) y no se amplía a verify global.

## Auditoría de señal nativa y límites

Revisados runner/fixture finales por blobs y archivos `evidence-identity.json`, `native-browser.json`, `native-inspection.json`, `native-cleanup.json`, logs de inspección/cleanup. La evidencia nativa del autor es build/start real fuente `2c4ef9eb6c8487b4ecce8b65c9b97bd2e650bdec`, BUILD_ID `cE0AIVAqRwZmMQ5K5Q_ER`, CI protegida endpoint `4e09cdfbd634`, esquema0101. Config SHA256 `535be4b240effc5b8e0f0e8079a3ec77aa605c7710da54ae0b8289c84a66ce47`. Árboles schema `73034e4e5a943b059ebe51a3ac76a193e0f881f9` y migraciones `21471713dde8f9d91faefdf065ecba9f4640db1d` coinciden con el candidato. Hashes finales runner `496ca250f6e2511ec6b525feeeab9a5360b27971585a9b05c13e51a890074af0` y fixture `6b0e4fe8fa1c4b93ee2c3707ef0c0b8a46be51632d78f97d63a70812632d1be8` coinciden con manifiesto.

Se reutiliza su resultado: 0GET sesión/módulos propios, 1GET listado scoped, POST guardar intenciónA/cookieB devuelve409 código exacto, 1POST sin retry y retiro documental real con borradorA ausente. Inspección SQL **1/1 PASS**, posOrders idéntico en ambos negocios; cleanup **1/1 PASS**, removed=true y eliminación de usuarios propios añadida al teardown final. Coordinación confirmó servidor detenido/43242 sin listener y transfirió CI; QA no operó DB ni levantó otro build. No se identifica interacción que requiera repetir esos recursos.

CDP pausa la entrega de respuesta real409 para leer su cuerpo y continúa sin sustituirlo. Acredita comportamiento funcional observado, **no latencia M1 ni red ininterrumpida**. El fixture browser de componente usa APIs interceptadas y no acredita autenticación nativa ni replay de efectos React dev.

El caso584 de impresión retiene mediante Navigation API solo la intención de navegación: comprueba un destino exacto y un único retiro, controles ausentes, ticket tardío sin reaparición y `printCount=0` usando globals del documento original. Después suelta el destino capturado y observa el documento restablecido. Es una señal compuesta; **no observa el documento viejo durante fullnav real**. El smoke nativo separado acredita navegación efectiva sin ese doble. No se certifica comportamiento físico nuevo de dispositivos/R2.

Permanecen documentados los fallos anteriores del autor: impresión original **2/3** por heading obsoleto tras401, intentos de observación del documento provisional con timeout y primera captura nativa fallida por `Network.getResponseBody` tras navegar (log `native-browser.log`). La corrección autorizada del oráculo conserva privacidad/ticket tardío; el observador CDP final no fabrica respuesta. No hay afirmación M0/M1/CP4, publicación, PROD ni aprobación de catálogo0102.
