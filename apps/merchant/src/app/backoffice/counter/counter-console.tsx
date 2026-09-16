"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { QrScanner } from "./qr-scanner";
import { CounterHome } from "./counter-home";
import { Console, DoneStage, LocationGate, ResolvedStage } from "./stages";
import { postRedeem } from "./redeem-panel";
import { postCouponRedeem } from "./coupon-panel";
import { addLine, changeQuantity, setLineUnitPrice } from "./cart";
import {
  type AccreditationRow,
  type CartLine,
  type CounterLocation,
  type CouponRedeemResponse,
  type GrantResponse,
  type Mode,
  type RedeemResponse,
  type ResolveResponse,
  canRedeem,
} from "./types";

type Stage = "idle" | "scanning" | "resolved" | "done";

const JSON_HEADERS = { "content-type": "application/json" };

export function CounterConsole({
  currencyCode,
  operatorName,
  history,
  locations,
  preselectedLocationId,
}: {
  currencyCode: string;
  operatorName: string;
  history: AccreditationRow[];
  locations: CounterLocation[];
  preselectedLocationId?: string;
}) {
  const router = useRouter();
  const soleLocation = locations.length === 1 ? locations[0].id : null;
  const validPreselect =
    preselectedLocationId &&
    locations.some((l) => l.id === preselectedLocationId)
      ? preselectedLocationId
      : null;
  const [locationId, setLocationId] = useState<string | null>(
    validPreselect ?? soleLocation,
  );

  const [stage, setStage] = useState<Stage>("idle");
  const [scanKey, setScanKey] = useState(0);
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [mode, setMode] = useState<Mode>("detailed");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<GrantResponse | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<RedeemResponse | null>(null);
  const [couponRedeemed, setCouponRedeemed] =
    useState<CouponRedeemResponse | null>(null);
  // A SEPARATE id from `requestId`: `(business_id, client_request_id)` is unique per
  // table, so reusing one key across a sale and a coupon in the same scan would make a
  // retry of either indistinguishable from the other in the two logs.
  const [couponRequestId, setCouponRequestId] = useState("");

  const reset = useCallback(() => {
    setResolved(null);
    setCart([]);
    setAmount("");
    setNote("");
    setResult(null);
    setSelectedRewardId(null);
    setRedeemed(null);
    setCouponRedeemed(null);
    setCouponRequestId("");
    setError(null);
    setNotice(null);
    setMode("detailed");
    setRequestId("");
    setStage("idle");
    setScanKey((k) => k + 1);
    // Re-run the server component so the day history reflects the fresh accreditation.
    router.refresh();
  }, [router]);

  const onDecode = useCallback(async (qrToken: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/counter/resolve", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ qrToken }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || !("membership" in payload)) {
        throw new Error(payload?.error ?? "No pudimos resolver el código.");
      }
      const data = payload as ResolveResponse;
      setResolved(data);
      setRequestId(crypto.randomUUID());
      setCouponRequestId(crypto.randomUUID());
      setMode(data.catalog.products.length > 0 ? "detailed" : "quick");
      setStage("resolved");
      setNotice(
        data.membership.justEnrolled
          ? "Cliente identificado · nuevo miembro"
          : "Cliente identificado",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el código.");
      setScanKey((k) => k + 1); // remount the scanner to try again
    } finally {
      setBusy(false);
    }
  }, []);

  const canConfirm =
    !busy &&
    (mode === "redeem"
      ? canRedeem(resolved, selectedRewardId)
      : mode === "detailed"
        ? cart.length > 0 &&
          cart.every((l) => l.hasStoredPrice || l.unitPrice > 0)
        : Number(amount) > 0);

  async function confirm() {
    if (!canConfirm || !resolved) return;
    setBusy(true); // disables Confirm on the first tap (UI layer of idempotency)
    setError(null);
    try {
      if (mode === "redeem") {
        // Same `clientRequestId` as a grant would use: minted once per scan. The
        // server's locked transaction is the real idempotency; this is layer two.
        setRedeemed(
          await postRedeem({
            clientRequestId: requestId,
            membershipId: resolved.membership.id,
            rewardId: selectedRewardId,
            locationId,
          }),
        );
        setStage("done");
        return;
      }
      const res = await fetch("/api/counter/grant", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          clientRequestId: requestId,
          membershipId: resolved.membership.id,
          mode,
          total: mode === "quick" ? amount : undefined,
          note: note.trim() || undefined,
          locationId,
          items:
            mode === "detailed"
              ? cart.map((l) => ({
                  productId: l.productId,
                  quantity: l.quantity,
                  unitPrice: l.hasStoredPrice ? undefined : String(l.unitPrice),
                }))
              : undefined,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload || !("order" in payload)) {
        throw new Error(payload?.error ?? "No pudimos acreditar.");
      }
      setResult(payload as GrantResponse);
      setStage("done");
    } catch (e) {
      const fallback =
        mode === "redeem" ? "No pudimos canjear." : "No pudimos acreditar.";
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The coupon is NOT one of the three modes: it has no cart, no reward to choose and no
   * balance to debit, so it does not go through `confirm()`. It is its own button, and
   * `busy` is what makes a double tap harmless on top of the server's locked transaction.
   */
  async function confirmCoupon() {
    if (busy || !resolved?.coupon) return;
    setBusy(true);
    setError(null);
    try {
      setCouponRedeemed(
        await postCouponRedeem({
          clientRequestId: couponRequestId,
          turnId: resolved.coupon.turnId,
          locationId,
        }),
      );
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos canjear el cupón.");
    } finally {
      setBusy(false);
    }
  }

  const dismissError = () => setError(null);
  const dismissNotice = () => setNotice(null);

  if (stage === "idle") {
    return (
      <CounterHome
        operatorName={operatorName}
        history={history}
        onScan={() => setStage("scanning")}
      />
    );
  }

  if (locations.length > 1 && !locationId) {
    return (
      <Console error={error} onDismissError={dismissError}>
        <LocationGate locations={locations} onPick={setLocationId} />
      </Console>
    );
  }

  return (
    <Console
      error={error}
      onDismissError={dismissError}
      notice={notice}
      onDismissNotice={dismissNotice}
    >
      {stage === "scanning" && (
        <section className="counter-panel">
          <QrScanner key={scanKey} onDecode={onDecode} />
          {busy && <p className="counter-hint">Resolviendo…</p>}
        </section>
      )}

      {stage === "resolved" && resolved && (
        <ResolvedStage
          resolved={resolved}
          currencyCode={currencyCode}
          mode={mode}
          setMode={setMode}
          cart={cart}
          onAdd={(product) => setCart((lines) => addLine(lines, product))}
          onQty={(id, delta) =>
            setCart((lines) => changeQuantity(lines, id, delta))
          }
          onLinePrice={(id, value) =>
            setCart((lines) => setLineUnitPrice(lines, id, value))
          }
          quick={{ amount, onAmount: setAmount, note, onNote: setNote }}
          selectedRewardId={selectedRewardId}
          onSelectReward={setSelectedRewardId}
          busy={busy}
          canConfirm={canConfirm}
          onConfirm={confirm}
          onCancel={reset}
          onRedeemCoupon={() => void confirmCoupon()}
        />
      )}

      {stage === "done" && resolved && (
        <DoneStage
          result={result}
          redeemed={redeemed}
          couponRedeemed={couponRedeemed}
          displayName={resolved.consumer.displayName}
          onNext={reset}
        />
      )}
    </Console>
  );
}
