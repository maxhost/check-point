/**
 * `node tools/check-numbers.ts` — numeros de spec/ADR duplicados (spec 0135 / ADR 0114).
 *
 * Claude y GPT escriben specs en paralelo sobre `main`; el 2026-10-02 los dos escribieron
 * 0121-0123. Lo corre `.githooks/pre-push` antes de `pnpm verify`: sale 1 listando los
 * duplicados con sus archivos.
 *
 * Que cuenta: `NNNN-<algo>.md` en `docs/specs/` y en `docs/adr/` (cada carpeta por separado:
 * la spec 0114 y el ADR 0114 son cosas distintas). NO cuenta `TEMPLATE*.md`, lo que no es
 * `.md` (los `.txt` de la 0116) ni los ANEXOS `NNNN-contratos-*.md`, que por convencion llevan
 * el numero de su spec (`0067-contratos-de-api.md`, `0055-contratos-del-orquestador.md`).
 *
 * Autocontenido a proposito (Node 24 corre `.ts` quitando los tipos), igual que `tools/verify.ts`.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** El numero que `name` reclama, o `null` si no reclama ninguno (template, anexo, no-`.md`). */
export function claimedNumber(name: string): string | null {
  const match = /^(\d{4})-(.+)\.md$/.exec(name);
  if (!match) return null;
  if (match[2].startsWith("contratos-")) return null;
  return match[1];
}

/** PURO: los numeros que reclama mas de un archivo de `names`, ordenados. */
export function duplicateNumbers(names: string[]): string[] {
  const seen = new Map<string, number>();
  for (const name of names) {
    const number = claimedNumber(name);
    if (number === null) continue;
    seen.set(number, (seen.get(number) ?? 0) + 1);
  }
  return [...seen]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort();
}

/**
 * Duplicados historicos aceptados, con sus archivos EXACTOS (si un tercero reclama el mismo numero,
 * vuelve a fallar). Vacio: el unico que habia (0112) se renumero a 0136 el 2026-10-02.
 */
const KNOWN: Record<string, string[]> = {};

const ROOT = join(import.meta.dirname, "..");

function main(): number {
  let failed = false;
  for (const dir of ["docs/specs", "docs/adr"]) {
    const names = readdirSync(join(ROOT, dir));
    for (const number of duplicateNumbers(names)) {
      const files = names.filter((n) => claimedNumber(n) === number).sort();
      const known = KNOWN[`${dir}/${number}`];
      if (known && known.join("\n") === files.join("\n")) continue;
      failed = true;
      console.error(`numero duplicado en ${dir}: ${number}`);
      for (const f of files) console.error(`  ${dir}/${f}`);
    }
  }
  if (failed) {
    console.error(
      "\nRenumera la tuya (la que no esta en origin/main) y su fila del INDEX antes de pushear.",
    );
    return 1;
  }
  console.log(
    "check-numbers: sin numeros duplicados en docs/specs ni docs/adr",
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
