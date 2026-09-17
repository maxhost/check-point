---
spec: NNNN
fecha: YYYY-MM-DD
estado: borrador | cerrada | implementada
resumen: Una linea. Es lo que se lee en el INDEX sin abrir el archivo.
disjunta: si | no
archivos: rutas que esta spec va a tocar
---

# NNNN — Titulo

> **Plantilla CHICA (ADR 0071).** Se usa cuando las tres condiciones valen: **un solo dominio**,
> **sin migraciones** y **sin decision de producto abierta**. Si falta alguna, va `TEMPLATE.md`.
>
> **Nada de codigo empieza sin esta spec en `cerrada`.** Sigue siendo el gatillo medido del
> exito fingido: en tareas bien definidas el reward hacking cae a 0%; en tareas vagas, ~50%.
>
> **Las decisiones del owner se piden ANTES de escribir esto.** Una spec escrita dos veces
> porque el alcance cambio despues es el costo que el ADR 0071 vino a cortar.

## Problema

Que esta mal hoy, **medido**, con `archivo:linea`. Dos o tres bullets. Si no se puede señalar el
codigo que lo produce, no es un diagnostico.

## Alcance

**Entra:** …

**No entra:** … *(explicito — es lo que evita el scope creep del agente)*

## Diseño

Lo necesario para implementar sin inventar decisiones durante el codigo: contratos, entradas,
salidas, **todos** los codigos de error, autorizacion y aislamiento. Prohibido «a definir durante
la implementacion» en una spec `cerrada`.

## Archivos

| Archivo | Accion |
|---|---|
| `src/…` | crear / editar |

**Disjunta?** Si / No + con cual colisiona.

## Definition of Done

Cada criterio es **un comando o una asercion ejecutable**. **Los barridos `rg` se corren contra
el arbol ANTES de cerrar la spec** — la 0067 cerro con cuatro criterios imposibles de cumplir.

- [ ] …
- [ ] Gates de root con Node 24, **una sola vez al final**: `typecheck`, `lint`, `test`,
      `format:check`, `build`.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: N. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | … | … |

**Protocolo:** `shasum` limpio antes de mutar → fila de bitacora **antes** de medir → etiqueta
`MUTATION` → medir y **transcribir la salida ejecutada** → revertir con `diff` contra copia
limpia. De a una. **Leer la asercion del rojo**: un rojo por el setup no prueba nada.

**Condicion de corte:** si dos vueltas seguidas terminan en «el fix abrio la siguiente», se corta
y va al owner. Lo que queda afuera se **declara**.

## Declarado AFUERA (sin oraculo, a proposito)

- …

## Handoff

**UN implementador para toda la spec, UN revisor independiente al final** (ADR 0071). El revisor
produce un `PASS` con evidencia ejecutada antes de marcar `implementada`.

## Abierto

Si esta seccion bloquea, la spec **no** esta cerrada.
