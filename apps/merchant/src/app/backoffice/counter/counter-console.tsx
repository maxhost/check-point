"use client";

import { useCallback, useEffect, useState } from "react";
import { QrScanner } from "./qr-scanner";
import { Console, DoneStage, LocationGate, ResolvedStage } from "./stages";
import {
  type CartLine,
  type CounterLocation,
  type CounterProduct,
  type GrantResponse,
  type ResolveResponse,
} from "./types";

type Stage = "scanning" | "resolved" | "done";
type Mode = "detailed" | "quick";

const JSON_HEADERS = { "content-type": "application/json" };

export function CounterConsole({
  currencyCode,
  locations,
  preselectedLocationId,
}: {
  currencyCode: string;
  locations: CounterLocation[];
  preselectedLocationId?: string;
}) {
  const soleLocation = locations.length === 1 ? locations[0].id : null;
  const validPreselect =
    preselectedLocationId &&
    locations.some((l) => l.id === preselectedLocationId)
      ? preselectedLocationId
      : null;
  const [locationId, setLocationId] = useState<string | null>(
    validPreselect ?? soleLocation,
  );

  const [stage, setStage] = useState<Stage>("scanning");
  const [scanKey, setScanKey] = useState(0);
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [mode, setMode] = useState<Mode>("detailed");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GrantResponse | null>(null);

  const reset = useCallback(() => {
    setResolved(null);
    setCart([]);
    setAmount("");
    setNote("");
    setResult(null);
    setError(null);
    setMode("detailed");
    setRequestId("");
    setStage("scanning");
    setScanKey((k) => k + 1);
  }, []);

  // Auto-restart to the scanner after a confirmed grant (spec 0030).
  useEffect(() => {
    if (stage !== "done") return;
    const timer = setTimeout(reset, 4000);
    return () => clearTimeout(timer);
  }, [stage, reset]);

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
      setMode(data.catalog.products.length > 0 ? "detailed" : "quick");
      setStage("resolved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el código.");
      setScanKey((k) => k + 1); // remount the scanner to try again
    } finally {
      setBusy(false);
    }
  }, []);

  function addProduct(product: CounterProduct) {
    setCart((lines) => {
      const found = lines.find((l) => l.productId === product.id);
      if (found) {
        return lines.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...lines,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.unitPrice ?? 0,
          hasStoredPrice: product.unitPrice !== null,
          quantity: 1,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((lines) =>
      lines
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function setLinePrice(productId: string, value: number) {
    setCart((lines) =>
      lines.map((l) =>
        l.productId === productId
          ? { ...l, unitPrice: Number.isFinite(value) && value > 0 ? value : 0 }
          : l,
      ),
    );
  }

  const canConfirm =
    !busy &&
    (mode === "detailed"
      ? cart.length > 0 &&
        cart.every((l) => l.hasStoredPrice || l.unitPrice > 0)
      : Number(amount) > 0);

  async function confirm() {
    if (!canConfirm || !resolved) return;
    setBusy(true); // disables Confirm on the first tap (UI layer of idempotency)
    setError(null);
    try {
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
      setError(e instanceof Error ? e.message : "No pudimos acreditar.");
    } finally {
      setBusy(false);
    }
  }

  const dismiss = () => setError(null);

  if (locations.length > 1 && !locationId) {
    return (
      <Console error={error} onDismiss={dismiss}>
        <LocationGate locations={locations} onPick={setLocationId} />
      </Console>
    );
  }

  return (
    <Console error={error} onDismiss={dismiss}>
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
          onAdd={addProduct}
          onQty={changeQty}
          onLinePrice={setLinePrice}
          quick={{ amount, onAmount: setAmount, note, onNote: setNote }}
          busy={busy}
          canConfirm={canConfirm}
          onConfirm={confirm}
          onCancel={reset}
        />
      )}

      {stage === "done" && result && resolved && (
        <DoneStage
          result={result}
          displayName={resolved.consumer.displayName}
          onNext={reset}
        />
      )}
    </Console>
  );
}
