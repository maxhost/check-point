import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Spec 0090 §2 / ADR 0082 §11 — EL CONTADOR DE PAGINAS DE UN PDF, **sin dependencias**.
 *
 * Hace falta porque el limite de 10 paginas no tenia mecanismo: `sharp` no lee PDF
 * (`sharp.format.pdf.input === false`) y no hay libreria de PDF en el store. Un escaneo
 * naive de `/Type /Page` **falla ABIERTO**: sobre un PDF con `/ObjStm` devuelve **0**, asi
 * que un documento de 400 paginas pasaria un check de `<= 10`.
 *
 * Por eso se toma el **maximo de dos señales independientes** —los objetos `/Type /Page` y
 * el `/Count` del nodo de paginas— sobre el texto crudo **mas** los streams inflados con
 * `node:zlib`, y **si ninguna da nada se RECHAZA**. Sobre-contar solo puede rechazar un
 * archivo valido; nunca deja pasar uno de 400 paginas.
 *
 * **Limites declarados** (los tres fallan del lado seguro):
 * - no valida que el PDF sea renderizable;
 * - ignora los object streams con compresion que no sea Flate;
 * - un menu que contuviera el texto literal `/Type /Page` se sobre-cuenta.
 */
export type PdfPageCount =
  | { ok: true; pages: number }
  | { ok: false; reason: "encrypted" | "unreadable" };

/** Cuanto se infla como maximo por stream: un stream que se expande mas que esto es una
 * bomba de descompresion y no una tabla de objetos de un menu. */
const MAX_INFLATED_BYTES = 8 * 1024 * 1024;
/** Cuantos streams se intentan inflar. Un PDF de 10 paginas no tiene miles. */
const MAX_STREAMS = 400;

export function countPdfPages(buffer: Buffer): PdfPageCount {
  if (!isPdf(buffer)) return { ok: false, reason: "unreadable" };
  const raw = buffer.toString("latin1");
  // El cifrado se detecta por `/Encrypt`. Se busca en TODO el texto y no solo en el trailer
  // final: un PDF con revisiones incrementales tiene varios trailers, y perderse uno seria
  // aceptar un archivo que despues no se puede leer.
  if (/\/Encrypt\b/.test(raw)) return { ok: false, reason: "encrypted" };

  const haystacks = [raw, ...inflatedStreams(buffer)];
  let byTypePage = 0;
  let byCount = 0;
  for (const text of haystacks) {
    byTypePage += countTypePage(text);
    byCount = Math.max(byCount, maxPagesCount(text));
  }
  const pages = Math.max(byTypePage, byCount);
  if (pages < 1) return { ok: false, reason: "unreadable" };
  return { ok: true, pages };
}

function isPdf(buffer: Buffer): boolean {
  // Los bytes mandan: `%PDF-` en la cabecera. Algunos generadores dejan basura antes, asi
  // que se busca dentro del primer KB en vez de exigir offset 0.
  return buffer.subarray(0, 1024).includes("%PDF-");
}

/** Señal A: objetos de pagina. El lookahead evita contar `/Type /Pages`, que es el NODO. */
function countTypePage(text: string): number {
  return (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

/** Señal B: el `/Count` mas grande. En un arbol de paginas bien formado el del nodo raiz es
 * el total, y cualquier nodo intermedio cuenta menos — asi que el maximo es el total. */
function maxPagesCount(text: string): number {
  let max = 0;
  for (const match of text.matchAll(/\/Count\s+(\d{1,6})\b/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max;
}

/**
 * Infla cada stream Flate del archivo. Los object streams (`/ObjStm`) viven ahi: es lo unico
 * que hace visible un `/Type /Page` en un PDF moderno.
 */
function inflatedStreams(buffer: Buffer): string[] {
  const out: string[] = [];
  let offset = 0;
  let seen = 0;
  while (seen < MAX_STREAMS) {
    const start = buffer.indexOf("stream", offset);
    if (start === -1) break;
    let dataStart = start + "stream".length;
    // Tras `stream` va CRLF o LF, segun el generador.
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf("endstream", dataStart);
    if (end === -1) break;
    offset = end + "endstream".length;
    seen += 1;
    const chunk = buffer.subarray(dataStart, end);
    if (chunk.byteLength === 0) continue;
    const text = inflateToText(chunk);
    if (text) out.push(text);
  }
  return out;
}

function inflateToText(chunk: Buffer): string | null {
  const options = { maxOutputLength: MAX_INFLATED_BYTES };
  try {
    return inflateSync(chunk, options).toString("latin1");
  } catch {
    // Sin cabecera zlib (raw deflate) es un archivo valido igual; lo demas —LZW, JPX, un
    // stream no comprimido— simplemente no aporta señal y se ignora.
    try {
      return inflateRawSync(chunk, options).toString("latin1");
    } catch {
      return null;
    }
  }
}
