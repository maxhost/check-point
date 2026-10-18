---
spec: 0242
fecha: 2026-10-18
estado: borrador
resumen: Rediseñar el ciclo completo de POS, integrar Mostrador, vender por peso y conectar premios emitidos en PWA como cupones, con autorización y rendimiento verificables.
disjunta: no; POS, catálogo, fidelización, acceso compartido, eventos, Stock/Recetas y analíticas
archivos: contratos y ámbitos por cerrar tras mapeo; sin implementación en esta etapa
---

# 0242 — POS unificado y venta por peso

Reserva documental del coordinador sobre dev `5f9cb2b2af49fa45850c059ef33f8bb69ea15172`.

Etapa autorizada: mapeo con agentes, comparación con el laboratorio, spec y plan de implementación. No se modifica producto ni se publica. La reserva se completa con evidencia de lectura y revisión independiente antes del handoff.

Fuente de producto: [registro de decisiones](../design-explorations/2026-10-18-mostrador/decisiones.html), prototipo v004 conservado.

Arquitectura prevista: [ADR0155](../adr/0155-pos-unificado-cantidades-y-cupones-de-premio.md). La mejora de carga compartida vigente es spec0238/ADR0154.

## Pendiente de la etapa de mapeo

Contratos HTTP exactos, matrices de migración/consumidores/seguridad, protocolo de rendimiento y plan por dos implementadores más QA. La conversión premio→cupón no se presume existente. Las políticas nuevas de vigencia/límite diario del cupón de premio se consultan al owner.
