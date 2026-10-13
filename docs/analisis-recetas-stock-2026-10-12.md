# Analisis de producto (2026-10-12) — modulos por rubro, recetas, costo y stock de insumos

Conversacion con el owner (2026-10-12), antes de pensar implementacion. Origen: escucho a sus tres comercios
gastronomicos (panaderia/cafe, cafe, almuerzos). Los tres tienen el mismo problema: controlar stock para saber cuando
pedir y producir, prever demanda y saber cuanto van a vender. CheckPass no es software de gastronomia (tiene que
servir a mecanica, odontologia, peluqueria…), pero el owner quiere darles mucho valor a estos tres antes de pasar a
otro rubro.

**Como leer este doc:** «Decisiones del owner» son palabras suyas, no se le vuelven a preguntar. «Propuestas de
Claude» NO estan decididas: son hallazgos a decidir, y se confirman antes de escribir una spec.

## Decisiones del owner (no volver a preguntar)

1. **Nucleo + modulos.** El nucleo es catalogo, programa de fidelizacion, marketing y analitica: lo tiene todo
   comercio. El resto se activa o desactiva segun el rubro (un dentista no necesita POS, necesita turnos; una
   pizzeria si necesita POS). Objetivo: no sobrecargar al comercio con lo que no le sirve.
2. **Se empieza por el costo del plato y el margen real (capa A).** Es lo que se puede usar desde el primer dia,
   acostumbra al comercio y va alineado con el stock (capa B).
3. **El stock teorico no tiene que ser exacto, tiene que acercarse.** El aviso es aproximado: «Revisa tu stock,
   deberias tener aproximadamente X g y al ritmo de esta semana te quedaras sin ella en dos o tres dias». Despues se
   buscan formas de ajustarlo para que acierte la mayoria de las veces.
4. **La condicion es que el comercio use el POS y cargue compras y recetas: la IA tiene que hacer eso muy facil.**
   Referencia: el comerciante saco una foto de su menu, vio crearse categorias, productos y precios, y quedo
   asombrado.
5. **Carga de compras con IA, sin depender del ticket.** No todos tienen ticket del proveedor: a veces es un papel
   con el precio anotado. Se carga desde foto (ticket o papel) y **por audio** (owner: «audio, audio»).
6. **Recetas como plantilla.** La IA no tiene que acertar todo: tiene que darle la lista de ingredientes para que el
   comercio no escriba «harina 100 g, queso 150 g, polvo de hornear 10 g» y solo complete las cantidades. Sirve sobre
   todo con muchos productos en el catalogo o con productos de muchos ingredientes. **El audio tambien sirve para
   armar recetas.** Buscar como lo resuelven otras apps (las de nutricion que dan los nutrientes con una foto).
7. **Probar modelos de IA baratos, chinos incluidos.** Dato del owner: 5 pedidos de importacion de menu le costaron
   unos US$ 0,01. Medido en el codigo: la importacion usa `gpt-5-mini` por defecto
   (`apps/merchant/src/server/catalog-import/providers/provider.ts:34`), se cambia con `CATALOG_EXTRACTION_MODEL`, y ya
   hay una capa de proveedores (ADR 0082).
8. **Una receta por producto del catalogo, sin sub-recetas.** Las sub-recetas sirven a la pizzeria (la masa) pero no a
   la panaderia ni al restaurante: complican el concepto.
9. **Un solo stock: el de materia prima.** No se carga stock de producto hecho (pan). El producto hecho se deduce de
   la materia prima, las ventas y el historial: si se cargaron 1000 g de harina y se venden 100 pizzas por semana, la
   proxima carga de 1000 g implica unas 100 pizzas/masas en stock.
10. **Parqueado** (ver `docs/PARQUEADO.md` #96-#98): prevision de demanda; stock + marketing; el mecanismo para
    anticipar el hueco entre stock teorico y real.

## Las tres capas (marco de la conversacion)

| Capa | Que necesita | Cuando da valor | Estado |
|---|---|---|---|
| **A. Costo por producto y margen** | recetas + precio de compra de insumos | desde el dia 1, sin historial | **se empieza por aca** |
| **B. Stock teorico** (cada venta descuenta insumos) | A + que las ventas pasen por el POS | desde que vende | horizonte |
| **C. Prevision y lista de compras** | B + semanas de historial + proveedores | despues de semanas | **parqueada** |

El aviso de precio va en A: «la muzzarella subio 18 % en esta compra; el margen de la napolitana bajo de 62 % a 51 %;
para mantenerlo, subila a $X o baja la porcion». Achicar la porcion se muestra como opcion, no como receta: tiene un
costo de calidad que decide el dueño.

## Propuestas de Claude (hallazgos a decidir, NO decididos)

- **El rubro sugiere los modulos, no los bloquea.** Una panaderia toma encargos con fecha (es un turno); un dentista
  vende productos (es catalogo con cobro). El rubro define el combo inicial; el comercio prende o apaga cualquier
  modulo. Ya hay rubro en el modelo: ADR 0021 (analiticas por rubro), ADR 0102 (dias por rubro), reservas en ADR 0131.
- **Los ingredientes son una lista compartida del comercio**, no texto por receta: «queso muzzarella» es el mismo
  insumo en 15 recetas, y una compra actualiza el costo de todas. Cubre buena parte de lo que resolvian las
  sub-recetas. Lo que se pierde: cambiar la cantidad de harina obliga a editar cada pizza; si molesta, «aplicar a
  todas las recetas que usan harina», sin cambiar el modelo.
- **Equivalencias aprendidas en la carga de compras.** La primera vez la IA propone «HARINA 000 BLANCAFLOR 25KG →
  Harina, 25.000 g» y el dueño confirma; se guarda, y la proxima compra del mismo proveedor se carga sola. Resuelve
  la conversion de unidades (compra en bolsas, la receta usa gramos). **Las compras son lo que mantiene viva la capa
  A:** sin ellas el costo queda congelado y con inflacion miente en meses. Costo recurrente (uno por compra), pero de
  centavos.
- **Recetas en lote despues de importar el menu:** un pedido a la IA con todo el catalogo; cada producto queda con
  sus ingredientes y la cantidad sugerida en gris (se acepta o se cambia). La foto o el nombre identifican el producto
  y sus ingredientes; los gramos no se adivinan de una foto, y en la capa A los gramos son el margen. Pedir validar
  primero los ~10 productos mas vendidos y mostrar cuanto de la facturacion tiene costo confirmado.
- **Elegir el modelo por aciertos, no por precio:** 15-20 fotos reales de los tres comercios (tickets, papeles, letra
  dificil) contra 3-4 modelos (p. ej. Qwen con vision, Gemini Flash-Lite, el actual). A estos costos, lo que decide es
  si lee un papel escrito a mano. Mandar datos a un proveedor chino es otra jurisdiccion: riesgo bajo para compras de
  insumos, pero se decide a conciencia.
- **«Te alcanza para»:** con receta y stock de insumos, «te alcanza para ~40 pizzas; te frena la muzzarella» (el
  ingrediente que se acaba primero). Es la forma concreta de la decision 9.
- **Descontar insumos al vender, no al producir.** Coincide con la decision 9 (no se registra la produccion). La merma
  de lo producido y no vendido aparece como hueco y la absorben las correcciones.
- **Cada correccion de stock se guarda como registro con fecha, no pisando el numero.** Es lo unico de la capa B que
  hay que decidir ya: sin ese historial, el mecanismo de anticipacion parqueado (#98) no tiene de donde aprender.

## Preguntas abiertas para el owner

1. ¿Los tres registran todas las ventas en el POS, o parte se escapa (efectivo, apps de delivery)? Para A no importa;
   para B es la condicion.
2. ¿Como controlan el stock hoy (cuaderno, Excel, memoria)? Un Excel con precios podria ser la carga inicial de A.
3. ¿Guardan tickets, facturas o papeles de compra? Decide cuanto se sostiene sola la capa A.
4. ¿Proveedores fijos con dias fijos de entrega? Solo importa para C (parqueada).
5. ¿Existe cierre/arqueo de caja en el POS? No verificado en el codigo; importa para el mecanismo #98.

## Propuesta de division en incrementos (Claude, A DISCUTIR con el owner)

Cada incremento entrega algo usable y se apoya en el anterior. Todos tocan base de datos (migraciones a PROD), asi
que ninguno baja de L2 (CLAUDE.md §Niveles).

| # | Incremento | Que ve el comercio |
|---|---|---|
| 0 | Prueba de modelos (spike, sin producto) | nada; sale el modelo elegido para compras y recetas |
| 1 | Modulos activables por comercio, con combo por defecto segun rubro | «Recetas y stock» aparece solo donde corresponde |
| 2 | Insumos (lista compartida) + receta manual por producto | costo y margen de cada producto |
| 3 | Cargar compra a mano (insumo, cantidad, precio) con historial | el costo se actualiza con cada compra |
| 4 | Compra con IA: foto de ticket/papel o texto → borrador revisable | cargar una compra en segundos |
| 5 | Recetas con IA en lote: ingredientes + cantidad sugerida | armar las recetas del catalogo sin escribirlas |
| 6 | Audio como entrada (compras y recetas) | hablar en vez de escribir |
| 7 | Aviso de margen cuando sube un insumo | «subio la muzzarella; tu margen bajo» |
| 8 | Stock teorico: cada venta del POS descuenta insumos; «te alcanza para» | stock estimado sin cargarlo |
| 9 | Corregir stock (registro con fecha) + aviso aproximado «revisa tu stock» | el aviso de la decision 3 |

Abierto en esta division: si el 1 va primero o puede esperar (hoy los tres comercios son gastronomia), y si el 4-6
(la IA) va antes que el 3 por el efecto «asombro» del menu.

## Decision del owner: un modulo es un plugin, no un switch (2026-10-12)

> «no es solo un switch. el modulo debe vivir realmente desacoplado del core, para poder instalarlo o desinstalarlo
> como un plugin de wordpress… esto me permite trabajar en modulos nuevos o viejos sin afectar la estabilidad del core.»

**Estado medido del POS (2026-10-12):** es un switch, no un plugin. El encendido es una columna del core
(`core.business.pos_enabled`, `packages/db/src/schema/business.ts:102`) y el core nombra al POS en varios lugares:
permisos de staff (`apps/merchant/src/server/staff-permissions.ts`, `assertPosGrantable`), la sesion
(`api/merchant/session/route.ts`), la navegacion (`backoffice-navigation.tsx`), ajustes y locales. Lo que si esta
separado: su servidor (`apps/merchant/src/server/pos/`) y su esquema (`packages/db/src/schema/pos.ts`). Las ventas con
items viven en el core (`core.order` / `core.order_item`, mostrador y POS).

**Propuestas de Claude (a decidir; esto termina en un ADR):**
- Regla unica: **el modulo depende del core; el core nunca depende de un modulo.** Chequeable con un comando (lint de
  fronteras de imports) → hook/gate.
- El core expone **puntos de enganche** y el modulo se registra en ellos: entrada de navegacion, permisos propios,
  panel de ajustes, y **eventos del core** (venta registrada, producto creado/borrado). Ejemplo: recetas escucha «venta
  registrada» del core (`core.order_item`), no al POS, y asi no depende de que el comercio tenga POS.
- Cada modulo con su paquete y su esquema de base propios (`pos.*`, `recetas.*`); claves foraneas solo modulo → core.
- Activacion generica por comercio (una tabla de modulos activos), no una columna por modulo en `core.business`.
- No es instalar codigo en caliente como WordPress (hay un solo deploy): es desacople de arquitectura. Limite honesto:
  un error de compilacion en un modulo sigue rompiendo el build de la app; lo que se gana es que un modulo apagado o
  roto en ejecucion no toca el core, y que cambiar un modulo no obliga a tocar el core.
- Orden sugerido: inventariar los enganches reales del POS para diseñar el contrato, que **recetas nazca ya como
  modulo**, y migrar el POS despues (esta en vivo con comercios reales).

**Preguntas abiertas:** que pasa con los datos al desinstalar (se ocultan o se borran); si un modulo puede depender de
otro (mesas → POS); si los modulos se cobran aparte o van atados al plan (ADR 0134).

### Respuestas del owner (2026-10-12, no volver a preguntar)

1. **Al desinstalar un modulo los datos quedan; nada se borra.**
2. **Un modulo puede depender de otro.** Mesas depende de POS (sin POS no sirve); recetas depende de catalogo (core);
   stock depende de recetas («sin recetas no hay stock, o eso creo, a no ser que tengamos otra forma»).
3. **Los modulos van atados al plan** (no se cambia ese concepto, ADR 0134). Lo que si puede haber es un **limite de
   uso de IA**, porque tiene costo adicional. Meta: de los $20 del plan base, despues de infraestructura (Neon,
   Vercel, IA, dominio), **quedan limpios al menos $15 por comercio**. El owner no lo calculo todavia.

**Hallazgos de Claude sobre estas respuestas (a decidir):**
- Datos que quedan + modulo apagado = el modulo no escucha eventos mientras esta apagado. Al reactivar stock, el
  stock teorico esta viejo: la reactivacion tiene que pedir recalibrar (o recalcular desde las ventas del core).
- **Stock sin recetas existe: la reventa.** Lo que se compra hecho y se vende igual (gaseosas, alfajores comprados;
  repuestos en una mecanica, shampoo en una peluqueria) consume 1 unidad del insumo por venta, sin receta. Si stock
  es el modulo base (insumos + consumo por venta) y recetas lo enriquece (consumo compuesto), stock sirve a otros
  rubros y la dependencia se invierte: recetas depende de stock. No contradice «un solo stock de materia prima»: lo
  revendido no es producto hecho por el comercio.
- La meta de $15 depende mas de cuantos comercios reparten los costos fijos (Vercel, Neon, dominio, Apple) y de la
  comision de Stripe sobre los $20 que de la IA, que es variable y chica por operacion. Hay que medirla con las
  facturas reales. Ya existe un cupo de IA para la importacion de catalogo (ADR 0083): el limite de IA puede
  generalizar ese mecanismo.
