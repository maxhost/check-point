# La red: cifras re-verificadas, horas valle y el modelo del mostrador + cerebro

> **Estado: BORRADOR DE ESTRATEGIA, nada decidido salvo lo marcado «owner».** Continua
> `docs/red-y-atencion.md` (§1–6c) y `reports/Ideas laterales para la red local.md`. Escrito el 2026-09-29.
> Lo marcado *(orquestador)* es propuesta para discutir.

## 1. Re-verificacion de las cifras (busqueda web, 2026-09-29)

Leido = el orquestador abrio la pagina y la cita sale de ahi. Snippet = solo el resumen del buscador (la pagina
devolvio 403/429 o un control anti-bot). Secundaria = un tercero que cita la fuente original.

| Cifra del informe | Resultado | Fuente |
|---|---|---|
| **Groupon (Dholakia):** ~20 % volvio a precio completo | **CONFIRMADA, leida** («just 20% returned for a full-price purchase») | knowledge.wharton.upenn.edu/article/death-daily-deal |
| Groupon: 21,7 % no canjeo | **CONFIRMADA, leida** («21.7% of deal buyers never redeemed vouchers they paid for») | idem |
| Groupon: 324 negocios, 55,5 % gano, 26,6 % perdio | **CONFIRMADA, leida** (+ 17,9 % salio hecho; ago-2009 a mar-2011, 5 sitios, 23 mercados de EE.UU.) | idem + hospitalitynet.org/external/4053775.html (articulo de Dholakia) |
| Groupon: ~80 % de los compradores eran clientes nuevos | **NUEVA, leida** («close to 80% of deal users were new customers») | hospitalitynet (Dholakia) |
| Groupon: restaurantes peor que servicios | **NO re-verificada** (las dos paginas leidas no lo dicen; el paper SSRN no abrio) | — |
| **ClassPass:** 94 % de los usuarios son nuevos para el local | **CONFIRMADA, leida** (datos de Playlist, la empresa madre; el snippet de ClassPass dice: datos conjuntos ClassPass+Mindbody 2020 – ene-2025) | athletechnews.com/classpass-tops-3-billion-in-partner-revenue |
| ClassPass SmartRate: ~20 % mas de pago, >2× visitantes nuevos, ~14 % mas ocupacion | **CONFIRMADA, leida** (socios de EE.UU., 2024, contra no usuarios — sin grupo de control) | idem |
| ClassPass: el estudio fija un «piso de precio confidencial» | **NO re-verificada** (classpass.com devolvio 403) | — |
| ClassPass SmartSpot: saca lugares cuando una reserva «could displace a direct member» | **Snippet** de classpass.com | — |
| **Panera:** de ~4 a ~10 visitas/mes | **NO ENCONTRADA ASI.** Lo leido dice otra cosa: «200% uptick in frequency of visits, with participants visiting Panera cafes 15-plus days per month» (piloto de 3 meses) y +70 % de compra de comida | restaurantdive.com/news/paneras-new-coffee-subscription… (leida); foxbusiness.com (leida: «coming in eight times more every month», CEO Chaudhary — ambigua) |
| **Too Good To Go:** 58 % probo comercios nuevos, 76 % volvio como cliente a precio completo | **Snippet** del blog oficial de TGTG (la pagina bloquea con 429 / control anti-bot). Es una ENCUESTA de usuarios, no retorno medido | toogoodtogo.com/en-gb/blog/attract-regular-cafe-restaurant-customers |
| TGTG: 73 % «volveria» | leida, sin fuente de la encuesta | tipranks.com (case study) |
| **Nunes & Dreze 2006:** 34 % vs 19 % | Paper **confirmado** (abstract leido en OUP: JCR 32(4):504–512). Las cifras siguen en **secundaria**: 300 tarjetas, abril 2004, 9 meses de seguimiento, 34 % vs 19 % | academic.oup.com/jcr/article-abstract/32/4/504/1787425; siliconcanals.com (secundaria) |

**Correcciones al informe de ideas laterales:** Panera «4 → 10» se reemplaza por «+200 % de frecuencia; 15+ dias
por mes en el piloto» (cifras del CEO/empresa). Nunes 34/19 sigue [NV] en las cifras. El resto de lo priorizado
queda confirmado. Nota: el concepto 3 (donde vivia Nunes) quedo recortado por el owner — no se le pide al comercio
que costee sellos extra.

## 2. Horas valle

### 2.1 La leccion de Groupon, en simple

Groupon vendia cupones de 50 % o mas de descuento, a cualquiera, para cualquier dia y hora. Rice University
(Dholakia) encuesto a 324 negocios que lo usaron:

- **~8 de cada 10 compradores eran clientes nuevos.** Groupon SI traia gente.
- **Solo 2 de cada 10 volvieron a pagar precio completo.** La mayoria vino por la ganga y no volvio.
- **1 de cada 4 negocios (26,6 %) perdio plata** con la promo; poco mas de la mitad gano.

Por que salio mal, en tres errores que CheckPass puede evitar:

1. **Regalaba a quien iba a venir igual.** Groupon no sabia quien ya era cliente; el fiel compraba el cupon y
   el comercio le cobraba la mitad por lo mismo de siempre. *CheckPass sabe quien ya escaneo ahi.*
2. **Regalaba a cualquier hora.** El cupon se usaba el sabado a la noche, con el local lleno: el descuento
   ocupaba una mesa que igual se vendia. *CheckPass sabe a que hora hay lugar (los escaneos tienen hora).*
3. **Media el exito en la primera visita.** Contaba cupones vendidos, no clientes que volvieron. *CheckPass ve la
   segunda visita a precio completo, y con grupo de control sabe si fue extra.*

**La regla que sale:** no se vende el producto con descuento; **se vende el hueco** (la silla vacia del martes
15 h) **y solo a quien todavia no es cliente** (o se durmio). El exito se mide en si vuelve fuera del hueco.

### 2.2 Lo que ya hay en el arbol (medido)

- Cada escaneo con acreditacion es una fila de `core.order` con `created_at` (timestamptz), `business_id`,
  `location_id`, `consumer_id` y `total` (`apps/merchant/src/server/schema/order.ts:31-80`), con indice
  `(business_id, created_at)` (`:79`). → la curva por hora **y en plata** sale sin columnas nuevas.
- El comercio tiene `timezone` (`schema/business.ts:84`) → la hora local se calcula bien.
- `location_id` es nullable (`order.ts:38`, `set null`): un escaneo sin local elegido no entra a la curva por local.
- **NO existe horario de apertura** en ningun lado (grep de `opening_hours|openingHours|businessHours` vacio).
  → hoy la red NO puede distinguir «franja muerta» de «cerrado». Es el primer hueco a resolver.
- Prod: 0 consumidores (SQL de la sesion anterior) → al arrancar no hay curva: el primer mes es sin datos.

### 2.3 Como detecta la red la franja muerta *(orquestador)*

1. **Grilla por local:** dia de la semana × bloque de 1 h, ultimas 8 semanas, en hora local.
2. **Solo horas abiertas:** las declaradas por el comercio (ver decision A) o, sin declaracion, las que tuvieron
   al menos un escaneo en ≥ 3 de las 8 semanas.
3. **Valle =** bloque abierto con escaneos < 40 % de la mediana de los bloques abiertos del local, que se repite
   en ≥ 5 de las 8 semanas (no un martes de lluvia). Se juntan bloques contiguos: «martes y miercoles 15–17 h».
4. **Minimo de datos:** con < ~150 escaneos en 8 semanas no se propone nada; se le pregunta al comercio «¿cual es
   tu hora mas floja?» y se usa su respuesta. La red corrige despues.
5. **Honestidad del dato:** escaneos ≠ clientes (no todos escanean). La curva mide a los miembros; alcanza para
   encontrar el hueco relativo, no para contar gente.

### 2.4 A quien se le muestra *(orquestador)*

- **Si:** quien **nunca escaneo** en ese local, o un miembro **dormido** (etapa de reactivacion de la 0110).
- **No:** el miembro activo. Es la leccion 1 de Groupon: si lo ve, se muda de hora y el comercio regala.
- **Filtros del owner que ya aplican:** rubro distinto al del comercio de referencia y ≤ 2 km (GPS o ultimo
  escaneo). *Efecto a decidir:* con «Todo filtrado», el dormido del Cafe A que hoy escanea en otro cafe no ve el
  valle del Cafe A.
- **Cuando:** solo mientras la franja esta abierta (y la hora previa, para que llegue a tiempo).
- **Donde, sin gastar avisos:** «Ahora mismo, cerca tuyo» arriba en «Mis beneficios»; el recibo del escaneo en
  otro comercio de la zona; el frente del pase en silencio. El aviso con notificacion solo si lo gana en el
  arbitro del dia (§3).
- **Tope:** una vez por persona y por local; el beneficio vence al cerrar la franja.

### 2.5 Que se ofrece *(orquestador)*

Lo que cuesta poco en ese hueco, nunca «50 % en todo»:
- **Sellos ×2 en la franja** (no sale plata hoy; adelanta el premio), o
- **un agregado** («capuchino con humita al precio del capuchino»), con un **piso** que fija el comercio: lo
  maximo que regala por persona.
- Funciona mejor donde el hueco cuesta ~0 (cafe a la tarde, peluqueria a las 11, gimnasio, panaderia al cierre).

### 2.6 Que percibe el comercio *(orquestador)*

1. **Su semana en un mapa de calor** (escaneos y ventas por hora) con la franja floja marcada: «tu martes 15–17 h
   tiene 70 % menos movimiento que tu promedio» (ilustrativo).
2. **Una sola aprobacion:** la franja + el beneficio + el piso. Queda corriendo; lo pausa cuando quiere.
3. **El informe, con el numero honesto de Groupon:** clientes nuevos que vinieron en la franja → cuantos
   **volvieron a precio completo fuera de la franja en 30 dias** → contra el grupo de control, si fueron visitas
   extra o las mismas mudadas de hora → lo que regalo en total.

### 2.7 Decisiones del owner (2026-09-29, textual resumido)

- **A. Horario de apertura:** «lo puede cargar el comercio en Marca».
- **B. Publico:** «ambos son opcion» — no-clientes y dormidos.
- **C. Beneficio:** «las dos opciones»: sellos o puntos extra (segun el programa activo), un producto especifico
  del menu, o un texto libre («2x1 en cerveza»).
- **D. Quien elige la franja:** «la red», con una opcion a editar para los comercios que quieran mas control.

## 3. El modelo conceptual: el mostrador y el cerebro de la red

La lista de features no cierra porque mezcla tres cosas distintas: **de donde sale el dato**, **quien decide** y
**por donde se entrega**. Separadas, el sistema son 5 piezas y un ciclo.

### 3.1 Las piezas (entidades)

| Pieza | Que es | Que sabe |
|---|---|---|
| **Persona** | el cliente, con UN pase | su historia de escaneos en toda la red, su ubicacion (GPS o ultimo local) |
| **Comercio / Local** | quien ofrece | rubro (`category_gcid`), posicion, timezone, (horario: falta) |
| **Relacion** | persona × comercio | etapa: nunca vino · nuevo · activo · dormido · perdido (la 0110) |
| **Beneficio** | lo que un comercio pone sobre la mesa | que da, a que publico, en que ventana, cuanto regala como maximo |
| **Superficie** | donde la persona lo ve | recibo del escaneo · frente del pase · «Mis beneficios» · aviso |

### 3.2 Los momentos (cuando se decide algo)

- **Escaneo** — el mostrador. Es el unico momento en que la red sabe **quien, donde y cuando** sin preguntar.
  Tambien es el momento en que la persona tiene el telefono en la mano.
- **Apertura de «Mis beneficios»** — la persona pregunta «¿que hay para mi?».
- **Paso cerca** — la proximidad del pase (ADR 0065), sin gastar avisos.
- **Tick diario** — el reloj: alguien se durmio, algo vence, se abre una franja valle.

### 3.3 El flujo

```
  MOMENTO                     CEREBRO (una sola funcion)                          SUPERFICIE
  ───────                     ──────────────────────────                          ──────────
  escaneo       ──┐     1. ¿quien es y donde esta?                          ┌──► recibo (1 lugar)
  abre Mis ben. ──┼──►  2. candidatos = beneficios que le CORRESPONDEN      ├──► frente del pase (1 linea)
  paso cerca    ──┤        (etapa + rubro distinto + ≤ 2 km + ventana)      ├──► Mis beneficios (lista)
  tick diario   ──┘     3. ordenar (rotacion → cercania → rendimiento)      └──► aviso (0–3/dia, escaso)
                        4. llenar los lugares de cada superficie
                                         │
                                         ▼
                          MEDICION: ¿vino? ¿habria venido igual? (grupo de control)
                                         │
                                         └──► vuelve al paso 3 como «rendimiento»
```

El **mostrador** no es una feature: es el **momento** mas rico (y el recibo, su superficie). El **cerebro** no es
IA: es **la funcion que llena lugares escasos**. Cada superficie tiene cupo propio: el recibo 1, el frente del pase
1 linea, el aviso 3/dia en Google; solo «Mis beneficios» no tiene tope. El cerebro decide **que va en cada lugar**.

### 3.4 Quien decide que

| Quien | Decide | No decide |
|---|---|---|
| **Comercio** | QUE ofrece, a que publico lo habilita, su franja, su piso | a que persona concreta le llega ni cuando |
| **Red (cerebro)** | A QUIEN, CUANDO y POR DONDE; el orden entre comercios | el contenido ni el costo del beneficio |
| **Plataforma (owner)** | las reglas fijas: 2 km, rubro no competidor, cupos, privacidad | nada caso por caso |
| **Persona** | si lo usa; opt-out por comercio y (futuro) de perfil de red | — |

### 3.5 Un ejemplo que atraviesa todo

Martes 15:10. Sofia escanea en una panaderia (momento: **escaneo**). El cerebro: esta en el Centro; candidatos =
beneficios de comercios a ≤ 2 km que no son panaderias y en los que ella nunca estuvo o se durmio; el Cafe Molino
tiene su franja valle abierta (15–17 h) → entra. Orden: Molino no aparecio en su recibo esta semana, esta a 300 m.
Lugares: **recibo** → «Cafe Molino, a 300 m: capuchino con humita hasta las 17 h»; **frente del pase** → sus sellos
de la panaderia; **aviso** → ninguno (el recibo ya le llego). Si va: es su primer escaneo en Molino (medicion). Si
vuelve un sabado a precio completo, eso es lo que Molino ve en su informe.

### 3.6 Por que el cerebro puede empezar tonto

El paso 3 arranca con **reglas fijas** (rotacion → cercania). Recien con datos se le suma el «rendimiento» medido
contra el grupo de control (lift del ADR 0066) y, mucho despues y con consentimiento de red (LOPDP), el nivel
persona. **El modelo no cambia al crecer: cambia solo como se ordena en el paso 3.** Por eso se puede construir
por partes sin rehacer nada.

### 3.7 Que cae de este modelo

- **Horas valle** = un tipo de **beneficio** con ventana horaria y publico «no-clientes/dormidos».
- **«Te extrañamos»** (0110) = un beneficio con publico «dormidos», que el tick diario vuelve candidato.
- **Cupon cruzado** (owner) = cualquier beneficio que sale en el **recibo** de otro comercio.
- **El timbre** del owner = un aviso cuyo contenido es «tenes N cosas en Mis beneficios».
- La **spec 0110** pasa a definir **cuando una relacion cambia de etapa** (el paso 2), no cuantos push salen.

### 3.8 Decisiones del owner y lo que queda abierto

**Consolidado en el ADR 0103 (2026-09-29).** Ultimas respuestas del owner: aviso del escaneo = **variante 2**;
F se enriquece con **novedad, comercio nuevo, exploracion y su horario** (no eligio los filtros de cupo agotado /
ignorado 3 veces ni «rendimiento»; tampoco respondio si el recordatorio sale solo con novedad).

- **E. (owner, 2026-09-29):** si — el recibo muestra beneficios de otros comercios desde el dia uno.
- **G. (owner, 2026-09-29, textual resumido):** «en el wallet nunca metemos el cupon de otro comercio […] el cupon
  vive en la cuenta checkpass.club del cliente». El aviso del escaneo sigue, pero cambia su texto: acredita los
  puntos/sellos **e invita a abrir checkpass.club** para ver sus beneficios. Dos variantes que planteo el owner,
  SIN elegir: **(1)** un aviso por cada compra (hasta 3/dia); **(2)** hasta 2 avisos de compra por dia y, el dia sin
  compra, 1 recordatorio para abrir la cuenta. Medido: el escaneo ya notifica (`wallet/google-object.ts:142-165`,
  `TEXT_AND_NOTIFY`; Apple `changeMessage`, `wallet/apple.ts:86-94`); el pase enlaza a `/c/[webViewToken]`
  (`wallet/apple.ts:101-103`, `wallet/google-object.ts:112`). **Sin verificar:** si tocar el aviso abre el pase
  (y de ahi el enlace, 2 toques) o la cuenta directo — se prueba en un telefono.
- **F. (owner, 2026-09-29):** «una combinacion de varias, primero urgencia mas rotacion mas cercania», abierto a
  enriquecerlo. *Propuestas del orquestador para enriquecerlo, SIN decidir:* filtros duros antes de ordenar
  (cupo del comercio agotado → no sale; beneficio ignorado 3 veces por esta persona → descansa); **novedad**
  (primero lo que nunca vio); **su horario** (primero lo que puede usar a las horas en que suele escanear);
  **comercio nuevo en la red** (empujon las primeras semanas); **exploracion** (~1 de cada 10 lugares al azar,
  para medir contra el grupo de control); **rendimiento** cuando haya datos.
- *Contexto de F:* cuando varios comercios compiten por un mismo lugar (el destacado de la cuenta, el aviso
  dirigido), algo decide cual sale. Criterios: **urgencia** (vence antes: franja valle abierta ahora, cupon que
  vence hoy), **rotacion** (el que hace mas que no le aparece a esta persona: reparto justo entre los que pagan),
  **cercania**, **rendimiento** (visitas extra contra el grupo de control; necesita datos).
