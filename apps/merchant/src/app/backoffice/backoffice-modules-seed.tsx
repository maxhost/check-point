import { readBackofficeInitialModules } from "../../server/backoffice-initial-context";
import { BackofficeModulesSeedConsumer } from "./backoffice-context";

/** Only this leaf waits for modules; its Suspense boundary leaves core usable. */
export async function BackofficeModulesSeed({
  bootId,
  scopeKey,
}: {
  bootId: string;
  scopeKey: string;
}) {
  const seed = await readBackofficeInitialModules(bootId, scopeKey);
  return <BackofficeModulesSeedConsumer seed={seed} />;
}
