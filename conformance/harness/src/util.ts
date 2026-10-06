import { RequirementFailure } from "./assert.js";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The harness's one poll: calls `check` every `everyMs` until it returns something other than
 * `undefined` or `false`, and returns that; past `ms`, a RequirementFailure naming `what`.
 */
export async function pollUntil<T>(
  check: () => Promise<T | undefined | false>, ms: number, what: string, everyMs = 100,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v !== undefined && v !== false) return v;
    if (Date.now() > deadline) throw new RequirementFailure(`${what}: not within ${ms} ms`);
    await sleep(everyMs);
  }
}
