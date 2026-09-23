import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PosterPreview } from "./poster-preview";
import { TEMPLATES } from "./templates/types";

describe("afiches sin logo", () => {
  it.each(TEMPLATES)("$label conserva el nombre del negocio", ({ id }) => {
    const html = renderToStaticMarkup(
      createElement(PosterPreview, {
        templateId: id,
        businessName: "Cafe Milca",
        logoPath: null,
        colors: {
          primary: "#176548",
          complementary: "#2D8B68",
          accent: "#E78132",
        },
        qrSvg: '<svg xmlns="http://www.w3.org/2000/svg" />',
        qrStyle: "black",
        label: "Tu café de siempre",
        headline: "Sumá en cada visita",
        subheadline: "Escaneá para empezar",
      }),
    );

    expect(html).toContain("Cafe Milca");
  });
});
