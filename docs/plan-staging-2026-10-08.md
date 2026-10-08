# Plan — ambiente de staging en proyectos separados (2026-10-08)

Estado: **plan guardado, sin ejecutar** (owner: «guarda eso como plan, por ahora»). Al retomarlo: ADR propio que
reemplaza en parte el ADR 0128, y recien despues se toca algo.

## Por que

- Un alta real («Café Plátano») fallo en PROD: `merchant_auth.auth_start_attempt` tiene un intento del 2026-10-07
  14:58 UTC sin usuario ni negocio (medido por SQL el 2026-10-08; PROD tiene 0 negocios). La causa no se pudo ver:
  Vercel Hobby guarda logs 1 hora. **Sigue abierto**: el alta en PROD no se volvio a probar.
- El ambiente local corre `dev` con claves de desarrollo: prueba el codigo, no la configuracion de PROD.
- Hallazgo medido: en el proyecto Vercel `check-point-merchant`, `DATABASE_URL` y `DATABASE_URL_UNPOOLED` apuntan a
  **production y preview**. Un despliegue de preview escribiria en la base de PROD.

## Decisiones del owner (2026-10-08)

- Staging en **proyectos de Vercel separados**, no el ambiente Preview del mismo proyecto. Palabras del owner: «si
  cometes un error que ultima mente viene sendo la norma, acabaremos por desplegar cosas que no deberian ser
  desplegadas en produccion en lugar de preview».
- Base **Neon separada** con exactamente la misma forma que PROD. Se desarrolla contra Vercel + Neon de staging y
  despues se despacha al proyecto en vivo.

## Propuesta de Claude (a confirmar en el ADR)

1. **Vercel:** tres proyectos nuevos (merchant, customer, public de staging), mismo repo, rama de produccion =
   `dev`. Los de PROD siguen desplegando solo `main`. Subdominios propios (p. ej. `staging-business.` y
   `staging-my.checkpass.club`).
2. **Neon:** proyecto NUEVO, no una rama del de PROD (una rama hereda roles y contraseñas de su madre: con las
   credenciales de staging se entraria a PROD). Mismas migraciones; igualdad de forma verificada con
   `compare_database_schema` / diff de `information_schema`.
3. **Variables:** las mismas que PROD salvo base, direcciones, secreto de sesion y bucket R2 (el de desarrollo, ya
   con CORS). Claves de Stripe y correo: decidir modo test vs real. Lista clave por clave a preparar (solo nombres).
4. **Flujo:** `dev` → push → staging; QA del owner en staging; con OK, `merge --ff-only` a `main` → PROD. Cada
   migracion se aplica primero en staging. Ajustar `tools` de push y `docs/TRABAJO-EN-PARALELO.md`.
5. **Smoke despues de cada despliegue a PROD:** un alta de prueba en `business.checkpass.club` mientras Claude lee
   los logs (ventana de 1 hora en Hobby), y se borra.

**Reparto:** Claude: proyecto Neon + forma + comparacion, lista de variables, ADR, tooling, verificacion con un alta
en staging. Owner: crear los proyectos Vercel y cargar secretos, DNS en Cloudflare, CORS de R2 y restricciones de
Google para las direcciones nuevas.
