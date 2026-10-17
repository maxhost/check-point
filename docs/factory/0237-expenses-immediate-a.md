# 0237 — Gastos, intento inmediato de entrega a Analíticas (A)

Task/branch `expenses-immediate-a`, worktree `/private/tmp/checkpass-expenses-immediate/expenses-immediate-a`. Base limpia **c0f727746d19f8d47383c7f4e9825159b10b3f12**. Producto congelado **263790be4ac3fa761c02efa02031d03c2c0c8b2f**; la entrega posterior solo agrega este handoff. Mandan spec0237 §2.3 y [contrato del encargo](0237-expenses-immediate-contract.md).

## Cambio y contrato

`apps/merchant/src/modules/expenses/server/routes.ts` conserva las rutas, permisos, validación, códigos y JSON. POST entries, PUT entries/:id y DELETE entries/:id esperan el resultado exitoso del writer existente, que devuelve la transacción completada, y luego llaman una vez a `scheduleExpenseDelivery(business.id)`. Si falla el writer o el body, no hay programación. GET/context/concepts/entries y los dos drafts siguen sin dispatch.

Nuevo `server/delivery.ts`: registra con `after()` un callback **async y awaitable, Promise<void>** que llama al `retryModuleEvents` existente, limitado exactamente a:

- Comercio autenticado de la ruta; no se usa businessId del payload.
- `expense.recorded`, `expense.updated`, `expense.deleted`.
- Solo `subscriberIds: ["core.analytics"]`.
- `budgetMs: 2000`, `batchSize: 50`, sin `force` ni ampliación de alcance.

Si `after()` arroja por falta de contexto, inicia el mismo intento con `void retry()`. El callback captura tanto throw síncrono como rechazo asíncrono del procesador: no arroja ni deja rechazo sin manejar que convierta un gasto guardado en error. La respuesta no espera que termine el intento. Un batch de hasta30 líneas programa una sola ejecución, y un replay idempotente puede volver a ayudar a drenar la cola sin modificar los writers.

No se cambian writers, transacciones, traductores, dinero/null/moneda, deduplicación, Stock, cron, migraciones, UI ni condiciones de mes cerrado/cobertura. Cola y cron siguen siendo respaldo durable. El intento no garantiza actualización antes de navegar ni éxito dentro de2s; pueden quedar entregas pendientes.

## Verificación real de A

Node **24.20.0** con `source ~/.nvm/nvm.sh && nvm use`. Primera ejecución de cada check, sin fallos ni reintentos, sobre los tres archivos de producto del checkpoint263790be:

```sh
pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/expenses/server/delivery.test.ts --reporter=verbose
pnpm --filter @mi-pasaporte/merchant exec tsc --noEmit
pnpm exec eslint apps/merchant/src/modules/expenses/server/routes.ts apps/merchant/src/modules/expenses/server/delivery.ts apps/merchant/src/modules/expenses/server/delivery.test.ts
git diff --check
```

**16/16 unit PASS**, sin skips, filtrados ni retries,1.07s. Log `/private/tmp/expenses-immediate-a-unit.log`. Merchant tipos EXIT0 `/private/tmp/expenses-immediate-a-types.log`; lint focal EXIT0 `/private/tmp/expenses-immediate-a-lint.log`; diffcheck EXIT0.

Los unit importan la tabla real de rutas y el helper real, con writers, consultas, drafts y retry mockeados. Observan POST/PUT/DELETE sin programación mientras la promesa del writer sigue pendiente, callback registrado después, DTO/códigos y argumentos preservados; un callback por batch30/replay; scope exacto sinforce; ModuleError preservado/errores inesperados503 sin dispatch; GET/drafts/body inválido sin dispatch; fallos sync/async del callback absorbidos; fallback cuando after arroja; respuesta disponible con retry aún pendiente; y ausencia de `unhandledRejection` con los fallos del fallback.

Estos unit prueban el cableado y la espera del resultado del writer, **no certifican por sí solos el commit ni los resúmenes reales de la DB**. B tiene el único Neon focal autenticado de create→update→delete, replay, tenant y corte Stock, después de integrar/refrescar este checkpoint. A no opera DB ni presta evidencia de B o QA. No se ejecutó verify global ni mutaciones.

## Entrega y pendientes

Los únicos archivos de esta entrega son routes.ts, delivery.ts, delivery.test.ts y este handoff. Sin procesos propios persistentes, puertos ni recursos DB; checkout limpio tras commit. Checkpoint comunicado al coordinador/B para integración antes de su Neon; entrega factory posterior requiere QA independiente/combinación exacta antes del pase local a main. Sin push, deploy, PROD, nueva migración ni cron remoto.

Se conserva el FAIL de rendimiento general y todos los pendientes diferidos anteriores. Este intento inmediato de Gastos no resuelve ni mide el objetivo de rendimiento de la evaluación global, no hace backfill y no cambia las decisiones de producto cerradas.
