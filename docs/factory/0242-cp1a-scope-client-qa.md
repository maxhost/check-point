# 0242 CP1a — QA independiente de cliente POS/scope

Estado: preparación y revisión estática; dictamen de entrega y combinación pendientes.

QA trabaja en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, base `bb77c235`, sin cambiar refs ni ejecutar contra el worktree del autor. Fuente congelada revisada mediante blobs: `2c4ef9eb`, base de producto `7c16236f`. Contrato leído en `bb77c235`, además de protocolos, anexo0242 §3 y ADR0154. Único archivo propio: este informe.

## Revisión estática preliminar

- `createPosClient` captura identidad de época/scope antes de fetch y la verifica antes de entregar éxito o clasificar error. Una respuesta A tardía no llama a `retire` de B. Provider presente sin ticket no usa transporte legacy.
- La consola se remonta al cambiar identidad; su caché privada invalida época/generación y conserva versiones monotónicas. Las lecturas de catálogo usan clave por local. Mismo scope mantiene la instancia y el borrador.
- Consola, caché (listado/detalle/catálogo), resolve, coupon-state, payment-methods, recuperación, cierre, mesas, impresión y ticket-settings utilizan el cliente scoped. Solo el consumidor sin provider conserva GET de sesión legacy.
- El cierre conserva orden, UUID, cuerpo e instancia capturada de transporte para reintento incierto; total cero conserva `payments: []`. Conflictos de versión mantienen recuperación separada del retiro por 401/scope409; 402/403 no retiran por el transporte.
- Revisados fixtures/browser de componente y primera versión del runner/suite nativos. El browser de componente intercepta API: su evidencia no acredita autenticación nativa.

Sin hallazgo concreto de producto por esta lectura. Esto no es PASS: no se ejecutaron checks ni operaciones DB durante esta preparación.

## Pendientes antes de dictamen

Revisar SHA final y delta del oráculo de impresión, conservación de sus observaciones tras navegación documental, runner CDP definitivo, evidencia nativa de inspección y teardown, y candidato combinado congelado por coordinación. El FAIL previo de impresión y el FAIL inicial de observación del cuerpo 409 deben permanecer identificados. Una pausa CDP de respuesta real solo acredita comportamiento funcional observado; no prueba latencia M1 ni una entrega de red ininterrumpida.
