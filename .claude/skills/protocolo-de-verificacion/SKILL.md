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
