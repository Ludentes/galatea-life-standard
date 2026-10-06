import { describe, expect, it } from "vitest";
import { applierIdentity, onFreshPort, PORT_ATTEMPTS, whoAnswers } from "../src/home.js";
import { SubjectNotReady } from "../src/subject.js";

describe("the applier subject's identity", () => {
  it("is its own for each test, so parallel subjects never share a ClientID on the broker", () => {
    expect(applierIdentity("demo/run-1/t3")).toBe("subject-applier-run-1-t3");
    expect(applierIdentity("demo/run-1/guard")).toBe("subject-applier-run-1-guard");
    expect(applierIdentity("demo/run-1/t3")).not.toBe(applierIdentity("demo/run-1/t4"));
  });
});

describe("the guard on the subject's port", () => {
  it("takes the subject that answers the run's id, and throws, as the harness's fault, for another server", () => {
    expect(() => whoAnswers({ ok: true, body: { test_run_id: "run-1" } }, "run-1")).not.toThrow();
    expect(() => whoAnswers({ ok: true, body: { test_run_id: "run-2" } }, "run-1")).toThrow(/another server holds the port/);
    expect(() => whoAnswers({ ok: true, body: {} }, "run-1")).toThrow(/test_run_id undefined/);
    expect(() => whoAnswers({ ok: false, error: "not_permitted", message: "", body: {} }, "run-1")).toThrow(/may hold the port/);
    // It fails closed: any other answer is not this test's subject either.
    expect(() => whoAnswers({ ok: false, error: "invalid_request", message: "", body: {} }, "run-1")).toThrow(/invalid_request/);
  });

  it("starts the subject again on a fresh port, after a pause, while another server took its port, up to PORT_ATTEMPTS", async () => {
    const lost = () => new SubjectNotReady("the subject exited (1) before it was ready",
      ["Error: listen EADDRINUSE: address already in use 127.0.0.1:4000"]);
    let next = 4000;
    const o = { port: async () => next++, pauseMs: () => 1 };
    const ports: number[] = [];
    // Two losses in a row, which the single retry before failed on (the whole matrix's GA-STATE-2).
    expect(await onFreshPort(async (port) => {
      ports.push(port);
      if (ports.length <= 2) throw lost();
      return "started";
    }, o)).toBe("started");
    expect(ports).toEqual([4000, 4001, 4002]);
    // The last loss, or any other failure, is thrown.
    let losses = 0;
    await expect(onFreshPort(async () => { losses++; throw lost(); }, o)).rejects.toThrow(/before it was ready/);
    expect(losses).toBe(PORT_ATTEMPTS);
    let tries = 0;
    await expect(onFreshPort(async () => {
      tries++;
      throw new SubjectNotReady("the subject was not ready in 30000 ms", []);
    }, o)).rejects.toThrow(/not ready/);
    expect(tries).toBe(1);
  });
});
