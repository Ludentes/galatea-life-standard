import { capabilityKeys } from "@ludentes/galatea-life-sim";
import { must, RequirementFailure } from "../../assert.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import type { TestContext } from "../../context.js";
import { wire } from "../util.js";
import { timeOf, topics } from "./doer.js";

/**
 * What a bridge keeps of a device across its restarts and its device's rejoins (bridge 0.6): the
 * settings the device confirmed (GA-BRIDGE-79), and the held-back keys it has reported
 * (GA-BRIDGE-80). Each device is made up, in the shape of the bench's (a radar whose sensitivity is
 * known only from the echo of its write, and whose model promises a temperature it never sends).
 */

/** A snapshot's answer, as a fence: everything the subject published for what came before it is in. */
async function fence(ctx: TestContext): Promise<Seen> {
  const asked = ctx.watch!.seen.length;
  return ctx.applier!.reply(await ctx.applier!.request("snapshot"), 10_000 + ctx.allowanceMs, asked);
}

const RADAR = "org.galatea.test.radar";
const SENSITIVITY = `${RADAR}.sensitivity`;
const FADING = `${RADAR}.fading`;
/** A presence radar with two settings, each an extension state key the device answers no read of. */
const RADAR_ENTRY = { capabilities: ["sensor"], sensorKeys: ["occupancy"], feedback: "closed", settings: [SENSITIVITY, FADING],
  extensions: [{ capability: RADAR, keys: [{ key: SENSITIVITY, kind: "state", schema: { type: "number" } },
    { key: FADING, kind: "state", schema: { type: "number" } }] }] };

requirement("GA-BRIDGE-79", {
  seam: "bridge", covers: "every setting listed in settings and no vocabulary key; a setting the device echoed kept and published with its observation's time after a secured rejoin and across a restart, the device answering no read of it; a setting never confirmed never published; every kept setting dropped when the device is interviewed again, and its status never cleared for it",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  const latest = (from: number) => watch.seen.slice(from).filter((s) => s.topic === t.deviceStatus("radar")).at(-1);
  const start = watch.seen.length;
  await transport.send({ op: "describe", device: "radar", entry: RADAR_ENTRY });
  const doc = await watch.waitFor(t.devices("radar"), within, start);
  const entry = t.entry(doc, "radar")!;
  ctx.evidence(`the radar's settings: ${JSON.stringify(entry.settings)}`);
  const settings = (entry.settings ?? []) as string[];
  must(settings.includes(SENSITIVITY) && settings.includes(FADING), "a setting of the radar is not listed in settings", entry);
  const vocabulary = [...capabilityKeys(entry.capabilities ?? []), ...(entry.sensorKeys ?? [])];
  must(!settings.some((k) => vocabulary.includes(k)), "settings lists a vocabulary state key", entry);

  // The device echoes its sensitivity, as when it was written; its fading it never sends.
  const echoedAt = wire(ctx.time.now() - 2000);
  await transport.send({ op: "setting", device: "radar", key: SENSITIVITY, value: 7, observedAt: echoedAt });
  await watch.waitFor(t.statusOf("radar", (p) => p[SENSITIVITY] === 7), within, start);
  const keptAs = (p: Record<string, any> | undefined) => p?.[SENSITIVITY] === 7 && timeOf(p, SENSITIVITY) === echoedAt;

  // A secured rejoin, as after a power cut, is not an interview: the setting stays.
  await transport.send({ op: "admit", device: "radar", how: "securedRejoin" });
  await fence(ctx);
  const afterRejoin = latest(start)?.payload;
  ctx.evidence(`after a secured rejoin: ${JSON.stringify(afterRejoin)}`);
  must(keptAs(afterRejoin), "the radar's sensitivity, echoed before, is not in its status after a secured rejoin", afterRejoin);

  // The bridge starts again; the device sends nothing, and answers no read of its settings.
  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await transport.send({ op: "describe", device: "radar", entry: RADAR_ENTRY });
  const back = await watch.waitFor(t.statusOf("radar", (p) => SENSITIVITY in p), 5000 + ctx.allowanceMs, restarted)
    .catch((err) => { throw err instanceof RequirementFailure ? new RequirementFailure(`the echoed sensitivity is not published after the restart: ${err.message}`) : err; });
  ctx.evidence(`after the restart: ${JSON.stringify(back.payload)}`);
  must(keptAs(back.payload), `the kept sensitivity after the restart is not 7 at ${echoedAt}, its echo's time`, back.payload);
  // A reading after the restart: the kept setting rides on with its own time.
  await transport.send({ op: "report", device: "radar", values: { occupancy: true }, observedAt: wire(ctx.time.now()) });
  const both = await watch.waitFor(t.statusOf("radar", (p) => p.occupancy === true), within, restarted);
  ctx.evidence(`beside a new reading: ${JSON.stringify(both.payload)}`);
  must(keptAs(both.payload), "the kept sensitivity is not carried, with its echo's time, beside a new reading", both.payload);
  await fence(ctx);
  const unconfirmed = watch.seen.slice(start).filter(t.statusOf("radar", (p) => FADING in p));
  must(unconfirmed.length === 0, "the fading, which the device never sent, is published", unconfirmed.map((s) => s.payload));

  // Interviewed again, as after a reset: the kept sensitivity is dropped, and stays dropped beside a
  // new reading; the device is still listed, so its status is never cleared (an empty status is a removal).
  const interviewed = watch.seen.length;
  await transport.send({ op: "interview", device: "radar" });
  await transport.send({ op: "report", device: "radar", values: { occupancy: false }, observedAt: wire(ctx.time.now()) });
  const after = await watch.waitFor(t.statusOf("radar", (p) => p.occupancy === false), within, interviewed);
  await fence(ctx);
  ctx.evidence(`after the interview: ${JSON.stringify(after.payload)}`);
  const last = latest(interviewed)?.payload;
  must(!(SENSITIVITY in after.payload) && !(SENSITIVITY in (last ?? {})), "the kept sensitivity is still published after the device was interviewed again",
    last);
  const cleared = watch.seen.slice(interviewed).filter((s) => s.topic === t.deviceStatus("radar") && s.payload === null);
  must(cleared.length === 0, "the radar's status was cleared after its interview, as if it had been removed");

  // A second radar whose one value is its kept sensitivity: interviewed again, it has no reading
  // left, and is still listed, so its status is not cleared (GA-BRIDGE-21) and no longer carries it.
  const lone = watch.seen.length;
  await transport.send({ op: "describe", device: "radar2", entry: RADAR_ENTRY });
  await transport.send({ op: "setting", device: "radar2", key: SENSITIVITY, value: 3, observedAt: wire(ctx.time.now()) });
  await watch.waitFor(t.statusOf("radar2", (p) => p[SENSITIVITY] === 3), within, lone);
  const reset = watch.seen.length;
  await transport.send({ op: "interview", device: "radar2" });
  await fence(ctx);
  const radar2 = watch.seen.slice(reset).filter((s) => s.topic === t.deviceStatus("radar2"));
  ctx.evidence(`radar2 after its interview: ${JSON.stringify(radar2.map((s) => s.payload))}`);
  must(radar2.every((s) => s.payload !== null), "radar2's status was cleared after its interview, as if it had been removed");
  const stale = watch.seen.slice(lone).filter((s) => s.topic === t.deviceStatus("radar2")).at(-1)?.payload;
  must(!(SENSITIVITY in (stale ?? {})), "radar2's retained status still carries the sensitivity dropped at its interview", stale);
});

/** A radar whose model promises a temperature and a humidity, which its maker has seen it never send. */
const AWAITING = { capabilities: ["sensor"], sensorKeys: ["occupancy", "temperature", "humidity"], feedback: "closed" };
/** A leak sensor whose maker's records name its leak as seen missing: it may first come at the first leak. */
const LEAK = { capabilities: ["sensor"], sensorKeys: ["leak", "battery"], feedback: "closed" };

requirement("GA-BRIDGE-80", {
  seam: "bridge", covers: "each promised key declared or listed in awaitedKeys, never both; a boolean never held back; a held-back key declared in a devices published before the status with its first value and within 1 s of it, never undescribed; once reported, declared again after a restart",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const t = topics(ctx);
  const within = 1000 + ctx.allowanceMs;
  const start = watch.seen.length;
  const sorts = (e: Record<string, any>, promised: string[]) => {
    const declared = (e.sensorKeys ?? []) as string[];
    const awaited = (e.awaitedKeys ?? []) as string[];
    const nowhere = promised.filter((k) => !declared.includes(k) && !awaited.includes(k));
    must(nowhere.length === 0, `promised keys neither declared nor in awaitedKeys: ${JSON.stringify(nowhere)}`, e);
    const both = awaited.filter((k) => declared.includes(k));
    must(both.length === 0, `keys both declared and in awaitedKeys: ${JSON.stringify(both)}`, e);
    return { declared, awaited };
  };
  await transport.send({ op: "describe", device: "radar", entry: AWAITING, seenMissing: ["temperature", "humidity"] });
  await transport.send({ op: "describe", device: "leak", entry: LEAK, seenMissing: ["leak", "battery"] });
  const radarDoc = await watch.waitFor(t.devices("radar"), within, start);
  const leakDoc = await watch.waitFor(t.devices("leak"), within, start);
  const radar = sorts(t.entry(radarDoc, "radar")!, AWAITING.sensorKeys);
  const leak = sorts(t.entry(leakDoc, "leak")!, LEAK.sensorKeys);
  ctx.evidence(`radar: declared ${JSON.stringify(radar.declared)}, awaited ${JSON.stringify(radar.awaited)}; leak: declared ${JSON.stringify(leak.declared)}, awaited ${JSON.stringify(leak.awaited)}`);
  must(leak.declared.includes("leak") && !leak.awaited.includes("leak"), "the leak sensor's leak, a boolean, is held back", t.entry(leakDoc, "leak"));
  must(!radar.awaited.includes("occupancy"), "the radar's occupancy, which its maker has not seen missing, is held back", t.entry(radarDoc, "radar"));

  // The temperature comes at last: a devices that declares it goes out before its first value, within 1 s.
  const first = watch.seen.length;
  const sentAt = Date.now();
  await transport.send({ op: "report", device: "radar", values: { occupancy: true, temperature: 21.5 }, observedAt: wire(ctx.time.now()) });
  const value = await watch.waitFor(t.statusOf("radar", (p) => p.temperature === 21.5), within, first)
    .catch((err) => { throw err instanceof RequirementFailure ? new RequirementFailure(`the temperature's first value is not published: ${err.message}`) : err; });
  if (radar.awaited.includes("temperature")) {
    const declaring = watch.seen.slice(first, watch.seen.indexOf(value)).find(t.devices("radar",
      (e) => (e.sensorKeys ?? []).includes("temperature") && !(e.awaitedKeys ?? []).includes("temperature")));
    must(declaring !== undefined, "no devices declaring the temperature went out before its first value",
      watch.seen.slice(first).map((s) => s.topic));
    const lag = declaring.realAt - sentAt;
    ctx.evidence(`the temperature declared ${lag} ms after its first report, before its value`);
    must(lag <= within, `the devices declaring the temperature came ${lag} ms after its first report, past 1 s`);
  }
  await fence(ctx);
  const undescribed = watch.seen.slice(first).filter((s) => s.topic === `${t.base}/event` && s.payload?.type === "undescribed"
    && s.payload.name === "temperature");
  must(undescribed.length === 0, "the held-back temperature's first report was announced undescribed");
  const listed = watch.seen.slice(first).filter(t.devices("radar", (e) => (e.undescribed ?? []).some((u: { name: string }) => u.name === "temperature")));
  must(listed.length === 0, "the held-back temperature's first report is listed undescribed");

  // Once reported, never held back again, across a restart.
  const restarted = watch.seen.length;
  await ctx.subject.restart();
  await transport.send({ op: "describe", device: "radar", entry: AWAITING, seenMissing: ["temperature", "humidity"] });
  const back = await watch.waitFor(t.devices("radar"), 5000 + ctx.allowanceMs, restarted);
  const again = sorts(t.entry(back, "radar")!, AWAITING.sensorKeys);
  ctx.evidence(`after the restart: declared ${JSON.stringify(again.declared)}, awaited ${JSON.stringify(again.awaited)}`);
  must(again.declared.includes("temperature"), "the temperature, reported before the restart, is held back again", t.entry(back, "radar"));
});
