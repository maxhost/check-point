/**
 * Spec 0099 — la fila de `loyalty_program` que `toClientProgram` puede leer, y NADA MAS.
 * Sin indice abierto (`[key: string]: unknown`): antes de esta spec cualquier columna que
 * `db.select()` trajera pasaba por `...rest` al DTO sin que nadie la hubiera pedido. Ahora
 * si una columna no esta en esta lista, TypeScript no permite construirla en el objeto de
 * salida — no hay forma de que `businessId`, `createdBy`, `schemaVersion`, `termsHash` o
 * `termsUpdatedAt` entren por accidente.
 *
 * Solo `id`, `stampImageObjectKey` y `stampImageVersion` son obligatorios: los otros 15
 * campos (incluidos los 3 de acumulacion) quedan opcionales porque `consumer/programs.ts`
 * llama a esta funcion con un objeto de exactamente esos 3 campos cuando arma
 * `stampImagePath` para su propio DTO — verificado en la spec 0099, no hay nada que
 * endurecer ahi. Volverlos obligatorios rompe esa llamada por *excess/missing property
 * checking* de TypeScript; el invariante de seguridad (columnas internas nunca servidas)
 * lo da la construccion campo por campo de `toClientProgram`, no la obligatoriedad del tipo.
 */
type ProgramRow = {
  id: string;
  kind?: string;
  configuration?: unknown;
  status?: string;
  activatedAt?: Date | string;
  earningEndsAt?: Date | string | null;
  redemptionEndsAt?: Date | string | null;
  termsMarkdown?: string;
  stampImageObjectKey: string | null;
  stampImageVersion: number;
  cardBackgroundColor?: string | null;
  cardBackgroundColor2?: string | null;
  cardBackgroundGradientAngle?: number | null;
  cardBorderColor?: string | null;
  redeemAllowInsufficient?: boolean;
  accrualMode?: string | null;
  accrualGrant?: number | null;
  accrualBlockAmount?: string | null;
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
 *
 * **Spec 0099 — lista blanca explicita, sin `...rest` ni spread de la fila de entrada.**
 * Cada campo del objeto de salida se nombra a mano, en el mismo estilo que `toRewardDTO`:
 * lo que no se nombra aca no puede llegar al cliente, sea cual sea la fila que le pase
 * `programForOwner` (`owner.ts:69-79`, que sigue trayendo `db.select()` de TODAS las
 * columnas). `stampImageObjectKey` se recibe para calcular `stampImagePath` pero nunca se
 * copia al objeto de salida.
 */
export function toClientProgram<T extends ProgramRow>(
  program: T | null,
  businessId: string,
  rewards: RewardRow[] = [],
) {
  if (!program) return null;
  return {
    id: program.id,
    kind: program.kind,
    configuration: program.configuration,
    status: program.status,
    activatedAt: program.activatedAt,
    earningEndsAt: program.earningEndsAt,
    redemptionEndsAt: program.redemptionEndsAt,
    termsMarkdown: program.termsMarkdown,
    cardBackgroundColor: program.cardBackgroundColor,
    cardBackgroundColor2: program.cardBackgroundColor2,
    cardBackgroundGradientAngle: program.cardBackgroundGradientAngle,
    cardBorderColor: program.cardBorderColor,
    redeemAllowInsufficient: program.redeemAllowInsufficient,
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
    accrual: program.accrualMode
      ? {
          mode: program.accrualMode,
          grant: program.accrualGrant ?? null,
          blockAmount:
            program.accrualBlockAmount === null ||
            program.accrualBlockAmount === undefined
              ? null
              : Number(program.accrualBlockAmount),
        }
      : null,
    rewards: rewards.map(toRewardDTO),
  };
}
