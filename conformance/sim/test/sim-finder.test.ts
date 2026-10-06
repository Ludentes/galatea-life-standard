import { TestClock } from "@ludentes/galatea-life-test-clock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startBroker, type Broker } from "../src/broker.js";
import { SimFinder, type FinderCandidate } from "../src/finder/sim-finder.js";
import { TimeServer } from "../src/time-server.js";
import { watch } from "./watch.js";

let broker: Broker;
let time: TimeServer;
let n = 0;
const cleanup: (() => unknown)[] = [];

beforeAll(async () => { broker = await startBroker(); time = await TimeServer.start(); }, 60_000);
afterAll(async () => { await time.close(); await broker.stop(); });
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

async function finder() {
  const root = `demo/f${++n}`;
  const clock = await TestClock.connect(time.source);
  const w = await watch(broker.url, `${root}/#`);
  const f = new SimFinder({ brokerUrl: broker.url, root, clock, runId: "run-1" });
  await f.start();
  await w.waitFor((s) => s.topic === `${root}/finder/status`, 5000);
  cleanup.push(() => clock.close(), () => w.close(), () => f.stop());
  return { f, w, root, clock };
}

const esphome = (keys: string[], ip: string): FinderCandidate =>
  ({ keys, sources: ["dhcp"], address: { ip }, matches: [{ bridgeType: "esphome", connect: true }] });

describe("SimFinder", () => {
  it("publishes a retained status every 10 s of its clock, and its candidates retained", async () => {
    const { f, w, root } = await finder();
    const first = await w.waitFor((s) => s.topic === `${root}/finder/status`, 2000);
    expect(first.retained).toBe(false);
    expect(first.payload).toMatchObject({ finderId: "sim-finder", instanceId: f.instanceId, v: 1, levels: ["Find"], faults: [] });
    f.setSources([{ source: "mdns", state: "up" }, { source: "dhcp", state: "off" }]);
    await f.setCandidates([{ keys: ["mdns:hall._esphomelib._tcp.local."], sources: ["mdns"], address: { ip: "192.0.2.10", port: 6053 },
      matches: [{ bridgeType: "esphome", connect: true }] }]);
    const list = await w.waitFor((s) => s.topic === `${root}/finder/candidates`, 2000);
    expect(list.payload.candidates[0]).toMatchObject({ keys: ["mdns:hall._esphomelib._tcp.local."], address: { ip: "192.0.2.10", port: 6053 },
      sources: ["mdns"], hints: {}, matches: [{ bridgeType: "esphome", connect: true }] });
    expect(list.payload.candidates[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Math.abs(Date.parse(list.payload.candidates[0].firstSeen) - time.now())).toBeLessThan(1000);
    const from = w.seen.length;
    await time.advance(10_000, { chunkMs: 2000 });
    const s = await w.waitFor((x) => x.topic === `${root}/finder/status`, 2000, from);
    expect(s.payload).toMatchObject({ v: 1, testRunId: "run-1", sources: [{ source: "mdns", state: "up" }, { source: "dhcp", state: "off" }] });
    // A later subscriber gets both retained.
    const late = await watch(broker.url, `${root}/finder/#`);
    cleanup.push(() => late.close());
    const again = await late.waitFor((x) => x.topic === `${root}/finder/candidates`, 2000);
    expect(again.retained).toBe(true);
    expect((await late.waitFor((x) => x.topic === `${root}/finder/status`, 2000)).retained).toBe(true);
  });

  it("keeps a candidate's id while it is listed, moves its address, and draws new ids after a restart", async () => {
    const { f, w, root } = await finder();
    const c = esphome(["mac:D4A651000001"], "192.0.2.11");
    await f.setCandidates([c]);
    const id = f.candidateId("mac:D4A651000001");
    await f.setCandidates([{ ...c, address: { ip: "192.0.2.12" } }]);
    expect(f.candidateId("mac:D4A651000001")).toBe(id);
    const moved = await w.waitFor((s) => s.topic === `${root}/finder/candidates` && s.payload.candidates[0]?.address?.ip === "192.0.2.12", 2000);
    expect(moved.payload.candidates[0].id).toBe(id);
    const instance = f.instanceId;
    await f.restart();
    expect(f.instanceId).not.toBe(instance);
    await f.setCandidates([c]);
    expect(f.candidateId("mac:D4A651000001")).not.toBe(id);
  });

  it("dies by its will when killed, and with a graceful status, its will cleared, when stopped", async () => {
    const { f, w, root } = await finder();
    const instance = f.instanceId;
    f.kill();
    const will = await w.waitFor((s) => s.topic === `${root}/finder/lwt` && s.payload?.instanceId === instance, 5000);
    expect(will.payload.finderId).toBe("sim-finder");
    await f.restart();
    const second = f.instanceId;
    const from = w.seen.length;
    await f.stop();
    const graceful = await w.waitFor((s) => s.topic === `${root}/finder/status` && s.payload?.graceful === true, 2000, from);
    expect(graceful.payload.instanceId).toBe(second);
    await w.waitFor((s) => s.topic === `${root}/finder/lwt` && s.payload === null, 2000, from);
  });

  it("drops v, skews publishedAt, stays silent while told, and publishes a will naming another instance", async () => {
    const { f, w, root } = await finder();
    f.dropV(true);
    f.skew(60_000);
    let from = w.seen.length;
    await f.publishStatus();
    const odd = await w.waitFor((s) => s.topic === `${root}/finder/status`, 2000, from);
    expect(odd.payload).not.toHaveProperty("v");
    expect(Math.abs(Date.parse(odd.payload.publishedAt) - time.now() - 60_000)).toBeLessThan(1000);
    f.setFaults([{ code: "overflow" }]);
    f.silence(true);
    from = w.seen.length;
    await time.advance(20_000, { chunkMs: 2000 });
    expect(w.seen.slice(from).some((s) => s.topic === `${root}/finder/status`)).toBe(false);
    await f.publishLwt("not-the-latest");
    const will = await w.waitFor((s) => s.topic === `${root}/finder/lwt`, 2000, from);
    expect(will.payload).toEqual({ finderId: "sim-finder", instanceId: "not-the-latest" });
    f.silence(false);
    f.dropV(false);
    f.skew(0);
    from = w.seen.length;
    await f.publishStatus();
    const s = await w.waitFor((x) => x.topic === `${root}/finder/status`, 2000, from);
    expect(s.payload).toMatchObject({ v: 1, faults: [{ code: "overflow" }] });
    time.reset();
  });
});
