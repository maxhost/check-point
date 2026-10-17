import { AnalyticsAmountError } from "@mi-pasaporte/domain/analytics/money";
import { after, NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../api-owner";
import { requireApiPermissionSinGateDeEmail } from "../../api-permission";
import {
  actOnCard,
  evaluateBusiness,
  evaluateDueBusinesses,
  readInbox,
} from "../evaluation";
import { AnalyticsError, readDay, readHistory } from "../queries";
import {
  HISTORY_PERIODS,
  type HistoryPeriod,
} from "@mi-pasaporte/domain/analytics/history";
import { validDay } from "@mi-pasaporte/domain/analytics/date";
export async function inboxWithFallback(
  businessId: string,
  viewer: { role: string; permissions: readonly string[] },
) {
  const existing = await readInbox(businessId, viewer);
  if (existing.state === "ready") return existing;
  const pending = evaluateBusiness(businessId);
  after(async () => {
    await pending.catch((error) => {
      console.error(
        "Analytics evaluation failed",
        error instanceof Error ? error.name : "unknown",
      );
    });
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pending,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 3000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return readInbox(businessId, viewer, new Date(), true);
}
export function analyticsFailure(error: unknown) {
  if (error instanceof AnalyticsAmountError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 422 },
    );
  if (error instanceof AnalyticsError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  return NextResponse.json(
    {
      error: "No pudimos leer tus analíticas. Intenta otra vez.",
      code: "analytics_unavailable",
    },
    { status: 503 },
  );
}
async function authenticated(request: Request) {
  const auth = await requireApiPermissionSinGateDeEmail(request, "analytics");
  return "failure" in auth
    ? { response: apiOwnerFailureResponse(auth.failure) }
    : auth;
}
export async function inboxGET(request: Request) {
  const auth = await authenticated(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await inboxWithFallback(auth.business.id, auth));
  } catch (e) {
    return analyticsFailure(e);
  }
}
export async function cardPOST(
  request: Request,
  id: string,
  status: "accepted" | "dismissed",
) {
  const auth = await authenticated(request);
  if ("response" in auth) return auth.response;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
    return analyticsFailure(
      new AnalyticsError(
        404,
        "card_not_found",
        "No encontramos esa tarjeta de hoy.",
      ),
    );
  try {
    return NextResponse.json(
      await actOnCard(auth.business.id, auth.userId, id, status, auth),
    );
  } catch (e) {
    return analyticsFailure(e);
  }
}
export async function historyGET(request: Request) {
  const auth = await authenticated(request);
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams;
  const period = query.get("period") ?? "month";
  if (!(HISTORY_PERIODS as readonly string[]).includes(period))
    return analyticsFailure(
      new AnalyticsError(400, "invalid_period", "Elige un período válido."),
    );
  try {
    return NextResponse.json(
      await readHistory(
        auth.business.id,
        period as HistoryPeriod,
        query.get("locationId") || undefined,
      ),
    );
  } catch (e) {
    return analyticsFailure(e);
  }
}
export async function dayGET(request: Request) {
  const auth = await authenticated(request);
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams;
  const date = query.get("date") ?? "";
  if (!validDay(date))
    return analyticsFailure(
      new AnalyticsError(400, "invalid_date", "Elige una fecha válida."),
    );
  try {
    return NextResponse.json(
      await readDay(
        auth.business.id,
        date,
        query.get("locationId") || undefined,
      ),
    );
  } catch (e) {
    return analyticsFailure(e);
  }
}
export async function evaluateGET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthorized" },
      { status: 401 },
    );
  try {
    return NextResponse.json(await evaluateDueBusinesses());
  } catch (e) {
    return analyticsFailure(e);
  }
}
