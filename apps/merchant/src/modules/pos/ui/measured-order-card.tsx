import { Archive, Bag, DeliveryTruck, Shop, Table } from "iconoir-react";
import { Button, Card, Heading, Text } from "../../../ui";
import type { PosSummaryV2, SaleType } from "../contracts";

const saleTypes = {
  table: {
    label: "Mesa",
    icon: <Table className="size-5 shrink-0" aria-hidden="true" />,
  },
  counter: {
    label: "Mostrador",
    icon: <Shop className="size-5 shrink-0" aria-hidden="true" />,
  },
  delivery: {
    label: "Delivery",
    icon: <DeliveryTruck className="size-5 shrink-0" aria-hidden="true" />,
  },
  pickup: {
    label: "Para retirar",
    icon: <Bag className="size-5 shrink-0" aria-hidden="true" />,
  },
  legacy: {
    label: "Pedido anterior",
    icon: <Archive className="size-5 shrink-0" aria-hidden="true" />,
  },
} satisfies Record<SaleType, { label: string; icon: React.ReactNode }>;

function formatTotal(value: string, currencyCode: string): string {
  try {
    const formatter = new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currencyCode,
    });
    // Intl accepts decimal strings exactly; TypeScript's signature omits them.
    const formatDecimal = formatter.format as (decimal: string) => string;
    return formatDecimal(value);
  } catch {
    return `${currencyCode} ${value}`;
  }
}

export function MeasuredOrderCard({
  order,
  currencyCode,
  disabled,
  onOpen,
}: {
  order: PosSummaryV2;
  currencyCode: string;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  const saleType = saleTypes[order.saleType];
  const titleId = `order-card-${order.id}`;

  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      className="flex h-full min-w-0 flex-col gap-3 rounded-2xl p-4 sm:p-6"
    >
      <Heading level={3} id={titleId} className="min-w-0 break-words">
        {order.orderLabel}
      </Heading>
      <Text variant="small" className="flex items-center gap-2">
        {saleType.icon}
        {saleType.label}
      </Text>
      <Text variant="small" className="min-w-0 break-words">
        {order.location?.name ?? "Sin local"}
      </Text>
      {order.status !== "open" && (
        <Text variant="label">
          {order.status === "closed" ? "Cerrada" : "Anulada"}
        </Text>
      )}
      <Text variant="metric" className="mt-auto min-w-0 break-words pt-3">
        {formatTotal(order.total, currencyCode)}
      </Text>
      <Text variant="small">
        {order.lineCount} {order.lineCount === 1 ? "producto" : "productos"}
      </Text>
      <Button
        variant="secondary"
        fullWidth
        aria-label={`Abrir ${order.orderLabel}`}
        isDisabled={disabled}
        onPress={() => onOpen(order.id)}
      >
        Abrir
      </Button>
    </Card>
  );
}
