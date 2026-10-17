# 0235 — candidato condicionado de retiro

Fecha: 2026-10-16 (America/Guayaquil). Tarea/rama `negocio-retirement-0235`, base `058634669359d6be96b841d158750c9de7e9e6d7`, worktree `/private/tmp/checkpass-negocio-followups/negocio-retirement-0235`. Código congelado: `d4eda771022b6f24ecdfaba61d91e1376c2684e0`. Contrato: [0235-followup-contract.md](0235-followup-contract.md), spec0235 y ADR0150. Cero mutaciones de verificación; no push, deploy, consulta ni escritura PROD, ni migración nueva.

**Este artefacto se conserva separado y no certifica drenaje ni habilita publicación.** Requiere esquema0093–0095 completo, corte/writers antiguos resueltos y obligaciones históricas drenadas. El puente combinado `e5eaa741e5f1b3f1f0787b134b3d00d1c5d5c45c` sigue disponible; este candidato no lo reemplaza antes de cumplir esas condiciones. La corrección CI se integra por separado; no se mezcla con este retiro para declararlo apto para producción.

## Cambio preparado

- POS obtiene metadata/validación directamente de core, sin detectar ubicación de tablas. Se borran implementaciones/tablas privadas legadas y fachada de catálogo; sale `onEnable` y el provider `payment_method`. Permanece GET del selector y `sale_settlement`, necesario para comprobar cero histórico sin cabecera.
- El cierre calcula/captura siempre core en su transacción y conserva provider nuevo `core`, fuente opaca del POS, idempotencia, importes, revisiones y avisos. Desaparecen únicamente la alternativa precorte y la opción del publisher que omitía un suscriptor de comisión ahora retirado. No se cambia aritmética ni el timeout/budget/claim/ACK genérico del retry.
- Se borran suscripción/aplicador de comisiones de `profitability`, aplicador core histórico y dispatch de compatibilidad. Retry conserva su manejo normal de errores: si aparece una obligación sin handler, rechaza; no inventa ACK, no marca skipped y no elimina datos. Por eso es obligatorio certificar drenaje **antes** de instalar el candidato.
- Marca pierde argumento/DTO/writer precorte. Siempre rechaza Regional/Fiscal por `brand`; identidad/logo/colores permanecen. Alta del comercio siempre inicializa medios core, sin guardar una variante para esquema viejo.
- Tablas, revisiones, resultados, eventos, deliveries aplicados y mapping `historical_event_handler` permanecen intactos. El mapping sigue siendo metadata de lectura para identidades heredadas aunque ya no despache código. No se recalculan pagos ni se cambia provider histórico. No se toca Settings, UI, Gastos/renombre, kit/guardias ni SQL/journal de migraciones.

Paths adicionales autorizados por coordinador: `modules/resources.neon.integration.test.ts` y `modules/stock-local-integration-support.ts`. El segundo cambia solo el import del inicializador hacia core al retirar la fachada POS.

## Precondición y operación futura

Consulta preparada: [retirement-preflight.sql](../../apps/merchant/src/server/business/retirement-preflight.sql). Es exclusivamente SELECT; se ejecuta en una instantánea consistente de solo lectura, con autorización operacional correspondiente, sin imprimir credenciales:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Ejecutar el contenido completo de retirement-preflight.sql.
COMMIT;
```

Debe devolver `schema_ready=true`, `unresolved_deliveries=0`, `unresolved_claims=0`, `failed_attempts=0` y `database_ready_for_retirement=true`. Usa los estados reales pending/processing/applied/skipped; `application_failed` es un diagnóstico de pending, no un estado inventado. Cuenta todo claim aún presente, activo o vencido, también si una fila terminal conservara metadata inconsistente. Una consulta fallida, mapping ausente o esquema incompleto **no certifica retiro**. No cambia estados, no limpia claims ni toca evidencia financiera.

La consulta cubre el esquema core requerido (incluida precisión0095) y obligaciones de los subscribers identificados por `commission_snapshot`. **No prueba READY, ausencia de writers/versiones viejas, comparación de IDs/FK ni consumidores/sesiones:** esas señales operativas se obtienen aparte. Tampoco una instantánea aislada garantiza que un writer viejo no cree otra obligación después; cerrar primero esa fuente y mantener la coordinación del corte.

Orden pendiente, sin ejecución aquí:

1. Confirmar puente READY/SHA, esquema0093/0094/0095 transaccional y ausencia verificable de invocaciones/writers anteriores. Conservar comparación de todos los IDs/valores/FK, incluidos los que crecieron desde el baseline22/2; no volver a migrar o reconstruir historia.
2. Con puente aún instalado, completar reintentos históricos con sus revisiones capturadas. No reinterpretar skipped por módulos apagados ni cierres sin evento. Obtener cero obligaciones/claims por la consulta y evidencia operativa de que no pueden aparecer nuevas desde writers viejos. Guardar resultado, hora, DB/SHA y autorizaciones; esta tarea no los presupone.
3. Solo después preparar la integración/publicación del candidato de retiro, con QA de combinación y cada autorización PROD propia (push/deploy/otras operaciones). Verificar selector, cierre nuevo y lecturas históricas. La presencia de código preparado en esta rama no autoriza esos pasos.
4. Si hay pendientes o una regresión, detener el retiro y conservar el puente compatible con core. Después del movimiento no volver al binario0092, no SETSCHEMA inverso, no borrar/recalcular resultados. Reponer el puente restaura recuperación histórica sin cambiar sus identidades.

## Pruebas y evidencia durable

Node24.20.0. DB CI seleccionada `/private/tmp/checkpass-recipes-margin/0234-ci.env`, con reserva exclusiva `db:modules-ci` transferida por coordinador después del teardown del worker CI. Solo wrapper, archivos focales y `--no-file-parallelism`. No se ejecutaron DDL ni triggers globales de prueba en esta tarea. Directorio de logs reales sanitizados: `/private/tmp/checkpass-negocio-followups/retirement-logs/`; no son transcripciones del chat. Los wrappers guardan comando, SHA, hora, configuración por path y EXIT_CODE. Solo claves/largos de variables, nunca valores.

| Comprobación | Resultado observado | Log absoluto |
| --- | --- | --- |
| Merchant typecheck final | EXIT0 | `/private/tmp/checkpass-negocio-followups/retirement-logs/11-typecheck-final.log` |
| DB + Domain typecheck | Ambos EXIT0 sobre d4eda771 | `/private/tmp/checkpass-negocio-followups/retirement-logs/14-package-types.log` |
| ESLint de todos los TS afectados | EXIT0 | `/private/tmp/checkpass-negocio-followups/retirement-logs/09-eslint.log` |
| Unitarios Marca + tres fronteras | 62PASS/1FAIL, EXIT1; baseline ajeno descrito abajo | `/private/tmp/checkpass-negocio-followups/retirement-logs/07-unit.log` |
| Retirement Neon | 5/5 PASS, EXIT0,28.46s, sin skips y teardown completo; d4eda771 | `/private/tmp/checkpass-negocio-followups/retirement-logs/12-neon-retirement.log` |
| Resources Neon | 9/9 PASS, EXIT0,50.78s, sin skips y teardown completo; d4eda771 | `/private/tmp/checkpass-negocio-followups/retirement-logs/13-neon-resources.log` |
| Formato de ficha, números y diff | Todos EXIT0 | `/private/tmp/checkpass-negocio-followups/retirement-logs/15-final-checks.log` |

```sh
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm --filter @mi-pasaporte/db typecheck
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/brand.test.ts src/modules/modules-boundary.test.ts src/modules/modules-boundary-literals.test.ts src/modules/modules-boundary-between.test.ts
NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/modules/negocio-retirement.neon.integration.test.ts --no-file-parallelism
NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/modules/resources.neon.integration.test.ts --no-file-parallelism
```

Cinco focos nuevos: activar POS no crea medios ni resucita archivados y conserva IDs/marcador; staff solo POS conserva selector sin tasas y cierra con core/flagOFF; cero histórico canónico sin cabecera se lee y ausencia/fuente ajena no fabrica cero; revisión/resultado legado aplicado3%=0.06 conserva IDs sin handler; pending con diagnóstico y claim sin resolver hacen fallar la precondición y el aplicador ausente no hace ACK ni altera el claim. La fixture aplicada nace aplicada y conserva su snapshot; las dos obligaciones nuevas permanecen no terminales hasta el teardown del comercio, no se maquillan como aplicadas.

Cambio semántico de tests autorizado: los dos archivos de migración/recuperación del **puente** dejan de ser tests del binario postdrain; sus oráculos DDL/ACK y evidencia permanecen versionados en e5eaa741. Los reemplazan los focos de rechazo/identidades/lectura anteriores. Resources conserva configuración/validación/tenant, congeladoA→B, parciales/ausencia, moneda, inmutabilidad, cero histórico y atomicidad de activación; el fixture llama `freezeSaleCommission` en la misma transacción de captura/publicación. Sus antiguas esperas de comisión pendiente/aplicación posterior cambian a resultado ya persistido y cero aplicaciones; módulo apagado ya no apaga comisión core. Referencia inválida ahora confirma resultado marcado, como pide0235, no rechazo comercial del cierre. Rollback DB técnico sigue cubierto por el oráculo existente de business-failures, que no se modifica; no se repitieron los13 financieros ni DDL completos por ceremonia.

Incidencias propias corregidas antes de congelar: primer typecheck encontró el import del aplicador retirado en Resources (01); tras adaptación, otro detectó `orderId` en vez de `posOrderId` en el nuevo fixture (03); ESLint detectó tx sin uso al retirar readiness (06). Se corrigieron fuentes, sin modificar guardias ni relajar asserts. Tipos04/11, lint09 y tests de retiro12 son la confirmación correspondiente.

Baseline de unitarios: `app/backoffice/business/page-guard.test.ts` ya contenía el literal `pos` en la base05863466 y provoca el único fallo de frontera de07. Coordinador lo verificó y asignó al worker CI mover sus cuatro casos completos al módulo, sin borrarlos ni tocar la guardia. No lo corrigió este worker ni se declara la selección verde; su aceptación se coteja al combinar esa corrección independiente. Sin build nuevo, verify global ni suites enteras; presupuesto0 mutaciones. Entrega condicionada y QA de combinación siguen siendo distintos de publicación PROD.

Fin de wrappers y teardowns confirmado al2026-10-17 01:51:03UTC; sin procesos propios de DB/servidor/túnel pendientes. Recurso CI notificado al coordinador para liberar. El único cambio posterior al código d4eda771 es esta ficha de entrega.
