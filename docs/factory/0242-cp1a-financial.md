# 0242 — Ficha preparada CP1a financial puro

Estado: preparada, **sin autorización de código hasta salida CP0/M0 aceptada**. Owner pidió entregables manejables y agentes nuevos con contexto limpio para el siguiente bloque. Esta ficha es contexto mínimo del nuevo implementador; no heredar historial de coordinación.

## Objetivo y entrada

Adoptar cantidades medidas en el cálculo financiero puro, reutilizando el reparto/normalización/pagos actuales. Mantener el comportamiento de `FinancialInput` legacy y añadir el input explícito `FinancialInputV2` de medidas. Los helpers CP0 aceptados son329c7917, QA7fc88bad sobre9d719476:53/53 pruebas. Base exacta/WT/reserva para esta entrega se fijan después de aceptar M0; no usar el SHA histórico como base nueva ni cambiar refs del checkout principal.

Lecturas pertinentes: AGENTS/protocolos, spec0242 §2.3/§3 y anexo §1/§4 (incluido compatibilidad legacy), esta ficha, `packages/domain/src/financial/{types,rational,settlement,validate}.ts`, helpers measures/legacy y evidencia CP0 propia. No necesita leer históricos de estado ni implementar catálogo/eventos/auth.

## Scope propuesto antes de reserva

- `packages/domain/src/financial.ts`
- `packages/domain/src/financial/types.ts`
- `packages/domain/src/financial/settlement.ts`
- `packages/domain/src/financial/validate.ts`, solo si hace falta preservar validación durable de salida
- `packages/domain/src/measures/types.ts`, solo ubicación/reexport del input v2 sin romper contrato aceptado
- `apps/merchant/src/server/financial.test.ts`
- `apps/merchant/src/modules/pos/financial-measures.test.ts` nuevo
- `docs/factory/0242-cp1a-financial-handoff.md` propio

Fuera: schema/migraciones/DB, endpoints/UI/POSclose/auth/cupones de negocio/eventos/stock/analytics, kit/guardias/tooling/config/deps. Ningún writer mass/V4 ni cambio operativo en esta entrega. No subdelegar. Coordinador reserva y mantiene estados/índices; autor entrega commit propio limpio y evidencia, QA independiente revisa candidato congelado.

## Contrato y aceptación

Conservar exports actuales buildFinancialAmounts/buildFinancialSettlement y un solo algoritmo de reparto/normalización. Entrada medida exige quantity decimal string y measure explícita; no inferir masa por string ni aceptar una captura fraccional como piezas legacy. Reutilizar factores exactos y fuentes confiables de snapshots unit legacy12,2/INT32 mediante adaptadores separados; la permisividad legacy no se convierte en permiso de entrada HTTP nueva. No duplicar aritmética UI/servidor ni modificar payload de settlements durables ya guardados.

Gross originales racionales antes de minorUnit0/2; tarifa/masa no se redondean antes del total. Preservar sourceLineId/position, asignación de descuentos por orden/línea, originales/ajustes, suma de pagos, medios duplicados, neto0 con payments=[] y validación durable de salida. Rechazar overflow monetario por línea/agregado y después de normalización antes de persistencia. Casos inválidos conservan errores compatibles donde ya había contrato, con errores de medida/rango explícitos cuando corresponda.

Pruebas decisivas: ejemplos1lb=453,59237g,4/lb×2lb=8 y0,01/g×250g=2,50; conversiones equivalentes y cociente no terminante; mezclaunit/mass sin perder dinero; tarifa9dec y subcentavo; total0/monedas0y2; reparto que cierra exactamente; límites/overflow/exponente/medida incoherente; snapshotslegacy extremos válidos sin ampliar parsernuevo. Comparar salida unit legacy existente con su equivalente v2 sobre casos reales del settlement, no copiar el algoritmo como oráculo. Validar salidas con assertFinancialSettlement. Gratis/2x1mass excluidos por contrato de negocio ya cerrado; esta ficha no añade otro cálculo de cupones.

Checks: Node24, Vitest focal financial existente+medido+regresiónCP0 afectada, types domain/merchant, lint/format/diff pertinentes. Sin Neon por cálculo puro. QA reutiliza evidencia compatible y reproduce señal decisiva en candidato congelado; no verify global por ceremonia. Registrar SHA/base/runtime/config/lock, comando exacto, intentos fallidos/skips y límites. Siguiente bloque nuevo y contexto limpio después de aceptación.
