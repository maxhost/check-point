import { getTableName, type Table } from "drizzle-orm";
import type { DbTransaction } from "./db";

/**
 * EL DOBLE DE `tx` DE BILLING, compartido por `billing-store.test.ts` y
 * `billing-campaign-brake.test.ts`. Fija el conjunto EXACTO de claves de cada `SET` y del
 * `select`; no que Postgres aplique la fila (eso es la integración).
 *
 * Vive en su propio archivo desde la spec 0065: los dos tests que lo usan no entran juntos
 * en 300 líneas, y copiarlo habría dejado dos dobles que se pueden desincronizar — que es
 * justo la clase de divergencia silenciosa que el doble existe para cazar.
 */
export type Recorded = {
  /** El `SET` de `core.subscription`, que es de lo que trata este archivo. */
  set: Record<string, unknown>;
  /** El `SET` de cada tabla escrita, por nombre. Existe desde la spec 0065: al entrar el
   * freno defensivo, `applySubscriptionState` escribe DOS tablas en la misma transacción y
   * el doble viejo —que guardaba un solo `set`, sin mirar la tabla— dejaba el `UPDATE` de
   * `campaign` pisando al de `subscription`. El rojo se leía como un cambio de columnas de
   * billing y era otra tabla: un rojo por el motivo equivocado (`CLAUDE.md`). */
  sets: Record<string, Record<string, unknown>>;
  selected: string[];
};

export function txDouble(row?: Record<string, unknown>) {
  const recorded: Recorded = { set: {}, sets: {}, selected: [] };
  let table = "";
  const chain = {
    set: (values: Record<string, unknown>) => {
      recorded.sets[table] = values;
      if (table === "subscription") recorded.set = values;
      return chain;
    },
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(row ? [row] : []),
    returning: () => Promise.resolve(row ? [row] : []),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve([])),
  };
  const tx = {
    update: (updated: Table) => {
      table = getTableName(updated);
      return chain;
    },
    select: (columns: Record<string, unknown>) => {
      recorded.selected = Object.keys(columns);
      return chain;
    },
  } as unknown as DbTransaction;
  return { tx, recorded };
}
