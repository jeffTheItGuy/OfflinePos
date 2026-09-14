import { describe, it, expect } from "vitest";
import { computeTax } from "./tax";

describe("computeTax (UNIT-T01)", () => {
  it("returns 0 with no rates", () => {
    expect(computeTax(1350, {})).toBe(0);
  });

  it("applies a single rate to the subtotal", () => {
    expect(computeTax(1000, { vat: 0.15 })).toBe(150);
  });

  it("rounds each rate independently then sums", () => {
    // 333 * 0.05 = 16.65 -> 17 ; 333 * 0.07 = 23.31 -> 23 ; total 40
    expect(computeTax(333, { a: 0.05, b: 0.07 })).toBe(40);
  });

  it("matches backend _compute_totals for identical inputs", () => {
    expect(computeTax(1000, { vat: 0.15, service: 0.1 })).toBe(250);
  });
});