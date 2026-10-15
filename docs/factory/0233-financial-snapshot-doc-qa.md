# P1 — QA documental de la ampliación financiera

Fecha: 2026-10-15. Candidato revisado: `faf7de09aa4c3b1e5c1ec5bdabf53a44afeb89a7`. QA independiente: agente `r1_qa`; coordinación registra su entrega sin modificar el informe documental anterior. **PASS documental; no certifica implementación ni pruebas de producto.**

Alcance: [SPEC0233](../specs/0233-medios-de-pago-y-comisiones.md) y [ADR0149](../adr/0149-pagos-y-comisiones-congelados-al-cierre.md), ampliados según las respuestas del owner: importes y descuento por línea en v2, reparto acumulado, destino preciso de gratis/2x1, origen reservado para P3 y normalización de todos los importes operativos, con originales exactos y ajustes auditables sin cambiar el cobrado aprobado.

QA detectó dos huecos y se corrigieron antes del PASS: orden de pagos estable que determina redondeo/fijo; originales y ajustes explícitos en DTOs HTTP de configuración/resultados de comisión. El candidato conserva las referencias de R1 y no implementa premios.

Evidencia: Node24.20.0; Prettier explícito con `--ignore-path /dev/null` sobre los dos archivos extraídos mediante `git show` (EXIT0); cuatro tablas y28 filas, enlaces locales y `git diff --check` (EXIT0). Hashes SHA256 de los documentos revisados:

- SPEC0233: `d2f8b773970a4327af73536f498470a0f962bfee064b537357557fc748582770`.
- ADR0149: `5fe66d5ae635e94e1ad73d8103e3567c762e3787d5f3073b44007316fb97d966`.

QA ejecutó un probe independiente Python/Fraction de14932 casos USD/COP globales y dirigidos, con dos/tres líneas, pesos0, cobertura total y empates: sumas G/D/N/A, límites0≤descuento≤bruto y originales exactos PASS. Coordinación comprobó489996 casos BigInt con los mismos invariantes. Son comprobaciones del algoritmo de diseño, no del producto futuro. Ambas verificaron COP10,40−0,60: G10, D1, A+1, N10; y COP0,60 con descuento total: G1, D1, N0, pagos[].

No se ejecutaron DB, migraciones ni pruebas de producto para esta revisión; checkout QA permaneció limpio en `42c7661b`. La implementación posterior requiere sus propias pruebas y QA. Validar precios según moneda en origen permanece como hallazgo fuera del encargo; no bloquea cierres ni se presenta como resuelto.

## Corrección técnica durante implementación

La revisión posterior encontró un defecto del algoritmo documentado: el reparto conjunto podía redistribuir brutos ya normalizados. Coordinación lo midió sobre el helper real congelado `729a39c4`: USD dos líneas0,01 con descuento0,01 daban brutos0,02/0 y netos0,01/0; cuatro líneas0,01 con descuento0,02 daban brutos0,02/0/0,02/0. Los totales y límites previos pasaban, pero el oráculo no exigía conservar cada bruto ya alineado. El implementador reprodujo un test nuevo FAIL sobre ese caso antes de corregirlo; los otros nueve unitarios financieros pasaban. No fue una mutación ni se relajó el test.

Aplicando la regla general de normalización ya aprobada, se corrigieron SPEC/ADR sin nueva decisión de producto: si todos los brutos originales son múltiplos de minorUnit, conservarlos; descontar las cuotas acumuladas y distribuir solo A, que en esa rama es0 o1, sobre pesos restantes. La rama general fraccionaria conserva la fórmula conjunta. No cambia el cobrado aprobado, firmas, límites de descuento ni conservación de originales/deltas. Las cuotas racionales siguen auditadas aunque A=0.

QA independiente verificó matemáticamente **152500 casos** Python/Fraction USD/COP globales/dirigidos con tres líneas, ceros, cobertura total y empates: bruto por línea conservado,0≤descuento≤bruto, netos no negativos, sumas G/D/N/A y A∈{0,1} PASS, sin contraejemplos. Con pesos enteros y D≤G, una diferencia de prefijos no supera la longitud entera de su línea; si no hay pesos restantes, N=A=0. Sin DB ni edición de producto.

**PASS documental focal** sobre `f311de4578f4ad26956e683778275ea6916b4409`: SPEC0233 y ADR0149 alineados con la corrección, ejemplos de dos/cuatro líneas y prueba11 actualizados. Prettier forzado2/2, cuatro tablas/28 filas, enlaces y diff-check PASS; checkout QA intacto `3e0ee77f`. Hashes nuevos:

- SPEC0233: `cb3d6f6a638c816301eec3741c410ac21cec1d19b2b6418af85861f2f6cd4c5b`.
- ADR0149: `fed2193008f85e753b99cbf0ddea8682573332f30deac9216c825419c66787a3`.

El probe anterior de coordinación sobre el helper real729 había pasado12172 casos y716 listas de pagos para sumas/límites/deltas/ceros; no incluía este oráculo de idempotencia y no certifica la versión corregida. Ambos resultados se conservan con su alcance real. Aún requiere pruebas de producto y QA de la implementación final.
