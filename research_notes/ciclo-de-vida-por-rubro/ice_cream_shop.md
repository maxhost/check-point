# Ciclo de vida del cliente — Heladería (`gcid:ice_cream_shop`)

Investigado el 2026-09-29. Presupuesto: 20 búsquedas/fetches, usados ~20.
Condición de corte: el presupuesto. Encontré **3 números independientes y citados de FRECUENCIA DE
CONSUMO** en Argentina, pero **ninguno de intervalo de visita a UNA MISMA heladería** medido por un
POS o una plataforma de fidelización (ver §6). Toda la escalera se apoya en frecuencia de consumo
declarada, que es una cota por debajo del intervalo real a un local puntual.

Leyenda: **[PRIMARIO]** = encuesta o dato con muestra (aunque llegue citado por prensa);
**[PROVEEDOR]** = afirmación de un proveedor de software de fidelización, sin muestra publicada;
**[BLOG]** = opinión / estimación sin fuente.

---

## 1) Intervalo de visita

No hay dato de "días entre visitas al mismo local". Lo que hay es frecuencia de **consumo** (que incluye
delivery, otros locales y helado de góndola):

| Dato | Valor | Tipo | Fuente |
|---|---|---|---|
| Consumen helado al menos 1 vez por semana | 62% (n=1.058) | [PRIMARIO] D'Alessio IROL / AFADHYA, ~2018 | Ámbito [F1] |
| Consumieron en los últimos 30 días | 82% (misma encuesta) | [PRIMARIO] | Ámbito [F1] |
| En verano 2023, tomaron helado 2 veces por semana o más | 41% (n=1.200) | [PRIMARIO] AFADHYA + D'Alessio IROL | Infobae [F2], BAE [F3] |
| Consumo semanal/mensual en verano 2021 | 53% al menos mensual; 23% una vez por semana | [PRIMARIO] citado por prensa | Forbes AR [F4] |
| "Los argentinos consumen helado mínimo una vez por semana, sin distinción por estación" | — | [PRIMARIO, afirmación de la cámara] | AFADHYA [F5] |
| Clientes "regulares" = semanal o más, 15–25% del tráfico; "ocasionales" = mensual, 15–25% | — | [BLOG] sin fuente | BusinessDojo [F10] |

**Lectura:**
- El consumidor habitual toma helado **cada ~3–7 días** en temporada (41% ≥2 veces/semana en verano;
  62% ≥1 vez/semana en el año).
- El consumidor "promedio" está en el orden **mensual** (82% en los últimos 30 días; 53% al menos
  mensual en verano 2021).
- Como no toda ingesta es en el mismo local, el intervalo al **mismo** comercio es mayor. Estimación
  (no medida): habitual ~7–14 días en temporada; promedio ~30 días. Confianza **baja/media**.
- Distribución: no encontrada.

## 2) Definiciones de la industria (riesgo / inactivo / perdido)

- **Nada específico de heladerías.** Ningún proveedor POS/fidelización del rubro publica umbrales en días.
- Paytronix (fidelización de restaurantes, [PROVEEDOR]): *"In restaurants and retail, 'churn' is when a
  regular customer hasn't transacted in 90+ days."* y *"Engaging customers 60–90 days before a potential
  cancellation or lapse will improve your save rate."* [F6]
- StampMe (fidelización, [BLOG/PROVEEDOR]): *"Most customers visit ice cream shops weekly or monthly"* y
  menciona *"seasonal traffic swings (think summer surges, back-to-school dips...)"*; no define inactivo en días. [F7]
- Conclusión: el único umbral citable es el genérico de restaurantes, **90+ días = churn**, que en heladería
  choca con la temporada (un cliente de verano pasa ~6 meses sin venir sin haberse "perdido").

## 3) Retención

- No encontré % de segunda visita ni retención a 90 días medidos para heladerías.
- Paytronix [PROVEEDOR]: *"For a restaurant, aim for a monthly attrition rate below 5%."* [F6]
- BusinessDojo [BLOG, sin fuente]: *"Successful ice cream shops derive 30-50% of their business from repeat
  customers"* y *"Many successful shops achieve 60-70% repeat customer rates during peak season"*. [F10]
  Útil sólo como orden de magnitud; no es dato.

## 4) Particularidades — estacionalidad (CLAVE)

| Dato | Tipo | Fuente |
|---|---|---|
| Consumo por estación: *"Verano: 87% / Otoño: 78% / Invierno: 75% / Primavera: 81%"* | [PRIMARIO, AFADHYA] | [F5] |
| *"el 84% de los encuestados afirmó disfrutar de un buen helado durante los meses más fríos"* | [PRIMARIO, AFADHYA + D'Alessio] invierno 2025 | [F8] |
| *"El consumo promedio anual per cápita es de 7,3 kilos, con picos de 10 kilos en temporada alta."* | [PRIMARIO, AFADHYA] | [F9] |
| *"El 95% de los encuestados mencionó consumir helado entre diciembre y marzo"* | [PRIMARIO] | [F2] |
| Chungo: *"el área de cafetería representa el 35% de la facturación promedio. Pero en invierno alcanza el 50%"* | [dato de empresa, sin muestra] | Cronista [F11] |
| Dairy Queen Nueva York: *"May foot traffic more than 300% higher than that seen in January"* | [PRIMARIO, datos de movilidad Placer.ai, EE.UU.] | [F12] |
| Ventas en invierno *"Típicamente 55–75% vs meses pico... julio-agosto (HS) con ventas al 25–40% del promedio anual"* | [BLOG/simulador, sin fuente] | Simulalo [F13] |

**Lectura:** en Argentina la mayoría **declara** tomar helado en invierno (75–84%), pero el volumen y la
frecuencia caen fuerte (7,3 kg anual vs 10 kg ritmo de verano; en el hemisferio norte el tráfico puede
cuadruplicarse entre enero y mayo). Hay dos tipos de cliente: el **anual** (sigue viniendo, a menor
ritmo, a veces por la cafetería) y el **de temporada** (desaparece de mayo a septiembre y vuelve con el
calor). Un reloj de "días desde la última visita" sin corrección marca al segundo como «Perdido» en
julio y le manda 4 mensajes de rescate en pleno invierno, cuando no hay nada que rescatar.

**Qué hacer en invierno (propuesta, requiere decisión de producto — hallazgo a decidir):**
1. **Pausa de temporada baja (recomendada):** el comercio marca un rango (default HS: 1 jun – 31 ago,
   editable; muchas heladerías además cierran). Durante la pausa el reloj de etapa **no avanza** y no se
   envían «En riesgo»/«Perdido». Sigue permitido marketing de campaña (cafetería, promo invierno,
   delivery). Al terminar la pausa, el reloj retoma donde estaba.
2. **Mensaje de reapertura:** un push único a todos los que estaban en «Te extrañamos»/«En riesgo»/«Perdido»
   al empezar la temporada (septiembre/octubre) reemplaza a la escalera de rescate de invierno.
3. Sin pausa (si el motor no la soporta), usar la escalera alternativa de abajo con umbrales más largos.

## 5) Escalera propuesta

Días desde la última visita **contando sólo días fuera de la pausa de temporada baja**.

| Etapa | Valor | Confianza | Justificación |
|---|---|---|---|
| Te extrañamos (opción A) | **10** | media | El habitual consume ≥1 vez/semana (62%, F1; 41% ≥2/semana en verano, F2). Al mismo local, ~7–14 días; 10 días es ya una ausencia notable en temporada. |
| Te extrañamos (opción B) | **21** | media | Para comercios con cliente "promedio" mensual (82% consumió en 30 días, F1; 53% al menos mensual, F4). Avisa antes de que se cumpla el mes. |
| En riesgo — R | **45** | baja | 1,5× el ciclo mensual del cliente promedio. No hay umbral del rubro; el genérico de restaurantes pone la ventana de intervención en 60–90 días antes del churn (F6). |
| En riesgo — cadencia X | **cada 21** | baja | Igual que la referencia de café; con pausa invernal no hay riesgo de spamear en julio. 45 → 66 → 87 → 108. |
| Perdido — P | **120** | baja | Paytronix: churn = 90+ días (F6). Se corre a 120 porque en heladería aun dentro de temporada hay semanas frías/lluviosas que cortan el hábito (F9, F12). |
| Perdido — 4 mensajes | **121, 135, 181, 211** (P+1, +14, +60, +90 desde el primero) | baja | Se conserva la forma de la referencia de café; no hay dato del rubro para cambiarla. |
| Irrecuperable | **~211** (después del 4º mensaje) | baja | 211 días de temporada = más de una temporada completa (oct–may ≈ 240 días calendario) sin volver. |

**Alternativa sin pausa de temporada** (días calendario; confianza **baja**): Te extrañamos 14 / 30;
En riesgo R=60 cada 30; Perdido P=240 con mensajes en 241/255/301/331; Irrecuperable ~400. Lógica: un
cliente de temporada con última visita en abril vuelve en octubre/noviembre (~180–220 días); P tiene
que caer **después** de ese hueco para no marcarlo «Perdido» en invierno, y el primer mensaje de
«Perdido» coincide así con el arranque de la temporada siguiente. Costo: en verano se detecta tarde a
quien realmente se fue. Por eso se recomienda la pausa.

## 6) Lo que NO se encontró

- **Intervalo de visita al mismo local** (mediana/promedio en días) medido por POS, app o fidelización,
  en Argentina ni afuera. Grido, Freddo, Persicco no publican datos de frecuencia de sus clubes/apps.
- **Distribución** de la frecuencia (sólo cortes: ≥1/semana, ≥2/semana, últimos 30 días).
- **Definición de riesgo/inactivo/perdido en días específica de heladerías.** Sólo el genérico de
  restaurantes (Paytronix, 90+ días).
- **% de segunda visita o retención a 90 días** en heladerías: nada con muestra.
- **Caída de ventas invierno vs verano en Argentina con fuente primaria**: sólo empresas (Chungo, cafetería
  35%→50%) y un simulador sin fuente (55–75%).
- El informe primario de AFADHYA (PDF, F14) no se pudo leer (no hay extractor de PDF en el entorno);
  sus números se tomaron de la prensa que lo cita.

## 7) Fuentes

- **[F1]** Ámbito — "El helado artesanal se derrite..." — https://www.ambito.com/ambito-biz/el-helado-artesanal-se-derrite-caen-las-ventas-y-pierde-rentabilidad-n4038119
  — *"el 62% de las personas consumía helado al menos una vez por semana"*; *"1.058 encuestados"*; *"el porcentaje se elevaba a 82% durante los últimos treinta días"*. [PRIMARIO vía prensa]
- **[F2]** Infobae, 12/04/2023 — https://www.infobae.com/tendencias/2023/04/12/dia-del-helado-por-que-se-celebra-y-cuales-son-los-10-gustos-mas-pedidos-por-los-argentinos/
  — *"el 41% aseguró haber tomado helado dos veces por semana o más"*; *"Según la encuesta realizada entre 1.200 personas"*; *"El 95% de los encuestados mencionó consumir helado entre diciembre y marzo"*. [PRIMARIO vía prensa]
- **[F3]** BAE Negocios, 11/04/2023 — https://www.baenegocios.com/findesemana/Dia-del-helado-aumenta-la-frecuencia-de-consumo-20230411-0069.html
  — *"el 41 % aseguró haber tomado helado dos veces por semana o más"*; *"un relevamiento realizado durante la reciente temporada por la Asociación Fabricantes Artesanales de Helados y Afines (AFADHYA)... junto a la consultora D'Alessio IROL"*. [PRIMARIO vía prensa]
- **[F4]** Forbes Argentina, 17/03/2021 — https://www.forbesargentina.com/negocios/solo-amor-verano-helado-fue-rubro-menos-sufrio-gastronomia-n5324
  — *"53% consume helado artesanal"* (al menos mensual en verano); *"23% lo hace una vez por semana"*. [PRIMARIO vía prensa; cita reconstruida por el extractor, verificar en la nota]
- **[F5]** AFADHYA — https://www.afadhya.com.ar/helado-artesanal/
  — *"Los argentinos consumen helado mínimo una vez por semana, sin distinción por estación."*; *"Verano: 87% / Otoño: 78% / Invierno: 75% / Primavera: 81%"*. [PRIMARIO, cámara del sector]
- **[F6]** Paytronix — https://www.paytronix.com/blog/customer-attrition-analysis
  — *"In restaurants and retail, 'churn' is when a regular customer hasn't transacted in 90+ days."*; *"For a restaurant, aim for a monthly attrition rate below 5%."* [PROVEEDOR]
- **[F7]** StampMe — https://www.stampme.com/blog/loyalty-programs-for-ice-cream-shops
  — *"Most customers visit ice cream shops weekly or monthly."* [BLOG de proveedor]
- **[F8]** MendoVoz, 12/08/2025 — https://www.mendovoz.com/relax/2025/8/12/el-top-diez-de-los-sabores-de-helado-mas-elegidos-durante-el-invierno-2025-159998.html
  — *"el 84% de los encuestados afirmó disfrutar de un buen helado durante los meses más fríos"*. [PRIMARIO vía prensa]
- **[F9]** ANDigital — https://andigital.com.ar/nota/128035/el-helado-argentino-rompio-definitivamente-la-estacionalidad-picos-de-10-kilos-per-capita/
  — *"El consumo promedio anual per cápita es de 7,3 kilos, con picos de 10 kilos en temporada alta."*; *"nueve de cada diez personas lo consumen todo el año."* [PRIMARIO vía prensa]
- **[F10]** BusinessDojo — https://dojobusiness.com/blogs/news/ice-cream-shop-visitors-profitability
  — *"15-25% of total traffic, generating 35-45% of revenue"* (regulares semanales); *"Many successful shops achieve 60-70% repeat customer rates during peak season"*. [BLOG, sin fuente]
- **[F11]** El Cronista, 04/07/2023 — https://www.cronista.com/pyme/negocios-pyme/cual-es-el-secreto-de-las-heladerias-para-sobrevivir-al-invierno-y-seguir-creciendo-en-facturacion/
  — *"el área de cafetería representa el 35% de la facturación promedio. Pero en invierno alcanza el 50%"* (Chungo). [dato de empresa]
- **[F12]** Placer.ai — https://www.placer.ai/anchor/articles/frozen-delights-exploring-ice-cream-chains-across-america
  — *"May foot traffic more than 300% higher than that seen in January"* (Dairy Queen, NY). [PRIMARIO, movilidad EE.UU.]
- **[F13]** Simulalo — https://simulalo.app/es/simulador/food/heladerias-estacional
  — *"Típicamente 55–75% vs meses pico. El mes valle suele ser febrero (HN) o julio-agosto (HS) con ventas al 25–40% del promedio anual."* [BLOG/simulador, sin fuente]
- **[F14]** AFADHYA, informe de prensa verano 2023 (PDF, no leído) — https://www.afadhya.com.ar/wp-content/uploads/2023/05/23.03.01-Informe-para-prensa-verano-2023.pdf

Nota: las citas se obtuvieron con un extractor automático de páginas (WebFetch); son textuales según esa
herramienta pero conviene re-verificarlas antes de pasarlas a una spec o a un mensaje al owner.
