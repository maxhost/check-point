import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConsumerCoupon } from "@mi-pasaporte/domain/server/consumer/coupons";
import type { ConsumerProgramSummary } from "@mi-pasaporte/domain/server/consumer/programs";
import { ActivityView } from "./activity-view";

const callbacks = {
  onBack: () => {},
  onShowBenefits: () => {},
  onShowPrograms: () => {},
};

describe("Actividad — avisos de mostrador (spec 0140)", () => {
  it("mezcla el aviso con beneficios y programas por fecha, con texto y fecha del DTO", () => {
    const html = renderToStaticMarkup(
      h(ActivityView, {
        coupons: [
          {
            id: "coupon-1",
            status: "valid",
            label: "Café gratis",
            businessName: "Café Uno",
            validFrom: new Date("2026-10-01T12:00:00.000Z"),
          } as unknown as ConsumerCoupon,
        ],
        programs: [
          {
            membershipId: "membership-1",
            businessName: "Bar Dos",
            enrolledAt: "2026-09-30T12:00:00.000Z",
          } as ConsumerProgramSummary,
        ],
        notices: [
          {
            id: "notice-1",
            title: "Tienda Tres",
            body: "+1 sello",
            createdAt: "2026-10-02T12:00:00.000Z",
          },
        ],
        ...callbacks,
      }),
    );

    expect(html.indexOf("Tienda Tres")).toBeLessThan(
      html.indexOf("Café gratis"),
    );
    expect(html.indexOf("Café gratis")).toBeLessThan(
      html.indexOf("Te sumaste a un programa"),
    );
    expect(html).toContain("+1 sello");
    expect(html).toContain("2 de octubre de 2026");
    expect(html).toContain("movimientos en comercios");
    expect(html).not.toContain("no_channel");
  });

  it("menciona los movimientos en comercios en el estado vacío", () => {
    const html = renderToStaticMarkup(
      h(ActivityView, {
        coupons: [],
        programs: [],
        notices: [],
        ...callbacks,
      }),
    );
    expect(html).toContain("movimiento en un comercio");
  });
});
