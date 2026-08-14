import { isValidCountryIso } from "../../lib/countries";
import { ConsumerError, type EnrollInput } from "./core";

/** E.164: a leading '+', a non-zero first digit, then up to 14 more digits. */
const E164 = /^\+[1-9]\d{1,14}$/;
const MAX_NAME = 120;

function normalizeName(value: unknown, label: string): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name)
    throw new ConsumerError(422, "invalid_name", `Ingresá tu ${label}.`);
  if (name.length > MAX_NAME)
    throw new ConsumerError(
      422,
      "invalid_name",
      `El ${label} es demasiado largo (máximo ${MAX_NAME} caracteres).`,
    );
  return name;
}

/** Validates and normalizes the enroll body. Any problem → ConsumerError(422). */
export function validateEnrollInput(raw: unknown): EnrollInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConsumerError(422, "invalid_input", "Los datos no son válidos.");
  }
  const input = raw as Record<string, unknown>;
  const firstName = normalizeName(input.firstName, "nombre");
  const lastName = normalizeName(input.lastName, "apellido");
  const phoneE164 =
    typeof input.phoneE164 === "string" ? input.phoneE164.trim() : "";
  if (!E164.test(phoneE164)) {
    throw new ConsumerError(
      422,
      "invalid_phone",
      "El teléfono debe estar en formato internacional, por ejemplo +593987654321.",
    );
  }
  // Country is the selector choice (analytics), NOT derived from the phone and
  // NOT cross-validated against it: foreign numbers are allowed on purpose.
  const countryIso =
    typeof input.countryIso === "string"
      ? input.countryIso.trim().toUpperCase()
      : "";
  if (!isValidCountryIso(countryIso)) {
    throw new ConsumerError(
      422,
      "invalid_country",
      "Elegí un país válido de la lista.",
    );
  }
  return { firstName, lastName, phoneE164, countryIso };
}
