# Ciclo de vida del cliente — Lavado de autos / lavadero (`gcid:car_wash`)

Investigacion: 2026-09-29. Presupuesto usado: ~21 busquedas/fetches (tope ~20). Cortado por presupuesto.

**Advertencia general:** la industria del lavado (ICA, DRB, Sonny's, Rinsed, Cinch) publica mucho sobre
**miembros de planes ilimitados** y muy poco con numeros abiertos sobre el **cliente que paga por lavado**
(«retail»), que es el caso de un lavadero chico argentino. Los estudios de consumo de la ICA son pagos
(US$450–950 por paquete; «CAR WASH Pulse» por suscripcion) y no pude leer sus cifras en primera mano.
El PDF del estudio ICA 2016 se descargo pero no se pudo extraer el texto en este entorno (sin
`pdftotext`/`pypdf`). Varias cifras abajo vienen **de segunda mano** y asi se marcan.

Leyenda de tipo de fuente:
- **[P]** dato primario (estudio o datos de un proveedor con base de clientes).
- **[P-2a]** dato primario citado por un tercero; no pude leer la fuente original.
- **[O]** opinion / guia de blog de proveedor, sin muestra declarada.
- **[Prensa]** testimonio de comerciantes en un medio.

---

## 1) Intervalo de visita

| Segmento | Intervalo | Tipo | Fuente |
|---|---|---|---|
| Miembro de plan ilimitado (EE.UU.) | 2,4–2,6 lavados/mes ≈ **cada 12 dias** (~30/año) | [P-2a] | Cinch, *Retail to Member Report* (citado por ghlcarwashsnapshot; la pagina de Cinch no se pudo leer completa) |
| Miembro «sano» (EE.UU.) | «sweet spot» de **2 a 4 lavados/mes** ≈ cada 7–15 dias | [P] proveedor POS | DRB |
| Dueño de auto promedio (EE.UU.) | 66% lava **una o dos veces por mes** ≈ cada 15–30 dias | [P-2a] | ICA Consumer Study (citado por ghlcarwashsnapshot) |
| Cliente retail (paga por lavado, EE.UU.) | **30 a 60 dias** entre visitas en muchos mercados | [O] | Rinsed (CRM de lavaderos) |
| Cliente retail vs miembro | «un puñado de visitas por año» para el que paga por lavado | [P-2a] | Cinch via ghlcarwashsnapshot |
| Argentina (Entre Rios) | «lo ideal seria al menos una vez al mes»; «antes podia ser semanal o quincenal, hoy se estira» | [Prensa] | UNO Entre Rios |

**Lectura:** hay dos poblaciones muy distintas. El suscriptor lava cada ~1–2 semanas; el cliente que
paga por lavado —el habitual de un lavadero de barrio— vuelve cada **~2–4 semanas si es habitual** y
cada **30–60 dias** el promedio. En Argentina, con la inflacion, los comerciantes reportan que el
intervalo se estiro de semanal/quincenal a mensual. No encontre una **mediana** medida con muestra
para el cliente retail: el «30–60 dias» es la mejor cifra disponible y es de un blog de proveedor.

## 2) Definiciones de la industria (en riesgo / inactivo / perdido)

No encontre una definicion estandar publicada por la ICA ni por un POS (DRB/Sonny's) con umbrales en
dias para clientes retail. Lo que hay son **guias de proveedores de CRM/marketing** [O]:

- **Rinsed** (CRM usado sobre POS DRB y Sonny's): secuencia para retail «Day 30: Friendly reminder /
  Day 45: Nudge with urgency / Day 60: Win back incentive / Day 90: Strong reactivation offer»; y
  para primera visita «Thank you message within 7 days / Reminder at 21 days / Return incentive at 30 days».
  Mide la «reactivation rate at 60 and 90 days» como KPI (sin dar el benchmark).
- **Blinko** (blog): «There is a lapse window of around 30 days, the point after which a customer is
  more likely lost than recovered»; «By 45 days, there's a good chance they found a competitor»;
  «By 60 days, you're competing against an established habit at a different location»;
  «Day 28 to day 35 is the most valuable win-back window». Sin fuente ni muestra.
- **DRB** (miembros, no retail): no define dias de inactividad; define el riesgo por **uso en los
  primeros 30 dias** (ver §3).

Convergencia de las guias: **30 dias = recordatorio / lapso**, **45 = en riesgo**, **60 = win-back**,
**90 = reactivacion fuerte** (ultimo intento que nombran).

## 3) Retencion / abandono

- **DRB [P]**: «if new members wash their cars an average of 1.7 times or less in the first 30 days,
  they are 75% less likely to stay on for a second month»; «new members who wash an average of three
  times or more in that first month are 76% more likely to recharge their plan at least once»;
  «If they wash four or more times in the month, they are 61% more likely to still be a member by month six».
  Objetivo de churn: «keep your overall churn rate under 5% annually» (sic, asi lo dice la pagina; el
  resto de la industria habla de churn **mensual**, por lo que probablemente sea un error del articulo).
- **Superoperator [O]**: churn de membresias «between 5% and 15% per month for most operators», los
  buenos «below 5%». (Blog, sin muestra.)
- **ICA Pulse Q1 2025 [P]** (encuesta a consumidores): «54% of former subscription members continue to
  wash at the car wash where they used to be a subscriber» — el que cancela no esta perdido: sigue
  viniendo como retail. Tambien citado (segunda mano): «91% of unlimited subscribers say they plan to renew».
- **% que vuelve por segunda vez / % retenido a 90 dias para retail: NO ENCONTRADO** con cifra.

## 4) Particularidades del rubro

- **Clima (lo mas fuerte del rubro):** «Nadie lava el auto si sabe que al otro dia se ensucia»; «Si
  esta seco, trabajas bien. Si llueve, se paraliza todo» (UNO Entre Rios [Prensa]). Rinsed: el
  intervalo «varies by climate». Implicancia: una racha de lluvia estira el intervalo sin que el cliente
  se haya ido — las etapas no deberian ser muy cortas, y lo ideal (fuera de alcance de este informe) seria
  no disparar push un dia de lluvia.
- **Estacionalidad invertida en Argentina:** en invierno el lavadero profesional gana contra el lavado
  en casa porque «la gente no se quiere mojar» (UNO Entre Rios, parafraseo del articulo).
- **Sensibilidad al precio:** «Para muchos llevar a lavar el vehiculo paso a ser un gasto que se
  evalua»; caida de «hasta 28 autos en una mañana» a «8, 10 o 12 como mucho» (UNO Entre Rios). El
  intervalo real en AR hoy es mas largo que el de EE.UU.
- **Dos poblaciones:** abonados (cada ~12 dias) y clientes por lavado (cada 30–60). Un comercio con
  abonos deberia elegir el valor corto de «Te extrañamos».
- **El churn de un abonado no es la perdida del cliente** (54% sigue viniendo, ICA).

## 5) Escalera propuesta

| Etapa | Valor propuesto | Confianza |
|---|---|---|
| Te extrañamos (opcion A, clientes frecuentes / abonados) | **dia 21** | media |
| Te extrañamos (opcion B, cliente por lavado tipico) | **dia 30** | media |
| En riesgo: arranque R | **dia 45** | media-baja |
| En riesgo: cadencia X | **cada 15 dias** (45, 60, 75) | baja |
| Perdido: arranque P | **dia 90** | media-baja |
| Perdido: 4 mensajes | **91, 105, 135, 181** (P+1, +14, +44, +90 desde el primero) | baja |
| Irrecuperable | **~dia 181** | baja |

**Justificacion:**
- **21 / 30:** el habitual lava cada 2–4 semanas (ICA via 3ro: 66% una o dos veces por mes; AR: «al
  menos una vez al mes»). Un habitual que no volvio en 21 dias ya salto su ciclo quincenal; uno mensual,
  a los 30. Coincide con los hitos de Rinsed («Reminder at 21 days», «Day 30: Friendly reminder») y con
  la «lapse window of around 30 days» de Blinko. 7 o 14 (valores del cafe) son demasiado cortos: con una
  semana de lluvia el cliente sano ya recibiria un «te extrañamos». Para abonados (cada ~12 dias) 21 es
  casi el doble de su ciclo — razonable.
- **R = 45, X = 15:** 45 es donde Rinsed pone el «Nudge with urgency» y Blinko «a good chance they found
  a competitor»; es 1,5× el intervalo mensual. Cadencia de 15 dias ≈ medio ciclo: mensajes en 45, 60
  (el «Win back incentive» de Rinsed) y 75. La cadencia NO tiene respaldo numerico directo.
- **P = 90:** Rinsed ubica la «Strong reactivation offer» en el dia 90 y mide reactivacion a 60 y 90;
  90 dias = 3 ciclos mensuales sin volver, o 1,5× el techo de 60 dias del retail promedio. Ademas cubre
  una estacion entera (un cliente que no lavo en todo un invierno lluvioso).
- **Mensajes 91 / 105 / 135 / 181:** misma forma que el cafe en los dos primeros; el tercero se adelanta
  (135 en vez de 151) porque el ciclo base es mensual y un gap de 46 dias ya es ~1,5 ciclos. **El
  181 corresponde a un cambio de estacion** (verano↔invierno), que en AR cambia el habito de lavado.
  Sin datos publicados de reactivacion despues de 90 dias: es juicio, confianza baja.
- **Irrecuperable ~181:** ninguna fuente nombra un intento despues del dia 90; seis meses sin lavar en
  el mismo lugar en un rubro de frecuencia mensual es ~6 ciclos perdidos. Baja.

## 6) Lo que no se encontro (declarado)

- Mediana/distribucion medida del intervalo entre visitas del cliente **retail**, con muestra. Solo el
  rango «30–60 dias» de Rinsed (blog).
- % de primeros clientes que vuelven, % retenido a 90 dias para retail.
- Definiciones en dias de «at-risk/lapsed/lost» de DRB o Sonny's (sus paginas hablan de miembros y churn
  de suscripcion, no de dias de inactividad).
- Cifras del estudio de consumo de la ICA en primera mano (pago; PDF 2016 no legible en este entorno).
  El «66% una o dos veces por mes» no pude verificarlo en la fuente original.
- La cifra «13,6 lavados/año en EE.UU.» aparecio en un resumen de busqueda sin fuente rastreable: **descartada**.
- Datos cuantitativos de LatAm/Argentina con muestra: solo prensa con testimonios de comerciantes.
- Cuantificacion del efecto clima (ej. caida de visitas por dia de lluvia).

## 7) Fuentes

1. **DRB** [P, proveedor POS] — https://drb.com/resources/learning_library/stopping_the_silent_enemy_of_unlimited_car_wash_plans
   — «if new members wash their cars an average of 1.7 times or less in the first 30 days, they are 75% less likely to stay on for a second month»; «new members who wash an average of three times or more in that first month are 76% more likely to recharge their plan at least once»; «If they wash four or more times in the month, they are 61% more likely to still be a member by month six»; «the 'sweet spot' for wash frequency is two to four times a month»; «Ideally, you want to keep your overall churn rate under 5% annually.»
2. **Rinsed** [O, CRM de lavaderos] — https://www.rinsed.com/blog/how-customers-decide-where-to-wash-their-car-before-they-ever-see-your-menu
   — «The average interval varies by climate, but many markets fall between 30 and 60 days for retail customers.»; «Most operators do not know their true average days between retail visits.»; «Day 30: Friendly reminder / Day 45: Nudge with urgency / Day 60: Win back incentive / Day 90: Strong reactivation offer»; «Thank you message within 7 days / Reminder at 21 days / Return incentive at 30 days».
3. **ICA — Pulse Report Q1 2025** [P, encuesta] — https://www.carwash.org/conversations-with-ica/pulse-report-q1
   — «54% of former subscription members continue to wash at the car wash where they used to be a subscriber».
4. **ghlcarwashsnapshot** [agregador; cita a Cinch e ICA → P-2a] — https://ghlcarwashsnapshot.com/blog/car-wash-industry-statistics/
   — «Unlimited members wash about 2.4–2.6 times per month — call it ~30 visits a year» (atribuido a https://cinch.io/retail-to-member-report/); «Roughly 66% of vehicle owners wash their vehicle once or twice a month» (atribuido a ICA Consumer Study); «91% of unlimited subscribers say they plan to renew» (atribuido a ICA Pulse).
5. **Blinko** [O, blog] — https://blinko.ai/blog/car-wash-customer-retention/
   — «There is a lapse window of around 30 days, the point after which a customer is more likely lost than recovered»; «By 45 days, there's a good chance they found a competitor»; «By 60 days, you're competing against an established habit at a different location»; «Day 28 to day 35 is the most valuable win-back window».
6. **Superoperator** [O, blog] — https://www.superoperator.com/what-is-the-average-churn-rate-for-car-wash-memberships-in-2026/
   — churn de membresias «between 5% and 15% per month for most operators» (cita tomada del resumen de busqueda; pagina no abierta).
7. **UNO Entre Rios** [Prensa, Argentina] — https://www.unoentrerios.com.ar/la-provincia/lavaderos-autos-un-negocio-atado-los-vaivenes-del-clima-y-el-bolsillo-n10257284.html
   — «Para mantener el auto en condiciones, lo ideal seria al menos una vez al mes»; «Antes podia ser semanal o quincenal, hoy se estira en el tiempo»; «Nadie lava el auto si sabe que al otro dia se ensucia»; «Si esta seco, trabajas bien. Si llueve, se paraliza todo»; «Antes podiamos hacer hasta 28 autos en una mañana. Ahora estamos en 8, 10 o 12 como mucho».
8. **ICA — anuncio del estudio de consumo 2019** — https://carwashmag.com/ica-releases-u-s-car-wash-consumer-study/ — sin cifras; confirma que los resultados son pagos.
