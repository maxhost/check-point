import { eq, like } from "drizzle-orm";
import { getDb } from "./db";
import { businesses } from "./schema";
import { RESERVED_SLUGS, isValidSlug, nextSuggestion, slugify } from "./slug";

/**
 * Spec 0067 §1 — el CABLEADO del slug del negocio. `server/slug.ts` es puro y su forma la
 * fija la spec: **no se toca**. Lo que falta ahí y vive acá es lo que necesita la base —
 * qué slugs están tomados, y qué pasa cuando el índice único dice que no.
 *
 * Dos propiedades que este módulo existe para sostener, y que `slugify` sola no da:
 *
 * 1. **`slugify` puede devolver una palabra RESERVADA** (`"Admin"` → `"admin"`, medido por
 *    el revisor del paso 1). Llamarla a secas en el alta le regalaría `/es/admin` a un
 *    comercio. `nextSuggestion` trata las reservadas como ocupadas, así que el derivado
 *    pasa SIEMPRE por ahí — igual que hizo el paso 2 con el `handle` del staff.
 * 2. **`slugify` colapsa a `"000"` todo nombre sin caracteres latinos** (`"日本語"`,
 *    `"Мир"`). Dos comercios así chocarían contra el único global; con `nextSuggestion` el
 *    segundo se lleva `000-2`.
 *
 * Y una que NO sostiene, a propósito: la unicidad. Esa la garantiza
 * `core_business_slug_unique`, no la lectura previa — entre leer y escribir cabe otra alta
 * (TOCTOU). El `insert`/`update` que choca es quien decide.
 */
export class SlugError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Sólo en el 409: la siguiente forma libre, para que la UI la pueda ofrecer. */
    readonly suggestion?: string,
  ) {
    super(message);
    this.name = "SlugError";
  }
}

/** Los slugs ya tomados que empiezan igual. Acota la lectura: el único es global, pero una
 * sugerencia sólo puede chocar con la misma raíz. */
async function takenWithPrefix(root: string): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(like(businesses.slug, `${root}%`));
  return rows.map((row) => row.slug);
}

/**
 * El slug con el que nace un negocio, derivado del NOMBRE. El wizard no expone ningún campo
 * de slug (decisión del owner, spec §1): el servidor lo resuelve solo y lo devuelve hecho.
 */
export async function slugForNewBusiness(name: string): Promise<string> {
  const root = slugify(name);
  return nextSuggestion(root, await takenWithPrefix(root));
}

/** Normaliza y valida la FORMA de un slug que escribió el usuario. */
export function parseSlug(value: unknown): string {
  const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!isValidSlug(slug))
    throw new SlugError(
      400,
      "invalid_slug",
      "Usá entre 3 y 30 letras, números o guiones, sin guion al principio ni al final.",
    );
  if (RESERVED_SLUGS.includes(slug))
    throw new SlugError(
      400,
      "reserved_slug",
      "Ese identificador está reservado.",
    );
  return slug;
}

/**
 * El cambio EXPLÍCITO y posterior al alta (ADR 0070 §12). Es la única forma de mover un
 * slug: renombrar el negocio NO lo toca (`saveBrand` no escribe la columna), porque el slug
 * es a la vez el login del staff (`handle@slug`) y la URL pública.
 *
 * **El 409 sale del choque del único, no de un chequeo previo.** Un `select … where slug = ?`
 * antes del `update` respondería sobre un estado que ya puede haber cambiado; acá el
 * `23505` es el que manda y la sugerencia se calcula recién después, para la UI.
 *
 * **Consecuencia declarada:** cambiar el slug cambia el identificador de login de TODO el
 * staff del negocio (`handle@slug`). Es inherente a la decisión del owner de que sean el
 * mismo identificador (ADR 0070 §5); esta spec no entrega ningún aviso previo.
 */
export async function changeBusinessSlug(
  businessId: string,
  value: unknown,
): Promise<{ slug: string }> {
  const slug = parseSlug(value);
  try {
    const [row] = await getDb()
      .update(businesses)
      .set({ slug, updatedAt: new Date() })
      .where(eq(businesses.id, businessId))
      .returning({ slug: businesses.slug });
    if (!row)
      throw new SlugError(404, "business_not_found", "Negocio no encontrado.");
    return { slug: row.slug };
  } catch (error) {
    if (error instanceof SlugError) throw error;
    if (!isUniqueViolation(error))
      throw new SlugError(
        503,
        "slug_unavailable",
        "No pudimos guardar el identificador. Intentá de nuevo.",
      );
    throw new SlugError(
      409,
      "slug_taken",
      "Ese identificador ya está en uso.",
      nextSuggestion(slug, await takenWithPrefix(slug)),
    );
  }
}

/** `23505` = unique_violation, en el error o en cualquiera de sus `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
