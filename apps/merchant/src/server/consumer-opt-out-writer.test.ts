import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 0065, fase D — BARRIDO ESTÁTICO: `marketing_opt_out_at` tiene UN SOLO ESCRITOR en
 * producción, y es la acción del consumidor.
 *
 * POR QUÉ IMPORTA: la columna es el discriminante de un CONSENTIMIENTO. Si una ruta del
 * backoffice, el motor o el tick pudieran escribirla, «el consumidor apagó las promociones»
 * dejaría de significar eso — y sería falsificable justo por el actor del que hay que
 * defenderse (ADR 0060, la lección del `pending_plan`).
 *
 * ESTO ES UN PROXY, Y SE DICE CUÁL PARTE HACE EL TRABAJO. Lo que se busca es el
 * identificador dentro de un `.set({…})` o `.values({…})` —o sea una ESCRITURA de drizzle—
 * y el literal snake en SQL crudo. Lo que el proxy NO ve: un `sql.raw` armado por
 * concatenación, o un `update` escrito con el nombre de la columna en una variable. La
 * propiedad de comportamiento que sí tiene oráculo de verdad está en
 * `consumer-marketing-opt-out.neon.integration.test.ts`, que la escribe por la ruta y la lee
 * por SQL.
 *
 * LA ORTOGRAFÍA ES LA DEL CÓDIGO, no la del schema (la versión anterior de esta fila en la
 * spec era VACUA: buscaba `marketing_opt_out_at`, que el código que escribe nunca contiene —
 * drizzle mapea camelCase → snake sólo en `schema/consumer.ts`).
 */

const ROOT = join(import.meta.dirname, "..");
/** El único escritor permitido, relativo a `apps/merchant/src`. */
const WRITER = join("server", "consumer", "marketing-opt-out.ts");
/** El schema DECLARA la columna (y la migración la crea); no la escribe. */
const SCHEMA = join("server", "schema", "consumer.ts");

/** Todo el árbol de producción: los tests y sus supports quedan afuera, y eso se declara —
 * los seeds de integración escriben la marca por SQL a propósito, para construir estados que
 * la fase A no podía producir de otro modo. */
function productionFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      productionFiles(full, found);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    if (/-support\.ts$/.test(entry.name)) continue;
    found.push(relative(ROOT, full));
  }
  return found;
}

/** Una escritura de drizzle: el identificador DENTRO del objeto de un `.set(` o `.values(`.
 * La ventana está acotada para que no cruce funciones enteras. */
const WRITE = /\.(set|values)\(\s*\{[\s\S]{0,400}?marketingOptOutAt/;
/** En SQL crudo la ortografía es la otra, y una escritura es una asignación. */
const RAW_WRITE = /marketing_opt_out_at\s*=/;

describe("quién escribe `marketing_opt_out_at` (spec 0065, fase D)", () => {
  const files = productionFiles(ROOT);

  it("el barrido mira el árbol entero, no tres archivos", () => {
    // PISO: un barrido que se quedó sin archivos —un `readdirSync` sobre la carpeta
    // equivocada— pasaría en verde diciendo «nadie más lo escribe».
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(WRITER);
    expect(files).toContain(SCHEMA);
  });

  it("sólo `consumer/marketing-opt-out.ts` la escribe", () => {
    const writers = files.filter((file) =>
      WRITE.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(writers).toEqual([WRITER]);
  });

  it("nadie la asigna por SQL crudo", () => {
    const rawWriters = files.filter(
      (file) =>
        file !== SCHEMA &&
        RAW_WRITE.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(rawWriters).toEqual([]);
  });

  it("el barrido corre sobre `apps/merchant/src`, y la raíz se asevera", () => {
    // Sin esto, mover el archivo de test cambiaría la raíz en silencio y el barrido
    // miraría otra cosa (o nada).
    expect(ROOT.endsWith(join("apps", "merchant", "src"))).toBe(true);
    expect(files.some((file) => file.startsWith(`app${sep}`))).toBe(true);
  });
});
