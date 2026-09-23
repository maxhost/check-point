---
adr: 0084
fecha: 2026-09-23
estado: aceptada
resumen: La importacion de menu escribe el catalogo directamente y es SIEMPRE aditiva — crea lo que falta, no toca nada existente, no borra y no actualiza. Desaparecen el borrador, la revision, el `accept` y el estado `ready` (supersede el invariante «la IA nunca escribe» del ADR 0082 §1). Un precio que no se puede leer crea el producto SIN precio; un item que no se puede leer se DESCARTA y se lista para cargarlo a mano. Un analisis termina en catalogo o en `failed`: no hay estado intermedio que revisar ni reintento de submit.
---

# 0084 — La importacion de catalogo escribe directo y solo agrega

## Contexto

El ADR 0082 eligio un invariante fundacional: **«la IA nunca escribe el catalogo»**. Todo lo demas
—el borrador versionado, las resoluciones por categoria, el `PUT /draft`, el `POST /accept`, el
estado `ready`, el conflicto de version— es **consecuencia** de ese invariante, no una feature
propia.

La implementacion y la prueba con un PDF real mostraron el costo: un menu de siete paginas produce
decenas de categorias y ~90 productos, y la pantalla le pide al merchant revisarlos campo por campo
en un modal, en el telefono. **El producto prometia ahorrarle la carga a mano y le devuelve la misma
carga con otra forma.**

Decision del owner (2026-09-23), textual: *«Cargar una foto o fotos o un pdf, extraer, crear, listo,
que revise a mano luego del catalogo final, que tenga un filtro para saber cuales son los que debe
revisar. No es tan complicado.»*

Este ADR **cambia el invariante**. Al cambiarlo, la maquinaria que existia para sostenerlo se borra:
esta decision **quita** codigo, no lo agrega.

## Decision

### 1. La importacion escribe el catalogo, y es SIEMPRE aditiva

Una importacion:

- crea las categorias que no existen y **reusa** las que existen;
- crea los productos que no existen dentro de su categoria;
- **omite** los que ya existen ahi;
- **nunca** actualiza nombre, precio, costo, imagen, disponibilidad ni categoria de algo existente;
- **nunca** borra nada.

Un precio distinto en el documento **no** es un pedido de actualizacion: el producto ya existe, se
omite y listo. Por eso importar dos veces el mismo PDF es seguro por construccion.

### 2. La primera importacion y la quinta son la MISMA operacion

No hay «carga inicial» y «carga incremental». Siempre es la misma: extraer todo, conciliar contra el
catalogo actual, crear lo que falta. Con el catalogo vacio, «lo que falta» es todo.

Esto elimina de raiz el modo `missing_only`, el contexto de catalogo en el prompt, su limite de
bytes, el truncado silencioso y la diferencia de versiones de prompt que traia. **El LLM no necesita
saber que ya tenes**: lo sabe el servidor, que es quien escribe.

### 3. La conciliacion es del SERVIDOR, determinista, y nunca elige entre dos cosas destructivas

Dentro de la transaccion que escribe, el servidor relee el catalogo actual y concilia:

- **Categoria** por clave canonica. Existe → se reusa. No existe → se crea. **Empatan dos
  existentes** → se reusa **la mas vieja** (`created_at` ascendente). Reusar nunca destruye nada,
  asi que no hace falta preguntarle a nadie.
- **Producto** por `(categoria conciliada, clave canonica)`. Existe → se omite. No existe → se crea.
  Dos «Agua» en categorias distintas son dos productos legitimos.

La clave canonica es una funcion unica y testeada: NFKD, sin diacriticos, minusculas, puntuacion a
espacio, espacios colapsados. **No es fuzzy matching**: «Coca-Cola» = «coca cola»; «Hamburguesa» ≠
«Hamburguesa doble».

### 4. Lo que no se puede leer no se inventa: o queda sin precio, o queda afuera

Dos casos distintos, con dos respuestas distintas (decision del owner):

- **El producto se lee pero su precio no** → se crea **sin precio** (`unit_price = null`). Es
  inofensivo: el mostrador le pide el precio al operador cuando el producto no lo tiene
  (`counter/grant.ts:154-163`), y la pantalla ofrece un filtro «sin precio» para completarlos.
  Nunca un `0`, que es un precio falso con cara de valido.
- **El item no se puede leer** (nombre ilegible, fila rota, fuera de esquema) → **se descarta** y se
  lista en el resumen con el texto que se vio. El merchant lo carga a mano desde el listado.

El criterio del precio no lo decide el modelo: **el proveedor devuelve el texto impreso y el
servidor lo parsea**. Si el texto no parsea a un decimal sin ambiguedad, el producto nace sin precio.
Mover esa decision del modelo al servidor la vuelve **testeable**, que es la unica forma de mejorarla.

### 5. No hay borrador, ni revision, ni aceptacion, ni reintento de submit

Los estados son: `pending_upload → queued → analyzing → accepted | failed | cancelled | expired`.

- **`ready` desaparece.** Ningun import queda esperando una decision humana, porque ninguna decision
  del servidor es destructiva.
- **`PUT /draft` y `POST /accept` se borran.** No hay dos pasos: hay uno.
- **Un fallo es un fallo**: `failed`, y el merchant vuelve a empezar desde subir el archivo. No se
  re-submitea un analisis al proveedor por nuestra cuenta.

Lo unico que se conserva del mecanismo diferido es **pollear al proveedor un resultado ya pagado**
cuando el webhook se pierde. Eso no es un reintento: es ir a buscar algo que ya se compro.

### 6. El resultado se cuenta en pantalla, y la pantalla la hace el owner

La importacion deja un resumen persistido en su fila y el `GET` lo devuelve: categorias creadas y
reusadas, productos creados y omitidos, productos sin precio, y la lista de descartados. El servidor
entrega el dato; **el diseño, el copy y los filtros son del owner** (ADR 0070).

Para que un reload no pierda el resultado, `GET /api/catalog/imports` pasa a devolver **el ultimo
import del negocio**, no solo el que esta abierto.

### 7. Sin tabla de trazabilidad y sin lock de catalogo

- **No nace `catalog_import_product`.** «Lo recien importado» ya se puede ver con
  `product.created_at`; una tabla sin consumidor es andamiaje (CLAUDE.md).
- **No nace un lock por negocio ni un unique nuevo en `product`.** La unica carrera real es que el
  merchant cree a mano el mismo producto en el segundo exacto en que corre la importacion, y su
  consecuencia es **un producto duplicado que se borra en dos toques**. Serializar todas las
  escrituras de catalogo del negocio para eso es un precio peor que el problema. La carrera de
  **categoria** si tiene unique en la base y se resuelve **reusando** ante el 23505, nunca fallando.

## Consecuencias

- El camino feliz de un menu de 100 productos es: subir → esperar → «se crearon 86 productos en 14
  categorias; 3 quedaron sin precio; 4 no se pudieron leer». Cero campos revisados.
- **Se borra codigo**: el borrador y su validacion, las resoluciones por categoria, el
  `duplicateCandidate`, el `include`, el `draft_version`, el conflicto de version, dos rutas, el
  estado `ready` y la pantalla de revision.
- **El riesgo que se acepta:** un precio mal leido con confianza alta entra al catalogo y lo cobra
  el mostrador. Se mitiga por dos lados —el parseo pasa al servidor y lo dudoso queda en `null`— y
  se corrige como se corrige cualquier precio mal tipeado: editando el producto. **El owner lo
  acepta explicitamente** a cambio de no convertirlo en revisor de OCR.
- El cupo, R2, el callback firmado, el proveedor intercambiable y los limites del ADR 0082/0083 no
  cambian.

## Lo que supersede

Supersede del ADR 0082: **§1** (la IA nunca escribe), **§5** (duplicados resueltos en el borrador),
**§6** y **§13** en todo lo que describe borrador, revision, aceptacion y `ready`. Mantiene §2-§4,
§7-§12 (proveedor agnostico, archivos efimeros, proceso diferido, cupo, privacidad, email) y la
enmienda de precios de §9 (`ambiguous` ⇒ `null`, nunca `0`).

Deja **sin efecto** el ADR 0084 en su version del 2026-09-22, que resolvia el mismo problema
agregando maquinaria (contexto de catalogo en el prompt, autoaceptacion opcional detras de un flag,
`ready` como escape hatch, trazabilidad y lock por negocio) encima de la que iba a borrarse.

## Referencias

- ADR 0070 — la UI la construye el owner por fuera; aca van API y endpoints.
- ADR 0082 / 0083 — importacion agnostica, proceso diferido y cupo.
- Spec 0090 — lo que hay implementado hoy.
- Spec 0091 — la implementacion de esta decision.
