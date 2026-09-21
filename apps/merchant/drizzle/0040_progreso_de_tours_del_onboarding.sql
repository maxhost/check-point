-- Spec 0084 (ADR 0078 §2-3) — EL PROGRESO DE LOS TOURS DEL ONBOARDING.
--
-- La PRIMERA tabla de escritura del onboarding. Hasta acá el checklist era lectura pura,
-- porque «vi un tour» NO es un hecho derivable de ninguna tabla de dominio: no hay una sola
-- columna de «visto» en el schema y `loyalty_program.updated_at` es `defaultNow()` **sin**
-- `$onUpdate`, así que «revisé mi programa y no cambié nada» no deja rastro.
--
-- SOLO DDL: **no siembra ni una fila.** Un tour sin `POST` simplemente no tiene fila, su
-- `done` queda en `false` y no traba a nadie (ningún tour es `blocking`).
--
-- PK compuesta `(business_id, tour_id)` y **sin `user_id`**: el progreso es POR NEGOCIO,
-- decisión textual del owner (ADR 0078 §3), tomada con la alternativa a la vista. Esa PK es
-- lo que hace idempotente al upsert (`on conflict (business_id, tour_id)`) y su PREFIJO ya
-- sirve la única lectura prevista (por `business_id`, spec 0085): por eso no hay índice extra.
--
-- `status` es texto con `CHECK`, la convención de `core` (`business.status`,
-- `business_membership.status`): no hay enums de PG en este schema.
--
-- El `IF NOT EXISTS` sigue la letra de la spec y hace que un `CREATE` sobre una base que ya
-- tiene la tabla no reviente. **No convierte al archivo entero en re-ejecutable**: el
-- `ADD CONSTRAINT` de la FK que va abajo es el de `drizzle-kit generate` y volvería con
-- `42710` si la constraint ya existiera. La idempotencia real la da `drizzle-kit migrate`,
-- que lleva su propia tabla `drizzle.__drizzle_migrations` y no re-aplica una migración.
CREATE TABLE IF NOT EXISTS "core"."business_onboarding_tour" (
	"business_id" uuid NOT NULL,
	"tour_id" text NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_onboarding_tour_business_id_tour_id_pk" PRIMARY KEY("business_id","tour_id"),
	CONSTRAINT "business_onboarding_tour_status_check" CHECK ("core"."business_onboarding_tour"."status" in ('completed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "core"."business_onboarding_tour" ADD CONSTRAINT "business_onboarding_tour_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
