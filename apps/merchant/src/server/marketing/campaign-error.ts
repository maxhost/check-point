/**
 * The error every marketing store throws and `app/api/marketing/_auth.ts` maps to its
 * HTTP answer (`fields` only on a 400 `validation`). It lives alone so that a store module
 * can throw it without importing `campaign-store.ts` — `reward-store.ts` is imported BY that
 * file, and the cycle would reach a binding before it exists. `campaign-store.ts`
 * re-exports it: every existing import keeps working.
 */
export class CampaignError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}
