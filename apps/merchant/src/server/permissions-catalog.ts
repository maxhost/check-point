/**
 * EL CATALOGO DE LOS SIETE PERMISOS, PURO — spec 0086 §1 / ADR 0079 §1.
 *
 * **Este archivo no tiene un solo `import`, y eso es deliberado** (misma forma y mismo motivo
 * que `server/business-status.ts` y `server/session-view.ts`). Los siete valores los necesitan
 * cuatro modulos que no se pueden importar entre si sin arrastrar runtime:
 *
 * - `schema/business.ts` — el `CHECK` de contencion de la migracion 0041;
 * - `api-permission.ts` — el paso 3 de la escalera, que importa better-auth;
 * - `staff-permissions.ts` — el validador del writer, que importa drizzle y `./db`;
 * - `session-view.ts` — la forma de `GET /api/merchant/session`, que **no importa nada** a
 *   proposito y seguiria sin importar nada si este archivo tampoco lo hace.
 *
 * Una copia del arreglo en cada uno seria cuatro fuentes de verdad para el conjunto que el
 * `CHECK` de la base declara CERRADO.
 */

/**
 * Los siete alcances por OBJETO (ADR 0079 §1, decision textual del owner:
 * *«queremos un toggle por cada objeto, no uno por cada CRUD de objeto»*).
 *
 * **Un permiso autoriza LEER, CREAR y EDITAR su objeto. No hay variantes por verbo** — no
 * existe `catalog.read` ni `catalog.write`, y la granularidad CRUD quedo **descartada**, no
 * diferida. Lo IRREVERSIBLE (cerrar el programa, archivar o terminar una campaña, borrar del
 * catalogo) no lo abre ningun permiso: esas rutas conservan `requireApiOwner`.
 *
 * **El orden de este arreglo es el orden en que salen normalizados** y el que ve la UI en
 * `GET /api/merchant/session`. Es alfabetico a proposito: `normalizePermissions` ordena, y
 * ordenar contra una lista que no esta ordenada da un resultado que depende de donde se agrego
 * el ultimo valor.
 */
export const PERMISSIONS = [
  "brand",
  "catalog",
  "counter",
  "locations",
  "loyalty",
  "marketing",
  "staff",
] as const;

export type PermissionScope = (typeof PERMISSIONS)[number];

/** El conjunto de los siete como `string[]` mutable, que es lo que devuelve la API para un
 * owner (§8 de la spec: la API **no expone la columna, expone la capacidad**). Se copia en
 * cada llamada: devolver el arreglo congelado dejaria que un consumidor lo mute. */
export function allPermissions(): string[] {
  return [...PERMISSIONS];
}

export function isPermission(value: unknown): value is PermissionScope {
  return (
    typeof value === "string" &&
    (PERMISSIONS as readonly string[]).includes(value)
  );
}

/**
 * Deduplica y ordena. **El `CHECK` de contencion de la base NO impide duplicados**
 * (`{catalog,catalog}` lo satisface), asi que la normalizacion es del writer y tiene su caso
 * de prueba; no se intenta expresarla como constraint.
 *
 * El orden es el de {@link PERMISSIONS}, no el alfabetico de `Array.prototype.sort`: son el
 * mismo hoy porque la lista esta escrita en orden, y si alguna vez dejan de serlo manda la
 * lista — el consumidor pinta toggles en el orden del catalogo, no del alfabeto.
 */
export function normalizePermissions(values: readonly string[]): string[] {
  const seen = new Set(values);
  return PERMISSIONS.filter((permission) => seen.has(permission));
}

/**
 * Lo que la API devuelve como `permissions` para una membresia.
 *
 * **Para `role === 'owner'` son los SIETE, aunque su fila los tenga en `'{}'`** (spec 0086 §8
 * y contrato §6). El owner puede todo por definicion y el `CHECK 2` de la migracion 0041
 * **depende** de que su columna quede vacia: la forma de la API y la forma de la fila no
 * tienen por que coincidir, y aca la diferencia es la que hace posible el invariante.
 */
export function permissionsForRole(
  role: string,
  stored: readonly string[] | null | undefined,
): string[] {
  if (role === "owner") return allPermissions();
  return normalizePermissions(stored ?? []);
}

/**
 * EL PASO 3 DE LA ESCALERA, PURO (spec 0086 §2).
 *
 * `role === 'owner'` pasa **sin mirar la columna**: es el ADR 0079 §4 («el owner ignora la
 * columna: es owner, tiene todo»), y es lo que permite que la fila del owner quede en `'{}'`.
 * Cualquier otro rol —hoy solo `staff`— necesita el alcance en su lista.
 *
 * Esta separado de `requireApiPermission` porque es la unica parte del guard que es una
 * DECISION y no plomeria: la mutacion M1 del presupuesto lo ataca aca.
 */
export function hasScope(
  role: string,
  permissions: readonly string[] | null | undefined,
  scope: PermissionScope,
): boolean {
  if (role === "owner") return true;
  return (permissions ?? []).includes(scope);
}
