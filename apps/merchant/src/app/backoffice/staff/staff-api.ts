import { errorCopy, type ApiFailure, type StaffMember } from "./staff-contract";

export type StaffSession = {
  authenticated: boolean;
  user?: { id: string };
  membership?: { role: string; permissions: string[] } | null;
};
const JSON_HEADERS = { "content-type": "application/json" };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = (await response.json().catch(() => null)) as
    | (T & ApiFailure)
    | null;
  if (!response.ok)
    throw new Error(errorCopy(payload, "No pudimos completar la acción."));
  if (!payload)
    throw new Error(
      "La respuesta del servidor no es válida. Intentá otra vez.",
    );
  return payload;
}

export async function loadStaff() {
  const [session, staff] = await Promise.all([
    request<StaffSession>("/api/merchant/session"),
    request<{ staff: StaffMember[] }>("/api/staff"),
  ]);
  return { session, members: staff.staff };
}
export const createStaff = (name: string, permissions: string[]) =>
  request<{ staff: StaffMember; pin: string }>("/api/staff", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name, permissions }),
  });
export const renameStaff = (member: StaffMember, name: string) =>
  request<{ staff: StaffMember }>(`/api/staff/${member.userId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
export const savePermissions = (member: StaffMember, permissions: string[]) =>
  request<{ staff: StaffMember }>(`/api/staff/${member.userId}/permissions`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ permissions }),
  });
export const saveStatus = (
  member: StaffMember,
  status: "active" | "disabled",
) =>
  request<{ staff: StaffMember }>(`/api/staff/${member.userId}/status`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
export const regeneratePin = (member: StaffMember) =>
  request<{ staff: StaffMember; pin: string }>(
    `/api/staff/${member.userId}/pin/regenerate`,
    { method: "POST" },
  );
