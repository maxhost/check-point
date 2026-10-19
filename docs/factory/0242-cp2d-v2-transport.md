# 0242 — CP2d.2 transporte V2 con scope y errores preservados

Estado: preparada, sin autor/reserva. Autor nuevo/contexto vacío después de aceptar carrito CP2d.1; coordinador fija base/factory. Entrega acotada previa al editor/consola V2: no UI nueva, cache nueva ni cobro. Leer protocolos, contrato0242 de scope/versión y transporte aceptado pertinente. No subdelegar.

## Resultado

Permitir a un consumidor POS optar explícitamente por X-Pos-Contract2 usando el MISMO transporte capturado y sus garantías de identidad. Proponer API mínima antes de código: opción de createPosClient/usePosContext o equivalente que mantenga callers sin opción en V1. Congelar versión elegida junto al transporte capturado antes de await; un reintento de esa intención no puede cambiar de versión ni scope por una nueva lectura del contexto. No cambiar automáticamente todo el POS antiguo a V2 ni introducir un fetch paralelo que omita panelRequest/guards.

panelRequest aún no admite headers adicionales. Autorizar extensión genérica en BackofficeRequestOptions y panelRequest para headers opcionales, sin nombres ni reglas POS en core. Scope capturado tiene precedencia case-insensitive sobre headers del caller; no permitir sobreescritura, duplicación/join de X-Backoffice-Scope ni quitarlo por merge. Content-Type JSON/FormData, signal, no-store, shape/error y callers actuales preservados. Preferir comportamiento idéntico cuando no se usa la nueva opción. Header POS se define solo en módulo.

PosError debe conservar payload autorizado completo para que el futuro editor pueda revisar products[] y orden V2 de conflictos sin convertir cantidades/precios ni perder metadata. Mantener propiedades/callers legacy compatibles; no sustituir shape de errores ni inventar un DTO numérico V1 desde V2. Error401/scope409 retira documento según mecanismo vigente, respuesta tardía A no pisa B ni retira B; restricciones403/402/conflicto no se reintentan silenciosamente. Header de contrato inválido no se reenvía con otra versión. Cero GET sesión/módulos extras ni retry automático por esta extensión.

Esta entrega no implementa manejo visual de create incierto ni editor/caché V2; esos callers congelarán UUID/body y usarán el transporte preparado. No llamar nuevas rutas por montar componentes o enfocar escáner, no cambiar impresión ni checkout antiguo.

## Paths autorizables

- apps/merchant/src/app/backoffice/backoffice-scope-request.ts, solo opción genérica de headers
- apps/merchant/src/app/backoffice/panel-request.ts
- apps/merchant/src/app/backoffice/panel-request.test.ts
- apps/merchant/src/modules/pos/ui/pos-types.ts, transporte/error compatible
- apps/merchant/src/modules/pos/ui/pos-context.tsx
- apps/merchant/src/modules/pos/ui/pos-context.test.ts
- docs/factory/0242-cp2d-v2-transport-handoff.md

Sin core nombresPOS, backoffice provider/guards, cache/editor/console/payment/printing/UI, rutas backend/schema/kit/tooling/deps/estados/índices. Si hace falta extender test de scope existente, solicitar path antes de editar. No relajar tests de transporte para ocultar scope perdido.

## Gate

Node24, tipos merchant, lint/formato/UIguard y pruebas de transporte/contexto afectadas. Fetch de test conserva transporte real hasta boundary de red; verificar headers case-insensitive y valores efectivos, JSON/FormData/signal/no-store, legacy sin opción, V2 explícito y versión capturada, intento de header scope alterno rechazado o sobrescrito por capturado, A→B antes/después de await, rechazo tardío no retira B, retiro actual401/scope409 una sola vez,403/conflicto conservados sin retry, payload products[]/order2 strings intactos. Reusar evidencia de servidor HTTP y scope previa; no certificar nuevo auth nativo/DB por fetch mock. La combinación final validará transporte en app real.

SIN DB/env/wrapper/browser/build/M0/M1/fullverify; no nuevo handler visual ni capturas por ceremonia. Logs completos fueraWT ligados SHA/config/comando/exit/fallos/skips/límites. QA nuevo independiente, autor conserva fixes; entrega limpia0procesos, factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
