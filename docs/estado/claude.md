# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-12, noche) — MODULOS (ADR 0138) + STOCK Y RECETAS (0210) + DICTADO DE STOCK (0212) Y DE RECETAS (0214) EN `dev`; 0074-0077 YA EN PROD (CODIGO NO)

**En PROD:** codigo `origin/main` = `3fe2ad6` (sin cambios). **Base PROD: 0074-0077 APLICADAS el 2026-10-13** por MCP (`run_sql_transaction`, una transaccion; snapshot previo
`snap-round-paper-axm7z3lj`; leido por SQL: 78 migraciones, los 4 hashes = sha256 de cada `.sql`, tablas `core.business_module`,
`stock.{item,movement,draft_request}`, `recipes.line`, columnas `entry_id` y `kind`; 4 comercios y 144 productos intactos). Aditivas: el codigo
de PROD (`3fe2ad6`) no las lee. Tambien en la base local (78 migraciones, y en `ci-integration` por `neon-test.sh`).

**Hecho esta sesion (en `dev`, sin push):**
- Analisis con el owner: `docs/analisis-recetas-stock-2026-10-12.md` (decisiones textuales; parqueados #96 prevision,
  #97 stock+marketing, #98 hueco teorico/real).
- ADR 0138: modulos como plugins (el core no importa modulos; test `modules-boundary.test.ts`).
- Spec 0210 implementada: `cdd145c` (implementador) + `cbab1a3` (test que cierra la M2 del revisor; revisor PASS) +
  `2cddc7e` entradas con varias lineas (`POST /api/modules/stock/entries`, el camino del audio), compra sin precio,
  registro general (`GET /api/modules/stock/movements`), migracion 0075. Suites de modulos 31/31 Neon, unitarios 37,
  typecheck y lint verdes; M5 (compra sin precio tapa el costo) mordio y revertida. `PUT /api/modules/{stock,recipes}`
  medido contra `next dev`: 401 (llega al guard, no 405).
- Spec 0212 implementada (`21728b1`): `POST /api/modules/stock/entries/draft` (texto dictado → borrador validado por el
  servidor; la IA ve solo insumos del negocio), uso en `stock.draft_request` sin texto y SIN tope (owner: medir primero;
  `draftsSince` listo para el tope), migracion 0076. Unitarios 5 + Neon 4 verdes; M6 (la IA ve insumos ajenos) mordio y
  revertida. Proveedor: `STOCK_DRAFT_PROVIDER` → `CATALOG_EXTRACTION_PROVIDER` → `fake`. **Local no tiene
  `OPENAI_API_KEY`**: en local el borrador vuelve vacio (fake). Sin probar contra OpenAI real.
- Dictado: `d18bb39` (muletillas ignoradas, QA del owner), `646dafa` (default `gpt-6-luna`: banco de 6 frases, mismos
  aciertos que `gpt-5-mini`, 3,0 s vs 7,0 s, ~$0,00018 vs ~$0,0021 por analisis; precios de agregadores).
- Spec 0214 implementada (`3cc57dd`): `POST /api/modules/recipes/:productId/draft` (receta POR UNIDAD, `yield` divide,
  «a gusto» sin cantidad) + `PUT` de receta con `newItem`/`unit`; uso con `kind` (migracion 0077). Unitarios 5 + Neon 5
  verdes, los viejos de Recetas intactos; M7 mordio. Sonda real con 3 recetas OK. `recipes.ts` partido (`read.ts`).
- Encargo a GPT: `docs/encargo-gpt-2026-10-12-modulos-stock-recetas.md` (Ajustes + Stock como log + Recetas como
  gestion; SIN costo/margen: van a Analitica, owner). GPT ya commiteo 0211 (cards en Ajustes) y sigue.

**QUE SIGUE:**
1. GPT cierra pantallas → probar en local → OK del owner para 0074+0075 a PROD (snapshot previo, MCP) → `main` ←
   `merge --ff-only dev`, probar `main`, push con OK. El comercio real lo prueba despues.
2. Hallazgos a decidir: path del toggle (`/api/modules/:id/state` evita la colision de Next); `GET /api/modules` exige
   permiso `catalog` (no hay guard «cualquier miembro»); test de frontera no ve `import * as schema` (hoy solo en
   `server/auth.ts`).
3. Siguiente incremento: audio/IA sobre `POST /entries` (borrador revisable, ADR 0082); analitica como inbox de
   decisiones (vision del owner, sin diseñar).

**Decisiones del owner, no volver a preguntar:** las del analisis 2026-10-12 (nucleo + modulos por rubro, empezar por
costo/margen, una receta por producto sin sub-recetas, un solo stock de materia prima, datos quedan al desinstalar,
dependencias entre modulos, atados al plan, recetas depende de stock, modulos en Ajustes como POS e Imprimir, recetas y
stock son gestion y costo/margen va a analitica, una frase de audio = varios registros separados).
