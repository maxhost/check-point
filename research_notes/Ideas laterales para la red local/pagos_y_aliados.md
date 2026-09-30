# Pagos, bancos, telcos y super-apps como aliados o modelos — notas (2026-09-29)

> Dominio de este archivo: quien en Ecuador (y en LatAm) ya gasta plata para que el consumidor pague
> o compre en comercios chicos, y como CheckPass se enchufa ahi. Formato del `_encargo.md`.
>
> **Limite declarado de la investigacion:** el presupuesto de busquedas web de la sesion se agoto a
> mitad del trabajo. Lo leido con fuente esta marcado con URL y confianza. Mercado Pago, Nubank, Tuya,
> Pacificard y Claro Club **Ecuador** NO se pudieron leer: van como «sin fuente (conocimiento previo)»
> y confianza B/M — hay que verificarlos antes de citarlos a un aliado.

## 0. El mapa de Ecuador en una tabla (lo que se pudo leer)

| Actor | Que hace hoy | Cifra | Fuente | Conf. |
|---|---|---|---|---|
| **Deuna** (Banco Pichincha) | QR y transferencia P2P/P2M, **0% de comision al comercio** en QR presencial; acredita al dia siguiente; desde 2026 pago sin conexion | 314 mil comercios / 2 M usuarios (NM Tech 2026) vs **620 mil / 6 M** (resumen de busqueda, sin pagina) — cifras que no cuadran | [pichincha.com/deuna](https://www.pichincha.com/detalle-producto/pymes-servicios-deuna), [nmtechstudio](https://www.nmtechstudio.com/blog/deuna-para-negocios-cobrar-qr-web-ecuador-2026) | A (0%) / B (tamaño) |
| **Club Deuna** | Programa automatico y gratis por pagar/transferir; niveles por actividad con cashback, promos, regalos; promos mensuales con cadenas (ej. TIA «Jueves Deuna» $5 cashback) | — | [deuna.ec/club-deuna](https://www.deuna.ec/club-deuna.html) (403 al leer; dato del indice de busqueda) | M |
| **Payphone** | Cobro con tarjeta por link/QR sin datafono; **5% + IVA** fijo; campañas estacionales con premios para comercios que cobran | — | [payphone.app/para-negocios](https://payphone.app/para-negocios), [payphone.app/campanas](https://payphone.app/campanas) | A |
| **JEP** (cooperativa, **nacio en Cuenca**, Sayausi 1971) | JEPFast: pagar con QR en taxis, tiendas, panaderias, farmacias; >100 mil establecimientos; paga el **Tranvia de Cuenca** desde JEP Movil; se sumo a la **red CHAS** (QR interoperable entre cooperativas) | 100 mil establ. | [jep.coop/jepfast](https://www.jep.coop/productos-servicios/servicios/jepmovil/jepfast), [redceres CHAS](https://www.redceres.com/post/cooperativa-jep-forma-parte-de-la-red-chas-el-sistema-unificado-de-pagos-con-c%C3%B3digo-qr-que-promueve) | A |
| **Banco Guayaquil** | Banco del Barrio: >4.600 tiendas/farmacias como corresponsales que **cobran comision por transaccion**; billetera **peiGo**; link de pago | 4.600 puntos | [bancoguayaquil.com/banco-del-barrio](https://www.bancoguayaquil.com/banco-del-barrio/), [peigo.com.ec](https://www.peigo.com.ec/blog/bancos-de-barrio-en-ecuador-que-son-y-por-que-son-tan-importantes) | A |
| **Diners Club Ecuador** | «Dias Diners» por centro comercial con descuentos en comercios participantes; blu benefits (descuentos 10–20% por rubro); cashback 1% canjeable | — | [dinersclub.com.ec beneficios](https://www.dinersclub.com.ec/tarjetas/beneficios), [TyC Dias Diners 2025](https://dce-documents.s3.amazonaws.com/tyc_dias_diners_2025.pdf) (403) | M |
| Tarjetas (general) | POS fisico 2,5–4,5%; Kushki 2,5–3,5%; Paymentez 1,5% + IVA | — | [firmaok 2026](https://firmaok.com.ec/blog/metodos-pago-aceptar-factura-ecuador-2026) | M |
| **Rappi** | Opera en Ecuador (Quito confirmado); **Cuenca no confirmado** | — | [rappi.com.ec](https://www.rappi.com.ec/) | M |

**Quien absorbe el descuento de Diners** no esta publicado: las TyC dicen que el comercio participante
informa el beneficio, lo que sugiere co-financiamiento negociado comercio por comercio (confianza B).

**El hallazgo que ordena todo lo demas:** en Ecuador **el QR ya es gratis** (Deuna 0%, JEP/CHAS «sin costo
adicional»). La vision «medios de pago propios con comisiones bajas» NO puede competir por comision: el
precio ya es cero y lo pone el banco mas grande del pais. Lo que Pichincha, JEP y Guayaquil NO tienen es
**la razon para volver al comercio chico** (fidelizacion + red) ni **la medicion de si su promo trajo una
visita que no iba a pasar**. Eso es lo que CheckPass vende, a ellos.

---

## 1. Block: Cash App Neighborhoods (el modelo mas cercano que existe)

**1. A → mecanismo → B.** Block une sus dos lados (59 M usuarios de Cash App, 4,5 M comercios Square). El
consumidor «sigue» cafes/restaurantes de su barrio y gana **Local Cash = 10% del subtotal (tope US$10 por
orden) + US$5 de bienvenida**, que se gasta **en cualquier comercio de la red**, no solo en el que lo dio.
**Cash App financia el Local Cash** en el periodo introductorio; despues el comercio paga solo lo que se
redime y nunca mas de lo emitido en el mes. Procesamiento **1%** en ordenes de Cash App (la mitad de lo
normal de Square). Resultado: los seguidores hacen **~10% del volumen del comercio tras tres trimestres** y
transaccionan **50% mas seguido** que los no seguidores; en jun-2026 el programa sumaba US$1.000 M de
volumen anualizado (+220% vs marzo). Owen Jennings: «probablemente el mayor factor» de crecimiento de la red.
Fuentes: [Square fees](https://squareup.com/help/us/en/article/8644-understand-neighborhoods-fees-and-payments),
[Square como funciona](https://squareup.com/help/us/en/article/8641-how-neighborhoods-works-at-your-business),
[Payments Dive](https://www.paymentsdive.com/news/why-cash-app-wants-food-orders-square-merchants-dining/825040/),
[Intelligent Fin.tech 2026-08-27](https://www.intelligentfin.tech/2026/08/27/blocks-neighborhoods-adds-30000-more-sellers-as-square-and-cash-app-help-build-local-commerce-network/).
Confianza **A** en mecanismo; **M** en el 10%/50% (cifras de la propia Block, sin grupo de control publicado).

**2. De B a C.** Block tiene billetera + POS; CheckPass tiene pase + escaner. Lo que se copia es la
**moneda de red financiada por un tercero durante el arranque**: «Saldo Cuenca» en «Mis beneficios». El
consumidor ve «tenes $1,40 para usar en cualquier comercio de la red»; el comercio lo acepta como descuento
al escanear; **quien paga el saldo el primer año no es CheckPass ni el comercio: es el aliado financiero**
(ver §2). El comercio lo percibe como «un cliente de otro local vino a gastar su saldo aca» — el resultado
(2) de la mision.

**3. Innovador / dificil de copiar.** Es la unica evidencia publica a escala de que una red de fidelizacion
entre comercios **chicos** mueve volumen. Lo dificil de copiar no es la moneda: es tener los dos lados. En
Cuenca, CheckPass puede tener el lado comercio + consumidor + medicion; el banco tiene la plata.

**4. Viabilidad sin app / Cuenca.** **Media.** El saldo vive en la PWA y se aplica al escanear el pase —
no necesita app. Riesgo principal: **regulatorio** — un saldo canjeable en muchos comercios se parece a
dinero electronico (en Ecuador, sujeto a la Junta de Politica y Regulacion Financiera; **sin fuente leida,
verificar con abogado**). Salida: que el saldo sea del **banco** (cashback en su cuenta) y CheckPass solo
lo muestre y lo mida.

**5. Experimento.** 5 comercios de rubros distintos en 2 km; durante una semana, al escanear se le dice al
cliente «tenes $1 para gastar en cualquiera de estos 4 locales» (lo pone CheckPass de su bolsillo: $1 x
escaneos redimidos, tope $100). Medir: % de redencion en un local DISTINTO del que lo dio, y cuantos de esos
eran nuevos para ese local. Es el numero que se le lleva a JEP/Pichincha.

## 2. Bancos y billeteras QR de Ecuador como pagadores del beneficio (Deuna / JEPFast / peiGo)

**1. A → mecanismo → B.** Pichincha regala el cobro QR (0%) y ademas **paga cashback** al consumidor
(Club Deuna por niveles, «Jueves Deuna» con TIA). Monetiza depositos, datos y credito, no la comision.
Banco Guayaquil paga comision a 4.600 tenderos para que sean su sucursal (Banco del Barrio). JEP integra el
Tranvia de Cuenca y 100 mil establecimientos a JEPFast. Resultado: **tres entidades ya gastan plata para
llevar transacciones al comercio chico**, y sus promos visibles son con **cadenas** (TIA), no con la
panaderia de la esquina — porque no tienen como llegar a ella con una promo segmentada. Fuentes en la tabla
§0. Confianza **A** en el 0% y en que existen los programas; **B** en que Club Deuna no llegue a comercios
chicos (no se pudo leer el listado de promos: 403).

**2. De B a C — el acuerdo concreto («el banco paga, CheckPass aporta red y medicion»):**
- **Que pone el banco:** un presupuesto de beneficio (p. ej. $3.000/mes en Cuenca) y su QR.
- **Que pone CheckPass:** la red de comercios, la distribucion (el beneficio aparece en «Mis beneficios» y
  en el escaneo, sin gastar avisos), la segmentacion por etapa de ciclo de vida (dar el cashback al «en
  riesgo», no al que iba a venir igual) y **el grupo de control**: un informe mensual de *lift* incremental
  («de 1.000 clientes con el beneficio vs 1.000 sin, vinieron 140 visitas mas; costo por visita
  incremental $2,10»). Ningun banco en Ecuador recibe hoy ese numero de su promo.
- **Que ve el consumidor:** «Pagando con Deuna/JEPFast en Panaderia X hoy, tu sello vale doble» o «10%
  de vuelta». Paga con el QR del banco como ya lo hace.
- **Que hace el comercio:** nada nuevo — escanea el pase como siempre y cobra con el QR del banco.
- **Como se liquida sin integracion:** CheckPass marca el escaneo con beneficio; el comercio (o el cliente)
  registra que pago con el QR del banco; a fin de mes CheckPass entrega al banco la lista de visitas y el
  banco acredita el cashback al cliente o reembolsa al comercio. Fase 2: el banco expone un webhook de pago
  y la conciliacion es automatica.
- **Que cobra CheckPass:** un fee por visita incremental medida, o **que el banco pague la suscripcion de
  $10/mes de los comercios** que aceptan su QR (el banco «regala» CheckPass como ya regala el QR). Esta
  segunda es la que resuelve el precio del owner: el comercio no paga, paga el aliado.

**3. Innovador / dificil de copiar.** El banco compra hoy promos a ciegas; CheckPass le vende **promos
medidas en comercios que el banco no alcanza**. El grupo de control es la barrera: el banco podria hacer su
propio programa, pero no tiene la frecuencia por comercio (sellos) ni la etapa de ciclo de vida.

**4. Viabilidad / Cuenca.** **Alta con JEP, media con Pichincha.** JEP nacio en Cuenca, integra el tranvia
y es la mayor cooperativa del pais: el pitch «la cooperativa de Cuenca financia el consumo en los comercios
de Cuenca» encaja con su identidad. (Jardin Azuayo tambien es cuencana — **sin fuente leida**.) Pichincha
es mas grande pero decide en Quito. Riesgo principal: **ciclo de venta a un banco** (meses) y exigencias de
seguridad/datos personales (LOPDP) para compartir listas.

**5. Experimento.** Sin firmar nada: una semana, 5 comercios, cartel «pagando con JEPFast/Deuna tu sello
vale doble» (lo absorbe el comercio: un sello no cuesta plata). Medir que % paga con QR y si el doble sello
movio visitas vs la semana anterior y vs el grupo de control. Con ese PDF se pide la reunion.

## 3. Tarjetas de credito: Diners Club Ecuador, Pacificard (card-linked offers)

**1. A → mecanismo → B.** «Dias Diners» y blu benefits: descuentos en comercios participantes al pagar con
la tarjeta; el comercio lo co-financia a cambio de trafico de clientes de alto ticket. En EE.UU. el modelo
industrializado es el *card-linked offer* (Cardlytics): el comercio paga el descuento + una comision solo si
la compra ocurre, y el banco lo distribuye en su app. Resultado: el banco da «beneficios» casi gratis;
paga el comercio. Fuentes: [Diners beneficios](https://www.dinersclub.com.ec/tarjetas/beneficios); Cardlytics
y Pacificard **sin fuente leida**. Confianza **M** (Diners) / **B** (resto). Diners Ecuador y Banco Pichincha
comparten grupo controlante — **sin fuente leida, verificar**.

**2. De B a C.** Invertir el flujo: **CheckPass es el canal que le trae comercios chicos a Diners/Pacificard**
(hoy sus beneficios son cadenas y centros comerciales). El consumidor ve en «Mis beneficios» «15% con
Diners en Cafe X»; el comercio lo carga en CheckPass en 1 minuto; el emisor lo publica en su app y paga la
parte que negocie. Ademas: CheckPass sabe quien es cliente frecuente del cafe — el emisor puede dirigir la
oferta solo a los que NO lo son (adquisicion pura).

**3. Innovador.** Los emisores no tienen fuerza de ventas para 3.000 comercios chicos de Cuenca; CheckPass
si (o la va a tener). Es un canal de alta de comercios para su programa.

**4. Viabilidad.** **Media-baja.** El comercio chico cobra poco con tarjeta en Cuenca (costo 2,5–4,5%) y
el ticket es chico. Riesgo: al emisor no le interesa un cafe de $3.

**5. Experimento.** Ninguno de una semana: primero una llamada con el area de beneficios de Diners o
Pacificard preguntando cuanto les cuesta dar de alta un comercio y quien paga el descuento. Dato barato,
decisivo.

## 4. Telcos: Claro Club / Movistar (beneficios que paga el comercio)

**1. A → mecanismo → B.** Claro Club (Colombia, El Salvador, Peru, Guatemala, Costa Rica leidos): gratis
para el cliente, sin puntos; en la app Mi Claro se elige un cupon y se genera un **QR** que se muestra en el
comercio (restaurantes, cafeterias, salones de belleza). **El descuento lo pone el comercio**; la telco lo
usa para bajar la baja de lineas (churn). Fuentes: [Claro CO](https://www.claro.com.co/personas/servicios/entretenimiento/claro-club/),
[Claro SV](https://www.claro.com.sv/personas/servicios/entretenimiento/claro-club/). Ecuador **no leido**
(confianza **M** en el mecanismo, **B** para Ecuador).

**2. De B a C.** Es CheckPass sin la fidelizacion: cupones que el comercio paga, distribuidos por alguien con
millones de usuarios. Dos jugadas: (a) **CheckPass como proveedor de ofertas locales de Claro Club en
Cuenca** — la telco necesita comercios; CheckPass los tiene y le entrega un feed. El comercio gana
clientes nuevos de un canal masivo, sin hacer nada extra (el cupon se escanea igual). (b) Beneficio de
bienvenida: «clientes Claro: tu primer sello doble».

**3. Innovador.** La telco quiere retencion, no pagos: no compite con CheckPass en nada.

**4. Viabilidad.** **Media.** Riesgo: las telcos cierran acuerdos con cadenas nacionales; Cuenca puede ser
chica para ellos.

**5. Experimento.** Verificar si Claro Club existe en Ecuador y cuantos comercios de Cuenca tiene (una
tarde). Si tiene pocos, es la puerta.

## 5. Mercado Pago / Mercado Credito (de cobrar a prestar)

**1. A → mecanismo → B.** Mercado Pago entra por el QR y el cobro, y monetiza **prestando al comercio con el
historial de cobros** como scoring (Mercado Credito), descontando la cuota de las ventas futuras. En
Argentina co-financia descuentos por pagar con QR junto a bancos y comercios. **Sin fuente leida** (403 en la
pagina de ayuda); confianza **M** (es conocimiento publico general). **Mercado Pago no opera en Ecuador**
hasta donde se sabe — confianza B.

**2. De B a C.** El camino a «pagos propios» no es el cobro (ya es gratis) sino **el credito al comercio con
datos de visitas**. CheckPass sabe, por comercio: clientes activos, frecuencia, recurrencia, estacionalidad
— un *scoring de salud del negocio* que hoy nadie tiene para la panaderia informal. **JEP presta; CheckPass
aporta el score y cobra por originacion.** El comercio ve «tu panaderia califica para $2.000 en JEP, cuota
automatica».

**3. Innovador.** Los datos de fidelizacion como colateral informativo son raros en LatAm para el micro
comercio; el banco hoy presta con estados de cuenta que el comercio informal no tiene.

**4. Viabilidad.** **Media (a 12–24 meses).** Riesgo: se necesita historia (meses de datos) y la LOPDP exige
consentimiento explicito del comercio para compartir.

**5. Experimento.** Armar a mano el «informe de salud» de 3 comercios con sus datos de CheckPass y
preguntarle a un oficial de credito de JEP si le sirve y que le falta.

## 6. Nubank / Tuya / Rappi Prime (breves)

- **Nubank** (sin fuente leida, conf. M): crece con cero comisiones y experiencia; monetiza credito y
  depositos. Leccion para CheckPass: el producto gratis es el canal; el margen esta en el credito. No opera
  en Ecuador.
- **Tuya** (Bancolombia + Grupo Exito; sin fuente leida, conf. M): tarjeta de marca compartida — el retail
  pone clientes y datos, el banco balance y riesgo. Analogo: **«tarjeta/cuenta de la red Cuenca» con JEP**,
  donde el pase CheckPass es la marca y JEP la cuenta. Es la version mas ambiciosa de §2.
- **Rappi Prime** (conf. B para Ecuador): suscripcion del consumidor que financia envio gratis. Analogo:
  «CheckPass Plus» a $1,99/mes para el consumidor con beneficios de toda la red — dudoso en Cuenca: el
  consumidor ya recibe beneficios gratis de bancos (Club Deuna) y telcos.

---

## Respuestas a las preguntas del encargo

**¿Quien en Ecuador tiene interes en financiar que el consumidor compre en comercios locales?**
En orden de interes x cercania a Cuenca:
1. **JEP** (y probablemente Jardin Azuayo): cooperativas cuencanas, con QR propio y red CHAS, que necesitan
   **uso** de JEPFast frente a Deuna. Identidad local = el pitch escribe solo.
2. **Banco Pichincha / Deuna**: ya paga cashback (Club Deuna) y regala el cobro; quiere volumen y
   desplazar efectivo; sus promos llegan a cadenas, no al barrio.
3. **Banco Guayaquil / peiGo**: ya le paga a tenderos (Banco del Barrio); quiere cuentas peiGo.
4. **Emisores de tarjeta** (Diners, Pacificard): menos, por el ticket chico.
5. **Telcos**: interes en retencion, pero el descuento lo pone el comercio, no ellas.
6. Municipio de Cuenca / Camara de Comercio (sin fuente): desarrollo economico local; posible sponsor
   de un «Saldo Cuenca» de lanzamiento.

**¿Como seria el acuerdo?** Ver §2.2: el aliado pone el presupuesto de beneficio y **paga la suscripcion de
los comercios**; CheckPass pone red, distribucion sin gastar avisos, segmentacion por ciclo de vida y el
**informe de lift con grupo de control** (costo por visita incremental). Liquidacion manual por lista mensual
en fase 1; webhook de pago en fase 2. El comercio no cambia su operacion.

**¿Que camino lleva de fidelizacion a pagos propios?** Propuesta en 4 escalones (ninguno compite por
comision, porque en Ecuador el QR ya cuesta 0%):
1. **Hoy — fidelizacion + medicion.** Construir la prueba de lift.
2. **Pago aliado** (6–12 meses): el beneficio lo financia un banco/cooperativa y se activa pagando con SU
   QR. CheckPass mide. Primer ingreso que no sale del comercio.
3. **Saldo de red** (12–18 meses): una moneda tipo Local Cash emitida **por el aliado** (evita licencia de
   dinero electronico) y mostrada/gastada via CheckPass en cualquier comercio de la red. Aca el pase de
   CheckPass empieza a ser el medio de pago percibido, aunque la plata la custodie el banco.
4. **Credito y cuenta de marca compartida** (18–36 meses): score de salud del comercio con datos de CheckPass
   → credito de JEP; eventualmente «cuenta Red Cuenca» estilo Tuya. Delivery encaja aca como un comercio mas
   que acepta el saldo.
Pagos «propios» en sentido estricto (licencia de PSP o dinero electronico) solo si el escalon 3 muestra
volumen; hasta entonces es mas barato y rapido ser **la capa de fidelizacion sobre el QR de otro**.

---

## Mis 3 mejores ideas (rankeadas)

1. **«El banco paga la suscripcion»**: JEP (o Deuna) financia los $10/mes de cada comercio que acepte su QR +
   un presupuesto de beneficio, a cambio del informe de lift con grupo de control. Resuelve precio, adopcion
   y el primer ingreso grande a la vez. Experimento: doble sello pagando con QR, 5 comercios, 1 semana, y
   con el PDF pedir reunion en JEP.
2. **Saldo de red financiado por el aliado (Local Cash de Cuenca)**: 10% del ticket en saldo gastable en
   **otro** comercio de la red; es el unico mecanismo con evidencia a escala (Block) de que la red trae
   clientes nuevos. Experimento: $1 de saldo cruzado pagado por CheckPass, tope $100, medir redencion en
   local distinto.
3. **Score de salud del comercio para credito** (Mercado Credito aplicado a la panaderia): el camino a
   ingresos de pagos sin pelear comision. Experimento: 3 informes a mano y una charla con un oficial de
   credito de JEP.

## Idea loca

**«El pase CheckPass como tarjeta del Tranvia + monedero de Cuenca».** JEP ya cobra el Tranvia de Cuenca
desde su app. Si el pase de Wallet de CheckPass (que ya esta en la pantalla de bloqueo) fuera tambien el
lugar donde el cuencano ve su saldo JEP de transporte y comercios, cada viaje en tranvia seria un contacto
diario con la red — y un «bajaste en la parada X: a 100 m tenes un cafe con tu sello 9/10». Choca con
permisos, con el integrador del tranvia y con la regulacion; pero convierte el pase en infraestructura de la
ciudad, que es algo que ni Deuna ni Rappi pueden copiar desde Quito.
