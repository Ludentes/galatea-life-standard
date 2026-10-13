import { describe, expect, it } from "vitest";
import type { TestContext } from "../src/context.js";
import { setFlag } from "../src/tests/steward/util.js";

/** A context whose owner answers `define` with `answer` and `describe` with a revision. */
function stub(answer: unknown) {
  const evidence: string[] = [];
  const ctx = { evidence: (x: string) => evidence.push(x),
    steward: { owner: { callOk: async () => ({ revision: 1 }), call: async () => answer } } } as unknown as TestContext;
  return { ctx, evidence };
}

describe("setFlag", () => {
  it("is true when the steward takes the flag", async () => {
    const { ctx, evidence } = stub({ ok: true, body: {} });
    expect(await setFlag(ctx, "schedule_ends", true, ["X"])).toBe(true);
    expect(evidence).toEqual([]);
  });

  it("is false, each subject recorded as skipped, when the steward refuses with data.field naming the flag", async () => {
    const { ctx, evidence } = stub({ ok: false, error: "invalid_request", message: "no", body: { data: { field: "schedule_ends" } } });
    expect(await setFlag(ctx, "schedule_ends", true, ["X part 1", "X part 2"])).toBe(false);
    expect(evidence).toEqual(["skipped: X part 1: hold.schedule_ends true refused by the steward",
      "skipped: X part 2: hold.schedule_ends true refused by the steward"]);
  });

  it("fails when the refusal names no field, another field or another error", async () => {
    for (const answer of [{ ok: false, error: "invalid_request", message: "no", body: {} },
      { ok: false, error: "invalid_request", message: "no", body: { data: { field: "vacant_ends" } } },
      { ok: false, error: "conflict", message: "no", body: { data: { field: "schedule_ends" } } }]) {
      await expect(setFlag(stub(answer).ctx, "schedule_ends", true, ["X"])).rejects.toThrow(/schedule_ends/);
    }
  });
});
