# 0242 — CP2b.7 ensamblado HTTP de listado y QR V2

Estado: preparada, sin autor/reserva. Requiere PUT CP2b.6 y contexto QR CP2c.2 aceptados; autor nuevo/contexto vacío tras aceptar QR, no el mismo agente de su implementación. Coordinador fija base/factory antes de código. No subdelegar. Entrega pequeña: conectar dos capacidades aceptadas, sin cambiar su dominio ni empezar cierre/void/interfaz.

## Resultado

GET orders con X-Pos-Contract2 llama overload V2 de listPosOrders (cuarto argumento literal2), devuelve proyección PosSummaryV2 abierta/cerrada/anulada ya aceptada. Ausente/1 conserva V1 y query status actual; inválido conserva error existente. No descargar detalles/settlement completo ni agregar viajes al listado, paginar o truncar abiertas. El contrato de dominio exacto no se reimplementa en ruta.

POST resolve con X-Pos-Contract2 llama resolveMeasuredScan mínimo aceptado. Ausente/1 conserva resolveScan legacy. Valida cuerpo/token/location con mecanismos actuales antes de efectos de identidad y conserva códigos vigentes. Respuesta allowlist PosResolveV2, sin catálogo/rewards/atajos/rawconfiguration/QR/objectKey. No resolver legacy completo y luego recortar: minimal no debe llamar catálogo ni premios. No GET por enfocar escáner ni prefetch; no tocar cliente aquí.

Ambas rutas negocian header en capa POS DESPUÉS de guard/scope actual; desconocido409 pos_client_upgrade_required antes del dominio/cuerpo con efectos. Guard POS, no nuevo permiso business; todo private,no-store también errores/auth/scope/contract. Scope sigue optional durante expansión hasta cutover; no alterar dispatcher global. No ampliar credenciales ni datos de otro tenant. Contexto QR no autoriza cierre ni vuelve veredicto cupón autoridad persistida.

## Paths autorizables

- apps/merchant/src/modules/pos/server/routes.ts, solo GETorders y POSTresolve/imports necesarios
- apps/merchant/src/modules/pos/server/read-api-v2.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2b-read-api-assembly-handoff.md

Sin list/read/measured-resolve/http/commands/close/void/financial/coupon/schema/journal/UI/kit/guardias/tooling/deps/estados/índices. Reutilizar selector/readers aceptados, no capas nuevas por ceremonia. Cualquier ampliación vuelve a root antes de editar.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes; CI únicamente tools/neon-test.sh/env seleccionado con reserva explícita hasta teardown. HTTP real:401403/module/scope A→B antes de effects, versiones ausente/1/2/desconocida y no-store, tenant, listado V2 lineCount/saleType/etiqueta/monetarios exactos y legacyV1 intacto, query anuladas. Resolver mínimo con QR real y primer enrolamiento/last_scan/cupón, sin catálogo/rewards/shortcuts comprobado por spies reales/evidencia SQL, también si legacy catálogo arrojaría por representación no compatible (sin sembrar masa imposible). Reintento no duplica membresía/compra; error token/local/contrato/scope no escribe. Legacy resolve mantiene shape. No repetir por ceremonia todas las pruebas de dominio si identidad es compatible; reproducir señal HTTP decisiva que faltaba.

Registrar SHA congelado/config/logs completos/exit/fallos/skips fueraWT; cleanup verifica negocio/consumidores/membresías/owner/staff/sesiones por IDs propios. Sin browser/build/M0/M1/fullverify ni cierre/void/mass canónico afirmados. QA nuevo independiente, autor conserva fixes; entrega limpia0procesos y factory/integración coordinador. Sinpush/PROD/3201/túnel/M0/demos/artefactosajenos.
