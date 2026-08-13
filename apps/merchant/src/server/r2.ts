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

export async function createTemporaryUploadUrl(input: {
  objectKey: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
}) {
  if (
    !Number.isInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > MAX_LOGO_BYTES
  ) {
    throw new Error("El archivo debe pesar como máximo 5 MB.");
  }
  const { s3, bucket } = client();
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    }),
    { expiresIn: 10 * 60 },
  );
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

export async function putLogoVariants(
  prefix: string,
  webp: Buffer,
  png: Buffer,
) {
  const { s3, bucket } = client();
  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/logo.webp`,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/logo.png`,
        Body: png,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    ),
  ]);
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

export { MAX_LOGO_BYTES };
