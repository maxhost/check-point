export type LoyaltyKind = "points" | "stamps" | "tiers" | "cashback";
export type ClauseInput = { templateId?: string; text?: string };
export type StampAction = "keep" | "replace" | "remove";
/** Normalized card design (Sellos only). Colors are `#RRGGBB` uppercase; a null
 * `backgroundColor2` means a solid background and forces a null `gradientAngle`. */
export type CardDesignInput = {
  backgroundColor: string;
  backgroundColor2: string | null;
  gradientAngle: number | null;
  borderColor: string;
};
export type ProgramInput = {
  kind: LoyaltyKind;
  configuration: Record<string, unknown>;
  clauses: ClauseInput[];
  stampAction: StampAction;
  stampUploadId?: string;
  cardDesign: CardDesignInput | null;
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
