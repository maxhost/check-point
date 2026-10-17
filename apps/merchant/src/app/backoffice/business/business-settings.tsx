"use client";
import { useRef, useState } from "react";
import {
  canonicalVatRate,
  resultingBrandVat,
} from "@mi-pasaporte/domain/server/brand/vat";
import type {
  BusinessFiscal,
  BusinessRegional,
} from "../../../lib/business-contract";
import {
  Alert,
  Button,
  Card,
  Form,
  FormActions,
  FormSection,
  Text,
} from "../../../ui";
import { businessRequest, BusinessRequestError } from "./business-api";
import { FiscalFields } from "./fiscal-fields";
import { RegionalFields } from "./regional-fields";

export function BusinessSettings({
  initialRegional,
  initialFiscal,
  onCurrencyChange,
  onAccessDenied,
}: {
  onAccessDenied: () => void;
  initialRegional: BusinessRegional;
  initialFiscal: BusinessFiscal;
  onCurrencyChange: (value: string) => void;
}) {
  const [regional, setRegional] = useState(initialRegional);
  const [fiscal, setFiscal] = useState(initialFiscal);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [review, setReview] = useState(
    initialRegional.revision !== initialFiscal.revision,
  );
  const [denied, setDenied] = useState(false);
  const locked = useRef(false);
  function fail(reason: unknown) {
    setError(
      reason instanceof Error
        ? reason.message
        : "No pudimos guardar los datos.",
    );
    if (reason instanceof BusinessRequestError) {
      if ([401, 403].includes(reason.status)) {
        setDenied(true);
        onAccessDenied();
      }
      if (reason.status === 409 || reason.status === 0 || reason.status >= 500)
        setReview(true);
    }
  }
  async function save(area: "regional" | "fiscal") {
    if (locked.current || review || denied) return;
    let body: BusinessFiscal | BusinessRegional = regional;
    if (area === "fiscal") {
      try {
        const saleVatRate = canonicalVatRate(fiscal.saleVatRate);
        resultingBrandVat({ ...fiscal, saleVatRate }, {});
        body = { ...fiscal, saleVatRate };
      } catch (reason) {
        fail(reason);
        return;
      }
    }
    locked.current = true;
    setSaving(area);
    setError(null);
    setNotice(null);
    try {
      if (area === "regional") {
        const saved = await businessRequest<BusinessRegional>(area, body);
        setRegional(saved);
        setFiscal((draft) => ({ ...draft, revision: saved.revision }));
        onCurrencyChange(saved.currencyCode);
      } else {
        const saved = await businessRequest<BusinessFiscal>(area, body);
        setFiscal(saved);
        setRegional((draft) => ({ ...draft, revision: saved.revision }));
      }
      setNotice(
        area === "regional"
          ? "Configuración regional guardada."
          : "Datos fiscales guardados.",
      );
    } catch (reason) {
      fail(reason);
    } finally {
      locked.current = false;
      setSaving(null);
    }
  }
  async function reload() {
    if (locked.current || denied) return;
    locked.current = true;
    setSaving("reload");
    try {
      const [savedRegional, savedFiscal] = await Promise.all([
        businessRequest<BusinessRegional>("regional"),
        businessRequest<BusinessFiscal>("fiscal"),
      ]);
      if (savedRegional.revision !== savedFiscal.revision)
        throw new Error(
          "La configuración cambió mientras la consultabas. Intenta actualizar nuevamente.",
        );
      setRegional(savedRegional);
      setFiscal(savedFiscal);
      onCurrencyChange(savedRegional.currencyCode);
      setReview(false);
      setError(null);
      setNotice("Usando la configuración guardada.");
    } catch (reason) {
      fail(reason);
    } finally {
      locked.current = false;
      setSaving(null);
    }
  }
  const disabled = Boolean(saving) || denied || review;
  return (
    <div className="grid gap-8">
      {error && (
        <Alert kind="error" title="Revisa la configuración">
          <Text>{error}</Text>
        </Alert>
      )}
      {notice && <Alert kind="success" title={notice} />}
      {review && !denied && (
        <Alert kind="warning" title="Tu borrador se conserva">
          <div className="grid gap-3">
            <Text>
              La configuración pudo cambiar. Actualiza ambas secciones antes de
              volver a guardar. Esta acción descarta los borradores regional y
              fiscal.
            </Text>
            <Button
              variant="secondary"
              isLoading={saving === "reload"}
              onPress={() => void reload()}
            >
              Descartar borradores y actualizar configuración
            </Button>
          </div>
        </Alert>
      )}
      <Card>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void save("regional");
          }}
        >
          <FormSection
            title="Configuración regional"
            description="Controla cómo se interpretan horarios y precios."
          >
            <RegionalFields
              timezone={regional.timezone}
              currencyCode={regional.currencyCode}
              disabled={disabled}
              onTimezoneChange={(timezone) =>
                setRegional({ ...regional, timezone })
              }
              onCurrencyChange={(currencyCode) =>
                setRegional({ ...regional, currencyCode })
              }
            />
          </FormSection>
          <FormActions>
            <Button
              type="submit"
              isDisabled={disabled}
              isLoading={saving === "regional"}
            >
              Guardar configuración regional
            </Button>
          </FormActions>
        </Form>
      </Card>
      <Card>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void save("fiscal");
          }}
        >
          <FormSection
            title="Datos fiscales"
            description="Guardamos estos datos para funciones futuras. Hoy no cambian los precios del catálogo, los cobros del POS ni los costos de tus insumos."
          >
            <FiscalFields
              draft={fiscal}
              onChange={setFiscal}
              disabled={disabled}
            />
          </FormSection>
          <FormActions>
            <Button
              type="submit"
              isDisabled={disabled}
              isLoading={saving === "fiscal"}
            >
              Guardar datos fiscales
            </Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
