type AddressParts = {
  formatted?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  street?: unknown;
  housenumber?: unknown;
  postcode?: unknown;
  city?: unknown;
  town?: unknown;
  village?: unknown;
  municipality?: unknown;
  country?: unknown;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

function first(...values: unknown[]) {
  return values.map(text).find(Boolean) ?? null;
}

function unique(parts: string[]) {
  return parts.filter(
    (part, index) =>
      parts.findIndex(
        (candidate) =>
          candidate.localeCompare(part, "es", { sensitivity: "accent" }) === 0,
      ) === index,
  );
}

/**
 * Creates the canonical postal address without using a POI/business name.
 * The raw provider response remains available as provenance in the snapshot.
 */
export function canonicalAddress(parts: AddressParts) {
  const street = first(
    [text(parts.street), text(parts.housenumber)].filter(Boolean).join(" "),
    parts.address_line2,
    parts.address_line1,
  );
  const locality = first(
    parts.city,
    parts.town,
    parts.village,
    parts.municipality,
  );
  const formatted = unique(
    [street, text(parts.postcode), locality, text(parts.country)].filter(
      (part): part is string => Boolean(part),
    ),
  ).join(", ");

  return formatted || text(parts.formatted);
}
