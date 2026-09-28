import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";
import { listCustomers } from "../../../server/customers/list";
import {
  CustomerQueryError,
  parseCustomerQuery,
} from "../../../server/customers/query";

export const dynamic = "force-dynamic";

/**
 * GET /api/customers — the customer list of the caller's business (spec 0108, contract
 * `0108-contratos-de-api.md`). Owner and staff with `counter`; the guard's ladder is not
 * rewritten here. The business comes from the session, never from the request.
 */
export async function GET(request: Request) {
  const auth = await requireApiPermission(request, "counter", {
    missingPermission: "No tienes permiso para ver los clientes.",
    emailNotVerified: "Verificá tu email para ver los clientes.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    const query = parseCustomerQuery(new URL(request.url).searchParams);
    return NextResponse.json(await listCustomers(auth.business.id, query));
  } catch (error) {
    if (error instanceof CustomerQueryError)
      return NextResponse.json(
        { error: error.message, code: error.code, fields: error.fields },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos leer tus clientes." },
      { status: 503 },
    );
  }
}
