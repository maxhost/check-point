import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, magicLink } from "better-auth/plugins";
import { getDb } from "@mi-pasaporte/db";
import { loginCodeEmail } from "./email/login-code-email";
import { magicLinkEmail } from "./email/magic-link-email";
import { emailChannelFromEnv } from "@mi-pasaporte/domain/server/email/provider";
import * as schema from "@mi-pasaporte/db/schema";

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
    // Spec 0067 §2 / ADR 0070 §4: la identidad del merchant NO tiene contraseña. El owner
    // se da de alta en `POST /api/onboarding/signup` (spec 0155) y vuelve con un link
    // magico; el staff entra con `handle@slug` + PIN por ruta propia. Sin `emailAndPassword`
    // better-auth deja de montar `/sign-in/email` y `/sign-up/email` —pinneado en
    // `merchant-auth-disabled-paths.test.ts`— y `revokeSessionsOnPasswordReset` deja de
    // existir junto con el arco de recuperacion, que esta spec borra entero (§5).
    // Spec 0068 §4: el plugin de OTP por email se BORRO. Existia solo para el reset de
    // contraseña —su unico `type` atendido era `forget-password`— y ese arco se borro
    // entero en la 0067, asi que era configuracion muerta que igual publicaba 16
    // endpoints de OTP/password en la instancia. El oraculo de que no vuelve se asevera
    // sobre la INSTANCIA y no sobre un 404: `merchant-auth-disabled-paths.test.ts`.
    // Spec 0202 / ADR 0137: VUELVE, ahora para el LOGIN del owner (codigo de 6 digitos en vez
    // de link, para entrar desde la PWA instalada en iPhone). Solo se usa por `auth.api.*`
    // desde `api/merchant/auth/login` y `login/verify`; sus 9 paths HTTP van abajo.
    plugins: [
      emailOTP({
        otpLength: 6,
        // 10 minutos (owner 2026-10-11, ADR 0137).
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        // Un email desconocido no crea cuenta: el alta vive solo en `onboarding/signup`.
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          // Solo el login emite codigos. Otro tipo es un camino que nadie deberia abrir:
          // falla ruidoso en vez de mandar un mail que no corresponde.
          if (type !== "sign-in")
            throw new Error(`email-otp: tipo no atendido (${type}).`);
          const { subject, html, text } = loginCodeEmail(otp);
          await emailChannelFromEnv().sendEmail({
            to: email,
            subject,
            html,
            text,
          });
        },
      }),
      magicLink({
        // 15 minutos: el owner abre el mail en el momento. El token se consume una sola
        // vez (`consumeVerificationValue`, better-auth 1.6.26).
        expiresIn: 900,
        // El alta de cuentas vive en UN solo lugar: `POST /api/onboarding/signup`. Con
        // `disableSignUp: false` un token cuyo `user` fue borrado entre el envio y el
        // click crearia una cuenta por esta puerta, salteando el rate limit del alta.
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
    // Spec 0068 §4 dejo DOS al borrar `emailOTP`; la spec 0202 lo trae de vuelta y sus 9
    // paths vuelven a esta lista (ahora existen, asi que bloquearlos SI protege).
    disabledPaths: [
      // Spec 0067 §2: los DOS unicos endpoints que publica el plugin `magicLink`, medidos
      // en `dist/plugins/magic-link/index.mjs` (`createAuthEndpoint("/sign-in/magic-link")`
      // y `"/magic-link/verify"`). Por HTTP saltearian nuestro rate limit por IP y el
      // registro de intentos; el consumo va por ruta propia via `auth.api.*`.
      "/sign-in/magic-link",
      "/magic-link/verify",
      // Spec 0202 §D1: los NUEVE que publica `emailOTP`, medidos en
      // `better-auth@1.7.6/dist/plugins/email-otp/index.mjs`. Por HTTP saltearian el rate
      // limit, el tope de codigos equivocados y el corte de negocio `closed`.
      "/email-otp/send-verification-otp",
      "/email-otp/check-verification-otp",
      "/email-otp/verify-email",
      "/sign-in/email-otp",
      "/email-otp/request-password-reset",
      "/email-otp/reset-password",
      "/forget-password/email-otp",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
    ],
    secret,
    baseURL,
    trustedOrigins: Array.from(new Set([baseURL, ...extraOrigins])),
  });
}
