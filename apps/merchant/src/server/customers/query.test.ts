import { describe, expect, it } from "vitest";
import { CustomerQueryError, parseCustomerQuery } from "./query";

/** Spec 0108 — validation of `GET /api/customers` (contract `0108-contratos-de-api.md`). */
const parse = (qs: string) => parseCustomerQuery(new URLSearchParams(qs));

function fieldsOf(qs: string): string[] {
  try {
    parse(qs);
  } catch (error) {
    expect(error).toBeInstanceOf(CustomerQueryError);
    const e = error as CustomerQueryError;
    expect(e.status).toBe(400);
    expect(e.code).toBe("validation");
    return Object.keys(e.fields).sort();
  }
  throw new Error(`expected a 400 for "${qs}"`);
}

describe("parseCustomerQuery", () => {
  it("defaults to page 1, no filter", () => {
    expect(parse("")).toEqual({ page: 1, filter: "all" });
  });

  it("accepts an integer page ≥ 1", () => {
    expect(parse("page=3")).toEqual({ page: 3, filter: "all" });
  });

  it.each(["0", "-1", "1.5", "abc", "", "1e2", "99999999999999999999"])(
    "rejects page=%s with fields.page",
    (page) => {
      expect(fieldsOf(`page=${page}`)).toEqual(["page"]);
    },
  );

  it("trims q and accepts 3 to 60 characters", () => {
    expect(parse("q=%20mar%20")).toEqual({ page: 1, filter: "name", q: "mar" });
    expect(parse(`q=${"a".repeat(60)}`)).toMatchObject({ filter: "name" });
  });

  it("counts characters, not UTF-16 units", () => {
    // Three emoji are six UTF-16 units: still three characters.
    expect(parse(`q=${encodeURIComponent("😀😀😀")}`)).toMatchObject({
      filter: "name",
    });
  });

  it.each(["ma", "%20%20ma%20%20", "", "a".repeat(61)])(
    "rejects q=%s with fields.q",
    (q) => {
      expect(fieldsOf(`q=${q}`)).toEqual(["q"]);
    },
  );

  it("accepts an E.164 phone", () => {
    expect(parse("phone=%2B593987654321")).toEqual({
      page: 1,
      filter: "phone",
      phone: "+593987654321",
    });
  });

  it.each(["0987654321", "%2B0123", "593987654321", "%2B59398765432100000"])(
    "rejects phone=%s with fields.phone",
    (phone) => {
      expect(fieldsOf(`phone=${phone}`)).toEqual(["phone"]);
    },
  );

  it("q and phone together → 400 with both fields", () => {
    expect(fieldsOf("q=maria&phone=%2B593987654321")).toEqual(["phone", "q"]);
  });

  it("reports a bad page together with a bad q", () => {
    expect(fieldsOf("page=0&q=ab")).toEqual(["page", "q"]);
  });
});
