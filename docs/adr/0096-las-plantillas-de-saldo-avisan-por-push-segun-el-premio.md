---
adr: 0096
fecha: 2026-09-27
estado: aceptada
resumen: Las plantillas de SALDO #7 «Te falta poco» y #8 «Premio sin canjear» son plantillas solo-push y sin cupon del grupo fijo `balance` (#8 > #7), sobre el canal de la 0103. La audiencia es la de dormidos MAS una condicion sobre el saldo contra el premio mas barato del programa operativo (la misma lectura que la bolsa de utilidad): #7 = le falta poco (≤ N sellos o ≤ P % de puntos), una vez por ciclo de canje; #8 = ya tiene el premio, una vez o cada 30 d (max 2) por ausencia. El faltante va en el mensaje con el marcador `{faltan}` (owner), renderizado por cliente al decidir. Un canje despues de la decision cancela el push como `visited`.
---

# 0096 — Las plantillas de saldo avisan por push segun el premio

## Contexto

El catalogo (ADR 0091) tiene #7 «Te falta poco» y #8 «Premio sin canjear» como las primeras lanzables
sin catalogo de premios. La 0103 (ADR 0095) dejo el canal push, los grupos (`group`/`rank`) y la
decision en `core.campaign_push`. Parametros propuestos al owner el 2026-09-26 (en `docs/TASKS.md`):
#7 umbral 1/2/3 sellos o ≤10/20 % puntos, dias sin venir 3/7/14, una vez por ciclo, sin premio; #8
dias 7/14/30, repeticion una vez | cada 30 d max 2, sin premio; SALDO #8 > #7; NO a sellos/puntos
dobles. Decisiones del 2026-09-27 (AskUserQuestion): el faltante con **marcador `{faltan}`** en el
mensaje; **defaults** #7 = 2 sellos / 20 %, 7 d; #8 = 14 d, una vez.

Medido: puntos y sellos no vencen; el canje DEBITA (`counter/redeem-plan.ts:64`); hay un solo programa
operativo por negocio (`schema/loyalty.ts:137`); el costo del premio ya se lee en
`marketing/utility-text.ts` (Sellos: `configuration.target`; Puntos: el premio mas barato con costo
entero ≥ 1).

## Decision

1. **Dos plantillas del grupo `balance`**: `near_reward` (#7, rango 1) y `unclaimed_reward` (#8, rango
   2). Canales del catalogo: **solo `push`** (la bolsa de utilidad del pase ya dice «te faltan N» /
   «tenes un premio para canjear» por proximidad). **Sin cupon** (`couponAllowed: false`).
2. **Audiencia = dormido + condicion de saldo.** Dormido con la misma `dormantSince` de siempre. El
   «costo» es el del premio mas barato del programa OPERATIVO del negocio, leido como la bolsa de
   utilidad; sin programa o sin costo usable, nadie es elegible.
   - #7: `saldo < costo` y `faltante ≤ N sellos` (Sellos) o `faltante · 100 ≤ costo · P` (Puntos).
     La campaña guarda LOS DOS umbrales y aplica el del tipo del programa al momento del tick.
   - #8: `saldo ≥ costo`.
3. **Frecuencia.** Regla de grupos de la 0095 (desde la ultima visita, rango mayor o igual), mas:
   - #7 **una vez por ciclo**: no se decide si ya hay una decision no cancelada de #7 desde
     `max(alta, ultimo canje)`.
   - #8 **reemplaza la regla de si misma por su repeticion**: `once` = una decision por ausencia;
     `every_30_days` = hasta 2 por ausencia, separadas por ≥ 30 d. (Nada esta por encima de #8.)
   - El holdout cuenta como decidido (igual que la 0095).
4. **Texto.** El mensaje de #7 admite `{faltan}`, que al decidir se reemplaza por el faltante de ESE
   cliente («2 sellos», «1 sello», «15 puntos», «1 punto»). Opcional: sin marcador el texto es fijo.
   Otra plantilla con `{faltan}` → 400. Se congela al encolar, como todo push.
5. **Un canje es una visita para el gate.** El gate al entregar (0103 §6) cancela `visited` tambien si
   hay un `reward_redemption` de la membresia posterior a la decision — para TODAS las plantillas.
6. **`kind` sigue en `proximity`**; en una plantilla la audiencia la define `template_key`.

## Consecuencias

- Sin tope global (owner), un cliente puede recibir en la misma ausencia un push de SALDO y uno de
  REACTIVACION del mismo negocio: grupos distintos. *(Consecuencia a declarar.)*
- La conversion de #7/#8 se mide igual que la de todo push (compra en 7 d); el canje no se mide aparte.
- `dormant_days` baja su piso de 7 a 3 en la base (la opcion «3 dias» de #7); el compositor sigue
  validando 7..365.

## Alternativas descartadas

- **Faltante agregado automaticamente al final** (recomendado): el owner prefirio el marcador.
- **Un umbral unico segun el programa al activar**: si el negocio cambia de programa, la campaña
  quedaria con un umbral de la unidad equivocada.
- **`kind = 'balance'`**: obligaria a tocar compositor, resultados y checks por un dato que
  `template_key` ya da.
