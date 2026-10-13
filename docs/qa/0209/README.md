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
