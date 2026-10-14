---
spec: NNNN
fecha: YYYY-MM-DD
estado: borrador | cerrada | implementada
resumen: Resultado observable y motivo.
disjunta: si | no; paths y dependencias semanticas
archivos: ambitos previstos
---

# NNNN — Titulo

ADR0144; politica docs/VERIFICACION.md. Para cambios transversales/criticos; arquitectura/migraciones/compatibilidad pertinentes.

## Problema

Comportamiento actual/esperado, evidencia pertinente.

## Alcance y diseño

Entra/fuera; contratos/entradas/salidas/errores, permisos y dependencias. Decisiones de producto cerradas; detalles rutinarios a cargo del implementador. Arquitectura/ADRs aplicables.

## Archivos y paralelismo

Ambitos, consumidores y recursos comunes; responsable de cada pieza. Paths disjuntos no bastan si contrato/esquema/DBcompartidos. Base/worktree/puertos/reservas en la ficha operativa, no campos volatiles de esta spec.

## Definition of Done

- [ ] Resultado observable de producto.
- [ ] Aceptacion de tarea y de combinacion comprobadas segun riesgo.

## Pruebas pertinentes

Casos/comandos/capa que detectan defecto plausible; aprovechar cobertura existente. Sin verify global, snapshots, mutaciones o revisor extra obligatorio por cada feature. Gatefinal segun riesgo del candidato/release. Mutaciones solo si justificadas y restauradas con protocolo.

## Handoff y abierto

SHA/base, criterios/evidencia, resultados y limites. Falla dentro del alcance vuelve a correccion sin specnueva; cambio material vuelve a acuerdo/spec. Nada bloqueante puede quedar en speccerrada. Coordinador marca implementada trasQA pertinente.
