---
adr: 0092
fecha: 2026-09-26
estado: aceptada
resumen: Una campaña PREARMADA (ADR 0091) es una fila de `core.campaign` con `template_key`, creada y activada en un solo paso, con UNA corrida viva por plantilla y negocio. Sus parametros quedan CONGELADOS mientras corre: cambiarlos es apagarla (= FINALIZAR, irreversible) y encender una corrida nueva, porque «si cambia parametros las estadisticas se vuelven irrelevantes» (owner). Corre en todos los locales usables menos los que el comercio excluye. Cuando dos campañas del mismo negocio se disputan a un consumidor, gana la de MAYOR `dormant_days` (el perdido recibe el mensaje de perdido), por orden determinista del tick.
---

# 0092 — Una plantilla es una corrida con parametros congelados

## Contexto

El ADR 0091 decidio el modo PREARMADO: el comercio enciende un toggle y edita pocos parametros.
La spec 0101 lo implementa sobre el motor de proximidad existente (spec 0065) con dos plantillas,
«Te extrañamos» y «Recuperar perdidos». Al diseñarla aparecieron cuatro preguntas que el owner
contesto el 2026-09-26, y un hecho medido del arbol:

- `loadActiveCampaigns` (`server/marketing/audience-store.ts:43`) no tiene `ORDER BY`, y el tick
  inserta los turnos campaña por campaña con `on conflict do nothing` sobre el unico parcial
  `(business_id, consumer_id)` de turnos vivos (`audience-store.ts:198`). Con dos campañas del
  mismo negocio cuyo publico se solapa, **cual se queda con el consumidor es azar**.

## Decision

1. **Plantilla = `campaign.template_key`** (`null` = campaña custom). El catalogo de plantillas
   (textos, opciones, defaults) vive en CODIGO, no en la base: es producto, versionado con el
   deploy.
2. **Una corrida viva por (negocio, plantilla)**, garantizada por un unico parcial en la base
   sobre los estados `draft`/`active`/`paused`. Encender = crear **y** activar en una sola
   transaccion.
3. **Parametros congelados** (owner: «hay que detenerla y lanzar una nueva, por una cuestion de
   estadisticas»). Una campaña con `template_key` no admite `PATCH` en ningun estado. Pausar y
   reanudar SI (no cambian parametros; el freno por plan del ADR 0065 §12 las pausa).
4. **Apagar = FINALIZAR** (owner). Es irreversible, asi que sigue la regla del ADR 0079 §2: solo el
   owner. Volver a encender crea una corrida NUEVA; las anteriores quedan como historial con sus
   resultados.
5. **Locales:** todos los del negocio que el tick puede usar (`active` y geocodificados) **menos
   los que el comercio excluya** al encender (owner: «todos los locales, pero puede desactivar
   locales»). Se fijan al encender, como el resto de los parametros. *(Que un local creado DESPUES
   no entre hasta la proxima corrida es consecuencia de la decision 3, no una decision aparte:
   ORQUESTADOR.)*
6. **Solapamiento: gana el MAYOR `dormant_days`** (owner: «gana 5 de momento»). Se implementa
   ordenando `loadActiveCampaigns` por `dormant_days desc` con desempate estable: la primera
   campaña que evalua a un consumidor se queda con el turno. Rige para TODAS las campañas del
   negocio, custom incluidas. El owner declaro que va a revisar estas reglas (posiblemente
   impedir activar plantillas similares) — esto es el comportamiento de hoy, no el final.

## Consecuencias

- Migracion aditiva: `template_key` nullable con `CHECK` sobre las claves conocidas y su unico
  parcial. Las campañas existentes quedan `null` (custom), sin cambio de comportamiento salvo el
  orden determinista del tick.
- Un turno encolado por «Te extrañamos» a los 85 dias sigue siendo de esa campaña si el consumidor
  cruza los 90 antes de colocarse: el orden decide al ENCOLAR. Limite declarado.
- Un integrante con permiso `marketing` puede encender una plantilla pero no apagarla (apagar es
  finalizar). Es la misma asimetria que ya tienen `activate` y `end`.
- El compositor custom y sus rutas siguen intactos; su pantalla se borra cuando exista la UI nueva
  (owner, 2026-09-26).

## Alternativas descartadas

- **Editar en caliente aplicando a turnos nuevos.** Mezcla dos configuraciones en los mismos
  resultados. Descartada por el owner.
- **Bandas disjuntas explicitas** (`dormant_days_max` en «Te extrañamos» atada a la otra
  plantilla). Acopla dos filas: encender, editar o apagar una recalcularia la otra. El orden del
  tick da el mismo resultado sin columna ni acople.
- **Apagar = pausar.** El owner eligio finalizar: una corrida es una unidad de medicion.
