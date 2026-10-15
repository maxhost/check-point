# P1 — QA documental de la ampliación financiera

Fecha: 2026-10-15. Candidato revisado: `faf7de09aa4c3b1e5c1ec5bdabf53a44afeb89a7`. QA independiente: agente `r1_qa`; coordinación registra su entrega sin modificar el informe documental anterior. **PASS documental; no certifica implementación ni pruebas de producto.**

Alcance: [SPEC0233](../specs/0233-medios-de-pago-y-comisiones.md) y [ADR0149](../adr/0149-pagos-y-comisiones-congelados-al-cierre.md), ampliados según las respuestas del owner: importes y descuento por línea en v2, reparto acumulado, destino preciso de gratis/2x1, origen reservado para P3 y normalización de todos los importes operativos, con originales exactos y ajustes auditables sin cambiar el cobrado aprobado.

QA detectó dos huecos y se corrigieron antes del PASS: orden de pagos estable que determina redondeo/fijo; originales y ajustes explícitos en DTOs HTTP de configuración/resultados de comisión. El candidato conserva las referencias de R1 y no implementa premios.

Evidencia: Node24.20.0; Prettier explícito con `--ignore-path /dev/null` sobre los dos archivos extraídos mediante `git show` (EXIT0); cuatro tablas y28 filas, enlaces locales y `git diff --check` (EXIT0). Hashes SHA256 de los documentos revisados:

- SPEC0233: `d2f8b773970a4327af73536f498470a0f962bfee064b537357557fc748582770`.
- ADR0149: `5fe66d5ae635e94e1ad73d8103e3567c762e3787d5f3073b44007316fb97d966`.

QA ejecutó un probe independiente Python/Fraction de14932 casos USD/COP globales y dirigidos, con dos/tres líneas, pesos0, cobertura total y empates: sumas G/D/N/A, límites0≤descuento≤bruto y originales exactos PASS. Coordinación comprobó489996 casos BigInt con los mismos invariantes. Son comprobaciones del algoritmo de diseño, no del producto futuro. Ambas verificaron COP10,40−0,60: G10, D1, A+1, N10; y COP0,60 con descuento total: G1, D1, N0, pagos[].

No se ejecutaron DB, migraciones ni pruebas de producto para esta revisión; checkout QA permaneció limpio en `42c7661b`. La implementación posterior requiere sus propias pruebas y QA. Validar precios según moneda en origen permanece como hallazgo fuera del encargo; no bloquea cierres ni se presenta como resuelto.
