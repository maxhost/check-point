import { describe, expect, it } from "vitest";
import { checkinUrl } from "./demo";

describe("checkinUrl", () => {
  it("only creates a QR destination for HTTPS origins", () => {
    expect(checkinUrl("https://demo.example.test")).toBe(
      "https://demo.example.test/check-in/demo-bar",
    );
    expect(checkinUrl("http://192.168.1.2:3000")).toBeNull();
  });
});
