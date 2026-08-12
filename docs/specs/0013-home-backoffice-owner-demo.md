---
spec: 0013
fecha: 2026-08-10
estado: cerrada
resumen: Home mock responsive del Backoffice owner con campaña activa visible y navegación a locales, equipo, marca, configuración, campañas y analíticas.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0013 — Home demo del Backoffice owner

> **Nada de código empieza sin esta spec en `cerrada`.**

## Problema

Después del onboarding, el owner necesita reconocer su negocio, entender qué campaña
está activa y llegar sin fricción a los módulos con que lo gestionará. Aún no existe un
Backoffice real ni datos persistidos, pero la estructura y prioridades de la interfaz
deben validarse antes de implementar cada módulo.

## Alcance

**Entra:**

- Home responsive del Backoffice para el negocio fixture creado durante la Spec 0012.
- Navegación visible y funcional entre los accesos demo de **Campañas**, **Locales**,
  **Staff**, **Marca**, **Configuración** y **Analíticas**.
- Resumen de negocio: logo/nombre fixture, plan y cantidad de sucursales.
- Una tarjeta prioritaria de campaña activa con nombre, estado, locales y beneficio
  fixture relevantes.
- Rutas placeholder de cada módulo, con título y regreso al home, para comprobar la
  navegación completa.
- Estados vacíos/ausencia de datos fixture cuando se accede sin completar onboarding.

**No entra:**

- CRUD de locales, personal, branding, campañas o métricas.
- Autorización real, cuentas reales, roles de staff, API, base de datos ni persistencia
  fuera de `sessionStorage` demo.
- Crear/publicar campañas reales, Incentive Engine, cálculos analíticos o diseño de los
  módulos internos.

## Diseño

El home se abre en `/backoffice/demo` desde la finalización de onboarding. En móvil se
presenta primero la campaña activa y después accesos grandes a cada área; en escritorio
la misma jerarquía puede mostrarse con navegación lateral. Campañas es el acceso visual
primario porque representa el valor comercial inmediato; Locales y Staff representan
operación; Marca, Configuración y Analíticas quedan como accesos secundarios.
Configuración prepara la futura activación de módulos opcionales, como el programa de
fidelidad, sin afirmar que estén habilitados en el demo.

```text
/backoffice/demo
  → campaña activa fixture
  → /backoffice/demo/campaigns
  → /backoffice/demo/locations
  → /backoffice/demo/staff
  → /backoffice/demo/brand
  → /backoffice/demo/settings
  → /backoffice/demo/analytics
```

Las rutas leen el estado demo de Spec 0012. Si no existe, muestran un estado que orienta
a completar onboarding; nunca inventan un owner autenticado.

### Especificación técnica

- Los datos fixture reutilizan `merchant-demo` de la Spec 0012; no se duplica un modelo
  de negocio ni se añade endpoint.
- La campaña activa fixture contiene: nombre `Check-in de bienvenida`, estado `Activa`,
  locales aplicables (todas las sucursales), y efectos `10 puntos`, `1 sello`, `cupón
  2x1`.
- Cada enlace usa rutas reales de Next y es usable con teclado. El módulo actual tiene
  título identificable y enlace para volver al home.
- Un placeholder no simula capacidades que no existen: explica que el módulo se diseñará
  en el siguiente paso, sin botones falsos de guardar/editar.
- No hay datos sensibles, pagos ni coordenadas en el home o sus fixtures.

### Arquitectura de referencia

- ADR 0007 — permisos/auditoría reales llegan con la Spec 0001.
- ADR 0010 — Backoffice merchant aislado.
- ADR 0016 — superficie merchant clara y rápida.
- ADR 0017 — estados explícitos y pruebas.
- Specs 0001–0003 — implementarán los módulos reales posteriormente.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/demo/**` | crear/editar |
| `apps/merchant/src/app/demo.ts` y pruebas unitarias | editar/crear |
| `tests/e2e/**` | editar con navegación owner demo |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | editar al entregar |

### Disjunta?

No. Comparte `apps/merchant` y el estado demo con Spec 0012; se implementa después de
ese onboarding y antes de diseñar los módulos individuales.

## Definition of Done

- [ ] El owner puede navegar desde el home a Campañas, Locales, Staff, Marca,
  Configuración y Analíticas, y volver al home.
- [ ] Ve datos relevantes de su negocio, incluyendo una campaña activa visible y
  comprensible.
- [ ] El home es responsive y prioriza campaña activa/operación en móvil.
- [ ] Sin estado de onboarding, las rutas muestran orientación y no datos inventados.
- [ ] No hay backend, auth real, CRUD ni datos de producto reales.
- [ ] Format, lint, typecheck, unit, E2E y build pasan; revisor independiente emite PASS.

## Plan de pruebas y verificación

- [ ] Unidad: fixture de campaña activa y lectura de estado demo.
- [ ] E2E: completar/sembrar onboarding demo, abrir home, navegar a cinco módulos y
  volver.
- [ ] E2E: abrir home sin estado demo y comprobar estado de orientación.
- [ ] Manual: revisar viewport móvil y escritorio, foco y etiquetas de los accesos.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.

## Handoff requerido

Implementador y revisor usan `docs/AGENT-WORKFLOW.md`.

## Abierto

No hay bloqueos. Los datos del home son fixtures UI y no deciden contratos de backend.
