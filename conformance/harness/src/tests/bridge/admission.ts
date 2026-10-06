import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import type { TestContext } from "../../context.js";
import { wire } from "../util.js";

/** A closed lamp, as a `describe` op gives it; a subject with no doer to script refuses the op, and the test is not_applicable. */
const LAMP = { capabilities: ["onoff"], feedback: "closed" };

/** The roster lags a device by at most one heartbeat (*The roster and freshness*): a status interval, the allowance added. */
const heartbeat = (ctx: TestContext) => constantMs("bridge", "status-interval") + ctx.allowanceMs;

function topics(ctx: TestContext) {
  const base = `${ctx.root}/bridges/${ctx.bridgeId}`;
  const ids = (s: Seen): string[] => (s.payload?.devices ?? []).map((d: { id: string }) => d.id);
  return {
    base,
    /** A `devices` document that `pred` holds for its ids. */
    devices: (pred: (ids: string[]) => boolean) => (s: Seen) => s.topic === `${base}/devices` && s.payload !== null && pred(ids(s)),
    deviceStatus: (id: string) => `${base}/devices/${id}/status`,
    event: (type: string, device: string) => (s: Seen) => s.topic === `${base}/event` && s.payload?.type === type && s.payload.device === device,
    /** A status whose roster's ids `pred` holds for. */
    roster: (pred: (ids: string[]) => boolean) => (s: Seen) => s.topic === `${base}/status` && s.payload !== null && pred(ids(s)),
  };
}

requirement("GA-BRIDGE-21", {
  seam: "bridge", covers: "a device that leaves goes from devices and the roster, its retained status is cleared with an empty payload, and left names it",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  await transport.send({ op: "describe", device: "lamp", entry: LAMP });
  await watch.waitFor(t.devices((ids) => ids.includes("lamp")), within);
  const reported = watch.seen.length;
  await transport.send({ op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor((s) => s.topic === t.deviceStatus("lamp") && s.payload?.on === true, within, reported);

  const mark = watch.seen.length;
  await transport.send({ op: "leave", device: "lamp" });
  const gone = await watch.waitFor(t.devices((ids) => !ids.includes("lamp")), within, mark);
  ctx.evidence(`devices after the leave: ${JSON.stringify(gone.payload.devices.map((d: { id: string }) => d.id))}`);
  await watch.waitFor(t.roster((ids) => !ids.includes("lamp")), heartbeat(ctx), mark).catch(() => {
    must(false, "no status within a heartbeat of the leave has a roster without the lamp");
  });
  const left = await watch.waitFor(t.event("left", "lamp"), within, mark);
  must(validate("bridge/event.json", left.payload).length === 0, "the left event is not valid", left.payload);
  // The standard fixes no order between left and the clear, so the clear gets the same bounded wait.
  await watch.waitFor((s) => s.topic === t.deviceStatus("lamp") && s.payload === null, within, mark).catch(() => {
    must(false, "the lamp's retained status was not cleared with an empty payload",
      watch.seen.slice(mark).filter((s) => s.topic === t.deviceStatus("lamp")).map((s) => s.payload));
  });
  ctx.evidence("the lamp's status was cleared with an empty payload");
});

requirement("GA-BRIDGE-35", {
  seam: "bridge", covers: "an association of hardware in devices is a new admission, a never-used id and joined, the old id gone from devices and the roster and its status cleared; a secured rejoin keeps the id and sends no joined",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  await transport.send({ op: "describe", device: "lamp", entry: LAMP });
  await watch.waitFor(t.devices((ids) => ids.includes("lamp")), within);

  // Hardware still in devices, back by a secured rejoin: the same device.
  const rejoin = watch.seen.length;
  await transport.send({ op: "admit", device: "lamp", how: "securedRejoin" });
  // The bridge takes what the doer tells it in order: once this report is out, the rejoin was handled.
  await transport.send({ op: "report", device: "lamp", values: { on: true }, observedAt: wire(ctx.time.now()) });
  await watch.waitFor((s) => s.topic === t.deviceStatus("lamp") && s.payload?.on === true, within, rejoin);
  const joinedAfterRejoin = watch.seen.slice(rejoin).filter((s) => s.topic === `${t.base}/event` && s.payload?.type === "joined");
  mustEqual(joinedAfterRejoin.length, 0, "joined events after a secured rejoin");
  const after = watch.seen.filter(t.devices(() => true)).at(-1)!;
  mustEqual(JSON.stringify(after.payload.devices.map((d: { id: string }) => d.id)), JSON.stringify(["lamp"]), "devices after a secured rejoin");

  // The same hardware associating again: a new admission.
  const assoc = watch.seen.length;
  await transport.send({ op: "admit", device: "lamp", how: "association" });
  const fresh = await watch.waitFor(t.devices((ids) => ids.length === 1 && ids[0] !== "lamp"), within, assoc);
  const id = fresh.payload.devices[0].id as string;
  ctx.evidence(`the association's id: ${id}`);
  const joined = await watch.waitFor(t.event("joined", id), within, assoc);
  must(validate("bridge/event.json", joined.payload).length === 0, "the joined event is not valid", joined.payload);
  // The old id leaves the roster, and its retained status is cleared.
  await watch.waitFor(t.roster((ids) => ids.includes(id) && !ids.includes("lamp")), heartbeat(ctx), assoc).catch(() => {
    must(false, "no status within a heartbeat of the association has a roster with the new id and without the old");
  });
  await watch.waitFor((s) => s.topic === t.deviceStatus("lamp") && s.payload === null, within, assoc).catch(() => {
    must(false, "the old id's retained status was not cleared with an empty payload");
  });
});
