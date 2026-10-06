import { describe, expect, it } from "vitest";
import { classCategories, utilityOf } from "./ui-guard-counts.ts";
import { countFile } from "./ui-guard.ts";

/** Spec 0164: un caso por categoria (cuenta 1) y su par permitido (cuenta 0). */
const SCREEN = "apps/merchant/src/app/backoffice/x/screen.tsx";
const n = (text: string, category: string, path = SCREEN) =>
  (countFile(path, text) as Record<string, number[] | undefined>)[category]
    ?.length ?? 0;
const tsx = (body: string) => `export const X = () => (${body});`;

describe("ui-guard: TSX", () => {
  it("native-element: <button> cuenta, <div> no", () => {
    expect(n(tsx("<button>a</button>"), "native-element")).toBe(1);
    expect(n(tsx("<div>a</div>"), "native-element")).toBe(0);
    expect(n(tsx("<Button>a</Button>"), "native-element")).toBe(0);
  });

  it("native-handler: onClick en un nativo cuenta, en un componente no", () => {
    expect(n(tsx("<div onClick={f} />"), "native-handler")).toBe(1);
    expect(n(tsx("<Button onPress={f} />"), "native-handler")).toBe(0);
  });

  it("native-style: solo custom properties pasa", () => {
    expect(n(tsx('<div style={{ color: "red" }} />'), "native-style")).toBe(1);
    expect(n(tsx('<div style={{ "--x": 1 }} />'), "native-style")).toBe(0);
  });

  it("dangerous-html y native-spread", () => {
    expect(
      n(tsx("<div dangerouslySetInnerHTML={h} />"), "dangerous-html"),
    ).toBe(1);
    expect(n(tsx("<div {...props} />"), "native-spread")).toBe(1);
    expect(n(tsx("<Card {...props} />"), "native-spread")).toBe(0);
  });

  it("create-element: React.createElement/jsx cuenta, document.createElement no", () => {
    expect(n('React.createElement("button");', "create-element")).toBe(1);
    expect(n('jsx("button", {});', "create-element")).toBe(1);
    expect(n('document.createElement("canvas");', "create-element")).toBe(0);
  });

  it("tag-variable: const Tag = 'button' o un ?: de tags; una constante de texto no", () => {
    expect(n('const Tag = "button";', "tag-variable")).toBe(1);
    expect(n('const Tag = big ? "h2" : "h3";', "tag-variable")).toBe(1);
    expect(n('const LABEL = "Guardar";', "tag-variable")).toBe(0);
    expect(n('const tag = "button";', "tag-variable")).toBe(0);
  });

  it("restricted-import: React Aria y next/link fuera del kit; el kit no", () => {
    expect(
      n('import { Button } from "react-aria-components";', "restricted-import"),
    ).toBe(1);
    expect(n('import Link from "next/link";', "restricted-import")).toBe(1);
    expect(n('import { Button } from "@/ui";', "restricted-import")).toBe(0);
  });

  it("css-import: en app/** cuenta; la fuente del import no es una clase", () => {
    expect(n('import "./x.css";', "css-import")).toBe(1);
    expect(n('import "./text-sm.css";', "type-scale")).toBe(0);
  });

  it("clases en cualquier literal o template, no solo className", () => {
    expect(n('const c = "p-4 text-sm";', "type-scale")).toBe(1);
    expect(n("const c = `p-4 ${a} bg-white`;", "raw-palette")).toBe(1);
    expect(n(tsx('<div className="font-bold" />'), "type-scale")).toBe(1);
  });

  it("// eslint-disable no apaga ninguna categoria (noInlineConfig)", () => {
    const text = `/* eslint-disable */\n// eslint-disable-next-line\nexport const X = () => <button onClick={f}>a</button>;`;
    expect(n(text, "native-element")).toBe(1);
    expect(n(text, "native-handler")).toBe(1);
  });

  it("un .ts con genericos parsea sin JSX", () => {
    expect(
      n(
        "export const f = <T,>(x: T) => x as T;",
        "native-element",
        SCREEN.replace(".tsx", ".ts"),
      ),
    ).toBe(0);
  });

  it("un archivo que no parsea es un error, no se saltea", () => {
    expect(() => countFile(SCREEN, "export const = ;")).toThrow(/screen\.tsx/);
  });

  it("templates/** y poster-preview.tsx: exentos de color y estilo, no de controles", () => {
    const path = "apps/merchant/src/app/backoffice/brand/kit/templates/a.tsx";
    const body = tsx(
      '<button style={{ color: "red" }} className="bg-white text-sm" />',
    );
    expect(n(body, "native-style", path)).toBe(0);
    expect(n(body, "raw-palette", path)).toBe(0);
    expect(n(body, "type-scale", path)).toBe(0);
    expect(n(body, "native-element", path)).toBe(1);
    expect(
      n(body, "native-style", "apps/merchant/src/app/x/poster-preview.tsx"),
    ).toBe(0);
  });
});

describe("ui-guard: tokens de clase", () => {
  it("utilityOf saca variantes con corchetes y el ! o - inicial", () => {
    expect(utilityOf("md:hover:bg-white")).toBe("bg-white");
    expect(utilityOf("data-[focus-visible]:outline-2")).toBe("outline-2");
    expect(utilityOf("!-mt-2")).toBe("mt-2");
  });

  it("arbitrary-value: tamaño/color arbitrario si; custom property, variante y selector de tour no", () => {
    expect(classCategories("w-[13px]")).toContain("arbitrary-value");
    expect(classCategories("bg-[#fff]")).toContain("arbitrary-value");
    expect(classCategories("[mask-type:luminance]")).toContain(
      "arbitrary-value",
    );
    expect(classCategories("max-w-[var(--content-form)]")).toEqual([]);
    expect(classCategories("w-(--field)")).toEqual([]);
    expect(classCategories("data-[x]:flex")).toEqual([]);
    expect(classCategories('[data-tour="staff-add"]')).toEqual([]);
  });

  it("raw-palette y type-scale: los roles de tokens no cuentan", () => {
    expect(classCategories("text-slate-500")).toEqual(["raw-palette"]);
    expect(classCategories("border-t-black/10")).toEqual(["raw-palette"]);
    expect(
      classCategories("text-content text-content-muted bg-surface"),
    ).toEqual([]);
    expect(classCategories("leading-6 font-semibold text-2xl")).toEqual([
      "type-scale",
      "type-scale",
      "type-scale",
    ]);
  });
});

describe("ui-guard: CSS", () => {
  const GLOBALS = "apps/merchant/src/app/globals.css";
  it("css-file: un .css fuera de la lista cerrada cuenta; globals no", () => {
    expect(n("a{}", "css-file", "apps/merchant/src/app/x/tour.css")).toBe(1);
    expect(n("a{}", "css-file", "apps/merchant/src/app/x/a.module.css")).toBe(
      1,
    );
    expect(n("a{}", "css-file", GLOBALS)).toBe(0);
  });

  it("css-selector, css-at-rule y css-kit-selector", () => {
    expect(n("a, b .c {} d {}", "css-selector", GLOBALS)).toBe(3);
    expect(n("@layer x { a { @apply p-2; } }", "css-at-rule", GLOBALS)).toBe(2);
    expect(n(".cp-x, [data-rac] a, .ok {}", "css-kit-selector", GLOBALS)).toBe(
      2,
    );
  });

  it("css-color: hex, funciones y nombres; @media print y transparent no", () => {
    expect(
      n(
        "a { color: #fff; background: rgb(0 0 0); border-color: red; }",
        "css-color",
        GLOBALS,
      ),
    ).toBe(3);
    expect(n("@media print { a { color: red } }", "css-color", GLOBALS)).toBe(
      0,
    );
    expect(
      n(
        "a { color: transparent; border-color: currentcolor; grid-area: redbox; }",
        "css-color",
        GLOBALS,
      ),
    ).toBe(0);
  });
});
