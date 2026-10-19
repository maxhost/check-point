---
spec: 0242
fecha: 2026-10-18
estado: funcional cerrada; puntos1–5 y regresión aceptados localmente; M1 R2 final en curso
resumen: Rediseño integral del POS con Mostrador integrado, órdenes por tipo, medidas de catálogo, retiro de Mostrador legacy y mejora de carga/autorización basada en0238.
disjunta: no; POS, catálogo/business, auth compartida, financial, eventos, Stock/Recetas y analíticas
archivos: ámbitos y escritores definidos en docs/factory/0242-plan-implementacion.md
---

# 0242 — POS unificado y venta por peso

**L3**, por dinero, cantidades, auth/tenant, migraciones y consumidores de eventos. Owner pidió mapear con agentes, comparar laboratorio, escribir spec/plan y dejar handoff antes de implementar con agentes. La fase inicial fue documental; el owner autorizó retomar implementación por checkpoints con dos implementadores y QA independiente. Base producto `5f9cb2b2af49fa45850c059ef33f8bb69ea15172`; reserva local `ec454681`. Sin push ni operaciones PROD.

Fuentes: [decisiones D001–D019 y posteriores](../design-explorations/2026-10-18-mostrador/decisiones.html), [v004](../design-explorations/2026-10-18-mostrador/versiones/v004/index.html), [mapa actual](../factory/0242-mapa-actual.md), [rendimiento](../factory/0242-performance.md), [ADR0155](../adr/0155-pos-unificado-cantidades-y-cupones-de-premio.md), [contratos](0242-contratos-pos-y-medidas.md), [plan](../factory/0242-plan-implementacion.md).

## 1. Resultado y alcance cerrado

POS pasa a concentrar todo el proceso de venta. Mostrador deja de ser una consola independiente y pasa a ser un tipo de venta. Se rediseñan listado/creación/editor/revisión/QR/cobro/resultado/tickets y estados de recuperación, preservando las capacidades existentes. Teléfono prioritario, escritorio con catálogo y orden simultáneos.

Entra: Mesa, Para retirar, Delivery y Mostrador; lista abierta y cerradas/anuladas; filtro local y anulación; notas; QR opcional; cupones existentes; pago/total0; precios/unidades de masa de negocio y catálogo; cantidades/snapshots/eventos/consumo/métricas compatibles; navegación/permisos/retirada legacy; optimización focal de carga y protocolo de intención0238.

Fuera: PWA canje de puntos/sellos por cupones, políticas de esos premios, Agenda/citas reales, GYM/membresías, taller/vehículo/tratamiento, logística/tarifas delivery, tara/balanza/etiquetas, PSP nuevo, devoluciones o reapertura de cerradas, nuevas reservas de stock, fidelización de ventas externas, realtime/offline y refactor global de cookies/driver/pool/auth. Las maquetas de otros rubros orientan extensiones; no son funcionalidades que se prometen en0242.

**Cambio de alcance del owner durante el mapeo:** no implementar emisión PWA; **dejar de ofrecer el canje directo actual por ahora**. Se preservan saldos y todo historial; no reembolsar/convertir/borrar registros. Retirar UI y bloquear writes legacy es parte de aceptación, no se reemplaza por un canje improvisado dentro del POS.

## 2. Recorrido completo

### 2.1 Listado y entrada

Entrada habitual muestra abiertas con tipo, identificador, local, total y número de líneas. Búsqueda por mesa/nombre/referencia; filtro local; cerradas/anuladas del día local y acceso a anuladas90d existentes. Abiertas orden antiguo→nuevo; cerradas/anuladas reciente→antiguo. No llamar cantidad de productos a kg+unidades. Total neto cerrado proviene del settlement aunque no haya cliente.

Nueva orden abre tipos habilitados por capacidades del comercio. Mesa solo se presenta cuando se puede usar el flujo de mesa actual: con módulo Mesas se elige mesa real; sin él se mantiene etiqueta libre del POS existente. El módulo POS apagado sigue bloqueando ventas. Selección de local conserva reglas actuales: único activo automático; varios exigen elección válida, sin mezclar borradores o catálogos.

| Tipo | Identificación | Confirmación y cobro |
| --- | --- | --- |
| Mesa | tableId real o etiqueta Mesa según configuración actual | Confirmar guarda abierta. Se retoma/modifica y cobra al cerrarla. |
| Para retirar | Etiqueta obligatoria1–60: nombre/referencia | Igual, sin mesa. |
| Delivery | Etiqueta obligatoria1–60: nombre/referencia | Igual, sin mesa ni logística nueva. |
| Mostrador | Referencia automática legible con número de orden; no pedir mesa | Armar venta, identificar si corresponde y cobrar. Crear el borrador necesario es interno; no exige un paso manual Guardar. Si se cancela cobro, la orden sigue abierta/recuperable. |
| Legacy | Histórico/open sin origen inequívoco | Conservar etiqueta/mesa y operación; no adivinar tipo por nombre. Nuevas órdenes no eligen Legacy. |

Cambiar tipo conserva líneas y exige revisar/retirar mesa cuando no aplique; no cambia precios. Confirmar sin líneas conserva la posibilidad actual de abrir mesa/orden vacía. Cobrar vacía se rechaza. Orden `open→closed|voided`; no reapertura de cerrada. “Retomar” solo abre una que sigue abierta.

### 2.2 Armar/revisar/guardar

Mismo borrador en Catálogo y Orden. Teléfono: vistas dentro del espacio; total final y acción primaria solo en pie fijo. Subtotal/descuento en cuerpo cuando aportan desglose. Desktop: catálogo y orden en columnas, acción/total en panel. No copiar fuentes/CSS nativos de laboratorio a merchant: kit/tokens existentes, tuteo y guardia vigente.

Búsqueda/categorías/frecuentes visibles; añadir/corregir unidades o peso; nota existente; retirar línea; ver precios y cantidades con sus unidades. Borrador modificado muestra Guardar/Confirmar antes de cobrar una versión distinta de la persistida. Salida con cambios ofrece conservar trabajo o descartarlo explícitamente; no descartar por cambiar vista/abrir escáner/modal. No autosave por cada toque ni DB por pulsación.

POST/PUT publica DTO canónico en caché. Conflicto conserva borrador y muestra orden actual sin sobrescribirla;404 y cierre/anulación ajenos tienen salida clara. Identificador de Retiro/Delivery y nota aparecen también en lista/ticket. Impresión/precuenta/reimpresión y anular siguen accesibles según estado/permisos.

### 2.3 Cliente, cupones y pago

Venta anónima válida. QR identifica cliente y cupón seleccionado en PWA, sin exigir cupón. Mantener efectos reales actuales del escaneo (puede enrolar/registrar last_scan); no prometer lectura pura ni prefetchearlo. Cliente/cupón temporales por orden actual: cambiar vistas/modal conserva; salir/recargar no crea asociación persistida nueva. UI explica cuándo se pierde contexto. Cambiar persona retira beneficio previo y conserva líneas; respuestas tardías no lo restauran.

Cupón: mostrar tipo, efecto económico y texto íntegro de reglas del merchant, con expansión accesible si largo. El operador revisa condiciones de texto; no se interpretan automáticamente. Mantener elegibilidad técnica/fechas/local/moneda/selección/límites diarios existentes. Quitar beneficio de una venta es exclusión local; no POST coupon-remove global salvo acción que diga expresamente devolver la selección.

**Decisión explícita del owner al retomar0242:** «No aplican a productos por peso. Gratis ni 2x1». Gratis/2x1 solo bonifican líneas de unidades discretas y conservan su cálculo actual de una pieza (2x1 exige al menos2). No pedir peso bonificado ni usar una unidad tarifaria automática. Si la línea objetivo se vende por peso, mostrar “Gratis y 2×1 no aplican a productos por peso” y no aplicar/consumir el beneficio; el cierre servidor lo rechaza con409 coupon_measure_not_supported si se intenta incluirlo. El operador puede quitar el beneficio de esta venta y cobrarla normalmente.

La restricción se aplica a la línea objetivo de gratis/2x1, no a toda venta mixta: una línea unit elegible puede recibir el beneficio aunque haya otras por peso. Sin selección explícita se elige la primera línea elegible del producto por orden estable; una selección mass explícita se rechaza sin cambiar de línea silenciosamente. Porcentaje/importe se calculan sobre dinero exacto y sí admiten productos por peso. No interpretar texto de reglas ni añadir configuración general de exclusiones. Esta decisión sustituye la propuesta pendiente de cantidad bonificada y la instrucción anterior de no añadir ninguna exclusión por peso.

Confirmar cobro es el único comando de cierre, consumo de cupón y acreditación. Total0 con línea real usa payments=[], permite cerrar sin efectivo/medio ficticio y sigue generando stock/evento. Mostrar “Cerrar venta sin cobro”. Mantener reglas existentes de acreditación por programa/neto, sin crear otra política para premio. Pago es registro con medios existentes, no procesamiento PSP nuevo.

Preparación revalida cupón y medios cuando corresponda. Cambios de importe requieren nueva revisión. Timeout/5xx ambiguo →closeUncertain, no “falló, vuelve a pagar”. Congelar UUID/cuerpo/version/scope antes del await; reintento explícito idéntico. Cierre repetido no duplica pagos/cupón/puntos/eventos/comisión/stock. Fallo de impresión o aftercommit no convierte una venta ya confirmada en error de cobro.

## 3. Peso: negocio, catálogo y snapshots

Business permite unidades de venta por peso kg/lb/g. Producto tiene checkbox “Este producto se vende por peso”; apagado conserva unidad discreta, encendido permite tarifa por una unidad habilitada. Precio/costo se etiquetan por esa unidad y admiten precisión tarifaria, sin conversión mental. Captura POS arranca en unidad tarifaria y permite convertir entre habilitadas preservando masa; teclado decimal y coma/punto localizados. No conectar balanza.

Contrato exacto, límites, persistencia y compatibilidad en anexo. Precio/nombre/unidades/factor congelados al agregar línea; cambiar producto/unidad de negocio no reprecifica abierta ni histórico. Retirar una unidad aún referenciada impide nuevos usos pero no borra snapshots; mantenerla mientras catálogo actual la use o pedir corregir productos antes de retirar. Guardar unidad ilegítima falla con campo y mensaje.

Cambiar modo unit↔mass en producto con composición vigente exige declarar su base de producción en Recetas antes del cambio; no inferir que la receta por pieza produce1kg. Si hay composición incompatible,409 measurement_basis_required con vínculo a configuración; sin módulos de consumo no inventar dependencias. Nuevas revisiones capturan base y convierten cantidad vendida con factor racional; snapshots/eventos viejos no se recalculan. Mermas explícitas separadas de venta. Aplicación durable pendiente se comunica como pendiente, no stock ya descontado.

Ranking rápido será por frecuencia de órdenes cerradas que contienen producto en30d (una aparición por orden), con nombre “Frecuentes”; no mezclar kg y piezas en ranking de cantidades. Métricas mantienen unidades discretas y masa separadas. Histórico conserva medidas/snapshots; conversiones físicas no cambian ingresos financieros ni recalculan meses anteriores.

## 4. Acceso y rendimiento

Adoptar ADR0154/spec0238: provider/seed autorizado para presentación, contexto por Request, guard ordinario en cada petición, scope de intención antes de dominio y respuestas privadas/no-store. Incluye catálogo/listado/detalle/create/update/void/close/resolve/coupon/tables/ticket/payment-methods y settings con owner donde hoy corresponde. Nuevos clientes no ejecutan acciones sin scope listo.403/revocación y409scope limpian acciones; no reenviar bajo identidad nueva. Implementación genérica de política de ruta en dispatcher, sin if pos en core.

Eliminar GET sesión inicial propio y GET módulos extra. Cargar lista directamente del contexto listo; catálogo al requerir venta/local; ticket fuera de camino crítico. Mantener epoch/version/cache por scope/local, sin caché persistente de autorización. Listado agregado sin descargar todas las líneas; batch de updates si M0 demuestra coste; paralelizar solo lecturas independientes fuera de misma conexión transaccional. No añadir índices sin EXPLAIN/fixture/permiso de migración asignado.

M0 y gates antes de código de optimización: [protocolo](../factory/0242-performance.md). M1 debe demostrar mejora de listUsable y no regresión material en guardar/QR/cobro/cierre, con intentos completos por SHA/build/DB. No extrapolar49→18SQL o ~20%Inbox al POS. No cambiar cookieCache/duración/firmas/driver/pool global sin un nuevo encargo justificado.

## 5. Retiro Mostrador y datos existentes

Retirar consola, navegación, onboarding/tours/defaults y acreditación externa. Mantener dominio QR/cupón/acreditación reutilizado por POS, trasladando tipos/componentes antes de borrar UI. `/backoffice/counter` redirige a entrada operativa genérica declarada por módulos, preservando local solo si autorizado. No nombres del módulo en core.

Después del corte, APIs públicas legacy de counter responden410 feature_retired tras guard y sin efectos de dominio. No redirigir POST a POS ni mantener POSTgrant/redeem como otra vía de venta/canje. POS llama dominio compartido mediante sus rutas autorizadas.

Permiso core counter también controla Clientes: conservar clave de compatibilidad, mostrar etiqueta Clientes y actualizar consumidores/tours; no tratar su ausencia como permiso pos. Migración de staff activos que tenían counter añade pos en el mismo negocio solo si POS ya está activo, conservando Clientes y demás permisos; no owner elevation ni otros módulos. Antes del corte, inventariar negocios/miembros relevantes. POS apagado o membresías ambiguas son excepciones de despliegue que exigen resolución explícita por owner; no activar módulos silenciosamente. Owner afirma que actuales comercios usan POS; no convertir afirmación en inventario DB ya verificado.

Conservar core.order/reward_redemption/coupons/pagos/eventos/saldos. No generar ventas para convertir históricos ni restaurar cupones consumidos. Programa y su configuración antigua de canje insuficiente permanecen datos históricos; no habilitan canje POS ni cliente. Ocultar el ofrecimiento de canje en superficies merchant afectadas y retirar acceso directo; PWA sin emisión no se modifica en0242. Cualquier copy consumidor contradictorio se reporta como limitación existente, sin ampliar funcionalidad PWA.

## 6. Entrega y aceptación

Plan por dos implementadores más QA independiente, con escritor único de contratos/esquemas/guards/eventos. Ver [plan](../factory/0242-plan-implementacion.md). No implementar el siguiente checkpoint antes de su contrato/base aceptados. Migraciones solo CI/desarrollo protegido por tools/neon-test.sh; cada producción/push espera autorización de ese caso.

DoD de producto y seguridad:
- [ ] Lista completa y ciclos de los4tipos, etiqueta/mesa/local, vacíos, notas, filtros, anular y tickets reales preservados.
- [ ] Móvil320/390/430 con texto200% y desktop1440, CTA/total único, foco/teclado/errores, borrador conservado.
- [ ] Mezcla piezas/kg/lb/g, tarifa por gramo, equivalencias exactas, límites, snapshots al editar/borrar producto y composición.
- [ ] Monedas minorUnit0/2, total0, reparto y suma pagos, gratis/2x1/porcentaje/monto/reglas visibles; sin interpretación de texto.
- [ ] Idempotencia create/close, carreras, before/aftercommit incierto, versión, límites diarios, cupón ajeno/usado y revocación.
- [ ] V1/V2/V3 y V4 replay, stock/recetas/comisión/analytics/tickets equivalentes y sin conteo masa+piezas.
- [ ] Staff/Clientes/POS activo, legacy410 sin escrituras, redirects/local y canje suspendido sin borrar datos.
- [ ] Negativo real intenciónA/cookieB:409 antes de dominio; sin segunda escritura ni datos deB mostrados comoA.
- [ ] M0/M1 y gates de rendimiento con evidencia reproducible, sin declarar PASS por skips/retries o inconclusos.
- [ ] QA de entregas y de combinación sobre candidato congelado, integración solo local; release separado con pre-push vigente.

## 7. Estado de esta etapa

Puntos1–5 del [plan](../factory/0242-plan-implementacion.md) aceptados localmente:
UI por el owner, masa/invariantes0108, corte HTTPV2 y retirada de accesos/UI
anteriores, fidelización y cadena de efectos con QA independiente. Combinado
funcional a9d32924, entrega QA29b8592c. Regresión dirigida del autor39suites/197casos
PASS compatibles, aceptada3a5b98a7/QA cbd8cd75 en main local5c158325; otras7 sólo por lectura.
M1 R1.3 acredita listado, con QA independiente; rutas críticas R2 y cierre global
siguen pendientes. No publicación ni PROD. Evidencia y límites en el plan y sus
handoffs; la aceptación funcional no sustituye el gate de rendimiento.

El contrato funcional recoge las respuestas explícitas del owner del18oct2026:
PWA fuera; suspensión del canje directo; reglas de cupón visibles y exclusión de
líneas por peso para gratis/2x1; porcentaje/importe permitidos. Estas decisiones
permanecen vigentes durante el cierre de P6.
