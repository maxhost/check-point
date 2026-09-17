import { text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses } from "./business";

// Spec 0069: `subscription` y `stripe_webhook_event` salieron de `schema/business.ts`
// porque ese archivo llego al limite del hook `file-size` (300 lineas) al sumarle
// `category_gcid` — mismo motivo por el que `staff-pin.ts` ya vive aparte. El barrel
// `server/schema.ts` las reexporta, asi que ningun `from "./schema"` cambia.

export const subscriptions = core.table(
  "subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    interval: text("interval"),
    status: text("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    /** Spec 0063, D3. «El tope tiene que caer» — lo dice STRIPE, y por eso no sirve como
     * discriminante de intención: el botón «Cancel subscription» del dashboard lo produce
     * igual que nuestra ruta. NULL = sin baja programada. Hoy solo toma `'free'`. */
    pendingPlan: text("pending_plan"),
    /** Cuándo se aplica la baja programada; es lo que la UI muestra. */
    pendingPlanAt: timestamp("pending_plan_at", { withTimezone: true }),
    /** Spec 0063, D3 / [R2-1]. «Esta baja la pedimos NOSOTROS»: lo escriben SOLO nuestras
     * rutas (`cancel` lo pone; `resume` y `settle-free` lo limpian). El webhook nunca lo
     * pone — solo lo limpia en la rama incondicional de D5.f. Sin esta columna, un
     * `deleted` originado en el dashboard se clasificaba «esperado» y aterrizaba en `free`
     * con 3 locales activos, el estado que la spec entera existe para prohibir. */
    downgradeRequestedAt: timestamp("downgrade_requested_at", {
      withTimezone: true,
    }),
    /** `created` del último evento de Stripe APLICADO (guard de orden, D5.h). */
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_subscription_customer_unique").on(table.stripeCustomerId),
    uniqueIndex("core_subscription_stripe_unique").on(
      table.stripeSubscriptionId,
    ),
    /** Spec 0063, D3. Todos los lectores usan `.limit(1)` SIN `orderBy`: con dos filas por
     * negocio, cuál gana es indefinido — y desde esta spec eso significa «el tope efectivo
     * es indefinido». Verificado en prod: 0 duplicados, así que es seguro de aplicar. */
    uniqueIndex("core_subscription_business_unique").on(table.businessId),
  ],
);

export const stripeWebhookEvents = core.table("stripe_webhook_event", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  payloadVersion: text("payload_version").notNull(),
  /** Spec 0063, D3. Por qué un evento se marcó procesado SIN efecto. Hoy un `invoice.paid`
   * ignorado y un evento aplicado quedan indistinguibles en la base, y en prod ya llegaron
   * de los dos tipos. Vocabulario cerrado en `billing/derive.ts` (`IgnoredReason`). */
  ignoredReason: text("ignored_reason"),
});
