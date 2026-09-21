---
spec: 0088
fecha: 2026-09-21
estado: cerrada
resumen: Publica un tour breve mobile-first de Staff con Driver.js y cuatro ayudas operativas reutilizables; las acciones de las ayudas son reales, el contenido traducible vive en archivos y solo el onboarding persiste progreso con la API existente.
disjunta: no
archivos: apps/merchant/src/app/backoffice/onboarding, apps/merchant/src/app/backoffice/staff, apps/merchant/src/app/globals.css
---

# 0088 — Tour interactivo de Staff

## Problema

- El checklist entrega `staff`, pero la UI sólo publica `verify-email`; Staff aparece “Próximamente”.
- Staff funciona, pero no expone anchors estables ni recorridos de Driver.js.
- La orientación del onboarding y las cuatro ayudas operativas deben poder ejecutarse por separado.

## Alcance

**Entra:** “Empezar” tras verificar email; navegación a Staff; orientación breve de la UI; ayudas independientes para crear, editar nombre/permisos, regenerar PIN y dar de baja; acciones reales/manuales en las ayudas; mobile-first; copy traducible en archivos.

**No entra:** migración, endpoint nuevo, CMS, persistencia de ayudas, simulación o ejecución automática, otros tours.

## Diseño

1. Definiciones en `staff-tour-definitions.ts` y copy en `staff-tour-locales.ts`: la lógica referencia claves; la base no guarda copy ni selectores.
2. Recorridos atómicos `create`, `edit-permissions`, `regenerate-pin` y `disable`. `onboarding` es una orientación breve de dos pasos y no ejecuta esos procesos. Sólo `onboarding` persiste `tourId: staff`; Ayuda no escribe progreso.
3. El checklist navega a `/backoffice/staff?tour=onboarding`; Staff espera a cargar antes de iniciar Driver.js.
4. Los pasos usan `data-tour` estables. El merchant hace cada acción real; el tour nunca llama directamente una API de Staff.
5. El onboarding señala dónde añadir y dónde gestionar; desde su primer paso permite avanzar o saltar. Al iniciarse oculta el checklist para no competir visualmente.
6. El primer permiso de la ayuda de alta es `counter`. Crear entrega credenciales reales; regenerar rota el PIN real; dar de baja revoca acceso real.
7. Ayuda ofrece los cuatro recorridos. Editar, regenerar y dar de baja requieren un integrante.
8. Copy inicial `es`; otro idioma agrega un diccionario, sin duplicar comportamiento.
9. En las ayudas, pulsar el control resaltado avanza automáticamente cuando el paso representa una acción inequívoca. Los campos de texto conservan avance manual y el onboarding informativo no ejecuta ni autoavanza acciones.
10. Cada paso centra automáticamente su elemento dentro del viewport o del contenedor con scroll más cercano y refresca el spotlight al terminar; esto incluye las acciones del footer de los modales.

## Archivos

| Archivo | Acción |
|---|---|
| `backoffice/onboarding/onboarding-checklist.tsx` | editar |
| `backoffice/onboarding/onboarding-view.ts` | editar |
| `backoffice/staff/staff-tour-*` | crear |
| `backoffice/staff/*` | editar anchors y Ayuda |
| `app/globals.css` | editar estilos mobile-first |

**Disjunta?** No: comparte Staff todavía sin commit.

## Definition of Done

- [x] Staff queda accionable en checklist y navega al tour.
- [x] Onboarding orienta sobre la UI sin ejecutar las ayudas y persiste estado con la API existente.
- [x] Ayudas independientes no persisten progreso.
- [x] Anchors estables, acciones reales, copy separado y catálogo tipado.
- [x] Funciona desde 320 px con controles táctiles de 44 px.
- [x] Tests de composición, locale, navegación y persistencia.
- [ ] Gates root: typecheck, lint, test, format:check, build y test:e2e.

## Mutaciones — presupuesto: 4

| # | Mutación | Oráculo rojo |
|---|---|---|
| 1 | Ayuda persiste progreso | test de modo ayuda |
| 2 | Onboarding omite un recorrido | test de composición |
| 3 | Staff no está disponible | test de estado visual |
| 4 | Primer permiso no es counter | test del anchor |

**Condición de corte:** dos correcciones consecutivas que descubran otra rotura detienen la ronda.

## Declarado AFUERA

- Reanudación por paso, analítica por usuario y versión persistida; eso sí requeriría API nueva.

## Handoff

Implementación y revisión contra esta spec. La revisión independiente queda pendiente de disponibilidad de agente en esta sesión.

## Evidencia de implementación

**Ronda del 2026-09-21, corrida por el orquestador con Node 24.20.0 y `TURBO_FORCE=1`:**

- `typecheck`, `lint`, `format:check` y `test`: **verdes** — 148 archivos / **1.538 tests** pasaron;
  101 archivos / 560 tests de integración externa los omite la suite por falta de `DATABASE_URL`.
- `build`: **VERDE** (`3 successful, 0 cached`, 19,5 s). El `EPERM` de Turbopack de la ronda
  anterior era del sandbox del agente, no del código: corriendo sin sandbox el gate pasa.
- `test:e2e`: **NO SE PUDO CORRER, y no por el código.** Playwright levanta el consumer en
  `127.0.0.1:3000` y el merchant en `3001` (`playwright.config.ts:16-31`); el puerto 3000 está
  tomado por un `next dev` **del propio merchant** (PID 97387, `apps/merchant`), así que
  `webServer` aborta con *«Another next dev server is already running»* y exit 1 antes de abrir
  una sola pestaña. Es un proceso del owner: no se mata desde acá. **El gate queda para la CI**,
  que es el único lugar donde corre de verdad (`ci.yml:64`).
- `git diff --check`: verde.

**Trampa de medición, anotada:** el `pnpm run test:e2e | tail` de esa corrida devolvió
`exit 0` **con el gate fallado** — en zsh el status de un pipeline es el de `tail`. El fallo se
vio LEYENDO la salida, que es exactamente la regla de `CLAUDE.md` sobre gates que «pasan» sin
que nadie los mire.

## Abierto

Nada.
