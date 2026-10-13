---
spec: 0219
fecha: 2026-10-13
estado: cerrada
resumen: Ingreso público del equipo con identificador/PIN, cambio obligatorio de PIN y avisos, usando el login existente.
disjunta: si
archivos: apps/merchant/src/app/acceso-equipo/**, apps/merchant/src/app/[locale]/(merchant)/business/onboarding/_components/onboarding-wizard.tsx, tests/e2e/staff-access.spec.ts, docs/INDEX.md, docs/estado/gpt.md
---

# 0219 — Acceso del equipo

## Problema

ADR0140 y servidor0218 ya entregados. POST auth/staff:200 aporta userId/name/identifier/mustChangePin/landing; no hay pantalla pública que lo llame. server/staff-landing.ts envía también permisos vacíos a /backoffice; el owner decide en este encargo mostrar solo «Tu acceso no está activado» y no continuar.

## Alcance

Entra: /acceso-equipo pública fuera de locale; login, cambio PIN, avisos URL, bloqueo temporal con contador, e2e. Se exporta WizardShell existente con texto de audiencia configurable para reutilizar exactamente el marco del dueño. Form/TextField/Button/InlineApiError/Heading/Text del login existente y tokens Tailwind actuales. Sin CSS, paleta ni diseño nuevos. No entra: API/servidor/kit, host/DNS/noindex (ya resueltos), publicación.

## Diseño

Página servidor lee searchParams sin requerir sesión, reutiliza WizardShell con «Para el equipo», metadata Acceso del equipo. Estado cliente login → cambio PIN → navegación de documento nuevo. Formatos ^[0-9]{6}$, inputMode numeric, autoComplete one-time-code, maxLength6, pattern del campo de código. Identificador trim; los PIN conservan ceros iniciales como strings. Sin persistencia de PIN en storage, logs ni URL.

POST /api/merchant/auth/staff {identifier,pin}. 200: validar DTO, leer sesión para confirmar permisos antes de continuar; si sesión autenticada del mismo userId, rol staff y permisos no vacíos, mustChangePin=false → window.location.assign(landing); true → formulario de tres campos. GET fallido conserva posibilidad de reintentar; no navega ante respuesta incoherente. Destino solo path del mismo host /backoffice o subrutas, sin // ni barra invertida; no se calcula el landing en el cliente.

POST /api/staff/:userId/pin {currentPin,newPin}; repetir nuevo coincidente y ambos de seis dígitos antes de enviar. 200 ok:true/mustChangePin:false → landing de login o /backoffice si se llegó por ?cambiar-pin=1. En entrada directa se lee GET /api/merchant/session para user.id; sin sesión o rol ajeno, error y volver al ingreso, sin emitir cambio. Sesión con permisos vacíos o membresía inactiva: solo «Tu acceso no está activado», sin formulario ni redirección. Errores conservan borrador y muestran el error del API usando InlineApiError (WizardApiError); fallback corto ante red/JSON inválido. El cambio de PIN no anuncia éxito ni navega sin confirmación.

429 pin_locked: error recibido + contador de retryAfterSeconds, botón bloqueado hasta vencimiento. Deadline por Date.now, timer limpio al desmontar; un segundo de actualización, sin sleeps de UI. Cerradura ref además de busy para impedir dobles envíos; botones/campos deshabilitados durante solicitud/navegación. Sesión inicial y respuestas viejas no escriben tras desmontar.

?e=staff_disabled: Tu acceso no está activado. business_suspended: El negocio está suspendido. business_closed: El negocio está cerrado. payment_required: El acceso del negocio está pendiente de pago. Alert del kit sobre el formulario, no actúan como autorización; valores desconocidos ignorados. Tuteo.

## Contrato solicitado a Claude: cero permisos

Decisión ya tomada por owner, no pregunta abierta: un staff sin permisos no accede; se muestra solo que no está activado. Hoy el login devuelve 200 y cookie incluso vacío. La UI cubre el flujo mediante GET sesión antes de navegar/cambiar PIN. Para impedir también el acceso directo, Claude debe rechazar el login ANTES de openMerchantSession con 403 staff_disabled y «Tu acceso no está activado», y hacer equivalente el guard del panel. No se declara resuelto el rechazo del servidor con un bloqueo visual. Esta solicitud no autoriza a GPT a modificar servidor. Si el servidor ya devuelve ese 403, la UI muestra su error sin continuación.

## Archivos

| Archivo | Acción |
|---|---|
| app/acceso-equipo/page.tsx | ruta pública y shell existente |
| app/acceso-equipo/staff-access.tsx | estado y formularios |
| app/acceso-equipo/pin-field.tsx | composición reutilizable del TextField existente |
| app/acceso-equipo/staff-access-api.ts | contratos HTTP y errores |
| app/acceso-equipo/use-pin-lockout.ts | bloqueo temporal |
| onboarding/_components/onboarding-wizard.tsx | exportar shell y audiencia opcional |
| tests/e2e/staff-access.spec.ts | pruebas en ruta real con HTTP simulado |
| docs/INDEX.md, docs/estado/gpt.md, docs/handoff-0219-acceso-equipo.md | reserva, evidencia y contrato pendiente |

Disjunta con0218: pantallas y e2e propios; ningún servidor. INDEX compartido conserva todas las filas.

## Definition of Done

- [ ] Login con/sin PIN temporal, errores, 429 con contador y reintento; cambio PIN error/éxito y coincidencia; entrada directa GET sesión; cuatro avisos; permisos vacíos sin acceso. E2e en ruta exacta.
- [ ] 390/1280 sin overflow y capturas revisadas; navegación documento nuevo a landing confirmado.
- [ ] Tipos/lint/formato y node tools/ui-guard.ts --base origin/main sin aumentos.
- [ ] pnpm verify una vez al final, tabla real y límites; suites de DB solo wrapper NeonCI, nunca URL de producción.
- [ ] Revisor independiente antes de marcar implementada; rechazo de servidor pendiente declarado aparte.

## Mutaciones

Presupuesto1: forzar continuación con permisos vacíos → e2e de no activado debe fallar. Registrar salida y revertir; sin mutaciones de servidor.

## Handoff

Implementador GPT, revisor independiente posterior. Sin merge/push. QA del owner y confirmación servidor pendientes antes de publicar.

## Abierto

Sin decisiones de producto abiertas. Implementación del rechazo de servidor pertenece a Claude; no bloquea construir/verificar esta UI y queda declarada como límite de autorización real.
