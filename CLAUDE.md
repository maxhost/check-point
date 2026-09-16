# CLAUDE.md

> Instalado por GlaDOS (plantilla del arnes v1). Es tuyo: editalo con el uso —
> cada error observado del agente deberia volverse una linea aca o un hook (mistake→rule).

Directrices del proyecto. Se cargan siempre y cuestan tokens en cada request — aca va
solo lo que cambia una decision. Lo derivable del codigo no va: leelo del arbol.

- **`docs/INDEX.md`** — mapa de ADRs y specs. **Empeza aca**, no leas todo.
- **`docs/TASKS.md`** — estado actual. El punto de retorno si esta sesion se cae.
- `.claude/settings.json` — lo que esta enforced (hooks + permisos).

## Flujo de trabajo

1. **Leer `docs/TASKS.md` antes de empezar.** Es el estado real, no lo que diga el chat.
2. **Ninguna tarea toca codigo sin su spec cerrada** (`docs/specs/`, plantilla en
   `TEMPLATE.md`). La subespecificacion es el gatillo medido del exito fingido: en tareas
   resolubles y bien definidas el reward hacking cae a 0%; en tareas vagas, ~50%.
3. **Toda decision de diseño genera un ADR** (`docs/adr/`) con fecha y `resumen` de una
   linea en el frontmatter. El resumen es lo que se lee sin abrir el archivo.
4. **Agregar la fila a `docs/INDEX.md` en el mismo commit.** Un indice viejo es peor que
   ninguno.
5. **Actualizar `docs/TASKS.md` al terminar.** Hay un hook `Stop` que lo exige si quedo
   viejo respecto del codigo tocado.
6. **Marcar `hecho` solo con verificacion real** — test que pasa, comando corrido, cosa
   vista en pantalla. Nunca "deberia andar".
7. **Implementar con el protocolo de `docs/AGENT-WORKFLOW.md`.** Una spec cerrada se
   entrega a implementador y después a revisor independiente; solo un PASS verificable
   permite marcarla como implementada.

## Estado

**Lo que tiene que sobrevivir va a un archivo, no a la conversacion.** La compactacion
borra lo que vive solo en el chat; el disco se re-lee. Un plan que es un mensaje no es
un plan.

**Handoff SIEMPRE seguido de `/clear`.** El handoff baja el estado a disco pero NO libera
la ventana de contexto. Orden sagrado: handoff PRIMERO (a disco), clear DESPUES. Nunca
compact: comprime con perdida.

## Verificacion

**Ninguna afirmacion de exito vale sin una señal que el modelo no genero** — tests,
typecheck, exit code. La auto-revision sin oraculo es negativa neta.

**Mistake→rule:** cada error observado del agente se convierte en un fix estructural
permanente — un hook si se chequea con un comando, una linea aca si es advisory. Nunca
la misma correccion dos veces a mano.

**Antes de pedirle QA al owner, verificar que prod tenga EL COMMIT que se va a probar** —
no que "prod este verde". `GH_TOKEN= gh api repos/maxhost/check-point/commits/<sha>/status
--jq '.state'` tiene que decir `success` para el sha exacto. Paso de verdad (spec 0040): se
commiteo sin pushear y el owner probo el build anterior; dos items del QA fueron invalidos y
el diagnostico arranco persiguiendo un bug que no existia.

**Lo que el owner no dijo explicitamente NO se escribe como decision suya.** Si al
implementar aparece un efecto lateral que nadie acordo (orden de statements, un caso borde),
va como *hallazgo a decidir*, nunca como "aceptado, declarado en el handoff". Paso en la spec
0053: se dedujo del orden del codigo que el 409 actualizaba el nombre y despues rechazaba, se
escribio en la spec y el ADR como acordado, y el owner lo rechazo **dos veces** — la segunda
obligo a revertir la spec entera (ADR 0050 supersedido por el 0051). Una spec que inventa un
acuerdo es peor que una spec incompleta: la incompleta se pregunta, la inventada se implementa.

**Un residual heredado puede estar YA SALDADO por una spec posterior — verificalo antes de trabajarlo, y aplica
la misma sospecha a TODOS los items de esa nota.** Los hallazgos de un revisor quedan escritos con la foto del
dia; las specs siguen. Paso en la tarea 38: el item (2) ya lo habia resuelto la spec 0051 (se detecto y se
verifico por mutacion), pero **la premisa del item (1) estaba viciada por la misma spec y eso no se chequeo** —
se implemento el fix correcto con un "por que" falso, escrito en la tarea y en un comentario del codigo. Lo cazo
el revisor independiente. Si un item de una nota vieja resulto obsoleto, sus hermanos son sospechosos.

**Un comentario que afirma "atomico e idempotente por EvalPlanQual" no es una prueba —
demostralo con `EXPLAIN` + una carrera real que asevere el saldo por SQL.** `orders.ts`
(spec 0030) documentaba que un `NOT EXISTS` sin correlacionar, dentro de un CTE junto al
`UPDATE`, se re-evaluaba bajo concurrencia (EvalPlanQual) y por eso el otorgamiento nunca
duplicaba. **Es falso, y estaba en produccion:** Postgres lo planea como `InitPlan` +
`One-Time Filter` — se evalua UNA vez, ANTES del lock. Verificado al disenar la spec 0055
(canje): dos requests concurrentes con el MISMO `client_request_id` acreditaron el saldo
DOS veces, con una sola fila de auditoria que reportaba el saldo intermedio — la API
mentia con total confianza (ADR 0054, spec 0056). El guard que si se re-evalua es el que
vive en el `WHERE`/`Filter` del scan que se actualiza (ej. `saldo >= costo`), nunca un
`NOT EXISTS` de otra tabla en un CTE previo. Cualquier claim de "esto es idempotente/atomico
bajo concurrencia" en SQL nuevo se cierra con un `EXPLAIN` del plan real **y** un test que
lance el statement dos veces en simultaneo y lea el estado final por SQL — nunca con una
lectura del codigo, por mas que "EvalPlanQual deberia cubrirlo".

**UN DISCRIMINANTE DE INTENCION NO PUEDE LEERSE DE UN CAMPO QUE EL OTRO LADO TAMBIEN ESCRIBE.**
La spec 0063 tenia que distinguir «esta baja la pedimos NOSOTROS» de «la pidio otro», y eligio
`pending_plan` como discriminante afirmando «no hace falta ninguna columna nueva». **Era
falsificable por el actor del que habia que defenderse, y se demostraba leyendo la propia spec
dos secciones mas abajo:** el webhook escribe `pending_plan='free'` ante cualquier
`cancel_at_period_end`, que es justo lo que setea el boton del dashboard de Stripe. Resultado:
cancelar desde el dashboard con 3 locales activos clasificaba la baja como «esperada» y aterrizaba
en `free` con 3 activos — el estado que la spec entera existia para prohibir. Lo cazo un revisor
independiente en la segunda ronda. **Al elegir el campo que prueba una intencion, preguntá quien
mas puede escribirlo**; si la respuesta no es «solo nuestro codigo», no es un discriminante, es
una coincidencia. Reusar una columna existente «para no agregar una nueva» es la forma que toma
este error, y se siente como economia.

**UNA PROPIEDAD UNIVERSAL NO SE CIERRA CON MUTACIONES: SE CIERRA CON UN ORACULO ACOTADO MAS UN LIMITE DECLARADO.**
«Esto no filtra nada por ningun canal», «este dato no cruza nunca» y familia son afirmaciones **universales**, y
**ningun conjunto finito de mutaciones las demuestra** — siempre queda un canal mas. Paso en la spec 0063: el oraculo
de fuga de la pagina de suscripcion llego a **SEIS** vueltas, cada una cazada por un revisor plantando un canal nuevo
(el markup, `JSON.stringify`, la allow-list de claves, el **conteo de lecturas**, `element.key`, el **estado
parcial**), con una septima ya empezada cuando el **owner** corto el ciclo preguntando por que una feature de upgrade/
downgrade llevaba horas. **El riesgo real se habia cerrado en la PRIMERA vuelta** (el DTO omite las claves + el test
de que el HTML no las contiene); todo lo demas exigia que alguien escribiera la fuga a proposito, y las mutaciones se
volvieron irreales (un `Proxy` que devuelve el secreto solo en la 1a lectura, un base64 como `type` del elemento).
**El defecto es del ORQUESTADOR, no de los revisores:** ellos hicieron exactamente lo encargado; **el que tiene que
poner la condicion de corte es el que encarga**. Al abrir una revision sobre una propiedad universal: (a) decidí de
antemano que clase de error tiene que cazar el oraculo —los PLAUSIBLES— y escribilo en el encargo; (b) lo que quede
afuera se **declara** (con la misma exigencia de siempre: intentado, no supuesto); (c) **si dos rondas seguidas
terminan en «el fix abrio la preimagen siguiente», eso no es mala suerte: es la señal de que la propiedad es
universal y de que el bucle no termina solo.** Ver ADR 0062.

**TODA VERIFICACION LLEVA PRESUPUESTO Y CONDICION DE CORTE ESCRITOS EN EL ENCARGO — Y EL ORACULO QUE
DEFINE ES EL QA DEL OWNER, NO LA SUITE.** Instruccion literal del owner (2026-09-13, despues de que la
spec 0064 se comiera una sesion entera): «no podemos quedarnos eternamente gastando tokens en cosas que
no acaban, loops de test, loops de errores, loops de webhooks muertos. Necesitamos planificar, revisar
que es production grade, implementar y probar un QA que nos de la verdad; claro que algun test en el
medio esta definido, pero se te esta yendo la mano». **Lo que lo gatillo:** el orquestador encargo
**14 mutaciones** para revisar una fase; **las primeras 4 ya habian dado todo el valor** (un hallazgo
real) y las otras 10 eran inercia. Es el ADR 0062 otra vez —el que tiene que poner el corte es el que
ENCARGA— pero generalizado: no solo a las propiedades universales, a **toda** verificacion.
Reglas practicas: (a) al encargar una revision, escribi **cuantas mutaciones** y **que clase de error**
tiene que cazar; lo que quede afuera se declara. (b) **Ningun ciclo de verificacion se reabre porque
"quedo una preimagen mas"**: si dos vueltas seguidas terminan en «el fix abrio la siguiente», eso no es
mala suerte, es la señal de cortar. (c) **Entre una evidencia mas y una pantalla que el owner pueda
probar, gana la pantalla** — el QA humano encuentra lo que ninguna mutacion ve (los 4 huecos de UI de
la 0063 salieron asi, y ninguna spec los pedia). (d) Un hallazgo que **no es riesgo de produccion** se
DECLARA y se sigue; no se persigue. (e) Si una fase no llego a pantalla, cortar la verificacion y
llevarla al QA es la decision correcta, no una rendicion.
**(f) Corolario de la 0064, que costo cinco agentes cortados a mitad: cuando un encargo no entra en un
turno, REANUDAR sale mas caro que terminarlo a mano.** Cada muerte obliga a auditar el arbol antes de
seguir (una mutacion viva es indistinguible de un bug real) y a reconstruir contexto. El cierre lo hizo
el orquestador a mano en una fraccion del tiempo: los 11 errores que quedaban eran imports huerfanos de
archivos a medio partir, no bugs. **Si un encargo ya murio DOS veces, no lo despaches una tercera:
terminalo vos y manda a un agente solo lo que sea de verdad independiente.**

**Las reglas verificables van en hooks, no aca.** Los hooks corren fuera del contexto,
cuestan cero tokens y son deterministas; este archivo es advisory. Si una regla se puede
chequear con un comando, es un hook — no la escribas aca tambien.

**UN LIMITE DECLARADO ES UNA AFIRMACION COMO CUALQUIER OTRA: verificalo antes de escribirlo.**
Un limite sobredimensionado **se ve virtuoso** —parece honestidad— y hace exactamente el mismo
daño que un `[x]` inflado: le regala a quien herede el arbol la creencia de que algo no se puede
probar, y nadie vuelve a intentarlo. Paso en la spec 0057: se declaro que «el aviso del login no
tiene oraculo porque el vitest de merchant corre en `environment: "node"` sin jsdom», y de ahi
viajo a `docs/TASKS.md` y a `docs/INDEX.md`. **Era cierto solo para la INTERACCION.** El
**renderizado** —que era el DoD #1 y el pedido literal del owner— se pinnea **sin instalar
nada**, con `react-dom/server` (`renderToStaticMarkup`) bajo ese mismo `environment: "node"`; el
revisor independiente lo demostro escribiendolo, 2/2 en verde. Es el ADR 0054 otra vez, en su
version mas dificil de ver: no un invariante falso afirmado de mas, sino una **imposibilidad
falsa afirmada de menos**. Antes de escribir «esto no se puede testear», **intenta testearlo**;
y si el limite es real, acotalo a la parte exacta que lo es (aca: la interaccion, no el render).
**Corolario para el orquestador: un limite que te reporta un subagente no se relata al owner ni
se baja a un doc sin verificarlo** — es una afirmacion de exito («ya lo pense, no se puede»)
disfrazada de cautela.
**Y la generalizacion, que costo que el owner la preguntara: NO ES SOLO EL LIMITE — ES TODO HALLAZGO
DE UN SUBAGENTE.** Un revisor que te entrega «esto esta mal, mira `archivo:linea`» te esta dando una
afirmacion, y una cita **no es una verificacion**: es un puntero a donde verificar. En la revision
adversarial de la spec 0065 el orquestador recibio 16 bloqueantes de tres revisores, **verifico 2** y
bajo los otros 14 a la spec, al `INDEX` y al relato al owner tal como vinieron. El owner pregunto
«¿probaste esos resultados de forma empirica antes de tomarlo para el plan final?» y la respuesta
honesta era **no**. Al verificarlos: los 16 eran ciertos —o sea que el riesgo no era el falso
positivo— pero **aparecio un 17.º que ninguno de los tres habia visto**, y solo aparecio porque
verificar significo **correr el SQL** en vez de releer la cita (`on conflict` contra un indice
parcial, abajo en Gotchas: el tick reventaba en su primera corrida). **Verificar un hallazgo ajeno no
es auditarlo por desconfianza, es la unica forma de encontrar el que falta.** Regla: ningun hallazgo
de subagente entra a una spec, a un ADR, al `INDEX` o a un mensaje al owner sin que vos hayas
reproducido la evidencia — el `grep` corrido, el archivo leido, el statement ejecutado. Y si el
hallazgo es sobre semantica de la base, se reproduce **en una base**, no en la cabeza.
**Y el limite no siempre dice «no se puede»: a veces dice «cuesta X», y esa forma es la que se
cuela.** La spec 0063 declaro que cerrar el solape del claim «costaria un lock explicito o una
columna `processing_at` con lease». Falso: el lease entra en la columna **`received_at` que ya
existe**, como un predicado mas en el **mismo** `setWhere` — sin columna, sin migracion, sin lock,
y con el `EXPLAIN` poniendo los **dos** predicados en el mismo nodo post-lock. **El orquestador lo
relato al owner y lo bajo a `docs/TASKS.md` tal como vino del handoff**, y encima sostenia una
recomendacion («aceptar el limite»), o sea que **un precio inventado estuvo a punto de torcer una
decision del owner**. Lo cazo el revisor independiente. **Un COSTO declarado es un limite
declarado:** «no se puede» y «costaria una migracion / una columna / un refactor grande» se
verifican igual —intentandolo— y ninguno de los dos se le pasa al owner como insumo de decision
sin haberlo hecho. Es mas facil de tragar que una imposibilidad, porque suena a ingenieria
prudente en vez de a rendicion.

**Y el corolario que costo una segunda vuelta: al CORREGIR un limite sobredimensionado, el
limite nuevo tampoco vale sin intentarlo.** En la misma spec 0057, la correccion del limite
—«queda afuera la interaccion, porque requiere disparar un evento y no hay jsdom»— resulto
igual de falsa: el revisor la pinneo con `vi.mock("react")` sobre `useState`, ~45 lineas, cero
paquetes nuevos, y demostro con una mutacion que **se podia romper ese DoD con los 5 gates en
verde**. Sub-corregir se siente como rigor (se acoto el limite, se admitio parte) y deja el
mismo agujero mas chico. **La pregunta al escribir un limite no es «¿suena honesto?» sino
«¿intente exactamente esto que estoy declarando imposible?»** — y la respuesta se demuestra con
el intento, aunque termine descartado por invasivo.

**Que un test MUERDA no dice QUE propiedad pinnea — eso solo lo dice la mutacion, y la
atribucion equivocada es tan peligrosa como la ausencia de test.** La spec 0055 declaraba que
sacar el `FOR UPDATE` ponia roja «la carrera de mismo `clientRequestId`». Se ejecuto: esa carrera
queda **VERDE** sin el lock, porque para ese caso el **indice unico solo ya alcanza** (el `23505`
aborta y revierte el `UPDATE` del saldo). El `FOR UPDATE` si es load-bearing, pero su oraculo es
**otro** test —el de 8 canjes concurrentes, que pasa de 1 exito a 8—, y las mutaciones (a) y (b)
de esa spec resultaron **indistinguibles** entre si, contra lo que el plan afirmaba. Nadie lo
habria notado: la suite estaba verde y el nombre del test sonaba a que cubria el lock. Es el ADR
0054 otra vez —un documento afirmando un invariante que el test no pinnea— pero del lado del plan
de pruebas. **Corolario: al escribir un plan de mutaciones, la fila «mutacion X → rojo el test Y»
no se predice, se EJECUTA y se transcribe el resultado.** Un par mutacion↔test escrito de memoria
le regala a quien herede el arbol una cobertura que no existe.

**Y el corolario que solo se ve despues de varias rondas: LA TABLA DE MUTACIONES SE ESCRIBE DESDE
EL DISEÑO, ASI QUE SISTEMATICAMENTE NO VE LO QUE EL CODIGO TERMINO AFIRMANDO.** La fase D1 de la
spec 0063 cerro con **CUATRO bloqueantes consecutivos de la MISMA familia** —un invariante
declarado que ningun test pinnea— y **los cuatro salieron de mutaciones FUERA de la tabla**: el
guard `createdNow` del revert, el alias de `settle-free` sobre una suscripcion viva, la
`idempotencyKey` fija del `checkout`, y el `cancel_at: null` de `resume`. Ninguno estaba en el plan
de pruebas, porque el plan se escribio antes de que existieran esos docblocks. **Un docblock
normativo es una AFIRMACION, y cada afirmacion necesita un oraculo o una declaracion explicita de
que no lo tiene.** Regla practica al cerrar una fase: **listá los comentarios del codigo nuevo que
afirman un invariante —los que dicen «esto es lo que hace que X», «sin esto pasaria Y»— y mutá cada
uno.** Los que queden verdes son el trabajo que falta.
**Dos agravantes reales, los dos de esa misma fase:** (1) el cuarto bloqueante vivia en un docblock
que **el delta anterior acababa de editar** para cerrar un menor — o sea que tocar un comentario no
lo verifica, y la mano que lo edita es la que menos lo duda; y (2) un docblock falso **no es
pasivo: causa errores de metodo**. El de `readBody` decia que `cancel`, `resume` y `settle-free`
usaban la tolerancia —**ninguna de las tres la llama**— y esa frase fue exactamente la que hizo que
la primera sonda se escribiera contra `cancel` y **saliera VERDE por el motivo equivocado**. Un
comentario mentiroso no espera a que alguien lo lea mal: lo induce.

**UN ORACULO QUE INSPECCIONA UN OBJETO TIENE QUE LEERLO IGUAL —Y LA MISMA CANTIDAD DE VECES— QUE EL CONSUMIDOR REAL.**
Es el **ADR 0062**, y costo cuatro vueltas: probar que un server component no filtra al navegador salio VERDE con la
fuga puesta usando el render del HTML (`renderToStaticMarkup` **no emite el payload RSC**), usando `JSON.stringify` de
las props (borra `Map`/`Promise`, que **Flight si manda**, y `Promise.resolve(row)` **es el idiom de Next 15**), y
usando una allow-list de CLAVES (un `cus_…` en **base64** bajo una clave permitida la pasa entera). La cuarta es la
mas fina: con `toEqual` exacto, **el test leia cada prop dos veces y Flight una** — un **getter con estado** o un
**`Proxy`** devuelven el secreto en la primera lectura y el valor legitimo en la segunda, 15/15 en verde. **Se cierra
con una LECTURA UNICA (`structuredClone`) y valor exacto.** Corolarios: **todo guard por forma o por substring tiene
preimagen por TRANSFORMACION**; y antes de creerle a un guard sobre serializacion, **medi que manda el serializador de
verdad** con una sonda — sin eso no distinguis una **fuga** de un **limite** (ahi se separo «Flight no manda props
extra de arrays» = limite, de «Flight si manda el base64» = fuga).

**Una mutacion se revierte SIEMPRE, y se etiqueta mientras esta puesta.** Un implementador de
la spec 0055 murio a mitad de sus mutaciones y dejo `counter/core.ts` sin el filtro
`status = 'active'`: la integracion daba 25/26 y **el rojo parecia un bug real del producto**
(«un miembro `disabled` puede operar el mostrador»). **Un rojo de mutacion y un rojo de bug son
indistinguibles desde afuera**, y el default de quien hereda el arbol es creerle al sintoma —
perseguir un bug que no existe, o «arreglarlo» tapando la mutacion. Enforced por el hook
`no-mutations-left.sh` (Stop), que **solo ve mutaciones ETIQUETADAS** con `MUTATION`: no es un
detector de codigo mutado, es el cierre de esa convencion. Por eso todo encargo a un
implementador exige etiquetar la mutacion y revertir con `shasum` antes de cualquier otra cosa.

**Caso del ORQUESTADOR: si el hook `no-mutations-left.sh` te marca una mutacion de un subagente que
TODAVIA ESTA MIDIENDO, no la revientes — el hook no puede distinguir «viva» de «abandonada», y vos
si.** Cortarla bajo un agente vivo lo hace transcribir un resultado falso, que es peor que el rojo
que el hook previene. Lo correcto: verificar que este **etiquetada y atribuida**, y dejar en
`docs/TASKS.md` **el comando exacto de restauracion y el `shasum` limpio**, para que si la sesion
se cae la proxima no tenga que reconstruir nada. Lo que NO puede pasar es que sobreviva a la sesion.
**Y dos precisiones que salieron de vivirlo (fase D2): (a) el reclamo del hook es una FOTO VIEJA** — entre que corre y
que vos lo leen, la mutacion puede ya estar revertida (paso: `shasum` y `diff` contra la copia limpia daban identico al
baseline, y lint volvia VERDE re-corrido). **El primer comando no es `git checkout`: es `ListAgents` para ver si el
subagente esta vivo, y re-leer el archivo.** Las dos respuestas posibles —viva, o ya revertida— prohiben tocarla, y
ninguna se sabe sin mirar. **(b) Ojo con el rojo COLATERAL de la mutacion, porque su fix «obvio» puede ser un bug
real:** R9 (sacar `lockBusiness` de la lectura) dejaba el import sin usar y `verify.sh` tiraba lint rojo; el arreglo
evidente era **borrar el import**, o sea consolidar «la pagina lee sin lock» mientras se tapaba la medicion. Un gate
rojo bajo una mutacion viva no se arregla: se espera.

**Y el corolario que costo caro, porque rompe el salvavidas que todo el mundo asume: MUTAR UN
ARCHIVO UNTRACKED DEJA A GIT SIN NADA A QUE VOLVER.** El reflejo ante una mutacion abandonada es
`git checkout <archivo>`, y sobre un `??` **no hace nada** — no hay blob. Paso en la fase D1 de la
spec 0063: un revisor murio con M5 puesta en `app/api/billing/cancel/route.ts`, que todavia no
estaba commiteado, y el unico camino fue **reconstruir la version limpia a mano**. Se pudo
**solo porque el implementador habia dejado el `shasum` de cada archivo mutado en su handoff**: la
reconstruccion dio `1fa5bbf9d80ee940…`, identico al reportado, y eso la convirtio de adivinanza en
verificacion. Sin ese numero no habia oraculo y el arbol quedaba con una mutacion indistinguible
de codigo legitimo. **Dos reglas que salen de ahi:** (1) el `shasum` de un archivo que se va a
mutar se registra ANTES de mutarlo y se escribe en el handoff, **sobre todo si el archivo es
nuevo** — es el unico punto de retorno que existe; y (2) antes de mutar, mirá si el archivo esta
trackeado (`git status --short`), porque si sale `??` el `git checkout` de emergencia **no existe**
y conviene sacar una copia a `/tmp` primero.
**Y la variante PEOR, que la regla de arriba no cubria: un archivo TRACKED Y MODIFICADO (` M`).** Ahi el `git checkout`
de emergencia **si hace algo — y es lo peor que puede hacer: se lleva tambien el trabajo no commiteado**, no solo la
mutacion. La del untracked no revierte nada y **se nota**; esta revierte de mas y **se ve como si hubiera funcionado**.
Paso en la fase D1 de la spec 0063 con `checkout/route.ts`. **Regla: antes de restaurar CUALQUIER archivo, corré un
`diff` contra la copia limpia y mira que lo unico que se va sea la mutacion.** Se hizo asi al revertir una S3 sobre
`_auth.ts` y el `diff` mostro exactamente una linea: **eso es lo que convierte «restaurar» en una operacion verificada
en vez de una apuesta sobre el trabajo de otro.** Y cuando la reconstruccion a mano no converge —cuatro candidatos
contra un `shasum` y ninguno dio— **la copia en `/tmp` es lo unico que queda**: ya salvo dos mutaciones abandonadas en
esa fase. Ojo tambien con el «casi igual»: un candidato estructuralmente correcto perdia un comentario que explicaba
por que se miraba `rawType` y no `instanceof`; **el hash lo cazo, y sin el ese archivo se degradaba en silencio**.

**Y la ultima pieza del protocolo, que costo una medicion entera: LA FILA DE LA BITACORA SE ABRE ANTES DE MUTAR, NO
DESPUES DE MEDIR.** Un revisor de la fase D2 (spec 0063) escribia cada fila «al terminarla» —disciplina que suena
correcta— y murio con **R10 puesta y sin fila**: el arbol se pudo restaurar (habia copia en `/tmp` y `shasum`
baseline, y el `diff` mostro una sola linea), **pero el resultado ya ejecutado de R10 se perdio y hubo que rehacerlo
desde cero**. El hook `no-mutations-left.sh` te salva el arbol; no te salva la medicion ni le dice a la proxima sesion
QUE mutacion era. **Regla: al mutar se escribe primero `id + archivo + shasum limpio + que invariante ataca`, y
despues se mide y se completa el resultado.** Una fila a medio escribir es un punto de retorno; una fila ausente es
trabajo que se hace dos veces — y si la sesion que hereda la transcribe «de memoria», es una fila inventada, que es
justo lo que la tabla de mutaciones existe para prohibir.

**UN SINTOMA NO ES UNA CAUSA, y nombrar un mecanismo PLAUSIBLE se siente igual que haberlo verificado.** En la fase D1
el orquestador vio `fetch failed` dentro de corridas VERDES y escribio —en `docs/TASKS.md` y al owner— que eran
«reintentos absorbidos» y que el flaky estaba «tapado, no cerrado». **Falso, y lo falsifico un revisor con dos `grep`:**
esos `fetch failed` salen de un test que setea a proposito un `DATABASE_URL` de localhost, y **no hay ninguna capa de
retry en `db.ts`** — la hipotesis no tenia mecanismo. El flaky real era otro y ajeno a la fase (un `select` sin
`order by` + `.at(-1)` sobre dos filas del mismo telefono). **Antes de escribir «esto pasa PORQUE X», buscá X en el
arbol**: si no podes señalar el codigo que lo produce, no es un diagnostico, es una historia. Es el ADR 0054 del lado
de la causa, y se cuela mas facil porque explicar un sintoma **se siente como entenderlo**.

**Un hook tambien es un guard, y un guard sin prueba de que MUERDE es peor que ninguno.**
`tasks-fresh.sh` guardaba con `[ -d src ] || exit 0`, pero `src/` **no existe en la raiz de
este monorepo** (vive en `apps/*/src`): salia en 0 **siempre** y no bloqueo un turno en toda
su vida, mientras `CLAUDE.md` y `docs/TASKS.md` citaban su existencia como garantia. Es la
leccion de los tres guards rotos de la tarea 38, ahora del lado del harness. Al escribir o
tocar un hook: corrolo contra un estado que **debe** bloquear y verifica el `exit 2` **y** el
mensaje, no solo que salga 0 cuando todo esta bien. Un exit 0 puede significar "paso" o
"nunca miro nada", y desde afuera son indistinguibles.

**Y el espejo: un ROJO tambien puede ser por el motivo equivocado, y se ve igual de convincente.** Al
cerrar un hallazgo de la fase C (spec 0063) se escribio un test de forma que llamaba a `getDb()`: sin
las env de integracion moria con `DATABASE_URL no esta configurada`. **Con la mutacion puesta daba
rojo — y sin la mutacion tambien.** Se leia como «el guard muerde» y era el entorno; encima habria
roto toda corrida sin esas env. **Verificar que un guard muerde no es ver un rojo: es LEER la
asercion del rojo** y confirmar que habla de la propiedad, no del setup. Corolario del mismo error,
cazado por el revisor en la misma fase: **una mutacion se corre contra TODOS los archivos que
pueden verla, y el alcance se escribe en la fila.** M21 y M22 se transcribieron con 2 y 1 rojos
porque se corrieron contra un solo archivo; eran 3 y 2, y una de las filas sacaba una conclusion
del numero equivocado. **Y el tercero de la misma familia, en la misma fase: un tamaño de archivo
reportado como «299/300 — queda margen» eran 309** — medido antes de la ultima pasada de prettier y
nunca re-medido, o sea que el archivo creado para respetar el limite lo violaba. Los 5 gates no lo
cazan: `file-size` es **PostToolUse, no Stop**. **Un numero que va a un doc se re-mide en el momento
de escribirlo, y para los que tienen hook se pregunta AL HOOK, no a `wc`** —
`echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh; echo "EXIT=$?"`, con un
control sobre un archivo sano para probar que discrimina. **Y el caso de esta familia que mas
duele, cazado en el handoff de esa misma fase: un `shasum` BASELINE guardado en `docs/TASKS.md`
para que la proxima sesion audite el arbol habia quedado viejo** (era de antes de un refactor del
mismo archivo). Un baseline podrido no falla ruidoso: la sesion fresca corre la auditoria, ve el
mismatch y concluye **«alguien dejo una mutacion puesta»** — el sintoma exacto que esa auditoria
existe para descartar, ahora fabricado por el propio doc. **Todo baseline (`shasum`, conteo de
tests, tamaño) se RE-MIDE en el handoff, no se copia del mensaje anterior.**
**Y la variante del mismo error del lado del RESUMEN, no del numero: `docs/TASKS.md` acumulo secciones nuevas
correctas (commiteado, pusheado, migrado a prod, dos rondas de QA) mientras el bloque `ESTADO` del TOPE del
archivo seguia diciendo «SIN COMMITEAR… no se pusheo… la migracion NO esta aplicada».** Cada sesion agregaba su
seccion abajo y confiaba en que el header de arriba seguia describiendo la realidad; nadie lo volvio a leer con
sospecha. Una sesion fresca que solo lee el tope —que es el diseño explicito de este archivo— habria heredado un
estado falso aunque la verdad completa estuviera mas abajo. **Al hacer handoff, el bloque `ESTADO` de la primera
pantalla se reescribe entero contra los hechos actuales, nunca se deja "vigente por omision" solo porque nadie
lo contradijo explicitamente.**
**Y el corolario de alcance, que costo un numero relatado al owner: al medir tamaños, el conjunto es TODO EL ALCANCE,
no los archivos NUEVOS.** El orquestador de la D2 reporto «dos archivos en 300 exactas»; **eran tres** — el tercero
(`billing-store.neon.integration.test.ts`) es un archivo **modificado** que ya estaba en el limite desde antes, y solo
se midieron los dos creados en la fase. **Un archivo preexistente clavado en el limite es el mas peligroso de todos,
porque nadie lo vuelve a medir**: no aparece como `??` en el `git status`, no se siente «nuevo», y el hook `file-size`
es **PostToolUse** — solo mira lo que se acaba de tocar. Lo cazo el revisor independiente. Al cerrar una fase, el
barrido de tamaños se corre sobre los ` M` **y** los `??`.

## Codigo

- Si un archivo supera el limite de tamaño (hook `file-size`): dividir, no extender.
- No editar ni borrar tests para que el gate pase: un test rojo se arregla o se discute.
- Nada de andamiaje sin su tarea: codigo que no se usa hoy va con su fila en
  `docs/TASKS.md` que lo va a consumir, o se borra.
- **Una ruta que devuelve una entidad al navegador NUNCA serializa claves internas de R2**
  (`*ObjectKey`): devolver un DTO que las omite y expone sólo el `*Path` publico (ver
  `toClientProgram` en loyalty, `brandResponse` en marca). Blindar con un test por entidad.
  Un revisor independiente ya cazo esta fuga en marca (spec 0025); no repetirla.

## Gotchas

- **El shell del agente es ZSH, y zsh NO separa en palabras una variable sin comillas.** `FILES="a b c";
  prettier --write $FILES` le pasa UN argumento con espacios: prettier contesta «No files matching the pattern» y
  un `for f in $FILES` itera UNA vez sobre la cadena entera. Paso en el delta de la D2: prettier «corrio» sin tocar
  nada y el bucle de tamaños al hook midio una entrada inexistente como `EXIT=0` — o sea un gate que dice «paso»
  sin haber mirado. Usar arrays (`FILES=(a b c); cmd "${FILES[@]}"`) o `${=FILES}`; y leer la salida de prettier,
  que lista cada archivo que formateo.
- **`jsdom` NO es la unica forma de tener `querySelectorAll`: `node-html-parser` viene BUNDLEADO en `next`**
  (con motor CSS). Render real con `renderToStaticMarkup` + `parse()` + invocar el handler real del elemento pinnea
  una trampa de foco en **45 lineas, 12 ms, cero paquetes** — verificado en el delta de la spec 0063, donde el
  ORQUESTADOR habia declarado el limite «exige DOM real» y era falso (mutar el selector da rojo). Antes de escribir
  «no hay DOM», mira que bundlea Next.
- **UN `import` DE VALOR AL BARREL `./billing` DENTRO DE UN SUPPORT DE TEST CUELGA LA SUITE PARA SIEMPRE.**
  `billing-integration-support.ts` lo importa la factory de `vi.mock("./stripe-config")`; el barrel arrastra el
  dominio entero **de vuelta a `stripe-config`**, cuya factory todavia no termino → ciclo. Los dos
  `billing-pages*.neon.integration.test.ts` **colgaban sin emitir una linea** (ni `vitest list` terminaba, **0% de
  CPU** — asi se ve un deadlock, no una corrida lenta). Se importa del **modulo concreto** (`./billing/store`): de
  infinito a **1.06 s**. **Un `import type` al barrel es gratis —se borra en compilacion—; uno de VALOR no.** Es el
  mismo deadlock que ya documentaba `billing-pages.neon.integration.test.ts`, reintroducido por otra puerta.
  **Y el metodo para diagnosticarlo, que es lo reutilizable:** ante «todo cuelga», (a) corré un test suelto y
  AJENO —si anda en ms, vitest esta sano y el problema es de ESOS archivos—; (b) si cuelgan **dos** hermanos,
  mira la cadena COMUN y no el archivo nuevo, que es el sospechoso obvio y era inocente; (c) matar procesos
  zombis **no** lo arreglo, y ese negativo fue el dato que descarto «contencion de maquina».

- **`ON CONFLICT` CONTRA UN INDICE UNICO *PARCIAL* EXIGE REPETIR EL `WHERE` DEL INDICE.**
  `on conflict (a, b) do nothing` **pelado** no matchea un `create unique index … on t (a, b) where
  status in ('queued','active')`: falla con `there is no unique or exclusion constraint matching the
  ON CONFLICT specification`. No es un no-op silencioso — es un error **en tiempo de ejecucion**, o
  sea que un encolado idempotente escrito asi revienta en su **primera** corrida. Se arregla
  repitiendo el predicado en el conflict target:
  `on conflict (a, b) where status in ('queued','active') do nothing`. Verificado contra PG 18 real
  al revisar la spec 0065 (los dos casos, el que falla y el que anda). El patron «unico parcial sobre
  filas vivas + `on conflict do nothing`» es el idiom de este repo para colas y turnos, asi que el
  error es facil de reintroducir.
  **Y el hermano del mismo dia: NO PONGAS UN UNICO PARCIAL SOBRE UN `status` QUE EL WORKER VUELVE A
  ESCRIBIR.** `wallet_push_queue` devuelve una fila fallida a `'pending'` en el **mismo** `UPDATE`
  que incrementa `attempts` (`wallet/push.ts:199-203`). Con un unico parcial sobre
  `status = 'pending'`, si mientras esa fila estaba en `sending` entro otra para el mismo consumidor,
  la vuelta viola el unico → **el `UPDATE` entero falla** → `attempts` **no sube** (reproducido:
  queda en 0, `last_error` null) → la fila se queda clavada en `'sending'` y `claimRow`
  (`push.ts:118-126`) la re-reclama para siempre, comiendose el cupo de cada corrida. El error ademas
  cae en un `swallow`. Coalescer con `insert … select … where not exists (… status in
  ('pending','sending'))`, no con un indice.

- **Gates: Node 24 + scripts de ROOT.** El shell del AGENTE arranca en Node 22 —es el Node del
  harness de Claude Code, que se antepone en el `PATH`, **no la terminal del owner**— y el repo
  pide 24: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` antes de cualquier gate.
  **Desde 2026-09-09 `nvm use` va SIN argumento**: hay un `.nvmrc` en la raiz (nvm **no** lee
  `.node-version`). Los dos pines los mantiene sincronizados `tools/node-version-pins.test.ts`.
  **Al diagnosticar "que Node corre", ojo con confundir tres shells distintos:** la del agente
  (22, del harness), `zsh -l -c` (26.7.0 de Homebrew — `-c` **no** sourcea `.zshrc`, asi que nvm
  nunca carga) y la terminal interactiva real del owner (la que importa). Para ver la de verdad:
  `env -i HOME="$HOME" TERM=xterm /bin/zsh -i -c 'node -v'`. **La version sale de `.node-version`
  — desde la spec 0049 es 24.20.0, no 24.19.0**; con la vieja los gates pasan igual pero pnpm
  tira `WARN Unsupported engine: wanted {"node":">=24.20.0 <25"}` en cada corrida (paso al
  implementar la 0056: esta linea habia quedado vieja). **Ese drift estuvo vivo en esta maquina
  hasta el 2026-09-09** (`nvm alias default` = 24.19.0) **y el guard de pines NO lo cazaba: solo
  comparaba el MAJOR**, asi que 24.19.0 pasaba 5/5 mientras violaba `engines.node` — verificado
  corriendo el guard viejo bajo 24.19.0. Ahora compara la version completa contra el piso.
  `lint`, `test`, `format:check`, `build` son scripts de
  **root** (`pnpm run <script>`), NO del paquete — `pnpm --filter @mi-pasaporte/merchant lint`
  tira `None of the selected packages has a "lint" script`. El paquete merchant solo define
  `typecheck` (y `db:migrate`); para unit de un archivo suelto: `pnpm --filter
  @mi-pasaporte/merchant exec vitest run <path>`. El Stop hook (`.claude/hooks/verify.sh`) corre
  typecheck+lint+test de root (no prettier ni build).

- **`pnpm install`/`pnpm add` bajo codex + Auto fallan por DNS, aunque `git commit` ande
  (analogo al fix de GlaDOS ADR-0046/spec 0035, pero para paquetes en vez de `.git`).**
  Dos bloqueos independientes, apilados, NINGUNO es bug — son el sandbox
  `workspace-write` de codex haciendo lo que promete: (1) **red bloqueada por default**
  (el `approvalPolicy`/autoApprove NO da red — es otra dimension; GlaDOS ademas nunca
  concede la enmienda de red, ni en manual: MCP-only por diseño); (2) **el store global
  de pnpm** (`~/Library/pnpm/store`) **queda fuera del workdir writable** — mismo
  mecanismo que `.git/` fuera de `writable_roots`. Bajo Auto, codex no puede distinguir
  "sandbox lo bloqueo" de "internet caido": reporta el sintoma (DNS) y pide correrlo a
  mano en una terminal real.
  - **Fix: store de pnpm DENTRO del repo, pre-cargado.** `.pnpm-store` gitignored +
    `storeDir: .pnpm-store` en `pnpm-workspace.yaml`. **OJO: pnpm 11 lee `storeDir` de
    `pnpm-workspace.yaml`, NO de `.npmrc`** (`store-dir` en `.npmrc` se ignora en
    silencio — `pnpm config get store-dir` sigue devolviendo el global aunque el
    `.npmrc` este ahi; solo `pnpm-workspace.yaml` lo aplica, verificado con `pnpm store
    path`). Con el store adentro del workdir, `pnpm install --offline` no necesita red
    NI escritura fuera del sandbox — verificado end-to-end: `node_modules` borrado y
    reconstruido 100% offline (268 paquetes, `downloaded 0`) + `pnpm run typecheck`
    real, 3/3 paquetes verdes.
  - **Operatoria hacia adelante: el re-warm hace falta MENOS de lo que decia esta linea.**
    Si la dependencia se agrega **en una sesion CON red** (`pnpm add`), el propio install ya
    escribe en el store local y no hace falta nada mas — verificado en la spec 0040:
    `.pnpm-store/v11/index.db` ya contenia `react-easy-crop@6.2.3` + `normalize-wheel@1.0.1`
    recien agregados. Chequeo barato antes de tocar nada:
    `strings .pnpm-store/v11/index.db | grep '<paquete>@<version>'`.
    **`pnpm fetch` es solo para cuando el lockfile cambio en OTRO entorno** (pull con deps
    nuevas que nunca se instalaron aca): ahi si el store queda desactualizado y el offline
    install falla con "paquete no encontrado" (no DNS). **Correrlo de mas no es gratis: PURGA
    `node_modules`** (ver la linea de abajo) y te deja arreglando el `Already up to date` con
    la raiz vacia a cambio de nada.
  - **`pnpm fetch` purga `node_modules` sin preguntar salvo `CI=true`** (falla con
    `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` sin TTY, p.ej. corrido por un agente).
  - **Despues de `pnpm fetch`, `pnpm install --offline` MIENTE: dice `Already up to date`
    y deja el `node_modules` de la RAIZ vacio** (sin symlinks ni `.bin`), asi que
    `pnpm run typecheck`/`build` fallan con **`sh: turbo: command not found`** — parece
    que se rompio turbo y en realidad falta el link. `--force` tampoco alcanza: el
    chequeo de estado de pnpm lo da por hecho. **Fix verificado:** borrar los dos
    archivos de estado y reinstalar —
    `rm -f node_modules/.modules.yaml node_modules/.pnpm-workspace-state-v1.json && pnpm install --offline`
    (`node_modules/.pnpm` conserva los paquetes, asi que sigue siendo 100% offline; no
    hace falta red). Ojo: `rm -rf` esta en el deny de `.claude/settings.json`, usar `rm -f`
    sobre los archivos.

- **Worktrees en este monorepo: SI para leer y para vitest directo, NO para `pnpm run <script>`.**
  **NI `pnpm run` NI `pnpm exec` son seguros adentro de un worktree con `node_modules`
  symlinkeado al repo real**: los dos disparan `runDepsStatusCheck` → `pnpm install` → **intenta
  purgar ese `node_modules`**, que por el symlink son las dependencias posta. Pasó dos veces en la
  spec 0053: un implementador lo abortó a tiempo y un revisor se comió el
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` (que sin TTY es lo que te salva). Nadie perdió
  `node_modules`, pero el camino estaba armado las dos veces.
  **Para probar mutaciones, la opcion segura es hacerlo IN-PLACE en el repo real con backup y
  verificacion de hash** (`shasum` antes/despues), o invocar el binario directo sin pnpm
  (`node node_modules/vitest/vitest.mjs run <path>`). Los worktrees siguen siendo utiles para
  **leer** codigo viejo (`git show HEAD:<archivo>` alcanza casi siempre y es mas barato).

- **`git push` a `main` falla con "Invalid username or token" aunque `gh` este logueado.**
  Hay un `GH_TOKEN` **invalido** en el entorno que tapa las credenciales validas del keyring
  (`gh auth status` muestra `X Failed to log in ... using token (GH_TOKEN)` y ademas dos
  cuentas keyring OK: `maxhost` —dueña del repo— y `no-code-company-max`). El remoto es HTTPS
  y ya no acepta password. **Fix verificado (sin exponer el token):**
  `export GH_TOKEN=; gh auth switch --hostname github.com --user maxhost` y despues
  `GH_TOKEN= git -c credential.helper='!gh auth git-credential' push origin main`. Cada Bash
  es un shell nuevo, asi que el `GH_TOKEN=` inline va en el MISMO comando del push. No es bug
  del repo — es el entorno; no reintentar el push pelado.
- **Migracion a prod (Neon):** `DATABASE_URL_UNPOOLED='<conn de la rama default, host SIN
  -pooler>' pnpm --filter @mi-pasaporte/merchant db:migrate`. `drizzle-kit migrate` aplica
  solo las pendientes (lleva su propia tabla `drizzle.__drizzle_migrations`). Verificar
  siempre por MCP (`run_sql`) que el esquema quedo y que `core`/`merchant_auth` estan
  intactos ANTES de marcar la spec. Aplicar a prod = paso del orquestador DESPUES del PASS
  del revisor, nunca antes. `delete_branch` (MCP Neon) esta gateado como destructivo:
  pedir confirmacion del owner antes de borrar ramas efimeras. Alternativa sin gate: crear la
  rama efimera con `expiresAt` (ISO) para que Neon la borre sola.
- **Al BORRAR una ruta API (`app/api/.../route.ts`), `pnpm typecheck` puede fallar con
  `.next/types/validator.ts(...): Cannot find module '.../route.js'`** — es un tipo GENERADO
  que quedo viejo apuntando a la ruta borrada, no un error del codigo. Fix: `rm -f
  apps/merchant/.next/types/validator.ts` (o borrar `.next`); el proximo `next build`/`dev` lo
  regenera sin la ruta. No editar el archivo generado a mano.
- **Vercel plan Hobby: MAXIMO 2 cron jobs y SOLO frecuencia diaria.** Un 3er cron en
  `apps/merchant/vercel.json`, o un `schedule` sub-diario (`*/5 * * * *`), hace que Vercel
  **rechace el deploy entero** (Production queda clavado en el commit anterior, el commit status
  de GitHub muestra `Vercel: failure`). Los 2 crons existentes son diarios a propósito. Si una
  feature necesita un worker frecuente sin pagar Pro: dejar el endpoint autenticado por
  `CRON_SECRET` y dispararlo desde un **scheduler externo gratis** (GitHub Actions programado en
  `.github/workflows/`, o cron-job.org) — patrón ya usado por `wallet-push` (spec 0033). Al pasar a
  Pro se re-agrega el cron nativo. Diagnóstico del deploy sin acceso a Vercel: `gh api
  repos/maxhost/check-point/commits/<sha>/status`.
- **Agregar un plugin de better-auth AGREGA SUPERFICIE HTTP: el catch-all `app/api/auth/[...all]/route.ts`
  publica TODOS sus endpoints.** Envolver el plugin en una ruta propia con gate/rate-limit/permisos NO
  protege nada — queda una puerta con candado al lado de una pared abierta. Cazado por un revisor
  independiente en la spec 0046 y demostrado end-to-end: con `PASSWORD_RECOVERY_ENABLED` **apagado**,
  `/api/auth/email-otp/request-password-reset` devolvía 200 y entregaba el OTP; un **staff deshabilitado**
  cambiaba su contraseña; una ráfaga de 8 mandaba 8 emails contra un cap de 3/h, con 0 filas de auditoría.
  **Fix: `disabledPaths: [...]` en `betterAuth({...})`** con los paths HTTP del plugin — se aplica en el
  `onRequest` del router (→404, `dist/api/index.mjs`) y **NO** afecta las llamadas server-side `auth.api.*`,
  así que las rutas propias siguen funcionando. **Guard:** `server/merchant-auth-disabled-paths.test.ts`
  pinnea los 9 paths de `emailOTP` en 404 + `/sign-in/email` vivo; si sumás un plugin, sumá sus paths ahí.
  Al escribir el test, ojo con el falso verde: un path mal escrito también da 404 — verificá que sin el
  guard esos paths respondan algo distinto de 404.
- **Un server component de Next NO puede fijar el status HTTP.** Si una spec pide que una *página* responda
  503/404 (no solo su API), va por `src/middleware.ts` con `matcher` acotado. Ojo: el middleware corre en
  **edge runtime** — no importes cadenas que arrastren `node:crypto` (leé la env directo). Verificá que la
  env no quede inlineada en build-time inspeccionando el chunk edge compilado.
- **Formatos de imagen aceptados en subidas: viven en UN solo lugar,
  `apps/merchant/src/lib/image-formats.ts`** (jpeg/png/webp/**heic/heif/avif** — las fotos de
  cámara/galería de Android e iPhone son HEIC/HEIF, `sharp` las decodifica). Lo consumen los guards
  del cliente y los allow-lists del prep de marca/sello/catálogo. **No dupliques la lista** (un
  allow-list angosto por-feature ya causó que el sello rechazara fotos de Android — spec 0033 QA, y
  **de nuevo en marca/backoffice — spec 0039 QA**: la lista angosta estaba hardcodeada en 3 lugares
  (guard cliente, allow-list server, `accept` del input)). Mantener en sync con la lista de formatos
  de `sharp` en `server/assets/image.ts`. **Guard:** `server/upload-image-formats.test.ts` pinnea
  sello + catálogo + marca aceptando HEIC/HEIF/AVIF **y barre TODO `.tsx` bajo `app/` buscando
  listas MIME hardcodeadas** — si agregás una superficie de subida nueva, sumala a ese test.
  **OJO AL ESCRIBIR ESE TIPO DE BARRIDO (spec 0040): la primera version del regex solo matcheaba
  `accept={...}` y era CIEGA a `accept="..."`, asi que tapaba dos listas angostas mas en
  `demo/brand` y `demo/loyalty` — 4a y 5a aparicion del mismo bug, con el test en verde diciendo
  "no hay ninguna otra".** Un guard que solo ve una de las dos ortografias de JSX es peor que
  ninguno: da seguridad que no tiene. Al escribir un barrido estatico, (a) probá las dos formas,
  (b) aseverá un **piso de archivos escaneados** (`scanned > 50`) para que un barrido vacio no
  quede verde, (c) verificá que se pone rojo con el codigo viejo (`git show HEAD:<archivo>` a
  `/tmp`), no solo que pasa con el nuevo, y (d) **si la propiedad es de COMPORTAMIENTO, ningun
  barrido estatico la pinnea: extrae la decision a una funcion pura y testeala.** Un barrido sirve
  para propiedades que SON sintacticas ("ningun `.tsx` bajo `app/` hardcodea una lista MIME",
  "esta pagina no enlaza un manifest"). Para "en iOS Safari sin VAPID el instructivo se
  renderiza" **no alcanza ninguno**: la sintaxis es un proxy y todo proxy tiene preimagen. La
  tarea 38 lo pago con **tres guards rotos por tres revisores**, cada uno con los 5 gates verdes:
  `indexOf(A) < indexOf(B)` (evadido con una 2da ortografia del guard); `matchAll` +
  `toHaveLength(1)` (evadido de 5 formas: llaves, `Boolean(x) === false`, hoist a un `const`,
  comentario señuelo, y un refactor idiomatico); y un mini-parser "el primer `return` del cuerpo
  devuelve X" (evadido metiendo la clave **dentro de la condicion** —que ningun chequeo de orden
  ve— y gateando el componente **en el llamador**; ademas disparaba en 4 refactors legitimos).
  Lo que funciono fue `choosePushPromptView`: la decision como funcion pura, con una tabla de
  casos como oraculo. **Pero ojo con lo que compra extraer, porque no es lo que parece: convierte
  una propiedad de COMPORTAMIENTO ("el usuario ve X") en una de DECISION ("la decision dice X"),
  y deja el CABLEADO sin oraculo.** En la tarea 38 ese hueco resulto de una linea: un revisor
  reintrodujo el bug exacto con `setIsIos(ios && vapidPublicKey !== null)` en el efecto, con los
  5 gates verdes. Corolarios: **extraer no cierra la propiedad — nombra explicitamente que queda
  afuera**; **lo que quede sin cubrir se declara en el test**, no se tapa con un regex; y **si
  igual escribis un proxy, etiquetalo como proxy, decí cual de sus partes hace el trabajo y cual
  es decorativa**, y escribi vos 3 evasiones antes de darlo por bueno — las de la tarea 38 las
  encontraron los revisores, nunca el autor.
- **La forma del payload de un webhook de Stripe la fija la `api_version` del ENDPOINT, no el
  SDK.** `getStripeClient` no pinnea `apiVersion` (`server/stripe-config.ts`), asi que las
  llamadas **salientes** (`retrieve`, `update`, `list`) vienen en la version del SDK
  (`2026-07-29.dahlia` con `stripe@22.5.0`) y estan bien tipadas — pero el JSON **entrante** de
  `constructEvent` viene como lo serializo Stripe con la version del endpoint, y
  `constructEvent` **no lo transforma**. En este proyecto los eventos que llegaron tienen
  `payload_version = '2020-08-27'` (`select payload_version from core.stripe_webhook_event`),
  seis años atras: ahi `subscription.current_period_end` **existe** y
  `items.data[0].current_period_end` es **`undefined`**, con `typecheck` en VERDE porque los
  `.d.ts` describen dahlia. **Corolario operativo: del payload se leen solo `type`, `id` y
  `created`; todo lo demas se pide con un `retrieve`.** Y el corolario de metodo, que es el ADR
  0054 otra vez: **verificar el TIPO no es verificar el PAYLOAD** — un `.d.ts` es evidencia sobre
  la forma que el SDK espera, no sobre la que llega por la red.
- **Al endpoint del webhook llegan eventos que NO son `customer.subscription.*`** — en la base
  hay `invoice.paid` y `checkout.session.completed`. Cualquier codigo que asuma que
  `event.data.object.id` es un `sub_…` y lo pase a `subscriptions.retrieve` falla con
  `resource_missing`; y si el registro del evento ocurre **despues** de esa llamada, Stripe
  reintenta para siempre hasta desactivar el endpoint. Allow-list de tipos, y la fila del evento
  se reclama **antes** de cualquier llamada de red.

- **Geoapify autocomplete pega DIRECTO del navegador (`address-autofill-geoapify.tsx`) con la clave
  pública `NEXT_PUBLIC_GEOAPIFY_API_KEY`.** Con **Allowed Origins** seteadas en la clave, Geoapify
  devuelve un `Access-Control-Allow-Origin` **FIJO** (un solo origen, SIN `Vary: Origin`, sin *echo*
  del `Origin` del request): por CORS **sólo funciona UN dominio**; desde cualquier otro (`www.` vs
  apex vs `.vercel.app`) el browser bloquea con "ACAO ... not equal to the supplied origin". No es la
  config del owner ni caché — verificado por terminal: mismo ACAO para todo `Origin`,
  `cf-cache-status: DYNAMIC`. Diagnóstico: `curl -s -D - -H 'Origin: https://X' 'https://api.geoapify.com/v1/geocode/autocomplete?text=cuenca&apiKey=<KEY>' | grep -i access-control-allow-origin`.
  **Fix operativo (owner, sin código, ya aplicado): quitar TODAS las Allowed Origins de la clave
  pública → Geoapify responde `*` y anda desde cualquier dominio** (contra: clave usable desde
  cualquier sitio, mitigado por la cuota diaria). **Fix durable pendiente (spec, Opción B): proxear el
  autocomplete por el server del merchant con la clave server `GEOAPIFY_API_KEY` — el browser pega
  same-origin (cero CORS) y la clave nunca viaja al cliente.** Reordenar orígenes NO sirve: un ACAO
  fijo no cubre apex + www + vercel a la vez.
