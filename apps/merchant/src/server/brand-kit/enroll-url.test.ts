import { describe, expect, it } from "vitest";
import { enrollPath, enrollUrl } from "./enroll-url";

describe("enrollPath", () => {
  it("omits the query when no local is given (global poster)", () => {
    expect(enrollPath("prog-1")).toBe("/enroll/prog-1");
    expect(enrollPath("prog-1", null)).toBe("/enroll/prog-1");
    expect(enrollPath("prog-1", undefined)).toBe("/enroll/prog-1");
  });

  it("adds a single `?loc=` param for a per-local poster", () => {
    expect(enrollPath("prog-1", "loc-9")).toBe("/enroll/prog-1?loc=loc-9");
  });

  it("encodes both segments", () => {
    expect(enrollPath("a/b", "l c")).toBe("/enroll/a%2Fb?loc=l%20c");
  });
});

describe("enrollUrl", () => {
  const origin = "https://app.example.com";

  it("produces an absolute URL without loc", () => {
    expect(enrollUrl(origin, "prog-1")).toBe(
      "https://app.example.com/enroll/prog-1",
    );
  });

  it("produces an absolute URL with loc", () => {
    expect(enrollUrl(origin, "prog-1", "loc-9")).toBe(
      "https://app.example.com/enroll/prog-1?loc=loc-9",
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(enrollUrl("https://app.example.com/", "prog-1", "loc-9")).toBe(
      "https://app.example.com/enroll/prog-1?loc=loc-9",
    );
  });
});
