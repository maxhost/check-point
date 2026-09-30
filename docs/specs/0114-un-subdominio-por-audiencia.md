---
spec: 0114
fecha: 2026-09-30
estado: cerrada
resumen: Implementa el ADR 0106 — merchant enruta por host (business./my., 308 al host correcto, apagado sin env), los pases y el QR del afiche se emiten con my., el aviso dice my.checkpass.club, la web publica en www hace 308 de las paginas viejas y proxy de /api/* a merchant, y se retiran los rewrites multi-zones de 0442841. Incluye el runbook de dominios con el punto exacto del aviso a Plantano. Sin migracion.
disjunta: si
archivos: apps/merchant/src/proxy.ts, apps/merchant/src/server/hosts.ts(+test), apps/merchant/next.config.ts, apps/merchant/src/app/api/public/wallet/{apple.pkpass,google}/route.ts, apps/merchant/src/app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts, apps/merchant/src/app/backoffice/brand/kit/page.tsx, apps/merchant/src/server/wallet/{push-text.ts,push-text.test.ts,reminder.ts}, apps/public/next.config.ts, apps/public/src/app/site-config.ts, apps/public/src/legacy-routes.ts(+test), apps/public/vitest.config.ts, vitest.config.ts, docs/despliegue-publico.md
---

# 0114 — Un subdominio por audiencia

> Implementa el **ADR 0106**. Plantilla grande: infraestructura, dos apps y una decision del owner con usuario real
> afectado. Sin migracion de base.

## Problema

`www.checkpass.club` lo sirve merchant y la web publica entra por rewrites (`0442841`): doble salto, cookies de
merchant reenviadas a otro proyecto, lista de rutas a mano. Vienen mas apps. Ademas hay cosas ya emitidas con `www`
grabado (medido 2026-09-30, ADR 0106 §Contexto): 1 pase de Apple (`webServiceURL`, `wallet/apple.ts:77`), su link
`/c/<token>` (`wallet/apple.ts:57`, `wallet/google-object.ts:112`), los QR impresos `/enroll/<programId>`
(`brand-kit/enroll-url.ts`), Stripe, los crons de GitHub (`*_ENDPOINT`) y la sesion viva de Cafeteria Plantano.

## Decisiones del owner (2026-09-30)

Subdominios; comercio en `business.checkpass.club`; cliente en `my.checkpass.club`; avisar a Plantano en el punto
correcto o redirigir (textual en el ADR 0106).

## Elecciones del orquestador (reversibles)

- **H1 — Enrutamiento por host apagado sin env.** `MERCHANT_ORIGIN` y `CONSUMER_ORIGIN` (ej.
  `https://business.checkpass.club`); si falta cualquiera, merchant no redirige nada. Permite desplegar el codigo
  antes de tocar dominios.
- **H2 — Solo se redirige cuando el host ES uno de los dos.** `www`, `*.vercel.app` y `localhost` no se tocan.
- **H3 — `/api/*` no se redirige nunca** (sirve en los dos hosts; su autorizacion no depende del host).
- **H4 — En `my.`, `/` → 308 a `/wallet`.** En `business.`, `/` queda como esta (la landing sin accion, ADR 0070 §17,
  destino de los `redirect("/")` de los guards).
- **H5 — `www/api/*` es proxy (rewrite), no 308**: un `POST` de Stripe, de un cron o de un iPhone no sigue un 308 con
  garantia. Destino: `MERCHANT_API_ORIGIN` (def. `https://business.checkpass.club`).
- **H6 — El texto del aviso** pasa a «Revisa tus beneficios en my.checkpass.club» (consecuencia de la decision del
  owner: `checkpass.club` ahora es la landing de comercios).

## Alcance

**Entra:**
1. `server/hosts.ts` (puro): `decideHostRoute({ host, pathname, search, merchantOrigin, consumerOrigin })` →
   `{ redirect: url } | null`. Paginas del cliente: `/wallet` (y `/wallet/*`), `/c/*`, `/enroll/*`, `/recover`
   (y `/recover/*`). Paginas del comercio: `/backoffice` (y `/*`), `/<locale>/business/*`. En `business.` una
   pagina del cliente → 308 a `consumerOrigin` (mismo path + query); en `my.` una del comercio → 308 a
   `merchantOrigin`; en `my.` `/` → 308 a `/wallet` (H4). `/api/*`, `/_next/*`, archivos con extension y todo lo
   demas → `null`. Host comparado sin puerto y en minusculas.
2. `src/proxy.ts` (Next 16, `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`): lee el env, llama a
   `decideHostRoute` con el header `host`, responde `NextResponse.redirect(url, 308)` o sigue. `matcher` que excluye
   `/api`, `/_next` y archivos estaticos.
3. **Origen del cliente al emitir:** `apple.pkpass/route.ts:37`, `google/route.ts:39` y
   `passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts:68` usan `consumerOriginOr(request.nextUrl.origin)`
   (de `server/hosts.ts`: `CONSUMER_ORIGIN` si esta, si no el del request). Asi un pase ya emitido con `www` se
   actualiza a `my.` en su proxima descarga. El afiche (`app/backoffice/brand/kit/page.tsx:12-18`) usa lo mismo para
   el QR de `/enroll`.
4. `server/wallet/push-text.ts:12` → H6, y su test. El docblock de `reminder.ts:7` que nombra `checkpass.club` se
   actualiza.
5. `apps/merchant/next.config.ts`: se **borran** `PUBLIC_APP_ORIGIN`, `PUBLIC_PATHS` y el `rewrites` de `0442841`.
6. `apps/public`: se borra el `assetPrefix` y su rewrite `/public-zone` de `0442841`; `src/legacy-routes.ts` (puro)
   exporta `legacyRedirects(merchantOrigin, consumerOrigin)` y `legacyRewrites(merchantApiOrigin)` que
   `next.config.ts` usa en `redirects()` / `rewrites()`:
   - 308 → `business.`: `/backoffice`, `/backoffice/:path*`, `/:locale/business/:path*`;
   - 308 → `my.`: `/wallet`, `/wallet/:path*`, `/c/:path*`, `/enroll/:path*`, `/recover`, `/recover/:path*`;
   - rewrite: `/api/:path*` → `${merchantApiOrigin}/api/:path*` (H5).
   Defaults: `https://business.checkpass.club`, `https://my.checkpass.club`; env `MERCHANT_ORIGIN`,
   `CONSUMER_ORIGIN`, `MERCHANT_API_ORIGIN`.
7. `apps/public/src/app/site-config.ts`: `onboardingUrl` def. `https://business.checkpass.club/es/business/onboarding`;
   `consumerWalletUrl` def. `https://my.checkpass.club/wallet`.
8. `docs/despliegue-publico.md`: se reemplaza la seccion multi-zones por el runbook de abajo.
9. **`apps/public` entra a la suite:** `apps/public/vitest.config.ts` (igual que `apps/platform/vitest.config.ts`) y su
   entrada en `projects` del `vitest.config.ts` de root. Sin esto el test de `legacy-routes.ts` no corre nunca
   (medido 2026-09-30: root lista consumer, merchant, platform y tools) y la fila M5 seria falsa.

**No entra:** separar el cliente en su propio proyecto; UI de admin; `Domain=.checkpass.club` en cookies (ADR 0106
§6); cambiar Stripe/GitHub/Google (lo hace el owner, runbook paso 6); retirar el proxy de `www/api` (spec futura,
cuando ningun pase tenga `www`).

## Runbook (owner, en Vercel — en este orden)

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

## Definition of Done

- [ ] `decideHostRoute` cumple la tabla de casos (unit) — incluye H1–H4, query preservada, host con puerto/mayusculas.
- [ ] `legacyRedirects`/`legacyRewrites` devuelven exactamente las entradas del §6 (unit), y `next.config.ts` del
      publico las usa.
- [ ] Las tres rutas de pases y el afiche usan `consumerOriginOr` (unit o integracion: con `CONSUMER_ORIGIN` el
      `webServiceURL` y el link `/c/` salen con `my.`; sin el, con el origin del request).
- [ ] `rg -n 'PUBLIC_APP_ORIGIN|public-zone|assetPrefix' apps` → vacio.
- [ ] Verificacion local con dos servidores (merchant `next dev` con las env de H1, publico `next start`) y `curl -H
      'Host: …'`: `business./wallet` → 308 `my./wallet`; `my./backoffice` → 308 `business./backoffice`; `my./` → 308
      `/wallet`; `business./api/health` 200; publico `/backoffice` → 308 `business.`, `/enroll/x?loc=y` → 308
      `my./enroll/x?loc=y`, `/api/health` → 200 via proxy; sin env, merchant no redirige.
- [ ] Gates: typecheck, lint, test, format:check, build (root, Node 24). `test:e2e` (toca el ruteo de todas las
      paginas): corrido.

## Plan de pruebas y verificación

**Presupuesto:** hasta **5 mutaciones**; clase de error: los plausibles — un host que redirige lo que no debe
(bucle, `/api` redirigido, `www` tocado), un pase emitido con el host viejo, una ruta legacy olvidada. Queda afuera y
se declara: la propagacion DNS y el traspaso de dominios (runbook, lo verifica el owner), y el comportamiento real de
un iPhone ante el proxy (se prueba el `curl` al endpoint de passkit via `www`).

| # | Mecanismo | Oraculo | Guard hermano |
|---|---|---|---|
| M1 | rama «pagina del cliente en `business.`» (`hosts.ts`) | unit: `business./wallet` → 308 `my./wallet` | ninguno |
| M2 | rama «pagina del comercio en `my.`» (`hosts.ts`) | unit: `my./backoffice/x?a=1` → 308 `business./backoffice/x?a=1` | ninguno |
| M3 | exclusion de `/api/*` (`hosts.ts`) | unit: `my./api/public/wallet/passkit/v1/log` → `null` | el `matcher` de `proxy.ts` tambien excluye `/api`: la fila muta el puro y se declara que el matcher es el segundo guard |
| M4 | `consumerOriginOr` en `apple.pkpass/route.ts` | con `CONSUMER_ORIGIN`, el pase sale con `webServiceURL` en `my.` | ninguno |
| M5 | la entrada `/api/:path*` de `legacyRewrites` | unit: la lista contiene el rewrite con destino `MERCHANT_API_ORIGIN` | ninguno |

**Verificacion en PROD (despues del runbook, la corre el orquestador):**
`curl -sI https://www.checkpass.club/backoffice` → 308 `business.`; `curl -sI https://www.checkpass.club/enroll/x`
→ 308 `my.`; `curl -s https://www.checkpass.club/api/health` → 200 merchant; `curl -sI
https://business.checkpass.club/wallet` → 308 `my.`; `curl -s -o /dev/null -w '%{http_code}'
https://www.checkpass.club/api/public/wallet/passkit/v1/log -X POST -d '{}'` → no 404.

## Handoff requerido

Un implementador y un revisor (AGENT-WORKFLOW). El runbook lo ejecuta el owner; el orquestador verifica en PROD.

## Abierto

Nada que bloquee.
