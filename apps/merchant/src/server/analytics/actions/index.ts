import { MODULES } from "../../../modules/registry";
import { enabledModuleIds } from "../../../modules/activation";
import {
  ANALYTICS_POLICY,
  policyText,
  type AnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
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
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  if (!key) return null;
  const permitted = (permission: string) =>
    viewer.role === "owner" || viewer.permissions.includes(permission);
  if (key === "view_day" || key === "view_calculation")
    return {
      label: policyText(policy, `action_${key}`),
      href: href ?? "/backoffice/analytics",
    };
  if (key === "view_customer" || key === "view_campaign_results") {
    const customer = key === "view_customer";
    const prefix = customer
      ? "/backoffice/customers/analytics/"
      : "/backoffice/marketing/";
    if (
      !permitted(customer ? "counter" : "marketing") ||
      !href ||
      !href.startsWith(prefix) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        href.slice(prefix.length),
      )
    )
      return null;
    return { label: policyText(policy, `action_${key}`), href };
  }
  if (key === "edit_product_price")
    return permitted("catalog")
      ? {
          label: policyText(policy, `action_${key}`),
          href: "/backoffice/catalog",
        }
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
    let destination = active.href;
    if (href) {
      try {
        const base = new URL(active.href, "https://internal.invalid");
        const requested = new URL(href, "https://internal.invalid");
        if (
          requested.origin === base.origin &&
          !requested.hash &&
          (requested.pathname === base.pathname ||
            requested.pathname.startsWith(`${base.pathname}/`))
        )
          destination = requested.pathname + requested.search;
      } catch {
        /* Invalid captured links fall back to the declared action. */
      }
    }
    return permission && permitted(permission)
      ? {
          label:
            policy.texts[`action_${key}`] === undefined
              ? active.label
              : policyText(policy, `action_${key}`),
          href: destination,
        }
      : null;
  }
  return viewer.role === "owner"
    ? {
        label: policyText(policy, "action_view_modules"),
        href: "/backoffice/settings",
      }
    : null;
}
export async function actionContext(
  businessId: string,
  viewer: AnalyticsViewer,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const enabled = await enabledModuleIds(businessId);
  return (key: string | null, href?: string) =>
    resolveAction(key, href, viewer, enabled, MODULES, policy);
}
