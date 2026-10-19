"use client";
import { useState } from "react";
import { Button, Heading, SelectField, Text } from "../../../ui";
import type { PosHistoryV2, PosLocationV2, PosSummaryV2 } from "../contracts";

export function MeasuredOrderList({
  history,
  locations,
  currencyCode,
  disabled,
  onOpen,
  onNew,
  onRefresh,
}: {
  history: PosHistoryV2;
  currencyCode: string;
  locations: PosLocationV2[];
  disabled: boolean;
  onOpen: (id: string) => void;
  onNew: (locationId: string) => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState("open");
  const [location, setLocation] = useState(
    locations.length === 1 ? locations[0].id : "all",
  );
  const rows = (status === "open" ? history.open : history.closedToday).filter(
    (row) =>
      row.status === status &&
      (location === "all" || row.location?.id === location),
  );
  function row(order: PosSummaryV2) {
    return (
      <li
        key={order.id}
        className="flex min-w-0 flex-wrap items-center justify-between gap-4 border-b border-border py-4"
      >
        <div className="min-w-0 break-words">
          <Text variant="label">{order.orderLabel}</Text>
          <Text variant="muted">
            {order.location?.name ?? "Sin local"} · {order.lineCount} líneas
          </Text>
          <Text>
            {currencyCode} {order.total}
          </Text>
        </div>
        <Button
          variant="secondary"
          isDisabled={disabled}
          onPress={() => onOpen(order.id)}
        >
          Abrir {order.orderLabel}
        </Button>
      </li>
    );
  }
  return (
    <section
      aria-label="Pedidos"
      className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading level={1}>Pedidos</Heading>
        <Button
          isDisabled={disabled}
          onPress={() => onNew(location === "all" ? "" : location)}
        >
          Nueva orden
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Estado"
          selectedKey={status}
          isDisabled={disabled}
          options={[
            { id: "open", label: "Abiertas" },
            { id: "closed", label: "Cerradas hoy" },
            { id: "voided", label: "Anuladas hoy" },
          ]}
          onSelectionChange={(key) => setStatus(String(key))}
        />
        <SelectField
          label="Local del listado"
          selectedKey={location}
          isDisabled={disabled}
          options={[
            { id: "all", label: "Todos los locales" },
            ...locations.map((l) => ({ id: l.id, label: l.name })),
          ]}
          onSelectionChange={(key) => setLocation(String(key))}
        />
      </div>
      <Text variant="muted">
        Las cerradas y anuladas corresponden al día del negocio.
      </Text>
      {rows.length ? (
        <ul aria-label="Órdenes" className="min-w-0">
          {rows.map(row)}
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
