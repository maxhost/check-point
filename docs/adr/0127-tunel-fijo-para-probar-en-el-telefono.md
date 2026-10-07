---
adr: 0127
fecha: 2026-10-07
estado: aceptada
resumen: El ambiente local se abre al telefono con un Cloudflare Tunnel con nombre y dos subdominios FIJOS de checkpass.club (`dev-business.` → merchant en :3001, `dev-my.` → consumer en :3000), abierto a cualquiera con la direccion mientras esta prendido. Las variables de origen de los `.env.local` pasan a esas direcciones y ninguna puede apuntar a un host de PROD.
---

# 0127 — Tunel fijo para probar el ambiente local en el telefono

## Contexto

Con el ambiente local del ADR 0126 las apps corren en `localhost`, que el telefono no alcanza. La IP de la red
(`allowedDevOrigins: ["192.168.100.7"]`, `apps/consumer/next.config.ts`) da `http`, y sin `https` el telefono no instala
la PWA ni acepta push; las cookies del cliente son `secure: true` (`packages/domain/src/server/consumer/oauth/state-cookie.ts:20`).

Medido el 2026-10-07 al preparar el QA local: los `.env.local` siguen con origenes de PROD aunque la base ya es local.
`BETTER_AUTH_URL` de merchant es `business.checkpass.club` (el link de login de la consola llevaria a PROD) y
`CONSUMER_ORIGIN` de consumer es `my.checkpass.club` (pases y callbacks OAuth emitidos hacia PROD). Merchant no tiene
`CONSUMER_ORIGIN` y su rewrite de `/api/public/*` cae al default `https://my.checkpass.club`
(`apps/merchant/next.config.ts:16`). `tools/local-db/check-env.ts` (spec 0167) no mira origenes.

## Decision (owner, 2026-10-07)

1. **Tunel con nombre de Cloudflare** y subdominios fijos de `checkpass.club` (su DNS ya esta en Cloudflare:
   `hasslo`/`tina.ns.cloudflare.com`). `dev-business.checkpass.club` → merchant (`localhost:3001`),
   `dev-my.checkpass.club` → consumer (`localhost:3000`). Fijos para que la PWA instalada y la suscripcion de push
   sobrevivan entre sesiones y para poder registrar despues callbacks de OAuth/Wallet de desarrollo.
   Descartado: tunel rapido `*.trycloudflare.com` (direccion nueva cada vez).
2. **Acceso abierto** a quien tenga la direccion mientras el tunel esta prendido (sin Cloudflare Access). Detras hay
   solo datos ficticios (ADR 0126 §3).
3. Los `.env.local` usan las direcciones del tunel como origen, tambien desde la compu, y **ningun origen local puede
   ser un host de PROD**: lo verifica `check-env.ts`.

## Consecuencias

- Login de merchant y links del cliente necesitan el tunel prendido (el link de la consola apunta a `dev-business.`).
- La wallet real en el telefono sigue afuera: requiere decidir credenciales de desarrollo de Apple/Google (ADR 0126 §4).
- La instalacion de `cloudflared` y el `tunnel login` (navegador) son del owner, una vez.
