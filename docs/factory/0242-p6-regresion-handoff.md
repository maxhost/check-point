# 0242 P6A — handoff de regresión HTTP

Base `01445a86bdec433e8d7bc75b94dfca1ce8184c19`, WT/ref `pos-ui-card-0242`. Corte inicial6+2 y ampliación5 autorizada por coordinador/contrato `613fbf1f`. Sin producto, guards, esquema, migraciones ni despachador genérico editados.

## Estrategia e invariantes

- `pos` y `openOrder` originales conservan su comportamiento raw: ningún consumidor transitivo recibe cabeceras o traducción de bodies a escondidas.
- `capturePosScope` captura sesión nativa y negocio del caller una sola vez. `scopedPos` representa ese cookie/scope capturado; no recaptura durante reintentos ni toca el cuerpo.
- `openOrderV2` sólo construye fixtures positivas explícitas con UUID, note:null, cantidades string/unit y revisión comercial consultada. Las entradas negativas siguen explícitas/raw.
- `closeWithCash` adopta V2 sólo con cuarto argumento `{scope}` explícito. Neto0 conserva payments:[]. El default raw sigue intacto.
- Histórico se monta por SQL transaccional (`seedLegacyOrder`) con snapshots de productos del propio tenant y constraints vigentes. No se reabre writerHTTPV1. Lectores internos históricos mantienen los oráculos de tarifa/cantidad legacy, centavosCOP y ranking unitario.
- HTTPV1 ausente/1 pasa a409 upgrade antes de consumir body/escritores; se comprueba no efectos. Scope ausente/mismatch y401/403 conservan precedencia. DTOs exactos conservan allowlists actuales y se amplían detalle/línea/medida/membership/accrual.

## Matriz de conservación del corte

| Suite | Invariantes conservadas |
| --- | --- |
| measured-create | permisos/tenant/scope; idempotencia serial/concurrente y replay tras editar/cerrar/anular; precios0/legacy; mesa/local; rollback SQL real; lock comercial |
| measured-update | permisos/tenant/estado; V1 sin mutación; carrera de versión con DTO canónico; rollback de última línea; snapshots/fk borrada/extremos legacy; efectos |
| measured-read | scope/tenant; catálogo mínimo/tarifas; alias/tipo/mesa; histórico SQL/centavosCOP/currency snapshot; cupón/settlement; ranking/local/fecha |
| read-api-v2 | guards/módulo/scope; resúmenes/histórico/tenant; resolve inválido sin enrolar; DTO mínimo exacto; cupón seleccionado; V1 sin cargar catálogo/identidad |
| close-api-v2 | harness explícito con guard mock y sesión cookie nativa para scope; orden guard/scope/contrato/body; pago/evento/acreditación/after exactamente una vez; negativos y DTO |
| void-api-v2 | harness explícito con cookie/scope real; body opcional; JSON/versión inválidos; replay/evento uno; tenant y cerrada sin alterar pagos |
| extensión5 | escaleraauth, owner/staff/tenant, ajustes/pagos, locks mesaocupada/toggle, cuerpos V2 explícitos sin reparar negativos |

## Inventario transitivo exhaustivo

39 consumidores únicos de ambos soportes: seis iniciales +33 fuera del corte inicial. Cinco ya autorizados después; otros siete dinero/soporte indirecto en preparación. Los14 residuales/históricos están autorizados y preparados sólo en patches privados. “Compatible por lectura” no significa PASS ejecutado.

| Archivo real | Tratamiento |
| --- | --- |
| `apps/merchant/src/modules/analytics-an3-events.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/brand-fiscal-inert.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/negocio-retirement.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/business-access.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/business-failures.neon.integration.test.ts` | Requiere V2 por dependencia indirecta business-core-support.close; autorizado b6375774, en corte dinero |
| `apps/merchant/src/modules/pos/server/business-financial.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/business-sales-units.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/catalog-measure-storage.neon.integration.test.ts` | Ampliación futura necesaria: montaje histórico SQL/proyección interna, HTTP positivo V2 explícito; preservar DDL/hash/constraints, DDL aislado |
| `apps/merchant/src/modules/pos/server/catalog-storage-expand.neon.integration.test.ts` | Ampliación futura necesaria: montaje histórico SQL/proyección interna, HTTP positivo V2 explícito; preservar DDL/hash/constraints, DDL aislado |
| `apps/merchant/src/modules/pos/server/close-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/console-native.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/legacy-cutover.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/measured-create.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/measured-read.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/measured-summary.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/measured-update.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/order-intent-storage.neon.integration.test.ts` | Ampliación futura necesaria: montaje histórico SQL/proyección interna, HTTP positivo V2 explícito; preservar DDL/hash/constraints, DDL aislado |
| `apps/merchant/src/modules/pos/server/payment-methods.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-access.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-best-sellers.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-close-races.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-close-reuse.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-close.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-context-native.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/pos-disable-tables.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-disable.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-ladder.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/pos-migration-0079.neon.integration.test.ts` | Ampliación futura necesaria: montaje histórico SQL/proyección interna, HTTP positivo V2 explícito; preservar DDL/hash/constraints, DDL aislado |
| `apps/merchant/src/modules/pos/server/pos-orders.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/pos-scope.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/pos-staff-entry.neon.integration.test.ts` | Compatible por lectura: usa sólo seed/módulo o caller nativo/raw de cutover explícito; no cambiar por el soporte |
| `apps/merchant/src/modules/pos/server/quantity-storage-expand.neon.integration.test.ts` | Ampliación futura necesaria: montaje histórico SQL/proyección interna, HTTP positivo V2 explícito; preservar DDL/hash/constraints, DDL aislado |
| `apps/merchant/src/modules/pos/server/read-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/settlement.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/pos/server/ticket-settings.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |
| `apps/merchant/src/modules/pos/server/unit-expand-compat.neon.integration.test.ts` | Ampliación futura necesaria: montaje histórico SQL/proyección interna, HTTP positivo V2 explícito; preservar DDL/hash/constraints, DDL aislado |
| `apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts` | Corte inicial PASS DB en afe7060d |
| `apps/merchant/src/modules/stock-local.neon.integration.test.ts` | Ampliación futura necesaria: HTTP POS positivo/cierre obsoleto; V2 explícito y negativos intactos |
| `apps/merchant/src/modules/tables/server/tables.neon.integration.test.ts` | Ampliación5 PASS DB en afe7060d |

## Checks e intentos

- Runtime Node24.20.0/pnpm11.4.0 del lock existente. No Next/browser/DB/puerto ni accesoPROD.
- Intento preliminar seis: typecheck merchant FAIL por import seedLegacyOrder faltante y ESLint FAIL por cuatro imports pos sobrantes; corregidos.
- Segundo intento seis: `pnpm --filter @mi-pasaporte/merchant typecheck` PASS y ESLint focal8 PASS.
- Intento ampliación5: ESLint focal13 PASS; typecheck merchant FAIL por clave duplicada en fixture mesas; corregida. Tercer intento typecheck merchant PASS.
- Prettier focal ejecutado; diff whitespace limpio. Evidencia offline no certifica comportamiento DB. No skips/retries DB ejecutados.

## Resultado DB inicial congelado

`afe7060d`: wrapper CI seleccionado `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/{measured-create,measured-update,measured-read,read-api-v2,close-api-v2,void-api-v2,pos-access,pos-ladder,ticket-settings,payment-methods}.neon.integration.test.ts src/modules/tables/server/tables.neon.integration.test.ts --no-file-parallelism`.

EXIT0,11/11 suites,75/75 casos,0skips/0retries,616.03s. SHA limpio antes/durante/tras ejecución; migraciones CI idempotentes y teardown completos. Log privado `p6-first11-attempt1.log`. Dos SQL22012 son inyecciones esperadas con rollback probado; warning consumerURL ausente no aplica a estos casos. Ningún fallo DB en este intento.

## Pendiente

DB transferida explícitamente y reservada incluyendo teardown. Continuar sólo wrapper `tools/neon-test.sh` y selección privada existente, sin mostrar/copiar secretos. Siguiente corte autorizado cbbb8c83/b6375774: siete suites dinero y business-core-support (opt-in). Residual8 autorizado b1867cad e histórico6 cbbce442 siguen sólo patches privados hasta cerrar siguiente congelado. Registrar cada intento y congelar para QA NUEVO independiente. closeWithCash sólo unit legacy; no certificar masa con ese helper. No factory/estados/índices/push/PROD.
