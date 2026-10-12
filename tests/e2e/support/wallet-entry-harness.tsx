import { createRoot } from "react-dom/client";
import WalletPage from "../../../apps/consumer/src/app/(consumer)/wallet/page";
import EnrollPage from "../../../apps/consumer/src/app/(consumer)/enroll/[programId]/page";
import ReadyPage from "../../../apps/consumer/src/app/(consumer)/enroll/[programId]/ready/page";

async function mount() {
  const query = new URLSearchParams(location.search);
  const params = Promise.resolve({ programId: "demo-program" });
  const surface = query.get("surface");
  const node =
    location.pathname.endsWith("/ready") || surface === "ready"
      ? await ReadyPage({ params })
      : location.pathname === "/wallet" || surface === "access"
        ? await WalletPage({
            searchParams: Promise.resolve({
              error: query.get("error") ?? undefined,
            }),
          })
        : await EnrollPage({
            params,
            searchParams: Promise.resolve({
              loc: query.get("loc") ?? undefined,
              error: query.get("error") ?? undefined,
            }),
          });
  createRoot(document.getElementById("root")!).render(node);
}
void mount();
