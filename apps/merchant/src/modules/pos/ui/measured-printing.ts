"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { PosOrderV2 } from "../contracts";
import type { PosClient } from "./pos-context";
import { DiscardedPosIntent } from "./pos-context";
import { PosError } from "./pos-types";
import type { TicketSettings } from "./ticket-settings-types";
import {
  buildMeasuredTicket,
  choosePrinter,
  forgetDevicePrinter,
  printerSupport,
  printTicket,
  type PrintResult,
  type TicketDoc,
} from "./printing/index";

type Failure = Extract<PrintResult, { ok: false }>;
type State = {
  busy: boolean;
  issue: Failure | null;
  notice: string | null;
  browserDoc: TicketDoc | null;
};
const empty = (): State => ({
  busy: false,
  issue: null,
  notice: null,
  browserDoc: null,
});

/** Prepared integration API: context must be the parent's real session identity.
 * prepare becomes true only after the parent has made its list/detail usable.
 * There are no sale commands, auto-print effects, or configuration reads in gestures. */
export function useMeasuredPrinting({
  order,
  client,
  context,
  prepare,
  onError,
}: {
  order: PosOrderV2 | null;
  client: PosClient;
  context: string | null;
  prepare: boolean;
  onError: (error: unknown) => void;
}) {
  const configKey = useMemo(() => ({}), [client, context, prepare]);
  const identity = useMemo(
    () => ({}),
    [configKey, order?.id, order?.version, order?.status],
  );
  const configCurrent = useRef(configKey);
  configCurrent.current = configKey;
  const current = useRef(identity);
  current.current = identity;
  const active = useRef(false);
  const lock = useRef<object | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [configuration, setConfiguration] = useState<{
    key: object;
    settings: TicketSettings | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stored, setStored] = useState<{ key: object; state: State }>({
    key: identity,
    state: empty(),
  });
  const state = stored.key === identity ? stored.state : empty();
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      lock.current = null;
    };
  }, [identity]);
  const live = () =>
    active.current && current.current === identity && !!context && prepare;
  useEffect(() => {
    let mounted = true;
    setConfiguration(null);
    if (!prepare || !context) return;
    const request = client.capture();
    void request<TicketSettings>("/api/modules/pos/ticket")
      .then((settings) => {
        if (
          typeof settings?.printingEnabled !== "boolean" ||
          typeof settings?.showBusinessName !== "boolean" ||
          typeof settings?.showTable !== "boolean"
        )
          throw new Error("No pudimos leer la configuración del ticket.");
        if (mounted && configCurrent.current === configKey)
          setConfiguration({ key: configKey, settings, error: null });
      })
      .catch((error: unknown) => {
        if (
          !mounted ||
          configCurrent.current !== configKey ||
          error instanceof DiscardedPosIntent
        )
          return;
        setConfiguration({
          key: configKey,
          settings: null,
          error:
            error instanceof Error
              ? error.message
              : "No pudimos cargar la configuración del ticket.",
        });
        if (
          error instanceof PosError &&
          ([401, 403].includes(error.status ?? 0) ||
            error.code === "backoffice_context_changed")
        )
          onErrorRef.current(error);
      });
    return () => {
      mounted = false;
    };
  }, [client, context, configKey, prepare, attempt]);
  const settings =
    configuration?.key === configKey ? configuration.settings : null;
  const built = useMemo(() => {
    if (!settings?.printingEnabled || !order || !context || !prepare)
      return { doc: null, error: null };
    try {
      return { doc: buildMeasuredTicket(order, settings), error: null };
    } catch {
      return {
        doc: null,
        error: "No pudimos preparar el ticket. Revisa la orden.",
      };
    }
  }, [settings, order, context, prepare]);
  const update = (next: State) => {
    if (live()) setStored({ key: identity, state: next });
  };
  const begin = () => {
    if (!live() || !built.doc || lock.current === identity) return false;
    lock.current = identity;
    update({ ...empty(), busy: true });
    return true;
  };
  const finish = (result: PrintResult, doc: TicketDoc) => {
    if (!live()) return;
    lock.current = null;
    if (result.ok) update({ ...empty(), notice: "Ticket impreso" });
    else if (result.reason === "unsupported") {
      flushSync(() => update({ ...empty(), browserDoc: doc }));
      if (live()) window.print();
    } else update({ ...empty(), issue: result });
  };
  async function print() {
    if (!begin() || !built.doc) return;
    // This transport invocation occurs in the gesture, before any await.
    const result = await printTicket(built.doc);
    finish(result, built.doc);
  }
  async function choose() {
    if (!begin() || !built.doc) return;
    if (state.issue?.reason === "not_found") forgetDevicePrinter();
    const result = await choosePrinter(printerSupport().ble ? "ble" : "serial");
    if (!live()) return;
    if (result.ok) {
      lock.current = null;
      update({
        ...empty(),
        notice: "Impresora lista. Vuelve a imprimir el ticket.",
      });
    } else finish(result, built.doc);
  }
  return {
    ...state,
    ready: !!settings,
    enabled: settings?.printingEnabled === true,
    doc: built.doc,
    settingsError:
      (configuration?.key === configKey ? configuration.error : null) ??
      built.error,
    retrySettings: () => {
      if (live()) setAttempt((value) => value + 1);
    },
    print,
    retry: print,
    choose,
    dismiss: () => {
      if (lock.current !== identity) update({ ...state, issue: null });
    },
    dismissNotice: () => update({ ...state, notice: null }),
  };
}
export type MeasuredPrinting = ReturnType<typeof useMeasuredPrinting>;
