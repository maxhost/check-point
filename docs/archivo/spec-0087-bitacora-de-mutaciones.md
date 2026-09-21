# Bitacora de mutaciones — spec 0087 (ABIERTA ANTES DE MEDIR)

Restauracion de emergencia (NO usar `git checkout` en staff-create.ts: se lleva el trabajo no
commiteado; staff-rename.ts es `??` y no tiene blob):
  cp /tmp/0087/staff-create.clean.ts /Users/maxi/claude-workspace/check-point/apps/merchant/src/server/staff-create.ts
  cp /tmp/0087/staff-rename.clean.ts /Users/maxi/claude-workspace/check-point/apps/merchant/src/server/staff-rename.ts

| id | archivo | shasum limpio | git status | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|---|
| M1 | staff-rename.ts | ad0a6c46ce01b5ed57e113407b513361a5c09cf9 | ?? | la ruta deja de chequear `"permissions" in body` | ROJO — 11 failed / 26 passed. unit: «expected function to throw an error, but it didn't» (6 casos de presencia) + «promise resolved … instead of rejecting»; integracion: «expected 200 to be 400» en los 4 casos de `permissions`. REVERTIDA (diff vacio, shasum ok). |
| M2 | staff-rename.ts | ad0a6c46ce01b5ed57e113407b513361a5c09cf9 | ?? | el chequeo pasa de PRESENCIA DE CLAVE a VALOR distinto del actual | ROJO — 1 failed / 36 passed. integracion, caso «los permisos ACTUALES»: «AssertionError: expected 200 to be 400». El unit file queda VERDE (el doble no puede proveer el conjunto actual): alcance declarado. REVERTIDA (diff vacio, shasum ok). |
| M3 | staff-rename.ts | ad0a6c46ce01b5ed57e113407b513361a5c09cf9 | ?? | la derivacion pierde el `excludeUserId` (freeHandle pelado) | ROJO — 2 failed / 35 passed. unit: «expected { handle: 'carla-2' } to deeply equal { handle: 'carla' }»; integracion: «expected 'carla-sola-2@rentest-a-…' to be 'carla-sola@rentest-a-…'». REVERTIDA (diff vacio, shasum ok). |
| M4 | staff-create.ts | 627d225b3ad42a2320e098c6213efbc8b00d6bf0 | ' M' | la derivacion deja de pasar por `nextSuggestion` (slugify pelado) | ROJO — 8 failed / 43 passed en los CUATRO archivos del alcance. alta: «expected 'admin@la-farmacia' to be 'admin-2@la-farmacia'» y «'000@…' vs '000-2@…'» + staff.neon «resolves a handle collision with a suffix»; renombre unit: «{handle:'marcos'} vs {handle:'marcos-2'}» y «{handle:'admin'} vs {handle:'admin-2'}»; renombre integracion: «expected 409 to be 200» (el 409 es handle_taken: sin nextSuggestion el renombre choca contra el unico) + 2 rojos COLATERALES por el mismo choque. REVERTIDA (diff vacio, shasum ok). |
| M5 | staff-rename.ts | ad0a6c46ce01b5ed57e113407b513361a5c09cf9 | ?? | el UPDATE pierde el `business_id` del WHERE (aislamiento) | ROJO — 1 failed / 36 passed. integracion, aislamiento: «expected 200 to be 404» (el staff de B se renombra desde A). REVERTIDA (diff vacio, shasum ok). |

Alcance de cada medicion (archivos que pueden ver la mutacion):
- M1,M2,M3,M5: src/server/staff-rename.test.ts + src/server/staff-rename.neon.integration.test.ts
- M4: ademas src/server/staff-create.test.ts + src/server/staff.neon.integration.test.ts (freeHandle es COMPARTIDA con el alta)

## Mutacion extra (encargo del coordinador tras el PASS) — presupuesto 1, ABIERTA ANTES DE MEDIR

| id | archivo | shasum limpio | git status | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|---|
| M6 | staff-rename.ts | 98d9f2729adf351a0f10471cfdaac1531178474b | ?? | `rejectionFor` pierde el `business_id` del `WHERE`: el owner de OTRO negocio pasaria de 404 a 409 `target_is_owner` (filtra existencia e identidad) | ROJO — 1 failed / 38 passed. Integracion, caso de aislamiento: «AssertionError: expected 409 to be 404» sobre `expect(ownerAjeno.status).toBe(404)`. El vector del INTEGRANTE ajeno (peonB) del mismo caso sigue verde bajo la mutacion, que es lo que prueba que el owner ajeno es el unico que la distingue. REVERTIDA (diff vacio contra /tmp/0087/staff-rename.clean2.ts, shasum 98d9f27… ok). |

Copia limpia: /tmp/0087/staff-rename.clean2.ts
Alcance: src/server/staff-rename.test.ts + src/server/staff-rename.neon.integration.test.ts
Asercion que TIENE que ponerse roja: `expect(ownerAjeno.status).toBe(404)` en el caso de aislamiento.

## Mutacion de la ENMIENDA §5 (presupuesto 5 -> 6) — ABIERTA ANTES DE MEDIR

| id | archivo | shasum limpio | git status | invariante que ataca | resultado EJECUTADO |
|---|---|---|---|---|---|
| M7 | staff-rename.ts | 20c48702e8e286166248363e95b03f7c09057c5d |  M (ya commiteado por el coordinador) | el chequeo de `status` se hace ANTES del scope por negocio: el `disabled` de OTRO negocio pasaria de 404 a 409 `staff_disabled`, filtrando existencia y estado | ROJO — LECTURA 2 (arbol final): 1 failed / 42 passed, y el unico rojo es el previsto: staff-rename-status.neon.integration.test.ts > «un `disabled` de OTRO negocio → 404 `staff_not_found`, NO 409» con «AssertionError: expected 409 to be 404». Sin colaterales. REVERTIDA (diff vacio contra /tmp/0087/staff-rename.clean3.ts, shasum 20c48702… ok). |

Copia limpia: /tmp/0087/staff-rename.clean3.ts — shasum 20c48702e8e286166248363e95b03f7c09057c5d
Alcance: staff-rename.test.ts + staff-rename.neon.integration.test.ts + staff-rename-status.neon.integration.test.ts
Asercion que TIENE que ponerse roja: `expect(response.status).toBe(404)` del tercer caso de staff-rename-status.

LECTURA 1 (antes de arreglar el doble): ROJO 2 failed / 40 passed. (a) staff-rename-status, `disabled`
de OTRO negocio: «expected 409 to be 404» — el oraculo previsto. (b) COLATERAL en staff-rename.test.ts,
caso del OWNER: recibio `staff_disabled` porque el doble devolvia `{role:'owner'}` SIN `status`, y
`status` es NOT NULL en la base. Se arreglo el DOBLE (no el test): `targetRows` lleva `status` siempre,
y se agrego el caso unit `disabled -> 409 staff_disabled`. Re-medicion abajo sobre el arbol final.
