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
    const form = source("enroll-form.tsx");
    expect(form).toContain("if (res.status === 201)");
    expect(form).toContain("window.location.assign(");
    expect(form).toContain("/ready");
  });

  it("serves the consumer manifest in the confirmation document metadata", () => {
    const ready = source("ready/page.tsx");
    expect(ready).toContain("generateMetadata");
    expect(ready).toContain("walletManifestPathFor(account.webViewToken)");
    expect(ready).toContain("<EnrollConfirmation");
    expect(source("enroll-confirmation.tsx")).toContain("beforeinstallprompt");
  });
});
