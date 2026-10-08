"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Heading,
  NumberField,
  SelectField,
  Text,
  TextField,
} from "../../../ui";
import { formatMoney } from "../counter/types";
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
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
  function update(key: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }
  const total =
    lines.reduce(
      (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
      0,
    ) / 100;
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
    <div className="grid gap-6">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-4">
          <Heading level={2}>Catálogo</Heading>
          <TextField
            label="Buscar productos"
            value={query}
            onChange={setQuery}
          />
          <SelectField
            label="Categoría"
            selectedKey={category}
            onSelectionChange={(key) => setCategory(String(key))}
            options={[
              { id: "all", label: "Todos" },
              ...(catalog?.categories ?? []).map((item) => ({
                id: item.id,
                label: item.name,
              })),
              { id: "other", label: "Sin categoría" },
            ]}
          />
          {catalogError ? (
            <Alert kind="error" title={catalogError} />
          ) : !catalog ? (
            <Text variant="muted">
              {locations.length > 1 && !locationId
                ? "Elige el local para ver su catálogo."
                : "Cargando catálogo…"}
            </Text>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...catalog.products]
                .sort((a, b) => a.name.localeCompare(b.name, "es"))
                .filter(
                  (product) =>
                    product.name
                      .toLocaleLowerCase("es")
                      .includes(query.toLocaleLowerCase("es")) &&
                    (category === "all" ||
                      (category === "other"
                        ? !product.categoryId
                        : product.categoryId === category)),
                )
                .map((product) => (
                  <Button
                    key={product.id}
                    variant="secondary"
                    aria-label={`Agregar ${product.name}`}
                    isDisabled={busy || lines.length >= 200}
                    onPress={() =>
                      setLines((current) => {
                        const existing = current.find(
                          (line) =>
                            !line.lineId && line.productId === product.id,
                        );
                        if (existing)
                          return current.map((line) =>
                            line.key === existing.key
                              ? { ...line, quantity: line.quantity + 1 }
                              : line,
                          );
                        return [
                          ...current,
                          {
                            key: crypto.randomUUID(),
                            productId: product.id,
                            name: product.name,
                            unitPrice: product.unitPrice ?? 0,
                            quantity: 1,
                            needsPrice: product.unitPrice === null,
                          },
                        ];
                      })
                    }
                  >
                    <span className="grid gap-1 text-left">
                      <Text as="span" variant="label">
                        {product.name}
                      </Text>
                      <Text as="span" variant="small">
                        {product.unitPrice === null
                          ? "Sin precio"
                          : formatMoney(product.unitPrice, currencyCode)}
                      </Text>
                    </span>
                  </Button>
                ))}
            </div>
          )}
          {catalog && !catalog.products.length && (
            <Text variant="muted">
              No hay productos disponibles en este local.
            </Text>
          )}
        </Card>
        <Card className="grid content-start gap-4">
          <Heading level={2}>Tu orden</Heading>
          {!lines.length && (
            <Text variant="muted">
              Puedes guardar la mesa y agregar productos después.
            </Text>
          )}
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-3 border-b border-border pb-4"
            >
              <Text variant="label">{line.name}</Text>
              <Text variant="muted">
                {formatMoney(line.unitPrice, currencyCode)} por unidad
                {line.lineId ? " · Precio guardado" : ""}
              </Text>
              <NumberField
                label={`Cantidad de ${line.name}`}
                value={line.quantity}
                minValue={1}
                maxValue={9999}
                onChange={(quantity) => update(line.key, { quantity })}
                isDisabled={busy}
              />
              {line.needsPrice && (
                <NumberField
                  label={`Precio unitario de ${line.name}`}
                  value={line.unitPrice}
                  minValue={0.01}
                  maxValue={9999999999.99}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  onChange={(unitPrice) => update(line.key, { unitPrice })}
                  isDisabled={busy}
                />
              )}
              <Button
                variant="quiet"
                isDisabled={busy}
                onPress={() =>
                  setLines((current) =>
                    current.filter((item) => item.key !== line.key),
                  )
                }
              >
                Quitar {line.name}
              </Button>
            </div>
          ))}
          <Text variant="label">Total: {formatMoney(total, currencyCode)}</Text>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
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
      </div>
    </div>
  );
}
