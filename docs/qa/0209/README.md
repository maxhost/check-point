# 0209 — Nota de la orden POS

Implementación local en dev: `dbeb469`. Reserva: `73e203a`. Sin merge, push ni publicación.

Botón de nota junto a Revisar pedido y Guardar pedido; modal del kit con Cancelar y Aplicar nota. Aplicar conserva el borrador hasta guardar. Permite consultar/editar notas de órdenes abiertas y consultar las cerradas/anuladas sin edición. Una nota por orden, máximo 1000 tras trim, saltos internos conservados. No se incluye en impresión ni listados.

## Prueba funcional

Node24, Chromium, POS y kit reales con HTTP simulado. Comando ejecutado: `pnpm exec playwright test --config /private/tmp/0209-playwright.cjs --grep 0209`. Resultado: **5 passed (5.2s)**.

- Móvil390 y escritorio1280: pasos2/3, cancelar/Escape, foco/restauración, límite1000/1001, POST, cambio de mesa conservando borrador, PUT de nota/version, PUT de productos omite note, whitespace → null, sin overflow.
- Conflicto409: bloquea cambios, compara nota local/vigente y permite cargar vigente.
- Cerrada/anulada: texto visible, sin botón ni campo editable.

Capturas sintéticas con datos ficticios: [móvil](note-mobile.png) y [escritorio](note-desktop.png). Vistas por implementador y reviewer, modal completo en ambos tamaños.

## Revisión independiente

Impeccable finish reviewer: disposición **ship** para la extensión acotada del POS. Fuente, kit, contrato0169 y capturas revisados; diffcheck0 y rg MUTATION vacío ejecutados independientemente. Sin cambios materiales pedidos. No ejecutó navegador por restricción de su definición; la ejecución5/5 es del implementador. Sin nuevo comp ni mundo visual; se conserva sistema existente. Documenter: [compatibilidad con el sistema](design-system-review.md).

## Gate global

Ejecutado en checkout detached `/private/tmp/checkpass-pos-note-0209`, mismo commit UI, `CI=true pnpm verify --base main`. Dependencias offline319; entornos locales copiados sin imprimir valores. El aislamiento evita colisión con los servidores habituales. Log `/private/tmp/0209-verify.log`. Tabla real de la única corrida de verify:

| Gate | Resultado | Segundos |
| --- | --- | --- |
| typecheck | ok | 10.6 |
| lint | ok | 7.3 |
| ui-guard | ok | 0.8 |
| format:check | ok | 8.6 |
| test | ok: 2530 passed / 1091 skipped | 44.6 |
| build | ok | 21.0 |
| test:e2e | ROJO: 326 passed / 62 skipped / 1 failed | 238.2 |
| neon related merchant | ok: 32 passed (2 archivos relacionados) | 7.3 |
| neon related consumer | saltado: nada de consumer | — |

Único fallo: test anterior del wizard esperaba el POST sin el campo opcional nuevo. `note: null` es válido y esperado; se actualizó la expectativa en `ae9a5d1`. UI y servidor idénticos. Se repite únicamente el gate de navegador con `CI=true pnpm test:e2e`; log `/private/tmp/0209-e2e-final.log`. Resultado final: **327 passed / 62 skipped (3.6m), salida0**, sin fallos ni flaky. Todos los gates quedan resueltos tras esta corrección mecánica; la tabla original ROJO se conserva como evidencia. No se repite verify entero.

## Límites

Sin pruebas con factura/datos reales ni teclado de teléfono físico. API/servidor/kit/migraciones intactos. Base productiva no usada. Owner aún debe probar la UI en dev antes de autorizar merge o publicación.

## Ajuste posterior del owner: padding inferior18px

Commit `5faeed5`, solo declaración existente de globals.css: 10px →18px más safe-area inferior. Padding superior10px y lateral16px intactos. Clase compartida POS/mostrador. Formato, ui-guard contra HEAD previo y diffcheck salida0. CSS real compilado con PostCSS/Tailwind y medido en Chromium:390px → bottom18px/top10px/left16px/fixed;1280px → bottom18px/top10px/left16px/sticky. Script temporal `/private/tmp/0209-footer-padding.mjs`. Primer fixture no pudo resolver vite/package.json; comprobación directa con CSS real salida0. No nuevas pruebas ni corrida global para este ajuste reversible de espaciado.

## Ajuste L0 posterior: nota junto a Editar/Pedido

Commit `a067159`: un único botón Nota en la fila de tabs de orden ya creada, disponible en Editar y Pedido; retirado del footer. Wizard mantiene su ubicación anterior. Solo movimiento en pos-editor.tsx. Formato/diffcheck0. Sin tests ni nuevas capturas por instrucción explícita del owner; las capturas y pruebas anteriores no verifican esta ubicación nueva.

## Ajuste L0 más reciente: menú circular inferior

Commit `b49bdcb` reemplaza los accesos anteriores. Botón circular48px MoreVert junto a Guardar/Cobrar, borde primary y distintivo de documento cuando existe nota. Menú concentra Escanear QR, Añadir/Editar nota, Imprimir pedido (si habilitado) y Anular separado. Menú superior retirado, X de navegación intacta. Nota junto a tabs retirada. Editar conserva acceso al menú aun limpio, CTA Guardar deshabilitado hasta cambios. Wizard2/3 usa disparador igual con Nota; las acciones que requieren orden creada aparecen después de guardar. Bloqueos busy/dirty/conflict/printing y modal/persistencia conservados. Solo pos-editor.tsx, sin kit/CSS/API. Formato/diffcheck0, revisión estática; sin tests/capturas/verify por owner. Pruebas anteriores tienen selectores previos y no prueban el menú nuevo; adaptación pendiente para próxima verificación autorizada.

## Última corrección L0: nota directa en wizard

`35c04a3`: pasos2/3 de creación restauran botón Notes directo al modal, estilo anterior (primary cuando hay nota, primary-soft cuando no). Menú inferior de órdenes creadas intacto. Formato/diffcheck0; sin tests ni capturas por owner. Cambios de Claude en su estado preservados y fuera del commit.

## L0: distintivo superpuesto retirado

`327a4bb` elimina únicamente Notes superpuesto al menú circular de orden creada. Borde/aria y wizard conservados. Sin tests por owner; formato/diffcheck0.

## L0: orden del menú

`b5a092c`: Nota (Añadir/Editar), Escanear QR, Imprimir pedido y Anular. Solo reordenado; bloqueos intactos. Formato/diffcheck0, sin tests.

## L0: toast de nota guardada

`06e0f0f` reutiliza ConfirmationToast al guardar cambios de nota: «Nota actualizada» o «Nota eliminada». Solo tras respuesta exitosa; mesa/productos sin cambio de nota siguen «Pedido actualizado». Sin tests por owner; formato/diffcheck0.

## L0: búsqueda al añadir producto

`75a27e0`: clearSearchOnAdd opcional en DetailedSale, activado únicamente al editar orden abierta; limpiar búsqueda al seleccionar producto o +unidad. Toast Producto añadido existente se mantiene en onAdd y se extiende a +unidad. Wizard/mostrador intactos. Sin tests por owner; formato/diffcheck0.

## L0: persistencia inmediata de nota

`5f67add`: Aplicar nota en orden creada guarda vía PUT con version y items/contexto del snapshot guardado. Mantiene productos/contexto locales pendientes, actualiza baseline/version, cierra solo tras éxito y muestra toast. Error visible en modal, sin perder texto. Bloquea cierre/duplicados mientras guarda. Wizard sin orden mantiene borrador hasta POST. Formato/diffcheck0; sin tests por owner. Oráculos anteriores de nota diferida no representan este comportamiento nuevo.

## Ajuste: nota optimista y caché

`541be5f`: PosEditor cierra modal y muestra toast inmediato, actualiza snapshot local y pasa note optimista a PosConsole.run. Cache privada acepta nota sin inventar versión, bloquea lecturas pendientes y mantiene bloqueo de otras escrituras mientras PUT confirma. Éxito reemplaza por respuesta; fallo revierte caché confirmada antes del handler existente, retira toast y reabre modal con texto para reintentar. Conflicto/sesión siguen manejo vigente; epoch impide recuperación en otra sesión. Productos pendientes conservados. Toast usa key nueva por nota para reiniciar duración. Wizard sigue local hasta crear orden.

Formato/diffcheck0 y `pnpm --filter @mi-pasaporte/merchant exec tsc --noEmit` salida0. Primera comprobación detectó reset anterior setUpdatedNotice(false), corregido a null en Descartar cambios. Sin tests ni capturas por preferencia del owner; comportamiento optimista/fallos revisado estáticamente, no afirmar comprobación runtime.
