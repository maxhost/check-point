# Web pública de CheckPass Club

El sistema visual y de experiencia de estas páginas está documentado en [Sistema UI/UX público](../../docs/sistema-ui-publico.md).

La raíz `/` es la landing para comercios. `/negocios` redirige de forma permanente a la raíz. `/explorar` es un mock funcional de exploración para consumidores; no consulta APIs ni la base de datos.

El explorador usa fotos locales de Pexels y datos de ejemplo aislados en `src/app/explore/mock-businesses.ts`. Permite buscar, filtrar por categoría y por horario de apertura en `America/Guayaquil`. Cada tarjeta abre una ficha estática de ejemplo en `/lugares/[slug]`. El explorador y las fichas llevan `noindex` y no aparecen en el sitemap. La landing y el explorador se prerenderizan como HTML estático.

## Vista local

`pnpm dev:public` desde la raíz, o `pnpm --filter @mi-pasaporte/public dev`.

## Variables opcionales

- `PUBLIC_SITE_URL`: origen de canonical y sitemap. Por defecto `https://www.checkpass.club`.
- `MERCHANT_ONBOARDING_URL`: destino de los CTA de alta. Por defecto `https://business.checkpass.club/es/business/onboarding`.
- `CONSUMER_WALLET_URL`: destino de «Mi pase». Por defecto `https://my.checkpass.club/wallet`.

El despliegue de esta app requiere un proyecto Vercel propio con directorio raíz `apps/public`. La configuración del dominio y de las rutas compartidas con merchant se describe en [despliegue de la web pública](../../docs/despliegue-publico.md).

Antes de conectar la base, definir el contrato de publicación pública y mapear fotos, horarios y beneficios verificables. Las fotos del mock están acreditadas en el pie de la página de exploración y se usan según la [licencia de Pexels](https://www.pexels.com/license/).
