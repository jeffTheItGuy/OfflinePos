import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./api";

function mockFetchOnce(res: {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      text: async () => res.body,
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("request error handling (UNIT-W03)", () => {
  it("throws ApiError carrying the server detail on non-2xx", async () => {
    mockFetchOnce({
      ok: false,
      status: 409,
      statusText: "Conflict",
      body: JSON.stringify({ detail: "Order already paid" }),
    });
    await expect(api.getOrder("x")).rejects.toMatchObject({
      status: 409,
      message: "Order already paid",
    });
  });

  it("falls back to statusText when the body is empty", async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      body: "",
    });
    await expect(api.getOrder("x")).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("returns the parsed body on success", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify({ id: "o1" }),
    });
    await expect(api.getOrder("o1")).resolves.toEqual({ id: "o1" });
  });
});