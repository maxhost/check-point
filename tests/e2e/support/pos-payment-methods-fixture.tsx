import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Text } from "../../../apps/merchant/src/ui";
import { PosCheckout } from "../../../apps/merchant/src/modules/pos/ui/pos-checkout";
import { usePosPayment } from "../../../apps/merchant/src/modules/pos/ui/pos-payment";
import type { PosOrder } from "../../../apps/merchant/src/modules/pos/ui/pos-types";

function Fixture() {
  const scenario = new URLSearchParams(location.search).get("scenario");
  const [closed, setClosed] = useState(false);
  const [message, setMessage] = useState("");
  const cop = scenario === "cop";
  const order: PosOrder = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "open",
    version: 1,
    tableLabel: "Venta",
    note: null,
    location: null,
    business: { name: "Comercio de prueba", currencyCode: cop ? "COP" : "USD" },
    items: [
      {
        lineId: "11111111-1111-4111-8111-111111111111",
        productId: "product-first",
        name: "Servicio principal",
        unitPrice: cop ? "10.40" : "10.00",
        quantity: 1,
        lineTotal: cop ? "10.40" : "10.00",
      },
      ...(scenario === "targets"
        ? [
            {
              lineId: "22222222-2222-4222-8222-222222222222",
              productId: "product-second",
              name: "Servicio incluido",
              unitPrice: "0.00",
              quantity: 1,
              lineTotal: "0.00",
            },
          ]
        : []),
    ],
    total: cop ? "10.40" : "10.00",
    createdAt: "",
    createdBy: "Ana",
    closedAt: null,
    closedBy: null,
    sale: null,
  };
  const payment = usePosPayment({
    order,
    context: "fixture",
    onError: (error) => setMessage(String(error)),
    onClosed: () => setClosed(true),
    onRecovered: (_, text) => setMessage(text),
    onBeginClose: () => {},
  });
  return (
    <>
      <Button
        onPress={() => {
          payment.scan();
          void payment.resolve("fixture-pass");
        }}
      >
        Identificar cliente
      </Button>
      <Button onPress={() => void payment.prepare()}>Revisar cobro</Button>
      {payment.resolved && <Text>Cliente listo</Text>}
      {closed && <Text>Venta cerrada</Text>}
      {message && <Text>{message}</Text>}
      <PosCheckout order={order} payment={payment} />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
