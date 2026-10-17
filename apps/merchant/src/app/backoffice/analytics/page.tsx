import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import {
  HISTORY_PERIODS,
  type HistoryPeriod,
} from "@mi-pasaporte/domain/analytics/history";
import { validDay } from "@mi-pasaporte/domain/analytics/date";
import AnalyticsConsole from "./analytics-console";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string }>;
}) {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("analytics"))
    redirect("/backoffice/counter");
  const query = await searchParams;
  return (
    <AnalyticsConsole
      initialDate={query.date && validDay(query.date) ? query.date : ""}
      initialPeriod={
        HISTORY_PERIODS.includes(query.period as HistoryPeriod)
          ? (query.period as HistoryPeriod)
          : "month"
      }
    />
  );
}
