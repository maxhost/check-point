"use client";
import { useRef, useState } from "react";
import {
  canonicalVatRate,
  resultingBrandVat,
} from "@mi-pasaporte/domain/server/brand/vat";
import type {
  BusinessFiscal,
  BusinessRegional,
  BusinessSalesUnits,
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
import { SalesUnitsFields } from "./sales-units-fields";
import { coherentRevisions, reconcileDraft } from "./settings-drafts";
import { RegionalFields } from "./regional-fields";

export function BusinessSettings({
  initialRegional,
  initialFiscal,
  initialUnits,
  onCurrencyChange,
  onAccessDenied,
}: {
  onAccessDenied: () => void;
  initialRegional: BusinessRegional;
  initialFiscal: BusinessFiscal;
  initialUnits: BusinessSalesUnits;
  onCurrencyChange: (value: string) => void;
}) {
  const [regional, setRegional] = useState(initialRegional);
  const [fiscal, setFiscal] = useState(initialFiscal);
  const [units, setUnits] = useState(initialUnits);
  const baseline = useRef({
    regional: initialRegional,
    fiscal: initialFiscal,
    units: initialUnits,
  });
  const [differences, setDifferences] = useState<
    { area: string; text: string }[]
  >([]);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [review, setReview] = useState(
    !coherentRevisions(initialRegional, initialFiscal, initialUnits),
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
      setUnitsError(reason.fields?.salesMassUnits ?? null);
      if (reason.code === "unit_in_use" && reason.products?.length)
        setError(
          `${reason.message} Productos: ${reason.products.map((product) => product.name).join(", ")}.`,
        );
      if ([401, 403].includes(reason.status)) {
        setDenied(true);
        onAccessDenied();
      }
      if (reason.status === 409 || reason.status === 0 || reason.status >= 500)
        setReview(true);
    }
  }
  async function save(area: "regional" | "fiscal" | "sales-units") {
    if (locked.current || review || denied) return;
    if (area === "sales-units" && units.salesMassUnits.length === 0) {
      setUnitsError("Elige al menos una unidad de venta.");
      return;
    }
    let body: BusinessFiscal | BusinessRegional | BusinessSalesUnits =
      area === "sales-units" ? units : regional;
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
    setUnitsError(null);
    try {
      if (area === "regional") {
        const saved = await businessRequest<BusinessRegional>(area, body);
        setRegional(saved);
        baseline.current.regional = saved;
        setUnits((draft) => ({ ...draft, revision: saved.revision }));
        setFiscal((draft) => ({ ...draft, revision: saved.revision }));
        onCurrencyChange(saved.currencyCode);
      } else if (area === "fiscal") {
        const saved = await businessRequest<BusinessFiscal>(area, body);
        setFiscal(saved);
        baseline.current.fiscal = saved;
        setUnits((draft) => ({ ...draft, revision: saved.revision }));
        setRegional((draft) => ({ ...draft, revision: saved.revision }));
      }
      if (area === "sales-units") {
        const saved = await businessRequest<BusinessSalesUnits>(area, body);
        setUnits(saved);
        baseline.current.units = saved;
        setRegional((draft) => ({ ...draft, revision: saved.revision }));
        setFiscal((draft) => ({ ...draft, revision: saved.revision }));
      }
      setDifferences((items) => items.filter((item) => item.area !== area));
      setNotice(
        area === "regional"
          ? "Configuración regional guardada."
          : area === "fiscal"
            ? "Datos fiscales guardados."
            : "Unidades de venta guardadas.",
      );
    } catch (reason) {
      fail(reason);
    } finally {
      locked.current = false;
      setSaving(null);
    }
  }
  async function reload(discard = false) {
    if (locked.current || denied) return;
    locked.current = true;
    setSaving("reload");
    try {
      const [savedRegional, savedFiscal, savedUnits] = await Promise.all([
        businessRequest<BusinessRegional>("regional"),
        businessRequest<BusinessFiscal>("fiscal"),
        businessRequest<BusinessSalesUnits>("sales-units"),
      ]);
      if (!coherentRevisions(savedRegional, savedFiscal, savedUnits))
        throw new Error(
          "La configuración cambió mientras la consultabas. Intenta actualizar nuevamente.",
        );
      const r = reconcileDraft(
        baseline.current.regional,
        regional,
        savedRegional,
      );
      const f = reconcileDraft(baseline.current.fiscal, fiscal, savedFiscal);
      const u = reconcileDraft(baseline.current.units, units, savedUnits);
      const labels: Record<string, string> = {
        timezone: "Zona horaria",
        currencyCode: "Moneda",
        chargesVat: "Cobro de IVA",
        saleVatRate: "Tasa de IVA",
        recoversPurchaseVat: "Recuperación de IVA",
        salesMassUnits: "Unidades de venta",
      };
      const display = (value: unknown): string =>
        value === null
          ? "Sin definir"
          : typeof value === "boolean"
            ? value
              ? "Sí"
              : "No"
            : Array.isArray(value)
              ? value.join(", ")
              : String(value);
      const describe = (
        area: string,
        keys: PropertyKey[],
        local: object,
        remote: object,
      ) =>
        keys.map((key) => ({
          area,
          text: `${labels[String(key)]}: tu borrador ${display(Reflect.get(local, key))}; guardado ${display(Reflect.get(remote, key))}.`,
        }));
      setDifferences(
        discard
          ? []
          : [
              ...describe("regional", r.overlaps, regional, savedRegional),
              ...describe("fiscal", f.overlaps, fiscal, savedFiscal),
              ...describe("sales-units", u.overlaps, units, savedUnits),
            ],
      );
      setRegional(discard ? savedRegional : r.draft);
      setFiscal(discard ? savedFiscal : f.draft);
      setUnits(discard ? savedUnits : u.draft);
      baseline.current = {
        regional: savedRegional,
        fiscal: savedFiscal,
        units: savedUnits,
      };
      onCurrencyChange(savedRegional.currencyCode);
      setReview(false);
      setError(null);
      setNotice(
        discard
          ? "Usando la configuración guardada."
          : "Configuración consultada. Conservamos tus cambios; revísalos antes de guardar.",
      );
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
              La configuración pudo cambiar. Consulta los datos guardados para
              revisar tus cambios antes de volver a guardar. Tus borradores se
              conservan.
            </Text>
            <Button
              variant="secondary"
              isLoading={saving === "reload"}
              onPress={() => void reload()}
            >
              Consultar configuración y conservar mis cambios
            </Button>
          </div>
        </Alert>
      )}
      {differences.length > 0 && (
        <Alert kind="warning" title="Revisa los cambios que coinciden">
          <div className="grid gap-3">
            {differences.map((difference) => (
              <Text key={difference.text}>{difference.text}</Text>
            ))}
            <Button
              variant="secondary"
              isDisabled={Boolean(saving)}
              onPress={() => void reload(true)}
            >
              Descartar mis cambios y usar los datos guardados
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
      <Card>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void save("sales-units");
          }}
        >
          <FormSection
            title="Unidades de venta"
            description="Elige al menos una unidad para los productos que se venden por peso."
          >
            <SalesUnitsFields
              draft={units}
              onChange={setUnits}
              disabled={disabled}
              error={unitsError}
            />
          </FormSection>
          <FormActions>
            <Button
              type="submit"
              isDisabled={disabled}
              isLoading={saving === "sales-units"}
            >
              Guardar unidades de venta
            </Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
