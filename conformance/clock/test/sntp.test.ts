import { describe, expect, it } from "vitest";
import { isRequest, isResponse, request, response, transmitTime } from "../src/sntp.js";

describe("sntp", () => {
  it("round-trips a time to the millisecond", () => {
    const t = Date.UTC(2026, 8, 27, 10, 0, 0, 123);
    expect(Math.abs(transmitTime(request(t)) - t)).toBeLessThan(0.01);
  });

  it("answers a client request as a server, echoing its transmit time as originate", () => {
    const req = request(1_000);
    const res = response(req, 5_000_000);
    expect(isRequest(req)).toBe(true);
    expect(isResponse(res)).toBe(true);
    expect(res.subarray(24, 32)).toEqual(req.subarray(40, 48));
    expect(Math.abs(transmitTime(res) - 5_000_000)).toBeLessThan(0.01);
  });
});
