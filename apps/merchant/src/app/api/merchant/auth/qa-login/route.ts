import { NextResponse } from "next/server";
import {
  publicQaAccounts,
  qaLoginEnabled,
  qaLoginPost,
  qaNotFound,
} from "../../../../../server/qa-login";

export const dynamic = "force-dynamic";

/**
 * Spec 0150 — TEMPORAL. Login de QA sin link magico para las 3 cuentas de prueba.
 *
 * - `GET`  → `200 { accounts: [{ account, label }] }` (la UI muestra los botones solo si da 200).
 * - `POST { account }` → `200 { redirectTo: "/backoffice" }` con `Set-Cookie`;
 *   `400 invalid_body`, `403 qa_account_unavailable`, `503 qa_login_unavailable`.
 *
 * Apagada (`QA_LOGIN_ENABLED !== "true"`) → `404 not_found` en los dos verbos. Se borra al
 * terminar las pruebas del owner.
 */
export function GET(): NextResponse {
  if (!qaLoginEnabled()) return qaNotFound();
  return NextResponse.json({ accounts: publicQaAccounts() }, { status: 200 });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!qaLoginEnabled()) return qaNotFound();
  return qaLoginPost(request);
}
