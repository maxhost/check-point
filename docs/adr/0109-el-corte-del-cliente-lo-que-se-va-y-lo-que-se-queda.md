---
adr: 0109
fecha: 2026-09-30
estado: aceptada
resumen: El corte (fase 3 del ADR 0107) se hace de una vez y sin pasar my. por merchant: proyecto Vercel propio para apps/consumer con my.checkpass.club y un rol de Postgres sin merchant_auth; merchant borra las pantallas y /api/public del cliente pero conserva un proxy de /api/public/* al cliente (pases y callbacks ya emitidos); el worker de avisos de Wallet y los 28 modulos solo-cliente se quedan donde estan (merchant y packages/domain), corrigiendo el §3 del ADR 0107.
---

# 0109 — El corte del cliente: lo que se va y lo que se queda

## Contexto

Fase 3 del ADR 0107. Tras la 0116 (`627e6f7`) `apps/consumer` tiene copias identicas de las pantallas y rutas del
cliente; merchant las sigue sirviendo. `my.checkpass.club` no responde (no esta en ningun proyecto) y `www` ya
redirige ahi los QR impresos y el link del pase.

**Owner (2026-09-30, textual):** «no quiero parche, quiero que acabes de migrar el proyecto customer fuera de
merchant, que subamos ese proyecto a vercel con su propio dominio». AskUserQuestion: el proyecto lo crea **«Yo en el
dashboard»**; orden **«Todo junto»**; la raiz de `my.` **«Redirige a /wallet»**.

Medido sobre `0930d4b`:
- Los pases de Apple estan en PROD con certificado real (`docs/wallet-go-live.md`). Su `webServiceURL` es
  `CONSUMER_ORIGIN` o el origen del request (`apple.pkpass/route.ts`: `consumerOriginOr(request.nextUrl.origin)`);
  `CONSUMER_ORIGIN` no esta cargado en merchant, asi que los pases emitidos llevan `www.` o `business.` grabado.
- Merchant sigue necesitando los proveedores de Wallet sin el cliente: `counter/{orders,redemptions,redeem,grant,coupon,coupon-store}.ts`
  encolan, `server/wallet/push-worker.ts` + `apns.ts` despachan, y `/api/internal/wallet-push` es su cron.
- Tras borrar el cliente de merchant, los 28 modulos que solo usa el cliente los siguen importando **tests de merchant**
  como preparacion (enrolar un cliente para probar el mostrador).
- La base tiene tres esquemas (`merchant_auth`, `core`, `consumer`). El codigo del cliente solo nombra una tabla de
  `merchant_auth` en `onboarding-grant.ts` (`shortenOnboardingGrant`), que llama unicamente `saveProgram`
  (`loyalty-program.ts:157`), y el cliente no lo llama.

## Decision

1. **Sin paso intermedio:** `my.` se agrega directo al proyecto nuevo del cliente; no pasa por merchant.
2. **Proyecto Vercel `apps/consumer`** (lo crea el owner con un runbook de pasos con precondicion verificable,
   LECCIONES 2026-09-30); raiz `/` → 308 a `/wallet`.
3. **Rol de Postgres `checkpass_consumer`** con `USAGE` y DML en `core` y `consumer`, nada en `merchant_auth`, y
   privilegios por defecto para las tablas que creen migraciones futuras. Es el `DATABASE_URL` del proyecto del cliente.
4. **Merchant borra** `app/(consumer)/**`, `app/api/public/**`, el CSS `.consumer-*` y los assets solo-cliente, y
   **conserva**: el 308 de paginas del cliente a `my.` (`hosts.ts`) y un **proxy `/api/public/*` → cliente** para los
   pases y callbacks que ya tienen `business.` grabado. `www` manda `/api/public/*` al cliente y el resto de `/api/*`
   a merchant.
5. **Corrige el ADR 0107 §3–4:** el worker de avisos de Wallet **se queda en merchant** (lo alimenta el mostrador, que
   es de merchant) y los certificados de Wallet viven en los dos proyectos. Los 28 modulos solo-cliente **se quedan en
   `packages/domain`** (los usan tests de merchant).

## Consecuencias

- Los tests que prueban pantallas o rutas del cliente pasan a `apps/consumer` si no necesitan codigo de merchant;
  si lo necesitan (escenarios cruzados mostrador → cliente) se quedan en merchant importando el archivo de
  `apps/consumer` por ruta relativa. **Solo tests** pueden cruzar de app; lo pinnea un barrido.
- Entre el deploy del proyecto nuevo y el traspaso de `my.` no hay ventana rota extra: `my.` hoy ya no responde.
