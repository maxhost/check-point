import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";
import { type Campaign, getCampaign } from "./campaign-store";
import {
  TEMPLATES,
  type TemplateDefinition,
} from "@mi-pasaporte/domain/server/marketing/templates";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";

/**
 * The cards of the prebuilt campaigns (spec 0101), apart from `template-store.ts` (which
 * re-exports them) only for the size budget. Spec 0138 / ADR 0115: only the templates that are ON
 * (`enabled-campaigns.ts`), in catalog order — an OFF one does not exist for the merchant.
 */

/** The states that hold `core_campaign_template_live_unique`: one run of these per
 * business and template. */
export const LIVE_STATUSES = ["draft", "active", "paused"] as const;
const RUNS_SHOWN = 10;

export type TemplateRun = {
  id: string;
  status: "ended" | "archived";
  activatedAt: Date | null;
  endedAt: Date | null;
};

export type TemplateView = TemplateDefinition & {
  live: Campaign | null;
  runs: TemplateRun[];
};

/** `GET /api/marketing/templates` — the cards, in catalog order. */
export async function listTemplates(
  businessId: string,
): Promise<TemplateView[]> {
  const rows = await getDb()
    .select({
      id: campaigns.id,
      templateKey: campaigns.templateKey,
      status: campaigns.status,
      activatedAt: campaigns.activatedAt,
      endedAt: campaigns.endedAt,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.businessId, businessId),
        isNotNull(campaigns.templateKey),
      ),
    )
    .orderBy(
      sql`${campaigns.activatedAt} desc nulls last`,
      desc(campaigns.createdAt),
    );
  const enabled = TEMPLATES.filter((template) =>
    campaignKindEnabled(template.key),
  );
  return await Promise.all(
    enabled.map(async (template) => {
      const mine = rows.filter((row) => row.templateKey === template.key);
      const live = mine.find((row) =>
        (LIVE_STATUSES as readonly string[]).includes(row.status),
      );
      return {
        ...template,
        live: live ? await getCampaign(businessId, live.id) : null,
        runs: mine
          .filter((row) => row.status === "ended" || row.status === "archived")
          .slice(0, RUNS_SHOWN)
          .map((row) => ({
            id: row.id,
            status: row.status as TemplateRun["status"],
            activatedAt: row.activatedAt,
            endedAt: row.endedAt,
          })),
      };
    }),
  );
}
