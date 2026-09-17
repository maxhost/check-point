type ProgramRow = {
  id: string;
  stampImageObjectKey: string | null;
  stampImageVersion: number;
  accrualMode?: string | null;
  accrualGrant?: number | null;
  accrualBlockAmount?: string | null;
  [key: string]: unknown;
};

/** Service-side reward row (joined to its product image); the DTO strips the R2 key. */
type RewardRow = {
  id: string;
  rewardType: string;
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  imageObjectKey: string | null;
  imageVersion: number | null;
};

/**
 * The ONE client-facing shape of a reward (contract fixed in
 * `docs/specs/0055-contratos-del-orquestador.md` §1), shared by the loyalty wizard,
 * `counter/resolve` and the consumer wallet summary. There is deliberately no second
 * reward DTO: two places that decide the same thing diverge — that is how the
 * `*ObjectKey` leak of spec 0025 and the duplicated MIME lists of 0033/0039/0040
 * happened. `id` exists because `/api/counter/redeem` takes a `rewardId`.
 */
export type RewardDTO = {
  id: string;
  type: string;
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  /** Public path only — NEVER `imageObjectKey`. */
  imagePath: string | null;
};

/** Client-facing reward: never serializes the internal R2 key, only a public `imagePath`. */
export function toRewardDTO(reward: RewardRow): RewardDTO {
  return {
    id: reward.id,
    type: reward.rewardType,
    label: reward.label,
    productId: reward.productId,
    discountPercent: reward.discountPercent,
    pointsCost: reward.pointsCost,
    position: reward.position,
    imagePath:
      reward.productId && reward.imageObjectKey
        ? `/api/public/catalog/${reward.productId}/image?v=${reward.imageVersion ?? 0}`
        : null,
  };
}

/**
 * Client-facing shape of a program: never serializes the internal R2 keys
 * (`stampImageObjectKey` on the program, `imageObjectKey` on a reward's product),
 * only public paths. Exposes the accrual mechanics and the ordered reward list.
 */
export function toClientProgram<T extends ProgramRow>(
  program: T | null,
  businessId: string,
  rewards: RewardRow[] = [],
) {
  if (!program) return null;
  const {
    stampImageObjectKey,
    accrualMode,
    accrualGrant,
    accrualBlockAmount,
    ...rest
  } = program;
  // La clave interna de R2 se desestructura para SACARLA de `rest` y no vuelve nunca al
  // DTO (spec 0025). El `void` es el idiom del repo para un binding a proposito sin uso
  // (ver `wallet/push-transports.ts:46`).
  void stampImageObjectKey;
  return {
    ...rest,
    /**
     * Spec 0069 §D5 — **el path se emite SIEMPRE, con sello o sin el.**
     *
     * Hasta la 0069 esto devolvia `null` sin `stampImageObjectKey`, y medido contra el
     * arbol esta es la UNICA linea que construye la URL `/api/public/loyalty/.../stamp`
     * en todo `apps/merchant/src`. O sea: un placeholder escrito solo dentro de la ruta
     * publica seria **codigo muerto**, porque nadie la llamaria nunca. Esto es lo que
     * lo hace alcanzable — y `consumer/programs.ts` lo propaga tal cual.
     *
     * Sin sello la version es la de la columna (`0` por default), que es exactamente
     * la que la ruta exige para servir el placeholder.
     */
    stampImagePath: `/api/public/loyalty/${businessId}/${program.id}/stamp?v=${program.stampImageVersion}`,
    accrual: accrualMode
      ? {
          mode: accrualMode,
          grant: accrualGrant ?? null,
          blockAmount:
            accrualBlockAmount === null || accrualBlockAmount === undefined
              ? null
              : Number(accrualBlockAmount),
        }
      : null,
    rewards: rewards.map(toRewardDTO),
  };
}
