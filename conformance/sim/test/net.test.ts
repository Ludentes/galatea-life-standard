import { afterEach, describe, expect, it } from "vitest";
import { freePort } from "../src/net.js";

describe("freePort", () => {
  afterEach(() => { delete process.env.GALATEA_PORT_RANGE; });

  it("hands out ports of GALATEA_PORT_RANGE, each past the last, so parallel matrix jobs never share one", async () => {
    process.env.GALATEA_PORT_RANGE = "21500-21509";
    const ports = [await freePort(), await freePort(), await freePort()];
    for (const p of ports) expect(p >= 21500 && p <= 21509).toBe(true);
    expect(new Set(ports).size).toBe(3);
  });

  it("asks the system for one without a range", async () => {
    expect(await freePort()).toBeGreaterThan(0);
  });
});
