import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../../server/consumer/core";
import { resolveSession } from "../../../../server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Per-consumer PWA manifest (spec 0037, ADR 0039 §5). The `start_url` encapsulates the
 * consumer's `web_view_token` via the magic-link `/c/[token]` so the installed home-screen
 * icon RE-BOOTSTRAPS its session on launch (iOS standalone PWAs get a separate cookie
 * jar). This is why the manifest is dynamic, not a static `public/` file: rotating the
 * token on account recovery (0032) then leaves the old icon pointing at a dead link (404),
 * exactly as the rotation purge intends. Without a session we fall back to `/wallet`.
 */
export async function GET() {
  const store = await cookies();
  const account = await resolveSession(store.get(SESSION_COOKIE)?.value);
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
