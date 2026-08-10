---
spec: 0003
fecha: 2026-08-09
estado: borrador
resumen: El dueño configura una campaña de ruleta y el sistema evita una economía declarada a pérdida.
disjunta: no
archivos: depende de 0001 y 0002; rutas concretas por definir
---

# 0003 — Wizard de campaña y guardrails económicos

## Problema

Una campaña configurable sin reglas económicas puede convertirse en un descuento aleatorio dañino. El dueño necesita decidir qué conducta busca, qué mecanismo usará y ver las consecuencias antes de activarla.

## Alcance

**Entra:**
- Una campaña por negocio, asignada a uno, varios o todos sus locales, en estado borrador, activa, pausada o finalizada.
- Tipo de campaña: promoción de marketing o evento. Un evento es una campaña, no una entidad independiente.
- Objetivo declarado: segunda bebida, comida tras bebida, combo, retorno futuro, visibilidad o experiencia en local.
- Mecánica elegida: asignación directa de beneficio o ruleta. Las mecánicas no implementadas aparecen deshabilitadas.
- Disparador opcional: check-in, compra acreditada de un producto/categoría o asignación manual por personal; cantidad de oportunidades, puntos o cupones que genera.
- Premios configurables: descuento porcentual, descuento fijo, 2x1 o producto gratis; cada uno con producto objetivo, coste, valor, probabilidad cuando sea juego, cupo y vigencia.
- Horario y fechas de campaña.
- Cálculos visibles: margen bruto del producto, coste esperado por oportunidad y coste máximo posible por cupos.
- Bloqueo de activación si un premio gratuito, 2x1 o descuento puede dejar margen bruto negativo según los datos declarados.

**No entra:**
- IA, A/B testing automático, recomendación basada en histórico, segmentación individual, reglas de inventario ni campañas combinadas entre locales.

## Diseño

El wizard guía en orden: objetivo -> mecánica -> disparador -> producto objetivo -> premios -> probabilidades/cupos cuando aplique -> horario -> resumen económico. Las probabilidades de una ruleta deben sumar 100%. El cálculo es una estimación y lo declara expresamente; el sistema no infiere costes faltantes ni permite activar premios sin datos económicos completos.

Una campaña conserva su definición a nivel negocio. Sus locales operativos son los locales asignados que siguen `active`; si ninguno queda activo, se pausa con la razón `no_active_locations`, sin eliminar campaña ni beneficios emitidos.

## Archivos

| Archivo | Acción |
|---|---|
| Modelo de campaña, disparador y premio | crear |
| Motor determinista de validación económica | crear |
| Wizard y resumen de activación para dueño | crear |

### Disjunta?

No. Depende del catálogo de 0002, se rige por ADR 0006 y define contrato de 0005/0006.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Productos y roles | 0001–0002 | Antes de esta spec |

## Verificación

- [ ] Una campaña válida se activa y queda visible para operación.
- [ ] Una probabilidad distinta de 100% no se puede activar.
- [ ] Un premio que deja margen bruto negativo bloquea activación y explica por qué.
- [ ] Un premio agotado o fuera de horario no puede emitirse.

## Abierto

- Definir si el margen mínimo aceptable inicial será 0% o un porcentaje configurable; V1 propone 0% para no imponer una política comercial al bar.
