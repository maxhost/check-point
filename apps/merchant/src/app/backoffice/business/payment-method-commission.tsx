"use client";
import { useRef, useState } from "react";
import type {
  BusinessCommission,
  BusinessPaymentMethod,
} from "../../../lib/business-contract";
import { Alert, Button, Form, FormActions, Text, TextField } from "../../../ui";
import { businessRequest, BusinessRequestError } from "./business-api";

/** Original fixed inputs have two decimal places; avoid editing the normalized amount. */
export function originalFixedInput(commission: BusinessCommission) {
  const exact = commission.originalFixed;
  if (!exact) return "";
  const cents = BigInt(exact.numerator) / BigInt(exact.denominator);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
export function PaymentMethodCommission({
  method,
  currencyCode,
  disabled,
  onSaved,
  onReload,
  onAccessDenied,
  onRefreshCurrency,
}: {
  method: BusinessPaymentMethod;
  currencyCode: string;
  disabled: boolean;
  onSaved: (method: BusinessPaymentMethod) => void;
  onAccessDenied: () => void;
  onRefreshCurrency: () => Promise<void>;
  onReload: () => Promise<BusinessPaymentMethod | undefined>;
}) {
  const [commission, setCommission] = useState(method.commission);
  const [fixedCurrency, setFixedCurrency] = useState(
    method.commission.currencyCode ?? currencyCode,
  );
  const [percent, setPercent] = useState(method.commission.percent ?? "");
  const [fixed, setFixed] = useState(originalFixedInput(method.commission));
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [currencyConflict, setCurrencyConflict] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const usesPercent = ["percent", "percent_and_fixed"].includes(
    method.chargeShape,
  );
  const usesFixed = ["fixed", "percent_and_fixed"].includes(method.chargeShape);
  function fail(reason: unknown) {
    setError(
      reason instanceof Error
        ? reason.message
        : "No pudimos guardar la comisión.",
    );
    if (reason instanceof BusinessRequestError) {
      if ([401, 403].includes(reason.status)) {
        setDenied(true);
        onAccessDenied();
      }
      if (reason.code === "commission_currency_conflict")
        setCurrencyConflict(true);
      if (reason.status === 409 || reason.status === 0 || reason.status >= 500)
        setReview(true);
    }
  }
  async function save() {
    if (locked.current || disabled || review || denied) return;
    locked.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { commission: savedCommission } = await businessRequest<{
        commission: BusinessCommission;
      }>(`payment-methods/${method.id}/commission`, {
        expectedRevisionId: commission.revisionId,
        ...(usesPercent ? { percent: percent.trim() || null } : {}),
        ...(usesFixed
          ? {
              fixed: fixed.trim() || null,
              ...(fixed.trim() ? { expectedCurrencyCode: fixedCurrency } : {}),
            }
          : {}),
      });
      setCommission(savedCommission);
      setFixedCurrency(savedCommission.currencyCode ?? currencyCode);
      onSaved({ ...method, commission: savedCommission });
      setPercent(savedCommission.percent ?? "");
      setFixed(originalFixedInput(savedCommission));
      setNotice(
        "Comisión guardada. Las ventas anteriores conservan su comisión.",
      );
    } catch (reason) {
      fail(reason);
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  async function reload() {
    if (locked.current || denied) return;
    locked.current = true;
    setSaving(true);
    try {
      const saved = await onReload();
      if (!saved)
        throw new Error("El medio ya no está disponible. Actualiza la página.");
      setCommission(saved.commission);
      setFixedCurrency(saved.commission.currencyCode ?? currencyCode);
      onSaved(saved);
      setPercent(saved.commission.percent ?? "");
      setFixed(originalFixedInput(saved.commission));
      setReview(false);
      setError(null);
      setNotice("Usando la comisión guardada.");
    } catch (reason) {
      fail(reason);
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  async function refreshCurrency() {
    if (locked.current || denied) return;
    locked.current = true;
    setSaving(true);
    try {
      await onRefreshCurrency();
      setReview(false);
      setCurrencyConflict(false);
      setError(null);
      setNotice(
        "Moneda actualizada. Tu borrador conserva su importe y moneda; configura el fijo en la moneda actual para cambiarlo.",
      );
    } catch (reason) {
      fail(reason);
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  if (!usesPercent && !usesFixed)
    return <Text variant="small">Sin comisión. Cero conocido.</Text>;
  const blocked = disabled || saving || review || denied;
  const currencyMismatch = usesFixed && fixedCurrency !== currencyCode;
  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {!commission.configured && (
        <Alert kind="warning" title="Sin configurar">
          <Text>
            Los componentes vacíos usan 0 provisional. Se calcula lo que hayas
            configurado y se conserva el aviso; ese resultado no es un margen
            real.
          </Text>
        </Alert>
      )}
      {currencyMismatch && (
        <Alert kind="warning" title="Revisa la moneda del fijo">
          <div className="grid gap-3">
            <Text>
              Fijo guardado:{" "}
              {originalFixedInput(commission) || "Sin configurar"}{" "}
              {fixedCurrency}. No se convierte a {currencyCode}. Para editar la
              comisión, configura el fijo en la moneda actual o déjalo vacío
              como sin configurar.
            </Text>
            <Button
              variant="secondary"
              isDisabled={blocked}
              onPress={() => {
                setFixed("");
                setFixedCurrency(currencyCode);
              }}
            >
              Configurar fijo en {currencyCode}
            </Button>
          </div>
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {usesPercent && (
          <TextField
            label={`Porcentaje de ${method.name} (%)`}
            value={percent}
            inputMode="decimal"
            description="Deja vacío si aún no lo conoces. Un 0 explícito es una comisión conocida."
            isDisabled={blocked}
            onChange={setPercent}
          />
        )}
        {usesFixed && (
          <TextField
            label={`Fijo de ${method.name} (${fixedCurrency})`}
            value={fixed}
            inputMode="decimal"
            description="Se cobra una vez por medio en cada venta. Deja vacío si aún no lo conoces."
            isDisabled={blocked || currencyMismatch}
            onChange={setFixed}
          />
        )}
      </div>
      {error && (
        <Alert kind="error" title="Revisa la comisión">
          <Text>{error}</Text>
        </Alert>
      )}
      {notice && <Alert kind="success" title={notice} />}
      {review && !denied && (
        <Alert kind="warning" title="Tu borrador se conserva">
          <div className="grid gap-3">
            <Text>
              {currencyConflict
                ? "La moneda del negocio cambió. Actualízala para revisar la diferencia. Tu importe y su moneda se conservan; no se convierten ni se guardan nuevamente."
                : "Actualiza la comisión antes de volver a guardar. Esta acción descarta el borrador de este medio."}
            </Text>
            <Button
              variant="secondary"
              isLoading={saving}
              onPress={() =>
                void (currencyConflict ? refreshCurrency() : reload())
              }
            >
              {currencyConflict
                ? "Actualizar moneda del negocio"
                : `Descartar borrador y actualizar ${method.name}`}
            </Button>
          </div>
        </Alert>
      )}
      <FormActions>
        <Button
          type="submit"
          variant="secondary"
          isDisabled={blocked || currencyMismatch}
          isLoading={saving}
        >
          Guardar comisión de {method.name}
        </Button>
      </FormActions>
    </Form>
  );
}
