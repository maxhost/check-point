import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramTransitions,
  loyaltyProgramVersions,
  loyaltyPrograms,
  loyaltyTermsClauses,
  loyaltyTermsVersions,
  memberships,
  termsTemplates,
} from "./schema";

export type LoyaltyKind = "points" | "stamps" | "tiers" | "cashback";
type SupportedKind = "points" | "stamps";
type ClauseInput = { templateId?: string; text?: string };
export type PublishInput = {
  kind: LoyaltyKind;
  configuration: unknown;
  clauses: ClauseInput[];
  earningEndsAt?: string;
  redemptionEndsAt?: string;
};

const enabledKinds = new Set<SupportedKind>(["points", "stamps"]);
const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function validateConfiguration(kind: LoyaltyKind, value: unknown) {
  if (!enabledKinds.has(kind as SupportedKind)) {
    return "Esta modalidad todavía no está disponible.";
  }
  if (!value || typeof value !== "object")
    return "La configuración no es válida.";
  const config = value as Record<string, unknown>;
  if (kind === "points") {
    if (!nonEmpty(config.unitSingular) || !nonEmpty(config.unitPlural)) {
      return "Completa el nombre singular y plural de la unidad.";
    }
  }
  if (kind === "stamps") {
    const target = config.target;
    if (
      !nonEmpty(config.unitName) ||
      !Number.isInteger(target) ||
      Number(target) < 2 ||
      Number(target) > 50
    ) {
      return "Los sellos requieren nombre y un objetivo entero entre 2 y 50.";
    }
  }
  return null;
}

export async function ownerBusiness(userId: string) {
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      countryCode: businesses.countryCode,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")))
    .orderBy(desc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

export async function programForOwner(userId: string) {
  const business = await ownerBusiness(userId);
  if (!business) return null;
  const [program] = await getDb()
    .select()
    .from(loyaltyPrograms)
    .where(eq(loyaltyPrograms.businessId, business.id))
    .limit(1);
  if (!program) return { business, program: null, activeVersion: null };
  const [activeVersion] = program.activeVersionId
    ? await getDb()
        .select()
        .from(loyaltyProgramVersions)
        .where(eq(loyaltyProgramVersions.id, program.activeVersionId))
        .limit(1)
    : [];
  return { business, program, activeVersion: activeVersion ?? null };
}

function date(value: string | undefined) {
  if (!value) return null;
  const result = new Date(value);
  return Number.isNaN(result.valueOf()) ? null : result;
}

function render(text: string, variables: Record<string, string>) {
  return text.replace(
    /{{([a-z_]+)}}/g,
    (_, key: string) => variables[key] ?? `{{${key}}}`,
  );
}

export async function publishProgram(userId: string, input: PublishInput) {
  const error = validateConfiguration(input.kind, input.configuration);
  if (error) throw new LoyaltyError(422, error);
  const context = await programForOwner(userId);
  if (!context) throw new LoyaltyError(403, "No tienes un negocio como owner.");
  const { business, program, activeVersion } = context;
  const earningEndsAt = date(input.earningEndsAt);
  const redemptionEndsAt = date(input.redemptionEndsAt);
  if (
    activeVersion &&
    (!earningEndsAt ||
      !redemptionEndsAt ||
      earningEndsAt > redemptionEndsAt ||
      earningEndsAt <= new Date())
  ) {
    throw new LoyaltyError(
      422,
      "Indica una ventana futura válida para cerrar la versión actual.",
    );
  }
  const db = getDb();
  const selected = input.clauses.slice(0, 12);
  const templates = selected.some((clause) => clause.templateId)
    ? await db
        .select()
        .from(termsTemplates)
        .where(eq(termsTemplates.status, "published"))
    : [];
  const programId = program?.id ?? randomUUID();
  const versionId = randomUUID();
  const termsId = randomUUID();
  const variables = {
    business_legal_name: business.name,
    program_name:
      input.kind === "points"
        ? String((input.configuration as Record<string, unknown>).unitPlural)
        : "tarjeta de sellos",
    program_kind: input.kind,
    effective_from: new Date().toLocaleDateString("es-EC"),
    earning_ends_at: earningEndsAt?.toLocaleDateString("es-EC") ?? "No aplica",
    redemption_ends_at:
      redemptionEndsAt?.toLocaleDateString("es-EC") ?? "No aplica",
    country_code: business.countryCode,
  };
  const clauses = selected.map((clause, position) => {
    const template = clause.templateId
      ? templates.find((item) => item.id === clause.templateId)
      : null;
    const text =
      nonEmpty(clause.text) ?? (template ? template.templateMarkdown : null);
    if (!text) throw new LoyaltyError(422, "Cada cláusula debe tener texto.");
    return {
      id: randomUUID(),
      position: String(position + 1),
      template,
      rendered: render(text, variables),
      edited: Boolean(clause.text),
    };
  });
  if (!clauses.length)
    throw new LoyaltyError(422, "Añade al menos una cláusula de términos.");
  const renderedMarkdown = clauses
    .map((clause) => clause.rendered)
    .join("\n\n");
  const contentHash = createHash("sha256")
    .update(renderedMarkdown)
    .digest("hex");
  const statements = [
    ...(!program
      ? [
          db.insert(loyaltyPrograms).values({
            id: programId,
            businessId: business.id,
            status: "inactive",
          }),
        ]
      : []),
    ...(activeVersion
      ? [
          db
            .update(loyaltyProgramVersions)
            .set({ status: "retiring", earningEndsAt, redemptionEndsAt })
            .where(eq(loyaltyProgramVersions.id, activeVersion.id)),
          db.insert(loyaltyProgramTransitions).values({
            id: randomUUID(),
            programId,
            fromVersionId: activeVersion.id,
            toVersionId: versionId,
            earningEndsAt: earningEndsAt!,
            redemptionEndsAt: redemptionEndsAt!,
            createdBy: userId,
          }),
        ]
      : []),
    db.insert(loyaltyProgramVersions).values({
      id: versionId,
      programId,
      kind: input.kind,
      configuration: input.configuration as Record<string, unknown>,
      effectiveFrom: new Date(),
      status: "active",
      publishedAt: new Date(),
      createdBy: userId,
    }),
    db.insert(loyaltyTermsVersions).values({
      id: termsId,
      programVersionId: versionId,
      renderedMarkdown,
      contentHash,
    }),
    db.insert(loyaltyTermsClauses).values(
      clauses.map((clause) => ({
        id: clause.id,
        termsVersionId: termsId,
        position: clause.position,
        sourceTemplateId: clause.template?.id,
        sourceTemplateVersion: clause.template?.version,
        renderedClause: clause.rendered,
        editedByOwner: clause.edited,
      })),
    ),
    db
      .update(loyaltyPrograms)
      .set({
        status: "active",
        activeVersionId: versionId,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyPrograms.id, programId)),
  ];
  const [firstStatement, ...remainingStatements] = statements;
  if (!firstStatement)
    throw new LoyaltyError(503, "No pudimos preparar la publicación.");
  await db.batch([firstStatement, ...remainingStatements] as Parameters<
    typeof db.batch
  >[0]);
  return { programId, versionId };
}

export class LoyaltyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
