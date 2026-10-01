import { E164 } from "@mi-pasaporte/domain/server/consumer/validation";

/** Fixed page size of the customer list (contract `0108-contratos-de-api.md`). */
export const CUSTOMERS_PAGE_SIZE = 25;
const Q_MIN = 3;
const Q_MAX = 60;

/** What `GET /api/customers` asks for, already validated. `q` and `phone` never together. */
export type CustomerQuery =
  | { page: number; filter: "all" }
  | { page: number; filter: "name"; q: string }
  | { page: number; filter: "phone"; phone: string };

export type CustomerQueryFields = Partial<
  Record<"page" | "q" | "phone", string>
>;

export class CustomerQueryError extends Error {
  readonly status = 400;
  readonly code = "validation";
  constructor(readonly fields: CustomerQueryFields) {
    super("Revisa los filtros del listado.");
  }
}

/**
 * Validates the query string of the list (spec 0108). `page` is an integer ≥ 1 (default 1);
 * `q` is 3 to 60 characters AFTER trimming (counted as characters, not UTF-16 units); `phone`
 * is E.164 with the same regex as the enroll. `q` and `phone` together are a 400 with both
 * fields. Every rule failing at once reports all of its fields.
 */
export function parseCustomerQuery(params: URLSearchParams): CustomerQuery {
  const fields: CustomerQueryFields = {};
  const rawPage = params.get("page");
  const rawQ = params.get("q");
  const rawPhone = params.get("phone");

  let page = 1;
  if (rawPage !== null) {
    const parsed = /^\d+$/.test(rawPage) ? Number(rawPage) : Number.NaN;
    if (!Number.isSafeInteger(parsed) || parsed < 1)
      fields.page =
        "La página tiene que ser un número entero mayor o igual a 1.";
    else page = parsed;
  }

  if (rawQ !== null && rawPhone !== null) {
    fields.q = "Busca por nombre o por teléfono, no por los dos.";
    fields.phone = "Busca por nombre o por teléfono, no por los dos.";
    throw new CustomerQueryError(fields);
  }

  const q = rawQ?.trim() ?? null;
  if (q !== null) {
    const length = Array.from(q).length;
    if (length < Q_MIN || length > Q_MAX)
      fields.q = `La búsqueda por nombre tiene que tener entre ${Q_MIN} y ${Q_MAX} caracteres.`;
  }
  const phone = rawPhone?.trim() ?? null;
  if (phone !== null && !E164.test(phone))
    fields.phone =
      "El teléfono tiene que estar en formato internacional (+593…).";

  if (Object.keys(fields).length > 0) throw new CustomerQueryError(fields);
  if (q !== null) return { page, filter: "name", q };
  if (phone !== null) return { page, filter: "phone", phone };
  return { page, filter: "all" };
}
