# 0242 — Contratos de POS, cantidades y compatibilidad

Anexo normativo de [spec0242](0242-pos-unificado-y-venta-por-peso.md), ADR0155. Este documento fija el contrato antes de repartir UI/backend. Nombres de archivos nuevos son previsión; paths reales se reservan en la ficha del checkpoint. Implementar tipos puros compartidos antes de dos consumidores. No se ha implementado ninguna ruta nueva en esta etapa.

## 1. Tipos y precisión

```ts
type Decimal = string; // canónico, sin exponentes, coma solo en presentación
type MassUnit = 'kg' | 'lb' | 'g';
type MeasureUnit = 'unit' | MassUnit;
type SaleType = 'table' | 'pickup' | 'delivery' | 'counter' | 'legacy';
type LineMeasure = {
  kind: 'unit' | 'mass';
  quantityUnit: MeasureUnit;
  priceUnit: MeasureUnit;
  conversionVersion: 'mass-si-1';
};
type PosLineV2 = {
  lineId: string; productId: string | null; name: string;
  quantity: Decimal; unitPrice: Decimal; measure: LineMeasure;
  lineTotal: string; // monetario normalizado vigente
  financialSnapshot?: FinancialLine | null; // tipo financial existente
};
```

`quantity` es cantidad en `quantityUnit`; `unitPrice` es tarifa por una `priceUnit`. Unit exige unidades unit/unit y cantidad entera positiva. Mass exige unidades de masa y cantidad positiva. Cantidad/tarifa hasta9decimales y valor máximo999999999,999999999; tarifa>=0, cantidad>0. Rechazar exponentes, NaN/infinito, exceso de escala/límite y overflow monetario **antes** de DB; no truncar. Total/pagos conservan límites y minorUnit0/2 actuales. Precio ausente no es gratis; precio0 almacenado sí.

Factor exacto hacia gramos: g=1, kg=1000, lb=45359237/100000. Fórmula bruta racional: quantity × factor(quantityUnit)/factor(priceUnit) × unitPrice. No Number/toFixed para decidir dinero o consumo. Usar decimal→BigInt racional y financial/rational existente, con parser tarifario hasta9dec; ExactAmount continúa representando centavos racionales con scale2 y el settlement normaliza a minorUnit y reparte líneas como hoy. No redondear tarifa/masa antes del total monetario; conservar originales/ajustes de normalización.

El límite de9decimales corresponde a capturas y tarifas, no a resultados derivados. Una captura en lb de9decimales puede producir gramos exactos de14decimales; los totales físicos derivados conservan esa precisión y no pasan por el parser de captura. Cocientes no terminantes se representan como racional reducido `{numerator:string,denominator:string}` con denominador positivo; su presentación aproximada no sustituye el valor fuente.

Cambiar unidad de captura sin editar la cantidad preserva la masa exacta original. Una conversión como g→lb puede ser no terminante: presentar aproximación con señal visible si hace falta y conservar el valor/unidad originales como fuente; no reenviar la aproximación como una medición nueva. Si se edita el número, pasa a ser una nueva captura válida en la unidad elegida. No imponer precisión fija de1g que el owner sustituyó por unidades configurables.

Al agregar línea se congelan nombre, tarifa, medida y versión de conversión. Editar su cantidad no cambia tarifa. Una nueva adición del mismo producto solo se combina si snapshots/precio/unidades coinciden; si no, crea otra línea con lineId distinto. No fusionar por productId a ciegas.

## 2. Negocio y catálogo

Business añade `salesMassUnits: MassUnit[]`, único/validado. Nuevos datos migrados usan ['kg']; productos existentes siguen unit. Owner o permiso business según writer actual puede editar; catálogo necesita permiso catalog. Retirar unidad referenciada por producto actual→409 unit_in_use con productos pertinentes del mismo negocio; snapshots históricos nunca bloquean ni se borran.

Se conserva el router de business/catalog; no crear /api/pos/catalog-writer alternativo:
- Nuevo GET `/api/business/sales-units` retorna `{salesMassUnits:MassUnit[],revision:number}`; PUT en la misma ruta recibe exactamente `{salesMassUnits,revision}` y retorna la configuración guardada con revision incrementada. Integrar en `server/business/http.ts`, `configuration.ts` y `lib/business-contract.ts`, bajo guard `requireApiPermission(request,'business')`. La ruta vive en el catch-all business actual; no existe ni se crea `/api/merchant/business` raíz.
- Usar el mismo mutex `business-config/<businessId>` y `business_configuration.revision` que regional/fiscal. Comparación/incremento/validación unit_in_use y escritura dentro de una transacción. Todo writer que introduzca o cambie la unidad de producto adquiere ese mismo mutex antes de validar unidades y escribir; orden de locks business-config antes del lock de producto/importe existente. Evitar carrera entre retirar unidad y asignarla a un producto. Revision ajena→409 business_revision_conflict, sin sobrescribir. GET no fabrica otra revisión. PUT no acepta timezone/fiscalidad/moneda para modificarlos indirectamente; conserva su contrato y guards. Error422 invalid_sales_units con fields.salesMassUnits; duplicados/unidades desconocidas/lista vacía inválidos.
- UI business carga la tercera sección con las otras dos, compara revisiones y, al guardar cualquiera, actualiza la revisión de los tres borradores sin perder sus valores no guardados. Un conflicto exige revisar estado autoritativo y conserva la intención para reconciliar. No forzar reload que descarte silenciosamente otro formulario.
- GET `/api/catalog`, POST `/api/catalog/product` y PUT `/api/catalog/product/:id` existentes: `soldByWeight:boolean`, `pricingUnit:'unit'|MassUnit`, `unitPrice:Decimal|null`, `unitCost:Decimal|null`, revisión explícita por producto. Añadir `salesRevision` entero positivo en producto (default1), incrementado transaccionalmente por todos los writers cuando cambien nombre/tarifa/modo/unidad/disponibilidad local. DTOv2 expone `catalogRevision:String(salesRevision)`; la cadena no es credencial. POST nuevo inicia1; PUTv2 recibe `expectedSalesRevision` y retorna la nueva. Conflicto409 catalog_changed con DTO autorizado; importación/reconciliación también incrementan y respetan los locks vigentes. Cambios de imagen sin cambio comercial no necesitan invalidar una cotización. Unit requiere pricingUnit=unit; mass exige unidad habilitada.
- UI checkbox “Este producto se vende por peso”; Precio de venta/Costo “por kilogramo/libra/gramo”. Lectores nuevos usan strings precisos; no convertir tarifas a JS number por DTO compartido.
- Clientes de catálogo v2 envían `X-Catalog-Contract: 2` en esas rutas (incluidas las de escritura), manteniendo el guard catalog sin gate de email que actualmente usa requireOwner como nombre histórico; DELETE sigue owner-only. HTTPv2 responde tarifas string/medidas/revisión y errores private,no-store. POS catalog ofrece esa misma proyección con X-Pos-Contract2. Readerv1 mantiene tarifa number de2dec solo para productos unit compatibles; si hay tarifa precisa/masa no representable,409 pos_client_upgrade_required sin coerción. Legacy reader/editor sobre producto unit compatible conserva contrato anterior. Writer legacy sobre producto mass→409 pos_client_upgrade_required y no cambia ni elimina medidas. Importación/reconciliación no adivina peso: nuevos importados unit; actualizar un producto medido sin conocer su contrato conserva medida/tarifa o genera conflicto explícito, nunca reset a unit.
- Modo incompatible con composición vigente→409 measurement_basis_required. La comprobación usa un hook genérico de cambio de medida de recurso (businessId,resourceType,resourceId,oldMeasure,newMeasure,tx), declarado por el proveedor de composición; catálogo/core no importan Recetas ni nombran su módulo. El contrato del hook se congela con la política de rutas en CP0/CP1 antes de consumers. La UI lleva a Recetas para definir base, sin cálculo inventado. Cambiar solo priceUnit de masa mantiene la base de receta anterior; se convierte por factor, no cambia receta ni historial.

Persistencia aditiva propuesta: campos de modo/unidad en core.product y configuración business; tarifas unitPrice/unitCost numeric(24,9), manteniendo restricciones existentes. Cantidades de pos_order_item y core.order_item numeric(24,9) con metadatos por línea. Índices/constraints y FKs por negocio conforme a patrón actual. Cada writer de esquema/journal tiene reserva única; SQL generado nunca se mergea concurrentemente.

## 3. HTTP POS v2 y autorización

Prefijo actual `/api/modules/pos/`. Cliente nuevo envía `X-Pos-Contract: 2` y `X-Backoffice-Scope` en todos los recursos POS y conserva su intención antes del await. Servidor conserva guard vigente, después valida scope/capacidad de contrato y recién ejecuta dominio. Cabeceras no son credenciales. Todas las respuestas adoptadas, también errores, `Cache-Control: private, no-store`.

-409 backoffice_context_changed: retirar ámbito/datos y restablecer documento; no reintentar bajo otra cookie.
-409 pos_client_upgrade_required: cliente antiguo/no contrato requerido; sin escribir; acción de actualizar aplicación. No servir fractional quantity como number al cliente viejo.
-401/403: revocación de estado/acciones como hoy; 404 unknown_pos_order mantiene no enumeración entre tenants.

La política de scope será metadato genérico en ModuleRoute consumido por dispatcher, aplicándose a POS completo. No hardcode del nombre del módulo en core ni extensión silenciosa de otros módulos. Actualizar ticket/settings/mesas/pagos y todos sus consumidores antes de exigir cabeceras. Reporter/auth siguen exentos como0238.

### Lecturas

| Ruta | Evolución v2 |
| --- | --- |
| GET orders | PosSummaryV2 en open/closedToday; filtros/orden/día actuales. quantityTotal legado no se suma entre medidas. |
| GET orders?status=voided | Mismo histórico90d con medidas/saleType. |
| GET orders/:id | PosOrderV2: shape actual más contractVersion2,saleType,orderLabel,items V2. |
| GET catalog?locationId | Productos/tarifas precisas, unidad, revisión; categories y frequentProductIds. |
| GET tables/payment-methods/ticket/ticket-settings | Contrato actual protegido por scope; etiquetas tipo/peso en impresión. |

PosSummaryV2: id,status,version,saleType,orderLabel,tableId,location,createdAt,closedAt,lineCount,total,saleTotal. lineCount cuenta líneas, no masa+piezas. Totales físicos opcionales se agrupan en `{unit:'unit'|'g',quantity:Decimal}`; no hacen falta para habilitar listado. Cada total financiero cerrado usa settlement neto; legacy sin settlement usa su snapshot explícito y no inventa coste/dinero.

La colección pública se llama `PosOrderV2.items: PosLineV2[]`, conservando el nombre actual. Las menciones a líneas en este anexo describen sus elementos; no crean una segunda colección `lines` ni aliases simultáneos.

Listado server agrega sin recuperar todas las líneas por orden; rango de día debe ser equivalente a timezone actual. Cambios a paginación/semántica por volumen requieren contrato adicional; no truncar abiertas para cumplir un benchmark.

### Crear y guardar

POST orders v2:
```json
{
  "createRequestId": "uuid",
  "saleType": "pickup",
  "orderLabel": "Paula / Pedido 24",
  "locationId": "uuid",
  "tableId": null,
  "note": null,
  "items": [{"productId":"uuid","quantity":"750","quantityUnit":"g","catalogRevision":"3"}]
}
```

→201 PosOrderV2. Reintento idéntico devuelve mismo DTO/id, sin duplicar abierta; misma createRequestId distinto payload→409 create_request_reused. Scope original y body se congelan antes de await. Resultado incierto se recupera con la misma intención, sin generar otra clave. Se requiere unique business+createRequestId y huella canónica; no convertir una clave enviada por otro tenant en lookup público.

Mesa: tableId real determina local/nombre; sin módulo Mesas, orderLabel libre según flujo actual. pickup/delivery: orderLabel1–60 obligatorio, tableId null. counter: etiqueta automática estable, sin mesa. legacy solo lectura/migración. items=[] permitido para abrir orden; cierre exige líneas.

PUT orders/:id conserva version optimista, nota/contexto y lista completa. Líneas existentes `{lineId,productId,quantity,quantityUnit}` mantienen precio/medida tarifaria/nombre; nuevas piden catalogRevision y snapshot servidor. No aceptar tarifa o medida congelada arbitraria del cliente. Catálogo cambió→409 catalog_changed con datos autorizados para revisar; no guardar/cobrar a precio distinto silenciosamente. Cambio de local no repricing.

Response canónica alimenta caché sin GET detalle/historial extra desde UI.409 version_conflict incluye orden actual como hoy después rollback; no reenvío automático.

Mostrador inmediato reutiliza POST orders + POST close: preparación guarda internamente la orden antes del modal de confirmación, con createRequestId idempotente. No añadir otra contabilidad ni endpoint de acreditación directa. Cancelar modal deja abierta recuperable. Nunca cerrar implícitamente al crear ni cobrar un total distinto del DTO/preview revisado. El doble viaje se mide; no optimizarlo rompiendo estado/idempotencia. Orden abierta recuperable es intencional.

### Cierre/anulación

POST orders/:id/close conserva `{clientRequestId,version,membershipId?,coupon?,payments?}` y añade lectura de cantidad V2 interna, sin precios calculados por cliente. Coupon puede identificar línea explícita si varias del mismo producto tienen snapshots distintos; validar que pertenece a esa orden/producto y mostrarla en preview. Gratis/2x1 no aplican a líneas `measure.kind='mass'`, por decisión explícita del owner. Mantener una unidad discreta bonificada y requisito quantity>=2 para2x1 en unit. Campo opcional `coupon.targetSourceLineId` selecciona una línea de la orden/producto; si es mass,409 coupon_measure_not_supported sin efectos y sin elegir otra automáticamente. Sin selección explícita, primera línea unit elegible del producto por orden estable; si solo existen líneas mass del producto, mismo409 (producto ausente conserva coupon_product_missing). Preview y cierre comparten la decisión pura. En una orden mixta no se excluyen otras líneas unit elegibles. Porcentaje/importe admiten masa y siguen reglas monetarias exactas. UI informa la restricción y permite excluir el beneficio de esta venta sin devolver selección global; no pedir cantidad bonificada ni cambiar el cupón por otro silenciosamente. UUID/cuerpo/scope y línea objetivo quedan congelados para reintento incierto.

Una transacción mantiene locks/versión/módulo/mesa, precios/saldo/cupón/pagos/evento/comisión como hoy. Total0→payments=[] y cierre normal con ingresos0. Idempotencia conserva misma salida/efectos ante carreras y replay; clave distinta para cerrada falla como hoy. No actualizar consentimiento/selección global por excluir un beneficio de esta venta.

POST void conserva anulación abierta idempotente; no anula cerrada ni cancela citas. Impresión abierta/cerrada no crea comandos de pago. Ante error aftercommit, conservar resultado cerrado y reintentar entregas durables por sus mecanismos actuales.

### QR

POST resolve v2 conserva qrToken/locationId y efectos de identidad/enrolamiento/last_scan actuales. Respuesta mínima POS: consumer,membership,program/accrual,couponState y revisión pertinente; elimina catálogo/rewards/atajos que POS ya tiene o que esta etapa suspende. No GET por enfocar escáner ni prefetch de resolve. GET coupon-state y acción global coupon-remove mantienen reglas/autorización; el texto rule se presenta, no se ejecuta. Cierre revalida servidor bajo locks.

## 4. Financial, eventos y consumidores

FinancialInputV2 usa quantity/measure/tarifa exactas; calcular originales racionales y reutilizar normalización/distribución/pagos actuales. FinancialInput legado se adapta como quantity entera unit/unit. No duplicar algoritmos de descuento en UI y servidor; compartir funciones puras, servidor manda.

Nuevo `sale.closed` **eventVersion4** deriva de V3 (que ya existe con etiquetas/comisión). Cada línea tiene quantity Decimal y measure; conserva sourceLineId,productId,resourceVersions,position,money,discountOrigin,productLabel,commissionMinor. V1/V2/V3 se decodifican como unit sin cambiar payload histórico. Decoder no adivina forma por UUID ni por estar guardado un string. Writers V4 solo se activan cuando todos los subscribers requeridos lo aceptan.

Recetas: revisión de composición añade basisQuantity/basisUnit de producto. Legacy basis1unit. La cantidad de ingrediente es cantidad vendida convertida a la base × composición × receta capturada. Operar racional exacto y consolidar por orden/línea/insumo; redondear solo a escala3 del ledger al final conforme ADR0148, conservando procedencia. Según ADR0148, consumo positivo que redondea a cero deja procedencia con estado redondeo_sin_consumo, sin movimiento de stock ficticio ni coste completo inventado. No mover resolución específica de recetas al core.

La procedencia medida añade numerador/denominador exactos y captura la base de composición en revisión/resolución; `consumption_source.exact_quantity` numeric(20,6) y `recipe_quantity` numeric(30,3) actuales no son fuentes exactas suficientes para conversiones no terminantes. Se conservan como proyecciones de compatibilidad, sin reconstruir el racional desde un decimal redondeado. El expand y los lectores nuevos deben distinguir procedencia legacy de la racional aditiva antes de publicar V4; no reescribir procedencia histórica para inventar exactitud.

Tanto cantidad exacta de insumo como cantidad de receta necesitan su racional. Las constraints de positividad deben validar la fuente racional cuando exista: una proyección decimal de un positivo diminuto puede ser0 y no debe impedir guardar su procedencia. Legacy mantiene sus validaciones anteriores; no aceptar numerador negativo/cero ni denominador no positivo para un consumo positivo. Ledger y estados de redondeo siguen ADR0148.

Stock: no inventar salida directa de producto terminado; aplicar el modelo de consumo configurado hoy. Sin receta/proveedor no crear un movimiento ficticio. Evento/consumo/commission idempotentes por sus claves actuales, coste pendiente/completo explícito. Confirmación de orden no consume ni crea merma. Replay V1–V4 no duplica.

Analytics: unidades discretas separadas de masa normalizada en gramos exactos; métricas de ingresos/neto/costos no se recalculan desde catálogo actual. Traductores POS/Recetas/Stock y lectores de ranking/ticket se actualizan en el mismo checkpoint de contrato. Frecuencia de órdenes por producto sustituye ranking incompatible de cantidades, campo frecuente y label explícitos.

## 5. Retiro y compatibilidad

Fases expand→migrate→cutover; no borrar columnas/tablas al primer deploy.
- Legacy sin tableId: saleType legacy; con tableId real: table; orderLabel copia tableLabel. Todas líneas anteriores unit, quantity string entera, tarifa anterior exacta. Mantener alias tableLabel durante transición para readers compatibles/ticket, sin usarlo como fuente del tipo.
- Backfill de medidas y createRequestId nuevos sin generar pagos,eventos,puntos ni nuevas ventas. Las claves históricas permanecen null donde no existe createRequestId.
- APIs POS admiten v1 de unit durante despliegue expand si no se activan writes/lecturas mass para esos clientes. Antes de cutover, cliente v2/scope y todas superficies deben estar listos. En cutover se exige v2/scope; cliente viejo→409 upgrade_required, ninguna escritura parcial. No periodo indefinido de writers viejos sobre líneas medidas.
- GET counter UI redirige a operación registrada y autorizada. POST/GET counter API retirados→410 feature_retired, guard antes, sin resolver escaneo/escribir, sin redirect de POST. Módulos POS siguen usando dominio común mediante rutas POS.
- staff activo con counter y POS activo obtiene pos, conserva counter para Clientes/otros permisos; POS apagado/estado ambiguo→inventario de excepción para resolver antes corte, sin activación silenciosa. Owner no se convierte en staff ni se altera su columna vacía. Etiqueta de permiso counter se presenta como Clientes durante compatibilidad.
- Canje directo de premios queda suspendido: no endpoint activo de débito/entrega, ni botón en POS o pantalla legacy. reward_redemption/saldos intactos. Ningún cambio de endpoint/UI de canje PWA.

Rollback de aplicación requiere lectura V4/medidas: una vez que existen ventas medidas no se vuelve a binario v1 que las lea como piezas. Desactivar nuevas ventas por peso y volver a un candidato compatible; conservar órdenes, cupones y eventos. No downcast de cantidades/tarifas ni borrar historia para volver atrás.

## 6. Errores adicionales y evidencia

422 invalid_measure, invalid_quantity, invalid_price, amount_out_of_range, invalid_unit (fields);409 coupon_measure_not_supported, unit_in_use, measurement_basis_required,catalog_changed,create_request_reused,pos_client_upgrade_required; conservar códigos auth/version/local/mesa/cupón/pago actuales. Conflicto operativo no se reetiqueta saldo insuficiente. No imprimir tokens/cookies/QR/scopeKey/PII en logs entregables.

Tests exactos:1lb=453,59237g; precio4/lb×2lb=8; precio0,01/g×250g=2,50; captura equivalente kg/lb/g; unit entero; cambios de unidad sin edición; snapshot old/new mismo productId no merge; precio0/null; cupones0/2x1 en unit y neto0; rechazo gratis/2x1 mass sin consumir, orden mixta unit elegible, selección mass explícita rechazada, porcentaje/importe sobre peso; monedas0/2; overflow/escala; replay V1–V4; scope/cookieA→B y baja de permiso; create/close concurrente, timeout y reintento congelado. Todos contra contrato real y CI aislada cuando corresponde.
