---
adr: 0148
fecha: 2026-10-15
estado: aceptada
resumen: Recetas independientes y composición versionada con resolución inmutable publicada por puntero genérico, consumo consolidado y procedencia por receta sin cambiar el core del cierre.
---

# 0148 — Recetas independientes y composiciones versionadas

## Contexto

[SPEC0232](../specs/0232-recetas-independientes-y-combos.md), piso L2 por dinero/migración. El owner separa receta y producto: receta de una unidad, con identidad/nombre/revisiones por comercio y sin producto obligatorio; producto normal usa como máximo una receta, combo varias, cantidades decimales, sin subrecetas ni combos anidados. La composición se edita en Recetas, no en Catálogo. Cambios de receta y de composición tienen historiales distintos. Cada venta usa ambas versiones vigentes al cerrar, sin bloquear ediciones por órdenes abiertas; lo vendido no cambia.

Lectura sobre `21a77b162669ea867eae34c9dc746c76f549cc5c`: `recipes.line` depende del producto con cascada; `recipes.revision` guarda snapshots antiguos con identidad de producto sin FK destructiva. El core captura en una sentencia MVCC **todos** los punteros de producto y elegibilidad (`apps/merchant/src/server/module-events/publish.ts:80-113`), y el consumidor expande solo la revisión de slot `recipe`. El evento admite `resourceVersions[]` sin conocer el contenido de cada revisión. ADR0138/0139 prohíben dependencias core→módulos; ADR0145 separa cierre durable y aplicación Stock posterior.

0230 conserva una fila de consumo por orden/línea/insumo y congela promedio local, factor, moneda y escala en su primera aplicación exitosa. Su sección «Compatibilidad R1» exige consolidar insumos repetidos, dejando el diseño de procedencia a R1. La nota técnica anterior del plan proponía agregar receta a la clave; el encargo permite escoger y justificar otra opción. No es una decisión de producto irrevocable.

El owner respondió antes de escribir: archivo bloqueado únicamente por uso en composición **vigente**, no por historial/ventas; nombres duplicados no detienen migración, se desambiguan determinísticamente con categoría o sufijo y se entrega lista; sumar por insumo/línea y redondear una sola vez a 3 decimales, con procedencia por receta persistida aparte. Texto/preguntas completos en SPEC0232. La cantidad real de duplicados todavía **no se midió**: este encargo no consulta DB ni genera migración.

## Decisión

### 1. Dos historiales de negocio y una resolución técnica

Recetas incorpora identidad independiente, nombre único activo case-insensitive y revisiones append-only con nombre e ingredientes por unidad, incluyendo nombres/unidades congelados de insumos. Ingredientes/cantidades siguen normalizados, sin rendimiento persistido. Su identidad no tiene FK al producto. Composición actual en Recetas relaciona producto con recetas y cantidades, con `isCombo`; su historial guarda asociaciones/cantidades y nombre del producto al guardar composición, sin fijar para siempre los ingredientes de cada receta. Esa etiqueta no promete nombre recapturado al cerrar: no requiere enganche core al renombrar el producto. La lectura histórica usa snapshots, nunca reemplaza etiquetas/unidades con valores renombrados hoy; legado sin etiqueta informa indisponibilidad. Mantener FKs compuestas por comercio en relaciones actuales y IDs históricos que sobrevivan al producto.

Agregar una resolución técnica append-only por producto que referencia `compositionRevisionId` y, para cada componente, `recipeId`, `recipeRevisionId`, cantidad y orden. No es una entidad editable ni un tercer historial de decisiones del comerciante. Guarda la combinación efectiva que puede capturar un cierre; sus referencias siempre apuntan a revisiones inmutables del mismo comercio.

Publicarla mediante `core.module_resource_version` existente: `resourceType=product`, `providerId=recipes`, **slot `composition`**, `versionId=resolutionId`. El nuevo slot distingue explícitamente el formato nuevo del slot `recipe` legado; no sobrecargar un UUID para adivinar su tabla o intentar dos decodificaciones silenciosas.

### 2. Publicación atómica y captura consistente sin cambios al core

Guardar composición inserta revisión/resolución y actualiza el puntero en un commit. Editar receta inserta su revisión y reconstruye las resoluciones de **todos los productos que la usan actualmente**, manteniendo la revisión de composición; actualiza todos sus punteros en el mismo commit. Sin esta propagación, una sopa editada seguiría consumiendo sus ingredientes anteriores en productos que no cambiaron su composición.

Serializar writers R1 por comercio con lock transaccional, incluido archivo, edición de receta/composición y fanout, releer uso/estado dentro de él y respetar orden estable de locks. El cierre no adquiere ese lock: lee MVCC y captura todos los punteros en la sentencia genérica actual. Ve el conjunto anterior o posterior; la atomicidad evita mezclas y el lock evita invalidaciones perdidas entre edición de receta y asociación concurrente. El costo es trabajo proporcional a productos que usan la receta, pagado por la edición, sin agregar esperas de Stock ni handlers al cobro. Medirlo al implementar; no prometer límites de latencia sin datos.

**R1 no necesita modificar esquema core, publicación, payload ni POS.** Usa `sale.closed` v1 y su array existente. Si el encargo P1 extiende a event v2, los lectores/consumidores R1 se adaptan a los campos comunes y conservan el significado del slot; no requieren medio de pago para expandir recetas ni confunden comisiones al cierre con costo Stock al aplicar. Los writers de archivos compartidos se coordinan antes de implementar.

No buscar revisiones por `created_at<=closedAt` al aplicar. Una transacción inicia antes del cierre y confirma después: su timestamp puede entrar retrospectivamente en esa condición aunque no fuera visible al vender. Tampoco basta ordenar timestamps por UUID ni usar la hora de aplicación. `closedAt` acompaña el punto de captura; los IDs del snapshot son la autoridad. La ausencia/error de una revisión capturada deja la entrega pendiente, nunca vuelve a la receta actual ni revierte el cierre.

### 3. Un movimiento consolidado y procedencia separada por receta

Conservar índice Stock `(business,order,line,item)` y consolidar ingredientes repetidos por línea antes de `applyConsumption`, compatible con 0230 y su cobertura. No agregar receta a la clave del ledger: eso dividiría movimientos que hoy forman una unidad idempotente, ampliaría cambios de lectura/valoración y exigiría reinterpretar su unicidad histórica.

Por cada componente, multiplicar ingrediente escala 3×cantidad de composición escala 3×unidades enteras de venta: aporte exacto escala 6. Sumar por línea/insumo, luego redondear una vez a 3, mitades lejos de cero, usando BigInt. Preview y consumidor comparten expansor. Un total redondeado 0 no inserta movimiento; se informa explícitamente y conserva su procedencia.

Persistir en el esquema Recetas, aparte del ledger, procedencia inmutable con comercio, evento/orden/línea, local/producto, resolución/revisión de composición, receta/revisión, insumo, cantidad de receta vendida, aporte exacto Q6 y cantidad atribuida Q3. Unicidad por comercio+orden+línea+insumo+revisión de receta, con validación de todas las referencias. La composición admite una sola entrada por receta; no se pierde procedencia por agregación ni por reparto 0. No inventar una FK/import a POS ni desde Stock hacia Recetas.

Asignar Q3 por **mayor residuo**: piso de cada aporte exacto y distribución de milésimas hasta el total redondeado según residuo descendente, desempate `(recipeId,recipeRevisionId)` ascendente. Sumatoria atribuida igual al movimiento, sin duplicar cantidad ni costo. Guardar exacto y atribuido permite auditar qué aportó cada receta y qué cantidad del ledger se le adjudicó; la discrepancia de precisión es explícita. Todo 0 conserva procedencias con asignación 0 sin inventar movimiento.

Procedencia, movimientos y confirmación de delivery son una sola transacción. Reentrega compara snapshot de origen/referencias/cantidades, conserva lo existente y rechaza diferencias; no recalcula costos ni completa procedencias históricas desde recetas actuales. Fallo de cualquier parte revierte aplicación entera; venta permanece cerrada según ADR0145.

### 4. Atribución monetaria y lectura 0230

Smart Menu podrá separar pizzas sueltas y dentro de combos mediante producto, revisión de composición y receta/revisión en la procedencia. El costo atribuible se calcula de la cantidad Q3 repartida y **los campos congelados del mismo movimiento Stock**: costo unitario, factor, moneda y escala. No un costo propio copiado desde el promedio actual ni una segunda valoración independiente por receta. Sumar exactos monetarios antes de redondear; no sumar importes por receta previamente redondeados para formar la venta.

Se conserva 0230: cantidades/versiones al cerrar; promedio local/factor/moneda al aplicar. Compras posteriores a la primera aplicación y cambios de receta no alteran snapshots; pendiente sin aplicar conserva su regla de primera aplicación exitosa. Histórico legado no gana atribución independiente inventada ni costo desde precios actuales.

Adaptar el wrapper de Recetas que calcula cobertura esperada a ambos formatos. Mantener sus tres estados `completo|incompleto|pendiente`, faltantes y suma exacta. Caso aporte positivo que redondea 0 sin movimiento: `incompleto`, razón `redondeo_sin_consumo`, nunca sin-receta ni costo 0 por ausencia. En línea mixta conservar suma conocida parcial y razón; sin ningún consumo de costo conocido, `knownCost=null`. La cobertura adicional se pasa tipada al lector Stock sin dependencia Stock→Recetas. Lectura bajo snapshot consistente como 0230. No abrir HTTP de dinero/agregados ni implementar 1.3 en R1.

### 5. Contrato nuevo y retiro del legado

El HTTP completo está en SPEC0232: biblioteca bajo `/api/modules/recipes/library`, composición e historial bajo `/products/:productId/composition`, archivo explícito y preview de una venta, dictado/foto independientes bajo `/draft` y `/draft-photo` con nombre de receta. Ninguna ruta nueva identifica receta mediante un producto; el namespace literal evita que la antigua URL UUID siga aceptándose con otra semántica. Guardar receta y composición ya no exige local; cantidades compartidas, inventario/costo locales.

Archivar bloquea si una composición vigente la usa y devuelve productos para resolverlo; historia/ventas no bloquean. Se serializa con nuevas asociaciones para evitar receta archivada en un uso nuevo. Nombre único activo se valida también mediante índice parcial. No DELETE físico ni reactivación en este alcance.

Dictado/foto conservan IA registrada, normalización por rendimiento y confirmación antes de guardar, con contexto de receta y sin depender de un producto. No arman un combo ni guardan receta/insumos/stock durante análisis. Retirar handlers antiguos por producto y sus variantes, incluida lista raíz anterior, sin aliases/redirects. Mantener `/locations` independiente no mantiene una receta por producto.

ADR0070§17 exige retirar UI vieja acoplada y referencias, registro de pantalla/navegación incluidos. Es parte de la implementación futura, sin UI nueva ni recableado provisional; el contrato documentado es el insumo de R1-UI. No tocar el core para esconder un módulo o mantener enlaces muertos. La entrega actual solo agrega documentos.

### 6. Migración conservadora y corte verificable

Migración necesaria, **no generada/ejecutada aquí**. Medir primero duplicados reales de catálogo y de productos con receta, revisiones/punteros, eventos pendientes y equivalencia de ingredientes/cantidades. No inferir cero duplicados desde lectura del esquema: `core.product` no exige nombre único. Conservar stock/locales, flags y EXPAND 0227, revisiones/eventos/movimientos/costos anteriores.

Cada producto con líneas actuales obtiene receta propia con las mismas líneas, composición×1 e `isCombo=false`. No crear recetas para productos sin configuración; revisión vacía legada sigue significando ausencia para eventos capturados. No reconstruir preparaciones de productos borrados desde historia. Nuevas identidades no dependen de FK a producto.

Resolver nombres sin detener por colisiones: reservar todos los nombres originales y activos previamente migrados por comercio; ordenar productos por UUID, conservar original del menor UUID de cada grupo y desambiguar los restantes con categoría o `(2)`. Añadir/incrementar sufijo numérico si choca con originales reservados o candidatos ya asignados; sin categoría incrementar el mismo sufijo; truncar base a 120 conservando categoría/sufijo. Manifiesto inicial inmutable de IDs/nombres/categoría/origen/razón antes de aplicar permite reejecución idéntica, sin reasignar IDs ni sobrescribir nombres posteriormente corregidos por el comercio, **sin modificar Catálogo**. Entregar renombrados por `GET /api/modules/recipes/migration-renames` bajo permiso `recipes`, aislado por comercio, con nombre inicial y actual distinguidos; no solo log del operador. Validar origen bajo corte si cambió desde preflight para filas aún no aplicadas, preservando el mapping aplicado. SPEC0232 fija el algoritmo/aceptación, incluyendo categorías iguales y nombres ya sufijados.

Mantener decoder dual: slot `recipe`→`recipes.revision` antiguo; slot `composition`→resolución nueva. Cortar writers antiguos de guardado y aplicador, instalar lector/consumidor compatible y cambiar punteros por comercio atómicamente, sin ambos slots ni ventana ausente. No puede convivir indefinidamente un consumidor antiguo que ignore `composition`.

0082 instaló `recipes_bridge_revision` AFTER cambios en `recipes.line`, creando snapshots y punteros del slot antiguo. Retirarlo durante el corte **antes de transformar/eliminar líneas legadas**, una vez retirados writers antiguos. No lanzar un borrado masivo con el trigger activo ni retirar por inferencia los puentes Stock de EXPAND 0227. Conservar trigger de inmutabilidad/revisiones históricas necesarias para eventos anteriores.

Revisiones y consumos ya aplicados permanecen intactos; pendientes antiguos se resuelven con su revisión legada y writer monetario 0230. No backfill de dinero/procedencia desde estado actual, no replay de ventas y no reset de promedio. Rollback tras primer evento nuevo exige lector dual; no eliminar resoluciones/procedencias ni volver a consumidor solo legado. Pruebas de equivalencia y corte antes de habilitar; cada operación PROD necesita autorización específica del owner.

## Alternativas y consecuencias

- **Expandir al cerrar consultando Recetas:** introduciría conocimiento del módulo/handlers en el core y trabajo/fallos adicionales al cobrar; innecesario porque el puntero existente captura una resolución íntegra.
- **Composición fija con revisiones de ingredientes al editarla:** deja ingredientes viejos al editar una sopa hasta que se vuelva a guardar cada combo; incumple siguiente venta con receta vigente.
- **Resolver receta por fecha después del cierre:** vulnerable a visibilidad/commit concurrente y empates; IDs capturados y publicación atómica dan una prueba más fuerte.
- **Un puntero por receta propagado al producto:** vuelve variable el conjunto de slots y obliga a probar pertenencia/composición desde múltiples referencias. Un solo puntero a resolución mantiene el cierre/contrato genérico actuales y encapsula la combinación.
- **Receta en clave Stock:** posible, pero amplía writer/lectores/unicidad histórica 0230; consolidar más procedencia separada preserva el ledger y ofrece la atribución exigida.
- **Solo aporte exacto sin cantidad repartida:** permite describir ingredientes, pero no garantiza que la atribución sume al movimiento tras redondeo. Guardar Q6 y Q3 más regla determinista conserva ambas propiedades.
- **Renombrado manual bloqueante:** el owner pidió continuar y entregar lista; algoritmo determinista/manifiesto evita frenar y evita fusiones/sufijos aleatorios.

La resolución agrega almacenamiento y fanout en escrituras, más un lock de writers por comercio. Es deliberado para mantener el cierre genérico y consistente; no es un lock de órdenes abiertas. La procedencia agrega filas auditables por receta/insumo aun cuando el movimiento sea único. Historia retenida y lector dual son necesarios mientras haya referencias; no se fija un TTL de borrado.

## Estado y límites

Diseño cerrado y decisiones de producto respondidas; estado aceptado del ADR **no significa implementación ni migración aprobadas**. Alcance documental: SPEC0232 y este ADR, sin código/SQL/INDEX/TASKS/estados. Base de evidencia arriba; checks documentales/SHA en entrega. Duplicados reales y tiempos de fanout sin medir, sin consulta PROD.

Pruebas futuras: equivalencia migración×1, combo con insumo compartido, decimales/reparto/cero, carrera edición↔composición↔captura, retry/atomicidad, recipe sin producto, archivo/nombres y aislamiento entre comercios/locales; ver aceptación completa en SPEC0232. R1-UI, 1.3, Smart Menu, P1/P2/P3 y etapa 6 mantienen sus encargos propios; no agregar aquí agregados, precios/packaging ni conversión monetaria. La convivencia con v2 de P1 se verifica cuando se implemente esa pieza, preservando slots/versiones R1.
