# 0242 CP2c.3 — QA independiente de descuento exacto

Resultado: PASS de entrega pura y combinación sobre candidato congelado `c944b0e83d368852a2a73695100fc4029948f1bc`, que incorpora entrega corregida `af9797c9d13ae3fb55286c5a3477cdd57823a2c8`. Sin pendientes de producto observados dentro del scope. Base de autor `85047c9145fba561afa325bfaac71f0c3c20bfa0`; revisión independiente de protocolos, ficha, contrato0242 §1/3/4, diff, financial y helper/selector POS.

## FAIL inicial conservado y corrección

Sobre candidato inicial `56466b9221be64ea6f4a9832bac0010c8c0b9f01` (dev2078 + entrega `9c784b94fbc68fc7f011b8dc7f5e1639df7283d4`) se reprodujo independientemente un fallo de producto: `decideMeasuredBenefit` admitía porcentajes `10`/`100`, pero rechazaba `10.00`/`100.00` con `invalid_financial_input`. El snapshot `campaign_coupon.discount_value_snapshot` es numeric(12,2), representación válida real. Repro externo de cuatro casos: dos PASS y dos FAIL; no se aceptó esa entrega. Log íntegro conservado en `/private/tmp/checkpass-pos-0242/exact-benefit-qa-evidence/56466b9-padded-repro.log`.

La corrección admite padding decimal exclusivamente cero de una/dos posiciones para enteros1–100, extrae el entero con BigInt y sigue multiplicando el bruto racional original; rechaza fracciones no enteras/exponentes/signos/ceros iniciales/rango inválido. El mismo repro externo, sin cambios, pasa4/4 sobre `c944b0e`. El delta final se limita al helper, su regresión y handoff; el núcleo financial no cambia desde el candidato inicial. No se ocultó el fallo mediante retries/skips.

## Evidencia y aceptación

Runtime Node24.20.0/pnpm11.4.0, configuración temporal externa con entorno Node sin setup DB/env. Lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`. Logs QA en `/private/tmp/checkpass-pos-0242/exact-benefit-qa-evidence/`:

- `c944b0e-padded-repro.log`: comando `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/exact-benefit-qa-evidence/qa.config.mjs`, exit0,4/4; contiene100% de bruto mass no terminante con original net0/pagos[] y validación final vigente.
- `c944b0e-pure.log`: comando `pnpm exec vitest run --config /private/tmp/checkpass-pos-0242/exact-benefit-evidence/pure.config.mjs`, exit0,130/130 en seis archivos, sin skips/retries. Incluye financial legacy, measured-discount, financial-measures, measure-contract, measured-benefit y payment-financial-preview.
- `c944b0e-types.log`: comando `pnpm --filter @mi-pasaporte/db --filter @mi-pasaporte/domain --filter @mi-pasaporte/merchant typecheck`, exit0 en los tres proyectos integrados.
- `56466b9-pure.log` y `56466b9-types.log`:129/129 y tipos3 exit0 iniciales; no neutralizan ni sustituyen el FAIL inicial.

Los comandos se ejecutaron tras `source ~/.nvm/nvm.sh && nvm use`, desde el WT QA congelado. Config QA SHA256 `5f71566b5a4420dd7f6fc60df6cf29aac977a084bf411c6ac6e4317c86ea8d78`, repro SHA256 `dc8a98d5d3c8ac0d0794867ba1e6a5bfa31e984fb9b90bbf301f4e818179254e`; ambos externos al WT. Evidencia autor adicional revisada en `/private/tmp/checkpass-pos-0242/exact-benefit-evidence/manifest.json` y `final-*.log`, ligada a `af9797c9`: tipos3/lint/formato/UIguard/check-numbers/diff-check exit0. Evidencia9c anterior preservada en subdirectorio propio.

La inspección confirma FinancialInput legacy intacto y unión V2 amount/originalAmount exclusiva, con racional canónico reducido, escala2, denominador positivo, rango/origen coherentes. Se resuelve un único d0 y se conserva normalización/distribución/validador vigente. Los casos puros reproducidos cubren porcentaje completo/parcial, fixed menor/mayor y clamp, USD/COP, tiny/half-up, legacy equivalente, límites trusted, malformed exact/orígenes y settlement validado. No se modifica el validador para acomodar resultados.

Helper compartido puro sin imports servidor ni Number como autoridad monetaria. Porcentaje/fijo usan originales; fijo conserva moneda null legacy y rechaza moneda específica distinta. Gratis/2x1 reutilizan selectProductCouponLine: mass explícita409 sin fallback, mezcla permite UNIT elegible, cantidad>=2 para2x1, producto ausente conserva código; beneficio de una pieza del snapshot/sourceLineId correcto. Se verifican snapshots distintos del mismo producto, precio0, legado extremo y exclusión local null; custom/extras no descuentan ni ejecutan rule/grants.

## Límites y entrega

QA puro; sin DB/env/wrapper/browser/build/M0/M1/fullverify. No certifica activación HTTP, elegibilidad/fechas/límites/consumo de cupón, acreditación, cierre real, masa canónica o V4. Sin push/PROD, cambios de producto/tests/estados/índices, refs principales/ajenas ni subdelegación. Solo se escribe y commitea este informe reservado en la rama QA propia; factory/integración corresponden al coordinador. Cero checks/procesos propios activos al entregar.
