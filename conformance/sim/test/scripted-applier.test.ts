import { signToken } from "@ludentes/galatea-life-binding";
import { systemClock, type Clock } from "@ludentes/galatea-life-test-clock";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { serveMcp } from "../src/applier/mcp.js";
import { SCRIPTED_ACK_MS, SimApplier } from "../src/applier/sim-applier.js";
import { fixtureDevices } from "../src/fixture.js";
import { freePort } from "../src/net.js";
import { nonLoopbackAddress, selfSigned } from "../src/tls.js";

const cleanup: (() => unknown)[] = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

async function connect(url: string, bearer: string, era: "legacy" | "auto" = "auto") {
  const client = new Client({ name: "sim-test", version: "0.0.0" }, { versionNegotiation: { mode: era } });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } }));
  cleanup.push(() => client.close());
  return async (name: string, args: Record<string, unknown> = {}) =>
    ((await client.callTool({ name, arguments: args })) as { structuredContent?: any }).structuredContent;
}

/** A clock a test steps by hand, as the harness's time source is stepped. */
class SteppedClock implements Clock {
  private t = Date.parse("2026-10-02T08:00:00Z");
  private next = 1;
  private readonly timers = new Map<number, { due: number; fn: () => void }>();
  now(): number { return this.t; }
  setTimeout(fn: () => void, ms: number): number { this.timers.set(this.next, { due: this.t + ms, fn }); return this.next++; }
  setInterval(): number { throw new Error("not used"); }
  clear(h: number): void { this.timers.delete(h); }
  close(): void { this.timers.clear(); }
  advance(ms: number): void {
    this.t += ms;
    for (const [h, timer] of [...this.timers].sort((a, b) => a[1].due - b[1].due)) {
      if (timer.due <= this.t) { this.timers.delete(h); timer.fn(); }
    }
  }
}

/** The scripted stand-in: no broker, a notify channel and a lamp set by the test, a client registered. */
async function standIn(clock: Clock = systemClock()) {
  const applier = new SimApplier({ identity: "stand-in", root: "demo/s", clock, ownerCredential: "owner-secret", runId: "run-1" });
  await applier.start();
  const [lamp, channel] = fixtureDevices(["lamp", "channel"]);
  applier.scriptDevice(channel!, { adopt: "channel" });
  applier.scriptDevice(lamp!, { adopt: "light" });
  const owner = applier.caller("owner-secret");
  const rev = (await applier.call(owner, "describe", {}) as { body: { revision: number } }).body.revision;
  const r = await applier.call(owner, "configure", { changes: [{ op: "upsert", kind: "client",
    value: { id: "steward", credential: "steward-secret", kind: "steward", token_key: "a-token-key-of-sixteen" } }], expected_revision: rev, dry_run: false });
  expect(r.ok).toBe(true);
  cleanup.push(() => applier.stop());
  return applier;
}

describe("the scripted stand-in applier", () => {
  it("describes the devices a test scripts, adopted, with their values, and reports their changes as events", async () => {
    const applier = await standIn();
    const mcp = await serveMcp(applier, await freePort());
    cleanup.push(() => mcp.close());
    const call = await connect(mcp.url, "steward-secret");
    const d = await call("describe");
    expect(d.devices.map((x: { id: string; adopted: boolean; class: string }) => [x.id, x.adopted, x.class]))
      .toEqual([["sim-bridge:channel", true, "channel"], ["sim-bridge:lamp", true, "light"]]);
    expect(d.devices[0].actions.map((a: { action: string }) => a.action)).toEqual(["notify.notify"]);
    expect(d.test_run_id).toBe("run-1");
    // As the reference applier reports it.
    expect(d.standard_version).toBe("0.14");
    expect((await call("state")).targets["sim-bridge:lamp"]).toMatchObject({ liveness: "live", values: [{ key: "on", value: false }] });
    const { cursor } = await call("events");
    applier.scriptValue("sim-bridge:lamp", "on", true);
    applier.scriptDevice(fixtureDevices(["dimmer"])[0]!);
    const e = await call("events", { cursor });
    expect(e.events.map((x: { type: string }) => x.type)).toEqual(["state", "model"]);
  });

  it("describes the keys a device's bridge declares personal (GA-DESC-9)", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const id = applier.scriptDevice(fixtureDevices(["shaker"])[0]!, { adopt: "sensor" });
    const d = ((await applier.call(client, "describe", {})) as { body: any }).body;
    expect(d.devices.find((x: { id: string }) => x.id === id).personal).toEqual(["org.galatea.test.vibration.presence"]);
    expect(d.devices.find((x: { id: string }) => x.id === "sim-bridge:lamp")).not.toHaveProperty("personal");
  });

  it("holds an events long-poll on its clock: a stepped clock ends it, and a model change wakes it", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const events = async (args: Record<string, unknown>) => ((await applier.call(client, "events", args)) as { body: any }).body;
    const { cursor } = await events({});
    let done = false;
    const idle = events({ cursor, wait_s: 30 }).finally(() => { done = true; });
    await new Promise((r) => setTimeout(r, 50));
    expect(done).toBe(false);
    clock.advance(30_000);
    expect(await idle).toEqual({ events: [], cursor, notices: [] });
    const woken = events({ cursor, wait_s: 30 });
    applier.scriptDevice(fixtureDevices(["dimmer"])[0]!);
    expect((await woken).events.map((x: { type: string }) => x.type)).toEqual(["model"]);
  });

  it("records the MCP revision each client's calls came at, and serves only 2025 once told to", async () => {
    const applier = await standIn();
    const mcp = await serveMcp(applier, await freePort());
    cleanup.push(() => mcp.close());
    await (await connect(mcp.url, "steward-secret"))("describe");
    await (await connect(mcp.url, "steward-secret", "legacy"))("describe");
    expect(applier.revisions.get("steward")).toEqual(["2026-07-28", "2025-11-25"]);
    // Once it serves only the 2025 era, a client that negotiates is answered there.
    mcp.onlyLegacy(true);
    await (await connect(mcp.url, "steward-secret"))("describe");
    expect(applier.revisions.get("steward")!.at(-1)).toBe("2025-11-25");
  });

  const address = nonLoopbackAddress();
  it.skipIf(!address)("serves TLS on another address of the host, which a client that validates certificates refuses", async () => {
    const tls = await selfSigned(address!);
    if (!tls) return;
    const applier = await standIn();
    const mcp = await serveMcp(applier, await freePort(), { host: address, tls });
    cleanup.push(() => mcp.close());
    expect(mcp.url.startsWith(`https://${address}:`)).toBe(true);
    await expect(connect(mcp.url, "steward-secret")).rejects.toThrow();
    expect(mcp.connections().tcp).toBeGreaterThan(0);
    expect(mcp.connections().tls).toBe(0);
    expect(applier.revisions.size).toBe(0);
  });

  it("plans each step at its effective tier, in the standard's order: tier, already, toggle_only, token", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const [tv, dimmer] = fixtureDevices(["tv", "dimmer"]);
    applier.scriptDevice(tv!, { adopt: "tv" });
    applier.scriptDevice(dimmer!, { bridge: "far-bridge", adopt: "light" });
    applier.scriptTier("sim-bridge:lamp", "onoff.turn_on", "confirm");
    applier.scriptTier("sim-bridge:lamp", "onoff.turn_off", "no_voice");
    applier.scriptDead("far-bridge", true);
    const by = { for: { endpoint: "e" } };
    const tokenOf = (a: Record<string, unknown>) => signToken({ token_id: String(a.target), issuer: "steward", target: a.target as string,
      action: a.action as string, args: {}, via: "app", brain: false, for: by.for, expires: new Date(Date.now() + 60_000).toISOString() }, "a-token-key-of-sixteen");
    const tvOff = { target: "sim-bridge:tv", action: "onoff.turn_off" };
    const lampOn = { target: "sim-bridge:lamp", action: "onoff.turn_on" };
    const plan = async (actions: Record<string, unknown>[]) => (((await applier.call(client, "plan", { actions: actions.map((a) => ({ args: {},
      via: "app", brain: false, ...by, ...a })) })) as { body: any }).body.steps as { verdict: string; reason?: string; tier: string }[])
      .map((x) => `${x.tier} ${x.verdict}${x.reason ? `(${x.reason})` : ""}`);
    expect(await plan([{ target: "sim-bridge:lamp", action: "onoff.turn_on" }, { target: "sim-bridge:lamp", action: "onoff.turn_off" },
      { target: "sim-bridge:lamp", action: "onoff.turn_off", via: "voice", brain: true }, { target: "sim-bridge:tv", action: "onoff.turn_off" },
      { ...tvOff, token: tokenOf(tvOff) }, { target: "far-bridge:dimmer", action: "onoff.turn_on" },
      { ...lampOn, token: tokenOf(lampOn) }]))
      .toEqual(["confirm refuse(token)", "no_voice skip(already)", "no_voice refuse(tier)", "reversible refuse(toggle_only)", "reversible op",
        "reversible skip(dead)", "confirm op"]);
    expect(applier.requests.at(-1)).toMatchObject({ tool: "plan", target: "sim-bridge:lamp", via: "app", brain: false, args: {} });
    const d = ((await applier.call(client, "describe", {})) as { body: any }).body;
    expect(d.devices.find((x: { id: string }) => x.id === "sim-bridge:lamp").actions.map((a: { tier: string }) => a.tier)).toEqual(["confirm", "no_voice"]);
  });

  it("marks a device internal or infrastructure, a bridge dead, and hides its run id, each a model change but the liveness", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const { cursor } = await body("events");
    applier.scriptMarks("sim-bridge:lamp", { internal: true, infrastructure: true });
    applier.scriptDead("sim-bridge", true);
    applier.hideRunId(true);
    const d = await body("describe");
    expect(d.devices.find((x: { id: string }) => x.id === "sim-bridge:lamp")).toMatchObject({ internal: true, infrastructure: true });
    expect(d.devices.find((x: { id: string }) => x.id === "sim-bridge:channel")).not.toHaveProperty("internal");
    expect(d).not.toHaveProperty("test_run_id");
    expect((await body("state")).targets["sim-bridge:lamp"].liveness).toBe("dead");
    expect((await body("events", { cursor })).events.map((x: { type: string; target?: string }) => `${x.type}${x.target ? ` ${x.target}` : ""}`))
      .toEqual(["model", "liveness sim-bridge:channel", "liveness sim-bridge:lamp", "model"]);
    applier.scriptMarks("sim-bridge:lamp", { internal: false });
    applier.hideRunId(false);
    expect((await body("describe")).test_run_id).toBe("run-1");
    expect((await body("describe")).devices.find((x: { id: string }) => x.id === "sim-bridge:lamp")).not.toHaveProperty("internal");
  });

  it("unadopts a device and forgets one, each a model change", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const { cursor } = await body("events");
    applier.scriptAdopted("sim-bridge:lamp", false);
    applier.scriptForget("sim-bridge:channel");
    const d = await body("describe");
    expect(d.devices.map((x: { id: string; adopted: boolean }) => [x.id, x.adopted])).toEqual([["sim-bridge:lamp", false]]);
    expect(Object.keys((await body("state")).targets)).not.toContain("sim-bridge:channel");
    expect((await body("events", { cursor })).events.map((x: { type: string }) => x.type)).toEqual(["model", "model"]);
    expect(() => applier.scriptForget("sim-bridge:channel")).toThrow(/no scripted device/);
  });

  it("skips a stateful step already in effect, on a closed device, idempotent or not, and never a stateless one", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const [pulse] = fixtureDevices(["pulse"]);
    applier.scriptDevice(pulse!, { adopt: "socket" });
    applier.scriptValue("sim-bridge:pulse", "on", true);
    const plan = async (target: string, action: string, args: Record<string, unknown> = {}) => (((await applier.call(client, "plan", { actions: [{ target, action,
      args, via: "app", brain: false, for: { endpoint: "e" } }] })) as { body: any }).body.steps[0] as { verdict: string; reason?: string });
    expect(await plan("sim-bridge:pulse", "onoff.turn_on")).toMatchObject({ verdict: "skip", reason: "already" });
    expect(await plan("sim-bridge:channel", "notify.notify", { text: "x" })).toMatchObject({ verdict: "op" });
  });
  it("counts a token as none unless its proof holds, its issuer sent it, it names the step and it has not expired past 5 s; an author's for never lifts a toggle", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const [tv] = fixtureDevices(["tv"]);
    applier.scriptDevice(tv!, { adopt: "tv" });
    applier.scriptTier("sim-bridge:lamp", "onoff.turn_on", "confirm");
    const client = applier.caller("steward-secret");
    const lampOn = { target: "sim-bridge:lamp", action: "onoff.turn_on", args: {}, via: "app", brain: false, for: { person: "demo", endpoint: "e" } };
    const sign = (over: Record<string, unknown> = {}, key = "a-token-key-of-sixteen", step: Record<string, any> = lampOn) =>
      signToken({ token_id: "t", issuer: "steward", ...step, expires: new Date(clock.now() + 60_000).toISOString(), ...over } as never, key);
    const verdict = async (step: Record<string, unknown>, token: unknown) => {
      const r = await applier.call(client, "plan", { actions: [{ ...step, token }] }) as { body: any };
      const x = r.body.steps[0];
      return `${x.verdict}${x.reason ? `(${x.reason})` : ""}`;
    };
    expect(await verdict(lampOn, sign())).toBe("op");
    expect(await verdict(lampOn, sign({}, "another-key-of-sixteen"))).toBe("refuse(token)");
    expect(await verdict(lampOn, { ...sign(), proof: sign().proof.replace(/^./, (c) => (c === "A" ? "B" : "A")) })).toBe("refuse(token)");
    expect(await verdict(lampOn, sign({ issuer: "someone-else" }))).toBe("refuse(token)");
    expect(await verdict(lampOn, sign({ via: "voice" }))).toBe("refuse(token)");
    expect(await verdict(lampOn, sign({ for: { person: "demo", endpoint: "another" } }))).toBe("refuse(token)");
    expect(await verdict(lampOn, sign({ expires: new Date(clock.now() - 4_000).toISOString() }))).toBe("op");
    expect(await verdict(lampOn, sign({ expires: new Date(clock.now() - 6_000).toISOString() }))).toBe("refuse(token)");
    expect(await verdict(lampOn, sign({ expires: new Date(clock.now() + 301_000).toISOString() }))).toBe("refuse(token)");
    // GA-PLAN-8: a rule's, or a run's with no person and no endpoint, counts as none for a toggle.
    const tvOff = { target: "sim-bridge:tv", action: "onoff.turn_off", args: {}, via: "app", brain: false };
    for (const forWhom of [{ rule: "r1" }, { run: "x" }]) {
      const step = { ...tvOff, for: forWhom };
      expect(await verdict(step, sign({}, undefined, step))).toBe("refuse(toggle_only)");
    }
    const asked = { ...tvOff, for: { run: "x", endpoint: "hall-panel" } };
    expect(await verdict(asked, sign({}, undefined, asked))).toBe("op");
    const faults = applier.requests.filter((r) => r.tokenFault).map((r) => r.tokenFault);
    expect(faults).toEqual(["its proof does not hold", "its proof does not hold", "issued by another client than the one that sent it",
      "it names another via", "it names another for", "it expired", "it expires more than 300 s ahead"]);
    expect(JSON.stringify(applier.requests)).not.toContain(sign().proof);
  });

  it("dispatches a scripted step and has its device answer: a closed device's value set, caused by the apply, and the step acked", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const forWhom = { person: "demo", endpoint: "e", apply: "steward-apply-1" };
    const { cursor } = (await applier.call(client, "events", {}) as { body: any }).body;
    const r = await applier.call(client, "apply", { request: { actions: [{ target: "sim-bridge:lamp", action: "onoff.turn_on", args: {}, via: "app",
      brain: false, for: forWhom }] }, idempotency_key: "k-1" }) as { body: any };
    expect(r.body.outcomes.map((o: any) => o.outcome)).toEqual(["dispatched"]);
    expect(applier.requests.at(-1)).toMatchObject({ tool: "apply", key: "k-1", token: false });
    clock.advance(SCRIPTED_ACK_MS);
    const events = (await applier.call(client, "events", { cursor }) as { body: any }).body.events;
    expect(events.map((e: any) => [e.type, e.key ?? e.outcome, e.value ?? e.apply_id])).toEqual([["state", "on", true], ["outcome", "acked", r.body.apply_id]]);
    expect(events[0].cause).toEqual({ apply: r.body.apply_id, client: "steward", for: forWhom });
    expect((await applier.call(client, "outcome", { apply_id: r.body.apply_id }) as { body: any }).body.outcomes[0]).toMatchObject({ outcome: "acked" });
  });

  it("reports a scripted value with its cause, external unless told, one device's liveness, and an owner's freshness bound", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const [motion] = fixtureDevices(["motion"]);
    applier.scriptDevice(motion!, { adopt: "sensor" });
    const { cursor } = await body("events");
    applier.scriptValue("sim-bridge:lamp", "on", true);
    applier.scriptValue("sim-bridge:lamp", "on", false, { cause: "load_cap" });
    applier.scriptLiveness("sim-bridge:motion", "stale");
    applier.scriptFresh("sim-bridge:motion", 600);
    const events = (await body("events", { cursor })).events;
    expect(events.map((e: any) => `${e.type} ${e.type === "state" ? e.cause : e.type === "liveness" ? `${e.old}>${e.new}` : ""}`.trim()))
      .toEqual(["state external", "state load_cap", "liveness live>stale", "model"]);
    const d = (await body("describe")).devices.find((x: { id: string }) => x.id === "sim-bridge:motion");
    expect(d).toMatchObject({ sensor_keys: ["motion"], fresh_s: 600, fresh_basis: "configured", fresh_slack_s: 11 });
    expect((await body("state")).targets["sim-bridge:motion"]).toMatchObject({ liveness: "stale", fresh_s: 600, fresh_basis: "configured" });
    expect((await body("state")).targets["sim-bridge:lamp"]).toMatchObject({ liveness: "live", fresh_s: 60, fresh_basis: "declared" });
    applier.scriptFresh("sim-bridge:motion", null);
    expect((await body("state")).targets["sim-bridge:motion"]).toMatchObject({ fresh_s: null, fresh_basis: "unknown" });
  });

  it("carries a notice in every events response until a client takes it, and answers a waiting long-poll with it", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const events = async (args: Record<string, unknown>) => ((await applier.call(client, "events", args)) as { body: any }).body;
    const { cursor } = await events({});
    const waiting = events({ cursor, wait_s: 30 });
    applier.scriptNotice({ notice_id: "n-1", cause: "safety_rule", rule_id: "leak", text: "Протечка" });
    expect((await waiting).notices).toEqual([{ notice_id: "n-1", cause: "safety_rule", rule_id: "leak", text: "Протечка" }]);
    expect((await events({})).notices.map((n: any) => n.notice_id)).toEqual(["n-1"]);
    expect((await events({ cursor, notice_taken: ["n-1"] })).notices).toEqual([]);
    expect(applier.taken).toEqual(["n-1"]);
    expect(applier.pendingNotices()).toEqual([]);
  });

  it("ends a notify delivered on a channel that confirms it, sent on one declared confirms: false", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    applier.scriptDevice(fixtureDevices(["pager"])[0]!, { adopt: "channel" });
    const notify = (target: string, key: string) => applier.call(client, "apply", { request: { actions: [{ target, action: "notify.notify",
      args: { text: "x", urgency: "info" }, via: "rule", brain: false, for: { notice: "n-1" } }] }, idempotency_key: key }) as Promise<{ body: any }>;
    const a = (await notify("sim-bridge:channel", "k-1")).body.apply_id;
    const b = (await notify("sim-bridge:pager", "k-2")).body.apply_id;
    clock.advance(SCRIPTED_ACK_MS);
    const outcome = async (apply_id: string) => ((await applier.call(client, "outcome", { apply_id })) as { body: any }).body.outcomes[0].outcome;
    expect([await outcome(a), await outcome(b)]).toEqual(["delivered", "sent"]);
  });

  it("refuses a notify's from as an argument it does not know while it reports a standard_version below 0.10", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const plan = async (args: Record<string, unknown>) => (((await applier.call(client, "plan", { actions: [{ target: "sim-bridge:channel",
      action: "notify.notify", args, via: "rule", brain: false, for: { notice: "n-1" } }] })) as { body: any }).body.steps[0]);
    const withFrom = { text: "x", urgency: "info", from: { notice: "n-1" } };
    expect(await plan(withFrom)).toMatchObject({ verdict: "op" });
    applier.scriptVersion("0.8");
    expect(((await applier.call(client, "describe", {})) as { body: any }).body.standard_version).toBe("0.8");
    expect(await plan(withFrom)).toMatchObject({ verdict: "refuse", reason: "invalid_args" });
    expect(await plan({ text: "x", urgency: "info" })).toMatchObject({ verdict: "op" });
  });

  it("scripts a computer: its accounts and session keys, session.lock setting the account's key, already on a locked one, and an account retired", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const laptop = applier.scriptDevice(fixtureDevices(["laptop"])[0]!, { adopt: "computer" });
    const described = (await body("describe")).devices.find((x: { id: string }) => x.id === laptop);
    expect(described).toMatchObject({ class: "computer", capabilities: ["session"], accounts: { liza: "Лиза", dmitry: "Дмитрий" } });
    expect(described.actions.map((a: { action: string }) => a.action)).toEqual(["session.lock"]);
    expect((await body("state")).targets[laptop].values.map((v: any) => `${v.key} ${v.value}`)).toEqual(["session.liza active", "session.dmitry locked"]);
    const lock = (account: string, key: string) => body("apply", { request: { actions: [{ target: laptop, action: "session.lock", args: { account },
      via: "rule", brain: false, for: { rule: "limit" } }] }, idempotency_key: key });
    const { cursor } = await body("events");
    expect((await lock("liza", "k-1")).outcomes[0].outcome).toBe("dispatched");
    clock.advance(SCRIPTED_ACK_MS);
    const events = (await body("events", { cursor })).events;
    expect(events.filter((e: any) => e.type === "state").map((e: any) => `${e.key} ${e.value}`)).toEqual(["session.liza locked"]);
    expect((await lock("dmitry", "k-2")).outcomes[0]).toMatchObject({ outcome: "skipped", reason: "already" });
    applier.scriptValue(laptop, "session.dmitry", "disconnected", { cause: "device" });
    expect((await lock("dmitry", "k-3")).outcomes[0]).toMatchObject({ outcome: "skipped", reason: "already" });
    const { cursor: before } = await body("events");
    applier.scriptAccounts(laptop, { dmitry: "Дмитрий" });
    expect((await body("events", { cursor: before })).events.map((e: any) => e.type)).toEqual(["model"]);
    expect((await body("describe")).devices.find((x: { id: string }) => x.id === laptop).accounts).toEqual({ dmitry: "Дмитрий" });
    expect((await body("state")).targets[laptop].values.map((v: any) => v.key)).toEqual(["session.dmitry"]);
  });
  it("scripts how a step ends: failed with a reason after a given time, failed(no_ack) and unanswered at ack_within_s, each once, in order", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const [ac] = fixtureDevices(["ac"]);
    applier.scriptDevice(ac!, { adopt: "ac" });
    const lamp = "sim-bridge:lamp";
    const ackS = (await body("describe")).devices.find((x: { id: string }) => x.id === lamp).actions[0].ack_within_s;
    applier.scriptOutcome(lamp, "onoff.turn_on", { outcome: "failed", reason: "rejected", afterMs: 1_000 });
    applier.scriptOutcome(lamp, "onoff.turn_on", { outcome: "failed", reason: "no_ack" });
    applier.scriptOutcome("sim-bridge:ac", "climate.set_mode", { outcome: "unanswered" });
    let n = 0;
    const act = (target: string, action: string, args: Record<string, unknown> = {}) => body("apply", { request: { actions: [{ target, action, args,
      via: "rule", brain: false, for: { rule: "r" } }] }, idempotency_key: `k-${++n}` });
    const outcome = async (apply_id: string) => (await body("outcome", { apply_id })).outcomes[0];
    const first = (await act(lamp, "onoff.turn_on")).apply_id;
    clock.advance(999);
    expect((await outcome(first)).outcome).toBe("dispatched");
    clock.advance(1);
    expect(await outcome(first)).toMatchObject({ outcome: "failed", reason: "rejected" });
    const second = (await act(lamp, "onoff.turn_on")).apply_id;
    const cool = (await act("sim-bridge:ac", "climate.set_mode", { mode: "cool" })).apply_id;
    clock.advance(ackS * 1000 - 1);
    expect([(await outcome(second)).outcome, (await outcome(cool)).outcome]).toEqual(["dispatched", "dispatched"]);
    clock.advance(1);
    expect(await outcome(second)).toMatchObject({ outcome: "failed", reason: "no_ack" });
    expect((await outcome(cool)).outcome).toBe("unanswered");
    expect((await body("state")).targets[lamp].values).toContainEqual(expect.objectContaining({ key: "on", value: false }));
    // The script used, the device answers by itself again.
    const third = (await act(lamp, "onoff.turn_on")).apply_id;
    clock.advance(SCRIPTED_ACK_MS);
    expect((await outcome(third)).outcome).toBe("acked");
  });

  it("gives a failed step its late_ack on a test's word: the device's value moves, caused by the apply, and a late_ack event names the apply and step", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const laptop = applier.scriptDevice(fixtureDevices(["laptop"])[0]!, { adopt: "computer" });
    applier.scriptOutcome(laptop, "session.lock", { outcome: "failed", reason: "not_locked", afterMs: 1_000 });
    const forWhom = { rule: "limit" };
    const r = await body("apply", { request: { actions: [{ target: laptop, action: "session.lock", args: { account: "liza" }, via: "rule", brain: false,
      for: forWhom }] }, idempotency_key: "k-1" });
    clock.advance(1_000);
    const { cursor } = await body("events");
    expect(() => applier.scriptLateAck("sim-bridge:lamp")).toThrow();
    applier.scriptLateAck(laptop);
    const events = (await body("events", { cursor })).events;
    expect(events.map((e: any) => [e.type, e.key, e.value])).toEqual([["state", "session.liza", "locked"], ["late_ack", "session.liza", "locked"]]);
    const cause = { apply: r.apply_id, client: "steward", for: forWhom };
    expect(events[0].cause).toEqual(cause);
    expect(events[1]).toMatchObject({ apply_id: r.apply_id, step_id: "s1", target: laptop, cause });
    expect((await body("outcome", { apply_id: r.apply_id })).outcomes[0]).toMatchObject({ outcome: "failed", reason: "not_locked" });
    expect(() => applier.scriptLateAck(laptop)).toThrow();
  });

  it("re-declares an action toggles: true, or not, as its bridge would; a model change", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const tv = applier.scriptDevice(fixtureDevices(["tv"])[0]!, { adopt: "tv" });
    const turnOff = async () => (await body("describe")).devices.find((x: { id: string }) => x.id === tv).actions.find((a: any) => a.action === "onoff.turn_off");
    expect(await turnOff()).toMatchObject({ toggles: true });
    const { cursor } = await body("events");
    applier.scriptToggles(tv, "onoff.turn_off", false);
    expect((await turnOff()).toggles).toBeUndefined();
    applier.scriptToggles(tv, "onoff.turn_off", true);
    expect(await turnOff()).toMatchObject({ toggles: true });
    expect((await body("events", { cursor })).events.map((e: any) => e.type)).toEqual(["model", "model"]);
  });
});

describe("the scripted stand-in: an unreachable end and refused plans (the milestone review, B5)", () => {
  it("ends a scripted step unreachable at SCRIPTED_ACK_MS, and refuses the next scripted number of plans, then plans again", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const call = (tool: string, args: Record<string, unknown> = {}) => applier.call(client, tool, args) as Promise<{ ok: boolean; body?: any; error?: string }>;
    const lamp = "sim-bridge:lamp";
    applier.scriptOutcome(lamp, "onoff.turn_on", { outcome: "unreachable" });
    const request = { actions: [{ target: lamp, action: "onoff.turn_on", args: {}, via: "rule", brain: false, for: { rule: "r" } }] };
    const r = (await call("apply", { request, idempotency_key: "k-1" })).body;
    clock.advance(SCRIPTED_ACK_MS);
    expect((await call("outcome", { apply_id: r.apply_id })).body.outcomes[0]).toMatchObject({ outcome: "unreachable" });
    applier.scriptRefusePlans(2);
    expect((await call("plan", request)).ok).toBe(false);
    expect((await call("plan", request)).ok).toBe(false);
    expect((await call("plan", request)).ok).toBe(true);
  });

  it("fires a scripted safety rule under no client: its latch set, its actuation's state and outcome naming it, and rule_fired once complete; describe and state list it", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const [valve] = fixtureDevices(["valve"]);
    applier.scriptDevice(valve!, { adopt: "water_valve" });
    applier.scriptSafetyRule({ id: "leak", actuates: [{ target: "sim-bridge:valve", key: "open", value: false }], latch: true });
    applier.scriptSafetyRule({ id: "plain", actuates: [{ target: "sim-bridge:lamp", key: "on", value: true }] });
    expect((await body("describe")).safety_rules.map((r: any) => `${r.id}${r.latch ? " latch" : ""}`)).toEqual(["leak latch", "plain"]);
    const { cursor } = await body("events");
    applier.scriptSafetyFire("leak", { complete: false });
    applier.scriptSafetyFire("plain");
    const shown = (e: any) => `${e.type} ${e.rule_id ?? ""} ${e.target ?? ""} ${e.latch ?? e.outcome ?? JSON.stringify(e.cause ?? e.devices ?? "")}`.trim();
    expect((await body("events", { cursor })).events.map(shown)).toEqual([
      "latch leak  set", 'state  sim-bridge:valve {"safety_rule":"leak"}', "outcome leak sim-bridge:valve acked",
      'state  sim-bridge:lamp {"safety_rule":"plain"}', "outcome plain sim-bridge:lamp acked", 'rule_fired plain  ""']);
    expect((await body("state")).latches).toEqual([{ rule_id: "leak", since: expect.any(String) }]);
    const c2 = (await body("events")).cursor;
    applier.scriptSafetyComplete("leak");
    applier.scriptLatchClear("leak", "cleared_by_owner");
    expect((await body("events", { cursor: c2 })).events.map(shown)).toEqual(['rule_fired leak  ""', "latch leak  cleared_by_owner"]);
    expect((await body("state")).latches).toEqual([]);
    // history matches a rule_fired or latch event by the devices its rule actuates.
    const h = (await body("history", { from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z", targets: ["sim-bridge:valve"] })).events;
    expect(h.map(shown)).toEqual(["latch leak  set", 'state  sim-bridge:valve {"safety_rule":"leak"}', "outcome leak sim-bridge:valve acked",
      'rule_fired leak  ""', "latch leak  cleared_by_owner"]);
  });

  it("opens a gap: a follower's long-poll sees nothing past it, history keeps it, and its close expires every cursor given before", async () => {
    const clock = new SteppedClock();
    const applier = await standIn(clock);
    const client = applier.caller("steward-secret");
    const call = (tool: string, args: Record<string, unknown> = {}) => applier.call(client, tool, args);
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await call(tool, args)) as { body: any }).body;
    const { cursor } = await body("events");
    applier.scriptValue("sim-bridge:lamp", "on", true);
    const seen = await body("events", { cursor });
    expect(seen.events.map((e: any) => e.type)).toEqual(["state"]);
    applier.scriptGap();
    applier.scriptValue("sim-bridge:lamp", "on", false);
    applier.scriptEvent("route_conflict", { identifier: "0x00158d0001", bridges: ["sim-bridge", "other-bridge"] });
    const waiting = body("events", { cursor: seen.cursor, wait_s: 30 });
    clock.advance(30_000);
    expect(await waiting).toMatchObject({ events: [], cursor: seen.cursor });
    const held = call("events", { cursor: seen.cursor, wait_s: 30 });
    applier.scriptGapEnd();
    expect(await held).toMatchObject({ ok: false, error: "cursor_expired" });
    expect(await call("events", { cursor })).toMatchObject({ ok: false, error: "cursor_expired" });
    const fresh = (await body("events")).cursor;
    applier.scriptValue("sim-bridge:lamp", "on", true);
    expect((await body("events", { cursor: fresh })).events.map((e: any) => `${e.type} ${e.value}`)).toEqual(["state true"]);
    const h = (await body("history", { from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" })).events;
    expect(h.filter((e: any) => e.type !== "model").map((e: any) => `${e.type} ${e.value ?? e.identifier}`))
      .toEqual(["state true", "state false", "route_conflict 0x00158d0001", "state true"]);
  });

  it("closes a gap without expiring: the events of the gap are served", async () => {
    const applier = await standIn();
    const client = applier.caller("steward-secret");
    const body = async (tool: string, args: Record<string, unknown> = {}) => ((await applier.call(client, tool, args)) as { body: any }).body;
    const { cursor } = await body("events");
    applier.scriptGap();
    applier.scriptValue("sim-bridge:lamp", "on", true);
    expect((await body("events", { cursor })).events).toEqual([]);
    applier.scriptGapEnd({ expire: false });
    expect((await body("events", { cursor })).events.map((e: any) => e.type)).toEqual(["state"]);
  });
});
