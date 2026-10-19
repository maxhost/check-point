import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Bag,
  DeliveryTruck,
  NavArrowRight,
  Shop,
  Table,
} from "iconoir-react";
import { Button, Card, Heading, Text } from "../../../ui";
import type { PosOrderV2, PosSummaryV2, SaleType } from "../contracts";

const saleTypes = {
  table: {
    color: "bg-info-soft text-info",
    label: "Mesa",
    icon: <Table className="size-5 shrink-0" aria-hidden="true" />,
  },
  counter: {
    color: "bg-primary-soft text-primary",
    label: "Mostrador",
    icon: <Shop className="size-5 shrink-0" aria-hidden="true" />,
  },
  delivery: {
    color: "bg-warning-soft text-warning",
    label: "Delivery",
    icon: <DeliveryTruck className="size-5 shrink-0" aria-hidden="true" />,
  },
  pickup: {
    color: "bg-accent-soft text-accent",
    label: "Para retirar",
    icon: <Bag className="size-5 shrink-0" aria-hidden="true" />,
  },
  legacy: {
    color: "bg-surface-subtle text-content-muted",
    label: "Pedido anterior",
    icon: <Archive className="size-5 shrink-0" aria-hidden="true" />,
  },
} satisfies Record<
  SaleType,
  { label: string; icon: React.ReactNode; color: string }
>;

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

type OrderCardProps = {
  order: PosSummaryV2;
  currencyCode: string;
  disabled: boolean;
  onOpen: (id: string) => void;
  onLoadProducts?: (id: string) => Promise<PosOrderV2["items"]>;
};

export function MeasuredOrderCard(props: OrderCardProps) {
  return (
    <OrderCard
      key={`${props.order.id}:${props.order.version}:${props.disabled}`}
      {...props}
    />
  );
}

function OrderCard({
  order,
  currencyCode,
  disabled,
  onOpen,
  onLoadProducts,
}: OrderCardProps) {
  const saleType = saleTypes[order.saleType];
  const titleId = `order-card-${order.id}`;
  const productsId = `${titleId}-products`;
  const [expanded, setExpanded] = useState(false);
  const [products, setProducts] = useState<PosOrderV2["items"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);

  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  function closeProducts() {
    request.current += 1;
    setExpanded(false);
    setLoading(false);
  }

  async function loadProducts() {
    if (disabled || !onLoadProducts) return;
    const token = ++request.current;
    setExpanded(true);
    setLoading(true);
    setError(false);
    setProducts(null);
    try {
      const items = await onLoadProducts(order.id);
      if (request.current === token) setProducts(items);
    } catch {
      if (request.current === token) setError(true);
    } finally {
      if (request.current === token) setLoading(false);
    }
  }

  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      className="relative flex h-full min-w-0 flex-row items-center gap-3 rounded-2xl p-4! sm:p-4! md:flex-col md:items-stretch md:gap-4 md:p-6!"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-14 md:flex-none md:pr-0">
        <div className={`shrink-0 rounded-xl p-3 ${saleType.color}`}>
          {saleType.icon}
        </div>
        <div className="min-w-0">
          <Heading level={3} id={titleId} className="break-words">
            {order.orderLabel}
          </Heading>
          <Text variant="small" className="sr-only md:not-sr-only">
            {saleType.label}
          </Text>
          <Text variant="small" className="break-words md:hidden">
            {formatTotal(order.total, currencyCode)}
          </Text>
        </div>
      </div>
      {order.status !== "open" && (
        <Text variant="label" className="hidden md:block">
          {order.status === "closed" ? "Cerrada" : "Anulada"}
        </Text>
      )}
      <div className="mt-auto hidden min-w-0 md:block">
        <Text variant="metric" className="min-w-0 break-words">
          {formatTotal(order.total, currencyCode)}
        </Text>
      </div>
      <div className="relative hidden items-center gap-3 md:flex">
        <Button
          variant="quiet"
          className="size-11 shrink-0 rounded-full! border border-primary bg-primary-soft! p-0! text-primary!"
          aria-label={`Ver ${order.lineCount} ${order.lineCount === 1 ? "producto" : "productos"} de ${order.orderLabel}`}
          aria-expanded={expanded}
          aria-controls={expanded ? productsId : undefined}
          isDisabled={disabled || !onLoadProducts}
          onPress={() => (expanded ? closeProducts() : void loadProducts())}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeProducts();
          }}
        >
          {order.lineCount}
        </Button>
        <Button
          variant="secondary"
          className="min-w-0 flex-1"
          aria-label={`Abrir ${order.orderLabel}`}
          isDisabled={disabled}
          onPress={() => onOpen(order.id)}
        >
          Abrir
        </Button>
        {expanded && !disabled && (
          <div
            id={productsId}
            role="region"
            aria-label={`Productos de ${order.orderLabel}`}
            className="absolute left-0 right-0 top-full z-10 mt-2 grid max-h-72 gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg"
          >
            <Text variant="label">Productos</Text>
            <div aria-live="polite">
              {loading && <Text variant="small">Cargando productos…</Text>}
              {error && (
                <Text variant="small">No pudimos cargar los productos.</Text>
              )}
              {products?.length === 0 && (
                <Text variant="small">Esta orden no tiene productos.</Text>
              )}
            </div>
            {products && products.length > 0 && (
              <ul className="m-0 grid list-none gap-3 p-0">
                {products.map((line) => (
                  <li key={line.lineId} className="min-w-0 break-words">
                    <Text variant="label">{line.name}</Text>
                    <Text variant="small">
                      {line.quantity.replace(".", ",")}{" "}
                      {line.measure.quantityUnit === "unit"
                        ? line.quantity === "1"
                          ? "unidad"
                          : "unidades"
                        : line.measure.quantityUnit}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <Button variant="secondary" onPress={() => void loadProducts()}>
                Reintentar
              </Button>
            )}
            <Button
              variant="quiet"
              onPress={closeProducts}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeProducts();
              }}
            >
              Cerrar
            </Button>
          </div>
        )}
      </div>
      <Button
        variant="secondary"
        className="absolute right-4 top-4 size-11 shrink-0 p-0! md:hidden"
        aria-label={`Abrir ${order.orderLabel}`}
        isDisabled={disabled}
        onPress={() => onOpen(order.id)}
      >
        <NavArrowRight className="size-5" aria-hidden="true" />
      </Button>
    </Card>
  );
}
