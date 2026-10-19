# 0242 M1 — receta R1.2, listado real contemporáneo

Revisión R1.2 previa a datos; la ejecución3c07 se detuvo antes de iniciar
browser/servidor/warmup/muestras por metadata pnpm previa a build. No se cambia
tamaño/orden/estimadores ni se reemplaza ninguna muestra (hubo cero).
R1.2 fija prepare-metadata como provenance y freeze-metadata FINAL como identidad
de ejecución, con versiones/lock/realpaths estrictos y copias privadas comparables.
Revisión R1.1 previa a datos; sustituye R1 del commit1c39815c, rechazada por QA
sin ejecutar datos. Corrige adaptador OPEN, marcador de revisión, bytes desconocidos
y verificación durable de cleanup. Receta previa a datos. Este primer corte mide listado; no cierra0242 ni sustituye
los gates de catálogo, detalle, guardar, QR, preparar y cerrar. No hay datos M1
recogidos al escribir R1. El coordinador autoriza recursos por separado después de
la preparación offline. No capturas/push/PROD. M0, sus21identidades y todos sus
artefactos permanecen preservados.

## Fuentes y ejecución

Control compilado original: buildSource
`6f8e1e9cecdd33930c5f055db43641d805dbe3c2`, BUILD_ID
`VLV2fFFeM_dUWKnxvv7iY`, archivo privado `private/control-build-6f.tar.gz`,
SHA256 `54cbc567143f7d3e2af43309810c14da6bea647ab50926534ecb4b78109ec5fe`.
No se recompila control. Se extrae en scratch privado nuevo, con fuente externa a
`.next` obtenida de ese mismo commit; no es un cuarto worktree ni usa `.old.next`.
Candidato: fuente combinada funcional aceptada por QA independiente, base de
producto `b6375774a5b2f5c157df7aadc09b5f6820479c99`, más este harness offline.
El SHA exacto del runner y el buildSource real quedan en plan/freeze, junto a
BUILD_ID, archivos compilados, fuente, lockfile, configuración protegida,
instrumentación, esquema/migraciones y fixture. Nunca atribuir al control un
build nuevo por cambiar runner. «Contemporáneo» describe las ejecuciones A/B
actuales del control archivado frente al build propio del candidato.

Node24, pnpm11.4.0, Next build webpack/start, mismo host, transporte HTTP/WS y
configuración seleccionada CI privada. Runtime scratch por fuente, dependencias
del WT asignado, con paths reales y hashes/versiones manifestados. No Nextdev. Build candidato usa Node directamente sobre el CLI Next fijado por
versión/realpath; no pnpmexec dentro de scratch con node_modules compartido.
El prepare conserva modules-prepare.yaml exclusivo0600 y hash de provenance;
freeze, DESPUÉS de setup/login/build, conserva modules-execution.yaml0600 y
hash final de ejecución. Se comparan copias reales y registran changedKeys/hashes;
no se inventa un diff si falta baseline histórico. Lock fuente/installed-lock,
versiones/packageJSON de Next/React/BetterAuth/drivers/Playwright/TypeScript,
Node/pnpm y realpaths deben seguir idénticos entre prepare y freeze. Durante
TODOS los intentos se exige ese metadataFINAL exacto, además de la identidad
real de dependencias: ningún cambio pnpm incidental se permite ya en campaña.
La instrumentación real existente preload/SQL/fases no cambia; registrar su hash
actual separado de hashes de instrumentación compilada del control.

El preload aceptado exige auth en `http://localhost:43242`; ambas fuentes usan
SERIALMENTE ese mismo origen/puerto, con reserva exclusiva. No alterar cookies,
duración de sesión, caché de auth ni preload para simular equivalencia.
Cada observación planificada inicia un proceso propio nuevo de su fuente y hace
exactamente UNA entrada completa de warmup funcional fuera del reloj. Se observa
su finalización con la misma regla de quietud. La muestra normal es una recarga
completa del mismo contexto después de ese warmup: proceso/pool calentados y
assets de ese contexto disponibles. Un fallo de warmup detiene la campaña; no
añadir warmups ni reintentos a conveniencia. Arranque/startup queda fuera del
marcador y se manifiesta. No se declara DB fría: el wrapper ya la despertó.
No se extrapola a hostingPROD. No hay población inferencial de proceso/pool frío.

Antes de medir se exige checkout limpio y freeze compatible. Política de hashes
versionada antes de datos: sólo `.next/cache/fetch-cache/**`,
`.next/cache/images/**` y `.next/trace` se clasifican runtime mutable conocido.
Se manifiestan sus hashes iniciales/finales y cada delta por intento; no se ignoran.
No se excluye todo cache: webpack/tsbuildinfo, paths no clasificados, ISRserver,
BUILD_ID, manifests, server, static, types, diagnostics y trace-build siguen
inmutables. Un cambio allí aborta por drift. Una nueva clase mutable legítima
requiere investigación y política previa explícita, nunca exclusión retrospectiva.
El freeze control además compara sus compilados con el mapa archivado del plan.

Antes de medir se exige checkout limpio y freeze compatible. Cada fuente usa
código archivado/compilado correcto y la misma topología de observación. Tras
cada observación se detiene sólo el proceso propio; nunca3201/PID927/túnel.
El runner falla si43242 ya está ocupado, sin tocar a su dueño.

## Fixture y equivalencia observable

Namespace NUEVO `m1-*` privado0700, archivos propios0600 y creación exclusiva.
`selected.json`/`ci.env` existentes se leen; no se copian envPROD ni se escriben.
AntiPROD se comprueba SIEMPRE, también con NODE_ENVproduction y aliaspooler.
DB sólo wrapper `tools/neon-test.sh`, tras transferencia explícita y serial con
regresión, incluidos setup/login/inspect/cleanup. Nuevos tenants/usuarios/UUID,
prefijo `posm10242-`; nunca importar o resetear tenants/ledger/históricos M0.

Tres tenants sintéticos: empty0órdenes, normal24abiertas×8líneas/120productos,
volume200abiertas×30líneas/2000productos. Ocho categorías, dos locales. Todos los
productos/líneas son unidades compatibles con ambas fuentes, tarifa2.00,
cantidad1, total16.00normal/60.00volume. Los IDs de cada línea se premanifiestan
y se insertan explícitos; inspect verifica IDs/producto/nombre/qty/precio/medidas
unit/unit/unit/mass-si-1 y posición contra DB antes del freeze. Órdenes alternadas entre locales; índices
pares pertenecen a Centro, impares a Norte. El manifiesto congela orden de IDs de
locales `[Centro,Norte]`; ambos clientes seleccionan Centro inicialmente, tal
como hacen control y candidato. Normal compara12filas visibles respaldadas por
los mismos24IDs de respuesta, y volume100visibles/200IDs; nunca24contra12.
La respuesta debe conservar cada ID→label→local→estado→líneas→total, con cero
cerradas. El marcador DOM comprueba exactamente las labels del primer local,
acciones autorizadas habilitadas y heading de listado. Las labels se vinculan a
IDs en la respuesta validada; no basta contar cards. Dos botones de una misma
card no duplican una orden. Empty exige estado vacío real y Nueva orden habilitada.
No skeleton, DCL ni montaje sirven como listUsable.

Owner y staff se analizan separados. Staff conserva exclusivamente permiso[pos]
y PIN vigente, sin ampliaciones para facilitar navegación. Auth real mediante
helper existente OTP/PIN; cookies emitidas por proveedor, privadas y legítimas.
No endpoints de diagnóstico públicos, interceptación deAPI ni cambios deproducto.

## Tamaño y orden fijados

Por rol, listado normal:30pares,60observaciones. Quince bloques ABBA, donde A es
control y B candidato; cada bloque contiene un parAB y unoBA. Se permuta el orden
de los15IDs de bloque con Mulberry32 y semilla24220261018 reducida a uint32; no se
permuta el ordenABBA dentro del bloque. Owner precede staff. Todos los intentos,
errores, warmups y observaciones incompletas se conservan. No reemplazos/retries.

Por rol y fuente:10primeras entradas con assets nuevos en población separada.
Después del warmup fijo se cierra su contexto y se crea otro limpio con cookies
legítimas; Chromium usa caché normal, serviceWorkers bloqueados. No se mezcla
esa primera entrada con la recarga normal ni se atribuye precisión inferencial.
Los10pares alternanAB/BA (cinco de cada uno).

Cuatro diagnósticos separados, cada uno5pares por rol: empty, volume,
lista→detalle y detalle→lista. AB/BA alterna; owner iniciaAB y staffBA para
balance global. Lista→detalle abre la misma ordenM1 000 del primer local;
detalle/revisión abierta usable exige respuesta exacta contra fixture: ocho
lineIDs/productIDs/nombres, cantidad1, precio2, lineTotal2, localCentro, estadoOPEN
y medidaunit. El DTOcontrol no expone medida: se acredita por fixture y esquema
inspeccionados, sin inventar campos deAPI. El marcador se limita a la región
Productos del pedido visible (y secciónOrden en candidato), con exactamente
ochofilas reales, cada nombre/cantidad1/precio2 y Cobrar habilitado. No usa nombres
del catálogo120productos ni texto global como prueba de líneas. AbrirOPEN lleva
a revisión/editor, no al ticket de una venta cerrada. Retorno prepara ese mismo
editor/revisión fuera del reloj y mide
acción de volver hasta el mismo conjunto exacto de12filas y Nueva orden activa:
control usa Volver al listado de órdenes; candidato usa Salir. No cambiar producto
para igualar selectores. La respuesta y el DOM deben validar ambos antes de aceptar
el intento, sin relajar el marcador.
No guardado ni venta. No son transición de otra rutaRSC. Con staff[pos] no existe
landing autorizada distinta equivalente: ese trayecto no forma esta población,
no es un test saltado niPASS. Owner tampoco se mezcla con un trayecto distinto.
Una futura receta puede incorporar otra ruta con landing autorizada comparable.
El diagnóstico de transiciónRSCowner queda pendiente y separado de lista↔detalle;
R1 no lo acredita. Para staff no está disponible bajo el permiso fijado.

TotalR1:240observaciones medidas,240warmups y20preparaciones de detalle fuera
del reloj de retorno. El plan enumera cada observación antes de empezar; IDs y
salidas son exclusivos. Cualquier error funcional/estructural detiene el corte,
preservando todo lo observado. Una campaña parcial no producePASS.

## Relojes, evidencia y gates

listUsable full-navigation: `performance.now()` desde origen de la navegación
hasta marcador DOM semántico. Registrar timeOrigin, TTFB, RSC/JS/CSS y todos los
recursos, waterfalls/encoded/decoded/cache/errores, longtasks, todos los requests
incluidos sesión/módulos/proveedor global, con initiatorCDP/stack saneado por path.
No registrar queries URL, cuerpos, cookies, scopeKey oQR en informe público.
Una entrada fría de navegador puede revelar trabajo global que el smoke caliente
no vio: no omitirlo ni llamarlo cero por observar sólo rutasPOS. Candidato exige
ceroGETsesión/ceroGETmódulos adicional y exactamente unGETlistado por entrada;
si aparece trabajo global no resuelto, se informa y vuelve al autor pertinente.
Los warmups se preservan por separado; sus errores no se eliminan del informe.
Observar SQL/request/guard/tx/commit/aftercommit mediante preload aceptado y sus
tags propios, sin sumar medianas para fabricar trayectos.

Tras marcador se espera finalización de requests y lectura de respuestas, más
500ms continuos sin pendientes, máximo15s. Waterfalls registran finish/error/
timeout y bytes realmente observados; bytes desconocidos quedan null, nunca0
inventado. CDPdecoded inicia null; sólo se suma cuando dataReceived lo observa,
y cero sólo cuando observado o finalizaciónHEAD/HTTP204/205 lo confirma. Un
finish sin evidencia de decoded no convierte cache/error/timeout en cero.
Este asentamiento queda FUERA del reloj listo. Fracaso/timeout es
evidencia inválida y se conserva. No cerrar contextos con peticiones pendientes
silenciosas ni inferir status200, cancelación o bytes de SQL terminado.

Estimadores: diferencia de medianas MARGINALES candidato−control; p95 de cada
fuente por nearest-rank `ceil(.95*n)-1`, diferencia de esos p95. No mediana de
diferencias de pares. Bootstrap PAREADO:10000remuestras de níndices con reemplazo,
conservando ambos miembros del par; por rol reiniciar Mulberry32 con
seed24220261018 reducida a uint32. ICpercentil95 con nearest-rank de las10000
diferencias, percentiles2.5/97.5. Reportar delta absoluto/relativo,IC y tamaño.

Gate mediana listUsable: límite superiorIC95 estrictamente<0. Gate no regresión
mediana/p95: límite superiorIC95 de delta<=max(5% del estimadorcontrol,50ms).
Inconcluso noPASS. Diagnósticos/primerasassets no aportan gates inferenciales.
Si p95 no resuelve, detener e informar INCONCLUSO; cualquier extensión debe tener
nueva receta explícita versionada ANTES de muestras adicionales, justificando
tamaño/orden/población y preservando las muestras previas. Nunca extender tras
ver datos para buscar verde sin receta nueva ni sustituir muestras fallidas.

Los gates estructurales del protocolo siguen íntegros: ceroGET redundantes,
caché sin refetch por crear/editar/cambiar pestaña/calcular peso, una confirmación
de cierre y autoridad/efectos equivalentes. R1 sólo observa el subconjunto de
listado; no acredita los demás por ausencia de ejecución.

Cleanup posterior exige SELECT/asserts de ausencia de los propios tenants,
owners/staff, sesiones, membresías, órdenes, líneas, productos, categorías,
locales, módulos, tours, suscripciones y métodos/inicializaciones de pago. Sólo
después persiste artefacto0600 saneado de conteos y marca cleaned; nunca liberar
DB basándose sólo en DELETE ejecutado. No elimina históricos/tenants ajenos.

## Segundo corte obligatorio, aún no autorizado por R1

Tras revisar R1 y antes de datos nuevos: recetaR2 propia versionada con tamaño y
orden por rol/variante, rutas críticas catálogo/detalle/guardar/QR/preparar/cerrar,
sin cupón/10%/100%total0. Identidades NUEVAS premanifestadas por fuente, rol,
variante e intento, sin duplicar ventas ni consumir M0. Cámara sintética idéntica
en ambos, autenticación/token/API/DB reales; no cámara contra entrada manual.
Peso candidato diagnóstico funcional separado, sin control inventado. Inspección
durable/replay del mismo comando sin repetir ventas. La muestra de rutas críticas
debe resolver no regresión mediana y p95; una muestra inconclusa noPASS.

Tail postclose FUERA de closeConfirmed: misma regla500ms sin APIs pendientes,
máximo15s por fuente, finish/error/timeout y bytes reales antes de cerrar contexto.
No prolongar closeConfirmed para esconder aftercommit/refresco. R2 deberá
precisar marcadores equivalentes y conteo exacto antes de generar sus identidades.
QA independiente revisa receta/identidades/equivalencia, todos los intentos y
cálculo en SHA congelado; ningún verde global o cierre0242 se deriva de R1.


## D1 — diagnóstico de observabilidad RSC, previo a otra campaña

La revisión1fd427d2 se detuvo en su primera warmup CONTROL: listadoAPI200/válido,
12labels correctas, listUsable3776ms,0pageErrors y settlementfinish; functionalValid
false por25Fetch RSC cancelados. Se observaron response200, canceledtrue y decoded
parcial, encodednull. Los eventos terminaron1859–2096ms después del Document,
ANTES del marcador: context.close no los causó. El stack es compatible con fetch
Next, pero faltan flags/errorText para probar prefetch. El intento sigue FAIL;
no se relabela3776ms como muestra niPASS. Identidad final pasó, cleanup mismoSHA
verificó14tablas0 y phasecleaned; artefactos/basales se conservan.

D1 tiene exactamente DOS entradas nuevas: OWNER normal, control→candidato,
proceso/pool y contexto nuevos por fuente, viewport1280×900, serviceWorkersblock,
misma cámara no usada, cookies legítimas nuevas y datos/acciones/API reales. Cada
entrada es primera navegación completa `/backoffice/pos`; NO warmup adicional,
NO reload, NO staff, NO venta ni rutas mutantes, CERO muestras inferenciales.
Fixture normal24×8, Centro primero/12filas visibles y respuesta24IDs idénticos en
ambas fuentes. El helper existente prepara también empty/volume; no se observan
ni mezclan esas poblaciones en D1. Se preservan y retiran por ownership al cerrar.

Se aplican los markers/APIassertions exactos vigentes, sin relajar la región de
revisión ni el listado. Plazo de listo30s; después quietud500ms sin pendientes,
máximo15s, con finish/error/timeout y bytes observados/parciales/null. No se
infieren bytes0, finish ni cancelación por haberSQL terminado. Se captura:

- Booleanos permitidos RSC, presencia/valor reconocido Next-Router-Prefetch,
  presencia Next-Router-Segment-Prefetch, Purposeprefetch y Sec-Purposeprefetch.
  Se combinan requestWillBeSent y ExtraInfo en ambos órdenes mediante buffer por
  requestId que retiene sólo booleanos permitidos; cada fila expone una identidad
  local correlacionable, nunca el requestId CDP. No se guardan
  Cookie, scope, QR, otros headers, queries ni valores de segment-prefetch.
- CDP canceled, errorText saneado, blockedReason y timestamps start/response/end,
  wallTime e initiatorstack por path. Timestamps de server/context/navigation,
  marker observado, settlement y close/stop permiten ordenar causa/terminación.
- TODAS las solicitudes y costos, también globals/proveedor/Nextprefetch y SQL
  del preload existente; ningún error se borra o transforma en finish.

Se permite pasar de control a candidato sólo si listado real/API/DOM son válidos,
0pageErrors y settlementterminado. Los errores ambientales quedan registrados y
el gate funcional estricto permanece false; D1 sólo observa su naturaleza. Cero
GET extra sesión/módulos del candidato sigue OBLIGATORIO; si falla se detiene,
no se aprueba ni continúa una campaña normal. D1 puede completar observación con
exit2/strictGateSatisfiedfalse: eso NO es PASSM1 ni aprobación de la política.
No se amplía ninguna exclusión de RSC en D1; una clasificación nueva exigiría
receta y revisiónQA previas a una futura campaña inferencial independiente.

Runner nuevo se separa de buildSource. Control6f/BUILD_IDoriginal y hasharchive
siguen inmutables. El coordinador autorizó para D1 COPY privada NUEVA del candidato
propio compilado1fd427d248e41cd6087fb93018f5c251c1bcd844, BUILD_ID
`mQAEivzHwhRenkWFyULLz`, freezeSHA
`1617de3cf21db2403f351f4e3753856a870fcecc331b3e1005000ce9589b6436`.
Nunca iniciar/modificar runtime antiguo. `prepare NUEVO_NAMESPACE PRIOR_NAMESPACE`
valida exactamente ese origen, config/dependencias/BUILD_ID, mapa compilado822
idéntico y diff vacío de producto/instrumentación/lock entre buildSource y runner.
La fuente externa del runtime también es1fd; no se le atribuye build nuevo.
La copia no contiene cachefetch/images previa. Rebuild de esa copia se rechaza.
Plan/freeze manifiestan fuente, hashes, reuso y paths nuevos antes de datos.
Metadata prepare/ejecución se conserva con la política finalR1.2 y se exige estable
mientras D1 corre. DB/build/freeze/diagnose requieren nueva reserva/autorización
exacta del coordinador; receta y código revisados por QA ANTES de ejecutarlos.
