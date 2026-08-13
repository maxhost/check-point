import type { Page } from "@playwright/test";
import { type DemoState, key } from "../../../apps/merchant/src/app/demo";

export type { DemoState };

/**
 * Seeds the merchant demo `sessionStorage` fixture.
 *
 * `addInitScript` runs on EVERY navigation — including `page.reload()`. Seeding
 * unconditionally would re-clobber, on each reload, whatever state the app has
 * persisted under the same key, masking real persistence bugs. So we seed only
 * when the key is absent: the fixture bootstraps the first load and the app
 * owns the key from then on. The single storage `key` is imported from the app
 * so the two never drift.
 */
export async function seedDemo(page: Page, state: Partial<DemoState>) {
  await page.addInitScript(
    ({ storageKey, seed }) => {
      if (!sessionStorage.getItem(storageKey)) {
        sessionStorage.setItem(storageKey, JSON.stringify(seed));
      }
    },
    { storageKey: key, seed: state },
  );
}
