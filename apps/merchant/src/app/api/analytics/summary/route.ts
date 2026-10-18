import { NextResponse } from "next/server";
import { requireApiPermissionSinGateDeEmail } from "../../../../server/api-permission";
import { apiOwnerFailureResponse } from "../../../../server/api-owner";
import {
  backofficeScopeFailure,
  privateBackofficeResponse,
} from "../../../../server/backoffice-scope-http";
import { readDashboardSummary } from "../../../../server/analytics/summary";

export async function GET(request: Request) {
  let response: Response;
  try {
    const auth = await requireApiPermissionSinGateDeEmail(request, "analytics");
    if ("failure" in auth) response = apiOwnerFailureResponse(auth.failure);
    else {
      const scope = await backofficeScopeFailure(request, auth.business.id);
      response =
        scope ??
        NextResponse.json(await readDashboardSummary(auth.business.id));
    }
  } catch {
    response = NextResponse.json(
      {
        code: "summary_unavailable",
        error: "No pudimos leer tus números. Intenta otra vez.",
      },
      { status: 503 },
    );
  }
  return privateBackofficeResponse(response);
}
