import { describe, expect, it } from "vitest";
import { isBusinessCategory } from "../../lib/business-categories";
import { CATEGORY_BY_TYPES, categoryFromTypes } from "./category-from-types";

describe("categoryFromTypes (spec 0155)", () => {
  it.each([
    ["pizza_restaurant", "gcid:pizza_restaurant"],
    ["ice_cream_shop", "gcid:ice_cream_shop"],
    ["bakery", "gcid:bakery"],
    ["cafe", "gcid:cafe"],
    ["coffee_shop", "gcid:cafe"],
    ["bar", "gcid:bar"],
    ["pub", "gcid:bar"],
    ["wine_bar", "gcid:bar"],
    ["barber_shop", "gcid:barber_shop"],
    ["nail_salon", "gcid:nail_salon"],
    ["beauty_salon", "gcid:beauty_salon"],
    ["hair_salon", "gcid:beauty_salon"],
    ["hair_care", "gcid:beauty_salon"],
    ["gym", "gcid:gym"],
    ["fitness_center", "gcid:gym"],
    ["pharmacy", "gcid:pharmacy"],
    ["drugstore", "gcid:pharmacy"],
    ["grocery_store", "gcid:grocery_store"],
    ["supermarket", "gcid:grocery_store"],
    ["convenience_store", "gcid:grocery_store"],
    ["clothing_store", "gcid:clothing_store"],
    ["pet_store", "gcid:pet_store"],
    ["car_wash", "gcid:car_wash"],
    ["restaurant", "gcid:restaurant"],
  ])("la tabla de la spec: %s → %s", (type, gcid) => {
    expect(
      categoryFromTypes([type, "point_of_interest", "establishment"]),
    ).toBe(gcid);
  });

  it("cualquier *_restaurant es restaurante", () => {
    expect(categoryFromTypes(["italian_restaurant"])).toBe("gcid:restaurant");
  });

  it("gana el mas especifico: cafe + restaurant → cafe", () => {
    expect(categoryFromTypes(["cafe", "restaurant"])).toBe("gcid:cafe");
    expect(categoryFromTypes(["restaurant", "cafe"])).toBe("gcid:cafe");
    // y pizza le gana a su propio sufijo `_restaurant`
    expect(categoryFromTypes(["pizza_restaurant", "restaurant"])).toBe(
      "gcid:pizza_restaurant",
    );
  });

  it("sin coincidencia → null", () => {
    expect(categoryFromTypes(["intersection"])).toBeNull();
    expect(categoryFromTypes([])).toBeNull();
  });

  it("todo gcid de la tabla esta en la lista curada", () => {
    expect(CATEGORY_BY_TYPES.length).toBe(15);
    for (const row of CATEGORY_BY_TYPES) {
      expect(isBusinessCategory(row.gcid)).toBe(true);
    }
  });
});
