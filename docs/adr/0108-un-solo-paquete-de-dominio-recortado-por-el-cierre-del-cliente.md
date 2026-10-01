---
adr: 0108
fecha: 2026-09-30
estado: aceptada
resumen: La fase 2 del ADR 0107 saca de merchant UN solo paquete de dominio, @mi-pasaporte/domain, con exactamente el cierre de imports de las pantallas y rutas del cliente (111 modulos, medido), movidos byte a byte con la misma estructura de carpetas (src/server, src/lib, src/i18n, src/components); no un paquete por dominio, porque las carpetas se importan en ciclo (wallet ↔ consumer) y partirlas seria refactor, no movimiento.
---

# 0108 — Un solo paquete de dominio, recortado por el cierre del cliente

## Contexto

El ADR 0107 §1 dice «despues los [paquetes] de dominio que usen las dos apps». Medido el 2026-09-30 sobre `d20f2c5`
con un cierre de imports relativos (estaticos, `import()` y `import type`) desde los 45 archivos no-test de
`app/(consumer)/**` y `app/api/public/**` de merchant:

- el cliente arrastra **111 modulos** de `apps/merchant/src` (~15.000 lineas): 83 los usa tambien el resto de merchant
  y 28 solo el cliente (`server/consumer/*`, `server/otp/*`, `wallet/passkit`, `wallet/google-callback`, …);
- **ninguno de los 111 importa un modulo de merchant fuera del conjunto** (es un cierre: por construccion);
- las carpetas se importan en ciclo: `server/wallet/core.ts:9` → `consumer/core`, y
  `server/consumer/recovery/internal.ts:5` → `wallet/rotate`. Tambien `customers/projection` → `counter/core` y
  `marketing/driver-values`; `consumer/*` → `marketing/*` (23 aristas).

## Decision

1. **Un solo paquete, `packages/domain` = `@mi-pasaporte/domain`**, con exactamente esos 111 modulos (lista en
   `specs/0116-modulos-movidos.txt`). Un paquete por carpeta exigiria romper los ciclos, y eso cambia codigo; la fase 2
   es un movimiento.
2. **Misma estructura de carpetas** dentro de `src/` (`server/…`, `lib/…`, `i18n/locales.ts`,
   `components/loyalty/card-preview.tsx`): los imports relativos ENTRE los modulos movidos no se tocan y cada archivo
   se mueve byte a byte. El especificador es la ruta vieja con el prefijo del paquete:
   `apps/merchant/src/server/wallet/core.ts` → `@mi-pasaporte/domain/server/wallet/core`.
3. **El recorte lo da el cierre, no el dominio**: lo que el cliente no importa queda en merchant aunque viva en la
   misma carpeta (p. ej. parte de `server/marketing/*`).
4. Los 28 modulos que solo usa el cliente van al paquete igual: en la fase 2 merchant sigue sirviendo el cliente y los
   necesita. Si vuelven a `apps/consumer` lo decide la 0117 al borrar el cliente de merchant.

## Consecuencias

- Partir el paquete por dominio queda posible despues, ya fuera de merchant, como refactor con su propia spec.
- `card-preview.tsx` es un componente React sin imports que usan el backoffice y la billetera: el paquete declara
  `react` como `peerDependency` y exporta esa ruta `.tsx` explicitamente.
