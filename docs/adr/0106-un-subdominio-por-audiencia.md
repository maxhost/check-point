---
adr: 0106
fecha: 2026-09-30
estado: aceptada
resumen: Cada audiencia tiene su subdominio — checkpass.club (web publica), business.checkpass.club (comercio), my.checkpass.club (cliente), admin.checkpass.club (plataforma) — sin proxy entre proyectos; www conserva para siempre una capa de compatibilidad (308 de las paginas viejas y proxy de /api/*) porque pases de Wallet, QR impresos e integraciones externas ya tienen www grabado. Descarta Vercel Microfrontends (Hobby: 2 proyectos; Pro: US$ 250/proyecto/mes) y el dominio unico con rewrites.
---

# 0106 — Un subdominio por audiencia

## Contexto

La web publica (`apps/public`) vive en su propio proyecto Vercel y el dominio `www.checkpass.club` lo sirve merchant.
El 2026-09-30 se resolvio con multi-zones (rewrites desde merchant, `0442841`): funciona, pero tiene doble salto,
reenvia las cookies de merchant a otro proyecto y exige listar a mano cada ruta publica. Vienen mas apps (cliente,
admin). Vercel Microfrontends es la solucion nativa pero no entra en el plan (doc oficial, leida el 2026-09-30:
«Hobby and Pro include two microfrontend projects», Hobby sin ampliacion; Pro US$ 250 por proyecto adicional por mes).

**Owner (2026-09-30, AskUserQuestion):** estrategia **«Subdominios»**; comercio en **`business.checkpass.club`**; cliente
en **`my.checkpass.club`** («my.checkpass.clubm», leido como error de tipeo). Y: «ya tenemos un usuario real en el app
que es Cafeteria Plantano entonces tendrias que indicarme en que punto tengo que avisarles para que no pierdan acceso
al app o aplicar un redireccionamiento».

**Medido (2026-09-30):** PROD tiene 6 comercios, 1 cliente, **1 pase y 1 iPhone registrado**, 1 pedido, 1 sesion de
comercio viva. El pase de Apple lleva grabado `webServiceURL = <origin>/api/public/wallet/passkit`
(`wallet/apple.ts:77`) y el link `<origin>/c/<token>` (`wallet/apple.ts:57`, `wallet/google-object.ts:112`), con
`origin = request.nextUrl.origin` → hoy `https://www.checkpass.club`. Los afiches impresos llevan
`<origin>/enroll/<programId>` (`brand-kit/enroll-url.ts`), con el origin del backoffice. Stripe y los crons de GitHub
(`*_ENDPOINT`) apuntan a `www`. No hay middleware en merchant.

## Decision

1. **Dominios.** `checkpass.club` + `www` → proyecto de `apps/public`. `business.checkpass.club` y `my.checkpass.club`
   → el proyecto merchant (una sola app Next sirve las dos audiencias hasta que el cliente se separe en su propio
   proyecto; entonces solo se mueve `my.` de proyecto). `admin.checkpass.club` → `apps/platform` cuando tenga UI.
2. **Cada host sirve solo lo suyo.** En merchant, las paginas del comercio en `business.` y las del cliente en `my.`;
   la pagina pedida en el host equivocado responde **308 al host correcto** (mismo path y query). Las `/api/*` se
   atienden en los dos hosts (su autorizacion no depende del host).
3. **Sin proxy entre proyectos en el camino normal.** Se retiran los rewrites multi-zones de `0442841`.
4. **Compatibilidad permanente en `www`** (lo grabado no se puede reescribir): las paginas viejas del comercio →
   308 a `business.`; las del cliente (`/wallet`, `/c/*`, `/enroll/*`, `/recover`) → 308 a `my.`; **`/api/*` →
   proxy** (rewrite) a merchant, porque un iPhone con un pase emitido, Stripe y los crons hablan con `www` y un 308
   no es seguro para un `POST`. El proxy de `/api/*` se mantiene mientras exista un pase con `www` grabado.
5. **Lo que se emite desde ahora usa el host nuevo:** los pases y el QR del afiche llevan `my.checkpass.club`; los
   avisos dicen «my.checkpass.club»; el login del comercio vive en `business.`.
6. **Las cookies quedan por host** (sin `Domain=.checkpass.club`): la sesion del comercio no viaja al cliente ni a la
   web publica. Costo: quien tenga una sesion en `www` vuelve a entrar una vez.

## Consecuencias

- Cafeteria Plantano tiene que volver a iniciar sesion una vez, en `business.checkpass.club`; su QR impreso sigue
  funcionando por la redireccion. El aviso va en el paso del runbook de la spec 0114 que activa `business.`.
- Stripe, los secrets de GitHub y el callback de Google se actualizan al host nuevo; mientras tanto el proxy de
  `www` los sigue atendiendo.
- Una app nueva = un proyecto + un subdominio, sin tocar la configuracion de las otras.
