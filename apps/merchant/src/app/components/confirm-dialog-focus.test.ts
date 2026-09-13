import { afterEach, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-expect-error — build interno de Next, sin tipos. Cero paquetes nuevos: ver el docblock.
import { parse } from "next/dist/compiled/node-html-parser";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * LA TRAMPA DE FOCO DE `ConfirmDialog`, PINNEADA — y este archivo nace de un LÍMITE FALSO.
 * El docblock del componente declaraba que su selector «no lo pinnea ningún test» porque
 * exigiría «un DOM real (jsdom no está instalado y `environment: "node"`)». Es el patrón de
 * `CLAUDE.md` —un límite declarado sin intentarlo— y era falso: **`node-html-parser` viene
 * BUNDLEADO en `next`**, con `querySelectorAll` y motor CSS. Cero paquetes nuevos.
 *
 * No es un proxy sobre el string del selector: se renderiza el markup REAL, se le pasa al
 * `onKeyDown` REAL del elemento un `ref` cuyo `querySelectorAll` consulta ese markup, y se
 * mira A QUIÉN enfoca. El mock de `react` sólo neutraliza los tres hooks que no corren fuera
 * de un renderer (`useId`, `useRef`, `useEffect`); la lógica del Tab es la del componente.
 *
 * LOS TRES CASOS SON EL ORÁCULO, Y EL TERCERO EXISTE PORQUE LA PRIMERA VERSIÓN ERA
 * TAUTOLÓGICA: stubeaba `document.activeElement` como `seen.at(-1)`, o sea el último por
 * construcción, así que borrar la comparación `activeElement === last` dejaba 32/32 en verde
 * —y con esa mutación puesta NINGÚN Tab hacia adelante funciona dentro del modal—. Por eso
 * `tabDesde()` toma QUIÉN está enfocado en vez de asumirlo.
 *
 * Qué queda pinneado, y cada línea tiene su mutación que la pone roja:
 *  - el CONJUNTO focusable: `[href]` entra (el link de la `description`) y el «Confirmar»
 *    deshabilitado NO (`button:not([disabled])`);
 *  - hacia ADELANTE el ciclo cierra SÓLO desde el último;
 *  - hacia ATRÁS (shift+Tab) cierra SÓLO desde el primero;
 *  - y que la trampa SÓLO actúa con Tab: otra tecla no llega ni a consultar el DOM.
 * Lo que este test NO mira: el `useEffect` (foco inicial, y el Escape que cierra el modal),
 * que está mockeado acá — es el handler de `document`, no este `onKeyDown`.
 */
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useId: () => "id",
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

type Focusable = {
  tagName: string;
  text: string;
  focus: ReturnType<typeof vi.fn>;
};

const props = {
  open: true,
  title: "Bajar a Free",
  description: h(
    "span",
    null,
    "Archivá ",
    h("a", { href: "/backoffice/locations" }, "tus locales"),
  ),
  confirmLabel: "Confirmar",
  confirmDisabled: true,
  onCancel: () => {},
  onConfirm: () => {},
};

/** Dispara `key` con FOCO EN `activo`, y devuelve qué vio el selector y a quién enfocó. */
function tabDesde(
  activo: "primero" | "ultimo",
  shiftKey: boolean,
  key = "Tab",
) {
  const root = parse(renderToStaticMarkup(h(ConfirmDialog, props)));
  const seen: Focusable[] = [];
  const section = (
    ConfirmDialog(props) as {
      props: { children: { props: Record<string, unknown> } };
    }
  ).props.children;
  (section.props.ref as { current: unknown }).current = {
    querySelectorAll: (selector: string) => {
      const nodes = root.querySelectorAll(selector) as Focusable[];
      for (const node of nodes) node.focus = vi.fn();
      seen.splice(0, seen.length, ...nodes);
      return nodes;
    },
  };
  vi.stubGlobal("document", {
    get activeElement() {
      return activo === "primero" ? seen[0] : seen.at(-1);
    },
  });
  const preventDefault = vi.fn();
  (section.props.onKeyDown as (event: unknown) => void)({
    key,
    shiftKey,
    preventDefault,
  });
  const etiquetas = seen.map((node) => `${node.tagName}:${node.text.trim()}`);
  return { etiquetas, seen, preventDefault };
}

it("el conjunto focusable: el link ENTRA y el «Confirmar» deshabilitado NO", () => {
  const { etiquetas } = tabDesde("ultimo", false);
  // El conjunto EXACTO y EN ORDEN. Mutación que lo mide: el selector pasa a
  // `"button, input, select, textarea"` ⇒ ROJO (entra `BUTTON:Confirmar`, se va el link).
  expect(etiquetas).toEqual(["A:tus locales", "BUTTON:Cancelar"]);
});

it("hacia adelante el ciclo cierra SÓLO desde el último focusable", () => {
  const desdeUltimo = tabDesde("ultimo", false);
  expect(desdeUltimo.seen[0].focus).toHaveBeenCalledTimes(1);
  expect(desdeUltimo.preventDefault).toHaveBeenCalledTimes(1);

  // Y desde el PRIMERO el Tab no se toca: lo maneja el navegador. Esta mitad es la que
  // vuelve no-tautológico al test — sin ella, borrar `activeElement === last` queda verde.
  const desdePrimero = tabDesde("primero", false);
  expect(desdePrimero.seen[0].focus).not.toHaveBeenCalled();
  expect(desdePrimero.preventDefault).not.toHaveBeenCalled();
});

it("hacia atrás (shift+Tab) el ciclo cierra SÓLO desde el primero", () => {
  const desdePrimero = tabDesde("primero", true);
  expect(desdePrimero.seen.at(-1)?.focus).toHaveBeenCalledTimes(1);
  expect(desdePrimero.preventDefault).toHaveBeenCalledTimes(1);

  const desdeUltimo = tabDesde("ultimo", true);
  expect(desdeUltimo.seen.at(-1)?.focus).not.toHaveBeenCalled();
  expect(desdeUltimo.preventDefault).not.toHaveBeenCalled();
});

it("una tecla que no es Tab no la toca la trampa: ni consulta el DOM", () => {
  // El guard `event.key !== "Tab"` no tenía oráculo NI declaración: borrarlo dejaba 32/32 en
  // verde (S3 de un revisor). Se asevera lo más fuerte que se puede: con otra tecla el
  // handler sale ANTES del `querySelectorAll`, así que `seen` queda vacío.
  const { seen, preventDefault } = tabDesde("ultimo", false, "Escape");
  expect(seen).toEqual([]);
  expect(preventDefault).not.toHaveBeenCalled();
});
