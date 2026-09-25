---
spec: 0093
fecha: 2026-09-24
estado: implementada
resumen: Tres arreglos del modal de importacion de catalogo pedidos por el owner en su QA. (1) Fuera el copy «te avisamos por email» (ADR 0085), reemplazado por un mensaje ROTATIVO mientras se procesa. (2) Mientras se sube o se analiza, el modal NO se cierra (ni X, ni scrim, ni Escape, ni boton «Cerrar»); «Cancelar importacion» se queda. (3) Un import `accepted` nunca se repinta al abrir (ni tras reload): el modal vuelve a la eleccion de archivos.
disjunta: si
archivos: apps/merchant/src/app/backoffice/catalog/{catalog-ai-import.tsx,use-catalog-import.ts,catalog-ai-import-state.ts,catalog-ai-import-state.test.ts}, apps/merchant/src/app/backoffice/staff/staff-form-modal.tsx
---

# 0093 — El modal de importacion no se cuelga

> Plantilla **chica**: un dominio (la pantalla de catalogo), **cero migraciones**, y las decisiones
> son del owner, dichas el 2026-09-24 en su QA, textual:
>
> *«pero hasta donde se no avisamos por email. Deberiamos quitar ese mensaje o cambiarlo por
> "espera estamos procesando tu menu". de echo podriamos hacer que el mensaje fuera rotativo para
> que la persona vea que se esta procesando y no que se quedo colgado. Tambien tenemos dos botones
> "cerrar" y cancelar. Cancelar se deberia mantener, pero el modal no deberia permitirse cerrar
> hasta que acabe el analisis o de un error. Luego de que completamos la importacion dice "ver mi
> catalogo" con un boton, doy click alli cierra el modal, perfecto, pero el modal queda en esee
> estado, por lo que no puedo volver a analizar ningun menu de nuevo»*
>
> El ADR 0070 deja la UI en manos del owner; **aca es el owner quien pide el cambio**, sobre una
> pantalla que ya existe.

## Problema

- **Copy muerto.** `catalog-ai-import.tsx` (rama `waiting`) dice *«te avisamos por email cuando
  esté»*. El ADR 0085 borro el email: la promesa es falsa.
- **Se puede cerrar a mitad del analisis.** `StaffFormModal` (`staff/staff-form-modal.tsx`) cierra
  siempre por la X, el scrim y Escape, y la rama `waiting` ofrece ademas «Cerrar y continuar
  después». El owner quiere que el modal quede abierto hasta `accepted` o un error.
- **Trabado en el resumen.** Al abrir, `use-catalog-import.ts` hace `GET /api/catalog/imports`,
  que devuelve el **ultimo import, terminal incluido** (ADR 0084 §6), y `land()` pone su `result`.
  Un import `accepted` ya visto vuelve a pintar el resumen en cada apertura, y el resumen no tiene
  salida a una importacion nueva: no se puede analizar otro menu.

## Alcance

**Entra:** el copy rotativo, el bloqueo del cierre mientras se procesa, y que un resultado ya
visto no se vuelva a mostrar al reabrir.

**No entra:** el servidor (ni rutas, ni `GET` que devuelve el ultimo import — el ADR 0084 §6 se
mantiene), el filtro «sin precio» del listado, otros usos de `StaffFormModal` (su comportamiento
por defecto no cambia), el diseño visual/CSS.

## Diseño

Un modulo puro nuevo, `catalog-ai-import-state.ts`, con las tres decisiones, para que tengan
oraculo sin DOM (vitest corre en `node`, `vitest.config.ts:10`):

1. **`isProcessing({ status, busy })`** → `true` si `status` es `queued` o `analyzing`, **o** si
   es `pending_upload` con `busy` (se esta subiendo). Es la condicion de «procesando»: rotan los
   mensajes y el modal no se cierra.
2. **`PROCESSING_MESSAGES`** (≥ 3 textos, el primero *«Esperá, estamos procesando tu menú…»*) y
   **`processingMessage(tick)`** → `PROCESSING_MESSAGES[tick % length]`. El componente avanza
   `tick` cada **3 s** con un `setInterval` que solo corre mientras `isProcessing`. El texto va en
   un elemento con `aria-live="polite"`. Ningun texto menciona email ni aviso.
3. **`importToShow(found)`** → devuelve `null` si `found` es `accepted`; si no, devuelve `found`.
   El hook filtra por esta funcion lo que devuelve el `GET` **al abrir**. Consecuencia: un import
   `accepted` **nunca** se vuelve a pintar al abrir el modal —ni en la misma carga de pagina ni
   despues de un reload—: se ve la eleccion de archivos. El resumen se ve **solo** cuando el poll
   presencia la transicion a `accepted` con el modal abierto (`land()` desde el poll).
   **Enmienda del owner (2026-09-24), textual:** *«al recargar el modal sigue alli, el ADR 0084 fue
   mal interpretado. tenemos que regenerar el modal al salir de el luego de una importacion
   exitosa»*. El `GET` del servidor no cambia (sigue devolviendo el ultimo import, que la pantalla
   usa para `failed`/`cancelled`/`expired` y para retomar uno en curso).

**El modal:** `StaffFormModal` gana `dismissible?: boolean` (default `true`). Con `false`: no se
renderiza la X, el scrim no cierra y Escape no cierra. `CatalogAiImport` pasa
`dismissible={!processing}`. La rama de espera pierde el boton «Cerrar y continuar después» y
conserva **«Cancelar importación»**, que sigue funcionando igual (`DELETE`, y cierra).

**«Cancelar importación» durante la subida (owner, 2026-09-25):** mientras `busy` (se estan subiendo
los archivos) el boton **no se renderiza** —antes estaba deshabilitado, y cancelar ahi competiria con
el `analyze()` en vuelo—. Aparece en `queued`/`analyzing`, que es el tramo largo y el que cuesta
plata. Textual: *«si cancelar importacion esta desabilitado y habilitarlo genera un problema,
entonces lo quitemos»*.

**Error durante el procesamiento:** si el poll falla, `error` se pinta y el estado sigue siendo
`queued/analyzing`; para que el merchant no quede encerrado, **con `error` presente el modal
vuelve a ser cerrable** (`dismissible={!processing || error !== null}`). Un `failed` ya no es
`processing`, asi que cierra normal.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-state.ts` | crear |
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import-state.test.ts` | crear |
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx` | editar |
| `apps/merchant/src/app/backoffice/catalog/use-catalog-import.ts` | editar |
| `apps/merchant/src/app/backoffice/staff/staff-form-modal.tsx` | editar (prop opcional) |

**Disjunta?** Si.

## Definition of Done

- [ ] `rg -n "email" apps/merchant/src/app/backoffice/catalog/catalog-ai-import*.tsx` → vacio.
- [ ] `rg -n "Cerrar y continuar" apps/merchant/src` → vacio.
- [ ] `catalog-ai-import-state.test.ts` en verde, cubriendo: los 7 estados × `busy` de
      `isProcessing`; la rotacion (`tick` 0, 1, `length`, `length+1`) y que ningun texto contenga
      `email`; `importToShow` con `accepted` → `null`, y cada uno de los otros 6 estados → el mismo
      import, `null` → `null`.
- [ ] Gates de root con Node 24, una vez al final: `typecheck`, `lint`, `test`, `format:check`,
      `build`, **y `test:e2e`** (toca un componente de `/backoffice`).
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

| # | Mutacion (archivo:funcion) | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `catalog-ai-import-state.ts:isProcessing` — olvidar el caso `pending_upload && busy` | el caso `pending_upload`/`busy:true` del test |
| M2 | `catalog-ai-import-state.ts:importToShow` — esconder tambien los terminales (`status !== "queued" && status !== "analyzing"` → `null`), lo que se come el `failed` y su mensaje | el caso `failed` → el import |
| M3 | `catalog-ai-import-state.ts:processingMessage` — `tick % (length - 1)` | el caso `tick = length - 1` / `length` |

**Protocolo:** el de la skill `protocolo-de-verificacion`. **Condicion de corte:** dos vueltas
seguidas de «el fix abrio la siguiente» → se corta y va al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **El cableado en el componente** (que `dismissible` reciba `!processing`, que el `ref` se escriba
  en `land()`, que el intervalo corra): no hay tests de componente en el repo y el e2e no visita
  `/backoffice/catalog`. Lo cubre el **QA del owner**: subir un PDF, intentar cerrar con X/Escape/
  scrim, ver rotar el mensaje, terminar, «Ver mi catálogo», reabrir y ver la eleccion de archivos.
- **Un import que termina mientras la pagina no esta abierta** (el merchant recargo o se fue a
  mitad del analisis): al volver ve la eleccion de archivos, no el resumen. El catalogo ya esta
  escrito y se ve en el listado. Es la consecuencia directa de la enmienda del owner.

## Handoff

UN implementador, UN revisor independiente al final (ADR 0071).

## Abierto

Nada.
