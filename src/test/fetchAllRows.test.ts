import { describe, it, expect } from "vitest";
import { fetchAllRows } from "@/lib/fetchAllRows";

const source = Array.from({ length: 2109 }, (_, i) => i);
const pager = (from: number, to: number) =>
  Promise.resolve({ data: source.slice(from, to + 1), error: null });

describe("fetchAllRows", () => {
  it("returns every record past the 1000-row page limit, including the oldest", async () => {
    const rows = await fetchAllRows(pager);
    expect(rows.length).toBe(2109);
    expect(rows[2108]).toBe(2108);
  });

  it("stops after one request when everything fits on one page", async () => {
    let calls = 0;
    const rows = await fetchAllRows((f, t) => { calls++; return Promise.resolve({ data: source.slice(0, 520).slice(f, t + 1), error: null }); });
    expect(rows.length).toBe(520);
    expect(calls).toBe(1);
  });

  it("throws instead of returning a partial list when a page fails", async () => {
    await expect(
      fetchAllRows((f) => Promise.resolve(f === 0 ? { data: source.slice(0, 1000), error: null } : { data: null, error: { message: "boom" } })),
    ).rejects.toThrow("boom");
  });
});
