---
fecha: 2026-08-10
resumen: Todo código de Mi Pasaporte se entrega con estándares operativos, de seguridad, pruebas y observabilidad de producción.
estado: aceptada
---

# ADR 0017 — Estándar de entrega production grade

## Decisión

Cada feature se construye para operar con usuarios y comercios reales desde su primera publicación, aunque el piloto tenga sólo dos bares. “Production grade” significa, como mínimo:

- autorización en servidor y separación de dominios de acceso;
- validación de entrada, secretos fuera del repositorio, rate limiting y auditoría;
- operaciones con valor idempotentes y transaccionales;
- manejo explícito de errores, estados de red y observabilidad;
- pruebas automatizadas que prueban el DoD, revisión independiente y CI verde;
- migraciones reversibles/seguras, backup verificable y despliegue reproducible;
- métricas de rendimiento para los flujos críticos, especialmente operación de staff.

## No significa

No se agregan sistemas complejos sin necesidad demostrada. La calidad se consigue con contratos claros, límites y verificación real, no con infraestructura prematura.

