---
fecha: 2026-08-10
resumen: Neon Postgres y Better Auth autoalojado separan identidad de consumidor, comercio y plataforma.
estado: propuesta
---

# ADR 0012 — Neon, Better Auth y esquemas de identidad separados

## Propuesta

Usar Neon Postgres como base de datos. Better Auth se ejecuta dentro de las aplicaciones en vez de usar Neon Auth gestionado. Habrá tres configuraciones y esquemas: `consumer_auth`, `merchant_auth` y `platform_auth`; los datos de producto viven en `core` y son migrados con Drizzle.

Consumidor usa sesión guest/anónima y teléfono OTP sin contraseña. Comercio y plataforma usan email/contraseña sólo en sus propios backoffices.

## Motivo

El producto requiere enlazar guests, personalizar OTP y conservar dominios de acceso estrictamente separados.

## Consecuencias

- Las migraciones de Better Auth y Drizzle se ejecutan como pasos distintos y explícitos.
- Los saldos, premios y canjes se resuelven mediante transacciones PostgreSQL en servidor.
- La identidad de una superficie no autoriza automáticamente a otra.

## Estado

Propuesta pendiente de validación del fundador.

