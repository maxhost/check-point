import {
  backofficeScopeFailure,
  privateBackofficeResponse,
} from "../../backoffice-scope-http";
import { AnalyticsAmountError } from "@mi-pasaporte/domain/analytics/money";
import { ANALYTICS_POLICY } from "@mi-pasaporte/domain/analytics/policy/index";
import type { InboxDecision } from "@mi-pasaporte/domain/analytics/types";
import { parseAbsolute } from "@internationalized/date";
import { after, NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../api-owner";
import { requireApiPermissionSinGateDeEmail } from "../../api-permission";
import { evaluateBusiness, evaluateDueBusinesses } from "../evaluation";
import { cleanupInbox, decideInboxCard, readInbox } from "../lifecycle";
import { AnalyticsError, readDay, readHistory } from "../queries";
import {
  HISTORY_PERIODS,
  type HistoryPeriod,
} from "@mi-pasaporte/domain/analytics/history";
import { validDay } from "@mi-pasaporte/domain/analytics/date";
const cardIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
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
        timer = setTimeout(resolve, ANALYTICS_POLICY.operation.fallbackWaitMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return readInbox(businessId, viewer);
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
  return privateBackofficeResponse(await inboxResponse(request));
}
async function inboxResponse(request: Request) {
  try {
    const auth = await authenticated(request);
    if ("response" in auth) return auth.response;
    const scope = await backofficeScopeFailure(request, auth.business.id);
    if (scope) return scope;
    return NextResponse.json(await inboxWithFallback(auth.business.id, auth));
  } catch (e) {
    return analyticsFailure(e);
  }
}
export async function cardPOST(
  request: Request,
  id: string,
  decision: InboxDecision,
) {
  return privateBackofficeResponse(await cardResponse(request, id, decision));
}
async function cardResponse(
  request: Request,
  id: string,
  decision: InboxDecision,
) {
  try {
    const auth = await authenticated(request);
    if ("response" in auth) return auth.response;
    const scope = await backofficeScopeFailure(request, auth.business.id);
    if (scope) return scope;
    if (!cardIdPattern.test(id))
      return analyticsFailure(
        new AnalyticsError(404, "card_not_found", "No encontramos ese aviso."),
      );
    const body: unknown = await request.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("expectedVersion" in body) ||
      typeof body.expectedVersion !== "string" ||
      !body.expectedVersion.trim() ||
      !("operationId" in body) ||
      typeof body.operationId !== "string" ||
      !body.operationId.trim()
    )
      throw new AnalyticsError(
        422,
        "invalid_decision",
        "La decisión está incompleta. Revisa el aviso e intenta otra vez.",
      );
    let remindAt: string | undefined;
    if (decision === "snooze") {
      const raw = "remindAt" in body ? body.remindAt : null;
      try {
        if (typeof raw !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw))
          throw new Error("missing-zone");
        parseAbsolute(raw, "UTC");
        remindAt = raw;
      } catch {
        throw new AnalyticsError(
          422,
          "invalid_reminder",
          "Elige una fecha y hora válidas con zona horaria.",
        );
      }
    }
    return NextResponse.json(
      await decideInboxCard(
        {
          businessId: auth.business.id,
          actorId: auth.userId,
          cardId: id,
          decision,
          expectedVersion: body.expectedVersion,
          operationId: body.operationId,
          ...(remindAt ? { remindAt } : {}),
        },
        auth,
      ),
    );
  } catch (e) {
    return analyticsFailure(e);
  }
}
/** Old navigation clients cannot reinterpret a click as a lifecycle decision. */
export async function legacyCardPOST(request: Request, id: string) {
  const auth = await authenticated(request);
  if ("response" in auth) return auth.response;
  if (!cardIdPattern.test(id))
    return analyticsFailure(
      new AnalyticsError(404, "card_not_found", "No encontramos ese aviso."),
    );
  return analyticsFailure(
    new AnalyticsError(
      409,
      "inbox_contract_changed",
      "Los avisos se actualizaron. Recarga la página antes de decidir.",
    ),
  );
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
export async function cleanupGET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthorized" },
      { status: 401 },
    );
  try {
    return NextResponse.json(await cleanupInbox());
  } catch (error) {
    return analyticsFailure(error);
  }
}
