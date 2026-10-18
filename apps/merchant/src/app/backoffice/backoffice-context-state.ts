import type {
  BackofficeInitialContext,
  BackofficeModulesResult,
  BackofficeModulesSeed,
} from "../../backoffice-context-contract";

export type BackofficeResource =
  "session" | "modules" | "inbox" | "checklist" | "summary";
export const backofficeResources: readonly BackofficeResource[] = [
  "session",
  "modules",
  "inbox",
  "checklist",
  "summary",
];

/** Local causal ticket, never an authorization credential. */
export type BackofficeResourceTicket = Readonly<{
  resource: BackofficeResource;
  scopeKey: string;
  epoch: number;
  generation: number;
}>;

export type BackofficeContextState = Readonly<{
  /** Null means a present provider has withdrawn its private presentation. */
  core: BackofficeInitialContext | null;
  modules: BackofficeModulesResult | { state: "loading" };
  epoch: number;
  generations: Readonly<Record<BackofficeResource, number>>;
  initialModulesTicket: (BackofficeResourceTicket & { bootId: string }) | null;
  observedBootIds: readonly string[];
  /** Signal only: B1a performs no revalidation transport or navigation. */
  revalidationBootId: string | null;
}>;

export function createBackofficeContextState(
  core: BackofficeInitialContext,
): BackofficeContextState {
  return {
    core,
    modules: { state: "loading" },
    epoch: 0,
    generations: { session: 0, modules: 0, inbox: 0, checklist: 0, summary: 0 },
    initialModulesTicket: {
      resource: "modules",
      scopeKey: core.scopeKey,
      bootId: core.bootId,
      epoch: 0,
      generation: 0,
    },
    observedBootIds: [core.bootId],
    revalidationBootId: null,
  };
}

/** Capture at the beginning of an intention; a retired provider issues no ticket. */
export function captureBackofficeTicket(
  state: BackofficeContextState,
  resource: BackofficeResource,
): BackofficeResourceTicket | null {
  return state.core
    ? {
        resource,
        scopeKey: state.core.scopeKey,
        epoch: state.epoch,
        generation: state.generations[resource],
      }
    : null;
}

export function isBackofficeTicketCurrent(
  state: BackofficeContextState,
  ticket: BackofficeResourceTicket,
): boolean {
  return (
    state.core !== null &&
    ticket.scopeKey === state.core.scopeKey &&
    ticket.epoch === state.epoch &&
    ticket.generation === state.generations[ticket.resource]
  );
}

export function invalidateBackofficeResources(
  state: BackofficeContextState,
  resources: readonly BackofficeResource[],
): BackofficeContextState {
  if (!state.core || !resources.length) return state;
  const generations = { ...state.generations };
  for (const resource of new Set(resources)) generations[resource] += 1;
  return { ...state, generations, initialModulesTicket: null };
}

export function applyBackofficeModulesSeed(
  state: BackofficeContextState,
  seed: BackofficeModulesSeed,
): BackofficeContextState {
  const ticket = state.initialModulesTicket;
  if (
    !ticket ||
    seed.bootId !== ticket.bootId ||
    seed.scopeKey !== ticket.scopeKey ||
    !isBackofficeTicketCurrent(state, ticket)
  )
    return state;
  return { ...state, modules: seed.result, initialModulesTicket: null };
}

/** Withdrawal is immediate and irreversible within this provider/document. */
export function retireBackofficeContext(
  state: BackofficeContextState,
): BackofficeContextState {
  if (!state.core) return state;
  const invalidated = invalidateBackofficeResources(state, backofficeResources);
  return {
    ...invalidated,
    core: null,
    modules: { state: "restricted" },
    epoch: state.epoch + 1,
    revalidationBootId: null,
  };
}

/** RSC arrival order does not establish freshness or authorize a new scope. */
export function observeBackofficeCoreSeed(
  state: BackofficeContextState,
  incoming: BackofficeInitialContext,
): BackofficeContextState {
  if (!state.core) return state;
  if (
    incoming.scopeKey !== state.core.scopeKey ||
    incoming.userId !== state.core.userId ||
    incoming.business.id !== state.core.business.id
  )
    return retireBackofficeContext(state);
  if (state.observedBootIds.includes(incoming.bootId)) return state;
  return {
    ...invalidateBackofficeResources(state, backofficeResources),
    observedBootIds: [...state.observedBootIds, incoming.bootId],
    revalidationBootId: incoming.bootId,
  };
}
