-- Spec 0067 §5 — el arco de recuperacion de contraseña se BORRA entero: sin contraseña no
-- hay nada que recuperar. `merchant_auth.password_reset_attempt` era su libro de intentos y
-- su fuente de rate limit; su unico lector (`server/recovery/*`) desaparece en esta misma
-- spec. El rate limit del alta se muda a `auth_start_attempt` (migracion 0034).
-- CASCADE lo pone drizzle-kit: la tabla no tiene dependientes, no hay dato que arrastre.
DROP TABLE "merchant_auth"."password_reset_attempt" CASCADE;
