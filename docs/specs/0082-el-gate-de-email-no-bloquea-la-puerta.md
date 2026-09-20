---
spec: 0082
fecha: 2026-09-19
estado: implementada
resumen: El gate de email deja de rebotar en la PUERTA del backoffice — el owner sin verificar ENTRA y ve el panel (ADR 0070 §11, paso 2 textual del owner), y lo que sigue bloqueado son las ACCIONES. Las 11 superficies de API ya gatean por feature; lo unico que falta es el MOSTRADOR, que hoy no tiene gate en ninguna linea y pasa a exigir email verificado SOLO al owner (el staff no tiene email por diseño).
disjunta: si
archivos: apps/merchant/src/server/auth-guards.ts, apps/merchant/src/server/auth-guards.test.ts, apps/merchant/src/app/api/counter/_auth.ts, apps/merchant/src/server/counter/core.ts, docs/specs/0067-contratos-de-api.md
---

# 0082 — El gate de email no bloquea la puerta, bloquea las acciones

> **Plantilla CHICA (ADR 0071).** Un solo dominio (control de acceso), sin migraciones, y la
> decision de producto **ya esta tomada** por el owner: ADR 0070 §11 (textual, 2026-09-16) y la
> confirmacion del mostrador (2026-09-19, ver §Diseño 3).

## Problema

**El owner con el email sin verificar no puede ENTRAR al backoffice, y eso contradice sus propias
palabras.** ADR 0070 §11 registra el flujo que dicto, textual:

> *«para el alta no pedimos verificacion. Una vez estemos en la cuenta, alli para iniciar el
> onboarding, basicamente cualquier accion si requerimos verificar el email»*

y sus tres pasos, donde el **2** es *«Entra a su cuenta directamente al terminar el wizard y ve el
onboarding»* y el **3** es *«El primer paso del onboarding es verificar el email»*. Para ver ese
primer paso hay que estar **adentro**. Hoy no se entra.

- **`server/auth-guards.ts:141-143`** — `requireBackofficeSession` hace
  `redirect('/?e=email_not_verified')` para `role === 'owner'` con `emailVerified !== true`. Rebota
  en la puerta: bloquea las **8 paginas del backoffice y el mostrador** de una, no las acciones.
  **Reproducido en prod el 2026-09-19** por el owner: terminado el wizard, «Ir a mi panel» aterriza
  en `https://www.checkpass.club/?e=email_not_verified`.
- **Por que nadie lo vio antes:** la spec 0067 que lo implemento declara en su propio alcance
  *«no tiene ninguna forma de entrar al producto por navegador hasta que aterrice la UI de afuera…
  el QA de pantalla de esta spec no se puede hacer»*. El defecto entro en un arco donde el
  backoffice era inalcanzable **a proposito**. Recien con la UI del owner en pie se ve.
- **El principio contrario ya estaba fijado y solo se aplico a medias:** ADR 0076 bajo el gate
  *«de la PUERTA HTTP al WRITER»*, pero solo en `saveProgram`. El guard de paginas quedo como
  estaba.
- **Y queda un hueco real del lado opuesto: el mostrador no tiene gate de email en ninguna linea.**
  `app/api/counter/_auth.ts` no menciona `emailVerified` (0 matches) y `operatorBusiness`
  (`server/counter/core.ts:77-94`) **ni siquiera selecciona `memberships.role`**. Hoy eso no se nota
  porque la puerta rebota antes; sacada la puerta, un owner sin verificar acreditaria sellos.

**Lo que hace seguro sacar el rebote, medido y no supuesto:**

- `server/api-owner-surfaces.test.ts` pinea **13 entradas HTTP**; las que **no** llevan el paso 3
  del email son **exactamente dos** (el QR y la escritura del programa, las excepciones cerradas de
  ADR 0076 §3). Las otras **11 responden 403 `email_not_verified`** al owner sin verificar, con
  **fail-closed** cuando falta la clave.
- **Cero server actions en el backoffice:** `rg -l '"use server"' apps/merchant/src/app/backoffice/`
  → **0 archivos**. Las 8 paginas son lecturas detras de `requireOwner`; toda escritura sale por la
  API ya gateada.
- `GET /api/merchant/session` **ya devuelve `emailVerified`** (`session/route.ts:68`), asi que la UI
  de afuera puede renderizar el «verifica tu email» como primer paso del onboarding sin API nueva.

## Alcance

**Entra:**

1. Sacar el rebote por email de `requireBackofficeSession` y **exponer `emailVerified`** en
   `BackofficeSession`, para que las paginas server puedan mostrar el primer paso del onboarding.
2. Poner el gate de email en el **mostrador**, dentro de `requireOperator`, **solo para `role =
   'owner'`**, con 403 `email_not_verified`.
3. Que `operatorBusiness` devuelva el `role` **al lado** del negocio, que es lo que hoy impide
   distinguir owner de staff en el mostrador.
4. Invertir los oraculos que pineaban el rebote y agregar los del mostrador.
5. Actualizar el contrato `0067-contratos-de-api.md`: `email_not_verified` **sale de la tabla de
   codigos de rebote** (el guard de paginas ya no lo emite) y entra como 403 de las 4 rutas del
   mostrador.

**No entra:**

- **Las 11 superficies de API ya gateadas**: no se toca una linea. Su gate es el que sostiene esta
  spec.
- **Las dos excepciones de ADR 0076 §3** (QR y escritura del programa): siguen sin paso 3.
- **Los rebotes `staff_disabled` y `business_closed`**: intactos, con su orden y su revocacion.
- **UI**: ninguna. ADR 0070 §16 — el arco entrega API, la pantalla la construye el owner. Esta spec
  no crea ni edita un solo `.tsx`.
- **Migraciones**: ninguna. `memberships.role` ya existe.
- **El permiso de alta** (ADR 0076 §2): no se toca; gobierna escrituras del alta, no la puerta.

## Diseño

### 1. `requireBackofficeSession` deja de rebotar por email

Se borran las dos lineas del `redirect` (`auth-guards.ts:141-143`) y la constante
`EMAIL_NOT_VERIFIED` queda **sin ningun uso de produccion**: se borra tambien (su unico consumidor
era ese `redirect`).

El orden del resto **no cambia**: sin sesion → `/`; sin membresia → `/`; membresia `disabled` →
revoca la sesion y `/?e=staff_disabled`; negocio `closed` → `/?e=business_closed`.

`BackofficeSession` suma **`emailVerified: boolean`**, leido de la sesion de better-auth con la
misma forma fail-closed que ya usa el resto del repo (`=== true`, no `!!`): una fila vieja o un
doble incompleto se lee como **sin verificar**. No agrega consulta: `getSession` ya trajo la fila.

**Consecuencia declarada:** un owner sin verificar ahora **ve** las 8 paginas y el mostrador. Cada
accion que intente muere con 403 en la API. Es exactamente el paso 2 del owner.

### 2. El mostrador gatea por email, y solo al owner

En `requireOperator` (`app/api/counter/_auth.ts`), **despues** de resolver el negocio y **antes**
del eje `status`:

```
si business.role === 'owner' y session.user.emailVerified !== true
  → 403 { error: "Verificá tu email para operar el mostrador.", code: "email_not_verified" }
```

**Como llega el `role`, y por que NO va adentro de `OperatorBusiness`:** hoy
`operatorBusiness` (`server/counter/core.ts:77-94`) selecciona `{id, currencyCode, status}` y
**no trae `memberships.role`**. Pasa a devolver **`{ business, role }`** — el `role` **afuera** del
objeto de negocio, no adentro. El motivo es la leccion que ya esta escrita en `auth-guards.ts`
(ADR 0055): *«dos ejes distintos con el mismo nombre es como uno termina decidiendo por el otro»*.
`OperatorBusiness` viaja como argumento a los cuatro escritores del dominio (`grant.ts:191`,
`redeem.ts:100`, `resolve.ts:136`, `coupon.ts:42`); meterle la membresia adentro le mete un eje que
esos escritores no tienen por que ver. **Ripple medido: 2 call-sites** — `_auth.ts:28` (produccion)
y `counter-redeem-guards.neon.integration.test.ts:66-67`, cuya asercion pasa de
`toMatchObject({id})` a leer `.business`. Ningun otro consumidor cambia.

- **`role === 'owner'` no es una optimizacion, es la trampa central.** El staff no tiene email por
  diseño (`@staff.invalid`, spec 0067 §4, que nunca se entrega). Si el gate lo alcanzara, **el
  mostrador quedaria muerto para siempre** y ninguna accion podria desbloquearlo. Es la misma nota
  que ya vive en `auth-guards.ts` y la mutacion #1 de esta spec.
- **`!== true`, no `!`**: fail-closed ante `undefined`.
- **Las 4 rutas quedan cubiertas** porque las 4 pasan por `requireOperator`:
  `counter/resolve`, `counter/grant`, `counter/redeem`, `counter/coupon-redeem` — **las cuatro
  son `POST`**, verificado con `grep -o 'export async function [A-Z]*'` sobre las cuatro rutas.
  **`resolve` es semanticamente una lectura y se gatea igual**, a proposito: es el primer paso de
  acreditar, y la decision del owner fue «el mostrador» como unidad, no ruta por ruta.

**El ORDEN respecto del eje `status` es una decision, no un descuido:** el email va **antes** que
`businessStatusFailure`, que es el orden de ADR 0073 §1 y el que ya usan `requireApiOwner` y
`requireBackofficeSession`, *«para que las dos superficies contesten lo mismo ante el mismo
caller»*. **Cambia un caso observable:** un owner sin verificar sobre un negocio `suspended` pasa
de recibir `business_suspended` a recibir `email_not_verified`. Queda pinneado por un test propio.

**Y NO rompe el oraculo del eje `status` que ya existe, medido:**
`business-status.neon.integration.test.ts:144` y `:199` son los dos unicos lugares que ejercitan
`requireOperator`, y los dos lo hacen con **`staffCookie`**, no con el owner. Como el gate nuevo
solo alcanza a `role === 'owner'`, ese archivo queda verde **sin editarlo** — y el DoD lo exige asi.

### 3. Que autoriza y que no — la regla completa despues de esta spec

| Superficie | Owner sin verificar |
|---|---|
| **Entrar** a `/backoffice` y sus 8 paginas (lecturas) | **PASA** ← lo que arregla esta spec |
| Las 11 superficies de API owner-only | 403 `email_not_verified` (ya estaba) |
| QR y escritura del programa (ADR 0076 §3) | PASA, con el permiso de alta (ya estaba) |
| **Mostrador** (4 rutas) | **403 `email_not_verified`** ← lo que agrega esta spec |
| Staff sin email, en cualquier lado | **PASA** — no tiene email por diseño |

**Decision textual del owner (2026-09-19), al preguntarle exactamente por el mostrador:**
*«mostrador, tambien entra en cualquier accion requiere verificar email»*.

### 4. Contrato

En `docs/specs/0067-contratos-de-api.md`:

- **Tabla «Codigos de rebote»**: se **saca la fila `email_not_verified`**. Ese codigo ya no viaja
  por `?e=` porque ningun guard de pagina lo emite. Quedan `staff_disabled` y `magic_link_invalid`.
  La nota «Gemelo de API» se reescribe: el motivo **solo** existe como 403 de API.
- Se agrega la fila `403 email_not_verified` a las 4 rutas del mostrador, con la aclaracion de que
  **un integrante nunca lo recibe**.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/auth-guards.ts` | editar — borrar el rebote y la constante; sumar `emailVerified` a `BackofficeSession` |
| `apps/merchant/src/server/auth-guards.test.ts` | editar — **invertir** los 2 oraculos del rebote; ajustar la asercion del contrato |
| `apps/merchant/src/app/api/counter/_auth.ts` | editar — gate de email para `role='owner'` |
| `apps/merchant/src/server/counter/core.ts` | editar — `role` en `OperatorBusiness` y en el `select` |
| `apps/merchant/src/server/counter-email-gate.test.ts` | crear — los oraculos del mostrador. **Ubicacion por convencion medida**: los 15 tests del mostrador viven en `src/server/` con prefijo `counter-`, ninguno en `app/api/counter/`. **Patron**: dobles con `vi.mock('./auth')`, igual que `api-owner-surfaces.test.ts` — rapido y sin Neon |
| `apps/merchant/src/server/counter-redeem-guards.neon.integration.test.ts` | editar — 2 aserciones (`:66-67`) que leen la forma de `operatorBusiness`; la intencion del test no cambia |
| `docs/specs/0067-contratos-de-api.md` | editar — §Codigos de rebote y las 4 rutas del mostrador |

**Disjunta?** **Si.** No colisiona con ninguna spec en ejecucion: el arco 0077–0081 esta
implementado y desplegado, y ninguna de sus rutas se toca.

## Definition of Done

- [ ] `rg -n "EMAIL_NOT_VERIFIED" apps/merchant/src` → **0 matches** (constante borrada con su uso).
- [ ] `rg -n "e=email_not_verified" apps/merchant/src` → **0 matches**.
- [ ] Un owner con `emailVerified: false` **atraviesa** `requireBackofficeSession` y el contexto que
      devuelve trae `emailVerified: false` (no redirige, no revoca).
- [ ] Un owner **sin** la clave `emailVerified` tambien atraviesa, y el contexto dice `false`
      (fail-closed en el DATO, no en la puerta).
- [ ] `requireOperator` con owner `emailVerified: false` → **403** con `code: "email_not_verified"`.
- [ ] `requireOperator` con owner **sin** la clave → **403** igual (fail-closed).
- [ ] `requireOperator` con **staff** `emailVerified: false` → **pasa** (la trampa del `@staff.invalid`).
- [ ] `requireOperator` con owner `emailVerified: true` → pasa.
- [ ] Owner sin verificar sobre negocio `suspended` → `email_not_verified`, **no** `business_suspended`
      (el orden de ADR 0073 §1).
- [ ] `api-owner-surfaces.test.ts` **sigue verde sin editarlo**: las 11 superficies no se tocan.
- [ ] `business-status.neon.integration.test.ts` **sigue verde sin editarlo**: el eje `status` del
      mostrador se ejercita con staff, a quien el gate nuevo no alcanza.
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`.
- [ ] `test:e2e` **solo si aplica**: `git status --porcelain | grep -c '\.tsx$'` → si da **0**, no
      corre y se declara (esta spec no toca UI).
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | En el gate del mostrador, **borrar la condicion `role === 'owner'`** | «staff sin verificar opera el mostrador» → 403. **Es la mutacion que importa**: sin este oraculo, el mostrador queda muerto para siempre y ningun otro test lo nota |
| 2 | En el gate del mostrador, `!== true` → `=== false` | «owner SIN la clave `emailVerified` → 403» pasa a verde-falso (fail-open) |
| 3 | Borrar el gate de email del mostrador entero | «owner con `emailVerified:false` → 403 `email_not_verified`» |
| 4 | Re-poner el `redirect('/?e=email_not_verified')` en `requireBackofficeSession` | «owner sin verificar ENTRA» → vuelve a redirigir. Prueba que el oraculo invertido MUERDE y no es una asercion decorativa |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia limpia.
De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta y
va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- **Que la UI muestre el paso «verifica tu email».** Es trabajo del owner (ADR 0070 §16). Esta spec
  entrega el dato por dos vias que ya existen o se agregan aca (`GET /api/merchant/session` y
  `BackofficeSession.emailVerified`), no la pantalla.
- **El QA de pantalla de este cambio.** Lo corre el owner sobre el deploy; el checklist se agrega a
  `docs/QA-arco-0076.md` al cerrar.
- **Las 11 superficies de API**: su gate ya esta medido por `api-owner-surfaces.test.ts` y esta spec
  se apoya en el sin re-probarlo. Si ese test se cayera, esta spec pierde su piso — por eso el DoD
  exige verlo verde **sin editarlo**.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

## Abierto

Nada. Las dos decisiones de producto estan tomadas y son textuales del owner: ADR 0070 §11 (entrar
si, acciones no) y la del mostrador (2026-09-19, §Diseño 3).
