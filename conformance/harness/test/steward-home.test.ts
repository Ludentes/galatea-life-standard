import { validate } from "@ludentes/galatea-life-schemas";
import { systemClock } from "@ludentes/galatea-life-test-clock";
import { afterEach, describe, expect, it } from "vitest";
import { baselineChanges, CHANNEL, freshCredentials, LAMP, startStandIn, STEWARD_CLIENT, type StandIn } from "../src/steward-home.js";

const open: StandIn[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

describe("the steward seam's home", () => {
  it("defines a baseline whose every change is its kind's provisional shape", () => {
    const changes = baselineChanges(freshCredentials(), "127.0.0.1:123") as { op: string; kind: string; value: unknown }[];
    for (const c of changes) expect(validate(`steward/define.${c.kind}.json`, c.value), `${c.kind}`).toEqual([]);
    expect(changes[0]).toMatchObject({ kind: "home", value: { notice_channels: [CHANNEL], time_source: "127.0.0.1:123" } });
  });

  it("starts a scripted stand-in with an adopted notify channel and a lamp, the steward registered as its client", async () => {
    const s = (await startStandIn({ clock: systemClock(), runId: "run-1", root: "demo/x" }))!;
    open.push(s);
    expect(s.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    const caller = s.applier.caller(s.credential);
    expect(caller).toEqual({ kind: "client", id: STEWARD_CLIENT });
    const d = await s.applier.call(caller, "describe", {});
    expect(d.ok && (d.body.devices as { id: string; adopted: boolean }[]).map((x) => [x.id, x.adopted])).toEqual([[CHANNEL, true], [LAMP, true]]);
    expect(d.ok && d.body.test_run_id).toBe("run-1");
  });
});
