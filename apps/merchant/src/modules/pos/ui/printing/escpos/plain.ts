/**
 * Spec 0184 — SIN ACENTOS (decision del owner, ADR 0133): la tabla de caracteres de una termica
 * generica no esta garantizada. `á`→`a`, `ñ`→`n`, espacios duros → espacio, `€`→`EUR`, y todo lo
 * que no sea ASCII imprimible desaparece. Lo que sale de aca es siempre 0x20–0x7E.
 */
const SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "£": "GBP",
  "×": "x",
  "–": "-",
  "—": "-",
  "·": "-",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
};

export function plain(value: string): string {
  return (
    value
      // NFD separa la letra de su acento; el acento queda fuera de 0x20–0x7E y lo borra el ultimo paso.
      .normalize("NFD")
      .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
      .replace(/[^\x20-\x7e]/g, (char) => SYMBOLS[char] ?? "")
  );
}
