---
spec: 0190
fecha: 2026-10-10
estado: cerrada
resumen: Implementa el ADR 0135 (L2, todo Claude). `apps/platform` en `admin.checkpass.club` con login por link al correo para la lista blanca `PLATFORM_ADMIN_EMAILS` (Better Auth propio en `platform_auth`, migracion 0070 aditiva), una lista de los comercios (alta, dueño, plan, acceso, fin de prueba y dias que quedan) y la ficha de cada uno para sumar dias o fijar la fecha de fin de la prueba, con registro en `platform_auth.audit_log`. Reusa el kit de UI del comercio por ruta relativa. El correo pasa a `packages/domain`. Borra la skill `/extender-prueba`.
disjunta: si
archivos: packages/db/drizzle/0070_* (+ meta), packages/db/src/schema/{_schemas,platform-auth}.ts, packages/db/src/schema.ts, packages/domain/src/server/email/* (movido de apps/merchant/src/server/email), apps/merchant/src/server/{auth.ts,email-provider.test.ts,email/*}, apps/platform/** (package.json, next.config.ts, postcss, globals.css, app, server, tests), tools/neon-test.sh (`--app platform`), .claude/skills/extender-prueba (se borra), docs/INDEX.md
---

# 0190 — Panel de plataforma minimo

> Plantilla chica por nivel **L2** (ADR 0129, decision del owner 2026-10-10) aunque trae una migracion: es
> **aditiva** (un esquema nuevo, ninguna tabla existente cambia). L2 = sin implementador ni revisor separados; los
> tests y las mutaciones de abajo son el oraculo.

## Problema

- La prueba de cada comercio vence sola (`core.subscription.trial_ends_at`, spec 0189) y la unica forma de verla o
  moverla es pedirle a Claude que corra SQL en PROD (`.claude/skills/extender-prueba/SKILL.md`).
- `apps/platform` tiene una sola ruta (`src/app/api/health/route.ts`); no hay login de plataforma ni esquema
  `platform_auth` (`packages/db/src/schema/_schemas.ts` declara solo `merchant_auth`, `core`, `consumer`).

## Alcance

**Entra:** login por link al correo con lista blanca; lista de comercios; ficha de un comercio con «sumar dias» y
«fijar fecha» de la prueba (pasada incluida, con confirmacion); registro de cada cambio; cerrar sesion.

**No entra:** suspender/cerrar comercio, datos de Stripe, numeros de la red, crear o borrar admins desde la UI, correr
el barrido de campañas al instante, el proyecto de Vercel (lo crea Claude despues con OK del owner o el owner), mover
el kit de UI a un paquete.

## Diseño

### D1 — Migracion 0070 (`platform_auth`)

Esquema `platform_auth` con `user`, `session`, `account`, `verification` (mismas columnas que `merchant_auth`,
`packages/db/src/schema/auth.ts`) y:

```
platform_auth.audit_log (
  id uuid pk default gen_random_uuid(),
  admin_email text not null,
  business_id uuid not null references core.business(id) on delete cascade,
  action text not null check (action in ('trial_add_days','trial_set_date')),
  before_trial_ends_at timestamptz,
  after_trial_ends_at timestamptz not null,
  created_at timestamptz not null default now()
)
```

Indice `(business_id, created_at desc)`. Sin grants al rol del cliente.

### D2 — Login

- `getPlatformAuth()` (`apps/platform/src/server/auth.ts`): Better Auth con `PLATFORM_AUTH_SECRET` (≥32) y
  `PLATFORM_AUTH_URL`, adaptador drizzle sobre las tablas de D1, plugin `magicLink` (`expiresIn: 900`,
  `disableSignUp: false`: el primer login de un correo de la lista crea su `user`). **No se monta el catch-all
  `/api/auth/[...all]`**: solo existen nuestras rutas, que llaman a `auth.api.*`.
- `adminEmails(env)`: `PLATFORM_ADMIN_EMAILS` partido por coma, `trim` + minusculas, vacios fuera. Sin variable → `[]`.
- `POST /api/auth/start` `{ email }`: email invalido → 400 `invalid_email`. Si no esta en la lista → 200
  `{ ok: true }` sin enviar nada. Si esta y hay una `verification` de ese correo creada hace menos de 60 s → 200 sin
  enviar. Si no → `auth.api.signInMagicLink`; el mail lleva `PLATFORM_AUTH_URL/api/auth/magic-link?token=…`. Proveedor
  caido → 503 `email_unavailable`.
- `GET /api/auth/magic-link?token=` → `auth.api.magicLinkVerify` (pone la cookie) → 303 a `/`. Token invalido o
  vencido → 303 a `/login?e=link_invalid`.
- `POST /api/auth/sign-out` → revoca la sesion → 303 a `/login`.

### D3 — Guard

`apps/platform/src/server/admin-guard.ts`:
- `requireAdmin()` (paginas): sin sesion → `redirect("/login")`; email de la sesion fuera de la lista →
  `redirect("/login?e=not_admin")`. Devuelve `{ email }`.
- `requireApiAdmin(request)` (rutas): sin sesion → 401 `unauthorized`; fuera de la lista → 403 `not_admin`.
- La lista se lee en **cada** llamada (sacar un correo corta en el proximo request).

### D4 — Lista (`/`)

Una consulta (`apps/platform/src/server/businesses.ts`, `listBusinesses(now)`): por comercio, `id`, `name`, `slug`,
`status`, `createdAt`, email del dueño (membresia `owner` → `merchant_auth.user`), `plan`, `trialEndsAt`, si tiene
suscripcion de Stripe, y `access` + `trialDaysLeft` calculados con `billingAccess`/`trialDaysLeft` de
`packages/domain/src/server/billing-access.ts` (no se reimplementan). Comercio sin fila de suscripcion → `access:
"blocked"`. Orden: bloqueados primero, despues por `trialEndsAt` ascendente (el que vence antes arriba), despues los que
pagan. Tabla con: comercio (link a la ficha), dueño, alta, estado, plan, acceso, fin de prueba, dias.

### D5 — Ficha (`/comercios/[id]`) y escritura

Pagina con los datos de D4 de ese comercio, el formulario y los ultimos 20 registros de `audit_log` de ese comercio.
`id` que no es uuid o no existe → `notFound()`.

`POST /api/businesses/[id]/trial`, cuerpo:
`{ mode: "add_days", days: entero 1..365 } | { mode: "set_date", date: "AAAA-MM-DD", confirmBlock?: boolean }`.

`nextTrialEnd(current, now, input)` (pura, `apps/platform/src/server/trial.ts`):
- `add_days` → `max(current ?? now, now) + days` (misma regla que la skill que reemplaza).
- `set_date` → `AAAA-MM-DDT23:59:59-05:00` (Ecuador, sin horario de verano).

En UNA transaccion: `select … for update` de `core.subscription` del comercio; calcular; escribir `trial_ends_at` y
`updated_at`; insertar el `audit_log`. Respuestas:

| Caso | Respuesta |
|---|---|
| ok | 200 `{ trialEndsAt, access, trialDaysLeft }` |
| cuerpo invalido (modo, dias fuera de rango, fecha invalida) | 400 `invalid_body` |
| sin sesion / fuera de la lista | 401 `unauthorized` / 403 `not_admin` |
| comercio o fila de suscripcion inexistente | 404 `not_found` |
| suscripcion de Stripe viva (`hasLiveSubscription`) | 409 `subscription_live` («ya paga: la prueba se mueve en Stripe») |
| la fecha resultante es ≤ `now` y no vino `confirmBlock: true` | 409 `would_block` |

La pantalla muestra el codigo con texto propio y, ante `would_block`, pide confirmar y reenvia con `confirmBlock`.

### D6 — UI y estilos

Kit importado de `apps/merchant/src/ui` (barril `index.ts`) por ruta relativa. `apps/platform` agrega Tailwind 4
(`@tailwindcss/postcss`), su `globals.css` importa `tokens.css` del kit y declara `@source` sobre esa carpeta.
Pantallas sobrias: `PageHeader`, tabla simple, `Card`, `TextField`, `NumberField`, `Button`, `feedback`. Español de
Ecuador, tuteo. 390 px y escritorio.

### D7 — Correo

`apps/merchant/src/server/email/{channel,console,provider,resend}.ts` se mueven a
`packages/domain/src/server/email/`; `magicLinkEmail` queda en el merchant (su texto es del comercio) y el panel tiene
el suyo. Sus 2 importadores (`auth.ts`, `email-provider.test.ts`) cambian el import; nada mas.

### D8 — Tooling y limpieza

`tools/neon-test.sh --app platform`. Se borra `.claude/skills/extender-prueba/`. `apps/platform/.env.local` de
ejemplo documentado en el handoff (sin valores), `EMAIL_PROVIDER=console` en local.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/{_schemas,platform-auth}.ts`, `packages/db/src/schema.ts`, `packages/db/drizzle/0070_*` | crear / editar |
| `packages/domain/src/server/email/*` | mover desde el merchant |
| `apps/merchant/src/server/{auth.ts,email-provider.test.ts}` | editar import |
| `apps/platform/{package.json,next.config.ts,postcss.config.mjs,tsconfig.json}` | editar / crear |
| `apps/platform/src/app/{layout,globals.css,page,login/page,comercios/[id]/page}.tsx` | crear |
| `apps/platform/src/app/api/auth/{start,magic-link,sign-out}/route.ts`, `api/businesses/[id]/trial/route.ts` | crear |
| `apps/platform/src/server/{auth,admin-guard,admin-emails,businesses,trial}.ts` + tests | crear |
| `tools/neon-test.sh` | editar |
| `.claude/skills/extender-prueba/` | borrar |

**Disjunta:** si. No toca pantallas del merchant ni `apps/public` (GPT).

## Definition of Done

- [ ] Unit: `adminEmails` (vacia → nadie, espacios y mayusculas), `nextTrialEnd` (prueba vigente, vencida, nula,
      `set_date` a las 23:59:59 −05:00), `requireApiAdmin` (sin sesion 401, correo sacado de la lista 403).
- [ ] Neon (`tools/neon-test.sh --app platform`): la ruta de la prueba escribe UNA fila + UN `audit_log`; 409
      `subscription_live`; 409 `would_block` y 200 con `confirmBlock`; 404; `listBusinesses` da `access` y dias
      correctos para un comercio en prueba, uno bloqueado y uno que paga, y el email del dueño.
- [ ] `/api/auth/start` con un correo fuera de la lista no crea `verification` (Neon).
- [ ] `rg --files apps/platform/src/app | rg '\[\.\.\.'` → vacio (sin catch-all de auth).
- [ ] `test ! -e .claude/skills/extender-prueba` y `rg -n extender-prueba .claude apps packages tools` → vacio.
- [ ] Migracion 0070 aplicada en la rama de CI por `tools/neon-test.sh` y releida por SQL (tablas y check).
- [ ] QA visual en local (390 px y escritorio): login con link de consola, lista, sumar dias, fijar fecha pasada
      con confirmacion.
- [ ] `pnpm verify` en verde con Node 24, una sola vez al final, con su tabla transcripta.
- [ ] `rg -n '\b(MUTATION|MUTACION)\b' apps/*/src packages/*/src` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `requireApiAdmin` deja de mirar la lista (solo sesion) | unit «correo sacado de la lista → 403» |
| 2 | la ruta de la prueba no llama a `hasLiveSubscription` | Neon «suscripcion viva → 409 `subscription_live`» |
| 3 | `add_days` suma sobre `current` aunque ya vencio (sin `max(…, now)`) | unit «prueba vencida + 7 → now + 7» |

**Guard hermano:** no hay otro que produzca 403/409 en esos caminos (la lista se mira solo en `admin-guard.ts`; la
suscripcion viva solo en la ruta). **Protocolo:** shasum limpio, bitacora antes de medir, etiqueta, medir, revertir
con `diff`. **Corte:** dos vueltas de «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- Envio real por Resend (se prueba en live con el primer login).
- Que el kit se vea igual que en el comercio (QA visual, no test).
- Rate limit fuera de los 60 s por correo: la lista blanca hace que el unico destinatario posible sea el owner.

## Abierto

Nada que bloquee. Despues: proyecto de Vercel `admin.checkpass.club` + variables (ADR 0135, Consecuencias), con OK del
owner; migracion 0070 a PROD en el mismo pase a live.
