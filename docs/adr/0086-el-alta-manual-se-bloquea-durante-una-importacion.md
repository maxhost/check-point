---
adr: 0086
fecha: 2026-09-23
estado: aceptada
resumen: Mientras hay una importacion de catalogo abierta, crear categorias y productos a mano devuelve 409. Decision del owner el 2026-09-23: en vez de resolver la carrera entre el writer y el alta manual, se la vuelve imposible. El bloqueo es del SERVIDOR —la pantalla solo lo refleja— y es momentaneo: dura lo que dura el analisis. Cierra la carrera del 23505 de categoria y la del producto duplicado de una sola vez.
---

# 0086 — El alta manual de catalogo se bloquea durante una importacion

## Contexto

El writer de la importacion (ADR 0084, spec 0091 §6) relee el catalogo **dentro** de su
transaccion y planifica que crear. Entre esa lectura y el `INSERT` hay una ventana, y otra sesion
puede escribir ahi. Quedaron dos carreras vivas:

1. **La categoria.** Otra sesion crea «Postres» en esa ventana → el writer recibe un 23505 de
   `core_product_category_name_unique`. El codigo lo **recupera** releyendo por `lower(name)` y
   reusando. El mecanismo esta ejecutado contra Postgres con su control positivo, pero el
   *interleaving* real no tenia oraculo (hueco declarado en la 0091).
2. **El producto.** Un alta manual concurrente puede dejar un producto duplicado. La spec 0091 la
   declaro **afuera a proposito**: evitarla costaba serializar las escrituras del negocio.

Al revisar como cerrar la primera, el owner propuso (2026-09-23): *«si esta una importacion en
curso, simplemente bloquear momentaneamente la opcion de crear manualmente un producto»*.

**Su propuesta apuntaba a productos y la carrera del 23505 es de CATEGORIAS** —crear un producto
a mano no crea ninguna categoria (`catalog/products.ts:createProduct` no inserta en
`productCategories`; el unico camino manual es `catalog/categories.ts:createCategory`)—. Pero la
idea de fondo **resuelve las dos** si se aplica a las dos altas, y eso es lo que se decide aca.

## Decision

**Mientras el negocio tiene una importacion ABIERTA, crear una categoria o un producto a mano
devuelve 409.** Editar, renombrar y borrar **siguen permitidos**: no compiten con el writer, que
es estrictamente aditivo y nunca toca lo que ya existe.

- «Abierta» son los estados no terminales que ya define `CATALOG_IMPORT_OPEN_STATUSES`. Un
  import `accepted`, `failed`, `cancelled` o `expired` **no bloquea nada**.
- **El bloqueo es del servidor.** La pantalla lo refleja deshabilitando el boton y explicando por
  que, pero no es ella la que protege: un guard que vive solo en la UI no es un guard.
- Es **momentaneo por construccion**: dura lo que dura el analisis, que ya esta acotado por el
  lease, el vencimiento del import y el boton de cancelar.

## Consecuencias

- **La carrera del 23505 pasa de «recuperada» a «imposible» por el camino normal.** La
  recuperacion (`on conflict do nothing` + relectura) **se queda igual**: sigue siendo la red que
  cubre lo que el guard no ve, y su oraculo tampoco se toca.
- **La carrera del producto duplicado, que la 0091 habia declarado afuera, se cierra sin
  serializar nada** — que era exactamente el costo que habia hecho descartarla.
- **Un merchant que quiere cargar un producto a mano mientras importa, no puede.** Aceptado por
  el owner: dura minutos, el caso es raro, y la alternativa era un duplicado silencioso.
- **No cierra la ventana del todo, y se declara:** el guard mira si hay un import abierto en el
  mismo instante en que se procesa el alta. Dos requests exactamente simultaneas siguen pudiendo
  cruzarse. Serializar de verdad exigiria un lock por negocio, que sigue descartado (§ADR 0084).
  Por eso la recuperacion del 23505 **no se borra**.
- **El dominio catalogo NO tiene lista cerrada de `code`** (a diferencia de catalog-import):
  `CatalogError` lleva `status` y `message`, y la ruta serializa `{ error }`. Para que la
  pantalla pueda distinguir este 409 sin leer el texto, `CatalogError` gana un `code`
  **opcional** que la ruta emite cuando existe. Es aditivo: todo lo que hoy no lo pasa sigue
  respondiendo igual.
- **La pantalla se entera por el GET que ya hace:** `GET /api/catalog` suma un booleano
  `importInProgress`, y con eso deshabilita el alta y explica por que. Evita una segunda llamada
  y evita que la pantalla adivine.

## Alternativas descartadas

- **Solo bloquear productos** (la letra de la propuesta): no toca la carrera de categorias, que
  es la que tenia el hueco.
- **Serializar las escrituras de catalogo del negocio con un lock advisory:** cierra la clase
  entera, pero es el costo que el ADR 0084 ya evaluo y descarto, y no cambio nada desde entonces.
- **Dejar todo como estaba y pinnear el interleaving con un test:** era la opcion tecnica (la
  sonda del revisor funciona). El owner prefirio que la carrera no exista a tener el test de una
  carrera que si.

## Referencias

- ADR 0084 — la importacion escribe directo y es aditiva; descarta serializar.
- Spec 0091 §6 — el writer, su relectura en transaccion y la recuperacion del 23505.
