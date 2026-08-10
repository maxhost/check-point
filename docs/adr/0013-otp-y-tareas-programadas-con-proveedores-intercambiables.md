---
fecha: 2026-08-10
resumen: OTP y tareas programadas se abstraen para mantener bajo costo, control antifraude e idempotencia.
estado: propuesta
---

# ADR 0013 — OTP y tareas programadas con proveedores intercambiables

## Propuesta

Definir `OtpProvider` y pilotar Telnyx Verify como proveedor principal, con Twilio Verify como alternativa si la entrega a operadores ecuatorianos no resulta aceptable. Los OTP son de seis dígitos, cinco minutos de vigencia, intentos limitados y rate limiting propio por teléfono, IP y cuenta usando Upstash Redis.

Usar Vercel Cron para tareas diarias/horarias de V1. Cada tarea usa un endpoint autenticado, registro en Postgres, bloqueo de concurrencia e idempotencia.

## Consecuencias

- Se puede sustituir proveedor SMS sin migrar usuarios ni reescribir autenticación.
- No se permite que una falla o repetición del cron duplique expiraciones ni emisión de activos.
- Antes de producción hay que probar costo y entrega efectiva en Ecuador.

## Estado

Propuesta pendiente de validación del fundador.

