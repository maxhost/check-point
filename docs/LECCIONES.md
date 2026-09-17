# LECCIONES

**Registro historico de `mistake→rule` de este proyecto.** Cada bloque es un error observado
del agente, con su caso, su fecha y la regla que salio de ahi. Salio de `CLAUDE.md` (spec 0066,
ADR 0069) porque es **memoria del proyecto, no instruccion operativa**: no cambia una decision
en toda sesion, pero es lo que hay que leer cuando una de esas familias de error vuelve a
aparecer.

**No se referencia con `@` desde `CLAUDE.md`** — un import `@` se carga como si estuviera pegado
y la poda no ahorraria un solo token. Se lee a mano cuando hace falta.

La version operativa y condensada de estas reglas vive en la skill
`.claude/skills/protocolo-de-verificacion/SKILL.md`, que se carga on demand.

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
**Y EL ESPEJO, QUE COSTO UN HALLAZGO FALSO DE UN REVISOR: LO QUE LE PASAS A UN SUBAGENTE COMO INSUMO
ES UNA AFIRMACION TUYA.** Al abrir la cola de revisiones de la spec 0065 se les dio `docs/TASKS.md`
como contexto; su primera pantalla decia «falta el Actions secret `MARKETING_TICK_ENDPOINT`» y
llevaba **horas** vencida —el owner lo habia cargado y el workflow ya habia corrido en verde—. El
revisor de la fase A construyo un hallazgo sobre esa premisa y lo entrego como suyo. **No es su
error: es el del que encarga.** Antes de despachar un subagente, la parte del doc que le sirve de
insumo se **re-mide**, igual que un `shasum` de baseline. Un doc vencido no falla ruidoso: le
fabrica un diagnostico a alguien que no tiene como dudarlo.

**Y UNA DE HERRAMIENTA QUE BORRO MEDIA PANTALLA DEL PUNTO DE RETORNO: NUNCA REESCRIBAS UNA CABECERA
REEMPLAZANDO EL RANGO ENTRE DOS ANCLAS.** Al cerrar la spec 0065 el orquestador actualizo el bloque
`ESTADO` de `docs/TASKS.md` con `s[s.index("Ultima actualizacion") : s.index("**ESTADO REAL")]` y lo
reemplazo por la cabecera nueva. Entre esas dos anclas habia crecido, durante la misma sesion, TODO
el registro de la cola de revisiones —los cuatro veredictos, los 14 hallazgos, las mutaciones— y el
reemplazo se lo llevo entero. **No fallo ruidoso**: los hooks pasaron, el `git status` quedo limpio y
el commit salio; se detecto por casualidad, al correr un `grep` de verificacion para otra cosa. Un
`sed`/`python` que reemplaza UN RANGO borra lo que alguien (vos, dos horas antes) metio en el medio.
Regla: para cambiar una cabecera se reemplaza **esa linea**, y para insertar se hace `replace(marca,
nuevo + marca, 1)` contra una marca exacta. Si igual reemplazas un rango, **contá las lineas antes y
despues** — `wc -l` delata un borrado de 200 lineas en un segundo.

**UNA FRASE «ESTO TIENE SU ORACULO EN X» ES UNA FILA MUTACION↔TEST ESCRITA DE MEMORIA — EJECUTALA
ANTES DE ESCRIBIRLA.** El docblock de `marketing/plan-gate.test.ts` declaraba que «el gate se lee en
la MISMA transaccion que escribe» tenia su oraculo en la integracion. **Falso**: leerlo con `getDb()`
fuera de la transaccion dejo 64 tests en verde. Lo escribio el orquestador **un dia despues** de
escribir en este archivo la regla de que los pares mutacion↔test no se predicen. Vale para las dos
direcciones: afirmar que algo TIENE oraculo es tan verificable —y tan barato de verificar— como
afirmar que no se puede testear. Corolario del mismo cierre: **un test de un bloqueo que convive con
OTRO bloqueo tiene que aseverar CUAL de los dos contesto** — el caso del 409 por campañas empezo
midiendo el de locales, porque sembrar la campaña con una puerta nueva le daba al negocio dos locales
activos y la guarda de locales va primero.
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

**Y el reverso positivo, que ya recupero una medicion: UNA MUTACION ABANDONADA QUE SEGUIS ENCONTRANDO PUESTA
SE MIDE ANTES DE REVERTIRLA.** El reflejo al heredar una mutacion viva es revertirla rapido para limpiar el
arbol — y eso **tira a la basura la unica corrida gratis que vas a tener**: mientras esta puesta, el
experimento ya esta montado; despues de revertir hay que volver a mutar para saber que pinneaba. Paso en la
fase A2 de la spec 0065: el implementador murio con M2 puesta y **sin fila de bitacora**; el orquestador
corrio el test **con la mutacion todavia ahi**, obtuvo el rojo con su asercion textual, y recien despues
revirtio. Orden correcto al heredar una mutacion viva: (1) **`ListAgents`** — si hay un subagente vivo, no
la toques, esta midiendo; (2) `git status --short` del archivo y copia a `/tmp` **si es `??`**, porque ahi
`git checkout` no hace nada; (3) **medir y transcribir**; (4) revertir y probar con `diff` que se fue
**solo** la mutacion. Los pasos (1) y (2) ya estaban; el que faltaba es el (3).
**Y el truco de reconstruccion cuando no hay `shasum` ni copia: buscá el ARTEFACTO COLGANTE que dejo el
codigo removido.** Aca el guard borrado era `if (withLiveTurn.has(...)) continue;` y lo delato un `Set` que
se construia y se hacia `.add()` **pero nunca se leia** — una variable escrita y jamas consumida es la firma
de una linea que falta, y `lint` no la marca porque `.add()` cuenta como uso.

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
**Y la variante mas fina, que la regla de arriba NO evito dos veces seguidas y por eso ahora es un hook
(`state-uncommitted-lie.sh`, Stop): el doc se escribe ANTES del commit, asi que el propio commit lo
invalida.** Paso en B3 y en la fase C de la spec 0065: el bloque `ESTADO` decia «esta SIN COMMITEAR» y ese
mismo commit la commiteaba; las secciones de B1 y B2 arrastraban lo mismo. No es drift entre sesiones —es
drift **dentro de un commit**— y se ve inocente porque cuando se escribio la frase era cierta. El hook
compara `git status --short` vacio contra un «SIN COMMITEAR» en las primeras 40 lineas de `docs/TASKS.md`;
verificado que **muerde** (exit 2 + mensaje) y que **discrimina**: la frase en una seccion historica de mas
abajo pasa, y con el arbol sucio pasa porque ahi es cierta. **Y el hook mismo pago la leccion del rojo por el
motivo equivocado en su primera corrida**: se disparo sobre el parrafo de `docs/TASKS.md` que lo DESCRIBE, o
sea sobre una **cita** de la frase y no sobre una afirmacion. Se arregla filtrando las lineas que nombran al
hook y las apariciones entre `«»`, y se cierra con un caso (E) que pone una cita **y** una afirmacion real en
la misma cabecera y exige el exit 2 — sin ese caso, el filtro que arregla el falso positivo podria haber
apagado el hook entero y nadie se habria enterado.
**Y el corolario de alcance, que costo un numero relatado al owner: al medir tamaños, el conjunto es TODO EL ALCANCE,
no los archivos NUEVOS.** El orquestador de la D2 reporto «dos archivos en 300 exactas»; **eran tres** — el tercero
(`billing-store.neon.integration.test.ts`) es un archivo **modificado** que ya estaba en el limite desde antes, y solo
se midieron los dos creados en la fase. **Un archivo preexistente clavado en el limite es el mas peligroso de todos,
porque nadie lo vuelve a medir**: no aparece como `??` en el `git status`, no se siente «nuevo», y el hook `file-size`
es **PostToolUse** — solo mira lo que se acaba de tocar. Lo cazo el revisor independiente. Al cerrar una fase, el
barrido de tamaños se corre sobre los ` M` **y** los `??`.


## Alcance: entregar la capa que el owner pidio, no la que el codigo sugiere

**El arco del alta (ADR 0070) entrega API y endpoints. La UI la construye el owner por fuera, con
ChatGPT.** Esta escrito en el «Contexto» del propio ADR, con la cita textual del owner: *«el dia de
mañana si creamos una app mobile o cambiamos completamente la UI estariamos abstrayendo la capa de
logica de la UI»*.

**El caso (2026-09-16).** El orquestador leyo el ADR, escribio en la spec 0067 la frase «la UI la
trabaja el owner por fuera; esta capa entrega los endpoints»… **y en la misma spec listo
`app/login/login-form.tsx` y `app/onboarding/page.tsx` como archivos a editar.** La restriccion
estaba copiada en la prosa y contradicha en la tabla. No la cazo ningun gate: `typecheck`, `lint` y
`test` no tienen forma de saber quien construye la UI. **La cazo el owner preguntando «recordas que
lo que te toca es armar api y endpoints?»** — o sea, el recurso mas caro del proyecto revisando algo
que estaba escrito dos parrafos mas arriba.

**Por que se cuela.** La pregunta «que archivos toca esto» se contesta siguiendo el codigo, y el
codigo **si** lleva a la UI: apagar `emailAndPassword` rompe los dos call-sites de `signIn.email` /
`signUp.email`. El razonamiento «esto rompe X, entonces arreglo X» es correcto tecnicamente y
**equivocado de alcance**. Una restriccion de division de trabajo no se deduce del grafo de
dependencias: hay que ir a buscarla.

**La regla.** Una spec de este arco que liste un archivo de pantalla en «Archivos» esta mal
alcanzada. Y lo que falta en su lugar no es «nada»: es el **contrato HTTP escrito** —metodo, ruta,
entrada, salida, todos los `code` de error, si setea cookie— que consume quien hace la UI afuera.
Sin ese documento, «entregamos los endpoints» es intransferible. La forma ya existe en el repo:
`specs/0055-contratos-del-orquestador.md`, normativo para el implementador y oraculo para el
revisor.

**Y el corolario que hay que declarar, no tapar.** Entregar solo la capa de API tiene un costo real:
rompe las pantallas vivas y deja al producto sin entrada hasta que aterrice la UI de afuera, o sea
**sin QA humano**, que es justo el recurso que este repo declara superior a una evidencia mas
(«entre una evidencia mas y una pantalla que el owner pueda probar, gana la pantalla»). Ese conflicto
no lo resuelve el agente por su cuenta: **se sube al owner como decision**, con sus opciones y su
costo. Esta como item BLOQUEANTE en la seccion «Abierto» de la spec 0067.
