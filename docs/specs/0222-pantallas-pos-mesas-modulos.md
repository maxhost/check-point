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

- [x] `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules` verde; pendientes vacíos salvo las tres filas de servidor.
- [x] `pnpm typecheck`, `pnpm lint`, `node tools/ui-guard.ts --base origin/main` verdes con Node 24.
- [x] E2e afectados verdes; incluye Mesas apagado sin selector y 409 al apagar con orden en mesa.
- [x] Pantallas observadas en móvil/escritorio; sin modificación visual fuera del traslado.
- [x] `git diff --check` y formato de archivos propios verdes.
- [x] Commits pequeños en dev; sin push/merge; SHAs y límites en `docs/estado/gpt.md`.

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

## Bitácora de mutación

M1 preparada en snapshot aislado, no en el árbol compartido. SHA256 limpio `148e33e5ff50d52cfc798d1e9d230ced5d5b72abe19ba509ce4149fe9888f93f`. Se fuerza tablesEnabled=true aunque Mesas esté apagado; oráculo: los dos e2e «0222 POS sin Mesas». Resultado ejecutado: **2 failed** (390/1280), `expect(getByRole("textbox", {name:"Nombre de mesa"})).toBeVisible()` → `element(s) not found`; el mutante ofrece selector en lugar de nombre libre. Restaurado con igualdad byte a byte y SHA256 idéntico. Log `/tmp/checkpass-0222-mutation.log`.

## Evidencia de entrega

Commits locales de `dev`, sin push ni merge:

| SHA | Cambio |
|---|---|
| `549ae06` | Reserva y spec cerrada |
| `369da93` | Helper HTTP del core y consumidores Stock/Recetas |
| `1ff282f` | Traslado y registros POS/Mesas, Ajustes/Locales/Equipo/barra/aviso genéricos |
| `c4ca538` | Marcado anterior de la acción móvil, tipografía conservada |
| `f779b80` | URLs/DTO/errores y regresiones e2e |

El registro UI se consume del lado servidor en las páginas de Ajustes y Locales. Se pasan slots React al cliente, evitando importar la pantalla servidor del POS en bundles cliente. El panel de Mesas controla su propio diálogo y cierre; Locales lo remonta por instancia y cierra al perder el módulo/permiso en la sesión. El helper conserva los errores del contrato y el POS adapta el snapshot tipado de orden.

Solo se quitaron filas resueltas de `PENDING_GPT*`; no se cambiaron patrones, aserciones ni excepciones. Quedan las tres filas transitorias del servidor, sin cambios. Equipo conserva permisos previos de módulos apagados, los muestra deshabilitados y ya no filtra el POS por un booleano.

| Gate ejecutado, Node 24.20.0 | Resultado |
|---|---|
| `pnpm typecheck` (árbol compartido final) | 6 paquetes verdes; 5 caché, merchant ejecutado, 5,485 s |
| Merchant typecheck tras restaurar `next-env.d.ts` generado | Verde |
| `pnpm lint` | Verde |
| `node tools/ui-guard.ts --base origin/main` | 115 archivos, sin aumentos |
| `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules` | 28 archivos aprobados / 25 omitidos; 215 pruebas aprobadas / 122 omitidas, 15,98 s |
| Prettier de archivos propios y `git diff --check` | Verde |
| E2e final de ocho suites afectadas | 165 aprobados, sin fallos/reintentos, 59,0 s |
| M1 en snapshot aislado | Rojo correcto, 2 fallos por selector indebido; restauración SHA/bytes idénticos |

E2e: POS, impresión, Mesas, ticket, Ajustes, módulos/menú, Equipo y billing (aviso compartido). Diez casos nuevos: POS sin Mesas 390/1280; 409 de Mesas; panel solo encendido/evento confirmado; Locales cambia módulo/permiso; acción móvil/moduleId/icono; aviso de operación 7/8 días y subruta/core. Fixtures conservan los payloads, aserciones de cobro/cupones/UUID/impresión, conflictos/versiones, dobles envíos, cierre bloqueado, permisos y errores. Cambio requerido en el caso antiguo de permiso POS apagado: ahora visible/deshabilitado como todos los módulos, según el DTO genérico.

Capturas vistas: POS sin Mesas 390/1280, diálogo 409 móvil, Ajustes/ticket escritorio y barra móvil. La primera barra usaba Button y alteraba tipografía: corregida al marcado Link anterior y confirmada con Plus ya cargado. Los selectores nuevos de aviso informativo y SVG diferido se corrigieron tras rojos de selector; no se aflojaron aserciones existentes.

Hubo cambios paralelos de 0223 que temporalmente rompieron tipos y dos reglas de frontera; se preservaron sin tocar. El snapshot propio (HEAD `a790599` + cambios propios, sin env de producción) pasó tipos de los 6 paquetes, 246 pruebas en 31 archivos y build Merchant con Webpack. Después los tipos y módulos del árbol compartido volvieron a verde, como muestra la tabla. Turbopack falló con EPERM al abrir su puerto interno incluso tras solicitar escalación; la compilación adicional con Webpack pasó. Ninguna suite Neon se habilitó ni se usó DATABASE_URL de producción.

Logs: `/tmp/checkpass-0222-{typecheck-final,types-restored,modules-final,lint-final,guard-final,format-final,e2e-final,mutation,snapshot-typecheck,snapshot-unit,snapshot-build}.log`; e2e `/tmp/checkpass-0222-results`. Config temporal de Playwright conserva los mismos tests/fixtures y usa workers=2/retries=0, sin webServer de Next: las ocho suites prueban componentes con sus servidores locales propios.

AFUERA: limpieza final de posEnabled del servidor, revisión adversarial conjunta de Claude, QA del owner contra la base local/túnel y migración/deploy de producción. La spec permanece cerrada hasta PASS independiente. Sin API, módulos servidor/manifiestos, packages/db, kit, guardias/tooling, PWA o inicio en estos commits.
