import type {
  AccessRow,
  BillingAccess,
} from "@mi-pasaporte/domain/server/billing-access";

/**
 * Spec 0189 §Plan de pruebas, T1 + T2 — LA TABLA DE CASOS DEL EJE DE ACCESO, UN SOLO ORÁCULO
 * para sus dos definiciones: `billingAccess` (TS, `billing-access.test.ts`) y `accessSql`
 * (SQL, `billing-access.neon.integration.test.ts`, que siembra una fila por caso).
 *
 * `null` es «sin fila de suscripción». Las fechas son relativas a `NOW`.
 */
export const NOW = new Date("2026-10-10T12:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const DAY = 86_400_000;

export const ACCESS_CASES: Array<{
  name: string;
  row: AccessRow | null;
  expected: BillingAccess;
}> = [
  { name: "sin fila (fail-closed)", row: null, expected: "blocked" },
  {
    name: "sin id y sin prueba",
    row: { status: "active", stripeSubscriptionId: null, trialEndsAt: null },
    expected: "blocked",
  },
  {
    name: "prueba que vence EXACTAMENTE en now",
    row: { status: "active", stripeSubscriptionId: null, trialEndsAt: NOW },
    expected: "blocked",
  },
  {
    name: "prueba que vence en now + 1 ms",
    row: { status: "active", stripeSubscriptionId: null, trialEndsAt: at(1) },
    expected: "trial",
  },
  {
    name: "id vivo con la prueba vencida",
    row: {
      status: "active",
      stripeSubscriptionId: "sub_vivo",
      trialEndsAt: at(-DAY),
    },
    expected: "subscribed",
  },
  {
    name: "past_due con id (el impago no bloquea, PARQUEADO #54)",
    row: {
      status: "past_due",
      stripeSubscriptionId: "sub_past_due",
      trialEndsAt: null,
    },
    expected: "subscribed",
  },
  {
    name: "canceled con id y la prueba vigente",
    row: {
      status: "canceled",
      stripeSubscriptionId: "sub_cancelada",
      trialEndsAt: at(DAY),
    },
    expected: "trial",
  },
  {
    name: "incomplete_expired con id y la prueba vencida",
    row: {
      status: "incomplete_expired",
      stripeSubscriptionId: "sub_expirada",
      trialEndsAt: at(-DAY),
    },
    expected: "blocked",
  },
];
