# Auditoria del arnes de Claude Code en el repo `check-point-wt/motor` (medida 2026-10-04)

Metodo: todo lo medido sale de comandos read-only corridos en el worktree `motor` (HEAD `24ce0df`).
Tamaños con `wc -l / -w / -c`; **tokens aproximados = caracteres / 4**. Las fuentes son rutas del repo
(relativas a `/Users/maxi/Documents/claude-workspace/check-point-wt/motor/`). Lo marcado como
«evidencia de sesion (orquestador)» lo paso el orquestador tal cual y NO lo medi yo.

## 1. Que se carga en contexto en TODA sesion

### Takeaway
Lo que Claude Code inyecta solo (CLAUDE.md raiz + MEMORY.md + descripciones de skills/agentes) es chico,
**~4,5k tokens**. Pero el flujo que CLAUDE.md manda leer al arrancar («Empeza aca» `docs/INDEX.md` +
`docs/estado/claude.md`) suma **~63k tokens mas**, y el agente implementador ademas manda leer
`docs/TASKS.md`, que mide **~163k tokens**.

### Cited Findings
- `CLAUDE.md` raiz: **199 lineas, 2.344 palabras, 14.335 chars ≈ 3.583 tokens**. Un hook (`claude-md-size.sh`)
  bloquea el fin de turno si pasa de **200 lineas**: esta a 1 linea del techo. — [CLAUDE.md](CLAUDE.md), [.claude/hooks/claude-md-size.sh](.claude/hooks/claude-md-size.sh)
- `apps/merchant/CLAUDE.md`: 1 linea, solo `@AGENTS.md`; `apps/merchant/AGENTS.md` = 9 lineas, 678 chars ≈ 169 tokens
  (bloque autogenerado de Next.js: «This is NOT the Next.js you know»). Se carga solo al trabajar bajo `apps/merchant/`
  (CLAUDE.md anidado). El `AGENTS.md` raiz (27 lineas ≈ 433 tok) es para GPT; Claude Code no lo auto-carga. — [apps/merchant/CLAUDE.md](apps/merchant/CLAUDE.md), [apps/merchant/AGENTS.md](apps/merchant/AGENTS.md)
- Auto-memoria `MEMORY.md`: 4 lineas, 546 chars ≈ 136 tokens (3 entradas; hay 4 archivos de memoria, uno sin indexar:
  `comercios-de-prueba-qa-cupones.md`). — `/Users/maxi/.claude/projects/-Users-maxi-Documents-claude-workspace-check-point/memory/MEMORY.md`
- No existe `~/.claude/CLAUDE.md` global. No existe `.claude/settings.local.json`.
- Frontmatter (descripcion) de skills y agentes que se listan en cada sesion: gotchas 701, handoff 398,
  protocolo 687, qa-cupones 356, implementador 465, revisor 479 chars → **3.086 chars ≈ 770 tokens**. — `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`
- Lecturas que CLAUDE.md ordena al arrancar (flujo paso 1 y «Empeza aca»):
  - `docs/INDEX.md`: **351 lineas, 35.189 palabras, 230.771 chars ≈ 57.692 tokens**. 250 filas, media 889 chars por fila,
    la mas larga **14.817 chars** (ADR 0071 manda filas de 3 lineas). — [docs/INDEX.md](docs/INDEX.md)
  - `docs/estado/claude.md`: 281 lineas, 3.269 palabras ≈ **5.528 tokens** (el bloque vigente es el primero; el resto son
    «ESTADO HISTORICO» acumulados). — [docs/estado/claude.md](docs/estado/claude.md)
  - `pnpm ci:status` (una llamada a la API de GitHub).
- Otros docs referenciados: `docs/TASKS.md` **7.709 lineas, 96.616 palabras, 652.934 chars ≈ 163.233 tokens**;
  `docs/LECCIONES.md` 1.998 lineas ≈ **36.551 tokens** (61 casos `##`; CLAUDE.md dice que no se importa con `@`);
  `docs/PARQUEADO.md` 86 lineas ≈ 5.845 tok; `docs/estado/gpt.md` 141 lineas ≈ 2.387 tok;
  `docs/TRABAJO-EN-PARALELO.md` 74 lineas ≈ 768 tok. — [docs/TASKS.md](docs/TASKS.md), [docs/LECCIONES.md](docs/LECCIONES.md)

### Inferences
- Piso automatico ≈ 3.583 + 136 + 770 ≈ **4,5k tokens** (+169 en apps/merchant). Piso «siguiendo el flujo» ≈
  4,5k + 57,7k (INDEX) + 5,5k (estado) ≈ **68k tokens antes de leer una linea de codigo**. Eso ya es ~68% del techo de
  100k que el propio hook `context-budget.sh` usa para pedir handoff.
- El INDEX incumple su propia regla (ADR 0071: «filas de 3 lineas»): es el archivo mas caro del arranque.
- CLAUDE.md esta pegado al limite de 200 lineas que el mismo repo se impuso; gran parte es regla-con-historia
  (casos, fechas) que su propia politica dice mudar a `LECCIONES.md`.
- Dato desactualizado en CLAUDE.md: dice «Las 105 suites `.neon.integration`»; hoy hay **168** (ver §5).

### Gaps
- No pude medir el system prompt de Claude Code ni las definiciones de tools/MCP (Neon, Vercel, Notion, etc.) que
  tambien se cargan; con varios MCP conectados probablemente pesan mas que CLAUDE.md, pero no lo medi.

## 2. Hooks: eventos, que enforzan y costo

### Takeaway
13 scripts en `.claude/hooks/`, 11 cableados en `settings.json` (+1 llamado desde `verify.sh`). El costoso es el
**Stop `verify.sh`, que corre `typecheck + lint + test` (unit de toda la raiz) al final de CADA turno**, incluso
turnos que no tocaron codigo, y bloquea (exit 2) si algo falla. Ademas 4 hooks PostToolUse en cada Write/Edit y 1
PreToolUse en cada Bash.

### Cited Findings
Cableado en `.claude/settings.json`:
- **Stop** (cada fin de turno, en serie dentro del array):
  1. `verify.sh` (86 l) — primero corre `stale-validator.sh` (borra `apps/merchant/.next/types/validator.ts` si quedo
     apuntando a una ruta borrada), carga Node de `.node-version` via nvm, y corre `npm run typecheck` (turbo),
     `npm run lint` (`eslint .`), `npm run test` (`vitest run` de raiz). Si falla cualquiera: exit 2 «No podes terminar
     el turno todavia». No mira si el turno toco codigo. — [.claude/hooks/verify.sh](.claude/hooks/verify.sh)
  2. `tasks-fresh.sh` (72 l) — bloquea si se toco codigo y `docs/estado/claude.md` quedo viejo.
  3. `no-mutations-left.sh` (46 l) — bloquea si queda un `MUTATION` en el codigo.
  4. `state-uncommitted-lie.sh` (51 l) — bloquea si el ESTADO dice «SIN COMMITEAR» con el arbol limpio.
  5. `claude-md-size.sh` (45 l) — bloquea si CLAUDE.md > 200 lineas.
- **PostToolUse, matcher `Write|Edit`** (cada edicion): `no-control-bytes.sh` (68 l, bytes de control crudos),
  `invisible-test.sh` (34 l, `*.test.tsx` que vitest no corre), `file-size.sh` (32 l, aviso >300 lineas),
  `format-on-write.sh` (82 l, `prettier --write` del archivo; siempre exit 0).
- **PreToolUse, matcher `Bash`** (cada comando Bash): `foreign-staged.sh` (71 l) — bloquea `git commit` si el index
  tiene archivos staged ajenos (caso: GPT y Claude en el mismo arbol).
- **UserPromptSubmit**: `context-budget.sh` (63 l) — lee el transcript y avisa si el contexto pasa **100.000 tokens**
  (`CONTEXT_WARN`), pidiendo handoff; no bloquea.
- **PreCompact**: `pre-compact.sh` (46 l) — avisa si el estado no esta al dia; no bloquea.
- Permisos: allow solo `npm run typecheck/lint/test/build`, `git status/log/diff/show/branch`, `ls`; deny `sudo`,
  `rm -rf`, force-push, `Read(**/.env*)`, `~/.ssh`. Los gates reales usan `pnpm`, que no esta en el allow. — [.claude/settings.json](.claude/settings.json)
- Costo de los gates del Stop hook, medido por el repo: ADR 0071 (2026-09-17): typecheck --force 2,1 s, lint ~3 s,
  test 1027 casos 15 s; ADR 0113 (2026-10-02): typecheck con cache ~10 s, unit 2272 tests/238 archivos 34 s.
  Evidencia de sesion (orquestador): unit ~39 s. — [docs/adr/0071-...](docs/adr/0071-el-proceso-se-recorta-spec-chica-y-un-solo-ciclo-de-revision.md), [docs/adr/0113-...](docs/adr/0113-los-gates-corren-segun-lo-que-cambio.md)

### Inferences
- Con esos numeros, el Stop hook cuesta del orden de **~45-55 s por fin de turno** (typecheck ~10 + lint ~3 + unit
  ~34-39), en cada turno del orquestador y de cada subagente que termine, aunque solo se haya editado un `.md`.
  Es la misma suite unit que `pnpm verify` vuelve a correr.
- El Stop hook usa `npm run` mientras el repo y CLAUDE.md dicen pnpm; y el allow-list esta escrito para `npm`.

### Gaps
- **No corri `verify.sh`**: no es read-only (`stale-validator.sh` puede borrar un archivo generado en `.next/`, y
  turbo/vitest escriben cache). El tiempo de arriba es inferido de los numeros medidos por el repo y del orquestador.

## 3. Skills y agentes

### Takeaway
4 skills (≈18k tokens en total, cargadas on demand) y 2 agentes. **Ambos agentes mandan protocolo de mutaciones,
`pnpm verify`, leer CLAUDE.md, y cargar `protocolo-de-verificacion` (5,4k tok)**; el implementador ademas manda leer
`docs/TASKS.md` (≈163k tok) y anotar la bitacora de mutaciones ahi. El revisor exige por defecto **4 mutaciones**.

### Cited Findings
- Skills: `gotchas-del-repo` 484 l ≈ **10.644 tok**; `protocolo-de-verificacion` 321 l ≈ **5.425 tok**;
  `qa-cupones-prueba` 78 l ≈ 1.093 tok (temporal, toca PROD por MCP); `handoff` 46 l ≈ 769 tok. — `.claude/skills/`
- `implementador.md` 102 l ≈ 1.230 tok. «Antes de tocar un archivo»: 1) leer la spec entera y sus ADRs; 2) «Leé
  `docs/TASKS.md` (es el estado real) y `CLAUDE.md`»; 3) cargar `protocolo-de-verificacion` (y `gotchas-del-repo` si
  toca SQL/Stripe/Neon/Vercel/auth/wallet/imagenes); 4) nvm. Protocolo de mutaciones de 6 pasos (git status, shasum,
  fila de bitacora en `docs/TASKS.md` ANTES de medir, etiqueta `MUTATION`, medir, revertir con diff). Gate final:
  `pnpm verify`. — [.claude/agents/implementador.md](.claude/agents/implementador.md)
- `revisor.md` 92 l ≈ 1.380 tok. Primera linea del informe = presupuesto; si el encargo no lo dice, **por defecto 4
  mutaciones, clase «plausible»**; correr `pnpm verify` por su cuenta; mutar ademas los docblocks normativos del codigo
  nuevo; condicion de corte «dos vueltas seguidas con el fix abriendo la siguiente». — [.claude/agents/revisor.md](.claude/agents/revisor.md)
- El revisor atribuye la regla del presupuesto al «ADR 0062», pero `docs/adr/0062-...` trata de otra cosa (pinnear por
  valor exacto lo que cruza al cliente). Referencia cruzada erronea. — [docs/adr/0062-...](docs/adr/0062-lo-que-cruza-al-cliente-se-pinnea-por-valor-exacto-y-en-una-sola-lectura.md)
- Ninguno de los dos agentes manda Neon completo explicitamente: lo decide `pnpm verify` segun los archivos (§5).

### Inferences
- Costo minimo de arranque de un implementador obediente: spec (mediana 190 lineas; la 0148 son 466 l/4.694 palabras
  en dos archivos) + CLAUDE.md 3,6k + protocolo 5,4k + (gotchas 10,6k) + TASKS.md 163k (que no entra en un Read de 2000
  lineas: son 7.709). Eso ayuda a explicar los ~446k tokens del implementador de la 0148.
- Implementador y revisor duplican el protocolo de mutaciones y la corrida de `pnpm verify`; el revisor no reusa la tabla
  del implementador.

### Gaps
- No medi cuantas veces cada skill se carga realmente por sesion (requiere transcripts).

## 4. Proceso obligatorio para CUALQUIER cambio, y si hay via rapida

### Takeaway
**No hay via rapida documentada.** Todo cambio de codigo requiere: spec `cerrada` (aunque sea la plantilla chica de
80 lineas con tabla de mutaciones), fila de INDEX en el mismo commit, ADR si hay decision, UN implementador + UN revisor
independiente, `pnpm verify`, y despues un segundo commit con el ESTADO. Un grep de «sin spec / trivial / hotfix /
fast path / cambio chico» en CLAUDE.md, AGENT-WORKFLOW, plantillas, ADR 0069/0071, `.claude/` y TRABAJO-EN-PARALELO
no encontro ninguna excepcion (solo la mencion historica en ADR 0071 de que «un cambio chico costo cerca de una hora»).

### Cited Findings
- CLAUDE.md flujo: (1) leer estado + `pnpm ci:status`; (2) «Ninguna tarea toca codigo sin su spec cerrada»; (3) toda
  decision de diseño genera ADR; (4) fila de INDEX en el mismo commit; (5) actualizar estado DESPUES del commit
  («son dos commits»); (6) `hecho` solo con verificacion real; (7) UN implementador + UN revisor por spec. — [CLAUDE.md](CLAUDE.md)
- `docs/AGENT-WORKFLOW.md` (79 l): «Secuencia obligatoria» conversacion → ADR → spec borrador → cerrada → orquestador →
  implementador → revisor PASS/FAIL → orquestador actualiza spec/indice/tareas. El orquestador debe leer INDEX, TASKS,
  ARCHITECTURE, spec, ADRs. — [docs/AGENT-WORKFLOW.md](docs/AGENT-WORKFLOW.md)
- `TEMPLATE-CHICA.md` (80 l ≈ 672 tok) aplica si: un dominio, sin migraciones, sin decision de producto. Igual exige
  Diseño con «todos los codigos de error», tabla de mutaciones con presupuesto, `pnpm verify` y revisor. `TEMPLATE.md`
  123 l ≈ 1.119 tok. — [docs/specs/TEMPLATE-CHICA.md](docs/specs/TEMPLATE-CHICA.md)
- ADR 0071 (2026-09-17): el owner pregunto por que `GET /api/staff` costo ~1 h. Medido: impl 18 min/71 tools/179k,
  revisor 9 min/40 tools/106k, impl cerrando FAIL 8 min/18/208k; gates <1 min por ronda («los comandos NO son el
  cuello»; «el tiempo se va en texto generado y contexto re-leido: 493k tokens»). Recorte: plantilla chica, un ciclo,
  filas de INDEX de 3 lineas. Re-medicion con la 0069: impl 29,1 min/141 tools/316k + revisor 11,2 min/59/183k; la
  plantilla chica «sigue sin estrenarse». — [docs/adr/0071-...](docs/adr/0071-el-proceso-se-recorta-spec-chica-y-un-solo-ciclo-de-revision.md)
- ADR 0113 (2026-10-02): `pnpm verify` decide gates por diff; owner: «no podemos estar esperando 20 minutos solo de test
  cuando código lleva 3-5 minutos». — [docs/adr/0113-...](docs/adr/0113-los-gates-corren-segun-lo-que-cambio.md)
- Volumen documental: 170 archivos en `docs/specs`, 115 en `docs/adr`. Ultimos 300 commits (2026-09-28 → 2026-10-04,
  6 dias): **196 (65%) empiezan con `docs`**, 46 son `docs…: estado`. Desde 2026-09-27: 438 commits, 93 `docs: estado`.
  (Medido con `git log --oneline | grep -ciE`.)
- Excepciones de facto: la 0149 y la 0150 cerraron sin revisor «por decision del owner» (estado/claude.md). — [docs/estado/claude.md](docs/estado/claude.md)

### Inferences
- El proceso escala igual para un boton que para una migracion: la unica palanca de tamaño es la plantilla, y aun la
  chica arrastra mutaciones + revisor + dos commits de docs. El owner ya esta saltando pasos ad hoc (0149, 0150) en vez
  de existir una via rapida formal.
- Dos de cada tres commits son de documentacion/estado: el costo del arnes se ve en el historial.

### Gaps
- No hay metrica de cuantos de esos commits `docs` son overhead vs. documentacion de producto real.

## 5. Costo de los gates de test

### Takeaway
`pnpm verify` siempre corre typecheck/lint/format/unit/build; e2e si se toco UI; Neon selectivo por grafo de imports,
**pero Neon COMPLETO (~380 s medido por el orquestador; ~20 min segun ADR 0113) ante cualquier cambio en
`packages/db/**`, `.sql`, `package.json` (cualquiera), lockfile, configs de vitest/drizzle o `tools/neon-test.sh`**.
`neon-test.sh` **migra la rama de CI en cada invocacion** (y en modo related se invoca una vez por app → hasta 2
migraciones). El pre-push de `main` vuelve a correr `pnpm verify` entero.

### Cited Findings
- `tools/verify.ts` (286 l): base = cambios contra `origin/main` (commits + arbol + sin seguimiento). Solo-docs
  (`docs/**` o `.md` de raiz) → solo `format:check`. `isFullTrigger`: `packages/db/`, `*.sql`, `drizzle.config.*`,
  `vitest.config.*`, `vitest.workspace.*`, **cualquier `package.json`**, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `tools/neon-test.sh` → Neon full **y e2e**. `isE2eTrigger`: `apps/*/src/app/**` fuera de `app/api/`, `*.css`,
  `apps/*/public/`, `tests/e2e/`, `playwright.config.*`. Neon related si se toca `apps/{merchant,consumer}/src/**.ts(x)`
  o `packages/domain/`. No corta en el primer rojo. — [tools/verify.ts](tools/verify.ts)
- `tools/neon-test.sh` (97 l): valida credenciales e interlock contra PROD, luego **siempre** `pnpm db:migrate` contra la
  rama de CI («correrlo siempre es idempotente»), despues `vitest related`/`vitest run`/`pnpm run test`. — [tools/neon-test.sh](tools/neon-test.sh)
- `.githooks/pre-push` (42 l, instalado: `core.hooksPath=.githooks`): solo en push a `main`, corre
  `node tools/check-numbers.ts` + `pnpm verify`. — [.githooks/pre-push](.githooks/pre-push)
- Conteo (`find` excluyendo node_modules/.pnpm-store/.next): **419 archivos `*.test.ts(x)`**, de ellos **168
  `.neon.integration.test.ts`** (159 merchant, 9 consumer); **26 specs e2e** en `tests/e2e`. ADR 0113 contaba 153 Neon y
  2272 tests unit/238 archivos el 2026-10-02.
- ADR 0113 medido: typecheck ~10 s, unit 34 s, build 7 s, e2e 35 s, Neon 153 suites ~20 min.
- Evidencia de sesion (orquestador): `pnpm verify` Neon full ~380 s, e2e ~36 s, build ~21 s, unit ~39 s; una suite Neon
  de 3 tests ~29 s mas el migrate.

### Inferences
- Un cambio chico de servidor = unit (~39 s) + typecheck/lint/format/build (~35 s) + Neon related (migrate + N suites
  a ~10-30 s c/u) ≈ 2-4 min por corrida; se corre en implementador, revisor, Stop hooks parciales y pre-push.
- Como la base es `origin/main` y `motor` acumula commits sin pushear, un `package.json` tocado dias atras mantiene el
  Neon full en todas las corridas hasta el push.
- Las suites unit se pagan dos veces por turno de cierre (Stop hook + `pnpm verify`).

### Gaps
- No corri `pnpm verify` ni Neon (escriben caches / tocan la rama de CI); los tiempos son los del repo y del orquestador.

## 6. Evidencia de sesion (dada por el orquestador, incluida tal cual)

### Takeaway
Implementar una spec mediana cuesta ~1 h y ~640k tokens entre implementador y revisor; una spec chica (3 botones +
una ruta API) no termino en 7 min.

### Cited Findings
- Spec 0148: implementador **56 min, 195 tool uses, ~446k tokens**; revisor **20 min, ~191k tokens**. — evidencia del orquestador
- Spec 0150 (3 botones de login + ruta API chica): implementador **~7+ min** antes de ser cortado. — evidencia del orquestador
- `pnpm verify`: Neon full ~380 s, e2e ~36 s, build ~21 s, unit ~39 s; suite Neon de 3 tests ~29 s + migrate. — evidencia del orquestador
- Comparar con ADR 0071: «una ronda entera de gates es menos de 1 minuto» (2026-09-17); hoy Neon full sola son ~6 min.

### Inferences
- Los numeros de la 0148 (56+20 min, ~637k tokens) estan por encima de la 0069 que ADR 0071 tomo como piso de «arco»
  (40 min, 498k): el recorte de 0071 no se sostuvo.

### Gaps
- Sin desglose de en que se fueron los 195 tool uses (lectura de docs vs. codigo vs. gates).

## 7. Reparto de zonas Claude / GPT

### Takeaway
Claude es dueño de API, servidor, paquetes/migraciones y tooling; GPT de pantallas, estilos y e2e. Los dos pushean a
`main` sin PR, con el mismo pre-push.

### Cited Findings
- Tabla de zonas: GPT → `apps/*/src/app/**` fuera de `app/api/**`, `**/*.css`, `apps/*/public/**`, `tests/e2e/**`,
  `playwright.config.*`. Claude → `apps/*/src/app/api/**`, `apps/*/src/server/**`, `packages/**`, `**/drizzle/**`,
  `tools/**`, `.githooks/**`, `.claude/**`, `.github/**`. Frontera = contrato HTTP escrito (ADR 0070). «Sin ramas de
  feature ni PR. Commits chicos, push en el dia.» — [docs/TRABAJO-EN-PARALELO.md](docs/TRABAJO-EN-PARALELO.md)
- CLAUDE.md: «El arco del alta (ADR 0070) entrega API y endpoints, NO interfaz». — [CLAUDE.md](CLAUDE.md)
- La 0150 metio botones en el login (zona GPT) «por decision del owner». — [docs/estado/claude.md](docs/estado/claude.md)

### Inferences
- Como los e2e son zona GPT pero los dispara cualquier cambio que toque `package.json`/db (Neon full implica e2e), Claude
  paga los e2e de la zona ajena en cambios de infraestructura.

### Gaps
- Ninguno relevante.
