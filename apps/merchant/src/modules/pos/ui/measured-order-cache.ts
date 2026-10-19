import type { PosHistoryV2, PosOrderV2, PosSummaryV2 } from "../contracts";
import { PosError } from "./pos-types";
import { detailKey, historyKey, tablesKey, type PosCache } from "./pos-cache";
import type { PosTable } from "./pos-tables";

// Close/void do not necessarily increment version; a terminal snapshot wins ties.
const statusRank = { open: 0, closed: 1, voided: 2 } as const;
const ahead = (
  a: Pick<PosOrderV2, "version" | "status">,
  b: Pick<PosOrderV2, "version" | "status">,
) =>
  a.version > b.version ||
  (a.version === b.version && statusRank[a.status] > statusRank[b.status]);

/** V2 writes share the console's PosCache and its epoch/generation guards. */
export class MeasuredOrderCache {
  constructor(
    readonly cache: PosCache,
    private readonly historyStatus: "active" | "voided",
  ) {}

  accept(
    order: PosOrderV2,
    options?: { historyWindow: { timeZone: string; now: Date } },
  ): PosOrderV2 {
    const key = detailKey(order.id);
    const previous = this.cache.peek<PosOrderV2>(key, true);
    const result = previous && ahead(previous, order) ? previous : order;
    const window = options?.historyWindow;
    const day = (date: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: window!.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    const inWindow =
      window && result.closedAt
        ? day(new Date(result.closedAt)) === day(window.now)
        : false;
    const history = this.cache.peek<PosHistoryV2>(historyKey, true);
    const existing =
      history &&
      [...history.open, ...history.closedToday].find(
        (item) => item.id === result.id,
      );
    this.cache.invalidate(key);
    // Also retire reads started after beginWrite, even without a cached list.
    this.cache.invalidate(historyKey, false);
    if (existing && ahead(existing, result)) {
      this.cache.put(key, result, false);
      throw new PosError(
        "Revisa la versión actual del pedido.",
        "cache_revision_ahead",
        undefined,
        undefined,
        409,
        { receivedOrder: order, summary: existing },
      );
    }
    this.cache.put(key, result);
    // Patch availability from the canonical order, without a GET after a write.
    for (const locationId of new Set([
      previous?.location?.id,
      result.location?.id,
    ])) {
      if (!locationId) continue;
      const tableCacheKey = tablesKey(locationId);
      const known = this.cache.peek<{ tables: PosTable[] }>(tableCacheKey);
      this.cache.invalidate(tableCacheKey);
      if (known)
        this.cache.put(tableCacheKey, {
          tables: known.tables.map((table) => ({
            ...table,
            openOrderId:
              result.status === "open" &&
              result.location?.id === locationId &&
              result.tableId === table.id
                ? result.id
                : table.openOrderId === result.id
                  ? null
                  : table.openOrderId,
          })),
        });
    }
    if (!history) return result;
    const valid = this.cache.peek(historyKey) !== null;
    // Match list V2's frozenSummaryTotals without importing server code or arithmetic.
    const gross = result.settlement?.gross ?? result.total;
    const net =
      result.status === "closed"
        ? (result.settlement?.collected ?? result.sale?.total ?? result.total)
        : null;
    const summary: PosSummaryV2 = {
      id: result.id,
      status: result.status,
      version: result.version,
      saleType: result.saleType,
      orderLabel: result.orderLabel,
      tableId: result.tableId,
      location: result.location,
      createdAt: result.createdAt,
      closedAt: result.closedAt,
      total: net ?? gross,
      lineCount: result.items.length,
      saleTotal: net,
    };
    const open = history.open.filter((item) => item.id !== result.id);
    const closedToday = history.closedToday.filter(
      (item) => item.id !== result.id,
    );
    if (result.status === "open" && this.historyStatus === "active")
      open.push(summary);
    // Recovery patches a known historical row, without guessing business-local 'today'.
    else if (
      result.status !== "open" &&
      (this.historyStatus === "active" || result.status === "voided") &&
      (window
        ? inWindow
        : history.closedToday.some((item) => item.id === result.id))
    )
      closedToday.push(summary);
    this.cache.put(
      historyKey,
      {
        open: open.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        closedToday,
      },
      valid &&
        (result.status === "open" ||
          (this.historyStatus === "voided" && result.status === "closed") ||
          history.closedToday.some((item) => item.id === result.id)),
    );
    return result;
  }
}
