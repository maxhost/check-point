# Handoff — Spec 0219

Estado: UI implementada y verificada en dev; spec cerrada hasta revisión independiente. Sin merge ni push.

Spec ee228d2, precisión del marco83eeb61, UI c80b347, avisos desconocidos9e4734a.

## Resultado

/acceso-equipo es una ruta pública fuera de locale. Reutiliza Form, TextField numérico del código del dueño, Button, InlineApiError, Heading y Text. PinField compone los cuatro campos, sin tocar el kit. El marco WizardShell y su stylesheet ya existente se comparten mediante merchant-entry.tsx; el dueño conserva su default/generateMetadata a través de page.ts, un shim sin JSX. El traslado real de page.tsx a merchant-entry.tsx conserva su deuda original (rename84%). Sin CSS ni paleta nueva, guardia sin aumentos.

Login POST identifier/pin, conserva ceros iniciales, verifica sesión antes de continuar, navega por documento nuevo al landing del servidor o exige cambio. Cambio POST currentPin/newPin, coincidencia y formato antes de enviar, GET sesión para entrada directa ?cambiar-pin=1, destino /backoffice cuando no hay landing. Respuestas incoherentes no navegan; cierre ref/busy impide dobles envíos. Errores conservan los datos y muestran el mensaje del API. 429 muestra contador de retryAfterSeconds y bloquea hasta vencer. Cuatro avisos URL arriba del formulario; claves desconocidas y propiedades heredadas del objeto se ignoran. PIN solo en memoria/JSON del POST, sin storage, logs ni URL.

Sesión de staff sin permisos o membresía inactiva: solo «Tu acceso no está activado», sin formulario, botones ni redirección. Los avisos URL son presentación, nunca autorización.

## Contrato pendiente de Claude: rechazo real por cero permisos

Decisión explícita del owner en este encargo: staff sin permisos no accede, solo se dice que no está activado. **Hoy POST auth/staff todavía devuelve 200 y crea cookie incluso con cero permisos**, y el guard del panel no niega ese caso. La UI hace GET sesión y corta el flujo, pero eso NO reemplaza una regla del servidor ni impide el login por HTTP directo.

Pedido cerrado de producto en spec0219 §Contrato solicitado a Claude: rechazar ANTES de openMerchantSession con 403 staff_disabled y «Tu acceso no está activado»; rechazar equivalentemente el panel. La evaluación de permisos efectivos y el destino siguen perteneciendo al servidor (ADR0140), sin calcular destinos en esta UI. GPT no modificó API/servidor/guards/migraciones, conforme a las zonas de AGENTS.md. Esta parte debe estar resuelta antes de publicar la política de rechazo.

## Archivos tocados

app/acceso-equipo/{page,pin-field,staff-access-api,staff-access,use-pin-lockout}.tsx/ts; onboarding/{page.ts,_components/merchant-entry.tsx,_components/onboarding-wizard.tsx}; tests/e2e/staff-access.spec.ts; spec/INDEX/estado/handoff propios.

## Comandos y evidencia

Node24.20.0. Tipos merchant, ESLint, Prettier, diffcheck0 y node tools/ui-guard.ts --base origin/main verdes,46 archivos sin aumentos. E2e sobre página REAL Next/Turbopack, HTTP simulado:24/24 en10.2s, incluyendo login con/sin PIN temporal, formato de6 dígitos/ceros, errores400/401/403, bloqueo429 en ambos pasos, coincidencia y persistencia del borrador, entrada directa con/sin sesión, cuatro avisos, permisos vacíos, destino inválido, reintento GET, doble envío y avisos desconocidos. Capturas390/1280 login y cambio PIN vistas; sin overflow. Primeros fallos fueron selectores globales que incluían el anunciador/devtools de Next, y una corrida arrancada desde la instalación distinta de Playwright: corregidos sin aflojar aserciones.

La inspección inicial detectó el marco sin estilos; se compartió la entrada estilizada existente y se confirmaron las cuatro capturas. Dos rondas visuales, sin rediseño.

MutaciónM1 en copia temporal: forzar stage change con permisos vacíos; 1failed esperado, heading «Tu acceso no está activado» ausente (staff-access.spec.ts:354). Restaurada y comparada byte a byte con SHA limpio. Bitácora ejecutada /private/tmp/checkpass-0219-mutation.md. La corrección posterior de claves desconocidas no cambia esa rama.

## Verify completo: tabla REAL

Una sola ejecución `CI=true pnpm verify` en /private/tmp/checkpass-0219-verify sobre snapshotc80b347. Env de copia sin DATABASE_URL/DATABASE_URL_UNPOOLED; Neon solo mediante tools/neon-test.sh contra CI. Instalación con lockfile, servidores originales preservados. La whitelist de avisos9e4734a se verificó después con tipos/lint/guardia,24 e2e y build Merchant repetido:exit0.

| Gate | Resultado | Segundos |
|---|---|---|
| typecheck | ok |14.9|
| lint | ok |8.3|
| ui-guard | ok |1.2|
| format:check | ok |9.0|
| test | ok |43.8|
| build | ok |33.3|
| test:e2e | ROJO: imágenes landing |424.0|
| neon (full) | ok |458.6|

Unitarios2677pasaron1151omitidos; los cuatro builds verdes y /acceso-equipo presente. E2e global350pasaron62omitidos15no corrieron por grupo serial,1falló: landing390light, imagen hero naturalWidth0 al vencer30s; reintentos fallaron luego en imágenes POS (naturalWidth0 tras60s). No se editaron landing ni sus aserciones en esta tarea. El login del dueño y los21 casos iniciales de equipo pasaron en esa corrida. NeonCI completo3583pasaron282omitidos. No se afirma verify verde.

Logs /private/tmp/checkpass-0219-verify.log, /private/tmp/checkpass-0219-e2e-24.log, /private/tmp/checkpass-0219-types-final.log, /private/tmp/checkpass-0219-build-final.log. Capturas finales /private/tmp/checkpass-0219-results; copia también en test-results del snapshot.

## DoD

- [x] UI y24 e2e de su alcance verdes, navegación real y no continuación con permisos vacíos.
- [x] Componentes/estilos existentes, sin deuda adicional, capturas390/1280 vistas.
- [x] Mutación negativa ejecutada, rojo por oráculo correcto, revertida.
- [x] Tipos/lint/formato/guardia/unitarios/builds/Neon reales; verify único con tabla transcrita.
- [ ] Gate global e2e verde: falla de imágenes landing fuera del cambio0219.
- [ ] PASS independiente y QA del owner; contrato de rechazo de servidor completado por Claude.

## Hallazgos y límites

UI lista para revisar en dev. Sin prueba de login con credenciales reales ni publicación. No se tocaron DNS/host/noindex, kit, API o base de producción. El servidor todavía debe aplicar el rechazo por cero permisos antes de crear sesión; no se presenta el bloqueo visual como control de autorización. El estado de main remoto sigue rojo en4208714 por las capturas POS que ya están corregidas localmente desdeb2482c4; no se pusheó nada.
