# Venta cruzada: que es «lo justo» para un comercio (hipotesis y simulacion)

2026-10-03, para el ADR 0117. Pregunta del owner: «¿que significa que a un comercio le toque lo justo?» — «No lo se,
deberiamos investigar y proponer hipotesis o pensamientos sobre esto». Contexto: `venta-cruzada-criterio.md` y
`venta-cruzada-algoritmo.md` (la loteria con boletos).

## 1. Las hipotesis

| | «Justo» significa… | Lo premia | Lo castiga |
|---|---|---|---|
| **H1** | **Igual por oportunidad:** cada vez que un comercio es candidato (cerca, otro rubro, con cupo), cuenta igual que los demas; el que va atrasado recibe mas boletos | a todos por igual | a nadie; ignora quien convierte mejor |
| **H2** | **Segun su cupo:** el que pone mas cupones al mes recibe mas exposicion | al que invierte | al chico que pone poco |
| **H3** | **Segun sus canjes:** mas exposicion al que mas canjea, pero repartida (no «gana el mejor») | al que le sirve mas al cliente | al nuevo, que todavia no tiene canjes |
| **H4** | **H1 + bono al que no tiene clientes nuevos este mes** (idea de Mercari: el primer cliente de un comercio vale mas que el vigesimo de otro) | al que esta en cero | — |
| control | «Gana el mejor» (Thompson) y «la mas cercana» | — | — (son las referencias a evitar) |

## 2. La simulacion (red INVENTADA: compara politicas, no predice la real)

Script: `docs/notificaciones/sim_equidad.py` (`python3 sim_equidad.py <compras> <chicos|grandes>`, 30 semillas). 12
comercios en 6 rubros sobre 3×3 km; **3 «estrellas»** que canjean al 30 % y 9 chicos al 4–12 %; 400 clientes con gustos
por rubro; un mes de compras; en cada compra en A sale UNA oferta entre los elegibles; 20 % de azar parejo en H1–H4.

**Cupos grandes (no se agotan), 3000 compras:**

| Politica | Canjes de la red | Desigualdad de envios (Gini, 0 = parejo) | Comercios con ≥ 3 canjes (de 12) | Canjes del peor comercio | % de canjes en las 3 estrellas |
|---|---|---|---|---|---|
| La mas cercana | 339 | 0,54 | 8,6 | 0,2 | 47 % |
| Gana el mejor (Thompson) | **600** | 0,71 | 5,9 | **0,0** | **95 %** |
| **H1** igual por oportunidad | 301 | **0,18** | **11,8** | 5,4 | 53 % |
| H2 segun su cupo | 300 | 0,18 | 11,9 | 6,1 | 53 % |
| H3 segun sus canjes | 403 | 0,30 | 11,3 | 2,5 | 71 % |
| **H4** H1 + bono | 309 | **0,18** | **11,9** | **6,2** | 53 % |

Con 600 compras (poco volumen) el orden es el mismo.

**Cupos chicos (se agotan), 3000 compras:** todas las politicas dan casi lo mismo (Gini 0,36 en todas, 81–89 canjes):
cada comercio termina entregando su cupo entero, elija lo que elija la politica.

## 3. Lo que muestra

1. **«Gana el mejor» hace exactamente lo que el owner no quiere:** el doble de canjes de la red, pero las 3 estrellas
   se llevan el 95 % y el peor comercio no consigue ninguno.
2. **«La mas cercana» tambien es injusta, por otra razon:** depende de donde cayo cada local (Gini 0,54); el que esta
   un poco mas lejos casi no existe.
3. **H1/H4 reparten de verdad:** casi todos los comercios llegan a 3+ canjes y el peor consigue ~6, a cambio de **la
   mitad de canjes totales** que «gana el mejor». **Ese es el trade-off real: alcance de la red contra canjes totales.**
4. **H3 queda en el medio:** +34 % de canjes que H1, pero las estrellas vuelven al 71 % y el peor baja a 2,5.
5. **Cuando el cupo se agota, el cupo ES la equidad:** en una zona con mucho movimiento, lo que reparte es cuanto pone
   cada comercio, no el algoritmo. H2 solo se distingue de H1 en ese caso — y la simulacion con cupos grandes no lo
   mide (todos tenian el mismo cupo enorme): **limite declarado**.
6. **El bono de H4 sobre H1 es chico** (peor comercio 5,4 → 6,2): ayuda, no cambia el cuadro.

## 4. Propuesta (opinion del orquestador)

**Arrancar con H4** (igual por oportunidad + bono al que no tiene clientes nuevos), que es la que mejor encaja con
la obsesion del owner: que todo comercio de la red tenga clientes nuevos. Y dejar **una perilla** entre H4 y H3 (cuanto
pesan los canjes de cada comercio), para correrla con datos reales si los canjes totales de la red resultan muy bajos.
Mirar cada mes las dos cosas a la vez: canjes de la red y cuantos comercios lograron clientes nuevos.

## 5. Lo que tiene que decidir el owner

- La hipotesis de arranque (H1, H2, H3 o H4).
- Si acepta el trade-off: con H4, en esta red inventada, la red canjea ~la mitad que con «gana el mejor», pero casi
  todos los comercios consiguen clientes.
