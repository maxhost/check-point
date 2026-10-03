import { after } from "next/server";
import { decideCrossSale } from "@mi-pasaporte/domain/server/marketing/cross-sale";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { dispatchGranted } from "../wallet/push";
import type { GrantedOrder } from "./orders";

/**
 * WHAT RUNS AFTER AN ACCREDITATION (spec 0143 §1), apart from `grant.ts` for its size
 * budget. The transactional push, as before (`dispatchGranted`, ADR 0037) — and, ONLY when
 * THIS call created the order (`pushQueueId !== null`: a retry or the reread of the race's
 * loser brings it null), the cross sale's decision (`decideCrossSale`, ADR 0117), with the
 * same `after()` and the same inline fallback as `dispatchGranted`.
 *
 * Best-effort: it never throws nor delays the counter's response. A failed decision is
 * logged and that opportunity is lost (declared, spec 0143 §1). With `cross` switched off
 * it does nothing (`enabled-campaigns.ts`).
 */
export function afterGrant(granted: GrantedOrder): void {
  dispatchGranted(granted.pushQueueId);
  if (granted.pushQueueId === null) return;
  if (!campaignKindEnabled("cross")) return;
  const orderId = granted.id;
  const run = () =>
    decideCrossSale(orderId).then(
      () => undefined,
      (error: unknown) =>
        console.error("[cross-sale] decision failed", orderId, error),
    );
  try {
    after(run);
  } catch {
    void run();
  }
}
