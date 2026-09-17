# CLAUDE.md

> Instalado por GlaDOS (plantilla del arnes v1). Es tuyo: editalo con el uso —
> cada error observado del agente deberia volverse una linea aca o un hook (mistake→rule).

Directrices del proyecto. Se cargan siempre y cuestan tokens en cada request — aca va
solo lo que cambia una decision. Lo derivable del codigo no va: leelo del arbol.

- **`docs/INDEX.md`** — mapa de ADRs y specs. **Empeza aca**, no leas todo.
- **`docs/TASKS.md`** — estado actual. El punto de retorno si esta sesion se cae.
- `.claude/settings.json` — lo que esta enforced (hooks + permisos).
- **`docs/LECCIONES.md`** — el registro historico de `mistake→rule`, con el caso de cada regla.
- **`docs/PARQUEADO.md`** — lo diferido/parado. `TASKS.md` es solo lo que esta en ejecucion.

**Donde va cada cosa (spec 0066 / ADR 0069), para que este archivo no vuelva a crecer:** regla
operativa corta que cambia una decision en **toda** sesion → aca; chequeable con un comando →
**hook**; protocolo de verificacion o gotcha de un dominio → **skill** en `.claude/skills/`
(se carga on demand, cuesta cero cuando no aplica); el caso completo con su fecha y su evidencia
→ `docs/LECCIONES.md`. **Nunca se referencia `LECCIONES.md` con `@`**: un import `@` se carga
como si estuviera pegado aca y no ahorraria un solo token.

## Flujo de trabajo

1. **Leer `docs/TASKS.md` antes de empezar.** Es el estado real, no lo que diga el chat.
2. **Ninguna tarea toca codigo sin su spec cerrada** (`docs/specs/`). La subespecificacion
   es el gatillo medido del exito fingido: en tareas resolubles y bien definidas el reward
   hacking cae a 0%; en tareas vagas, ~50%. **Que plantilla (ADR 0071):** `TEMPLATE-CHICA.md`
   (~60 lineas) si valen las tres —**un dominio, sin migraciones, sin decision de producto
   abierta**—; `TEMPLATE.md` si falta alguna. **Y las decisiones del owner se piden ANTES de
   escribir la prosa**: una spec escrita dos veces porque el alcance cambio despues es el
   costo que el 0071 vino a cortar.
3. **Toda decision de diseño genera un ADR** (`docs/adr/`) con fecha y `resumen` de una
   linea en el frontmatter. El resumen es lo que se lee sin abrir el archivo.
4. **Agregar la fila a `docs/INDEX.md` en el mismo commit**, de **3 lineas**: que es, por
   que importa, estado (ADR 0071). El detalle vive en la spec, que es lo que la fila enlaza.
   Un indice viejo es peor que ninguno; uno de 2.000 palabras por fila se paga en cada sesion.
5. **Actualizar `docs/TASKS.md` al terminar.** Hay un hook `Stop` que lo exige si quedo
   viejo respecto del codigo tocado.
6. **Marcar `hecho` solo con verificacion real** — test que pasa, comando corrido, cosa
   vista en pantalla. Nunca "deberia andar".
7. **Implementar con el protocolo de `docs/AGENT-WORKFLOW.md`: UN implementador para toda
   la spec y UN revisor independiente al final** (ADR 0071), no un ciclo por paso. Solo un
   PASS verificable permite marcarla como implementada. **Los gates completos se corren una
   vez por spec**, no una por agente: medido, una ronda entera cuesta menos de un minuto y el
   tiempo real se va en contexto re-leido. **Lo que NO se recorta es el protocolo de
   mutaciones ni la revision independiente** — en la 0068 el revisor cazo un oraculo que no
   existia y la fuga sobrevivia a 1027 tests.

## Estado

**Lo que tiene que sobrevivir va a un archivo, no a la conversacion.** La compactacion
borra lo que vive solo en el chat; el disco se re-lee. Un plan que es un mensaje no es
un plan.

**Handoff SIEMPRE seguido de `/clear`.** El handoff baja el estado a disco pero NO libera
la ventana de contexto. Orden sagrado: handoff PRIMERO (a disco), clear DESPUES. Nunca
compact: comprime con perdida.


## Verificacion

**Ninguna afirmacion de exito vale sin una señal que el modelo no genero** — tests, typecheck,
exit code, una fila leida por SQL. La auto-revision sin oraculo es negativa neta.

**Y su espejo: una afirmacion de IMPOSIBILIDAD o de COSTO es una afirmacion como cualquier otra.**
«No se puede testear» y «costaria una migracion / una columna / un refactor grande» se verifican
igual —**intentandolo**— y ninguna de las dos se le pasa al owner ni se baja a un doc sin eso.

**Toda verificacion lleva presupuesto y condicion de corte escritos EN EL ENCARGO**, y el oraculo
que define es el QA del owner, no la suite: cuantas mutaciones y que clase de error tiene que
cazar (los plausibles). Lo que quede afuera se **declara**. Si dos vueltas seguidas terminan en
«el fix abrio la siguiente», es la señal de cortar, no mala suerte. Entre una evidencia mas y una
pantalla que el owner pueda probar, **gana la pantalla**.

**Ningun hallazgo de un subagente entra a una spec, a un ADR, al `INDEX` o a un mensaje al owner
sin que vos hayas reproducido la evidencia.** Una cita no es una verificacion: es un puntero a
donde verificar. Y el espejo: **lo que le pasas a un subagente como insumo es una afirmacion
tuya** — re-medí el doc antes de despacharlo.

**Toda mutacion se etiqueta con `MUTATION`, se le registra el `shasum` limpio ANTES de mutar, y se
revierte con un `diff` contra la copia limpia.** Enforced por el hook `no-mutations-left.sh`, que
**solo ve mutaciones etiquetadas**. Si heredas una puesta: `ListAgents` primero (puede estar
midiendo), y **medila antes de revertirla**.

**Mistake→rule:** cada error observado del agente se convierte en un fix estructural permanente.
Si se chequea con un comando es un **hook**; si es advisory, una linea aca; el caso completo va a
`docs/LECCIONES.md`. Nunca la misma correccion dos veces a mano.

**El protocolo completo —el orden exacto de una mutacion, como se prueba que un oraculo muerde y
por el motivo correcto, como se declara un limite— esta en la skill
`protocolo-de-verificacion`.** Cargala antes de encargar una revision o de escribir un plan de
pruebas. Los casos que originaron cada regla estan en `docs/LECCIONES.md`.

**Antes de pedirle QA al owner, verificar que prod tenga EL COMMIT que se va a probar** —
no que "prod este verde". **Y el `/status` NO sirve solo para eso: en este repo devuelve `success`
con la CI todavia corriendo**, porque agrega los *commit statuses* de la API vieja —donde el unico
que publica es **Vercel**— y **GitHub Actions reporta como *check runs*, que es otro endpoint**
(medido el 2026-09-17). El comando que hay que correr:
`GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/check-runs --jq '.check_runs[] |
"\(.name): \(.status) -> \(.conclusion)"'` — **todos** `completed` y `success`, para el sha exacto.

**Lo que el owner no dijo explicitamente NO se escribe como decision suya.** Un efecto lateral que
nadie acordo va como *hallazgo a decidir*, nunca como «aceptado».

**Las reglas verificables van en hooks, no aca.** Los hooks corren fuera del contexto, cuestan
cero tokens y son deterministas; este archivo es advisory.

## Codigo

- Si un archivo supera el limite de tamaño (hook `file-size`): dividir, no extender.
- **El arco del alta (ADR 0070) entrega API y endpoints, NO interfaz: la UI la construye el owner
  por fuera.** Una spec de ese arco que liste un archivo de pantalla como «crear» o «rediseñar»
  esta mal alcanzada; lo que falta en su lugar es el **contrato HTTP escrito** que consume quien
  hace la UI (forma de `specs/0055-contratos-del-orquestador.md`). Caso en `LECCIONES.md`.
- **Y su contraparte, que SI es trabajo de estas specs: la UI vieja de lo que se refactoriza se
  BORRA** (decision del owner, ADR 0070 §17) — «no dejar rastros viejos de lo que ya no usaremos».
  Borrar una pantalla deja enlaces muertos: los `redirect` de un guard apuntando a una ruta borrada
  convierten un rebote en un **404**, asi que la limpieza de referencias es parte del borrado, no
  un extra.
- No editar ni borrar tests para que el gate pase: un test rojo se arregla o se discute.
- Nada de andamiaje sin su tarea: codigo que no se usa hoy va con su fila en
  `docs/TASKS.md` que lo va a consumir, o se borra.
- **Una ruta que devuelve una entidad al navegador NUNCA serializa claves internas de R2**
  (`*ObjectKey`): devolver un DTO que las omite y expone sólo el `*Path` publico (ver
  `toClientProgram` en loyalty, `brandResponse` en marca). Blindar con un test por entidad.
  Un revisor independiente ya cazo esta fuga en marca (spec 0025); no repetirla.


## Gotchas que rompen el turno en curso

Solo los que arruinan una sesion cualquiera. **Todo el resto —drizzle y SQL crudo, Stripe y sus
webhooks, Neon, Vercel, better-auth, wallet, formatos de imagen, middleware de Next, Geoapify—
esta en la skill `gotchas-del-repo`.** Cargala antes de tocar esos dominios.

- **Gates: Node 24 + scripts de ROOT.** El shell del agente arranca en Node 22 (es el Node del
  harness, que se antepone en el `PATH`) y el repo pide 24: correr
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` (**sin argumento**: hay `.nvmrc`)
  antes de cualquier gate. `lint`, `test`, `format:check` y `build` son scripts de **root**
  (`pnpm run <script>`), NO del paquete. Para un archivo suelto:
  `pnpm --filter @mi-pasaporte/merchant exec vitest run <path>`. El Stop hook
  (`.claude/hooks/verify.sh`) corre typecheck+lint+test de root.
- **El shell del agente es ZSH, y zsh NO separa en palabras una variable sin comillas.**
  `FILES="a b c"; cmd $FILES` pasa UN argumento con espacios, y `for f in $FILES` itera UNA vez.
  Usar arrays (`FILES=(a b c); cmd "${FILES[@]}"`) o `${=FILES}`, y **leer la salida** del comando:
  asi es como un gate «pasa» sin haber mirado nada.
- **`pnpm install`/`pnpm add` fallan por DNS bajo sandbox.** El store vive dentro del repo
  (`.pnpm-store`, via `pnpm-workspace.yaml` — **no** `.npmrc`), asi que `pnpm install --offline`
  alcanza. **No corras `pnpm fetch` salvo que el lockfile haya cambiado en otro entorno**: purga
  `node_modules` y despues `--offline` miente con `Already up to date` dejando la raiz vacia
  (sintoma: `sh: turbo: command not found`). Fix:
  `rm -f node_modules/.modules.yaml node_modules/.pnpm-workspace-state-v1.json && pnpm install --offline`.
- **Worktrees: crealos con `tools/worktree-new.sh <nombre>`**, que instala un `node_modules` propio
  offline. Un worktree con `node_modules` symlinkeado al repo real es una trampa: `pnpm run` y
  `pnpm exec` adentro disparan un `pnpm install` que **intenta purgar las dependencias posta**.
- **`git push` falla con «Invalid username or token» aunque `gh` este logueado**: hay un `GH_TOKEN`
  invalido en el entorno. `export GH_TOKEN=; gh auth switch --hostname github.com --user maxhost`
  y despues `GH_TOKEN= git -c credential.helper='!gh auth git-credential' push origin main` — el
  `GH_TOKEN=` inline va en el MISMO comando (cada Bash es un shell nuevo).
