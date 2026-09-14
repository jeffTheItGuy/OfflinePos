import { describe, it, expect } from "vitest";
import { backoffMs } from "./retry";

describe("backoffMs (UNIT-T04)", () => {
  it("grows exponentially", () => {
    expect(backoffMs(0)).toBeGreaterThanOrEqual(1_000);
    expect(backoffMs(0)).toBeLessThan(1_500);
    expect(backoffMs(3)).toBeGreaterThanOrEqual(8_000);
    expect(backoffMs(3)).toBeLessThan(8_500);
  });

  it("caps at 60 seconds", () => {
    expect(backoffMs(20)).toBeGreaterThanOrEqual(60_000);
    expect(backoffMs(20)).toBeLessThan(60_500);
    expect(backoffMs(100)).toBeLessThan(60_500);
  });

  it("jitter is never negative", () => {
    for (let attempts = 0; attempts < 25; attempts++) {
      expect(backoffMs(attempts)).toBeGreaterThanOrEqual(0);
    }
  });
});