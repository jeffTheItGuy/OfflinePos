import { describe, it, expect } from "vitest";
import { businessDay } from "./SalesReportPage";

describe("businessDay (UNIT-W01)", () => {
  it("buckets an order before cutover to the previous day", () => {
    expect(businessDay("2026-02-16T02:00:00Z", "UTC", 4)).toBe("2026-02-15");
  });

  it("buckets an order at/after cutover to the current day", () => {
    expect(businessDay("2026-02-16T04:00:00Z", "UTC", 4)).toBe("2026-02-16");
  });

  it("cutover 0 buckets by calendar day", () => {
    expect(businessDay("2026-02-16T00:00:00Z", "UTC", 0)).toBe("2026-02-16");
    expect(businessDay("2026-02-15T23:59:00Z", "UTC", 0)).toBe("2026-02-15");
  });
});