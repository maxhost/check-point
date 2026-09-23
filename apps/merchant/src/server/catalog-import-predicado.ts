import { Column, getTableColumns } from "drizzle-orm";

/**
 * EL EVALUADOR DE PREDICADOS DE LOS DOBLES DE `./db` (spec 0090, hallazgo H2 de la revision).
 *
 * **Por que existe.** Los dobles de `./db` encadenaban `where()` devolviendo la misma cadena
 * y **descartaban el predicado**: una prueba titulada «un import de OTRO negocio devuelve
 * 404» medía en realidad «si la base no devuelve filas, tiramos 404», que es cierto **con y
 * sin** el filtro por negocio. Un doble que ignora el `where` es una afirmacion falsa sobre
 * lo que la base puede devolver.
 *
 * Con esto, el doble **evalua** el predicado contra las filas que el test sembro, asi que
 * borrar un `eq(businessId)` del codigo deja de ser invisible.
 *
 * **Que NO hace**, y por eso los casos que dependen de esto van igual a la suite de Neon:
 * no ordena, no agrupa, no une tablas y no entiende `or` (tira, en vez de mentir). Lo que
 * mide es **que el predicado existe y discrimina**, no que Postgres lo ejecute igual.
 */
export type Condicion = { clave: string; op: string; valores: unknown[] };

const esTexto = (c: unknown): c is { value: string[] } =>
  !!c &&
  typeof c === "object" &&
  Array.isArray((c as { value?: unknown }).value);

const esParam = (c: unknown): c is { value: unknown } =>
  !!c && typeof c === "object" && "encoder" in (c as Record<string, unknown>);

const esListaDeParams = (c: unknown): c is { value: unknown }[] =>
  Array.isArray(c) && c.length > 0 && c.every(esParam);

const chunksDe = (c: unknown): unknown[] | null => {
  const chunks = (c as { queryChunks?: unknown })?.queryChunks;
  return Array.isArray(chunks) ? chunks : null;
};

function claveDe(columna: Column): string {
  const tabla = (
    columna as unknown as { table: Parameters<typeof getTableColumns>[0] }
  ).table;
  for (const [clave, valor] of Object.entries(getTableColumns(tabla))) {
    if (valor === columna) return clave;
  }
  return columna.name;
}

/** Las comparaciones `columna op valor` que hay en la condicion, a cualquier profundidad. */
export function condicionesDe(condition: unknown): Condicion[] {
  const out: Condicion[] = [];
  recorrer(condition, out);
  return out;
}

function recorrer(nodo: unknown, out: Condicion[]): void {
  const chunks = chunksDe(nodo);
  if (!chunks) return;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (esTexto(chunk)) {
      if (chunk.value.join("").includes(" or ")) {
        throw new Error("predicado_no_soportado: or");
      }
      continue;
    }
    if (!(chunk instanceof Column)) {
      recorrer(chunk, out);
      continue;
    }
    const siguiente = chunks[i + 1];
    const op = (esTexto(siguiente) ? siguiente.value.join("") : "").trim();
    // `inArray` mete los `Param` en un ARRAY anidado, no como hermanos sueltos.
    const valores: unknown[] = [];
    let j = i + 2;
    while (esParam(chunks[j]) || esListaDeParams(chunks[j])) {
      const actual = chunks[j];
      if (esParam(actual)) valores.push(actual.value);
      else
        for (const p of actual as { value: unknown }[]) valores.push(p.value);
      j += 1;
    }
    if (valores.length === 0 && op !== "is null" && op !== "is not null") {
      throw new Error(`predicado_no_soportado: ${claveDe(chunk)} ${op}`);
    }
    out.push({ clave: claveDe(chunk), op, valores });
    i = j - 1;
  }
}

const normalizar = (valor: unknown): unknown =>
  valor instanceof Date ? valor.toISOString() : valor;

/**
 * **Una clave que la fila del doble no trae NO restringe.** Las filas de estos dobles son
 * parciales a proposito (`{ total: 0 }`, `{ id: "cat-1" }`); la fila que quiera ser
 * distinguida por una columna tiene que traerla.
 */
export function cumple(fila: unknown, condiciones: Condicion[]): boolean {
  if (!fila || typeof fila !== "object") return true;
  const registro = fila as Record<string, unknown>;
  for (const { clave, op, valores } of condiciones) {
    if (!(clave in registro)) continue;
    const actual = normalizar(registro[clave]) as never;
    const valor = normalizar(valores[0]) as never;
    if (op === "is null") {
      if (actual !== null && actual !== undefined) return false;
    } else if (op === "is not null") {
      if (actual === null || actual === undefined) return false;
    } else if (op === "in") {
      if (!valores.map(normalizar).includes(actual)) return false;
    } else if (op === "=") {
      if (actual !== valor) return false;
    } else if (op === "<>") {
      if (actual === valor) return false;
    } else if (op === "<=") {
      if (!(actual <= valor)) return false;
    } else if (op === "<") {
      if (!(actual < valor)) return false;
    } else if (op === ">=") {
      if (!(actual >= valor)) return false;
    } else if (op === ">") {
      if (!(actual > valor)) return false;
    } else {
      throw new Error(`operador_no_soportado: ${op}`);
    }
  }
  return true;
}

/** Lo que un `SELECT` con ese `where` devolveria de las filas sembradas. */
export function filtrar(filas: unknown[], condition: unknown): unknown[] {
  const condiciones = condicionesDe(condition);
  return filas.filter((fila) => cumple(fila, condiciones));
}

export type EstadoDelDoble = {
  /** Cola de resultados, en el orden en que el codigo los va a consumir. */
  filas: unknown[][];
  sets: Record<string, unknown>[];
};

/**
 * La cadena de drizzle doblada que **si evalua el `where`** de los `SELECT`.
 *
 * El `RETURNING` de un `UPDATE`/`INSERT` **no** se filtra, y eso no es una omision: en
 * Postgres el `WHERE` mira la fila VIEJA y el `RETURNING` devuelve la NUEVA, asi que
 * `UPDATE … WHERE status='pending_upload' … RETURNING *` devuelve una fila con
 * `status='queued'`. Filtrarla seria describir una base que no existe.
 */
export function cadenaHonesta(estado: EstadoDelDoble): Record<string, unknown> {
  const cadena: Record<string, unknown> = {};
  let condicion: unknown = null;
  let seleccion = false;
  for (const metodo of [
    "from",
    "for",
    "limit",
    "orderBy",
    "values",
    "onConflictDoNothing",
    "returning",
  ]) {
    cadena[metodo] = () => cadena;
  }
  cadena.select = () => {
    seleccion = true;
    return cadena;
  };
  for (const metodo of ["insert", "update", "delete"]) {
    cadena[metodo] = () => {
      seleccion = false;
      return cadena;
    };
  }
  cadena.where = (cond: unknown) => {
    condicion = cond;
    return cadena;
  };
  cadena.set = (valor: Record<string, unknown>) => {
    estado.sets.push(valor);
    return cadena;
  };
  cadena.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => {
    const filas = estado.filas.shift() ?? [];
    const resultado = seleccion ? filtrar(filas, condicion) : filas;
    return Promise.resolve(resultado).then(resolve, reject);
  };
  return cadena;
}

/** El modulo `./db` doblado, con el predicado evaluado. */
export function dbDobleHonesto(estado: EstadoDelDoble) {
  return {
    getDb: () => cadenaHonesta(estado),
    withDbTransaction: async () => undefined,
  };
}
