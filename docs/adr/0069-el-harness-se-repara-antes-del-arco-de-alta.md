---
adr: 0069
fecha: 2026-09-16
estado: aceptada (decision del OWNER, 2026-09-16)
resumen: El cuello de botella medido de este repo no es escribir codigo: son 61 KB de `CLAUDE.md` cargados en CADA request, un `docs/TASKS.md` de 712 KB que nadie relee entero (y que ya mintio dos veces en su cabecera), la ausencia de `.claude/agents/` —que obliga a reescribir el protocolo de mutaciones a mano en cada encargo, y basta un renglon olvidado para que aparezca una mutacion abandonada— y worktrees inutilizables porque `pnpm run` intenta purgar el `node_modules` symlinkeado. La cola de revisiones de la spec 0065 lo cuantifica: cuatro revisores, 14 hallazgos, **UNO** cambio codigo de produccion. Decision del owner: **el harness se repara ANTES de empezar el arco del wizard**, en este orden — (1) podar `CLAUDE.md` a <=200 lineas y sacar de `TASKS.md` todo lo que no este en ejecucion, (2) definir subagentes con el protocolo y el presupuesto de verificacion adentro, (3) hacer los worktrees usables de verdad. Recien despues se paraleliza por slice vertical y se escribe el oraculo antes que el codigo.
---

# 0069 — El harness se repara antes del arco de alta

## Contexto

Al abrir la etapa de re-pensar el producto, el owner pregunto algo que no era sobre el
producto: **«Hoy siento que nos toma un monton de tiempo implementar cualquier cosa»**, y
pidio investigar como desarrollar mas rapido con Claude Code sin perder calidad ni
production grade.

La respuesta generica —worktrees, subagentes, paralelismo— no aplicaba sin medir primero
este arbol. Lo medido el 2026-09-16:

| Que | Cuanto | Por que importa |
|---|---|---|
| `CLAUDE.md` | **696 lineas / 61 KB** | se carga entero en **cada** request |
| `docs/TASKS.md` | **7.197 lineas / 712 KB** | es «el punto de retorno», y su cabecera ya mintio dos veces |
| `.claude/agents/` | **no existe** | cada encargo reescribe el protocolo a mano |
| `docs/` en la raiz | ~10 archivos de encargos y revisiones de fases ya cerradas | mezclados con los documentos vivos |
| hooks | 10, funcionando | esto **si** esta bien y no se toca |

Y el dato que cierra el diagnostico, de este mismo `docs/TASKS.md`: la cola de revisiones
independientes de la spec 0065 corrio **cuatro revisores** sobre cuatro fases, produjo
**14 hallazgos** y **uno solo cambio codigo de produccion**. Los otros trece eran oraculos
que faltaban y comentarios que mentian — trabajo real, pero no riesgo de produccion.

Sumado a lo que este mismo `CLAUDE.md` ya registra: la spec 0064 se comio una sesion
entera; 14 mutaciones donde las primeras 4 dieron todo el valor; seis vueltas de oraculo en
la 0063 con una septima empezada; cinco agentes cortados a la mitad.

**El patron es uno solo: la verificacion no tiene condicion de corte por defecto, y cada
sesion arrastra un costo fijo de contexto enorme.**

## La confirmacion externa

La documentacion oficial de Claude Code nombra las dos cosas como patrones de falla, no
como matices:

> *«Bloated CLAUDE.md files cause Claude to ignore your actual instructions»* — y como
> failure pattern explicito: *«The over-specified CLAUDE.md. If your CLAUDE.md is too long,
> Claude ignores half of it because important rules get lost in the noise.»*

> *«A reviewer prompted to find gaps will usually report some, even when the work is sound,
> because that is what it was asked to do. Chasing every finding leads to over-engineering.»*

El segundo parrafo es, palabra por palabra, el **ADR 0062** de este repo. O sea: la leccion
ya estaba aprendida a los golpes y escrita; lo que faltaba es que se aplicara **sin depender
de que alguien se acuerde**.

La misma documentacion da la salida: lo que solo hace falta a veces **no va en `CLAUDE.md`,
va en una skill** que se carga on demand; lo verificable va en un hook; y lo repetido en
cada encargo va en un subagente definido en `.claude/agents/`.

## Decision

**El harness se repara antes de escribir una linea del arco de alta.** Textual del owner:
«antes de empezar con el trabajo del nuevo wizard y onboarding repararemos esto».

Tres frentes, en este orden, y los tres los implementa la **spec 0066**:

### 1. Podar el contexto permanente

- **`CLAUDE.md` <= 200 lineas.** Decision del owner: *«no deberia haber crecido mas alla de
  200 lineas. El resto deberia ir en archivos referenciados, pero no directo en
  `CLAUDE.md`»*. Queda solo lo que cambia una decision en **toda** sesion.
- **Nada se borra: se muda.** Las lecciones largas van a skills (`.claude/skills/`), que
  Claude carga cuando son relevantes y no cuestan tokens cuando no lo son, y el registro
  historico completo a `docs/LECCIONES.md`.
- **`docs/TASKS.md` solo contiene lo que esta en ejecucion.** Textual del owner: *«si algo
  se parqueo, se paro, se defirio deberia ir a otra carpeta/documento donde se referencia y
  se puedan encontrar los pendientes, pero en TASKS.md solo vive lo que se esta por
  trabajar»*.

### 2. Subagentes definidos, con el presupuesto adentro

`.claude/agents/` con el protocolo de este repo escrito una vez: mutacion etiquetada,
`shasum` **antes** de mutar, fila de bitacora abierta **antes** de medir, `git status` por
si el archivo es untracked. Y —lo que hoy se olvida mas seguido— **el presupuesto y la
condicion de corte como parte del encargo, no como advertencia**: cuantas mutaciones y que
clase de error tiene que cazar.

Esto ataca la causa exacta del ADR 0062 y de la regla del 2026-09-13: *el que tiene que
poner el corte es el que ENCARGA*. Si el corte vive en la definicion del agente, deja de
depender de que el orquestador se acuerde de escribirlo.

### 3. Worktrees usables de verdad

Hoy los worktrees estan documentados como trampa: `pnpm run` y `pnpm exec` adentro de uno
disparan `runDepsStatusCheck` → `pnpm install` → **intenta purgar el `node_modules`
symlinkeado**, que son las dependencias reales. Ya paso dos veces (spec 0053).

La salida esta a mano y no se habia visto: **el store de pnpm ya vive dentro del repo**
(`.pnpm-store`, spec 0035), asi que cada worktree puede tener su propio `node_modules`
instalado **100% offline**, sin red y sin tocar el del repo principal.

Esto no es solo comodidad. Es lo que hace que **la muerte de un agente deje de contaminar
el arbol principal** — hoy una mutacion abandonada es indistinguible de un bug real y
obliga a auditar el arbol entero antes de seguir.

## Consecuencias

**Lo que se gana:** menos tokens fijos por sesion y reglas que no se pierden en el ruido;
encargos que no se reescriben ni se olvidan a medias; y aislamiento real, que es el
precio de entrada para cualquier paralelismo.

**Lo que recien despues se habilita** (y por eso no entra en la spec 0066):

- **Paralelizar por slice vertical, no por capa.** La idea de «un agente escribe los tests
  mientras otro sigue con la proxima feature» se descarta: el test y el codigo de la misma
  feature tocan los mismos archivos y el mismo entendimiento, y separarlos obliga a
  reconstruir contexto — que este repo ya midio como carisimo («reanudar sale mas caro que
  terminarlo a mano»). Lo que si escala es **otra slice**, y el techo es **2-3**: arriba de
  eso el cuello de botella es la revision humana.
- **El oraculo primero.** Un agente escribe el test que muerde, otro escribe el codigo que
  lo pone verde. Encaja con la regla de la casa —el oraculo antes que la afirmacion— y le
  da al implementador un rojo concreto que perseguir en vez de un «terminé» que es opinion.

**El riesgo declarado:** podar `CLAUDE.md` puede perder una leccion que hoy evita un error.
Se mitiga porque **nada se borra, todo se muda**, y porque la spec 0066 exige demostrar por
script que ninguna linea desaparecio. Pero queda dicho: es un riesgo real, no cero.

**Lo que NO se toca:** los 10 hooks. Son la parte del harness que funciona, corren fuera del
contexto y cuestan cero tokens. La poda de `CLAUDE.md` es, en parte, mover reglas **hacia**
ellos.
