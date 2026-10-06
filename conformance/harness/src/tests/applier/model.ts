import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import { pollUntil } from "../../util.js";
import { LAMP, turnOn } from "../util.js";

requirement("GA-DESC-1", {
  seam: "applier", fixture: { devices: ["lamp", "dimmer", "gate", "tv", "pusher", "shaker"] },
  covers: "describe is valid against its schema, with standard_version, levels and revision, a button pusher's and a vibration sensor's extensions included, each key with its kind, and an extension action with its confirmed_by",
}, async (ctx) => {
  const d = await pollUntil(async () => {
    const x = await ctx.mcp!.callOk("describe");
    return (x.devices as { id: string }[]).some((v) => v.id === "sim-bridge:shaker") ? x : undefined;
  }, 1000 + ctx.allowanceMs, "the shaker in describe");
  const errors = validate("applier/describe.response.json", d);
  must(errors.length === 0, `describe is not valid: ${errors.join("; ")}`, d);
  must(typeof d.standard_version === "string" && Array.isArray(d.levels) && Number.isInteger(d.revision),
    "describe gives standard_version, levels and revision", d);
  type Ext = { capability: string; keys: { key: string; kind: string }[] };
  const ext = (id: string) => (d.devices as { id: string; extensions?: Ext[] }[]).find((v) => v.id === id)?.extensions ?? [];
  mustEqual(ext("sim-bridge:shaker").flatMap((e) => e.keys.map((k) => [k.key, k.kind])), [["org.galatea.test.vibration.alarm", "event"],
    ["org.galatea.test.vibration.presence", "event"], ["org.galatea.test.vibration.sensitivity", "state"]], "the shaker's extension keys");
  mustEqual(ext("sim-bridge:pusher").map((e) => e.capability), ["org.galatea.test.pusher"], "the pusher's extensions");
  const setMode = (d.devices as { id: string; actions: { action: string; confirmed_by?: unknown }[] }[])
    .find((v) => v.id === "sim-bridge:pusher")?.actions.find((a) => a.action === "org.galatea.test.pusher.set_mode");
  mustEqual(setMode?.confirmed_by, { key: "org.galatea.test.pusher.mode", value: { arg: "mode" } }, "set_mode's confirmed_by");
});

type State = { targets: Record<string, { values: { key: string; value: unknown; basis_time: string }[]; liveness: string }> };

/** What a plan must not change: each target's values and liveness. */
function project(s: State) {
  return Object.fromEntries(Object.entries(s.targets).sort(([a], [b]) => a.localeCompare(b)).map(([id, t]) => [id, {
    liveness: t.liveness,
    values: t.values.map((v) => [v.key, v.value, v.basis_time]).sort(),
  }]));
}

requirement("GA-PLAN-1", {
  seam: "applier", covers: "each target's values and liveness, and the event stream, are unchanged by a plan",
}, async (ctx) => {
  const mcp = ctx.mcp!;
  const { cursor } = await mcp.callOk("events");
  const before = project(await mcp.callOk("state"));
  const plan = await mcp.callOk("plan", { actions: [turnOn(LAMP)] });
  must(plan.steps?.[0]?.verdict === "op", "the plan to turn the lamp on has an op step", plan);
  const after = project(await mcp.callOk("state"));
  // Assumes the subject emits no event of its own in this window; the test does nothing else.
  const events = await mcp.callOk("events", { cursor, wait_s: 1 });
  mustEqual(after, before, "the state after the plan");
  mustEqual(events.events, [], "the events after the plan");
});
