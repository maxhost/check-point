/**
 * Spec 0090 §2 — LA DETECCION POR BYTES de la cabecera, para que `analyze` pueda contestar
 * `422` **en el momento** sin bajarse los 50 MB.
 *
 * «La extension y el `content-type` del cliente no son autoridad»: un `.jpg` renombrado desde
 * un `.gif`, un SVG con `content-type` de PNG o un ofimatico se caen aca. El decodificado
 * completo con `sharp` sigue corriendo despues —es el que realmente abre la imagen— pero
 * llega dentro de `after()`, cuando la respuesta ya se fue.
 */
export type SniffedKind = "pdf" | "image" | null;

export function sniffKind(head: Buffer): SniffedKind {
  if (isPdfHead(head)) return "pdf";
  if (isJpeg(head) || isPng(head) || isWebp(head) || isIsoBaseMedia(head)) {
    return "image";
  }
  return null;
}

/** `%PDF-` dentro del primer KB: algunos generadores dejan basura antes del header. */
function isPdfHead(head: Buffer): boolean {
  return head.subarray(0, 1024).includes("%PDF-");
}

function isJpeg(head: Buffer): boolean {
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

function isPng(head: Buffer): boolean {
  return (
    head
      .subarray(0, 8)
      .compare(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ) === 0
  );
}

function isWebp(head: Buffer): boolean {
  return (
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  );
}

/** HEIC/HEIF/AVIF son contenedores ISO-BMFF: la caja `ftyp` arranca en el byte 4. */
function isIsoBaseMedia(head: Buffer): boolean {
  return head.subarray(4, 8).toString("latin1") === "ftyp";
}
