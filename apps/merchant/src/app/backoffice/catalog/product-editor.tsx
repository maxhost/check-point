"use client";

import { useState } from "react";
import { Plus } from "iconoir-react";
import { SelectField, TextField } from "../../../ui";
import { StaffFormModal } from "../staff/staff-form-modal";
import type { Category, Location, Product, ProductPayload } from "./types";
import { useCatalogImage } from "./use-catalog-image";
import { ProductImageField } from "./product-image-field";

type Props = {
  open: boolean;
  product: Product | null;
  categories: Category[];
  locations: Location[];
  currencyCode: string;
  onCreateCategory: (name: string) => Promise<Category | null>;
  onSave: (payload: ProductPayload, id: string | null) => Promise<boolean>;
  onCancel: () => void;
  onError: (message: string) => void;
  categoryCreationDisabled?: boolean;
};

function toMoney(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return Number(trimmed);
}

export function ProductEditor({
  open,
  product,
  categories,
  locations,
  currencyCode,
  onCreateCategory,
  onSave,
  onCancel,
  onError,
  categoryCreationDisabled = false,
}: Props) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unitPrice, setUnitPrice] = useState(
    product?.unitPrice != null ? String(product.unitPrice) : "",
  );
  const [unitCost, setUnitCost] = useState(
    product?.unitCost != null ? String(product.unitCost) : "",
  );
  const [availableAll, setAvailableAll] = useState(
    product?.availableAllLocations ?? true,
  );
  const [locationIds, setLocationIds] = useState<string[]>(
    product?.locationIds ?? [],
  );
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const image = useCatalogImage(
    product?.imagePath ?? null,
    product
      ? {
          source: product.imageSource,
          author: product.imageAuthor,
          authorUrl: product.imageAuthorUrl,
          sourceUrl: product.imageSourceUrl,
        }
      : null,
  );

  function toggleLocation(id: string) {
    setLocationIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function createCategory() {
    const created = await onCreateCategory(newCategory.trim());
    if (created) {
      setCategoryId(created.id);
      setNewCategory("");
    }
  }

  async function save() {
    if (!name.trim()) {
      onError("El nombre del producto es obligatorio.");
      return;
    }
    if (!availableAll && locationIds.length === 0) {
      onError("Selecciona al menos un local o habilita todos.");
      return;
    }
    setSaving(true);
    try {
      const uploadId =
        image.action === "replace" ? await image.upload() : undefined;
      const payload: ProductPayload = {
        name: name.trim(),
        categoryId: categoryId || null,
        unitPrice: toMoney(unitPrice),
        unitCost: toMoney(unitCost),
        availableAllLocations: availableAll,
        locationIds: availableAll ? [] : locationIds,
        imageAction: image.action,
        ...(uploadId ? { uploadId, cropped: image.cropped } : {}),
        ...(image.action === "stock" && image.stock
          ? { provider: image.stock.provider, photoId: image.stock.photoId }
          : {}),
      };
      const ok = await onSave(payload, product?.id ?? null);
      if (!ok) setSaving(false);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "No pudimos guardar.");
      setSaving(false);
    }
  }

  return (
    <StaffFormModal
      open={open}
      eyebrow={product ? "Editar producto" : "Nuevo producto"}
      title={product ? "Actualizá el producto" : "Sumá un producto al catálogo"}
      description="Completá solo lo que ya tengas. La imagen, el costo y el precio de venta son opcionales."
      onClose={onCancel}
    >
      <form
        className="catalog-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          data-tour="catalog-product-name"
          autoFocus
          label="Nombre del producto"
          value={name}
          maxLength={120}
          onChange={setName}
          placeholder="Ej. Café con leche"
          isRequired
        />
        <SelectField
          data-tour="catalog-product-category"
          label="Categoría"
          selectedKey={categoryId || "none"}
          onSelectionChange={(key) =>
            setCategoryId(key === "none" ? "" : String(key))
          }
          options={[
            { id: "none", label: "Sin categoría" },
            ...categories.map((category) => ({
              id: category.id,
              label: category.name,
            })),
          ]}
        />
        <div className="catalog-inline-add">
          <TextField
            label="Crear una categoría sin salir"
            value={newCategory}
            maxLength={60}
            onChange={setNewCategory}
            placeholder="Ej. Bebidas calientes"
          />
          <button
            type="button"
            className="small-button"
            disabled={categoryCreationDisabled || !newCategory.trim()}
            onClick={() => void createCategory()}
          >
            <Plus aria-hidden="true" /> Crear
          </button>
        </div>
        <div className="catalog-money" data-tour="catalog-product-prices">
          <TextField
            label="Precio de venta (opcional)"
            type="number"
            inputMode="decimal"
            value={unitPrice}
            onChange={setUnitPrice}
            placeholder="0.00"
            description={`En ${currencyCode}`}
          />
          <TextField
            label="Precio de costo (opcional)"
            type="number"
            inputMode="decimal"
            value={unitCost}
            onChange={setUnitCost}
            placeholder="0.00"
            description="Solo para tus reportes internos"
          />
        </div>
        <div data-tour="catalog-product-image">
          <ProductImageField image={image} name={name} onError={onError} />
        </div>
        {locations.length > 1 && (
          <fieldset
            className="catalog-visibility"
            data-tour="catalog-product-availability"
          >
            <legend>Disponibilidad por local</legend>
            <p className="field-help">
              Elegí dónde estará disponible este producto.
            </p>
            <label className="catalog-choice">
              <input
                type="radio"
                name="availability"
                checked={availableAll}
                onChange={() => setAvailableAll(true)}
              />
              <span>
                <strong>Todos los locales</strong>
                <small>
                  También se aplicará a los locales que agregues después.
                </small>
              </span>
            </label>
            <label className="catalog-choice">
              <input
                type="radio"
                name="availability"
                checked={!availableAll}
                onChange={() => setAvailableAll(false)}
              />
              <span>
                <strong>Locales específicos</strong>
                <small>Seleccioná uno o más locales.</small>
              </span>
            </label>
            {!availableAll && (
              <div className="catalog-location-options">
                {locations.map((location) => (
                  <label className="catalog-check" key={location.id}>
                    <input
                      type="checkbox"
                      checked={locationIds.includes(location.id)}
                      onChange={() => toggleLocation(location.id)}
                    />
                    {location.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        <div className="catalog-editor-actions">
          <button className="button alt" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="button"
            data-tour="catalog-product-save"
            type="submit"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </StaffFormModal>
  );
}
