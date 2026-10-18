/** Optional private diagnostic. The preload owns validation and sanitized output. */
type Measurement = { beginPhase(name: string): () => void };
export function beginRequestMeasurement(name: string): () => void {
  return (
    (
      globalThis as typeof globalThis & { __requestMeasurement?: Measurement }
    ).__requestMeasurement?.beginPhase(name) ?? (() => {})
  );
}
export async function measureRequestPhase<T>(
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const finish = beginRequestMeasurement(name);
  try {
    return await work();
  } finally {
    finish();
  }
}
