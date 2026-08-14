---
spec: 0032
fecha: 2026-08-14
estado: borrador
resumen: Verificación de teléfono y recuperación de la cuenta de consumidor por OTP (SMS o WhatsApp) para recuperar la tarjeta en otro dispositivo y endurecer la identidad no verificada de la 0028; canal agnóstico `deliverOtp`. Guarda la investigación de proveedores.
disjunta: no
archivos: por definir (extiende el esquema `consumer` de 0028; agrega el canal de mensajería)
---

# 0032 — Recuperación de cuenta y verificación por OTP

> **Stub — reserva de alcance.** No cerrada. Endurece la identidad que la **spec 0028** deja
> deliberadamente sin verificar. Es la primera pieza que necesita un **proveedor de
> mensajería** (SMS/WhatsApp).

## Problema

La spec 0028 crea la cuenta de consumidor con el teléfono como clave de identidad pero **sin
verificar** (`phone_verified_at = null`) y sin enviar mensajes, para que el enrolamiento sea
gratis y sin fricción. Eso deja dos cosas sin resolver:

1. **Recuperación**: si la persona cambia o pierde el teléfono, su QR/sesión viven en ese
   dispositivo; necesita reclamar su cuenta en uno nuevo, y para eso hay que **probar que el
   teléfono es suyo** (OTP).
2. **Colisión de identidad**: como el teléfono no está verificado, dos personas podrían quedar
   sobre una misma cuenta (número mal tipeado o ajeno). La verificación resuelve quién es el
   dueño real del número.

## Alcance (tentativo)

**Entra:** verificación del teléfono por OTP (marca `phone_verified_at`); flujo de recuperación
"reclamar mi cuenta en este dispositivo" con OTP → nueva sesión; el canal agnóstico
`deliverOtp(phoneE164, code)` con implementaciones **SMS** y **WhatsApp**; challenge con
expiración (10 min), límite de intentos (5), uso único, sin fuga de existencia de cuenta;
resolución de colisión cuando un número verificado ya estaba en una cuenta no verificada.

**No entra:** el enrolamiento en sí (0028); pase de Wallet (0029); cambio de teléfono como
feature de perfil (posible sub-spec).

## Diseño (semilla)

- Reusa el `enrollment_challenge`/`otp_challenge` (tabla en el esquema `consumer`) y la interfaz
  **`OtpChannel.deliverOtp(...)`** ya bosquejada: el proveedor solo "entrega un OTP a un
  número"; nosotros generamos/verificamos el código (no Verify API). Impls: `TwilioSmsChannel`,
  `PlivoSmsChannel`, `WhatsAppOtpChannel`, `ConsoleOtpChannel` (dev), `FakeOtpChannel` (test),
  y un `RoutingOtpChannel` opcional que elige por prefijo E.164 (p.ej. WhatsApp para `+55`).
- Selección por entorno (ADR 0024, secretos en env); consume el ADR 0013 (proveedor
  intercambiable).

## Investigación de proveedores (2026-08-14)

> Aclaración clave: **"OTP" no es un SMS más caro.** Enviar nuestro código como SMS común =
> tarifa de SMS normal. Lo caro es una **Verify API** (Twilio/Vonage Verify), que cobra un fee
> por verificación **además** del SMS — no la usamos. Nuestro OTP es propio (DIY), envío crudo.

**Precios verificados (oficiales, USD por segmento/mensaje):**

| Proveedor | Ecuador | Brasil | España | Probar hoy | Notas |
|---|---|---|---|---|---|
| **Twilio** | $0.339 | $0.0599 | $0.0875 | Sí (trial: solo a números verificados; luego PAYG) | REST simple, Node SDK. |
| **Plivo** | desde $0.2516 (Movistar $0.4267) | desde $0.0484 | desde $0.0716 | Sí (PAYG con tarjeta) | Más barato que Twilio en los tres. |
| **Telnyx** | no verificado (portal) | no verificado | no verificado | Sí (PAYG + tarjeta, trial con tope) | US $0.004/parte. Mejor DX/Node SDK. |
| **AWS SNS** | no publicado | no publicado | no publicado | Con fricción (sandbox: 10 números verif., cupo $1/mes, alta de origen por país) | EC/BR **solo short code**; ES sender ID (ver abajo). Pesado salvo si ya estás en AWS. |
| **Bird (MessageBird)** | no verificado | no verificado | no verificado | Parcial (PAYG sí; resto sales-led, mínimos grandes) | Riesgoso para self-serve chico. |
| **Vonage** | no verificado (páginas 403 / LATAM sales-gated) | no verificado | no verificado | — | No verificable en esta ronda. |

**WhatsApp OTP (mensaje de autenticación, base Meta, USD):** Brasil **$0.0225**, España
**$0.0298**, Ecuador **no encontrado**. Desde 2025-07 Meta cobra **por mensaje** (no por
conversación); el BSP suma markup ~$0.003–0.010; algunos mercados tienen tarifa
"Authentication-International" 3–18× mayor. En Brasil/España WhatsApp es **más barato que SMS**
y con penetración altísima → candidato fuerte para la verificación en régimen.

**Régimen regulatorio (afecta a todos):**
- **Brasil**: sender ID alfanumérico **pre-registrado**, solo Vivo/Claro/TIM, provisioning
  **~10 semanas** (el long-pole); long codes **no** válidos para A2P (short code es el camino);
  LGPD extraterritorial. Viable sin presencia local, pero **lento** para un remitente branded.
- **España/UE**: sender ID alfanumérico desde **2026-09-15** debe estar **registrado en el
  Registro de Alias de la CNMC** o los operadores lo bloquean; requiere certificado
  español/eIDAS o representante UE con poder apostillado; fallback: **long code** sin registro.
- **Ecuador**: entregable, el de **menor fricción** regulatoria de los tres pero el menos
  documentado; vía AWS solo short code.

**Recomendación (semilla, a confirmar al cerrar la spec):**
- **Para probar YA** (Ecuador/España primero): **Plivo o Telnyx** (PAYG inmediato con tarjeta,
  REST simple, Node SDK). Plivo es el más barato verificado; Telnyx el de mejor DX (hay que
  sacar sus tarifas EC/BR/ES del portal). Twilio sirve para trial a números propios.
- **En régimen**: **WhatsApp** para la verificación donde sea más barato (BR/ES; confirmar EC),
  vía `WhatsAppOtpChannel`, con SMS como fallback.
- **Brasil**: planificar con anticipación el alta del sender (~10 semanas) o entrar por
  WhatsApp; no bloquea EC/ES.
- **Evitar** Verify APIs (cobran de más para lo que ya hacemos nosotros).

Datos **no verificados** (obtener del portal al implementar, no dar por ciertos): tarifas
EC/BR/ES de Telnyx, AWS SNS y Bird; tarifa WhatsApp-auth de Ecuador; tarifas por país de Vonage.

## Dependencias

- **Spec 0028** — cuenta/perfil/sesión/QR y el esquema `consumer`.
- **ADR 0013** — OTP con proveedor intercambiable; **ADR 0024** — secretos en entorno.

## Abierto (bloquea el cierre)

- Proveedor(es) concreto(s) por canal/país y confirmación de las tarifas no verificadas.
- Canal por defecto (SMS vs WhatsApp) y política de ruteo por país.
- Modelo exacto del flujo de recuperación y de resolución de colisión (qué pasa con una cuenta
  no verificada cuyo número reclama un tercero verificado).
- Rate-limiting y anti-abuso del envío.

## Fuentes

- Twilio SMS pricing — https://www.twilio.com/en-us/sms/pricing
- Plivo SMS pricing — https://www.plivo.com/sms/pricing/
- Telnyx messaging pricing — https://telnyx.com/pricing/messaging · https://telnyx.com/ai/pricing.json
- AWS End User Messaging — países/orígenes: https://docs.aws.amazon.com/sms-voice/latest/userguide/phone-numbers-sms-by-country.html · España: https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations-spain.html · sandbox: https://docs.aws.amazon.com/sns/latest/dg/sns-sms-sandbox.html
- Bird SMS pricing — https://bird.com/en-us/pricing/sms
- WhatsApp Business pricing — https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Brasil A2P/ANATEL/LGPD — https://www.telerivet.com/blog/brazil-sms-compliance-anatel-lgpd · https://www.sent.dm/en/resources/sms-compliance/brazil-sms-guide
