import type { ExactAmount } from "@mi-pasaporte/domain/financial";
export type ChargeShape = "none" | "percent" | "fixed" | "percent_and_fixed";
export type BusinessCommission = {
  providerId: string;
  methodId: string;
  name: string;
  status: string;
  chargeShape: ChargeShape;
  revisionId: string | null;
  percent: string | null;
  fixed: string | null;
  originalFixed: ExactAmount | null;
  fixedNormalizationAdjustment: ExactAmount | null;
  currencyCode: string | null;
  minorUnit: number | null;
  configured: boolean;
};
export type BusinessPaymentMethod = {
  id: string;
  name: string;
  chargeShape: ChargeShape;
  isCash: boolean;
  status: "active" | "archived";
  commission: BusinessCommission;
};
export type BusinessMethods = {
  methods: BusinessPaymentMethod[];
  defaultMethodId: string | null;
};
export type BusinessCatalog = {
  countryCode: string;
  source: "country" | "base";
  entries: {
    id: string;
    name: string;
    chargeShape: ChargeShape;
    isCash: boolean;
    initiallySuggested: boolean;
  }[];
};
export type BusinessRegional = {
  timezone: string;
  currencyCode: string;
  revision: number;
};
export type BusinessFiscal = {
  chargesVat: boolean;
  saleVatRate: string | null;
  recoversPurchaseVat: boolean;
  revision: number;
};
