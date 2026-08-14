type ProgramRow = {
  id: string;
  stampImageObjectKey: string | null;
  stampImageVersion: number;
  [key: string]: unknown;
};

/**
 * Client-facing shape of a program: never serializes the internal R2
 * `stampImageObjectKey`, only a public `stampImagePath`.
 */
export function toClientProgram<T extends ProgramRow>(
  program: T | null,
  businessId: string,
) {
  if (!program) return null;
  const { stampImageObjectKey, ...rest } = program;
  return {
    ...rest,
    stampImagePath: stampImageObjectKey
      ? `/api/public/loyalty/${businessId}/${program.id}/stamp?v=${program.stampImageVersion}`
      : null,
  };
}
