# Nueva orden POS: tres etapas de toma de pedido

Investigación solicitada por owner, 2026-10-08. Propuesta, sin código ni spec nueva.
No se hicieron pruebas con meseros; ejemplos de otros POS son precedentes de diseño,
no estudios comparativos que prueben velocidad o errores en CheckPass.

## Evidencia

- [NN/g: Wizards](https://www.nngroup.com/articles/wizards/): separar pasos reduce
  información simultánea; advierte costo de interacción y repetición para usuarios
  expertos. Propone mostrar etapa, controles descriptivos y reusar datos anteriores.
- [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/):
  mostrar información pertinente a la tarea; separar etapas perjudica si exige
  alternar repetidamente entre información interdependiente. Se requiere análisis
  de tareas para decidir qué se oculta y qué sigue accesible.
- [Toast: Manage Orders With Toast POS](https://support.toasttab.com/en/article/New-POS-Experience-Ordering-Screens):
  menús/grupos/productos y búsqueda durante selección; modificar cantidades y borrar
  artículos desde pedido. Handheld concentra información y desplaza acciones secundarias
  a overflow. Evidencia de que borrar y cambiar cantidad son operaciones distintas;
  no prueba que debamos copiar sus controles o exposición de cobro.
- [NN/g: State of Ecommerce Search](https://www.nngroup.com/articles/state-ecommerce-search/):
  en mobile puede usarse lupa en lugar de campo permanente. Contexto ecommerce;
  transferencia a POS es inferencia, no evidencia específica de restaurantes.
- [Apple: Undo and Redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo):
  recuperación explícita de acciones y resultado comprensible. Aplicación propuesta:
  quitar línea completa del borrador con Deshacer, sin confirmación por cada toque.

## Propuesta para contrastar

Tres pantallas: Mesa, Tomar pedido, Revisar pedido. Guardar pedido es la acción final,
no cuarta pantalla. Paso Mesa admite local si hay varios, reutilizando último válido.
Una vez identificado, contexto pequeño Mesa/Local acompaña toma/revisión; no repetir
formulario completo. Navegación anterior conserva borrador/filtro/posición, sin escrituras.

Tomar pedido: categorías y productos más vendidos según API, cantidades visibles por
producto. CTA Revisar pedido. Sin precios/total global ni campo de búsqueda desplegado.
No hay evidencia encontrada que avale prohibir búsqueda aquí: Toast la ofrece y el
mesero suele buscar un producto concreto. Recomiendo lupa opcional; si owner prefiere
suprimirla completamente, es una hipótesis a contrastar, no un óptimo demostrado.

Revisar: nombre, cantidad, menos/más y Quitar producto (línea completa). Sin precio,
subtotal o total habitual. Búsqueda explícita Buscar producto para añadir con resultados
del catálogo del local, no filtro de los renglones existentes; añadir regresa al pedido
sin una cuarta etapa. Acceso a categorías si es necesario. Deshacer debe recuperar línea
completa, posición, cantidad e identidad original, no solo sumar unidad de un producto.

Ocultar precios para concentrar tarea en precisión de productos/cantidades es una
inferencia por contexto del owner y progressive disclosure; no encontramos estudio que
mida mejora específica al ocultarlos. No es un requisito universal de POS restaurante.
El cobro/precuenta posteriores sí requieren su representación financiera.

## Restricción del contrato existente

[0169](../specs/0169-pos-ordenes-de-mesa.md), edición de líneas, exige unitPrice para
producto sin precio de catálogo. PosEditor invalida needsPrice sin importe positivo,
y linePayload incluye ese importe. Para productos con precio definido, ocultar UI
es viable sin cambiar servidor: precio/snapshot siguen en datos internos.
Para producto sin precio, hace falta captura excepcional o contrato distinto aprobado
con Claude. No asumir cero ni posponer ese importe silenciosamente al cobro.
Guardar y eliminar siguen operando el mismo borrador; un POST final, sin polling/TTL.

## Cómo obtener evidencia propia

Comparar flujo de tres etapas con versión actual en el teléfono real y menú real,
con meseros que conozcan y no conozcan categorías. Tareas propuestas: pedido habitual,
producto cuya categoría no conocen, retirar cinco unidades de una línea y añadir
un producto durante revisión. Medir tiempo total, toques, retrocesos y errores de
producto/cantidad. Contrastar búsqueda opcional versus solo en revisión.
No afirmar superioridad de tres etapas o ausencia de buscador hasta observar resultados.
No se ejecutan suites adicionales; esta evaluación de campo es propuesta futura.
