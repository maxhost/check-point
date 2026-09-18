import type {
  BusinessSummary,
  OnboardingState,
  ProgramSummary,
} from "./contracts";

const storageKey = "checkpass:onboarding-state-contract-0074";

function emptyState(): OnboardingState {
  return { authenticated: false };
}

export function readDevelopmentState(): OnboardingState {
  if (typeof window === "undefined") return emptyState();
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as OnboardingState) : emptyState();
  } catch {
    return emptyState();
  }
}

export function writeDevelopmentState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey, JSON.stringify(state));
}

export function markDevelopmentAuthenticated() {
  const current = readDevelopmentState();
  if (!current.authenticated) {
    writeDevelopmentState({
      authenticated: true,
      business: null,
      program: null,
      stampImage: false,
    });
  }
}

export function markDevelopmentBusiness(business: BusinessSummary) {
  const current = readDevelopmentState();
  writeDevelopmentState({
    authenticated: true,
    business,
    program: current.authenticated ? current.program : null,
    stampImage: current.authenticated ? current.stampImage : false,
  });
}

export function markDevelopmentProgram(program: ProgramSummary) {
  const current = readDevelopmentState();
  writeDevelopmentState({
    authenticated: true,
    business: current.authenticated ? current.business : null,
    program,
    stampImage: current.authenticated ? current.stampImage : false,
  });
}
