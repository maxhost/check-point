---
spec: 0032
fecha: 2026-08-14
estado: cerrada
resumen: Recuperación passwordless por OTP propio enviado por SMS, con ClickSend y Twilio intercambiables (ClickSend activo inicialmente), alta verificada si el número aún no existe, límites persistentes y rotación de todas las credenciales del consumidor recuperado.
disjunta: no
archivos: esquema consumer, migración, server/otp y consumer/recovery, rutas públicas y UI de recuperación; extiende wallet/rotate
---

# 0032 — Recuperación de cuenta y verificación por OTP

## Problema

La spec 0028 crea una cuenta con teléfono no verificado para que el alta en un comercio no
genere un coste de SMS. Si la persona pierde el dispositivo, no puede recuperar su cuenta, QR,
membresías ni pases. También puede existir una cuenta no verificada creada con un número ajeno o
mal escrito: solo quien demuestre posesión del número mediante OTP debe conservar acceso.

## Alcance

**Entra:**

- Recuperación passwordless por SMS para una cuenta existente, verificada o no.
- Si el teléfono no tiene cuenta, verificación del número y onboarding corto para crear una cuenta
  verificada sin membresía automática.
- OTP de seis dígitos generado y validado por CheckPass Club; ClickSend y Twilio solo transportan
  el SMS común. No se usan ClickSend Verify ni Twilio Verify.
- Interfaz agnóstica de proveedor; ClickSend activo inicialmente y Twilio seleccionable por
  configuración. Sin fallback automático.
- SMS inicial más un único reenvío del mismo código; expiración, intentos, uso único y límites
  persistentes por teléfono.
- Recuperación de cuenta con revocación de sesiones y rotación de QR, portal, Wallet y Web Push.
- Español, portugués o inglés según país.

**No entra:**

- Verificar por SMS durante el enrolamiento de la spec 0028.
- WhatsApp (previsto como canal posterior, aproximadamente tres meses después).
- Cambio de teléfono desde el perfil.
- UI del administrador de plataforma para elegir proveedor global o por país. La arquitectura la
  habilita, pero esta spec selecciona un único proveedor mediante entorno.
- Selección del proveedor por owners de negocio, fallback automático, optimización automática por
  precio, delivery receipts o webhooks de estado.
- Apertura real de WhatsApp desde “Contacta con soporte”; queda como estado visible sin acción.

## Decisiones cerradas

- **Canal:** solo SMS. Recovery usa SMS; el alta normal continúa sin coste ni verificación.
- **Proveedor:** `clicksend` por defecto; `twilio` implementado y activable. Una sola selección
  efectiva por despliegue, sin fallback automático. A futuro el administrador de plataforma podrá
  resolver proveedor global o por país según coste; nunca el owner del negocio.
- **Cobertura:** países soberanos de América excepto Guyana (`GY`) y Surinam (`SR`), más España
  (`ES`). ISO-2 permitidos: `AG, AR, BB, BO, BR, BS, BZ, CA, CL, CO, CR, CU, DM, DO, EC, ES, GD,
  GT, HN, HT, JM, KN, LC, MX, NI, PA, PE, PY, SV, TT, US, UY, VC, VE`.
- **Idioma:** portugués para `BR`; español para países hispanohablantes; inglés para países
  angloparlantes y como fallback (incluye inicialmente Canadá y Haití).
- **Código:** seis dígitos, HMAC-SHA-256 con secreto de servidor en DB, comparación en tiempo
  constante, cinco minutos de vigencia, uso único y máximo dos intentos de validación.
- **Entrega:** un SMS inicial y, pasados 60 segundos, un único reenvío del mismo código. El reenvío
  no crea challenge ni invalida el código. Un challenge nuevo sí invalida cualquier challenge
  activo anterior del teléfono.
- **Límites:** cada entrega aceptada por el proveedor —inicial o reenvío— cuenta para máximo tres
  SMS por teléfono en una hora y cinco en 24 horas. No hay límite por IP. Los contadores viven en
  Postgres y sobreviven reinicios/deploys.
- **Existencia:** request y verify no revelan si ya existe una cuenta. Un número inexistente recibe
  el mismo SMS; después de verificar pasa al onboarding.
- **Colisión:** `phone_e164` sigue siendo único. El OTP válido otorga acceso a la única cuenta que
  posea ese número en el momento de verificar; nunca se crean una cuenta verificada y otra no
  verificada para el mismo teléfono y no se fusionan cuentas silenciosamente.

## Diseño

### Arquitectura y proveedor

CheckPass Club genera el código. Los canales solo entregan texto:

```ts
type OtpLocale = "es" | "pt" | "en";
type OtpPurpose = "recover_account";

interface OtpDeliveryInput {
  phoneE164: string;
  countryIso: string;
  code: string;
  locale: OtpLocale;
  purpose: OtpPurpose;
}

interface OtpDeliveryReceipt {
  provider: "clicksend" | "twilio";
  providerMessageId: string;
  acceptedAt: Date;
}

interface OtpChannel {
  deliverOtp(input: OtpDeliveryInput): Promise<OtpDeliveryReceipt>;
}
```

Implementaciones:

- `ClickSendOtpChannel`: REST con credenciales de entorno; proveedor inicial.
- `TwilioOtpChannel`: REST con Account SID/Auth Token; alternativa seleccionable.
- `ConsoleOtpChannel`: solo desarrollo explícito; nunca producción.
- `FakeOtpChannel`: pruebas deterministas.
- `otpChannelFromEnv`: valida `OTP_PROVIDER=clicksend|twilio|console`, rechaza `console` en
  producción y construye exactamente un canal. Este resolver es el seam que una futura UI de
  plataforma reemplazará por selección global/por `countryIso`.

No se agrega SDK: ambos adaptadores usan `fetch`, timeout y errores normalizados. Un error o timeout
de ClickSend no llama Twilio. El usuario puede reintentar sin exceder límites; cambiar proveedor es
una decisión de configuración/plataforma.

Plantillas, sin enlaces:

- ES: `Tu código de CheckPass Club es {code}. Vence en 5 minutos. No lo compartas.`
- PT: `Seu código do CheckPass Club é {code}. Expira em 5 minutos. Não compartilhe.`
- EN: `Your CheckPass Club code is {code}. It expires in 5 minutes. Do not share it.`

### Modelo de datos

Migración aditiva en el esquema `consumer`:

**`otp_challenge`**

- `id uuid PK`, `phone_e164 text`, `country_iso text`, `purpose text` (`recover_account`).
- `code_hash text` y `code_ciphertext text`; nunca código en claro. El hash HMAC verifica y el
  ciphertext AES-256-GCM permite reenviar exactamente el mismo código durante cinco minutos.
- `status text`: `pending | verified | consumed | locked | expired | invalidated`.
- `verification_attempts integer default 0`, check `0..2`.
- `delivery_count integer default 0`, check `0..2`.
- `resend_available_at`, `expires_at`, `verified_at`, `consumed_at`, `created_at`, `updated_at`.
- `onboarding_token_hash text nullable`, `onboarding_expires_at nullable`: se llenan únicamente
  cuando un OTP válido no encuentra cuenta; el token opaco se entrega en cookie HttpOnly y dura 15
  minutos. El challenge queda `verified` hasta consumir el onboarding.
- Índice por `(phone_e164, created_at)` y un índice parcial/guard transaccional que asegure un solo
  challenge `pending` por teléfono. Crear uno nuevo invalida el anterior.

**`otp_delivery`** (log append-only y fuente de rate limit)

- `id uuid PK`, `challenge_id FK`, `phone_e164`, `provider`, `provider_message_id`, `locale`,
  `accepted_at`, `created_at`.
- Solo se inserta después de que el proveedor acepta el mensaje. Un fallo se observa en logs/métrica
  pero no consume cuota de SMS aceptado.
- Índice `(phone_e164, accepted_at)` para contar 3/hora y 5/24h.

Los challenges y deliveries no tienen FK a `consumer_account`: el teléfono puede no tener cuenta.
Una tarea de limpieza futura puede podar filas antiguas; no bloquea V1.

### Flujo y concurrencia

#### Solicitar código

1. Normalizar E.164 y validar que `countryIso` esté permitido y sea coherente con el prefijo usando
   la misma fuente de países del formulario.
2. Dentro de una transacción/bloqueo por teléfono, contar deliveries aceptados en 1h/24h. Si llegó
   al límite, devolver `429 otp_rate_limited` con respuesta independiente de existencia.
3. Invalidar el challenge `pending` anterior, generar seis dígitos con CSPRNG, guardar su HMAC y
   crear el challenge con expiración `now + 5m` y reenvío `now + 60s`.
4. Entregar por el canal configurado. Solo tras aceptación insertar `otp_delivery` e incrementar
   `delivery_count`. Si falla, marcar el challenge inválido/fallido de forma reintentable y devolver
   `503 otp_delivery_unavailable`, sin probar otro proveedor.
5. Responder `202` con `challengeId`, `expiresInSeconds=300`, `resendAfterSeconds=60`; nunca datos de
   cuenta.

Solicitudes concurrentes para el mismo teléfono no pueden dejar dos challenges utilizables ni
saltarse los límites. El lock puede ser advisory por hash de teléfono o una estrategia equivalente
demostrada en integración Neon.

#### Reenviar

- Solo el challenge `pending`, no expirado, con `delivery_count=1` y después de
  `resend_available_at`.
- Reutiliza el mismo código lógico descifrando `code_ciphertext` con AES-256-GCM. La clave
  `OTP_ENCRYPTION_KEY` es distinta de `OTP_HMAC_SECRET`; nunca hay texto plano en DB/logs/cookies.
- Aplica otra vez 3/hora y 5/24h, entrega el mismo SMS e incrementa a `delivery_count=2` únicamente
  tras aceptación. No hay tercer envío dentro del challenge.
- Antes de 60s: `429 otp_resend_too_soon`. Tras el único reenvío: `409 otp_resend_exhausted`.

#### Verificar y recuperar

- Respuesta uniforme para código inválido, challenge inexistente/no correspondiente o expirado:
  `400 invalid_or_expired_otp`. No revela cuentas.
- Cada código incorrecto incrementa atómicamente `verification_attempts`; al segundo, `locked`.
- Código correcto: marca `verified` de uso único. Una carrera de dos verifies solo deja consumir uno.
- Se vuelve a buscar la cuenta por teléfono dentro de la transacción; no se confía en un snapshot
  tomado al solicitar el OTP.
- Si existe: fija `phone_verified_at` si era null; revoca todas sus sesiones anteriores; invoca la
  rotación atómica de credenciales de 0033 (QR, web view, Wallet devices y Web Push); crea una nueva
  sesión de 30 días para este dispositivo; marca challenge `consumed`. La nueva sesión se crea en la
  misma unidad transaccional o la operación completa revierte.
- Si no existe: emite cookie HttpOnly de onboarding con token opaco de 15 minutos cuyo hash queda en
  el challenge y responde `needs_profile`; aún no crea una cuenta.

#### Onboarding posterior a OTP

- Pide nombre, apellido y país; el teléfono verificado no es editable.
- Consume el token de onboarding una sola vez. Inserta `consumer_account` con
  `phone_verified_at=now()`, tokens opacos nuevos y una sesión de 30 días. No crea membresía.
- Si una cuenta apareció concurrentemente para ese teléfono, no se sobrescribe ni se fusiona:
  recupera esa cuenta mediante el mismo camino de revocación/rotación y abre la sesión nueva.
- Al terminar redirige a `/wallet`, que puede mostrar cero programas y los CTA existentes.

### API y UI

| Ruta | Entrada | Éxito | Errores públicos |
|---|---|---|---|
| `POST /api/public/recovery/request` | `phoneE164`, `countryIso` | `202 {challengeId, expiresInSeconds, resendAfterSeconds}` | `400`, `429`, `503` |
| `POST /api/public/recovery/resend` | `challengeId` | `202` | `400`, `409`, `429`, `503` |
| `POST /api/public/recovery/verify` | `challengeId`, `code` | `200 {next:"wallet"|"profile"}` + cookies | `400` |
| `POST /api/public/recovery/profile` | `firstName`, `lastName`, `countryIso` | `201` + sesión | `400`, `401`, `409` normalizado |

UI `/recover`:

- Paso teléfono/país → código → éxito o perfil corto.
- Reenvío deshabilitado con contador durante 60s; luego se permite una sola vez.
- Indica dos intentos disponibles sin revelar existencia de cuenta.
- Al agotar entregas/límites o ante indisponibilidad persistente muestra “Contacta con soporte”. El
  control queda deshabilitado/sin acción en esta spec y accesible como texto de estado.
- El `409 already_member` del enrolamiento enlaza a `/recover` con el teléfono prellenado solo en
  estado cliente; no se incluye el teléfono en query strings ni logs.
- Estados de carga, doble submit bloqueado, foco accesible y diseño móvil primero.

### Seguridad, secretos y observabilidad

- `OTP_PROVIDER`, `OTP_HMAC_SECRET`, `OTP_ENCRYPTION_KEY`; ClickSend: username/API key/from configurables; Twilio: Account
  SID/Auth Token/from configurables. Secretos solo server-side y validados al construir el canal.
- Código, HMAC secret, credenciales, token de onboarding y teléfono completo nunca aparecen en logs,
  métricas, DTOs ni errores. Logs correlacionan por challenge y teléfono redactado/hash estable.
- Métricas: request, accepted delivery, resend, provider/error normalizado, latencia, país/idioma,
  verify success/failure/locked/expired, onboarding y recovery; nunca contenido SMS.
- No hay rate limit por IP por decisión de producto. El control de abuso es por teléfono y
  persistente; proveedor y límites pueden apagarse mediante configuración operativa.

### Arquitectura de referencia

- ADR 0013: OTP propio y canales intercambiables ClickSend/Twilio.
- ADR 0032: identidad purpose-built en esquema `consumer`.
- ADR 0037 y ADR 0039: rotación de credenciales, Wallet y Web Push al recuperar.
- Spec 0028: cuenta, sesión y enrolamiento no verificado.
- Spec 0033: `rotatePassCredentials`, que debe admitir el executor transaccional de recovery.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/consumer.ts` | agregar challenges y deliveries |
| `apps/merchant/drizzle/*` + `drizzle/meta/*` | migración aditiva generada |
| `apps/merchant/src/server/otp/{core,provider,clicksend,twilio,fake}.ts` | crear dominio y adaptadores |
| `apps/merchant/src/server/consumer/recovery.ts` | crear flujo transaccional |
| `apps/merchant/src/server/consumer/recovery*.test.ts` | unit e integración Neon |
| `apps/merchant/src/server/wallet/rotate.ts` | aceptar executor/participar en transacción |
| `apps/merchant/src/app/api/public/recovery/{request,resend,verify,profile}/route.ts` | crear rutas |
| `apps/merchant/src/app/(consumer)/recover/*` | crear UI por pasos |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx` | enlazar recovery desde 409 |
| `.env.example` / documentación de despliegue | documentar variables sin secretos |

### Disjunta?

**No.** Comparte `consumer.ts` con futuras features de identidad, `wallet/rotate.ts` con 0033/0037 y
`enroll-form.tsx` con el flujo de enrolamiento. Serializar contra cambios en esas superficies. No
colisiona conceptualmente con 0040, pero no despachar en paralelo si el árbol está sucio.

## Definition of Done

- [ ] ClickSend y Twilio implementan el mismo contrato; ClickSend funciona como selección inicial y
  cambiar `OTP_PROVIDER` usa Twilio sin cambiar rutas, DB o UI; no hay fallback automático.
- [ ] Recovery nunca envía SMS durante un alta normal; request sirve tanto para cuenta existente
  como inexistente sin revelar cuál es.
- [ ] OTP tiene 6 dígitos, HMAC, 5 minutos, uso único y 2 intentos; un challenge nuevo invalida el
  anterior y carreras no permiten doble consumo.
- [ ] Hay un SMS inicial y un solo reenvío del mismo código tras 60s; cuentan persistentemente para
  3/h y 5/24h por teléfono, sin límite por IP.
- [ ] Cuenta existente queda verificada, sesiones viejas revocadas, credenciales Wallet/PWA/QR
  rotadas y una sola sesión nueva válida, todo atómico.
- [ ] Número inexistente completa perfil y crea una única cuenta verificada sin membresías; una
  carrera con alta concurrente recupera la cuenta única sin fusionar ni sobrescribir perfil.
- [ ] Cobertura e idiomas siguen el allow-list cerrado; SMS no contiene enlaces.
- [ ] Ningún secreto, OTP, token ni teléfono completo se filtra por DTO, cookie legible por JS,
  logs o errores; UI móvil cubre contador, reenvío, intentos y soporte placeholder.
- [ ] Revisor independiente emite PASS según `docs/AGENT-WORKFLOW.md` antes de `implementada`.

## Plan de pruebas y verificación

- [ ] Unit: generación CSPRNG de 6 dígitos; HMAC/comparación; expiración; locale/allow-list;
  plantillas; validación E.164; errores normalizados y configuración de ambos proveedores.
- [ ] Unit con fetch mock: ClickSend y Twilio autentican/formatean sin SDK, devuelven receipt y no
  se llaman entre sí ante error; fake permite observar código solo en test.
- [ ] Integración Neon: inicial + mismo reenvío; bloqueo antes de 60s/tercer delivery; 3/h y 5/24h;
  nuevo challenge invalida anterior; segundo código malo bloquea; expiración y doble verify.
- [ ] Integración Neon: cuenta existente no verificada → verificada, sesiones anteriores revocadas,
  QR/web token rotados, devices/subscriptions purgados y sesión nueva; fallo intermedio revierte.
- [ ] Integración Neon: número inexistente → ticket → perfil → cuenta verificada sin membresías;
  carrera concurrente conserva una sola cuenta y no sobrescribe perfil existente.
- [ ] Seguridad: respuestas y tiempos razonablemente uniformes para cuenta existente/inexistente;
  DTO/log spy sin código, hashes, tokens, credenciales ni teléfono completo.
- [ ] Regresión: enrolamiento 0028, Wallet/rotación 0033, Web Push 0037 y micro-portal 0031 verdes.
- [ ] Comandos: Node 24; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`; integración Neon en rama efímera con migración desde producción.
- [ ] Manual: ClickSend real a al menos un operador ecuatoriano; Twilio real activado por config;
  recuperar en otro teléfono y comprobar que QR/portal anterior dejan de funcionar; probar un
  número nuevo y completar onboarding. Nunca registrar credenciales en el handoff.

## Handoff requerido

Implementador y revisor usan `docs/AGENT-WORKFLOW.md`. El implementador no cambia límites,
proveedores, países ni semántica de colisión. El revisor exige evidencia de concurrencia, atomicidad,
no enumeración y anti-fuga, además de los gates. Solo el orquestador aplica migración a producción y
marca `implementada` después del PASS.

## Abierto

No hay decisiones bloqueantes. WhatsApp, selector de proveedor del administrador de plataforma,
francés/criollo y soporte por WhatsApp son trabajo futuro explícitamente fuera de alcance.
