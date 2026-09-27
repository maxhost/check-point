---
adr: 0097
fecha: 2026-09-27
estado: aceptada
resumen: La plantilla #4 «Cliente en riesgo» (`at_risk`) es una plantilla de reactivacion como #3/#5 (proximidad, push o ambos; cupon opcional) cuya audiencia es el cliente HABITUAL que rompio su ritmo — ≥3 dias distintos con compra, ausencia ≥ N dias (14/30/45, default 14: owner) y ausencia > 2× su intervalo promedio entre visitas. 3 y 2× son FIJOS de plataforma (el owner delego: «elegí una cosa»). En el grupo `reactivation` queda en el MEDIO de la escalera (#3 rango 1 → #4 rango 2 → #5 rango 3): un cliente avisado con #4 todavia recibe #5 si se pierde. En proximidad las plantillas se ordenan por rango antes que por dias.
---

# 0097 — «En riesgo» es el cliente habitual que rompio su ritmo

## Contexto

El catalogo (ADR 0091) tiene #4 «Cliente en riesgo» como la ultima plantilla de reactivacion sin
catalogo de premios. Owner, 2026-09-26: «arranca con ≥3 visitas y ausencia > 2× su ritmo»,
EDITABLE; grupo REACTIVACION #4 > #5 > #3 (ADR 0095). Owner, 2026-09-27 (AskUserQuestion, textual):
- parametros: «el ritmo ni yo lo comprendo. elije una cosa. asi puedo crear la UI para luego
  comprender mejor como funciona y como el merchant deberia tener control sobre elo»;
- piso: «el cliente empieza a estar en riesgo luego de 14 dias sin visita … puedes estudiar como lo
  considera fivestars o tailone o perkstar»;
- grupos: «armalo de alguna manera para que podamos probar, luego nos centraremos en los grupos. lo
  importante es el concepto»;
- canales: «Como #3/#5» (proximidad, push o ambos; cupon opcional, no recomendado).

**Estudiado (2026-09-27, verificado en las fuentes):**
- Fivestars AutoPilot usa SOLO dias sin venir: At-Risk «15, 30, or 45 days», Lapsed 30–150, Lost
  180/270/365 (blog.fivestars.com/set-up-autopilot-for-customer-retention-success). Sin ritmo.
- Talon.One no define umbrales (es motor de promociones); en su marco RFM «At-Risk (low recency,
  strong historical value): Win-back campaigns» (talon.one/blog/match-incentives-to-customer-segments).
- Perkstar agrupa en «Champions, Regulars, New, Slipping, At risk or Lost» pero no publica el
  criterio (perkstar.co.uk).

**Medido en el arbol:** una visita no existe como entidad; lo que hay es `core."order"` (una fila por
acreditacion, `schema/order.ts:31`) y `core.reward_redemption`. Varias ordenes el mismo dia son una
sola visita para cualquier lectura de «ritmo». `core.business.timezone` existe (`schema/business.ts:84`).
Con el rango 3 que el ADR 0095 le reservaba, la regla de grupos «escala, nunca baja» hace que un
cliente avisado con #4 no reciba nunca #5 en esa ausencia (`templateKeysAtOrAbove`, `templates.ts:163`).

## Decision

1. **#4 es una plantilla de reactivacion mas** (`at_risk`), con el mismo `enable`, los mismos canales
   y el mismo cupon opcional que #3/#5. `dormant_days` es el PISO de ausencia: opciones 14/30/45
   (14 del owner; 30/45 de Fivestars), default 14.
2. **Audiencia = dormido (regla de siempre) Y habitual que rompio su ritmo** *(ORQUESTADOR, por
   delegacion del owner)*: visitas = dias distintos con compra en el negocio, en su `timezone`; ritmo
   = (ultima compra − primera compra) / (visitas − 1); en riesgo si visitas ≥ **3** y
   `now − ultima compra` > **2 ×** ritmo. Es la «historia fuerte + baja recencia» del RFM de Talon.One
   con el piso de dias de Fivestars. 3 y 2× son constantes del catalogo, visibles en `GET templates`
   y NO editables hasta que el owner lo vea en la UI.
3. **Escalera #3 → #4 → #5** *(ORQUESTADOR, por delegacion)*: rangos 1, 2, 3 (#5 pasa de 2 a 3; es
   codigo, no base). Un cliente avisado con #4 no recibe #3 en esa ausencia pero SI #5 si sigue sin
   volver; si califica a #4 y #5 en el mismo tick, gana #5 (ya esta perdido). Revisa el «#4 > #5 > #3»
   del ADR 0095 en el orden, no en el modelo de grupos.
4. **Proximidad ordenada por rango**: el tick evalua las campañas con proximidad por rango de plantilla
   desc, despues `dormant_days` desc (hoy solo esto); el compositor custom (sin plantilla) va despues de
   las plantillas. Sin esto, #3 a 30 d le ganaria el turno a #4 a 14 d a todo habitual con > 30 d.
5. **Un canje NO es una visita para el ritmo** (solo compras, igual que el «dormido» de #3/#5); el gate
   de entrega sigue cancelando por canje (spec 0104 §7).

## Consecuencias

- Migracion chica: solo el check `core_campaign_template_key_check` suma `at_risk`.
- Un cliente con 3 visitas en dos años (ritmo ~1 año) no entra nunca a #4: le toca #3/#5. Es deseado.
- El compositor custom pierde contra cualquier plantilla en proximidad; se declara (se borra con la UI
  nueva, ADR 0070 §17).
- `audience-preview` (del compositor) no conoce el ritmo: no aplica a plantillas.
- Los grupos, el control del ritmo por el comercio y la eleccion 3/2× se revisan con la UI (owner).
