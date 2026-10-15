import { Alert, Button, Text } from "../../../ui";
import { formatAmount, type StockItem } from "./stock-types";

// Owner 2026-10-15: keep the balances implementation parked until its UI is redesigned.
const SHOW_CURRENT_BALANCES = false;

export function StockSummary({
  items,
  pending,
  currency,
  onReload,
}: {
  items: StockItem[];
  pending: { count: number; failed: number };
  currency?: string;
  onReload: () => void;
}) {
  return (
    <>
      {pending.count > 0 && (
        <Alert
          kind="warning"
          title={`${pending.count} ${pending.count === 1 ? "consumo pendiente" : "consumos pendientes"}`}
        >
          <Text>
            El saldo puede estar atrasado.{" "}
            {pending.failed > 0
              ? "Hubo un problema al aplicar consumos. Reintenta para actualizarlo."
              : "Se está actualizando el stock de las ventas."}
          </Text>
          <Button variant="secondary" onPress={onReload}>
            Actualizar stock
          </Button>
        </Alert>
      )}
      {SHOW_CURRENT_BALANCES && items.length > 0 && (
        <div className="grid gap-2" aria-label="Saldos del local">
          {items.map((item) => (
            <Text key={item.id}>
              {item.name}: {formatAmount(item.onHand ?? "0")}{" "}
              {item.unit === "unit" ? "unidades" : item.unit}
              {item.lastUnitCost
                ? ` · Último costo: ${item.lastUnitCost}${currency ? ` ${currency}` : ""} / ${item.unit}`
                : " · Sin costo"}
            </Text>
          ))}
        </div>
      )}
    </>
  );
}
