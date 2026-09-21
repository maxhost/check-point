import { describe, expect, it } from "vitest";
import {
  CHECKLIST_ITEMS,
  type ChecklistItemDef,
  toChecklistView,
} from "./checklist";
import { ONBOARDING_TOURS } from "./tours";

/**
 * Spec 0085 (antes 0083 §D2) — `toChecklistView` y EL CATALOGO DE CINCO, sin Neon, sin sesion,
 * sin base.
 *
 * **El oraculo que sobrevivio al borrado del segundo eje es el del `sort`**, y necesita el
 * segundo parametro de `toChecklistView`: el catalogo real sale ya ordenado, asi que un `sort`
 * removido no se puede falsificar con el. Ahora vale MAS que con un item, porque en el catalogo
 * real hay cinco posiciones que ordenar.
 *
 * **Lo que este archivo NO asevera, declarado:** el TEXTO (`title`, `body`). Es copia y no es
 * contrato (ADR 0077 §3): un test que lo aseverara se rompe con cada ajuste de redaccion sin
 * que nada este mal.
 */

/** Una entrada sintetica. El `done` es constante porque estos casos miden el ORDEN y las
 * claves, no el hecho. */
const item = (position: number, required = true): ChecklistItemDef => ({
  position,
  required,
  anchor: `anchor-${position}`,
  title: `titulo ${position}`,
  body: `cuerpo ${position}`,
  done: () => false,
});

/** Los hechos con los cuatro tours PENDIENTES, que es como nace todo negocio. */
const sinTours = (emailVerified: boolean) => ({
  emailVerified,
  toursHechos: new Set<string>(),
});

describe("toChecklistView — el catalogo REAL de CINCO (spec 0085)", () => {
  it("son los cinco ids en el orden del ADR 0078 §1, con `position` 1..5", () => {
    const view = toChecklistView(sinTours(false));
    expect(view.locale).toBe("es");
    expect(view.items.map((i) => i.id)).toEqual([
      "verify-email",
      "staff",
      "catalog",
      "program",
      "brand",
    ]);
    expect(view.items.map((i) => i.position)).toEqual([1, 2, 3, 4, 5]);
  });

  /** ORACULO DE M4 — el owner dijo que `verify-email` sea EL UNICO obligatorio. Se asevera el
   * vector entero, no «el primero es true»: asi un tour que se volviera `required` aparece. */
  it("`verify-email` es el UNICO `required: true`", () => {
    expect(
      toChecklistView(sinTours(false)).items.map((i) => i.required),
    ).toEqual([true, false, false, false, false]);
  });

  /** Los ids de los tours SALEN de `ONBOARDING_TOURS` y su `anchor` es el mismo id: si esa
   * constante cambia, el catalogo cambia con ella y no hay segunda lista que desincronizar. */
  it("los cuatro items de tour son exactamente `ONBOARDING_TOURS`, y su `anchor` es su id", () => {
    const tours = toChecklistView(sinTours(false)).items.slice(1);
    expect(tours.map((i) => i.id)).toEqual([...ONBOARDING_TOURS]);
    expect(tours.map((i) => i.anchor)).toEqual([...ONBOARDING_TOURS]);
    expect(Object.keys(CHECKLIST_ITEMS)).toHaveLength(
      ONBOARDING_TOURS.length + 1,
    );
  });

  it("`done` del email sigue al hecho de la sesion en las dos polaridades", () => {
    expect(toChecklistView(sinTours(false)).items[0].done).toBe(false);
    expect(toChecklistView(sinTours(true)).items[0].done).toBe(true);
  });

  /** ORACULO DE M1 y M2 en la funcion pura: el `done` de un tour lee el conjunto —**sin mirar
   * `completed` ni `skipped`, que aca ya no existen**— y lo hace POR ITEM. `catalog` esta en el
   * conjunto y los otros tres no. */
  it("el `done` de cada tour sale de `toursHechos`, item por item", () => {
    const { items } = toChecklistView({
      emailVerified: false,
      toursHechos: new Set(["catalog"]),
    });
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ["verify-email", false],
      ["staff", false],
      ["catalog", true],
      ["program", false],
      ["brand", false],
    ]);
  });

  /** El CONJUNTO EXACTO de claves, y **el borrado del segundo eje se asevera aca**: la lista
   * es cerrada, asi que si volviera a emitirse este `toEqual` se pone rojo. */
  it("cada item sale con el conjunto EXACTO de claves del contrato, SIN el campo borrado", () => {
    for (const fila of toChecklistView(sinTours(true)).items) {
      expect(Object.keys(fila).sort()).toEqual([
        "anchor",
        "body",
        "done",
        "id",
        "position",
        "required",
        "title",
      ]);
      expect(typeof fila.done).toBe("boolean");
    }
  });
});

describe("toChecklistView — entradas SINTETICAS (spec 0083 §D2)", () => {
  /** ORACULO DEL `sort` (mutacion M5): las entradas llegan DESORDENADAS respecto de su
   * `position`. Sin el `sort`, `Object.entries` las devuelve en orden de declaracion y esto
   * queda 3-1-2. Es el unico caso que puede falsificarlo: el catalogo real ya sale ordenado. */
  it("ordena por `position` ascendente aunque lleguen desordenadas", () => {
    const { items } = toChecklistView(sinTours(false), {
      tercero: item(3),
      primero: item(1),
      segundo: item(2),
    });
    expect(items.map((i) => i.id)).toEqual(["primero", "segundo", "tercero"]);
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  /** `required` viaja por item y no se contagia entre items: uno `true` y otro `false` en la
   * MISMA vista. */
  it("`required` viaja por item, sin contagiarse", () => {
    const { items } = toChecklistView(sinTours(false), {
      a: item(1, true),
      b: item(2, false),
    });
    expect(items.map((i) => [i.id, i.required])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  /** `done` se resuelve POR ITEM con los mismos hechos: un item hecho y otro pendiente en la
   * misma respuesta. */
  it("resuelve el `done` de cada item por separado", () => {
    const { items } = toChecklistView(sinTours(true), {
      hecho: { ...item(1), done: (f) => f.emailVerified },
      pendiente: { ...item(2), done: (f) => !f.emailVerified },
    });
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ["hecho", true],
      ["pendiente", false],
    ]);
  });

  it("un catalogo vacio devuelve `items: []` con el locale puesto", () => {
    expect(toChecklistView(sinTours(true), {})).toEqual({
      locale: "es",
      items: [],
    });
  });
});
