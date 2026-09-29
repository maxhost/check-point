---
adr: 0102
fecha: 2026-09-29
estado: aceptada
resumen: Cada cliente esta en UNA etapa de ciclo de vida por negocio (bienvenida, activo, te extrañamos, en riesgo, perdido, irrecuperable), calculada por dias desde su ultima visita con una ESCALERA POR RUBRO (`category_gcid`, 16 filas cargadas a mano; `gcid:store` y lo desconocido usan la de relleno). #3/#4/#5 siguen siendo campañas sueltas, pero cada una solo le habla a los clientes de SU etapa y REPITE con un calendario (#3 cada 7 o 14 segun elija el comercio; #4 y #5 con los dias del rubro); lo salteado no se reprograma. El cupon de bienvenida vigente sin usar saca al cliente de todas. #7/#8 salen sueltos solo en «activo» y, en una etapa de reactivacion, se SUMAN al mensaje de la etapa. Reemplaza el ritmo del ADR 0097 y la regla de grupos del ADR 0095 §5 para reactivacion.
---

# 0102 — Cada cliente esta en una sola etapa, y los dias son del rubro

## Contexto

Las plantillas de reactivacion miran **pisos abiertos** de dias sin venir (`audience.ts:124-127`,
`push-audience.ts:60-63`: `dormantSince > dormantFloor`), no franjas: un cliente con 100 dias califica a
#3, #4 y #5 a la vez y la superposicion la resuelve el rango (proximidad: orden de `loadActiveCampaigns`,
`audience-store.ts:57`; push: regla de grupos del ADR 0095 §5, `push-audience.ts:66`). #4 ademas pide el
ritmo del ADR 0097 (`at-risk.ts`). Cada plantilla manda **un** push por ausencia. Los dias son los
mismos para una cafeteria que para una peluqueria. En prod no hay ninguna campaña todavia (medido el
2026-09-29 por SQL sobre `red-violet-38772073`/`main`: `core.campaign` 0 filas, 5 negocios, rubros
`gcid:bar` y `gcid:cafe`).

**Decisiones del owner (2026-09-29, `docs/TASKS.md` seccion «MARKETING — ETAPAS», textuales resumidas):**
modelo «cada cliente en UNA etapa»; bienvenida activa + cupon sin usar → solo el recordatorio de canje;
#3 «el merchant elige 7 o 14 dias; se REPITE con esa cadencia hasta caer en riesgo («a 7 → 4 mensajes en
un mes; a 14 → 2»)»; (1) cupon de bienvenida vencido sin usar → la etapa que le toca por dias desde que
se anoto; (2) «En riesgo» solo por dias («deja sin efecto la regla de ritmo del ADR 0097»); (4) sin
respiro minimo entre mensajes («2 dias entre etapas no me parece mal»); (5) dias de cada etapa POR RUBRO;
calibrar con los datos del negocio («C») queda para despues; (6) #5 = opcion A: 14/60/90 contados desde
el PRIMER mensaje (dias 91, 105, 151, 181) y despues irrecuperable; (7) #4 se repite cada 21 dias
escalado por rubro; (8) los offsets de #5 se escalan con el rubro; (9) «campañas SUELTAS», no un
recorrido unico («da la impresion de tener mas opciones»), la exclusion por etapa la garantiza el motor;
(10) #7/#8 solo en etapa activo; (12) la tabla por rubro se carga A MANO, sin formula; (13) heladeria
sin pausa invernal; (14) gimnasio: Perdido 46/60/120/181, irrecuperable 181; (15) #7/#8 «SI se suman al
mensaje de la etapa de reactivacion («ademas el texto es editable»)».

**Y las cuatro de esta sesion (AskUserQuestion, 2026-09-29):** fin de «activo» = «Lo que eligió» (los
dias de #3 del comercio; con #3 apagada, T1 del rubro); dias de #7/#8 = «Solo opciones que entran»
(las menores al T1 del rubro); suma de #7/#8 = «En cada envío» mientras siga calificando; proximidad =
«Solo respeta la etapa», sin cadencia propia.

**Insumo:** `research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md` (tabla de 16 filas, fuentes
verificadas por el orquestador; investigacion de mercado resumida en `docs/TASKS.md`: Fivestars
At-Risk/Lapsed/Lost, Toast 28 d, Klaviyo «lo salteado no se reprograma», Braze exit criteria).

## Decision

1. **Etapa = funcion pura del cliente en el negocio.** `d` = tiempo desde `dormantSince` (la ultima
   compra, o el alta si nunca compro — el mismo instante de siempre, `audience.ts:106`). En orden:
   - **bienvenida**: tiene el cupon de bienvenida de esa membresia (`welcome_membership_id`) sin canje y
     con `valid_until > ahora`, sin importar `d` ni si la campaña de bienvenida sigue encendida;
   - **activo**: `d < A`, con `A` = los dias de la corrida viva de #3 (lo que eligio el comercio) o, sin
     #3 viva, el T1 del rubro;
   - **te extrañamos**: `A ≤ d < R`; **en riesgo**: `R ≤ d < P`; **perdido**: `P ≤ d < I + 1 dia`;
   - **irrecuperable**: `d ≥ I + 1 dia` — no recibe nada de reactivacion.
2. **La escalera es del rubro** (`core.business.category_gcid`) y es PRODUCTO, en codigo, cargada a
   mano (tabla de la spec 0110, copia de `CONSOLIDADO.md`): T1/T2, los mensajes de riesgo, P, los
   mensajes de perdido; `I` = el ultimo mensaje de perdido. Un `gcid` sin fila (`gcid:store`, el relleno
   de la columna) usa la fila `gcid:store`. No se congela en la corrida (ADR 0092 §3): cambia con el
   deploy, como cambiaban las constantes del ritmo. Lo unico congelado es la eleccion de #3 (`A`, en
   `dormant_days`).
3. **Campañas sueltas con exclusion por etapa.** #3/#4/#5 siguen siendo tres plantillas que se
   encienden por separado; cada una le habla SOLO a los clientes de su etapa, por proximidad y por push.
   Con una etapa apagada, sus clientes no reciben nada: no los toma la de al lado.
4. **Calendario por plantilla (push).** Dias de mensaje: #3 = `A, 2A, 3A, …` mientras `< R`; #4 = los
   del rubro (cafe 30, 51, 72); #5 = los del rubro (cafe 91, 105, 151, 181). **Regla del tramo:** el
   mensaje vigente es el ultimo dia del calendario `≤ d`; se decide si no hay, del mismo template y
   cliente en el negocio, una decision no cancelada (holdout incluido) desde `dormantSince + ese dia`.
   Lo salteado NO se reprograma (Klaviyo): encender #4 con un cliente en el dia 60 le manda el mensaje
   del 51 y el siguiente sera el del 72. Sin respiro minimo entre mensajes (owner (4)).
5. **Proximidad: solo la etapa.** El turno de una plantilla de reactivacion exige la etapa de la
   plantilla en lugar del piso de dias; la cadencia de proximidad sigue siendo la de siempre (un turno
   vivo por negocio, enfriamiento 30 d, `DEFAULT_PLACEMENT_LIMITS`). El compositor custom no cambia.
6. **#7/#8.** Sueltos solo en etapa **activo** (y nunca en bienvenida). Sus opciones de dias pasan a
   ser las del catalogo MENORES al T1 del rubro (cafe: #7 → `[3]`, #8 → ninguna: solo sale sumado); una
   corrida cuyo `dormant_days` no esta entre las opciones de su rubro no sale suelta. **Suma:** si #7
   (o #8) tiene corrida activa y el cliente califica por saldo (cerca del premio con los umbrales de esa
   corrida / premio ya alcanzado), cada push de #3/#4/#5 lleva `«mensaje de la etapa» · «texto de #7/#8»`
   (`{faltan}` resuelto). No escribe una decision de #7/#8: el envio es de la campaña de la etapa.
7. **Lo que se va.** El ritmo del ADR 0097 (`at-risk.ts`, el campo `atRisk` del catalogo, `visit_days`
   y `first_order_at` de los loaders) y, para reactivacion, la regla de grupos «desde la ultima visita,
   una de rango ≥» del ADR 0095 §5 (la reemplaza la etapa + el tramo). La regla de grupos del grupo
   `balance` (#7/#8) queda como esta.

*(ORQUESTADOR — a validar con el OK de la spec)*: el borde de «perdido» es `I + 1 dia` para que el
ultimo mensaje tenga un dia de ventana (el tick corre cada 6 h); el default de #3 es T2 (el mas calmo,
como el default 30 de hoy sobre 14/30); la suma de #7/#8 es solo push (la proximidad no la lleva); una
etapa distinta de la plantilla se cuenta como `not_dormant` («no es el publico»), igual que el ritmo.

## Consecuencias

- **Frecuencia:** un cliente de cafeteria que no vuelve recibe hasta 4 (#3 a 7) + 3 (#4) + 4 (#5) = 11
  push por ausencia de ese negocio, en ~6 meses. Sin tope global (ya declarado en el ADR 0095). Toast
  pone 1 automatico cada 28 d; aca no, por decision (4).
- Sin migracion: `dormant_days` guarda la eleccion de #3 (T1/T2 caben en 3..365), y para #4/#5/#8 un
  valor informativo. Prod no tiene campañas, asi que no hay corridas con la semantica vieja.
- `GET /api/marketing/templates` pasa a depender del negocio (opciones por rubro + bloque `ladder`) y
  pierde `atRisk`; la UI tiene que borrar su bloque del ritmo (contrato `specs/0110-contratos-de-api.md`).
- La medicion de #7/#8 no cuenta los envios sumados (no hay `campaign_push` suyo).
- La calibracion con los datos del negocio («C»: el ritmo propio del cliente, que restaurante, barberia
  y farmacia recomendaron) queda para despues (owner (5)).

## Alternativas descartadas

- **Un recorrido unico (Braze Canvas).** El owner eligio campañas sueltas (9).
- **Formula para derivar la tabla** (`0,7 × R`, offsets × `P/90`): no reproducia su propia tabla
  (`0,7 × 45` → 31, no 32); owner (12): a mano.
- **Reprogramar lo salteado** (mandar todos los mensajes viejos al encender): con el tick cada 6 h, un
  #4 encendido tarde mandaria dos push en 6 horas.
- **Respiro minimo entre mensajes:** el «7 d» era del orquestador, sin fuente; owner (4): no.
