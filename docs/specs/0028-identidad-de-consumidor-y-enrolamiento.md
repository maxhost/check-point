---
spec: 0028
fecha: 2026-08-14
estado: cerrada
resumen: Landing pública de enrolamiento (nombre+apellido+teléfono → cuenta de consumidor de plataforma SIN verificar + membresía aislada al programa + QR personal + sesión) en un esquema pg `consumer`. La verificación de teléfono por OTP se difiere a la spec de recuperación (0032); no se envía ningún mensaje al enrolar.
disjunta: sí
archivos: apps/merchant/src/server/schema/consumer.ts, apps/merchant/src/server/consumer/*, apps/merchant/src/app/api/public/enroll/*, apps/merchant/src/app/(consumer)/enroll/*, apps/merchant/drizzle/00XX_*.sql
---

# 0028 — Identidad de consumidor y enrolamiento

> **Primera rebanada del "camino A"** (ADR 0031). Es la fundación sobre la que cuelgan el
> pase de Wallet (spec 0029), la acreditación en mostrador (spec 0030), la notificación +
> landing en vivo (spec 0031) y la recuperación por OTP (spec 0032).
>
> **Decisión de costo/fricción (2026-08-14):** el enrolamiento **no verifica** el teléfono ni
> envía SMS. El teléfono es la clave de identidad pero queda `phone_verified_at = null`. La
> verificación por OTP se difiere a la spec 0032 (recuperación), donde recién ahí hay un
> proveedor de mensajería. Motivo: un SMS a Ecuador cuesta ~$0.25–0.34, y el valor (puntos/
> sellos) se acredita contra el **QR al portador**, no contra el teléfono — así que verificar
> al enrolar no protege nada del loop y sí encarece cada alta.

## Problema

Hoy no existe ninguna noción de cliente/consumidor en el sistema: la única "membresía" es la
de staff/owner de un comercio (`core.business_membership`). Cuando una persona escanea el QR
de un local para sumarse a su programa de fidelidad, no hay dónde crear su identidad, no hay
forma de reusar sus datos si mañana se enrola en otro comercio, y no hay un identificador
suyo (su QR personal) para que el comercio pueda después acreditarle puntos/sellos.

El primer contacto ocurre en el local, con el teléfono en la mano, frente a un QR. Debe ser
inmediato y sin fricción: pedir lo mínimo y entregar la pertenencia al programa. Y la
identidad tiene que pertenecer a **Mi Pasaporte** (plataforma), no al comercio, para poder
reusarse entre comercios manteniendo cada membresía aislada.

## Alcance

**Entra:**

- Esquema pg **`consumer`** nuevo y su cliente Drizzle (dentro del backend existente).
- **Cuenta de consumidor** a nivel plataforma: nombre, apellido, teléfono E.164 (clave de
  identidad, único), **sin verificar** (`phone_verified_at = null`), y un **token de QR
  personal** opaco emitido al crear la cuenta.
- **Sesión de consumer** por token opaco en cookie `HttpOnly` (30 días), independiente de la
  sesión de merchant.
- **Landing pública de enrolamiento** servida en el backend existente, accesible desde el QR
  físico del comercio (URL por programa). Formulario: nombre + apellido + teléfono →
  confirmación inmediata. **No se envía ningún mensaje.**
- **Aviso de recuperación** claro en la confirmación: "Guardá tu teléfono: lo vas a necesitar
  para recuperar tu tarjeta si cambiás o perdés este dispositivo".
- **Membresía por programa** (`consumer.program_membership`), aislada por negocio
  (`business_id` denormalizado), única por (consumidor, programa). Idempotente.
- **Reuso de identidad**: si el teléfono ya tiene cuenta, se reusa el perfil (no se pisa) y se
  agrega solo la nueva membresía; la sesión se abre sobre esa cuenta.
- Validación de que el programa **existe y admite enrolamiento** (activo, no cerrado según
  ADR 0027/0028).

**No entra (cada uno su spec):**

- **Verificación de teléfono / recuperación por OTP** (envío de código, canal de mensajería,
  proveedor) → **spec 0032**. Es lo que "endurece" la identidad; hasta entonces el teléfono
  queda no verificado.
- Render del QR personal como imagen y botones **Añadir a Apple/Google Wallet** + push del
  pase → **spec 0029**.
- **Acreditación en mostrador** (staff escanea el QR, arma carrito, otorga puntos/sellos) y el
  catálogo económico que la alimenta → **spec 0030** (depende del catálogo, 0002/0021).
- **Notificación** y **landing en vivo** al otorgar → **spec 0031**.
- Cambio de teléfono, email, ciclo de vida guest/inactividad, activos de plataforma
  (rutas/coleccionables) — diferidos (parte de la 0004 reencuadrada por 0031).

## Diseño

### Especificación técnica

**Arquitectura y límites.** Todo el código nuevo del dominio consumer vive bajo
`apps/merchant/src/server/consumer/*` (lógica), `apps/merchant/src/server/schema/consumer.ts`
(schema Drizzle en `pgSchema("consumer")`) y rutas públicas `apps/merchant/src/app/api/public/enroll/*`
+ la landing en un route group `(consumer)`. No toca `core` ni `merchant_auth` salvo una
**lectura** de `core.loyalty_program` para validar el programa. La sesión de consumer es
independiente de la de merchant (cookie distinta, namespace distinto).

**Modelo de datos** (esquema `consumer`, snake_case en DB):

| Entidad | Campos / invariantes |
|---|---|
| `consumer_account` | `id` uuid PK; `phone_e164` text **único, not null** (clave de identidad); `phone_verified_at` timestamptz **nullable** (en esta spec siempre `null`); `first_name`, `last_name` text not null (≤120); `qr_token` text **único, not null**, opaco, sin PII, aleatorio no adivinable (≥128 bits); `created_at`, `updated_at`. |
| `program_membership` | `id` uuid PK; `consumer_id` → `consumer_account.id`; `program_id` → `core.loyalty_program.id`; `business_id` uuid **denormalizado** (scoping de analítica); `enrolled_at` timestamptz; **unique (`consumer_id`, `program_id`)**. En esta spec es la *pertenencia*; los saldos de puntos/sellos los agregan specs posteriores. |
| `consumer_session` | `id` uuid PK; `consumer_id` → `consumer_account.id`; `token_hash` text único (token opaco, cookie `HttpOnly`); `expires_at` timestamptz (**30 días**); `revoked_at` null; `created_at`. |

FK cross-schema `program_membership.program_id → core.loyalty_program.id`: válido dentro de
la misma DB Postgres. (No hay `enrollment_challenge`: sin OTP en esta spec.)

**Rutas / contrato** (públicas, sin sesión de merchant):

| Método · Ruta | Entrada | Salida OK | Errores |
|---|---|---|---|
| `POST /api/public/enroll/:programId` | `{ firstName, lastName, phoneE164 }` | `201 { account, membership }` (DTO sin claves internas ni `qr_token` en crudo); crea-o-reusa cuenta por teléfono, crea membresía, abre sesión (cookie `HttpOnly`) | `404` programa inexistente/cerrado; `422` datos inválidos (nombre vacío/largo, teléfono no E.164); `429` rate-limit por teléfono/IP |
| `GET /api/public/enroll/me` | cookie de sesión | `200 { account, memberships[] }` (solo del consumidor de la sesión) | `401` sin sesión válida |

**DTO / no-fuga.** Ninguna respuesta serializa `token_hash` ni el `qr_token` en crudo (el
`qr_token` se emite y se usará al renderizarlo/portarlo en la spec 0029). Se sigue el patrón
`toClientProgram`/`brandResponse`: un DTO explícito por entidad.

**Autorización y aislamiento.**
- `POST /enroll/:programId` es público por diseño (el consumidor aún no tiene sesión).
- `me` devuelve **solo** la cuenta y membresías del consumidor de la cookie.
- Ningún endpoint expone datos de un negocio a otro. La membresía lleva `business_id` para que
  la analítica futura (owner) se scopee a su negocio y **nunca** vea membresías/actividad de
  otros negocios.

**Identidad no verificada — límite conocido, resuelto por 0032.** Como el teléfono no se
verifica, dos personas podrían quedar sobre una misma cuenta si una tipea el número de otra
(colisión sobre la clave única). Es **aceptable en v1** porque el valor se acredita contra el
**QR al portador** (el encargado escanea el QR que la persona tiene en su teléfono, spec 0030),
no contra el teléfono: un teléfono ajeno/mal tipeado **no le entrega los puntos de nadie a un
tercero**. El teléfono solo habilita **recuperar la tarjeta en otro dispositivo** y el reuso de
perfil entre comercios; ambos se endurecen con la verificación de la **spec 0032**.

**Idempotencia.** `POST /enroll` crea-o-encuentra `consumer_account` por `phone_e164` (si
existía, **reusa** el perfil sin pisarlo con los datos del formulario nuevo), crea la
`program_membership` si no existe (la unique la protege → reenrolar al mismo programa es no-op),
abre sesión. Un mismo teléfono en dos programas = **una** cuenta, **dos** membresías.

**Estados de interfaz (móvil-first).** La landing: (1) formulario nombre+apellido+teléfono;
(2) confirmación con nombre + programa + negocio + el aviso de recuperación. Errores como
toast. Programa cerrado/inexistente → pantalla clara "este programa no está disponible".

### Arquitectura de referencia

- **ADR 0031** — merchant-first, identidad de consumidor de plataforma, identidad compartida
  / membresías aisladas.
- **ADR 0032** — esquema `consumer`, hospedaje en el backend existente, DB compartida para
  analítica; verificación de teléfono diferida.
- **ADR 0002 / 0007** — aislamiento por comercio, extendido a la identidad de consumidor.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/consumer.ts` | crear (schema Drizzle `pgSchema("consumer")`) |
| `apps/merchant/src/server/schema.ts` | editar (reexportar `consumer`) |
| `apps/merchant/drizzle.config.ts` | editar (`schemaFilter` suma `"consumer"`) |
| `apps/merchant/drizzle/00XX_*.sql` | crear (migración aditiva: `CREATE SCHEMA consumer` + 3 tablas) |
| `apps/merchant/src/server/consumer/core.ts` | crear (tipos, errores, generación de `qr_token`/token de sesión) |
| `apps/merchant/src/server/consumer/enrollment.ts` | crear (crear-o-reusar cuenta, membresía) |
| `apps/merchant/src/server/consumer/session.ts` | crear (emisión/validación de sesión opaca) |
| `apps/merchant/src/app/api/public/enroll/[programId]/route.ts` | crear (`POST`) |
| `apps/merchant/src/app/api/public/enroll/me/route.ts` | crear (`GET`) |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/page.tsx` | crear (landing) |

### Disjunta?

**Sí.** El esquema `consumer` y las rutas `api/public/enroll/*` son territorio nuevo; ninguna
spec abierta los toca. La única intersección es una **lectura** de `core.loyalty_program`
(estable, no se modifica) y un reexport en `schema.ts` + `drizzle.config.ts`. No colisiona con
specs implementadas (0024–0027) ni con las abiertas.

### Archivos compartidos

Ninguno. Al diferir el OTP, esta spec **no necesita** la interfaz del proveedor de mensajería
ni un emisor de prueba; se implementa y verifica sin ningún proveedor.

## Definition of Done

- [ ] Abrir la URL de enrolamiento de un programa **activo** muestra el formulario
      nombre+apellido+teléfono y nada más.
- [ ] `POST /enroll` con datos válidos crea la cuenta (`phone_verified_at = null`), la
      membresía, abre sesión y devuelve la confirmación con el aviso de recuperación. **No se
      envía ningún mensaje.**
- [ ] Teléfono no-E.164 o nombre inválido → `422`; programa cerrado/inexistente → `404`.
- [ ] Enrolar con un teléfono que **ya existe** reusa el perfil (no lo pisa) y solo agrega la
      membresía.
- [ ] Reenrolarse al **mismo** programa es idempotente: no crea una segunda membresía.
- [ ] Un mismo teléfono enrolado en **dos** programas distintos tiene **una** cuenta y **dos**
      membresías, cada una con su `business_id`.
- [ ] `me` con sesión válida devuelve solo la cuenta y membresías del consumidor; sin sesión
      `401`.
- [ ] Ninguna respuesta serializa `token_hash` ni el `qr_token` en crudo (test por entidad,
      patrón anti-fuga del proyecto).
- [ ] Migración aditiva aplicada y verificada en rama Neon efímera y en prod: existe el
      esquema `consumer` con las tres tablas y sus índices/uniques; `core`/`merchant_auth`
      intactos.

## Plan de pruebas y verificación

- [ ] Unidad: `qr_token` y token de sesión son aleatorios no adivinables (≥128 bits) y no
      contienen PII.
- [ ] Unidad: DTO por entidad no expone `token_hash`/`qr_token`.
- [ ] Integración (Neon, rama efímera): programa activo → enroll → cuenta+membresía; teléfono
      repetido en 2º programa → 1 cuenta / 2 membresías; reenrol mismo programa → idempotente;
      programa cerrado → `404`.
- [ ] Integración de aislamiento: la membresía de negocio A no aparece al consultar/analizar el
      negocio B (query scopeada por `business_id`).
- [ ] Integración de sesión: cookie válida abre `me`; cookie ausente/revocada/expirada → `401`.
- [ ] Comandos exactos: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), integración Neon en
      rama efímera, `pnpm build`, y aplicación de la migración con `drizzle-kit migrate`
      verificada.
- [ ] Verificación manual en teléfono (deploy): abrir la URL de un programa real, completar el
      formulario, ver la confirmación con el nombre, el programa y el aviso de recuperación.
      **Sin dependencia de proveedor de SMS.**

## Handoff requerido

Implementador y revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor produce un
`PASS` independiente —con foco en el aislamiento por negocio, la no-fuga de `qr_token`/
`token_hash`, y la seguridad del token de sesión— antes de marcar `implementada`.

## Abierto

- **Colisión de identidad por teléfono no verificado**: límite conocido y aceptado en v1 (ver
  "Identidad no verificada"); lo resuelve la **spec 0032** (verificación/recuperación por OTP).
  **No bloquea** el cierre de esta spec.
