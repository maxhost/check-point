---
adr: 0137
fecha: 2026-10-11
estado: aceptada
resumen: El owner entra al panel con un CODIGO de 6 digitos que vence en 10 minutos, enviado por email y tipeado en la misma pantalla donde lo pidio; el login deja de mandar link magico. El alta y la verificacion del email siguen con link. Reabre el plugin `emailOTP` de better-auth que la spec 0068 §4 habia borrado, con sus 9 rutas HTTP en `disabledPaths`.
---

# 0137 — El owner entra con codigo por email

## Contexto

- El panel se instala como PWA y abre en el POS (PARQUEADO #86, `adb723c`). En iPhone, la PWA instalada tiene su
  propio almacen de cookies, separado de Safari. El link magico del login se abre en Safari o en Mail, nunca dentro
  de la PWA: **el owner no puede entrar a la app instalada en iPhone**. El staff si (usuario + PIN, sin email).
- Otros problemas del link, ya conocidos: un escaner de correo que sigue el enlace lo consume y el owner recibe
  «enlace invalido» (declarado en `api/merchant/auth/magic-link/route.ts`); y pedir en la computadora y abrir el
  email en el telefono deja logueado al telefono, no a la computadora.
- La spec 0068 §4 borro el plugin `emailOTP` porque solo servia al reset de contraseña, que ya no existia. Era
  configuracion muerta, no una decision contra los codigos.

## Decision (owner, 2026-10-11)

1. **El login del owner es solo por codigo**: 6 digitos, **vence en 10 minutos**, sirve una vez. Se tipea en la misma
   pantalla donde se pidio. El email del login ya no trae link. Owner: «vamos con codigo expirable en 10 minutos».
   Descartado separar por dispositivo (codigo en la PWA, link en el navegador): dos caminos y un email que cambia
   segun desde donde se pidio.
2. **Solo el login.** El alta del comercio (`onboarding/signup`, email conocido) y la verificacion del email
   (`verify-email`) siguen mandando link magico. Owner: «Solo entrar».
3. Tecnico (Claude): el codigo lo emite y verifica el plugin `emailOTP` de better-auth (1.7.6) **solo por
   `auth.api.*`** desde rutas propias; sus 9 rutas HTTP van a `disabledPaths` (gotcha del repo: un plugin agrega
   superficie HTTP). 5 intentos por codigo y 10 equivocados por dia por email; el codigo se guarda hasheado; pedir uno nuevo anula el anterior. Los
   limites de pedido son los de hoy (`START_RATE_LIMITS`: 20/h por IP, 5/h y 10/dia por email).

## Consecuencias

- Adivinar un codigo: 5 intentos por codigo y, ademas, **10 codigos equivocados por dia por email** (owner
  2026-10-11, al ver que 50 por dia durante un año acumulaban casi 2 %): como mucho 3.650 intentos por año sobre 10⁶
  combinaciones (0,37 %). Cada codigo pedido le llega al owner, asi que un ataque se ve.
- Costo del tope: quien conozca el email del owner puede dejarlo sin entrar al panel 24 h tipeando 10 codigos
  equivocados (el staff sigue entrando). **Aceptado por el owner (2026-10-11), en la etapa de pruebas.**
- El login funciona igual en computadora, Android y iPhone, con o sin la PWA instalada.
- El link magico sigue vivo para el alta y la verificacion: el plugin `magicLink` y `GET /api/merchant/auth/magic-link`
  no se tocan.
- Si un dia el alta o la verificacion pasan tambien a codigo, se hace con el mismo plugin y este ADR se extiende.
