---
spec: 0094
fecha: 2026-09-25
estado: implementada
resumen: Pulido del modal de importacion pedido por el owner tras su QA de la 0093. Mientras se procesa, el modal se MUEVE —el icono late, cada mensaje rotativo entra con un fundido y una barra indeterminada corre debajo— para que no parezca colgado; todo se apaga con `prefers-reduced-motion`. El boton «Cancelar importación», que quedaba solo en la mitad izquierda de una grilla de dos columnas, ocupa el ancho entero.
disjunta: si
archivos: apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx, apps/merchant/src/app/globals.css
---

# 0094 — El modal muestra que esta trabajando

> Plantilla **chica**: un dominio (la pantalla de catalogo), cero migraciones. Decision del owner,
> 2026-09-25, tras su QA de la 0093 (cancelar y reanalizar funcionaron), textual:
>
> *«Sobre los mensajes que aparecen en el modal cuando se carga, se esta analizando, etc. que hoy
> rotan, podemos darle un efecto? para que llame la atencion y la persona sepa que esta procesando
> y no colgado? eso mejoraria la UX, el boton de cancelar importacion ahora esta alineado a la
> izquierda, deberia ocupar el ancho o alinearse a la derecha»*
>
> De las dos opciones del boton se elige **ocupar el ancho**: en el breakpoint de 520 px la grilla
> ya es de una columna (`globals.css`, `@media (max-width: 520px)`), asi que el boton se ve igual
> en celular y en escritorio.

## Problema

- **El mensaje cambia en seco.** `catalog-ai-import.tsx` pinta `<p aria-live="polite">` con
  `processingMessage(tick)`: el texto se reemplaza cada 3 s sin transicion, y el icono `Spark` es
  estatico. Entre dos cambios no hay nada que se mueva.
- **Cancelar queda a la izquierda.** `.catalog-editor-actions` es `grid-template-columns: 1fr 1fr`
  (`globals.css`, la segunda definicion, que pisa a la `flex` anterior por cascada); con un solo
  boton ocupa la primera columna.

## Alcance

**Entra:** tres movimientos mientras `processing` (icono que late, mensaje que entra con fundido,
barra indeterminada), su apagado con `prefers-reduced-motion`, y el boton a ancho completo.

**No entra:** los textos de los mensajes, el intervalo de 3 s, la logica de `processing`, cualquier
otro modal o boton del catalogo (el modificador es opt-in).

## Diseño

- `catalog-ai-import.tsx`, rama `activeImport`: el contenedor `.catalog-ai-result-head` suma la
  clase `is-processing` cuando `processing`. El `<p>` del mensaje lleva `key={tick}` y la clase
  `catalog-ai-processing-message`: al cambiar `tick` React lo **remonta** y la animacion de entrada
  corre de nuevo. Debajo del mensaje, `<span className="catalog-ai-progress" aria-hidden="true" />`.
  El `aria-live="polite"` se mueve a un contenedor que NO se remonta, para que el lector de
  pantalla anuncie cada mensaje una vez.
- La fila del boton Cancelar pasa a `className="catalog-editor-actions is-single"`.
- `globals.css`, junto a las reglas `.catalog-ai-result-head`:
  - `.catalog-ai-result-head.is-processing > svg` → `animation: catalog-ai-pulse 1.6s ease-in-out
    infinite` (escala 1 → 1.15 y opacidad 1 → .6).
  - `.catalog-ai-processing-message` → `animation: catalog-ai-message-in .45s ease-out` (opacidad
    0 → 1, `translateY(4px)` → 0).
  - `.catalog-ai-progress` → barra de 4 px, radio completo, fondo `color-mix` del primario; su
    `::after` es un tramo del 40 % en `var(--color-primary)` que cruza con `catalog-ai-progress
    1.4s ease-in-out infinite`.
  - `@media (prefers-reduced-motion: reduce)` → `animation: none` en los tres; la barra queda
    visible y estatica.
- Junto a la segunda `.catalog-editor-actions`: `.catalog-editor-actions.is-single {
  grid-template-columns: 1fr; }`.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx` | editar |
| `apps/merchant/src/app/globals.css` | editar |

**Disjunta?** Si.

## Definition of Done

- [ ] `rg -n "catalog-ai-pulse|catalog-ai-message-in|catalog-ai-progress" apps/merchant/src/app/globals.css`
      → las tres `@keyframes` y sus reglas, y las tres dentro de un `prefers-reduced-motion`.
- [ ] `rg -n "is-single" apps/merchant/src` → la regla CSS y el uso en `catalog-ai-import.tsx`.
- [ ] `rg -n 'key=\{tick\}' apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx` → 1.
- [ ] Gates de root con Node 24: `typecheck`, `lint`, `test`, `format:check`, `build` y
      **`test:e2e`** (toca CSS GLOBAL).

## Mutaciones — presupuesto: 0

No hay oraculo automatico posible sin un navegador que mida animaciones: vitest corre en `node` y
el e2e no visita `/backoffice/catalog`. **Se declara**, no se simula con un test que lea el CSS.

## Declarado AFUERA (sin oraculo, a proposito)

- **Todo lo visual**: que el icono lata, que el mensaje entre con fundido en cada cambio, que la
  barra corra, que con «reducir movimiento» del sistema todo quede quieto, y que Cancelar ocupe el
  ancho. Lo cubre el **QA del owner** en `checkpass.club`.

## Handoff

Por el tamaño (dos archivos, sin logica), la implementa el orquestador; el revisor independiente
lee el diff contra esta spec antes de marcar `implementada` (ADR 0071).

## Abierto

Nada.
