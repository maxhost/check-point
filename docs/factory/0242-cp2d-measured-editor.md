# 0242 — CP2d.4 editor visual V2 preparado

Estado: preparada, sin autor/reserva. Requiere comandos CP2d.3 aceptados, autor NUEVO/contexto vacío; coordinador fija base/factory. Bloque visible coherente editor+catálogo, separado de consola/listado/checkout/QR/cupón/ticket. No sustituir ruta productiva legacy en esta entrega. Leer protocolos, spec0242 §2, contratos crear/guardar y componentes/carrito/comandos aceptados; no cargar toda historia0242.

## Resultado

MeasuredPosEditor reusable que trabaja con PosOrderV2 y misma instancia PosCache/PosClientV2. Props/callbacks mínimos propuestos antes código: contexto autorizado/locales/capacidades, orden inicial o nueva, salida explícita, canónico guardado y preparar cobro con DTO confirmado. No importar componentes legacy que asumen quantity/unitPrice number ni adaptar masa aNumber para usarlos. Reusar carrito/captura/modelo y comandos aceptados; sin segundo borrador divergente por vista ni otra caché.

Tipos nuevos table/pickup/delivery/counter con etiquetas spec. Mesa con móduloMesas usa picker existente/carga on-demand y tabla real; sin él etiqueta libre actual. Pickup/delivery etiqueta requerida, counter referencia automática servidor sin pedir mesa ni nombre obligatorio. Local único activo automático, múltiples requieren elección válida; restaurar último solo si permitido. Cambio local no mezcla catálogos ni borra líneas silenciosamente: revisión/discard explícito según intención, mantener snapshots persistidos históricos si contexto sin cambios. Legacy abierta conserva tipo/etiqueta y se edita, no se ofrece legacy en crear.

Catálogo V2 al requerir venta/local desde misma cache: búsqueda, categorías y “Frecuentes” por ids servidor, cero DB por tecla; sin sumar piezas/peso ni renombrar frecuentes por más vendidos. Tarifa string y unidad visibles, precio0 válido, null sin venta; producto por peso abre captura manual VACÍA en unidad tarifaria habilitada, no agrega1kg implícito. Productos nuevos conservan revisión/cantidad/snapshot, líneas existentes conservan sourceLineId/snapshot y no se reprecifican por refrescar catálogo. Reusar límites/exactitud del modelo aceptado, sin duplicar cálculos. Nota existente, retirar línea, vistas Catálogo/Orden comparten borrador.

Teléfono: vistas dentro del editor y total/primaria solo en pie fijo; desktop catálogo/orden en columnas con total/primaria en panel. Contexto/cambios/errores claros, sin duplicar CTA ni total final arriba. Kit/tokens/COPY tuteo e identidad laboratorio0242 aprobada; no CSS ni nativos/handlers/paleta/tipografía arbitraria/kit/guard bypass. Skill impeccable ya aplicada, contexto cargado por coordinador una vez; NO init/drift ni tocar artefactos ajenos. Autor lee skill/harden y craft-floor antes UI, autoridad spec/COPY/kit/incumbent, sin nuevas preguntas de diseño.

Guardar/confirmar persiste snapshot completo V2 con comandos aceptados; response canónica alimenta misma cache sin GET detalle/history extra. Borrador modificado no permite cobrar importe distinto al revisado/persistido. Mostrador nuevo usa acción “Continuar al cobro”: prepara POST internamente y solo llama callback con DTO confirmado; sin paso manual Guardar, no cierra aquí. Otros tipos pueden guardar/confirmar. Cancelar futuro modal preservará orden abierta; el editor no anula por salir. OnPrepare callback no implementa medio/pago ni abreescáner por su cuenta.

Incierto muestra explicación+recuperación explícita, conserva UUID/body/scope y bloquea otra creación; no liberar por cerrar modal/re-render.409version_conflict muestra orden actual y permite revisión explícita sin perder borrador ni reenviar automático. catalog_changed muestra productos actuales y revisión explícita de líneas nuevas afectadas, no cambia silenciosamente snapshots guardados ni aplica tarifas nuevas a otras líneas. Si cambia medida no adivinar cantidad: pedir captura nueva. Descartar implica elección explícita; salida con cambios permite seguir trabajando o descartar. Montaje/cambio de scope retira comandos y respuestas previas; no completar callback de intención vieja en documento/orden nuevos. Guardado tardío no sobreescribe otro borrador seleccionado. Reusar403/401/contextchanged existentes para retirar acciones, sin saltarse transporte.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/measured-pos-editor.tsx
- apps/merchant/src/modules/pos/ui/measured-editor-model.ts
- apps/merchant/src/modules/pos/ui/measured-editor-model.test.ts
- apps/merchant/src/modules/pos/ui/measured-product-catalog.tsx
- apps/merchant/src/modules/pos/ui/measured-cart.tsx, solo prop opcional lineAmounts para importes distribuidos por el kernel del padre; default compatible
- apps/merchant/src/modules/pos/ui/pos-tables.tsx, solo opción tipada de contrato/transporteV2 compatible defaultlegacy si necesaria
- tests/e2e/pos-measured-editor.spec.ts
- tests/e2e/support/pos-measured-editor-harness.tsx
- tests/e2e/support/pos-measured-editor-fixture.ts
- docs/factory/0242-cp2d-measured-editor-handoff.md

Sin console/rutas/checkouts/QR/cupones/pagos/impresión/Counter legacy/cachecomandos/modelo aceptados/backend/contratos/schema/kit/guardias/tooling/deps/estados/índices. Pedir extensión concreta antes editar fuera scope. Harness reutiliza startCatalogHarness; no backend ficticio que omita transporte real hasta fetch boundary cuando se prueba recovery/header.

Interacción monetaria confirmada al componer: dos líneas0.49 COP tienen total global1, pero el componente aislado redondeaba cada fila por separado. Editor y fixture reutilizan buildFinancialAmountsFromSnapshots para gross y lines[].money.gross (orden fuente/posición), y pasan lineAmounts por key a MeasuredCart. No sumar redondeos independientes ni duplicar allocateCumulative. Datos inválidos no muestran importes viejos; default del componente conserva otros callers. Extensión coordinada antes de código.

## Gate

Node24 tipos merchant/lint/formato/UIguard, puros nuevos si útiles y browser decisivos: cuatro tipos/local/mesa, mass manual y líneas mismo producto distintos snapshots, nota/retirar/cambiar vistas sin perder trabajo, producto0/null, guardar canónico sin GET extra, counter preparación interna/cancelación conserva abierta, create respuesta perdida/recovery misma clave/body aunrerender, conflicto actual/productos requiere revisión, contextA→B y respuesta tardía no callbacks/escrituras deB. No repetir matriz monetaria/cart/transporte ya aceptada sin concern nuevo. Keyboard/foco/Escape/partialcantidad/errores accesibles y contenido largo a390/1280. Una inspección visual agrupada móvil+desktop abierta y máximo una confirmación tras fixes, no bucle de polish. Chromium sandbox MachPort1100 runner propio escalado autorizado desde inicio.

SIN DB/env/wrapper/Nextbuild/fullverify/M0/M1 ni auth nativa nueva por harness. Evidencia SHA/base/config/comandos/exits/fallos/skips/capturas abiertas fueraWT,0procesos/puertos propios al entregar. QA NUEVO independiente, fixes autor hasta aceptar; factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
