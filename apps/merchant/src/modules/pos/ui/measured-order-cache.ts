import type { PosHistoryV2, PosOrderV2, PosSummaryV2 } from "../contracts";
import { PosError } from "./pos-types";
import { detailKey, historyKey, type PosCache } from "./pos-cache";

/** V2 writes share the console's PosCache and its epoch/generation guards. */
export class MeasuredOrderCache {
  constructor(
    readonly cache: PosCache,
    private readonly historyStatus: "active" | "voided",
  ) {}

  accept(order: PosOrderV2): PosOrderV2 {
    const key = detailKey(order.id);
    const previous = this.cache.peek<PosOrderV2>(key, true);
    const result =
      previous && previous.version > order.version ? previous : order;
    const history = this.cache.peek<PosHistoryV2>(historyKey, true);
    const existing =
      history &&
      [...history.open, ...history.closedToday].find(
        (item) => item.id === result.id,
      );
    this.cache.invalidate(key);
    if (existing && existing.version > result.version) {
      this.cache.put(key, result, false);
      this.cache.invalidate(historyKey, false);
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
    if (!history) return result;
    const valid = this.cache.peek(historyKey) !== null;
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
      total: result.total,
      lineCount: result.items.length,
      saleTotal: result.sale?.total ?? null,
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
      history.closedToday.some((item) => item.id === result.id)
    )
      closedToday.push(summary);
    this.cache.invalidate(historyKey, false);
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
