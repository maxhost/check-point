"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BusinessCatalog,
  BusinessFiscal,
  BusinessMethods,
  BusinessRegional,
} from "../../../lib/business-contract";
import { Alert, Button, Card, PageHeader, Text } from "../../../ui";
import { businessRequest, BusinessRequestError } from "./business-api";
import { PaymentMethods } from "./payment-methods";
import { BusinessSettings } from "./business-settings";

type Data = {
  methods: BusinessMethods;
  catalog: BusinessCatalog;
  regional: BusinessRegional;
  fiscal: BusinessFiscal;
};
export function BusinessConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [methods, catalog, regional, fiscal] = await Promise.all([
        businessRequest<BusinessMethods>("payment-methods?status=all"),
        businessRequest<BusinessCatalog>("payment-method-catalog"),
        businessRequest<BusinessRegional>("regional"),
        businessRequest<BusinessFiscal>("fiscal"),
      ]);
      setData({ methods, catalog, regional, fiscal });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No pudimos cargar Negocio.",
      );
      if (
        reason instanceof BusinessRequestError &&
        [401, 403].includes(reason.status)
      )
        setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function deny() {
    setData(null);
    setDenied(true);
    setError(
      "Tu acceso cambió. Vuelve al inicio o inicia sesión con una cuenta autorizada.",
    );
  }
  return (
    <main className="merchant-shell">
      <div className="mx-auto grid max-w-4xl gap-8 py-8">
        <PageHeader
          title="Negocio"
          description="Administra tus medios de pago, configuración regional y datos fiscales."
        />
        {error && (
          <Alert kind="error" title="No pudimos cargar Negocio">
            <Text>{error}</Text>
          </Alert>
        )}
        {loading && <Text>Cargando configuración del negocio…</Text>}
        {!data && !loading && !denied && (
          <Button variant="secondary" onPress={() => void load()}>
            Reintentar
          </Button>
        )}
        {data && (
          <>
            <Card>
              <PaymentMethods
                initial={data.methods}
                catalog={data.catalog}
                currencyCode={data.regional.currencyCode}
                onAccessDenied={deny}
              />
            </Card>
            <BusinessSettings
              onAccessDenied={deny}
              initialRegional={data.regional}
              initialFiscal={data.fiscal}
              onCurrencyChange={(currencyCode) =>
                setData(
                  (value) =>
                    value && {
                      ...value,
                      regional: { ...value.regional, currencyCode },
                    },
                )
              }
            />
          </>
        )}
      </div>
    </main>
  );
}
