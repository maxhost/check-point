# Mejoras y pendientes de revisión

Registro del owner durante el QA. Anotar aquí incidencias e ideas; su registro no autoriza implementarlas ni las convierte automáticamente en bloqueantes de publicación.

## POS: elegir gramos al vender un producto con tarifa por kg

- **Fecha:** 2026-10-19. Diferido por el owner; no implementar ahora.
- **Observado:** para Pan Frances, con tarifa de 10/kg, el selector de unidad de cantidad sólo ofrece kg. El owner no puede introducir una venta de 750 g seleccionando gramos. Falta revisar si las unidades habilitadas del negocio explican la limitación.
- **Mejora solicitada:** permitir elegir g al introducir la cantidad de un producto tarifado por kg, convertir automáticamente y conservar el importe correcto: 750 g a 10/kg = 7,50. La unidad de entrada debe poder elegirse por comodidad sin cambiar la tarifa del catálogo.

## POS: conservar filtros al volver de una orden

- **Fecha:** 2026-10-19. Diferido por el owner; no implementar ahora.
- **Observado:** al filtrar órdenes cerradas de hoy, entrar a una orden y volver, se pierde el filtro.
- **Mejora solicitada:** regresar al listado con los filtros que estaban seleccionados.

## QA manual 0242: resultados y pendientes

- **Confirmado por el owner (2026-10-19):** crear/editar productos por peso tras actualizar la DB local; venta de 2 unidades normales; venta por kg a tarifa 10/kg; entrada con coma y punto; bloqueo de cantidades negativas/cero/vacías; orden con productos mezclados, cambio de cantidades y eliminación de líneas; cobro habitual; coincidencia de totales/cantidades/precios/unidades; recarga con venta cerrada sin duplicados; anulación de orden aún no cobrada.
- **Límite de anulación observado:** el owner sólo puede anular órdenes aún no cobradas. No se ha certificado reversión de una venta cobrada.
- **Pendiente:** asociar cliente y aplicar descuento; el owner no puede probarlo todavía. Registrar el motivo cuando se revise, sin asumir que existe un fallo.
- **Pendiente para mañana:** impresión física. No declararla validada.
- **Confirmado por el owner:** venta con empleado autorizado funciona correctamente, probada desde el acceso local del equipo.
- **No validado:** entrada de 750 g desde el selector; limitación registrada arriba. Puntos, stock y comisiones no fueron confirmados en este recorrido.

## Catálogo y recetas: aclarar la base de elaboración

- **Fecha:** 2026-10-19. Pendiente de revisión; no implementar ahora.
- **Observado:** el owner creó un producto por peso en Catálogo y después una receta asociada. Recetas mostró «La base y el modo de venta no son compatibles» e indicó que el costo y la ganancia no están disponibles. No se ha determinado la causa ni confirmado un defecto: revisar la base configurada y el comportamiento esperado.
- **Mejora solicitada:** al seleccionar el producto de Catálogo en Recetas, mostrar su modo de venta y su unidad de precio, y explicar claramente para qué cantidad de producto terminado se está preparando la receta. Ejemplo del owner: producto con tarifa de 10 por kg; hacer visible la referencia de 1 kg para evitar confusión al introducir ingredientes.
- **Caso que debe contemplarse:** una receta puede elaborarse para 1 kg y el producto venderse con una tarifa por 100 g. Diferenciar explícitamente la cantidad de elaboración de la referencia del precio y mostrar su equivalencia; no asumir que deben coincidir. La representación de tarifas por 100 g también queda por revisar, sin dar por hecho que esté soportada actualmente.
- **Resultado deseado:** que el usuario entienda la base y la relación con la venta antes de guardar, y que un aviso de incompatibilidad explique qué dato debe ajustar.
