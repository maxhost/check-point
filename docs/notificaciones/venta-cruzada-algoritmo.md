# Venta cruzada: el algoritmo para repartir oportunidades entre comercios

Segunda investigacion (2026-10-02) para el ADR 0117, a pedido del owner: «queremos dar a todos los comercios de la red
oportunidades. No queremos que el que mas venda venda mas mientras el que venda menos nunca llegue a mas clientes
[...] siempre tener una cuota de azar o de "discoveribilidad"». La reunio un agente de investigacion (22 busquedas);
el orquestador verifico las citas del repo y **recalculo el ejemplo numerico** (§2). La propuesta es opinion, no
decision. Primera investigacion: `venta-cruzada-criterio.md`.

## 1. La idea en una linea

**Una loteria con boletos, no «gana el mejor».** Cada comercio elegible recibe boletos segun cercania, cuanto va
atrasado en su turno y (mas adelante) cuanto le sirve a ese cliente y cuanto canjean sus cupones; ademas, una parte
fija se sortea pareja entre todos. Nadie queda en cero, la probabilidad de cada eleccion se guarda, y se le explica a
un comercio: «tus boletos dependen de cercania, atraso y, despues, de cuanto canjean».

Por que no «gana el mejor»: con Thompson sampling puro (el bandit clasico), en el ejemplo de abajo un comercio recibe
el **4 %** de los envios — el «ganador se lo lleva todo» que documenta Wang et al., ICML 2021.

## 2. Ejemplo (recalculado por el orquestador)

A es un cafe. Elegibles: **B** panaderia a 300 m (popular), **C** peluqueria a 900 m, **D** libreria a 1,8 km (nueva).

1. **Cercania:** `c = e^(−distancia/1 km)` → B 0,74 · C 0,41 · D 0,17. Solo con esto: B 56 %, C 31 %, D 13 %.
2. **Atraso:** en el mes hubo 60 decisiones con los tres como candidatos; lo justo son 20 cada uno, pero B recibio 40,
   C 15 y D 5. Factor `a = (1 + justo) / (1 + recibido)`, acotado entre 0,5 y 2 → B 0,51 · C 1,31 · D 2,0.
3. **Probabilidad** con 20 % de azar parejo (`ε = 0,2`): `p = ε/3 + (1−ε)·c·a / Σ(c·a)` → **B 31 %, C 41 %, D 28 %**.
   De los proximos 10 clientes: ~3 a B, ~4 a C, ~3 a D.
4. **Equidad medida con Gini** (0 = parejo): exposiciones 40/15/5 → 0,39; 25/20/15 → 0,11; 20/20/20 → 0.
5. **Merito con pocos datos** (etapa 2): canjes/envios B 8/40, C 1/15, D 2/5. Achicado hacia un 10 % de red,
   `(1 + canjes)/(10 + envios)` → B 18 %, C 8 %, D 20 %. El 40 % crudo de D salio de 5 envios: el achique impide
   creerselo.
6. **Habitos:** Ana tiene 6 escaneos, 2 en librerias → su afinidad por libreria es 2× la de la red. A Ana: D 65 %. A un
   cliente sin historia: B 38 %, C 26 %, D 37 %.

## 3. Propuesta en tres etapas (opinion)

**Etapa 1 — arranque (hoy).** Filtros del ADR 0117 + «B abierto dentro de la vigencia» + «no el mismo B al mismo
cliente en 30 dias». Regla: `p_i = ε/k + (1−ε)·c_i·a_i / Σ c_j·a_j`, con `ε = 0,2`. El «justo» de cada comercio se
cuenta **por oportunidad** (suma de `1/k` en las decisiones donde fue candidato), asi un comercio en una zona sin
movimiento no aparece «atrasado». Todo sale de una consulta sobre el registro de decisiones; sin ML.

**Pasar a etapa 2:** ~200 cupones cruzados emitidos y ~20 canjes en la red (regla practica, no de la literatura).

**Etapa 2 — crecimiento.** Se suman la afinidad del cliente por el rubro (suavizada hacia la red: con 1 escaneo es
neutra, con 10 personaliza), un factor por segmento (nuevo para B / dormido / habitual) y el merito (tasa de canje
achicada: red → par de rubros → comercio). Bono «primer cliente nuevo del mes» para el comercio que todavia no
consiguio ninguno (idea de Mercari: el primer cliente de un comercio vale mas que el vigesimo de otro). `ε` baja a
0,10–0,15.

**Pasar a etapa 3:** ~30 comercios, la mayoria con 10+ canjes, miles de decisiones por mes.

**Etapa 3 — escala.** Modelo de probabilidad de canje (regresion logistica entrenada semanalmente, coeficientes en una
tabla), equidad como piso de exposicion por comercio con un bono que se ajusta solo cada dia, y antes de cambiar de
politica se evalua con los datos guardados (Li et al., WSDM 2011).

**Como se mide la equidad (mensual):** por comercio, oportunidades, exposiciones, canjes y clientes nuevos logrados;
para la red, Gini de exposicion por oportunidad, % de comercios con al menos un cliente nuevo y cuota del 20 % de
arriba.

## 4. Que registrar DESDE EL DIA UNO (lo que no se puede reconstruir despues)

- **Por decision:** pedido que la disparo, cliente, comercio A, local, hora local, origen de la ubicacion (GPS o ultimo
  escaneo), version de la politica, `ε`, numero sorteado, si fue control y quien habria salido. Tambien las compras con
  **0 elegibles** (para ver que comercios nunca son candidatos).
- **Por candidato:** campaña, comercio, local, rubro, distancia, abierto en la vigencia, cupo restante, segmento del
  cliente respecto de ese comercio (nuevo / dormido / habitual, dias desde la ultima visita, cantidad de visitas), los
  factores (`c`, `a`, y despues `r`, `m`) y la **probabilidad final**.
- **Resultado:** el cupon emitido; push enviado y abierto; el canje (ya existe en `core.coupon_redemption`); cualquier
  compra en B dentro de la vigencia aunque no canjee; si fue su primera visita a B y si volvio despues sin cupon.

## 5. El grupo de control

- **Cliente que nunca fue a B:** el canje es casi seguro incremental (en cupones tipo Groupon ~80 % eran clientes
  nuevos; Dholakia, encuesta, fuente media). Ahi el owner tiene razon y no hace falta control.
- **Dormido o habitual:** parte vuelve solo; el canje sobrestima. Y a la vez puede **subestimar**: en 70 experimentos de
  campo, el 90 % de la ganancia de las ofertas no vino por el canje sino por mas compras de quienes no canjearon
  (Sahni et al., Management Science 2016, fuente fuerte).
- **Lo mas barato:** sin control para «nuevo para B»; control solo para dormidos y habituales **cuando junten volumen**
  (~2.000 decisiones del segmento; hoy no mediria nada en meses), o un mes de control por trimestre. Lo que no se
  puede postergar es **registrar el segmento** desde el dia uno.

## 6. Fuentes principales

Singh y Joachims, KDD 2018 (equidad de exposicion); Morik et al., SIGIR 2020 (FairCo: relevancia + bono al atrasado);
Wang et al., ICML 2021 (bandits con equidad de exposicion); Patil et al., JMLR 2021 (piso por brazo); Mehrotra et al.,
CIKM 2018 (Spotify, equidad hacia artistas); Geyik et al., KDD 2019 (LinkedIn, en produccion con A/B); Steck, RecSys
2018 (calibracion); Li et al., WSDM 2011 (evaluacion fuera de linea); Sahni et al., Management Science 2016; Ohashi et
al., KDD 2024 workshop (Mercari; su ventaja sobre las alternativas sale de evaluaciones sobre datos de experimentos,
no se confirmo en produccion). Enlaces en el informe del agente; las fuentes debiles (blogs de anfitriones de Airbnb,
un caso personal de difference-in-differences) no sostienen ninguna recomendacion.
