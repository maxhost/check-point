"use client";

import type { CounterCoupon, CouponRedeemResponse } from "./types";

/**
 * The campaign coupon at the counter (spec 0065 phase C). It is a BANNER above the three
 * modes and not a fourth tab, because it is not a way of doing the same operation: the
 * consumer either has a live coupon or does not, and when they do the operator has to see
 * it without looking for it — they have the phone in their hand.
 *
 * It only PAINTS. Whether the coupon may actually be handed over is re-decided under the
 * campaign's lock by `decideCouponRedemption`; this banner is the snapshot of the scan and
 * the campaign may have run out of cap since.
 */
export function CouponBanner({
  coupon,
  busy,
  onRedeem,
}: {
  coupon: CounterCoupon;
  busy: boolean;
  onRedeem: () => void;
}) {
  return (
    <section className="counter-coupon">
      <div>
        <p className="eyebrow">Cupón</p>
        <strong>{coupon.label}</strong>
        <span>
          {coupon.campaignName} · válido hasta {formatDay(coupon.windowEnd)}
        </span>
      </div>
      <button
        type="button"
        className="counter-primary"
        disabled={busy}
        onClick={onRedeem}
      >
        Canjear cupón
      </button>
    </section>
  );
}

/** `window_end` arrives as an ISO string over JSON (a `Date` does not survive
 * `JSON.stringify`), so the day is cut from the string and never re-parsed into a local
 * `Date` — that is what would move the expiry a day for anyone west of Greenwich. */
function formatDay(windowEnd: string): string {
  return windowEnd.slice(0, 10);
}

/** Done screen of a coupon: what to HAND OVER, big, and the manual restart (the console
 * never auto-advances — QA amendment of spec 0030). There is NO balance line: a coupon
 * does not touch `points_balance` nor `stamps_count`, and printing one would say it did. */
export function CouponDone({
  redeemed,
  displayName,
  onNext,
}: {
  redeemed: CouponRedeemResponse;
  displayName: string;
  onNext: () => void;
}) {
  return (
    <section className="counter-panel counter-done">
      <p className="counter-check" aria-hidden>
        ✓
      </p>
      <h2>Entregá</h2>
      <p className="counter-reward-delivered">{redeemed.coupon.label}</p>
      <p className="counter-hint">para {displayName}</p>
      <p className="counter-hint">
        El cupón no descuenta puntos ni sellos: el saldo queda igual.
      </p>
      <button type="button" className="counter-primary" onClick={onNext}>
        Escanear siguiente
      </button>
    </section>
  );
}

/**
 * `POST /api/counter/coupon-redeem`. The `clientRequestId` is minted once per scan,
 * exactly like the grant and the redemption: this is the SECOND layer of idempotency (the
 * button also disables on the first tap), never the first — the first one is the server's
 * locked transaction.
 *
 * ⚠️ It is a DIFFERENT id from the one the grant/redeem use, and that is not an oversight:
 * `(business_id, client_request_id)` is unique per TABLE, but reusing one key across a
 * sale and a coupon in the same scan would make a retry of either indistinguishable from
 * the other for anyone reading the two logs side by side.
 */
export async function postCouponRedeem(body: {
  clientRequestId: string;
  turnId: string;
  locationId: string | null;
}): Promise<CouponRedeemResponse> {
  const response = await fetch("/api/counter/coupon-redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("coupon" in payload)) {
    throw new Error(payload?.error ?? "No pudimos canjear el cupón.");
  }
  return payload as CouponRedeemResponse;
}
