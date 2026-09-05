import { type NextRequest } from "next/server";
import { resolveWebViewToken } from "../../../../server/wallet/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Per-consumer PWA manifest (spec 0037/0050, ADR 0039 §5 as amended by ADR 0048).
 *
 * The `start_url` encapsulates the consumer's `web_view_token` via the magic-link
 * `/c/[token]` so the installed home-screen icon RE-BOOTSTRAPS its session on launch
 * (iOS standalone PWAs get a separate cookie jar).
 *
 * The token arrives in the manifest's OWN URL (`?c=<token>`), server-rendered by the page
 * that does have the session — NOT from the session cookie. A `<link rel="manifest">` is
 * fetched WITHOUT credentials unless it carries `crossorigin="use-credentials"`, which
 * Next cannot emit from `metadata.manifest`: reading the cookie here silently resolved to
 * no session and pinned `start_url` at `/wallet` forever (ADR 0048). The token is already
 * at-bearer and already travels in URLs (ADR 0014), so this adds no threat class.
 *
 * Absent, unknown or rotated-away token (recovery, spec 0032) → `/wallet`, the safe
 * anonymous fallback. `id` stays `/wallet` so the PWA identity never fragments per
 * consumer nor changes when the token rotates (ADR 0048 §3).
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("c");
  const account = await resolveWebViewToken(requested ?? undefined);
  // Echo the stored token, never the raw query, so nothing user-supplied reaches start_url.
  const startUrl = account ? `/c/${account.webViewToken}` : "/wallet";

  const manifest = {
    name: "CheckPass Club",
    short_name: "CheckPass",
    description:
      "Tu pase, tus programas y tu código QR en la pantalla de inicio.",
    id: "/wallet",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#0f2a3a",
    theme_color: "#0f2a3a",
    icons: [
      {
        src: "/wallet-logo.png",
        sizes: "660x660",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
