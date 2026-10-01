# Ciclo de vida del cliente — Farmacia (`gcid:pharmacy`)

Investigacion: 2026-09-29. Presupuesto usado: ~20 busquedas/fetches. Condicion de corte alcanzada
(4 numeros independientes para el intervalo de visita, 2 de ellos primarios verificados).

Leyenda de fuente: **[PRIMARIO]** = estudio con muestra/metodo declarado; **[ENCUESTA-PROV]** =
encuesta de un proveedor/industria sin muestra publicada; **[BLOG]** = opinion o guia de proveedor
sin datos; **[SNIPPET]** = la cita viene del resumen del buscador, no pude abrir la pagina (no
verificada textualmente, tratar como tal).

---

## 1) Intervalo de visita

| # | Dato | Intervalo implicito | Tipo | Fuente |
|---|------|--------------------|------|--------|
| A | Mediana **13 visitas/año** a farmacia comunitaria (IQR 9–17), 681.456 beneficiarios Medicare, 2016 | mediana **~28 dias**; IQR ≈ **21–41 dias** | [PRIMARIO] | JAMA Netw Open 2020 (F1) |
| B | «Patients visit a pharmacy an average 35 times per year» | promedio **~10 dias** | [ENCUESTA-PROV] AmerisourceBergen, muestra no publicada | Drug Topics (F2) |
| C | «El 67% de la población, visita la farmacia mínimo una vez al mes» (España) | 2/3 de la poblacion con intervalo **≤30 dias** | [ENCUESTA-PROV] Boehringer Ingelheim, sin muestra | IM Farmacias (F3) |
| D | «58% of drug store shoppers visit two-to-three times monthly» (EE.UU., cadenas) | **~10–15 dias** | [SNIPPET] atribuido a Nielsen/Cardinal Health 2023; el PDF no abrio | Cardinal Health (F4) |

Lectura:
- **Cliente habitual con receta cronica: ~28 dias** (dato A, el unico con muestra y metodo). Coincide
  con el ciclo de dispensa de 30 dias. Ojo con el metodo de A: «Unique visits to the community
  pharmacy were defined using a 13-day window between individual prescription drug claims» — dos
  retiros a menos de 13 dias cuentan como una visita, asi que A **subestima** la frecuencia real y
  no cuenta compras sin receta (perfumeria/OTC). Poblacion: mayores (edad media 72).
- **Cliente que ademas compra perfumeria/OTC: ~10–15 dias** (B y D). Ambos son encuestas sin
  muestra publicada; confianza media-baja.
- **Distribucion:** solo A la da: p25 ≈ 9 visitas/año (~41 dias), p75 ≈ 17/año (~21 dias). Rural
  14 [10–17], metropolitano 13 [8–17].
- **Argentina/LatAm:** no encontre dato de frecuencia de visita (ver §6).

## 2) Definiciones de la industria (riesgo / inactivo / perdido)

No hay una definicion estandar de «cliente perdido» para farmacia en POS/CRM. Lo que hay:

- **Programas de fidelizacion de farmacia [BLOG]:** Perkstar (UK, farmacia independiente):
  «A lapsed-customer automation triggers after 28 days of no activity.» (F5) — o sea, **lapso = 28
  dias**, un ciclo de receta.
- **Guia generica de fidelizacion [BLOG, no especifica de farmacia]** (F6): para negocios de alta
  frecuencia «A member who hasn't returned in 21-30 days is showing early signs of lapse. By 45 days,
  they are definitely lapsed.»; para cadencia mensual «60-90 days has missed at least one full
  cycle»; y archivar tras «3 unsuccessful attempts over approximately 6 months».
- **Definicion clinica de abandono (la mas solida, es la que usa la farmacoepidemiologia) [PRIMARIO]:**
  - Discontinuacion = «first 90 day gap after the estimated end date of a statin prescription»
    (CPRD UK, 431.023 + 139.314 pacientes) (F7). Con receta de 30 dias: ultima visita + 30 de
    cobertura + 90 de hueco ≈ **dia 120**.
  - Otras variantes citadas en la busqueda [SNIPPET] (F8): hueco de **60 dias** (Medicare post-IAM,
    AHA), **90 dias** (varios), **180 dias** (Escocia, la definicion «estricta»), y «Prior studies
    have required 15- to 360-day treatment gaps».
  - Adherencia: PDC ≥ 80% = adherente (Pharmacy Quality Alliance) [SNIPPET] (F9). Con 30 dias de
    suministro, 80% ≈ tolerancia de **~6 dias de atraso por ciclo**.

## 3) Retencion / abandono

- **Abandono de tratamiento cronico en Argentina [PRIMARIO citado por prensa]:** ENSAT (Rev. Fed.
  Arg. Cardiologia): «el 52% de los pacientes abandonaban el tratamiento antes del año»; SAHA: «una de
  cada dos personas que se enteran de que son hipertensas está abandonando el tratamiento antes de
  los seis meses» (Intramed/La Nacion 2013) (F10). Dato viejo (~2005 el ENSAT).
- **Pero vuelven [PRIMARIO]:** en estatinas, «47% ... discontinued treatment and 72% ... of those who
  discontinued restarted» (prevencion primaria); en secundaria 41% discontinuo y 75% reinicio (F7).
  Implicancia: un «perdido» de farmacia tiene alta probabilidad de volver a necesitar el producto —
  el ultimo mensaje de Perdido vale mas que en un cafe. Limite: el estudio no dice si reinicia en la
  **misma** farmacia.
- **Primer retiro [SNIPPET]:** IQVIA: «in 2019, 9% of new prescriptions were abandoned at retail
  pharmacies» (F11). No es retencion de cliente sino de receta.
- **Repeticion de compra en la farmacia:** Acosta 2023 (1.100 compradores EE.UU.) [ENCUESTA-PROV]:
  entre quienes van por receta, «66% are shopping for other products», y los compradores asignan
  «nearly 70% of their total prescription expenses and 50% of their personal/O-T-C expenditures
  within the drug store setting» (F12). La receta es el motor del viaje; la perfumeria se «cuelga».
- **Win-back [BLOG]:** «A well-timed, staged sequence brings back 15-25% of lapsed members» y «After
  2-3 failed re-engagement attempts, the probability drops below 5%» (F6). Sin muestra.
- **No encontre** % que vuelve por segunda vez ni retencion a 90 dias medida sobre clientes de
  farmacia (no sobre pacientes).

## 4) Particularidades del rubro

1. **Reloj externo de 30 dias.** El cronico vuelve porque se le acaba la caja, no por gusto. La etapa
   debe medirse contra ese reloj: una ausencia de 20 dias es normal; de 40 ya es un ciclo salteado.
2. **Dos poblaciones mezcladas en el mismo comercio:** (a) cronicos, cadencia ~28–30 dias; (b)
   agudos/perfumeria, que solo vienen cuando se enferman o necesitan algo — su ausencia larga NO es
   abandono. Un motor unico por «dias desde ultima visita» va a mandar al (b) a «Perdido» aunque sea
   fiel. Hallazgo a decidir, no resuelto por la escalera.
3. **Estacionalidad Argentina [SNIPPET, COFA/IQVIA, pagina bloqueada por geo-IP]:** el mercado etico
   tiene un minimo en **febrero** (~37M unidades) y un maximo en **abril** (43,2M); el total se mueve
   entre 52 y 60M unidades/mes, con crecimiento marzo–mayo; los antigripales suben en invierno (F13).
   Implicancia: un «perdido» de verano puede ser vacaciones; el invierno es la ventana natural del
   ultimo mensaje de win-back para clientes agudos.
4. **Sensibilidad del dato:** el motor no debe mencionar la medicacion en el push (dato de salud).
   No investigado a fondo; lo dejo como alerta.
5. **Recetas de mas de 30 dias** (suministro 60/90) estirarian todo. No encontre datos de su
   prevalencia en Argentina.

## 5) Escalera propuesta

| Etapa | Valor | Justificacion | Confianza |
|---|---|---|---|
| Te extrañamos — opcion A (farmacia con mucha perfumeria/OTC) | **21 dias** | p75 de frecuencia de A = ~21 dias; B y D sugieren 10–15 dias en compradores de front-end; F6 «21-30 days … early signs of lapse» | media |
| Te extrañamos — opcion B (farmacia de receta cronica, **default**) | **35 dias** | ciclo de 30 dias (mediana A ~28) + ~5–6 dias de tolerancia (PDC 80% ≈ 6 dias/ciclo). Perkstar dispara a 28; 35 evita escribirle al que simplemente viene el dia 31 | media-alta |
| En riesgo — arranque R | **45 dias** | un ciclo entero salteado (1,5 × 30); p25 de A ≈ 41 dias; F6 «By 45 days, they are definitely lapsed» (blog) | media |
| En riesgo — cadencia X | **cada 15 dias** (45, 60, 75) | medio ciclo de dispensa: cada mensaje cae cerca de una «fecha de caja vacia»; el 60 coincide con la definicion de discontinuacion de 60 dias (F8) | baja-media |
| Perdido — arranque P | **90 dias** | tres ciclos sin retirar = hueco de ≥60 dias tras agotar la ultima caja; entre las definiciones de 60 y 90 dias de discontinuacion (F7, F8) | media |
| Perdido — 4 mensajes | **91, 105, 135, 180** | 91 = P+1; 105 = +14 (misma logica del cafe); 135 = 3 meses de hueco post-caja (= definicion de 90 dias de F7 medida desde dia 30+90≈120, con margen); 180 = definicion «estricta» de 180 dias (F8) y ~6 meses de F6. Se sostiene un ultimo intento tardio porque 72–75% de los que discontinuan reinician (F7) | baja-media |
| Irrecuperable | **dia 181** (tras el 4.º mensaje) | 6 meses sin visita supera la definicion clinica mas estricta citada (180 dias) y F6 recomienda archivar tras ~6 meses | baja-media |

Comparada con el cafe (7/14 · 30 c/21 · 90 · 181), la farmacia arranca mas tarde (su ritmo natural
es mensual, no semanal) y aprieta la cadencia de «En riesgo» (15 en vez de 21) porque cada mes
salteado es una caja que se compro en otro lado. El final (90/181) coincide con el del cafe, pero
por un motivo distinto: las definiciones clinicas de abandono (60–180 dias).

## 6) Lo que no se encontro

- **Frecuencia de visita a farmacia en Argentina/LatAm** (Farmacity, COFA, IQVIA Argentina): nada
  publicado con frecuencia por cliente. El PDF de IQVIA Argentina «Dinamica de consumo de
  medicamentos» se bajo pero no pude extraer texto (sin herramienta de PDF); el observatorio COFA
  bloquea por geo-IP.
- **Definicion en dias de «cliente en riesgo/perdido» de un POS/CRM de farmacia con datos** (no blog).
- **% que vuelve por segunda vez y retencion a 90 dias de clientes** (no pacientes) de farmacia.
- **Tasa de win-back medida en farmacia.**
- **Prevalencia de recetas de 60/90 dias en Argentina** (PAMI/obras sociales).
- El dato D (58% va 2–3 veces por mes) no pudo verificarse textualmente: el PDF de Cardinal Health
  no cargo (timeout).

## 7) Fuentes

- **F1 [PRIMARIO]** Evaluation of Frequency of Encounters With Primary Care Physicians vs Visits to
  Community Pharmacies Among Medicare Beneficiaries, JAMA Netw Open 2020 —
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7364370/ (abstract leido via Europe PMC) — «Visits to the
  community pharmacy outnumbered encounters with primary care physicians (median [interquartile range
  (IQR)], 13 [9-17] vs 7 [4-14]; P < .001)»; «(n = 681 456)»; «Unique visits to the community pharmacy
  were defined using a 13-day window between individual prescription drug claims»; «rural areas
  (median [IQR], 14 [10-17] …) than in metropolitan areas (median [IQR], 13 [8-17] …)».
- **F2 [ENCUESTA-PROV]** Drug Topics, Pharmacists Want More Time with Patients —
  https://www.drugtopics.com/view/pharmacists-want-more-time-patients — «Patients visit a pharmacy an
  average 35 times per year compared to just four visits to see medical providers.» (encuesta
  Pharmacy Check-Up, AmerisourceBergen; muestra no publicada).
- **F3 [ENCUESTA-PROV]** IM Farmacias — https://www.imfarmacias.es/noticia/33474/cerca-del-70-de-los-pacientes-visitan-la-farmacia-una-vez-al-mes-de-m.html
  — «El 67% de la población, visita la farmacia mínimo una vez al mes» (Boehringer Ingelheim, España).
- **F4 [SNIPPET]** Cardinal Health / Nielsen 2023 —
  https://www.cardinalhealth.com/content/dam/corp/web/documents/literature/cardinal-health-market-trends-impacting-independent-drug-retailers.pdf
  — «58% of drug store shoppers visit two-to-three times monthly» (texto del buscador; no verificado).
- **F5 [BLOG]** Perkstar — https://perkstar.co.uk/blog/pharmacy-loyalty-program-guide — «A
  lapsed-customer automation triggers after 28 days of no activity.»
- **F6 [BLOG, generico]** LoyaltyPass — https://www.loyaltypass.co/blog/guide/how-to-re-engage-lapsed-loyalty-customers
  — «A member who hasn't returned in 21-30 days is showing early signs of lapse. By 45 days, they are
  definitely lapsed.»; «A well-timed, staged sequence brings back 15-25% of lapsed members»; «After
  2-3 failed re-engagement attempts, the probability drops below 5%».
- **F7 [PRIMARIO]** Discontinuation and restarting in patients on statin treatment (BMJ 2016, CPRD) —
  https://pubmed.ncbi.nlm.nih.gov/27353261/ (abstract via Europe PMC) — «Discontinuation of statin
  treatment (first 90 day gap after the estimated end date of a statin prescription)»; «47% (n=204 622)
  discontinued treatment and 72% (n=147 305) of those who discontinued restarted»; secundaria «41% …
  discontinued treatment and 75% (43 211) of those who discontinued restarted».
- **F8 [SNIPPET]** definiciones de discontinuacion — https://www.ahajournals.org/doi/10.1161/circoutcomes.117.003626
  (60 dias: «60-day continuous period with no statin supply»),
  https://academic.oup.com/eurheartj/article/41/Supplement_2/ehaa946.3509/6002709 (180 dias: «first
  statin treatment gap of 180 days or more»), y «Prior studies have required 15- to 360-day treatment
  gaps» (https://pmc.ncbi.nlm.nih.gov/articles/PMC8204202/). Citas del resumen del buscador.
- **F9 [SNIPPET]** PDC — https://www.researchgate.net/publication/355210136_Proportion_of_days_covered_as_a_measure_of_medication_adherence
  — «The Pharmacy Quality Alliance has suggested that the benchmark for adherence, a PDC of 80%…».
- **F10 [PRIMARIO citado por prensa]** Intramed — https://www.intramed.net/content/hipertension-la-mitad-de-los-pacientes-abandona-el-tratamiento
  — «una de cada dos personas que se enteran de que son hipertensas está abandonando el tratamiento
  antes de los seis meses»; «el 52% de los pacientes abandonaban el tratamiento antes del año» (ENSAT).
- **F11 [SNIPPET]** Pleio / IQVIA — https://www.pleio.com/blog/prescription-abandonment-statistics/
  — «in 2019, 9% of new prescriptions were abandoned at retail pharmacies».
- **F12 [ENCUESTA-PROV]** Chain Drug Review, Acosta 2023 — https://chaindrugreview.com/scripts-drive-trips-new-insights-inform-growth-strategies/
  — «66% are shopping for other products»; «nearly 70% of their total prescription expenses and 50% of
  their personal/O-T-C expenditures within the drug store setting».
- **F13 [SNIPPET]** Observatorio COFA / IQVIA Argentina —
  https://observatorio.cofa.org.ar/index.php/2025/11/14/evolucion-del-mercado-de-productos-estacionales-de-invierno/
  y https://www.iqvia.com/-/media/iqvia/pdfs/argentina/presentation/dinmica-de-consumo-de-medicamentos-en-el-mercado-farmacutico-argentino.pdf
  — mercado etico con minimo de 37M unidades en febrero y maximo de 43,2M en abril; total 52–60M
  unidades/mes (resumen del buscador; COFA bloquea por geo-IP y el PDF no se pudo leer).
