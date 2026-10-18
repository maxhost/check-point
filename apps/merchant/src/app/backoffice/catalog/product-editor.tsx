"use client";

import { useRef, useState } from "react";
import { Plus } from "iconoir-react";
import {
  Alert,
  Button,
  CheckboxField,
  SelectField,
  Text,
  TextField,
} from "../../../ui";
import { StaffFormModal } from "../staff/staff-form-modal";
import {
  unitLabels,
  formatMoney,
  type MassUnit,
  type MeasureUnit,
  type Category,
  type Location,
  type Product,
  type ProductPayload,
} from "./types";
import {
  commercialFields,
  draftPrice,
  reconcileProduct,
  type SaveResult,
} from "./catalog-product-draft";
import { useCatalogImage } from "./use-catalog-image";
import { ProductImageField } from "./product-image-field";

type Props = {
  open: boolean;
  product: Product | null;
  categories: Category[];
  locations: Location[];
  currencyCode: string;
  salesMassUnits: MassUnit[];
  onReview: (id: string) => Promise<Product | null>;
  onCreateCategory: (name: string) => Promise<Category | null>;
  onSave: (payload: ProductPayload, id: string | null) => Promise<SaveResult>;
  onCancel: () => void;
  onError: (message: string) => void;
  categoryCreationDisabled?: boolean;
};

export function ProductEditor({
  open,
  product,
  categories,
  locations,
  currencyCode,
  salesMassUnits,
  onReview,
  onCreateCategory,
  onSave,
  onCancel,
  onError,
  categoryCreationDisabled = false,
}: Props) {
  const [baseline, setBaseline] = useState(product);
  const [soldByWeight, setSoldByWeight] = useState(
    product?.soldByWeight ?? false,
  );
  const [pricingUnit, setPricingUnit] = useState<MeasureUnit>(
    product?.pricingUnit ?? "unit",
  );
  const [issue, setIssue] = useState<Exclude<SaveResult, boolean> | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const savingRef = useRef(false);
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
    baseline?.imagePath ?? null,
    baseline
      ? {
          source: baseline.imageSource,
          author: baseline.imageAuthor,
          authorUrl: baseline.imageAuthorUrl,
          sourceUrl: baseline.imageSourceUrl,
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

  function draft(): ProductPayload {
    return {
      name: name.trim(),
      categoryId: categoryId || null,
      unitPrice: draftPrice(
        unitPrice,
        baseline?.unitPrice,
        !soldByWeight && !baseline?.soldByWeight,
      ),
      unitCost: draftPrice(
        unitCost,
        baseline?.unitCost,
        !soldByWeight && !baseline?.soldByWeight,
      ),
      soldByWeight,
      pricingUnit,
      ...(baseline ? { expectedSalesRevision: baseline.catalogRevision } : {}),
      availableAllLocations: availableAll,
      locationIds: availableAll ? [] : locationIds,
      imageAction: image.action,
    };
  }
  async function review() {
    if (!baseline || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const remote = await onReview(baseline.id);
      setIssue(
        remote
          ? {
              code: "catalog_changed",
              message: "Revisa los datos actuales antes de continuar.",
              product: remote,
            }
          : {
              code: "missing",
              message:
                "Este producto ya no está en el catálogo. Puedes descartar este borrador.",
            },
      );
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "No pudimos revisar el producto.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function acceptReview() {
    if (!baseline || !issue?.product) return;
    try {
      const { next } = reconcileProduct(baseline, draft(), issue.product);
      setName(next.name);
      setCategoryId(next.categoryId ?? "");
      setUnitPrice(next.unitPrice ?? "");
      setUnitCost(next.unitCost ?? "");
      setSoldByWeight(next.soldByWeight);
      setPricingUnit(next.pricingUnit);
      setAvailableAll(next.availableAllLocations);
      setLocationIds(next.locationIds);
      setBaseline(issue.product);
      setIssue(null);
      setReviewed(true);
    } catch {
      onError(
        "Revisa las tarifas: usa hasta 9 decimales, sin exponentes ni comas.",
      );
    }
  }
  let overlaps: string[] = [];
  if (baseline && issue?.product) {
    try {
      overlaps = reconcileProduct(baseline, draft(), issue.product).overlaps;
    } catch {
      /* Validation appears on save/review. */
    }
  }
  function remoteValue(field: keyof typeof commercialFields, remote: Product) {
    if (field === "categoryId")
      return (
        categories.find((item) => item.id === remote.categoryId)?.name ??
        "Sin categoría"
      );
    if (field === "locationIds")
      return remote.availableAllLocations
        ? "Todos los locales"
        : remote.locationIds
            .map(
              (id) =>
                locations.find((item) => item.id === id)?.name ??
                "Local no disponible",
            )
            .join(", ");
    if (field === "pricingUnit") return unitLabels[remote.pricingUnit];
    if (field === "soldByWeight") return remote.soldByWeight ? "Sí" : "No";
    if (field === "availableAllLocations")
      return remote.availableAllLocations
        ? "Todos los locales"
        : "Locales específicos";
    if (field === "unitPrice" || field === "unitCost")
      return remote[field] === null
        ? "Sin tarifa"
        : formatMoney(remote[field], currencyCode);
    return remote[field];
  }
  async function save() {
    if (savingRef.current || issue) return;
    if (!name.trim()) {
      onError("El nombre del producto es obligatorio.");
      return;
    }
    if (!availableAll && locationIds.length === 0) {
      onError("Selecciona al menos un local o habilita todos.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const values = draft();
      const uploadId =
        image.action === "replace" ? await image.upload() : undefined;
      const payload: ProductPayload = {
        ...values,
        ...(uploadId ? { uploadId, cropped: image.cropped } : {}),
        ...(image.action === "stock" && image.stock
          ? { provider: image.stock.provider, photoId: image.stock.photoId }
          : {}),
      };
      const ok = await onSave(payload, product?.id ?? null);
      if (typeof ok !== "boolean") {
        setIssue(ok);
        setReviewed(false);
      }
    } catch (reason) {
      onError(
        reason instanceof Error && reason.name !== "MeasureError"
          ? reason.message
          : "Revisa las tarifas: usa hasta 9 decimales, sin exponentes ni comas y un máximo de 999999999.999999999.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <StaffFormModal
      open={open}
      eyebrow={product ? "Editar producto" : "Nuevo producto"}
      title={product ? "Actualiza el producto" : "Suma un producto al catálogo"}
      description="Completa solo lo que ya tengas. La imagen, el costo y el precio de venta son opcionales."
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
        <CheckboxField
          label="Este producto se vende por peso"
          isSelected={soldByWeight}
          onChange={(selected) => {
            setSoldByWeight(selected);
            setPricingUnit(selected ? (salesMassUnits[0] ?? "kg") : "unit");
          }}
        />
        {soldByWeight && (
          <SelectField
            label="Unidad de venta"
            selectedKey={pricingUnit}
            onSelectionChange={(key) => setPricingUnit(String(key) as MassUnit)}
            options={salesMassUnits.map((unit) => ({
              id: unit,
              label: unitLabels[unit],
            }))}
          />
        )}
        <div className="catalog-money" data-tour="catalog-product-prices">
          <TextField
            label={`Precio de venta${soldByWeight ? ` por ${unitLabels[pricingUnit]}` : ""} (opcional)`}
            inputMode="decimal"
            value={unitPrice}
            onChange={setUnitPrice}
            placeholder="0.00"
            description={`En ${currencyCode}, sin IVA`}
          />
          <TextField
            label={`Precio de costo${soldByWeight ? ` por ${unitLabels[pricingUnit]}` : ""} (opcional)`}
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
              Elige dónde estará disponible este producto.
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
                <small>Selecciona uno o más locales.</small>
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
        {issue && (
          <Alert
            kind="warning"
            title={
              issue.code === "uncertain"
                ? "Resultado pendiente de revisión"
                : "Revisa el producto"
            }
          >
            <Text>{issue.message}</Text>
            {issue.product && (
              <>
                <Text>Datos actuales del catálogo:</Text>
                {Object.entries(commercialFields).map(([field, label]) => (
                  <Text key={field}>
                    {label}:{" "}
                    {remoteValue(
                      field as keyof typeof commercialFields,
                      issue.product!,
                    )}
                  </Text>
                ))}
                <Text>
                  {overlaps.length
                    ? `Ambos cambiaron: ${overlaps.join(", ")}. Se conservarán tus valores en estos campos.`
                    : "Tus cambios se conservarán; los campos intactos tomarán los datos actuales."}
                </Text>
                <Button variant="secondary" onPress={acceptReview}>
                  Ya revisé: conservar mis cambios
                </Button>
              </>
            )}
            {issue.code === "measurement_basis_required" && (
              <Text>
                Revisa la base de medida del producto en Recetas antes de
                cambiar cómo se vende.
              </Text>
            )}
            {!issue.product && baseline && issue.code !== "missing" && (
              <Button
                variant="secondary"
                isDisabled={saving}
                onPress={() => void review()}
              >
                Revisar estado actual
              </Button>
            )}
            {!baseline && issue.code === "uncertain" && (
              <Text>
                Revisa la lista antes de crear otro producto. Tu borrador sigue
                aquí.
              </Text>
            )}
            {issue.code !== "uncertain" &&
              issue.code !== "catalog_changed" &&
              issue.code !== "missing" && (
                <Button variant="secondary" onPress={() => setIssue(null)}>
                  Corregir borrador
                </Button>
              )}
            <Button variant="quiet" onPress={onCancel}>
              Descartar borrador
            </Button>
          </Alert>
        )}
        {reviewed && (
          <Text>
            Datos revisados. Guarda explícitamente para aplicar tus cambios.
          </Text>
        )}
        <div className="catalog-editor-actions">
          <button className="button alt" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="button"
            data-tour="catalog-product-save"
            type="submit"
            disabled={saving || issue !== null}
          >
            {saving ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </StaffFormModal>
  );
}
