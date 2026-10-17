import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../../../server/api-owner";
import { requireApiPermission } from "../../../../../server/api-permission";
import { readAnalyticsCustomer } from "../../../../../server/customers/analytics-detail";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission(request, "counter", {
    missingPermission: "No tienes permiso para ver los clientes.",
    emailNotVerified: "Verifica tu email para ver los clientes.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const customer = await readAnalyticsCustomer(
    auth.business.id,
    (await context.params).id,
  );
  return customer
    ? NextResponse.json(customer)
    : NextResponse.json(
        { code: "customer_not_found", error: "No encontramos ese cliente." },
        { status: 404 },
      );
}
