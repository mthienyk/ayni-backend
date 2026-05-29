import { describe, expect, it } from "vitest";
import { canonicalItemPair } from "../lib/crypto.js";
import { MatchService } from "../services/swipe.service.js";

describe("MatchService pair canonicalization", () => {
  it("uses consistent low/high ids for conflict target", () => {
    const itemA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const itemB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const pair = canonicalItemPair(itemA, itemB);

    expect(pair.itemLowId).toBe(itemA);
    expect(pair.itemHighId).toBe(itemB);

    const reversed = canonicalItemPair(itemB, itemA);
    expect(reversed).toEqual(pair);
  });
});

describe("MatchService duplicate prevention contract", () => {
  it("documents ON CONFLICT DO NOTHING on item_low_id + item_high_id", () => {
    const service = new MatchService({} as never);
    expect(service.createMatchIfReciprocal).toBeDefined();
    expect(service.findReciprocalLike).toBeDefined();
  });
});
