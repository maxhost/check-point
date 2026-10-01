# Despliegue de la web pública

La app pública vive en `apps/public` y se despliega como proyecto Vercel independiente de `apps/merchant`. Su ruta `/` es la landing de negocios; `/negocios` redirige a `/`. `/explorar` y las fichas de ejemplo se publican con `noindex` mientras usan datos ficticios.

## Crear el proyecto

1. En Vercel, importar el mismo repositorio de GitHub como proyecto nuevo y seleccionar `apps/public` como **Root Directory**. La rama de producción es `main`.
2. Usar Node `24.x`, pnpm `11.4.0` y el framework Next.js. Los scripts de `apps/public/package.json` contienen el build y el arranque. Vercel debe instalar desde la raíz del monorepo para resolver el lockfile y las dependencias compartidas.
3. Desplegar primero en el dominio temporal de Vercel y comprobar `/`, la redirección de `/negocios`, `/explorar`, `robots.txt`, `sitemap.xml` y los CTA hacia el alta merchant.

Variables opcionales de `apps/public`:

- `PUBLIC_SITE_URL`: origen final de la web pública usado en canonical, Open Graph y sitemap. Por defecto `https://www.checkpass.club`.
- `MERCHANT_ONBOARDING_URL`: URL completa del alta, por defecto `https://business.checkpass.club/es/business/onboarding`.
- `CONSUMER_WALLET_URL`: URL completa de la billetera, por defecto `https://my.checkpass.club/wallet`.
- `MERCHANT_ORIGIN` / `CONSUMER_ORIGIN`: destino de los 308 de las paginas viejas (`src/legacy-routes.ts`), por
  defecto `https://business.checkpass.club` y `https://my.checkpass.club`.
- `MERCHANT_API_ORIGIN`: destino del proxy de `/api/*`, por defecto `https://business.checkpass.club`.

## Un subdominio por audiencia (ADR 0106, spec 0114)

`checkpass.club` y `www` → este proyecto (`apps/public`); `business.checkpass.club` (comercio) y `my.checkpass.club`
(cliente) → el proyecto merchant, que enruta por host en `apps/merchant/src/proxy.ts`: una pagina pedida en el host
equivocado responde 308 al correcto; `/api/*` se atiende en los dos. **Sin `MERCHANT_ORIGIN` y `CONSUMER_ORIGIN`
cargadas en merchant, merchant no redirige nada.** `www` conserva para siempre una capa de compatibilidad
(`apps/public/src/legacy-routes.ts`): las paginas viejas del comercio (`/backoffice`, `/<locale>/business/*`) → 308 a
`business.`; las del cliente (`/wallet`, `/c/*`, `/enroll/*`, `/recover`) → 308 a `my.`; `/api/*` → proxy a merchant
(un pase de Apple, Stripe y los crons tienen `www` grabado y un `POST` no sigue un 308 con garantia). Los rewrites
multi-zones del 2026-09-30 (`PUBLIC_APP_ORIGIN`, `/public-zone`) se retiraron.

### Runbook (owner, en Vercel — en este orden)

1. **Deploy del codigo** (push a `main`). Sin env nuevas nada cambia: `www` sigue siendo merchant.
2. **Proyecto merchant → Domains:** agregar `business.checkpass.club` y `my.checkpass.club` (si el DNS no esta en
   Vercel, crear los CNAME que indique). Esperar «Valid Configuration».
3. **Proyecto merchant → Environment Variables (Production):** `MERCHANT_ORIGIN=https://business.checkpass.club`,
   `CONSUMER_ORIGIN=https://my.checkpass.club`, `BETTER_AUTH_URL=https://business.checkpass.club`,
   `BETTER_AUTH_TRUSTED_ORIGINS=https://www.checkpass.club,https://checkpass.club`. Borrar `PUBLIC_APP_ORIGIN` si se
   cargo. **Redeploy.**
4. **Verificar** `https://business.checkpass.club/es/business/onboarding` (entrar con tu cuenta → backoffice) y
   `https://my.checkpass.club/wallet`.
5. **⇥ AVISO A PLANTANO, AHORA:** «Desde hoy entran por **business.checkpass.club** — la primera vez les va a pedir
   iniciar sesion de nuevo. Su QR impreso sigue funcionando.» (Hasta el paso 6 pueden seguir entrando por `www`.)
6. **Mover `www.checkpass.club` y `checkpass.club`** del proyecto merchant al proyecto de `apps/public` (en el
   publico: Domains → Add; Vercel pide confirmar el traspaso). Desde aca `www` es la landing y las paginas viejas
   redirigen.
7. **Verificar** con los comandos de «Verificacion en PROD».
8. **Actualizar integraciones externas** a `business.checkpass.club`: endpoint del webhook de Stripe; secrets de
   GitHub `MARKETING_TICK_ENDPOINT`, `WALLET_PUSH_ENDPOINT`, `CATALOG_IMPORT_RECONCILE_ENDPOINT`. (Hasta hacerlo, el
   proxy de `www/api` los atiende.)

### Verificacion en PROD (despues del runbook)

```sh
curl -sI https://www.checkpass.club/backoffice            # 308 → https://business.checkpass.club/backoffice
curl -sI https://www.checkpass.club/enroll/x              # 308 → https://my.checkpass.club/enroll/x
curl -s  https://www.checkpass.club/api/health            # 200 de merchant (via proxy)
curl -sI https://business.checkpass.club/wallet           # 308 → https://my.checkpass.club/wallet
curl -s -o /dev/null -w '%{http_code}' -X POST -d '{}' \
  https://www.checkpass.club/api/public/wallet/passkit/v1/log   # no 404
```

El proxy de `www/api/*` se mantiene mientras exista un pase con `www` grabado (retirarlo es una spec futura).
