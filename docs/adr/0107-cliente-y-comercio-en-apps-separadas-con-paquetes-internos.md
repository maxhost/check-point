---
adr: 0107
fecha: 2026-09-30
estado: aceptada
resumen: El cliente sale de apps/merchant a apps/consumer (proyecto Vercel propio en my.checkpass.club) compartiendo codigo por PAQUETES INTERNOS del monorepo (packages/db primero, despues los de dominio) y la misma base Neon, con un rol de Postgres de permisos minimos para el cliente; en 3 fases desplegables solas — paquete de base, dominio + app del cliente sin trafico, corte por traspaso de dominio con vuelta atras — y al final se borra el codigo del cliente de merchant.
---

# 0107 — Cliente y comercio en apps separadas, con paquetes internos

## Contexto

Tras el ADR 0106 el cliente se ve en `my.checkpass.club`, pero su codigo vive en `apps/merchant`: 45 archivos de
pantallas y `/api/public/*`, que importan `server/consumer` (49 imports), `wallet` (21), `push`, `otp`,
`marketing`, `loyalty-program`, `catalog`, `brand` y R2 (medido 2026-09-30). El acople mas fuerte va del comercio al
cliente: el mostrador escribe en la cola de avisos de Wallet (`counter/orders.ts`, `redemptions.ts`,
`coupon-store.ts`). El esquema (28 archivos), el cliente de base (`server/db.ts`) y las migraciones viven en merchant
y los importan 279 archivos. `apps/consumer` solo tiene demos. No existe `packages/`.

**Owner (2026-09-30, AskUserQuestion):** codigo compartido por **«Paquetes internos»**; **«Sí, en la fase 3»** un
rol de base por app con permisos minimos; **«Ya, las 3 fases seguidas»**.

## Decision

1. **Paquetes internos del monorepo** (`packages/*`, workspace de pnpm, codigo TypeScript fuente transpilado por cada
   app): primero `packages/db` (esquema, cliente, migraciones, `drizzle.config`); despues los de dominio que usen las
   dos apps. Sin re-exports de transicion: los imports se reescriben al paquete.
2. **Una sola base Neon.** Nada de APIs internas entre apps para leer datos.
3. **Tres fases, cada una desplegable sola:** (1) `packages/db`, sin cambio de comportamiento; (2) paquetes de
   dominio + `apps/consumer` real, sin trafico; (3) proyecto Vercel del cliente, verificacion en su dominio temporal
   y en un telefono, traspaso de `my.checkpass.club` (vuelta atras = devolver el dominio), cron de avisos de Wallet y
   proxy `www/api/public/*` al cliente, **rol de Postgres del cliente sin `merchant_auth`**, y borrado del codigo del
   cliente en merchant (ADR 0070 §17).
4. **Cada app con sus secretos:** los certificados de Wallet, VAPID y OTP del cliente salen de merchant si merchant ya
   no los usa.
5. Durante las tres fases **no se suman features al cliente** (chocan con el movimiento).

## Consecuencias

- Spec por fase (0115, 0116, 0117), cada una con implementador + revisor; la siguiente se escribe contra el arbol ya
  implementado.
- `tools/neon-test.sh`, `db:migrate` y los workflows cambian de ruta en la fase 1.
- El proyecto Vercel de merchant pasa a depender de un paquete del workspace (instala desde la raiz, como ya hace).
