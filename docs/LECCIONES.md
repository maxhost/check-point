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

## Un criterio de DoD que nunca se corrio contra el arbol es una afirmacion sin verificar

**La regla que ya estaba y no alcanzo.** «Ninguna afirmacion de exito vale sin una señal que el
modelo no genero.» Lo que faltaba era su espejo en el momento de **escribir** la spec: un DoD es una
afirmacion sobre el arbol —«este comando va a dar vacio»— y se verifica igual que cualquier otra,
**corriendolo**, antes de cerrarla.

**El caso (2026-09-16, spec 0067).** La spec se cerro con **cuatro** criterios imposibles de
cumplir, y ninguno lo era por una decision equivocada: los cuatro eran afirmaciones que nadie
ejecuto.

1. `rg '/login|/onboarding|/forgot-password' apps/merchant/src` **no puede dar vacio**:
   `api/onboarding/business/route.ts` es una ruta que **la misma spec manda editar**.
2. El mismo barrido matchea `recovery-routes.test.ts:56` («session/onboarding tokens»), que es el
   arco del **consumidor**, declarado fuera de alcance **por la misma spec**.
3. `rg 'forgot-password'` tampoco puede dar cero: la **§1 de la misma spec** manda esa palabra en
   `RESERVED_SLUGS`, con piso aseverado y con `PASS` de un revisor.
4. La §3 mandaba `redirect('/onboarding?v=1')` para el owner sin verificar… y **la §7 de la misma
   spec borra `/onboarding`**.

**Los cuatro son autocontradicciones internas**, no choques con el mundo. Y los cuatro habrian caido
con **un solo `rg` corrido antes de cerrar**.

**Por que se cuela.** Un DoD se escribe en el modo «que quiero que sea verdad», que es el mismo modo
en el que se escribe el resto de la spec. El comando `rg` **parece** una verificacion —tiene forma de
comando— y por eso desarma la sospecha: se lee como si ya se hubiera corrido. Los tres primeros los
cazo el orquestador re-midiendo el doc antes de despachar (la regla «lo que le pasas a un subagente
es una afirmacion tuya» funciono); **el cuarto lo cazo el implementador chocandose con el**, a mitad
del paso 3, cuando ya no habia ruta a la que redirigir.

**La regla.** **Todo criterio de DoD que sea un comando se corre contra el arbol ANTES de cerrar la
spec, y se escribe al lado lo que devuelve hoy.** Si devuelve algo, el criterio dice «exactamente
estas N lineas y ninguna mas», no «nada». Y **todo destino de redireccion que una spec escriba se
busca en la lista de lo que esa misma spec borra**.

### Quinto caso, 2026-09-17 (spec 0068): el barrido y el ORACULO se contradicen entre si

La spec 0068 pedia dos cosas a la vez, y **una hacia imposible a la otra**. Su DoD exige
`rg -n "emailOTP|passwordResetEmail|sendVerificationOTP" apps/merchant/src` → **vacio**; y su §4
escribe el oraculo nuevo como `expect(keys).not.toContain("sendVerificationOTP")`, con el `it`
nombrado «el plugin `emailOTP` ya no esta montado». **El test que el DoD manda escribir es
exactamente lo que el barrido del DoD prohibe.** Lo cazo el implementador chocandose con el, no
la re-medicion del orquestador: el barrido se habia corrido —daba las 12 lineas esperadas— pero
**contra el arbol de ANTES, sin el archivo que la propia spec manda crear**.

**La regla, que amplia la de arriba:** un barrido `rg` del DoD **se corre contra el arbol que la
spec va a DEJAR**, no contra el de hoy — o sea que los archivos que la spec manda crear entran en
la cuenta. En concreto, **un barrido por nombre de simbolo y un oraculo que menciona ese simbolo
no pueden convivir**: o el barrido excluye el archivo del oraculo, o el oraculo usa otro simbolo
del mismo plugin. Se resolvio por medicion, sin debilitar nada: `forgetPasswordEmailOTP` es otra
clave que **solo** aporta ese plugin (verificada presente bajo la mutacion) y no matchea el
barrido, que es sensible a mayusculas.

## El comando de verificacion tambien es una afirmacion: `/status` no ve a GitHub Actions

**La regla que ya estaba y no alcanzo.** «Ninguna afirmacion de exito vale sin una señal que el
modelo no genero.» El agujero: **la señal venia de un comando que miraba el lugar equivocado**, y un
comando escrito en `CLAUDE.md` se lee como si alguien ya lo hubiera validado.

**El caso (2026-09-17).** `CLAUDE.md` mandaba verificar con
`gh api repos/.../commits/<sha>/status --jq '.state'` y exigir `success` para el sha exacto. Se
pusheo el arco de la spec 0067 y ese comando contesto **`success`** — **con la CI todavia
`in_progress`**. El orquestador estuvo a punto de reportar «CI verde».

**Por que.** `/status` agrega los **commit statuses** de la API vieja de GitHub. **GitHub Actions no
publica ahi: publica *check runs***, que es `/check-runs`. En este repo el unico que publica un commit
status es **Vercel**, asi que `/status` dice `success` en cuanto termina el deploy — y el deploy
termina **antes** que la suite. Medido: `/status` → `success` (`Vercel: success`) mientras
`/check-runs` → `verify: in_progress`.

**Por que se cuela.** El comando **tiene forma de verificacion** —es `gh api`, devuelve un estado, se
puede pegar en un mensaje— y encima estaba escrito en el archivo de reglas, o sea con la autoridad de
algo ya acordado. Nadie vuelve a preguntarse *que mide*. Es el mismo defecto que los cuatro criterios
imposibles de la spec 0067, una capa mas arriba: **ahi el DoD era una afirmacion sin correr; aca el
comando corria, pero sobre el objeto equivocado.**

**La regla.** **Un comando de verificacion se valida contra un caso donde TIENE que dar rojo**, igual
que un oraculo. Si nunca se lo vio distinguir, no se sabe que mide. Y en concreto para este repo: el
verde de CI se lee de **`/check-runs`** —todos `completed` + `success`—, nunca de `/status`, que aca
es el deploy de Vercel y nada mas.

## Un fixture que mezcla el reloj REAL con un `NOW` fijado es una bomba de tiempo

**2026-09-17, spec 0069.** Se pushea un commit que **no toca marketing** y la CI queda roja en
**7 archivos `.neon` de marketing**, con 20+ fallos que aseveran todos lo mismo:
`{campaigns: 0, enqueued: 0}`. El commit anterior habia sido **verde** ocho horas antes.

**La causa:** `marketing-integration-support.ts:78` defaulteaba `startsAt` de una campaña a
`new Date(Date.now() - 86_400_000)` —**reloj real**— mientras los 7 archivos corren el tick con
un `NOW` **fijado** en `2026-09-16T12:00:00.000Z`. Mientras el reloj real estuviera dentro de esas
24 h, `startsAt <= NOW` y la campaña era elegible. Pasadas las 24 h, `startsAt` queda **despues**
del `NOW` fijado, la campaña «todavia no empezo» y el tick no encola nada. **Detono a las 12:00
UTC del 2026-09-17 y habria puesto roja la CI de CUALQUIER commit.**

**Por que es peligroso y no solo molesto:** el rojo aparece **en el commit de otro**, y todo
empuja a culpar al cambio nuevo. El costo real de este error no es el fixture — es el rato que se
pierde buscando la regresion donde no esta, y el riesgo de «arreglar» codigo sano.

**Como se aisló, en orden, y esto es lo reutilizable:**

1. **¿El commit anterior era verde?** Si (`a0f66ea`, 07:15 UTC). O sea que es nuevo… o temporal.
2. **¿El codigo nuevo esta en el grafo de dependencias del que falla?** `rg` de todo lo que toco
   la spec sobre `marketing/` → **cero matches**. Primera señal fuerte de que no era la spec.
3. **La prueba decisiva: correr el test que falla SIN cambiar nada, mas tarde.**
   `marketing-tick.neon` **paso** en local a las 08:17 UTC y **fallo** en local a las 14:18 UTC
   del **mismo dia**, sobre el **mismo arbol**. Si el arbol no cambio y el resultado si, la
   variable es el **entorno**, y el candidato numero uno es el reloj.
4. **Re-correr el job** para distinguir flake de determinista: fallo **identico**.
5. Recien ahi, buscar el reloj real en el fixture: `rg 'Date.now\(\)|new Date\(\)'`.

**La regla:** en un test de integracion con tiempo fijado, **ningun fixture puede leer el reloj
real**. Si el test inyecta un `NOW`, todo lo que se compare contra ese `NOW` —`startsAt`,
`enrolledAt`, ventanas, cooldowns— se deriva **de ese mismo `NOW`** o de un instante fijo
declarado. Un `Date.now()` en un default de fixture pasa todos los gates el dia que se escribe y
falla un dia cualquiera, en el commit de otra persona.

**Y el corolario de metodo, que es el ADR 0062 otra vez:** «la CI se puso roja con mi cambio» es
una **afirmacion**, no un hecho. Se verifica igual que las demas —buscando si el codigo nuevo
siquiera puede alcanzar al que falla, y volviendo a correr lo que fallo bajo otra variable—. Aca
las dos respuestas fueron «no» y «el reloj», y ninguna se deducia leyendo el diff.

## `rg -r` no es `-n`: un flag mal puesto devuelve una lectura FALSA del arbol, no un error

**2026-09-17, spec 0069.** Buscando quien construia la URL del sello, el orquestador corrio
`rg -rn 'patron' <ruta>`. **`-r` es `--replace`**, asi que `n` no fue «numero de linea»: fue el
**texto de reemplazo**. `rg` devolvio las lineas con **cada match sustituido por la letra `n`** —
`const resized = base.n{`, `"n": 'attachment; …'`— y **exit 0**.

**Por que importa mas de lo que parece:** el comando **no falla**. Devuelve rutas reales, numeros
de linea reales y contenido casi real. Es exactamente la forma de un resultado valido, y se presta
a leerlo como «ya vi donde esta». Es la misma familia que el gotcha de zsh sin comillas que ya
esta en `CLAUDE.md`: **un comando que "paso" sin haber mirado lo que uno cree.**

**La regla:** cuando la salida de una busqueda se vea rara —contenido truncado, identificadores
que no existen en el repo, una constante que aparece donde no deberia— **la primera hipotesis es
el comando, no el codigo**. Volver a correrlo en su forma minima (`rg -n 'patron' <ruta>`) antes
de sacar una sola conclusion. Aca se cazo porque un nombre de columna aparecio renombrado a `n` en
tres archivos distintos, que es imposible; si el patron hubiera sido de una sola letra, la
sustitucion habria pasado desapercibida.

**Corolario, que es el de siempre en este repo:** la salida de una herramienta es evidencia sobre
**lo que la herramienta hizo**, no sobre el arbol. Las dos cosas coinciden solo si el comando era
el que uno creia.

---

## El espejo de «lo que el owner no dijo»: lo que YA dijo, preguntado de nuevo

**2026-09-17, spec 0072.** El orquestador le subio al owner **dos** «decisiones pendientes» que el
owner **ya habia tomado el mismo dia**, con palabras textuales guardadas en `TASKS.md`:

1. **F1 — `POST /api/onboarding/program` reescribiendo el programa de un negocio `suspended`.** Se
   le planteo como decision de producto («¿gatear el wizard o declararlo?»). Su regla dictada para
   `suspended` ya decia: «no pueden escanear, no pueden asignar puntos, sellos, **cambios en
   programa**, marca, etc. Nada». **No era una decision: era un incumplimiento.** Respuesta del
   owner: «cerralo ahora».
2. **El `status`/`suspensionReason` que devuelve `requireBackofficeSession`** y que hoy ninguna
   pantalla consume. Se le subio como «andamiaje a decidir: su fila o se borra». Su dictado ya
   decia que el owner suspendido «puede loguearse y **ver un mensaje de cuenta suspendida con su
   razon y boton de contacto**» — o sea que el consumidor estaba decidido y el campo es la mitad de
   API de esa pantalla. **Lo que faltaba era la fila, que es trabajo del orquestador, no una
   pregunta.**

**La causa raiz, y es lo que hace que se repita:** los dos venian etiquetados por un subagente como
«decision del implementador, NO del owner». Esa etiqueta es **cierta desde el contexto del
subagente** —el no tiene el historial de decisiones— y el orquestador la propago sin cruzarla
contra las palabras del owner. La regla anterior («lo que el owner no dijo no se escribe como
decision suya») empuja justo en esa direccion, asi que sin su espejo el sesgo es estructural: **ante
la duda, preguntar parece siempre lo seguro.** No lo es — le devuelve al owner trabajo que el ya
hizo, y encima disfrazado de pregunta nueva.

**El costo medido:** dos vueltas de conversacion, y en F1 el owner tuvo que reafirmar una regla que
habia dictado horas antes. El sintoma en su voz fue «tan dificil es entender eso?».

**La regla (en `CLAUDE.md`, junto a su espejo):** antes de subir un hallazgo a decidir, buscar las
palabras textuales del owner en `TASKS.md`/`PARQUEADO.md`. Si ya las dijo, **no es una decision
abierta: es un incumplimiento, y se arregla**. Un subagente que etiqueta algo como «decision mia»
esta describiendo su contexto, no el estado del proyecto.

## Un gate verde en CI puede estar tapando un defecto, si el ORDEN de los pasos lo esconde

**2026-09-18, al revisar la UI que volvio de ChatGPT.** El handoff externo reportaba «el typecheck
global queda en rojo por un problema ajeno de billing». Tentacion inmediata y equivocada: darlo por
ruido, porque **la CI estaba verde sobre el mismo arbol** (18 pasos en `success`, leidos de
`/check-runs`).

**Lo que pasaba de verdad, medido:** `apps/merchant/src/app/api/billing/cancel/route.ts` exportaba
`downgradeToFree`, un simbolo que **no es un handler**. Next genera en `.next/types` un chequeo que
exige que un Route Handler **solo** exporte handlers, y ese chequeo fallaba (`TS2344`). La CI nunca
lo vio porque **corre `typecheck` en la linea 32 y `build` en la 65**: sobre un checkout limpio,
cuando `tsc` corre, `.next/types` **todavia no existe**. El defecto solo aparece despues de un
`next build` local — o sea, exactamente para quien construye UI, y nunca para la CI.

**Las dos lecturas falsas que esto habilita, y las dos son caras:**
1. «La CI esta verde, entonces el arbol esta sano» — falso: la CI verifico un arbol **sin el
   artefacto generado** que dispara el chequeo.
2. «Es un artefacto rancio, lo borro y sigo» — es hacer pasar el gate sin mirar nada. El artefacto
   era rancio **y** el defecto era real; borrarlo deja el segundo vivo para el siguiente.

**Como se distingue una cosa de la otra, y es barato:** correr el gate en las DOS condiciones. Un
`tsc` con un `tsconfig` que omite `.next/types` (la condicion de la CI) contra el `tsc` normal (la
condicion del que buildea). Si difieren, el orden de los pasos esta escondiendo algo.

**El arreglo:** mover el cuerpo compartido a `api/billing/_downgrade.ts` —mismo criterio que
`_auth.ts`, que ya vivia en ese directorio— y dejar en la ruta solo su `POST`. Del test se cambio
**la ruta del import y nada mas**: la asercion `expect(SETTLE_FREE).toBe(downgradeToFree)` quedo
intacta, porque un test que se afloja para que el gate pase no verifica el arreglo, lo tapa.

**La regla:** un reporte de gate rojo que viene de afuera se **reproduce**, no se clasifica de
oido. Y «la CI esta verde» responde «el arbol pasa los pasos de la CI **en el orden de la CI**»,
que no es la misma afirmacion que «el arbol esta sano».

## «Diff aditivo puro» es una afirmacion, y los barridos de inventario la desmienten

**2026-09-18, spec 0074.** La spec declaraba `disjunta: si`, «el diff es **aditivo puro**» y una
tabla de Archivos con **solo archivos nuevos**: tres rutas `GET` y una hoja de DTO. El argumento
escrito era bueno —«no se edita una sola linea de `auth-guards.ts`, `api-owner.ts`,
`billing/_auth.ts` ni de ninguna ruta existente»— y **era falso igual**.

Apenas el implementador creo `GET /api/billing/state`, la suite dio un rojo:

```
FAIL src/server/billing-routes.test.ts > every handler under api/billing/** is covered by HANDLERS
AssertionError: expected [ 'POST /api/billing/cancel', …(3) ] to deeply equal [ 'GET /api/billing/state', …(4) ]
```

**La causa, y es lo que la hace repetible:** ese archivo tiene un **barrido de inventario** que lee
el filesystem bajo `api/billing/**`, extrae los handlers exportados y exige **igualdad exacta**
contra su lista. Un barrido asi **no aparece en ninguna lista de imports**: no lo caza un
`rg 'from ".*billing/state"'` porque no importa la ruta nueva — la **descubre leyendo el disco**.
O sea que la tecnica habitual para probar disjuncion (buscar quien importa lo que voy a tocar) es
**estructuralmente ciega** a esta clase de acoplamiento.

**Por que es un acierto y no un estorbo:** el barrido existe justamente para que nadie agregue una
ruta de billing sin declarar como se comporta su auth. Funciono. Lo que fallo fue la spec.

**El costo:** el implementador quedo con un gate rojo contra una regla del encargo que le prohibia
tocar ese archivo — o se bloquea, o amplia alcance por su cuenta, y las dos son malas. Se resolvio
con una ampliacion **autorizada y acotada** (agregar la fila; **no** tocar el `toEqual` ni bajar el
piso del barrido) anotada en la spec y en el handoff.

**La regla:** antes de cerrar una spec que **crea una ruta**, correr
`rg -n 'readdirSync|readdir\(|globSync|import\.meta\.glob' apps -g '*.test.ts'` y mirar si algun
test hace inventario del directorio donde va a nacer. **El flag es `-g`, no `--include`** —`rg`
rechaza `--include` con «unrecognized flag», y esa es la misma familia de error que la leccion del
`rg -r`: un comando de verificacion mal escrito es una afirmacion sin verificar. **Corrido asi el
2026-09-18 devuelve 8 archivos** que hacen inventario, entre ellos los barridos por dominio de
`billing`, `locations` y `marketing`. Si lo hace, **ese test va en la tabla
de Archivos**, y «aditivo puro» deja de ser cierto. Una tabla de Archivos incompleta es
subespecificacion, que es el gatillo medido del exito fingido.

## Un limite que le declaras a un subagente es una afirmacion tuya, y esta se verifica corriendola

**2026-09-18, spec 0074.** El encargo al implementador incluia esta linea, escrita por el
orquestador:

> «Si `pnpm run test` corre sin `DATABASE_URL`, los tests Neon quedan **`skipped`, no en verde**:
> si no podes correrlos, **declaralo** como limite en vez de reportar la suite como pasada.»

La primera mitad es cierta y util. **La segunda inventa un limite que no existe:** hay un
`.env.integration.local` **en la raiz del repo**, y con el la suite corre contra la rama Neon de
verdad. Verificado despues de mandar el encargo, sobre `loyalty-qr.neon.integration.test.ts`:
**7 passed**. El comando es `set -a; . ./.env.integration.local; set +a` antes de `pnpm run test`,
y estaba escrito en `TASKS.md` y en cuatro encargos archivados.

**Por que es caro, y no un detalle de redaccion:** el presupuesto de mutaciones de la 0074 tiene
**5 mutaciones, y 4 apuntan a tests de integracion Neon**. Sin ese `set -a`, esos archivos quedan
en `skipped`. Y una mutacion cuyo oraculo esta skippeado **no da rojo: da verde** — o sea que el
implementador podia ejecutar el protocolo entero, con su `shasum` y su bitacora, y producir
evidencia que **no prueba absolutamente nada**, con el formato de la que si prueba. La medicion del
arbol lo mostraba a la vista y hay que saber leerla: **1201 passed | 423 skipped**.

**La regla ya existia en `CLAUDE.md` y se rompio hacia adentro:** «una afirmacion de IMPOSIBILIDAD
o de COSTO es una afirmacion como cualquier otra, y se verifica **intentandolo**», y su espejo «lo
que le pasas a un subagente como insumo es una afirmacion tuya — re-medi el doc antes de
despacharlo». El sesgo es especifico y vale nombrarlo: **cuando uno escribe «si no podes, declaralo
como limite» se siente prudente**, porque le esta dando al agente una salida honesta. No lo es —
le esta dando permiso anticipado para no medir, y el agente **no tiene el contexto para saber que
el permiso esta mal dado**.

**La regla:** un encargo no ofrece «declaralo como limite» sobre algo que el orquestador **no
intento primero**. Si el limite es real, se demuestra con el comando que fallo; si no se intento,
la frase que corresponde es «corré esto y pegame la salida», nunca «si no podes, declaralo».

## Medir la suite con OTRA corrida de la suite encima fabrica el rojo que despues explicas

**2026-09-18, al cerrar la 0074.** Para no pisar a un subagente que trabajaba, puse un poll en
background que corria `pnpm run test` cada tanto. Despues corri la suite yo, en primer plano, para
reproducir su evidencia. **Las dos corrian contra la MISMA rama Neon.**

Resultado: rojos que no existian. La cronologia es exacta y no deja lugar a la casualidad —

```
poll [1] 11:00:49 roja
poll [2] 11:04:56 roja   <- mi corrida en primer plano 11:05:33 → 2 failed
poll [3] 11:08:50 roja   <- mi corrida de grep en esa ventana → FAIL marketing-placement
poll [4] 11:12:44 roja   <- mi corrida en primer plano 11:13:02 → 1634 passed, 0 failed
```

**En cada par, una de las dos pierde.** El sintoma que lo delata esta en el log:
`marketing_tick {"skipped":"tick_in_flight"}` — o sea, **otra corrida tenia el lock**. Y el par
final es la prueba de que no es el codigo: las dos corridas, sobre el MISMO arbol, una roja y una
verde.

**Y el error de razonamiento que vino despues, que es la mitad cara de esta leccion.** Corri la
suite sola, dio rojo otra vez —en OTRO test, `consumer-recovery`, el del limite «3/hora»— y de ahi
arme una explicacion nueva (paralelismo entre archivos contra una rama compartida), con cita del
comentario de `vitest.config.ts` que dice que las suites `.neon.integration` «borran mundos enteros
contra una rama Neon compartida». **La explicacion era plausible, tenia evidencia citable, y no la
probe.** Cuando la puse a prueba —los tres archivos sospechosos juntos en paralelo— dio
**3 passed / 17 tests**: no reprodujo nada.

Lo que quedo medido de verdad, con nada mas corriendo y despues de que rodara la ventana horaria:
**dos corridas completas consecutivas, 1634 passed, 0 failed las dos.** El unico rojo «limpio» fue
un test de ventana de una hora, corrido despues de ~8 suites en 45 minutos — consistente con estado
acumulado en esa ventana, **pero eso tampoco esta probado y se declara como no probado.**

**Las dos reglas:**

1. **Nunca corras la suite mientras otra corrida de la suite esta viva.** Si hay un poll en
   background que la ejecuta, matalo antes de medir. Una medicion contaminada no se distingue de un
   bug del producto: se lee igual, se reporta igual y hace perder una hora.
2. **Un rojo intermitente no se explica: se reproduce.** La tentacion es armar el mecanismo —tenes
   el comentario del config, tenes el `tick_in_flight`, cierra todo— y pasarlo como hallazgo. Es el
   mismo error que la leccion del `/status`: **el comando de verificacion tambien es una afirmacion**,
   y una explicacion elegante sin experimento que la separe de su alternativa **no es una medicion,
   es una historia**. Si el experimento no reproduce, lo que corresponde es **declarar que no se
   identifico el mecanismo**, no elegir la explicacion mas linda.

## «Los cinco gates verdes» eran cinco de SEIS: `test:e2e` solo lo corre la CI

**2026-09-18.** Se pusheo un arco entero —dos specs con PASS de revisor, mas la UI que el owner
construyo por fuera— reportando **«los cinco gates verdes»**: `typecheck`, `lint`, `format:check`,
`test` (1637 con Neon) y `build`. **CI se puso ROJA igual**, y en un paso que no estaba en esa
lista: **`pnpm test:e2e`** (`ci.yml:64`), Playwright, **7 min 24 s**.

**Lo que rompio, y es peor que un test fragil:**

```
await page.getByRole("radio", { name: /Sellos/i }).check();
  - locator resolved to <input type="radio" value="stamps" class="sr-only" …>
  - element is visible, enabled and stable
  - <span class="loyalty-choice-content">…</span> intercepts pointer events
  → Test timeout of 30000ms exceeded   (reintento 57 veces)
```

Un radio del backoffice **dejo de ser clickeable**. El commit anterior (`78d1f3a`) tenia ese mismo
`test:e2e` en **`success`** y el test no cambio: lo unico del push que toca CSS global es el
`@import "tailwindcss"` que entro por `globals.css`, que importa el **root layout**.

**Y ahi esta la leccion de producto, que es la mitad cara:** el owner habia aceptado explicitamente
que las pantallas viejas **se rompieran** («voy a rediseñar todas, que se rompan ahora no me
preocupa»), y con eso se descarto aislar el CSS. Esa decision se tomo sobre **degradacion visual**
—bullets, margenes, tamaños de heading—, que es lo que se le midio y se le mostro. **Lo que
aparecio no fue visual: fue funcional.** Un click que ya no entra no es «se ve feo»: es una
pantalla que no se puede usar. **El alcance de una decision del owner no se extiende solo: si la
evidencia que se le puso enfrente era visual, una rotura funcional es una decision NUEVA.**

**Las dos reglas:**

1. **Contar los gates contra `ci.yml`, no contra la memoria.** Son **seis**: el Stop hook corre
   tres, las specs listan cinco, **CI corre seis**. El sexto es el unico que nadie corre local —y
   por eso es el unico que puede tumbar `main` despues de un push «con todo verde»—. Va al DoD de
   **toda spec que toque UI, CSS global o una pantalla de `/backoffice`**. Los browsers se bajan
   aparte: `pnpm exec playwright install chromium`.
2. **Cuando se acepta romper algo, acotar QUE se acepta romper.** «Que se rompan» dicho sobre
   capturas de estilo no autoriza que un control deje de responder. Si la rotura cambia de clase
   —de visual a funcional— **vuelve al owner**, no se arrastra la autorizacion vieja.

## 2026-09-19 — La spec mal especificada hace MENTIR al implementador (specs 0077, 0078, 0079 y 0080)

> **Seis casos, y los dos ultimos los produjo el ORQUESTADOR, no un implementador.** El modo de
> fallo no es «el agente barato se equivoca»: es **copiar una afirmacion sin ejecutarla**, y lo
> comete igual quien escribe la spec.

**Que paso.** En la spec 0077, **tres** de los errores que encontro el revisor estaban en la
SPEC, no en el codigo. El peor: la spec afirmaba, presentandolo como medido, que
`defaultAdditionalFields` **pisa** al `override` de `createSession` y que «**por eso**» hacia
falta `overrideAll: true`. **Era falso.** El orquestador habia leido
`better-auth/dist/db/internal-adapter.mjs:204`, visto el spread `...defaultAdditionalFields` y
concluido el resto. No abrio `getSessionDefaultFields`, que esta a 60 lineas de ahi
(`dist/db/schema.mjs:141-146`) y hace `if (fields[key].defaultValue !== void 0)`: **solo emite
campos con `defaultValue`**, y el campo nuevo no tenia ninguno.

**El daño no fue la spec: fue que el implementador la OBEDECIO.** Copio la causa falsa al
docblock de `openMerchantSession`, donde quedo con forma de conocimiento verificado. La cazo el
revisor con una mutacion (`overrideAll: false` → **no se cayo ni un test**).

Los otros dos de la misma spec: un oraculo que pedia **403** donde la propia regla de la spec
(`emailVerified || onboardingGrantActive`) implica **200** —el implementador lo detecto y
pregunto en vez de fabricar el 403—, y un docblock de test que decia pinnear el `isNotNull` del
acortado cuando pinneaba otra linea. En la **0078** se repitio la forma: la tabla «Archivos» de
la spec estaba **incompleta** (no listaba la ruta que habia que tocar para que el `countryCode`
llegara), y el revisor tuvo que dictaminar que eso **no** era alcance ampliado del implementador.

**La regla (ya en `CLAUDE.md`).** Una afirmacion de **mecanismo** que la spec presenta como
«medido» tiene que estar medida **hasta el final**: leer una linea y ver el nombre de una funcion
no es medir, hay que abrir esa funcion. **Media medicion presentada como completa es peor que no
medir**, porque el implementador no tiene motivo para dudar y la propaga al arbol.

**Corolario operativo, aplicado el mismo dia:** el encargo del implementador de la 0078 llevo la
instruccion explicita de **verificar cada cita de la spec antes de apoyarse en ella**, y de
reportar como hallazgo cualquiera que no se sostuviera en vez de copiarla. Verifico las tres que
se le señalaron y las tres se sostenian — pero la instruccion es barata y el modo de fallo es caro.

### Cuarto caso, 2026-09-19 (spec 0079): el ORACULO de la spec estaba VENCIDO

La 0079 fijaba como mutacion M5 «los `code` caen a `codeForStatus` ignorando `error.code`» con el
caso `business_suspended` como oraculo. **Despues de la propia 0079 ese oraculo ya no muerde**: al
mover el guard, el eje `status` lo corta el **paso 4**, que emite su `code` sin pasar por
`codeForStatus`. El revisor lo reprodujo — bajo la mutacion, el caso de `business_suspended` quedo
**VERDE**, y el unico 403 que la sostiene es `email_not_verified`.

Lo notable: **la spec se escribio antes del cambio que ella misma ordenaba**, y su oraculo
describia el mundo viejo. No es una cita mal leida como en la 0077: es una afirmacion que **era
cierta al escribirla y dejo de serlo por efecto de la propia spec**. Se detecta igual — corriendo
la mutacion y **leyendo que test se cayo**, no dando por bueno que «algo» se puso rojo.

De la misma spec: la tabla «Archivos» omitia 13 archivos realmente tocados y listaba
`validation.ts` como «editar» cuando **no tocarlo era lo correcto**. El revisor tuvo que
dictaminar, otra vez, que eso no era alcance ampliado del implementador.

### Quinto caso, 2026-09-19 (spec 0080): el orquestador se lo hizo a si mismo, y lo cazo a tiempo

Escribiendo la 0080 —cuyo trabajo es justamente ponerle oraculo a un invariante que no lo tiene—
el orquestador afirmo que el `if (partial.clauses !== undefined)` estaba en
`program-defaults.ts:134` **y estaba en la 177**. No es un detalle de citado: la 134 esta dentro de
`composeProgramInput`, que es **puro**, y la 177 dentro de `programInput`, que es `async` y consulta
la base. **Con la linea mal, el test que la spec pedia no habria podido pinnear nada**: cuando se
llama al compositor, la decision de sembrar ya fue tomada. El implementador habria escrito un test
verde que no protege el invariante — exactamente el defecto que la spec venia a arreglar.

Lo cazo **abrir el archivo antes de cerrar la spec**, en vez de confiar en la cita del handoff del
revisor (que era correcta: decia «`programInput`»; el orquestador la tradujo mal a un numero de
linea). **La regla operativa que deja: una spec que cita `archivo:linea` verifica ESA linea con un
`grep -n` antes de cerrarse, y si la cita viene con el nombre de una funcion, el numero se
subordina al nombre.**

### Sexto caso, 2026-09-19 (spec 0080): el EJEMPLO con el que se describe un invariante tambien es una afirmacion

El mas fino de la serie, porque la regla de fondo era correcta y **el ejemplo que la ilustraba era
falso**. El revisor de la 0079 reporto: «el contrato dice que `clauses: []` no es lo mismo que
omitir `clauses`; hoy lo sostiene un solo caracter, `!== undefined`, y cambiarlo a truthy haria que
un `clauses: []` reciba las semillas — verificado con una sonda ejecutada». El orquestador lo
copio a la spec 0080 **sin ejecutarlo**, y diseño la mutacion M1 sobre ese ejemplo.

**`[]` es TRUTHY.** `Boolean([])` es `true`, asi que `if (partial.clauses)` y
`if (partial.clauses !== undefined)` **deciden exactamente lo mismo para `clauses: []`**. El
implementador puso la M1 y midio **21/21 en VERDE** con los tres casos que la spec pedia: la
mutacion no tenia como morder. Lo que ese caracter sostiene es un `clauses` **falsy pero
presente** (`null`, `""`, `0`, `false`) — con truthy, un `clauses: null` recibe semillas y **crea
el programa**. El implementador agrego el cuarto caso y ahi si la M1 se puso roja, con **1 test**,
el unico del repo que la ve.

**Lo que lo hace distinto de los cinco anteriores:** no fue una cita mal leida ni una linea mal
numerada. La **regla** («ese caracter sostiene un invariante sin oraculo») era **cierta**; el
**ejemplo** era falso, y el ejemplo es lo que se convierte en mutacion y en test. Una spec que
describe un invariante con un caso concreto esta afirmando que **ese caso lo distingue**, y eso se
verifica como cualquier otra cosa: **ejecutandolo**. Dos lineas de `node -e` habrian bastado.

**Y el espejo, que es la parte cara:** «verificado con una sonda ejecutada» venia de un revisor —
la fuente mas confiable del repo, la que produce PASS con evidencia. **No alcanzo.** La regla de
CLAUDE.md («ningun hallazgo de un subagente entra a una spec sin que vos hayas reproducido la
evidencia») **se aplica igual cuando el subagente es el revisor y dice haberlo medido**. Una cita
de una medicion no es una medicion: es un puntero a donde medir.

**El patron, cinco specs seguidas:** los defectos de este arco aparecen en las SPECS, no en el
arbol. Vale como prior al revisar: **lo primero que hay que dudar en un encargo es la spec**, y por
eso los encargos de este repo llevan la instruccion de reportar como hallazgo toda cita que no se
sostenga, en vez de obedecerla.

## 2026-09-19 — Un insumo falso a un subagente manda a buscar el bug donde no esta

**Que paso.** El orquestador le paso al implementador de la 0078, como dato de contexto, que el
flake de `consumer-recovery.neon.integration.test.ts` era una **colision de `phone_e164` UNIQUE**
sembrado con `Math.random()`. Lo tomo de un handoff de una sesion anterior y **no lo re-midio**.

**Era falso.** El implementador lo midio y el mecanismo real es otro: las lineas **363-367** hacen
`select … where(phoneE164)` **sin `ORDER BY`** y leen `.at(-1)`, y el orden de filas en Postgres
es indefinido; ademas `phones[4]` se usa en **dos** tests distintos (lineas 269 y 350). Lo
demostro con tres corridas del mismo archivo sobre el mismo codigo: pasa, pasa, falla.

**La regla ya estaba escrita en `CLAUDE.md`** —*«lo que le pasas a un subagente como insumo es una
afirmacion tuya — re-medí el doc antes de despacharlo»*— y se violo igual, por la via mas comun:
**copiar de un handoff propio sin releer la evidencia**. Un insumo falso es **peor que no dar
ninguno**: el agente lo toma como suelo firme y sale a buscar el bug donde no esta.

**Lo que salio bien y conviene repetir:** el encargo pedia explicitamente reportar lo que no se
sostuviera, y el implementador **contradijo al orquestador con evidencia** en vez de acomodarse al
dato que le habian dado. Esa contradiccion se propago: al revisor se le paso la correccion junto
con el error original, nombrado como error propio.

## 2026-09-20 — Leer la funcion que ya conoces no es medir el modulo (spec 0083)

**El caso.** La spec 0083 necesitaba un guard de owner **sin** el paso 3 (el gate de email),
porque su endpoint es el que le dice al owner «verifica tu email» y no puede exigir email
verificado. El orquestador abrio `apps/merchant/src/server/api-owner.ts`, leyo el docblock del
modulo y la firma de `requireApiOwner` —**`sed -n '1,90p'`**— confirmo que su escalera aplica el
paso 3 **siempre** y **cerro la investigacion ahi**. Escribio entonces en el §D3 de la spec y en
el ADR 0077 §6: *«no se usa `requireApiOwner` … y tampoco se escribe un resolvedor nuevo: se
llaman las piezas compartidas por separado»*.

**`requireApiOwnerSinGateDeEmail` estaba en la linea 174 del MISMO archivo**, hace exactamente
pasos 1, 2 y 4 sin el 3, y **ya la usaban dos rutas**.

**Que produjo.** El implementador obedecio la spec al pie de la letra y armo la escalera a mano.
El resultado era **correcto y seguro**, paso los seis gates y un barrido de mutaciones — y por
eso mismo no lo iba a cazar ningun test. Lo que creaba era una **ruta exenta del gate de email
invisible a los DOS mecanismos con que el repo las cuenta**: `rg 'SinGateDeEmail' apps` y el
inventario `NOMBRES_SIN_GATE_DE_EMAIL`, aseverado cerrado en 2. La spec 0075 §D1 habia elegido
deliberadamente **un nombre distintivo en vez de un flag booleano** justamente para poder
contarlas; una escalera a mano evade ese mecanismo sin poner rojo a nada.

Peor: el docblock que escribio el implementador decia *«tampoco escribe un resolvedor nuevo»* —
una afirmacion que **no se sostenia**, en el arbol, con forma de conocimiento verificado.

**Como aparecio.** No lo cazo un test ni el revisor: lo cazo el ORQUESTADOR reproduciendo la
evidencia de la entrega, cuando un `grep` de otra cosa devolvio una linea de un test que
mencionaba `requireApiOwnerSinGateDeEmail`. **Fue suerte, y por eso hace falta la regla.**

**La regla.** Antes de afirmar «no existe una pieza que haga X» o «hay que armar X a mano»,
**listar los exports del modulo donde X viviria** — `rg -n '^export (async )?function|^export
const' <archivo>` — en vez de leer solo la funcion que ya conocias. Una funcion con el docblock
correcto puede tener al lado una hermana que es exactamente lo que buscabas. **Leer 90 lineas de
un archivo de 250 y concluir sobre el archivo es la familia «medicion a medias presentada como
completa»**, la misma de la 0077, aplicada a un modulo en vez de a una funcion.

**Y el corolario de proceso:** un implementador que obedece una spec equivocada produce codigo
que pasa todos los gates. **La spec es un insumo del agente, y un insumo falso no falla ruidoso.**

## 2026-09-20 — El criterio de DoD que pasa vacuo: `rg` no es `grep` (spec 0084)

**El caso.** Escribiendo la DoD de la spec 0084 el orquestador puso el criterio
`rg -n 'user_id\|userId' apps/.../onboarding-tour.ts` → **vacio**, para blindar la decision del
owner de que el progreso del tour se guarda **por negocio y no por usuario**.

**Por que estaba mal.** `\|` es la alternacion de `grep`/BRE. **`rg` es regex extendido por
defecto**, donde `\|` significa **la barra vertical literal**. El patron no matchea nunca.

**Que produjo.** Nada todavia, porque se cazo antes de cerrar la spec — y se cazo **solo porque
se corrio**. Probado contra `schema/business.ts`, que tiene `user_id` y `userId` en tres lineas:
la forma con `\|` devolvio **vacio**; la forma correcta devolvio **tres matches**.

**Lo que lo hace peligroso.** El criterio afirma «→ vacio». Un comando roto tambien devuelve
vacio. **Los dos desenlaces son indistinguibles desde afuera**, asi que el criterio habria pasado
en verde para siempre sin verificar nada — y el revisor lo habria marcado como cumplido. Es la
misma familia que el `EXIT 0` sobre arbol limpio de un hook que nunca miro nada.

**La regla.** Ya existia («los barridos `rg` se corren contra el arbol ANTES de cerrar la spec»,
instaurada cuando la 0067 cerro con cuatro criterios imposibles). Lo que se agrega es el **motivo
especifico y el modo de falla**: no es que el comando falle, es que **pasa**. Un criterio de la
forma «→ vacio» **no esta verificado hasta que se lo vio dar NO-vacio sobre un caso que deberia
matchear**. Es el mismo principio que «probar que el oraculo MUERDE». Linea agregada a la skill
`protocolo-de-verificacion`.

## 2026-09-20 — Un gate que se auto-rompe al forzarlo: `typecheck` y `build` no van en la misma invocacion de turbo (spec 0084)

**El caso.** Cerrando la 0084 el orquestador corrio los cinco gates y los vio verdes, pero
`typecheck` y `build` vinieron de **caché** (`>>> FULL TURBO`). Para no dar por bueno un log
replayado los forzo — y juntos, en **una sola** invocacion:
`pnpm exec turbo run typecheck build --force`. **Rojo:**

```
@mi-pasaporte/merchant:typecheck: .next/types/validator.ts(5,79):
  error TS2307: Cannot find module './routes.js' or its corresponding type declarations.
```

**El mecanismo, medido hasta el final.** `apps/merchant/tsconfig.json:6` incluye
`".next/types/**/*.ts"`. En una sola invocacion turbo corre las dos tareas **concurrentes**;
`next build` regenera ese directorio, y `tsc` alcanza a leer `validator.ts` cuando el `routes.js`
que ese archivo importa todavia no existe. **Forzados por separado, los dos pasan** (`3 successful`
cada uno, `0 cached`).

**Por que importa y no es anecdota.** El rojo es **del arnes, no del arbol**, y llega en el peor
momento: al final de una spec, sobre codigo que acaba de pasar una revision independiente. Quien
no mida el mecanismo tiene dos salidas igual de malas — reportarle al owner un fallo que no existe,
o «arreglar» el codigo hasta que el sintoma se vaya.

**La regla.** `typecheck` y `build` se corren **en invocaciones separadas**, siempre. Es lo que
hacen `pnpm run typecheck` y `pnpm run build` por separado, que es la forma documentada; el atajo
de juntarlos en un `turbo run a b` es el que rompe. Linea agregada a la skill `gotchas-del-repo`.

**Y la de fondo, que ya es regla de la casa:** un gate que devuelve `FULL TURBO` **no midio nada
en esta corrida**. Si de lo que se esta por afirmar depende que el gate haya mirado el arbol de
verdad, se fuerza — de a uno.

## 2026-09-20 — `CREATE TABLE IF NOT EXISTS` en una migracion: una spec dictando una idempotencia que no existe (spec 0084)

**El caso.** La spec 0084 escribio en su §Modelo de datos: *«La migracion es `CREATE TABLE IF NOT
EXISTS` y no siembra datos»*. El implementador obedecio y lo agrego a mano, porque
**`drizzle-kit generate` no lo emite**.

**Por que estaba mal.** Medido sobre las 41 migraciones del repo: **ninguna otra `CREATE TABLE` lo
lleva**; el unico `IF NOT EXISTS` del arbol es un `CREATE EXTENSION` en la `0016`. Y lo peor es que
la propiedad que la frase sugiere **es falsa**: re-ejecutados los dos statements del `.sql` contra
la base, el `CREATE TABLE IF NOT EXISTS` pasa pero el `ADD CONSTRAINT` de la FK que viene despues
vuelve con **`42710` (`constraint ... already exists`)**. O sea que la migracion **no es
idempotente**, con o sin esas dos palabras.

**El hallazgo secundario, que corrigio una hipotesis comoda.** Se penso en dejarlo por miedo a que
editar un `.sql` ya aplicado rompiera el `hash` de `drizzle.__drizzle_migrations`. **Falso, y se
midio:** `pg-core/dialect.js:62` decide con
`Number(lastDbMigration.created_at) < migration.folderMillis` — por **timestamp**. El `hash` se
guarda y **nunca se compara**. La razon para no tocarlo es otra (ya paso la revision y no compra
nada), no la que primero sonaba plausible.

**La regla.** Una spec **no dicta el texto de una migracion**: dicta la forma de la tabla y deja
que `drizzle-kit generate` emita el SQL. Y si igual se va a afirmar una propiedad del `.sql`
—«es idempotente»— esa propiedad **se ejecuta**, no se supone: es una afirmacion de mecanismo como
cualquier otra. Linea agregada a la skill `gotchas-del-repo`.

## 2026-09-20 — La tabla de mutaciones de una spec es una afirmacion, y la M5 de la 0085 era falsa

**El caso.** La spec 0085 tabulo su mutacion M5 asi: *«Sacar el `sort` por `position` de
`toChecklistView`» → «El unit con entradas desordenadas **y el orden de los 5 ids en
integracion**»*. El implementador la ejecuto: el unit se puso rojo, y **el caso de integracion
quedo VERDE**.

**El mecanismo, medido.** `CHECKLIST_ITEMS` declara `verify-email` primero (`position: 1`) y
despues hace spread de `ONBOARDING_TOURS` con `position: indice + 2`. **`Object.entries` ya sale
ordenado**, asi que contra el catalogo REAL el `sort` es un **no-op** y no hay nada que
falsificar. Su unico oraculo son las entradas **sinteticas** del segundo parametro.

**Lo peor del caso: la spec se contradecia a si misma.** Su §1 ya decia que ese segundo parametro
existe porque es *«la unica forma de alimentar entradas sinteticas desordenadas, que el catalogo
real no puede producir»*. **Las dos secciones nunca se cruzaron.** Una tabla de mutaciones escrita
desde el DISEÑO no ve lo que el codigo termino afirmando.

**Lo que salio bien, y hay que repetirlo.** El implementador **no reordeno el catalogo para
fabricar el rojo** — habria sido una decision de diseño que nadie pidio, moviendo las `position`
(salen del indice) y el orden que dicto el owner. **Reporto el hueco en vez de taparlo.** Y el
revisor, al arbitrar, encontro la tercera opcion que nadie habia probado (declarar `verify-email`
**despues** del spread: salida HTTP identica, **129/129 verde**, y el `sort` pasa a ser
falsificable con el catalogo real). No se aplico porque llego **despues del PASS** y es codigo de
produccion; quedo con su gatillo escrito.

**La regla.** Es la misma de la 0080 —*el ejemplo con el que describis un invariante es una
afirmacion, no una ilustracion*— con un agravante nuevo: **cada fila de la tabla de mutaciones
afirma que un oraculo concreto DISTINGUE la mutacion**, y eso se verifica **corriendolo**, no
razonandolo desde el diseño. Y antes de cerrar una spec hay que **cruzar la tabla de mutaciones
con el resto de la prosa**: aca las dos secciones decian cosas opuestas y ninguna estaba oculta.

## 2026-09-20 — Un barrido mal armado devolvio vacio y lo lei como una ausencia (tercera vez en la misma sesion)

**El caso.** Cerrando la 0084 el orquestador quiso confirmar que la bitacora de mutaciones del
implementador estuviera persistida en `TASKS.md`. Corrio `grep -n 'BITACORA.*0084'`, vio **una
sola fila** (la del revisor) y reporto —al owner y en el mensaje del commit `9dfd293`— que **«la
bitacora del implementador nunca se persistio»**.

**Era falso.** La bitacora estaba en el archivo, completa, con las cinco mutaciones y sus
aserciones. El titulo era **«SPEC 0084 — EN IMPLEMENTACION (2026-09-20). BITACORA DE
MUTACIONES»**: el numero va **antes** de la palabra, y el patron `BITACORA.*0084` exige el orden
contrario.

**Por que es la MISMA familia que las otras dos de esta sesion** —el `rg` con `\|` de la DoD de la
0084, y el docblock que rompia su propio criterio citandolo— **y por que es la mas cara de las
tres:** en las otras dos el barrido fallaba en verde y nadie se enteraba. Aca el vacio se
**interpreto**, y la interpretacion viajo a un mensaje al owner, a un `mistake→rule` inventado
(«exigir la bitacora como entregable») y a un commit. **Un hallazgo que no existia gasto atencion
del owner.**

**La regla, que es una sola linea:** **un barrido que devuelve vacio no prueba una ausencia hasta
que se lo vio dar NO-vacio sobre algo que deberia matchear.** Ya estaba escrita para los criterios
de DoD (leccion del `rg` vs `grep`); lo que se agrega es que **vale igual cuando el barrido es
exploratorio y su resultado va a un mensaje**. Antes de afirmar «X no esta en el archivo»: correr
el patron contra un caso positivo conocido, o usar la forma que no depende del orden
(`grep -in 'bitacora' | grep 0084`).

## 2026-09-20 — Una decision del owner que vivio solo en el chat, y tres specs la copiaron como «pendiente»

**El caso.** El revisor de la spec 0083 declaro afuera el `503 onboarding_unavailable` y escribio
que quedaba *«pendiente de decision del owner, a quien se le ofrecio»*. La **0084** copio esa
linea. La **0085** la copio otra vez. Dos docblocks de tests de integracion la copiaron tambien.
Al cerrar el arco, el agente se lo volvio a ofrecer al owner — y el owner contesto: *«pense que ya
lo habias resuelto porque hace mucho que te dije que resuelvas esto»*.

**Se busco antes de contestarle**, que es lo unico que se hizo bien: `503` en `TASKS.md`,
`PARQUEADO.md`, `INDEX.md` y `docs/archivo/`. **La instruccion del owner no estaba en ningun
archivo.** La del agente estaba **cinco veces**.

**El mecanismo de la falla tiene dos mitades, y las dos son evitables.**

1. **La decision se tomo en el chat y no bajo a disco.** Es literalmente lo que advierte el
   §Estado de `CLAUDE.md` —*lo que tiene que sobrevivir va a un archivo*— aplicado a una
   decision del owner, que es el tipo de dato mas caro de perder: no se puede re-derivar del
   codigo ni de la historia de git.
2. **El «declarado afuera» se COPIO de una spec a la siguiente sin re-verificarse.** Ahi esta lo
   que agrega este caso: **copiar una afirmacion es re-afirmarla.** Cada vez que la 0084 y la
   0085 escribieron «el owner todavia no decidio», estaban haciendo una afirmacion NUEVA sobre el
   estado del proyecto, sostenida solo en que la spec anterior lo decia. Ninguna de las dos
   volvio a mirar.

**Lo que costo.** Nada de codigo — el cierre resulto barato: un archivo de test con dobles, dos
controles positivos, tres mutaciones rojas y **cero lineas de produccion tocadas**. Lo que costo
fue **atencion del owner**, tres veces, sobre algo que ya habia resuelto.

**Y un hallazgo de regalo al cerrarlo:** las tres specs decian que el `catch` *«no filtra nada»*.
Eso era un **leido del codigo, no una medicion**, y no tenia ni un test: se regresa escribiendo
`error.message` donde dice `error.name`, y nadie lo ve. Ahora el oraculo existe y muerde en los
dos canales (cuerpo HTTP y `console.error`). Tambien se corrigio de paso un «tres rutas» que eran
**dos** — el numero contaba specs, no rutas, y nadie lo habia contado.

**Las reglas.**
- Cuando el owner decide algo que cambia un **limite declarado**, el limite **se cierra o se
  reescribe en el mismo turno**. Una decision suya no termina en un mensaje: termina en el
  archivo que la contradice.
- **Un «declarado afuera» no se copia entre specs.** Se re-verifica contra las palabras del owner
  antes de repetirlo, igual que cualquier otra afirmacion heredada.

---

## 2026-09-21 — Spec 0086. Tres veces el mismo patron: el oraculo verde por un seed irreal

**El caso.** La spec 0086 se implemento y reviso con **17 mutaciones ejecutadas** (8 del
implementador, 9 del revisor). Tres de ellas midieron **VERDE el archivo que uno esperaba que se
pusiera rojo**, siempre por la misma causa:

| Mutacion | Archivo que quedo verde | Por que |
|---|---|---|
| **M3** (el paso 4 deja de exceptuar al staff) | `permisos-mostrador.neon` | el oraculo real era `counter-email-gate.test.ts`, con dobles |
| **M8** (el writer deja de saber que el caller es staff) | el caso de EDITAR el programa | el staff sembrado tenia `emailVerified: true` |
| **M3 re-corrida por el revisor (RV9)** | `permisos-delegados.neon` **y** `permisos-mostrador.neon` | la misma causa que M8, en la fuente |

**La causa unica:** `seedMember` creaba el `user` con **`emailVerified: true`**, pero un
integrante **real** nace con **`false`** (`staff-create.ts:132` — su email es el sintetico
`@staff.invalid`, que no se entrega nunca). O sea que **las suites de integracion estaban
midiendo un caller que no existe en produccion**, y cualquier oraculo que dependiera del gate de
email pasaba en verde sin medir nada.

**Lo que lo salvo fue mutar, no leer.** El codigo estaba **bien** en los tres casos: lo que
fallaba era el oraculo. Un barrido estatico, una revision de codigo o un «los tests pasan» no lo
habrian encontrado nunca — la unica señal fue una mutacion que **sobrevivio**.

**Y el segundo error, que casi lo deja abierto:** la primera reparacion fue **local** (un
`UPDATE emailVerified:false` dentro del archivo que se estaba arreglando). Eso apago el sintoma
en un archivo y **dejo la causa en la fuente**, asi que las otras dos suites siguieron midiendo
al caller irreal. Lo cazo el revisor re-corriendo M3.

**Las reglas.**
- **Una mutacion que sobrevive es un hallazgo, no un tramite.** Antes de declarar la fila falsa,
  preguntarse si el que miente es el **oraculo** y no la tabla. Aca la fila era verdadera las
  tres veces.
- **Un seed de test es una afirmacion sobre como es el caller en produccion.** Si diverge, todo
  lo que se mida con el vale cero. `seedMember` pasa a `emailVerified: opts.emailVerified ?? false`
  — **la forma de produccion es el default y `true` hay que pedirlo**.
- **Una reparacion de oraculo se hace en la FUENTE.** Un parche local apaga el sintoma del
  archivo que estas mirando y deja los demas midiendo lo mismo de antes, sin avisar.
- **Y se prueba que la reparacion MUERDE**, o no es una reparacion: sacando la linea, la mutacion
  tiene que volver a sobrevivir. El revisor lo midio (RV2) y volvio a verde 7/7.

## 2026-09-21 — Spec 0086. La SEGUNDA fila de mutacion falsa seguida, y las dos las escribi yo

**El caso.** La fila **M6** del plan de pruebas de la 0086 decia: *«el writer del **catalogo** se
llama sin pasar por el evaluador del plan»*. **El catalogo no tiene evaluador de plan.**
`ENTITLEMENTS` tiene exactamente dos claves, `locations.max` y `campaigns.enabled`
(`entitlements/catalog.ts:69,78`). La mutacion, como estaba escrita, era **imposible de ejecutar**.

**Es la segunda spec seguida con una fila de mutacion falsa** — la anterior es la M5 de la 0085,
que afirmaba un rojo que nunca existio. **Las dos las escribio el orquestador**, o sea yo, y las
dos las cazo el agente que fue a ejecutarlas.

**La regla que ya existia y no alcanzo.** `CLAUDE.md` dice que el ejemplo con el que describis un
invariante es una **afirmacion**, no una ilustracion. Una fila de la tabla de mutaciones es
exactamente eso: afirma que **existe un mecanismo X** y que **el oraculo Y lo distingue**. En la
M6 el mecanismo no existia; en la M5 de la 0085 el oraculo no distinguia.

**La regla nueva, que es mas barata que ambas.** **Cada fila de la tabla de mutaciones se
verifica contra el arbol ANTES de cerrar la spec** — el mecanismo que nombra tiene que existir y
hay que poder senalar el archivo y la linea. Dos minutos de `rg` por fila. No se despacha una
tabla de mutaciones cuyo mecanismo no se abrio.

## 2026-09-21 — Spec 0086. El §7 afirmaba un mecanismo medido a medias, y tapaba un bloqueo real

**El caso.** El §7 de la spec decia: *«un integrante con `loyalty` **edita** el programa y **no
puede crearlo**. Es correcto y queda declarado»*. **Es exactamente al reves.**
`programEditDenied` (`onboarding-grant.ts`) hace:

```ts
if (!input.isEdit) return null;                                 // CREAR es libre
if (input.emailVerified || input.onboardingGrantActive) return null;
return { status: 403, code: "email_not_verified", ... };        // EDITAR exige email
```

**Crear es libre** (ADR 0070 §11) y **editar** exige `emailVerified`, que un staff **nunca**
tiene. La spec afirmaba como propiedad deseada lo contrario de lo que hace el arbol.

**Lo caro no fue la frase: fue lo que TAPABA.** Al declarar el comportamiento como «correcto y
declarado», la spec cerraba la puerta a mirar ahi — y detras habia un **bloqueo real** que dejaba
la superficie `loyalty` delegada pero muerta. El implementador lo encontro **solo porque fue a
medir**, no porque la spec lo mandara.

**Y su gemelo en el codigo, la misma familia:** el docblock de `loyalty-program/route.ts` afirmaba
que `!== "owner"` era **fail-closed** para un rol desconocido. Es **falso**: con `!== "owner"` un
rol desconocido **si** queda exento. El comportamiento estaba bien —el dominio **espeja** al paso
4 del guard, y esa consistencia es la propiedad— pero la justificacion escrita mandaba a la
proxima sesion a escribir la sonda contra el lugar equivocado. Lo cazo el revisor.

**Las reglas.**
- **Una afirmacion de mecanismo en una spec se mide ABRIENDO la funcion**, no leyendo su nombre
  ni el docblock de quien la llama. Es la misma regla de la 0077, y volvio a costar.
- **Un «es correcto y queda declarado» es la frase mas cara de una spec:** cierra la puerta a
  mirar. No se escribe sin haber ejecutado lo que declara correcto.
- **Un docblock que explica POR QUE una comparacion tiene la forma que tiene es codigo, no
  prosa**, y se verifica igual. Un comentario que dice «fail-closed» sobre algo que no lo es
  sobrevive a todos los gates.

---

## 2026-09-21 — Spec 0087. Un `code` nuevo que ya existia, con otro status y otra audiencia

**El caso.** La enmienda §5 de la 0087 necesitaba un `code` para «el integrante que queres
renombrar esta dado de baja». El orquestador eligio **`staff_disabled`** y lo escribio en la
spec, en el contrato y en el encargo del implementador.

**Ese `code` YA EXISTIA y estaba establecido.** Tiene su propio **ADR 0055**, dos specs (0057,
0067), y lo emiten cinco archivos de codigo. Lo devuelve el **login** con **403**
(`api/merchant/auth/staff/route.ts:105-109`) y significa *«TU acceso esta desactivado»*, dirigido
**a la persona rechazada**.

El de la enmienda significa **otra cosa** —*«el TARGET que queres editar esta de baja»*, dirigido
**al merchant**— y sale con **409**. **El mismo string con dos status y dos audiencias.**

**Por que importa mas de lo que parece:** en este repo **el `code` ES el contrato** y el `error`
es copia reescribible. Un consumidor que mapee por `code` sin mirar la ruta se come la diferencia
entera. Y las tablas de contrato viven **por spec**, asi que ninguna de las dos habria mostrado a
la otra.

**Quien lo cazo:** el **implementador**, leyendo el arbol al implementar — no el orquestador al
elegirlo, ni el revisor. Lo subio como *hallazgo a decidir* con la evidencia y tres salidas
posibles, sin tomar la decision. Renombrado a **`target_disabled`**, que espeja a
`target_is_owner`: su hermano en la misma tabla y la misma familia.

**La regla.** **Antes de bautizar un `code` nuevo, `rg` por ese string en `apps` y `docs`.** El
catalogo de `code` es **compartido por todo el producto** aunque las tablas de contrato esten
partidas por spec. Dos minutos. Y el corolario de nombre: un `code` que describe **al target** de
una operacion se llama `target_*`, no como el estado que describe — asi la colision es dificil
incluso sin el `rg`.

## 2026-09-21 — Spec 0087. TERCERA spec seguida en la que un DOBLE irreal ensucia una medicion

**El caso.** Ya son tres, y las tres veces el patron es identico: **un doble de test devuelve una
fila que la base no puede producir**, y una mutacion se lee mal por eso.

| Spec | El doble devolvia | En la base |
|---|---|---|
| 0086 | `emailVerified: true` para un staff | un integrante real nace en `false` |
| 0087 (M4/R4) | filas `{handle:"000"}` **sin `userId`** | `user_id` es **`NOT NULL`** |
| 0087 (M7) | `{role:"owner"}` **sin `status`** | `status` es **`NOT NULL DEFAULT 'active'`** |

**Las consecuencias son las DOS**, y conviene tenerlas separadas:

- **Falso VERDE** (0086): la mutacion sobrevive porque el caso mide un caller que no existe.
- **Falso ROJO** (0087, las dos): la mutacion «muerde», pero **la propiedad que acusa solo existe
  en el doble**. En R4 el guard mutado no cambiaba **ningun resultado real**; en M7 el rojo
  colateral acusaba al doble, no al codigo.

**Un falso rojo es mas caro de lo que parece**, porque **se lee como exito**: la mutacion dio
rojo, el oraculo «muerde», se sigue de largo. Nadie audita un rojo.

**Las reglas.**
- **Un doble de test es una afirmacion sobre lo que la base puede devolver.** Si omite una
  columna `NOT NULL`, esta describiendo una fila **imposible**, y todo lo que se mida con ella
  vale cero.
- **Ante un rojo de mutacion, preguntarse SIEMPRE si la propiedad que acusa existe fuera del
  doble.** La pregunta es barata: abrir el esquema y mirar los `notNull()`.
- **Se arregla el DOBLE, no el test.** Y se **re-mide** despues: en la 0087 la segunda lectura de
  M7 dejo un solo rojo, y era el correcto.
