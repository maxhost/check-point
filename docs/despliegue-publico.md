# Despliegue de la web pública

La app pública vive en `apps/public` y se despliega como proyecto Vercel independiente de `apps/merchant`. Su ruta `/` es la landing de negocios; `/negocios` redirige a `/`. `/explorar` y las fichas de ejemplo se publican con `noindex` mientras usan datos ficticios.

## Crear el proyecto

1. En Vercel, importar el mismo repositorio de GitHub como proyecto nuevo y seleccionar `apps/public` como **Root Directory**. La rama de producción es `main`.
2. Usar Node `24.x`, pnpm `11.4.0` y el framework Next.js. Los scripts de `apps/public/package.json` contienen el build y el arranque. Vercel debe instalar desde la raíz del monorepo para resolver el lockfile y las dependencias compartidas.
3. Desplegar primero en el dominio temporal de Vercel y comprobar `/`, la redirección de `/negocios`, `/explorar`, `robots.txt`, `sitemap.xml` y los CTA hacia el alta merchant.

Variables opcionales de `apps/public`:

- `PUBLIC_SITE_URL`: origen final de la web pública usado en canonical, Open Graph y sitemap. Por defecto `https://www.checkpass.club`.
- `MERCHANT_ONBOARDING_URL`: URL completa del alta, por defecto `https://www.checkpass.club/es/business/onboarding`.
- `CONSUMER_WALLET_URL`: URL completa de la billetera, por defecto `https://www.checkpass.club/wallet`.

## Pasar a `www.checkpass.club`

**No asignar `www.checkpass.club` directamente al proyecto público todavía.** Ese dominio sirve actualmente la app merchant. Un dominio de producción solo se puede asignar directamente a un proyecto Vercel; moverlo al público sin un enrutamiento común dejaría de servir `/es/business/onboarding`, `/wallet`, `/backoffice` y las rutas API existentes.

Para conservar las rutas en un solo origen, configurar [Vercel Microfrontends](https://vercel.com/docs/microfrontends/quickstart), [Next.js multi-zones](https://nextjs.org/docs/app/guides/multi-zones) o un proyecto proxy con rewrites. Dirigir la raíz y las páginas públicas a `apps/public`, y las rutas de alta, autenticación, wallet, backoffice y API a `apps/merchant`. Revisar también assets de Next, cookies y callback de autenticación antes de cambiar el dominio. Como alternativa, separar merchant en un subdominio requiere revisar explícitamente sesiones, URLs y callbacks.

Tras configurar el enrutamiento, actualizar las variables de URL si cambian los orígenes, verificar el recorrido landing → alta → dashboard en producción y después asignar el dominio. Hasta ese momento, el dominio temporal de la app pública permite revisar el sitio sin alterar el merchant actual.

Referencias: [Vercel monorepos](https://vercel.com/docs/monorepos), [varios proyectos bajo un dominio](https://vercel.com/kb/guide/how-can-i-serve-multiple-projects-under-a-single-domain).
