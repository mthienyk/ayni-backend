import { describe, expect, it } from "vitest";
import { canonicalItemPair } from "./crypto.js";

describe("canonicalItemPair", () => {
  it("orders item ids consistently", () => {
    const a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    expect(canonicalItemPair(a, b)).toEqual({
      itemLowId: a,
      itemHighId: b,
    });
    expect(canonicalItemPair(b, a)).toEqual({
      itemLowId: a,
      itemHighId: b,
    });
  });
});
