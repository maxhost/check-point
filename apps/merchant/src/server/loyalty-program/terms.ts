import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { termsTemplates } from "../schema";
import { LoyaltyError, type ProgramInput } from "./core";
import { renderTermsText } from "./validation";

type OwnerBusiness = {
  name: string;
  countryCode: string;
} | null;

export async function renderedTerms(
  input: ProgramInput,
  business: OwnerBusiness,
) {
  if (!business)
    throw new LoyaltyError(403, "No tienes un negocio como owner.");
  const ids = input.clauses.flatMap((clause) =>
    clause.templateId ? [clause.templateId] : [],
  );
  const templates = ids.length
    ? await getDb()
        .select()
        .from(termsTemplates)
        .where(
          and(
            eq(termsTemplates.status, "published"),
            inArray(termsTemplates.id, ids),
          ),
        )
    : [];
  const variables = {
    business_legal_name: business.name,
    program_name:
      input.kind === "points"
        ? String(input.configuration.unitPlural)
        : String(input.configuration.unitName),
    program_kind: input.kind,
    country_code: business.countryCode,
  };
  const markdown = input.clauses
    .map((clause) => {
      const template = clause.templateId
        ? templates.find((item) => item.id === clause.templateId)
        : null;
      if (clause.templateId && !template) {
        throw new LoyaltyError(
          422,
          "La plantilla seleccionada no está disponible.",
        );
      }
      const text = clause.text ?? template?.templateMarkdown;
      if (!text) throw new LoyaltyError(422, "Cada cláusula debe tener texto.");
      return renderTermsText(
        text,
        variables,
        Array.isArray(template?.variablesAllowlist)
          ? template.variablesAllowlist.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      );
    })
    .join("\n\n");
  return {
    markdown,
    hash: createHash("sha256").update(markdown).digest("hex"),
  };
}
