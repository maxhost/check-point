---
spec: 0005
fecha: 2026-08-09
estado: borrador
resumen: El personal escanea al consumidor para asignar y validar beneficios sin interrumpir el servicio.
disjunta: no
archivos: depende de 0001, 0002, 0003 y 0004; rutas concretas por definir
---

# 0005 — App operativa: asignación y validación

## Problema

El negocio necesita una app web rápida para reconocer al consumidor, asignar los beneficios que su programa permite y validar los que canjea. En V1 no habrá POS; la compra acreditada es una de varias acciones operativas.

## Alcance

**Entra:**
- Consola web móvil para rol `staff`.
- Escaneo del QR dinámico del consumidor y alternativa de búsqueda por nombre/teléfono enmascarado.
- Selección de una acción permitida por campaña: acreditar compra, asignar puntos, oportunidad, premio o cupón.
- Emisión del beneficio según la campaña activa y confirmación visible al personal y consumidor.
- Validación de cupones desde la misma app.
- Historial del turno: asignaciones y canjes realizados por ese miembro del personal.
- Reglas de frecuencia por consumidor, campaña y día; no emitir si no hay campaña activa o cupo.

**No entra:**
- Cobros, tickets, facturas, control de caja, integración POS, impresión y edición de campañas desde la consola.

## Diseño

El flujo debe requerir: escanear/buscar cliente -> elegir acción/preset -> confirmar. La operación es una transacción de servidor: crea el beneficio, emite oportunidades si corresponde y registra un evento. Repetir la misma petición no puede duplicar beneficios.

## Archivos

| Archivo | Acción |
|---|---|
| Pantalla móvil de consola y lector de QR | crear |
| Servicio transaccional de acreditación | crear |
| Historial operativo por personal | crear |

### Disjunta?

No. Comparte modelo de campaña, usuario, eventos y wallet con las specs previas.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Campaña activa, disparadores y reglas | 0003 | Antes de esta spec |
| QR de consumidor | 0004 | Antes de esta spec |

## Verificación

- [ ] Desde un teléfono de personal se acredita una compra a un QR válido en tres interacciones o menos.
- [ ] El consumidor ve la oportunidad en su wallet sin recargar manualmente.
- [ ] Dos envíos idénticos no generan oportunidades duplicadas.
- [ ] Un personal de Bar A no puede acreditar una compra para Bar B.

## Abierto

- Medir en piloto si la búsqueda manual debe permanecer; el escaneo QR es el camino principal.
