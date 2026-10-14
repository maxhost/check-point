import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { ModuleConfiguration } from "./module-configuration";
import { UI_SCREENS } from "../../../modules/ui-registry";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const session = await requireBackofficeSession();
  if (session.membership.role !== "owner") redirect("/backoffice");
  return (
    <ModuleConfiguration
      panels={Object.entries(UI_SCREENS).flatMap(([moduleId, entry]) => {
        const Panel = entry.settingsPanel;
        return Panel ? [{ moduleId, content: <Panel /> }] : [];
      })}
    />
  );
}
