import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { merchantAuth } from "./_schemas";

/**
 * Spec 0067 §2 — libro de intentos de `POST /api/merchant/auth/start`, que es la fuente
 * del rate limit por IP.
 *
 * **Por que una tabla y no memoria:** el ADR 0070 §13 ya midio que el rate limit por
 * defecto de better-auth vive en un `Map` del proceso, y que en Vercel eso es por
 * instancia de lambda y se evapora. La misma razon por la que el arco de recuperacion
 * contaba desde la base (`merchant_auth.password_reset_attempt`, borrada con ese arco por
 * esta misma spec): un limite que no sobrevive al proceso no es un limite.
 *
 * **Por que hace falta el limite:** la spec §2 declara que `start` ES un oraculo de
 * existencia de cuenta —el flag `sent` lo dice— y lo acepta a cambio de acotar el volumen
 * desde una IP. Ademas es la unica puerta de ALTA de cuentas, asi que sin limite es una
 * fabrica de `user` vacios.
 *
 * Nunca guarda un token ni un secreto: quien pidio, desde donde (hasheado) y cuando.
 */
export const authStartAttempts = merchantAuth.table(
  "auth_start_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lowercased. En claro acá porque es la clave del límite; nunca va a un log. */
    email: text("email").notNull(),
    /** SHA-256 de la IP del cliente; null cuando ningún hop expuso una. */
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auth_start_attempt_email_created_idx").on(
      table.email,
      table.createdAt,
    ),
    index("auth_start_attempt_ip_created_idx").on(
      table.ipHash,
      table.createdAt,
    ),
  ],
);
