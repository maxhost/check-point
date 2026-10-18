"use client";
import { useCallback, useEffect, useState } from "react";
import { fromDate, parseDateTime, toZoned } from "@internationalized/date";
import type {
  InboxCard,
  InboxDecision,
} from "@mi-pasaporte/domain/analytics/types";
import { useBackofficeContext } from "../backoffice-context";

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
  const { state, acquireInbox, refreshInbox, decideInbox } =
    useBackofficeContext();
  const { data: inbox, error, pending } = state.inbox;
  const refresh = useCallback(() => refreshInbox(), [refreshInbox]);
  const [snoozing, setSnoozing] = useState<InboxCard | null>(null);
  const [reminder, setReminder] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [reminderTimezone, setReminderTimezone] = useState("UTC");
  useEffect(() => acquireInbox(), [acquireInbox]);
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useEffect(() => {
    const instant = inbox?.nextReminderAt;
    if (!instant) return;
    const due = Date.parse(instant);
    if (!Number.isFinite(due)) return;
    return atInstant(due, () => {
      refreshInbox(`reminder:${instant}`);
    });
  }, [inbox?.nextReminderAt, refreshInbox]);

  useEffect(() => {
    const deadlines =
      inbox?.cards.map((card) => Date.parse(card.expiresAt) + 1) ?? [];
    if (!deadlines.length) return;
    return atInstant(Math.min(...deadlines), () => {
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
    return atInstant(Date.now() + inbox.refreshAfterMs, () => refresh());
  }, [inbox, refresh]);

  async function act(
    card: InboxCard,
    decision: InboxDecision,
    remindAt?: string,
  ) {
    if (pending) return;
    setReminderError("");
    const result = await decideInbox({ card, decision, remindAt });
    if (result.saved || result.conflict) setSnoozing(null);
    if (result.reminderError) setReminderError(result.reminderError);
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
    if (!inbox || pending) return;
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
