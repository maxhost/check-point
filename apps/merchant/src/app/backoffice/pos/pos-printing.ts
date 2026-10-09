"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  buildTicket,
  choosePrinter,
  forgetDevicePrinter,
  printerSupport,
  printTicket,
  type PrintResult,
  type TicketDoc,
  type TicketSettings,
} from "../../../printing/index";
import { PosError, posRequest, type PosOrder } from "./pos-types";

type Failure = Extract<PrintResult, { ok: false }>;
type PrintState = {
  identity: string;
  busy: boolean;
  issue: Failure | null;
  browserDoc: TicketDoc | null;
  notice: string | null;
};
const initial = (identity: string): PrintState => ({
  identity,
  busy: false,
  issue: null,
  browserDoc: null,
  notice: null,
});

export function usePosPrinting({
  order,
  context,
  onError,
}: {
  order: PosOrder | null;
  context: string | null;
  onError: (error: unknown) => void;
}) {
  const [configuration, setConfiguration] = useState<{
    context: string | null;
    settings: TicketSettings | null;
    error: string | null;
  }>({ context: null, settings: null, error: null });
  const [settingsAttempt, setSettingsAttempt] = useState(0);
  const contextRef = useRef(context);
  contextRef.current = context;
  useEffect(() => {
    let active = true;
    setConfiguration({ context, settings: null, error: null });
    if (!context) return;
    void posRequest<TicketSettings>("/api/pos/ticket")
      .then((settings) => {
        if (
          typeof settings.showBusinessName !== "boolean" ||
          typeof settings.showTable !== "boolean"
        )
          throw new Error("No pudimos leer la configuración del ticket.");
        if (active && contextRef.current === context)
          setConfiguration({ context, settings, error: null });
      })
      .catch((error: unknown) => {
        if (!active || contextRef.current !== context) return;
        setConfiguration({
          context,
          settings: null,
          error:
            error instanceof Error
              ? error.message
              : "No pudimos cargar la configuración del ticket.",
        });
        if (error instanceof PosError && [401, 403].includes(error.status ?? 0))
          onError(error);
      });
    return () => {
      active = false;
    };
  }, [context, onError, settingsAttempt]);

  const identity = `${context ?? ""}:${order?.id ?? ""}:${order?.version ?? ""}:${order?.status ?? ""}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const generation = useRef(0);
  const locked = useRef(false);
  const pending = useRef<TicketDoc | null>(null);
  const [stored, setStored] = useState<PrintState>(() => initial(identity));
  const state = stored.identity === identity ? stored : initial(identity);
  useEffect(() => {
    generation.current += 1;
    locked.current = false;
    pending.current = null;
    setStored(initial(identity));
    return () => {
      generation.current += 1;
    };
  }, [identity]);
  const settings =
    context && configuration.context === context
      ? configuration.settings
      : null;
  const settingsError =
    context && configuration.context === context ? configuration.error : null;

  const live = (value: { identity: string; generation: number }) =>
    value.identity === identityRef.current &&
    value.generation === generation.current;
  const begin = () => {
    locked.current = true;
    setStored((current) => ({
      ...current,
      identity,
      busy: true,
      notice: null,
    }));
    return { identity, generation: ++generation.current };
  };
  const finish = (
    result: PrintResult,
    doc: TicketDoc,
    value: ReturnType<typeof begin>,
  ) => {
    if (!live(value)) return;
    locked.current = false;
    if (result.ok) {
      setStored({ ...initial(identity), notice: "Ticket impreso" });
    } else if (result.reason === "unsupported") {
      // The browser must see the complete TicketDoc before opening its dialog.
      flushSync(() => setStored({ ...initial(identity), browserDoc: doc }));
      window.print();
    } else setStored({ ...state, identity, busy: false, issue: result });
  };

  async function print() {
    if (
      !context ||
      !settings ||
      !order ||
      order.status !== "open" ||
      locked.current
    )
      return;
    const doc = buildTicket(order, settings);
    pending.current = doc;
    const value = begin();
    // No fetch or await before this call: retain Chrome's user gesture.
    const result = await printTicket(doc);
    finish(result, doc, value);
  }
  async function retry() {
    if (!pending.current || locked.current || !context) return;
    const doc = pending.current;
    const value = begin();
    const result = await printTicket(doc);
    finish(result, doc, value);
  }
  async function choose() {
    if (!pending.current || locked.current || !context) return;
    const doc = pending.current;
    const value = begin();
    if (state.issue?.reason === "not_found") forgetDevicePrinter();
    // Called by the explicit choose button, before any asynchronous work.
    const chosen = await choosePrinter(printerSupport().ble ? "ble" : "serial");
    if (!live(value)) return;
    if (!chosen.ok) {
      finish(chosen, doc, value);
      return;
    }
    const result = await printTicket(doc);
    finish(result, doc, value);
  }
  return {
    ...state,
    ready: !!settings,
    settingsError,
    retrySettings: () => setSettingsAttempt((current) => current + 1),
    print,
    retry,
    choose,
    dismiss: () => {
      if (!locked.current)
        setStored((current) => ({ ...current, issue: null }));
    },
    dismissNotice: () => setStored((current) => ({ ...current, notice: null })),
  };
}
export type PosPrinting = ReturnType<typeof usePosPrinting>;
