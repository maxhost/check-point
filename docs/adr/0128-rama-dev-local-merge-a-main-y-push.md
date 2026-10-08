---
adr: 0128
fecha: 2026-10-08
estado: aceptada
resumen: Se trabaja en una sola rama local `dev` (sin pushear); cuando el owner ve que esta bien, se mergea a `main`, se prueba `main` en local con `pnpm dev:local`, y recien entonces se pushea `main` a live. Reemplaza el «sobre `main`, push en el dia» del ADR 0114 §2-3.
---

# 0128 — Rama `dev` local, merge a `main` y push a live

## Contexto

Hasta hoy los dos agentes commiteaban directo en `main` (ADR 0114) y el push publica en live (Vercel despliega
`main`). Desde el 2026-10-07 PROD tiene datos reales y existe un ambiente local completo (ADR 0126, ADR 0127,
`pnpm dev:local`). El owner, 2026-10-08: «si algo sale mal no tengo que mergear a main y contaminar main,
simplemente descartar», y despues: «creemos una sola rama nueva para trabajar en local […] cuando trabaje, vea que
esta todo bien hacemos alli el merge a main, vemos que funciona en main en local y hacemos recien el push a live».

## Decision

1. **Una sola rama de trabajo: `dev`**, creada desde `main` el 2026-10-08. Todo commit de trabajo va ahi, de
   Claude y de GPT (comparten la carpeta del repo, asi que comparten la rama). `dev` **no se pushea**: un push de
   rama crea un deploy de preview en Vercel y consume el cupo del plan Hobby.
2. **El ambiente local corre lo que este en la carpeta**: `pnpm dev:local` levanta la rama activa (imprime cual).
   La base local en Docker es una sola para las dos ramas.
3. **Pasaje a live, en este orden y solo con OK del owner:**
   1. En `dev`: `pnpm verify` verde y el owner prueba en local.
   2. `git switch main && git merge --ff-only dev` (si `main` no avanzo, es un avance rapido sin commit de merge).
   3. En `main`: `pnpm dev:local` y el owner confirma que anda.
   4. `git push` desde `main` (el hook `pre-push` corre `check-numbers` y `pnpm verify`).
   5. `git switch dev` para seguir.
4. **Descartar**: lo que no sirve se deshace en `dev` (`git reset --hard <sha>` con OK del owner, o `git revert`);
   `main` no se toca. Si lo descartado aplico migraciones a la base local, `tools/local-db/reset.sh` (`/entorno-local
   reset-base`) la recrea desde las migraciones de la rama activa.

## Consecuencias

- `main` local = lo que esta (o esta por estar) en live. Un `main` local adelantado de `origin/main` significa
  «aprobado, falta el push».
- Las reglas comunes de `docs/TRABAJO-EN-PARALELO.md` §1-3 pasan a este flujo (sin `pull --ff-only` al empezar; el
  numero de spec/ADR se reserva commiteando en `dev`, `check-numbers` lo controla al pushear `main`).
- `pnpm verify` sigue comparando contra `origin/main`: desde `dev` mide todo lo que todavia no esta en live.
- **Riesgo aceptado:** `dev` existe solo en la compu del owner hasta el merge; no hay copia en GitHub.
