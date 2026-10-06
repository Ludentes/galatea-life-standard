import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { requirement } from "../../registry.js";
import { wire } from "../util.js";
import { topics } from "./doer.js";

requirement("GA-BRIDGE-1", { seam: "bridge", covers: "each reading's time is its observation's" }, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  await transport.send({ op: "join", device: "lamp", capabilities: ["onoff"], feedback: "closed" });
  const observedAt = wire(ctx.time.now() - 5000);
  const mark = watch.seen.length;
  await transport.send({ op: "report", device: "lamp", values: { on: true }, observedAt });
  const s = await watch.waitFor((m) => m.topic.endsWith("/devices/lamp/status") && m.payload?.on === true,
    1000 + ctx.allowanceMs, mark);
  ctx.evidence(`the lamp's status: ${JSON.stringify(s.payload)}`);
  const errors = validate("bridge/device-status.json", s.payload);
  must(errors.length === 0, `the device status is not valid: ${errors.join("; ")}`);
  mustEqual(s.payload.timestamps?.on ?? s.payload.timestamp, observedAt, "the time of the reading on");
});

requirement("GA-BRIDGE-78", {
  seam: "bridge", covers: "a movement sensor whose library calls its reading occupancy is declared and published under motion, never occupancy, its false the device's own; the other vocabulary keys' meanings are not checked",
}, async (ctx) => {
  const watch = ctx.watch!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  // A passive infrared sensor, as the Zigbee converters describe one: its one reading named `occupancy`.
  const mark = watch.seen.length;
  await ctx.transport!.send({ op: "libraryDevice", device: "pir", readings: [{ name: "occupancy", means: "movement" }] });
  const doc = await watch.waitFor(t.devices("pir"), within, mark);
  const entry = t.entry(doc, "pir")!;
  ctx.evidence(`the PIR's entry: capabilities ${JSON.stringify(entry.capabilities)}, sensorKeys ${JSON.stringify(entry.sensorKeys)}`);
  must((entry.sensorKeys ?? []).includes("motion"), "the movement sensor does not declare motion", entry);
  must(!(entry.sensorKeys ?? []).includes("occupancy"), "the movement sensor declares occupancy", entry);
  for (const value of [true, false]) {
    await ctx.transport!.send({ op: "report", device: "pir", values: { occupancy: value }, observedAt: wire(ctx.time.now()) });
    const s = await watch.waitFor(t.statusOf("pir", (p) => p.motion === value), within, mark)
      .catch((err) => { throw err instanceof RequirementFailure ? new RequirementFailure(`no status of the PIR with motion ${value}: ${err.message}`) : err; });
    ctx.evidence(`after occupancy ${value}: ${JSON.stringify(s.payload)}`);
  }
  const wrong = watch.seen.slice(mark).filter(t.statusOf("pir", (p) => "occupancy" in p));
  must(wrong.length === 0, "a status of the movement sensor carries occupancy", wrong.map((s) => s.payload));
});
