---
spec: 0027
fecha: 2026-08-13
estado: implementada
resumen: La creación y edición del programa de fidelización pasan a un wizard por pasos (Puntos y Sellos) e incorporan el diseño visual de la tarjeta de Sellos —fondo sólido o degradé lineal de ángulo configurable, color de borde de los recuadros— persistido en columnas dedicadas con preview en vivo, defaults derivados de la marca.
disjunta: si
archivos: apps/merchant (loyalty), migración Drizzle, Neon, pruebas y docs
---

# 0027 — Wizard de creación y diseño visual de la tarjeta de fidelización

> **Nada de código empieza sin esta spec en `cerrada`.** Cerrada el 2026-08-13 con las seis
> decisiones abiertas resueltas por el owner (ver «Decisiones cerradas»).
>
> **IMPLEMENTADA el 2026-08-13.** Gates verdes: typecheck 3/3, lint, unit 33/10-skip, Prettier,
> **build 3/3** (turbo); **integración Neon 6/6** en rama efímera; **migración `0013` aplicada y
> verificada en prod** (4 columnas + 5 checks). **PASS de revisor independiente** (`AGENT-WORKFLOW.md`,
> sin bloqueantes ni importantes; solo menores informativos) y **QA manual en vivo del owner OK**
> (crear Sellos por el wizard con degradé/ángulo/borde/imagen, preview en vivo, activar, reabrir en
> edición; Puntos por los 3 pasos). Nota de entorno resuelta: el `pnpm build` local fallaba por un
> `NODE_ENV=development` que inyecta el harness de dev (no del repo, no de esta feature: React
> mezclaba dev/prod y reventaba el prerender de `/_global-error`); se blindó con `NODE_ENV=production`
> en el `build` de los tres apps (no-op en Vercel) y se alineó el local a Node 24.19.0.

## Problema

Hoy la creación y la edición del programa de fidelización son un formulario único de scroll
(`program-editor.tsx` + `use-loyalty-program.ts`): la modalidad, la configuración, el sello y
los términos se ven todos a la vez. El owner quiere:

1. Un **wizard por pasos** para crear y editar (Puntos y Sellos), con navegación adelante/atrás
   y validación por paso.
2. Para **Sellos**, poder **diseñar la tarjeta** —color(es) de fondo y color de borde de los
   recuadros del sello— y ver un **preview en vivo** de cómo queda con y sin sellos puestos.

La imagen del sello ya existe (spec 0026); esta feature agrega el resto del aspecto visual de la
tarjeta y reorganiza el flujo en pasos.

## Decisiones cerradas (owner, 2026-08-13)

1. **Modelo de datos: columnas dedicadas** (no `jsonb`), siguiendo el criterio de 0026 para el
   sello y el precedente de checks hex de `business.ts`. Ver ADR 0030.
2. **Degradé lineal con dirección configurable**: se persiste el ángulo en grados; la UI ofrece
   presets (vertical/horizontal/diagonal) que setean el ángulo. Sólo aplica cuando hay 2º color.
3. **Crear y editar usan el wizard.** El paso «diseño de tarjeta» es un componente compartido.
4. **El preview muestra la mitad del objetivo con sellos puestos** (`round(target/2)`), el resto
   vacíos.
5. **Defaults de color derivados de la marca del negocio** (`business.brand*Color` de 0025):
   fondo = primario, fondo 2 = complementario (degradé activado por default), borde = acento.
6. **Puntos sin diseño de tarjeta**: no hay tarjeta de sellos que pintar. Las columnas de diseño
   son nullable, así la DB queda preparada para un futuro visual de Puntos sin trabajo hoy y sin
   romper programas existentes.

## Alcance

**Entra:**

- Convertir creación **y** edición del programa en un **wizard por pasos** con navegación
  adelante/atrás y validación por paso, para Puntos y Sellos.
- **Puntos** — pasos: (1) nombre de unidades singular/plural → (2) términos → (3) preview +
  Activar/Guardar.
- **Sellos** — pasos: (1) nombre del sello + cantidad (objetivo 2–50) → (2) **diseño de la
  tarjeta** (fondo 1 obligatorio, fondo 2 opcional con ángulo de degradé, color de borde, upload
  de imagen del sello reutilizando 0026, **preview en vivo**) → (3) términos → (4) preview +
  Activar/Guardar.
- Nuevas **columnas de diseño** en `core.loyalty_program` (nullable) + validación server + checks
  hex/ángulo a nivel DB. Migración aditiva verificada en Neon efímero y aplicada a prod.
- Componente **`CardPreview`** reutilizable que renderiza el fondo (sólido o degradé lineal en el
  ángulo elegido), los N recuadros (llenos vs. vacíos, con color de borde y fondo blanco) y la
  imagen del sello en los llenos. Se usa en el paso de diseño (vivo) y en el paso final.
- `toClientProgram` expone las columnas de color (son diseño público, no secretos).

**No entra (explícito):**

- El **wallet consumer** que consumirá la tarjeta (spec propia). `CardPreview` se diseña pensando
  en reusarse ahí, pero no se mueve a un paquete compartido en esta spec.
- **Diseño visual para Puntos** (no hay tarjeta; columnas quedan `null`).
- Animaciones, plantillas de diseño predefinidas, temas, degradés radiales o de 3+ colores.
- Cambiar la modalidad (`kind`) de un programa existente: la edición mantiene el `kind` fijo, como
  hoy.
- Tocar el flujo de **cierre** del programa (`program-closing.tsx`, `closeProgram`, `cancelClose`)
  ni la auditoría por eventos.

## Diseño

### Arquitectura de referencia

- ADR 0020 — programa de fidelización único por negocio.
- ADR 0026/0027 — versiones, transiciones, términos y cierre fechado (no se modifican).
- ADR 0029 — módulo de assets compartido para imágenes en R2 (el upload del sello se reutiliza tal
  cual: `useStampUpload` + `resolveStampChange`).
- **ADR 0030 (nuevo)** — modelo de datos del diseño de tarjeta (columnas dedicadas + ángulo
  configurable + defaults desde marca).

### Modelo de datos

Cuatro columnas nuevas en `core.loyalty_program` (archivo `server/schema/loyalty.ts`), **todas
nullable** (Puntos y programas de Sellos previos las dejan en `null`):

| Columna (TS) | Columna SQL | Tipo | Notas |
|---|---|---|---|
| `cardBackgroundColor` | `card_background_color` | `text` nullable | Fondo 1. `#RRGGBB` |
| `cardBackgroundColor2` | `card_background_color_2` | `text` nullable | Fondo 2 del degradé; `null` = fondo sólido |
| `cardBackgroundGradientAngle` | `card_background_gradient_angle` | `integer` nullable | Grados 0–360; sólo relevante con fondo 2 |
| `cardBorderColor` | `card_border_color` | `text` nullable | Borde de los recuadros del sello. `#RRGGBB` |

Constraints a nivel DB (mismo estilo que `business_*_color_check` en `business.ts:36-64`,
tolerando `NULL`):

- `loyalty_program_card_bg_color_check`: `card_background_color IS NULL OR card_background_color ~ '^#[0-9A-Fa-f]{6}$'`.
- `loyalty_program_card_bg_color2_check`: idem `card_background_color_2`.
- `loyalty_program_card_border_color_check`: idem `card_border_color`.
- `loyalty_program_card_gradient_angle_check`: `card_background_gradient_angle IS NULL OR (card_background_gradient_angle >= 0 AND card_background_gradient_angle <= 360)`.
- `loyalty_program_card_gradient_pair_check`: `card_background_color_2 IS NULL OR (card_background_color IS NOT NULL AND card_background_gradient_angle IS NOT NULL)` — no se persiste un fondo 2 sin fondo 1 ni sin ángulo.

**Invariantes (validadas en server + reforzadas por checks):**

- Si `kind = 'stamps'` y hay diseño, `cardBackgroundColor` y `cardBorderColor` son obligatorios.
- Si `cardBackgroundColor2` presente ⇒ `cardBackgroundGradientAngle` presente (server default 180
  si el cliente lo omite) y `cardBackgroundColor` presente.
- Si `kind = 'points'` ⇒ las cuatro columnas deben ser `null` (el server rechaza diseño en Puntos
  con `422`).
- Colores normalizados a **mayúsculas** (`#RRGGBB`).

La imagen del sello sigue en sus columnas dedicadas (`stamp_image_object_key`/`stamp_image_version`,
0026); el color **no** va en `configuration` jsonb (mismo criterio: `validation.ts:31`).

### API / acciones

No hay endpoint nuevo. La creación y la edición siguen yendo por `PUT /api/loyalty-program`
(`route.ts`, 201 create / 200 update). El payload de entrada (`ProgramInput`, `core.ts`) gana un
campo opcional:

```text
cardDesign?: {
  backgroundColor: string        // #RRGGBB
  backgroundColor2?: string|null  // #RRGGBB | null
  gradientAngle?: number|null     // 0..360; default 180 si hay backgroundColor2
  borderColor: string             // #RRGGBB
}
```

- **Entrada válida (stamps con diseño):** `cardDesign` presente y bien formado → persiste las 4
  columnas.
- **Errores esperados:** color con formato inválido, ángulo fuera de `0..360`, `cardDesign` en un
  programa `points`, o `backgroundColor2` sin `backgroundColor` → `422` con mensaje específico por
  caso (mismo patrón que `validateClosingWindow`).
- **Salida:** `toClientProgram` (`client-view.ts`) agrega los 4 campos de color al DTO (spread
  directo; no son secretos). El consumidor de la UI los usa para hidratar el wizard al editar.

### Validación (server)

Nueva función `validateCardDesign(kind, cardDesign)` en `loyalty-program/validation.ts`, llamada
desde `validateProgramInput`:

- `points` + `cardDesign` presente → `LoyaltyError` 422.
- `stamps` + `cardDesign` ausente → permitido (programa de Sellos sin diseño; el DTO devuelve
  colores `null` y `CardPreview` usa defaults). El wizard, sin embargo, exige el diseño en su paso
  2 antes de avanzar (validación de UI); el server no lo obliga para no romper programas viejos.
- Normaliza colores a mayúsculas, valida `^#[0-9A-Fa-f]{6}$`, valida ángulo entero `0..360`,
  aplica el default de ángulo (180) cuando hay 2º color y falta.
- Devuelve la tripleta/cuádrupla normalizada que `saveProgram` escribe en las columnas.

`saveProgram` (`loyalty-program.ts`) incluye las 4 columnas en el INSERT (creación) y en el CTE
`UPDATE … RETURNING` (edición). Sin cambios en la lógica de R2/sello ni en la de eventos.

### UI / Wizard

Reorganización de `apps/merchant/src/app/backoffice/loyalty/`:

- **Contenedor de wizard** (`program-editor.tsx` se reescribe como orquestador de pasos): estado
  de paso actual, barra de progreso, botones **Atrás/Siguiente**, y en el último paso **Activar
  programa** (create) o **Guardar cambios** (edit). Reutiliza `Toast` y `LoyaltySkeleton`.
- **Selección de modalidad** (`points`/`stamps`) como paso 0 sólo en **creación** (el radiogroup
  `loyalty-types` actual). En **edición** el `kind` está fijo y el wizard arranca en el paso 1.
- **Pasos como componentes** bajo `loyalty/steps/` (para respetar `file-size` LIMIT=300):
  - `step-units.tsx` (Puntos: singular/plural).
  - `step-stamp-basics.tsx` (Sellos: nombre + cantidad 2–50).
  - `step-card-design.tsx` (Sellos: fondo 1, toggle degradé + fondo 2 + presets de ángulo, borde,
    upload de sello vía `useStampUpload`, `CardPreview` en vivo).
  - `step-terms.tsx` (términos; reutiliza `AutoGrowTextarea` + «+ Insertar» de plantillas).
  - `step-review.tsx` (preview final con `CardPreview` para Sellos + resumen + botón final).
- **`CardPreview`** (`loyalty/card-preview.tsx`): props `{ backgroundColor, backgroundColor2, gradientAngle, borderColor, target, filled, stampImagePath }`. Fondo = `background: linear-gradient(<angle>deg, c1, c2)` si hay `backgroundColor2`, si no `background: c1`. Renderiza `target` recuadros: los primeros `filled = round(target/2)` (o el valor que le pase el paso) con fondo blanco + imagen del sello; el resto vacíos, todos con `border-color`. Sin dependencias del backend: sólo props. Pensado para portarse al wallet consumer luego.
- **Defaults desde marca**: al entrar por primera vez al paso de diseño de un programa **nuevo** de
  Sellos, se prellenan `backgroundColor = brandPrimaryColor`, `backgroundColor2 = brandComplementaryColor`
  (degradé activado), `borderColor = brandAccentColor`. Los colores de marca se obtienen del negocio
  del owner (fetch a `/api/brand` o exposición vía el loader del programa; ver «Archivos
  compartidos»). Al **editar**, se hidratan desde el DTO del programa; si el programa viejo tiene
  colores `null`, se caen a los defaults de marca.
- **Validación por paso** (UI): unidades no vacías; cantidad entera 2–50; en diseño, los 3 colores
  activos con formato válido; términos según regla actual. El botón «Siguiente» se deshabilita
  hasta que el paso valida.

### Split de archivos (hook `file-size`, LIMIT=300)

- `use-loyalty-program.ts` (253) → extraer el estado de wizard/diseño a un hook nuevo
  (`use-card-design.ts` y/o `use-wizard.ts`) para no cruzar 300.
- `program-editor.tsx` (176) → contenedor + `steps/*` (arriba).
- `validation.ts` (149) → cabe la `validateCardDesign`; vigilar el límite.
- `loyalty-program.ts` (277) → la validación de color vive en `validation.ts`, así `saveProgram`
  sólo suma nombres de columnas; vigilar que no cruce 300 (si lo hace, mover un helper a un
  submódulo).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/loyalty.ts` | editar — 4 columnas + 5 checks |
| `apps/merchant/drizzle/0013_*.sql` + `meta/` | crear — migración aditiva |
| `apps/merchant/src/server/loyalty-program/core.ts` | editar — `cardDesign` en `ProgramInput`; tipo `CardDesignInput` |
| `apps/merchant/src/server/loyalty-program/validation.ts` | editar — `validateCardDesign` |
| `apps/merchant/src/server/loyalty-program.ts` | editar — columnas de color en INSERT/UPDATE de `saveProgram` |
| `apps/merchant/src/server/loyalty-program/client-view.ts` | editar — exponer colores en el DTO |
| `apps/merchant/src/app/backoffice/loyalty/program-editor.tsx` | reescribir — contenedor de wizard |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-units.tsx` | crear |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-stamp-basics.tsx` | crear |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-card-design.tsx` | crear |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-terms.tsx` | crear |
| `apps/merchant/src/app/backoffice/loyalty/steps/step-review.tsx` | crear |
| `apps/merchant/src/app/backoffice/loyalty/card-preview.tsx` | crear — `CardPreview` compartido |
| `apps/merchant/src/app/backoffice/loyalty/use-loyalty-program.ts` | editar — payload `cardDesign`, hidratación al editar |
| `apps/merchant/src/app/backoffice/loyalty/use-card-design.ts` | crear — estado del diseño/wizard (split) |
| `apps/merchant/src/app/backoffice/loyalty/page.tsx` | editar — pasar defaults de marca / branch wizard |
| `apps/merchant/src/app/backoffice/loyalty/*.css` (o el CSS del panel) | editar — estilos de wizard/tarjeta |
| `apps/merchant/src/server/loyalty-program/*.test.ts` | editar/crear — unit de `validateCardDesign` |
| `apps/merchant/tests/integration/*loyalty*` | editar/crear — persistencia de columnas |
| `docs/adr/0030-*.md`, `docs/INDEX.md`, `docs/TASKS.md` | crear/editar |

### Disjunta?

**Sí.** Todos los archivos son de la feature loyalty en `apps/merchant`. Las specs que comparten
esos archivos (0024/0025/0026) están **`implementada`** — no hay ninguna spec **abierta** que toque
`apps/merchant/src/{server,app}/…loyalty…`. Las specs abiertas restantes (0001–0009 borrador, 0021,
0023) no tocan loyalty. Podría paralelizarse, pero se implementa sola (es la única feature activa).

### Archivos compartidos (deja listos el orquestador antes de despachar)

| Qué | Quién | Cuándo |
|---|---|---|
| Contrato de `CardDesignInput` (tipo TS en `core.ts`) | orquestador | antes de despachar |
| Forma de props de `CardPreview` (colores + `target`/`filled` + `stampImagePath`) | orquestador | antes de despachar |
| Cómo llegan los colores de marca al cliente (fetch `/api/brand` existente vs. loader) | orquestador | antes de despachar |

## Definition of Done

- [x] La creación de **Puntos** usa el wizard de 3 pasos (unidades → términos → preview+activar);
      la de **Sellos**, el de 4 pasos (básicos → diseño → términos → preview+activar).
- [x] La **edición** también usa el wizard, con el `kind` fijo y los datos hidratados desde el DTO.
- [x] En Sellos se eligen fondo 1, (opcional) fondo 2 con ángulo de degradé configurable, y color
      de borde; se persisten en las 4 columnas.
- [x] Los **defaults** al diseñar un programa nuevo de Sellos vienen de la marca (primario/
      complementario/acento).
- [x] El **preview** muestra la tarjeta con los colores elegidos y `round(target/2)` sellos puestos
      (llenos vs. vacíos), y se actualiza **en vivo** al cambiar cualquier color/ángulo.
- [x] La API valida colores (`#RRGGBB`), ángulo (`0..360`), rechaza diseño en Puntos y fondo 2 sin
      fondo 1/ángulo → `422` con mensaje por caso; el DTO expone los colores (no `*ObjectKey`).
- [x] Migración `0013` aplicada/verificada en Neon (rama efímera) y en prod; los checks rechazan
      hex/ángulo inválido a nivel DB.
- [x] Ningún archivo supera el límite de `file-size` (300); los splits están hechos.
- [x] Gates verdes: typecheck 3/3, lint, unit, build 3/3.
- [x] **PASS de revisor independiente** (`AGENT-WORKFLOW.md`).

## Plan de pruebas y verificación

- [x] **Unit** (`validation`): `validateCardDesign` acepta hex válidos y normaliza a mayúsculas;
      rechaza hex inválido; rechaza `cardDesign` con `kind='points'`; aplica default de ángulo 180
      cuando hay fondo 2 sin ángulo; rechaza ángulo fuera de `0..360`; rechaza fondo 2 sin fondo 1.
- [x] **Unit** (`CardPreview` o helper de estilo): con `backgroundColor2` produce
      `linear-gradient(<angle>deg, …)`; sin él, fondo sólido; `filled = round(target/2)` recuadros
      llenos para `target` par e impar (p.ej. 2→1, 5→3, 10→5).
- [x] **Unit** (`client-view`): `toClientProgram` incluye los 4 campos de color y sigue **omitiendo**
      `stampImageObjectKey` (blindaje de fuga, regla del repo).
- [x] **Integración Neon** (rama efímera): crear programa de Sellos con diseño → columnas
      persistidas; editar cambiando colores/ángulo → round-trip idéntico; INSERT con hex inválido o
      ángulo 400 rechazado por el check (error de DB, no 200); crear Puntos con colores `null` OK.
- [x] **Regresión**: un programa de Sellos preexistente con colores `null` hidrata `CardPreview`
      con defaults de marca sin crashear.
- [x] **Comandos exactos**: `pnpm --filter @check-point/merchant typecheck`, `... lint`,
      `... test` (unit), `pnpm build`, e integración Neon en rama efímera creada/borrada vía MCP.
- [x] **Verificación manual (owner, en vivo sobre Vercel)**: crear un programa de Sellos por el
      wizard eligiendo degradé + ángulo por preset + borde + imagen de sello; ver el preview en vivo
      con la mitad de sellos puestos; activar; reabrir en modo edición y confirmar que todo se
      hidrata; crear un programa de Puntos por el wizard de 3 pasos; verificar mobile.

## Handoff requerido

Implementador y revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor produce un `PASS`
independiente —verificado contra Neon real y contra los checks de DB— antes de pasar la spec a
`implementada`.

## Abierto

Nada bloqueante. Las seis decisiones de diseño están cerradas (ver «Decisiones cerradas»). Detalle
menor a resolver **en implementación** (no bloquea): la UI exacta del selector de ángulo (presets
vs. presets + slider fino) y si los colores de marca llegan por el fetch `/api/brand` ya existente o
se exponen en el loader del programa — ambas son decisiones de implementación sin impacto en el
contrato ni en el modelo de datos.
