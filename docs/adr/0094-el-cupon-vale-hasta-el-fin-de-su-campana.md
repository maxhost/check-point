---
adr: 0094
fecha: 2026-09-26
estado: aceptada
resumen: Supersede el §4 del ADR 0093. Un cupon de campaña emitido vale desde que se emite hasta la FECHA DE FIN de su campaña (`ends_at`, snapshot al emitir), aunque la campaña se pause o se finalice antes y aunque su turno se cancele; lo cortan solo esa fecha, el canje o el tope. Por eso una campaña con cupon EXIGE fecha de fin (check en la base + 400 `validation` en el compositor y en las plantillas). Avisarle al comercio que apagar no anula los cupones es trabajo de UI.
---

# 0094 — El cupon vale hasta el fin de su campaña

## Contexto

El ADR 0093 §4 decia, como propuesta del orquestador pendiente de confirmacion, que un cupon emitido
lo cortaban la campaña no `active` o la ventana del turno (5 dias). Al pedirle el OK, el owner
respondio (2026-09-26, textual): «si el cliente apaga la campaña, los cupones deberia seguir siendo
validos dentro de la fecha en la que se creo la campaña es decir si la campaña va del 1/9 al 30/9 los
cupones emitidos serian validos dentro de ese periodo. si el merchant apaga la campaña se le avisa
eso, es una cuestion de UI» (typos corregidos; «cliente» leido como el COMERCIO por la segunda frase —el
consumidor no puede apagar una campaña—, interpretacion del orquestador).

Medido: las plantillas se encienden sin `ends_at` por defecto (`template-input.ts`: `endsAt` ausente
→ `null`), y el compositor tambien lo permite. Preguntado que pasa entonces, el owner eligio (mismo
dia): **obligar fecha de fin** a toda campaña con cupon. «Finalizar» escribe `ended_at` y no toca
`ends_at` (`campaign-actions.ts:117`), asi que la fecha de fin sobrevive al apagado.

## Decision

1. **Vigencia:** `valid_from` = el momento de emision (para la proximidad, `window_start` del turno);
   `valid_until` = `campaign.ends_at` **copiado al emitir**. Editar despues la fecha de una campaña
   custom pausada no reescribe cupones ya dados (misma regla de snapshot del 0093 §1).
2. **Lo que NO corta un cupon emitido:** pausar o finalizar la campaña, archivarla, ni la cancelacion
   de su turno por cualquier motivo. Lo cortan solo: `now` fuera de `valid_from..valid_until`, el
   canje, o el tope de canjes de la campaña (`coupon_max_redemptions`), que sigue rigiendo.
3. **Campaña con cupon ⇒ `ends_at` obligatorio.** Lo garantiza un `CHECK` en `core.campaign`
   (`coupon_label is null or ends_at is not null`), y el compositor (crear y `PATCH`) y el `enable`
   de plantillas lo rechazan antes con 400 `validation` en el campo `endsAt`.
4. **Aviso al comercio:** que apagar no anula los cupones emitidos lo comunica la UI (owner). La API
   no agrega confirmaciones.

## Consecuencias

- El caso «el scan no pinta el cupon de una campaña pausada» (spec 0065) se invierte: ahora lo pinta.
- El costo de una campaña con cupon puede seguir corriendo despues de apagarla, hasta `ends_at`. El
  tope de canjes es el techo.
- Prod tiene 0 campañas (SQL, 2026-09-26): el `CHECK` nuevo no encuentra filas que lo violen.
