import type { CSSProperties } from "react";

// Presentational styles for the recovery form, split out to keep recover-form.tsx
// within the file-size budget.
export const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  fontSize: 16,
  marginTop: 5,
};

export const button: CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: 10,
  padding: "13px 14px",
  background: "#111827",
  color: "white",
  fontSize: 16,
  marginTop: 18,
};
