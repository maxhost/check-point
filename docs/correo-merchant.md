# Correo de acceso y verificación merchant

Los propietarios de negocios no usan contraseña. El login de `apps/merchant` manda un enlace mágico de un solo uso, válido 15 minutos. Al crear una cuenta nueva, `POST /api/merchant/auth/start` abre la sesión y solicita inmediatamente el correo de verificación. Si falla el envío, conserva la cuenta y muestra la opción de reintentar con `POST /api/merchant/auth/verify-email`.

## Configuración en producción

En el proyecto **merchant** de Vercel, configurar para Production:

| Variable | Valor |
| --- | --- |
| `BETTER_AUTH_URL` | `https://business.checkpass.club` (origen real donde vive merchant, sin barra final) |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Clave de Resend con permiso de envío, guardada como secreto del servidor |
| `EMAIL_FROM` | Remitente del dominio verificado, por ejemplo `CheckPass Club <acceso@checkpass.club>` |

El dominio usado por `EMAIL_FROM` debe estar verificado en Resend. Tras cambiar variables de entorno en Vercel, desplegar de nuevo el proyecto merchant para que las funciones lean los valores nuevos. Nunca guardar la clave en Git ni usar un prefijo `NEXT_PUBLIC_`.

## Comprobación de extremo a extremo

1. Con un email de prueba nuevo, entrar en «Crear cuenta». Debe aparecer el aviso «Revisá tu email» y llegar el enlace de verificación. El negocio puede completarse mientras llega el correo.
2. Abrir el enlace desde el email. Si aún no hay negocio, debe volver al onboarding; con un negocio existente, a `/backoffice` en `business.checkpass.club`.
3. Salir y, en «Iniciar sesión», pedir otro enlace con la misma dirección. Debe llegar y abrir el dashboard. Un email no registrado muestra la misma confirmación, pero no crea una cuenta ni envía correo.
4. Si no llega, revisar los logs de Vercel (`merchant_signup_verification_delivery_failed`, `merchant_login_link_failed`, `resend_email_rejected`) y el historial del mensaje en Resend. Un error de API aparece en los logs con estado y código; un mensaje aceptado que no llega requiere revisar eventos de entrega, rebotes o supresión en Resend.

La app ya contiene el adaptador HTTP de Resend en `apps/merchant/src/server/email/resend.ts`. La configuración de la cuenta, el dominio remitente y los secretos de producción requieren acceso a Vercel y Resend.

Referencias: [Resend, envío con Next.js](https://resend.com/docs/send-with-nextjs), [claves con permiso de envío](https://resend.com/changelog/new-api-key-permissions), [detalles de entrega](https://resend.com/changelog/improved-bounced-and-delivery-details).
