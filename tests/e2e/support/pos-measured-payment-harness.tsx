import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Button, Text } from "../../../apps/merchant/src/ui";
import { MeasuredCheckout } from "../../../apps/merchant/src/modules/pos/ui/measured-checkout";
import { MeasuredPaymentSession } from "../../../apps/merchant/src/modules/pos/ui/measured-payment-session";
import { PosCache } from "../../../apps/merchant/src/modules/pos/ui/pos-cache";
import { createPosClient } from "../../../apps/merchant/src/modules/pos/ui/pos-context";
import { paymentOrder } from "./pos-measured-payment-fixture";
import type { PosOrderV2 } from "../../../apps/merchant/src/modules/pos/contracts";
const params = new URLSearchParams(location.search);
let identity = "a";
const client = createPosClient(
  () => ({ identity, scopeKey: identity.repeat(64) }),
  { contractVersion: 2 },
);
const cache = new PosCache(undefined, client.request);
cache.bind(identity);
const order = structuredClone(paymentOrder);
if (params.has("mixture"))
  order.items.push({
    ...order.items[0],
    lineId: "second",
    name: "Café distinto",
    quantity: "1",
    unitPrice: "3",
    lineTotal: "3",
  });
if (params.has("cop")) order.business.currencyCode = "COP";
if (params.has("zero"))
  order.items.forEach((line) => {
    line.unitPrice = "0";
  });
let closedCount = 0;
let review: PosOrderV2 | null = null;
const session = new MeasuredPaymentSession(client, cache, {
  order,
  historyStatus: "active",
  timeoutMs: 100,
  onClosed: () => {
    closedCount++;
  },
  onReview: (order) => {
    review = order;
  },
});
function Harness() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const remount = () => setKey((value) => value + 1);
    const accept = () => {
      if (review) session.acceptReviewedOrder(review);
    };
    const changeIdentity = () => {
      identity = "b";
      session.retireIdentity();
      cache.bind(identity);
    };
    document.addEventListener("test-review", accept);
    document.addEventListener("test-identity", changeIdentity);
    document.addEventListener("test-remount", remount);
    return () => {
      document.removeEventListener("test-review", accept);
      document.removeEventListener("test-identity", changeIdentity);
      document.removeEventListener("test-remount", remount);
    };
  }, []);
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return (
    <>
      <div className="flex flex-wrap gap-3 p-4">
        <Button onPress={() => void session.prepare()}>Preparar cobro</Button>
        <Button
          onPress={() => {
            session.startScan();
            void session.resolve("explicit-pass");
          }}
        >
          Leer QR explícito
        </Button>
        <Button onPress={() => session.removeCustomer()}>
          Retirar persona
        </Button>
        <Button onPress={() => setKey(key + 1)}>Volver a montar vista</Button>
        <Button
          onPress={() => {
            if (session.canLeave) setKey(key + 1);
          }}
        >
          Salir de orden
        </Button>
        <Button
          onPress={() => {
            identity = "b";
            session.retireIdentity();
            cache.bind(identity);
          }}
        >
          Cambiar identidad
        </Button>
        <Button
          onPress={() => {
            if (review) session.acceptReviewedOrder(review);
          }}
        >
          Aceptar orden revisada
        </Button>
      </div>
      <MeasuredCheckout key={key} session={session} />
      <div role="status" aria-label="Sesión">
        <Text>
          {state.phase} · {state.resolved?.consumer.displayName ?? "Anónimo"} ·
          cierres {closedCount} · versión {state.order.version}
        </Text>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
