import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import { memberships } from "../../../../server/schema";
import {
  getStripeClient,
  getStripeConfiguration,
} from "../../../../server/stripe-config";

type Input = { businessId?: unknown; interval?: unknown };

export async function POST(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await request.json()) as Input;
  const businessId =
    typeof body.businessId === "string" ? body.businessId : null;
  const interval =
    body.interval === "year"
      ? "year"
      : body.interval === "month"
        ? "month"
        : null;
  if (!businessId || !interval)
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const [membership] = await getDb()
    .select({ businessId: memberships.businessId })
    .from(memberships)
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!membership)
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  let stripe;
  let price: string;
  try {
    const configuration = getStripeConfiguration();
    stripe = getStripeClient(configuration);
    price =
      interval === "month"
        ? configuration.monthlyPriceId
        : configuration.yearlyPriceId;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "El plan Plus aún no está configurado.",
      },
      { status: 503 },
    );
  }
  const origin = new URL(request.url).origin;
  const checkout = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: businessId,
      metadata: { businessId, interval },
      subscription_data: { metadata: { businessId, interval } },
      success_url: `${origin}/backoffice?checkout=success`,
      cancel_url: `${origin}/backoffice?checkout=cancelled`,
    },
    { idempotencyKey: `checkout:${businessId}:${interval}` },
  );
  return NextResponse.json({ url: checkout.url });
}
