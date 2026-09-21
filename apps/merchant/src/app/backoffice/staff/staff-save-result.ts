export type SaveResult = { kind: "success" | "error" | "idle"; text: string };
export const IDLE_RESULT: SaveResult = { kind: "idle", text: "Sin cambios." };

export function saveResultToast(name: SaveResult, permissions: SaveResult) {
  const parts = [
    name.kind !== "idle" ? `Nombre: ${name.text}` : null,
    permissions.kind !== "idle" ? `Permisos: ${permissions.text}` : null,
  ].filter(Boolean);
  return {
    message: parts.length ? parts.join(" · ") : null,
    kind:
      name.kind === "error" || permissions.kind === "error"
        ? ("error" as const)
        : ("success" as const),
  };
}
