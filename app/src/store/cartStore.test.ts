import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cartStore";
import type { MenuItem } from "../types";

const coffee: MenuItem = {
  id: "m1",
  name: "Coffee",
  price_cents: 350,
  category: "drinks",
  available: true,
  version: 1,
};

describe("cartStore (UNIT-T06)", () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it("total is sum(quantity × price_cents) in integer cents", () => {
    useCartStore.getState().add(coffee, 2);
    useCartStore.getState().add(
      { ...coffee, id: "m2", name: "Tea", price_cents: 200 },
      1,
    );
    expect(useCartStore.getState().totalCents()).toBe(2 * 350 + 200);
  });

  it("note-free lines for the same item merge", () => {
    useCartStore.getState().add(coffee);
    useCartStore.getState().add(coffee);
    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it("lines with notes stay separate", () => {
    useCartStore.getState().add(coffee);
    useCartStore.getState().add(coffee, 1, "no sugar");
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it("dec removes a line when it reaches zero", () => {
    useCartStore.getState().add(coffee, 1);
    const id = useCartStore.getState().lines[0].line_id;
    useCartStore.getState().dec(id);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});