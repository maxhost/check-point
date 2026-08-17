---
fecha: 2026-08-10
resumen: CheckPass Club genera y verifica OTP propios; proveedores intercambiables solo transportan SMS. ClickSend y Twilio son los primeros adaptadores, ClickSend inicia activo y la selección futura podrá variar globalmente o por país desde la plataforma.
estado: aceptada; revisada 2026-08-17 para cerrar spec 0032
---

# ADR 0013 — OTP y tareas programadas con proveedores intercambiables

## Contexto

La identidad del consumidor es passwordless y necesita recuperación por teléfono, pero Verify APIs
acoplan generación/validación al proveedor y agregan coste. El producto operará en varios países,
donde precio y entregabilidad cambian; la selección debe pertenecer al administrador de plataforma,
nunca al owner de un negocio.

## Decisión

- CheckPass Club genera, protege y verifica el OTP. El proveedor solo entrega un SMS común mediante
  `OtpChannel.deliverOtp`; no usamos Telnyx Verify, Twilio Verify ni ClickSend Verify.
- Los primeros adaptadores son ClickSend y Twilio. ClickSend queda activo inicialmente y Twilio se
  puede activar por configuración; no hay fallback automático.
- La selección inicial es global mediante entorno. El seam recibe país y permite que una futura UI
  de administración de plataforma seleccione proveedor global o por país según coste/operación sin
  cambiar cuentas, challenges, rutas o UI de consumidor.
- El primer canal es SMS. WhatsApp llegará como otro canal/adaptador, tentativamente en tres meses.
- Recovery aplica límites persistentes por teléfono en Postgres, no por IP. La spec 0032 fija
  expiración, intentos, reenvío, países, idiomas y resolución de identidad.
- `ConsoleOtpChannel` es exclusivamente desarrollo y `FakeOtpChannel` pruebas. Producción falla al
  arrancar/configurar antes que degradar a console.
- Vercel Cron sigue siendo el mecanismo para tareas programadas compatibles con el plan; cada tarea
  usa autenticación, idempotencia y exclusión de concurrencia. Esta parte de la decisión no cambia.

## Consecuencias

- Cambiar de ClickSend a Twilio —o resolver por país en el futuro— no migra usuarios ni reescribe
  recovery.
- Un fallo de un proveedor no dispara otro automáticamente: evita mensajes duplicados, códigos
  fuera de orden y coste doble. El operador cambia la selección de forma explícita.
- Implementar ambos proveedores ahora prueba el contrato; probar entrega real por país sigue siendo
  un gate manual antes de operar allí.
- Secretos, OTP y teléfonos completos nunca llegan al navegador ni a logs.

## Estado

Aceptada. Supersede la propuesta original de pilotar Telnyx Verify con Twilio Verify como fallback.
La implementación concreta está cerrada en la spec 0032.
