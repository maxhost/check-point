"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, SelectField } from "../../../ui";
import { marketingRequest } from "./marketing-api";

type Product = { id: string; name: string; unitCost: number | null };

export function CouponProductPicker({
  canReadCatalog,
  productId,
  onChange,
  onProductSelected,
  errorMessage,
}: {
  canReadCatalog: boolean;
  productId: string | null;
  onChange: (productId: string | null) => void;
  onProductSelected?: (product: Product | null) => void;
  errorMessage?: string;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await marketingRequest<{ products: Product[] }>(
        "/api/catalog",
      );
      setProducts(response.products);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (canReadCatalog) void load();
  }, [canReadCatalog, load]);

  if (!canReadCatalog)
    return (
      <Alert title="Producto opcional no disponible">
        Tu permiso de Marketing permite configurar el cupón. Para asociarlo a un
        producto necesitás permiso de Catálogo.
        {errorMessage && <p className="text-danger">{errorMessage}</p>}
        {productId && (
          <Button variant="secondary" onPress={() => onChange(null)}>
            Quitar producto guardado
          </Button>
        )}
      </Alert>
    );
  if (failed)
    return (
      <Alert kind="warning" title="No pudimos consultar los productos">
        Podés guardar el cupón sin producto asociado.{" "}
        {errorMessage && <p className="text-danger">{errorMessage}</p>}
        {productId && (
          <Button variant="secondary" onPress={() => onChange(null)}>
            Quitar producto guardado
          </Button>
        )}
        <Button variant="secondary" onPress={() => void load()}>
          Reintentar catálogo
        </Button>
      </Alert>
    );
  if (!products)
    return (
      <p className="text-sm text-content-muted" role="status">
        Cargando productos…
      </p>
    );
  const options = [
    { id: "", label: "Sin producto asociado" },
    ...products.map((product) => ({ id: product.id, label: product.name })),
  ];
  if (productId && !products.some((product) => product.id === productId))
    options.push({
      id: productId,
      label: "Producto guardado (ya no disponible)",
    });
  return (
    <SelectField
      label="Producto del cupón (opcional)"
      errorMessage={errorMessage}
      options={options}
      selectedKey={productId ?? ""}
      description="Identifica el premio en los resultados; el canje se hace en el mostrador."
      onSelectionChange={(key) => {
        const selected = products.find((product) => product.id === key) ?? null;
        onChange(selected?.id ?? null);
        onProductSelected?.(selected);
      }}
    />
  );
}
