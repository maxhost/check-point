"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrScanner } from "./qr-scanner";
import { CounterHome } from "./counter-home";
import { Console, ResolvedStage } from "./stages";
import { LocationGate } from "./location-gate";
import { DoneStage } from "./done-stage";
import { postRedeem } from "./redeem-panel";
import { addLine, changeQuantity, setLineUnitPrice } from "./cart";
import {
  type AccreditationRow,
  type CartLine,
  type CounterLocation,
  type GrantResponse,
  type Mode,
  type RedeemResponse,
  type ResolveResponse,
  canRedeem,
  unitLabel,
} from "./types";

type Stage = "idle" | "scanning" | "resolved" | "coupon_done" | "done";

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
  const [couponRequestId, setCouponRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<GrantResponse | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<RedeemResponse | null>(null);
  const [couponProductId, setCouponProductId] = useState<string | null>(null);
  const [validatedLabel, setValidatedLabel] = useState<string | null>(null);
  const [validatedUnits, setValidatedUnits] = useState<number | null>(null);
  const [validatedKind, setValidatedKind] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "resolved" || !resolved) return;
    const membershipId = resolved.membership.id;
    let active = true;
    async function poll() {
      try {
        const response = await fetch(
          `/api/counter/coupon-state?membershipId=${encodeURIComponent(membershipId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.couponState)
          setResolved((current) =>
            current?.membership.id === membershipId
              ? { ...current, couponState: data.couponState }
              : current,
          );
      } catch {
        /* The next poll retries transient network failures. */
      }
    }
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [stage, resolved?.membership.id]);

  const reset = useCallback(() => {
    setResolved(null);
    setCart([]);
    setAmount("");
    setNote("");
    setResult(null);
    setSelectedRewardId(null);
    setRedeemed(null);
    setError(null);
    setNotice(null);
    setMode("detailed");
    setRequestId("");
    setCouponRequestId("");
    setCouponProductId(null);
    setValidatedLabel(null);
    setValidatedUnits(null);
    setValidatedKind(null);
    setStage("idle");
    setScanKey((k) => k + 1);
    // Re-run the server component so the day history reflects the fresh accreditation.
    router.refresh();
  }, [router]);

  const onDecode = useCallback(
    async (qrToken: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/counter/resolve", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ qrToken, locationId }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload || !("membership" in payload)) {
          throw new Error(payload?.error ?? "No pudimos resolver el código.");
        }
        const data = payload as ResolveResponse;
        setResolved(data);
        setCouponProductId(null);
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
    },
    [locationId],
  );

  const canConfirm =
    !busy &&
    (mode === "redeem" ||
      resolved?.couponState.status !== "selected" ||
      resolved.couponState.coupon.kind === "discount") &&
    (resolved?.couponState.status === "selected" ||
    resolved?.couponState.status === "validated"
      ? !(
          mode === "detailed" &&
          (resolved.couponState.coupon.kind === "free_product" ||
            resolved.couponState.coupon.kind === "two_for_one") &&
          !resolved.couponState.coupon.productId &&
          !couponProductId
        )
      : true) &&
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
          note:
            mode === "quick" &&
            (resolved.couponState.status === "selected" ||
              resolved.couponState.status === "validated") &&
            (resolved.couponState.coupon.kind === "free_product" ||
              resolved.couponState.coupon.kind === "two_for_one")
              ? [resolved.couponState.coupon.label, note.trim()]
                  .filter(Boolean)
                  .join(" · ")
              : note.trim() || undefined,
          locationId,
          coupon:
            resolved.couponState.status === "selected" ||
            resolved.couponState.status === "validated"
              ? {
                  couponId: resolved.couponState.coupon.couponId,
                  productId: mode === "detailed" ? couponProductId : null,
                }
              : undefined,
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

  async function couponAction(action: "validate" | "remove") {
    if (
      !resolved ||
      (resolved.couponState.status !== "selected" &&
        resolved.couponState.status !== "validated")
    )
      return;
    const coupon = resolved.couponState.coupon;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/counter/coupon-${action}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          membershipId: resolved.membership.id,
          couponId: coupon.couponId,
          ...(action === "validate"
            ? { clientRequestId: couponRequestId, locationId }
            : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "No pudimos actualizar el cupón.");
      if (action === "validate") {
        setValidatedLabel(data.coupon?.label ?? coupon.label);
        setValidatedUnits(data.coupon?.unitsGranted ?? null);
        setValidatedKind(coupon.kind);
        setResolved((current) =>
          current
            ? {
                ...current,
                couponState:
                  coupon.kind === "extra_stamps" ||
                  coupon.kind === "extra_points"
                    ? { status: "used_today", label: coupon.label }
                    : { status: "validated", coupon },
              }
            : current,
        );
        setStage("coupon_done");
      } else {
        setResolved((current) =>
          current ? { ...current, couponState: { status: "none" } } : current,
        );
        setCouponProductId(null);
        setNotice("Cupón quitado");
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos actualizar el cupón.",
      );
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
          onRepeat={() => {
            const products = new Map(
              resolved.catalog.products.map((product) => [product.id, product]),
            );
            setCart((lines) => {
              let next = lines;
              for (const item of resolved.catalog.lastPurchase?.items ?? []) {
                const product = products.get(item.productId);
                if (!product) continue;
                next = changeQuantity(
                  addLine(next, product),
                  product.id,
                  item.quantity - 1,
                );
              }
              return next;
            });
          }}
          quick={{ amount, onAmount: setAmount, note, onNote: setNote }}
          selectedRewardId={selectedRewardId}
          onSelectReward={setSelectedRewardId}
          couponProductId={couponProductId}
          onCouponProductId={setCouponProductId}
          onValidateCoupon={() => void couponAction("validate")}
          onRemoveCoupon={() => void couponAction("remove")}
          busy={busy}
          canConfirm={canConfirm}
          onConfirm={confirm}
          onCancel={reset}
        />
      )}

      {stage === "coupon_done" && resolved && (
        <section className="counter-panel counter-done">
          <p className="counter-check" aria-hidden>
            ✓
          </p>
          <h2>Oferta válida</h2>
          <p>{validatedLabel}</p>
          {validatedUnits !== null && validatedKind && (
            <p>
              +{validatedUnits}{" "}
              {unitLabel(
                validatedKind === "extra_stamps" ? "stamps" : "points",
                validatedUnits,
              )}
            </p>
          )}
          <div className="counter-actions">
            <button
              type="button"
              className="counter-primary"
              onClick={() => setStage("resolved")}
            >
              Continuar con el cliente
            </button>
            <button type="button" className="counter-secondary" onClick={reset}>
              Escanear otro
            </button>
          </div>
        </section>
      )}

      {stage === "done" && resolved && (
        <DoneStage
          result={result}
          redeemed={redeemed}
          displayName={resolved.consumer.displayName}
          currencyCode={currencyCode}
          couponKind={
            resolved.couponState.status === "selected" ||
            resolved.couponState.status === "validated"
              ? resolved.couponState.coupon.kind
              : undefined
          }
          onNext={reset}
        />
      )}
    </Console>
  );
}
