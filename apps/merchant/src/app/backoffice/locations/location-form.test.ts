import { describe, expect, it } from "vitest";
import { addressBody, editDraft, newDraft } from "./location-form";

describe("dirección de locales 0157", () => {
  it("envía el token firmado del lugar elegido", () => {
    const draft = newDraft();
    draft.selection = {
      selectionToken: "signed-place",
      place: {
        placeId: "place",
        kind: "address",
        addressLabel: "Cuenca, Ecuador",
        suggestedCategoryGcid: null,
      },
      suggestion: {
        placeId: "place",
        kind: "address",
        mainText: "Cuenca",
        secondaryText: null,
      },
    };
    expect(addressBody(draft)).toEqual({
      label: "Cuenca, Ecuador",
      selectionToken: "signed-place",
    });
  });

  it("envía solo texto al escribir a mano y omite address en cambio de nombre", () => {
    const draft = editDraft({
      id: "l",
      name: "Principal",
      addressLabel: "Quito",
      status: "active",
    });
    expect(draft.addressChanged).toBe(false);
    expect(
      addressBody({
        ...draft,
        addressLabel: "Av. Amazonas 123",
        selection: null,
        addressChanged: true,
      }),
    ).toEqual({ label: "Av. Amazonas 123" });
  });
});
