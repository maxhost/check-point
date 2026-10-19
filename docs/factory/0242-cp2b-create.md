# 0242 — CP2b.5 creación V2 idempotente y captura de catálogo

Estado: preparada, sin autor ni reserva. Requiere lectores CP2b.3 aceptados y helpers CP2b.2/0106 integrados. Coordinador fijará base SHA, worktree y factory antes de código; autor nuevo con contexto vacío, sin subdelegar. Leer protocolos, contrato0242 §1/3 y código pertinente; no historia entera. Esta ficha no autoriza activar masa ni retirar barreras.

## Entrega acotada

Conectar únicamente POST orders con X-Pos-Contract2 al servicio nuevo de creación, usando parsePosCreateV2/createIntentFingerprint y respuesta PosOrderV2 de los lectores aceptados. Ausente/1 conserva servicio V1 durante expansión; valor desconocido devuelve409 pos_client_upgrade_required después de guard/scope y antes de efectos. Mantener private,no-store y permisos POS, sin permiso business adicional. No modificar GET listado, PUT, close, resolve ni interfaz. El ensamblado del listado tiene otra entrega.

Un único pedido abierto por businessId/createRequestId y huella canónica. Buscar replay dentro de la transacción, antes de resolver catálogo, local/mesa actuales o etiquetas automáticas: un cambio comercial posterior no debe invalidar una intención ya creada. Misma clave/huella devuelve el mismo recurso y DTO V2 sin insertar líneas, incrementar versión, recrear efectos ni generar otra etiqueta; otra huella devuelve409 create_request_reused. Clave de otro negocio no es lookup público. Serializar carreras por la intención y mantener unique0106 como respaldo; no capturar indiscriminadamente cualquier23505 como replay. Guard y permiso actual siguen aplicando al reintento. Respuesta201 según contrato. Antes de implementar, describir al coordinador comportamiento de replay si el pedido ya fue editado/cerrado; no introducir almacenamiento de respuestas ni esquema nuevo sin asignación.

Nueva creación mantiene una transacción para locks/validaciones/cabecera/líneas, usando mecanismos existentes. Conservar lock de módulo habilitado y orden consistente de locks compartidos con configuración/catálogo (business-config antes de producto), mesa y su ocupación; no deadlocks por invertir locks. Una edición concurrente de tarifa/configuración no puede dejar revisión vieja con precio nuevo ni medida incompatible. Volver a leer configuración y productos autoritativos en esa transacción. No confiar en catálogo leído antes, precios/name/measure del cliente ni reutilizar buildDetailed legacy para proyección medida. Reutilizar núcleo financiero y límites; no Number/toFixed/SQL aproximado para dinero/cantidad.

Local activo y del negocio obligatorio; null resuelve solo único activo según reglas actuales. tableId real exige módulo Mesas y mesa activa del mismo negocio, local/nombre autoritativos y ocupación protegida; no usar etiqueta recibida como autoridad. Tipo table sin FK mantiene etiqueta contractual; pickup/delivery exigen etiqueta1–60 sin mesa. Counter genera etiqueta automática estable sin Guardar manual, dentro del mismo flujo y replay; no cerrar ni crear core.order/pagos/eventos/comisión/consumo al preparar. Crear items=[] es válido.

Capturar cada línea nueva individualmente con producto disponible en local, tarifa noNULL (0 válido), revisión comercial exacta, nombre/precio/soldByWeight/pricingUnit/factor mass-si-1 actuales. catalogRevision discordante produce409 catalog_changed con información autorizada para revisión, sin escritura parcial ni precio cambiado silenciosamente. Validar dimensión y unidad de captura habilitada; precio se interpreta por pricingUnit del producto aunque captura use otra unidad de masa. Persistir originales exactos y metadatos, posición y sourceLineId reales; no fusionar por productId, no inventar financialSnapshot en abiertas. total_snapshot puede contener la proyección calculada al crear, sin convertirlo en autoridad única de lectura frente a moneda mutable.

Las barreras0102/0103/0105 continúan: CI debe probar recorrido canónico unit y rollback real; negativos/álgebra mass pueden cubrirse en helpers, distinguiéndolos de escritura canónica todavía prohibida. No desactivar constraints/triggers, escribir filas imposibles ni ampliar migraciones. Si la barrera devuelve el rechazo temporal conocido, mapearlo de forma precisa y segura, sin ocultar errores desconocidos.

## Paths autorizables al reservar

- apps/merchant/src/modules/pos/server/routes.ts, solo POST orders/imports necesarios
- apps/merchant/src/modules/pos/server/measured-create.ts, nuevo servicio
- apps/merchant/src/modules/pos/server/measured-capture.ts, nuevo helper transaccional compartible por posterior PUT
- apps/merchant/src/modules/pos/server/measured-create.test.ts, solo si aporta pruebas puras decisivas
- apps/merchant/src/modules/pos/server/measured-create.neon.integration.test.ts
- docs/factory/0242-cp2b-create-handoff.md

Sin otros writers/readers/list.ts/contratos aceptados/input helpers/schema/journal/Counter/kit/guardias/tooling/deps/UI/estados/índices. Si requiere compartir un helper de locks/local/mesa o un error tipado fuera de estos paths, proponer extensión concreta antes de editar. No duplicar SQL global ni cambiar guardia para conseguir PASS.

## Aceptación y evidencia

Node24, tipos db/domain/merchant, lint/formato/UIguard/guardias pertinentes y tests focales. CI exclusivamente tools/neon-test.sh, env seleccionado y reserva exclusiva hasta teardown. Reales: guard401403/scope A→B antes de efectos, tenant, cuatro tipos y mesa/local/módulo/ocupación; items vacíos y tarifa0; intentos idénticos seriales y concurrentes crean exactamente una orden y mismas líneas/ID; clave distinta crea otra; clave reutilizada diferente409 y cero cambios; replay después de cambiar catálogo y archivar local/mesa no recaptura ni pierde orden propia; revisión comercial vieja409 rollback íntegro; producto ajeno/inactivo/sin precio; fallo de última línea revierte cabecera y anteriores; ninguna preparación crea ledger/pago/evento/consumo. Conservar compatibilidad POST V1 unit. Concurrencia comercial validar con mecanismo determinista del test, sin sleeps como prueba de orden.

Congelar SHA antes de checks y guardar log completo con comando/exit/config fueraWT, incluyendo fallos y límites. No browser/build/M0/M1/fullverify por ceremonia, no certificar mass canónico ni cierre. Autor conserva fixes hasta aceptación; QA independiente nuevo valida candidato y evidencia compatible. Entrega limpia y cero procesos; factory e integración solo coordinador. Sin push/PROD, servidores3201/túnel/M0/demos ni artefactos ajenos.
