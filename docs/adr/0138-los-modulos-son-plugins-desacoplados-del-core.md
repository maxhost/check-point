---
adr: 0138
fecha: 2026-10-12
estado: aceptada
resumen: Un modulo (stock, recetas…) es un plugin, no un switch. El modulo depende del core y el core nunca de un modulo (lo vigila un test de imports); cada modulo tiene su esquema Postgres, su carpeta de servidor y sus rutas `/api/modules/<id>/…`; la activacion es una tabla generica `core.business_module`; desactivar no borra datos; un modulo declara de que modulos depende; los modulos van atados al plan. Stock y Recetas nacen asi; el POS se migra despues.
---

# 0138 — Los modulos son plugins desacoplados del core

## Contexto

- Owner 2026-10-12: «no es solo un switch. el modulo debe vivir realmente desacoplado del core, para poder
  instalarlo o desinstalarlo como un plugin de wordpress… esto me permite trabajar en modulos nuevos o viejos sin
  afectar la estabilidad del core». Analisis completo: `docs/analisis-recetas-stock-2026-10-12.md`.
- Medido 2026-10-12: el POS es un switch. Su encendido es `core.business.pos_enabled` y el core lo nombra en permisos
  (`assertPosGrantable`), sesion, navegacion, ajustes y locales.
- Respuestas del owner (2026-10-12): al desinstalar los datos quedan; un modulo puede depender de otro (mesas → POS;
  recetas → stock, elegido sobre «stock → recetas»); los modulos van atados al plan, sin cobro aparte.

## Decision

1. **Direccion unica de dependencia.** Codigo de modulo puede importar del core. Codigo del core NUNCA importa de un
   modulo. La unica puerta es el registro (`apps/merchant/src/modules/registry.ts`), que lista los manifiestos. Lo
   vigila un test que recorre los imports (`modules-boundary.test.ts`).
2. **Donde vive un modulo** (id `<id>`):
   - servidor: `apps/merchant/src/modules/<id>/`;
   - rutas: `apps/merchant/src/app/api/modules/<id>/…`;
   - esquema de base: un **esquema Postgres propio** (`stock`, `recipes`) definido en
     `packages/db/src/schema/modules/<id>.ts`. Claves foraneas solo modulo → core (o modulo → modulo del que depende),
     nunca al reves. Ningun archivo de `packages/db/src/schema/*.ts` del core importa de `schema/modules/`.
3. **Manifiesto:** `{ id, name, description, requires: string[], suggestedFor: gcid[] }`. `suggestedFor` usa la
   categoria del comercio (`core.business.category_gcid`) para marcar el modulo como sugerido; no lo enciende solo.
4. **Activacion generica:** `core.business_module (business_id, module_id, enabled, updated_at)`. `module_id` es texto
   validado contra el registro en codigo (sin `CHECK` en la base: agregar un modulo no migra el core). Sin fila =
   apagado. Encender/apagar es del owner.
5. **Dependencias:** encender un modulo con un requerido apagado → 409 `module_requires`; apagar un modulo con un
   dependiente encendido → 409 `module_required_by`. No hay cascada automatica: el comercio ve que pasa.
6. **Apagar no borra nada.** Las rutas del modulo contestan 403 `module_disabled`; al reencender los datos estan.
7. **Permisos:** mientras no exista el contrato de permisos por modulo, Stock y Recetas usan el permiso `catalog`
   del core (el conjunto de permisos es cerrado con `CHECK` en la base, ADR 0079; abrirlo es otra decision).
8. **Plan:** los modulos van atados al plan (owner). Las rutas pasan por la misma escalera de acceso que el resto
   (`requireApiPermission`/`requireApiOwner`, incluido el bloqueo por cobro). Un limite de uso de IA por plan queda
   para cuando haya IA en los modulos.
9. **El POS sigue como esta** hasta su migracion (otra spec): no esta en el registro.

## Consecuencias

- Agregar o cambiar un modulo no toca archivos del core (salvo `schema.ts`, que reexporta los esquemas para
  drizzle, y `drizzle.config.ts`, que lista los esquemas Postgres).
- Limite declarado: es un solo deploy. Un error de compilacion en un modulo rompe el build entero; lo que se gana es
  que el core no depende de ningun modulo y que un modulo apagado no participa.
- Un modulo apagado no escucha eventos: al reencender Stock, el stock estimado puede estar viejo (relevante cuando
  exista el descuento por venta, capa B).
- La navegacion del backoffice (zona GPT) lee `GET /api/modules` en vez de nombrar modulos.
