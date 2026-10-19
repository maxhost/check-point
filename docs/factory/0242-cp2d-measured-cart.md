# 0242 — CP2d.1 carrito medido y captura manual de cantidades

Estado: preparada, sin autor/reserva. Requiere descuento exacto CP2c.3 aceptado antes de asignar. Autor nuevo con contexto vacío; coordinador fija base/factory. Entrega UI acotada, sin sustituir todavía PosConsole ni asumir cobro completo. Leer protocolos, contrato0242, COPY y skill impeccable (harden/craft-floor); el contexto de diseño ya fue cargado por coordinador, no volver a iniciar context/init ni tocar artefactos ajenos.

## Resultado

Componentes y modelo de borrador V2 reutilizables para el futuro editor: carrito con identidad por línea/snapshot, captura manual y presentación de cantidad/unidad/tarifa/importe. Harness de componentes verifica interacción real con kit; el contenedor operativo y su transporte se integrarán en otra entrega. No publicar una pantalla alternativa ni introducir rutas nuevas. Al entregar distinguir explícitamente componente preparado de POS completo conectado.

Borrador existente conserva lineId, producto inclusoNULL, nombre, cantidad original, tarifa/priceUnit/factor y financialSnapshot de la fuente autorizada. Nuevas líneas conservan catalogRevision recibido y mandarán solo campos admitidos por comando V2; no precios del cliente. Modelo de serialización usa contratos aceptados y no genera UUID de create/close ni llamadas HTTP. Reutilizar canCombinePosLines para adiciones con snapshots comerciales realmente idénticos; nunca fusionar por productId solamente. Preservar IDs de existentes, posición, cardinalidad y límite200. Si no es necesario fusionar, mantener líneas separadas es válido; no ocultar dos precios del mismo producto.

Unit usa cantidad entera y controles accesibles; nuevo/cambiado respeta límite de captura, pero un valor histórico alto sin cambio sigue conservable. Tarifa histórica amplia también se conserva. Mass requiere captura manual explícita antes de añadir; no inventar1kg por pulsar producto. Mostrar unidad de captura y tarifa por priceUnit congelada, incluso si son distintas. Selección de unidad para presentación se separa de fuente: conversión no terminante lleva aproximación visible, y cambiar solo presentación NO modifica cantidad/unidad original ni serializa un redondeo como nueva medición. Una edición manual explícita captura nueva cantidad decimal9 y unidad habilitada. Unidad histórica deshabilitada permite conservar la fuente sin cambio; no introducir captura nueva en ella.

Campos mantienen buffers vacíos/parciales/erróneos y feedback comprensible sin convertirlos silenciosamente a cero ni enviar el valor anterior como si la edición fuese válida. Normalización de coma de presentación a decimal canónico sucede solo en captura explícita y sin Number como autoridad. Errores de escala, límite, dimensión y overflow bloquean confirmación/serialización del borrador. Calcular importes desde el núcleo financiero común con snapshots confiables; no toFixed/Math como otro núcleo. Tarifa exacta se presenta con unidad y precisión necesaria, separada del importe monetario normalizado. Precio0 es válido, sin precio no se añade.

Usar únicamente kit, iconos/tokens existentes y tuteo; nada de nuevos nativos/handlers/style/CSS/paleta/tipografía crudos ni cambios a kit/guard. No añadir CTA final duplicado: el contenedor futuro tendrá acción/total únicos en móvil. Capture dialog puede tener confirmación de la cantidad, claramente distinta del cobro. Teclado, foco, etiquetas de línea/unidad, errores y tamaños táctiles deben ser utilizables. Inspección visual agrupada390/1280 y como máximo una confirmación tras corrección; no iniciar un rediseño ni pulido ilimitado.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/measured-cart.tsx
- apps/merchant/src/modules/pos/ui/measured-quantity-dialog.tsx
- apps/merchant/src/modules/pos/ui/measured-cart-model.ts y measured-cart-model.test.ts
- tests/e2e/pos-measured-cart.spec.ts
- tests/e2e/support/pos-measured-cart-harness.tsx y pos-measured-cart-fixture.ts
- docs/factory/0242-cp2d-measured-cart-handoff.md

Sin PosConsole/editor actual/transport/cache/payment/printing/routes/backend/financial/schema/kit/guardias/tooling/deps/estados/índices. Si harness requiere entry/config adicional, proponer extensión antes de editar y usar infraestructura existente. No escribir en artefactos Impeccable ajenos.

## Gate

Node24, tipos merchant (otros paquetes solo si identidad/cambio lo requiere), lint/formato/UIguard y pruebas puras de fuente/serialización y browser decisivo. Casos: unidades nuevas/históricas, mass manual sin valor implícito, kg/lb/g y cambio solo presentación conserva fuente, aproximación no terminante sin edición vs nueva captura explícita, snapshot viejo y nuevo mismo producto, producto borrado, unidad deshabilitada sin cambio vs nueva rechazada,0/null, coma/9dec/escala/overflow/buffer inválido,200 líneas, errores impiden confirmar y teclado/doble confirmación sin duplicar adición. Harness no certifica Next→guard→DB ni venta por peso canónica. Capturas abiertas e inspeccionadas, no solo guardadas.

SIN DB/env/wrapper ni servidores ajenos; harness/puertos/procesos propios con cierre verificable. Chromium MachPortRendezvous1100 es bloqueo sandbox conocido: escalación acotada del runner autorizado y reportar rápido, no confundir con fallo del producto. Logs/capturas fueraWT ligados a SHA congelado/config/comando/exit; fallos/skips/límites conservados. QA nuevo independiente; autor conserva fixes hasta aceptación. Entrega limpia0procesos, factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos.
