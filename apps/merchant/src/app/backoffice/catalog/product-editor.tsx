"use client";

import { useRef, useState } from "react";
import type { Category, Location, Product, ProductPayload } from "./types";
import { useCatalogImage } from "./use-catalog-image";
import { StockPicker } from "./stock-picker";

type Props = {
  product: Product | null;
  categories: Category[];
  locations: Location[];
  onCreateCategory: (name: string) => Promise<Category | null>;
  onSave: (payload: ProductPayload, id: string | null) => Promise<boolean>;
  onCancel: () => void;
  onError: (message: string) => void;
};

function toMoney(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return Number(trimmed);
}

export function ProductEditor({
  product,
  categories,
  locations,
  onCreateCategory,
  onSave,
  onCancel,
  onError,
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
  const [showPicker, setShowPicker] = useState(false);
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
  const fileInput = useRef<HTMLInputElement>(null);

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
        ...(uploadId ? { uploadId } : {}),
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
    <section className="panel catalog-editor">
      <h2>{product ? "Editar producto" : "Nuevo producto"}</h2>
      <label>
        Nombre
        <input
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Café con leche"
        />
      </label>
      <label>
        Categoría
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <div className="catalog-inline-add">
        <input
          value={newCategory}
          maxLength={60}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="Nueva categoría"
          aria-label="Nueva categoría"
        />
        <button
          type="button"
          className="small-button"
          disabled={!newCategory.trim()}
          onClick={() => void createCategory()}
        >
          Crear
        </button>
      </div>
      <div className="catalog-money">
        <label>
          Precio de venta (opcional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
          />
        </label>
        <label>
          Coste unitario (opcional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </label>
      </div>
      <p className="field-help">
        Cargar el precio habilita puntos por consumo y analítica de ticket.
      </p>
      <label>
        Imagen (opcional)
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => image.choose(event.target.files?.[0], onError)}
        />
      </label>
      <div className="stock-or">o</div>
      <button
        type="button"
        className="small-button stock-library-button"
        onClick={() => setShowPicker(true)}
      >
        {image.visible
          ? "Elegir otra imagen de biblioteca"
          : "Elegir de biblioteca"}
      </button>
      {image.visible && (
        <div className="catalog-image-row">
          <img
            className="catalog-image-preview"
            src={image.visible}
            alt={`Imagen de ${name || "producto"}`}
          />
          <button
            type="button"
            className="small-button"
            onClick={() => {
              image.remove();
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            Quitar
          </button>
        </div>
      )}
      {image.credit?.author && (
        <p className="field-help catalog-credit">
          Foto de{" "}
          <a
            href={image.credit.sourceUrl ?? "https://www.pexels.com"}
            target="_blank"
            rel="noreferrer"
          >
            Pexels.com
          </a>{" "}
          · Autor:{" "}
          <a
            href={image.credit.authorUrl ?? "https://www.pexels.com"}
            target="_blank"
            rel="noreferrer"
          >
            {image.credit.author}
          </a>
        </p>
      )}
      {showPicker && (
        <StockPicker
          onApply={(provider, photo) => {
            image.chooseStock(provider, photo);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          onError={onError}
        />
      )}
      <fieldset className="catalog-visibility">
        <legend>Disponibilidad</legend>
        <label className="catalog-check">
          <input
            type="checkbox"
            checked={availableAll}
            onChange={(event) => setAvailableAll(event.target.checked)}
          />
          Disponible en todos los locales
        </label>
        {!availableAll &&
          (locations.length === 0 ? (
            <p className="field-help">Aún no tienes locales.</p>
          ) : (
            locations.map((location) => (
              <label className="catalog-check" key={location.id}>
                <input
                  type="checkbox"
                  checked={locationIds.includes(location.id)}
                  onChange={() => toggleLocation(location.id)}
                />
                {location.name}
              </label>
            ))
          ))}
      </fieldset>
      <div className="catalog-editor-actions">
        <button className="button alt" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="button"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </section>
  );
}
