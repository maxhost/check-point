---
spec: 0150
fecha: 2026-10-04
estado: cerrada
resumen: TEMPORAL. Login de QA sin link magico para las 3 cuentas de prueba (Panaderia, Barberia, Gym): `GET`/`POST /api/merchant/auth/qa-login`, con lista fija de 3 cuentas en el servidor y apagado por variable (`QA_LOGIN_ENABLED`). Los botones del login los pone GPT. Se borra al terminar las pruebas.
disjunta: si
archivos: apps/merchant/src/server/qa-login.ts, apps/merchant/src/app/api/merchant/auth/qa-login/route.ts, tests
---

# 0150 — Login de QA sin link magico (temporal)

## Problema

- El owner prueba bienvenida y venta cruzada con tres comercios de prueba en PROD (Panaderia, Barberia, Gym) y
  cambia de cuenta seguido. El merchant solo entra por link magico (`apps/merchant/src/server/auth.ts:70`, plugin
  `magicLink`, `expiresIn: 900`); el staff entra por PIN (`app/api/merchant/auth/staff/route.ts`), pero estas cuentas son
  `owner`.
- Decision del owner (2026-10-04), elegida entre tres opciones y con el riesgo explicado: **«Botones en el login»**: tres
  botones en el formulario de login que lo logueen con un click. «Esto es solo para test, los eliminaremos luego».

## Alcance

**Entra:** la API (servidor + ruta) y su contrato, abajo. Tests.

**No entra:**
- Los botones del login: zona de GPT (ADR 0114), contra el contrato de abajo.
- Cualquier otra cuenta. La lista es fija en el codigo; no se lee de la base, de una variable ni del cliente.
- Rate limit propio: la ruta solo puede abrir sesion de esas 3 cuentas, y el apagado es la variable.

## Diseño

**Cuentas** — constante en `apps/merchant/src/server/qa-login.ts` (medidas en PROD el 2026-10-04, las tres `owner`
`active` con un solo comercio):

| `account` | Comercio (`business_id`) | `user_id` |
|---|---|---|
| `panaderia` | Panaderia `f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0` | `13b520cd-54a7-4acc-9072-06162a7a1993` |
| `barberia` | Barberia `c512bbd2-b203-43f6-8fe5-24778387a331` | `2857ac6d-2df0-4b25-9e45-77ecadea3a32` |
| `gym` | Gym `02e37e89-66a4-4d1e-9f92-d83e6f4856af` | `481c2661-a756-48e9-bb15-3b182cb16e49` |

**Apagado:** la ruta existe solo si `process.env.QA_LOGIN_ENABLED === "true"` (comparacion exacta). Si no → `404` en
`GET` y en `POST`, con cuerpo `{ "error": "No encontrado.", "code": "not_found" }`. Se lee en
cada request (no en el import), para que apagarla en Vercel sea cambiar la variable + redeploy, sin codigo.

**`GET /api/merchant/auth/qa-login`** → `200 { "accounts": [{ "account": "panaderia", "label": "Panaderia" }, …] }` en
el orden de la tabla. No devuelve `user_id` ni `business_id`. La UI muestra los botones **solo** si esto da 200.

**`POST /api/merchant/auth/qa-login`** `{ "account": "panaderia" | "barberia" | "gym" }`, en este orden:
1. apagada → `404 not_found`;
2. cuerpo que no es JSON o `account` que no esta en la tabla → `400 invalid_body`;
3. se verifica en la base que el `user_id` sigue siendo miembro `owner` `active` de ESE `business_id` y que el comercio
   tiene `status = 'active'` (`core.business_membership.role/status`, `packages/db/src/schema/membership.ts:35-37`). Si no →
   `403 qa_account_unavailable` (nunca abre sesion);
4. `openMerchantSession(userId)` (sin `onboardingGrantUntil`) → `200 { "redirectTo": "/backoffice" }` con `Set-Cookie`.
5. error de base → `503 qa_login_unavailable`.

Cada login exitoso se registra con `console.info("[qa-login]", account)` (queda en los logs de Vercel).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/qa-login.ts` | crear (tabla, `qaLoginEnabled()`, decision pura `resolveQaAccount`) |
| `apps/merchant/src/app/api/merchant/auth/qa-login/route.ts` | crear |
| `apps/merchant/src/server/qa-login.test.ts`, `…/qa-login/route.test.ts` | crear |

**Disjunta?** Si. GPT toca solo la pantalla de login, contra el contrato.

## Definition of Done

- [ ] Sin `QA_LOGIN_ENABLED` (y con `"1"`, `"TRUE"`, `"true "`) → `GET` y `POST` 404. Con `"true"` → `GET` 200 con las 3.
- [ ] `POST` con `account` fuera de la tabla (`"admin"`, un uuid, `""`, ausente) → 400; nunca llama a `openMerchantSession`.
- [ ] `POST` valido → 200 con `Set-Cookie` de la sesion; la cookie abre sesion del `user_id` de la tabla (Neon: ida y vuelta
      con `auth.api.getSession` como en `staff-pin.neon.integration.test.ts`).
- [ ] Membresia no `owner`/no `active` o comercio no `active` → 403 `qa_account_unavailable` sin sesion (Neon, con un
      seed en la rama de CI vía `tools/neon-test.sh`, nunca PROD: puede sembrar esas uuids con limpieza, o la decisión
      recibe la tabla como parámetro y el test inyecta la suya).
- [ ] El test del `GET` asevera las claves EXACTAS de cada cuenta (`account`, `label`): ni `userId` ni `businessId`.
- [ ] `pnpm verify` en verde con Node 24, una vez al final, tabla transcripta.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `qaLoginEnabled` acepta cualquier valor no vacio (`!!env`) | unidad «`"1"` → apagada» |
| 2 | el `POST` acepta un `userId` del cuerpo si no hay `account` | ruta «cuerpo `{ userId }` → 400, sin sesion» |
| 3 | borrar la verificacion de membresia del paso 3 | Neon «membresia `disabled` → 403» |
| 4 | cableado: la ruta no llama a `qaLoginEnabled` | ruta «sin variable → 404» |

## Declarado AFUERA (sin oraculo, a proposito)

- **Riesgo aceptado por el owner:** con la variable prendida, cualquiera que llegue al login de produccion puede entrar a
  esas 3 cuentas de prueba (y desde ahi usar lo que el owner puede: campañas, push a sus clientes de prueba, importacion
  con IA). Mitigacion: solo 3 cuentas fijas, apagado por variable, log de cada entrada.
- CSRF de login (un sitio ajeno que te loguee en una cuenta de prueba): sin chequeo de `Origin`; consecuencia acotada a
  cuentas de prueba.

## Handoff

UN implementador, UN revisor. **Al terminar las pruebas: borrar esta ruta, `qa-login.ts`, sus tests, los botones (GPT) y
la variable de Vercel.**

## Abierto

Nada que bloquee.
