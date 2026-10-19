"use client";
import { useState } from "react";
import { FilterList } from "iconoir-react";
import { Button, Heading, SelectField, Sheet, Text } from "../../../ui";
import type { PosHistoryV2, PosLocationV2, PosOrderV2 } from "../contracts";
import { MeasuredOrderCard } from "./measured-order-card";

type OrderFilters = { status: string; location: string; saleType: string };

export function MeasuredOrderList({
  history,
  locations,
  currencyCode,
  disabled,
  onOpen,
  onLoadProducts,
  onNew,
  onChooseNew,
  onRefresh,
}: {
  history: PosHistoryV2;
  currencyCode: string;
  locations: PosLocationV2[];
  disabled: boolean;
  onOpen: (id: string) => void;
  onLoadProducts?: (id: string) => Promise<PosOrderV2["items"]>;
  onNew: (locationId: string) => void;
  onChooseNew?: (locationId: string) => void;
  onRefresh: () => void;
}) {
  const [filters, setFilters] = useState<OrderFilters>({
    status: "open",
    location: locations[0]?.id ?? "all",
    saleType: "all",
  });
  const { status, location, saleType } = filters;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);
  const rows = (status === "open" ? history.open : history.closedToday).filter(
    (row) =>
      row.status === status &&
      (location === "all" || row.location?.id === location) &&
      (saleType === "all" || row.saleType === saleType),
  );
  return (
    <section
      aria-label="Pedidos"
      className="grid w-full min-w-0 max-w-none gap-5 p-3 md:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading level={1}>Pedidos</Heading>
        <Button
          className="md:hidden"
          isDisabled={disabled}
          onPress={() => onNew(location === "all" ? "" : location)}
        >
          Nueva orden
        </Button>
        <Button
          className="hidden md:inline-flex"
          isDisabled={disabled}
          onPress={() =>
            (onChooseNew ?? onNew)(location === "all" ? "" : location)
          }
        >
          Nueva orden
        </Button>
      </div>
      <div className="md:hidden">
        <Button
          variant="secondary"
          isDisabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          onPress={() => {
            setDraftFilters(filters);
            setFiltersOpen(true);
          }}
        >
          <FilterList className="size-5" aria-hidden="true" />
          Filtros
        </Button>
      </div>
      <div className="hidden md:block">
        <OrderFilterFields
          value={filters}
          onChange={setFilters}
          locations={locations}
          disabled={disabled}
        />
      </div>
      <Sheet
        title="Filtros"
        isOpen={filtersOpen && !disabled}
        onOpenChange={setFiltersOpen}
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() => setFiltersOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              isDisabled={disabled}
              onPress={() => {
                setFilters(draftFilters);
                setFiltersOpen(false);
              }}
            >
              Aplicar filtros
            </Button>
          </div>
        }
      >
        <OrderFilterFields
          value={draftFilters}
          onChange={setDraftFilters}
          locations={locations}
          disabled={disabled}
        />
      </Sheet>
      {status !== "open" && (
        <Text variant="muted">
          Las cerradas y anuladas corresponden al día del negocio.
        </Text>
      )}
      {rows.length ? (
        <ul
          aria-label="Órdenes"
          className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4"
        >
          {rows.map((order) => (
            <li key={order.id} className="min-w-0">
              <MeasuredOrderCard
                order={order}
                currencyCode={currencyCode}
                disabled={disabled}
                onOpen={onOpen}
                onLoadProducts={onLoadProducts}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Text>No hay pedidos en esta vista. Puedes crear una nueva orden.</Text>
      )}
      <Button variant="quiet" isDisabled={disabled} onPress={onRefresh}>
        Actualizar listado
      </Button>
    </section>
  );
}

function OrderFilterFields({
  value,
  onChange,
  locations,
  disabled,
}: {
  value: OrderFilters;
  onChange: (value: OrderFilters) => void;
  locations: PosLocationV2[];
  disabled: boolean;
}) {
  const { status, location, saleType } = value;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SelectField
        label="Estado"
        selectedKey={status}
        isDisabled={disabled}
        options={[
          { id: "open", label: "Abiertas" },
          { id: "closed", label: "Cerradas hoy" },
          { id: "voided", label: "Anuladas hoy" },
        ]}
        onSelectionChange={(key) => onChange({ ...value, status: String(key) })}
      />
      <SelectField
        label="Local del listado"
        selectedKey={location}
        isDisabled={disabled}
        options={[
          ...(locations.length > 1
            ? [{ id: "all", label: "Todos los locales" }]
            : []),
          ...locations.map((l) => ({ id: l.id, label: l.name })),
        ]}
        onSelectionChange={(key) =>
          onChange({ ...value, location: String(key) })
        }
      />
      <SelectField
        label="Tipo de orden"
        selectedKey={saleType}
        isDisabled={disabled}
        options={[
          { id: "all", label: "Todos los tipos" },
          { id: "table", label: "Mesa" },
          { id: "counter", label: "Mostrador" },
          { id: "delivery", label: "Delivery" },
          { id: "pickup", label: "Para retirar" },
          { id: "legacy", label: "Pedido anterior" },
        ]}
        onSelectionChange={(key) =>
          onChange({ ...value, saleType: String(key) })
        }
      />
    </div>
  );
}
