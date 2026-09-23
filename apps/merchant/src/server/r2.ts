import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export class R2ConfigurationError extends Error {}

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const region = process.env.R2_REGION ?? "auto";
  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new R2ConfigurationError("R2 no está configurado por completo.");
  }
  return { accessKeyId, secretAccessKey, endpoint, bucket, region };
}

function client() {
  const config = r2Config();
  return {
    bucket: config.bucket,
    s3: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

export function logoTemporaryObjectKey(businessId: string, uploadId: string) {
  return `brand-uploads/${businessId}/${uploadId}`;
}

export function logoObjectPrefix(businessId: string, assetId: string) {
  return `brands/${businessId}/${assetId}`;
}

export function stampTemporaryObjectKey(businessId: string, uploadId: string) {
  return `stamp-uploads/${businessId}/${uploadId}`;
}

export function stampObjectPrefix(
  businessId: string,
  programId: string,
  assetId: string,
) {
  return `loyalty/${businessId}/${programId}/${assetId}`;
}

export function productTemporaryObjectKey(
  businessId: string,
  uploadId: string,
) {
  return `product-uploads/${businessId}/${uploadId}`;
}

export function productObjectPrefix(businessId: string, assetId: string) {
  return `products/${businessId}/${assetId}`;
}

export async function createTemporaryUploadUrl(input: {
  objectKey: string;
  // The real validation is upstream: the caller's allow-list (shared
  // `ACCEPTED_IMAGE_CONTENT_TYPE_SET`) plus the byte-sniff in
  // `server/assets/image.ts`. This only sets the presigned PUT's Content-Type.
  contentType: string;
  byteSize: number;
  /**
   * Spec 0090 §9 — el tope de bytes que esta reserva admite, en bytes. Por defecto
   * `MAX_LOGO_BYTES` (5 MB), que es lo que las tres subidas de imagen ya exigian.
   *
   * **Es parametrico desde la spec 0090 y no por gusto:** la importacion de catalogo firma
   * fotos de hasta 10 MB y PDFs de hasta 20 MB, y con el tope fijo no podia firmar ni una.
   * Lo que NO hace es cambiar lo que la firma ata: el `PutObjectCommand` lleva `Key` y
   * `ContentType`, **no `ContentLength`**, asi que esto es una validacion del tamaño
   * DECLARADO, no una garantia criptografica sobre el objeto que termina en el bucket. Lo
   * que protege de verdad es el tope de lectura del servidor (`readObjectAtMost`).
   */
  maxBytes?: number;
  /** Vida de la firma, en segundos. El default de 10 min es el de las subidas de imagen. */
  expiresInSeconds?: number;
}) {
  const maxBytes = input.maxBytes ?? MAX_LOGO_BYTES;
  if (
    !Number.isInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > maxBytes
  ) {
    throw new Error(
      `El archivo debe pesar como máximo ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    );
  }
  const { s3, bucket } = client();
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    }),
    { expiresIn: input.expiresInSeconds ?? 10 * 60 },
  );
}

/** Private R2 key of one uploaded original of a catalog import (spec 0090 §3). Business,
 * import and file are non-guessable UUIDs. */
export function catalogImportObjectKey(
  businessId: string,
  importId: string,
  fileId: string,
) {
  return `catalog-imports/${businessId}/${importId}/${fileId}`;
}

export async function getPrivateObject(key: string) {
  const { s3, bucket } = client();
  const object = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!object.Body) throw new Error("El archivo temporal no existe.");
  return object;
}

export async function readObjectAtMost(
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
  maxBytes: number,
) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const iterable =
    Symbol.asyncIterator in body
      ? (body as AsyncIterable<Uint8Array>)
      : streamToAsyncIterable(body as ReadableStream<Uint8Array>);
  for await (const chunk of iterable) {
    size += chunk.byteLength;
    if (size > maxBytes)
      throw new Error("El archivo supera el límite permitido.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function* streamToAsyncIterable(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Normalizes the Node stream returned by the AWS SDK into a Fetch response body. */
export function objectBodyToWebStream(
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
) {
  if (typeof (body as ReadableStream<Uint8Array>).getReader === "function") {
    return body as ReadableStream<Uint8Array>;
  }
  const iterator = (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else if (value) controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

async function putImageVariants(
  prefix: string,
  basename: string,
  webp: Buffer,
  png: Buffer,
) {
  const { s3, bucket } = client();
  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/${basename}.webp`,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/${basename}.png`,
        Body: png,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    ),
  ]);
}

export function putLogoVariants(prefix: string, webp: Buffer, png: Buffer) {
  return putImageVariants(prefix, "logo", webp, png);
}

export function putStampVariants(prefix: string, webp: Buffer, png: Buffer) {
  return putImageVariants(prefix, "stamp", webp, png);
}

export function putProductVariants(prefix: string, webp: Buffer, png: Buffer) {
  return putImageVariants(prefix, "product", webp, png);
}

export async function deleteObjectKeys(keys: string[]) {
  if (!keys.length) return;
  const { s3, bucket } = client();
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}

export async function deleteLogoPrefix(prefix: string) {
  await deleteObjectKeys([`${prefix}/logo.webp`, `${prefix}/logo.png`]);
}

export async function deleteStampPrefix(prefix: string) {
  await deleteObjectKeys([`${prefix}/stamp.webp`, `${prefix}/stamp.png`]);
}

export async function deleteProductPrefix(prefix: string) {
  await deleteObjectKeys([`${prefix}/product.webp`, `${prefix}/product.png`]);
}

export { MAX_LOGO_BYTES };
