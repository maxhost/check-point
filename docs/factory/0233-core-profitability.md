# P1 — entrega A: fundamento y Rentabilidad

Fecha: 2026-10-15. Base `3e0ee77f25f3e5447b14ca47d7ddf4bd1d0494ed`, reserva `p1-0233-core`, worktree `/private/tmp/checkpass-p1-implementation/p1-0233-core`. Sin push/PROD ni operaciones de la app local. Esta primera sección registra un **fundamento compilable**, no aceptación final de producto.

Contrato confirmado con B: `@mi-pasaporte/domain/financial` expone `ExactAmount`, `FinancialLine`, `FinancialSettlement`, `DiscountOrigin`, `FinancialError`, `minorUnitForCurrency`, `normalizeMoney`, `allocateCumulative`, `buildFinancialAmounts` y `buildFinancialSettlement`. Totales operativos planos; originales/ajustes exactos en racionales canónicos; líneas con `money`/origen y pagos en orden estable, incluyendo auditoría de entradas redondeadas a cero. El neto se determina por el original bruto menos el descuento autorizado, sin reevaluar cupones. B normaliza antes de la acreditación y aporta la decisión única de descuento.

Tablas públicas: core `paymentMethodCatalog`; POS `posPaymentMethods`, `posPaymentMethodInitializations`, `posOrderPayments`, `posOrders.settlement` y `posOrderItems.financialSnapshot`; Rentabilidad `profitabilityCommissionRevisions` y `profitabilityPaymentCommissions`. Builders privados conservan ownership en las entradas canónicas de sus módulos. Los tipos de JSON financiero se importan solo como tipos puros, sin dependencia runtime de DB hacia dominio. SQL0091 reordenado antes de aplicar: índices únicos compuestos preceden a sus FKs.

Framework: `onEnable(tx,{businessId})` transaccional solo apagado→encendido, y providers `ModuleResourceProvider`/`ModuleResource` bajo la transacción del consumidor. Directorio interno `listModuleResources`/`readModuleResources` permite metadata persistida con productor apagado. No introduce API pública ni permiso ajeno. Publisher acepta `settlement` y `paymentsMetadata` con proveedor explícito y captura recursos tipados+elegibilidad en una sentencia MVCC; sin snapshot mantiene v1 para el writer existente. Tipos y expansión legada de Recetas admiten campos comunes v1/v2.

Evidencia inicial: Node24.20.0, typecheck DB/domain/Merchant, ESLint focal y `git diff --check` EXIT0; 40/40 unitarios en cinco archivos (finanzas9, expansión legada5 y fronteras26). Incluye COP10,40−0,60→10−1+1=10, racional no terminante, origen ausente para base0, cuatro centavos/reparto acumulado, gratis por línea exacta, full cover neto0 y pagos cero auditados. La primera comprobación de tipos detectó el envelope discriminado usado por el expansor legado; se acotó a campos comunes. ESLint detectó una variable descartada sin uso; se corrigió sin cambiar semántica.

Pendientes de implementación A: seed/backfill protegido e invariantes append-only; configuración/revisiones y punteros de comisión; aplicador durable/reader/HTTP; validación financiera de envelopes, pruebas DB negativas y compatibilidad real R1/0230. No se ejecutó DB todavía ni se certifica publicación v2 POS, cuyo writer es B.

## Checkpoint de Rentabilidad y primer wrapper CI

El fundamento anterior es `729a39c42c92f2729f6751c7e980441c979e83a5`. En esta continuación se implementaron las rutas `commissions`, configuración optimista, revisiones/puntero atómicos, aplicador durable por pago y reader consistente. No importa ni consulta POS: usa metadata del directorio y el evento/revisión capturados. Ausencia de tarifa se congela; componentes presentes conservan su valor provisional; fijo original de otra moneda produce desconocido aunque su representación normalizada fuera cero. El reader mantiene positivo sin evento/apagado como sin dato y permite cero únicamente con evidencia financiera nueva.

SQL0092 siembra únicamente las12 entradas aprobadas, seis sugerencias EC y cinco base; Datalink opcional, sin Peigo ni tasas. Inicializa los POS ya activos una sola vez. Los cierres anteriores conservan `settlement=NULL`; no backfill monetario. Inmutabilidad de revisiones, resultados, pagos y snapshots admite borrar el comercio completo. No se modificó código ni flags de la app local.

Primer wrapper obligatorio, DB CI reservada, configuración seleccionada `/private/tmp/checkpass-specs/ci-selected.env`, Node24.20.0:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/resources.neon.integration.test.ts --no-file-parallelism
```

**9/9, EXIT0 y teardown completo**, sin skips: catálogo, permisos Rentabilidad sin POS, validación/tenant, revisión del cierre frente a edición posterior, replay idéntico, restricciones append-only, configuración ausente/parcial, moneda del fijo original, apagado/cero, fallback puntual, rollback completo de varios pagos y hook transaccional/idempotente. **El provider de metadata/cero de esta suite es un fixture inyectado**, no el servidor POS de B. Esa frontera real debe volver a medirse sobre el candidato combinado. Las pruebas no afirman que el fixture haya persistido una venta POS.

SQL aplicados a CI por ese wrapper y congelados desde entonces:

| Migración | SHA-256 |
| --- | --- |
| `0091_payment_methods_and_commissions.sql` | `dd3a6e24a7390aa28999ad03985b989837c698d4714fff25b8a1f354efc15a83` |
| `0092_payment_catalog_and_history.sql` | `0b2a223159935946c29109ae83c064abd3c2e52362b202c6cf3effbb2cd57b7f` |

Fallo de producto observado después del fundamento: el algoritmo conjunto de la primera versión de la spec redistribuía brutos ya alineados. Un test nuevo con dos líneas USD0,01/descuento0,01 falló exactamente con bruto0,02/0,00 contra0,01/0,01; los otros9 casos seguían pasando. Se corrigió según la aclaración técnica de SPEC0233/ADR0149 en `f311de4578f4ad26956e683778275ea6916b4409`: conservar brutos alineados y distribuir solo A; mantener algoritmo conjunto para fracciones. El caso vuelve a PASS con netos0/0,01, sin cambios de firma/neto aprobado. No se eliminó la evidencia del algoritmo anterior.

Unitarios actuales: **44/44** en seis archivos (finanzas10, comisiones5, decoder3 y fronteras26), más los5 de expansión legada que pasaron en el fundamento y no cambiaron. Incluyen fórmula USD9×2,5%+0,10→0,33 con original/delta racionales, parciales, fijo mayor al pago, cero/fijo incompatible y validación de payloads sin redistribuir. Tipos Merchant y ESLint focal: EXIT0. Los validadores runtime se conectaron después del primer wrapper; sus casos puros pasan, pero queda repetir la señal DB sobre la combinación final para cubrir el cableado y provider POS real. No se presenta el primer wrapper como aceptación final del SHA combinado.

DB CI liberada al terminar ese wrapper. Herramienta local `tools/payment-methods/index.ts preflight` informa solo conteos/huellas, país/lista, inicialización/Efectivo, cierres legados/nuevos, bandera de publicación y conservación Stock/R1/eventos. No activa la bandera ni modifica datos. Coordinación ejecutará el migrador y ese inventario con la configuración local protegida al finalizar; esta entrega no se atribuye sus mediciones.

Pendientes para combinación: adaptar fixture de cierre Stock/R1 a pagos explícitos cuando B esté integrado; probar productor/provider POS real y consumidores R1/0230 en v1/v2; negativos de integridad POS sobre la base combinada; QA independiente del candidato completo. No hay operaciones PROD ni push.

## Continuación sobre POS combinado: correcciones de QA y preparación DB

Base `553a9b4dfaffcdc76007286240facaafd0d75277`, con B integrado. Sin consultas DB: durante esta continuación CI pertenece a B. SQL0091/0092 permanecen congelados.

QA detectó que identidad/deltas coherentes no bastaban para validar un cobrado canónico: un original neto positivo podía disfrazarse de cero agregando un ajuste negativo. El validator ahora exige también `G=HALF_UP(G0)`, `D=HALF_UP(D0)` y `N=HALF_UP(N0)` en la orden; no impone redondeo individual a líneas repartidas. Dos casos unitarios nuevos rechazan ese cero ficticio y cambios de bruto/descuento con deltas coherentes. Se normalizan UUIDs de método/revisión esperada y venta/local (`trim`/minúsculas) en los bordes de Rentabilidad; el directorio conserva IDs genéricos opacos. El decoder también exige strings reales para proveedor/nombre de medio.

El fixture Stock-local inicializa medios explícitamente y usa `closeWithCash` de prueba, incluido el caso con pase. El test exige v2, importe/pago y referencia composition R1, sin introducir defaults de servidor. Se preparó `module-events.neon.integration.test.ts` con montaje separado en `module-events-integration-support.ts`: POS/provider reales, combo compartiendo insumo, tarifas/revisiones del cierre y valoración Stock separada; v1 legado; fallback cero y positivo sin evento con POS apagado y permiso Rentabilidad; mayúsculas UUID; negativos FK/archivo Efectivo/append-only y evento contradictorio. **Estos cinco casos DB están preparados, todavía no ejecutados en esta continuación.**

Evidencia sin DB: **46/46 unitarios** en los seis archivos focales (finanzas10, comisiones5, decoder5 y fronteras26); Merchant typecheck, ESLint de cambios y `git diff --check`: EXIT0. La extracción de helpers se comprobó con tipos/lint, sin mover oráculos a soporte. Pendiente ejecutar esa tanda real y los cuatro casos Stock-local cuando coordinación reasigne CI y continúe A sobre el cleanup final de B. El cleanup del caso con pase depende de B: sus nuevos pagos inmutables exigen cortar solo la referencia de prueba `posOrders.orderId` antes del cleanup core existente; no borrar pagos ni relajar SQL aplicado.
