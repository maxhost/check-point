"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fromDate, parseDateTime, toZoned } from "@internationalized/date";
import type {
  AnalyticsInboxMutation,
  AnalyticsInboxResponse,
  InboxCard,
  InboxDecision,
} from "@mi-pasaporte/domain/analytics/types";
import { PanelRequestError, panelRequest } from "../panel-request";

const validCards = (cards: InboxCard[]) =>
  cards.filter((card) => Date.parse(card.expiresAt) >= Date.now());
/** Browser timers cap delays at 2^31−1 ms; intermediate wakes never request data. */
function atInstant(instant: number, callback: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(
      () => {
        if (Date.now() < instant) schedule();
        else callback();
      },
      Math.min(Math.max(0, instant - Date.now()), 2_147_483_647),
    );
  };
  schedule();
  return () => clearTimeout(timer);
}
export function useAnalyticsInbox() {
  const [inbox, setInbox] = useState<AnalyticsInboxResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [snoozing, setSnoozing] = useState<InboxCard | null>(null);
  const [reminder, setReminder] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [reminderTimezone, setReminderTimezone] = useState("UTC");
  const busy = useRef(false);
  const loading = useRef<number | null>(null);
  const refreshQueued = useRef(false);
  const revision = useRef(0);
  const firedReminder = useRef<string | null>(null);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const refresh = useCallback(() => {
    if (busy.current || loading.current !== null) refreshQueued.current = true;
    else setReload((n) => n + 1);
  }, []);
  useEffect(() => {
    let active = true;
    const token = ++revision.current;
    loading.current = token;
    void panelRequest<AnalyticsInboxResponse>("/api/analytics/inbox")
      .then((data) => {
        if (active && token === revision.current) {
          if (data.contractVersion !== 2) throw new Error("inbox-contract");
          setInbox({ ...data, cards: validCards(data.cards) });
          setError((current) =>
            current.startsWith("No pudimos leer") ? "" : current,
          );
        }
      })
      .catch(() => {
        if (active && token === revision.current)
          setError("No pudimos leer tus avisos. Intenta otra vez.");
      })
      .finally(() => {
        if (loading.current !== token) return;
        loading.current = null;
        if (active && refreshQueued.current && !busy.current) {
          refreshQueued.current = false;
          setReload((n) => n + 1);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useEffect(() => {
    const instant = inbox?.nextReminderAt;
    if (!instant || firedReminder.current === instant) return;
    const due = Date.parse(instant);
    if (!Number.isFinite(due)) return;
    return atInstant(due, () => {
      firedReminder.current = instant;
      refresh();
    });
  }, [inbox?.nextReminderAt, refresh]);

  useEffect(() => {
    const deadlines =
      inbox?.cards.map((card) => Date.parse(card.expiresAt) + 1) ?? [];
    if (!deadlines.length) return;
    return atInstant(Math.min(...deadlines), () => {
      setInbox((current) =>
        current ? { ...current, cards: validCards(current.cards) } : null,
      );
      setSnoozing((current) =>
        current && Date.parse(current.expiresAt) < Date.now() ? null : current,
      );
      refresh();
    });
  }, [inbox?.cards, refresh]);
  useEffect(() => {
    if (
      inbox?.state !== "preparing" ||
      !inbox.refreshAfterMs ||
      inbox.refreshAfterMs <= 0
    )
      return;
    return atInstant(Date.now() + inbox.refreshAfterMs, refresh);
  }, [inbox, refresh]);

  async function act(
    card: InboxCard,
    decision: InboxDecision,
    remindAt?: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    ++revision.current;
    setPending(card.id);
    setError("");
    setReminderError("");
    const signature = JSON.stringify([
      card.id,
      card.version,
      decision,
      remindAt,
    ]);
    if (operation.current?.signature !== signature)
      operation.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await panelRequest<AnalyticsInboxMutation>(
        `/api/analytics/inbox/${card.id}/${decision}`,
        "POST",
        {
          expectedVersion: card.version,
          operationId: operation.current.id,
          ...(remindAt ? { remindAt } : {}),
        },
      );
      setInbox((current) =>
        current
          ? { ...current, ...result, cards: validCards(result.cards) }
          : null,
      );
      setSnoozing(null);
      operation.current = null;
    } catch (failure) {
      const message =
        failure instanceof PanelRequestError
          ? failure.message
          : "No pudimos guardar la acción. Intenta otra vez.";
      if (
        failure instanceof PanelRequestError &&
        [404, 409].includes(failure.status)
      ) {
        setSnoozing(null);
        operation.current = null;
        setReload((n) => n + 1);
      }
      if (
        decision === "snooze" &&
        failure instanceof PanelRequestError &&
        failure.status === 422
      )
        setReminderError(message);
      else setError(message);
    } finally {
      busy.current = false;
      setPending(null);
      if (refreshQueued.current) {
        refreshQueued.current = false;
        setReload((n) => n + 1);
      }
    }
  }
  function saveReminder() {
    if (!snoozing || !inbox) return;
    try {
      const local = parseDateTime(reminder);
      // Reject skipped wall-clock instants instead of silently moving the reminder.
      const instant = toZoned(local, reminderTimezone, "reject").toDate();
      if (
        instant.getTime() <= Date.now() ||
        instant.getTime() > Date.parse(snoozing.expiresAt)
      )
        throw new Error("outside-validity");
      void act(snoozing, "snooze", instant.toISOString());
    } catch {
      setReminderError(
        "Elige una fecha y hora futuras, dentro de la vigencia de este aviso.",
      );
    }
  }
  const localValue = (value: Date) =>
    fromDate(value, reminderTimezone).toString().slice(0, 16);
  function beginSnooze(card: InboxCard) {
    if (!inbox || busy.current) return;
    setSnoozing(card);
    setReminderTimezone(inbox.timezone);
    setReminder("");
    setReminderError("");
  }
  return {
    inbox,
    error,
    pending,
    refresh,
    act,
    snoozing,
    setSnoozing,
    reminder,
    setReminder,
    reminderError,
    setReminderError,
    reminderTimezone,
    localValue,
    saveReminder,
    beginSnooze,
  };
}
