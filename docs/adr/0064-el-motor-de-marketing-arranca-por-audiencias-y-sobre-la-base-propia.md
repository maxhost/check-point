---
adr: 0064
fecha: 2026-09-15
estado: aceptada
resumen: El motor de publicidad y marketing se construye en DOS FASES — primero un MOTOR DE AUDIENCIAS (una consulta sobre el comportamiento del consumidor + un mensaje + un efecto opcional, evaluada por el PASO DEL TIEMPO), y despues el motor REACTIVO de reglas del ADR 0018. El motivo es una carencia verificada: los tres disparadores del 0018/spec 0003 exigen que alguien HAGA algo, y el escenario que el ADR 0057 pone como ejemplo («N dias sin visita») es la AUSENCIA de un evento — inexpresable en un motor reactivo. Cada TIPO de campaña tiene su propia spec y su propio ADR; la primera es la proximidad por wallet (ADR 0065 / spec 0065), que ademas fija el journey de composicion y la pantalla de resultados que heredan las demas. Los $20 del plan compran el motor sobre la base PROPIA del negocio; llegar a consumidores de la red que no estan en tu programa es el mismo motor sobre una base que no controlas, con otro precio, y es un producto futuro. El cupon es un EFECTO que el motor emite. Medicion honesta (ADR 0021): «compro en su ventana» es observado; «lo trajo la campaña» solo se afirma con un grupo de control. Inspiracion: Talon.One (regla → efecto → resultado; «actualizar audiencia» como efecto), Fivestars (AutoPilot; base propia incluida, red cruzada como producto aparte) y RFM.
---

# 0064 — El motor de marketing arranca por audiencias, un tipo de campaña por spec, y sobre la base propia

## Contexto

El ADR 0057 fijo la direccion: geofencing/check-in, segmentacion por comportamiento («N dias sin
visita»), cupon exclusivo y push al Wallet. Los ADR 0018, 0022 y 0023 son la fundacion conceptual del
motor (reglas tipadas, objetivos medibles, disparadores independientes), y la spec 0003 es su borrador.
La entrega YA EXISTE y esta en prod: cola `wallet_push_queue` con `class in ('transactional','campaign')`
(ADR 0037), transportes wallet + Web Push (ADR 0038/0039), ruteo por clase (ADR 0040) y atribucion por
local (ADR 0042).

Al retomar el arco (2026-09-15) se verifico contra el arbol, no contra los documentos:

- **No existe NADA de campañas en datos**: ni `campaign`, ni versiones, ni reglas, ni segmentos. La
  «demo» de la spec 0017 son dos `.tsx`.
- **El motor del ADR 0018 es puramente REACTIVO.** Sus disparadores (`checkin_completed`,
  `purchase_credited`, `game_completed`) exigen que alguien haga algo. «Un cliente que vino, consumio
  y no regreso» es la ausencia de un evento: **el ejemplo del propio ADR 0057 es inexpresable** con
  ese motor. Talon.One lo resuelve con evaluacion periodica sobre perfiles/audiencias; el 0018 no
  copio esa pieza, ni la de «actualizar audiencia» como efecto.
- **Los datos para segmentar son mejores de lo que los borradores asumen.** `core.order` tiene
  `total`, `currency_code`, `location_id`, `units_granted`, `balance_after`, `created_by_user_id`, y
  `order_item` tiene producto, categoria y precio snapshot; `product` tiene `unit_price`/`unit_cost`.
  Eso da R, F y M completos, ticket promedio, local preferido, dia/franja, categorias y margen real.
  Mas el alta (`program_membership.enrolled_at`, `origin_location_id`), el saldo vivo
  (`points_balance`/`stamps_count`) y el canje (`reward_redemption`). Lo que NO hay: email, fecha de
  nacimiento, consentimiento/opt-out de marketing, check-in propio, categoria del negocio.
- **El ruteo de `campaign` esta sin decidir y su default es el bug que el ADR 0040 vino a matar**:
  `planTransports` devuelve fan-out a Apple + Google + Web Push para `campaign`
  (`wallet/push-transports.ts:148`, comentado «provisional hasta que la spec de campañas lo refine»).
- **No hay opt-out de marketing en ningun lado** (grep vacio en `apps/`). El unico push hoy es
  transaccional, que el consumidor pidio al enrolarse.
- **El pase es UNO por consumidor y por proveedor** (ADR 0033) y su «Ultima novedad» es un campo
  GLOBAL del consumidor (`consumer_account.latest_message`), no por negocio.

Escenarios que el owner puso sobre la mesa y los que salieron del inventario (2026-09-15):

1. vino, consumio y no volvio · 2. cliente frecuente · 3. gente que pasa cerca y NO es cliente ·
4. a punto de caerse (venia cada 7 dias, hace 21 que no) · 5. le falta un sello para el premio ·
6. saldo dormido (acumulo y nunca canjeo) · 7. aniversario de alta · 8. franja muerta ·
9. cambio de habito de producto/categoria · 10. ticket bajo · 11. abrio un local nuevo ·
12. se enrolo y nunca volvio · 13. proximidad fisica del que YA es cliente.

El **3** no tiene canal hoy y no es un olvido: el ADR 0031 difirio la red de descubrimiento; lo unico
que toca a un desconocido es el afiche fisico con QR por local (spec 0041).

## Decision

1. **Dos fases, en este orden.**
   - **Fase 1 — motor de AUDIENCIAS.** Una campaña de fase 1 es
     `audiencia → canal → mensaje → efecto opcional → limites`. La **audiencia** es una consulta
     cerrada sobre hechos del consumidor respecto del negocio (RFM sobre `core.order`, saldo,
     `enrolled_at`, alcanzabilidad), **evaluada por un tick periodico** — el disparador es el paso del
     tiempo, no un evento. Sin DSL, sin texto libre fuera del nombre y el mensaje (coherente con el
     ADR 0018).
   - **Fase 2 — motor REACTIVO.** El de reglas del ADR 0018 / spec 0003 (evento confiable → regla →
     efectos atomicos), con dos agregados tomados de Talon.One: **«actualizar audiencia» como
     efecto** (la salida de una regla puede ser pertenencia a una audiencia, que es la entrada de
     otra) y la evaluacion periodica de la fase 1 como segunda familia de disparador.
2. **Un tipo de campaña = una spec + un ADR.** Cada tipo tiene sus propios desafios (canal, datos,
   medicion). La primera es **proximidad por wallet** (ADR 0065 / spec 0065), que **ademas fija el
   journey de composicion de campañas y la pantalla de resultados** que los demas tipos heredan.
   Siguen, cada uno con su spec: reactivacion por push, le-falta-un-sello / premio sin canjear,
   franja muerta, local nuevo, aniversario de alta, categoria abandonada, ticket bajo, cumpleaños
   (cuando exista la fecha).
3. **La base es propia.** Los $20/mes (o $200/año) compran el motor **sobre `program_membership` del
   negocio**: incluidos los que fueron una sola vez. Llegar a consumidores de la red de CheckPass.Club
   que **no** estan en tu programa es **el mismo motor sobre una base que no controlas, con otro
   precio** — producto futuro, no de este arco. Es la linea que Fivestars traza entre su software
   (base propia incluida) y su «Love Local Network» (red cruzada, aparte); y el ADR 0006 ya preveia la
   distribucion destacada como componente eventualmente pago.
4. **El cupon es un EFECTO que el motor emite** («hoy 2x1 solo para vos en cervezas»), no un tipo de
   campaña. Lleva costo declarado y tope de canjes (ADR 0002: estimacion, no contabilidad), su canje
   es atomico e idempotente en el mostrador, y nace con `location_id` (ADR 0042). Su modelo concreto
   lo fija la spec 0065.
5. **Composicion al estilo Talon.One, en bloques cerrados.** El owner compone leyendo una frase con
   selectores acotados (audiencia → canal → mensaje → beneficio → limites → revision), ve la audiencia
   estimada y el costo maximo ANTES de activar, y **no hay boton de «enviar ahora»** en los canales
   que raciona la plataforma. El «AutoPilot» de Fivestars es la referencia de tono: el motor propone,
   el owner confirma.
6. **Medicion honesta, por contrato del ADR 0021.** Toda metrica declara su calidad:
   «compro durante su ventana» / «el push llego y lo abrio» son **observadas**; «la campaña trajo N
   clientes» es **estimada y solo se muestra con grupo de control** (holdout). Ningun tablero afirma
   causalidad sin holdout. El **merito por resultado** (prioridad para quien convierte, con piso para
   quien nunca se mostro y decaimiento) es una decision del owner y se enciende **canal por canal
   cuando ese canal tiene oraculo**: push lo tiene (entrega + click en `public/sw.js`), proximidad no
   (ver ADR 0065).
7. **Datos que faltan y se agregan con spec propia cuando un tipo de campaña los necesite:**
   categoria del negocio (el ADR 0021 ya la pide para sus lentes), fecha de nacimiento del consumidor
   (decision del owner: se pedira mas adelante). **Email: no** (decision del owner).
8. **El ADR 0057 §1 (OTP antes de ampliar el re-enroll) NO se gatilla con la fase 1**: el canal de
   proximidad entrega al **pase instalado en el dispositivo**, no al numero de telefono, asi que la
   verificacion del telefono no cambia a quien le llega. Sigue pendiente para el re-enroll, y no es
   prerequisito de este arco. (Corrige una afirmacion del orquestador hecha al retomar el arco.)

## Consecuencias

- La **spec 0003** queda superada en su orden: su motor reactivo es la **fase 2**; su seccion de
  wizard se reencuadra por la composicion de la spec 0065. La **spec 0007** (tablero) se reparte
  por tipo de campaña bajo el contrato del ADR 0021. La **spec 0017** (demo de campañas, «todavia en
  uso») queda reemplazada cuando la 0065 se implemente: el tile «Campañas» del backoffice pasa a
  apuntar a `/backoffice/marketing`.
- El fan-out provisional de `campaign` en `planTransports` **no se usa**: cada tipo de campaña fija
  su transporte en su spec (la 0065 agrega la clase `pass_refresh`, silenciosa).
- Hay que introducir **opt-out de marketing por negocio** en el consumidor (spec 0065), porque un
  push de campaña es publicidad y hoy no hay forma de bajarse. Lo transaccional no se toca.
- El freno de campañas al bajar de plan (cabo suelto del QA de la 0063) entra en la spec 0065, y el
  owner lo resolvio como **bloqueo duro** al bajar, no como pausa (ADR 0065 §12).

## Alternativas descartadas

- **Implementar la spec 0003 entera (motor reactivo) primero.** No puede expresar la ausencia de
  evento, que es el escenario 1 y el ejemplo del ADR 0057. Descartada; pasa a fase 2.
- **Un constructor generico de journeys/automatizaciones.** Ya lo descarta el ADR 0018; «actualizar
  audiencia» como efecto da el ciclo de vida sin ese editor.
- **Red cruzada en fase 1** (escenario 3). No hay canal (ADR 0031) y el owner decidio que es otro
  producto con otro precio.
- **Cobrar por campaña o por envio.** Decision del owner: el motor va incluido en el plan; el
  racionamiento de los canales invasivos es NO monetario (ADR 0065).

## Referencias

- ADR 0018, 0021, 0022, 0023 (fundacion), 0037–0040 (entrega), 0042 (atribucion), 0057 (roadmap).
- [Talon.One — Rules](https://docs.talon.one/docs/product/rules/overview) ·
  [Fivestars — AutoPilot](https://blog.fivestars.com/what-is-autopilot/) ·
  [Fivestars — Love Local Network](https://www.fivestars.com/products/love-local-network/) ·
  [Braze — RFM segmentation](https://www.braze.com/resources/articles/rfm-segmentation)
