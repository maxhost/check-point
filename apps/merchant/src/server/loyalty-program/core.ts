export type LoyaltyKind = "points" | "stamps" | "tiers" | "cashback";
export type ClauseInput = { templateId?: string; text?: string };
export type ProgramInput = {
  kind: LoyaltyKind;
  configuration: Record<string, unknown>;
  clauses: ClauseInput[];
};
export type CloseInput = {
  earningEndsAt?: unknown;
  redemptionEndsAt?: unknown;
};

export type EventAction =
  | "created"
  | "edited"
  | "closing_scheduled"
  | "closing_canceled"
  | "expired";

export class LoyaltyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
