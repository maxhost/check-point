-- Spec 0184 / ADR 0133: que lleva el ticket impreso del POS, por comercio (bloques opcionales).
-- Sin fila = los defaults; ninguna opcion es obligatoria. Aditiva: el codigo viejo no la lee.
-- Grants: ninguno nuevo; `checkpass_consumer` no lee el ajuste del ticket.
CREATE TABLE "core"."ticket_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"show_business_name" boolean DEFAULT true NOT NULL,
	"show_table" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."ticket_settings" ADD CONSTRAINT "ticket_settings_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;