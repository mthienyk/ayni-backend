import { describe, expect, it } from "vitest";
import { canonicalItemPair, hashTokenLookup } from "./crypto.js";

describe("hashTokenLookup", () => {
  it("returns a stable 32-char hex prefix", () => {
    const lookup = hashTokenLookup("secret-token-value");
    expect(lookup).toHaveLength(32);
    expect(hashTokenLookup("secret-token-value")).toBe(lookup);
  });
});

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
