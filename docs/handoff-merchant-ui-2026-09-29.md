# Handoff — UI de Clientes y Suscripción

**Fecha:** 2026-09-29
**Estado:** cambios terminados, commiteados y enviados a `origin/main`; árbol limpio al cierre.

## Punto de retorno

El siguiente trabajo todavía no está definido. Partir de `main` y leer `docs/TASKS.md` para el estado general. Esta sesión cerró dos entregas del backoffice:

- **Clientes:** `d6e132c` (`feat(merchant): add customer list to backoffice`). Ruta `/backoffice/customers`, visible para owner y staff con `membership.permissions` que incluye `counter`; consume `GET /api/customers` según `docs/specs/0108-contratos-de-api.md`. Búsqueda por nombre o teléfono, paginación y estados de carga/error/vacío.
- **Suscripción:** `e7e95cc` (`style(merchant): align subscription with dashboard design system`). Ruta `/backoffice/subscription` adaptada a los paneles, tokens y tipografía de Marketing/Fidelización, móvil primero, claro/oscuro. Conserva las decisiones de `subscriptionOffers`, los datos de Stripe y los diálogos de checkout, cambio anual y baja. Se extrajo `subscription-facts.tsx` para mantener las reglas de fechas y recibos.

## Verificación ejecutada

- Clientes: TypeScript, ESLint, 4 tests de navegación/guard y build de producción con webpack — PASS.
- Suscripción: TypeScript, ESLint, 67 tests de facturación y build de producción con webpack — PASS.
- Suscripción: vistas locales con datos de prueba y CSS compilado en Chromium a 320/390 px, escritorio y modo oscuro; sin desborde horizontal. Se corrigió la precedencia de reglas globales de `<p>` y `<button>` detectada en esas capturas.
- `pnpm --filter @mi-pasaporte/merchant build` con Turbopack falló en este entorno porque no pudo abrir el puerto local del procesador CSS; `next build --webpack` terminó correctamente. Las capturas fueron locales; la ruta autenticada en producción no se inspeccionó visualmente desde esta sesión.

## Estado y límites

- `origin/main` quedó en `e7e95cc` antes de este handoff documental; el árbol estaba limpio.
- No se modificaron API, esquema, migraciones ni configuración de Stripe en estas dos entregas.
- No se comprobó el estado de despliegue de esos commits en Vercel; el push sí fue confirmado por Git.
