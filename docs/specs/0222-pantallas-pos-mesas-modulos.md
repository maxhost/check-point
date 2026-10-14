---
spec: 0222
fecha: 2026-10-13
estado: cerrada
resumen: Pantallas de POS y Mesas como módulos; parte 2b de 0220, según el encargo de Claude.
disjunta: no
archivos: apps/merchant/src/app/backoffice/{pos,settings,locations,staff,subscription}/**, apps/merchant/src/app/backoffice/backoffice-navigation.tsx, apps/merchant/src/app/backoffice/panel-request.ts, apps/merchant/src/modules/{pos,tables}/ui/**, apps/merchant/src/modules/{stock,recipes}/ui/**, apps/merchant/src/modules/ui-registry.ts, apps/merchant/src/modules/modules-boundary*.test.ts (solo vaciar pendientes), tests/e2e/**
---

# 0222 — Pantallas de POS y Mesas como módulos

## Problema

- `pos-cache.ts:88,102` y `pos-types.ts:120` llaman rutas `/api/pos` borradas por 0220.
- `locations/location-tables.tsx:19` y `settings/ticket-settings.tsx:37,63` llaman rutas borradas.
- El inventario exacto de `modules-boundary*.test.ts` mantiene acoplamientos del core a POS/Mesas.

## Alcance

**Entra:** exclusivamente [el encargo completo](../encargo-gpt-2026-10-14-pos-mesas-modulos.md), secciones A–D, parte 2b de 0220. Traslado de pantallas y helper HTTP, enganches genéricos, URLs y e2e.

**No entra:** servidor/API, manifiestos, kit/guardias, paquetes/base/migraciones, PWA/inicio ya hechos por Claude, push/merge/deploy, eliminación de las tres filas transitorias del servidor.

## Diseño

El contrato HTTP y todos sus errores son los de [0220](0220-pos-y-mesas-como-modulos.md), tabla de rutas y sección de errores; los puntos de enganche son [ADR 0141](../adr/0141-puntos-de-enganche-del-pos-y-mesas.md). Sin cambios de payload ni comportamiento del cobro, cupón, impresión o concurrencia.

La consola conserva su lectura de locales activos del lado servidor, dentro de `modules/pos/ui/`. El despachador aplica sesión, módulo y permiso. El core importa solo registros/contrato público de módulos. El helper HTTP compartido vive en el core sin tipos de POS; el módulo conserva su error tipado de orden. Mesas ofrece un panel con las props registradas `{location:{id,name}}`; el core controla su apertura. Ticket solo se monta para owner y módulo encendido.

Menú y barra usan navegación declarada, sesión `enabledModules` y `MODULES.operation`; acción `checkpass:module-primary` con `{moduleId}`. Locales usa `locationAction`, permisos y `UI_SCREENS.locationPanel`. Toggle confirmado emite `checkpass:modules-changed`; navegación/Locales releen sesión y protegen contra GET anterior. Ajustes dibuja switches y paneles registrados; dependencias y 409 conservan error del servidor, cantidad de órdenes y diálogo equivalente. Equipo usa permisos del DTO, sin casos especiales. POS con Mesas apagado muestra nombre libre y no selector; conserva validaciones cuando Mesas está encendido.

Se conserva el diseño actual, estados de carga/error/reintento y bloqueo de doble envío. No se agrega excepción a frontera ni se afloja aserción: solo se vacían filas de pendientes después de mover/corregir el código.

## Archivos

| Archivo | Acción |
|---|---|
| `app/backoffice/pos/**` → `modules/pos/ui/**` | trasladar; reemplazar página fija por pantalla registrada |
| `settings/ticket-settings*.ts*` → `modules/pos/ui/` | trasladar |
| `locations/location-tables.tsx` → `modules/tables/ui/` | trasladar y adaptar panel |
| `app/backoffice/panel-request.ts` | crear helper HTTP y tipo de sesión público |
| `settings/{page,module-settings,module-request,module-navigation}.ts*`, `backoffice-navigation.tsx`, `subscription/trial-notice.tsx`, `locations/locations-console.tsx`, `staff/{staff-api,staff-console,staff-views,permission-picker}.ts*` | enganches genéricos |
| `settings/pos-settings.tsx` | borrar |
| `modules/{stock,recipes}/ui/**` | apuntar helper compartido al core |
| `modules/ui-registry.ts` | líneas e imports propios de POS/Mesas |
| `modules/modules-boundary*.test.ts` | exclusivamente quitar filas resueltas PENDING_GPT* |
| `tests/e2e/{pos,pos-printing,tables,ticket-settings,module-settings,staff,subscription}*.spec.ts` y fixtures consumidores afectados | URLs/códigos/DTO nuevos y regresiones |

**Disjunta:** no, parte secuencial de 0220 tras PASS de 2a. Un implementador; sin agentes paralelos.

## Definition of Done

- [ ] `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules` verde; pendientes vacíos salvo las tres filas de servidor.
- [ ] `pnpm typecheck`, `pnpm lint`, `node tools/ui-guard.ts --base origin/main` verdes con Node 24.
- [ ] E2e afectados verdes; incluye Mesas apagado sin selector y 409 al apagar con orden en mesa.
- [ ] Pantallas observadas en móvil/escritorio; sin modificación visual fuera del traslado.
- [ ] `git diff --check` y formato de archivos propios verdes.
- [ ] Commits pequeños en dev; sin push/merge; SHAs y límites en `docs/estado/gpt.md`.

Los gates de este encargo sustituyen verify global: no se ejecutan migraciones ni suites de base ajenas al alcance. Revisión adversarial conjunta posterior a cargo de Claude, como dispone el encargo.

## Mutaciones — presupuesto: 1. Clase: plausible

| # | Mutación | Oráculo que debe ponerse rojo |
|---|---|---|
| 1 | Volver a mostrar selector con Mesas apagado | E2e nuevo de POS sin Mesas |

Copia/hash antes, bitácora antes de ejecutar, salida del rojo real y restauración comprobada.

## Declarado AFUERA

Eliminación de posEnabled en servidor, revisión adversarial independiente de 0220, migración/deploy en producción y QA final del owner.

## Handoff

Se mantiene cerrada hasta PASS independiente. Evidencia y SHAs en estado GPT; no se marca implementada por autoevaluación.

## Abierto

Ninguna decisión de producto pendiente dentro del encargo.
