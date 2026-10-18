import type {
  BackofficeInitialContext,
  ModuleDTO,
} from "../../backoffice-context-contract";

export type BackofficeRefreshState = Readonly<{
  coreSignature: string;
  modulesSignature: string | null;
  gateCode: string | null;
  revision: number;
  issuedRevision: number;
  acknowledgedRevision: number;
  inFlight: boolean;
}>;
const coreSignature = (core: BackofficeInitialContext) =>
  JSON.stringify([
    core.membership.role,
    [...new Set(core.membership.permissions)].sort(),
    core.membership.status,
    core.business.status,
    core.billing.access,
  ]);
export function createBackofficeRefreshState(
  core: BackofficeInitialContext,
): BackofficeRefreshState {
  return {
    coreSignature: coreSignature(core),
    modulesSignature: null,
    gateCode: null,
    revision: 0,
    issuedRevision: 0,
    acknowledgedRevision: 0,
    inFlight: false,
  };
}
export function confirmBackofficeCore(
  state: BackofficeRefreshState,
  core: BackofficeInitialContext,
): BackofficeRefreshState {
  const signature = coreSignature(core);
  return signature === state.coreSignature
    ? state
    : { ...state, coreSignature: signature, revision: state.revision + 1 };
}
export function confirmBackofficeModules(
  state: BackofficeRefreshState,
  modules: readonly ModuleDTO[],
): BackofficeRefreshState {
  const signature = JSON.stringify(
    modules
      .map(({ id, enabled }) => [id, enabled] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    ...state,
    modulesSignature: signature,
    gateCode: null,
    revision:
      state.revision +
      (state.modulesSignature !== null && state.modulesSignature !== signature
        ? 1
        : 0),
  };
}
/** Only this API gate is absent from the reporter; ordinary email403 is not a page exit. */
export function confirmBackofficeModuleGate(
  state: BackofficeRefreshState,
  code: string,
): BackofficeRefreshState {
  return code === state.gateCode
    ? state
    : {
        ...state,
        gateCode: code,
        revision: state.revision + (code === "pin_change_required" ? 1 : 0),
      };
}
export function beginBackofficeRefresh(
  state: BackofficeRefreshState,
): BackofficeRefreshState {
  return state.inFlight || state.revision <= state.acknowledgedRevision
    ? state
    : { ...state, inFlight: true, issuedRevision: state.revision };
}
/** A new committed same-scope boot acknowledges an issued refresh; it never installs its DTO. */
export function acknowledgeBackofficeRefresh(
  state: BackofficeRefreshState,
): BackofficeRefreshState {
  return state.inFlight
    ? { ...state, inFlight: false, acknowledgedRevision: state.issuedRevision }
    : state;
}
/** No automatic retry. A later intentional signal may attempt the still-unacknowledged demand. */
export function failBackofficeRefresh(
  state: BackofficeRefreshState,
): BackofficeRefreshState {
  return { ...state, inFlight: false };
}
