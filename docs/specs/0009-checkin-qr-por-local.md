---
spec: 0009
fecha: 2026-08-09
estado: borrador
resumen: Registra un check-in autenticado mediante el QR fijo de cada local sin confundirlo con una compra.
disjunta: no
archivos: depende de 0001, 0002 y 0004; rutas concretas por definir
---

# 0009 — Check-in QR por local

## Problema

El check-in conecta al consumidor con el local y permite medir visitas o activar campañas diseñadas para presencia. No puede fingir ser una compra ni permitir repetición ilimitada.

## Alcance

**Entra:**
- QR fijo visible del local que abre una página web de check-in.
- Registro/inicio de sesión si el consumidor no tiene sesión.
- Confirmación de check-in con nombre, marca y hora del local.
- Regla de frecuencia inicial: un check-in por consumidor y local cada 24 horas.
- Emisión de beneficio solo si una campaña activa eligió explícitamente check-in como disparador.
- Registro auditable del evento.

**No entra:**
- GPS, geofencing, NFC, verificación de compra, puntos por ruta o ubicación en segundo plano.

## Diseño

El QR identifica local, no mesa ni persona. El check-in es una transacción de servidor que aplica frecuencia y, si corresponde, evalúa la campaña activa. Su resultado comunica claramente si solo registró la visita o además asignó un beneficio.

## Archivos

| Archivo | Acción |
|---|---|
| Ruta pública del QR y confirmación de check-in | crear |
| Servicio transaccional de frecuencia y disparador | crear |
| Evento e historial de check-in | crear/editar 0001 |

### Disjunta?

No. Comparte local, sesión del consumidor, campañas y wallet.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| QR del local | 0002 | Antes de esta spec |
| Wallet y sesión del consumidor | 0004 | Antes de esta spec |

## Verificación

- [ ] Un consumidor autenticado registra check-in en el local correcto.
- [ ] Un segundo check-in del mismo local antes de 24 horas se rechaza sin asignar otro beneficio.
- [ ] Un check-in no puede acreditarse como compra.

## Abierto

- Validar durante piloto si 24 horas es una frecuencia apropiada para bares.
