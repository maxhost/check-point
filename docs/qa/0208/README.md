# 0208 — Entrada de wallet: Club cotidiano, paleta A

Implementación local de los mocks0207 aprobados por el owner. Rutas reales: `/wallet` sin sesión, `/enroll/[programId]` y `/enroll/[programId]/ready`. No se cambió la wallet con sesión, sus pestañas, API, servidor, paquetes ni kit.

La entrada directa dice «Inicia sesión en tu wallet para acceder a tu pase y beneficios». Inscripción conserva programa/local, proveedores y alta explícita; con sesión muestra cuenta y permite No soy yo. La confirmación distingue inscripción de instalación y conserva avisos, ofertas existentes, manifest y recuperación por plataforma. Nombre y logo reales; inicial cuando falta logo.

Fuente NunitoSans autohospedada con OFL en `apps/consumer/public/fonts`. CSS module compartido y aislado. Retenida la marca tipográfica de Google/Apple; declarada en DESIGN. Revisión independiente:14 capturas válidas, tipo/material/fondo/composición/acciones coinciden con mock. Hallazgo documental corregido; verdictpass ship para persistencia, sin cambios visuales requeridos. No se produjo ningún raster de aplicación.

## Validación específica

- Node24: typecheckconsumer, ESLintconsumer/e2e y formato de archivos afectados, salida0.
- Unit existentes14/14: proveedores, login sin consultas de datos, manifest y contrato de alta.
- Chromium11/11 con páginas/componentes reales, session/program reads y HTTP simulados. Se prueban login puro, URLsprograma/local, logo, bienvenida, envío explícito/busy,201/409/401/503/red, cambio de cuenta, ya miembro, programa ausente, Androidprompt/rechazo/error y iOS/standalone.
- Corrección de estado: appinstalled limpia el error anterior; prueba Android específica1/1 posterior en verde.
- Capturas390/1440 de seis estados y overflow320/360/390/430/1440, incluidos nombres largos. [Capturas](captures/).
- Next real local3200: `/wallet`200 a390/1440, dos proveedores, fuenteNunitoSans, sin erroresJS ni overflow. [390](next-login-390.png), [1440](next-login-1440.png).
- Ajuste mecánico de dos aserciones de copy en `apps/merchant/src/app/backoffice/marketing/welcome-ui.test.ts` según §6 rotura cruzada;7/7 posteriores en verde, sin quitar protección contra revelar el premio.
- Revisión visual owner aprobada; el owner indicó que no puede probar el recorrido en local. OAuth/instalación en dispositivo físico no comprobados.

## Verify general — ejecución durante implementación

Log íntegro local `/private/tmp/0208-verify.log`. La tabla ejecutada, sin reinterpretar el estado:

| Gate | Ejecutado | Resultado | Segundos |
|---|---|---|---|
| typecheck | sí | ok |0.9|
| lint | sí | ok |10.3|
| ui-guard | sí | ok |0.6|
| format:check | sí | ROJO |11.9|
| test | sí | ROJO |80.3|
| build | sí | ok |36.6|
| test:e2e | sí | ROJO |2.4|
| neon(full) | sí | ROJO |452.8|

Unit general:2529pasaron/1falló/1091saltados. Neon mediante `tools/neon-test.sh`, variables deCI protegidas:3375pasaron/1falló/282saltados. Ambos fallos son el mismo test de copy de bienvenida que estaba cargado antes de su ajuste; rerun específico7/7 en verde. No se probaron datos de producción. Los cuatro builds terminaron correctamente.

Formato general señaló JSONs generados de Impeccable; fueron normalizados y `pnpm format:check` posterior terminó0 («All matched files use Prettier code style!»), log `/private/tmp/0208-format-final.log`. El cache del hook se regenera y puede volver a señalar formato, sin pertenecer a la UI enviada. La suitee2e general no empezó: intentó abrir otro Nextdev de consumer en la misma carpeta donde sigue el servidor3200 del owner. No se apagó ese servidor; la suite específica usa fixture independiente y11/11 pasó.

`pnpm verify` terminóROJO: no se presenta una corrida completa verde. Antes de publicación, cerrar la suitee2e general en un ambiente sin la colisión de Next. Formato y el único test fallido de copy ya se confirmaron verdes por separado. No se repitió la suite global tras corregir los controles puntuales.

## Cierre de merge solicitado por el owner

UI y evidencia guardadas en `04159ea6f99dc86c722afee2b67be12dbe0820f1`. El owner autorizó merge local a main. Checkout aislado `/private/tmp/checkpass-wallet-0208-merge`, dependencias319 reutilizadas offline y entornos locales copiados sin mostrar valores; servidores del checkout habitual intactos.

La verificación frente a main detectó un fallo de preparación del test de la landing: imágenes lazy medidas sin activar su carga. Se añadió `scrollIntoViewIfNeeded` en `tests/e2e/landing.spec.ts`, sin modificar la landing ni aflojar la aserción, commit `0ddf72ae7702f35d10d3b6fe28ca2d98439bb563`. Diagnóstico de navegador confirmó200 y ancho natural positivo de las tres imágenes; prueba específica posterior1/1 pasó. Los intentos locales anteriores se mantienen en sus logs.

Confirmación final bajo configuración CI existente (un worker y reintentos acotados): `CI=true pnpm verify --base main`, salida0 y **verify: ok**. Log `/private/tmp/0208-merge-verify-ci.log`.

| Gate | Resultado | Segundos |
|---|---|---|
| typecheck | ok |2.2|
| lint | ok |6.9|
| ui-guard | ok |0.6|
| format:check | ok |8.0|
| test | ok |40.3|
| build | ok |24.7|
| test:e2e | ok |216.8|
| neon related merchant | ok |5.8|
| neon related consumer | ok |3.2|

Unit generales2530pasaron/1091saltados. E2E384planificados,322pasaron/62saltados según la configuración CI; sin anotaciones de errores/flaky. Relacionados vía tools/neon-test.sh: merchant7/7 y consumer19/19, URLsCI protegidas. No se probó la base de producción.

Main local avanzó `7f2d757` → `0ddf72a` por fast-forward desde el checkout aislado; SHA main/dev confirmado idéntico. Cierre documental se incorpora con otro fast-forward. Checkout habitual sigue dev; servidores y archivos locales ajenos preservados. Sin push/deploy. No se repiten suites para este cierre solo documental.

## Entrega inicial (histórico)

Cambios locales sin commit de implementación, merge, push ni deploy. Reserva de spec0208: `3b3af23`. Diseño aprobado; pendiente cierre de gates generales y publicación solicitada aparte. Los next-env.d.ts generados por build se restauran a la versión inicial; los servidores locales del owner permanecen.
