# 0242 — CP2c.1 persistencia de acreditación con líneas medidas

Estado: preparada, sin autor/reserva. Autor nuevo/contexto vacío tras aceptar listado CP2b.4; coordinador fijará base y factory antes de código. Requiere0103 y núcleo financiero aceptados. Independiente de creación POS: no tocar rutas ni archivos del otro implementador. Leer protocolos, contrato0242 §1/4/5 y writer actual; sin subdelegar.

## Resultado acotado

Preparar la persistencia core.order/core.order_item para recibir snapshots medidos confiables del futuro cierre POS V2, sin nombres/rutas de módulos opcionales en core. Mantener persistGrant legacy y sus callers actuales compatibles. Agregar entrada medida explícita tipada, o adapter con discriminante inequívoco que permita reutilizar la MISMA sentencia/transacción y sus garantías; describir diseño a root antes de editar. No duplicar ledger, SQL de acreditación, selección de cupón ni generación de eventos. La API nueva no se expone a cuerpo HTTP arbitrario.

Líneas medidas llevan cantidad/precio strings exactas y measure completo (kind,quantityUnit,priceUnit,conversionVersion), más nombre/producto/lineTotal financiero autoritativo. Persistir originales y cuatro metadatos en columnas0103; no convertir a Number ni reinterpretar gramos como piezas. sourceLineId es referencia opaca de productor; no FK nueva ni supuesto de identidad igual al order_item generado. Validar coherencia con helpers aceptados y fuente confiable: no aceptar total/medida del cliente, no recalcular tarifa desde lineTotal redondeado. Snapshots unit históricos admiten límites trusted propios; nuevas capturas siguen límites nuevos. No estrechar el writer legacy ni el decoder antiguo.

Conservar íntegros bump de membresía, total neto autorizado, units de acreditación ya decididas por dominio, visit/customer projection, pushQueue, createdAt, claves y rollback SQL. No modificar fórmula de puntos/sellos ni usar cantidades físicas como acreditación. Mantener unicidad negocio/clientRequestId y tratamiento de carreras: el writer actual deja23505 abortar la transacción y su caller relee; no añadir ON CONFLICT que permita doble bump ni anunciar idempotencia concurrente directa que el caller no garantice. Entrada inválida o fallo en última línea revierte pedido/acreditación/push/proyección enteros. El writer no debe crear efectos externos después de commit por su cuenta.

No activar mass, cambiar barreras/migraciones ni conectar close/grant-coupon/UI. Unit canónico real y metadatos default pueden probarse en CI; álgebra/serialización mass en puro o VALUES, claramente separada de escritura canónica aún bloqueada. No desactivar triggers ni simular historia imposible para conseguir PASS.

## Paths autorizables

- apps/merchant/src/server/counter/orders.ts, refactor mínimo y compatibilidad legacy
- apps/merchant/src/server/counter/measured-order-input.ts y measured-order-input.test.ts, si hace falta helper servidor genérico
- apps/merchant/src/modules/pos/server/measured-core-order.neon.integration.test.ts, ubicación de fixture del productor sin imports de módulos en core
- docs/factory/0242-cp2c-core-order-write-handoff.md

Sin grant-coupon/coupon-discount/close/routes/orders POS/crear del otro autor, schema/journal, eventos/consumers, UI/kit/guardias/tooling/deps/estados/índices. Contratos HTTP no cambian: entrega interna. Cualquier caller que requiera adaptación fuera de paths vuelve a root antes de editar. No relajar assertions ni mover responsabilidades de guard al writer.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes y puros decisivos de exactitud/metadata/legacy. CI exclusivamente tools/neon-test.sh/env seleccionado con reserva exclusiva hasta teardown. Crear acreditación real con membresía/productos/negocio propios y examinar core.order_item exacto, neto/balance/units/push/proyección; mismo flujo legacy conserva resultado. Fallo transaccional deliberado en línea inválida/metadata tiene cero cambios en todos esos efectos. Duplicado serial no vuelve a acreditar; carrera por misma clave debe conservar una sola venta/bump por mecanismo existente y rollback del perdedor, sin afirmar respuesta de API no conectada. Tenant de caller se conserva; no inventar auth por tests de writer directo.

Congelar SHA y logs completos fueraWT con comando/exit/config y fallos/exclusiones explícitos. Limpieza debe eliminar también owners/staff/sesiones propios y verificar ausencia; nunca borrar usuarios por prefijo genérico. No browser/build/M0/M1/fullverify ni mass canónico/cierre E2E afirmados. Autor conserva fixes hasta aceptación, QA nuevo independiente y evidencia compatible. Factory/integración solo coordinador; sin push/PROD/3201/túnel/M0/demos ni artefactos ajenos.
