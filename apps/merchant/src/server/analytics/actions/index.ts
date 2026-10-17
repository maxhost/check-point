import { MODULES } from "../../../modules/registry";
import { enabledModuleIds } from "../../../modules/activation";
export type AnalyticsViewer = { role: string; permissions: readonly string[] };
type ActionManifest = (typeof MODULES)[number] & {
  analyticsActions?: readonly {
    key: string;
    label: string;
    href: string;
    permission?: string;
  }[];
};
export function resolveAction(
  key: string | null,
  href: string | undefined,
  viewer: AnalyticsViewer,
  enabled: ReadonlySet<string>,
  manifests: readonly ActionManifest[] = MODULES,
) {
  if (!key) return null;
  const permitted = (permission: string) =>
    viewer.role === "owner" || viewer.permissions.includes(permission);
  if (key === "view_day" || key === "view_calculation")
    return {
      label: key === "view_day" ? "Ver el día" : "Ver el cálculo",
      href: href ?? "/backoffice/analytics",
    };
  if (key === "edit_product_price")
    return permitted("catalog")
      ? { label: "Revisar precio", href: "/backoffice/catalog" }
      : null;
  const declarations = manifests.flatMap((m) =>
    (m.analyticsActions ?? [])
      .filter((a) => a.key === key)
      .map((a) => ({ ...a, module: m })),
  );
  const active = declarations.find((a) => enabled.has(a.module.id));
  if (active) {
    const navigation = active.module.navigation
      .filter((n) =>
        active.href.startsWith(
          `/backoffice/${active.module.id}${n.path ? `/${n.path}` : ""}`,
        ),
      )
      .sort((a, b) => b.path.length - a.path.length)[0];
    const permission =
      active.permission ??
      navigation?.permission ??
      active.module.permissions[0]?.id;
    return permission && permitted(permission)
      ? { label: active.label, href: active.href }
      : null;
  }
  return viewer.role === "owner"
    ? { label: "Ver módulos", href: "/backoffice/settings" }
    : null;
}
export async function actionContext(
  businessId: string,
  viewer: AnalyticsViewer,
) {
  const enabled = await enabledModuleIds(businessId);
  return (key: string | null, href?: string) =>
    resolveAction(key, href, viewer, enabled);
}
