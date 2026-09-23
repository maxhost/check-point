import { productCategories } from "./schema";
import { filtrar } from "./catalog-import-predicado";

/**
 * EL DOBLE DE LA TRANSACCION DEL `accept` (spec 0090 §6), compartido por
 * `catalog-import-accept.test.ts` y `catalog-import-accept-states.test.ts`.
 *
 * Vive aparte por el hook `file-size`, con el precedente de `billing-tx-double.ts`: copiarlo
 * dejaria dos dobles que se pueden desincronizar, que es la divergencia silenciosa que un
 * doble existe para cazar.
 *
 * **Lo que fija es QUE FILAS se escriben y con que valores.** Que Postgres las aplique —y que
 * la transaccion sea todo-o-nada— es la prueba de integracion, no esta.
 */
export type EstadoDelDoble = {
  /** Cola de resultados, en el orden en que la transaccion los va a consumir. */
  filas: unknown[][];
  inserts: Array<{ tabla: unknown; rows: unknown }>;
  sets: Record<string, unknown>[];
  tablaActual: unknown;
  /** Simula el 23505 del indice `core_product_category_name_unique`. */
  chocaLaCategoria: boolean;
};

export const estado: EstadoDelDoble = {
  filas: [],
  inserts: [],
  sets: [],
  tablaActual: null,
  chocaLaCategoria: false,
};

export function limpiarEstado(): void {
  estado.filas = [];
  estado.inserts = [];
  estado.sets = [];
  estado.tablaActual = null;
  estado.chocaLaCategoria = false;
}

export function filasDe(tabla: unknown): Record<string, unknown>[] {
  return estado.inserts
    .filter((insert) => insert.tabla === tabla)
    .flatMap((insert) => insert.rows as Record<string, unknown>[]);
}

/** El modulo `./db` doblado. `withDbTransaction` corre el trabajo con este mismo `tx`. */
export function dbDouble() {
  const tx: Record<string, unknown> = {};
  let condicion: unknown = null;
  let seleccion = false;
  for (const metodo of [
    "from",
    "for",
    "limit",
    "orderBy",
    "returning",
    "onConflictDoNothing",
  ]) {
    tx[metodo] = () => tx;
  }
  // **El `where` de un SELECT se EVALUA** (`catalog-import-predicado.ts`): sin esto, borrar
  // el `eq(businessId)` del `SELECT … FOR UPDATE` del `accept` no cambiaba ni un resultado.
  tx.select = () => {
    seleccion = true;
    condicion = null;
    return tx;
  };
  for (const metodo of ["update", "delete"]) {
    tx[metodo] = () => {
      seleccion = false;
      condicion = null;
      return tx;
    };
  }
  tx.where = (cond: unknown) => {
    condicion = cond;
    return tx;
  };
  tx.insert = (tabla: unknown) => {
    seleccion = false;
    condicion = null;
    estado.tablaActual = tabla;
    return tx;
  };
  tx.values = (rows: unknown) => {
    estado.inserts.push({ tabla: estado.tablaActual, rows });
    if (estado.chocaLaCategoria && estado.tablaActual === productCategories) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    return tx;
  };
  tx.set = (valor: Record<string, unknown>) => {
    estado.sets.push(valor);
    return tx;
  };
  tx.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => {
    const filas = estado.filas.shift() ?? [];
    const resultado = seleccion ? filtrar(filas, condicion) : filas;
    return Promise.resolve(resultado).then(resolve, reject);
  };
  return {
    getDb: () => tx,
    withDbTransaction: async (work: (t: unknown) => Promise<unknown>) =>
      work(tx),
  };
}

const IMPORT_ID = "11111111-1111-4111-8111-111111111111";
export const CAT_EXISTENTE = "33333333-3333-4333-8333-333333333333";
export const NEGOCIO = { id: "22222222-2222-4222-8222-222222222222" };
export { IMPORT_ID };

export const producto = (overrides: Record<string, unknown> = {}) => ({
  draftId: "p1",
  name: "Café",
  unitPrice: "3.50",
  priceStatus: "detected",
  sourceText: null,
  include: true,
  duplicateCandidate: null,
  ...overrides,
});

export const fila = (
  draft: unknown,
  overrides: Record<string, unknown> = {},
) => ({
  id: IMPORT_ID,
  businessId: NEGOCIO.id,
  status: "ready",
  draft,
  draftVersion: 1,
  acceptedSummary: null,
  ...overrides,
});

/** Los resultados que la transaccion consume: la fila del import, las categorias del
 * negocio, un id por cada categoria creada, y los dos await finales. */
export function cola(row: unknown, categoriasCreadas = 1): unknown[][] {
  const resultados: unknown[][] = [[row], [{ id: CAT_EXISTENTE }]];
  for (let i = 0; i < categoriasCreadas; i += 1) {
    resultados.push([{ id: `cat-nueva-${i}` }]);
  }
  resultados.push([], []);
  return resultados;
}
