---
name: protocolo-de-verificacion
description: >
  Protocolo operativo de verificacion de este repo: presupuesto y condicion de corte de una
  revision, protocolo de mutaciones (shasum antes de mutar, bitacora antes de medir, etiqueta
  MUTATION, revertir con diff), como se prueba que un oraculo MUERDE y por el motivo correcto,
  como se declara un limite o un costo, y que hacer con un hallazgo de un subagente. Leer ANTES
  de encargar una revision o una implementacion con mutaciones, al escribir un plan de pruebas,
  al declarar «esto no se puede testear» o «costaria X», y al heredar una mutacion abandonada.
  Los casos que originaron cada regla estan en `docs/LECCIONES.md`.
---

# Protocolo de verificacion

Version operativa. Cada regla de aca salio de un error real; el caso, la fecha y la evidencia
estan en **`docs/LECCIONES.md`** — leelo cuando quieras saber por que una regla es asi, o
cuando la familia de error vuelva a aparecer.

## 0. La regla madre

**Ninguna afirmacion de exito vale sin una señal que el modelo no genero** — un test, un
typecheck, un exit code, una fila leida por SQL. La auto-revision sin oraculo es negativa neta.

Y su espejo, que se cuela mas facil: **una afirmacion de IMPOSIBILIDAD o de COSTO tambien es una
afirmacion.** «Esto no se puede testear» y «esto costaria una migracion / una columna / un
refactor grande» se verifican igual —**intentandolo**— y ninguna de las dos se le pasa al owner
ni se baja a un doc sin haberlo hecho. Un limite sobredimensionado se ve virtuoso y hace el mismo
daño que un `[x]` inflado. Si el limite es real, **acotalo a la parte exacta que lo es**; y al
corregir un limite, el limite nuevo tampoco vale sin intentarlo.

## 1. Presupuesto y condicion de corte — lo pone el que ENCARGA

Es el ADR 0062 y la instruccion del owner del 2026-09-13, y es la regla que mas plata costo.

- Al abrir una revision se escribe **cuantas mutaciones** y **que clase de error** tiene que
  cazar: **los PLAUSIBLES**. Lo que quede afuera se **declara**, no se persigue.
- **Ningun ciclo se reabre porque «quedo una preimagen mas».** Si dos vueltas seguidas terminan
  en «el fix abrio la siguiente», eso no es mala suerte: es la señal de cortar. Una propiedad
  **universal** («esto no filtra por ningun canal») no se cierra con mutaciones — se cierra con
  un oraculo acotado **mas un limite declarado**.
- Un hallazgo que **no es riesgo de produccion** se declara y se sigue.
- **Entre una evidencia mas y una pantalla que el owner pueda probar, gana la pantalla.** El QA
  humano encuentra lo que ninguna mutacion ve. Si una fase no llego a pantalla, cortar la
  verificacion y llevarla al QA es la decision correcta, no una rendicion.
- **Si un encargo ya murio DOS veces, no lo despaches una tercera: terminalo vos.** Reanudar sale
  mas caro que terminarlo a mano (cada muerte obliga a auditar el arbol antes de seguir).

## 2. Protocolo de mutaciones — el orden importa

Una mutacion es codigo roto a proposito para probar que un test muerde. **Un rojo de mutacion y
un rojo de bug son indistinguibles desde afuera**, asi que la disciplina no es opcional.

### 2.0 La tabla se verifica ANTES de despacharla (2026-09-21)

**Cada fila de la tabla de mutaciones afirma DOS cosas** — que existe un mecanismo X, y que el
oraculo Y lo distingue — **y las dos se miden antes de cerrar la spec.** Hay que poder senalar el
archivo y la linea del mecanismo. Dos minutos de `rg` por fila.

**Van dos specs seguidas con una fila falsa, y las dos las escribio el orquestador:** la M5 de la
0085 afirmaba un rojo que **no existia** (`[]` es truthy, asi que la mutacion midio 21/21 en
verde), y la M6 de la 0086 mandaba a mutar *«el evaluador del plan del catalogo»*, que **no
existe** — `ENTITLEMENTS` tiene exactamente `locations.max` y `campaigns.enabled`. En los dos
casos la fila llego hasta el agente que iba a ejecutarla.

### 2.0-ter El FALSO ROJO, que es mas caro porque se lee como exito (2026-09-21)

**Van TRES specs seguidas** en las que un **doble de test devuelve una fila que la base no puede
producir**. El falso VERDE de la 0086 ya esta abajo; estas son las otras dos, las dos en la 0087:

| Doble devolvia | En la base |
|---|---|
| filas `{handle:"000"}` **sin `userId`** | `user_id` es **`NOT NULL`** |
| `{role:"owner"}` **sin `status`** | `status` es **`NOT NULL DEFAULT 'active'`** |

En las dos la mutacion **dio rojo** — pero **la propiedad que acusaba solo existia en el doble**.
Un guard mutado que no cambia **ningun** resultado real, y un rojo colateral que acusaba al doble
en vez de al codigo.

**Por eso es mas caro que el falso verde: un rojo se lee como exito y nadie lo audita.** «Muerde,
seguimos».

**Las reglas.** Un doble es una **afirmacion sobre lo que la base puede devolver**: si omite una
columna `NOT NULL`, describe una fila **imposible**. Ante cualquier rojo de mutacion, preguntarse
**si la propiedad que acusa existe fuera del doble** — abrir el esquema y mirar los `notNull()`
cuesta dos minutos. Y se arregla **el doble, no el test**, y se **RE-MIDE** despues.

### 2.0-bis Y su espejo: una mutacion que SOBREVIVE acusa al oraculo tan seguido como a la tabla

Antes de declarar la fila falsa, **mirar el seed**. En la 0086 esto paso **tres veces**:
`seedMember` creaba el `user` con `emailVerified: true`, pero un integrante real nace con
`false` (`staff-create.ts:132`, su email es el sintetico `@staff.invalid`). Las suites estaban
midiendo **un caller que no existe en produccion**, asi que todo oraculo que dependiera del gate
de email pasaba en verde sin medir nada.

**Un seed de test es una afirmacion sobre como es el caller en produccion.** Si diverge, lo que
midas con el vale cero. Tres corolarios, los tres pagados:

- **La reparacion va en la FUENTE, no en el archivo que estas mirando.** El primer parche de la
  0086 fue local y dejo la causa puesta; las otras dos suites siguieron midiendo al caller irreal
  hasta que el revisor re-corrio la mutacion.
- **El default del seed es la forma de PRODUCCION**, y lo excepcional se pide: `emailVerified:
  opts.emailVerified ?? false`, no al reves.
- **Se prueba que la reparacion MUERDE, o no es una reparacion**: sacando la linea, la mutacion
  tiene que volver a sobrevivir. En la 0086 se midio (RV2) y volvio a verde 7/7.

Antes de mutar, en este orden:

1. `git status --short <archivo>`. Si sale `??`, **`git checkout` no existe como salvavidas**:
   copia a `/tmp` primero. Si sale ` M`, el `git checkout` de emergencia **se lleva tambien el
   trabajo no commiteado** — peor todavia.
2. `shasum <archivo>` **limpio**, y se escribe en el handoff. Es el unico punto de retorno.
3. **Abrir la fila de la bitacora AHORA**: `id + archivo + shasum limpio + que invariante ataca`.
   Antes de medir, no despues. El hook `no-mutations-left.sh` te salva el arbol; no te salva la
   medicion.
4. Etiquetar la mutacion en el codigo con `MUTATION` (es lo unico que el hook ve).
5. Medir, transcribir el resultado **ejecutado**, y revertir.
6. Al revertir: **`diff` contra la copia limpia** y confirmar que se fue **solo** la mutacion.

Reglas que acompañan:

- **La fila «mutacion X → rojo el test Y» no se predice, se EJECUTA y se transcribe.** Un par
  escrito de memoria regala una cobertura que no existe.
- **La mutacion se corre contra TODOS los archivos que pueden verla**, y el alcance se escribe en
  la fila.
- **`MUTATION`/`MUTACION` es PALABRA RESERVADA: no la escribas en un docblock que documente que
  mutacion pinnea un test.** El hook `no-mutations-left.sh` busca
  `\b(MUTATION|MUTACION)\b` en `src/`, `apps/*/src` y `packages/*/src` —**las dos
  ortografias**— y no puede distinguir una etiqueta viva de prosa que la nombra. Documentar
  «este test es el oraculo de la mutacion M1» es valioso y hay que seguir haciendolo, pero se
  escribe **«ORACULO DE M1»**, sin la palabra. Medido el 2026-09-20 en la spec 0083: seis
  docblocks perfectamente correctos bloquearon el turno, y hubo que probar —con `diff` contra
  las copias limpias de `/tmp`— que **ninguna** mutacion estaba aplicada. **No se debilita el
  hook para que acepte prosa:** es deliberadamente tonto y ahi esta su valor.
- **El hook NO escanea `.next/`**, asi que un artefacto de build viejo con una mutacion adentro
  no lo dispara — pero SI aparece en un `grep -r` tuyo sobre `apps/`. Antes de alarmarte por un
  hit ahi, mira si el fuente real lo tiene: un source map de `.next/dev/` puede ser de hace
  varias specs (se reconoce porque su copia del archivo no tiene los campos que agregaron las
  specs posteriores).
- **Un gate rojo COLATERAL bajo una mutacion viva no se arregla: se espera.** (Un import que
  queda sin uso porque la mutacion borro su llamada — «arreglarlo» tapa la medicion.)

### Si heredas una mutacion puesta

1. **`ListAgents`** — si hay un subagente vivo, **no la toques**: esta midiendo. El reclamo del
   hook es una foto vieja.
2. `git status --short` + copia a `/tmp` si es `??`.
3. **MEDIR ANTES DE REVERTIR.** El experimento ya esta montado; revertir tira la unica corrida
   gratis.
4. Revertir y probar con `diff` que se fue solo la mutacion.

Si no hay `shasum` ni copia, buscá el **artefacto colgante** que dejo el codigo removido: una
variable que se escribe y nunca se lee es la firma de una linea que falta (y `lint` no la marca).

## 3. Que prueba —y que no prueba— un oraculo

- **Un guard sin prueba de que MUERDE es peor que ninguno.** Corrolo contra un estado que **debe**
  bloquear y verifica el `exit 2` **y** el mensaje. Un exit 0 puede significar «paso» o «nunca
  miro nada», y desde afuera son indistinguibles. Vale igual para los hooks.
- **Un ROJO tambien puede ser por el motivo equivocado.** Verificar que un guard muerde no es ver
  un rojo: es **LEER la asercion del rojo** y confirmar que habla de la propiedad, no del setup
  (una env faltante da rojo con y sin la mutacion).
- **Que un test muerda no dice QUE propiedad pinnea — eso solo lo dice la mutacion.**
- **La tabla de mutaciones se escribe desde el diseño, asi que no ve lo que el codigo termino
  afirmando.** Al cerrar una fase: **listá los comentarios del codigo nuevo que afirman un
  invariante** («esto es lo que hace que X», «sin esto pasaria Y») **y mutá cada uno**. Los que
  queden verdes son el trabajo que falta. Un docblock falso no es pasivo: **induce** a escribir la
  sonda contra el lugar equivocado.
- **Un oraculo que inspecciona un objeto tiene que leerlo IGUAL —y la misma cantidad de veces— que
  el consumidor real** (ADR 0062). Todo guard por forma o por substring tiene preimagen por
  **transformacion**.
- **Un barrido estatico solo pinnea propiedades SINTACTICAS.** Si escribis uno: probá las dos
  ortografias, aseverá un **piso de archivos escaneados**, verificá que se pone rojo con el codigo
  viejo, y si la propiedad es de **comportamiento**, extraé la decision a una funcion pura — y
  nombrá que el **cableado** queda afuera.

## 4. Hallazgos ajenos: los que recibis y los que mandas

- **Ningun hallazgo de un subagente entra a una spec, a un ADR, al `INDEX` o a un mensaje al owner
  sin que vos hayas reproducido la evidencia** — el `grep` corrido, el archivo leido, el statement
  ejecutado. Una cita no es una verificacion: es un puntero a donde verificar. Verificar no es
  desconfiar, **es la unica forma de encontrar el hallazgo que falta**. Si es sobre semantica de
  la base, se reproduce **en una base**.
- **Y el espejo: lo que le pasas a un subagente como insumo es una afirmacion tuya.** Antes de
  despachar, **re-medí** la parte del doc que le sirve de contexto. Un doc vencido no falla
  ruidoso: le fabrica un diagnostico a alguien que no tiene como dudarlo.
- **«No existe una pieza que haga X» se verifica listando los EXPORTS del modulo, no leyendo la
  funcion que ya conocias.** `rg -n '^export (async )?function|^export const' <archivo>`. Medido
  el 2026-09-20 en la spec 0083: el orquestador leyo `api-owner.ts` hasta la **linea 90**,
  confirmo que `requireApiOwner` aplica siempre el gate de email y escribio en la spec «hay que
  armar la escalera a mano» — **`requireApiOwnerSinGateDeEmail` estaba en la 174 del mismo
  archivo**, hacia exactamente lo que hacia falta y ya la usaban dos rutas. El implementador
  obedecio y el resultado **paso los seis gates y un barrido de mutaciones**, porque era correcto;
  lo que rompia era un mecanismo de conteo, y eso no tiene rojo. Caso en `LECCIONES.md`.
- **Un sintoma no es una causa.** Antes de escribir «esto pasa PORQUE X», **buscá X en el arbol**:
  si no podes señalar el codigo que lo produce, no es un diagnostico, es una historia.
- **Lo que el owner no dijo explicitamente NO se escribe como decision suya.** Un efecto lateral
  que nadie acordo va como *hallazgo a decidir*.

## 5. Numeros y docs

- **Todo numero que va a un doc se RE-MIDE en el momento de escribirlo** (tamaños, conteos de
  tests, `shasum` de baseline). Un baseline podrido hace que la sesion fresca concluya «alguien
  dejo una mutacion puesta» — el sintoma exacto que la auditoria existe para descartar.
- Para los tamaños se le pregunta **AL HOOK**, no a `wc`:
  `echo '{"tool_input":{"file_path":"<abs>"}}' | .claude/hooks/file-size.sh; echo "EXIT=$?"`, con
  un control sobre un archivo sano para probar que discrimina. El barrido va sobre los ` M` **y**
  los `??`, no solo sobre los archivos nuevos.
- **Nunca reescribas una cabecera reemplazando el RANGO entre dos anclas.** Se reemplaza **esa
  linea**, o se inserta con `replace(marca, nuevo + marca, 1)`. Si igual reemplazas un rango,
  **contá las lineas antes y despues** (`wc -l`).
- Al hacer handoff, el bloque `ESTADO` de la primera pantalla **se reescribe entero** contra los
  hechos del momento, nunca se deja «vigente por omision».

- **Un barrido `rg` de la DoD se ESCRIBE en sintaxis de `rg`, y se CORRE antes de cerrar la
  spec.** `rg` es regex por defecto: la alternacion es `'a|b'` y **`'a\|b'` es la barra
  LITERAL**, que es sintaxis de `grep`/BRE. Un criterio escrito asi **no matchea nunca**, y como
  el criterio dice «→ vacio», **pasa vacuo para siempre**. Cazado el 2026-09-20 escribiendo la
  DoD de la spec 0084: `rg -n 'user_id\|userId' <archivo>` dio vacio **sobre un archivo que tiene
  las dos**. La regla del repo ya decia que los barridos se corren contra el arbol antes de
  cerrar; esto es **por que**: el modo de falla no es «el comando falla», es «el comando pasa».
