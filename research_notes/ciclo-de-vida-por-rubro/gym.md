# Ciclo de vida del cliente — Gimnasio (`gcid:gym`)

Investigacion: 2026-09-29. Presupuesto usado: ~17 busquedas/fetches. Condicion de corte alcanzada:
4 numeros independientes y citados para el intervalo de visita.

**Aclaracion de dominio:** en un gimnasio la «visita» es la asistencia (check-in). La cuota se
paga aparte y casi toda la literatura mide la **baja de la membresia** (cancelacion/impago), no la
inasistencia. Donde un estudio mide baja de cuota y no asistencia, se marca. Lo que nos importa
para el motor es la asistencia; la baja de cuota se usa como consecuencia tardia de la inasistencia.

Leyenda: **[P]** = dato primario (estudio con muestra o datos de asociacion/proveedor con muestra).
**[B]** = opinion de blog / proveedor sin muestra declarada.

---

## 1) Intervalo de visita

| # | Dato | Intervalo implicito | Tipo |
|---|------|---------------------|------|
| 1 | EE.UU. 2018: socios usan el club **104 dias al año** (HFA/IHRSA) | ~3,5 dias entre visitas (socio que sigue activo) | [P] |
| 2 | Reino Unido, TRP 10,000 (10.000 socios, 2013–2015): **4,1 visitas por mes** en el primer año | ~7,3 dias entre visitas (socio promedio, incluye a los que se van apagando) | [P] |
| 3 | Portugal, 5.209 socios de un gimnasio: **0,89 (±0,76) visitas por semana** | ~7,9 dias entre visitas (poblacion con 87,7% de bajas) | [P] (ver nota) |
| 4 | Turquia, Mars Athletic Club (>100 sedes, 2022–2023): el habito se forma con **~2 visitas por semana**; hacen falta **≥9 visitas en 6 semanas** | ~3,5 dias para el socio que se habitua | [P] |
| 5 | TRP 10,000: **~30% no va ni una vez** en cada uno de los 3 primeros meses; **>50% al mes 12** | — distribucion: una parte grande de la base ya esta «dormida» | [P] |
| 6 | MAC: el **50% de los huecos intermedios dura una semana** | una semana sin ir es NORMAL, no señal de fuga | [P] |

**Lectura:**
- **Cliente habitual:** 2–3 visitas por semana → **intervalo ~3–4 dias** (datos 1 y 4). Confianza alta.
- **Cliente promedio:** ~1 visita por semana → **intervalo ~7–8 dias** (datos 2 y 3). Confianza media-alta.
- **Distribucion:** muy sesgada. Un tercio o mas de la base no asiste en un mes dado (dato 5), y
  una semana de ausencia es el hueco mas comun entre socios que siguen (dato 6).

Nota sobre el dato 3: el articulo tiene una inconsistencia — la tabla dice «Average number of visits
per week» pero el texto dice «per month». Se toma la tabla (semanal); el valor es plausible solo como
semanal y coincide con TRP.

## 2) Definiciones de la industria (riesgo / inactivo / perdido)

- **Estudio Portugal [P]:** la variable mas predictiva de la baja es **dias sin asistir**
  («non-attendance days»), con 35–54% de la importancia en los modelos de arbol. El arbol de decision
  corta en **>7,5 dias sin asistir** (junto con monto facturado bajo y edad ≤42,5) para el perfil de
  mayor abandono. Define la baja como aviso de cancelacion o **impago de hasta 60 dias**.
- **TRP 10,000 [P]:** el umbral que usa es **mensual**: cada mes con al menos una visita reduce el
  riesgo de cancelacion un 20% (27% en los primeros 6 meses) vs. no asistir. Implica: **un mes
  calendario entero sin asistir = riesgo**.
- **MAC Turquia [P]:** el estudio tolera **una semana de ausencia** sin cortar la racha; el uso de
  huecos **aumenta al acercarse el fin de la racha** (señal previa a la baja).
- **Glofox (proveedor) [B]:** ejemplo de automatizacion: «a member who hasn't visited in **10 days**
  gets a re-engagement nudge». Y la prediccion marca riesgo «30–60 days in advance».
- **Sperandei et al., Rio de Janeiro [P, LatAm]:** de los que se dan de baja (de la cuota), **el 22%
  vuelve dentro del primer mes** y despues la probabilidad acumulada extra es **~16% en los 11 meses
  siguientes** (38% total a 12 meses). Es la unica fuente que da la curva de «recuperabilidad» en el tiempo.

**No se encontro** una definicion publicada y numerica de Mindbody ni de ABC Fitness para
«at risk / lapsed / lost» en dias (ver §6).

## 3) Retencion

- **HFA 2025 Benchmarking [P]:** retencion anual promedio **66,4%** (175 empresas, >17.000 sedes, 27 paises).
- **Sperandei 2016, Rio de Janeiro [P, LatAm]:** **63%** de los nuevos socios abandona **antes del
  tercer mes**; **<4%** sigue mas de 12 meses continuos (5.240 socios, 2005–2014).
- **MAC Turquia [P]:** ~**50%** no mantiene la racha a las **6 semanas**; **80%** la corta a la **semana 17**.
- **TRP 10,000 [P]:** **45%** cancelo en los ~2 años de seguimiento.
- **Portugal [P]:** 87,7% de bajas en la ventana del estudio (solo 12,3% activos).

## 4) Particularidades del rubro

- **Asistencia ≠ pago.** El socio puede seguir pagando sin ir («ghost member»); la baja de cuota es un
  evento TARDIO de la inasistencia. El motor mide asistencia: bien. Pero implica que a los 30–60 dias
  sin ir, muchos aun pagan → el mensaje «Perdido» puede llegar a alguien que todavia es socio.
- **Los primeros 90 dias son el grueso de la fuga** (63% en Rio antes del mes 3; 50% a las 6 semanas
  en Turquia). Un socio nuevo con 7 dias sin ir es mucho mas riesgoso que un veterano.
- **Estacionalidad Argentina [P, encuesta a ~275 operadores, Mercado Fitness]:** desempeño negativo de
  28,57% en enero y 29,79% en febrero, 15,49% en marzo; marzo es «el inicio de la temporada alta».
  → Un socio que deja en diciembre/enero **vuelve en marzo** con frecuencia: el plazo hasta
  «Irrecuperable» tiene que cubrir un verano entero (~90–100 dias).
- **Urgencia temprana (Sperandei 2019):** «the longer they are away ... the less likely they are to
  return»; mas de la mitad de las vueltas ocurren en el primer mes. Justifica concentrar mensajes en
  los primeros ~45 dias y espaciarlos despues.
- **Las semanas de ausencia sueltas son normales** (MAC): un «Te extrañamos» a los 7 dias exactos le
  pega a mucha gente que iba a volver igual.

## 5) Escalera propuesta (dias desde la ultima asistencia)

| Etapa | Valor | Mensajes (dia) | Confianza |
|---|---|---|---|
| Te extrañamos — opcion A (habituales, 2–3/sem) | **8** | 8, 16 (cadencia 8) | media |
| Te extrañamos — opcion B (1/sem o clases semanales) | **14** | 14 | media |
| En riesgo (R), cadencia X | **R = 21, X = 10** | 21, 31, 41 | media-baja |
| Perdido (P) | **P = 45** | 46, 60, 106, 136 | baja |
| Irrecuperable | **~181** | — | baja |

**Justificacion:**
- **Te extrañamos 8:** el socio habitual va cada ~3–4 dias; 8 dias son 2–3 sesiones perdidas. El arbol
  del estudio portugues corta justo en >7,5 dias sin asistir. Se evita 7 porque una semana de hueco es
  el hueco mas comun entre socios que siguen (MAC) — con 8 dejamos pasar la semana normal. Confianza media.
- **Te extrañamos 14:** para el socio promedio (~1 visita/semana, TRP y Portugal), 14 dias son 2
  intervalos seguidos sin ir. Coincide con la practica (Glofox automatiza a los 10 dias; blogs 7–14). Confianza media.
- **R = 21:** tres semanas sin ir = 3 intervalos del socio promedio, 5–6 del habitual. Deja margen para
  mandar el mensaje antes del umbral mensual de TRP (un mes sin ir = riesgo real de cancelar) y dentro
  del mes en que se concentra la vuelta (Sperandei: 22% de los que cortan vuelve en el 1er mes).
  **X = 10**: 3 mensajes (21, 31, 41) antes de P; cadencia apenas mayor al 8 de la opcion A para no
  saturar. X es juicio propio, sin dato directo. Confianza media-baja.
- **P = 45:** a los 45 dias el socio perdio al menos un ciclo de cuota mensual entero sin ir, esta a
  mitad de la ventana de «impago de hasta 60 dias» que el estudio portugues usa como baja, y ya salio
  del primer mes donde se concentra la vuelta (Sperandei: despues del mes 1 solo ~16% adicional vuelve
  en 11 meses). Confianza baja (no hay fuente que diga «perdido = 45 dias»).
- **Mensajes de Perdido 46 / 60 / 106 / 136** (P+1, +14, +60, +90 desde el primero, igual que el
  patron del cafe): 60 coincide con el corte de impago del estudio portugues; 106 y 136 caen ~3,5 y
  ~4,5 meses despues de la ultima visita, que es el rango en el que un socio que corto en diciembre
  vuelve en marzo (estacionalidad AR). Confianza baja.
- **Irrecuperable ~181:** seis meses; cubre un verano argentino completo y el arranque de temporada
  (marzo). Sperandei muestra que despues del mes 1 las vueltas siguen goteando (~1,5 puntos/mes) hasta
  los 12 meses, asi que 181 es conservador en cuanto a no molestar, no un punto donde la vuelta sea
  cero. Confianza baja.

**Diferencia con la cafeteria:** el gimnasio arranca **antes** en «En riesgo» (21 vs 30) y en «Perdido»
(45 vs 90) porque la frecuencia esperada es mayor (2–3/sem) y la curva de abandono es muy temprana
(63% antes del mes 3). El «Irrecuperable» se mantiene en ~181 por la estacionalidad de verano.

**Recomendacion extra (fuera de la escalera):** si el motor supiera la antiguedad del socio, un socio
con <90 dias de alta deberia entrar a «Te extrañamos» con la opcion A (8) sin importar lo que eligio
el comercio: es donde esta el grueso de la fuga.

## 6) Lo que no se encontro

- **Mindbody y ABC Fitness:** no se encontro una definicion publicada en dias de «at risk / lapsed /
  lost». La cifra atribuida a ABC que aparece en Glofox («Members who visit 4+ times a month stay 7
  months longer») se vio solo citada en segunda mano; no se abrio la fuente original de ABC.
- **Mediana del intervalo entre visitas** (no promedio) con distribucion: ningun estudio la publica;
  todo es promedio de visitas por semana/mes/año.
- **Datos de asistencia de Argentina:** no hay; solo la encuesta de operadores (usuarios y rentabilidad,
  no frecuencia). El unico dato primario LatAm con asistencia/baja es Rio de Janeiro (Sperandei).
- **HFA 2024 «1,5 visitas/semana, bajando de 2,1 en 2019»:** aparecio en un resumen de buscador sin
  fuente abierta; NO se usa.
- **Cadencias de mensaje probadas (A/B)** para gimnasios: nada con datos. X y los dias de Perdido son juicio.
- **Estudio Frontiers (389.481 usuarios, mediana de abandono 19 semanas)** es sobre una **app** de
  entrenamiento, no gimnasio; se deja afuera de los numeros.

## 7) Fuentes (URL + cita textual)

1. **HFA / IHRSA 2018 [P]** — https://www.healthandfitness.org/latest-ihrsa-data-over-6b-visits-to-39-570-gyms-in-2018/
   > «More than 62 million health club members use a club or studio for an average of 104 days a year»
2. **TRP 10,000 (Hillsdon / The Retention People), Health Club Management [P]** — https://www.healthclubmanagement.co.uk/health-club-management-features/Retention-It-all-adds-up/30296
   > «During the first 12 months of their membership, TRP 10,000 members used their clubs an average of 4.1 times each month.»
   > «Each month a member makes at least one visit to their club, their likelihood of cancellation reduces by 20 per cent compared to members who don't attend at all.»
   > «Making at least one visit in a month reduces the risk of cancelling in the next month by 27 per cent.»
   > «During the follow-up period, 45 per cent of participating members cancelled their membership»
   (El ~30% que no va en cada uno de los 3 primeros meses y >50% al mes 12 viene del mismo articulo, en resumen del fetch, no en cita literal.)
3. **Predicting Fitness Centre Dropout (Portugal), PMC [P]** — https://pmc.ncbi.nlm.nih.gov/articles/PMC8508547/
   > Tabla: «Average number of visits per week» — «Mean (SD) 0.89 (0.76)»
   > «members that have lower 'tbilled' ≤ 365.025, 'dayswfreq' > 7.5, and age ≤ 42.5 to represent 1244 members that dropped and 30 that did not.»
   > Definicion de baja: «When the member gave notice of an intention to terminate the contract or did not pay the monthly fee within a period of up to 60 days.»
   > Importancia de «dayswfreq»: 54.21% (arbol), 43.29% (random forest), 35% (gradient boosting).
4. **From Occasional to Steady: Habit Formation Insights (Mars Athletic Club, Turquia), arXiv [P]** — https://arxiv.org/html/2501.01779
   > «at least nine visits» (en las 6 semanas); «roughly two visits per week»
   > «Approximately 50% of members did not maintain their attendance streak at the 6-week point.»
   > «80% of the member population failed to maintain their streak» (semana 17)
   > «50% of all intermediate gaps being one week long»; «gap usage seems to increase as they approach the end of their survival streak, indicating a higher likelihood of churn.»
5. **Sperandei, Vieira, Reis 2016 (Rio de Janeiro), J Sci Med Sport [P, LatAm]** — https://www.sciencedirect.com/science/article/abs/pii/S1440244016000062 (resumen via busqueda; el abstract textual no se pudo abrir: bvsalud dio 403)
   > «The general survival curve shows that 63% of new members will abandon activities before the third month, and less than 4% will remain for more than 12 months of continuous activity.» (texto del abstract segun el resumen del buscador; cita no verificada en la pagina)
6. **Sperandei et al. 2019, Athens Journal of Sports (misma base, Rio) [P, LatAm]** — https://www.athensjournals.gr/sports/2019-6-2-3-Sperandei.pdf
   > «The general survival curve shows that 38% of members who drop out will return to activities within 12 months. Of those who return, more than half return within the first month.»
   > «Of those who return, more than half (22%) return within the first month after cessation, which means that after the first month the probability of an individual returning is approximately only 16%.»
   > «the longer they are away from their spaces of practice the less likely they are to return.»
7. **HFA 2025 Fitness Industry Benchmarking Report [P]** — https://www.healthandfitness.org/hfa-releases-2025-fitness-industry-benchmarking-report/
   > «Member retention averaged 66.4% for the year.»
   > «Data from 175 companies representing more than 17,000 fitness facilities across 27 countries, which were surveyed between April and June 2025.»
8. **Mercado Fitness, encuesta a ~275 operadores argentinos [P, AR, encuesta a dueños]** — https://mercadofitness.com/gimnasios-argentina-crecieron-usuarios-marzo-2026/
   > «El desempeño negativo fue de 28,57% en enero, 29,79% en febrero y 15,49% en marzo, marcando un punto de inflexión con el regreso de usuarios tras la estacionalidad del verano.»
   > «Durante marzo, considerado el inicio de la temporada alta, el 65,38% de los gimnasios aumentó su padrón de usuarios.»
9. **Glofox (proveedor de software) [B]** — https://www.glofox.com/blog/gym-member-retention-strategies/
   > «a member who hasn't visited in 10 days gets a re-engagement nudge»
   > «flag churn risk 30–60 days in advance, based on signals like reduced app activity or missed bookings»
