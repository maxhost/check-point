---
adr: 0124
fecha: 2026-10-05
estado: aceptada
resumen: Las rutas publicas de Google Places (`/api/places/*`) se limitan por IP con una regla de Vercel Firewall (proyecto merchant, «Places por IP», 60 requests / 10 min, 429), no con codigo. Junto con la cuota diaria de Google Cloud acota el costo. La regla vive en Vercel, no en el repo. Cierra PARQUEADO #70.
---

# 0124 — Limite por IP de Places en Vercel Firewall

## Contexto

Las rutas `POST /api/places/autocomplete` y `/details` (spec 0155, ADR 0121) son publicas: el paso 1 del alta no tiene
sesion. Sin limite, un script puede agotar la cuota diaria de Google Cloud y cortar las altas del dia (PARQUEADO #70).
Limitar por dominio (`Origin`/`Referer`) no sirve contra un script, y restringir la clave de Google por IP del servidor
no se puede en Vercel sin IP de salida fija. Vercel WAF Rate Limiting esta disponible en Hobby (1 regla por proyecto,
ventana de 10 s a 10 min, claves IP/JA4, 1.000.000 de requests incluidos; documentacion de Vercel leida el 2026-10-04).

## Decision

Propuesta de la sesion, aprobada y publicada por el owner (2026-10-04): regla «Places por IP» en el proyecto merchant —
`Request Path` empieza con `/api/places/`, Fixed Window 600 s, 60 requests, clave IP, accion 429.

## Verificacion (2026-10-05)

63 requests seguidos a `https://business.checkpass.club/api/places/autocomplete` con `input: "ab"` (la ruta responde
400 sin llamar a Google): **60 × 400, 3 × 429**.

## Consecuencias

- La regla **no esta en el repo**: se ve en Vercel → merchant → Firewall. Esta anotado en la skill `gotchas-del-repo`.
- Es la unica regla de rate limit que permite Hobby por proyecto: otra ruta que necesite limite comparte esta o pide Pro.
- No frena un ataque distribuido; ese caso lo acota la cuota diaria de Google Cloud (owner).
