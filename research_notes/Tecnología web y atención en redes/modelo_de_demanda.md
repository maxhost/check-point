# Modelo de demanda de avisos de reactivación por consumidor en la red

> Notas de investigación (2026-09-29). **Todos los números del modelo salen de
> `modelo_de_demanda.py`** (misma carpeta; solo stdlib, semilla fija `20260929`, 3.000 consumidores
> simulados por escenario, ventana de 180 días tras 1.500 días de calentamiento; tarda ~4,5 min).
> Se corre con `python3 modelo_de_demanda.py`. Ningún número del modelo se hizo a mano.
> Insumos: la escalera de `research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md` y el contexto de
> `docs/red-y-atencion.md` (cupo de Google Wallet: 3 avisos/pase/24 h; 1 = timbre general → **2 para
> reactivación**; idea del owner de no mandar dos «te extrañamos» el mismo día → también se mide **cupo 1**).
>
> **Control independiente de la simulación:** la demanda media estacionaria tiene fórmula cerrada,
> `N · L · E[mensajes por episodio] / E[días hasta irrecuperable]` = `N · L · 9,07 / 196,6` con la mezcla base
> y T1. Da 0,046 / 0,092 / 0,138 (N=5), 0,092 / 0,185 / 0,277 (N=10) y 0,185 / 0,369 / 0,554 (N=20) para
> L = 20/40/60%; la simulación dio 0,05/0,09/0,14, 0,09/0,18/0,28 y 0,19/0,37/0,56. Coinciden.
> La cola de P(>2) también es coherente con una Poisson de la misma media (media 0,31 → P(>2) ≈ 0,4%; el
> script midió 0,4%).

## 1. Parámetros de comportamiento: ¿en cuántos comercios locales está un consumidor y cuántos deja por mes?

### Takeaway
No encontré ningún dato de Ecuador ni de LatAm sobre «cuántos comercios distintos visita una persona por
mes» ni sobre churn mensual de clientes regulares de comercios chicos. Lo más sólido es de movilidad y de
tarjetas (EE.UU./Europa): una persona mantiene ~25 lugares «familiares» de todo tipo y, en una muestra
filtrada de tarjetas, visita entre 10 y 50 comercios únicos por mes. La tasa de clientes que vienen una
sola vez está bien documentada (48–62% según el rubro). **El churn mensual de los regulares no tiene
fuente: es un SUPUESTO** (4%/mes en la base, sensibilidad de 2% a 8%).

### Cited Findings
- **~25 lugares familiares, cantidad que se conserva en el tiempo.** «the number of familiar locations an
  individual visits at any point is a conserved quantity with a typical size of ~25 locations»; ~40.000
  personas, 4 datasets, varios años. El conjunto evoluciona (entran lugares nuevos y salen otros), pero el
  tamaño se mantiene. Incluye TODO tipo de lugar (casa, trabajo, etc.), no solo comercios — [Alessandretti
  et al., Nature Human Behaviour 2018 / arXiv 1609.03526](https://arxiv.org/abs/1609.03526). Confianza:
  alta para el dato; baja como proxy de «comercios de la red».
- **Comercios únicos por tarjeta** (Krumme et al., «The predictability of consumer visitation patterns»):
  datos de un banco norteamericano (>50 M de cuentas, 6 meses, 2010–2011) y uno europeo (4 M de cuentas,
  11 meses). Filtraron a compradores con **entre 10 y 50 comercios únicos cada mes** y entre 50 y 120
  compras por mes. Mediana de comercios únicos: **64 en 6 meses** (p25/p75 46/87) en NA y **101 en 11
  meses** (69/131) en Europa. El comercio más frecuentado se lleva ~13% (NA) y ~22% (EU) de las visitas —
  [arXiv 1305.1120 (versión ar5iv)](https://ar5iv.labs.arxiv.org/html/1305.1120). Confianza: media (muestra
  filtrada; incluye comercios de todo tipo, no solo locales de barrio).
- **Programas de fidelidad:** el estadounidense promedio pertenece a 17,4 programas y está activo en 8,8
  (Bond 2025), y en el informe 2026 a más de 20 con ~11 activos — [Access Development, recopilación que
  cita a Bond](https://blog.accessdevelopment.com/the-ultimate-collection-of-loyalty-statistics).
  **No lo pude confirmar en la fuente primaria**: la nota de prensa de Bond que abrí
  ([bondbl.com](https://bondbl.com/news/the-bond-loyalty-report-returns-with-loyalty-decoded-revealing-why-loyalty-has-never-looked-stronger/))
  no trae esas cifras. Confianza: media-baja. Son programas de marcas y cadenas, no comercios de barrio.
- **Ecuador (Kantar Worldpanel 2025):** «los hogares ecuatorianos visitan entre 8 y 9 canales al año»; la
  frecuencia de compra baja y cada canasta es más completa — [Kantar, «El nuevo mapa del consumo en
  Ecuador»](https://www.kantar.com/latin-america/Inspiracion/Consumidor/2025/El-nuevo-mapa-del-consumo-en-Ecuador).
  Son **canales** (supermercado, tienda de barrio, farmacia…), no comercios: no sirve para fijar N.
- **Clientes que vienen una sola vez (one-and-done):**
  - Barbería: ~48% one-and-done (SQUIRE 2026, 9,79 M turnos; segunda mano, en `CONSOLIDADO.md`).
  - Salones: el promedio convierte 45% de las primeras visitas en una segunda y 39% en una tercera; los
    mejores, 70% y 57%. Son 11 M de turnos, 4 M de clientes y más de 30.000 negocios (ene-2022 a mar-2023) —
    [Salon Today sobre el informe de Boulevard](https://www.salontoday.com/articles/boulevard-report-reveals-top-performing-salons-retain-56-more-first-time-visitors-than-average).
    Es decir, ~55% no vuelve en el promedio.
  - Delivery/pizza: 38,2% repite en 6 meses → ~62% no repite (Restolabs, verificada en `CONSOLIDADO.md`).
  - Restaurantes: «60–70% de los primerizos no vuelve», atribuido a la National Restaurant Association 2023 —
    [regulr.ai](https://regulr.ai/for/restaurants). Es una página comercial que cita de segunda mano:
    confianza baja.
- **La frecuencia de visita varía mucho entre personas.** El número de visitantes a un lugar cae como
  1/(r·f)² (distancia × frecuencia): hay muchos visitantes esporádicos y pocos muy frecuentes — [Schläpfer
  et al., Nature 2021](https://www.nature.com/articles/s41586-021-03480-9). Respalda cualitativamente
  la variante «huecos» del modelo (los regulares a veces dejan pasar más de T días).
- **Definiciones de churn que usa la industria** (no son tasas): Paytronix, 90+ días sin transacción;
  Square «Lapsed», seis semanas (ambas verificadas en `CONSOLIDADO.md`).

### Inferences
- **Parámetros usados en el script** (fuente o SUPUESTO):

  | Parámetro | Base | Sensibilidad | Origen |
  |---|---|---|---|
  | N = membresías vivas en la red (no irrecuperables) | 5 / 10 / 20 | — | Escenarios del encargo. 20 es un techo alto: equivale a una parte grande de los ~25 lugares familiares de Alessandretti y de los 10–50 comercios/mes de Krumme. |
  | p1 = share de altas one-and-done | 0,5 | 0,4 / 0,6 | Rango SQUIRE 48%, Boulevard ~55%, Restolabs ~62%. Confianza media. |
  | h = churn mensual de un regular | 4%/mes (~39%/año) | 2% / 8% | **SUPUESTO**, sin fuente. |
  | Mezcla de rubros | cafe 15, panad. 12, almacén 8, rest. 15, pizza 7, bar 4, helad. 6, belleza 5, barb. 5, uñas 4, gym 5, farm. 6, ropa 4, masc. 2, lavado 2 (%) | variante «frecuente» (cafe 25, panad. 20, almacén 15…) | **SUPUESTO** |
  | Regulares y push | un activo no recibe push (regla del encargo) | «huecos»: visitas con huecos gamma(k=2) de media 0,5·T; si un hueco supera T, el «te extrañamos» dispara igual | **SUPUESTO** (gamma elegida a mano) |
  | Reactivación por el mensaje | 0 (la escalera corre entera) | — | **SUPUESTO de techo**: la demanda real es menor |
  | Share de membresías en escalera (L) | sale del modelo (34% en la base) | L fijo 20 / 40 / 60% | Derivado |
- Con p1 = 0,5 y h = 4%/mes, **~34% de las membresías vivas de un consumidor están en alguna etapa de
  reactivación** en un día cualquiera. Con p1 = 0,6 y h = 8% sube a ~57%; con p1 = 0,4 y h = 2% baja a ~18%.
  El one-and-done pesa más que el churn de los regulares, porque cada alta perdida mete una escalera entera
  de 121–481 días.

### Gaps
- No hay dato de Ecuador/Cuenca sobre cuántos comercios independientes visita una persona ni sobre
  cuántos deja por mes. Kantar y Dichter & Neira miden canales y tiendas de barrio en general.
- No encontré una tasa de churn mensual de regulares en comercios chicos con fuente primaria. Los
  benchmarks que aparecen (Toast, Thanx, blogs) no publican la tasa ni el método. El informe de regulares
  de Toast ([pos.toasttab.com](https://pos.toasttab.com/blog/data/restaurant-regular-customer-report))
  devolvió 403.
- No hay dato de cuántos comercios de UNA red local comparte un mismo cliente. Es la variable que más
  mueve el resultado (la demanda es lineal en N·L) y solo se puede medir con datos propios de CheckPass.

## 2. Demanda simulada frente al cupo: avisos por día y por semana, y choques el mismo día

### Takeaway
Con solo la escalera de reactivación, **la demanda media está muy por debajo del cupo**. Un consumidor en
20 comercios pide en promedio 0,31 avisos/día (2,2 por semana) con T1, contra 2 lugares/día. El problema
no es el volumen, **son los choques**: el 3,9% de los días hay 2 o más pedidos a la vez y el 0,4% hay más
de 2. Aun así, el 41% de los consumidores con N = 20 tiene al menos un día de más de 2 en seis meses. En el
peor caso combinado (mezcla de rubros frecuentes, huecos de regulares, p1 = 0,6, h = 8%, N = 20), la media
es 0,75/día: sigue por debajo de 2, pero con 17,2% de días con 2 o más.

### Cited Findings
- Cupo de Google Wallet: 3 avisos con notificación por pase cada 24 h; el cuarto devuelve
  `QuotaExceededException`. Apple no publica un tope — `docs/red-y-atencion.md` §1 (documentación oficial
  leída por el orquestador el 2026-09-29; no la re-verifiqué).
- Escalera por rubro: `research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md` (tabla cargada a mano por
  el owner).

### Inferences

#### Resultados del modelo (salida del script)

**Mensajes por episodio de lapso completo** (determinista): de 7 (belleza, barbería) a 11 (cafetería,
heladería). Promedio ponderado con la mezcla base: **9,07 con T1 y 7,56 con T2**. Con la mezcla frecuente:
9,53 y 7,80.

**Demanda sin cupo por consumidor** (180 días; «N» = membresías vivas):

| Escenario | N | T | % membresías en escalera | avisos/día | avisos/semana | p95 semana | P(0) | P(1) | P(2) | P(>2) | P(≥2) | máx. día | % consumidores con algún día >2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base (p1=.5, h=4%) | 5 | T1 | 35% | 0,08 | 0,56 | 2 | 92,2% | 7,6% | 0,2% | 0,0% | 0,2% | 4 | 0,8% |
| base | 5 | T2 | 34% | 0,07 | 0,46 | 2 | 93,7% | 6,2% | 0,2% | 0,0% | 0,2% | 3 | 0,4% |
| base | 10 | T1 | 35% | 0,16 | 1,11 | 3 | 85,3% | 13,7% | 1,0% | 0,0% | 1,0% | 4 | 6,7% |
| base | 10 | T2 | 35% | 0,13 | 0,93 | 3 | 87,5% | 11,8% | 0,7% | 0,0% | 0,8% | 4 | 4,3% |
| base | 20 | T1 | 34% | 0,31 | 2,20 | 5 | 72,9% | 23,1% | 3,6% | 0,4% | 3,9% | 5 | 41,3% |
| base | 20 | T2 | 34% | 0,26 | 1,84 | 4 | 76,8% | 20,5% | 2,6% | 0,2% | 2,8% | 5 | 28,7% |
| + huecos de regulares | 10 | T1 | 34% | 0,25 | 1,75 | 4 | 77,7% | 19,8% | 2,3% | 0,2% | 2,5% | 5 | 24,9% |
| + huecos de regulares | 20 | T1 | 34% | 0,50 | 3,48 | 7 | 60,5% | 30,8% | 7,4% | 1,3% | 8,7% | 6 | 85,8% |
| mezcla frecuente | 20 | T1 | 32% | 0,35 | 2,46 | 5 | 70,2% | 25,1% | 4,3% | 0,5% | 4,8% | 6 | 47,1% |
| p1=.6, h=8% | 20 | T1 | 57% | 0,52 | 3,66 | 7 | 58,9% | 31,6% | 8,1% | 1,5% | 9,6% | 6 | 86,4% |
| p1=.4, h=2% | 20 | T1 | 18% | 0,17 | 1,16 | 3 | 84,7% | 14,1% | 1,1% | 0,1% | 1,2% | 4 | 9,1% |
| PEOR (frecuente+huecos+p1=.6, h=8%) | 10 | T1 | 54% | 0,38 | 2,63 | 5 | 68,2% | 26,6% | 4,7% | 0,5% | 5,2% | 5 | 57,4% |
| PEOR | 20 | T1 | 53% | 0,75 | 5,26 | 9 | 46,5% | 36,3% | 13,5% | 3,7% | 17,2% | 7 | 99,8% |

- **Contra el cupo de 2/día:** ningún escenario se acerca en promedio: el peor usa el 37% del cupo
  (0,75/2). La cola no crece. El riesgo son los choques puntuales.
- **Contra el cupo de 1/día** (una idea del owner): el peor caso usa 75% del cupo en promedio y la mitad
  de los días hay al menos un pedido. Ahí la cola ya se nota (ver §3).
- Esto **no contradice** la cuenta del owner en `red-y-atencion.md` §1 («20 comercios que lanzan
  campañas» saturan el cupo). Ese cálculo cuenta CAMPAÑAS; este modelo cuenta solo la escalera de
  reactivación. Si cada campaña fuera un push aparte, la demanda sería otra y no está modelada acá.
- **Los huecos de los regulares pesan mucho:** si el motor dispara por días desde la última visita, un
  regular que a veces se salta una semana genera «te extrañamos». Con N = 10, la demanda pasa de 0,16 a
  0,25/día (+56%). Con N = 20, P(≥2) pasa de 3,9% a 8,7%. La media del hueco (0,5·T) es SUPUESTO, pero el
  efecto marca que conviene no mandar «te extrañamos» a quien viene con regularidad.

### Gaps
- La distribución de huecos de los regulares por rubro no tiene fuente. Solo tenemos la mediana de
  SQUIRE (48,5 días en barbería) y la de Restolabs (8,9 días en delivery).
- No se modelan campañas ni cupones: solo la escalera de reactivación.
- La simulación junta a todas las membresías vivas sin mirar el filtro de 2 km ni el de rubro no
  competidor. Esos filtros cambian lo que se VE en «Mis beneficios», no lo que se pide como push.

## 3. Cuánto demora un cupo diario, FIFO frente a prioridad, y cuánto se pierde si los mensajes vencen

### Takeaway
**Con cupo 2/día, en la práctica no hay demora** (N = 20, T1: 1,3% de mensajes con demora, máximo 2 días)
y solo se pierde un 1,3% si todo vence el mismo día. **Con cupo 1/día y N = 20**, el 18,6% sale con
demora (media 0,22 días, p90 1, máximo 6 con FIFO). Si el mensaje vence el mismo día se pierde el 13,8%;
con vencimiento a 3 días no se pierde nada. **Las prioridades puras hacen esperar a lo que queda último:**
en el peor caso, un mensaje esperó hasta 203–212 días. Hace falta un vencimiento o un envejecimiento.

### Cited Findings
- (Sin fuentes externas: resultados del script sobre los insumos de §1 y §2.)

### Inferences

#### Resultados del modelo (salida del script), selección

| Escenario | N | T | cupo | política | vence | reemplazo | entregados | vencidos | con demora | demora media | p90 | máx. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base | 5 | T1 | 1 | fifo | nunca | no | 100% | 0% | 3,3% | 0,03 | 0 | 3 |
| base | 5 | T1 | 1 | fifo | 0 d | no | 96,9% | 3,1% | 0% | 0 | 0 | 0 |
| base | 10 | T1 | 2 | fifo | nunca | no | 100% | 0% | 0,3% | 0,00 | 0 | 1 |
| base | 10 | T1 | 1 | fifo | nunca | no | 100% | 0% | 7,8% | 0,08 | 0 | 3 |
| base | 10 | T1 | 1 | fifo | 0 d | no | 93,2% | 6,8% | 0% | 0 | 0 | 0 |
| base | 20 | T1 | 2 | fifo | nunca | no | 100% | 0% | 1,3% | 0,01 | 0 | 2 |
| base | 20 | T1 | 2 | fifo | 0 d | no | 98,7% | 1,3% | 0% | 0 | 0 | 0 |
| base | 20 | T1 | 1 | fifo | nunca | no | 100% | 0% | 18,6% | 0,22 | 1 | 6 |
| base | 20 | T1 | 1 | riesgo_primero | nunca | no | 100% | 0% | 15,2% | 0,22 | 1 | 15 |
| base | 20 | T1 | 1 | facil_primero | nunca | no | 100% | 0% | 15,2% | 0,22 | 1 | 16 |
| base | 20 | T1 | 1 | fifo | 0 d | no | 86,2% | 13,8% | 0% | 0 | 0 | 0 |
| base | 20 | T1 | 1 | fifo | 3 d | no | 100% | 0% | 18,6% | 0,21 | 1 | 3 |
| base | 20 | T2 | 1 | fifo | nunca | no | 100% | 0% | 14,7% | 0,16 | 1 | 4 |
| base | 20 | T2 | 1 | fifo | 0 d | no | 88,5% | 11,5% | 0% | 0 | 0 | 0 |
| PEOR | 20 | T1 | 2 | fifo | nunca | no | 100% | 0% | 7,2% | 0,07 | 0 | 3 |
| PEOR | 20 | T1 | 2 | fifo | 0 d | no | 94,2% | 5,8% | 0% | 0 | 0 | 0 |
| PEOR | 20 | T1 | 1 | fifo | nunca | no | 100% | 0% | 60,6% | 1,44 | 4 | 27 |
| PEOR | 20 | T1 | 1 | riesgo_primero | nunca | no | 100% | 0% | 36,7% | 1,45 | 4 | 203 |
| PEOR | 20 | T1 | 1 | facil_primero | nunca | no | 100% | 0% | 36,7% | 1,44 | 3 | 212 |
| PEOR | 20 | T1 | 1 | fifo | 0 d | no | 71,3% | 28,7% | 0% | 0 | 0 | 0 |
| PEOR | 20 | T1 | 1 | fifo | 3 d | no | 97,6% | 2,4% | 56,2% | 0,90 | 2 | 3 |
| PEOR | 20 | T1 | 1 | fifo | 7 d | no | 99,7% | 0,3% | 60,1% | 1,27 | 3 | 7 |
| PEOR | 20 | T1 | 1 | fifo | nunca | sí | 98,4% | 0% (1,6% reemplazados) | 57,7% | 1,07 | 3 | 10 |
| PEOR | 20 | T1 | 1 | riesgo_primero | 3 d | sí | 92,5% | 6,6% (+0,9% reempl.) | 30,0% | 0,47 | 2 | 3 |

La tabla completa, con N = 5/10/20 × T1/T2 × diez políticas, está en la salida del script (sección 2).
«riesgo_primero» manda primero la etapa más avanzada: Perdido, después En riesgo, después Te extrañamos
(«el más cerca de perderse»). «facil_primero» hace lo contrario («el más fácil de recuperar»).
«reemplazo» significa que un mensaje nuevo del mismo comercio pisa al que seguía pendiente.

**Qué etapa pierde con cupo 1 y vencimiento el mismo día (N = 20, T1, base):**

| política | Te extrañamos perdidos | En riesgo perdidos | Perdido perdidos |
|---|---|---|---|
| fifo | 13,8% | 13,8% | 13,7% |
| riesgo_primero | 22,7% | 16,0% | 6,3% |
| facil_primero | 4,6% | 12,4% | 21,0% |

- **La demora media no depende de la política; la cola sí.** FIFO, riesgo_primero y facil_primero dan la
  misma demora media (0,22 días en la base), porque la cantidad total que sale por día es la misma. Pero
  con prioridad pura hay mensajes que no salen nunca mientras sigan entrando otros más urgentes: máximo de
  15–16 días en la base y 203–212 en el peor caso. **Toda política con prioridad necesita un vencimiento
  (3 días alcanzó en la base) o un envejecimiento.** A cambio, la prioridad deja menos mensajes con
  demora (15,2% contra 18,6%).
- **Cupo 1 con vencimiento el mismo día** equivale a «nunca dos te-extrañamos el mismo día, y lo que no
  salió se descarta». Se pierde el 13,8% con N = 20 en la base, el 6,8% con N = 10 y el 3,1% con N = 5. La
  política decide QUIÉN pierde: con riesgo_primero se pierde el 6,3% de los «Perdido» y el 22,7% de los
  «Te extrañamos».
- **Cupo 1 con vencimiento de 3 días** en la base: 0% perdido y demora máxima de 3 días. Es un punto
  medio sin costo visible en la base. En el peor caso pierde 2,4%.
- **El «reemplazo»** (el mensaje nuevo pisa al pendiente del mismo comercio) casi no actúa en la base
  (0,1%), porque los mensajes de una misma escalera están separados por 7 días o más. Solo importa cuando
  la cola se atrasa.
- **T1 frente a T2:** T2 baja los mensajes por episodio de 9,07 a 7,56 (−17%), la demanda media de 0,31
  a 0,26/día (N = 20), los consumidores con algún día >2 de 41% a 29%, y lo perdido con cupo 1 y
  vencimiento el mismo día de 13,8% a 11,5%. Toda la diferencia está en los «Te extrañamos» (4 contra 2 en
  cafetería); las etapas En riesgo y Perdido son iguales.
- **Share de comercios en lapso (L):** la demanda es lineal en N·L. Con N = 20: L = 20% → 0,19/día; 40% →
  0,37; 60% → 0,56. P(>2) pasa de 0,1% a 0,6% y a 1,7%; los consumidores con algún día >2, de 13% a 57% y
  a 93%. Con L = 60% y N = 20, casi todos chocan alguna vez contra 2 en seis meses, aunque la media sea
  un cuarto del cupo.

### Gaps
- No se modela que un mensaje reactive al cliente. Si reactivara, la escalera se cortaría y la demanda
  bajaría: los resultados son una **cota superior**.
- No se modelan el timbre general (se da por reservado y siempre usado), los cupones cruzados del escaneo
  ni la proximidad, que no gastan cupo según `red-y-atencion.md`.
- Apple no tiene un tope publicado; el modelo usa el de Google para los dos.
- La «rotación entre comercios» del borrador del orquestador no se simuló aparte. FIFO por día
  programado es su aproximación más cercana.

#### Script (`modelo_de_demanda.py`, copia al momento de la corrida)

```python
#!/usr/bin/env python3
"""Modelo de demanda de avisos de reactivacion por consumidor en una red de comercios.

Cruza la escalera por rubro (research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md, 2026-09-29)
con supuestos de comportamiento del consumidor y la compara con el cupo de Google Wallet
(3 avisos/pase/24 h, 1 reservado al timbre general => 2 para reactivacion).

Solo stdlib (el entorno no tiene numpy). Semilla fija: la salida es reproducible.
Uso:  python3 modelo_de_demanda.py            (corre todo e imprime tablas markdown)
      python3 modelo_de_demanda.py --rapido   (menos consumidores, para probar)

Modelo (todo en dias enteros):
  * El consumidor tiene N MEMBRESIAS vivas (comercios de la red donde tiene el pase y que todavia
    no pasaron a «irrecuperable»). Cada membresia es un «slot» que recorre un ciclo:
      fase ACTIVA (duracion A) -> ultima visita -> ESCALERA de mensajes del rubro
      -> irrecuperable (dia Irrecup) -> el slot se recicla con un comercio nuevo (rubro al azar).
  * Regla del encargo: un cliente activo (que visita con regularidad) NO recibe push.
    Variante «huecos»: en la fase activa las visitas tienen huecos gamma; si un hueco supera T
    el «Te extranamos» dispara igual (lo que haria el motor real por dias desde la ultima visita).
  * Duracion de la fase activa:
      - modo «conductual»: con prob p1 el cliente es one-and-done (A=0); si no, A ~ Exponencial
        con hazard mensual h (churn de clientes regulares).
      - modo «L fijo»: A ~ Exponencial con media elegida para que la fraccion estacionaria de
        membresias en escalera sea L (sensibilidad «share de comercios en lapso»).
  * Mensajes de la escalera (dias desde la ultima visita):
      Te extranamos en k*T mientras k*T < R  (T = T1 o T2),
      luego los de En riesgo y los de Perdido tal cual la tabla. Despues, nada.
  * Supuesto de techo: nadie vuelve por un mensaje (la escalera corre entera). Es cota superior
    de la demanda; declarado en las notas.
  * Cola: cupo c avisos/dia (1 o 2), politica FIFO o prioridad, vencimiento E dias,
    y opcion «reemplazo»: un mensaje nuevo del mismo comercio pisa al pendiente.
"""
import math
import random
import sys
from collections import defaultdict

SEED = 20260929
RAPIDO = "--rapido" in sys.argv
N_CONSUMIDORES = 400 if RAPIDO else 3000
VENTANA = 180          # dias medidos [0, 180)
BURN = 1500            # dias de calentamiento para llegar al regimen estacionario
COLA_PRE = 60          # la cola arranca 60 dias antes de la ventana
COLA_POST = 90         # y sigue 90 dias despues para medir la demora de lo pedido en la ventana

# ---------------------------------------------------------------------------------------------
# Tabla de CONSOLIDADO.md: rubro -> (T1, T2, R, [mensajes en riesgo], [mensajes perdido], irrecup)
# ---------------------------------------------------------------------------------------------
TABLA = {
    "cafeteria":     (7, 14, 30, [30, 51, 72], [91, 105, 151, 181], 181),
    "panaderia":     (8, 15, 30, [30, 51], [61, 70, 101, 121], 121),
    "almacen":       (7, 14, 30, [30, 51], [61, 70, 101, 121], 121),
    "restaurante":   (14, 30, 45, [45, 77], [91, 105, 151, 181], 181),
    "pizzeria":      (14, 21, 30, [30, 51, 72], [91, 105, 151, 181], 181),
    "bar":           (14, 21, 45, [45, 77], [91, 105, 151, 181], 181),
    "heladeria":     (10, 21, 45, [45, 77, 109], [121, 140, 201, 241], 241),
    "salon_belleza": (45, 60, 90, [90, 153], [181, 209, 301, 361], 361),
    "barberia":      (35, 49, 84, [84], [121, 140, 201, 241], 241),
    "unas":          (21, 28, 45, [45, 77], [91, 105, 151, 181], 181),
    "gimnasio":      (8, 14, 21, [21, 36], [46, 60, 120, 181], 181),
    "farmacia":      (21, 35, 45, [45, 77], [91, 105, 151, 181], 181),
    "ropa":          (45, 60, 120, [120, 204], [241, 278, 401, 481], 481),
    "mascotas":      (21, 35, 45, [45, 77], [91, 105, 151, 181], 181),
    "lavado_autos":  (21, 30, 45, [45, 77], [91, 105, 151, 181], 181),
}

# Mezcla de rubros de las membresias de un consumidor urbano. SUPUESTO (no hay fuente):
MEZCLA_BASE = {
    "cafeteria": .15, "panaderia": .12, "almacen": .08, "restaurante": .15, "pizzeria": .07,
    "bar": .04, "heladeria": .06, "salon_belleza": .05, "barberia": .05, "unas": .04,
    "gimnasio": .05, "farmacia": .06, "ropa": .04, "mascotas": .02, "lavado_autos": .02,
}
# Mezcla sesgada a rubros de ciclo corto (peor caso de frecuencia). SUPUESTO:
MEZCLA_FRECUENTE = {
    "cafeteria": .25, "panaderia": .20, "almacen": .15, "restaurante": .10, "pizzeria": .05,
    "bar": .03, "heladeria": .05, "salon_belleza": .02, "barberia": .03, "unas": .02,
    "gimnasio": .07, "farmacia": .02, "ropa": .01, "mascotas": .00, "lavado_autos": .00,
}

EXTR, RIESGO, PERDIDO = 0, 1, 2
NOMBRE_ETAPA = {EXTR: "te_extranamos", RIESGO: "en_riesgo", PERDIDO: "perdido"}


def escalera(rubro, usar_t2):
    """Lista de (dia_desde_ultima_visita, etapa)."""
    t1, t2, r, riesgo, perdido, _ = TABLA[rubro]
    t = t2 if usar_t2 else t1
    msgs = [(k * t, EXTR) for k in range(1, 1000) if k * t < r]
    msgs += [(d, RIESGO) for d in riesgo]
    msgs += [(d, PERDIDO) for d in perdido]
    return msgs


def elegir(rng, mezcla):
    x = rng.random()
    acc = 0.0
    for k, w in mezcla.items():
        acc += w
        if x < acc:
            return k
    return k


def generar_mensajes(rng, n, cfg):
    """Mensajes (dia, id_membresia, etapa, dias_desde_visita) de un consumidor, y fraccion de
    dias-membresia en escalera dentro de la ventana."""
    msgs = []
    usar_t2 = cfg["t2"]
    fin = VENTANA + COLA_POST
    dias_en_escalera = 0
    mid = 0
    for _slot in range(n):
        # arranque desfasado al azar para no sincronizar los slots
        t = -BURN - rng.randrange(0, 400)
        while t < fin:
            rubro = elegir(rng, cfg["mezcla"])
            t1, t2, r, _, _, irrec = TABLA[rubro]
            umbral = t2 if usar_t2 else t1
            mid += 1
            # --- fase activa
            if cfg["modo"] == "conductual":
                if rng.random() < cfg["p1"]:
                    a = 0
                else:
                    a = int(rng.expovariate(cfg["h"] / 30.0))
            else:  # L fijo: media de A tal que irrec/(A+irrec) = L
                media = irrec * (1 - cfg["L"]) / cfg["L"]
                a = int(rng.expovariate(1.0 / media)) if media > 0 else 0
            ultima = t + a
            if cfg["huecos"] and a > 0:
                # visitas con huecos gamma(k=2) de media cfg["huecos"]*T; mensajes si hueco > T
                media_h = cfg["huecos"] * umbral
                extr = [d for d, et in escalera(rubro, usar_t2) if et == EXTR]
                v = t
                while True:
                    g = max(1, int(round(rng.gammavariate(2.0, media_h / 2.0))))
                    if v + g >= ultima or v >= fin:
                        break
                    if g > extr[0] and v + g >= -COLA_PRE:
                        for d in extr:
                            if d < g and -COLA_PRE <= v + d < fin:
                                msgs.append((v + d, mid, EXTR, d))
                    v += g
            # --- escalera tras la ultima visita
            for d, et in escalera(rubro, usar_t2):
                dia = ultima + d
                if -COLA_PRE <= dia < fin:
                    msgs.append((dia, mid, et, d))
            # fraccion en escalera dentro de la ventana
            lo, hi = max(ultima, 0), min(ultima + irrec, VENTANA)
            if hi > lo:
                dias_en_escalera += hi - lo
            t = ultima + irrec  # el slot se libera cuando la membresia es irrecuperable
    return msgs, dias_en_escalera / (n * VENTANA)


def simular_cola(msgs, cupo, politica, vence, reemplazo):
    """Devuelve lista de (dia_programado, demora | None si vencio | 'R' si fue reemplazado)
    para los mensajes programados dentro de la ventana."""
    por_dia = defaultdict(list)
    for i, m in enumerate(msgs):
        por_dia[m[0]].append((i, m))
    pendiente = {}      # i -> mensaje
    ultimo_de = {}      # id_membresia -> i pendiente
    res = {}
    for dia in range(-COLA_PRE, VENTANA + COLA_POST):
        for i, m in por_dia.get(dia, []):
            if reemplazo and m[1] in ultimo_de:
                j = ultimo_de[m[1]]
                if j in pendiente:
                    res[j] = "R"
                    del pendiente[j]
            pendiente[i] = m
            ultimo_de[m[1]] = i
        # vencidos
        if vence is not None:
            for i in [i for i, m in pendiente.items() if dia - m[0] > vence]:
                res[i] = None
                del pendiente[i]
        if not pendiente:
            continue
        if politica == "fifo":
            clave = lambda im: (im[1][0], im[0])
        elif politica == "riesgo_primero":   # el mas cerca de perderse
            clave = lambda im: (-im[1][2], -im[1][3], im[1][0], im[0])
        else:                                 # facil_primero: el mas reciente
            clave = lambda im: (im[1][2], im[1][3], im[1][0], im[0])
        for i, m in sorted(pendiente.items(), key=clave)[:cupo]:
            res[i] = dia - m[0]
            del pendiente[i]
    out = []
    for i, m in enumerate(msgs):
        if 0 <= m[0] < VENTANA:
            out.append((m[0], res.get(i, "PEND")))
    return out


def pct(xs, q):
    if not xs:
        return float("nan")
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


def demanda(cfg, n, rng):
    """Estadisticas de demanda (sin cupo)."""
    tot_dias = 0
    hist = defaultdict(int)
    semanas = []
    consumidores_con_pico = 0
    fr_lapso = []
    todos = []
    for _ in range(N_CONSUMIDORES):
        msgs, fl = generar_mensajes(rng, n, cfg)
        fr_lapso.append(fl)
        todos.append(msgs)
        cnt = defaultdict(int)
        for m in msgs:
            if 0 <= m[0] < VENTANA:
                cnt[m[0]] += 1
        pico = False
        for d in range(VENTANA):
            hist[cnt[d]] += 1
            if cnt[d] > 2:
                pico = True
        consumidores_con_pico += pico
        for w in range(VENTANA // 7):
            semanas.append(sum(cnt[d] for d in range(7 * w, 7 * w + 7)))
        tot_dias += VENTANA
    total = sum(k * v for k, v in hist.items())
    return {
        "media_dia": total / tot_dias,
        "media_semana": sum(semanas) / len(semanas),
        "p95_semana": pct(semanas, .95),
        "p0": hist[0] / tot_dias,
        "p1": hist[1] / tot_dias,
        "p2": hist[2] / tot_dias,
        "p_mas2": sum(v for k, v in hist.items() if k > 2) / tot_dias,
        "p_mas1": sum(v for k, v in hist.items() if k > 1) / tot_dias,
        "max_dia": max(k for k, v in hist.items() if v),
        "cons_pico": consumidores_con_pico / N_CONSUMIDORES,
        "lapso": sum(fr_lapso) / len(fr_lapso),
    }, todos


def cola_stats(todos, cupo, politica, vence, reemplazo):
    dem, venc, reem, pend, n = [], 0, 0, 0, 0
    for msgs in todos:
        for _dia, r in simular_cola(msgs, cupo, politica, vence, reemplazo):
            n += 1
            if r is None:
                venc += 1
            elif r == "R":
                reem += 1
            elif r == "PEND":
                pend += 1
            else:
                dem.append(r)
    return {
        "entregados": len(dem) / n if n else 0,
        "demora_media": sum(dem) / len(dem) if dem else float("nan"),
        "demora_p90": pct(dem, .90),
        "demora_max": max(dem) if dem else 0,
        "p_con_demora": sum(1 for x in dem if x > 0) / len(dem) if dem else 0,
        "vencidos": venc / n if n else 0,
        "reemplazados": reem / n if n else 0,
        "pendientes": pend / n if n else 0,
    }


def fila(*xs):
    return "| " + " | ".join(str(x) for x in xs) + " |"


def main():
    rng = random.Random(SEED)
    f2 = lambda x: f"{x:.2f}"
    fp = lambda x: f"{100 * x:.1f}%"

    print("## 0. Mensajes por episodio de lapso completo (determinista, de la tabla)\n")
    print(fila("rubro", "msgs T1", "msgs T2", "de ellos Te extranamos T1/T2", "dias hasta el ultimo"))
    print(fila(*["---"] * 5))
    for r in TABLA:
        e1, e2 = escalera(r, False), escalera(r, True)
        n1 = sum(1 for d, e in e1 if e == EXTR)
        n2 = sum(1 for d, e in e2 if e == EXTR)
        print(fila(r, len(e1), len(e2), f"{n1}/{n2}", TABLA[r][5]))
    for nom, mz in (("MEZCLA_BASE", MEZCLA_BASE), ("MEZCLA_FRECUENTE", MEZCLA_FRECUENTE)):
        m1 = sum(w * len(escalera(r, False)) for r, w in mz.items())
        m2 = sum(w * len(escalera(r, True)) for r, w in mz.items())
        print(f"\nPromedio ponderado {nom}: {m1:.2f} msgs/episodio con T1, {m2:.2f} con T2.")

    base = {"modo": "conductual", "p1": 0.5, "h": 0.04, "huecos": 0, "t2": False,
            "mezcla": MEZCLA_BASE}

    escenarios = []
    for n in (5, 10, 20):
        for t2 in (False, True):
            escenarios.append((f"conductual p1=0.5 h=4%/mes", n, dict(base, t2=t2)))
    for n in (5, 10, 20):
        for L in (0.2, 0.4, 0.6):
            escenarios.append((f"L fijo={L}", n, dict(base, modo="L", L=L)))
    for n in (10, 20):
        escenarios.append(("conductual + huecos (media 0.5T)", n, dict(base, huecos=0.5)))
        escenarios.append(("conductual MEZCLA_FRECUENTE", n, dict(base, mezcla=MEZCLA_FRECUENTE)))
        escenarios.append(("conductual p1=0.6 h=8%/mes", n, dict(base, p1=0.6, h=0.08)))
        escenarios.append(("conductual p1=0.4 h=2%/mes", n, dict(base, p1=0.4, h=0.02)))
        escenarios.append(("PEOR: frecuente+huecos+p1=.6 h=8%", n,
                           dict(base, p1=0.6, h=0.08, huecos=0.5, mezcla=MEZCLA_FRECUENTE)))

    print("\n## 1. Demanda sin cupo (por consumidor, ventana de 180 dias)\n")
    print(fila("escenario", "N", "T", "% membresias en escalera", "avisos/dia", "avisos/semana",
               "p95 semana", "P(0)", "P(1)", "P(2)", "P(>2)", "P(>=2)", "max dia",
               "% consumidores con algun dia >2"))
    print(fila(*["---"] * 14))
    guardados = {}
    for nom, n, cfg in escenarios:
        d, todos = demanda(cfg, n, rng)
        guardados[(nom, n, cfg["t2"])] = todos
        print(fila(nom, n, "T2" if cfg["t2"] else "T1", fp(d["lapso"]), f2(d["media_dia"]),
                   f2(d["media_semana"]), d["p95_semana"], fp(d["p0"]), fp(d["p1"]), fp(d["p2"]),
                   fp(d["p_mas2"]), fp(d["p_mas1"]), d["max_dia"], fp(d["cons_pico"])))

    print("\n## 2. Con cupo diario: demora, vencidos y reemplazos\n")
    print("(Escenarios conductuales base; demora en dias entre el dia programado y el de salida.)\n")
    print(fila("escenario", "N", "T", "cupo", "politica", "vence (d)", "reemplazo",
               "entregados", "vencidos", "reemplazados", "% con demora>0", "demora media",
               "p90", "max"))
    print(fila(*["---"] * 14))
    politicas = [
        (2, "fifo", None, False), (1, "fifo", None, False),
        (1, "riesgo_primero", None, False), (1, "facil_primero", None, False),
        (1, "fifo", 0, False), (1, "fifo", 3, False), (1, "fifo", 7, False),
        (1, "fifo", None, True), (1, "riesgo_primero", 3, True),
        (2, "fifo", 0, False),
    ]
    claves = [("conductual p1=0.5 h=4%/mes", n, t2) for n in (5, 10, 20) for t2 in (False, True)]
    claves += [("PEOR: frecuente+huecos+p1=.6 h=8%", 20, False)]
    for clave in claves:
        todos = guardados[clave]
        for cupo, pol, vence, reem in politicas:
            if clave[1] == 5 and (pol != "fifo" or reem):
                continue
            s = cola_stats(todos, cupo, pol, vence, reem)
            print(fila(clave[0], clave[1], "T2" if clave[2] else "T1", cupo, pol,
                       "nunca" if vence is None else vence, "si" if reem else "no",
                       fp(s["entregados"]), fp(s["vencidos"]), fp(s["reemplazados"]),
                       fp(s["p_con_demora"]), f2(s["demora_media"]), s["demora_p90"],
                       s["demora_max"]))

    # por etapa: que se pierde con cupo 1 y vencimiento 0 (mismo dia), segun politica
    print("\n## 3. Que etapa pierde cuando el cupo es 1 y el mensaje vence el mismo dia (N=20, T1)\n")
    todos = guardados[("conductual p1=0.5 h=4%/mes", 20, False)]
    print(fila("politica", "te_extranamos perdidos", "en_riesgo perdidos", "perdido perdidos"))
    print(fila(*["---"] * 4))
    for pol in ("fifo", "riesgo_primero", "facil_primero"):
        por = defaultdict(lambda: [0, 0])
        for msgs in todos:
            res = simular_cola(msgs, 1, pol, 0, False)
            etapas = [m[2] for m in msgs if 0 <= m[0] < VENTANA]
            for (_d, r), et in zip(res, etapas):
                por[et][1] += 1
                if r is None:
                    por[et][0] += 1
        print(fila(pol, *[fp(por[e][0] / por[e][1]) if por[e][1] else "-"
                          for e in (EXTR, RIESGO, PERDIDO)]))


if __name__ == "__main__":
    main()
```
