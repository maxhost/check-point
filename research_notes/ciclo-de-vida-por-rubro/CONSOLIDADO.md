# Escalera de reactivacion por rubro — consolidado (2026-09-29)

Insumo para el ADR/spec de «etapas de ciclo de vida» (ver `docs/TASKS.md`, seccion MARKETING — ETAPAS).
Un informe por rubro en esta carpeta, escrito por un agente de investigacion cada uno. **Este archivo es
del orquestador**: la regla de derivacion es suya y las fuentes marcadas «verificada» las abrio el
orquestador (via WebFetch, que resume la pagina: la cita es la del resumidor, no un copy-paste propio).

## Como se carga (decision del owner, 2026-09-29)

**La tabla se carga A MANO, fila por fila; no hay formula.** El orquestador habia propuesto derivar la
cadencia de «En riesgo» (`0,7 × R`) y los mensajes de Perdido (14/60/90 escalados por `P/90`), y el
owner observo que la formula no reproducia la tabla: era cierto — `0,7 × 45` redondea a 31 y la tabla
decia 32 (77/109 en vez de 76/107), un error de cuenta del orquestador presentado como derivado.
Los valores de abajo son los definitivos, cada uno editable por separado.

## Tabla (dias desde la ultima visita)

| Rubro | T1 / T2 | En riesgo (R, X → mensajes) | Perdido (P → mensajes) | Irrecup. | Confianza |
|---|---|---|---|---|---|
| Cafeteria | 7 / 14 | 30, 21 → 30, 51, 72 | 90 → 91, 105, 151, 181 | 181 | media |
| Panaderia | 8 / 15 | 30, 21 → 30, 51 | 60 → 61, 70, 101, 121 | 121 | baja-media |
| Almacen | 7 / 14 | 30, 21 → 30, 51 | 60 → 61, 70, 101, 121 | 121 | baja-media |
| Restaurante | 14 / 30 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | media |
| Pizzeria | 14 / 21 | 30, 21 → 30, 51, 72 | 90 → 91, 105, 151, 181 | 181 | media |
| Bar | 14 / 21 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | baja |
| Heladeria | 10 / 21 | 45, 32 → 45, 77, 109 | 120 → 121, 140, 201, 241 | 241 | baja |
| Salon de belleza | 45 / 60 | 90, 63 → 90, 153 | 180 → 181, 209, 301, 361 | 361 | media |
| Barberia | 35 / 49 | 84, 59 → 84 | 120 → 121, 140, 201, 241 | 241 | media |
| Salon de unas | 21 / 28 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | media |
| Gimnasio | 8 / 14 | 21, 15 → 21, 36 | 45 → 46, 60, 120, 181 | 181 | media-baja |
| Farmacia | 21 / 35 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | baja-media |
| Tienda de ropa | 45 / 60 | 120, 84 → 120, 204 | 240 → 241, 278, 401, 481 | 481 | baja-media |
| Tienda de mascotas | 21 / 35 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | media |
| Lavado de autos | 21 / 30 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | media-baja |
| `gcid:store` (relleno) | 14 / 30 | 45, 32 → 45, 77 | 90 → 91, 105, 151, 181 | 181 | — (default) |

T1/T2, R y P son los de cada informe; donde el orquestador se aparto, se dice abajo. Los mensajes
internos de Perdido y la cadencia X los fijo el orquestador (los agentes los habian puesto a ojo, con
confianza «baja» en todos los rubros).

## Fuentes verificadas por el orquestador (2026-09-29)

| Rubro | Dato | Fuente | Estado |
|---|---|---|---|
| general | Toast «Miss You»: «Targets guests that have not visited in 30 days or more» | support.toasttab.com/en/article/Building-an-Automated-Email-Campaign | verificada |
| general | Toast: 1 automatico cada 28 d | support.toasttab.com/en/article/Toast-Marketing-FAQ | verificada |
| general | Square Lapsed = «were regulars, but haven't visited in the last six weeks» | squareup.com/help/us/en/article/6245 | verificada |
| restaurante | Paytronix: «churn is when a regular customer hasn't transacted in 90+ days» | paytronix.com/blog/customer-attrition-analysis | verificada |
| restaurante/bar | SevenRooms: «trigger the right message at 30, 60 or 90 days» | sevenrooms.com/platform/marketing-automation | verificada |
| pizzeria | Restolabs (4M+ pedidos, 479 marcas): mediana 8,9 d entre pedidos; 38,2% repite en 6 meses; 30+ d = «Churn risk» (todo delivery, no solo pizza) | restolabs.com/lp/online-ordering-report | verificada |
| salon | Boulevard (11M turnos, 30.000+ negocios): 45% 1a→2a visita, 39% 1a→3a (promedio) | salontoday.com (nota del reporte) | verificada |
| barberia | SQUIRE 2026 (9,79M turnos): «average time between visits is 48.5 days»; ~48% one-and-done | waitq.app/blog/barbershop-statistics (segunda mano) | verificada en la republicacion |
| unas | Zenoti: unas cada 2–4 semanas, recordatorio dia 18; 45–60 / 61–90 / 90+ / 180+ | zenoti.com/thecheckin/how-to-win-back-salon-clients | verificada |
| lavadero | DRB: «sweet spot … two to four times a month» | drb.com (learning library) | verificada |
| ropa | Kantar UK: fieles «five or more occasions», ocasionales «once or twice a year» | kantar.com/uki (2022 four pillars) | verificada |
| gimnasio | 5.209 socios (Portugal): dias sin asistir = mayor predictor, corte >7,5 d | pmc.ncbi.nlm.nih.gov/articles/PMC8508547 | verificada |
| mascotas | Italia: 64,4% tarda ≥4 semanas en una bolsa seca, 22,5% <2 semanas (n=1.446) | pmc.ncbi.nlm.nih.gov/articles/PMC7911149 | verificada |
| almacen | Kantar Colombia: «visita en promedio este canal cada 4 dias; es decir 91 veces en un año» (canal, no un almacen) | kantar.com/latin-america (2022) | verificada |
| panaderia | Puratos: 77% de argentinos consume pan diario o semanal; 67% compra en panaderias | mercado.com.ar | verificada |
| heladeria | AFADHYA: consumo verano 87%, otoño 78%, **invierno 75%**; «Nueve de cada diez … todo el año» | afadhya.com.ar/helado-artesanal | verificada — **contradice la premisa de estacionalidad fuerte** |
| farmacia | JAMA Netw Open 2020 Medicare: mediana 13 visitas/año | PMC7364370 | **NO verificada** (captcha) |

## Donde el orquestador se aparta de los informes

- **Cadencias y mensajes de Perdido**: los fijo el orquestador escalando la referencia del cafe (los de los
  agentes eran criterio propio, confianza baja). Cargados a mano, no por formula.
- **Gimnasio**: Irrecuperable llevado a 181 (mensajes de Perdido 46/60/120/181) para cubrir el verano
  (ene–feb temporada baja, vuelta en marzo). Owner: «si el problema es la cantidad de dias, ajusta los dias».
- **Heladeria**: el agente propuso pausar el reloj en invierno; el dato de AFADHYA verificado (75% consume
  en invierno) debilita esa premisa. **Owner: «no pausamos»**; se usa la version corta del agente (10/21, 45, 120).
- **Ropa**: el agente queria el ultimo mensaje al año (366) por la temporada; la tabla dice 401/481.
- **`gcid:store`**: sin informe; default del orquestador = el de restaurante/unas/farmacia (el mas comun).

## Hallazgo transversal (no se decide ahora)

Restaurante, barberia y farmacia recomiendan por su cuenta medir contra el ritmo PROPIO del cliente
(dos poblaciones muy distintas dentro del rubro). Es la opcion «C» que el owner dejo para despues.
