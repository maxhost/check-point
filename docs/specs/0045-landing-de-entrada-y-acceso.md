---
spec: 0045
fecha: 2026-08-30
estado: implementada
resumen: La raíz `/` (checkpass.club) deja de redirigir al form de registro y pasa a ser una landing mínima con estructura + botones "Acceder" (→ login) y "Crear negocio" (→ registro). Login y registro ya existen y se enlazan. Sin diseño visual, solo estructura navegable.
disjunta: si
archivos: app/page.tsx (landing), globals.css (estilos mínimos opcionales)
---

# 0045 — Landing de entrada y acceso

> **Nada de codigo empieza sin esta spec en `cerrada`.**

## Problema

Al entrar a `checkpass.club` (raíz `/`) un visitante sin sesión es **redirigido directo al
formulario de registro de negocio** (`/onboarding`). No hay una página de entrada: el primer
contacto con el producto es un wizard de alta. Se necesita una **landing** desde la cual el
usuario elija **Acceder** (login) o **Crear negocio** (registro), dejando la estructura lista
para vestirla después.

## Alcance

**Entra:**
- La raíz `/` (sin sesión) muestra una **landing mínima**: estructura + un botón **"Acceder"**
  (→ `/login`) y un botón **"Crear negocio"** (→ `/onboarding`). Ya no redirige al registro.
- Con sesión activa, `/` sigue redirigiendo a `/backoffice` (sin cambio de comportamiento para
  el owner logueado).
- El link de registro dentro de `/login` (ya existente) se conserva.

**No entra (explícito):**
- Diseño visual / copy / branding / imágenes de la landing (se hace después; ahora solo
  estructura navegable).
- Cambios en los formularios de `/login` o `/onboarding` (existen y funcionan).
- Landing del **consumidor** (las rutas `(consumer)/*` no se tocan).
- SEO/metadata/analítica de marketing.

## Diseño

`app/page.tsx` (hoy un server component que sólo redirige) pasa a:
1. Resolver la sesión (`getMerchantAuth().api.getSession`).
2. Si hay sesión → `redirect("/backoffice")` (igual que hoy).
3. Si no → renderizar la landing: un `<main>` con un bloque hero placeholder (título +
   una línea) y dos enlaces de acción a `/login` y `/onboarding`, reusando las clases de UI
   existentes (`merchant-shell`/`panel`/`button`) para que se vea consistente sin diseño nuevo.

Sin estado ni cliente: es markup estático con `<Link>`. No hay rutas ni endpoints nuevos
(login y onboarding ya existen). Estilos mínimos en `globals.css` sólo si hiciera falta para
que los botones se vean; nada más.

### Arquitectura de referencia

Consume el auth de merchant existente (spec 0022, better-auth). No introduce decisiones de
arquitectura → sin ADR.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/page.tsx` | editar — de redirect a landing (con el redirect de sesión conservado) |
| `apps/merchant/src/app/globals.css` | editar (opcional) — estilos mínimos de la landing si hacen falta |

### Disjunta?

**Sí.** Ninguna otra spec abierta toca `app/page.tsx`. La 0043 (recién implementada) tocó
`backoffice/*` y `/login` no cambia acá.

## Definition of Done

- [ ] `/` sin sesión muestra la landing con "Acceder" (→ `/login`) y "Crear negocio"
  (→ `/onboarding`); **no** redirige automáticamente al registro.
- [ ] `/` con sesión sigue redirigiendo a `/backoffice`.
- [ ] Desde la landing se llega a login y a registro; desde login se llega a registro
  (link existente).
- [ ] Gates verdes: typecheck, lint, unit, build.

## Plan de pruebas y verificación

- [ ] Manual/local: `/` deslogueado → landing con dos botones que navegan bien; `/` logueado
  → `/backoffice`.
- [ ] Comandos: Node 24; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Abierto

- Diseño real de la landing (fuera de alcance; esta spec deja la estructura).
