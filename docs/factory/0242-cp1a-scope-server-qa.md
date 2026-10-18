# 0242 CP1a — QA independiente scope servidor

**PASS de entrega y combinación focal** sobre candidato congelado `8a9b76f9543cc02d49bd0a3e2aa76fd00945486c`, WT `pos-qa-0242` inicialmente limpio. Base `00efff814a1939b25006af36c7dbfb04758f3256`; código scope `27ec722d13afb6f84b7f4b44ccd1eaa38ca314d0`; entrega `1af3d7f3bab690bb6db21e0d9655f8c9408c125d`. QA nueva, sin implementar producto ni cambiar refs principales. Fecha: 2026-10-18.

## Revisión y aceptación

Se contrastaron ficha, handoff, spec0242 §4, anexo §3, ADR0154, protocolos ADR0144 y diff exacto base→entrega. Los ocho archivos de código/test y handoff coinciden con el alcance asignado. No se identificó fallo nuevo de producto o interacción.

- Metadato genérico `backofficeScope?: 'optional'|'required'`; ausencia conserva la ruta no adoptada. Optional admite ausencia y valida toda cabecera presente, incluso vacía/malformed; required rechaza también ausencia. Scope no selecciona negocio ni concede permiso.
- Dispatcher conserva `measureRequestPhase('module-guard')`, guard completo → comparación → dominio. Se conservan las llamadas a los guards existentes de owner/permisos/email/billing/PIN/módulo y los controles de dominio/local. Respuestas adoptadas de guard, scope y dominio reciben `private, no-store`, también errores. 404/405 de matching previos a identificar una ruta mantienen su contrato.
- `posRoute` adopta optional para las 15 rutas/verbs reales, incluido `paymentRoutes`: payment-methods, catalog, orders GET/POST, orders/:id GET/PUT, close, void, resolve, coupon-state, coupon-remove, tables, ticket y ticket-settings GET/PUT. El inventario ejecutado exige tabla completa y metadato en todas. No hay literal POS nuevo en core, cambio cookies/auth/pool, esquema, DTO unit ni cutover anticipado.
- El helper usa el contexto de Request y HMAC existentes; no añade caché global/cookieCache. Reporter/auth y toggle conservan su implementación previa. Los clientes/seed/cache y required en CP3 quedan pendientes por contrato, sin afirmarse aquí su adopción.

## Evidencia independiente sobre el candidato

Node `v24.20.0`, Vitest `4.0.18`, con prefijo `source ~/.nvm/nvm.sh && nvm use &&`. SHA256 de lock `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Config privada seleccionada, sin imprimir valores: `selected.json` SHA256 `535be4b240effc5b8e0f0e8079a3ec77aa605c7710da54ae0b8289c84a66ce47`; `ci.env` SHA256 `2f5feba61ffc64659e7faac8afe917e68f5326256dd0ec6a37d4c2fd5cf13280`, ambos bajo `/private/tmp/checkpass-pos-0242/private/`. Identidad coincide con el handoff; sin modificación de fixtures M0.

```sh
pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/dispatch.test.ts src/modules/route-table.test.ts src/server/backoffice-scope-http.test.ts src/modules/modules-boundary.test.ts
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/pos-scope.neon.integration.test.ts --no-file-parallelism
pnpm --filter @mi-pasaporte/merchant typecheck
git diff --check
```

Todos EXIT0. Focales: **138/138 PASS**, 4 archivos, cero skips/retries (dispatch26, route-table7, scope95, boundary principal10), 3.27s. CI: **4/4 PASS**, cero skips/retries, 23.59s total/21.93s tests, migración wrapper exitosa. Incluye inventario y tres casos reales con sesiones nativas Better Auth, dispatch, Request y DB protegida exclusiva, también durante teardown. Schema heredado termina en `0101_analytics_inbox_lifecycle`; no DDL nuevo de esta entrega. Aviso de credencial consumer opcional ausente: esta suite no utiliza ese rol.

El cruce intención A/cookie B devuelve exactamente409 `backoffice_context_changed` en GET orders y POST orders con payload válido para B, sin exponer datos B; snapshot SQL completo de órdenes A/B idéntico antes/después. Matching/legacy leen A sin datos B; matching escribe201 y verifica por SQL el businessId A. Staff real counter mantiene403 `missing_permission` y403 `not_owner` antes de scope ajeno/malformed. Cabeceras vacía, malformed y hex mayúscula rechazan409. Respuestas privadas/no-store verificadas. AfterAll comprueba ausencia de businesses/posOrders/users propios; pasó sin huérfanos. No quedaron procesos persistentes propios.

Se reutilizan tipos domain, ESLint y Prettier del autor: archivos scope, configuración y lock idénticos a su entrega; merchant typecheck se repitió para la combinación. No se ejecutó verify global, build, navegador ni servidor HTTP. Esta evidencia certifica dispatch nativo y DB, no browser ni rendimiento.

## Combinación con financial aceptado

Se reutiliza la evidencia independiente **88/88 PASS** de [QA financial](0242-cp1a-financial-qa.md), commit `9a4a52a6c2d931b19a337ab70b73131595463278`, candidato allí `9587c002c19a62e26d715a4d028e6374d8865147`, entrega financial `e9d409ac23d9e712d08ffae475a375b09c913571`. `git diff --name-only 9587c002 HEAD` contiene únicamente los ocho archivos scope y documentación de ambas entregas; ningún archivo financial, lock o configuración cambió. La prueba CI positiva conserva operación unit real con ese financial combinado. El typecheck merchant conjunto y los negativos reales anteriores pasan sobre `8a9b76f9`; no hay interacción adversa observada. No se vuelve a certificar funcionalidad financiera futura ni HTTPv2.

## Fallos conservados y atribución

QA reprodujo `vitest run src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts`: **EXIT1, 2 FAIL/14 PASS**, sin skips/retries. No son PASS de guardias globales:

- Between: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`.
- Literals: `app/backoffice/backoffice-context-controller.test.ts` (3), `app/backoffice/backoffice-context-refresh.test.ts` (1), `app/backoffice/onboarding/checklist-context-resource.test.ts` (1), `server/analytics/evaluation/policy-simulation.test.ts` (2), `server/analytics/lifecycle/index.ts` (1).

QA comparó bytes `git show 00efff81:<path>` con candidato para esos seis archivos: todos iguales. SHA256 respectivos en el orden anterior, reproducidos e iguales al handoff:

```text
73f85ff198e379d8e79718da6f8baa188721de6a0b19311c0bdcb44f82ea1d05
2456e5eaf77cba32812e2622f5d6fe5c99c8e5ceb8ce5a1efcf50f3e1201a51e
1b8829636cdcb79f14d541cb0cffdd9b27dd6e723c26bc7046f507a533c01b86
7b031ab9d81eaf69aa3618d6ab97edcb7f0b96823ae1ffb758d997484c736931
ee0c7225fa4c1b4f993bd22400d8b2befdca549d9494d1534799596d8e7e3162
8168e48d8c14e7bb962419f24a48623730d035d1633e2f226adf545941a08353
```

`git diff --quiet 00efff81 --` los dos tests de guardias y `modules-boundary-support.ts`: EXIT0. Fallos preexistentes fuera de scope, sin alterar guardias ni excepciones. El PASS focal no significa que esos gates estén verdes.

El [handoff](0242-cp1a-scope-server-handoff.md) conserva el primer intento del autor: 3 tests PASS/1 FAIL y afterAll FAIL por fixture staff `[]` incompatible con constraint y owners no borrados por helper compartido. Corrección legítima: staff `['counter']`, borrado explícito de usuarios propios y aserciones teardown. Tres usuarios huérfanos del intento se eliminaron por IDs propios mediante wrapper CI, SELECT0, se retiró recuperación temporal y autor repitió archivo final4/4. QA inspeccionó el test final, sin recuperación fija, y reprodujo4/4 con cleanup0; no convierte el intento fallido original en PASS ni hubo reintento en esta QA.

## Cierre

PASS acotado permite al coordinador aceptar scope CP1a y esta combinación congelada con financial. No afirma publicación, PROD, browser/build, nuevos clientes o CP3. Único archivo escrito por QA: este informe; aceptación/factory/integración/estado quedan al coordinador. Recurso CI liberado tras teardown comprobado; no push ni implementación. El siguiente bloque requiere QA nuevo según asignación.
