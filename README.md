# Mi Pasaporte

Monorepo de las aplicaciones web separadas de consumidor, comercio y plataforma.

## Requisitos

- Node.js 24 LTS. Desarrollo local usa 24.19.0 (ver `.node-version`); Vercel puede
  ejecutar una revisión 24.x compatible.
- pnpm 11.4.0

## Inicio local

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Los health checks quedan disponibles en:

- `http://localhost:3000/api/health` — consumer
- `http://localhost:3001/api/health` — merchant
- `http://localhost:3002/api/health` — platform

El checklist para desplegar y probar el registro real de Owner está en
[docs/DEPLOY-OWNER-TEST.md](docs/DEPLOY-OWNER-TEST.md).

## Controles

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## QA de check-in consumer

El prototipo de la Spec 0011 no usa backend. Para probarlo desde un teléfono, expón el
puerto 3000 mediante una URL HTTPS temporal, define esa URL en `.env.local` como
`NEXT_PUBLIC_QA_ORIGIN`, ejecuta `pnpm qa:qr` y después `pnpm dev:consumer`. Abre
`/qa` en la computadora y escanea el QR desde el teléfono. HTTPS es necesario para que
el navegador del teléfono permita geolocalización.

Para QA HTTP en la misma red local, inicia Next con `--hostname 0.0.0.0` y usa la IP LAN
del Mac. `apps/consumer/next.config.ts` debe incluir esa IP en `allowedDevOrigins`; si
cambias de Wi-Fi, actualízala y reinicia Next.
