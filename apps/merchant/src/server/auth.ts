import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { getDb } from "./db";
import { magicLinkEmail } from "./email/channel";
import { emailChannelFromEnv } from "./email/provider";
import * as schema from "./schema";

export function getMerchantAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error(
      "Better Auth requiere BETTER_AUTH_SECRET y BETTER_AUTH_URL válidos.",
    );
  }
  // Trusted origins = the base URL plus any extra origins from env (comma-separated).
  // Lets a custom domain (checkpass.club), its www, and Vercel preview URLs be trusted
  // without a redeploy. Backward compatible: with no env set it is just [baseURL].
  // better-auth accepts wildcards, e.g. `https://*.vercel.app`.
  const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    // EL PERMISO DE ALTA (spec 0077 §2, ADR 0076 §2). `additionalFields` es config del
    // CORE, no un plugin: **no publica ni un endpoint** — un plugin sí lo haría por el
    // catch-all `api/auth/[...all]` (la lección de la spec 0046). Lo único que agrega es
    // que la columna `onboarding_grant_until` entre al esquema lógico de `session`, o sea
    // que el adapter la escriba al crear la sesión y `getSession` la devuelva.
    //
    // **`input: false` ES LA LÍNEA CRÍTICA DE SEGURIDAD DE ESTA SPEC.** Es lo que hace que
    // el campo no sea seteable desde ninguna entrada de la API: `parseInputData`
    // (better-auth 1.6.26, `dist/db/schema.mjs:59-77`) tira `BAD_REQUEST` —
    // «onboardingGrantUntil is not allowed to be set»— en cuanto un cuerpo lo trae con un
    // valor. Sin ella el permiso pasaría a ser lo que el ADR 0076 descarta explícitamente:
    // un claim aceptado desde el cliente. El oráculo está en `onboarding-grant.test.ts`.
    //
    // No afecta a la escritura del servidor: `internalAdapter.createSession` NO pasa por
    // `parseSessionInput` (medido: sólo `parseSessionOutput`, en la lectura).
    session: {
      additionalFields: {
        onboardingGrantUntil: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },
    // Spec 0067 §2 / ADR 0070 §4: la identidad del merchant NO tiene contraseña. El owner
    // entra escribiendo su email (`POST /api/merchant/auth/start`) y vuelve con un link
    // magico; el staff entra con `handle@slug` + PIN por ruta propia. Sin `emailAndPassword`
    // better-auth deja de montar `/sign-in/email` y `/sign-up/email` —pinneado en
    // `merchant-auth-disabled-paths.test.ts`— y `revokeSessionsOnPasswordReset` deja de
    // existir junto con el arco de recuperacion, que esta spec borra entero (§5).
    // Spec 0068 §4: el plugin de OTP por email se BORRO. Existia solo para el reset de
    // contraseña —su unico `type` atendido era `forget-password`— y ese arco se borro
    // entero en la 0067, asi que era configuracion muerta que igual publicaba 16
    // endpoints de OTP/password en la instancia. El oraculo de que no vuelve se asevera
    // sobre la INSTANCIA y no sobre un 404: `merchant-auth-disabled-paths.test.ts`.
    plugins: [
      magicLink({
        // 15 minutos: el owner abre el mail en el momento. El token se consume una sola
        // vez (`consumeVerificationValue`, better-auth 1.6.26).
        expiresIn: 900,
        // El alta de cuentas vive en UN solo lugar: `POST /api/merchant/auth/start`. Con
        // `disableSignUp: false` un token cuyo `user` fue borrado entre el envio y el
        // click crearia una cuenta por esta puerta, salteando el rate limit de `start`.
        disableSignUp: true,
        // El link NO apunta al endpoint de better-auth —esta en `disabledPaths`— sino a
        // nuestra ruta `GET /api/merchant/auth/magic-link`, que es la que consume el
        // token via `auth.api.magicLinkVerify` (`auth.api.*` no pasa por `disabledPaths`).
        sendMagicLink: async ({ email, token }) => {
          const url = new URL("/api/merchant/auth/magic-link", baseURL);
          url.searchParams.set("token", token);
          const { subject, html, text } = magicLinkEmail(url.toString());
          await emailChannelFromEnv().sendEmail({
            to: email,
            subject,
            html,
            text,
          });
        },
      }),
    ],
    // El catch-all `/api/auth/[...all]` publica TODO endpoint que un plugin agregue, y
    // esos saltean nuestro gate, el rate limit persistente, el chequeo de staff
    // desactivado y el registro de intentos — una puerta con llave al lado de una pared
    // abierta.
    //
    // Lo aplica el `onRequest` del router HTTP (better-auth 1.6.26,
    // `dist/api/index.mjs`: un path deshabilitado contesta 404), que NO afecta a las
    // llamadas server-side `auth.api.*` que hacen nuestras rutas.
    //
    // Spec 0068 §4: quedan DOS. Los 9 del plugin de OTP por email se fueron con el plugin
    // — sin el, esos paths dan 404 por INEXISTENTES, no por bloqueados, y listarlos aca
    // seria una proteccion vacua.
    disabledPaths: [
      // Spec 0067 §2: los DOS unicos endpoints que publica el plugin `magicLink`, medidos
      // en `dist/plugins/magic-link/index.mjs` (`createAuthEndpoint("/sign-in/magic-link")`
      // y `"/magic-link/verify"`). Por HTTP saltearian nuestro rate limit por IP y el
      // registro de intentos; el consumo va por ruta propia via `auth.api.*`.
      "/sign-in/magic-link",
      "/magic-link/verify",
    ],
    secret,
    baseURL,
    trustedOrigins: Array.from(new Set([baseURL, ...extraOrigins])),
  });
}
