# P1 — contrato de implementación de SPEC0233 / ADR0149

Fecha: 2026-10-15. Tarea preparada por el coordinador; **no se despacha código P1 hasta terminar QA e integración R1 en main local**. El owner autorizó esa secuencia y ambos merges locales. Sin push ni operaciones PROD; INDEX, TASKS y estados comunes siguen excluidos. La base exacta y las reservas se fijan al despachar.

Despacho autorizado después del cierre R1: main local `271dbba682f841b8277093a6431fd3d5408b6231`, QA independiente PASS y corte local ejecutado con equivalencia de los dos productos. Sus tres reservas quedaron retired y los worktrees limpios se retiraron mediante factory, sin force. P1 parte del commit de este despacho en dev, registrado por SHA en las nuevas reservas; no hereda el PASS de R1. Fichas: `p1-0233-core`, `p1-0233-pos` y `p1-0233-qa`, en worktrees nuevos bajo `/private/tmp/checkpass-p1-implementation`. A conserva el journal y recibe inicialmente la DB CI; B y QA esperan turno explícito.

## Mandato y equipo

[SPEC0233](../specs/0233-medios-de-pago-y-comisiones.md), [ADR0149](../adr/0149-pagos-y-comisiones-congelados-al-cierre.md) y [QA documental de la ampliación](0233-financial-snapshot-doc-qa.md), candidato documental `faf7de09`. Dos implementadores que también corrigen, coordinador y QA independiente, sin subdelegación ni reviewers extra. Piso L2; dinero, tenant y migración requieren negativos reales y evidencia por SHA/entorno.

El «solo documental» del encargo original describe aquella entrega. La autorización posterior permite implementar P1 completo, con selector mínimo POS, migración, QA y merge a main local. No implementa P3, pantallas definitivas, gateways, Smart Menu ni la validación de precios por moneda pendiente en origen. No se pide nuevamente una decisión monetaria cubierta por la regla general del owner.

## A — esquema, contratos genéricos y Rentabilidad

Writer único de esquema/journal/migraciones, incluidas tablas POS/core que usa B. Scope previsto: `packages/db/src/schema.ts`, esquema core de catálogo, esquemas canónicos `modules/pos.ts` y `modules/profitability.ts` con sus helpers privados si hacen falta, `packages/db/drizzle`; aritmética pura `packages/domain/src/financial.ts` y sus pruebas bajo un proyecto Vitest existente; lifecycle/directorio genéricos en `modules/route-table.ts`, `activation.ts` y nuevo helper de recursos; tipos/publicación/retry de `server/module-events`; módulo `profitability`; lectores Recetas/Stock estrictamente necesarios para aceptar v1/v2; pruebas de frontera/registro pertinentes sin excepciones; herramientas propias `tools/payment-methods`; entrega `docs/factory/0233-core-profitability.md`.

A entrega primero un fundamento compilable de esquema/DTOs, helper financiero, evento dual y recursos. No se generan journals en paralelo ni se modifican migraciones ya aplicadas. Aprendizajes R1: índices únicos compuestos antes de FKs; cascadas del comercio compatibles con historia inmutable; todas las tablas de un módulo se exponen por su esquema canónico sin alterar el detector de ownership.

Después implementa configuración/revisiones de comisión, puntero genérico al cierre, aplicador durable, reader y HTTP Rentabilidad, conservando costos/sueldos 0231. Rentabilidad mantiene `requires: []`, sin FK/import/SQL hacia POS; usa exclusivamente el directorio de metadata y la lectura puntual de cero persistido. Ningún suscriptor participa del cobro. Ausencia de evidencia positiva o módulo apagado al cierre significa sin dato, nunca cero ni reconstrucción posterior.

## B — POS, acreditación y selector mínimo

Scope previsto: módulo `pos` completo, sin tocar su esquema reservado A; helpers genéricos existentes `server/counter/{orders,grant-coupon,coupon-discount}` y pruebas relacionadas para unidad de liquidación/origen opaco; browser focal POS y fixtures propios; entrega `docs/factory/0233-pos.md`. No cambia kit, guardias, paleta ni reglas globales.

B implementa catálogo/lista comercial, carga transaccional al activar, archivo/Efectivo, providers POS, pagos y snapshot por orden/línea, reparto y origen congelados desde la única decisión de cupón, HTTP y retry idempotente. El helper genérico de acreditación conserva default2 para callers actuales; POS pasa minorUnit antes de persistir neto/acreditación. Propaga la referencia de la línea realmente elegida por el evaluador, sin reevaluar cupón ni cambiar consumo R1.

Selector del kit «Medio de pago», Efectivo inicial; solo con neto positivo. Neto0 envía pagos[], no muestra ni exige medio y no genera fijo. Recibido/cambio solo efectivo. Conservar pagos/clave en intento incierto, revisar importe autoritativo si cambió beneficio y mostrar ajuste legible. No mostrar comisión ni racionales internos al cobrar. UI mixta queda fuera, contrato admite varios medios distintos. Copy genérico y tuteo de `apps/merchant/COPY.md`.

La skill `impeccable` se aplica a esta extensión estrecha de checkout, heredando el kit y la composición existente; no hay rediseño, entrevista nueva ni cambio de identidad ya decidida. Coordinador ejecutó su carga de contexto sobre `pos-checkout.tsx`; el autor lee `reference/craft-floor.md` inmediatamente antes de editar UI. Revisión visual móvil/escritorio en una pasada conjunta, correcciones materiales y como máximo una confirmación; QA independiente existente, sin nuevos agentes por la skill.

## Interfaces A → B

Los nombres definitivos se confirman antes de escribir consumidores; un cambio vuelve al coordinador. Propuesta inicial:

- `@mi-pasaporte/domain/financial`: `minorUnitForCurrency`, `normalizeMoney`, `allocateCumulative`, `buildFinancialSettlement`, `ExactAmount` y `FinancialSettlement`. Puro y compartible con preview; BigInt/racionales exactos, sin DB, floats ni nombres de módulos. Conserva originales/ajustes y produce el DTO de la spec, incluidos position/sourceLineId, origen opaco y paymentOriginals en orden estable. No decide cupones ni medios propios/activos.
- `ModuleServer.onEnable(tx,{businessId})` y `resourceProviders`: list/read bajo la transacción del caller y comercio explícito. El helper core devuelve `{providerId,resourceId,metadata}`; POS aporta `payment_method` y lectura puntual `sale_settlement`, incluidos datos persistidos con POS apagado. Rentabilidad valida la metadata bajo su guard; no concede una API pública ni permisos POS.
- `publishSaleClosed`: mantiene el contrato histórico para decodificación/pruebas v1 y acepta snapshot financiero nuevo validado; el único writer POS pasa siempre v2. Una sentencia MVCC captura recursos tipados de productos/medios y elegibilidad. Preservar referencias composition R1 y campos comunes. No escoger tarifa por timestamps ni consultar tabla Rentabilidad durante cierre.
- A publica por SHA exports reales de tablas y DTOs antes de que B integre. B exporta hooks/providers en su objeto `server` ya registrado. Sin stubs de producción ni imports entre módulos opcionales.

## Recursos, QA y aceptación

Reservas/paths exactos y base se registran con factory antes del código. Tres worktrees operativos como máximo; el coordinador integra serialmente en dev y conserva commits/ref previos al refrescar dependencias. A tiene journal exclusivo; DB CI se asigna a un solo writer también durante DDL y teardown, solo `tools/neon-test.sh` y configuración seleccionada externa. Ninguna copia de env PROD. Tipos/lint/guardias focales y evidencia reutilizada por identidad; no verify global por ceremonia.

QA escribe `docs/factory/0233-implementation-qa.md`, no implementa el candidato certificado. Presupuesto inicial focal20min/candidato, cero mutaciones. Señales decisivas: cierre positivo exige medios/suma; neto0; con/sin cliente/cupón y acreditación igual; USD/COP con brutos/descuentos/pagos/comisión normalizados, originales/deltas exactos y G−D+A=N; reparto acumulado y línea gratis exacta con productos repetidos; retry/rollback; comisión %, fija y ambas congeladas pese a edición; medio archivado/historia/Efectivo; país fallback y seed idempotente; Rentabilidad apagado/sin dato sin backfill; permisos sin POS/tenant; consumidores R1/0230 v1/v2 conservados. Browser focal del selector y prueba visual390/1280 según kit; no confundir harness con smoke de app.

Al terminar, alinear también esquema/datos de la app local por migrador protegido, medir catálogo/medios sin inferir ceros ni tasas y conservar flags/EXPAND0227. QA final identifica SHA y límites; factory deliver/accept antes de promover a main local. Owner ya autorizó ese merge: no abrir otra aprobación local. Después factory integrate/cleanup solo con aceptación, ancestro de main, checkout limpio y ausencia de procesos; sin force ni descarte ajeno.
