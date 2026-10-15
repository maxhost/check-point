# Implementación 0231 — Rentabilidad y Equipo

El owner autorizó pasar el candidato aprobado `9e23b5fe547e6b98b2c4d5b7ed0f7da97586a290` a main local y lanzar la implementación0231. Main se avanzó desde120ecbc9 por fast-forward verificado, sin cambiar la rama dev del checkout principal. Tres entregas anteriores aceptadas se integraron/retiraron con factory, sin force. No hubo push ni operación PROD.

Objetivo: [SPEC0231](../specs/0231-costos-fijos-por-local-y-personal.md) y [ADR0147](../adr/0147-punto-de-enganche-de-modulos-en-equipo.md), diseño técnico con QA documental aprobado. Este encargo posterior autoriza backend, contratos genéricos, esquema/migración y pruebas. No autoriza pantallas, Smart Menu, Dashboard/equilibrio, generales multilocal, reparto manual, comisiones o cálculo de nómina. No modificar INDEX, TASKS ni estados comunes. ADR0144: coordinador, dos implementadores que corrigen y QA independiente; sin subdelegación.

## Base y recursos

Dev parte de9e23b5fe; la base exacta de workers es el commit de esta ficha/reserva documental, comunicado antes de escribir. Worktrees propios bajo `/private/tmp/checkpass-0231`: `factory-0231-core`, `factory-0231-profitability` y, al congelar, `factory-0231-qa`. Main conserva el candidato anterior mientras se trabaja en dev. Cada nueva promoción a main/push/operación PROD espera la autorización correspondiente; la actual solo promociona9e23b5fe.

Scopes exactos mediante `tools/factory.ts`, sin globs. A es único writer de esquema, journal/snapshots y contratos core; B de registros y módulo. DB CI protegida exclusiva por turno, incluyendo migración/teardown. Configuración seleccionada `/private/tmp/checkpass-specs/ci-selected.env`, modo0600, solo clavesCI. Tests DB únicamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh ...`; nunca URL PROD. Node24 antes de comandos. Sin servidores necesarios; artefactos propios `/private/tmp/checkpass-0231-*`.

## A — profitability-core-0231

Writer explícitamente asignado a las seis tablas de SPEC0231 (tres core, tres del módulo), exports de esquema, configuración Drizzle y migración/journal únicos. No alterar CHECKs de membresía o auth para simular personas sin acceso. Backfill 1:1 de identidad staff, sin locales/sueldos/permisos inventados; comprobar preservación de PIN, sesiones y accesos. Numerar SQL desde journal real posterior a0085; nada de PROD.

Core: identidad `staff_person`, acceso opcional, timeline de locales y rutas `/api/staff/people`, conservando contratos legados por `userId`. Alta sin acceso no crea auth/membership/PIN. Grant/revocación reutilizan validaciones y protecciones existentes; las escrituras legadas sincronizan identidad en la misma transacción. Altas legadas pueden quedar sin locales y requieren selección antes de cargar sueldo.

Contratos genéricos: `staffAction` en manifiesto y `staffLocationsChanged(tx, change)` en `ModuleServer`, con payload SPEC0231. Dispatcher core recorre aportes sin nombrar un módulo concreto, también apagados como mantenimiento de datos previos. Error sanitizado revierte cambio completo de Equipo, sin importes en DTOs/errores ni bloqueo de ventas. A y B acuerdan/publican temprano nombres exactos de tablas/helpers y tipos; B no adivina un contrato provisional. Helpers core para bloquear persona y leer timeline admiten el mismo `tx` del writer del módulo.

Contrato acordado A/B: `schema/staff-person.ts` exporta `staffPersons`, `staffLocationPeriods`, `staffLocationAssignments`; `schema/modules/profitability.ts` exporta `profitabilityFixedCosts`, `profitabilityFixedCostPeriods`, `profitabilityFixedCostAllocations`. `server/staff-location-timeline.ts` aporta `lockStaffPerson(tx,businessId,personId)` y `listStaffLocationTimeline(tx,businessId,personId)`, este último devuelve todos los periodos ordenados `{id,fromMonth,untilMonth,locationIds}`. Mes interno/callback `YYYY-MM-01`, HTTP `YYYY-MM`; preservar IDs/referencias históricas al dividir y no borrar periodos referenciados antes del callback.

Publicar primero un commit de fundamento/esquema/helpers estable para que B lo incorpore limpiamente; después completar comportamiento core sin tocar paths B. Checks focales de autenticación, permisos, tenant, grant/revocación, compatibilidad legada, transacciones, timeline, callback genérico y DDL/backfill; regresiones de staff afectadas. Tests relacionados pueden actualizar mocks por cambios reales dejando el motivo, nunca borrar negativos o relajar guardias.

Entrega propia `docs/factory/0231-core.md`, SHAs exactos y evidencia/runtime/config/esquema, límites y turno DB liberado. No marcar implementada ni integrar refs ajenas.

## B — profitability-module-0231

Writer `apps/merchant/src/modules/profitability/` (manifiesto, servidor, contratos/DTO, aritmética y pruebas), tres registros y expectativas concretas afectadas de registro/dispatch. Añadir tipo opcional `staffPanel` en ui-registry coordinado con A, registro `{screens:{}}`; ningún componente visual o menú que prometa una pantalla inexistente. SuggestedFor amplio con categorías existentes, copy genérico.

Rutas SPEC0231 con permiso único `profitability` y guards existentes; sin exigir `staff`/`locations` adicionales para dinero. CRUD de fijos/sueldos, intervalo explícito y correcciones pasadas, baja mensual, lectura local/comercio por buckets monetarios. Importes exactos; persistir total y asignaciones por local, no deducir histórico desde locales actuales. Reparto igual en unidades mínimas, q/r y residuo completo al primer UUID ordenado; COP/CLP/JPY/PYG enteros y resto de monedas ofrecidas a2. Manual representable en modelo, API actual no lo habilita.

Todo writer salarial bloquea persona→costos. Callback solo redivide salarios existentes, conserva total, moneda, baja, meses anteriores y variaciones futuras; mismo commit de cambio de locales core, incluso módulo apagado. Conservación/reasignación de referencias de periodos core se coordina con A antes de borrar/dividir filas referenciadas; no resolverlo con FKs desactivadas o lecturas que escriban. No crear sueldo desde callback ni filtrar datos a gestores de Equipo.

Checks: reparto/monedas/T<n, intervalos, CRUD/stop/corrección histórica, permisos negativos reales y aislamiento de dos comercios/locales, archivado/carrera, idempotencia y callback/concurrencia/rollback combinado. Turno DB solo asignado por coordinador, sin competir con A. Entrega `docs/factory/0231-profitability.md`; no modificar esquema/journal, core ni UI ajena.

## QA e integración

QA independiente lee spec y diferencias, verifica entregas y combinación por SHA, con DB reservada durante todos sus procesos y teardown. Probar decisivos auth/tenant/dinero y preservar negativos existentes; reutilizar evidencia compatible de autores por identidad de código/configuración/SQL. Tipos/lint/formato/fronteras y checks afectados; gates amplios solo por riesgo concreto, no verify global por ceremonia. No PASS por skips/retries o por un test que no ejecutó los casos requeridos.

Fallo de producto vuelve al implementador, invalidando solo checks afectados. Contratos genéricos no pueden introducir literales/imports de Rentabilidad en core, relajar fronteras o ampliar permisos implícitos. UI sigue diferida. Congelar combinación antes de QA; no actualizar checkout durante pruebas. Alinear también esquema de app local antes de integrar código que lo requiera, usando migrador local protegido; CI no migra la app ni producción. Informe QA propio `docs/factory/0231-qa.md`; listo en dev con evidencia concreta antes de solicitar promoción de un candidato nuevo a main.
