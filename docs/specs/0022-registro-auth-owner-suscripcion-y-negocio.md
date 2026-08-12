---
spec: 0022
fecha: 2026-08-11
estado: cerrada
resumen: Registro real de Owner, sesión merchant, suscripción Free/Plus con Stripe Checkout y alta inicial de negocio/local sobre Neon, Better Auth y Mapbox.
disjunta: no
archivos: apps/merchant, packages/auth, packages/db, packages/contracts, pruebas, configuración y docs
---

# 0022 — Registro, autenticación, suscripción y negocio inicial de Owner

## Problema

El onboarding actual valida la experiencia, pero guarda todo en `sessionStorage`. Un Owner
debe poder crear una cuenta real aunque todavía no pague, iniciar una sesión exclusiva del
merchant, escoger Free o Plus y, cuando corresponda, pagar mediante Stripe Checkout. Sólo
después debe poder crear su primer negocio y local con dirección verificable.

## Alcance

**Entra:**

- Neon Postgres como fuente de verdad y Drizzle para el esquema `core` y migraciones.
- Better Auth autoalojado en `apps/merchant`, con PostgreSQL/Drizzle en el esquema
  `merchant_auth`, email y contraseña, sesiones merchant y handler `/api/auth/*`.
- Registro de Owner desde el formulario existente `/onboarding`: nombre completo, email,
  contraseña y confirmación. El registro crea la cuenta aunque el Owner abandone o cancele
  el pago posterior.
- Inicio y cierre de sesión merchant, protección server-side de onboarding posterior y
  backoffice; una sesión merchant no autoriza consumer ni platform.
- Planes por negocio: **Free** sin Checkout y **Plus**, USD 20 mensual o USD 200 anual,
  mediante Stripe Checkout alojado en modo `subscription`.
- Stripe en sandbox/test inicialmente, preparado para producción mediante secretos de
  entorno y configuración no secreta separada de test/live; no hay selector de modo
  expuesto al navegador.
- Webhook Stripe firmado, con procesamiento idempotente de eventos y estado de suscripción
  local. El redirect `success_url` sólo informa UX; nunca concede Plus.
- Formulario de negocio inicial: nombre, logo opcional almacenado en Cloudflare R2 y un
  local inicial con nombre y dirección. La operación crea negocio, membresía `owner` y
  local de forma transaccional.
- Búsqueda/autocompletado de dirección con Mapbox. El Owner debe elegir una sugerencia
  válida; se persisten texto normalizado, coordenadas y metadatos permitidos para el
  local. No se aceptan direcciones manuales sin resultado verificable.
- Verificación de email no bloqueante preparada mediante Resend. Mientras no exista un
  dominio remitente configurado, permanece desactivada y no se muestra un CTA inútil; al
  activarla, el home muestra el banner para solicitar el email de verificación.
- Errores de red/validación, estados de pago pendiente/cancelado y toasts accesibles que
  reutilizan la fundación UI existente.

**No entra:**

- Staff, invitaciones de owners adicionales, SSO/social login, OTP consumer, recuperación
  de contraseña, cambio de email, 2FA, customer portal, cambios/cancelación de plan,
  Stripe Tax, facturación local, cupones Stripe, prueba gratuita ni Stripe Connect.
- Checkout o cobro para Free: Free se activa localmente, sin crear Customer/Subscription
  Stripe.
- Acceso a Neon desde el navegador, secretos en cliente o autorización basada sólo en UI.
- Múltiples negocios/locales en el primer alta, edición posterior de negocio/local,
  campañas, catálogo, canje o Stripe Billing Portal.

## Flujo

```text
/onboarding
  → registro válido → cuenta Owner + sesión merchant
  → negocio + local inicial en una transacción
  → elegir Free | Plus, con selector mensual | anual para Plus
  → Free: home con suscripción Free
  → Plus: crear Checkout Session asociado al negocio → Stripe Checkout alojado
       → retorno UX de éxito/cancelación
       → webhook firmado actualiza suscripción idempotentemente
  → /backoffice con sesión y contexto de negocio
```

El alta de cuenta y la suscripción son independientes. Un Owner registrado sin plan Plus
conserva su cuenta y puede iniciar sesión para continuar con Free o reabrir Checkout. La
creación del negocio no confía en parámetros del navegador: el servidor toma el Owner de
la sesión actual y crea su membresía inicial `owner`. La suscripción pertenece al negocio,
no al usuario: un negocio puede tener varios owners y cada negocio decide su propio plan.

Free habilita un local por negocio y el programa de fidelización. No habilita campañas; las
analíticas básicas y los límites exactos se definen en una spec de entitlement posterior.

Plus se considera habilitado sólo cuando el estado local, derivado de un webhook Stripe
válido, representa una suscripción cobrable/activa. `checkout.session.completed` vincula
la sesión con el negocio; `customer.subscription.created|updated|deleted`, `invoice.paid` e
`invoice.payment_failed` reconcilian el estado. Cada evento se guarda con su `event_id`
único antes o dentro de la transacción que modifica la suscripción, de modo que reintentos
de Stripe no duplican efectos.

La pantalla de retorno consulta el estado local y puede mostrar “Confirmando tu pago”; no
activa Plus por la URL. El webhook verifica la firma sobre el cuerpo crudo y responde 2xx
sólo después de persistir o reconocer de forma idempotente el evento.

## Modelo de datos e invariantes

Better Auth posee sus tablas `user`, `session`, `account` y `verification` en
`merchant_auth`; Drizzle no mezcla los datos de producto en esas tablas. `core` añade,
como mínimo:

```text
owner_profile(user_id PK → merchant_auth.user, full_name, timestamps)
business(id, name, country_code, logo_object_key?, timestamps)
business_membership(business_id, user_id, role = owner, timestamps)
location(id, business_id, name, address_label, longitude, latitude,
         mapbox_feature_id?, address_snapshot, timestamps)
subscription(id, business_id, plan = free|plus, interval = month|year|null,
             status, stripe_customer_id?, stripe_subscription_id?, timestamps)
stripe_webhook_event(event_id PK, event_type, received_at, processed_at, payload_version)
integration_setting(provider, environment, key, value_json, audited timestamps)
```

- Email se normaliza y Better Auth aplica la unicidad de cuenta. La contraseña se entrega
  únicamente al endpoint de Better Auth; se almacena con su hash, nunca en logs, eventos,
  errores, `core` ni respuestas.
- Un Owner puede existir sin negocio y un negocio puede soportar N owners en el futuro. El
  primer negocio crea exactamente una membresía owner en la misma transacción que local.
- `business_membership.role` no llega del cliente. El servidor asigna `owner` sólo al
  creador durante esta operación.
- Stripe IDs son únicos cuando no nulos. Los estados Stripe se modelan explícitamente;
  no se reducen a un booleano `paid`.
- Sólo se guarda geodato persistente obtenido/confirmado mediante Mapbox permanent
  geocoding. No se persiste una dirección manual sin coordenadas/sugerencia válida. Los
  países habilitados inicialmente son Argentina, Brasil, Chile, Colombia, Ecuador,
  Uruguay, Paraguay y Perú. El país elegido al crear el negocio se persiste y limita las
  sugerencias de Mapbox del local inicial.
- `integration_setting` sólo guarda valores no secretos, segregados por `test|live` y con
  auditoría. Sus credenciales privadas permanecen en secretos de entorno según ADR 0024.

## Configuración y secretos

Variables de servidor, nunca `NEXT_PUBLIC_*`:

```text
DATABASE_URL                 # Neon pooled, runtime
DATABASE_URL_UNPOOLED        # migraciones Drizzle
BETTER_AUTH_SECRET           # ≥32 bytes de alta entropía
BETTER_AUTH_URL              # URL base de merchant por entorno
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_ENVIRONMENT           # test | live; validado al arrancar
MAPBOX_SERVER_ACCESS_TOKEN   # sólo si se confirma geocoding permanente en servidor
RESEND_API_KEY
R2_*                          # credenciales privadas y bucket de Cloudflare R2
```

Variables de cliente permitidas y restringidas:

```text
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
```

`STRIPE_ENVIRONMENT=test|live` se valida al arrancar contra el prefijo de la clave y los
Price IDs no secretos de `integration_setting`. Cada entorno de despliegue recibe su propio
conjunto de secretos:
cambiar a live es un cambio de configuración/secretos en el entorno, no una opción de
producto ni un `if` controlable por cliente. Stripe test y live tienen objetos y webhooks
distintos.

## Diseño y seguridad

- Reutilizar la UI de `/onboarding`; reemplazar persistencia mock por acciones/handlers
  de servidor tipados. No duplicar formularios para registro o login.
- Validar en cliente para feedback y repetir toda validación en servidor. Contraseñas no
  se reenvían a Stripe, Mapbox ni logs.
- Rutas de negocio/backoffice obtienen sesión desde servidor y redirigen a login si falta;
  no aceptan `ownerId`, `businessId`, precio o plan como autoridad del cliente.
- Crear Checkout Session sólo en servidor, con Price ID no secreto de configuración
  interna y referencia de negocio en `client_reference_id`/metadata validable. No confiar
  en importes ni Price IDs enviados por navegador.
- Usar idempotency keys al crear Checkout Session para evitar suscripciones paralelas por
  doble clic/reintento. Definir una política clara para una suscripción Plus ya existente.
- Aplicar rate limit de registro, login y creación de Checkout por IP/cuenta; la elección
  concreta de proveedor se integra con la base de rate limit de Arquitectura.
- El token público Mapbox se restringe por URL/origen y permisos mínimos. Autocomplete es
  accesible por teclado, requiere elegir una sugerencia y no expone el token servidor.
- R2 recibe el logo mediante un flujo de carga autenticado; se validan MIME, tamaño,
  dimensiones y ownership antes de asociar la `object_key` al negocio. No se persiste una
  URL pública arbitraria enviada por el cliente.
- Resend envía verificación sólo para la sesión/Owner autorizado y limita reenvíos. El
  banner sólo se activa con configuración Resend completa, no concede permisos adicionales
  y actualiza Better Auth mediante un token de un solo uso.
- Los cambios de cuenta, checkout, webhook y negocio inicial dejan auditoría estructurada
  sin PII sensible ni credenciales.

## Arquitectura de referencia

- ADR 0010 — dominios y sesiones separados.
- ADR 0012 — Neon, Better Auth autoalojado y esquemas separados.
- ADR 0017 — entrega production-grade.
- ADR 0024 — secretos de entorno y configuración no secreta auditada.
- Spec 0001 — membresías/roles y auditoría, que esta feature inicia sólo en lo mínimo.
- Spec 0012 — recorrido y diseño mock que este flujo reemplaza parcialmente.
- Documentación oficial: [Better Auth installation](https://better-auth.com/docs/installation),
  [Stripe subscriptions/webhooks](https://docs.stripe.com/billing/subscriptions/webhooks),
  [Neon pooling](https://neon.com/docs/connect/connection-pooling) y
  [Mapbox permanent geocoding](https://docs.mapbox.com/api/search/geocoding/).

## Archivos previstos

| Archivo | Acción |
|---|---|
| `packages/db/**` | crear cliente Neon/Drizzle, esquemas, migraciones y repositorios transaccionales |
| `packages/auth/**` | crear configuración Better Auth merchant y cliente compartido por merchant |
| `apps/merchant/src/app/api/auth/[...all]/route.ts` | crear handler Better Auth |
| `apps/merchant/src/app/api/stripe/webhook/route.ts` | crear webhook firmado e idempotente |
| `apps/merchant/src/app/onboarding/**`, login y rutas protegidas | reemplazar acciones mock por flujos reales |
| `apps/merchant/src/app/api/**` o server actions tipadas | crear registro, checkout y negocio/local inicial según contrato cerrado |
| `apps/merchant/src/app/components/**` | integrar Mapbox y uploader de logo reutilizables |
| `.env.example`, CI y scripts | declarar variables, migraciones y verificación sin secretos |
| `packages/**/**/*.test.*`, `apps/merchant/**/*.test.*`, `tests/e2e/**` | cubrir dominio, integración y navegador |

### Disjunta?

No. Es la primera fundación backend y comparte merchant, esquemas, auth, identidad,
onboarding y pruebas con casi todas las specs futuras. Se implementa serialmente.

## Definition of Done

- [ ] Neon contiene migraciones versionadas y reproducibles para `merchant_auth` y el
  mínimo `core`; producción usa URL pooled en runtime y URL directa para migraciones.
- [ ] Better Auth autoalojado permite registro, login, logout y sesión merchant con email/
  contraseña; no existe acceso de navegador a Neon ni cruce de sesión con otros dominios.
- [ ] El formulario actual registra nombre completo, email, contraseña y confirmación con
  validación cliente/servidor; crear cuenta no depende de completar un pago.
- [ ] Tras guardar el negocio/local inicial, Free permite abrir el backoffice sin Stripe.
  Plus ofrece un selector mensual/anual y crea un Stripe Checkout Session alojado con los
  Price IDs configurados, sin tarjetas ni importes manejados por Mi Pasaporte.
- [ ] Webhook Stripe verifica firma, es idempotente y es la única autoridad que habilita o
  cambia Plus; retorno, cancelación, pago fallido y reintentos muestran estados correctos.
- [ ] Test/live se configuran por secretos de entorno y configuración no secreta separada
  y validada; ningún secreto aparece en cliente, logs, repositorio o fixtures.
- [ ] Owner autenticado puede crear una vez su negocio inicial, logo opcional en R2 y local
  con nombre/dirección Mapbox válida; negocio, membresía owner y local son atómicos.
- [ ] Dirección usa Mapbox accesible y conserva sólo datos permitidos bajo la modalidad de
  almacenamiento permanente aprobada; no permite finalizar con una dirección inexistente.
- [ ] La integración de Resend queda preparada y desactivada de forma segura sin dominio
  remitente. Al configurarla, un Owner no verificado ve banner y el envío/confirmación por
  token son seguros, limitados e idempotentes.
- [ ] Autorización server-side, rate limiting, manejo de errores, auditoría y observabilidad
  cumplen ADR 0017.
- [ ] Migraciones, unitarias, integración Neon aislada, webhook Stripe fixture, E2E móvil
  Free/Plus y build pasan; revisor independiente emite PASS.

## Plan de pruebas y verificación

- [ ] Unidad: normalización/validación de nombre, email, contraseña y confirmación;
  contraseñas nunca aparecen en serialización ni logs.
- [ ] Integración: email duplicado, sesión merchant válida/inválida, logout y protección de
  rutas; ninguna sesión consumer/platform es aceptada.
- [ ] Integración Neon: migrar desde cero, revertir/avanzar en branch efímera y crear
  negocio+membresía+local atómicamente; fallo intermedio no deja registros huérfanos.
- [ ] Integración Stripe: firma inválida se rechaza; eventos duplicados no duplican estado;
  checkout completado sin webhook no habilita Plus; `invoice.paid`, fallo y cancelación
  dejan el estado esperado.
- [ ] UI: errores por campo, submit doble, estados de red/checkout y retorno pendiente.
- [ ] E2E móvil: registro → negocio/local → Free → backoffice; registro → negocio/local
  → Plus mensual/anual → Checkout test → webhook fixture → backoffice protegido.
- [ ] Manual: cookies/sesiones por dominio, foco/lectores de pantalla, Mapbox teclado,
  bloqueo de dirección no seleccionada, archivos de logo R2 y banner de verificación.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.

## Pre-requisitos de implementación y despliegue

- Stripe test: clave privada, secreto de webhook y Price IDs mensual/anual para
  bootstrappear la configuración no secreta. Live usa su propio conjunto; USD está
  confirmado y Stripe Tax no entra.
- Mapbox: token público restringido, token servidor para geocoding permanente y cuenta con
  facturación válida. Países iniciales: `EC`, `AR`, `CL`, `PY`, `UY`, `PE`, `CO`, `MX`,
  `BR`.
- Cloudflare R2: bucket, credenciales privadas de entorno, dominio de entrega, límites de
  logo y política de eliminación. Sólo valores no secretos pueden ir en `Settings`.
- Resend queda apagado hasta disponer de API key, dominio remitente verificado, From y URL
  pública de retorno.
- Recuperación de contraseña queda fuera de esta spec; el primer corte aplica rate limits
  de registro/login y documenta la ausencia de recuperación en la UI.
