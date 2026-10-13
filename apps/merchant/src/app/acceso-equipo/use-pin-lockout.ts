"use client";
import { useEffect, useState } from "react";
import type { StaffAccessError } from "./staff-access-api";

export function usePinLockout() {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  function apply(error: StaffAccessError) {
    if (error.reason !== "pin_locked" || error.retryAfterSeconds === undefined)
      return;
    const current = Date.now();
    setNow(current);
    setDeadline(
      current + Math.max(0, Math.ceil(error.retryAfterSeconds)) * 1000,
    );
  }
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return { seconds, apply };
}
