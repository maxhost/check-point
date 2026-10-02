import type { NextRequest } from "next/server";
import { handleOAuthCallback } from "../../../../../../server/oauth-callback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const field = (form: FormData | null, name: string) => {
  const value = form?.get(name);
  return typeof value === "string" ? value : null;
};

/**
 * Spec 0119: Apple vuelve por POST cross-site (`response_mode=form_post`) con `code`, `state`
 * y, solo la primera vez, `user` (el nombre). La cookie transitoria es `SameSite=None` por esto.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  return handleOAuthCallback(request, "apple", {
    code: field(form, "code"),
    state: field(form, "state"),
    error: field(form, "error"),
    user: field(form, "user"),
  });
}
