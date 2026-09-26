import type { StepId } from "./program-form-state";
export type LoyaltyTask = "create" | "edit" | "close" | "policies";
export type LoyaltyWriteOutcome = {
  attemptId: number;
  operation: "create" | "edit" | "close" | "cancel";
  status:
    | "confirmed+refreshed"
    | "confirmed+refreshFailed"
    | "rejected"
    | "uncertain";
};
export type LoyaltyTourSession = {
  instance: number;
  task: LoyaltyTask;
  afterAttempt: number;
};
export function outcomeFor(
  session: LoyaltyTourSession,
  outcome: LoyaltyWriteOutcome | null,
) {
  return outcome &&
    outcome.attemptId > session.afterAttempt &&
    outcome.operation === (session.task === "policies" ? "edit" : session.task)
    ? outcome.status
    : null;
}
export type LoyaltyEditorSignal = { step: StepId; kind: "points" | "stamps" };
