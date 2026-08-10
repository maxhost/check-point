# Arquitectura — Mi Pasaporte

Este documento reúne las decisiones técnicas transversales. No define alcance de producto; cada decisión concreta se registra como un ADR y las specs la consumen por referencia.

## Estado

Propuesta técnica inicial, pendiente de validación antes de crear el repositorio de código. Los ADR 0011–0016 documentan las decisiones propuestas; ADR 0017 fija el estándar obligatorio de entrega.

## Principio

Consumidor, comercio y plataforma son productos con sesiones, riesgos y superficies distintas. Compartirán reglas y datos de producto, pero se desplegarán como aplicaciones separadas para no mezclar cookies, rutas ni autorizaciones.

## Stack propuesto

| Capa | Elección | Motivo |
|---|---|---|
| Repositorio | Monorepo TypeScript con `pnpm` y Turborepo | Comparte dominio, datos y contratos sin copiar código. |
| Apps | Next.js App Router: consumer PWA, merchant y platform | Web móvil sin instalación y tres dominios de acceso separados. |
| Hosting | Desarrollo local; Vercel Pro desde el piloto comercial | Despliegue, secretos y dominios aislados. No se paga Vercel antes de necesitar un servicio comercial público. |
| Datos | Neon Postgres + Drizzle ORM | Transacciones para saldos/canjes y migraciones versionadas. |
| Auth | Better Auth autoalojado sobre Neon | Permite guest, OTP y tres dominios de identidad. |
| Consumer | sesión guest/anónima + teléfono OTP de 30 días | Sin contraseña; el guest se vincula al alta confirmada. |
| Comercio/plataforma | email, contraseña e invitaciones | Cuentas totalmente separadas del consumidor. |
| SMS | `OtpProvider`; Telnyx Verify piloto, Twilio Verify fallback | Elegir entrega real y costo en Ecuador, sin acoplamiento. |
| Email | Resend detrás de `EmailProvider` | Invitaciones y recuperación por email. |
| Cron | Vercel Cron + `core.job_runs` idempotente | Expiraciones, lifecycle guest y campañas de V1. |
| Rate limit | Upstash Redis | Límites por IP/teléfono/cuenta para OTP, QR y check-in. |
| Errores | Sentry + Vercel logs | Observabilidad técnica separada de métricas de producto. |

## Estructura de repositorio

```text
apps/
  consumer/       # PWA, wallet, descubrimiento y juegos
  merchant/       # owner, merchant staff y operación
  platform/       # platform_admin y platform_staff
packages/
  auth/           # tres configuraciones de Better Auth
  db/             # Drizzle, migraciones y transacciones
  domain/         # elegibilidad, permisos, premios y campañas
  contracts/      # entradas/salidas y tipos compartidos
  ui/             # sólo componentes realmente compartidos
```

Cada app será un proyecto Vercel con secretos y nombres de cookie propios. Ningún navegador recibe credenciales de Neon.

## Datos y autorización

Un proyecto Neon contiene:

- `consumer_auth`, `merchant_auth`, `platform_auth`: tablas de Better Auth, con configuración y `search_path` propios.
- `core`: negocios, locales, membresías, campañas, wallet, check-ins, canjes, auditoría y métricas.

Better Auth migra sus esquemas y Drizzle migra sólo `core`. Puntos, créditos, premios y canjes se resuelven exclusivamente en transacciones PostgreSQL con claves de idempotencia. El servidor aplica autorización central y filtros obligatorios por `business_id`/ `location_id`; no existe acceso navegador→base de datos.

No se usa Neon Auth gestionado: usa Better Auth internamente, pero no sustituye Better Auth autoalojado para los flujos extensibles que requiere el producto.

## SMS, email y tareas

El OTP de consumidor será de seis dígitos, cinco minutos de vigencia y pocos intentos. `OtpProvider` expone enviar/verificar; antes de producción se prueba Telnyx y Twilio con operadores ecuatorianos y se compara costo efectivo por verificación.

Vercel Cron llama endpoints protegidos por secreto. Cada ejecución adquiere una protección de concurrencia y deja evidencia idempotente en `core.job_runs`. V1 cubre expiración de activos, guest inactivo/eliminable y transiciones temporales de campañas. No se incorpora una cola hasta que una feature realmente exija trabajos frecuentes o prolongados. En desarrollo, estas tareas se ejecutan manualmente o desde un script local.

## QR, check-in y Wallet

| Artefacto | Uso | Regla |
|---|---|---|
| QR de local | Iniciar check-in | Código de ubicación + geo puntual + frecuencia. |
| QR de cuenta | Staff encuentra wallet y asigna valor | Token opaco, revocable y validado por servidor. |
| QR de cupón | Canje de un beneficio | Token de un solo uso y validación atómica. |

El QR de cuenta puede ir directamente en Apple Wallet/Google Wallet. El pass lleva sólo el token opaco: la fuente de verdad sigue siendo el servidor. Primero se construye el contrato QR web; Wallet se integra después por APIs oficiales sin cambiarlo.

El check-in PWA solicita geolocalización por HTTPS, sólo cuando el usuario lo inicia. Un QR de local estático identifica el local; **cada lectura** crea en servidor un `checkin_challenge` único, de vida muy corta, ligado a sesión/cuenta y consumible una sola vez junto con la ubicación. Eso evita repetir una solicitud de check-in ya emitida, pero no hace mágica una foto del QR: alguien aún puede escanear la foto y falsificar geolocalización. El servidor calcula distancia, usa precisión reportada, hora y frecuencia como defensa en capas; una ubicación insuficiente no recibe el beneficio. Para beneficios de alto valor se exigirá además interacción del merchant staff o un QR dinámico mostrado en pantalla, decisión que se toma al definir esa campaña.

## Juegos y AR

V1 implementa ruleta y raspadita con Canvas/WebGL ligero. El servidor valida la oportunidad y preasigna el resultado; el cliente sólo lo anima. Otros juegos reutilizan el contrato elegibilidad → resultado idempotente → activo en wallet.

AR es compatible con PWA, pero no forma parte de V1. Cuando se active, la elección es **8th Wall autoalojado + `three.js`**: el motor de tracking queda separado del render y de las reglas de premio. No se usará WebXR como requisito por su soporte irregular en móviles, ni Zapworks como dependencia de producto por su costo comercial.

La cámara se abre **dentro de la PWA en el navegador** mediante permiso del usuario: no requiere ni abre una aplicación nativa externa. El primer juego AR no intentará reconocer un vaso genérico con IA. Cada local coloca junto al vaso un pequeño *image target* o marcador visual con branding; el tracker obtiene su pose, `three.js` ancla el vaso/aro virtual y simula la bola. Un gesto o toque lanza la bola; si atraviesa el plano objetivo, se registra el intento. Si el tracking se pierde, se pide reencuadrar el marcador. Esto funciona mucho mejor en un bar oscuro y permite estandarizar la experiencia entre locales.

El mismo contrato soporta dardos, tesoros y coleccionables: el marcador sólo ancla el objetivo físico y el objeto/resultado es virtual. No se pretende seguir una pelota o dardo físico real con la cámara en la primera versión AR.

Antes de publicar se hace un spike en los teléfonos objetivo con Safari iOS y Chrome Android, midiendo permisos, primer render, estabilidad del target, FPS, calentamiento y batería. Todo juego AR tiene alternativa 2D. Ningún premio de valor alto dependerá sólo de una física calculada en el cliente: el servidor autoriza cada intento y aplica límites, idempotencia y reglas de premio.

## Velocidad de operación

Merchant tiene una superficie operativa independiente del dashboard: abrir escáner → leer QR → ver contexto mínimo → asignar/validar. Con la sesión iniciada y conectividad normal, un flujo habitual debe requerir un escaneo y como máximo dos toques, con confirmación visible en menos de dos segundos. Las campañas, acciones permitidas y catálogo del local se precargan para no esperar al dashboard después del escaneo.

El cliente nunca confirma por su cuenta un punto, cupón o canje: espera la respuesta idempotente del servidor. V1 es deliberadamente online; ante una red insuficiente muestra pendiente/error, en vez de inventar una confirmación que después pueda duplicar beneficios.

## Calidad

Vitest cubre dominio/servicios; Playwright cubre flujos críticos de navegador móvil; una branch efímera de Neon cubre integración. CI deberá correr format, lint, typecheck y pruebas. El protocolo de agentes del repositorio se mantiene obligatorio.

## Estándar production grade

Desde el primer piloto, toda feature debe cumplir ADR 0017: autorización y validación de servidor, operaciones transaccionales/idempotentes, tratamiento de red y errores, observabilidad, migraciones seguras, pruebas que demuestren su DoD y revisión independiente. La escala inicial pequeña no rebaja estos requisitos; sólo evita infraestructura sin uso probado.
