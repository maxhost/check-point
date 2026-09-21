"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStaff, type StaffSession } from "./staff-api";
import type { StaffMember } from "./staff-contract";

export function useStaffData() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await loadStaff();
      setSession(payload.session);
      setMembers(payload.members);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos cargar el equipo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { error, loading, members, session, setError, setMembers };
}
