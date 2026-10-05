import { test } from "@playwright/test";
import { registerKitTests } from "./support/ui-kit-checks";

// Spec 0159: el kit en WebKit (Safari). La CI no instala WebKit: el archivo entero se saltea ahi.
test.use({ browserName: "webkit" });
test.skip(Boolean(process.env.CI), "la CI no instala WebKit");
registerKitTests();
