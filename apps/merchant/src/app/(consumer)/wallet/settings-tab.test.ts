import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";
import { BottomNav } from "./bottom-nav";
import { SettingsTab } from "./settings-tab";

/**
 * Spec 0065 fase D / ADR 0068 — LA PESTAÑA «Configuración», en sus dos mitades y sin
 * paquetes nuevos: el RENDER con `renderToStaticMarkup` y la INTERACCIÓN invocando el
 * `onChange` real del elemento.
 *
 * Acá está el RENDER, con React de verdad. La INTERACCIÓN vive en
 * `settings-tab-switch.test.ts`, que mockea `useState` y por eso no puede compartir archivo
 * con un `renderToStaticMarkup` real. NO se declara como límite: intentarla cuesta veinte
 * líneas (la lección de la spec 0057 — «antes de escribir que algo no se puede testear,
 * intentá testearlo»).
 */

const program = (over: Partial<ConsumerProgramSummary> = {}) =>
  ({
    membershipId: `m-${over.programId ?? "1"}`,
    programId: "11111111-1111-1111-1111-111111111111",
    businessName: "Café Uno",
    marketingOptOut: false,
    ...over,
  }) as ConsumerProgramSummary;

describe("la pestaña de Configuración — render", () => {
  it("una fila por membresía, encendida por defecto y apagada si hay opt-out", () => {
    const html = renderToStaticMarkup(
      h(SettingsTab, {
        programs: [
          program(),
          program({
            programId: "22222222-2222-2222-2222-222222222222",
            businessName: "Bar Dos",
            marketingOptOut: true,
          }),
        ],
      }),
    );
    expect(html).toContain("Promociones de Café Uno");
    expect(html).toContain("Promociones de Bar Dos");
    // Encendido por defecto: escanear ya es consentimiento (ADR 0033 §2), así que lo que
    // se persiste es el apagado. Se cuenta: un solo `checked` entre los dos switches.
    expect(html.match(/checked=""/g) ?? []).toHaveLength(1);
    expect(html).toContain(
      "Los avisos de tus puntos y sellos, y tu saldo en el pase, siguen igual.",
    );
  });

  it("sin membresías no muestra ningún interruptor ni el texto de promociones", () => {
    const html = renderToStaticMarkup(h(SettingsTab, { programs: [] }));
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Promociones de");
    expect(html).toContain("Todavía no hay nada que configurar");
  });

  it("la barra inferior tiene TRES pestañas y marca la activa", () => {
    const html = renderToStaticMarkup(
      h(BottomNav, { activeTab: "settings", onChange: () => {} }),
    );
    expect(html.match(/<button/g) ?? []).toHaveLength(3);
    // `aria-current="page"` en una sola, y en la tercera: con las tres marcadas —o con
    // ninguna— el usuario no sabe dónde está.
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    expect(html.lastIndexOf('aria-current="page"')).toBeGreaterThan(
      html.lastIndexOf("Mi QR"),
    );
  });
});
