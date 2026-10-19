import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Heading, Text } from "../../../apps/merchant/src/ui";
import { MeasuredCart } from "../../../apps/merchant/src/modules/pos/ui/measured-cart";
import { MeasuredQuantityDialog } from "../../../apps/merchant/src/modules/pos/ui/measured-quantity-dialog";
import {
  appendCartLine,
  existingCartLine,
  newCartLine,
  quantityEditor,
  serializeMeasuredCart,
  type QuantityEditor,
} from "../../../apps/merchant/src/modules/pos/ui/measured-cart-model";
import { existing, products } from "./pos-measured-cart-fixture";
const enabled = ["kg", "lb"] as const;
function Harness() {
  const [lines, setLines] = useState(existing.map(existingCartLine));
  const [pending, setPending] = useState<{
    index: number;
    editor: QuantityEditor;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState("");
  let valid = !pending;
  try {
    serializeMeasuredCart(lines, enabled, "USD");
  } catch {
    valid = false;
  }
  let error: string | undefined;
  if (pending)
    try {
      const candidate = newCartLine(
        products[pending.index],
        "preview",
        pending.editor,
        enabled,
      );
      serializeMeasuredCart([...lines, candidate], enabled, "USD");
    } catch (cause) {
      error = (cause as Error).message;
    }
  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-4 md:p-6">
      <Heading level={1}>Productos del pedido</Heading>
      <div className="flex flex-wrap gap-2">
        {products.map((product, index) => (
          <Button
            key={product.id}
            variant="secondary"
            onPress={() => {
              if (product.unitPrice === null) {
                setMessage("Este producto no tiene precio de venta.");
                return;
              }
              if (product.soldByWeight) {
                setPending({ index, editor: quantityEditor(null, "kg") });
                return;
              }
              setLines((current) =>
                appendCartLine(
                  current,
                  newCartLine(
                    product,
                    `new-${current.length}`,
                    { source: null, unit: "unit", buffer: "1", edited: true },
                    enabled,
                  ),
                ),
              );
            }}
          >
            Añadir {product.name}
          </Button>
        ))}
      </div>
      {message && <Text>{message}</Text>}
      <MeasuredCart
        lines={lines}
        enabledUnits={enabled}
        currencyCode="USD"
        onChange={setLines}
      />
      <Button
        isDisabled={!valid}
        onPress={() =>
          setPayload(
            JSON.stringify(serializeMeasuredCart(lines, enabled, "USD")),
          )
        }
      >
        Revisar borrador
      </Button>
      <div role="status" aria-label="Comando preparado" className="break-words">
        <Text>{payload}</Text>
      </div>
      {pending && (
        <MeasuredQuantityDialog
          key={pending.index}
          name={products[pending.index].name}
          editor={pending.editor}
          enabledUnits={enabled}
          error={error}
          onChange={(editor) => setPending({ ...pending, editor })}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setLines((current) =>
              appendCartLine(
                current,
                newCartLine(
                  products[pending.index],
                  `new-${current.length}`,
                  pending.editor,
                  enabled,
                ),
              ),
            );
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
