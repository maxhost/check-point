---
spec: 0099
fecha: 2026-09-26
estado: implementada
resumen: Endurece toClientProgram a lista blanca explicita (hoy filtra businessId, createdBy, schemaVersion, termsHash, termsUpdatedAt y el stampImageVersion crudo al owner via un spread) y consolida el contrato vigente de las 4 rutas de /api/loyalty-program en un anexo unico, corrigiendo el codigo 403 que el anexo 0079 dejo desactualizado tras la 0086.
disjunta: si — no toca ningun archivo de la 0098 (UI de loyalty, "sin backend")
archivos: apps/merchant/src/server/loyalty-program/client-view.ts, apps/merchant/src/server/loyalty-client-view.test.ts, docs/specs/0099-contratos-de-api.md, docs/INDEX.md
---

# 0099 — El DTO del programa a lista blanca, y el contrato vigente consolidado

> **Plantilla CHICA (ADR 0071).** Un solo dominio (la lectura de `/api/loyalty-program`),
> sin migraciones, sin decision de producto abierta: las dos correcciones son de higiene
> de lo YA decidido, no una decision nueva.

## Problema

1. **`toClientProgram` filtra 6 columnas internas al owner por un spread, no por eleccion**
   (`server/loyalty-program/client-view.ts:66-84`): desestructura solo `stampImageObjectKey`
   y devuelve `...rest` de la fila completa de `loyalty_program`. Eso deja pasar
   `businessId`, `createdBy` (un `userId`), `schemaVersion`, `termsHash`, `termsUpdatedAt` y
   el `stampImageVersion` crudo (redundante — ya viaja codificado en `stampImagePath`).
   **Medido que ninguno de los 6 lo lee nadie:** `rg` sobre
   `apps/merchant/src/app/backoffice/loyalty` y `apps/consumer/src` no encuentra un solo uso,
   y ninguno esta en el tipo cliente (`app/backoffice/loyalty/loyalty-types.ts:17-36`). No es
   una fuga de secretos hoy (no hay nada sensible en esas 6 columnas), pero es la unica
   superficie del dominio loyalty que no sigue el patron de lista blanca del resto del
   repo — `toRewardDTO`, en el mismo archivo (`client-view.ts:45-59`), si arma el objeto
   campo por campo.
2. **`redeemAllowInsufficient` no tiene oraculo en el DTO.** Existe en la columna
   (`server/schema/loyalty.ts:63-65`) y en el tipo cliente (`loyalty-types.ts:35`), pero
   ningun test — ni `loyalty-program.test.ts:214-259` ni `loyalty-client-view.test.ts` —
   asegura que `toClientProgram` lo exponga. Un typo futuro en la construccion del DTO
   pasaria los 6 gates sin que nadie lo note.
3. **El anexo `docs/specs/0079-contratos-de-api.md` §4 quedo desactualizado.** Documenta
   `403 not_owner` para `PUT /api/loyalty-program` (y por extension `GET`, que comparte
   guard). Desde la spec 0086 el guard real es `requireApiPermission` /
   `requireApiPermissionSinGateDeEmail` (`server/api-permission.ts:183-203`), que devuelve
   `403 not_member` (sin membresia activa) o `403 missing_permission` (falta el permiso
   `loyalty`) — `not_owner` sobrevive intacto solo en `DELETE` y `PATCH`, que siguen en
   `requireApiOwner` por ser irreversibles. Quien integre contra el 0079 solo, sin cruzarlo
   con el 0086, va a ramificar mal ese error. No es el unico caso: el contrato completo de
   este dominio esta repartido en 7 anexos (`0069/0072/0078/0079/0081/0084/0086-contratos-de-api.md`)
   que hay que leer en orden cronologico para reconstruirlo.

## Alcance

**Entra:**
- Reescribir `toClientProgram` con una lista blanca explicita de campos (§ Diseño).
- Un test que asegure que las 6 columnas internas NO se sirven y que
  `redeemAllowInsufficient` SI se sirve.
- Un anexo nuevo, `docs/specs/0099-contratos-de-api.md`, que consolida el contrato VIGENTE
  de las 4 rutas de `/api/loyalty-program` (mas `/qr`, `/stamp-upload` y
  `/api/loyalty-terms/templates` por remision) en un solo documento, con los `code`
  corregidos.

**No entra:**
- Cambiar el contrato de ESCRITURA de `PUT` (cuerpo, campos obligatorios/opcionales,
  status de exito): eso es el 0079 §2-3 y no cambia una coma.
- Habilitar `tiers` o `cashback`: sigue siendo una decision de dominio aparte (ADR 0076 §6).
- Tocar `consumer/programs.ts`: ya arma su propia lista blanca
  (`toConsumerProgramSummary`, `server/consumer/programs.ts:94-155`) y llama a
  `toClientProgram` con un objeto de 3 campos, no con la fila completa — verificado, no
  hay nada que endurecer ahi.
- Ningun `.tsx`. Ningun cambio de UI.
- Editar los 7 anexos viejos: quedan como registro historico. El anexo nuevo es la
  referencia vigente y los declara superados en ese punto puntual.

## Diseño

### 1. `toClientProgram` a lista blanca

`ProgramRow` deja de tener indice abierto (`[key: string]: unknown`) y pasa a declarar
exactamente los campos que el tipo cliente `Program` (`loyalty-types.ts:17-36`) consume:

```
id, kind, configuration, status, activatedAt, earningEndsAt, redemptionEndsAt,
termsMarkdown, stampImageObjectKey, stampImageVersion, cardBackgroundColor,
cardBackgroundColor2, cardBackgroundGradientAngle, cardBorderColor,
redeemAllowInsufficient, accrualMode?, accrualGrant?, accrualBlockAmount?
```

La funcion construye el objeto de salida CAMPO POR CAMPO (sin `...rest` ni spread de la
fila de entrada), en el mismo estilo que `toRewardDTO`:

```
{ id, kind, configuration, status, activatedAt, earningEndsAt, redemptionEndsAt,
  termsMarkdown, cardBackgroundColor, cardBackgroundColor2, cardBackgroundGradientAngle,
  cardBorderColor, redeemAllowInsufficient, stampImagePath: <computado, igual que hoy>,
  accrual: <computado, igual que hoy>, rewards: <computado, igual que hoy> }
```

`stampImageObjectKey` sigue sin viajar nunca (se recibe en `ProgramRow` para calcular
`stampImagePath` via la ruta publica, pero no se copia al objeto de salida).
`businessId`, `createdBy`, `schemaVersion`, `termsHash`, `termsUpdatedAt`, `createdAt` y
`updatedAt` no forman parte de `ProgramRow`: si algun caller los pasa, TypeScript los
ignora en la construccion explicita (no hay forma de que entren por accidente).

`route.ts` (`GET`, linea ~120) no cambia una linea: sigue llamando
`toClientProgram(result.program, result.business.id, result.rewards)`. `result.program`
sigue siendo lo que devuelve `db.select()` en `owner.ts:69-79` (todas las columnas); lo
que cambia es que `toClientProgram` ahora solo TOMA de ahi los campos de la lista, en vez
de devolver la fila entera menos una clave.

### 2. El test nuevo, en `loyalty-client-view.test.ts`

Un caso que arma un `ProgramRow` con `businessId`, `createdBy`, `schemaVersion`,
`termsHash`, `termsUpdatedAt` y `redeemAllowInsufficient: true` en la entrada (los
primeros 5 NO son parte del tipo `ProgramRow` nuevo, asi que el test los agrega via un
`as` para simular una fila de DB real) y verifica:

- `JSON.stringify(dto)` no contiene `businessId`, `createdBy`, `schemaVersion`,
  `termsHash` ni `termsUpdatedAt`.
- `dto.redeemAllowInsufficient` es `true`.

### 3. El anexo `0099-contratos-de-api.md`

Mismo formato que `0079`/`0086` (convenciones, base URL, cookie de sesion, `code` como
contrato). Secciones obligatorias, sin dejar nada "a definir":

1. **Los 4 verbos de `/api/loyalty-program`**, tabla verbo → guard → codigo emitido en
   cada paso de la escalera, TAL COMO ESTA HOY (`GET`/`PUT` con `not_member` /
   `missing_permission` / `email_not_verified` solo-owner / `business_suspended` /
   `business_closed`; `DELETE`/`PATCH` con `not_owner` literal), citando
   `server/api-permission.ts:183-203` y `server/api-owner.ts` como fuente.
2. **El cuerpo de `PUT`**: remite integro a `0079-contratos-de-api.md` §2-3 (no se
   reescribe, para no duplicar una tabla que no cambio) y aclara en una linea que SOLO el
   codigo 403 de guard cambio, via la 0086.
3. **La salida de `GET`**: la forma exacta del DTO post-0099 (la lista blanca de arriba),
   con un ejemplo de JSON completo.
4. **`DELETE` y `PATCH`**: remite a `0079-contratos-de-api.md` §0 y al codigo actual de
   `route.ts:204-252`, sin cambios de comportamiento.
5. **Una nota de procedencia**: que este anexo consolida y corrige (no reemplaza como
   documento historico) `0069/0072/0078/0079/0081/0084/0086-contratos-de-api.md` para el
   dominio loyalty, y que ante una discrepancia futura este es el vigente por fecha.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/loyalty-program/client-view.ts` | editar |
| `apps/merchant/src/server/loyalty-client-view.test.ts` | editar |
| `docs/specs/0099-contratos-de-api.md` | crear |
| `docs/INDEX.md` | editar |

**Disjunta?** Si. No colisiona con la spec 0098 en curso (UI de loyalty, declarada "sin
backend", no toca `server/`) ni con ninguna otra spec abierta.

## Definition of Done

- [ ] `rg -n "\.\.\.rest|\.\.\.program" apps/merchant/src/server/loyalty-program/client-view.ts` → sin resultados en `toClientProgram` (ya no hay spread de la fila de entrada).
- [ ] El test nuevo de §Diseño-2 pasa.
- [ ] Los tests existentes de `toClientProgram` (`loyalty-program.test.ts`,
      `loyalty-client-view.test.ts`, `loyalty-stamp-placeholder.neon.integration.test.ts`)
      siguen en verde sin editarlos (usan `toMatchObject` / aserciones puntuales, no el
      shape completo — verificado antes de escribir esta spec).
- [ ] `docs/specs/0099-contratos-de-api.md` existe con las 5 secciones de §Diseño-3.
- [ ] Fila en `docs/INDEX.md`.
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`. (`test:e2e` no aplica: no se toca ningun `.tsx` ni CSS.)

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Revertir `toClientProgram` a `{ ...rest, stampImagePath, accrual, rewards }` (el spread de hoy) | El test nuevo de §Diseño-2: `businessId`/`createdBy`/`schemaVersion`/`termsHash`/`termsUpdatedAt` vuelven a aparecer en `JSON.stringify(dto)` |
| 2 | Borrar `redeemAllowInsufficient` de la construccion explicita del DTO | El test nuevo de §Diseño-2: `dto.redeemAllowInsufficient` deja de ser `true` |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir →
etiqueta `MUTATION` → medir y transcribir la salida ejecutada → revertir con `diff`
contra copia limpia. De a una.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente»,
se corta y va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **`activatedAt` esta en el tipo cliente y no lo lee ninguna pantalla hoy**
  (`rg` sobre `app/backoffice/loyalty` sin resultados). Se mantiene en la lista blanca
  porque es parte del contrato ya publicado en `loyalty-types.ts` y no es interno —
  removerlo seria una decision de contrato, no de higiene, y esta spec no la toma.
- El costo de "5 round-trips por `PUT`" que la 0079 dejo declarado en `TASKS.md` no se
  toca: es una nota de eficiencia sin relacion con el DTO de lectura.

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El
revisor produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

## Abierto

Ninguno.
