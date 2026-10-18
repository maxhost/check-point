"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useOptionalBackofficeContext } from "../../../app/backoffice/backoffice-context";
import { posRequest, PosError, type PosSession } from "./pos-types";

export class DiscardedPosIntent extends Error {}
export type PosRequest = typeof posRequest;
export type PosClient = { capture: () => PosRequest; request: PosRequest };

/** Captured transport remains tied to its original intention across awaits/retries. */
export function createPosClient(
  read: () => {
    identity: string | null;
    scopeKey?: string;
    retire?: () => void;
  },
): PosClient {
  const capture = (): PosRequest => {
    const intent = read();
    return async <T,>(url: string, method = "GET", body?: unknown) => {
      if (!intent.identity || read().identity !== intent.identity)
        throw new DiscardedPosIntent();
      try {
        const result = await posRequest<T>(url, method, body, {
          scopeKey: intent.scopeKey,
        });
        if (read().identity !== intent.identity) throw new DiscardedPosIntent();
        return result;
      } catch (error) {
        if (read().identity !== intent.identity) throw new DiscardedPosIntent();
        if (
          error instanceof PosError &&
          (error.status === 401 || error.code === "backoffice_context_changed")
        )
          intent.retire?.();
        throw error;
      }
    };
  };
  return {
    capture,
    request: (url, method, body) => capture()(url, method, body),
  };
}

export function usePosContext() {
  const provider = useOptionalBackofficeContext();
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const current = useRef(provider);
  current.current = provider;
  const client = useMemo(
    () =>
      createPosClient(() => {
        if (!active.current) return { identity: null };
        const value = current.current;
        if (!value) return { identity: "legacy" };
        const ticket = value.captureTicket("session");
        return {
          identity: ticket ? `${ticket.epoch}:${ticket.scopeKey}` : null,
          scopeKey: ticket?.scopeKey,
          retire: value.retire,
        };
      }),
    [],
  );
  const core = provider?.state.core;
  const modules = provider?.state.modules;
  const enabled =
    modules?.state === "ready"
      ? modules.modules
          .filter((module) => module.enabled)
          .map((module) => module.id)
      : [];
  const session: PosSession | null = core
    ? {
        authenticated: true,
        user: { id: core.userId },
        business: { ...core.business, enabledModules: enabled },
        membership: core.membership,
      }
    : null;
  const identity = provider
    ? core
      ? `${provider.state.epoch}:${core.scopeKey}`
      : null
    : "legacy";
  // Primitive projection avoids restarting consumers for unrelated provider updates.
  const encoded = JSON.stringify(session);
  const stableSession = useMemo(
    () => JSON.parse(encoded) as PosSession | null,
    [encoded],
  );
  return {
    client,
    present: provider !== null,
    identity,
    loading: modules?.state === "loading",
    session: stableSession,
  };
}
