# 0242 CP1a — QA independiente financial puro

**PASS de entrega y combinación focal** sobre candidato congelado `9587c002c19a62e26d715a4d028e6374d8865147`, revisado en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, inicialmente limpio. Base de implementación `00efff814a1939b25006af36c7dbfb04758f3256`; código `7e13808d2f17cdbef75e95c58670c08ef0c525fa`, entrega documental `e9d409ac23d9e712d08ffae475a375b09c913571`. La combinación añade documentación del coordinador; el diff entrega→candidato no cambia producto, tests, lock ni configuración.

## Revisión y aceptación

Se contrastaron ficha, spec0242 §2.3/§3, anexo §1/§4 y diff financiero con los helpers CP0 aceptados. No se identificó fallo concreto en el alcance asignado.

- Los builders conservan un núcleo de reparto, normalización y pagos. V2 obtiene originales racionales mediante factores exactos, sin redondear cantidad/tarifa antes de agregar. La salida durable conserva su forma, identidad/posición, originales y ajustes.
- La presencia de `measure` selecciona validación medida incluso si su valor es inválido; no habilita fallback legacy. Una cantidad string sin medida falla en el camino legacy. Los wrappers de snapshots son explícitos: unit usa adaptadores históricos separados; mass mantiene límites nuevos. El tipo V2 tiene una sola declaración y reexports compatibles.
- Legacy mantiene safeInteger y el parser de precio anterior, sin imponer INT32; solo se acota el dinero resultante para persistencia. Se inspeccionaron los límites de originales por línea/agregado/descuento, de total normalizado para minorUnit0/2, de asignaciones por línea y de pagos. El validador durable verifica también rangos operativos y originales sin redistribuir históricos.
- Casos decisivos reproducidos: lb/g y originales exactos, 4/lb×2lb=8, 0.01/g×250g=2.50, conversiones equivalentes y cociente no terminante; tarifa9dec/subcentavo; mezcla unit/mass, orden estable y descuentos por orden/línea; moneda0/2; neto0 con payments=[]; pagos auditados/duplicados/suma; overflow original/agregado/normalizado; medida incoherente y exponentes; extremos snapshots12,2/INT32 sin ampliar captura ni mass. Equivalencia legacy/V2 compara settlements completos con descuento ausente/orden/línea en USD/COP y valida salida durable.

## Evidencia independiente

Node `v24.20.0`, Vitest `4.0.18`; prefijo de ejecución `source ~/.nvm/nvm.sh && nvm use &&`. Lock heredado sin cambios, blob `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`. Configuración raíz/merchant y setup fake IA heredados, sin cambios.

Desde la raíz del WT:

```sh
pnpm exec vitest run apps/merchant/src/server/financial.test.ts apps/merchant/src/modules/pos/financial-measures.test.ts apps/merchant/src/modules/pos/measure-contract.test.ts apps/merchant/src/server/module-events/decode.test.ts
pnpm --filter @mi-pasaporte/merchant typecheck
git diff --check
```

Todos EXIT0. Vitest: **88/88 pruebas, 4/4 archivos, 0 skips/retries**, duración718ms; financial12, medido28, CP0 medidas43, decode durable5. Merchant typecheck final incluye los últimos casos de test añadidos después del typecheck del autor. Se reutilizan typecheck domain, ESLint y Prettier del autor: producto/lock/config idénticos y lint/formato del autor ya incluyen esos casos finales. No se repitió batería global.

No hubo prueba fallida ni reintento en esta QA. Una consulta auxiliar buscó `.husky/pre-commit`, inexistente (rg EXIT2); no fue un check del producto ni se omitió ningún gate por ello. Las corridas incrementales80/82 del autor permanecen documentadas en su handoff, sin convertirlas en corridas QA adicionales.

## Alcance y límites

Este PASS permite aceptar CP1a financial puro y su combinación documental congelada. No certifica adopción HTTP/POS, auth, cupones de negocio, DB/migraciones, UI, eventos V4 productores, stock, analytics ni siguientes checkpoints. No se ejecutó DB/Neon, build global, servidor, push ni operación PROD. QA no modificó producto ni refs; único archivo propio: este informe. Sin procesos persistentes propios. Aceptación/integración queda al coordinador; siguiente bloque requiere QA nuevo según asignación.
