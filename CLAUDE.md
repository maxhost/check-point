# CLAUDE.md

> Plantilla del arnes GlaDOS, editada con el uso: cada error observado del agente se vuelve una linea
> aca, un hook o una skill (mistake→rule). Se carga en CADA request: solo lo que cambia una decision.

- **`docs/estado/claude.md`** — TU estado: leé solo su bloque `⇥ ESTADO` de arriba. Es el punto de retorno.
- **`docs/INDEX.md`** (ADRs y specs) y `docs/TASKS.md`: **buscalos con `rg`, no los leas enteros.**
- `.claude/settings.json` (hooks + permisos), `docs/PARQUEADO.md` (lo diferido), `docs/LECCIONES.md`
  (el caso de cada regla; no se lee al arrancar), `docs/TRABAJO-EN-PARALELO.md` (GPT sobre `main`, ADR 0114).

**Donde va cada cosa (ADR 0069):** regla corta que cambia una decision en toda sesion → aca; chequeable con
un comando → hook; protocolo o gotcha de dominio → skill en `.claude/skills/`; caso con fecha →
`docs/LECCIONES.md`. Nunca se referencia `LECCIONES.md` ni una skill con `@`: se cargaria entero.

## Niveles (spec 0151)

| Nivel | Cuando | Como |
|---|---|---|
| **N0 directo** | el diff se describe en una oracion, sin esquema/SQL nuevo, sin auth/dinero | en la conversacion principal, sin spec ni subagentes; typecheck + lint + tests del archivo; commit |
| **N1 rebanada** | un endpoint o un cambio de servidor acotado | spec CHICA (`TEMPLATE-CHICA.md`) = contrato HTTP para GPT + su test negativo; sin subagentes; `pnpm verify`; push en el dia |
| **N2 completo** | dinero, auth/sesiones, aislamiento entre comercios, migraciones, DTOs con datos internos | spec (`TEMPLATE.md`), UN implementador, UN revisor (correctitud + 1–3 mutaciones sobre lineas cambiadas); `docs/AGENT-WORKFLOW.md` |

Si dudas entre dos niveles, el mas alto. Una feature grande se parte en rebanadas N1 pusheables solas.
Subagentes (`implementador`, `revisor`) **solo en N2**. Las decisiones del owner se piden ANTES de
escribir la spec: una spec escrita dos veces porque el alcance cambio es el costo que esto corta.

## Flujo

1. Al arrancar: el bloque ESTADO y `pnpm ci:status`. Si el ultimo `main` esta rojo, se arregla primero.
2. Toda decision de diseño genera un ADR (`docs/adr/`) con fecha y `resumen` de una linea en el frontmatter.
3. Fila de 3 lineas en `docs/INDEX.md` (que es, por que importa, estado) en el mismo commit.
4. Estado: en N1/N2 el bloque ESTADO se reescribe DESPUES del commit del trabajo (dos commits: el trabajo
   y el doc con su sha) y describe, no pronostica (hook `state-uncommitted-lie.sh`). En N0, al cerrar la sesion.
   El bloque anterior se MUEVE a `claude-historico.md`, nunca se pisa (tambien fuera de un handoff).
5. `hecho` solo con verificacion real: test que pasa, comando corrido, cosa vista en pantalla.

## Estado

**Lo que tiene que sobrevivir va a un archivo, no a la conversacion**: la compactacion borra el chat, el
disco se re-lee. **Handoff SIEMPRE seguido de `/clear`**: handoff primero (a disco), clear despues.
**Nunca compact**: comprime con perdida.

## Verificacion

- **Ninguna afirmacion de exito vale sin una señal que el modelo no genero** — test, typecheck, exit code,
  una fila leida por SQL. **Y su espejo:** «no se puede testear» o «costaria una migracion» se verifican
  **intentandolo**, antes de pasarselo al owner o a un doc.
- **Ningun hallazgo de un subagente entra a una spec, ADR, `INDEX` o mensaje al owner sin reproducir su
  evidencia** — tambien si viene de un revisor con PASS. Lo que le pasas como insumo es afirmacion tuya: re-medilo.
- Mutaciones, tablas de mutacion, presupuesto y corte, mecanismos «medidos»: skill
  **`protocolo-de-verificacion`** — cargala antes de encargar una revision o escribir un plan de pruebas.
- **No esperar la CI de GitHub** (owner, 2026-09-23): gates locales antes de pushear, sin sondear despues.
  Antes de pedir QA al owner, el deploy de Vercel de `checkpass.club` tiene que estar `READY` con ese sha.
- **Lo que el owner no dijo no se escribe como decision suya** (va como *hallazgo a decidir*). **Lo que ya
  dijo no se le vuelve a preguntar**: buscar sus palabras en `TASKS.md`/`PARQUEADO.md` y en el ADR, que
  manda sobre un docblock.
- **De un `.env` se imprime la CLAVE y metadatos** (largo, huella `sha256[0..12]`), **nunca el valor ni un
  prefijo**; filtrar por nombre de variable no alcanza.

## Codigo

- Zonas (ADR 0114): GPT hace pantallas, estilos y e2e; Claude API, servidor, paquetes y tooling. La frontera
  es el contrato HTTP escrito.
- La UI vieja de lo que se refactoriza se BORRA (ADR 0070 §17), con sus referencias: un `redirect` a una
  ruta borrada es un 404.
- No editar ni borrar tests para que el gate pase: un test rojo se arregla o se discute.
- Nada de andamiaje: codigo sin uso hoy va con su fila en `docs/TASKS.md` o se borra.
- Una ruta que devuelve una entidad al navegador NUNCA serializa claves de R2 (`*ObjectKey`): DTO con el
  `*Path` publico (`toClientProgram`, `brandResponse`) y un test por entidad.

## Gotchas

El resto (`pnpm verify`, suites Neon, scripts de root, zsh, `pnpm install` offline, worktrees, `git push`
con `GH_TOKEN`, drizzle, Stripe, Vercel, auth, wallet, imagenes) esta en la skill **`gotchas-del-repo`**.

- **Node 24:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` (sin argumento) antes de
  cualquier gate: el shell del agente arranca en 22.
- **Suites Neon: `tools/neon-test.sh [archivo]`. Nunca contra `DATABASE_URL`: es `main`, o sea PROD.**
