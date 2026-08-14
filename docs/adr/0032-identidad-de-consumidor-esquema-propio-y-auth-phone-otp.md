---
fecha: 2026-08-14
resumen: La identidad de consumidor vive en un esquema pg propio (`consumer`) dentro de la DB única compartida; el enrolamiento crea la cuenta SIN verificar (teléfono como clave de identidad, sesión opaca) y la verificación por OTP se difiere a la spec de recuperación (0032). Queda separada por dominio y acceso del merchant pero hospedada, por ahora, en el backend existente. La DB compartida es deliberada: habilita analítica del mismo cliente para cada owner, scopeada y aislada por negocio.
estado: aceptada; refina 0012 (cómo se realiza la auth de consumidor) y realiza la separación de dominio de 0010/0031
---

# ADR 0032 — Identidad de consumidor: esquema propio, auth phone-OTP, DB compartida

## Contexto

El ADR 0031 fijó el modelo merchant-first: identidad de consumidor a nivel plataforma, con
N membresías, identidad/perfil compartida y membresías aisladas por comercio. Falta decidir
**dónde vive** esa identidad y **cómo se realiza** su autenticación, ancladas a la
arquitectura real.

Hechos del código (verificados): toda la infra —Neon, Drizzle, migraciones, Better Auth,
R2, crons— vive **solo** en `apps/merchant`. `apps/consumer` y `apps/platform` son cáscaras
de frontend sin backend ni dependencia de DB. Hay dos esquemas pg: `merchant_auth`
(staff/owner) y `core` (producto). Better Auth está configurado con **email+contraseña, sin
plugin de teléfono/OTP**. No existe paquete compartido (`packages/`), así que ningún otro
app puede leer la DB hoy.

El owner agregó un requisito que actúa como driver de arquitectura: **analítica del mismo
cliente, scopeada por negocio.** El mismo Marcos puede ser cliente de "La Gringa" y de
"Cervecería Cuervo"; cada owner debe poder ver métricas de Marcos **solo sobre su propio
negocio**, nunca sobre el otro. Eso exige una identidad única + datos de membresía por
negocio aislados, **todos en una misma DB** para poder computar cada tajada. Una DB por
negocio no podría; identidades separadas por negocio tampoco.

El ADR 0012 (bajo el posicionamiento viejo) asumió Better Auth también para el consumidor
con un esquema `consumer_auth`. El flujo real que definió el owner —landing con
nombre+teléfono → OTP → alta con contexto de *a qué programa se enrola*— no encaja bien con
el flujo sign-in-céntrico del plugin de Better Auth, y el consumidor no usa contraseña.

## Decisión

- **Esquema pg propio `consumer`**, dentro de la DB única compartida, para toda la identidad
  de consumidor: cuenta/perfil, sesión, membresías por programa, el token de QR personal y —a
  futuro— el challenge de OTP de recuperación. Separado de `merchant_auth` y de `core`. La separación de dominio/acceso
  del ADR 0010/0031 se realiza **por límites de esquema, rutas y autorización, no de
  deploy**: comercio y consumidor nunca comparten sesión ni tabla de identidad.
- **Enrolamiento SIN verificar + verificación por OTP diferida.** El alta crea la cuenta con
  el teléfono como clave de identidad pero `phone_verified_at = null` y **no envía ningún
  mensaje**; la sesión se abre con un token opaco en cookie `HttpOnly`. Motivo (2026-08-14):
  un SMS a Ecuador cuesta ~$0.25–0.34 y el valor se acredita contra el **QR al portador**, no
  contra el teléfono, así que verificar al enrolar no protege el loop y encarece cada alta. La
  **verificación/recuperación por OTP** (purpose-built, passwordless, con challenge de
  expiración/intentos/uso único, sin fuga de existencia) se difiere a la **spec 0032** y se
  entrega por la interfaz agnóstica `deliverOtp` (SMS **o** WhatsApp; el envío usa el proveedor
  intercambiable del ADR 0013). **Refina el ADR 0012**: el consumidor conserva "teléfono sin
  contraseña", realizado a medida (no con el plugin de Better Auth) y con verificación
  progresiva, no al enrolar.
- **Hospedaje, por ahora, en el backend existente** (`apps/merchant`), reusando Drizzle,
  migraciones, R2 y crons. No se levanta un backend de consumer separado ni un `packages/db`
  compartido hasta que un app de consumer real lo justifique. La identidad **conceptualmente
  pertenece a la plataforma**, aunque el código corra en ese deploy; el deploy se puede
  partir después sin tocar el modelo (el esquema `consumer` ya está aislado).
- **DB única compartida, deliberada, para habilitar analítica aislada por negocio.** La
  membresía lleva `business_id` denormalizado; toda query de analítica de un owner se scopea
  a su `business_id`. La plataforma podría ver la unión; cada owner ve solo su tajada. Ese es
  el motivo explícito de una sola DB.

## Consecuencias

- **Refina el ADR 0012**: consumer sigue passwordless por teléfono, purpose-built, en esquema
  `consumer` (no `consumer_auth` con Better Auth), pero con **verificación diferida** (no al
  enrolar). Merchant/platform no cambian.
- **El ADR 0013** (OTP con proveedor intercambiable) **no lo consume la 0028**: al diferir la
  verificación, el enrolamiento no envía mensajes y no necesita proveedor. Lo consume la **spec
  0032** (recuperación), donde elegir un proveedor concreto es prerequisito del QA de esa
  feature.
- **La spec 0028** implementa este ADR salvo el OTP (esquema `consumer`, enrolamiento sin
  verificar, membresía, sesión, QR). Las specs 0029–0031 (pase de Wallet, acreditación en
  mostrador, notificaciones+landing en vivo) y la **0032** (recuperación por OTP) cuelgan del
  mismo esquema.
- **Migración aditiva**: `CREATE SCHEMA consumer` + tablas nuevas; no toca `core` ni
  `merchant_auth`. Se aplica con el mismo `drizzle-kit` (habrá que sumar `consumer` al
  `schemaFilter` del `drizzle.config.ts`).
- **Rodar auth a medida** acota su superficie: en la 0028, sesión opaca + QR sin PII (el
  revisor verifica token no adivinable y no-fuga); las propiedades del OTP (expiración,
  intentos, uso único, no-fuga de existencia) las verifica el revisor de la **0032**.
- **Costo/fricción como consecuencia deseada**: al no verificar al enrolar, la 0028 queda
  **implementable y lanzable sin ningún proveedor de SMS** —esquiva el alta A2P de ~10 semanas
  de Brasil y el registro CNMC de España—; esos costos recaen sobre la 0032, cuando y donde la
  recuperación los justifique.
- Si a futuro se levanta un backend de consumer propio, el esquema `consumer` migra sin
  cambio de modelo; la decisión de deploy queda abierta y no se paga hoy.
