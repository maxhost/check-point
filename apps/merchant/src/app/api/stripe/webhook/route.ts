import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import { stripeWebhookEvents, subscriptions } from "../../../../server/schema";
import {
  getStripeClient,
  getStripeConfiguration,
} from "../../../../server/stripe-config";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  let stripe: Stripe;
  let secret: string | undefined;
  try {
    const configuration = getStripeConfiguration();
    stripe = getStripeClient(configuration);
    secret = configuration.webhookSecret;
  } catch {
    return new NextResponse("Webhook no configurado.", { status: 400 });
  }
  if (!secret || !signature)
    return new NextResponse("Webhook no configurado.", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new NextResponse("Firma inválida.", { status: 400 });
  }

  const db = getDb();
  const inserted = await db
    .insert(stripeWebhookEvents)
    .values({
      eventId: event.id,
      eventType: event.type,
      payloadVersion: event.api_version ?? "unknown",
    })
    .onConflictDoNothing()
    .returning({ eventId: stripeWebhookEvents.eventId });
  if (!inserted.length)
    return NextResponse.json({ received: true, duplicate: true });

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const businessId = subscription.metadata.businessId;
    if (businessId) {
      const status =
        subscription.status === "active" || subscription.status === "trialing"
          ? "active"
          : subscription.status;
      await db
        .update(subscriptions)
        .set({
          plan: "plus",
          interval:
            subscription.metadata.interval === "year" ? "year" : "month",
          status,
          stripeCustomerId: String(subscription.customer),
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.businessId, businessId));
    }
  }
  await db
    .update(stripeWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeWebhookEvents.eventId, event.id));
  return NextResponse.json({ received: true });
}
