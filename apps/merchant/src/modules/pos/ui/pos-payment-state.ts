import type { RefObject } from "react";
import type { ResolveResponse } from "../../../app/backoffice/counter/types";
import type { PosOrder, PosPaymentMethod } from "./pos-types";
export type Phase =
  | "idle"
  | "scanning"
  | "resolving"
  | "ready"
  | "preparingPayment"
  | "paymentOpen"
  | "closing"
  | "closeUncertain";
export type PaymentState = {
  phase: Phase;
  resolved: ResolveResponse | null;
  productId: string | null;
  excludedId: string | null;
  received: number | null;
  receivedError: string | null;
  error: string | null;
  clientError: string | null;
  notice: string | null;
  review: boolean;
  validated: boolean;
  methods: PosPaymentMethod[];
  methodId: string | null;
};
export const initial = (): PaymentState => ({
  phase: "idle",
  resolved: null,
  productId: null,
  excludedId: null,
  received: null,
  receivedError: null,
  error: null,
  clientError: null,
  notice: null,
  review: false,
  validated: false,
  methods: [],
  methodId: null,
});

export type PaymentTicket = { generation: number; identity: string };
export type PaymentRuntime = {
  current: RefObject<PaymentState>;
  selected: RefObject<PosOrder | null>;
  locked: RefObject<boolean>;
  recoveryRequired: RefObject<string | null>;
  attempt: RefObject<{
    orderId: string;
    body: Readonly<Record<string, unknown>>;
  } | null>;
  update: (patch: Partial<PaymentState>) => void;
  ticket: () => PaymentTicket;
  live: (ticket: PaymentTicket) => boolean;
  denyNavigation: () => boolean;
  classify: (error: unknown, operation: "resolve" | "coupon" | "close") => void;
  onRecovered: (order: PosOrder, message: string) => void;
  onClosed: (order: PosOrder) => void;
  onBeginClose: () => void;
};
