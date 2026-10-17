"use client";
import { useRef, useState } from "react";
import type {
  BusinessCatalog,
  BusinessMethods,
  BusinessPaymentMethod,
  ChargeShape,
} from "../../../lib/business-contract";
import {
  Alert,
  Button,
  Form,
  FormActions,
  Heading,
  SelectField,
  Text,
  TextField,
} from "../../../ui";
import { businessRequest, BusinessRequestError } from "./business-api";
import { PaymentMethodCommission } from "./payment-method-commission";

export const chargeShapes: { id: ChargeShape; label: string }[] = [
  { id: "none", label: "Sin comisión" },
  { id: "percent", label: "Porcentaje" },
  { id: "fixed", label: "Importe fijo" },
  { id: "percent_and_fixed", label: "Porcentaje e importe fijo" },
];
export function PaymentMethods({
  initial,
  catalog,
  currencyCode,
  onAccessDenied,
  onRefreshCurrency,
}: {
  initial: BusinessMethods;
  catalog: BusinessCatalog;
  currencyCode: string;
  onAccessDenied: () => void;
  onRefreshCurrency: () => Promise<void>;
}) {
  const [methods, setMethods] = useState(initial.methods);
  const [source, setSource] = useState("catalog");
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shape, setShape] = useState<ChargeShape>("percent");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const locked = useRef(false);
  async function read() {
    const data = await businessRequest<BusinessMethods>(
      "payment-methods?status=all",
    );
    setMethods(data.methods);
    return data.methods;
  }
  async function mutate(path: string, body: unknown, id: string) {
    if (locked.current || denied) return;
    locked.current = true;
    setSaving(id);
    setError(null);
    setNotice(null);
    try {
      await businessRequest(path, body, "POST");
      await read();
      if (id === "add") {
        setName("");
        setCatalogId(null);
      }
      setNotice(
        id === "add"
          ? "Medio de pago agregado."
          : "Medio archivado. Su historial se conserva.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos guardar el medio.",
      );
      if (
        reason instanceof BusinessRequestError &&
        [401, 403].includes(reason.status)
      ) {
        setDenied(true);
        onAccessDenied();
      }
    } finally {
      locked.current = false;
      setSaving(null);
    }
  }
  const disabled = Boolean(saving) || denied;
  function update(method: BusinessPaymentMethod) {
    setMethods((current) =>
      current.map((entry) =>
        entry.id === method.id
          ? {
              ...entry,
              commission: method.commission,
              status: entry.status === "archived" ? "archived" : method.status,
            }
          : entry,
      ),
    );
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Heading level={2}>Medios de pago</Heading>
        <Text variant="muted">
          Elige cómo cobras y configura la comisión de cada medio. Los cambios
          de comisión se aplican a ventas futuras.
        </Text>
      </div>
      {error && (
        <Alert kind="error" title="No pudimos guardar el medio">
          <Text>{error}</Text>
        </Alert>
      )}
      {notice && <Alert kind="success" title={notice} />}
      {!methods.length && (
        <Text>
          No tienes medios de pago. Agrega uno desde el catálogo o crea uno
          libre.
        </Text>
      )}
      <div className="grid divide-y divide-border">
        {methods.map((method) => (
          <section
            key={method.id}
            aria-label={`Medio ${method.name}`}
            className="grid gap-4 py-6 first:pt-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <Heading level={3}>{method.name}</Heading>
                <Text variant="small">
                  {method.status === "archived"
                    ? "Archivado"
                    : method.isCash
                      ? "Activo · Efectivo predeterminado"
                      : "Activo"}{" "}
                  ·{" "}
                  {
                    chargeShapes.find(
                      (entry) => entry.id === method.chargeShape,
                    )?.label
                  }
                </Text>
              </div>
              {method.status === "active" && !method.isCash && (
                <Button
                  variant="quiet"
                  isDisabled={disabled}
                  isLoading={saving === method.id}
                  onPress={() =>
                    void mutate(
                      `payment-methods/${method.id}/archive`,
                      {},
                      method.id,
                    )
                  }
                >
                  Archivar {method.name}
                </Button>
              )}
            </div>
            {method.status === "active" && (
              <PaymentMethodCommission
                method={method}
                currencyCode={currencyCode}
                disabled={disabled}
                onSaved={update}
                onAccessDenied={onAccessDenied}
                onRefreshCurrency={onRefreshCurrency}
                onReload={async () =>
                  (
                    await businessRequest<BusinessMethods>(
                      "payment-methods?status=all",
                    )
                  ).methods.find((entry) => entry.id === method.id)
                }
              />
            )}
          </section>
        ))}
      </div>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          if (source === "catalog" ? catalogId : name.trim())
            void mutate(
              "payment-methods",
              source === "catalog"
                ? { catalogId }
                : { name: name.trim(), chargeShape: shape },
              "add",
            );
        }}
      >
        <Heading level={3}>Agregar medio de pago</Heading>
        <SelectField
          label="Origen del medio"
          selectedKey={source}
          isDisabled={disabled}
          options={[
            { id: "catalog", label: "Catálogo del país" },
            { id: "custom", label: "Medio libre" },
          ]}
          onSelectionChange={(key) => setSource(String(key))}
        />
        {source === "catalog" ? (
          <>
            <Text variant="small">
              {catalog.source === "country"
                ? `Catálogo de ${catalog.countryCode}`
                : "Catálogo base disponible para tu país"}
              . No incluye tasas de comisión.
            </Text>
            <SelectField
              label="Medio del catálogo"
              selectedKey={catalogId}
              isDisabled={disabled}
              isRequired
              options={catalog.entries.map((entry) => ({
                id: entry.id,
                label: entry.name,
                description: chargeShapes.find(
                  (shape) => shape.id === entry.chargeShape,
                )?.label,
              }))}
              onSelectionChange={(key) =>
                setCatalogId(key === null ? null : String(key))
              }
            />
          </>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Nombre del medio"
              value={name}
              maxLength={120}
              isRequired
              isDisabled={disabled}
              onChange={setName}
            />
            <SelectField
              label="Forma de cobro de la comisión"
              selectedKey={shape}
              isDisabled={disabled}
              options={chargeShapes}
              onSelectionChange={(key) => setShape(String(key) as ChargeShape)}
            />
          </div>
        )}
        <FormActions>
          <Button
            type="submit"
            isLoading={saving === "add"}
            isDisabled={
              disabled || (source === "catalog" ? !catalogId : !name.trim())
            }
          >
            Agregar medio de pago
          </Button>
        </FormActions>
      </Form>
    </div>
  );
}
