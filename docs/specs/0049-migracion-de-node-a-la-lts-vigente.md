---
spec: 0049
fecha: 2026-09-02
estado: borrador
resumen: Plan por fases para poner el proyecto en la última Active LTS de Node (24.20.0) y dejar la migración a 26 barata y agendada. Implementa el ADR 0046. Node 26 NO entra: Vercel no lo ofrece como runtime, así que migrar ahora dejaría el CI probando un runtime que nadie despliega. Cada fase es un commit independiente con su verificación y su rollback.
disjunta: si
archivos: .node-version, package.json (engines + script del guard), apps/*/package.json (@types/node), pnpm-lock.yaml, .github/workflows/ci.yml, scripts/ (guard anti-drift)
---

# 0049 — Migración de Node a la LTS vigente

> Implementa el **ADR 0046**. Ese ADR contiene la decisión y el porqué; esta spec es
> el cómo. Si lo que buscás es "por qué no vamos a Node 26", está en el ADR, no acá.

## Contexto en una línea

Se pidió subir Node "a la última estable". La última estable de Node es **26.8.1**, pero
**Vercel sólo ofrece 24.x / 22.x / 20.x** como runtime, y este proyecto corre `24.x` en
producción (verificado con `vercel project ls`). El objetivo alcanzable y útil hoy es otro:
ponerse en la **última Active LTS (24.20.0)**, eliminar el drift entre los 4 lugares donde
la versión está escrita, y dejar el salto a 26 como un cambio de una línea cuando Vercel lo
habilite (después del 2026-10-28).

Estado inicial, verificado:

| Lugar | Valor hoy | Objetivo |
|---|---|---|
| `.node-version` | `24.19.0` | `24.20.0` |
| `package.json` → `engines.node` | `>=24.15.0 <25` | `>=24.20.0 <25` |
| `@types/node` (×3 apps) | `24.10.1` | `24.13.3` (última de la línea 24) |
| Vercel Project Settings | `24.x` | `24.x` (**sin cambio**) |

## Alcance

**Entra:**
- Subir el pin de desarrollo/CI a la última LTS de la línea 24.
- Alinear `@types/node` a la última de la línea 24.
- Un guard automatizado que falle si los pines se desincronizan.
- Sacar el warning de deprecación de Node 20 de las GitHub Actions (deuda arrastrada
  desde las specs 0047 y 0048, donde quedó explícitamente fuera de alcance).
- Dejar escrito y agendado el disparador de la migración a Node 26.

**No entra:**
- **Migrar a Node 26.** Lo prohíbe el ADR 0046 hasta que Vercel lo ofrezca. Es Fase 5,
  agendada, y **no se ejecuta en esta spec**.
- Cambiar la versión en el dashboard de Vercel: producción ya está en `24.x`, que es el
  destino correcto. No se toca.
- Subir otras dependencias (Next, better-auth, drizzle, sharp). Un bump de Node ya es
  suficiente variable; mezclarlo con upgrades de librerías hace indiagnosticable cualquier
  rojo.

## Fases

Cada fase es **un commit propio**, con su verificación y su rollback. La razón es
diagnóstica, no ceremonial: si el CI se pone rojo, tiene que quedar claro cuál de los
cambios lo hizo. Se avanza a la siguiente sólo con la corrida de CI de la anterior en
`success`.

### Fase 1 — Pin de Node a 24.20.0

**Cambio:** `.node-version` → `24.20.0`; `engines.node` → `>=24.20.0 <25`.

**Prerrequisito local:** `nvm install 24.20.0` (hoy la máquina sólo tiene 24.15.0 y
24.19.0 — verificado con `nvm ls`). Necesita red.

**Qué NO cambia:** producción. Vercel sirve "la última 24.x" y aplica minors/patches por
su cuenta; el `engines` seguirá resolviendo a la misma línea. Lo que se corrige es que
**local y CI dejen de probar contra una versión más vieja que la desplegada**.

**Riesgo:** bajo. Es un patch dentro de la misma LTS.

**Verificación:** los 5 gates locales en 24.20.0 + corrida de CI en `success` (el CI toma
la versión de `.node-version` vía `node-version-file`).

**Rollback:** `git revert` del commit. Vuelve a 24.19.0, que hoy está verde.

### Fase 2 — `@types/node` a 24.13.3

**Cambio:** `24.10.1` → `24.13.3` en las 3 apps + `pnpm-lock.yaml`.

**Riesgo: es la fase más riesgosa de la spec, y no es obvio.** Subir tipos puede romper
`typecheck` sin que cambie una línea de código de la app: definiciones más nuevas o más
estrictas destapan errores que antes no se veían. Si eso pasa, **no se baja el tipo ni se
silencia con `any`**: se arregla el código o se documenta el hallazgo y la fase vuelve a
`borrador`.

**Gotcha operativo (`CLAUDE.md`):** este es el único cambio de la spec que toca el
lockfile, así que exige `pnpm install` con red. Después hay que correr **`pnpm fetch` en
una terminal con red** para re-calentar `.pnpm-store`, o la próxima sesión bajo codex/Auto
falla el install offline con "paquete no encontrado". Ojo: `pnpm fetch` **purga
`node_modules` sin preguntar** salvo `CI=true`.

**Verificación:** `pnpm run typecheck` (3/3) y el resto de los gates + CI en `success`.

**Rollback:** `git revert` del commit, incluido el lockfile.

### Fase 3 — Guard anti-drift

**Problema que resuelve:** hoy la versión está escrita en 4 lugares y **nada verifica que
coincidan**. Ese es el costo real que hace cara la migración a 26; sin el guard, la Fase 5
vuelve a ser una cacería manual de pines sueltos.

**Cambio:** una verificación que falle si divergen `.node-version`, `engines.node` y el
major de `@types/node`. Se le suma el pin de pnpm, que hoy también está duplicado
(`packageManager: pnpm@11.4.0` en `package.json` y `version: 11.4.0` hardcodeado en
`ci.yml`).

**Riesgo:** ninguno sobre el runtime. El riesgo es de diseño: un guard mal escrito que
pase siempre. Se prueba **rompiéndolo a propósito** (desincronizar un pin y ver que falla)
antes de darlo por bueno — sin esa prueba negativa es decorativo.

**Verificación:** la prueba negativa de arriba, más los gates.

**Rollback:** `git revert`. No afecta runtime.

### Fase 4 — GitHub Actions al día

**Cambio:** `actions/checkout@v4` → `@v7`, `actions/setup-node@v4` → `@v7`,
`pnpm/action-setup@v4` → `@v6` (últimas verificadas por `gh api .../releases/latest` el
2026-09-02).

**Qué arregla:** el warning que aparece en cada corrida — *"Node.js 20 is deprecated. The
following actions target Node.js 20 but are being forced to run on Node.js 24"*. Es el
runtime **de las actions**, no el del proyecto: son cosas distintas que se parecen, y por
eso esta fase va separada y al final.

**Riesgo: es un salto de 3 majors en dependencias de terceros, el cambio con más
superficie de la spec.** Puede cambiar defaults (p.ej. `pnpm/action-setup` v6 puede tomar
la versión de pnpm desde `packageManager` en vez del input `version`). Por eso va sola, en
su propio commit, después de que todo lo demás esté verde.

**Verificación:** corrida de CI en `success` **y** el warning de Node 20 ausente de las
anotaciones (`gh run view <id>` no debe listarlo). Que el CI pase no alcanza: el objetivo
declarado de la fase es que el warning desaparezca.

**Rollback:** `git revert`. Es el commit más probable de necesitarlo.

### Fase 5 — Node 26 (AGENDADA, no se ejecuta en esta spec)

**Disparador — las dos condiciones, no una:**
1. Node 26 entró en LTS. Fecha del calendario oficial: **2026-10-28**.
2. **Vercel ofrece `26.x`** en Project Settings. Verificable sin entrar al dashboard:
   `vercel project ls` muestra la columna Node Version, y la doc oficial lista las
   disponibles. **Esta es la condición que manda**: la (1) sin la (2) no habilita nada.

**Trabajo cuando se dispare:** cambiar `.node-version` a la 26 LTS, `engines` a
`>=26.x <27`, `@types/node` a la línea 26, y la versión en el dashboard de Vercel. El
guard de la Fase 3 garantiza que no quede ningún pin suelto — ese es todo el punto de
haberlo construido.

**Verificación adicional que esta spec no puede anticipar:** un **preview deploy** en 26
antes de promover a producción, y revisar en particular `sharp` (binarios nativos por
versión de Node).

## Archivos

| Archivo | Fase | Acción |
|---|---|---|
| `.node-version` | 1 | editar — `24.20.0` |
| `package.json` (root) | 1, 3 | editar — `engines.node`; script del guard |
| `apps/*/package.json` (×3) | 2 | editar — `@types/node` |
| `pnpm-lock.yaml` | 2 | regenerado por `pnpm install` |
| `scripts/` (archivo nuevo) | 3 | crear — el guard |
| `.github/workflows/ci.yml` | 3, 4 | editar — step del guard; versiones de las actions |

### Disjunta?

**Sí.** No hay otra spec abierta. Toca configuración de tooling, ninguna ruta ni entidad.

## Criterios de aceptación (verificables)

- [ ] `node -v` en CI reporta `v24.20.0` (verificable agregando `node -v` o leyendo el log
  de `setup-node`).
- [ ] Los 5 gates verdes en cada fase, con el **mismo conteo de tests** (254) o mayor.
- [ ] Una corrida de CI en `success` **por fase**, no sólo al final.
- [ ] El guard existe, corre en CI, y **se probó rompiéndolo**: desincronizar un pin lo
  pone rojo. Sin esa evidencia negativa el criterio no se da por cumplido.
- [ ] El warning de deprecación de Node 20 **no aparece** en las anotaciones de la corrida
  posterior a la Fase 4.
- [ ] Producción sigue sirviendo con normalidad después del deploy (`/api/health` de las
  3 apps en 200) y Vercel sigue reportando `24.x`.
- [ ] El disparador de la Fase 5 está escrito en `docs/TASKS.md` con **fecha absoluta**, no
  como "más adelante".
- [ ] `pnpm fetch` corrido con red después de la Fase 2 (re-warm del store offline).

## Pruebas

- **Automatizada:** los 5 gates + la corrida de GitHub Actions por fase. La señal que vale
  es el commit status, no el reporte del agente.
- **Manual (mínima, sólo tras el deploy):** `curl` a `/api/health` de las 3 apps en
  producción. No hay cambio funcional que probar en pantalla; si algo se ve distinto, el
  bump de Node no fue sólo un bump de Node.

## Decisiones abiertas (a cerrar antes de pasar a `cerrada`)

1. **Forma del guard de la Fase 3.** Dos caminos razonables:
   - **(a) Script + step de CI** (`scripts/check-node-pins.mjs` + `pnpm run verify:node-pins`).
     Simple, sin plumbing, alineado con la doctrina de `CLAUDE.md` ("si una regla se puede
     chequear con un comando, es un hook/comando"). Contra: no corre con `pnpm test`, así
     que localmente sólo se ve si alguien lo invoca.
   - **(b) Un 4º project de vitest** (`vitest.config.ts` de root ya usa `projects` con las
     3 apps; sumar uno de tooling es una línea). Ventaja concreta: corre con `pnpm test`, o
     sea también en el **Stop hook** de `.claude/settings.json`, que es donde el drift se
     cazaría en el acto. Contra: un poco más de plumbing.
   - **Recomendación: (b)**, porque el drift lo introduce un agente editando un pin, y (b)
     es el único de los dos que lo detecta en ese mismo turno.
2. **¿Se ejecutan las 4 fases en una sesión o se corta después de la 3?** La Fase 4
   (actions) es la de mayor superficie y la de menor beneficio (saca un warning). Es
   defendible dejarla para después. Decisión del owner.
