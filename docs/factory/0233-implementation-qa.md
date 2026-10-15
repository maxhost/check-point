# P1 — QA independiente de implementación y combinación

Fecha:2026-10-15. **PASS sobre `3450607ae6b9eb4ac0de4ea40be8d117108926c5`**. Base de encargo `3e0ee77f25f3e5447b14ca47d7ddf4bd1d0494ed`; entregas finales A `b955bcad`, B `fe149b27`. Fuentes: [SPEC0233](../specs/0233-medios-de-pago-y-comisiones.md), [ADR0149](../adr/0149-pagos-y-comisiones-congelados-al-cierre.md), [contrato](0233-implementation-contract.md) y [QA documental](0233-financial-snapshot-doc-qa.md).

QA no escribió ni corrigió el código certificado. Único archivo de entrega: este informe. Cero mutaciones de código, sin subdelegación, verify global, push ni operaciones PROD. El owner ya autorizó integrar P1 en main local después de QA; aceptación y promoción corresponden al coordinador.

## Identidad y alcance de la evidencia

Checkout QA: `/private/tmp/checkpass-p1-implementation/p1-0233-qa`, limpio al iniciar. Se revisó primero el producto `f58fac8961b78ec05d1881ebe2f81d524a6a2de5`, y después se comprobó el diff hasta el candidato final: únicamente dos filtros `subscriberId=recipes` en soporte de pruebas Stock-local y handoffs A/B. No cambió producción financiera, publisher/decoder, Rentabilidad, providers, POS ni impresión. Los filtros evitan tomar arbitrariamente otro delivery de un evento con dos suscriptores y no debilitan las aserciones de consumo.

QA ejecutó53 unitarios y tipos Merchant sobre `f58fac89`, reutilizados por esa identidad; el build y comprobaciones finales se ejecutaron sobre `3450607a`. También se verificó diff vacío de los archivos del selector entre el árbol browser B `120292e2` y el candidato final. La nueva impresión fue comprobada separadamente con sus unitarios.

Runtime Node `24.20.0`, activado mediante `source ~/.nvm/nvm.sh && nvm use`. Lockfile SHA256 `a63b2a852e32abcd70ae19f57c8784524f56037d91447a42ca71ba08b7f0cce0`. SQL congelados, iguales en entregas/CI/local:

| Migración                                  | SHA256 comprobado por QA                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `0091_payment_methods_and_commissions.sql` | `dd3a6e24a7390aa28999ad03985b989837c698d4714fff25b8a1f354efc15a83` |
| `0092_payment_catalog_and_history.sql`     | `0b2a223159935946c29109ae83c064abd3c2e52362b202c6cf3effbb2cd57b7f` |

## Comprobaciones independientes

Comando focal ejecutado desde QA, sin DB:

```sh
pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/financial.test.ts src/server/module-events/decode.test.ts src/modules/profitability/commission-arithmetic.test.ts src/modules/pos/server/payment-resources.test.ts src/modules/pos/ui/pos-payment-financial-preview.test.ts src/modules/pos/ui/printing/ticket/build.test.ts src/modules/pos/ui/printing/escpos/encode.test.ts src/modules/pos/ui/printing/index.test.ts
```

**53/53 PASS**, ocho archivos, EXIT0: finanzas10, decoder5, comisión5, provider5, preview3, documento de ticket9, ESC-POS8 y transporte8. Sin skips ni retries. Incluye preservación de brutos alineados, originales/deltas racionales, reparto global/dirigido, pagos0 auditados, COP10,40−0,60→10−1+1=10, comisión porcentual/fija/mixta, faltantes y moneda, cero falso rechazado y ticket normalizado.

Otros checks QA:

- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0 sobre `f58fac89`, producción idéntica al final.
- `pnpm --filter @mi-pasaporte/merchant build`: EXIT0 sobre `3450607a`; Next16.3.0 compiló, verificó tipos y generó36 páginas. Único build focal. Next regeneró las dos referencias de `next-env.d.ts` hacia `.next/types`; se repusieron exactamente sus bytes HEAD, sin reset ni cambios entregados de producto.
- `node tools/check-numbers.ts`: EXIT0, sin duplicados; warning de Node `MODULE_TYPELESS_PACKAGE_JSON` del script, sin modificar tooling.
- `git diff --check 3e0ee77f HEAD`: EXIT0. Hashes SQL/lockfile y diffs de identidad verificados antes de escribir el informe.
- QA revisó código de cobro, decisión única del cupón/origen, persistencia, publicación/decoder, directorio, reader/aplicador y proyección de recibos. La validación de totales no redistribuye líneas históricas; los recursos de receta/composición sobreviven al envelope v2.

## DB reutilizada por identidad, con oráculos revisados

QA no ejecutó DB adicional: los autores tuvieron CI en turnos exclusivos y completaron teardown. Se revisaron sus [entregas A](0233-core-profitability.md) y [B](0233-pos.md), comandos, límites, fallos y oráculos sobre las fuentes combinadas. Solo wrapper protegido `tools/neon-test.sh` con `NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env`, sin usar ni imprimir credenciales PROD.

**A:9/9 DB reales**, dos archivos, EXIT0 y148,61s, sin skips, retries de suite ni teardown pendiente:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/module-events.neon.integration.test.ts src/modules/stock-local.neon.integration.test.ts --no-file-parallelism
```

Los cinco casos nuevos usan POS/provider reales: combo v2 con procedencia/cantidades R1 congeladas, costo12,00 valorado al aplicar y comisión0,55 con tarifa del cierre; editar receta/tarifa/promedio después no cambia esa venta. V1 conserva receta/costo3,50 sin comisión inventada. Neto0 sin evento se lee con POS apagado y permiso propio Rentabilidad; positivo sin evento queda sin dato. UUID canónicos, tenant/FKs cruzadas, Efectivo, append-only y cero contradictorio tienen negativos reales. Los cuatro Stock-local conservan cierre/acreditación, consumo/retry, mesa libre ante fallo y módulos apagados. El caso más lento pasó en27,05s bajo el límite original30s, sin ampliarlo.

**B:38 casos DB distintos aprobados por evidencia compatible**, sin contar repeticiones:37 casos previos intactos más corrección focal del DTO; además se repitieron COP y cero por los cambios materiales de reader/provider. Tanda original protegida:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/pos/server/payment-methods.neon.integration.test.ts src/modules/pos/server/settlement.neon.integration.test.ts src/modules/pos/server/pos-close.neon.integration.test.ts src/modules/pos/server/pos-close-races.neon.integration.test.ts src/modules/pos/server/pos-close-reuse.neon.integration.test.ts src/modules/pos/server/pos-orders.neon.integration.test.ts src/modules/pos/server/pos-access.neon.integration.test.ts src/modules/brand-fiscal-inert.neon.integration.test.ts --no-file-parallelism
```

Esa corrida fue37/38, **no se registra como EXIT0 global**: el DTO exacto anterior no incluía los campos nuevos. Se corrigió el oráculo manteniendo igualdad exacta y null explícito en abierta. Focal posterior sobre `f58fac89`:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-specs/ci-selected.env tools/neon-test.sh src/modules/pos/server/pos-orders.neon.integration.test.ts src/modules/pos/server/settlement.neon.integration.test.ts --no-file-parallelism -t 'la forma de|COP10.40|neto0 usa'
```

**3/3 seleccionados PASS**,41,74s, EXIT0 y teardown completo. Los12 casos no seleccionados de ese comando no se cuentan como PASS nuevo. Se confirma cierre positivo con medio/suma y rollback de errores, descuentos/acreditación iguales, COP con bruto10/descuento1/neto10/100puntos, destino gratis exacto en líneas repetidas y cantidad física intacta, pagos cero solo auditados, UUID, archivo/Efectivo, país fallback/seed y tenant/permisos. Logs B privados: `/private/tmp/checkpass-p1-pos-db-final.log` y `...-focused.log`.

Los nueve DB iniciales A con provider inyectado complementan configuración parcial/ausente, fórmula, moneda del fijo original, congelación, rollback multi-pago y lifecycle; **no se presentan como provider POS real**, ni se suman sus ejecuciones repetidas. Ese límite se cerró con los cinco casos reales nuevos. Tipos DB/domain, lint, fronteras y guardia UI de autores se reutilizan por identidad y scope; los unitarios solapados no se suman a los53 QA.

## Browser y visual

Selector mínimo revisado conforme al kit/impeccable acordado, sin rediseño. Se reutilizan **8/8 browser** B, workers1/retries0, con hook/checkout reales y transporte mock: selector/payload390/1280, cupón/COP, neto0, quitar cliente, excluir100%, cambiar destino e intento incierto. Comando: `pnpm exec playwright test --config /private/tmp/checkpass-p1-pos-playwright.config.cjs`.

Regresión POS/impresión B:117/118 iniciales y1/1 focal corregido; no se afirma que la corrida inicial haya pasado completa. El único oráculo obsoleto esperaba body sin payments; se mantuvo comparación exacta agregando pago efectivo20,00. Son118 casos distintos, sin sumar el reintento como caso nuevo. Logs y configuración temporal están identificados en la entrega B.

QA inspeccionó las dos capturas existentes390/1280 del selector: controles/etiquetas caben, sin desbordes visibles, conservan kit y copy genérico, sin comisiones/racionales en cobro. Se revisó la identidad de la UI capturada; no se volvió a lanzar un harness ni se convierte una captura en aserción de comportamiento. Las rutas de ambos PNG están en la entrega B. Harness/browser no equivalen al smoke de app real siguiente.

## Hallazgos materiales y correcciones

1. **Transiciones del selector:** QA detectó que quitar cliente borraba medios conservando validated=true, y que excluir cupón100% podía dejar cobro positivo sin medios. B conserva selección válida/invalida revisión y vuelve a preparar; browser cubre ambos recorridos y cambio de destino gratis.
2. **Brutos alineados:** el algoritmo escrito inicialmente redistribuía bruto entre líneas USD ya normalizadas. Coordinación lo detectó y A reprodujo FAIL real. La rama corregida conserva cada bruto alineado, descuenta acumuladamente y reparte solo A; los casos fraccionarios conservan la rama conjunta. QA validó152.500 casos matemáticos exactos y dio nuevo PASS documental en `f311de45`; esos probes son evidencia de diseño, no una batería de producto adicional.
3. **Cero falso:** QA reprodujo en `553a9b4d` un settlement con original neto10 y cobrado0, ajuste−10/deltas coherentes, aceptado indebidamente. Se archivó el helper y se probó sin DB ni mutar código. `8172fba4` exige HALF_UP de originales en G/D/N de orden; el mismo probe acepta válido y rechaza el cero incompatible. Unitarios y negativos reales de decoder/provider/reader cubren el fix final.
4. **UUID de Rentabilidad:** IDs/revisión esperada en mayúsculas/espacios pasaban isUuid pero fallaban comparaciones textuales con providers canónicos. Se normalizan en bordes; prueba real cubre configuración y fallback.
5. **Proyección COP:** A/B detectaron bruto reconstruido10,60 desde neto acreditado10 más descuento original0,60. Reader y tickets usan snapshot operativo G10/D1/A1/N10; legado sin snapshot mantiene su lectura. QA verificó proyección/código e impresión; focal CI confirma los valores persistidos/acreditados.

Los fallos de fixture/cleanup, sandbox Chromium, localizadores y DTO/browser anteriores están conservados en los handoffs. No se relajaron SQL ni guardias para esconderlos. Ninguno queda abierto en el candidato final.

## App local, migración y límites

Evidencia del coordinador en [0233-local-integration.md](0233-local-integration.md), separada de CI: backup privado, writers drenados, migrador protegido hasta0092/93 entradas y hashes SQL iguales. Se inicializaron dos POS activos con lista base; catálogo12 entradas/11 sugeridas, sin Peigo/tasas ni backfill de los siete cierres anteriores. Huellas conservan27 movimientos,2 mappings R1,7 cierres históricos y0 eventos v1.

Coordinación repitió preflight/deepEqual sobre el código final `3450607a`; artefacto privado `/private/tmp/checkpass-p1-local/final-preflight.json`, sin faltantes de inicialización/Efectivo, journal93 y mismas huellas. Health Merchant/Consumer por túnel HTTP200. Smoke autenticado real anterior comprobó login/verify y GET medios/catálogo200, sin cookie401 y sign-out200, con owner ficticio/proveedor console, sin cerrar una venta ni enviar mensajes externos. No se atribuye al smoke la validación financiera que se hizo en CI.

**Publicación local sigue apagada** (`MODULE_EVENTS_ENABLED=false`), conservada por el rollout: ventas positivas sin evento permanecen sin dato de comisión, nunca0. El PASS valida el comportamiento y el snapshot POS aun con esa bandera; no afirma activación operativa de comisiones positivas locales. No se ejecutó PROD, push ni cambio de bandera por inferencia.

## Cierre

No quedan bloqueantes P1 encontrados sobre el SHA identificado. Sin procesos/checks QA activos, sin DB tomada por QA y sin archivos de producto pendientes. La única escritura entregada es este informe, formateado explícitamente con `--ignore-path /dev/null`. La sesión local del coordinador permanece fuera de este checkout.

PASS de implementación/combinación con la evidencia y límites anteriores. Aceptación factory, actualización de spec e integración en main local corresponden al coordinador bajo la autorización ya recibida. No incluye P3/canjes, Smart Menu, pagos reales de un procesador, fiscalidad nueva ni validación de precios por moneda en origen.
