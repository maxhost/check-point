"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Heading,
  SelectField,
  Text,
  TextField,
} from "../../../ui";
import { DetailedSale } from "../counter/sale-forms";
import {
  addProduct,
  PosCart,
  productCart,
  productPrice,
  productQuantity,
  quantityForLine,
} from "./pos-cart";
import {
  draftItems,
  linePayload,
  posRequest,
  type DraftLine,
  type PosCatalog,
  type PosLocation,
  type PosOrder,
} from "./pos-types";
export function PosEditor({
  order,
  locations,
  currencyCode,
  busy,
  onSave,
  onCancel,
  onError,
}: {
  order: PosOrder | null;
  locations: PosLocation[];
  currencyCode: string;
  busy: boolean;
  onSave: (body: unknown) => void;
  onCancel: () => void;
  onError: (error: unknown) => void;
}) {
  const [table, setTable] = useState(order?.tableLabel ?? "");
  const [locationId, setLocationId] = useState(
    order?.location?.id ?? (locations.length === 1 ? locations[0].id : ""),
  );
  const [lines, setLines] = useState<DraftLine[]>(
    order ? draftItems(order) : [],
  );
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setCatalog(null);
    setCatalogError(null);
    if (locations.length > 1 && !locationId) return;
    void posRequest<PosCatalog>(
      `/api/pos/catalog${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`,
    )
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((error) => {
        if (active) {
          setCatalogError(error.message);
          onError(error);
        }
      });
    return () => {
      active = false;
    };
  }, [locationId, locations.length, onError]);
  const valid =
    table.trim().length > 0 &&
    table.trim().length <= 60 &&
    (locations.length <= 1 || !!locationId) &&
    lines.length <= 200 &&
    lines.every(
      (line) =>
        Number.isFinite(line.unitPrice) &&
        (!line.needsPrice || line.unitPrice > 0) &&
        Number.isInteger(line.quantity) &&
        line.quantity > 0,
    );
  return (
    <div className="counter-flow grid gap-6">
      <Card className="grid gap-4">
        <Heading level={2}>{order ? "Editar orden" : "Nueva orden"}</Heading>
        {locations.length > 1 && (
          <SelectField
            label="Local"
            selectedKey={locationId || null}
            options={locations.map((location) => ({
              id: location.id,
              label: location.name,
            }))}
            onSelectionChange={(key) => setLocationId(String(key ?? ""))}
            isDisabled={busy}
          />
        )}
        <TextField
          label="Nombre de mesa"
          value={table}
          onChange={setTable}
          maxLength={60}
          isRequired
          isDisabled={busy}
          placeholder="Ej.: Mesa 4"
        />
      </Card>
      <section className="counter-panel counter-panel-detailed min-w-0">
        {catalogError ? (
          <Alert kind="error" title={catalogError} />
        ) : !catalog ? (
          <Text variant="muted">
            {locations.length > 1 && !locationId
              ? "Elige el local para ver su catálogo."
              : "Cargando catálogo…"}
          </Text>
        ) : (
          <DetailedSale
            key={locationId}
            products={catalog.products}
            productOrder={catalog.bestSellingProductIds}
            categories={catalog.categories}
            habitualProductIds={[]}
            lastPurchase={null}
            currencyCode={currencyCode}
            cart={productCart(lines)}
            disabled={busy}
            onAdd={(product) =>
              setLines((current) => addProduct(current, product))
            }
            onQty={(id, delta) =>
              setLines((current) => productQuantity(current, id, delta))
            }
            onLinePrice={(id, value) =>
              setLines((current) => productPrice(current, id, value))
            }
            onRepeat={() => {}}
          />
        )}
        <PosCart
          lines={lines}
          currencyCode={currencyCode}
          busy={busy}
          onQty={(key, delta) =>
            setLines((current) => quantityForLine(current, key, delta))
          }
        >
          <Button
            isLoading={busy}
            isDisabled={!valid || !catalog}
            onPress={() =>
              onSave({
                ...(order ? { version: order.version } : {}),
                tableLabel: table.trim(),
                ...(locationId ? { locationId } : {}),
                items: linePayload(lines),
              })
            }
          >
            Guardar orden
          </Button>
          <Button variant="secondary" isDisabled={busy} onPress={onCancel}>
            Cancelar
          </Button>
        </PosCart>
      </section>
    </div>
  );
}
