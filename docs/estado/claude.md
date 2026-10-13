# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-12, noche) — MODULOS (ADR 0138) + STOCK Y RECETAS (SPEC 0210) EN `dev`; 0074/0075 SOLO LOCAL Y CI

**En PROD:** codigo `origin/main` = `3fe2ad6` (sin cambios). **Base PROD:** hasta 0073. **0074 y 0075 NO estan en PROD**
(aplicadas en la base local, 76 migraciones leidas por SQL, y en `ci-integration` por `neon-test.sh`).

**Hecho esta sesion (en `dev`, sin push):**
- Analisis con el owner: `docs/analisis-recetas-stock-2026-10-12.md` (decisiones textuales; parqueados #96 prevision,
  #97 stock+marketing, #98 hueco teorico/real).
- ADR 0138: modulos como plugins (el core no importa modulos; test `modules-boundary.test.ts`).
- Spec 0210 implementada: `cdd145c` (implementador) + `cbab1a3` (test que cierra la M2 del revisor; revisor PASS) +
  `2cddc7e` entradas con varias lineas (`POST /api/modules/stock/entries`, el camino del audio), compra sin precio,
  registro general (`GET /api/modules/stock/movements`), migracion 0075. Suites de modulos 31/31 Neon, unitarios 37,
  typecheck y lint verdes; M5 (compra sin precio tapa el costo) mordio y revertida. `PUT /api/modules/{stock,recipes}`
  medido contra `next dev`: 401 (llega al guard, no 405).
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
