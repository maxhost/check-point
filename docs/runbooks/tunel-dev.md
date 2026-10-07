# Runbook — tunel para probar el ambiente local en el telefono

ADR 0127, spec 0168. Un tunel con nombre de Cloudflare (`checkpass-dev`) publica las dos apps locales con
HTTPS y direccion fija:

| Direccion | App local |
|---|---|
| `https://dev-business.checkpass.club` | merchant (`:3201`) |
| `https://dev-my.checkpass.club` | consumer (`:3200`) |

Acceso abierto (decision del owner): cualquiera con la direccion entra, y lo que ve son los datos FICTICIOS de la
base local. La config de ingress esta en `tools/tunnel/config.yml`; las credenciales del tunel viven en
`~/.cloudflared/`, fuera del repo.

## §1 Alta unica (owner, una sola vez por compu)

En una terminal, de a un comando:

```sh
brew install cloudflared
cloudflared tunnel login
```

`tunnel login` abre el navegador: elegir el dominio `checkpass.club` y autorizar. Deja `~/.cloudflared/cert.pem`.

```sh
cloudflared tunnel create checkpass-dev
cloudflared tunnel route dns checkpass-dev dev-business.checkpass.club
cloudflared tunnel route dns checkpass-dev dev-my.checkpass.club
```

`create` deja `~/.cloudflared/<UUID>.json` (la credencial del tunel). Los dos `route dns` crean los CNAME en
Cloudflare. Comprobar: `dig +short dev-my.checkpass.club` y `dig +short dev-business.checkpass.club` devuelven IPs.

## §2 Uso diario

Cada uno en su terminal, desde la raiz del repo:

```sh
pnpm db:local:up
pnpm dev:tunnel
pnpm dev:merchant
pnpm dev:consumer
```

Trabajar **siempre** por `https://dev-business.checkpass.club` y `https://dev-my.checkpass.club`, tambien en la
compu: los links de login, los pases y los QR se arman con esas direcciones, y las cookies son de ese host.

- Login del comercio: `https://dev-business.checkpass.club/es/business/onboarding`. El link magico sale en la
  terminal de `pnpm dev:merchant` (`EMAIL_PROVIDER=console`).
- `node tools/local-db/check-env.ts` tiene que dar exit 0: revisa, entre otras cosas, que ningun origen de los
  `.env.local` apunte a PROD y que los del tunel esten puestos (§4).

## §3 Telefono

1. Abrir `https://dev-my.checkpass.club` en el navegador del telefono (Safari en iPhone, Chrome en Android).
2. Agregar a la pantalla de inicio. iPhone: Compartir → «Agregar a inicio». En iOS el push solo funciona desde la
   app instalada, no desde Safari.
3. Abrir la app instalada y aceptar las notificaciones.

## §4 Variables (las pone el owner: los agentes no escriben `.env*`)

| Archivo | Variable | Valor |
|---|---|---|
| `apps/merchant/.env.local` | `BETTER_AUTH_URL` | `https://dev-business.checkpass.club` |
| `apps/merchant/.env.local` | `CONSUMER_ORIGIN` | `https://dev-my.checkpass.club` |
| `apps/consumer/.env.local` | `CONSUMER_ORIGIN` | `https://dev-my.checkpass.club` |

Sin `CONSUMER_ORIGIN` en merchant, el rewrite de `/api/public/*` cae a PROD (`apps/merchant/next.config.ts`).

## §5 Que no se puede por el tunel

- **Wallet real:** el pase local es autofirmado (`WALLET_PROVIDER=fake`); el iPhone lo rechaza. Credenciales de
  desarrollo de Apple/Google: decision abierta del owner.
- **Login con Google/Apple del cliente:** `dev-my.` no esta registrado en los proveedores.

## Fallas conocidas

- `ABORTADO: falta cloudflared` → §1, `brew install cloudflared`.
- `ABORTADO: falta cloudflared tunnel login` → §1, `cloudflared tunnel login`.
- 502 de Cloudflare en una de las direcciones → la app de ese puerto no esta arriba.
- «Blocked cross-origin request» de Next en la consola → falta el host en `allowedDevOrigins` del `next.config.ts`.
