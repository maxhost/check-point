import { describe, expect, it } from "vitest";
import {
  CHECKLIST_ITEMS,
  type ChecklistItemDef,
  toChecklistView,
} from "./checklist";

/**
 * Spec 0083 §D2 — `toChecklistView`, LA FUNCION PURA. Sin Neon, sin sesion, sin base.
 *
 * **Dos de los oraculos de esta spec solo existen ACA**, y los dos necesitan el segundo
 * parametro de `toChecklistView` porque el catalogo real —de UN item— no puede producirlos:
 *
 * - **la independencia de `required` y `blocking`** (mutacion M5): con un item los dos valen
 *   `true`, asi que `blocking: def.required` pasaria en verde contra el catalogo real;
 * - **el `sort` por `position`**: con un item no hay orden que falsificar.
 *
 * **Lo que este archivo NO asevera, declarado:** el TEXTO (`title`, `body`). Es copia y no es
 * contrato (ADR 0077 §3): un test que lo aseverara se rompe con cada ajuste de redaccion sin
 * que nada este mal.
 */

/** Una entrada sintetica con los dos ejes elegibles por separado. El `done` es constante
 * porque estos casos miden los ejes, no el hecho. */
const item = (
  position: number,
  required: boolean,
  blocking: boolean,
): ChecklistItemDef => ({
  position,
  required,
  blocking,
  anchor: `anchor-${position}`,
  title: `titulo ${position}`,
  body: `cuerpo ${position}`,
  done: () => false,
});

describe("toChecklistView — el catalogo REAL (spec 0083 §D1)", () => {
  it("el unico item es `verify-email`, con `position: 1` y los DOS ejes en `true`", () => {
    const view = toChecklistView({ emailVerified: false });
    expect(view.locale).toBe("es");
    expect(view.items).toHaveLength(1);
    const [first] = view.items;
    expect(first.id).toBe("verify-email");
    expect(first.position).toBe(1);
    expect(first.required).toBe(true);
    expect(first.blocking).toBe(true);
    expect(first.anchor).toBe("verify-email");
  });

  /** ORACULO DE LAS MUTACIONES M3 y M4: `done` LEE EL HECHO, no devuelve una constante. Las
   * dos polaridades juntas son las que lo prueban — una sola la pasaria cualquier constante. */
  it("`done` sigue al hecho de la sesion en las dos polaridades", () => {
    expect(toChecklistView({ emailVerified: false }).items[0].done).toBe(false);
    expect(toChecklistView({ emailVerified: true }).items[0].done).toBe(true);
  });

  /** El CONJUNTO EXACTO de claves: la vista no filtra el `done` como funcion ni arrastra
   * nada del `def` que la UI no declara contrato. */
  it("cada item sale con el conjunto EXACTO de claves del contrato", () => {
    const [first] = toChecklistView({ emailVerified: true }).items;
    expect(Object.keys(first).sort()).toEqual([
      "anchor",
      "blocking",
      "body",
      "done",
      "id",
      "position",
      "required",
      "title",
    ]);
    expect(typeof first.done).toBe("boolean");
  });

  it("el catalogo real declara `verify-email` y nada mas", () => {
    expect(Object.keys(CHECKLIST_ITEMS)).toEqual(["verify-email"]);
  });
});

describe("toChecklistView — entradas SINTETICAS (spec 0083 §D2)", () => {
  /**
   * ORACULO DE M5 — **`blocking` NO es un alias de `required`**, y es el unico
   * caso del repo que puede falsificarlo: el catalogo real tiene los dos en `true`.
   *
   * Los dos espejos van juntos a proposito: `blocking: def.required` sobrevive al primero si
   * se mira solo `required`, y `blocking: !def.required` sobrevive al segundo. Con los dos,
   * ninguna derivacion de uno a partir del otro pasa.
   */
  it("`{ required: true, blocking: false }` viaja EXACTAMENTE asi", () => {
    const [only] = toChecklistView(
      { emailVerified: false },
      { "solo-obligatorio": item(1, true, false) },
    ).items;
    expect(only.required).toBe(true);
    expect(only.blocking).toBe(false);
  });

  it("y el espejo `{ required: false, blocking: true }`, tambien", () => {
    const [only] = toChecklistView(
      { emailVerified: false },
      { "solo-bloqueante": item(1, false, true) },
    ).items;
    expect(only.required).toBe(false);
    expect(only.blocking).toBe(true);
  });

  /** Los dos ejes en la MISMA vista, con valores cruzados: un solo item por llamada no
   * distingue «lo copio del otro campo» de «lo copio del otro ITEM». */
  it("dos items con los ejes cruzados conservan cada par", () => {
    const { items } = toChecklistView(
      { emailVerified: false },
      {
        a: item(1, true, false),
        b: item(2, false, true),
      },
    );
    expect(items.map((i) => [i.id, i.required, i.blocking])).toEqual([
      ["a", true, false],
      ["b", false, true],
    ]);
  });

  /** ORACULO DEL `sort`: las entradas llegan DESORDENADAS respecto de su `position`. Sin el
   * `sort`, `Object.entries` las devuelve en orden de declaracion y esto queda 3-1-2. */
  it("ordena por `position` ascendente aunque lleguen desordenadas", () => {
    const { items } = toChecklistView(
      { emailVerified: false },
      {
        tercero: item(3, true, true),
        primero: item(1, true, true),
        segundo: item(2, true, true),
      },
    );
    expect(items.map((i) => i.id)).toEqual(["primero", "segundo", "tercero"]);
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  /** `done` se resuelve POR ITEM con los mismos hechos: un item hecho y otro pendiente en la
   * misma respuesta. */
  it("resuelve el `done` de cada item por separado", () => {
    const { items } = toChecklistView(
      { emailVerified: true },
      {
        hecho: { ...item(1, true, true), done: (f) => f.emailVerified },
        pendiente: { ...item(2, true, true), done: (f) => !f.emailVerified },
      },
    );
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ["hecho", true],
      ["pendiente", false],
    ]);
  });

  it("un catalogo vacio devuelve `items: []` con el locale puesto", () => {
    expect(toChecklistView({ emailVerified: true }, {})).toEqual({
      locale: "es",
      items: [],
    });
  });
});
