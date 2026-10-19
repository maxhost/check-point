# 0242 — CP2d.3 comandos de borrador V2 y recuperación

Estado: preparada, sin autor/reserva. Autor NUEVO/contexto vacío después del transporte CP2d.2 aceptado. Coordinador fija base/factory. Bloque pequeño previo al editor visual/consola: transporte y carrito ya aceptados, sin abrir checkout ni sustituir UI legacy. Leer protocolos, contratos0242 §crear/guardar/scope y PosCache existente. Sin subdelegar.

## Resultado

Preparar un consumidor reusable de POST orders/PUT orders/:id V2 para el futuro editor, con una intención por comando y recuperación explícita. Proponer API mínima antes de código; mantener estado de operación pequeño y observable para que React pueda presentar pending/uncertain/conflict/confirmed sin duplicar lógica. No implementar otra caché ni framework genérico de comandos.

Usar PosClient.capture() aceptado con contractVersion2 configurado por caller. Antes de await, copiar/congelar profundamente cuerpo/UUID/version/scope mediante la captura; mutar luego borrador/objeto no cambia el intento. Crear una clave createRequestId al iniciar una creación válida (inyectar generador para tests); error de red/respuesta ambigua mantiene MISMA intención, clave y cuerpo para reintento EXPLÍCITO. Sin retries automáticos ni recrear tras5xx/timeout/error parseando respuesta exitosa. Mientras incierto no permitir otro cuerpo/clave que pueda duplicar venta. Recovery puede devolver el DTO actual editado/cerrado/anulado del mismo recurso; aceptar sin forzarlo a open ni recapturar catálogo. Una invalidación de identidad retira la intención; no reenviar bajo otro scope ni persistir claves/autorización fuera del documento. Evitar concurrentes/doble click y respuestas tardías después de retiro.

PUT snapshot completo usa PosUpdateV2 y versión revisada;409version_conflict conserva orden autoritativa V2 de PosError.payload, sin sobrescribir el borrador ni reenviar automáticamente.409catalog_revision_conflict conserva products[] íntegros para revisión del futuro editor. Respuestas definitivas422/403/conflictos y ambiguas tienen clasificación distinta; describir criterio de HTTP conocido/transportunknown. No convertir412/409 desconocido a éxito ni perder datos autorizados. Cambio deliberado tras conflicto exige nueva intención revisada. No atribuir idempotencia UUID al PUT que no tiene esa clave: si se perdió respuesta y reintento exacto llega409version_conflict, presentar orden actual/revisión; no declarar éxito solo porque coincide una parte del cuerpo. Comandos no deciden reglas comerciales ni precios/cupones ni cierre.

Éxito canónico actualiza caché del detalle sin GET posterior; misma instancia PosCache de la consola, públicas read/put/invalidate/beginWrite/bind/clear. No llamar accept/remove/history/order/catalog legacy que asumen números. Facade V2 opcional usa el mismo mapa y llaves; history resumido parcheado solo desde DTO canónico con lineCount y total/saleTotal strings, sin sumar masa+piezas. Conservar version monotónica y protección de pending reads/epoch/generation. No inventar respuesta history ni invalidar para forzar GET extra en éxito. Si falta historial cacheado, no cargarlo por guardar. Catálogo V2 puede leerse bajo catalogKey(local) solo al requerir venta/local, misma deduplicación, sin GET sesión/módulos ni eager mount. Sin mass→Number ni import server al cliente.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/measured-order-commands.ts
- apps/merchant/src/modules/pos/ui/measured-order-commands.test.ts
- apps/merchant/src/modules/pos/ui/measured-order-cache.ts, solo facade del PosCache actual si necesaria
- apps/merchant/src/modules/pos/ui/measured-order-cache.test.ts, si hay comportamiento nuevo
- docs/factory/0242-cp2d-order-commands-handoff.md

Sin modificar transporte/cache legacy/contratos/modelo exacto/editor/console/payment/printing/routes/schema/kit/guardias/tooling/deps/estados/índices. Necesidad de path adicional vuelve al coordinador antes editar. El siguiente agente nuevo implementará editor visual consumiendo esta API y carrito aceptado.

## Gate

Node24, tipos merchant/lint/formato/UIguard y tests focales de consumidor con transporte real hasta fetch mocked cuando importa la captura; no solo doble de manager que omita scope. Casos decisivos: create respuesta perdida luego recuperación misma UUID/body/header sin duplicado; mutación del input posterior no cambia reintento; double click una petición; currentDTO cerrado/voided aceptado; PUTconflicto actual completo sin retry ni pérdida products; A→B antes/después await retira/sin reenvío; cache canónica version monotónica frente lectura pendiente vieja, historialV2lineCount sin sumarqty; ninguno GET detalle/history/session/modules por éxito. Reutilizar tests aceptados de transporte/exactitud, sin repetirlos por ceremonia. El doble fetch no certifica auth nativa/DB/idempotencia servidor nueva.

SIN DB/env/wrapper/browser/build/M0/M1/fullverify, no UI nueva ni capturas visuales. Logs completos SHA/base/config/comandos/exits/fallos/skips fueraWT. QA NUEVO independiente; autor conserva fixes. Entrega limpia0procesos; factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
