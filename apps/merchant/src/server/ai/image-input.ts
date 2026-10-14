import {
  AssetImageError,
  normalizeImageToJpeg,
} from "@mi-pasaporte/domain/server/assets/image";
import { AiInputError } from "./errors";
import { sniffKind } from "./sniff";
import type { AiImage } from "./task";

/**
 * Spec 0224 §5 / ADR 0143 §6 — LAS FOTOS de un `multipart/form-data` que van a la IA. El servidor no
 * confia en el cliente: el tipo sale de los BYTES (`sniffKind`) y la normalizacion es UNA, la del
 * dominio (`normalizeImageToJpeg`: tope de 50 MP contra bombas, formato real, EXIF, lado mayor 2048,
 * JPEG). Lo que sale de aca es siempre JPEG. La foto no se guarda.
 */
export type AiImageLimits = {
  field: string;
  min: number;
  max: number;
  maxBytes: number;
  maxTotalBytes: number;
};

/** `request` → las fotos normalizadas, o `AiInputError` (422 / 413 / 415). */
export async function readAiImages(
  request: Request,
  limits: AiImageLimits,
): Promise<AiImage[]> {
  const invalid = () =>
    new AiInputError(
      422,
      "invalid_photos",
      `Mandá entre ${limits.min} y ${limits.max} fotos.`,
    );
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw invalid();
  }
  const parts = form.getAll(limits.field);
  if (parts.some((part) => !(part instanceof File))) throw invalid();
  const files = parts as File[];
  if (files.length < limits.min || files.length > limits.max) throw invalid();
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (
    files.some((file) => file.size > limits.maxBytes) ||
    total > limits.maxTotalBytes
  ) {
    throw new AiInputError(
      413,
      "photos_too_large",
      "Las fotos son muy pesadas.",
    );
  }
  const images: AiImage[] = [];
  // EN SERIE, nunca `Promise.all`: con el tope de 50 MP, varias decodificaciones en paralelo son
  // cientos de MB de pixeles (mismo criterio que `catalog-import/prepare.ts`).
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (sniffKind(bytes) !== "image") throw unsupported();
    try {
      images.push({ kind: "image", jpeg: await normalizeImageToJpeg(bytes) });
    } catch (error) {
      if (error instanceof AssetImageError) throw unsupported();
      throw error;
    }
  }
  return images;
}

function unsupported(): AiInputError {
  return new AiInputError(
    415,
    "unsupported_image",
    "No pudimos abrir la foto. Probá con JPG, PNG o HEIC.",
  );
}
