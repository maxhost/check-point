# Despliegue de prueba — Owner

Este checklist despliega exclusivamente el backoffice merchant de Mi Pasaporte. No subir
secretos al repositorio ni pegarlos en chat.

## 1. Neon

- [x] Proyecto `mi-pasaporte` creado, con base `neondb` y branch `main`.
- [x] Migraciones iniciales de `merchant_auth`, `core` y `drizzle` aplicadas y registradas.
- [ ] En Neon Console → **Connect**, copiar dos URLs del branch `main`:
  - pooled para `DATABASE_URL` (runtime Vercel);
  - directa, sin pooler, para `DATABASE_URL_UNPOOLED` (migraciones futuras).
- [ ] Guardarlas como secretos de Production y Preview en Vercel. No son valores de cliente.

## 2. Stripe test

- [ ] En Stripe Dashboard, activar **Test mode**.
- [ ] Crear el producto `Mi Pasaporte Plus`, moneda USD.
- [ ] Añadir dos precios recurrentes:
  - USD 20, mensual;
  - USD 200, anual.
- [ ] Copiar sus Price IDs `price_…` a `STRIPE_PRICE_PLUS_MONTHLY` y
  `STRIPE_PRICE_PLUS_YEARLY`.
- [ ] En Developers → API keys, copiar la **Secret key de test** a
  `STRIPE_SECRET_KEY` y definir `STRIPE_ENVIRONMENT=test`.
- [ ] Después del primer deploy, crear un webhook test que escuche:
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `checkout.session.completed`, `invoice.paid` e
  `invoice.payment_failed`; URL:
  `https://<tu-dominio-merchant>/api/stripe/webhook`.
- [ ] Copiar su signing secret `whsec_…` a `STRIPE_WEBHOOK_SECRET` y redeployar.
- [ ] Probar Plus con tarjeta test `4242 4242 4242 4242`, fecha futura y cualquier CVC.

## 3. Mapbox

- [ ] En Mapbox → Access tokens, crear un token **público** separado para Search JS;
  restringirlo a los orígenes de localhost y el dominio Vercel merchant. Guardar en
  `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- [ ] Crear un token **secreto** separado con el mínimo permiso de Geocoding; guardar en
  `MAPBOX_SERVER_ACCESS_TOKEN`.
- [ ] Tener método de pago activo: el backend solicita `permanent=true` porque almacena
  dirección y coordenadas. Mapbox exige ese modo para guardar geocodes.
- [ ] Verificar una dirección real en uno de los países iniciales: Ecuador, Argentina,
  Chile, Paraguay, Uruguay, Perú, Colombia, México o Brasil.

## 4. Better Auth

- [ ] Generar `BETTER_AUTH_SECRET` con `openssl rand -base64 32`.
- [ ] Definir `BETTER_AUTH_URL=https://<tu-dominio-merchant>` exactamente, sin slash final.
- [ ] Mantener cookie y auth sólo en este proyecto merchant; no reutilizar el secreto con
  consumer ni platform.

## 5. Vercel

- [ ] Instalar la integración GitHub de Vercel y dar acceso al repo `maxhost/check-point`.
- [ ] Importar el repo como un proyecto nuevo.
- [ ] En **Root Directory**, seleccionar `apps/merchant`. Vercel crea un proyecto por
  directorio del monorepo; no desplegar la raíz ni consumer/platform para esta prueba.
- [ ] Framework: Next.js detectado. Install y Build Command: dejar los predeterminados de
  Vercel para el package `@mi-pasaporte/merchant`.
- [ ] En Settings → Environment Variables, cargar los valores anteriores para Production
  y Preview. `RESEND_*` y `R2_*` permanecen vacíos: esas features no están activadas.
- [ ] Deploy. Al tener URL, volver a Stripe para crear el webhook y a Mapbox para añadir
  el origen definitivo al token público.
- [ ] Abrir `/onboarding`: registrar Owner → Free → negocio → seleccionar dirección
  Mapbox → `/backoffice`; repetir con Plus y confirmar el estado sólo después del webhook.

## 6. R2 y Resend: no necesarios para esta prueba

R2 se conecta cuando se implemente el uploader real de logo. Entonces crear un bucket,
generar credenciales S3 de **Object Read & Write** limitadas a ese bucket y cargar
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`. Resend queda
desactivado hasta verificar un dominio remitente.

## Referencias oficiales

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Stripe subscriptions and webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Mapbox permanent geocoding](https://docs.mapbox.com/api/search/geocoding/)
- [Cloudflare R2 S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/)
