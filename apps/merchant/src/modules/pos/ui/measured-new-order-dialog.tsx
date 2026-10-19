"use client";
import { useState } from "react";
import { Bag, DeliveryTruck, Shop, Table } from "iconoir-react";
import { Button, Dialog, SelectField, Text, TextField } from "../../../ui";
import type { SaleType } from "../contracts";
import type { MeasuredEditorContext } from "./measured-editor-model";
import type { PosClient } from "./pos-context";
import type { PosCache } from "./pos-cache";
import { PosTablePicker, tableUnavailable, usePosTables } from "./pos-tables";

export type NewMeasuredOrder = {
  saleType: Exclude<SaleType, "legacy">;
  locationId: string;
  tableId: string | null;
  orderLabel: string;
};

const types = [
  {
    id: "table",
    label: "Mesa",
    icon: <Table className="size-6" aria-hidden="true" />,
  },
  {
    id: "counter",
    label: "Mostrador",
    icon: <Shop className="size-6" aria-hidden="true" />,
  },
  {
    id: "delivery",
    label: "Delivery",
    icon: <DeliveryTruck className="size-6" aria-hidden="true" />,
  },
  {
    id: "pickup",
    label: "Para retirar",
    icon: <Bag className="size-6" aria-hidden="true" />,
  },
] satisfies {
  id: NewMeasuredOrder["saleType"];
  label: string;
  icon: React.ReactNode;
}[];

export function MeasuredNewOrderDialog({
  isOpen,
  initialLocationId,
  context,
  client,
  cache,
  disabled,
  onClose,
  onContinue,
  onError,
}: {
  isOpen: boolean;
  initialLocationId: string;
  context: MeasuredEditorContext;
  client: PosClient;
  cache: PosCache;
  disabled: boolean;
  onClose: () => void;
  onContinue: (order: NewMeasuredOrder) => void;
  onError: (cause: unknown) => void;
}) {
  const [saleType, setSaleType] = useState<NewMeasuredOrder["saleType"] | null>(
    null,
  );
  const [step, setStep] = useState<"type" | "details">("type");
  const [locationId, setLocationId] = useState(initialLocationId);
  const [tableId, setTableId] = useState<string | null>(null);
  const [orderLabel, setOrderLabel] = useState("");
  const hasLocation = context.locations.some((l) => l.id === locationId);
  const tables = usePosTables(
    locationId,
    0,
    onError,
    isOpen && !disabled && context.tablesEnabled,
    { client, cache },
  );
  const requiresTable = saleType === "table" && context.tablesEnabled;
  const canContinue =
    !disabled &&
    hasLocation &&
    !!saleType &&
    (saleType === "counter" ||
      (orderLabel.trim().length > 0 && orderLabel.trim().length <= 60)) &&
    (!requiresTable ||
      (tables.tables !== null &&
        !tables.error &&
        (tables.tables.length === 0 || !!tableId) &&
        !tableUnavailable(tables.tables, tableId)));
  const selected = types.find((type) => type.id === saleType);

  return (
    <Dialog
      title="Nueva orden"
      description={
        step === "type"
          ? "Elige el tipo de orden que quieres crear."
          : "Completa los datos para continuar con los productos."
      }
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {step === "type" ? (
        <div className="grid grid-cols-2 gap-3">
          {types
            .filter((type) => context.saleTypes.includes(type.id))
            .map((type) => (
              <Button
                key={type.id}
                variant="secondary"
                className="min-h-28 flex-col gap-3"
                aria-pressed={saleType === type.id}
                isDisabled={
                  disabled ||
                  (type.id === "table" &&
                    context.tablesEnabled &&
                    hasLocation &&
                    tables.tables === null &&
                    !tables.error)
                }
                onPress={() => {
                  if (disabled) return;
                  if (type.id === "counter" && hasLocation) {
                    onContinue({
                      saleType: type.id,
                      locationId,
                      tableId: null,
                      orderLabel: "",
                    });
                    return;
                  }
                  if (saleType !== type.id) {
                    setTableId(null);
                    setOrderLabel("");
                  }
                  setSaleType(type.id);
                  setStep("details");
                }}
              >
                {type.icon}
                {type.label}
              </Button>
            ))}
        </div>
      ) : (
        <div className="grid gap-4">
          <Text variant="label" className="flex items-center gap-3">
            {selected?.icon}
            {selected?.label}
          </Text>
          {context.locations.length > 1 && (
            <SelectField
              label="Local"
              selectedKey={locationId || null}
              options={context.locations.map((l) => ({
                id: l.id,
                label: l.name,
              }))}
              isDisabled={disabled}
              onSelectionChange={(key) => {
                setLocationId(String(key));
                setTableId(null);
                if (saleType === "table") setOrderLabel("");
              }}
            />
          )}
          {requiresTable ? (
            hasLocation ? (
              <PosTablePicker
                {...tables}
                tableId={tableId}
                name={orderLabel}
                disabled={disabled}
                onChange={(id, name) => {
                  setTableId(id);
                  setOrderLabel(name);
                }}
              />
            ) : (
              <Text variant="muted">Elige un local para ver sus mesas.</Text>
            )
          ) : saleType === "counter" ? (
            <Text variant="muted">
              La referencia de Mostrador se asigna al guardar.
            </Text>
          ) : (
            <TextField
              label={
                saleType === "table" ? "Nombre de mesa" : "Nombre o referencia"
              }
              value={orderLabel}
              onChange={setOrderLabel}
              maxLength={60}
              isRequired
              isDisabled={disabled}
              placeholder={saleType === "table" ? "Ej.: Mesa 4" : "Ej.: Ana"}
            />
          )}
        </div>
      )}
      <div className="mt-5 flex justify-between gap-3">
        <Button variant="quiet" onPress={onClose}>
          Cancelar
        </Button>
        {step === "details" && (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              isDisabled={disabled}
              onPress={() => setStep("type")}
            >
              Atrás
            </Button>
            <Button
              isDisabled={!canContinue}
              onPress={() => {
                if (canContinue && saleType)
                  onContinue({
                    saleType,
                    locationId,
                    tableId,
                    orderLabel: orderLabel.trim(),
                  });
              }}
            >
              Continuar
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
