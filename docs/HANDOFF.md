# Handoff — Spec 0032 cerrada / próxima implementación

**Fecha:** 2026-08-17
**Estado:** diseño cerrado, sin código de OTP. Próximo paso: implementar spec 0032.

## Punto de retorno

Leer, en este orden:

1. `docs/TASKS.md` — entrada superior del 2026-08-17.
2. `docs/specs/0032-recuperacion-de-cuenta-y-verificacion-por-otp.md` — contrato completo cerrado.
3. `docs/adr/0013-otp-y-tareas-programadas-con-proveedores-intercambiables.md` — proveedor/canal.
4. ADR 0032 (identidad), ADR 0037/0039 (rotación Wallet/Web Push) y spec 0033.
5. `docs/AGENT-WORKFLOW.md` — implementador y después revisor independiente.

## Decisiones que no debe reinventar el implementador

- Recovery por SMS únicamente; enrolamiento normal sigue sin SMS.
- OTP propio: 6 dígitos, HMAC para verificar, AES-256-GCM para reenviar el mismo código, 5 minutos,
  2 intentos y uso único.
- SMS inicial + un único reenvío después de 60 segundos. Challenge nuevo invalida anterior.
- 3 entregas/hora y 5/24h por teléfono en Postgres; inicial y reenvío cuentan; sin límite por IP.
- ClickSend y Twilio implementan `OtpChannel`; ClickSend activo. Sin fallback automático.
- Número existente recupera la cuenta única y rota/revoca todo; número inexistente valida OTP y
  completa onboarding antes de crear cuenta verificada sin membresía.
- Países soberanos de América menos Guyana/Surinam + España. ES/PT/EN según la spec.
- WhatsApp, UI admin de proveedor y soporte WhatsApp quedan fuera.

## Trabajo de implementación

- Agregar `otp_challenge` y `otp_delivery` mediante migración aditiva.
- Crear dominio `server/otp`, adaptadores ClickSend/Twilio/fake y resolver por entorno.
- Crear recovery transaccional y hacer que `rotatePassCredentials` acepte el executor de la
  transacción, sin abrir ventanas parciales.
- Crear las cuatro rutas públicas, `/recover`, onboarding corto y enlace desde `already_member`.
- Ejecutar los gates y la matriz de integración Neon detallada en la spec.
- Entregar a un revisor independiente; solo después de PASS el orquestador aplica migración a prod y
  cambia la spec a `implementada`.

## Estado del árbol y commit

Este commit de handoff también incluye el rebranding previo de “Mi Pasaporte” a **CheckPass Club**
en UI, PWA, Wallet, scripts y documentación principal. Sus verificaciones ya ejecutadas fueron:

- `pnpm typecheck` — PASS 3/3.
- `pnpm lint` — PASS.
- Wallet unit `src/server/wallet.test.ts` — PASS 7/7.

Para la documentación de 0032 se debe ejecutar al menos `git diff --check` y validar que INDEX,
TASKS, ARCHITECTURE, ADR y spec coincidan antes del commit. No hay migración ni secretos todavía.
