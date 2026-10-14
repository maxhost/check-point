# Modulos — como se trabaja

Guia operativa del patron de modulos (decisiones: ADR 0138 y **ADR 0139**). La siguen Claude y GPT. Si algo de aca
choca con el codigo, manda el ADR y esta guia se corrige.

## La regla

**Un modulo es una carpeta. Agregarlo, cambiarlo o borrarlo no toca ningun archivo del core.**
El core son el catalogo, el programa de fidelizacion, marketing, analitica, personal, locales y el marco del panel.
Todo lo demas (Stock, Recetas, y despues POS, Mesas, Turnos…) es un modulo que se enciende por comercio.

Direccion de dependencias: **modulo → core** y **modulo → modulo que declara en `requires`**. Nunca core → modulo.

## Donde va cada cosa

| Que | Donde | Quien |
|---|---|---|
| Lo que el modulo declara (nombre, dependencias, rubros, permisos, menu, panel de Ajustes) | `apps/merchant/src/modules/<id>/manifest.ts` (puro) | Claude |
| Logica y handlers de API | `modules/<id>/server/` | Claude |
| Tabla de rutas de API (`{ method, path, handler }`) | `modules/<id>/server/routes.ts` | Claude |
| Pantallas y panel de Ajustes | `modules/<id>/ui/` | GPT |
| Esquema de base | `packages/db/src/schema/modules/<id>.ts` (`pgSchema("<id>")`) + migracion | Claude |
| Tests de servidor | `modules/<id>/**.test.ts`, `*.neon.integration.test.ts` | Claude |
| Tests e2e de pantallas | `tests/e2e/<id>*.spec.ts` | GPT |

**Nunca** se crea un archivo en `app/` para un modulo: las pantallas las despacha `app/backoffice/[module]/…` y la API
`app/api/modules/[moduleId]/…`.

## Crear un modulo, paso a paso

1. **Decision del owner**: que resuelve, para que rubros, de que modulos depende, que permisos pide. Nivel minimo L2
   (es una funcionalidad nueva; si trae migracion o toca dinero/sesiones, piso L2 de todas formas).
2. **Spec** con el contrato HTTP (lo que GPT conecta) y el manifiesto.
3. **Claude**: carpeta `modules/<id>/` (manifiesto, `server/`, `routes.ts`), esquema + migracion, **una linea en cada
   registro** (`registry.ts`, `server-registry.ts`, `ui-registry.ts`), tests de servidor.
4. **GPT** (con encargo de Claude): pantallas en `modules/<id>/ui/`, su linea en `ui-registry.ts`, e2e.
5. **Gates**: `modules-boundary.test.ts` (la frontera) en verde; las suites del modulo; en L3, revisor adversarial.

## Lo que el core ofrece (puntos de enganche)

| Punto | El modulo declara | El core hace |
|---|---|---|
| Activacion | `requires`, `suggestedFor` | switch en Ajustes, 409 si falta una dependencia o hay dependientes, «Sugerido» por rubro |
| Menu | `navigation` | dibuja las entradas de los modulos encendidos que el usuario puede ver |
| Ajustes | `settingsPanel` | dibuja el panel del modulo encendido |
| Permisos | `permissions` | los suma al selector del personal; sin efecto y no otorgables con el modulo apagado |
| Pantallas | `ui-registry` | despacha `/backoffice/<id>/…`; 404 si el modulo esta apagado |
| API | `server/routes.ts` | despacha `/api/modules/<id>/…` con guard de permiso + modulo encendido |
| IA (ADR 0143) | sus tareas en `ai-tasks.ts` (id `<id>.<nombre>`, prompt, esquema, modelo, modo) y la ruta que las usa | `server/ai/` las ejecuta: proveedor, modelo por entorno, imagenes, logs y registro `core.ai_request` |

¿El modulo necesita algo que no esta en esta tabla (pantalla completa, inicio de la PWA, accion en Locales, regla para
no apagarse)? **Se agrega el punto de enganche al core por ADR**, generico, y el modulo lo declara. Nunca un `if` con el
nombre del modulo en el core.

## Lo que vigilan los tests (`modules/modules-boundary.test.ts`)

- el core no importa ni nombra modulos (codigo y pantallas);
- el esquema del core no importa esquemas de modulo, y ninguna FK del core apunta a uno;
- ningun id de modulo choca con una ruta del core;
- cada modulo esta completo en los tres registros.

Si un test de frontera da rojo, **no se agrega una excepcion**: se mueve el codigo al modulo o se crea el punto de
enganche. Las unicas excepciones son las nombradas en el ADR 0139 §7.

## Apagar y borrar

Apagar no borra datos (las rutas dan 403 `module_disabled`, el menu lo oculta, sus permisos quedan sin efecto).
Borrar el codigo de un modulo es borrar su carpeta y sus tres lineas; las tablas quedan hasta una migracion explicita
con OK del owner.
