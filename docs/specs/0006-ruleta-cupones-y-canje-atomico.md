---
spec: 0006
fecha: 2026-08-09
estado: borrador
resumen: Define el catálogo de mecánicas; implementa ruleta y cupones únicos, dejando raspadita como siguiente juego.
disjunta: no
archivos: depende de 0001, 0003, 0004 y 0005; rutas concretas por definir
---

# 0006 — Juegos, ruleta, cupones y canje atómico

## Problema

El producto requiere juegos intercambiables, pero la animación de una ruleta no debe decidir ni duplicar premios. El resultado debe respetar la campaña, el cupo y el local, y un bartender debe poder validarlo una sola vez.

## Alcance

**Entra:**
- Catálogo de mecánicas con contrato común: elegibilidad, resultado, premio y cupón. Ruleta habilitada; raspadita declarada como futura y no seleccionable.
- Consumir una oportunidad elegible desde el wallet.
- Resultado de ruleta elegido por servidor conforme a probabilidades, cupos, horario y campaña activa.
- Cupón único que especifica local, premio, condiciones, vencimiento y estado.
- Validación por personal mediante escaneo/código y transición atómica `disponible -> canjeado`.
- Estados de oportunidad: disponible, usada, vencida; estados de cupón: disponible, canjeado, vencido.
- Mensajes claros para cupo agotado, cupón vencido o local incorrecto.

**No entra:**
- Raspadita funcional, otros juegos, animaciones 3D, premios físicos, sorteos entre usuarios, transferencia o devolución de oportunidades.

## Diseño

La interfaz anima después de que el servidor reserve la oportunidad y determine el resultado. El cupón es una entidad del servidor y la validación se realiza bajo bloqueo/transacción para que dos teléfonos no lo canjeen a la vez. Todo cupón y oportunidad conserva `merchant_id` y `venue_id`. Una mecánica nueva debe implementar el mismo contrato, sin cambiar wallet ni consola.

La validación no asume que un cupón disponible es canjeable: evalúa vigencia, campaña, alcance de locales y estado operativo del local. Si un local de canje cerró, el cupón se conserva pero se devuelve un resultado no canjeable con razones legibles para consumidor y staff; nunca se redirige automáticamente a otra sucursal.

## Archivos

| Archivo | Acción |
|---|---|
| Motor de asignación ponderada y reserva de oportunidad | crear |
| Interfaz de ruleta y detalle de cupón | crear |
| Servicio y vista de validación atómica | crear/editar consola 0005 |

### Disjunta?

No. Colisiona directamente con 0005 en la consola y con 0004 en wallet.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Acreditaciones y oportunidades | 0005 | Antes de esta spec |
| Reglas y premios de campaña | 0003 | Antes de esta spec |

## Verificación

- [ ] Una oportunidad genera exactamente un cupón o resultado, incluso al recargar o repetir la solicitud.
- [ ] Dos intentos concurrentes de canje terminan con un solo cupón canjeado.
- [ ] Un cupón de Bar A es rechazado por la consola de Bar B.
- [ ] Un premio agotado no se asigna.

## Abierto

- Definir la librería de cámara/lector QR compatible con los dos teléfonos de prueba.
