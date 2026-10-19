import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Button } from "../../../apps/merchant/src/ui";
import { createPosClient } from "../../../apps/merchant/src/modules/pos/ui/pos-context";
import { useMeasuredPrinting } from "../../../apps/merchant/src/modules/pos/ui/measured-printing";
import { MeasuredTicket } from "../../../apps/merchant/src/modules/pos/ui/measured-ticket";
import { ticketOrder, closedTicket } from "./pos-measured-ticket-fixture";
const params = new URLSearchParams(location.search);
let identity = "a";
const client = createPosClient(
  () => ({ identity, scopeKey: identity.repeat(64) }),
  { contractVersion: 2 },
);
declare global {
  interface Window {
    ticketTest: {
      mode: string;
      delay: number;
      choices: number;
      writes: number;
      browsers: number;
      stacks: string[];
      inGesture: boolean;
      gestures: boolean[];
      stale: null | { print: () => Promise<void>; choose: () => Promise<void> };
    };
  }
}
const probe = (window.ticketTest = {
  mode: params.has("unsupported") ? "unsupported" : "ok",
  delay: 0,
  choices: 0,
  writes: 0,
  browsers: 0,
  stacks: [],
  inGesture: false,
  gestures: [] as boolean[],
  stale: null,
} as Window["ticketTest"]);
for (const event of ["pointerup", "keyup", "click"])
  document.addEventListener(
    event,
    () => {
      probe.inGesture = true;
      queueMicrotask(() => {
        probe.inGesture = false;
      });
    },
    true,
  );
window.print = () => {
  probe.browsers++;
};
Object.defineProperty(navigator, "serial", {
  value: undefined,
  configurable: true,
});
Object.defineProperty(navigator, "bluetooth", {
  configurable: true,
  value:
    probe.mode === "unsupported"
      ? undefined
      : {
          async requestDevice() {
            probe.gestures.push(navigator.userActivation.isActive);
            probe.stacks.push(new Error().stack ?? "");
            probe.choices++;
            if (probe.delay)
              await new Promise((resolve) => setTimeout(resolve, probe.delay));
            if (probe.mode === "cancelled")
              throw new DOMException("Cancelado", "NotFoundError");
            if (probe.mode === "not_found")
              throw new DOMException("No disponible", "NetworkError");
            return {
              name: "Fixture printer",
              gatt: {
                async connect() {
                  return {
                    async getPrimaryService() {
                      return {
                        async getCharacteristics() {
                          return [
                            {
                              properties: {
                                write: true,
                                writeWithoutResponse: false,
                              },
                              async writeValueWithResponse() {
                                probe.writes++;
                                if (probe.mode === "write_failed")
                                  throw new Error("write failed");
                              },
                            },
                          ];
                        },
                      };
                    },
                  };
                },
                disconnect() {},
              },
            };
          },
        },
});
if (params.has("saved"))
  localStorage.setItem(
    "checkpass-printer",
    JSON.stringify({ transport: "ble", name: "Fixture printer" }),
  );

function View({
  context,
  prepare,
  order,
}: {
  context: string;
  prepare: boolean;
  order: typeof ticketOrder;
}) {
  const printing = useMeasuredPrinting({
    order,
    client,
    context,
    prepare,
    onError: () => {},
  });
  useEffect(() => {
    if (printing.doc && !probe.stale)
      probe.stale = { print: printing.print, choose: printing.choose };
  }, [printing]);
  return <MeasuredTicket order={order} printing={printing} />;
}
function Harness() {
  const [prepare, setPrepare] = useState(false);
  const [context, setContext] = useState(identity);
  const [visible, setVisible] = useState(true);
  const [order, setOrder] = useState(() =>
    params.has("closed")
      ? closedTicket(params.has("pass"))
      : params.has("voided")
        ? { ...ticketOrder, status: "voided" as const }
        : ticketOrder,
  );
  useEffect(() => {
    const changeIdentity = () =>
      flushSync(() => {
        identity = "b";
        setContext(identity);
      });
    const changeOrder = () =>
      flushSync(() =>
        setOrder((old) => ({
          ...old,
          id: "ticket-b",
          version: old.version + 1,
        })),
      );
    const changeVersion = () =>
      flushSync(() =>
        setOrder((old) => ({ ...old, version: old.version + 1 })),
      );
    const changeStatus = () =>
      flushSync(() => setOrder((old) => ({ ...old, status: "closed" })));
    const unmount = () => flushSync(() => setVisible(false));
    const events = {
      "test-identity": changeIdentity,
      "test-order": changeOrder,
      "test-version": changeVersion,
      "test-status": changeStatus,
      "test-unmount": unmount,
    };
    for (const [event, callback] of Object.entries(events))
      document.addEventListener(event, callback);
    return () => {
      for (const [event, callback] of Object.entries(events))
        document.removeEventListener(event, callback);
    };
  }, []);
  return (
    <>
      <div className="p-4 print:hidden">
        <Button onPress={() => setPrepare(true)}>Preparar ticket</Button>
      </div>
      {visible && <View context={context} prepare={prepare} order={order} />}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
