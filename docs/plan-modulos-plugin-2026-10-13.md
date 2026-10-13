# Plan — el patron de modulos como plugins, completo (2026-10-13)

Owner 2026-10-13: «vamos a hacer un plan primero, porque esto es importante. y todo debe seguir el mismo patron a
futuro. y tenemos que revisar con un adversarial que no genere errores y que realmente queden desacoplados». Origen:
`docs/adr/0138-…` dejo el contrato del SERVIDOR; las pantallas quedaron como switch (medido abajo). El proximo trabajo
grande es desacoplar el POS, y antes el patron tiene que quedar entero.

## Decisiones del owner (2026-10-13, no volver a preguntar)

1. **Las tablas del POS y Mesas se mudan a un esquema propio `pos`** (hoy `core.pos_order`, `core.pos_order_item`,
   `core.dining_table`). Sin excepciones al patron.
2. **Cada modulo declara sus propios permisos.** El core conserva los suyos; `pos` (y a futuro `stock`, `recipes`) lo
   declara su manifiesto. El `CHECK` cerrado de la base se reemplaza por validacion contra el registro. Los permisos
   actuales del personal no cambian.
3. **Todas las rutas de API de los modulos van bajo `/api/modules/<id>/…`**: `/api/pos/…` y
   `/api/locations/:id/tables…` se mudan.
4. **Las pantallas las mueve GPT con encargo de Claude** (ADR 0114 se respeta). Claude deja los puntos de enganche y el
   contrato escrito.
5. (Ya decidido el 2026-10-12) Mesas depende del POS → Mesas es un modulo propio que `requires: ["pos"]`.

## Medido (2026-10-13)

- **Stock y Recetas, servidor y base: desacoplados.** `modules-boundary.test.ts` 4/4 y mordio con 3 mutaciones (spec
  0210). Excepciones escritas en el ADR 0138: `schema.ts` y `drizzle.config.ts`.
- **Stock y Recetas, pantallas: NO.** `backoffice-navigation.tsx:77-88` nombra ruta, nombre y segmento de los dos;
  las pantallas viven en `app/backoffice/{stock,recipes}/`; `settings/module-navigation.ts` los conoce. El test de
  frontera no mira pantallas (hablan por HTTP, no importan modulos), asi que pasa en verde con el menu escrito a mano.
- **POS + Mesas: 26 archivos del core los nombran.** Permisos (`permissions-catalog.ts`, CHECK en la base,
  `staff-permissions.ts` `assertPosGrantable`, el selector de permisos y la vista del personal), sesion
  (`session/route.ts`, `session-view.ts`: `posEnabled`), guard (`operator-guard.ts` `requirePosOperator`), esquema
  (`business.ts` `pos_enabled`, `pos.ts` y `dining-table.ts` en `core`), Mesas en Locales (3 rutas
  `/api/locations/:id/tables…` y `locations-console.tsx`), ticket e impresion (`ticket-settings/settings.ts`,
  `api/merchant/business/ticket`, `printing/`), PWA (`manifest.ts` abre `/backoffice/pos`), aviso de prueba
  (`trial-notice.tsx` caso especial de la ruta del POS), cupon en el cierre (`counter/grant-coupon.ts`: el cierre del
  POS llama al core — direccion permitida), `seed-local.ts`.
- `core.pos_order.order_id` → `core.order` (modulo → core: permitido). Ninguna tabla del core apunta a las del POS.

## Fase 0 — el contrato completo (ADR 0139, amplia el 0138) — HECHA 2026-10-13: `docs/adr/0139-…` + `docs/MODULOS.md`

1. **Manifiesto** (ademas de `id`, `name`, `description`, `requires`, `suggestedFor`):
   - `navigation`: entradas de menu (ruta, nombre, icono, orden);
   - `settingsPanel`: panel propio en Ajustes;
   - `permissions`: permisos propios (id, nombre, descripcion);
   - `fullscreen`: rutas que se muestran sin el marco del panel (POS);
   - `startPage`: puede ser la pantalla de inicio de la app instalada (PWA);
   - `locationActions`: acciones extra en cada local (el boton Mesas);
   - `canDisable`: regla para impedir apagarlo («no con ordenes abiertas» → 409 propio).
2. **Puntos de enganche del core**: menu, Ajustes, permisos del personal, acciones en Locales, inicio de la PWA y
   avisos globales. El core recorre los modulos ACTIVOS y dibuja lo que cada uno aporta, sin nombrar ninguno.
3. **Donde vive cada cosa**: servidor `apps/merchant/src/modules/<id>/`, pantallas `modules/<id>/ui/`, en `app/` solo
   archivos de ruta finitos que re-exportan (Next exige `app/`), rutas `/api/modules/<id>/…`, esquema Postgres propio.
4. **La frontera se vigila con tests**:
   - ningun archivo del core —servidor NI pantalla— nombra la carpeta, la ruta ni el id de un modulo;
   - ninguna tabla del core tiene FK hacia el esquema de un modulo (consulta a `information_schema` en Neon);
   - los archivos «pegamento» de `app/` estan listados y el test exige que sean finitos (solo re-exportan);
   - cada regla se prueba con una mutacion que la rompe (rojo visto antes de dar el test por bueno).
5. **Permisos de modulo**: el permiso de un modulo apagado queda sin efecto (como hoy `pos`); el catalogo valido de
   un negocio = permisos del core + los de sus modulos.

## Fase 1 — Stock y Recetas cumplen el contrato (implementacion de referencia)

Chicos, nuevos, sin datos que cuidar: aca se descubren los huecos del contrato con costo bajo.
- Menu y Ajustes salen del manifiesto; pantallas a `modules/{stock,recipes}/ui` (GPT); permisos propios declarados
  Owner 2026-10-13: **permisos propios** `stock` y `recipes`; a quien tiene `catalog` se le asignan los dos.
- Test de frontera extendido a pantallas y a la base.
- **Revision adversarial**: revisor en contexto fresco que intenta acoplar un modulo sin que ningun test lo vea.

## Fase 2 — POS y Mesas como modulos

- **2a, servidor y base**: esquema `pos` (mudar tablas), `pos_enabled` → `core.business_module` para cada comercio,
  permiso `pos` declarado por el modulo, `requirePosOperator`/ticket/impresion al modulo, Mesas modulo propio
  (`requires: ["pos"]`), rutas bajo `/api/modules/{pos,tables}/…`.
- **2b, pantallas (GPT)**: POS, Mesas en Locales, Ajustes, PWA y aviso de prueba por los puntos de enganche; reconectar
  a las rutas nuevas.
- **2c, PROD**: migracion + deploy COORDINADOS (el codigo viejo lee `core.pos_order` y `pos_enabled`: mudarlos rompe al
  codigo viejo → la migracion va junto con el deploy, ventana corta, snapshot), verificacion por SQL de que cada
  comercio con POS encendido lo sigue teniendo y de que las ordenes abiertas siguen abiertas.
- **Revision adversarial con tres focos**: acoplamiento oculto; regresiones del POS (cerrar orden con y sin pase,
  cupon, puntos, impresion, mesa ocupada, apagar con ordenes abiertas); migracion de datos.

## Como se trabaja cada fase

L3 (CLAUDE.md §Niveles): spec (`TEMPLATE.md`), un `implementador`, un `revisor` en contexto fresco con presupuesto y
clase de error declarados. Ningun hallazgo del revisor entra a un doc sin reproducirlo. Ninguna fase arranca sin el
PASS de la anterior. Antes: el push del trabajo actual (Stock, Recetas, dictado) con OK del owner.
