# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook
`Stop` que bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido,
cosa vista en pantalla. No "deberia andar". El auto-reporte no es evidencia.

Ultima actualizacion: 2026-09-02 (**SPEC 0040 IMPLEMENTADA con PASS de revisor independiente. Codigo SIN COMMITEAR
en el arbol, esperando OK del owner. PROXIMO PASO: QA en vivo con telefono real + commit.**

**Que se logro:** cropper 1:1 con drag+zoom en las 3 superficies de subida (logo de marca, sello, producto). Tests
**259 → 310**. Los 5 gates verdes. **Sin migracion** y sin secreto nuevo.

**EL PROTOCOLO DE `AGENT-WORKFLOW.md` SE CUMPLIO ENTERO Y VALIO LA PENA:** implementacion → revisor independiente
**FAIL con 5 hallazgos** → ronda de correcciones → **re-review PASS** (28 mutaciones muertas en un worktree de
`/tmp`, arbol intacto). **El FAIL no fue ceremonia** — cazo cuatro cosas reales:
1. **El fallback de decode estaba ASUMIDO, no probado.** `canDecodeImage` no tenia un solo test, y el criterio de
   la spec lo prohibia con todas las letras ("probado de verdad, forzando el fallo de decode — no asumido").
2. **El guard nuevo del `accept` era CIEGO a `accept="..."`** (el regex solo veia la forma con llaves `{...}`), asi
   que tapaba dos listas angostas mas en `demo/brand/page.tsx` y `demo/loyalty/page.tsx` — **4a y 5a aparicion** del
   mismo bug que `CLAUDE.md` ya documenta de las specs 0033 y 0039. Un guard ciego es peor que ninguno: da una
   seguridad que no tiene.
3. **Faltaba la mitad del pinneo del DoD**: revertir `use-catalog-image` a `startsWith("image/")` dejaba la suite verde.
4. **Un `isAcceptedImageType` nuevo que toleraba `file.type === ""` AFLOJO marca y sello sin ganar nada.** Se
   justificaba diciendo que si no "el server nunca llega a olfatear los bytes" — **falso, verificado**: los 3 presign
   validan contra `ACCEPTED_IMAGE_CONTENT_TYPE_SET`, que no contiene `""`, asi que ese archivo moria igual, solo que
   mas tarde y con peor mensaje. Revertido.

**DESVIO DE LA SPEC AUTORIZADO POR EL ORQUESTADOR (queda registrado, no se arreglo en silencio):** la decision 5
decia que el server distingue el camino estricto **por el presign**. Se implemento con el flag `cropped` en el
**payload de guardado**, porque el bound se aplica al GUARDAR, no al presignar → por presign habria que persistirlo
= migracion en 3 tablas que la spec no lista. El revisor auditó el modelo de confianza: **no existe input que
consiga un bound mas permisivo que los 50 MP de hoy**; los 3 validators tiran 422 con el flag no-booleano o fuera
de `replace`. `normalizeImage` quedo parametrizado: **4.2 MP** con recorte, **50 MP** en el fallback.

**Chunk diferido verificado contra manifests reales** (no de palabra): `static/chunks/1-5vd4y9_pvjp.js` (27K) aparece
solo en los 3 `react-loadable-manifest.json` y esta **ausente** de `build-manifest.json`. `react-easy-crop` se importa
en **un solo** modulo.

**RESIDUAL DEL OWNER, Y ES EL QUE IMPORTA: QA EN VIVO CON EL TELEFONO REAL** (el que produjo el bug de la 0039).
Subir una foto de galeria en **marca**, encuadrarla, verla guardada, y **registrar si aparecio el cropper o si cayo
al fallback**. Ese es el dato que decide el **ADR 0047 §4**: si el fallback se dispara, HEIC crudo llega de verdad y
se reevalua el decoder HEVC en WASM; si no, el tema queda cerrado. Ningun test local lo reproduce.

**Otro criterio NO cerrado, dicho sin maquillaje:** la mitad *cliente* del "blob cuadrado ≤2048". Lo probado es que
el pipeline del server no rompe la cuadratura (dimensiones leidas de los bytes de ambas variantes con `sharp`). Que
el `toBlob` de un navegador real PRODUZCA ese blob no es reproducible sin navegador, y **el server no valida
cuadratura a proposito** (ADR 0047 §3: el cropper es UX y ahorro de bytes, NO un control de seguridad).

**SEGUIMIENTO → SPEC PROPIA, no se arreglo aca:** un picker que reporta `contentType: ""` para una foto real **no
puede subir**. Preexistente, no regresion (los 3 presign nunca aceptaron `""`). Opciones para esa spec: deducir el
tipo por extension/bytes antes del presign.

**GOTCHA CORREGIDO (mistake→rule): `pnpm fetch` NO hacia falta.** `CLAUDE.md` decia "cuando se agreguen dependencias
nuevas, correr `pnpm fetch`". Con el store local al repo, **el propio `pnpm add` ya lo poblo** — verificado:
`.pnpm-store/v11/index.db` contiene `react-easy-crop@6.2.3` y `normalize-wheel@1.0.1`. Correr `pnpm fetch` de mas
habria PURGADO `node_modules` (y disparado el gotcha del `Already up to date` con la raiz vacia) a cambio de nada.

**Estado del repo: codigo SIN COMMITEAR** (24 modificados + 7 untracked), main verde, Node 24.20.0, 310 tests.

Ultima actualizacion previa: 2026-09-02 (**SPEC 0040 CERRADA + ADR 0047 — LISTA PARA IMPLEMENTAR. Nada de codigo
tocado todavia. PROXIMO PASO: implementarla con el protocolo de `AGENT-WORKFLOW.md`.**

**Que es:** cropper de imagen en el cliente, recuadro **1:1** con drag+zoom (touch y desktop), en las 3
superficies de subida (logo de marca, sello del programa, producto de catalogo). Ultima spec pendiente del
backlog: las otras 8 en `borrador` son specs fundacionales de agosto, material historico.

**EL HALLAZGO QUE CAMBIO EL DISEÑO (y obligo a un ADR nuevo): los navegadores NO pueden decodificar HEIC.**
Chrome, Firefox y Edge no licencian **HEVC** (esta bajo patente); Safari si, pero solo porque delega en el
decoder del SO. Un cropper NECESITA mostrar la imagen para que el usuario la encuadre — si el navegador no
puede decodificarla, no hay nada que dibujar. Y HEIC es el formato de las fotos de galeria de **Android** e
iPhone: es el caso exacto que ya costo **dos rondas de QA** (specs 0033 y 0039) y que esta en `CLAUDE.md`. Un
cropper obligatorio lo rompia por tercera vez.

**Por eso va el ADR 0047, que ENMIENDA el punto 2 del ADR 0041** (los ADR son inmutables: si la decision
cambia, va uno nuevo). El 0041 prometia que con el cropper el server volvia a un `limitInputPixels` estricto
**global**. No es alcanzable: mientras exista el fallback —y es obligatorio— por ese camino entra una foto
entera. El cropper pasa a ser **best-effort** y el estricto aplica solo al camino con recorte.

**Se evaluo y DESCARTO convertir HEIC en el browser** (fue la idea del owner, y es la salida correcta si el
costo cerrara): implica embarcar un decoder HEVC en WASM. `heic2any` 2.59 MB pero **sin publicar desde
2023-03-29**; `libheif-js` 6.1 MB y `heic-to` 23.2 MB, ambos **LGPL-3.0**. Aun diferido son 1-2 MB reales que
paga el usuario de Android justo cuando espera ver su foto, con una licencia cuya obligacion de relinkeo queda
difusa en un bundle propietario — y **sin saber todavia con que frecuencia llega HEIC crudo** (los pickers de
Android a veces entregan JPEG ya convertido). **Reapertura CONDICIONAL al QA, no agendada** (ADR 0047 §4).

**LAS 6 DECISIONES, cerradas con evidencia:**
1. **Aspecto 1:1 en las tres.** No es preferencia — lo decidio el CSS: `.brand-logo img` 56×56, `.stamp-preview
   img` 54×54 y `.catalog-image-preview` 120×120 **ya usan `object-fit: cover`**. El recorte cuadrado YA ocurre,
   a ciegas y al centro; el cropper solo se lo da al usuario. (A verificar al implementar: el logo tambien va al
   pase de Wallet y al afiche del brand kit.)
2. **`react-easy-crop` 6.2.3, UNA sola** (verificado en el registry: publicada 2026-07-24, unica dep
   `normalize-wheel`, peer react >=16.4 → ok con React 19). Se descarta el "dos librerias segun plataforma" del
   ADR 0041: la deteccion siempre falla en hibridos (notebooks tactiles).
3. **Fallback por COMPORTAMIENTO, no por user-agent:** se intenta decodificar y si falla se sube el original.
   Pregunta lo unico que importa y sigue andando el dia que un navegador agregue HEIC.
4. **Salida WebP q0.85, borde 2048** (= el `MAX_OUTPUT_EDGE` que el server ya usa). **Ojo con el alpha:** el
   respaldo es **PNG** en logo/sello (transparencia) y JPEG solo en catalogo — un PNG transparente que caiga a
   JPEG sale con fondo negro.
5. **`limitInputPixels` parametrizado:** 4.2 MP en el camino con recorte, 50 MP en el fallback. Elegir mal solo
   puede terminar en un rechazo, nunca en aceptar algo mas grande.
6. **Orden: marca → QA en telefono real → sello → catalogo.** Ese QA produce el dato que decide el ADR 0047 §4.

**DEUDA METIDA EN EL ALCANCE a pedido del owner:** el `accept` del catalogo en desktop esta hardcodeado angosto
(`"image/png,image/jpeg,image/webp"`) mientras marca y sello usan `ACCEPTED_IMAGE_ACCEPT_ATTR` — **tercera**
aparicion del mismo bug que `CLAUDE.md` ya documenta de las specs 0033 y 0039. Ademas `use-catalog-image.ts`
valida con `file.type.startsWith("image/")` en vez del set compartido, mas laxo que sus dos pares.

**OJO AL IMPLEMENTAR:**
- **Dependencia nueva** → correr **`pnpm fetch`** con red despues de agregarla, o la proxima sesion offline
  falla. Y despues de `pnpm fetch`, acordarse del gotcha del `Already up to date` con `node_modules` vacio.
- El cropper es **UX y ahorro de bytes, NO un control de seguridad**: ninguna validacion del server se relaja.
- El criterio del fallback exige **probarlo forzando el fallo de decode**, no asumirlo.

**Estado del repo:** todo pusheado, `main` verde, prod 200, Node 24.20.0, 259 tests. Sin trabajo a medias.)

Ultima actualizacion previa: 2026-09-02 (**SPEC 0049 IMPLEMENTADA: Node en 24.20.0, las 4 fases aplicadas, cada una
con su corrida de CI en `success`. Prod desplegada y sana. Punto de retorno.**

**Lo que se logro:** el repo corre la **ultima Active LTS (24.20.0)**, la version dejo de estar duplicada sin
control en 4 lugares, y la migracion a Node 26 quedo reducida a cambiar un numero. Tests **254 → 259**.

**Lo que NO se hizo, a proposito: NO se migro a Node 26** (ver ADR 0046). Es la ultima estable de Node
(26.8.1), pero **Vercel solo ofrece 24.x/22.x/20.x**: con local y CI en 26 y prod en 24, el CI dejaria de
probar lo que se despliega. Node 24 tiene soporte hasta **2028-04-30**, no hay urgencia.

**Las 4 fases, cada una un commit + una corrida verde:**
1. `72dd8cf` pin a **24.20.0** (`.node-version` + `engines >=24.20.0 <25`). Prod no cambio: Vercel ya servia
   la ultima 24.x, o sea el pin local estaba MAS VIEJO que produccion. CI: `node: v24.20.0` (verificado en el
   log de `setup-node`, no inferido).
2. `7e180d0` **`@types/node` 24.10.1 → 24.13.3** + lockfile. Era la fase con mas riesgo real (tipos nuevos
   pueden romper `typecheck` sin tocar codigo): **no paso**, typecheck 3/3 sin cache, sin bajar ningun tipo ni
   tapar nada con `any`.
3. `f90324f` **guard anti-drift** como 4º project de vitest (`tools/`), 5 chequeos. **Probado rompiendolo**:
   desincronizar `.node-version` falla; desincronizar `@types/node` de UNA app falla nombrandola
   (`expected 'apps/platform: 22' to be 'apps/platform: 24'`).
4. `b9bf954` **actions al dia** (`checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6`). El warning de Node
   20 **desaparecio de las anotaciones** (verificado con `gh run view`, que es lo que pedia el criterio — que
   el CI pase no alcanzaba).

**EL FALSO VERDE QUE SE CAZO EN LA FASE 3, y como:** el guard **no corria** y la suite daba verde igual. Causa:
**el `include` de un project de vitest se resuelve relativo al DIRECTORIO DE SU CONFIG, no a la raiz** — con
`include: ["tools/**/*.test.ts"]` en `tools/vitest.config.ts` buscaba en `tools/tools/`. Se detecto **porque el
conteo de tests no subio** (seguia en 254). Leccion general: al sumar tests, el conteo es el oraculo de que
efectivamente corren; un test que no corre pasa siempre.

**GOTCHA NUEVO, ya en `CLAUDE.md` (mistake→rule): despues de `pnpm fetch`, `pnpm install --offline` MIENTE.**
Dice `Already up to date` y deja el `node_modules` de la RAIZ vacio (sin symlinks ni `.bin`), asi que
`typecheck`/`build` fallan con **`sh: turbo: command not found`** — parece turbo roto y es un link faltante.
`--force` tampoco alcanza. Fix verificado: `rm -f node_modules/.modules.yaml
node_modules/.pnpm-workspace-state-v1.json && pnpm install --offline` (los paquetes siguen en
`node_modules/.pnpm`, o sea sigue siendo 100% offline). Paso de verdad en esta sesion al re-calentar el store
tras la Fase 2. **`.pnpm-store` quedo re-calentado y verificado**: `node_modules` reconstruido sin red y los 5
gates verdes.

**Verificacion final (salida real, Node 24.20.0):** lint, typecheck, build y format:check exit 0; test
**259 passed** / 96 skipped; e2e **5 passed / 1 skipped**. Prod: `checkpass.club/api/health` **200**, commit
status `Vercel: success`, `vercel project ls` sigue en **24.x**.

**AGENDADO — FASE 5, Node 26. Disparador de DOS condiciones, manda la segunda:**
(a) Node 26 entra en LTS el **2026-10-28** (calendario oficial) y (b) **Vercel lo ofrece** en Project Settings.
La (a) sin la (b) no habilita nada. Chequeo sin entrar al dashboard: `vercel project ls` (columna Node Version).
**Cuando se dispare:** cambiar `.node-version`, `engines`, `@types/node` y el dashboard — el guard de la Fase 3
dice cual falto. Verificar ademas **`sharp`** (binarios nativos por version de Node) y hacer un **preview
deploy** antes de promover.

**Desvio de protocolo declarado:** el owner delego las decisiones y pidio implementar directo, asi que esta
spec **NO paso por revisor independiente** como manda `AGENT-WORKFLOW.md` (la 0047 si). El oraculo fue el CI
por fase (4 corridas en `success`) mas la prueba negativa del guard. Si se quiere el PASS formal, falta esa
pasada.

**HALLAZGO REAL DEL GUARD, EN SU PRIMER USO: el Stop hook (`.claude/hooks/verify.sh`) venia corriendo los
gates en Node 22, no en el 24 que pide el repo.** El guard lo cazo apenas se instalo (`expected '22' to be
'24'`) y bloqueo el fin del turno. **No es un falso positivo ni un test mal escrito: el hook llevaba tiempo
verificando contra un runtime DISTINTO del de CI y produccion**, o sea su verde no decia nada del verde de
GitHub. Causa: el shell del hook arranca en el Node del sistema y `verify.sh` nunca hacia `nvm use` (el gotcha
de `CLAUDE.md` estaba documentado para las corridas a mano, pero el hook quedo afuera). **Fix aplicado en
`verify.sh`, no en el test** (editarlo para que pase es exactamente lo que prohibe el propio hook): carga nvm
y hace `nvm use "$(cat .node-version)"` antes de los gates. Verificado: shell nuevo sin el fix -> `v22.22.2`;
con el fix -> `v24.20.0`. Y probado que NO anulo el guard: con `@types/node` en 26 el hook bloquea con
`HOOK_EXIT=2` nombrando la app (`expected 'apps/merchant: 26'`), restaurado deja pasar con 0. Si nvm no esta o
la version no esta instalada, no se silencia nada: sigue con el Node que haya y el guard falla, que es la
señal correcta.

**EL GUARD YA SE PROBO SOLO CONTRA UN CASO REAL, no de laboratorio: Dependabot PR #8** (`@types/node`
24.13.3 → **26.4.0**). El CI del PR quedo en **failure** por el guard —`expected 'apps/consumer: 26' to be
'apps/consumer: 24'`— **antes de llegar a `main`, sin que nadie lo revisara a mano**. `main` siguio en
`success`. **PR #8 CERRADO** con comentario explicando el motivo y linkeando el ADR.

**Por que se cerro (no es "quedarse atras"):** `@types/node` no es Node, es la **descripcion de la API de Node
para TypeScript**. Su major debe seguir al Node que CORREMOS, no al ultimo publicado. Con tipos de 26 sobre
runtime 24, TS acepta APIs que en produccion **no existen**, sin error de compilacion, fallando recien en
runtime. Mergearlo habria INTRODUCIDO un riesgo que hoy no existe.

**Regla `ignore` agregada en `.github/dependabot.yml`** para majors de `@types/node`, asi la propuesta no vuelve
cada semana. **SE LEVANTA en la Fase 5**, al migrar a Node 26 — esta escrito en el comentario del archivo y en
el ADR 0046 para que no se olvide.

**Los otros 4 PRs de Dependabot NO tienen este problema** (turbo, playwright, typescript-eslint,
@types/react-dom): ninguno toca la version de Node. Quedan **abiertos**, sin revisar — decision del owner.

**Efecto lateral bueno del re-link de pnpm:** el lockfile tenia **dos** `@types/node` (la vieja 24.10.1 seguia
referenciada por `@types/node-forge`); quedaron consolidadas en 24.13.3.

**Limite conocido (menor, no bloqueante):** `tools/` no esta cubierto por `pnpm typecheck` (turbo corre los
tsconfig de las 3 apps), asi que un error de tipos en el guard no lo caza el gate — vitest transpila sin
chequear tipos. El guard igual falla en runtime si se rompe.)

Ultima actualizacion previa: 2026-09-02 (**PLAN DE MIGRACION DE NODE ESCRITO: ADR 0046 `aceptada` + spec 0049
`borrador`. Nada de codigo tocado todavia — falta cerrar 2 decisiones abiertas. Punto de retorno.**

**EL HALLAZGO QUE CAMBIA EL PEDIDO: "subir a la ultima estable" NO es ir a Node 26.** Datos verificados el
2026-09-02 contra `nodejs.org/dist/index.json`, el `schedule.json` oficial y la cuenta real de Vercel — no de
memoria:

| Version | Estado | Fechas |
|---|---|---|
| **26.8.1** | Current | salio 2026-08-26 · **LTS el 2026-10-28** · EOL 2029-04-30 |
| 25.9.0 | **EOL** | murio 2026-06-01 |
| **24.20.0** | **Active LTS** (Krypton) | maintenance 2026-10-20 · EOL **2028-04-30** |

**Vercel solo ofrece 24.x (default) / 22.x / 20.x. Node 26 NO existe como runtime ahi**
(`vercel.com/docs/functions/runtimes/node-js/node-js-versions`). `vercel project ls` confirma que
`check-point` corre **24.x**, igual que los otros 9 proyectos de la cuenta. **El techo no es negociable desde
el repo:** no hay `engines` ni `.node-version` que haga desplegar Node 26.

**Por eso el ADR 0046 decide seguir la LTS de Vercel, no la Current de Node.** El argumento decisivo es el
**skew, no la novedad**: si local y CI corren 26 y produccion corre 24, **el CI deja de probar lo que se
despliega** — seria reintroducir, en silencio y con todo en verde, el mismo problema del que este repo acaba
de salir con 0047/0048. Y no hay urgencia: Node 24 tiene soporte hasta **2028-04-30**.

**Estado real del repo: la version esta escrita en 4 lugares y NADA verifica que coincidan.**

| Lugar | Hoy | Objetivo |
|---|---|---|
| `.node-version` | `24.19.0` | `24.20.0` |
| `package.json` → `engines.node` | `>=24.15.0 <25` | `>=24.20.0 <25` |
| `@types/node` (×3 apps) | `24.10.1` | `24.13.3` |
| Vercel Project Settings | `24.x` | `24.x` (**sin cambio**) |

Ese drift es el costo que hace cara la migracion a 26 cuando llegue; el guard de la Fase 3 es el entregable
que la vuelve barata.

**Spec 0049 — 4 fases ahora + 1 agendada, cada una un commit con su verificacion y su rollback** (separadas a
proposito: si el CI se pone rojo, tiene que quedar claro cual cambio lo hizo):
1. Pin a **24.20.0** (`.node-version` + `engines`). Riesgo bajo. **Prod NO cambia**: Vercel ya sirve la ultima
   24.x. Lo que se corrige es que local y CI dejen de probar contra una version MAS VIEJA que la desplegada.
   Prerrequisito: `nvm install 24.20.0` (la maquina solo tiene 24.15.0 y 24.19.0).
2. **`@types/node` → 24.13.3. LA FASE MAS RIESGOSA, y no es obvio:** tipos mas nuevos pueden romper
   `typecheck` sin que cambie una linea de codigo. Si pasa, NO se baja el tipo ni se tapa con `any`. Es ademas
   **la unica fase que mueve el lockfile** → exige `pnpm install` con red y despues **`pnpm fetch`** para
   re-calentar `.pnpm-store` (sin eso, la proxima sesion bajo codex/Auto falla el install offline).
3. **Guard anti-drift** sobre los 4 pines (+ el de pnpm, que tambien esta duplicado: `packageManager` en
   `package.json` vs `version: 11.4.0` hardcodeado en `ci.yml`). **Se prueba rompiendolo a proposito** —
   un guard que nunca falla es decorativo.
4. Actions al dia: `checkout@v4→v7`, `setup-node@v4→v7`, `pnpm/action-setup@v4→v6` (ultimas verificadas por
   `gh api`). Mata el warning de Node 20. **Es un salto de 3 majors de terceros = la mayor superficie de la
   spec**, por eso va sola y al final. OJO: es el runtime DE LAS ACTIONS, no el del proyecto — cosas distintas
   que se parecen.
5. **Node 26: AGENDADA, no se ejecuta.** Disparador de DOS condiciones: (a) 26 en LTS el **2026-10-28** y
   (b) **Vercel lo ofrece** en Project Settings. **Manda la (b)**: la (a) sin la (b) no habilita nada.
   Verificable con `vercel project ls` (columna Node Version) sin entrar al dashboard.

**PENDIENTE ANTES DE IMPLEMENTAR — 2 decisiones abiertas del owner (la spec sigue en `borrador`):**
(1) **Forma del guard**: script + step de CI, o un 4º project de vitest. **Recomendado: vitest**, porque asi
corre con `pnpm test` y por lo tanto tambien en el **Stop hook** — el drift lo introduce un agente editando un
pin, y vitest es el unico de los dos que lo caza en ese mismo turno. (2) **Si se ejecutan las 4 fases o se
corta despues de la 3**: la 4 es la de mayor superficie y menor beneficio (saca un warning).)

Ultima actualizacion previa: 2026-09-02 (**EL CI ESTA VERDE. Specs 0047 y 0048 IMPLEMENTADAS. Corrida `33579163212`
en `success` — la PRIMERA verde en 101 corridas de CI, desde que el workflow existe (2026-08-12). Punto de
retorno.**

```
lint ✓  typecheck ✓  test ✓  playwright install ✓  test:e2e ✓  build ✓  format:check ✓
```

Ningun paso saltado. **Por primera vez el repo tiene un gate de CI que efectivamente verifica.** Antes: 100
corridas, 100 en failure, muriendo en ~25s en el paso 1 (`format:check`) sin ejecutar nada mas — un CI
decorativo detras del cual cualquier regresion de tipos, test roto o build caido habria pasado sin ser vista.

**Que faltaba (spec 0048): el workflow nunca instalaba los browsers de Playwright.** `pnpm install
--frozen-lockfile` trae el paquete `@playwright/test`, pero los binarios se bajan aparte a
`~/.cache/ms-playwright`, vacio en un runner limpio. Fix = un step
`pnpm exec playwright install --with-deps chromium` antes de `test:e2e`. **Solo chromium**:
`playwright.config.ts` no declara `projects`, asi que corre con el default (instalar los tres seria regalar
minutos de CI en cada push). **`--with-deps`** porque el runner de Ubuntu no trae las libs del sistema.
**Sin cache de `~/.cache/ms-playwright` a proposito**: ahorraria ~20-30s pero suma una pieza que puede dar
falsos verdes con una key vieja, y el problema que se estaba arreglando era justamente un CI que mentia. Se
puede medir despues, ahora que hay un tiempo real de corrida (2m0s) contra el cual comparar.

**LOS TESTS E2E ESTABAN SANOS — verificado corriendolos, no razonandolo.** Se ejecutaron con browser real por
primera vez (ni en CI ni en esta maquina habian corrido nunca): **5 passed, 1 skipped en 5.3s**. Los 2 que el
CI daba por rojos (`analytics`, `loyalty`) pasan sin tocarles una linea: era exclusivamente el browser
faltante. Ningun test fue editado ni borrado para conseguir el verde.

**El unico skip de la suite NO es deuda: es opt-in deliberado.** `loyalty-real.spec.ts` se saltea con una
condicion explicita y documentada en el propio archivo — exige `E2E_MERCHANT_BASE_URL`, `E2E_MERCHANT_EMAIL`,
`E2E_MERCHANT_PASSWORD` y `E2E_LOYALTY_MUTATION_TEST=true`, con el motivo escrito: "requiere owner de prueba
nuevo y aislado de la rama de desarrollo". **Muta datos reales**, asi que no se enciende en CI a proposito:
sin owner de prueba aislado, escribiria contra un entorno real desde cada push. Es el unico `test.skip` de
`tests/e2e/` (verificado por grep).

**GOTCHA LOCAL QUE CUESTA MEDIA HORA SI NO SE SABE: los e2e no arrancan si 3000/3001/3002 estan ocupados.**
La suite levanta las 3 apps en puertos FIJOS (consumer 3000, merchant 3001, platform 3002, hardcodeados en el
script `dev` de cada `package.json`). Si algo mas los ocupa, Playwright choca con `EADDRINUSE` y aborta
**antes de ejecutar un solo test** — el error no menciona puertos de entrada y se parece a un problema de
Playwright. Paso de verdad en esta sesion: `next dev` de **otros dos proyectos** (`gym-app` en 3000 desde el
31/ago, `55mas` en 3001) tenian los puertos tomados. Diagnostico: `lsof -nP -iTCP:3000 -sTCP:LISTEN` y
`lsof -a -p <pid> -d cwd -Fn` para ver de que proyecto es. Y **el cache de browsers YA ESTABA** en la Mac
(`~/Library/Caches/ms-playwright`, con el `chromium_headless_shell-1200` que el runner reclamaba): estos
tests se podian correr en local desde siempre, lo que faltaba era correrlos.

**Estado del repo:** todo pusheado a `main` (`c7e64cf`). Nada pendiente de estas dos specs.

**Deuda conocida que queda, sin spec todavia (no bloquea nada):** las GitHub Actions tiran warning de
deprecacion de Node 20 (`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4` forzadas a
correr en Node 24). Estuvo explicitamente fuera de alcance de 0047 y 0048. Y sigue en pie el **pendiente del
owner de la spec 0046**: alta del remitente en Resend + envs en Vercel + QA en vivo del recovery.)

Ultima actualizacion previa: 2026-09-01 (**Spec 0047 (deuda de formato y CI rojo) IMPLEMENTADA con PASS de revisor
independiente — punto de retorno. FALTA UNA COSA: pushear y confirmar que la corrida de CI queda en `success`,
que es el criterio que cierra el problema de fondo.** Flujo `AGENT-WORKFLOW.md` completo (spec cerrada por el
orquestador → implementador → revisor → 1 fix → re-revision del delta → PASS).

**Que se arreglo:** el CI corria `pnpm format:check` como PRIMER paso y fallaba, asi que
`lint`/`typecheck`/`test`/`test:e2e`/`build` NUNCA se ejecutaban en GitHub. Se formatearon los **19** archivos
versionados en deuda (0028/0031/0032/0041/0045), se agrego el script `format` que faltaba en el root
(`prettier --write .` — su ausencia era la causa estructural de que la deuda se acumulara), y `format:check`
paso a ser el **ULTIMO** step de `ci.yml` (sigue siendo bloqueante, pero ya no tapa las fallas que importan).

**Las 2 decisiones que estaban abiertas en el borrador, cerradas por el orquestador con evidencia:**
(1) **`.claude/settings.local.json` va a `.prettierignore`, no se formatea** — `git check-ignore -v` lo resuelve
contra el ignore global del usuario (`~/.config/git/ignore`), o sea es untracked y **nunca llega a GitHub**. Eso
explica la discrepancia que nadie habia atado: el log de CI decia `19 files` y el `format:check` local decia `20`.
Ojo: desaparecio del `format:check` por el `.prettierignore`, NO por estar untracked — **prettier no mira git,
escanea el filesystem**. (2) **Prevencion (c), ambas**: reordenar el CI + hook.

**Hook nuevo `.claude/hooks/format-on-write.sh`** (`PostToolUse` en `Write|Edit`, registrado DESPUES de
`file-size.sh` para que el aviso de tamaño se siga viendo). Es el fix estructural (mistake→rule): cada escritura
sale formateada y la deuda no se re-acumula. **Sale 0 SIEMPRE y en silencio** — es higiene, no un gate; un exit≠0
bloquearia ediciones validas (parse error transitorio a mitad de una edicion multi-paso, prettier ausente).

**LOS 3 GOTCHAS DEL HOOK, todos verificados corriendolo, no razonados:**
- **Prettier resuelve `.prettierignore` desde el CWD, NO desde la ruta del archivo.** Con `cwd=/tmp`,
  `prettier --write <ruta absoluta>` **reescribe** `.claude/settings.local.json` — es decir, un hook ingenuo
  reintroduce en cada sesion justo la deuda que esta spec saca. Por eso el hook hace `cd` a la raiz
  (`CLAUDE_PROJECT_DIR`, con fallback que busca `.prettierignore` hacia arriba).
- **NO se pasa `--ignore-path`** (la spec original lo pedia; se corrigio). En Prettier 3 el default es
  `{.gitignore, .prettierignore}`; fijar la flag perderia el `.gitignore`. Sin ella el hook aplica exactamente
  el mismo criterio que `pnpm format:check`.
- **Guard de contencion (hallazgo del revisor, corregido en 2ª ronda): sin el, el hook reformatea archivos de
  OTROS proyectos con la config de prettier de este** (reproducido con `/tmp/otro-proyecto/x.ts`). Se normalizan
  ambos paths con `fs.realpathSync` (cubre relativos, `..`, trailing slash, symlinks y el `/tmp`→`/private/tmp`
  de macOS) y si el archivo cae fuera de la raiz, sale 0 sin tocar nada.

**Verificacion (salida real, corrida por el revisor por su cuenta):** `format:check` **exit 0**, lint exit 0,
typecheck **3/3 sin cache** (`TURBO_FORCE=true`, `0 cached`), test **254 passed** (identico al baseline — no bajo),
build exit 0. **El diff de los 19 es SOLO formato**, probado con dos oraculos independientes: (a)
`prettier(git show HEAD:<f>) == worktree` byte a byte, **19/19** —concluyente, porque prettier es funcion pura del
AST—, y (b) comparacion de token stream con el parser de TypeScript. Ningun archivo paso las 300 lineas del hook
`file-size` (maximos: `recovery/deliver.ts` 263, `step-preview.tsx` 253). **Falso verde descartado**: se
desformateo a proposito un archivo de `apps/merchant/src` y `format:check` lo cazo, o sea el `.prettierignore` no
se ensancho de mas. El hook se probo adversarialmente (formatea lo del repo desde 2 caminos de raiz y CWD ajeno,
deja intactos los ignorados y todo lo de afuera, exit 0 en 8 casos degenerados) y se verifico que **no es
decorativo** corriendo la version SIN guard sobre el mismo caso.

**RIESGO ABIERTO QUE ESTA SPEC DESTAPA (no es fallo suyo): `pnpm test:e2e` va a correr de verdad en GitHub por
primera vez.** Estaba oculto detras del `format:check` rojo y **nunca se ejecuto ni en esta maquina ni en CI**.
`npx playwright test --list` confirma que compila: **6 tests en 4 archivos** (`health`, `analytics`, `loyalty`,
`loyalty-real`), levantan 3 dev servers y `loyalty-real` toca DB. **Si la corrida post-push sale roja en
`test:e2e`, no es regresion de 0047 — es la deuda que 0047 saca a la luz, y va a su propia spec.**

**PUSH HECHO** (commit `8e0d7c0`; el push subio 4 commits — la implementacion de 0046 tambien estaba sin
pushear). El gotcha de `GH_TOKEN` invalido del `CLAUDE.md` sigue vigente y el fix documentado funciono tal cual:
`export GH_TOKEN=; gh auth switch --hostname github.com --user maxhost` y despues
`GH_TOKEN= git -c credential.helper='!gh auth git-credential' push origin main`.

**RESULTADO DEL CI (corrida `33575852432`): ROJO. El ultimo criterio de aceptacion de 0047 NO se cumplio y
migro a la spec 0048.** Pero el arreglo funciono en lo que importaba: **`lint`, `typecheck` y `test` corrieron
y pasaron en GitHub POR PRIMERA VEZ** (antes el job moria en el step 1 y no verificaba nada). El job ahora
muere en `test:e2e`, y `build`/`format:check` no llegan a correr.

```
lint ✓  typecheck ✓  test ✓  test:e2e ✗ ← corta aca  build -  format:check -
```

**Causa, verificada: el workflow nunca instala los browsers de Playwright.** `grep -n playwright
.github/workflows/*.yml` no devuelve NINGUNA linea. `pnpm install --frozen-lockfile` instala el paquete
`@playwright/test@1.57.0`, pero los binarios se bajan aparte a `~/.cache/ms-playwright`, que en un runner
limpio esta vacio → `Error: browserType.launch: Executable doesn't exist ... chrome-headless-shell`.
De 6 tests: **3 pasan** (los que no abren browser), **2 fallan**, 1 sin explicar todavia (probablemente
skippeado — hay que confirmarlo, un test que se auto-saltea en silencio es un gate que no gatea).

**ESTO ES DEUDA DESTAPADA, NO REGRESION DE 0047** — es exactamente el riesgo que la spec 0047 anticipo por
escrito antes del push. Y ojo con la lectura facil: **el fallo es de infraestructura del runner y NO dice nada
sobre si los e2e pasan.** Nunca corrieron con browser, ni en CI ni en esta maquina. Arreglar la instalacion
puede destapar fallas reales de los tests; el verde no esta garantizado. No se reproduce en local (aca los
browsers ya estan bajados), asi que la unica señal valida es la corrida de Actions.

**PROXIMO PASO: spec 0048 (`borrador`, escrita, INDEX actualizado) — el step de `playwright install` en
`ci.yml`.** Decisiones abiertas ahi: que browsers instalar (`playwright.config.ts` no declara `projects`, hay
que confirmar contra cual corre de verdad antes de elegir entre `chromium` y los tres), si entra caché de
`~/.cache/ms-playwright`, y que hace `loyalty-real.spec.ts` (toca DB) sin `DATABASE_URL` en CI. Regla dura
heredada de `CLAUDE.md`: **ningun test e2e se edita ni se borra para conseguir el verde.**)

Ultima actualizacion previa: 2026-08-30 (**Spec 0046 (recovery de owner/staff por OTP al email) IMPLEMENTADA con
PASS de revisor independiente (en 2 rondas: FAIL → fixes → PASS) + migración `0027` aplicada y verificada en
PROD — punto de retorno.** Flujo `AGENT-WORKFLOW.md` completo. Spec `implementada`, INDEX actualizado.

**EL HALLAZGO QUE IMPORTA (bloqueante del revisor, ronda 1): las rutas propias de better-auth salteaban TODA
la protección.** El orquestador había blindado `/api/merchant/recovery/*` (gate, rate-limit persistente,
chequeo de staff deshabilitado, auditoría), pero el catch-all **preexistente** `app/api/auth/[...all]/route.ts`
publica TODOS los endpoints del plugin `emailOTP` — una puerta con candado al lado de una pared abierta. El
revisor lo demostró end-to-end contra la rama Neon: con el gate APAGADO `/api/auth/email-otp/request-password-reset`
devolvía 200 y entregaba el OTP; un **staff deshabilitado** recibía el código y **cambiaba su contraseña**; una
ráfaga de 8 mandaba **8 emails** contra un cap de 3/h, con **0 filas de auditoría**. **Fix:** `disabledPaths`
en `getMerchantAuth()` con los 9 paths HTTP del plugin. Verificado en `node_modules` (`dist/api/index.mjs:164-166`)
que se aplica en el `onRequest` del router (→404) y **NO** afecta las llamadas server-side `auth.api.*`, que es
lo que usan nuestras rutas. **Lección general: agregar un plugin de better-auth agrega SUPERFICIE HTTP por el
catch-all — no alcanza con envolverlo en una ruta propia.**
Otros 3 fixes de la ronda 1: `middleware.ts` (matcher `/forgot-password`) para el **503 real** de la página —un
server component de Next NO puede fijar status—; `audit(...,"reset_ok")` en try/catch (un fallo de log ya no
reporta 503 sobre una contraseña YA cambiada, que dejaba al usuario reintentando con un OTP consumido); e
intervalo explícito en el `FILTER` de `email_day`.
**Qué se construyó:** plugin `emailOTP` de better-auth en `server/auth.ts` (OTP de 6 dígitos, `expiresIn`
600s, `allowedAttempts` 3, `disableSignUp: true` para que `/sign-in/email-otp` no auto-cree cuentas, y el
callback `sendVerificationOTP` envía SÓLO para `type === "forget-password"`); contrato `EmailChannel`
(`server/email/{channel,console,resend,provider}.ts`) con **Resend por `fetch` a `https://api.resend.com/emails`,
SIN dependencia npm** — espeja el patrón de `ClickSendOtpChannel` (decisión del orquestador: mismo contrato
y proveedor que pide el ADR 0045, sin la fricción del store offline de pnpm); orquestación
`server/recovery/{internal,merchant-recovery}.ts` (gate, normalización, rate-limit persistente, enumeración,
mapeo de errores); tabla nueva `merchant_auth.password_reset_attempt` (migración **aditiva** `0027_good_drax`,
generada con `db:generate`, no a mano); rutas `api/merchant/recovery/{request,reset}`; UI `/forgot-password`
de 2 pasos + link desde `/login`; envs documentadas en `.env.example`.
**HALLAZGO CRÍTICO verificado en `node_modules` (no asumido):** better-auth 1.6.26 `resetPasswordEmailOTP`
revoca sesiones **sólo si `emailAndPassword.revokeSessionsOnPasswordReset === true`** (leído en
`dist/plugins/email-otp/routes.mjs`). Sin ese flag el DoD "sesiones revocadas" NO se cumple aunque todo lo
demás ande. El flag está puesto y la revocación quedó verificada contra DB real.
**Decisiones de seguridad que la spec no detallaba:** (a) si el envío de email falla, `/request` igual
responde 200 — si el error saliera sólo para cuentas reales, el fallo del proveedor se volvería un oráculo de
enumeración; (b) la validación de contraseña corta ocurre ANTES de canjear el OTP para no quemar un código
válido; (c) `isRecoverable` deja recuperar al owner sin membership todavía (onboarding a medias) pero no al
staff cuyo único membership está `disabled`.
**Gates finales (corridos, salida real):** typecheck **3/3**, lint limpio, unit **254** (213 previos + 41
nuevos; los del consumidor 0032 intactos), build **3/3** (`ƒ Proxy (Middleware)` presente). **Integración Neon
5/5** en rama efímera `spec-0046-merchant-recovery` (`br-holy-wave-ax5s6c9w`, off prod): entrega del código +
fila de auditoría con IP hasheada, email desconocido no envía nada, código incorrecto rechazado, **cambio de
contraseña + TODAS las sesiones previas revocadas + login viejo falla y el nuevo anda**, y el cap horario
aplicado desde la DB. Anti-fuga verificada por grep de un build con sentinel: `RESEND_API_KEY` **0 archivos**
en `.next/static`.
**Revisor independiente: PASS (ronda 2).** Corrió los 4 gates **sin caché** (`--force`, `0 cached`) +
integración 5/5 por su cuenta; reprodujo el escenario del staff deshabilitado end-to-end (ahora 404 + 0 emails
+ **la contraseña vieja sigue siendo válida**); y —lo más valioso— **comprobó que el test del guard no es
tautológico** construyendo un `betterAuth` SIN `disabledPaths`: los 9 paths dan 400/200, ninguno 404, así que
los strings son rutas reales. Además leyó el **chunk edge compilado** para confirmar que
`process.env.PASSWORD_RECOVERY_ENABLED` **no quedó inlineado en build-time** (gotcha clásico del edge
middleware): el flag se evalúa en runtime.
**Migración `0027_good_drax` APLICADA Y VERIFICADA EN PROD por SQL** (host unpooled; 27→28 migraciones;
`merchant_auth` 4→5 tablas con `password_reset_attempt`: 5 columnas, 3 índices, CHECK de `kind`;
`core`(22)/`consumer`(10) intactos; los 18 usuarios existentes sin tocar).
**Residuales (menores, del revisor, ninguno bloqueante):** (a) con el gate ENCENDIDO pero sin
`RESEND_API_KEY`/`EMAIL_FROM` la página da 200 con panel oscuro en vez de 503 (las 2 rutas API sí dan 503; el
middleware sólo mira el flag); (b) oráculo de **timing** en `/request` —sólo las cuentas reales pagan el
round-trip a Resend— acotado por 3/h y 5/día por email; (c) el cap por IP no está serializado (el advisory
lock es por email), así que una ráfaga concurrente desde una IP contra emails distintos puede pasar levemente
el 10/h; (d) `/reset` sin rate-limit propio, acotado por `allowedAttempts: 3` × 5 OTP/día ⇒ ≤15 intentos
diarios contra 10⁶.
**PENDIENTE DEL OWNER (bloquea el uso, no el código):** (1) alta del **remitente en Resend** (verificar
`checkpass.club`) + cargar en Vercel `PASSWORD_RECOVERY_ENABLED=true`, `EMAIL_PROVIDER=resend`,
`RESEND_API_KEY`, `EMAIL_FROM` — **sin esto `/forgot-password` responde 503 a propósito**; (2) **QA en vivo**:
pedir reset del propio email, recibir el OTP, cambiar la clave, re-loguear y confirmar que las sesiones viejas
murieron.
**Ramas Neon efímeras BORRADAS** con OK del owner: `spec-0046-merchant-recovery` (`br-holy-wave-ax5s6c9w`) y
la residual `spec-0043-staff` (`br-quiet-mouse-axp5nlrh`, arrastrada de la sesión anterior). `list_branches`
verifica que **solo queda `main`** (default/primary = prod).

**HALLAZGO GRANDE DE ESTA SESIÓN, FUERA DE 0046 → spec 0047 `borrador`: EL CI ESTÁ ROJO Y NO VERIFICA NADA.**
`.github/workflows/ci.yml` corre `pnpm format:check` como **primer** paso y falla con 20 archivos sin
formatear; como Actions corta al primer exit≠0, **`lint`, `typecheck`, `test`, `test:e2e` y `build` NUNCA se
ejecutan en GitHub**. Verificado, no inferido: 3 corridas seguidas en `failure` sobre `main` (`33329183454`,
`33328757578`, `33328440371`) y el log termina en `Code style issues found in 19 files`. Los 20 archivos son
de specs viejas (0028/0031/0032/0041/0045) — **ninguno de 0046**, que quedó formateado. Agravante: **no existe
el script `format` (escritura) en el `package.json` de root**, sólo `format:check` — causa estructural de que
la deuda se acumulara. **Ojo al implementarla:** el formateo puede empujar un archivo sobre las 300 líneas del
hook `file-size` (le pasó a `merchant-recovery.test.ts` en esta sesión, hubo que dividirlo) → dividir, no
exceptuar. Y `test:e2e` **nunca corrió en esta máquina**: podría estar roto sin que nadie lo sepa.)

Ultima actualizacion previa: 2026-08-30 (**ADR 0045 + spec 0046 CERRADA: recovery de owner/staff por OTP al
email (Resend) — lista para implementar.** Owner/staff hoy NO tienen recuperación de contraseña
(`auth.ts` no configura olvido); el email ya es su identidad en better-auth. Diseño cerrado con el
owner: OTP de 6 dígitos al email con el plugin `emailOTP` de better-auth (posee el OTP y el set de
contraseña — hashing + revocación de sesiones correctos, NO se toca `account.password` a mano),
**Resend** como proveedor activo detrás de un contrato `EmailChannel` intercambiable (ahí vive el
"cambiar de canal a futuro"; SMS para owner/staff queda como costura, no se construye). Resistente a
enumeración, rate-limit persistente por email/IP (tabla nueva `merchant_auth.password_reset_attempt`,
migración 0027), gate `PASSWORD_RECOVERY_ENABLED` (off → 503). El OTP del **consumidor** (SMS, spec
0032) queda intacto y aislado. Spec disjunta (única otra abierta, 0031, no solapa). **Próximo paso:
implementar 0046** con el protocolo `AGENT-WORKFLOW.md` (implementador → revisor independiente; rama
Neon efímera para el test de integración). **OJO implementador:** verificar la API del plugin
`emailOTP` contra la versión instalada de better-auth leyendo `node_modules` — no asumir de memoria
(regla del `AGENTS.md` de merchant). Dependencia nueva `resend` → correr `pnpm fetch` en terminal con
red antes de la sesión de implementación bajo codex/Auto (gotcha del store offline en `CLAUDE.md`).
Nada commiteado aún de 0046 salvo los docs de esta sesión.)

Ultima actualizacion previa: 2026-08-30 (**QA en vivo del owner sobre `checkpass.club` CERRADO + fix de CORS
de Geoapify — punto de retorno.** El owner completó los pasos de dashboard (Vercel `BETTER_AUTH_URL`
+ CORS de R2) y corrió el QA en producción: **landing (0045), creación de staff, login de staff y scan
del mostrador — todo funciona.** Registro/login/subidas de imagen andan en el dominio custom.
**Bloqueante encontrado y resuelto en el QA: el buscador de direcciones/locales (Geoapify) daba 401 y
después CORS.** Diagnóstico (verificado por terminal, no adivinado): la clave pública
`NEXT_PUBLIC_GEOAPIFY_API_KEY` restringida por origen devuelve un `Access-Control-Allow-Origin` **FIJO**
(un solo dominio, sin `Vary: Origin`, sin echo del `Origin`) → por CORS sólo servía `check-point-pied.vercel.app`;
desde `www.checkpass.club` el browser bloqueaba. **Fix (owner, sin código): quitó TODAS las Allowed
Origins de la clave pública → Geoapify responde `*` → el autocomplete anda desde cualquier dominio.**
Verificado en vivo por el owner. Sin cambios de código en esta sesión (`git status` limpio → no
corresponde gate). Gotcha completo + comando de diagnóstico + fix durable pendiente (Opción B: proxear
por el server con `GEOAPIFY_API_KEY`) documentados en `CLAUDE.md` (Gotchas). **Residual/backlog:** spec
Opción B (proxy server-side del autocomplete) para no depender de la clave pública sin restricción; y
spec 0032 (recovery OTP) sigue pendiente de env vars/provider. Nada por commitear salvo estos docs.)

Ultima actualizacion previa: 2026-08-30 (**Fix de dominio custom `checkpass.club` (trustedOrigins de
better-auth) — punto de retorno; QA en vivo es el próximo paso.** El owner reportó que registrarse
desde `checkpass.club` fallaba. Diagnóstico: **no era Neon** (Neon es solo la DB; su "trusted domain"
es de *Neon Auth*, producto que este repo no usa) — la auth es **better-auth**, que sólo confía en
`BETTER_AUTH_URL`; en Vercel esa env var seguía apuntando al dominio viejo. Fix en código
(`server/auth.ts`): `trustedOrigins = [BETTER_AUTH_URL, ...BETTER_AUTH_TRUSTED_ORIGINS.split(",")]`
(env nueva opcional, coma-separada, acepta comodines de better-auth tipo `https://*.vercel.app`;
retrocompatible — sin la env nueva se comporta igual que antes). Documentado en `.env.example`.
**Gates:** typecheck 3/3, lint, build 3/3. Commit `11c5f26` en `main`.

**Acción pendiente del OWNER en dashboards (no bloquea código, son pasos manuales):**
1. **Vercel** → Environment Variables (Production) → `BETTER_AUTH_URL=https://checkpass.club`
   (+ opcional `BETTER_AUTH_TRUSTED_ORIGINS=https://www.checkpass.club,https://*.vercel.app`) →
   **redeploy**. Esto es lo que arregla el registro/login.
2. **R2 (Cloudflare)** → bucket → CORS → agregar `https://checkpass.club` (+ `www`) a
   `AllowedOrigins` con métodos `GET,PUT`. Necesario porque las subidas de imagen (logo/producto/
   sello) hacen `PUT` **directo del navegador** a la URL firmada (`use-brand-logo.ts`,
   `use-catalog-image.ts`, etc.) — sin este CORS, subir imágenes falla en el dominio nuevo.

## Ahora

**Spec 0046 (recovery de owner/staff por OTP al email) CERRADA end-to-end (2026-08-30):** implementada,
PASS de revisor independiente en 2 rondas, migración `0027` en PROD, ramas Neon efímeras borradas, docs
sincronizados. **Lo único que falta es del owner: Resend + 4 envs en Vercel + QA en vivo** (detalle en la
última actualización). Antes de esto, el QA de `checkpass.club` ya había cerrado OK (landing 0045, staff y
mostrador 0043, Geoapify destrabado).

**Lo próximo recomendado: spec 0047 (`borrador`) — el CI está rojo y no verifica nada.** Es el ítem de
mayor palanca: barato, mecánico, sin cambio de comportamiento, y devuelve el gate de CI que hoy no existe.

Pendiente (no bloquea lo ya cerrado):
- **Spec 0046 (recovery owner/staff por OTP al email) — IMPLEMENTADA, PASS del revisor, migración `0027`
  en PROD.** ADR 0045. Detalle completo en la última actualización arriba. **Lo único que falta es del
  owner:** alta del remitente en Resend + las 4 envs en Vercel (`PASSWORD_RECOVERY_ENABLED=true`,
  `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`), QA en vivo, OK para borrar la rama efímera
  `br-holy-wave-ax5s6c9w`, y autorizar el commit. Hasta que carguen las envs, `/forgot-password` responde
  **503 a propósito** (la feature queda oscura).
  Nota: al final NO hizo falta la dependencia npm `resend` (el adaptador usa `fetch`, como los canales SMS),
  así que el `pnpm fetch` de re-warm del store fue innecesario para esta spec.
- **Spec 0047 (deuda de formato + CI rojo) — `borrador`, candidata a lo próximo.** Descubierta en esta
  sesión. **Es el trabajo de mayor palanca pendiente:** hoy el CI de GitHub no verifica NADA porque muere
  en `format:check`. Es higiene mecánica (20 archivos + un script + prevención), sin cambio de
  comportamiento, y devuelve el gate de CI. Ver `docs/specs/0047-deuda-de-formato-y-ci-rojo.md`; la única
  decisión abierta es la prevención (reordenar gates / hook de formato / ambas).
- **Backlog — spec Opción B (proxy server-side de Geoapify):** hoy el autocomplete pega directo del
  navegador con la clave pública SIN restricción de origen (scrapeable). El fix durable es proxearlo
  por el server del merchant con `GEOAPIFY_API_KEY` (same-origin, cero CORS, clave oculta). Requiere
  spec cerrada antes de tocar código. No urgente — el `*` funciona.
- **Spec 0032 (recovery OTP):** sigue pendiente de env vars/provider (detalle abajo).

Checklist de QA — specs ya verificadas en vivo (✅) y la que falta:
- ✅ **Spec 0045 (landing):** entrar a `checkpass.club` sin sesión → landing → "Acceder"/"Crea tu
  negocio"; con sesión → `/backoffice`.
- ✅ **Spec 0043 (staff):** owner crea staff → login en otro dispositivo → consola de mostrador
  (sin ver marca/programa/catálogo/personal) → escanear y acreditar → historial del día → desactivar.
- **Spec 0032 (recovery OTP):** requiere ANTES cargar en Vercel `RECOVERY_ENABLED=true` +
  `OTP_HMAC_SECRET`(≥32B) + `OTP_ENCRYPTION_KEY`(base64 32B) + credenciales ClickSend/Twilio.
  Camino barato sin cargar saldo: **ClickSend da $2 AUD de crédito trial** al registrarse (14 días,
  alcanza para varios OTP a Ecuador; dejar `CLICKSEND_FROM` vacío) — o Twilio trial (SMS gratis sólo
  a número verificado). Sin esto, `/recover` responde 503 (oscuro a propósito).

Ultima actualizacion previa: 2026-08-30 (**Spec 0045 (landing de entrada) IMPLEMENTADA — punto de retorno.**
Spec chica: la raíz `/` (checkpass.club) redirigía directo al wizard de registro de negocio. Ahora, sin
sesión, `/` muestra una **landing mínima** (estructura, sin diseño; reusa `panel/button`) con "Acceder"
(→ `/login`) y "Crea tu negocio" (→ `/onboarding`); con sesión sigue yendo a `/backoffice`. Login y
registro ya existían y se enlazan. Único archivo: `app/page.tsx` (de redirect a landing). Sin ADR (no
hay decisión de arquitectura). **Gates:** typecheck 3/3, lint, unit 213, build 3/3. Implementado directo
por el orquestador (cambio de 1 archivo, bajo riesgo, sin ciclo implementador/revisor). Commit `fe8e68d`
en `main`. **Residual:** diseño real de la landing (fuera de alcance). **Contexto:** el owner está
configurando el dominio `checkpass.club` en Vercel. Detalle en `docs/specs/0045-*.md`.)

Ultima actualizacion previa: 2026-08-30 (**Spec 0043 (login de staff + consola de mostrador) IMPLEMENTADA con
PASS de revisor independiente + migración `0026` aplicada y verificada en PROD — punto de retorno.**
Tajada del borrador 0005 (ADR 0044): que el **personal** opere el mostrador sin ver el resto del
backoffice. Flujo `AGENT-WORKFLOW.md`: spec cerrada con el owner → **implementador** (subagente) →
**revisor independiente FAIL** (1 bloqueante: la subpágina `backoffice/brand/kit/page.tsx` había quedado
con el guard viejo sin chequeo de rol → un staff la veía por URL) → orquestador la migró a `requireOwner`
y verificó por barrido que **ninguna** página de backoffice usa ya `getSession` inline → **PASS efectivo**;
además resolvió el menor (alta de staff borra el user better-auth si falla el insert de membership, para no
"quemar" el email). **Qué se construyó:** rol `staff` sobre `business_membership` (CHECK `role in
('owner','staff')` + columna `status active|disabled`, migración aditiva `0026`); guard compartido
`server/auth-guards.ts` (`requireBackofficeSession`/`requireOwner` — owner-only redirige staff a la
consola, NO a onboarding); `server/staff.ts` (alta vía better-auth `signUpEmail` **sin propagar la cookie
del owner**, listar, activar/desactivar = `status` + revocar sesiones, sin borrar al user → preserva
auditoría), rutas `api/staff/*` owner-only con aislamiento por negocio; UI `backoffice/staff` (reemplaza el
mock `demo/staff`); consola `backoffice/counter` reencuadrada = **historial de acreditaciones del día del
negocio** (`server/counter/history.ts` `listTodaysAccreditations`, zona horaria del negocio) + botón
Escanear que lanza el flujo 0030 **intacto**. Las páginas owner-only (brand/loyalty/catalog/home/brand-kit)
pasan por `requireOwner`. **Sin canje de cupones** (0006) ni staff atado a local (fuera de alcance).
**Gates:** typecheck 3/3, lint, unit **213**, build 3/3, **integración Neon 5/5** en rama efímera
`spec-0043-staff` (`br-quiet-mouse-axp5nlrh`, off prod). **Migración `0026_cynical_mister_fear` aplicada y
verificada por SQL en PROD** (26→27; `business_membership` gana `status` + 2 CHECK; memberships existentes →
`active`; `core`(22)/`merchant_auth`(4)/`consumer`(10) intactos). **Residuales (menores, no bloquean):** (a)
**QA en vivo del owner** — crear un staff, entrar en otro dispositivo, ver sólo la consola, escanear+acreditar,
desactivarlo y confirmar que pierde acceso; (b) el historial muestra las acreditaciones del negocio (todos
los operadores) — si el owner prefiere "solo las mías" es un filtro por `operator_user_id`; (c) las páginas
mock `demo/*` siguen sin guard de rol (se gatearán al volverse reales); (d) rama efímera `spec-0043-staff`
sin borrar (auto-expira o pedir al owner). Commit + push a `main` en esta sesión. **Próximo paso: revisar
el siguiente spec pendiente** — 0040 (cropper) o los fundacionales restantes (0003 Incentive Engine es el
keystone no construido; 0006/0007/0009 dependen de él). Detalle de diseño abajo.)

Ultima actualizacion previa: 2026-08-30 (**Spec 0032 (recuperación passwordless por OTP SMS) IMPLEMENTADA con
PASS de revisor independiente + migración `0025` aplicada y verificada en PROD — punto de retorno.**
Sesión de review + hardening: el árbol ya traía la implementación del implementador (sin commitear) y
el owner pidió auditarla. **Se hallaron 4 bugs graves + 3 menores y se corrigieron todos con el flujo
`AGENT-WORKFLOW.md`** (orquestador implementa → revisor independiente PASS → aplica a prod). **Los 4
graves:** (1) **idempotencia replayaba un challenge muerto** — tras un fallo de envío el SELECT de
replay matcheaba la delivery `failed`/challenge `invalidated` y devolvía 202 con un `challengeId` que
jamás verificaba; fix: el replay exige `c.status='pending' AND c.expires_at>now` y los índices
`otp_delivery_phone_client_request_unique` + `otp_delivery_challenge_kind_unique` pasan a **parciales**
(`WHERE status in ('sending','accepted','unknown')`) para que una `failed` libere la clave. (2) **un
reenvío fallido mataba el código inicial válido** — `deliverReservation` compartía la rama de error;
fix: sólo invalida el challenge si `kind='initial'`. (3) **sin corrida de integración** (el implementador
nunca la corrió — se probó al correrla: cazó un **fixture roto**, el test 5/24h backdateaba `accepted_at`
en vez de `reserved_at` y se auto-rate-limitaba por 3/h). (4) **`withDbTransaction` abría/cerraba un Pool
WS por request** → singleton por connection string en `server/db.ts` + guard de `webSocketConstructor`.
**Menores:** `RECOVERY_COUNTRIES` a fuente única `lib/recovery-countries.ts` (server+cliente); helper
`establishRecoveredSession` (revoke+`rotatePassCredentials`+sesión) reusado por verify-wallet y profile
(mata la duplicación de la rotación); país del perfil desde el challenge, no del body. **Además** el
implementador había dejado 2 archivos >300 líneas → split: `schema/otp.ts` (otp fuera de
`schema/consumer.ts`) y `consumer/recovery/{internal,deliver,verify}.ts` + barrel `recovery.ts` (patrón
del repo). **Gates verdes:** typecheck 3/3, lint, unit **198**, build 3/3, **integración Neon 10/10** en
rama efímera `spec-0032-recovery-fixes` (`br-flat-lab-axtggvs8`, off prod `main`, con `expiresAt` →
auto-borra, sin gate destructivo). Los 2 tests de regresión nuevos viven en archivo separado
`consumer-recovery-failure.neon.integration.test.ts` (dividir, no extender). **Revisor independiente:
PASS** — corrió los 4 gates + integración 10/10 por su cuenta, verificó los 7 hallazgos arreglados
uno por uno, la anti-fuga (ningún `*_hash`/`*token`/ciphertext/teléfono en DTO/log), la atomicidad
(revoke+rotate+sesión en una tx interactiva con `FOR UPDATE`), la carrera de alta sin overwrite; 3
menores no-bloqueantes nuevos (alta nueva sin colisión rota+encola push no-op —paridad con el original—;
`rotate.ts` usa `now()` de SQL; `otpProviderName` loguea 'clicksend' en modo `console` dev). **Migración
`0025_narrow_mephistopheles` (regenerada limpia, reemplazó el `0025_pretty_madame_web` del implementador)
APLICADA Y VERIFICADA EN PROD por SQL** (`db:migrate` host unpooled; 25→26 migraciones; `consumer` 8→10
tablas; ambos índices parciales presentes en `otp_delivery`; `core`(22)/`merchant_auth`(4) intactos).
**Residuales:** (a) **QA en vivo del owner — PENDIENTE (se decidió NO bloquear por esto).** Camino barato
sin cargar saldo: **ClickSend da $2 AUD de crédito trial al registrarse** (14 días; alcanza para varios
OTP a Ecuador; **dejar `CLICKSEND_FROM` vacío** para que use número compartido y evitar rechazo de
sender-ID alfanumérico a EC — el código sólo manda `from` si está seteado), o **Twilio trial** (SMS gratis
sólo a número verificado, hasta 5). Para activarlo hay que **cargar en Vercel**: `RECOVERY_ENABLED=true`,
`OTP_HMAC_SECRET`(≥32B), `OTP_ENCRYPTION_KEY`(base64 de 32B, `openssl rand -base64 32`), y las credenciales
del provider (`CLICKSEND_USERNAME`/`CLICKSEND_API_KEY` o las de Twilio). Con `RECOVERY_ENABLED=false`
(default) `/recover` responde 503 y la feature queda oscura. Checklist QA: SMS real a un operador
ecuatoriano + recuperar en otro teléfono y ver morir el QR/portal viejo + onboarding de número nuevo;
(b) el archivo de integración **base** sigue en 447 líneas (>300, del implementador) — split mecánico
como follow-up; (c) los 3 menores no-bloqueantes del revisor. **`RECOVERY_ENABLED=false` por defecto** →
la feature queda oscura en prod hasta que el owner cargue secretos y la active. Commit + push a `main` en
esta sesión (`d72997f` + `4b2db73`). **Próximo paso de la próxima sesión: revisar el siguiente spec
pendiente** — candidato natural **spec 0040** (cropper de imagen en el cliente, `borrador`, implementa
ADR 0041; el owner lo tenía como "trabajo futuro para retomar cuando se priorice"), o alguno de los
borradores fundacionales `0001`–`0009` (siguen en `borrador` hasta validar arquitectura). Empezar leyendo
la spec candidata + su ADR, cerrar diseño con el owner si hace falta, y recién ahí `AGENT-WORKFLOW.md`.
Detalle de diseño abajo.)

Ultima actualizacion previa: 2026-08-17 (**Spec 0032 (recuperación passwordless por OTP SMS) CERRADA con
el owner + ADR 0013 revisado — solo diseño, sin código, punto de retorno.** Decisiones cerradas:
CheckPass Club genera/verifica OTP propio; `OtpChannel` transporta SMS común mediante
`ClickSendOtpChannel` o `TwilioOtpChannel`, **ClickSend activo inicialmente**, Twilio seleccionable
por entorno, **sin fallback automático**; seam preparado para futura selección global/por país en
admin de plataforma (nunca owner). **Recovery solamente**: el enrolamiento 0028 sigue sin SMS por
costo. Número existente → prueba posesión, verifica la única cuenta de ese teléfono, revoca todas
las sesiones, rota atómicamente QR+web token+Wallet devices+Web Push mediante 0033 y crea sesión
nueva. Número inexistente → mismo OTP/respuesta, ticket HttpOnly de 15 min → onboarding corto
nombre/apellido/país → cuenta ya verificada, sin membresía; carrera con alta concurrente recupera la
cuenta única, sin merge ni overwrite. OTP: 6 dígitos CSPRNG, HMAC + ciphertext AES-256-GCM para
reenviar el mismo código, 5 min, 2 intentos; SMS inicial + **un** reenvío después de 60s; challenge
nuevo invalida anterior. Límites Postgres por teléfono, sin IP: 3 entregas/h y 5/24h (inicial y
reenvío cuentan). Países soberanos de América salvo Guyana/Surinam + España; PT Brasil, ES países
hispanos, EN angloparlantes/fallback. UI `/recover`, soporte placeholder sin acción. WhatsApp,
selector admin, francés/criollo y soporte WhatsApp quedan fuera. **Docs sincronizados:** spec 0032
`cerrada`, ADR 0013 `aceptada` (supersede Telnyx/Twilio Verify), INDEX/ARCHITECTURE/HANDOFF. **Árbol
incluye además el rebrand app-wide a CheckPass Club de esta sesión**, ya verificado antes con
typecheck 3/3, lint y wallet unit 7/7. **Próximo paso después de `/clear`: implementar 0032 con
`docs/AGENT-WORKFLOW.md`** (implementador → revisor independiente; migración aditiva + rama Neon
efímera; ClickSend y Twilio reales son QA manual, nunca exponer secretos). Spec no disjunta:
serializar `consumer.ts`, `wallet/rotate.ts` y `enroll-form.tsx`.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0041 (brand kit — afiche de enrolamiento por local)
IMPLEMENTADA con PASS de revisor independiente + migración `0024` aplicada y verificada en PROD —
punto de retorno.** Flujo `AGENT-WORKFLOW.md` completo (implementador → revisor independiente PASS →
orquestador aplica a prod y cierra). **Contexto de la sesión:** el árbol ya traía trabajo parcial de
sesiones previas cuyos agentes en background murieron con el cierre de sesión (patrón observado 3×:
los agentes async NO sobreviven el corte de sesión); el server-side de atribución + dominio
`brand-kit/*` + helpers `qr-render` ya estaban en disco. El orquestador **completó el trabajo
directamente** (cada Write aterriza en disco, sobrevive el crash): wizard de 3 pasos
(`brand-kit-wizard.tsx` + `steps/{step-template,step-brand-check,step-preview}.tsx`), **5 plantillas**
por rubro (`templates/template-{bar,lodging,retail,services,minimal}.tsx` + `parts.tsx`/`types.ts`),
`poster-preview.tsx`, `page.tsx` server (sesión→negocio→`getBrandKitData`, estados guía sin
programa/sin logo), link "Generar afiche" en `brand/page.tsx`, estilos + `@media print` A4/A5
(aislamiento por `visibility`, `@page` inyectado) en `globals.css`, migración **`0024_absurd_romulus.sql`**
(aditiva: ADD COLUMN `origin_location_id` uuid nullable + FK `set null` cross-schema consumer→core +
índice), test de integración de atribución en **archivo separado** (`consumer-enrollment-attribution.neon.integration.test.ts`
— el hook `file-size` bloqueó extender el base: dividir, no extender), y un test que **ancla
`qr-render` contra la salida REAL de `qrcode`** (`brand-kit/qr.test.ts` — confirmado: `qrcode` emite
`stroke="#000000"` + `viewBox`; los helpers operan sobre eso, no un fixture inventado). Fixes de gate:
`MembershipRow.originLocationId?` interno (opcional; el DTO `membershipResponse` NO lo serializa —
`consumer.test.ts` lo pinnea), quitados `eslint-disable` de reglas no configuradas
(`@next/next/no-img-element`/`react/no-danger`). **Estilos de QR (3, sin dep):** negro / teñido con
primary / logo al centro a **EC-H**. **`renderQrSvg` parametrizado** por el orquestador
(`payload,ec="M"` default → el pase intacto; el afiche pide `"H"`). **Gates verdes:** typecheck 3/3,
lint, unit **187/76-skip** (24 nuevos brand-kit+kit), build 3/3. **Integración Neon en rama efímera
`spec-0041-brand-kit` (`br-silent-rice-axvr9ctw`, off prod):** atribución **4/4** (loc válido→origin;
sin loc→null; ajeno→null y alta creada; re-alta 409 conserva) + enroll base **9/9** (la 1ª corrida tuvo
un timeout aislado por cold-start del compute 0.25 CU, NO un assert — re-corrido tibio 9/9). **Revisor
independiente: PASS** — corrió los 5 gates + integración **13/13** por su cuenta, verificó el DoD ítem
por ítem, la anti-fuga (`logoObjectKey`/`origin_location_id` fuera de todo DTO), el aislamiento por
negocio del `loc` (validado contra `program.businessId`, no lanza), la no-regresión del pase y la
migración aditiva; sin bloqueantes ni importantes, 2 menores (newline de `_journal.json` preexistente;
escaneo del QR impreso = QA en vivo). **Migración `0024` APLICADA Y VERIFICADA EN PROD por SQL**
(`db:migrate` host unpooled; 24→25 migraciones; `consumer` 8 tablas; `origin_location_id` uuid nullable
+ FK `set null` + índice; `core`(22)/`merchant_auth`(4) intactos). **Commit `f82a551` pusheado a `main`**
(con el fix `GH_TOKEN=`+`gh auth switch maxhost` de CLAUDE.md; 38 archivos). **Rama efímera
`spec-0041-brand-kit` (`br-silent-rice-axvr9ctw`) BORRADA** con OK del owner. **Único residual: QA en
vivo del owner** sobre el deploy de Vercel: recorrer el wizard con 2+ locales, cambiar color/headline,
probar los 3 estilos de QR, A4/A5, imprimir a PDF, **escanear el QR impreso** y verificar por SQL que
`origin_location_id` quedó en el local. Detalle de la spec (diseño) abajo.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0041 (brand kit — afiche de enrolamiento por local)
CERRADA con el owner + ADR 0042 aceptado — solo diseño, sin código, punto de retorno.** Sesión de
definición de spec (no se tocó código de producto). El owner pidió retomar el **brand kit**: un
generador en el backoffice de "Marca" del afiche imprimible con el QR que los consumidores escanean
en el local para enrolarse. Se ancló todo al código real (mapa por subagente Explore): hoy el QR de
enrolamiento **no se genera en ningún lado** (la ruta `/enroll/<programId>` existe y está brandeada,
0028/0039, pero no hay superficie que dibuje el QR), el enrolamiento **no guarda de qué local vino**
(solo la venta lo tiene, `order.location_id`, 0030) y **un negocio tiene un solo programa operativo**
(índice único) → "Marca ↔ programa" es 1:1, sin selector de programa. **Decisión de fondo (ADR
0042): la atribución por local es una dimensión UNIVERSAL de todo evento de valor** (alta, venta,
acumulación, canje futuro), capturada de dos fuentes — **counter** para eventos del operador
(venta/acumulación ya cubiertas por `order.location_id`; el canje, que aún NO existe como
transacción, nacerá con `location_id`) y **QR escaneado** para el alta self-service. "Separar stats
por local" = `GROUP BY location_id`; el **tablero** es otra feature. **Spec 0041 (cerrada)
implementa la primera pieza:** wizard de 3 pasos (elegir plantilla → chequear logo/colores → preview
editable) en `/backoffice/brand/kit`; **5 plantillas** curadas por rubro pintadas con logo+colores de
marca; **QR server-side** reusando `renderQrSvg` (lib `qrcode`, SVG, **sin dep nueva**) a **EC nivel
H**, con estilos básicos dep-free (negro / teñido de marca / **logo al centro**); salida = **HTML/SVG
+ CSS `@media print` A4/A5** → "Guardar como PDF" del navegador (sin librería de PDF); alcance
**Global o por local** (oculto con 1 local), el QR por local codifica `/enroll/<programId>?loc=<localId>`;
**atribución del alta** = nueva columna nullable **`origin_location_id`** en `program_membership`
(FK `set null`, migración aditiva ~`0024`), validada contra el negocio del programa (un `loc` ajeno
se ignora, el alta nunca se rompe), sin pisar en re-alta idempotente. **Decisiones del owner
cerradas:** un solo programa por marca; PDF por impresión del navegador (A4+A5); 5 plantillas por
rubro; textos/CTA con default por `kind` editables en el preview; wizard; estilos de QR básicos sin
dep. **Estado de docs:** ADR 0042 escrito (`aceptada`), spec 0041 `cerrada`, INDEX actualizado (filas
0042 + 0041). **`disjunta: no`** — único punto de contacto con specs abiertas: `brand/page.tsx`
(comparte con la 0040/cropper, ambos aditivos → serializar esa edición si 0040 corre en paralelo);
0032 (OTP) no toca `program_membership` ni el enroll. **Próximo paso: implementar la spec 0041** con
el protocolo de `AGENT-WORKFLOW.md` (implementador → revisor independiente; rama Neon efímera para la
integración de atribución `origin_location_id` + migración `0024` verificada). Sin dependencias
nuevas → no hace falta re-warmear el store de pnpm. **Residual heredado pendiente: QA en vivo del
owner de la spec 0031** (checklist Manual, ver entrada previa). Detalle de la 0031 abajo.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0031 (micro-portal del consumidor) IMPLEMENTADA en
código, gates + integración Neon verdes, commiteada y pusheada a `main` para QA en vivo del owner
— punto de retorno.** Se construyó la experiencia de dos pestañas sobre `(consumer)/wallet`:
`wallet-shell.tsx` (estado de pestaña en cliente + gate de pestaña inicial por opt-in de push),
`bottom-nav.tsx`, `programs-tab.tsx` (tarjeta por membresía ordenada por última actividad, filtro
"ver cerrados", `terms-modal.tsx` de T&C), `program-card.tsx`/`points-card.tsx` (Sellos reusa
`CardPreview` reubicado a `components/loyalty/`, Puntos usa colores+logo de marca), `qr-tab.tsx`
(QR + Wallet + PushPrompt). Query nuevo `listConsumerPrograms` (`server/consumer/programs.ts`) con
DTO anti-fuga R2 (reusa `toClientProgram`, sin `*ObjectKey`) + aislamiento por `consumerId`;
`push/subscriptions.ts` gana `hasWebPushSubscription` (aditivo, único punto de contacto). **Sin
migración ni secreto nuevo** (usa tablas ya en prod). **Gates verdes:** typecheck 3/3, lint, unit
163/72-skip (nuevos `programs.test.ts` + `programs-tab.test.ts`), build 3/3, format:check limpio
en los archivos de la spec. **Integración Neon 3/3** de `listConsumerPrograms` en rama efímera
`spec-0031-programs` (`br-lucky-night-axoyd81l`, off prod `main`): branding por-negocio, orden por
última actividad, aislamiento (`[]` para otro consumidor), detección de Web Push. **El test de
integración cazó un bug de su propio fixture** (insertaba un programa `status:"closing"` sin la
ventana de cierre → violaba el check `loyalty_program_closing_window_check`); se corrigió el
fixture agregando `earningEndsAt`/`redemptionEndsAt` (assertions intactas). **Commit `cb647d9` pusheado a
`main` para QA en vivo del owner.** **Revisor independiente (`AGENT-WORKFLOW.md`): PASS** — corrió
por su cuenta los 5 gates (typecheck 3/3, lint, unit 163/72-skip, build 3/3) + integración Neon 3/3,
verificó el DoD ítem por ítem, la no-fuga de `*ObjectKey` (test que pinnea el DTO), el aislamiento
por `consumerId` de sesión, la no-regresión de "Mi QR", la reubicación de `card-preview.tsx` y la
legitimidad del fix de fixture; **sin bloqueantes ni importantes**, solo 2 menores cosméticos (test
de aislamiento con B sin membresía propia; `readableTextColor` calculado solo contra el primary del
degradé). **Con el PASS, la spec 0031 pasa a `implementada`** (frontmatter + INDEX + DoD marcados).
**Rama Neon efímera `spec-0031-programs` borrada** (con OK del owner). **Único residual: QA en vivo
del owner sobre el deploy de Vercel** (checklist Manual del Plan de pruebas: 2 membresías reales,
una Puntos y una Sellos, en iOS/Android instalado desde el home). Detalle previo de la spec (diseño)
abajo.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0031 (micro-portal del consumidor) CERRADA con el
owner — solo diseño, sin código, punto de retorno.** Sesión de definición de spec (no se tocó
código). Se **reencuadró la 0031**: nació como "notificación + landing en vivo", pero ese
mecanismo YA está implementado end-to-end (verificado en código, no asumido): `counter/orders.ts`
encola la fila `transactional` en `consumer.wallet_push_queue` DENTRO de la misma transacción del
grant (CTE `pushq`, spec 0030), y el worker + ruteo por clase (0033/0038/0040) la entrega por pase
o Web Push. Así que la "landing en vivo" pre-pase se cae del alcance sin reemplazo. La 0031 pasa a
ser el **contenido rico del micro-portal** que el ADR 0039 §4 le había reservado: la superficie
instalable `(consumer)/wallet` (hoy shell mínimo QR+botones, spec 0037) se convierte en experiencia
**estilo iOS con nav inferior de 2 pestañas**. **Decisiones cerradas con el owner:** (1) pestaña
**"Programas"** = una tarjeta por `program_membership`, ordenadas por **última actividad** (la usada
más recientemente arriba = `MAX(core.order.created_at)` por membership, fallback `enrolledAt`, SIN
migración); **Sellos** reusa `CardPreview` (spec 0027) con `filled=stampsCount` real; **Puntos** —que
nunca tuvo diseño propio (columnas `card*` son Sellos-only)— usa colores de marca + **logo** del
negocio en tarjeta grande compuesta; **ícono info → popup de T&C** (`termsMarkdown`, texto plano SIN
parser de markdown —el repo no tiene ninguno, CLAUDE.md desaconseja deps—; el popup es contenedor
extensible a futuro); **filtro** "Ver programas cerrados" (default solo `active`, revela
`closing`/`inactive` atenuados). (2) pestaña **"Mi QR"** = el contenido actual (QR + `WalletButtons`
+ `PushPrompt`), sin regresión. (3) **Gate de pestaña inicial:** "Mi QR" primero hasta que el
consumidor confirma notificaciones, luego "Programas" (señal = suscripción Web Push:
`hasWebPushSubscription` para SSR sin flash + callback `onSubscribed` en `PushPrompt`; el gate elige
default, NO bloquea —ambas pestañas tocables desde la nav—). **Query nuevo** `listConsumerPrograms`
(`server/consumer/programs.ts`) con DTO anti-fuga R2 (reusa `toClientProgram`, sin `*ObjectKey`, test
por entidad) + aislamiento por `consumerId` de sesión. **`card-preview.tsx` se reubica** a
`components/loyalty/` (sus estilos viven en `globals.css` del layout raíz → aplican en la ruta del
consumidor sin tocar nada). **Sin migración ni secreto nuevo.** Estado de docs: spec 0031 `cerrada`,
INDEX actualizado. Nada commiteado aún (commit autorizado por el owner en esta sesión). **Próximo
paso: implementar la spec 0031** con el protocolo de `AGENT-WORKFLOW.md` (implementador → revisor
independiente; rama Neon efímera para el test de integración de `listConsumerPrograms`). **Disjunta**
frente a 0032/0040 —único punto de contacto: agrega `hasWebPushSubscription` a `push/subscriptions.ts`,
aditivo—. Sin dependencias nuevas → no hace falta re-warmear el store de pnpm.)

Ultima actualizacion previa: 2026-08-16 (**Spec 0023 (búsqueda y procedencia de locales) — Mapbox
retirado por costo, Geoapify único proveedor, QA en vivo del owner CERRADO, punto de retorno.**
El owner reportó que Geoapify resuelve locales/direcciones perfectamente en producción (incl.
Ecuador) y que el fallback Mapbox facturó USD 5 por una sola consulta de autocomplete. Se
eliminó el adaptador server `verifyMapbox`, el componente `address-autofill-mapbox.tsx`, la
plomería `renderMapboxFallback`/`useMapboxFallback` (ante error de Geoapify el campo ahora se
conserva y muestra aviso de reintento, sin segundo proveedor) y los estilos/env/docs de Mapbox.
El contrato `verifyLocation`/`LocationProvider` (`apps/merchant/src/server/location-providers.ts`)
sigue provider-neutral por si hiciera falta reintroducir otro proveedor sin migrar locales
existentes. ADR 0025 (enmienda 2026-08-16) + spec 0023 (→ `implementada`) + INDEX +
`DEPLOY-OWNER-TEST.md` actualizados. Gates: typecheck 3/3, lint, **unit 159 passed/69 skipped**
(integración Neon skip sin DB local). Sin migración nueva (columna `provider` ya permisiva).
**Commit `dfb4080` pusheado a `main` y QA en vivo del owner sobre Vercel: positivo.** Nada
pendiente de esta spec — queda como residual menor el E2E móvil del onboarding (cubierto por QA
manual). Secretos `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`/`MAPBOX_SERVER_ACCESS_TOKEN` en Vercel ya no
se leen y el owner puede borrarlos cuando quiera.)
Ultima actualizacion (sesión previa): 2026-08-16 (**Specs 0037 (Web Push iOS+Android), 0038 (ruteo por clase, ADR
0040) y 0039 (branding de la landing) — QA en vivo del owner CERRADO, todo funcionando, punto de
retorno.** Las tres se implementaron con el flujo `AGENT-WORKFLOW.md` (implementador → revisor
independiente PASS, gates + integración Neon en rama efímera por su cuenta) y después pasaron una
ronda de QA real del owner en el deploy, con varias enmiendas post-QA hasta quedar verde — el
detalle completo de cada iteración está en el frontmatter/cuerpo de cada spec (`docs/specs/003{7,8,9}-*.md`),
no se repite acá.

**Resumen de lo que quedó funcionando (verificado por el owner):**
- **Web Push iOS + Android** (0037): landing de Safari con instructivo "añadir a inicio" (sin botón
  "Abrir Compartir" — no existe API iOS para eso); subject VAPID normalizado a `mailto:`
  (`normalizeVapidSubject`) tras un 403 de Apple por subject sin esquema.
- **Ruteo por clase** (0038, ADR 0040): un aviso `transactional` sale **solo por wallet**, con
  **fallback a Web Push** si el consumidor no tiene pase alcanzable — nunca los dos a la vez (mata
  el duplicado que el QA de iOS había encontrado). Opt-in de Android (botón "Activar
  notificaciones") en la confirmación del enroll.
- **Branding de la landing** (0039): logo + color de marca en `/enroll/[programId]` y su
  confirmación, con texto por luminancia (`readableTextColor`) y card del instructivo iOS coherente
  con cualquier acento (`tint`/`shade` en `lib/brand-color.ts`). `/wallet` queda neutro (arco 0031).
- **Dos bugs de subida de imagen cazados y corregidos en el mismo QA** (afectan marca+sello+catálogo,
  comparten `lib/image-formats.ts` y `server/assets/image.ts`): (a) `image/jpg` (alias no-IANA que
  reportan varios selectores Android) faltaba en `ACCEPTED_IMAGE_CONTENT_TYPES`; (b) `normalizeImage`
  rechazaba toda imagen > 2048×2048 en vez de achicarla — una foto de cámara de teléfono (~12MP)
  daba 422 en el guardado. Fix: `MAX_INPUT_PIXELS=50MP` + el `resize` ya existente ahora sí achica.
  Guardado como **paliativo**: la solución de fondo (recortar/reducir en el CLIENTE antes de subir,
  para no tener que subir el límite de decode del server) quedó documentada como **ADR 0041 + spec
  0040** (`borrador`, sin implementar — trabajo futuro).

**Gates finales de la sesión:** typecheck 3/3, lint, **unit 159**, build 3/3, prettier — todos
verdes. Todo commiteado y pusheado a `main` (hasta `7ac5e90`).

**Nada pendiente de push.** Las specs 0037/0038/0039 quedan `implementada` con QA real cerrado. La
0040 queda `borrador` (diseño documentado, sin código) para retomar cuando se priorice.)
Ultima actualizacion base: 2026-08-16 (**spec 0037 (Web Push, iOS + Android) IMPLEMENTADA con PASS de revisor independiente + migración `0023` aplicada y verificada en prod — punto de retorno.** Flujo `AGENT-WORKFLOW.md` completo: implementador → **revisor independiente PASS** (sin bloqueantes; 1 importante no-bloqueante + 1 menor, ambos resueltos por el orquestador — ver abajo) → orquestador aplicó a prod y cerró la spec. Dominio nuevo `server/push/*`: `vapid.ts` (JWT VAPID ES256 RFC 8292 con `node:crypto`, mismo patrón que APNs 0033), `webpush-crypto.ts` (cifrado RFC 8291/8188 `aes128gcm` con `createECDH`/`hkdfSync`/`aes-128-gcm`), `webpush-channel.ts` (canal `WebPushChannel` real/`fake` intercambiable, 201/202=ok, 404/410→`WebPushGoneError`→borra la fila), `subscriptions.ts` (upsert por `endpoint`, borrado, lectura, DTO anti-fuga `webPushSubscriptionResponse` sin `endpoint`/`p256dh`/`auth`, `purgeConsumerSubscriptions`, fan-out `deliverWebPush`). Tabla `web_push_subscription` en **`schema/web-push.ts`** (split para el hook file-size; barrel `schema.ts` actualizado). Fan-out del transaccional movido a **`wallet/push-transports.ts`** (`deliverTransports` = apple+google+webpush; push.ts quedó 253 líneas) y threadeado por `push.ts`/`push-worker.ts` (`webPushChannel` opcional; el cooldown cuenta el aviso multi-transporte como UNO — una sola fila de cola se cierra). `rotate.ts` purga las `web_push_subscription` **plegado en el CTE de rotación** (atómico con la rotación del token + el borrado de devices — fix del orquestador tras el hallazgo importante del revisor; antes era un statement separado). Ruta `POST /api/public/push/subscribe` (sesión 0028; asocia SIEMPRE al consumidor de la sesión; 401 sin sesión, 400 body inválido; respuesta sin keys). PWA: `public/sw.js` (push+notificationclick, scope raíz) + **manifest DINÁMICO** en `app/(consumer)/wallet/manifest.webmanifest/route.ts` (start_url=`/c/[webViewToken]` por-consumidor — un archivo estático en `public/` NO puede llevar el token per-consumidor que exige el ADR 0039 §5, ver Hallazgos). UI: `(consumer)/push-prompt.tsx` (registro SW + prompt por plataforma: **iOS Safari NO intenta suscribir**, solo instructivo + escape hatch al botón Wallet ya presente; iOS PWA standalone / Android piden permiso tras gesto) + `wallet/page.tsx` (link al manifest via `metadata`, `apple-mobile-web-app-capable`, `<PushPrompt>`). **Cripto verificada contra el vector del Apéndice A del RFC 8291 byte-a-byte** (oráculo externo CLAUDE.md). Gates: **typecheck 3/3, lint, unit 136** (6 nuevos: VAPID JWT, vector RFC 8291, DTO sin keys, platform), **build 3/3**, **integración Neon 19/19** (6 nuevos web-push + 13 wallet-push de regresión, sin romperse). **Migración `0023_round_shape.sql`** (NO 0022 — ya existía; generada con drizzle-kit, aditiva: solo `CREATE TABLE consumer.web_push_subscription` + FK cascade + unique(endpoint) + idx(consumer)). **Migración aplicada + verificada por SQL en rama Neon efímera `br-patient-feather-ax1dsw2s` (spec-0036, reusada — ver Hallazgos)**: `web_push_subscription` 9 cols/3 idx, `core`(22)/`merchant_auth`(4) intactos. **Revisor independiente: PASS** — corrió los 5 gates por su cuenta + integración 6/6, verificó el vector RFC 8291 contra `rfc-editor.org`, la no-fuga de keys, el aislamiento por sesión, el fan-out con un solo cooldown, el purge y los dos contextos de iOS; único punto de diseño (purge no atómico) marcado importante-no-bloqueante. **El orquestador resolvió los dos hallazgos** (importante: purge plegado al CTE de `rotate.ts` → atómico; menor: docstring de `webpush-crypto.ts` apuntaba a un test inexistente) y re-verificó: typecheck 3/3, lint, unit 136, build 3/3, integración web-push 6/6 en la rama `br-spring-dawn-axu7nv1z`. **Migración `0023` APLICADA Y VERIFICADA EN PROD por SQL** (`db:migrate` con host unpooled; 23→24 migraciones; `consumer` 7→8 tablas; `web_push_subscription` 9 cols + 3 idx + FK cascade + check `platform`; `core`(22)/`merchant_auth`(4) intactos). **Commit `e734750` pusheado a `main`** (con el fix `GH_TOKEN=`+`gh auth switch maxhost` de CLAUDE.md). **Ramas Neon efímeras viejas borradas** (9 de specs 0030/0033/0034/0036, con OK del owner; queda solo la default de prod `br-curly-silence-ax8acywm`) → cuota liberada. **Hallazgos/residuales:** (a) el manifest es dinámico, no estático — el ADR 0039 §5 exige `start_url` con el `web_view_token` per-consumidor (para que la rotación deje el ícono en 404), imposible en un archivo estático de `public/`; `public/sw.js` sí es estático como pide la spec; (b) **quota de ramas Neon EXCEDIDA** — no se pudo crear una rama efímera nueva (`branches limit exceeded`); hay ~10 ramas efímeras viejas de specs 0030/0033/0034/0036 sin borrar; `delete_branch` está gateado (destructivo) → **el owner debe borrar las ramas viejas**; se reusó la rama de spec-0036 (ya cerrada, expira 2026-08-18) como workspace, el test limpia sus filas en `afterAll`; (c) **QA real iOS/Android queda como residual** (canal `fake` cubre el gate; falta suscribir en Android real + acreditar + ver la notificación con browser cerrado, y en iOS real añadir a inicio + abrir PWA + permiso + notificación + escape hatch); (d) **secreto nuevo VAPID** `WEB_PUSH_VAPID_PUBLIC_KEY`/`_PRIVATE_KEY`/`_SUBJECT` a cargar en Vercel (sin claves el canal queda deshabilitado, no se ofrece el prompt). — Sesión previa (diseño): )
Ultima actualizacion (sesión previa, diseño): 2026-08-15 (**spec 0037 (Web Push, iOS + Android) CERRADA — solo diseño, sin código, punto de retorno.** Sesión de definición de spec con el owner (no se tocó código). Se reencuadró la 0037: **incluye iOS, no solo Android** (revisa el punto 2 del ADR 0038). Se escribió **ADR 0039** (supersede el "solo Android" de 0038). Decisiones cerradas con el owner: **(1)** en iOS la Push API solo existe con la página **instalada como PWA en el home** (16.4+) y el permiso/suscripción **solo se pueden pedir dentro de la PWA standalone, nunca en Safari** → el flujo iOS vive en **dos contextos**: landing de Safari (registro 0028 → instructivo "añadir a inicio" + **escape hatch** "solo dame mi pase" que muestra el botón de Apple Wallet sin instalar, para no gatear el canal wallet ~90% detrás de la instalación) y el **micro-portal** (PWA) donde se suscribe; **(2)** el micro-portal **se construye ahora** = la página post-registro **ya existente** `(consumer)/wallet` (`page.tsx`/`wallet-cta.tsx`) hecha instalable con `manifest.webmanifest` + `public/sw.js` — su contenido rico sigue siendo la spec 0031, así que la 0037 **deja de depender de 0031** para el mínimo instalable; **(3)** el token del portal = **`web_view_token` existente** (`consumer_account`, magic-link `/c/[webViewToken]`), que ya rota junto al `qr_token` en `rotatePassCredentials` (`wallet/rotate.ts`) al recuperar cuenta (0032) — la 0037 **extiende esa rotación para purgar también las `web_push_subscription`** (simetría con "borra devices"; ícono viejo → 404, notifs viejas cortadas); **(4)** cripto **`node:crypto` sin dependencia** (VAPID JWT ES256 = mismo patrón que el JWT de APNs de 0033; cifrado RFC 8291/8188 `aes128gcm` con `createECDH`/`hkdf`/`aes-128-gcm` **verificado contra el vector del Apéndice A del RFC 8291** = oráculo externo que exige el CLAUDE.md; evita `web-push` y su re-warm del store de pnpm); **(5)** dimensión de transporte de la cola = **fan-out a todos los transportes para el transaccional** (opción (b), sin columna `transport` explícita; la selección wallet/webpush llega con el productor de campañas). Motivación asimétrica documentada: iOS gana Web Push por el **valor del portal** (el pase de Apple ya notifica rico), Android por el **contenido rico de la notificación** (banner de Google genérico). Migración aditiva prevista **`0022`** (`web_push_subscription` en esquema `consumer`, con `platform`). Anclado a código real verificado por grep: `web_view_token` (`schema/consumer.ts:38`, único), `rotatePassCredentials` (`wallet/rotate.ts`), ruta `/c/[webViewToken]`, página `(consumer)/wallet`, `public/` hoy solo tiene `wallet-logo.png`. **Estado de docs:** ADR 0039 escrito, spec 0037 `cerrada`, INDEX actualizado (fila 0039 + 0037 a `cerrada`). Nada commiteado aún (commit autorizado por el owner en esta sesión). **Próximo paso: implementar la spec 0037** con el protocolo de `AGENT-WORKFLOW.md` (implementador → revisor independiente; rama Neon efímera; migración `0022` verificada). **Serializar con la spec 0031** (comparten la página del portal). Sin dependencias nuevas → no hace falta re-warmear el store de pnpm para este trabajo.)

Ultima actualizacion previa: 2026-08-15 (**spec 0033 (canal de push del pase de Wallet) IMPLEMENTADA con doble PASS de revisor independiente — punto de retorno.** Cuarta rebanada del camino A (ADR 0031), prerequisito técnico duro de la 0031. Dominio `server/wallet/*` extendido: cola `wallet_push_queue` como **outbox transaccional** escrito en el mismo `WITH` de `persistGrant` (0030) — grant con rollback → sin fila; retry idempotente → sin duplicado; **worker** `/api/internal/wallet-push` (cron + dispatch inline best-effort) que drena con **prioridad transaccional>campaign** y **cooldown por-consumidor** (`planConsumerDrain` puro + reloj inyectable), **claim race-safe** (`pending→sending` con `UPDATE … RETURNING`) y **reaper** de filas `sending` huérfanas (`not_before` dobla como deadline de reclamo, `STALE_CLAIM_MS`) para el at-least-once del ADR 0037. **Web service PassKit** `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log; auth `ApplePass` vs `auth_token_hash` en tiempo constante; **rate-limit por serial, no IP** → 429). **APNs** = JWT **ES256** con `.p8` sobre HTTP/2 nativo (verificado con la pública en unit), **sin paquetes nuevos**; **Google** `addMessage` con el mismo service account; canal **`PushChannel`** intercambiable (`fake` cubre el gate, APNs/Google reales = QA residual). `rotatePassCredentials` (rota `qr_token`+`web_view_token`, borra devices, encola re-emisión; lo invoca la 0032). Anti-fuga: DTOs allow-list, ningún `push_token`/`qr_token`/`web_view_token`/`token_hash`/`auth_token_hash` serializado (test por entidad). **Flujo agéntico completo (`AGENT-WORKFLOW.md`):** implementador → revisor independiente **FAIL** (1 bloqueante: camino del worker sin test que lo ejecute; 1 importante: sin reaper de `sending`) → pase de corrección → **re-review PASS**. Gates verdes (typecheck 3/3, lint, prettier, **unit 118**, build 3/3) + **integración Neon 21/21** (worker 6 + wallet-push 6 + regresión wallet 4 + counter 5) en ramas efímeras. **Migración `0021` aplicada y verificada por SQL en prod** (22 migraciones; 3 columnas nullable en `consumer_account` + `wallet_push_device` + `wallet_push_queue` con índices/checks; `consumer` 5→7 tablas; `core`(22)/`merchant_auth`(4) intactos). **Externo del owner (no bloquea):** cargar los 3 secretos `APPLE_APNS_*` en Vercel (la `.p8` ya la generó, Team `SN489AVGUD`) + QA en Android/iPhone real. **Falta el `git push` a `main`** (commit local; outward-facing, espera OK del owner — recordar el fix `GH_TOKEN=` de CLAUDE.md). **Fast-follow menor:** los DTOs `walletPushDeviceResponse`/`walletPushQueueResponse` están testeados pero aún sin ruta que los consuma (sin fuga viva; su superficie llega con la 0031). **Próxima feature: spec 0031** (notificación + landing en vivo + dashboard "Ver mis programas"), que ahora consume este canal. Residuales de la 0033 documentados; ramas Neon efímeras auto-expiran 2026-08-18.)

Ultima actualizacion previa (0030): 2026-08-15 (**spec 0030 (acreditación en mostrador) CERRADA — QA en vivo del owner completo, punto de retorno.** Implementada con PASS de revisor independiente (`AGENT-WORKFLOW.md`) + verificada end-to-end por el owner sobre el deploy: enrolamiento por QR real (`/enroll/<programId>` de Fybeca 3), escaneo desde `/backoffice/counter`, venta rápida ($30 → 100 pts, `floor(30/3)×10`) y venta detallada (producto del catálogo "Café con leche" $5 → 10 pts, saldo acumulado 110), todo verificado por SQL contra prod. **Cuatro rondas de enmiendas post-QA, cada una con gates verdes y pusheadas a `main`:** (1) commit `eb4c9a8` — toast "Cliente identificado" al resolver, preview en vivo de puntos/sellos por venta (referencia no editable, misma fórmula que `computeAccrual`), fix de estilo del buscador/inputs (WebKit los pintaba grises por falta de `background`/`color` explícito); (2) commit `610ad31` — se quitó el reinicio automático a los 4s de la pantalla de confirmación (muy poco tiempo para leer el resultado); ahora el reinicio es 100% manual vía botón "Escanear siguiente". Spec actualizada con la enmienda. **El permiso de cámara repetido en cada ingreso es comportamiento del navegador** (ej. Safari iOS pregunta cada vez salvo "Permitir" fijado en Configuración del sitio), no accionable desde el código — documentado, no bloqueante. **Pendiente explícito, no de la 0030:** la notificación al consumidor en su teléfono (paso 6 del flujo) es la **spec 0031**, que depende de la **spec 0033** (canal de push del pase de Wallet) como prerequisito técnico. **Próximo paso: implementar la spec 0033** — hoy es stub/borrador, así que el primer paso de la próxima sesión es cerrar su diseño técnico con el owner antes de codear.)

## Ahora

Que esta pasando ahora mismo y cual es el proximo paso. Si una sesion se cae, la
siguiente arranca leyendo este bloque.

La V1 de Mi Pasaporte está planificada para consumidor, comercio y administrador de
plataforma: wallet/QR, backoffice y wizard, app de operación, ruleta, métricas y
rutas/eventos curados. La propuesta de arquitectura está documentada en
`docs/ARCHITECTURE.md` y ADRs 0011–0017. El lanzamiento del entorno está ordenado en
`docs/SCAFFOLD-PLAN.md`. La Spec 0010 de scaffold está `cerrada` e implementada: el árbol
estaba en disco pero sin instalar ni verificar. En esta sesión se resolvió el bloqueo de
red, se fijó Node 24.19.0 + pnpm 11.4.0, se generó y versionó `pnpm-lock.yaml`, y se
corrieron los controles con resultado verde real (frozen install, format:check, lint,
typecheck, unit 3/3, build 3/3, contrato health exacto + 405). Se corrigieron dos defectos
del árbol que nunca se habían ejecutado: la config de Vitest 4 (`test.projects` en
`vitest.config.ts` en vez del removido `vitest.workspace.ts` con `--workspace`) y el alcance
de Prettier (`.prettierignore` para no reformatear docs de producto). Falta el PASS del
revisor independiente. Las specs de producto siguen en `borrador` hasta validar la arquitectura, incluyendo
entrega/costo de OTP en Ecuador. La Spec 0003 fue rediseñada alrededor de un Incentive
Engine interno (ADR 0018): reglas tipadas, efectos, presupuestos, versiones y simulación;
no se implementará un DSL libre ni lógica especial por pantalla.

El remoto canónico es `https://github.com/maxhost/check-point.git`, documentado en
`docs/REPOSITORY.md`. La rama de publicación acordada es `main`; la autenticación local de
GitHub debe revalidarse antes del primer push. El commit inicial local `6467628` está listo
para publicar; el intento de conexión no resolvió `github.com` desde este entorno.

Handoff guardado en `docs/HANDOFF.md`. Se aceptó ADR 0019: Mi Pasaporte conserva la
estructura accesible de UI y cada negocio publica branding limitado y validado para sus
superficies. La primera feature de producto es la Spec 0011, `cerrada`: un prototipo QA
consumer sin backend para probar en teléfono QR → permiso de ubicación → validación
simulada → recompensa → wallet guest temporal. Requiere URL HTTPS temporal para que el
teléfono pueda conceder geolocalización. La arquitectura y stack transversal siguen
pendientes de validación antes de cerrar las features reales de V1.

El 2026-08-12 se cerraron las tareas 18 (Spec 0024, programa de fidelización real) y 19
(Spec 0025, marca real y assets R2): gates locales verdes (typecheck 3/3, unit 22/23 con
1 skip por env, lint, build 3/3), fix de fixture e2e (`tests/e2e/support/demo.ts`,
seed-once para que `sessionStorage` sobreviva a `page.reload()` sin pisar el estado que
persiste la app), push a `main` (`b576a4b`) y QA manual en vivo sobre el deploy de Vercel
confirmado por el owner. La Spec 0024 sigue `en curso` en su frontmatter — cerrarla
formalmente pide el PASS del revisor independiente de `AGENT-WORKFLOW.md`, que esta sesión
no corrió. La Spec 0025 se marcó `implementada` a pedido explícito del owner con 3 de 6
casilleros de su DoD sin marcar (casos límite de subida, concurrencia, e integración
R2/Neon + E2E de `brand`, inexistente); no hubo PASS de revisor independiente tampoco.

El 2026-08-12 se revisó la feature de fidelización (Spec 0024) contra el comportamiento
deseado del Owner. Decisión confirmada: el cierre fechado es el único mecanismo de apagado
(no se agrega «desactivar» inmediato). Se cerraron los huecos production-grade en ADR 0028
y se implementaron localmente con gates verdes (ver tarea 18). La integración Neon se corrió contra una rama de test
aislada y efímera (creada y borrada vía Neon MCP), la migración 0010 se aplicó a `main` de
producción con `drizzle-kit migrate` (verificada) y el código se pusheó (`1887db8`). El único
residual es el E2E `loyalty-real.spec.ts`, que requiere un entorno desplegado con un owner de
prueba sembrado (`E2E_MERCHANT_BASE_URL`/`EMAIL`/`PASSWORD`).

El 2026-08-13, durante el QA en vivo del programa de fidelización, el owner reportó que «los
términos seleccionados al crear no persisten al editar». Diagnóstico: el texto sí persistía
(`terms_markdown`), pero el modelo de **checkboxes de plantilla** se reseteaba al reabrir la
edición y, peor, re-marcar una plantilla **duplicaba** su texto (ya incrustado en el markdown).
Contradecía el intento de la spec 0024 («partir de una plantilla y editar el texto antes de
guardar»). Fix production-grade (UI): las plantillas dejan de ser selección persistente y pasan
a ser botones **«+ Insertar»** que copian su texto ya renderizado (variables resueltas contra el
formulario vivo) al textarea editable; al guardar sólo viaja `[{ text }]`. Round-trip idéntico al
editar, sin duplicación ni estado fantasma. Typecheck 3/3, unit de loyalty 6/6, e2e sin impacto
(usan el textarea directo). El servidor sigue aceptando cláusulas por `templateId` (no-breaking).

Segunda ronda de QA (2026-08-13), cinco ajustes UX del programa (todo UI, sin tocar el servicio):
(1) el textarea de términos crece con el contenido (`AutoGrowTextarea`) y arranca alto; (2) el
TOS guardado respeta saltos de línea y espacios al mostrarse (`white-space: pre-wrap` en
`.published-term`); (3) los inputs `datetime-local` de cierre traen `min` (fin de acumulación ≥
ahora en la zona del negocio; canje ≥ fin de acumulación) para no ofrecer fechas pasadas; (4) los
errores de cerrar/cancelar/cargar salen como **toast de error** (`Toast kind="error"`), no debajo
del formulario; (5) el modal de confirmación se cierra siempre al confirmar (antes quedaba abierto
si el cierre fallaba). Typecheck 3/3 y unit de loyalty 6/6 verdes.

Tercera pasada de pulido visual (2026-08-13, sólo CSS + una clase): la tarjeta de «programa en
cierre» gana jerarquía —`.closing-summary` pasa de `<dl>` por defecto (con sangría del navegador)
a panel con etiquetas en mayúsculas atenuadas y valores prominentes—; el botón «Cerrar programa»
deja de tener borde sin fondo y pasa a texto rojo sin borde con subrayado en hover
(`.close-program-link`).

Cuarto ajuste (2026-08-13): el formulario de cierre deja de ser inline (`.transition-fields`
colgado bajo el botón) y pasa a una pantalla propia con el mismo formato del editor —nuevo
`program-closing.tsx` como `section.panel.loyalty-panel`—. `page.tsx` alterna vista/editor/cierre
y el header cambia título y la X para volver, igual que en «Editar». `ProgramView` queda sólo con
la vista activa y el enlace «Cerrar programa» que abre esa pantalla.

Quinto ajuste (2026-08-13): el mensaje único «Indica una ventana futura válida en la zona horaria
del negocio» era confuso porque cubría tres fallas distintas. `validateClosingWindow` ahora lanza
un mensaje específico por caso (fechas inválidas / fin de acumulación no futuro / fin de canje no
posterior al fin de acumulación); test unitario actualizado a los textos nuevos.

Revisión independiente (2026-08-13, `AGENT-WORKFLOW.md`) sobre la feature completa: veredicto
FAIL estrecho (sin bloqueantes) por dos IMPORTANTES, ya resueltos y reverificados contra Neon
real: (1) **atomicidad de auditoría** —el cambio de estado y el evento eran dos round-trips;
ahora cada transición es un CTE `UPDATE … RETURNING` + `INSERT event` en una sola sentencia, y
la creación usa `db.batch` (rollback ante el índice único), ver enmienda ADR 0028—; (2) **tests
del núcleo** —se agregaron índice único (`23505`→`409`) y autorización (`403`) al test de
integración—. MENORES arreglados de paso: JSON inválido → `400` (antes `503`), guard de fecha de
`cancelClose` movido al `WHERE` (elimina TOCTOU), `isUniqueViolation` recorre `.cause`. Gates:
unit 25/25, typecheck 3/3, lint, e integración Neon 3/3 (rama aislada efímera, creada y borrada
vía MCP). MENORES no accionados hoy (documentados, no bloqueantes): `ownerBusiness` ordena
`desc` vs `asc` en brand —inalcanzable con 1 negocio/owner—, validación de formato de
`stampImageObjectKey` (reservado hasta R2), y `program_kind` como literal en inglés en términos.

Re-revisión independiente (2026-08-13): **PASS**. Verificó los arreglos contra el código real
del driver (`db.batch` = transacción en neon-http; semántica CTE de Postgres) y confirmó los dos
IMPORTANTES resueltos correcta y suficientemente; solo MENORES no bloqueantes. Con el PASS
verificable, la **Spec 0024 pasa a `implementada`** (frontmatter + INDEX + DoD marcados; commit
`50228a7`). Cierra la tarea 18 como production-grade. Único residual documentado: el E2E real
automatizado (`loyalty-real.spec.ts`) sustituido por QA manual en vivo del owner (crear/editar/
cerrar/cancelar/ciclo completo/términos con saltos de línea, todo OK sobre el deploy de Vercel).

**Cierre de sesión 2026-08-13 — punto de retorno.** Fidelización (0024), marca+R2 (0025) y
diseño de sello en R2 (0026) quedan **`implementada` con PASS de revisor independiente** y QA
manual del owner; migraciones aplicadas a prod (última: `0012`), gate verde (typecheck 3/3, lint,
unit 28/9-skip), todo pusheado a `main` (`629d15f`). **La próxima feature es la tarea 21 / spec
0027** (wizard de creación + diseño visual de la tarjeta de Sellos): la spec está en BORRADOR con
los requisitos del owner; **el primer paso de la próxima sesión es cerrar la sección «Abierto» de
`docs/specs/0027-…md` con el owner** (modelo de datos, degradé, si la edición es wizard, defaults
de color) y recién entonces implementar con el protocolo de `AGENT-WORKFLOW.md`. Patrón
reutilizable ya disponible: pipeline de imagen en `server/assets/image.ts` y el de assets R2 con
borrado diferido (marca/sello); las features nuevas se verifican con rama Neon efímera + revisor
independiente antes de `implementada`.

**Actualización 2026-08-13 — spec 0027 CERRADA.** Se resolvieron las seis decisiones abiertas con
el owner (columnas dedicadas nullable con checks hex/ángulo a nivel DB, no jsonb; degradé lineal de
**ángulo configurable**; crear **y editar** por wizard; preview con `round(target/2)` sellos;
defaults de color derivados de la marca; Puntos sin diseño, columnas `null`). Se escribió **ADR
0030** (modelo de datos de la tarjeta), se pasó la spec 0027 a `cerrada` en INDEX (`disjunta: sí` —
ninguna spec abierta toca loyalty) y se ancló la spec técnica al código real (mapa de archivos:
create+update comparten `PUT`, colores no son secretos → van al DTO, splits por `file-size`).

**Implementación 2026-08-13 (spec 0027, en revisión).** Hecho: 4 columnas `card_*` + 5 checks
hex/ángulo/pareja en `schema/loyalty.ts` (migración **`0013_broad_turbo`**); `validateCardDesign`
(server, 422 por caso) y `CardDesignInput` en `core.ts`; `saveProgram` escribe las columnas en
INSERT/UPDATE; `ownerBusiness` ahora expone los colores de marca al cliente para los defaults; UI
reescrita como **wizard** (`program-editor.tsx` contenedor + `steps/{units,stamp-basics,card-design,
terms,review}.tsx`), `CardPreview` puro-props compartido (`card-preview.tsx`) con helpers
`cardBackground`/`filledCount`, hook `use-card-design.ts` (split para no cruzar `file-size`), CSS
del wizard/tarjeta en `globals.css`. Tests: `card-preview.test.ts` (helpers), `loyalty-card-design.
test.ts` (validación), integración `loyalty-card-design.neon.integration.test.ts`. **Verificación:**
typecheck 3/3, lint, Prettier, **unit 33/10-skip**, **integración Neon 6/6** en rama efímera
(`br-cold-mountain`, auto-expira), **migración `0013` aplicada + verificada en prod** (columnas +
checks presentes) y **build 3/3** (turbo, Node 24). **Pendiente para `implementada`:** PASS de
revisor independiente (`AGENT-WORKFLOW.md`) y QA manual en vivo del owner sobre el deploy.

**Fix de entorno 2026-08-13 (build local).** El `pnpm build` fallaba en `/_global-error`
(`useContext` null) — diagnosticado mal al principio como «Node 22 vs 24». Causa real: el harness de
dev inyecta `NODE_ENV=development` en el proceso, y `next build` con ese valor mezcla los builds
dev/prod de React y revienta el prerender. No es del repo (ningún dotfile lo setea; con `env -i` el
build pasa) ni de la feature (falla en `main` limpio). **Fix durable:** `NODE_ENV=production` en el
script `build` de los tres apps (no-op en Vercel, que ya es production) + local alineado a Node
24.19.0 vía nvm (`.node-version`) + corepack pnpm 11.4.0. Verificado: `pnpm build` = 3/3 con
`NODE_ENV=development` en el entorno.

**Cierre del arco — Spec 0027 IMPLEMENTADA (2026-08-13).** Se corrió el **revisor independiente**
(`AGENT-WORKFLOW.md`), que ejecutó los gates por su cuenta (typecheck 3/3, lint, unit 33/10-skip,
build 3/3, Prettier, file-size) y verificó el DoD ítem por ítem, la no-fuga de `*ObjectKey`, la
coherencia server↔checks de DB, la atomicidad de `saveProgram` y la ausencia de tests borrados:
**veredicto PASS**, sin bloqueantes ni importantes (solo menores informativos). El **QA manual en
vivo del owner pasó perfecto**. Con PASS + QA, la Spec 0027 pasa a `implementada` (frontmatter +
INDEX + DoD marcados; tarea 21 → `hecho`). Commits en `main`: `4388662` (feature) + `967a080` (fix
build). **La próxima feature es el wallet consumer que consumirá la tarjeta** (spec propia; reusar
`CardPreview` puro-props ya preparado para portarse).

**Pivote de posicionamiento 2026-08-14 — ADR 0031/0032, camino A.** Antes de arrancar el
"brand kit" (afiche imprimible con QR) se hizo un parate estratégico: el QR de "sumarse al
programa" no tenía flujo detrás (no existe enrolamiento ni wallet consumer). Se decidió
**merchant-first**: Mi Pasaporte es una herramienta de fidelización/marketing para comercios,
con la **Wallet nativa (Apple/Google) como superficie de consumidor** —no una app propia de
descubrimiento (esa "red Foursquare × Niantic" se **difiere** a una fase futura encendida
sobre densidad)—. Los juegos/AR/notificaciones son de **esta** etapa (tier Plus). **ADR 0031**
(posicionamiento + identidad de consumidor: cuenta única con N membresías, **identidad
compartida / membresías aisladas**, driver de analítica por-owner scopeada por negocio;
supersede la "red curada" de 0003 y reencuadra 0019). **ADR 0032** (dónde vive: esquema pg
propio **`consumer`**, auth **phone-OTP purpose-built**, DB única compartida, hospedado por
ahora en el backend de `apps/merchant`; refina 0012). La spec 0004 quedó **reencuadrada**.

El caso de uso del owner (Marcos escanea en "La Gringa" → landing nombre+apellido+teléfono →
OTP → QR personal + "Añadir a Wallet"; el encargado escanea el QR, arma carrito y otorga
puntos/sellos; el consumidor recibe aviso en el pase o la landing se actualiza) se **rebanó en
4 specs**: **0028** identidad+enrolamiento (**CERRADA**, lista para implementar), **0029** pase
de Wallet, **0030** acreditación en mostrador, **0031** notificación+landing en vivo (las tres
en `borrador`/stub). **El próximo paso es implementar la spec 0028** con el protocolo de
`AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de `implementada`). El
**brand kit** queda **downstream**: su afiche recién tiene valor cuando el QR resuelve (0028+).
Nada de esto está commiteado aún (docs sin código). Dependencia dura de 0030: un **catálogo
económico de productos** (specs 0002/0021, en borrador).

**Ajuste 2026-08-14 — OTP diferido, 0028 sin proveedor.** Se decidió que el enrolamiento (0028)
**no verifica** el teléfono ni envía SMS: crea la cuenta con `phone_verified_at = null`
(gratis, sin fricción), porque el valor se acredita contra el **QR al portador**, no contra el
teléfono, y un SMS a Ecuador cuesta ~$0.25–0.34. Aclaración: "OTP" no es un SMS más caro —lo
caro son las *Verify API*; nuestro OTP es DIY (envío crudo). La **verificación/recuperación por
OTP** se movió a la **spec 0032** (nueva, `borrador`), que se quedó con la investigación de
proveedores (Twilio EC $0.339/BR $0.0599/ES $0.0875; Plivo más barato; Telnyx/Bird/AWS por
verificar; WhatsApp-auth más barato en BR/ES; Brasil ~10 semanas de alta de sender; España
registro CNMC desde 2026-09-15). Diseño agnóstico ya fijado: interfaz **`OtpChannel.deliverOtp`**
(SMS o WhatsApp bajo el mismo contrato) + canales `Console`/`Fake` para dev/test. **Consecuencia:
la 0028 queda implementable y lanzable HOY sin ningún proveedor de SMS** —el próximo paso sigue
siendo implementarla, ahora sin bloqueo de proveedor—. El ADR 0032 se ajustó (verificación
diferida); el ADR 0013 lo consume la 0032, no la 0028.

**Spec 0028 IMPLEMENTADA (2026-08-14) — identidad de consumidor y enrolamiento (camino A, 1ª
rebanada).** Primera noción de consumidor de plataforma: esquema pg `consumer` con 4 tablas
(`consumer_account` con teléfono E.164 único **sin verificar** + `qr_token` opaco; `program_membership`
aislada por `business_id`, unique `(consumer_id, program_id)`; `consumer_session` opaca con
`token_hash` sha256, cookie `HttpOnly` 30d; `enroll_attempt` para el rate-limit). Rutas públicas
`POST /api/public/enroll/:programId` (crea-o-reusa cuenta sin pisar perfil, membresía, abre sesión)
y `GET /api/public/enroll/me` (scopeado a la cookie); landing `(consumer)/enroll/[programId]`.
**Tres decisiones del owner (2026-08-14) bajadas a la spec antes de codear:** (1) reenrolar el
**mismo** programa con el mismo teléfono → **`409 already_member`** con CTA a recuperación (spec 0032),
sin duplicar membresía ni reabrir sesión (el teléfono no verificado no reabre acceso a una tarjeta
emitida en otro dispositivo — eso pasa por 0032); (2) **rate-limit 3 intentos/hora por teléfono**
(no por IP, para no bloquear al 4º cliente de la WiFi del local) → `429`; (3) enrolamiento permitido
en `active` **y** `closing`, solo `inactive`/inexistente → `404`. **Verificación:** implementador +
**revisor independiente PASS** (`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, lint,
prettier, **unit 46/19-skip** con 10 nuevos, build 3/3) e **integración Neon 9/9** en ramas efímeras
propias (no-fuga de `qr_token`/`token_hash`, aislamiento por negocio, seguridad del token de sesión
verificados). **Migración `0014_peaceful_harpoon` aplicada a prod** (`drizzle-kit migrate`;
verificado por SQL: esquema `consumer` con 4 tablas + 10 índices + 3 FK incl. cross-schema a
`core.loyalty_program`; `core`(14)/`merchant_auth`(4) intactos; 15 migraciones registradas). Ramas
Neon efímeras borradas. **Residual (post-deploy):** QA manual en teléfono sobre Vercel. Menores no
bloqueantes documentados por el revisor (TOCTOU del rate-limit ante concurrencia exacta del mismo
teléfono; intento contado también en 404/409 → consume slot del propio atacante; `23505` por colisión
de `qr_token` ~2⁻²⁵⁶ → 503) — todos dentro de los límites que la spec acepta y endurece la 0032.
**La próxima rebanada del camino A es la spec 0029** (pase de Wallet Apple/Google + push), bloqueada
por un ADR de proveedor de Wallet por escribir; reusa el `qr_token` ya emitido.

**Ronda QA 2026-08-14b sobre la spec 0028 (enmienda) — implementada + PASS.** QA en vivo del owner
sobre el deploy detectó tres ajustes (todo landing/UX + 1 columna): (1) **selector de país** con
banderita (emoji derivado del ISO) + código, **lista estática empaquetada** (`src/lib/countries.ts`
+ `countries.data.ts`, ~239 países; NO API ni tabla en DB — decisión del owner), número local que
compone el E.164; **default = país del negocio** (`core.business.country_code`, ISO-2; fallback `EC`);
(2) **`country_iso`** persistido para analítica (columna nullable en `consumer_account`, migración
**`0015_yummy_tusk`** aditiva; validado contra la lista → `422` si es desconocido; se guarda al crear,
**no se pisa en reuso**; entra al DTO, sin filtrar `qr_token`/`token_hash`); (3) **aviso de
recuperación movido al formulario** (junto al teléfono). **Implementador + revisor independiente
PASS**; gates verdes (typecheck 3/3, lint, prettier, unit 50→**53**, build 3/3) + integración Neon
9/9 en ramas efímeras. **Menor 1 resuelto post-PASS por el orquestador** (con tests): `composeE164`
evita duplicar el código si se pega un internacional con `+`, sin despojar dígitos pelados (colisión
Brasil dial `55`/DDD `55`). **Migración `0015` aplicada a prod y verificada** (`country_iso` text
nullable; `core`/`merchant_auth` intactos). El QR sigue sin renderizar a propósito (es la 0029).

**Cierre de sesión 2026-08-14 — punto de retorno.** La **spec 0028 (identidad de consumidor +
enrolamiento) + su enmienda 2026-08-14b (selector de país + `country_iso`)** quedan
**`implementada` con doble PASS de revisor independiente y QA manual del owner en vivo**: registro
real de **Marcos (`+49…`)** y **Julio (`+55…`/`country_iso=BR`)** sobre el deploy de Vercel,
verificados por MCP — selector de país OK, E.164 sin duplicar código, `country_iso` persistido.
Migraciones **`0014` + `0015` en prod**; commits **`b1f60d1`** (feature) + **`341f230`** (enmienda
país) en `main`. Gate verde (typecheck 3/3, lint, prettier, unit 53, build 3/3). Ramas Neon
efímeras borradas. **La próxima feature es la tarea 23 / spec 0029** (pase de Wallet Apple/Google +
canal de push): está en `borrador`/stub y **el primer paso es escribir el ADR de proveedor de
Wallet** (Apple PassKit / Google Wallet) que hoy la bloquea, y recién después cerrar la spec con el
owner. Reutiliza el `qr_token` ya emitido por la 0028 (no hay que re-emitirlo).

**Spec 0029 CERRADA + ADR 0033 + stub 0033 (2026-08-14) — punto de retorno.** Se cerró el
diseño del pase de Wallet con el owner. Decisión central (**ADR 0033**): **UN pase de identidad
"Mi Pasaporte" por consumidor** (no uno por comercio), **emisor único** Mi Pasaporte, en **Apple
Wallet (iOS, PassKit) y Google Wallet (Android)**; el **barcode lleva el `qr_token` global** de
la 0028 y **el comercio desambigua al escanear** (una sola credencial para todos los programas).
El pase es **casi estático — sin progreso por-programa**; enlaza a **"Ver mis programas"** (web)
vía un **`web_view_token` dedicado y revocable** (magic-link). Ciclo de vida = identidad (no
expira por cambio de programa; solo se rota ante pérdida de dispositivo). **Notificaciones
scopeadas por conjunto de destinatarios** (miembros de un negocio), no por el pase compartido: un
no-miembro no es alcanzable hasta que lo escanean. **Se desarrolla y verifica sin pagar Apple**:
`WalletProvider` intercambiable (`apple`/`google`/`console`/`fake`), firma **self-signed** del
`.pkpass` en tests + issuer **gratuito** de Google (modo demo); el install en iPhone real difiere
el $99 y queda como QA residual, no gate del PASS. La **spec 0029** quedó `cerrada` y `disjunta`
(dominio `wallet/*` nuevo; migración aditiva **`0016`**: `wallet_pass` + `web_view_token`). Se
separó el **canal de push a la spec 0033** (`borrador`: web service PassKit + APNs + `PATCH`/
`addMessage` de Google + rotación). Dos decisiones se mudaron a specs vecinas: **auto-enrolamiento
por escaneo + resolución del QR desambiguada por negocio → spec 0030**; **dashboard rico "Ver mis
programas" → spec 0031**. **Bloqueo externo del owner (no bloquea implementar):** dar de alta
Apple Developer ($99, solo para iOS real) y Google Cloud + Wallet API + issuer (gratis; guía
paso a paso acordada para el momento de implementar). **Próximo paso: implementar la spec 0029**
con el protocolo de `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de
`implementada`). **Antes de codear bajo codex: re-warmear el store de pnpm** (`pnpm fetch` en
terminal con red) porque la 0029 suma un paquete nuevo (render de QR / firma PKCS#7). Nada de
esto está commiteado aún (solo docs).

**Spec 0029 IMPLEMENTADA (2026-08-14) — pase de Wallet Apple/Google (camino A, 2ª rebanada).**
Se renderiza el `qr_token` de la 0028 y se lo hace portable en Wallet nativa. Dominio nuevo
`apps/merchant/src/server/wallet/*` con `WalletProvider` intercambiable (`apple`/`google`/`fake`,
seleccionado por entorno; 503 sin secretos): **Apple** arma `pass.json` storeCard + `manifest.json`
(sha1 por archivo) + firma **PKCS#7** con `node-forge` (cert real en prod, **self-signed en test**)
+ zip con `fflate`; **Google** arma el JWT RS256 de guardado con `node:crypto` nativo (sin lib).
Barcode = `qr_token` en ambos; branding Mi Pasaporte, sin progreso por-programa (ADR 0033). Rutas
públicas `GET /api/public/wallet/{apple.pkpass,google}` (401 sin sesión, crea-o-reusa **una** fila
`wallet_pass` por proveedor, runtime nodejs), `GET /c/[webViewToken]` (magic-link revocable → abre
sesión → `/wallet`, 404 si inexistente/revocado) y página `(consumer)/wallet` (QR SVG server-side +
ambos botones con detección UA y fallback + lista mínima "Ver mis programas"; el `done` de enroll
enlaza ahí). Ganchos de la 0033 provisionados (`webServiceURL` + `authenticationToken`, hash en
`wallet_pass.authTokenHash`). **Migración aditiva `0016`** (`web_view_token` en `consumer_account`
+ tabla `wallet_pass`); el backfill del NOT NULL se editó a mano (nullable → base64url por fila con
`gen_random_bytes(32)` → NOT NULL → unique). Paquetes nuevos agregados con red por el orquestador
(`qrcode`, `node-forge`, `fflate`, `@types/*`) — store caliente, lockfile versionado. **Anti-fuga**
blindada: DTOs por allow-list, ninguno serializa `qr_token`/`web_view_token`/`token_hash`/
`auth_token_hash`; test por entidad. **Implementador + revisor independiente PASS**
(`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, eslint, unit 60/23-skip con 7 de
wallet, build 3/3) + integración Neon **4/4** (wallet) y **9/9** (regresión 0028) en rama efímera
`br-small-surf-ax7jt3lk`. **Migración `0016` aplicada y verificada por SQL en efímera y en prod**
(17 migraciones; `web_view_token` NOT NULL/único/URL-safe, las 2 cuentas —Marcos+Julio— backfilleadas
con tokens distintos ≠ `qr_token`; `wallet_pass` + 3 uniques; `core`(14)/`merchant_auth`(4) intactos).
**Mistake→rule:** `drizzle/meta/` agregado a `.prettierignore` (json generado por drizzle-kit fallaba
`format:check` desde 0012). **Residuales aceptados** (no gate): install en iPhone real ($99, alta
Apple Developer del owner) + QA manual en **Android real** (issuer demo gratuito). **La rama Neon
efímera `br-small-surf-ax7jt3lk` sigue viva** (borrado gateado como destructivo — pendiente de
confirmación del owner). **Falta el `git push` a `main`** (commit local hecho; el push a `main` es
outward-facing y espera OK del owner; recordar el fix de `GH_TOKEN=` de CLAUDE.md). **La próxima
rebanada del camino A es la spec 0030** (acreditación en mostrador + auto-enrolamiento por escaneo);
depende del catálogo económico (0002/0021). El **canal de push del pase** es la spec 0033.

**Wallet en vivo (2026-08-14) — QA del owner en dispositivos reales, ambos pases en prod.**
**Google Wallet** verificado en **Android real** (issuer demo gratuito bajo cuenta Gmail
personal —la org GCP bloquea keys de SA vía `iam.disableServiceAccountKeyCreation`—; class
`3388000000023188934.mipasaporte_identity` `approved`; secretos `GOOGLE_WALLET_ISSUER_ID`/
`GOOGLE_WALLET_SA_JSON` en Vercel; script one-time `scripts/google-wallet/provision-class.mjs`).
**Apple Wallet** verificado en **iPhone real** con **certificado Pass Type ID real** (Apple
Developer personal, Team `SN489AVGUD`, `pass.com.checkpass.identity`, `.p12` con `-legacy` +
WWDR G4; 5 secretos `APPLE_*` en Vercel): el `.pkpass` instala y se agrega. Material de firma
local en `.secrets-apple/` (gitignoreado + **pre-commit hook** que aborta el commit de secretos,
verificado). Enmienda UX (commit `72081e5`): la confirmación de alta muestra los **dos botones de
Wallet directos** (componente compartido `WalletButtons`), sin paso extra. Checklist de go-live:
`docs/wallet-go-live.md`. **Residuales, cada uno su hilo:** (1) **diseño/arte** de los pases
(Google `heroImage` / Apple `strip` + logo/colores finales) — atado al rebrand **CheckPass**;
(2) **publishing access de Google** para salir de demo (gratis, ~2 días, post-arte); (3) pasaje
de la cuenta Apple **personal → organización** (regenerar cert); (4) **canal de push** = spec
0033. **Costos:** Google $0; Apple $99/año (ya pago hasta noviembre).

**Catálogo de productos CERRADO — spec 0034 + ADR 0034 (2026-08-14) — punto de retorno.**
Antes de implementar la spec 0030 (acreditación en mostrador, su prerequisito duro) se cerró
el catálogo con el owner. **Distinción clave:** el "catálogo económico" eran DOS cosas
distintas — (a) catálogo de **productos** (precio/coste), lo que 0030 consume; (b) catálogo
de **beneficios** (cupones/premios), motor de campañas. Se separaron: **ADR 0034** + **spec
0034** cierran el catálogo de **productos**; la **0002 quedó reencuadrada** (su marca/staff/
programa/negocio ya están implementados por 0025/0016/0024/0022) y la **0021 (beneficios)
diferida** con las campañas (andamiaje sin consumidor hoy). Decisiones del owner bajadas al
ADR/spec: catálogo **global por negocio con visibilidad opt-out por local**
(`available_all_locations` + `product_location`); **precio y coste opcionales** (sin precio,
el staff tipea el monto al escanear); el **valor en puntos NO vive en el producto** — lo
define el programa por **equivalencia `$X = Y puntos`** (se implementa en 0030, no en 0034);
**categorías gestionadas y libres** por negocio; **sin estados** (borrado directo, la
historia vive en el snapshot de 0030); **snapshot en la acreditación** para que editar/borrar
el catálogo no altere el wallet; **`currency_code` por negocio** (ISO 4217, default por país);
imágenes a R2 (pipeline de ADR 0029, DTO sin `*ObjectKey`); superficie real en
`/backoffice/catalog` (nueva tarjeta de nav), esquema `core` (`product`/`product_category`/
`product_location`), migración aditiva. La **spec 0034 quedó `cerrada` y `disjunta`**. Nada
commiteado aún (solo docs). **Próximo paso: implementar la spec 0034** con el protocolo de
`AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente), o 0030 en paralelo (0034 la
desbloquea). Re-warm del store de pnpm si se suma algún paquete.

**Spec 0034 IMPLEMENTADA (2026-08-14) — catálogo de productos del negocio.** Primer catálogo
real: dominio nuevo `apps/merchant/src/server/catalog/*` (barrel `catalog.ts` +
`core`/`validation`/`image`/`cleanup`/`products`/`categories`, todos < 300 líneas) sobre el
esquema `core` (`product` con precio/coste `numeric(12,2)` opcionales + checks `>=0 or null`,
`product_category` con unique `(business_id, lower(name))`, `product_location` para la
visibilidad opt-out, + `product_asset_upload`/`_cleanup` del pipeline de imagen). **`currency_code`
por negocio** en `business` (migración **`0017_opposite_cassandra_nova`**, backfill por país vía
CASE coherente con `lib/currencies.ts`; default `USD`). Rutas `api/catalog/**` (list/producto
CRUD/categoría CRUD/moneda + prep de subida **business-scoped** `product/image-upload` —soporta
imagen en el create, patrón diferido de stamp) + `api/public/catalog/[productId]/image`. UI real
en `backoffice/catalog/*` (lista mobile-first, editor con categoría inline + visibilidad por
local + imagen diferida, gestor de categorías, selector de moneda, estado vacío, `ConfirmDialog`,
toasts) + tarjeta "Catálogo" en el home. **El valor en puntos NO vive acá** (lo pone el programa
por equivalencia en 0030). **Anti-fuga blindada:** `toProductDTO` allow-list, ningún endpoint
serializa `image_object_key`; test unit + integración por entidad. **Implementador + revisor
independiente PASS** (`AGENT-WORKFLOW.md`), ambos con gates propios (typecheck 3/3, eslint,
prettier, **unit 70** con 10 nuevos, build 3/3) + **integración Neon 6/6 catálogo y 99/99 total**
(regresión de brand/consumer/wallet/loyalty verde) en rama efímera `br-rapid-moon-axlw221y`
(auto-expira 2026-08-17). **Migración `0017` aplicada a prod y verificada por SQL** (18
migraciones; 5 tablas `product*`; `currency_code` sin nulls, backfill AR→ARS/EC→USD/BR→BRL;
`core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). **Sin paquetes nuevos** (reusa
`server/assets/image.ts`), no hizo falta re-warm de pnpm. **Menores del revisor (no bloquean):**
la ruta de prep es `product/image-upload` (business-scoped, no `[id]/…`); `requireOwner` da 403
para sesión sin negocio (más correcto que 401). **Residual:** QA manual del owner sobre el deploy
(subida R2 en vivo + crear/editar/borrar producto/categoría + restringir por local). Commit
`3ca3f98`, pusheado a `main`.

**Enmienda 2026-08-14b (QA del owner) — moneda→Marca + rework de UI del catálogo, PASS.** Cuatro
ajustes sin cambio de esquema: (1) **la moneda pasó del catálogo a Marca** —se deriva del país
en el alta (`currencyForCountry` en `POST /api/onboarding/business`) y se edita en
`/backoffice/brand` (`saveBrand` la persiste, `currencyCode` opcional → conserva si falta); el
catálogo solo la lee; se borró `PUT /api/catalog/currency`, `updateCurrency` y `validateCurrencyCode`
(la validación ISO vive ahora en `brand/validation.ts`)—; (2) **catálogo con pestañas**
Productos/Categorías; (3) producto con form propio, categoría inline; (4) **buscador + filtro por
categoría** en Productos. Split por `file-size`: `brand/page.tsx` se dividió en `regional-fields.tsx`
+ `use-brand-logo.ts`. **Implementador + revisor independiente PASS**; gates verdes (typecheck 3/3,
lint, prettier, **unit+integración 100/100** con round-trip de moneda en Marca, build 3/3). Sin
migración. **Commit local hecho; falta `git push`.** **La próxima rebanada del camino A es la spec 0030**
(acreditación en mostrador), ahora **desbloqueada** por el catálogo.

**Spec 0035 IMPLEMENTADA (2026-08-14) — imágenes de stock para productos (ADR 0035).** Sobre la
imagen del catálogo (0034) se sumó una biblioteca de fotos gratis: botón **"Elegir de biblioteca"**
→ modal `StockPicker` (buscar on-submit + "cargar más") → elegir → preview desde la URL del
proveedor + atribución "Foto de Pexels.com · Autor: <nombre>"; al Guardar el servidor baja la foto
**por id** (anti-SSRF: allow-list `images.pexels.com` + `redirect:error` + tope 5 MB),
`normalizeImage` → R2, y persiste la atribución. Dominio `server/stock/*` (interfaz
`StockPhotoProvider` intercambiable: `pexels` + `fake` por `STOCK_PROVIDER`; la **API key nunca va
al cliente**, búsqueda proxeada `GET /api/catalog/stock/search`, 503 sin key). `resolveImageChange`
unifica keep/replace/remove/stock con rollback + borrado diferido. **Migración `0018`** (4 columnas
de atribución nullable en `core.product`; DTO las expone, **sigue sin serializar `image_object_key`**).
**Implementador + revisor independiente PASS**; gates (typecheck 3/3, lint, prettier, **unit+integración
106/106** con anti-SSRF unit + atribución→DTO en integración con `fake`, build 3/3). **Migración `0018`
aplicada y verificada por SQL en prod** (19 migraciones; `core`(19)/`consumer`(5)/`merchant_auth`(4)
intactos). **Residual (go-live):** setear `PEXELS_API_KEY` en Vercel (el owner ya tiene la key) + QA
manual (buscar/elegir/guardar/reeditar contra R2 real). **Con esto el catálogo (0034+0035) queda
cerrado; la próxima rebanada del camino A es la spec 0030** (acreditación en mostrador), desbloqueada.

**Cierre de sesión 2026-08-14 — punto de retorno. Catálogo (0034 + 0035) CERRADO con QA en vivo
del owner.** Estado en `main` (último commit `5f1ec5b`), árbol limpio, gate verde (typecheck 3/3,
lint, unit 75/31-skip; integración 106/106 y build 3/3 corridos en la sesión). En prod: migraciones
`0017` (catálogo + `currency_code`) y `0018` (4 columnas de atribución de stock) aplicadas y
verificadas por SQL (19 migraciones; `core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). Commits
de la sesión: `3ca3f98` (spec 0034), `69e04f5` (enmienda moneda→Marca + UI), `4ea982a`/`445d937`
(pulidos UI), `336426d` (spec 0035 stock), `5f1ec5b` (input mobile cámara/galería + HEIC). **Todo
con doble PASS de revisor independiente** (0034, enmienda 0034b, 0035) salvo los pulidos de UI
puros y el último ajuste HEIC (aditivo, cubierto por la regresión de integración). **La moneda vive
en Marca** (`/backoffice/brand`), derivada del país en el alta; el catálogo la lee. **Buscador de
stock**: `PEXELS_API_KEY` ya seteada por el owner y QA en vivo OK. **Rama Neon efímera
`br-rapid-moon-axlw221y` (auto-expira 2026-08-17)** — no requiere borrado manual. **Próxima sesión:
implementar la spec 0030 (acreditación en mostrador / tarea 24)** con el protocolo de
`AGENT-WORKFLOW.md`: es `borrador`/stub, así que **el primer paso es cerrar la spec con el owner**
(consola de staff: escanear QR del consumidor → carrito con productos del catálogo → otorgar
puntos por equivalencia `$X = Y puntos` / sellos por reglas; **auto-enrolamiento por escaneo** y
resolución del `qr_token` global desambiguada por el negocio, heredado del ADR 0033). Depende de
0028 (hecha) y del catálogo (hecho). Re-warm del store de pnpm si sumara algún paquete.

**Spec 0036 CERRADA + ADR 0036 (2026-08-14) — mecánica de acumulación + premios del programa;
prerequisito duro de 0030.** Antes de implementar la acreditación en mostrador (0030) se cerró con
el owner **cómo se otorga y qué se canjea**, que hoy el programa no define. **Wizard extendido:**
(3) el paso de términos gana un **bloque de mecánica** — otorgar `X` unidades por bloque de `$Y`
de compra, **por bloques enteros con `floor` y sin arrastre** (compra $7 con `10 pts cada $3` → 20
pts, el $1 se pierde); Sellos elige `por compra` (1 sello/transacción) o `por monto`, Puntos
siempre `por monto`; con **ejemplo en vivo**. (4) **paso de premios** nuevo — tabla `loyalty_reward`:
Sellos = completar → **1 premio**, Puntos = **1..N canjes** con **costo en puntos** auto-sugerido/
editable y **$-equivalente en vivo**; tres tipos: producto del catálogo (0034, trae nombre/precio/
imagen), premio libre (texto), % de descuento. (5) preview con **métrica de valor** ("por cada $1 en
premios, ~$N en ventas"; en Sellos `per_purchase`, "N compras por premio"). **Decisiones clave:** el
costo en puntos ES el gasto-objetivo, **aritmética calculada, no IA** (descartada por no
determinista); **sin catálogo de redención separado** (juega contra "operar en 30 min"); **sin regla
global de mínimo de gasto** (ya está en el costo de cada premio); la **ejecución del canje es de
0030**, acá solo se **define**. **Modelo (ADR 0036):** 3 columnas `accrual_*` nullable + checks en
`loyalty_program` (criterio de ADR 0030) + tabla `loyalty_reward` relacional; migración aditiva
**`0019`**, sin `DELETE` destructivo (los programas de prueba quedan "sin mecánica" hasta editarse;
el owner autorizó descartarlos). **Fast-follow explícito fuera de la spec:** imagen del premio libre
(el premio-producto ya trae imagen del catálogo). **Disjunta: no** (0030 abierta consume estas tablas
→ serializar antes de 0030). Nada commiteado aún (solo docs). **Próximo paso: implementar la spec
0036** con el protocolo de `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente antes de
`implementada`), y recién después cerrar/implementar 0030. Sin paquetes nuevos previstos.

**Spec 0033 CERRADA + ADR 0037 (2026-08-15) — canal de push del pase de Wallet; punto de
retorno.** Antes de implementar el push (prerequisito técnico duro de la 0031) se cerró el diseño
con el owner. **Decisión central (ADR 0037):** el push **no** se envía inline desde el request —
se **encola** en `wallet_push_queue` **dentro de la misma transacción** que el grant de 0030
(*outbox transaccional*: grant con rollback → sin aviso; grant idempotente → sin aviso duplicado),
y lo drena un worker. **Dos clases con prioridad:** `transactional` (acreditación 0030 — inmediata,
**preempta**, saltea cooldown) y `campaign` (marketing — **feature futura, solo provisionada**:
enum + prioridad + cooldown ya diseñados, sin productor), con **cooldown por-consumidor** (un
`transactional` empuja el `not_before` de un `campaign` en cola a `ahora+cooldown`). Esto
materializa el escenario del owner: Comercio B (acreditación) preempta a Comercio A (campaña), que
sale minutos después. **Un solo slot "Última novedad"** en el pase compartido; cada fila de la cola
es su propia notificación (**Apple**: campo con `changeMessage` + APNs pull vacío; **Google**:
`addMessage`). **Dispatch inmediato best-effort** tras el commit + **worker de cron**
(`/api/internal/wallet-push`) como red de seguridad/retry/campaña. **4 decisiones del owner
(2026-08-15):** (1) campo "Última novedad" + cola con prioridad; (2) **registro de dispositivo**
(`wallet_push_device`) para APNs; (3) la **rotación** del pase (rotar `qr_token`+`web_view_token`,
invalidar dispositivos, re-empujar) la **dispara la recuperación por OTP de la 0032** — la 0033
entrega el mecanismo `rotatePassCredentials`; (4) **auth por token del pase** (`ApplePass` vs
`auth_token_hash`) + **rate-limit por serial, NO por IP** (mismo criterio que 0028: NAT de carrier
+ el fetch lo dispara iOS; el límite es anti-DoS, no authz). **Web service PassKit** en
`/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log). **APNs = JWT ES256 con la
`.p8` sobre HTTP/2 nativo → SIN paquetes nuevos** (ni re-warm del store de pnpm). **Externo (hecho
por el owner):** APNs auth key `.p8` generada en Apple Developer (Team `SN489AVGUD`, entorno
**Both** sandbox+prod, scope unrestricted) — faltan 3 secretos en Vercel (`APPLE_APNS_KEY_P8`
base64 / `APPLE_APNS_KEY_ID` / `APPLE_APNS_TEAM_ID`); Google no suma nada (mismo service account).
**Migración aditiva `0021` de esta spec** (3 columnas en `consumer_account` + `wallet_push_device`
+ `wallet_push_queue`). **Disjunta: no** — el enqueue toca `counter/orders.ts` (0030, implementada)
y `rotatePassCredentials` lo consume la 0032 (abierta) → **serializar 0032/0031 después**. Nada
commiteado aún (solo docs: ADR 0037 + spec 0033 + INDEX). **Próximo paso: implementar la spec
0033** con `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente; el push real se verifica
end-to-end con el canal `fake`, APNs/Google reales quedan como QA residual).

## Siguiente

| # | Tarea | Spec | Estado | Notas |
|---|---|---|---|---|
| 1 | Validar propuesta de stack y publicar remoto GitHub | ADR 0011–0017 | pendiente | Remoto público `maxhost/check-point` definido; falta reautenticar GitHub antes del primer push a main |
| 2 | Crear y cerrar Spec 0010 de scaffold | 0010 | hecho | Spec cerrada el 2026-08-10; sin comportamiento de producto |
| 3 | Implementar scaffold con protocolo de agentes | 0010 | en revisión | Implementado y verificado localmente (gates verdes); `pnpm-lock.yaml` versionado. Canonical `test:e2e` requiere puerto 3001 libre; falta PASS/FAIL independiente |
| 4 | Cerrar alcance y arquitectura técnica de V1 | 0001–0009 | pendiente | 0003 rediseñada; resolver abiertos y cambiar specs a `cerrada` antes de código |
| 5 | Implementar prototipo QA consumer v0.1 | 0011 | en revisión | Rutas y QR local implementados; format, lint, typecheck, unit y build verdes. Pendientes E2E del nuevo flujo, QA manual HTTPS en teléfono y PASS independiente |
| 6 | Implementar onboarding demo de owner y negocio | 0012 | en revisión | Wizard mock implementado en merchant; typecheck y format verdes. Pendientes unit/E2E, QA manual y PASS independiente |
| 7 | Implementar home demo del Backoffice owner | 0013 | pendiente | Campaña activa y navegación mock a locales, staff, marca, campañas y analíticas |
| 8 | Implementar pantalla demo de Marca | 0014 | pendiente | Nombre, logo y colores primario/complementario/acento con picker y hexadecimal |
| 9 | Diseñar e implementar Locales demo | 0015 | pendiente | Ver, añadir, editar y archivar locales con placeholder preparado para Mapbox |
| 10 | Implementar Staff demo | 0016 | en curso | Crear, permisos, reenvío mock, archivar y eliminar; sin backend |
| 11 | Refactorizar la fundación UI de merchant demo | 0018 | en revisión | Componentes reutilizables, código muerto y confirmaciones nativas eliminados; format, lint, typecheck, unit, build y E2E local 3/3 verdes. Falta PASS independiente |
| 12 | Implementar Programa de fidelización demo | 0019 | en revisión | Acceso propio; activar/desactivar Puntos o Sellos y configurar unidades, objetivo e imagen de sello mock. Gates locales verdes; E2E nuevo pendiente de ejecución local y PASS independiente |
| 13 | Implementar Analíticas owner demo multirubro | 0020 | en revisión | Dashboard universal con lentes Bar/Restaurante, Hotel y Retail; gates locales verdes. Pendientes E2E local y PASS independiente |
| 14 | Rediseñar wizard demo desde objetivos de negocio | 0003, 0017, ADR 0022 | en revisión | Flujo Constructor (objetivo editable) → Fechas/horarios → Revisión; requisitos explícitos para POS, duración y directorio; feedback sin incentivo |
| 15 | Diseñar e implementar Catálogo único de beneficios | 0021 | diferido | **Diferido con las campañas (ADR 0034).** Es el catálogo de **beneficios** (cupones/premios), no el de productos. Sus consumidores (wizard de campañas + Incentive Engine) no existen; revive con esa fase. El catálogo de **productos** que sí se necesita hoy es la tarea 30 / spec 0034. |
| 16 | Implementar registro y autenticación real de Owner | 0022 | hecho | Registro/login, alta de negocio/local, Stripe Checkout y webhook implementados y desplegados; QA manual contra Neon y gates locales verdes. El selector final de planes es carrusel con Plus mensual por defecto. |
| 17 | Implementar búsqueda y procedencia de locales | 0023 | hecho | **Geoapify único; Mapbox retirado por costo (2026-08-16).** El owner confirmó en vivo que Geoapify encuentra locales/direcciones perfectamente (incl. Ecuador); el fallback Mapbox se eliminó porque su autocomplete facturó USD 5 por una sola consulta. Se borró el adaptador server (`verifyMapbox`), el componente `address-autofill-mapbox.tsx`, la plomería `renderMapboxFallback`/`useMapboxFallback` (ahora ante error de Geoapify el campo se conserva y muestra aviso de reintento) y los estilos/env/docs de Mapbox. Contrato `verifyLocation`/`LocationProvider` sigue provider-neutral para reintroducir otro proveedor sin migrar locales. ADR 0025 + spec 0023 + INDEX + DEPLOY-OWNER-TEST actualizados. Gates: **typecheck 3/3, lint, test 159 passed/69 skipped** (integración Neon skip sin DB local). Migración 0003 ya aplicada; sin cambios de schema (columna `provider` sigue permisiva). **Pusheado a `main` (`dfb4080`) y QA en vivo del owner sobre Vercel: positivo — Geoapify encuentra locales/direcciones correctamente en producción, sin Mapbox.** Spec 0023 cerrada. |
| 18 | Implementar programa de fidelización real y términos | 0024 | hecho | Ciclo mutable Puntos/Sellos, TOS editables y cierre fechado (ADR 0027) + endurecimiento production-grade (ADR 0028): cancelar cierre (`PATCH`), auditoría por eventos (`loyalty_program_event`), fin del éxito falso (`RETURNING`+409), normalización de `configuration`, last-write-wins. `schema.ts`/`loyalty-program.ts`/página divididos por el límite de tamaño. Gates locales verdes; **integración Neon verde** (schema + ciclo de vida completo + auditoría + 409) contra rama de test aislada; **migración 0010 aplicada a `main` de producción** (11 migraciones registradas, tabla+índices verificados) y **código pusheado** (`1887db8`) el 2026-08-12. Residual: el E2E `loyalty-real.spec.ts` queda listo pero pendiente de correr contra el entorno desplegado con owner de prueba. QA en vivo 2026-08-13: fix de persistencia de términos al editar (plantillas como botones «+ Insertar» que copian texto renderizado al textarea, sin duplicación) + ronda de UX. Endurecimiento post-revisión (auditoría atómica, tests de núcleo, 400/TOCTOU) y **PASS de revisor independiente**; Spec 0024 → `implementada` (commit `50228a7`). |
| 19 | Implementar marca real y assets R2 | 0025 | hecho | Nombre, colores, timezone y logo privado procesado/servido desde R2; reemplaza el mock de Marca. Gates locales verdes, pusheado a `main` (`b576a4b`) y QA manual en vivo confirmado por el owner el 2026-08-12. Spec cerrada a `implementada` a pedido del owner. 2026-08-13: **revisión independiente** (FAIL estrecho) resuelta — fuga de `logo_object_key` en `/api/brand` (ahora DTO sin la clave), JSON malformado → `400` (antes 503), UUID inválido → `404`, y tests agregados: `normalizeLogo` SVG/oversize + integración Neon (`409` optimista/`403`/`422`) verde en rama efímera. Concurrencia real **a futuro** (>1 owner). Núcleo de seguridad verificado correcto por el revisor. **Re-revisión: PASS** — 0025 al mismo estándar que 0024. |
| 20 | Diseño de sello del programa de fidelización en R2 | 0026 | hecho | Input para subir el diseño de la imagen del sello (modalidad Sellos): PNG/JPEG/WebP, **conserva transparencia** (decisión B del owner 2026-08-13; la tarjeta pinta los recuadros en blanco), borrado diferido a Guardar (igual que marca). Spec **cerrada** + **ADR 0029** (módulo de imagen compartido `server/assets/image.ts`; tabla `loyalty_asset_upload` paralela; `brand.ts` se divide). Implementación por fases: **(a) hecha** — `server/assets/image.ts` (`normalizeImage`, conserva alfa) extraído y `brand.ts` dividido (`brand/core|validation|cleanup`, 221 líneas), sin cambio de comportamiento (unit 26/26 + integración brand 3/3 verde en rama efímera). **(b–e) hechas**: columnas `stamp_image_object_key`/`stamp_image_version` + tablas `loyalty_asset_upload`/`loyalty_asset_cleanup` (migración `0012`); módulo `loyalty-program/stamp.ts` (upload firmado, procesamiento con `normalizeImage` que conserva alfa, resolución del cambio con rollback y borrado diferido, cron de limpieza, lectura pública); endpoints `POST /stamp-upload`, `stampAction` en el `PUT`, `GET /api/public/loyalty/.../stamp`; el `GET` del programa **oculta** `stampImageObjectKey` y expone `stampImagePath`; UI: campo de sello en el editor (solo Sellos) con subir/quitar diferido (`use-stamp-upload.ts`). Verificado: unit 7/7, typecheck 3/3, lint, integración Neon **9/9** en rama efímera, **migración 0012 aplicada a prod** (verificada). **Revisión independiente: PASS** (2026-08-13, sin bloqueantes ni importantes); se agregó un test que blinda que el `GET` nunca serializa `stampImageObjectKey`. Spec 0026 → `implementada`. Menores diferidos (URL firmada sin content-length, huérfano bajo edición concurrente del mismo owner — atado a la concurrencia a futuro; test de rollback con mock de R2). Residual: QA manual del camino de subida R2 en vivo (como en marca). Pulido QA 2026-08-13: botón "Quitar" del sello ahora al lado del preview (fila flex) y de tamaño normal, no full-width. |
| 22 | Identidad de consumidor y enrolamiento (esquema `consumer`, landing pública sin verificar, membresía aislada) | 0028 | hecho | Esquema pg `consumer` (4 tablas) + `POST /api/public/enroll/:programId` (crea-o-reusa cuenta **sin verificar**, `phone_verified_at=null`; **`409 already_member`** con CTA a recuperación al reenrolar el mismo programa; **rate-limit 3/h por teléfono** → `429`; enrola en `active`/`closing`, `inactive`→`404`) + `GET /enroll/me` scopeado + `program_membership` aislada por `business_id` + sesión opaca (`token_hash` sha256, cookie `HttpOnly` 30d) + `qr_token` opaco (nunca serializado). Landing `(consumer)/enroll/[programId]`. **No envía SMS** (OTP diferido a la 0032). Implementador + **revisor independiente PASS**; gates verdes (typecheck 3/3, lint, prettier, unit 46/19-skip, build 3/3), integración Neon 9/9 en rama efímera, **migración `0014` aplicada a prod y verificada por SQL**. Ramas efímeras borradas. Residual: QA manual en teléfono sobre el deploy. |
| 23 | Pase de Wallet (Apple / Google): UN pase de identidad por consumidor | 0029 | hecho | UN pase "Mi Pasaporte" por consumidor (**ADR 0033**), emisor único, barcode = `qr_token` global, sin progreso por-programa, enlace "Ver mis programas" (`web_view_token` dedicado revocable). Dominio `server/wallet/*` (`WalletProvider` apple/google/fake), rutas `GET /api/public/wallet/{apple.pkpass,google}` (401 sin sesión, crea-o-reusa 1 fila/proveedor, 503 sin secretos) + `/c/[webViewToken]` (magic-link → sesión → `/wallet`, 404 revocado) + página `/wallet` (QR SVG + ambos botones UA + lista mínima). Paquetes: `qrcode`, `node-forge` (PKCS#7 + self-signed en test), `fflate` (zip), JWT Google con `node:crypto`. Anti-fuga blindada (DTOs allow-list, test por entidad). **Implementador + revisor independiente PASS**; gates (typecheck 3/3, eslint, unit 60/23-skip, build 3/3) + integración Neon 4/4 (wallet) + 9/9 (regresión 0028) en rama efímera; **migración `0016` aplicada y verificada por SQL en efímera y en prod** (17 migraciones; `web_view_token` NOT NULL/único/URL-safe/≠`qr_token`, backfill de las 2 cuentas; `wallet_pass` + 3 uniques; `core`/`merchant_auth` intactos). Mistake→rule aplicado: `drizzle/meta/` a `.prettierignore` (json generado). **QA en vivo del owner 2026-08-14: Google verificado en Android real** (issuer demo gratuito, class `approved`) **y Apple verificado en iPhone real** (cert Pass Type ID real, Team `SN489AVGUD`, WWDR G4; `.pkpass` instala). Ambos en prod. Enmienda UX: botones de Wallet directos en la confirmación de alta (componente `WalletButtons` compartido). Checklist de go-live en `docs/wallet-go-live.md`. **Residuales (fuera de 0029):** diseño/arte del pase, pasaje cuenta Apple personal→org (regenerar cert), publishing access de Google (salir de demo). Push = tarea 28/spec 0033. |
| 32 | Mecánica de acumulación + premios del programa (wizard extendido) | 0036 | pendiente (spec CERRADA) | **PRÓXIMA FEATURE — spec CERRADA (2026-08-14) + ADR 0036, lista para implementar.** Prerequisito duro de la tarea 24 / spec 0030. Extiende el wizard: paso 3 gana la **mecánica de acumulación** (`X` por bloque de `$Y`, `floor` sin arrastre; Sellos `por compra`/`por monto`, Puntos `por monto`; ejemplo en vivo) en 3 columnas `accrual_*` nullable + checks; paso 4 **premios** (`loyalty_reward`: producto catálogo / libre / % descuento; Puntos con **costo en puntos** = gasto-objetivo calculado, auto-sugerido/editable + $-equivalente; Sellos 1 premio); paso 5 preview con **métrica de valor**. Migración aditiva `0019`. El canje se **ejecuta** en 0030 (acá solo se define). Imagen del premio libre = fast-follow. Implementar con `AGENT-WORKFLOW.md` (rama Neon efímera + revisor independiente). |
| 24 | Acreditación en mostrador (consola web móvil, puntos/sellos por reglas) + auto-enrolamiento por escaneo | 0030 | hecho | **IMPLEMENTADA + QA EN VIVO DEL OWNER COMPLETO (2026-08-15) con PASS de revisor independiente.** Dominio `server/counter/*` (core/resolve/grant/orders) + rutas `api/counter/{resolve,grant}` (+ `_auth.requireOperator`) + UI `/backoffice/counter` (page server + counter-console/stages/sale-forms/qr-scanner; scanner `BarcodeDetector`+`jsqr`; venta detallada/rápida; Confirmar deshabilitado al 1er tap; reinicio **manual** vía "Escanear siguiente", sin temporizador). Otorgamiento **atómico** vía CTE guardado (`persistGrant`: bump con guard `NOT EXISTS(order)` + `ON CONFLICT DO NOTHING`) e **idempotente** por `unique(business_id, client_request_id)` — sin doble-bump bajo concurrencia real (verificado por el revisor con sonda 8-way). Anti-fuga: DTOs allow-list, ningún `qr_token`/`token_hash`/`web_view_token`/`auth_token_hash` serializado (test). Migración aditiva **`0020_harsh_venus`** aplicada y verificada por SQL en prod (21 migraciones; `core.order`/`order_item` + saldo en `program_membership`; `core`(22)/`consumer`(5)/`merchant_auth`(4) intactos). Paquete nuevo `jsqr`. Gates: typecheck 3/3, lint, prettier, **unit 106/44-skip**, build 3/3, integración Neon **8/8** counter + **25/25** regresión en rama efímera. **QA real verificado por SQL:** venta rápida $30→100pts y venta detallada (Café con leche $5→10pts) sobre Fybeca 3 en prod, saldo final 110. **Enmiendas de QA pusheadas** (`eb4c9a8` toast+preview+estilos, `610ad31` reinicio manual). La notificación (paso 6) = spec 0031, que depende de la **spec 0033** (push del pase). **Modelo:** saldo por membresía (`points_balance`/`stamps_count`) + `core.order`/`order_item` owner-facing (ledger de auditoría). **Disjunta: no** — crea las tablas que la spec 0031 lee → serializar 0031 después. |
| 25 | Notificación y landing en vivo al otorgar + dashboard "Ver mis programas" | 0031 | pendiente | Stub/borrador. 4ª rebanada, cierra el loop. Push del pase (vía spec 0033) o actualización en vivo de la landing. **Hereda del ADR 0033:** aloja el **dashboard rico "Ver mis programas"** (CardPreview por programa + progreso + términos) al que enlaza el pase de la 0029. Depende de 0028/0029/0030/0033. |
| 28 | Canal de actualización y push de Wallet | 0033 | hecho | **IMPLEMENTADA (2026-08-15) con doble PASS de revisor independiente (flujo `AGENT-WORKFLOW.md`: implementación → revisor FAIL por worker sin test + sin reaper → corrección → re-review PASS).** Cola `wallet_push_queue` (outbox transaccional en el `WITH` de `persistGrant`), worker `/api/internal/wallet-push` con prioridad transaccional>campaign + cooldown + claim race-safe (`sending`) + reaper de huérfanas; web service PassKit `/v1/*` (auth `ApplePass`, rate-limit por serial→429); APNs JWT ES256 con `.p8` sobre HTTP/2 nativo (sin paquetes nuevos); Google `addMessage`; `PushChannel` intercambiable (`fake` cubre el gate); `rotatePassCredentials` (lo usa 0032). Anti-fuga por entidad. Gates: typecheck 3/3, lint, prettier, unit 118, build 3/3 + integración Neon 21/21. Migración **`0021`** aplicada y verificada por SQL en prod (22 migraciones; `consumer` 5→7; `core`(22)/`merchant_auth`(4) intactos). Residuales: 3 secretos `APPLE_APNS_*` en Vercel + QA Android/iPhone real (canal `fake` cubre el gate); DTOs de las 2 entidades sin ruta consumidora aún (llega con 0031). Falta `git push` a `main` (espera OK del owner). Notas de diseño previas: **PRÓXIMA FEATURE — spec CERRADA (2026-08-15) + ADR 0037.** Prerequisito técnico duro de la spec 0031. **Cola `wallet_push_queue` (outbox transaccional en el grant de 0030)** con prioridad `transactional`>`campaign` y cooldown por-consumidor (ADR 0037); dispatch inmediato best-effort + worker de cron `/api/internal/wallet-push`. **Un slot "Última novedad"** en el pase (Apple: `changeMessage`+APNs pull vacío; Google: `addMessage`). **Web service PassKit** `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log; auth `ApplePass` vs `auth_token_hash`; **rate-limit por serial, no IP**). **APNs = JWT ES256 con `.p8` sobre HTTP/2 nativo, SIN paquetes nuevos.** `wallet_push_device` para registros. **Rotación** `rotatePassCredentials` (rota `qr_token`+`web_view_token`, invalida devices, re-empuja) que **invocará la 0032**. Migración aditiva **`0021`**. **Externo hecho:** `.p8` generada (owner); faltan 3 secretos `APPLE_APNS_*` en Vercel. **Disjunta: no** (enqueue en `counter/orders.ts` de 0030; `rotatePassCredentials` lo usa 0032 → serializar). Implementar con `AGENT-WORKFLOW.md`; push real = QA residual (canal `fake` cubre el gate). |
| 27 | Recuperación de cuenta y verificación por OTP SMS | 0032 | pendiente (spec CERRADA) | **PRÓXIMA FEATURE.** OTP propio de 6 dígitos/5 min/2 intentos; inicial + un reenvío del mismo código tras 60s; límites persistentes 3 SMS/h y 5/24h por teléfono, sin IP. `OtpChannel` con ClickSend + Twilio, ClickSend activo, sin fallback automático. Cuenta existente recupera+rota credenciales; número nuevo completa onboarding y crea cuenta verificada sin membresía. Implementar con `AGENT-WORKFLOW.md`, migración aditiva y rama Neon efímera. |
| 33 | Web Push (notificaciones de navegador, iOS + Android) | 0037 | hecho | **IMPLEMENTADA + PASS de revisor independiente + QA en vivo del owner CERRADO (2026-08-16).** Dominio `server/push/*` (VAPID JWT ES256, cifrado RFC 8291 verificado vs el Apéndice A), tabla `web_push_subscription`, PWA (`public/sw.js` + manifest dinámico), UI `push-prompt.tsx`/`ios-install-hint.tsx`. Migración `0023` aplicada y verificada en prod. Post-QA: subject VAPID normalizado a `mailto:` (`normalizeVapidSubject`, Apple daba 403 sin esquema) e instructivo iOS rehecho (sin botón "Abrir Compartir", pasos numerados). Detalle completo en `specs/0037-web-push-notificaciones-android.md`. |
| 34 | Ruteo de notificación por clase de aviso (transaccional=wallet, fallback Web Push) + opt-in Android en la confirmación | 0038 | hecho | **IMPLEMENTADA + PASS de revisor independiente + QA en vivo del owner CERRADO (2026-08-16).** ADR 0040: `transactional` sale solo por wallet, con fallback a Web Push si no hay pase alcanzable (`consumerHasReachableWallet`) — nunca los dos a la vez (mata el duplicado hallado en el QA de iOS). `campaign` conserva el fan-out provisional. Botón "Activar notificaciones" en Android en la confirmación del enroll. Sin migración. Detalle en `specs/0038-ruteo-de-notificacion-por-clase-y-opt-in-android.md`. |
| 35 | Branding de la landing de enrolamiento (logo + color de marca) | 0039 | hecho | **IMPLEMENTADA + PASS de revisor independiente + QA en vivo del owner CERRADO (2026-08-16).** Logo del negocio (ruta pública sin exponer `logoObjectKey`) + color de marca en botones, con texto por luminancia (`readableTextColor`); card del instructivo iOS coherente con cualquier acento (`tint`/`shade`, `lib/brand-color.ts`). `/wallet` queda neutro (arco 0031). Post-QA se cazaron y corrigieron **2 bugs de subida de imagen que afectan también sello y catálogo** (comparten `lib/image-formats.ts`/`server/assets/image.ts`): alias no-IANA `image/jpg` faltante, y `normalizeImage` rechazaba fotos de teléfono >2048² en vez de achicarlas (fix paliativo `MAX_INPUT_PIXELS=50MP`; la solución de fondo —recorte en el cliente— quedó en **ADR 0041 + spec 0040**, tarea 36). Detalle en `specs/0039-branding-de-la-landing-de-enrolamiento.md`. |
| 36 | Recorte de imagen en el cliente antes de subir (cropper drag+zoom, mobile+desktop) | 0040 | hecho (QA en vivo del owner PENDIENTE) | **IMPLEMENTADA (2026-09-02) con PASS de revisor independiente en la 2ª pasada** (flujo `AGENT-WORKFLOW.md`: implementación → revisor **FAIL** por 5 hallazgos → corrección → re-review **PASS**). Cropper 1:1 `react-easy-crop` 6.2.3 en `app/components/image-cropper.tsx`, montado con `next/dynamic({ssr:false})` desde las 3 superficies; helper puro `lib/crop-image.ts` (`canDecodeImage`, `decideImageChoice`, `cropImageToBlob` con canvas inyectable). **SIN MIGRACIÓN**: el flag `cropped` viaja en el payload de guardado, no en el presign (desvío de la decisión 5 autorizado por el orquestador — por presign habría que persistirlo en 3 tablas). `normalizeImage` parametrizado: **4.2 MP** en el camino con recorte, **50 MP** en el fallback. Gates: lint, typecheck 3/3, prettier, build 3/3, **tests 259 → 310**. **Chunk diferido verificado contra manifests reales**: `static/chunks/1-5vd4y9_pvjp.js` (27K) sólo en los 3 `react-loadable-manifest.json`, **ausente** de `build-manifest.json`. **Lo que el FAIL cazó:** (1) el fallback de decode estaba *asumido* y el criterio lo prohibía explícitamente; (2) el guard del `accept` era ciego a `accept="…"` y tapaba **2 listas angostas más** en `demo/brand` y `demo/loyalty` — 4ª y 5ª aparición del bug de `CLAUDE.md`; (3) revertir `use-catalog-image` a `startsWith("image/")` dejaba la suite verde; (4) un `isAcceptedImageType` que toleraba `file.type == ""` **aflojó marca y sello** sin ganar nada (los 3 presign rechazan `""` igual). El revisor de la 2ª pasada mató **28 mutaciones** en un worktree de `/tmp`. **RESIDUAL DEL OWNER: QA en vivo con el teléfono real de la 0039** — subir una foto de galería en marca, encuadrarla, verla guardada, y **registrar si apareció el cropper o si cayó al fallback**: ese es el dato que decide el **ADR 0047 §4** (reabrir o cerrar el decoder HEVC en WASM). No cerrado tampoco: la mitad *cliente* del blob cuadrado ≤2048 (el server no valida cuadratura **a propósito**, ADR 0047 §3). **Seguimiento → spec propia:** un picker que reporta `contentType: ""` no puede subir (preexistente, no regresión). `pnpm fetch` **NO hace falta**: el store local ya quedó caliente con `react-easy-crop@6.2.3` (verificado en `.pnpm-store/v11/index.db`). Detalle en `specs/0040-recorte-de-imagen-en-el-cliente.md`. |
| 26 | Brand kit (afiche imprimible con QR de enrolamiento) | — | pendiente | **Downstream del loop.** Plantillas para un afiche imprimible con el QR que apunta a la landing de enrolamiento (0028). Reusa marca (colores/logo) y el pipeline R2. Sin spec aún; se abre cuando el QR resuelva. Las 6 decisiones abiertas ya relevadas en la conversación previa (plantillas curadas pintadas con la marca, PDF vs PNG, QR server-side, efímero vs persistido, sub-ruta en `/brand`). |
| 29 | Rebrand CheckPass Club + diseño visual de los pases de Wallet | — | parcial | **Marca decidida y cambio app-wide hecho en el commit de cierre de 0032:** UI consumer/merchant, metadata, PWA, notificaciones, Wallet y provisionador Google usan CheckPass Club. Se conservan package names e IDs técnicos históricos por compatibilidad. **Pendiente:** abrir spec para arte final de pases (Google `heroImage` + logo; Apple `strip` + logo/icon + colores), servir assets desde dominio estable y actualizar la Loyalty Class real antes del publishing access. |
| 21 | Wizard de creación + diseño visual de la tarjeta de fidelización | 0027 | hecho | **PRÓXIMA FEATURE — spec CERRADA (2026-08-13), lista para implementar.** Wizard por pasos para crear **y editar** (Puntos: unidades → TOS → preview/activar; Sellos: básicos → diseño de tarjeta → TOS → preview/activar). Diseño de tarjeta (Sellos): fondo 1 + fondo 2 opcional en **degradé lineal de ángulo configurable** + color de borde, **preview en vivo** con `round(target/2)` sellos puestos; reutiliza la imagen de sello de 0026. Las 6 decisiones abiertas cerradas con el owner: **columnas dedicadas nullable** (no jsonb) con checks hex/ángulo a nivel DB (ADR **0030**), defaults derivados de la marca, Puntos sin diseño (columnas `null`). Requiere **migración `0013` aditiva** + `CardPreview` compartido + splits por `file-size` (`use-loyalty-program.ts`, `program-editor.tsx` → `steps/*`). Implementar con protocolo `AGENT-WORKFLOW.md`: rama Neon efímera + revisor independiente antes de `implementada`. |
| 30 | Catálogo de productos del negocio | 0034 | hecho | **IMPLEMENTADA (2026-08-14) con PASS de revisor independiente.** Catálogo de **productos** en `core`: `product`/`product_category`/`product_location` (+ `product_asset_upload`/`_cleanup`) + `currency_code` en `business`. Global por negocio, **visibilidad opt-out por local**; **precio/coste opcionales** (el valor en puntos lo pone el programa por equivalencia); **categorías libres**; **sin estados** (borrado directo); imágenes a R2 (pipeline ADR 0029, DTO sin `*ObjectKey`, test por entidad). Dominio `server/catalog/*`, rutas `api/catalog/**` + `api/public/catalog/[productId]/image`, UI `/backoffice/catalog` + tarjeta de nav. Gates (typecheck 3/3, eslint, prettier, **unit 70**, build 3/3) + **integración Neon 6/6 + 99/99 total** en rama efímera; **migración `0017` aplicada y verificada en prod** (18 migraciones, backfill de moneda por país, `core`/`consumer`/`merchant_auth` intactos). Residual: QA manual del owner en deploy. Falta `git push` a `main` (espera OK del owner). Desbloquea la spec 0030. |

## Hecho

| Fecha | Que | Verificado con |
|---|---|---|
| 2026-08-08 | Documentacion de Idea 01: Pasaporte local jugable (web) | Revision del archivo en raiz |
| 2026-08-08 | Refinamiento de Idea 01: Mi Pasaporte, wallet de fidelizacion gamificada | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 02: Humbly, planes por actividad | Revision del archivo en raiz |
| 2026-08-08 | Documentacion de Idea 03: servicios confiables para el hogar en Cuenca | Revision del archivo en raiz |
| 2026-08-08 | Comparacion de tres ideas y recomendacion provisional | Revision del analisis y formulas de ingreso |
| 2026-08-08 | Investigacion de referentes y patrones de Mi Pasaporte | Revision de fuentes oficiales, casos y hoja de ruta |
| 2026-08-09 | Investigación de competencia local/nacional de fidelización, QR y promociones | Revisión de sitios y precios públicos de competidores |
| 2026-08-09 | Plan V1, roadmap, ADRs y nueve specs de producto en borrador | Revisión de documentos en `docs/` |
| 2026-08-09 | Protocolo de trabajo con agentes y plantilla de spec reforzada | Revisión de `AGENT-WORKFLOW.md` y plantilla |
| 2026-08-10 | Separación de arquitectura transversal y specs de feature | Revisión de `ARCHITECTURE.md` y spec 0004 |
| 2026-08-10 | Ciclo de vigencia de activos y retención guest definido | Revisión de ADR 0005 y DoD de spec 0004 |
| 2026-08-10 | Alcance de programas, campañas y eventos por negocio definido | Revisión de ADR 0006 y specs 0002/0003 |
| 2026-08-10 | Alcances de permiso y auditoría con snapshots definidos | Revisión de ADR 0007 y spec 0001 |
| 2026-08-10 | Owner definido como único administrador de merchant staff | Revisión de ADR 0008 y spec 0001 |
| 2026-08-10 | Cierre de local y validación de beneficios definidos | Revisión de ADR 0009 y specs 0002/0003/0006 |
| 2026-08-10 | Dominios de acceso de consumidor, plataforma y comercio separados | Revisión de ADR 0010 y spec 0001 |
| 2026-08-10 | Modelo de campañas compuesto mediante Incentive Engine definido | Revisión de ADR 0018 y Spec 0003 rediseñada |
| 2026-08-10 | Handoff para fase de arquitectura | Revisión de `docs/HANDOFF.md` |
| 2026-08-10 | Repositorio remoto canónico documentado y commit inicial local creado | `git log --oneline -1` muestra `6467628` |
| 2026-08-10 | Scaffold instalado y verificado: lockfile, install congelado, format/lint/typecheck, unit 3/3, build 3/3, contrato health exacto + 405, Playwright verde | Comandos corridos con Node 24.19.0 / pnpm 11.4.0 |
| 2026-08-10 | Diseño v0.1 de wallet contextual por comercio | Revisión manual: cover compacto, promoción futura, puntos, cupones, canjes y progreso de Bar Demo |
| 2026-08-10 | Diseño v0.1 de llegada desde QR y check-in | Revisión manual: pantalla simple, beneficios visibles y CTA único con explicación de ubicación |
| 2026-08-12 | Fix de fixture e2e: `seedDemo` con semántica seed-once (clave y tipo importados de la app) | `pnpm test:e2e` 5 passed / 1 skipped; antes fallaba en `loyalty.spec.ts` tras `page.reload()` |
| 2026-08-12 | Programa de fidelización real desplegado (Spec 0024, ADR 0027) | Gates locales (typecheck 3/3, unit 22/23, lint, build 3/3) + QA manual en vivo del owner sobre Vercel |
| 2026-08-12 | Marca real y assets R2 desplegados (Spec 0025) | Gates locales (typecheck 3/3, unit 22/23, lint, build 3/3) + QA manual en vivo del owner sobre Vercel |
| 2026-08-13 | Wizard de creación/edición + diseño visual de tarjeta de Sellos (Spec 0027, ADR 0030) | Gates (typecheck 3/3, lint, unit 33/10-skip, build 3/3) + integración Neon 6/6 + migración 0013 en prod + PASS de revisor independiente + QA manual del owner. Commits `4388662`/`967a080` |
| 2026-08-14 | Pase de Wallet Apple/Google (Spec 0029, ADR 0033, camino A 2ª rebanada) | Dominio `server/wallet/*` (provider apple/google/fake), rutas `wallet/{apple.pkpass,google}` + `/c/[token]` + página `/wallet` (QR SVG + botones). Gates (typecheck 3/3, eslint, unit 60/23-skip, build 3/3) + integración Neon 4/4 wallet + 9/9 regresión 0028 + **PASS de revisor independiente** + migración `0016` aplicada y verificada por SQL en efímera y **en prod**. Commits `4e4ba0b`/`72081e5`. |
| 2026-08-14 | Wallet en prod: Google en Android real + Apple en iPhone real (QA del owner) | Google Wallet (issuer demo gratis, class `approved`, secretos en Vercel) guarda el pase con QR en Android; Apple Wallet (cert Pass Type ID real, Team `SN489AVGUD`, WWDR G4, 5 secretos `APPLE_*`) instala el `.pkpass` en iPhone. Ambos vistos en pantalla por el owner. Setup en `docs/wallet-go-live.md`; secretos locales en `.secrets-apple/` (gitignore + pre-commit hook) |
| 2026-08-14 | Identidad de consumidor y enrolamiento (Spec 0028, camino A 1ª rebanada) | Esquema `consumer` (4 tablas) + rutas `enroll`/`me` + landing; `409 already_member`, rate-limit 3/h por teléfono, `closing` habilitado. Gates (typecheck 3/3, lint, prettier, unit 46/19-skip, build 3/3) + integración Neon 9/9 + **PASS de revisor independiente** + migración `0014` aplicada y verificada en prod (esquema `consumer` 4 tablas/10 índices/3 FK; `core`/`merchant_auth` intactos). Residual: QA manual en teléfono |
| 2026-08-14 | Catálogo de productos del negocio (Spec 0034, ADR 0034) | Dominio `server/catalog/*` + esquema `core` (`product`/`product_category`/`product_location` + upload/cleanup) + `currency_code` en `business`; rutas `api/catalog/**` + imagen pública; UI `/backoffice/catalog` + tarjeta de nav; anti-fuga `*ObjectKey`. Gates (typecheck 3/3, eslint, prettier, unit 70, build 3/3) + **integración Neon 6/6 catálogo + 99/99 total** + **PASS de revisor independiente** + migración `0017` aplicada y verificada por SQL en prod (18 migraciones; backfill de moneda por país; `core`(19)/`consumer`(5)/`merchant_auth`(4) intactos). Residual: QA manual del owner en deploy. Pusheado (`3ca3f98`); enmienda moneda→Marca + UI (`69e04f5`); fix botón (`4ea982a`) |
| 2026-08-14 | Imágenes de stock para productos (Spec 0035, ADR 0035) | Buscador Pexels server-proxied + import a R2 diferido anti-SSRF (allow-list host + `redirect:error` + tope) + atribución persistida; interfaz `StockPhotoProvider` (`pexels`/`fake`). Dominio `server/stock/*`, ruta `api/catalog/stock/search`, modal `StockPicker`. DTO sin `image_object_key`. Gates (typecheck 3/3, eslint, prettier, **unit+integración 106/106**, build 3/3) + **PASS de revisor independiente** + migración `0018` aplicada y verificada por SQL en prod (19 migraciones; esquemas vecinos intactos). Residual: `PEXELS_API_KEY` en Vercel + QA manual |
| 31 | Imágenes de stock para productos (buscador Pexels) | 0035 | hecho | **IMPLEMENTADA (2026-08-14, ADR 0035) con PASS de revisor independiente.** Botón "Elegir de biblioteca" + modal `StockPicker` (buscar on-submit + "cargar más") en el editor de producto; interfaz `StockPhotoProvider` intercambiable (`pexels`+`fake` por `STOCK_PROVIDER`), búsqueda **server-proxied** (`GET /api/catalog/stock/search`, la API key nunca al cliente, 503 sin key), import **por id anti-SSRF** (allow-list `images.pexels.com` + `redirect:error` + tope 5 MB) → `normalizeImage` → R2, diferido a Guardar; atribución persistida (4 columnas en `core.product`, migración `0018`) y mostrada ("Foto de Pexels.com · Autor: X"). DTO sin `image_object_key`. Gates (typecheck 3/3, lint, prettier, unit+integración **106/106** con anti-SSRF unit + atribución→DTO, build 3/3); **migración `0018` en prod verificada por SQL** (19 migraciones; esquemas vecinos intactos). Residual go-live: `PEXELS_API_KEY` en Vercel (owner ya la tiene) + QA manual. Cierra el catálogo (0034+0035). |
| 2026-08-14 | Mecánica de acumulación + premios del programa (Spec 0036, ADR 0036) — **implementada localmente, PASS de revisor, sin commitear** | Programa de fidelización gana mecánica (`accrual_mode`/`accrual_grant`/`accrual_block_amount` + 5 checks en `core.loyalty_program`) y premios (tabla `core.loyalty_reward`: `catalog_product`/`custom`/`discount`, `points_cost`, `position` + 4 checks). Server: `loyalty-program/{accrual,rewards,persistence}.ts`, `validateAccrual`/`validateRewardsInput`/`resolveRewards`, `computeAccrual`=floor(total/Y)×X sin arrastre, `saveProgram` atómico (create=`db.batch`; edit=CTE `updated/logged/deleted/inserted` con reescritura de premios condicionada al guard `status='active'`), DTO `toClientProgram`+`toRewardDTO` con `accrual`+`rewards`+`imagePath`, **sin fuga de `*ObjectKey`**. Wizard: paso mecánica en términos (`accrual-fields.tsx`, ejemplo en vivo), paso premios nuevo (`step-rewards.tsx`, $-equivalente en vivo), métrica de valor en review. Gates **corridos por el revisor independiente**: typecheck 3/3, lint, prettier del scope, **unit 93/36-skip** (+21 nuevos), build 3/3, **integración Neon 10/10** en rama efímera propia del revisor (atomicidad con guard, aislamiento por negocio 422, checks de DB rechazan inválidos, hidratación de programa legacy). Migración `0019_kind_guardsmen` verificada en Neon efímero **y aplicada+verificada en prod por SQL** (20 migraciones; 3 columnas accrual + 5 checks; tabla `loyalty_reward` + 4 checks; `core`(20)/`consumer`(5)/`merchant_auth`(4) intactos). **Único residual: QA manual del owner en vivo. Prerequisito duro desbloqueado para la spec 0030.** |
| 2026-08-14 | QA del owner en vivo sobre spec 0036 — 3 refinamientos de UX del wizard (prod) | (1) Copy del $-equivalente en el paso de premios más claro: recuerda la tasa arriba ("Tu tasa: 100 Puntos por cada BRL 5,00") y cada premio explica el cálculo trazable ("El cliente gasta ≈ BRL 5,00 para juntar 100 Puntos y ganar este premio"), commit `9ce0acc`. (2) Auto-sugerencia del costo en puntos: al elegir/cambiar un producto del catálogo, el costo se re-siembra para que el gasto cubra el precio del producto (`suggestPointsCost` = ceil(price/block)×grant, redondeo al siguiente bloque $Y; editable), commit `7262321` (+6 unit). (3) Preview de valor más potente: venta absoluta por canje en cada premio + reencuadre "Generás un X% más en ventas de lo que regalás" + aviso en rojo si un premio regala más de lo que genera (ratio<1), commit `b779874`. Gates verdes cada vez (typecheck, lint, unit 96/36-skip, build 3/3). Todo UI/derivado; sin cambios de contrato ni datos. |
| 2026-08-15 | Acreditación en mostrador (Spec 0030, camino A 3ª rebanada) — **implementada + PASS de revisor independiente** | Dominio `server/counter/*` + rutas `api/counter/{resolve,grant}` + UI `/backoffice/counter` (scanner `BarcodeDetector`+`jsqr`, detallada/rápida, Confirmar 1-tap). Otorgamiento atómico (CTE guardado `persistGrant`: bump `NOT EXISTS(order)` + `ON CONFLICT DO NOTHING`) e idempotente por `unique(business_id, client_request_id)`; sonda 8-way del revisor = 1 orden, sin doble-bump. Anti-fuga allow-list (test). Gates: typecheck 3/3, lint, prettier, **unit 106/44-skip**, build 3/3, integración Neon **8/8** counter + **25/25** regresión en rama efímera. **Migración `0020_harsh_venus` aplicada y verificada por SQL en prod** (21 migraciones; `core.order`/`order_item` + saldo en `program_membership`; `core`(22)/`consumer`(5)/`merchant_auth`(4) intactos). Paquete `jsqr`. Residual: QA manual del owner en teléfono. Commit local; falta `git push` a `main` (espera OK del owner) |
| 2026-08-15 | **Spec 0030 (acreditación en mostrador) CERRADA con el owner — punto de retorno** | Revisión del doc `specs/0030-…md` (estado `cerrada`, `Abierto` sin bloqueos) + fila en INDEX. **Comportamiento cerrado punta a punta:** consola web móvil `/backoffice/counter` (URL del backoffice, cámara del teléfono, bookmarkable, auth `merchant_auth`) → escanea el QR → resuelve/**auto-enrola** la membresía del negocio (ADR 0033) → toggle **venta detallada** (carrito del catálogo 0034 → total) / **venta rápida** (importe + nota, **inmutable** — sin edición, para no ensuciar la estadística de producto) → `computeAccrual` (0036) → otorga. **4 decisiones del owner ratificadas (2026-08-15):** (1) **solo acreditación**, el canje es otra feature/URL/mecánica (fuera del alcance); (2) la **orden ES el ledger de auditoría** en `core`, **owner-facing** (analítica del negocio, no se expone al consumidor); (3) **idempotencia en dos capas** — DB `unique (business_id, client_request_id)` **+** UI que deshabilita Confirmar al primer tap; (4) **`location_id` siempre registrado** (fijable por `?location` en el bookmark). **Modelo nuevo:** saldo por membresía (`points_balance`/`stamps_count` en `consumer.program_membership`) + `core.order`/`order_item` con snapshot; otorgamiento atómico (CTE 0024/0028). **QR:** `BarcodeDetector` + fallback JS (**re-warm del store de pnpm antes de codear**). **La notificación (paso 6) es la spec 0031** (0030 emite el evento; 0031 entrega + landing en vivo) → **serializar 0031 después de 0030**. Dependencias duras satisfechas (0028/0029/0034/0036 implementadas). **Prod limpio de programas** (crear uno con mecánica para probar). **Próximo paso: implementar 0030** con `AGENT-WORKFLOW.md`. |
| 2026-08-15 | **Spec 0033 (canal de push del pase de Wallet) CERRADA con el owner + ADR 0037** | Revisión de los docs: ADR **0037** (cola `wallet_push_queue` como **outbox transaccional** en el grant de 0030; prioridad `transactional`>`campaign` + cooldown por-consumidor; slot "Última novedad"; dispatch inmediato best-effort + worker de cron) + spec **0033** `cerrada` (`Abierto` sin bloqueos) + filas en INDEX. **Alcance cerrado:** web service PassKit `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve/log; auth `ApplePass` vs `auth_token_hash`; **rate-limit por serial, no IP**), **APNs JWT ES256 con `.p8` sobre HTTP/2 nativo (sin paquetes nuevos)**, `addMessage`/`PATCH` de Google (mismo service account), `wallet_push_device`, y `rotatePassCredentials` (lo invoca la 0032). Migración aditiva `0021`. **Externo:** owner generó la APNs auth key `.p8` (Apple Developer, Team `SN489AVGUD`, entorno Both, scope unrestricted); faltan 3 secretos `APPLE_APNS_*` en Vercel. **Disjunta: no** (enqueue en `counter/orders.ts` de 0030; serializar 0032/0031). Solo docs, sin commitear |
| 2026-08-15 | **QA en vivo del owner sobre spec 0030 — cerrado punta a punta, cierra el camino A hasta la acreditación** | Owner probó el flujo real sobre el deploy: creó QR de enrolamiento manual apuntando a `/enroll/<programId>` de Fybeca 3, "Test 1 Cliente" se auto-enroló al ser escaneado, venta rápida ($30 → 100 pts) y venta detallada (Café con leche $5 → 10 pts) verificadas por SQL contra prod (saldo final 110, `floor(total/3)×10` exacto en ambas, `order_item` con snapshot correcto). **Cuatro hallazgos de UX resueltos en dos rondas, gates verdes cada vez, pusheadas a `main`:** (1) `eb4c9a8` — toast "Cliente identificado" al resolver el QR (antes saltaba directo al form), preview en vivo no editable de cuántos puntos/sellos otorga la venta actual (mismo cálculo que `computeAccrual`, solo informativo), fix de estilo de los inputs del mostrador (WebKit los pintaba grises sin `background`/`color` explícito, parecían deshabilitados); (2) `610ad31` — se quitó el reinicio automático a los 4s de la pantalla "hecho" (dejaba muy poco tiempo para leer el resultado); ahora es 100% manual vía "Escanear siguiente". Spec 0030 actualizada con la enmienda. **Permiso de cámara repetido en cada ingreso: no es bug del código** — comportamiento propio del navegador (ej. Safari iOS pregunta cada vez salvo que se fije "Permitir" en Configuración del sitio), documentado en el commit, no accionable desde la app. **Con esto la 0030 queda 100% cerrada, sin residuales técnicos.** La notificación al consumidor en su teléfono (paso 6 del flujo) sigue siendo la **spec 0031**, que depende de la **spec 0033** (canal de push del pase de Wallet) como prerequisito técnico. **Próximo paso: cerrar el diseño de la spec 0033 con el owner** (hoy stub/borrador) e implementarla con `AGENT-WORKFLOW.md`. |

| 2026-08-15 | Canal de actualización y push de Wallet (Spec 0033, ADR 0037, camino A 4ª rebanada) — **implementada + doble PASS de revisor independiente** | Cola `wallet_push_queue` (outbox transaccional en el `WITH` de `persistGrant`; rollback→sin fila, retry idempotente→sin dup) + worker `/api/internal/wallet-push` (cron + dispatch inline best-effort) con prioridad transaccional>campaign + cooldown por-consumidor (`planConsumerDrain` puro, reloj inyectable) + claim race-safe (`pending→sending` `UPDATE…RETURNING`) + reaper de filas `sending` huérfanas (`not_before` = deadline de reclamo, `STALE_CLAIM_MS`). Web service PassKit `/api/public/wallet/passkit/v1/*` (register/unregister/list/serve 200/304/log; auth `ApplePass` vs `auth_token_hash` en tiempo constante; rate-limit por serial→429). APNs JWT ES256 con `.p8` sobre HTTP/2 nativo (verificado con la pública en unit), Google `addMessage` (mismo SA), `PushChannel` intercambiable (`fake`). `rotatePassCredentials` (rota `qr_token`+`web_view_token`, borra devices, encola re-emisión; old qr_token deja de resolver). Anti-fuga por entidad (`push_token`/tokens nunca serializados). **Flujo `AGENT-WORKFLOW.md`:** implementador → revisor **FAIL** (worker sin test ejecutable + sin reaper) → corrección → **re-review PASS**. Gates: typecheck 3/3, lint, prettier, **unit 118**, build 3/3 + **integración Neon 21/21** (worker 6 + wallet-push 6 + wallet 4 + counter 5) en ramas efímeras. **Migración `0021` aplicada y verificada por SQL en prod** (22 migraciones; 3 col nullable + 2 tablas + índices/checks; `consumer` 5→7; `core`(22)/`merchant_auth`(4) intactos). Residual: 3 secretos `APPLE_APNS_*` en Vercel + QA Android/iPhone real. Commit local; falta `git push` (espera OK del owner) |

| 2026-08-15 | QA en vivo del owner sobre la 0033 (push del pase) — 3 fixes en prod + spec 0037/ADR 0038 abiertos | (1) **Deploy en Vercel Hobby**: el cron `*/5` de `wallet-push` era el 3º y sub-diario → Hobby rechazaba el deploy entero (máx 2 crons, solo diario), Production clavado en el commit previo. Fix: se quitó el cron nativo de `vercel.json`; el push del momento se dispara **inline con `after()`** (Next 16, no lo congela Vercel) y la red de reintentos la cubre un **scheduler externo gratis** (`.github/workflows/wallet-push-cron.yml` o cron-job.org) contra el endpoint ya autenticado por `CRON_SECRET`. Al pasar a Pro se re-agrega el cron nativo. Commit `d345263`, deploy **verde**. (2) **Google `addMessage` con `messageType: TEXT_AND_NOTIFY`** (sin eso agrega el aviso al pase en silencio, sin notificación). Commit `8566ca9`. (3) **Mensaje como frase completa** "Se acreditaron X puntos en tu cuenta 🎉" (antes "+X puntos"). Commit `3758a94`. Verificado por SQL en prod: 2 grants → cola `sent`, `attempts=0`, `last_error=null`; notificación llegó al Android real del owner. **Límite de Google confirmado:** el banner de Android es genérico ("Mensaje nuevo / Presiona para ver el pase"), el emisor no controla ese texto (el aviso rico va dentro del pase); en iOS el `changeMessage` sí se ve en la notificación. Eso motivó la **spec 0037 (Web Push, solo Android) + ADR 0038** (dos transportes wallet/browser). Gates verdes cada commit (typecheck 3/3, lint, unit 118, build 3/3) + integración 21/21. |

| 2026-08-15 | QA en vivo del owner del push de Wallet (0033) VALIDADO en iOS + Android + fix del token estable (PASS de revisor) | **iOS (iPhone real):** con pase fresco, push al instante + "Última novedad" con texto rico "Novomundo: Se acreditó 1 sello en tu cuenta 🎉". **Android real:** ídem vía Google (`TEXT_AND_NOTIFY`). La latencia de un 2º push seguido = throttling de background de APNs (Apple), no bug. **Bug encontrado y arreglado production-grade:** el `authenticationToken` se re-acuñaba en cada emisión/serve → re-agregar el pase divergía el hash guardado del token instalado → **401** → iOS no podía tirar el pase (quedaba "—"). Fix: token **estable por pase** (`wallet_pass.auth_token`, migración aditiva **`0022`**, generado una vez en `ensureWalletPass`, reusado en emisión/serve, re-mint eliminado; `authorizePass` en tiempo constante + fallback legacy + backfill hacia adelante). Implementador + **revisor independiente PASS**; gates (typecheck 3/3, lint, prettier, **unit 130**, build 3/3) + integración Neon **17/17** en ramas efímeras (incluye test de estabilidad re-emisión). **Migración `0022` aplicada y verificada por SQL en prod** (23 migraciones; `auth_token` presente; `core`(22)/`consumer`(7)/`merchant_auth`(4) intactos). Enmiendas de observabilidad previas del QA: last_error de APNs/Google registrado; frase completa; `TEXT_AND_NOTIFY`. Ramas efímeras auto-expiran 2026-08-18. Residual menor (revisor): pase legacy que no aplique el backfill se re-agrega una vez. |

## Descartado (y por que)

Los caminos descartados importan: sin registro, se reintentan.

| Que | Por que no |
|---|---|
