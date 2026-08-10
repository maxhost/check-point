---
spec: 0007
fecha: 2026-08-09
estado: borrador
resumen: Muestra al dueño métricas de clientes, campañas, juegos, canjes, retorno y economía para decidir renovación.
disjunta: no
archivos: depende de eventos de 0001 y flujos de 0002–0006; rutas concretas por definir
---

# 0007 — Métricas valiosas para el negocio

## Problema

Un bar no puede juzgar el valor de una campaña por escaneos o partidas. Debe ver clientes identificados, visitas, uso de beneficios, retorno y, si cargó datos económicos, qué premios costaron y qué margen se atribuye. Un "embudo" solo es la secuencia de esos conteos; no es una métrica adicional obligatoria.

## Alcance

**Entra:**
- Tablero por local y campaña, visible solo al dueño.
- Filtro por fecha y campaña.
- Clientes identificados, nuevos y recurrentes; check-ins; compras acreditadas; puntos/oportunidades asignados; partidas; cupones emitidos, canjeados y vencidos.
- Rendimiento por campaña, juego, premio, día y franja horaria.
- Retorno: clientes que vuelven y vuelven a interactuar/canjear en 7 y 30 días.
- Desglose por premio: emitidos, canjeados, vencidos, coste declarado y coste real estimado de canjes.
- Margen bruto atribuido: precio menos coste de las compras acreditadas asociadas; separado de la estimación de coste de premios, solo cuando el negocio cargó esos datos.
- Exportación CSV de eventos de campaña para revisión del piloto.
- Pantalla de cierre: criterio explícito de renovación de USD 20/mes y notas del dueño.

**No entra:**
- Atribución causal, comparación estadística contra línea base, LTV, cohortes avanzadas, integración contable, benchmarks entre bares ni reportes de marcas.

## Diseño

Las métricas se derivan de eventos inmutables y de los importes guardados al momento de la acreditación/canje, no de precios editados después. Se presentan como "atribuido" o "estimado", nunca como ventas incrementales probadas.

## Archivos

| Archivo | Acción |
|---|---|
| Consultas/agregados de métricas de campaña | crear |
| Tablero y exportación CSV | crear |
| Formulario de cierre de piloto | crear |

### Disjunta?

No. Consume eventos y entidades de todas las specs anteriores; se ejecuta al final.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Eventos auditables | 0001 | Antes de esta spec |
| Flujos de check-in, crédito, juego y canje | 0004–0006 | Antes de esta spec |

## Verificación

- [ ] Eventos de prueba producen los totales esperados en el tablero.
- [ ] El CSV coincide con los eventos usados para el tablero.
- [ ] El dueño de un local no puede consultar métricas de otro.
- [ ] La pantalla identifica claramente las métricas como atribuidas/estimadas, no incrementales.

## Abierto

- El criterio exacto de renovación se fija antes de iniciar el piloto; la V1 lo captura, pero no decide por el dueño.
