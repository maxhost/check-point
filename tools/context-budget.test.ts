import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard del presupuesto de contexto permanente (spec 0066 / ADR 0069).
//
// `CLAUDE.md` se carga ENTERO en cada request. Llego a 696 lineas / 61 KB, que es el
// failure pattern que la doc oficial nombra: "if your CLAUDE.md is too long, Claude
// ignores half of it because important rules get lost in the noise". El owner puso el
// techo en 200 lineas.
//
// POR QUE ADEMAS DEL HOOK: `.claude/hooks/claude-md-size.sh` (Stop) corre solo en esta
// maquina y solo al cerrar un turno. Esto corre en `pnpm test`, o sea tambien en CI y
// para cualquiera que clone el repo. El hook avisa temprano; el test es el que no se
// puede olvidar.
//
// Y el segundo invariante, que es el que hace que la poda no sea una perdida: el techo
// se respeta MUDANDO reglas a destinos que se cargan on demand, no borrandolas. Si
// alguien "arregla" un rojo de aca borrando lineas, `tools/claude-md-coverage.sh` se
// pone rojo — son las dos mitades de la misma decision.

const root = join(import.meta.dirname, "..");
const LIMITE = 200;

// Cuenta IGUAL que `wc -l` y que el hook: sin el string vacio que deja el salto final.
// Medido: con `.split("\n").length` pelado, un archivo de 200 lineas da 201 y este test
// se pondria rojo con el hook en verde — dos guards de la misma regla discrepando en el
// borde es peor que uno solo.
const lineas = (p: string) => {
  const texto = readFileSync(join(root, p), "utf8");
  return texto.split("\n").length - (texto.endsWith("\n") ? 1 : 0);
};

describe("presupuesto de contexto permanente (spec 0066)", () => {
  it(`CLAUDE.md no pasa las ${LIMITE} lineas`, () => {
    expect(lineas("CLAUDE.md")).toBeLessThanOrEqual(LIMITE);
  });

  it("CLAUDE.md no importa LECCIONES.md con `@` (eso lo cargaria como si estuviera pegado)", () => {
    // El import `@path` de CLAUDE.md inlinea el archivo en cada request: importar
    // LECCIONES.md asi anularia la poda entera sin que nada se viera distinto.
    const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(claudeMd).not.toMatch(/@docs\/LECCIONES\.md/);
    expect(claudeMd).not.toMatch(/@\.claude\/skills\//);
  });

  it("los destinos de la mudanza existen", () => {
    // Si alguien los borra, el techo de arriba se cumple trivialmente y la poda pasa a
    // ser una perdida. El contenido lo verifica tools/claude-md-coverage.sh.
    expect(lineas("docs/LECCIONES.md")).toBeGreaterThan(100);
    expect(lineas(".claude/skills/gotchas-del-repo/SKILL.md")).toBeGreaterThan(
      100,
    );
    expect(
      lineas(".claude/skills/protocolo-de-verificacion/SKILL.md"),
    ).toBeGreaterThan(50);
  });
});
