# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — 0161 IMPLEMENTADA (`fede9d2`), SIN PUSHEAR; SIGUE LA FASE 0c, DESPUES GPT

**Hecho (verificado):**
- **0161** (Fase 0b, rebanada 3, cierra la 0b): spec `8354f93`, implementacion `fede9d2`. Decisiones del owner
  ANTES de la spec (enmienda del ADR 0123): fecha/hora con **segmentos de React Aria + calendario**, color con
  **muestra + hex editable**, busqueda con **lupa + borrar**. El kit suma `TimeField`, `DateTimeField`,
  `SearchField`, `ColorField`, `Slider` y `FileButton`; fecha/hora fijan `es-419` y 24 h y conservan los valores de
  texto nativos (`HH:mm`, `YYYY-MM-DDTHH:mm`). `@internationalized/date` 3.12.4 como dependencia directa del
  merchant. Rojo primero (6 exports faltantes); M1–M4 rojas por la asercion esperada y revertidas. Kit `58 passed`;
  `CI=1` `17 passed`/`41 skipped`. Capturas (16): https://claude.ai/artifact/URDEy2rxoDyLGF8U8ywoo2 . Desvios en la
  seccion «Implementacion» de la spec (el mas importante: `FileButton` arma su input propio porque `FileTrigger`
  descarta el `aria-label` que usan los e2e).
- **`pnpm verify` → ROJO, dos corridas**, solo en `neon (full)`: el flake PARQUEADO #74 (`catalog-import-guard`
  201 vs 409, `catalog-import-reconcile` polls 1 vs 0). La Neon completa suelta sobre el mismo arbol: `381 passed`,
  exit 0. Corre `full` porque cambio el lockfile. Todo lo demas `ok`.

**Siguiente, en orden:**
1. **Push de `fede9d2` + docs**: el pre-push va a dar rojo por #74; **pedir OK del owner** para `--no-verify` (como
   en la 0160) o reintentar el `verify`.
2. **Fase 0c** (guardias): spec nueva. Ahi tambien restringir el `type` de `TextField` (hoy 8 `datetime-local` en
   marketing) o dejarlo a la Fase 1 (anotado en «No entra» de la 0161).
3. **Recien despues GPT** (owner, 2026-10-05). Al terminar la 0c se rehace un solo prompt con 0160 + 0161 + 0c.
   Avisarle: los e2e que hoy usan `setInputFiles` por id/etiqueta, `searchbox`, `slider` «Zoom» y el hex de Marca
   se migran con cada pantalla (lista en «Medido para el diseño» de la 0161); con segmentos no se usa `fill`.

**Pendientes del owner:** QA del buscador de lugares (alta y locales) y del tour de locales paso «Busca la
dirección» (de la 0160). Borrar las dos claves de Geoapify en Vercel; QA del alta/locales/programa; deploys de
`b1ab123` y `d797c21`.

**Decidido por el owner (2026-10-05):** `.env.example` queda como esta. Las tres decisiones de la 0161 (arriba). No
volver a pedirlas.

**Hallazgos abiertos:** PARQUEADO #74 (2 veces mas hoy, en `verify`), #75, #78, #77 (diferido); H4 de la 0155.
`docs/design-system.md` §Form todavia dice «Pendiente» sobre `validationErrors` (texto viejo, sin tocar).

**Gotchas de esta sesion:** `FileTrigger` de RAC 1.21.1 no pasa `aria-label` al input. Los segmentos de fecha
llevan marcas U+2066..U+2069 en `textContent`. Un estilo de «hoy» en una captura necesita `page.clock`. El CSS
`legacy` de `input` se cuela en inputs internos del kit: neutralizar con utilidades. Una pagina del harness mas larga
puede dejar el puntero sobre un boton de un modal (hover en el oraculo de color). `/private/tmp/x` es un archivo
ajeno: no tocar.

**Prompt para retomar:** «Lee docs/estado/claude.md: push de la 0161 y spec de la Fase 0c».
