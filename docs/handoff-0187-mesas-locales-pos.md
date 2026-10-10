# 0187 — Mesas en Locales y POS

Implementación local en `dev`, encargo del 2026-10-09. Sin merge ni push.
API 0182, migración 0067 y producción no se modificaron.

Locales muestra Mesas junto a Editar cuando la sesión confirma POS activo.
El modal independiente lista solo mesas activas y guarda cada creación,
renombre y archivo al confirmar. Quitar pide confirmación; el modal Editar
permanece intacto. Los errores HTTP se muestran literalmente y conservan
el borrador. Cada local mantiene su lista aislada de respuestas tardías.

En POS se consultan las mesas del local al abrir el editor. Las ocupadas por
otras órdenes se marcan y no se pueden seleccionar. La propia mesa sigue
disponible al editar una orden. Seleccionar guarda `tableId`; volver a texto
libre manda `null` en PUT, incluso cuando el nombre no cambia. Los errores
`table_occupied` y `unknown_table` refrescan la lista conservando los productos.
La lectura fallida permite reintentar o continuar con nombre libre.

## Verificación

- `pnpm typecheck`: seis paquetes, salida 0.
- `pnpm lint` y `pnpm format:check`: globales, salida 0.
- `node tools/ui-guard.ts --base origin/main`: seis archivos, sin aumentos.
- `node tools/check-numbers.ts` y `git diff --check`: salida 0.
- E2E: 8 mesas + 91 POS, 99/99 verdes; HTTP simulado, UI y CSS reales.

Corrida aislada, con la configuración existente y sin iniciar el servidor Next:

```sh
source ~/.nvm/nvm.sh && nvm use
pnpm exec playwright test --config /private/tmp/0183-playwright.config.ts \
  tests/e2e/tables.spec.ts tests/e2e/pos.spec.ts --reporter=dot
```

La configuración temporal importa `playwright.config.ts`, conserva sus opciones,
usa el directorio absoluto de e2e y establece `webServer: []`, `workers: 4`.
Log: `/private/tmp/0187-verified.log`. Capturas inspeccionadas:
`/private/tmp/0187-mesas-local-mobile.png`,
`/private/tmp/0187-mesas-local-desktop.png`,
`/private/tmp/0187-mesas-pos-mobile.png`.

Los tests existentes de caché conservan los oráculos de sus endpoints originales
y cuentan aparte las nuevas lecturas de mesas; editar en texto libre espera
ahora el `tableId: null` que exige el contrato. El wizard espera el heading del
pedido ya guardado, evitando coincidir antes de terminar el POST. No se ejecutó verify global
ni se afirma CI remoto verde. No se utilizaron bases reales para los tests.

## QA pendiente del owner

Con POS activo, entra a Locales → Mesas: añade, renombra y quita una mesa sin
abrir Editar. En POS elige esa mesa, añade un producto y guarda: al volver al
listado e iniciar otra orden, la mesa debe aparecer ocupada. Reabre la primera
orden, cambia la mesa y guarda; también prueba Usar nombre de mesa y guardar.
Duplicados y mesas ocupadas deben mostrar el mensaje de la API sin perder datos.

Sin cambios en `server/**`, `app/api/**`, `ui/**`, paquetes, tooling, migraciones
ni printing. El cambio previo en `apps/merchant/next-env.d.ts` se deja fuera
de los commits. Publicación y QA con persistencia real quedan para el owner.
