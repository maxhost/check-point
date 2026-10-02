import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ENROLL = join(
  import.meta.dirname,
  "../app/(consumer)/enroll/[programId]",
);

function source(path: string) {
  return readFileSync(join(ENROLL, path), "utf8");
}

describe("post-enrollment installation", () => {
  it("navigates after enrollment so the browser receives a fresh HTML document", () => {
    // Spec 0119: the one-tap alta navigates on its 201; the provider callback answers a 303
    // to the same `/ready` (a full document either way).
    const oneTap = source("enroll-buttons.tsx");
    expect(oneTap).toContain("if (res.status === 201)");
    expect(oneTap).toContain("window.location.assign(");
    expect(oneTap).toContain("/ready");
    const callback = readFileSync(
      join(import.meta.dirname, "oauth-callback.ts"),
      "utf8",
    );
    expect(callback).toContain("/ready`");
  });

  it("serves the consumer manifest in the confirmation document metadata", () => {
    const ready = source("ready/page.tsx");
    expect(ready).toContain("generateMetadata");
    expect(ready).toContain("walletManifestPathFor(account.webViewToken)");
    expect(ready).toContain("<EnrollConfirmation");
    expect(source("enroll-confirmation.tsx")).toContain("beforeinstallprompt");
  });
});
