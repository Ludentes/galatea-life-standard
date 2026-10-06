import { randomUUID } from "node:crypto";
import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { pollUntil, sleep } from "../../util.js";
import { sign } from "../token.js";
import { advanceTo, computer, eventsOf, lastDevices, livenessWithin, oneSecond, ownerConfigure, SIM_PC, simPc, snapshots, stillBefore, TV,
  wire } from "../util.js";

// Slice 6a: safety rules fire and guard; the Safe claim. Slice 6b: latches, re-sends, the waiting and
// late_ack notices, liveness notices and a rule disabled on a declaration change. Slice 6c: the heating
// cap, witnesses, and the broker's host's administrators. Slice 7b: each graded across a clean restart or
// a crash (a latch, a notice, a said stop, a running rule, a seen basis, an on-time, a cap, a watch).

const LEAK = "sim-bridge:leak";
const VALVE = "sim-bridge:valve";
const PULSE = "sim-bridge:pulse";
const AC = "sim-bridge:ac";
const PUSHER = "sim-bridge:pusher";
const HEATER = "sim-bridge:heater";
const RELAY = "sim-bridge:relay";
const RFPLUG = "sim-bridge:rfplug";
const THERMO = "sim-bridge:thermo";
const UNBOUND = "sim-bridge:unbound";
/** The pusher's extension action: its effect the applier cannot know. */
const SET_MODE = "org.galatea.test.pusher.set_mode";
const WET = { device: LEAK, key: "leak", op: "eq", value: true };
type Notice = { notice_id: string; cause: string; rule_id?: string; devices?: string[]; text: string; outcomes?: Outcome[]; waiting?: true };
type Outcome = { target: string; outcome: string; reason?: string };

/** A rule closing the valve on a leak, in the build's provisional language (configure.safety_rule.json). */
const leakRule = (id: string, extra: Record<string, unknown> = {}) => ({ op: "upsert", kind: "safety_rule",
  value: { id, trigger: WET, actions: [{ target: VALVE, action: "valve.close" }], ...extra } });
const ask = (target: string, action: string, args: Record<string, unknown> = {}) =>
  ({ target, action, args, via: "app", brain: false, for: { person: "demo" } });
const short = (o: Outcome | undefined) => (o ? `${o.outcome}${o.reason ? `(${o.reason})` : ""}` : "none");

async function configured(ctx: TestContext, changes: unknown[], why: string): Promise<void> {
  const r = await ownerConfigure(ctx.owner!, changes);
  must(r.ok, `${why} returned ${r.ok ? "" : `${r.error}: ${r.message}`}`, r.body);
}

async function refusedAs(ctx: TestContext, changes: unknown[], why: string): Promise<string> {
  const r = await ownerConfigure(ctx.owner!, changes);
  must(!r.ok && r.error === "invalid_request", `${why} returned ${r.ok ? "a result" : r.error}`, r.body);
  return r.ok ? "" : r.message;
}

const report = (ctx: TestContext, device: string, values: Record<string, unknown>, at = ctx.time.now()) =>
  ctx.bridge!.control({ requestId: `safe-${randomUUID()}`, op: "report", device, values, observedAt: wire(at) });

/** The actions the bridge received for `device` since `from`. */
const received = (ctx: TestContext, device: string, from = 0) => ctx.bridge!.received.slice(from).filter((x) => x.device === device);

async function noticesOf(ctx: TestContext, cause: string): Promise<Notice[]> {
  return ((await ctx.mcp!.callOk("events")).notices as Notice[]).filter((n) => n.cause === cause);
}

/** The `rule_fired` events of `ruleId` after `cursor`, once there are `n`. */
const firedWithin = (ctx: TestContext, cursor: string, ruleId: string, n: number, ms: number, why: string) => pollUntil(async () => {
  const e = (await eventsOf(ctx.mcp!, cursor, "rule_fired")).filter((x) => x.rule_id === ruleId);
  return e.length >= n ? e : undefined;
}, ms, why, 50);

/** The action's `ack_within_s`, as the subject's `describe` gives it. */
async function ackWithinS(ctx: TestContext, target: string, action: string): Promise<number> {
  const d = ((await ctx.owner!.callOk("describe")).devices as { id: string; actions: { action: string; ack_within_s: number }[] }[])
    .find((x) => x.id === target);
  const s = d?.actions.find((a) => a.action === action)?.ack_within_s;
  must(typeof s === "number", `describe gives ${target}'s ${action} an ack_within_s`, d);
  return s!;
}

/**
 * "Nothing yet" while the subject's time is still before `dueMs`, an event the subject owes no sooner.
 * The subject's time is real time plus an offset, so the test's own real time (its chunk steps, polls
 * and sleeps) can carry it past `dueMs` on a loaded machine, and a conforming subject has then acted.
 * The count is read first, then the clock: only a count read before `dueMs` less a second of skew is
 * asserted; after it the check is skipped and said. This is the harness's patience, never a bound of
 * the standard.
 */
async function noneYet(ctx: TestContext, dueMs: number, count: () => number | Promise<number>, what: string): Promise<void> {
  const n = await count();
  const late = ctx.time.now() - (dueMs - oneSecond(ctx));
  if (late >= 0) {
    ctx.evidence(`${what}: not checked, the harness's clock already ${late} ms past the time it could be asserted`);
    return;
  }
  mustEqual(n, 0, what);
}

/** The subject's held value of `key` on `device`, from `state`. */
async function heldValue(ctx: TestContext, device: string, key: string): Promise<unknown> {
  const t = (await ctx.mcp!.callOk("state", { targets: [device] })).targets?.[device];
  return ((t?.values ?? []) as { key: string; value: unknown }[]).find((v) => v.key === key)?.value;
}

/**
 * Waits for the subject to hold `device`'s `key` at `value`, reporting it again, stamped with the
 * harness's time, while it does not. The time server stops waiting for a subject that has not asked
 * for the time within half a second, so on a loaded machine the subject's clock can lag the harness's
 * by more than the 5 s a bridge's stamp may run ahead (GA-BUS-2): the simulated bridge's report is then
 * refused as observed ahead, as it should be, and a bridge would report again. `sent` says the first
 * report was already sent (by the test, or by the simulated device after a command). This is the
 * harness's patience, never a bound of the standard; each report sent again is said in the evidence.
 */
async function held(ctx: TestContext, device: string, key: string, value: unknown, why: string, sent = true): Promise<void> {
  for (let i = 0; i < 3; i++) {
    if (i > 0 || !sent) {
      if (i > 0) ctx.evidence(`${why}: not held after ${2 * oneSecond(ctx)} ms, reported again at the harness's time`);
      await report(ctx, device.slice(device.indexOf(":") + 1), { [key]: value });
    }
    try {
      await pollUntil(async () => (await heldValue(ctx, device, key)) === value, 2 * oneSecond(ctx), why);
      return;
    } catch (err) {
      if (i === 2) throw err;
    }
  }
}

requirement("GA-DESC-6", {
  seam: "applier", fixture: { devices: ["lamp"] },
  covers: "over the simulated bridge, describe claims Safe with box true and ungoverned empty; a path the bridge's status declares ungoverned is listed under it, and the Safe claim and its configure changes lapse until the path goes. An adapter's engine paths and a child's are the adapters' and the meta-applier's slices'; box refused over plain TCP off loopback is unit-tested, the harness's broker being on loopback",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  const d = await owner.callOk("describe");
  ctx.evidence(`levels ${JSON.stringify(d.levels)}, box ${JSON.stringify(d.box)}, ungoverned ${JSON.stringify(d.ungoverned)}`);
  must(d.levels.includes("Safe") && d.box === true && Array.isArray(d.ungoverned) && d.ungoverned.length === 0,
    "a Safe applier over bridges: Safe in levels, box true, ungoverned empty", d);
  // Declared in every status from now, the periodic ones included.
  const PATH = "a vendor cloud app switches the lamp";
  bridge.setFaults({ ungoverned: [PATH] });
  await bridge.publishStatus();
  const lapsed = await pollUntil(async () => {
    const x = await owner.callOk("describe");
    return !x.levels.includes("Safe") ? x : undefined;
  }, oneSecond(ctx), "the Safe claim lapsing once the bridge declares an ungoverned path");
  ctx.evidence(`with an ungoverned path: levels ${JSON.stringify(lapsed.levels)}, ungoverned ${JSON.stringify(lapsed.ungoverned)}`);
  must(JSON.stringify(lapsed.ungoverned).includes(PATH), "the bridge's ungoverned path listed in describe", lapsed.ungoverned);
  const r = await ownerConfigure(owner, [{ op: "upsert", kind: "safety_rule", value: { id: "desc-6",
    trigger: { device: "sim-bridge:lamp", key: "on", op: "eq", value: true }, actions: [{ target: "sim-bridge:lamp", action: "onoff.turn_off" }] } }]);
  must(!r.ok && r.error === "not_claimed", `a safety rule while Safe has lapsed returned ${r.ok ? "a result" : r.error}`, r.body);
  bridge.setFaults({ ungoverned: [] });
  await bridge.publishStatus();
  await pollUntil(async () => (await owner.callOk("describe")).levels.includes("Safe"), oneSecond(ctx), "the Safe claim back once the path goes");
});

requirement("GA-DESC-8", {
  seam: "applier", fixture: { devices: ["heater", "lamp"] },
  covers: "every socket in describe declares a load; a socket adopted with none configured is heating, its turn_on above reversible",
}, async (ctx) => {
  const { owner, bridge } = { owner: ctx.owner!, bridge: ctx.bridge! };
  await bridge.control({ requestId: "desc-8", op: "join", device: "kettle", capabilities: ["onoff"], feedback: "closed" });
  await pollUntil(async () => ((await owner.callOk("describe")).devices as { id: string }[]).some((x) => x.id === "sim-bridge:kettle"),
    oneSecond(ctx), "the kettle in describe");
  await configured(ctx, [{ op: "upsert", kind: "adopt", value: { device: "sim-bridge:kettle", class: "socket" } }], "the kettle's adoption");
  const devices = (await owner.callOk("describe")).devices as { id: string; class: string | null; load?: string; actions: { action: string; tier: string }[] }[];
  const sockets = devices.filter((x) => x.class === "socket");
  ctx.evidence(`sockets: ${JSON.stringify(sockets.map((x) => [x.id, x.load]))}`);
  must(sockets.length >= 2 && sockets.every((x) => typeof x.load === "string"), "a load declared on every socket", sockets);
  const kettle = sockets.find((x) => x.id === "sim-bridge:kettle")!;
  mustEqual(kettle.load, "heating", "the load of a socket never configured");
  const on = kettle.actions.find((a) => a.action === "onoff.turn_on")?.tier;
  must(on !== undefined && on !== "reversible", `a heating socket's turn_on is ${on}, not above reversible`, kettle);
});

requirement("GA-SAFE-1", {
  seam: "applier", fixture: { devices: ["leak", "valve"] },
  covers: "with the harness's client disconnected, a leak rule fires on the sensor's report: the valve is sent valve.close; the client, back, finds the rule_fired event and the completion notice naming the valve acked; and a wet report made while the applier was down fires the rule once it is back, no client connected",
}, async (ctx) => {
  await configured(ctx, [leakRule("safe-1")], "the leak rule");
  const { cursor } = await ctx.mcp!.callOk("events");
  // No client: its session is closed before the sensor reports, and reopened only once the valve has its command.
  await ctx.mcp!.close();
  const mark = ctx.bridge!.received.length;
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => received(ctx, "valve", mark).length > 0, oneSecond(ctx), "the valve sent valve.close on a leak, no client connected");
  ctx.evidence(`the valve received ${JSON.stringify(received(ctx, "valve", mark).map((x) => x.action))} with no client connected`);
  mustEqual(received(ctx, "valve", mark).map((x) => x.action), ["valve.close"], "the valve's actions");
  const mcp = await ctx.mcp!.reconnect();
  try {
      const fired = await pollUntil(async () => (await eventsOf(mcp, cursor, "rule_fired")).find((x) => x.rule_id === "safe-1"),
        2 * oneSecond(ctx), "the rule_fired event, read by the client back");
      const n = (((await mcp.callOk("events")).notices as Notice[]).filter((x) => x.cause === "safety_rule"))
        .find((x) => x.rule_id === "safe-1");
      ctx.evidence(`rule_fired: ${JSON.stringify(fired)}; notice: ${JSON.stringify(n)}`);
      mustEqual((fired.outcomes as Outcome[]).map((o) => [o.target, short(o)]), [[VALVE, "acked"]], "the rule_fired event's outcomes");
      must(n !== undefined && n.notice_id === fired.notice, "the completion notice the rule_fired event names", n);
  } finally {
    await mcp.close();
  }
  // A report made while the applier was down (applier, *Restarts*): it fires on the applier's return.
  await report(ctx, "leak", { leak: false });
  await ctx.time.advance(1000);
  const down = ctx.bridge!.received.length;
  await ctx.restartApplier!({ between: () => report(ctx, "leak", { leak: true }) });
  await ctx.mcp!.close();
  await pollUntil(async () => received(ctx, "valve", down).length > 0, 2 * oneSecond(ctx),
    "the valve sent valve.close for a wet report made while the applier was down");
  ctx.evidence(`after the restart: the valve received ${JSON.stringify(received(ctx, "valve", down).map((x) => x.action))}`);
});

requirement("GA-SAFE-2", {
  seam: "applier", fixture: { devices: ["leak", "valve"] },
  covers: "from the leak rule's firing until its valve.close acks, a client's plan and apply for the valve are refuse(safety) and refused(safety), nothing of theirs sent; once complete they are not. A latch's refusal after completion is GA-SAFE-7's",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  await configured(ctx, [leakRule("safe-2")], "the leak rule");
  await bridge.control({ requestId: "safe-2-slow", op: "commandResult", device: "valve", result: "confirmed", afterMs: 3000 });
  const { cursor } = await mcp.callOk("events");
  const mark = bridge.received.length;
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => received(ctx, "valve", mark).length > 0, oneSecond(ctx), "the valve sent valve.close on a leak");
  const plan = await mcp.callOk("plan", { actions: [ask(VALVE, "valve.close")] });
  ctx.evidence(`plan while the rule runs: ${JSON.stringify(plan.steps)}`);
  mustEqual([plan.steps[0]?.verdict, plan.steps[0]?.reason], ["refuse", "safety"], "a plan for the valve while the rule runs");
  const r = await mcp.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [ask(VALVE, "valve.close")] } });
  mustEqual(short(r.outcomes[0]), "refused(safety)", "an apply for the valve while the rule runs");
  mustEqual(received(ctx, "valve", mark).length, 1, "commands the valve received while the rule ran");
  await firedWithin(ctx, cursor, "safe-2", 1, 3000 + 2 * oneSecond(ctx), "the rule complete once the valve acks");
  const after = await mcp.callOk("plan", { actions: [ask(VALVE, "valve.close")] });
  must(after.steps[0]?.reason !== "safety", "a plan for the valve once the rule is complete is no refuse(safety)", after.steps);
});

requirement("GA-SAFE-3", {
  seam: "applier", fixture: { devices: ["leak", "pulse", "valve"] }, timeoutMs: 120_000,
  covers: "a rule whose one actuation nothing answers, on a pump reporting on, is not complete, no rule_fired, before the actuation's bound; complete once it is failed(no_ack), rule_fired then naming it. A GA-SAFE-12 re-send pending is graded under GA-SAFE-12. "
    + "A latching rule closing the valve whose firing could not commit (the store stalled on the tables subject.json's stall_tables names, every table when it names none) and the applier crashed: after the restart, with no new report, the rule completes, its latch never held with no run "
    + "(a database: true subject only; without a store to stall, a firing commits before any crash the harness can time, and the clause is not graded, nor where the lock cannot be taken). "
    + "Whether the valve closed before the crash is evidence only: a subject that writes its firing before it acts does not. "
    + "Proposed for applier 0.16, recorded and never failing this id: the close sent again after the crash carries the first's commandId, and the simulated bridge does it once",
}, async (ctx) => {
  const { mcp, bridge } = { mcp: ctx.mcp!, bridge: ctx.bridge! };
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-3", trigger: WET,
    actions: [{ target: PULSE, action: "onoff.turn_off" }] } }], "a leak rule cutting the pump");
  const bound = await ackWithinS(ctx, PULSE, "onoff.turn_off");
  // The pump is on, so a report of its state never matches the turn_off nothing answers.
  await report(ctx, "pulse", { on: true });
  await bridge.control({ requestId: "safe-3-none", op: "commandResult", device: "pulse", result: "none" });
  const { cursor } = await mcp.callOk("events");
  // Counted from before the leak's report, so the time measured is never less than the actuation's own.
  const leakAt = ctx.time.now();
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => received(ctx, "pulse").length > 0, oneSecond(ctx), "the pump sent onoff.turn_off on a leak");
  // The harness's clock flows while stepped and while the events settle: step to an absolute time, a
  // second's settling and a second's margin before the bound, and check it still is (the 5b preflight's I5).
  await advanceTo(ctx, leakAt + bound * 1000 - 1000 - oneSecond(ctx), { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  const early = await eventsOf(mcp, cursor, "rule_fired");
  stillBefore(ctx, leakAt, bound * 1000, "no rule_fired before the actuation's bound");
  mustEqual(early.length, 0, `rule_fired events before the actuation's bound (${bound} s): ${JSON.stringify(early)}`);
  await advanceTo(ctx, leakAt + bound * 1000 + 2000);
  const [fired] = await firedWithin(ctx, cursor, "safe-3", 1, 2 * oneSecond(ctx), "rule_fired once the actuation is failed(no_ack)");
  ctx.evidence(`rule_fired: ${JSON.stringify(fired)}`);
  mustEqual((fired.outcomes as Outcome[]).map((o) => [o.target, short(o)]), [[PULSE, "failed(no_ack)"]], "the complete rule's outcomes");

  // A firing that a crash may have half kept (applier, *Restarts*: a fired rule's run).
  await configured(ctx, [{ op: "delete", kind: "safety_rule", value: { id: "safe-3" } },
    leakRule("safe-3-v", { latch: { condition: { device: LEAK, key: "leak", op: "eq", value: false } } })], "a latching leak rule closing the valve");
  if (!ctx.stallStore) {
    ctx.evidence("no database: the half-kept firing is not graded");
    return;
  }
  await report(ctx, "leak", { leak: false });
  const mark = bridge.received.length;
  const cmdMark = bridge.commands.length;
  let release: () => Promise<void>;
  try {
    release = await ctx.stallStore(ctx.stallTables);
  } catch (err) {
    ctx.evidence(`the store's tables ${JSON.stringify(ctx.stallTables ?? "all")} could not be locked (${String(err)}): the half-kept firing is not graded`);
    return;
  }
  await report(ctx, "leak", { leak: true });
  // A subject that writes its firing before it acts does not close the valve while its store is stalled:
  // whether it did is evidence, never a verdict (the 7b preflight's I3).
  const closed = await pollUntil(async () => received(ctx, "valve", mark).length > 0, oneSecond(ctx), "the valve closed on the leak")
    .then(() => true, () => false);
  ctx.evidence(closed ? "the valve closed before the crash, the store stalled" : "the valve not closed before the crash, the store stalled");
  await ctx.restartApplier!({ crash: true, between: release });
  // No new report: the wet status, retained, is delivered again at the start.
  const done = await pollUntil(async () => ((await ctx.mcp!.callOk("events")).notices as Notice[])
    .find((n) => n.cause === "safety_rule" && n.rule_id === "safe-3-v" && !n.waiting), 3 * oneSecond(ctx),
  "the rule complete after the restart, its firing half kept by the crash");
  ctx.evidence(`after the restart: ${JSON.stringify(done)}`);
  // The same command, the same id (the maintainer's ruling 2, proposed for applier 0.16; 0.14's text does not
  // hold it, so it never fails this id): a close sent again after the crash carries the first's
  // commandId, and the bridge does it once (GA-BRIDGE-4). Recorded as a proposed clause, which the
  // reference's matrix grades `draws-a-fresh-command-id` by.
  const ids = new Set(bridge.commands.slice(cmdMark).filter((c) => c.device === "valve").map((c) => c.commandId));
  const note = `valve commandIds across the crash: ${[...ids].join(", ")}; actuations ${received(ctx, "valve", mark).length}`;
  ctx.evidence(note);
  ctx.proposed?.("same-command-same-id", ids.size === 1, note);
});

requirement("GA-SAFE-5", {
  seam: "applier", fixture: { devices: ["leak", "pulse"] }, timeoutMs: 90_000,
  covers: "the pulse relay's turn_off, declared not idempotent, sent by a leak rule to the pump reporting on and answered by nothing, is actuated once through 5 s past its bound: no reissue",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-5", trigger: WET,
    actions: [{ target: PULSE, action: "onoff.turn_off" }] } }], "a leak rule cutting the pump");
  const bound = await ackWithinS(ctx, PULSE, "onoff.turn_off");
  // The pump is on, so a report of its state never acks the turn_off nothing answers: it ends failed(no_ack).
  await report(ctx, "pulse", { on: true });
  await bridge.control({ requestId: "safe-5-none", op: "commandResult", device: "pulse", result: "none" });
  const mark = bridge.received.length;
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => received(ctx, "pulse", mark).length > 0, oneSecond(ctx), "the pump sent onoff.turn_off on a leak");
  await ctx.time.advance(bound * 1000 + 5000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  ctx.evidence(`the pulse relay received ${JSON.stringify(received(ctx, "pulse", mark).map((x) => x.action))}`);
  mustEqual(received(ctx, "pulse", mark).length, 1, "physical actuations of the pulse relay");
});

requirement("GA-SAFE-6", {
  seam: "applier", fixture: { devices: ["leak", "valve"] },
  covers: "configure refuses a rule actuating a valve whose other_admins is unknown, or lists another admin, without accepts_other_admins: true, and takes it with. A simulated PC bridge's computer, not adopted, carrying proposedInfrastructure and an os administrator, makes a rule actuating the valve behind the other bridge need accepts_other_admins; adopted and marked applier_host, it does not; its applier_host cleared is an other_admin notice for the rule, naming the computer and the valve. The applier owns every device (no child); hosted devices are the PC build's",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const doc = lastDevices(bridge);
  const valve = doc.devices.find((d) => d.id === "valve")!;
  const leak = doc.devices.find((d) => d.id === "leak")!;
  // A snapshot's answer re-publishes the bridge's own devices document over the test's; the start-up
  // one may still be on its way, so the bridge answers no request and a second passes first.
  bridge.holdRequests(true);
  await sleep(oneSecond(ctx));
  try {
  // No bound is graded here: how soon describe shows a re-sent devices document is the harness's patience, not the standard's.
  const withAdmins = async (otherAdmins: unknown) => {
    await bridge.publishRaw("devices", { ...doc, devices: [leak, { ...valve, otherAdmins }] }, true);
    await pollUntil(async () => {
      const v = ((await ctx.owner!.callOk("describe")).devices as { id: string; other_admins: unknown }[]).find((x) => x.id === VALVE);
      return JSON.stringify(v?.other_admins) === JSON.stringify(otherAdmins);
    }, 10_000, `the valve's other_admins ${JSON.stringify(otherAdmins)}`);
  };
  for (const admins of ["unknown", [{ vendor: "demo", label: "a cloud app" }]]) {
    await withAdmins(admins);
    const why = await refusedAs(ctx, [leakRule("safe-6")], `a rule actuating a valve with other_admins ${JSON.stringify(admins)}`);
    ctx.evidence(`refused: ${why}`);
  }
  await configured(ctx, [leakRule("safe-6", { accepts_other_admins: true })], "the rule with accepts_other_admins");
  await configured(ctx, [{ op: "delete", kind: "safety_rule", value: { id: "safe-6" } }], "the rule's delete");
  await withAdmins([]);
  await configured(ctx, [leakRule("safe-6")], "the rule on a valve with no other admin");
  } finally {
    bridge.holdRequests(false);
  }

  // The broker's host: its administrators reach every bridge's commands.
  const BOX = `${SIM_PC}:box`;
  await simPc(ctx, [computer("box", { proposedInfrastructure: true })]);
  ctx.evidence(`refused, the broker's host not adopted: ${await refusedAs(ctx, [leakRule("safe-6-pc")], "a rule on the valve beside a computer carrying the broker")}`);
  await configured(ctx, [{ op: "upsert", kind: "adopt", value: { device: BOX, class: "computer" } },
    { op: "upsert", kind: "applier_host", value: { device: BOX, applier_host: true } }], "the broker's host adopted as the applier's own");
  await configured(ctx, [leakRule("safe-6-pc")], "the rule on the valve once the broker's host is the applier_host");
  await configured(ctx, [{ op: "delete", kind: "applier_host", value: { device: BOX } }], "applier_host cleared");
  const n = await pollUntil(async () => (await noticesOf(ctx, "other_admin")).find((x) => x.rule_id === "safe-6-pc"),
    oneSecond(ctx), "an other_admin notice for the rule once the broker's host is no longer the applier_host");
  ctx.evidence(`notice: ${JSON.stringify(n)}`);
  must(n.devices?.includes(BOX) === true && n.devices.includes(VALVE), "the other_admin notice names the computer and the valve", n);
});

requirement("GA-SAFE-8", {
  seam: "applier", fixture: { devices: ["leak", "valve", "pulse"] }, timeoutMs: 120_000,
  covers: `a complete leak rule is a notice with an id, cause safety_rule, its rule_id and each final outcome, carried by every events response until a client's notice_taken names it; the applier has no channel of its own. With the valve dead the rule's close waits: a notice at once, before any rule_fired, replaced by the completion notice once the valve is back and acks. A pump's turn_off nothing answers ends failed(no_ack), and the pump's later report of off is a late_ack and a second notice. The completion notice, not taken, is carried after a clean restart`,
}, async (ctx) => {
  let mcp = ctx.mcp!;
  await configured(ctx, [leakRule("safe-8", { notice: { text: "A leak closed the valve." } })], "the leak rule");
  const { cursor } = await mcp.callOk("events");
  await report(ctx, "leak", { leak: true });
  const [fired] = await firedWithin(ctx, cursor, "safe-8", 1, 2 * oneSecond(ctx), "the rule complete");
  const [n] = (await noticesOf(ctx, "safety_rule")).filter((x) => x.rule_id === "safe-8");
  ctx.evidence(`notice: ${JSON.stringify(n)}; rule_fired: ${JSON.stringify(fired)}`);
  must(n !== undefined && typeof n.notice_id === "string" && n.notice_id.length > 0, "a safety_rule notice with an id", n);
  mustEqual(n!.outcomes?.map((o) => [o.target, short(o)]), [[VALVE, "acked"]], "the notice's outcomes");
  mustEqual(fired.notice, n!.notice_id, "the rule_fired event's notice");
  await sleep(oneSecond(ctx));
  must((await noticesOf(ctx, "safety_rule")).some((x) => x.notice_id === n!.notice_id), "the notice still carried before it is taken");
  // A notice not yet taken is kept across a restart (applier, *Restarts*: "notices not yet taken").
  await ctx.restartApplier!();
  mcp = ctx.mcp!;
  const carried = (await noticesOf(ctx, "safety_rule")).find((x) => x.notice_id === n!.notice_id);
  ctx.evidence(`after a restart: ${JSON.stringify(carried)}`);
  must(carried !== undefined, "the untaken completion notice carried after a restart", carried);
  await mcp.callOk("events", { notice_taken: [n!.notice_id] });
  must(!(await noticesOf(ctx, "safety_rule")).some((x) => x.notice_id === n!.notice_id), "the notice gone once taken");

  // The valve dead: the rule's close waits, and a notice says so at once, before the rule is complete.
  const bridge = ctx.bridge!;
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: false });
  await bridge.setAvailable("valve", false);
  await livenessWithin(ctx, VALVE, "dead", oneSecond(ctx), "after available: false");
  const { cursor: waits } = await mcp.callOk("events");
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: true });
  const waiting = await pollUntil(async () => (await noticesOf(ctx, "safety_rule")).find((x) => x.rule_id === "safe-8"),
    oneSecond(ctx), "a notice at once while the valve's close waits");
  const early = (await eventsOf(mcp, waits, "rule_fired")).filter((x) => x.rule_id === "safe-8");
  ctx.evidence(`while the close waits: notice ${JSON.stringify(waiting)}; rule_fired ${JSON.stringify(early)}`);
  mustEqual(early.length, 0, "rule_fired events while the valve's close waits");
  await bridge.setAvailable("valve", true);
  const [done] = await firedWithin(ctx, waits, "safe-8", 1, 3 * oneSecond(ctx), "the rule complete once the valve is back and acks");
  const now = (await noticesOf(ctx, "safety_rule")).filter((x) => x.rule_id === "safe-8");
  ctx.evidence(`once complete: ${JSON.stringify(now)}`);
  must(!now.some((x) => x.notice_id === waiting.notice_id) && now.some((x) => x.notice_id === done.notice),
    "the waiting notice replaced by the completion notice", now);
  await mcp.callOk("events", { notice_taken: now.map((x) => x.notice_id) });

  // A pump's turn_off nothing answers ends failed(no_ack); the pump's later report of off is a late_ack, and a second notice.
  await configured(ctx, [{ op: "delete", kind: "safety_rule", value: { id: "safe-8" } }, { op: "upsert", kind: "safety_rule",
    value: { id: "safe-8-pump", trigger: WET, actions: [{ target: PULSE, action: "onoff.turn_off" }] } }], "a leak rule cutting the pump");
  const bound = await ackWithinS(ctx, PULSE, "onoff.turn_off");
  await report(ctx, "pulse", { on: true });
  await bridge.control({ requestId: "safe-8-none", op: "commandResult", device: "pulse", result: "none" });
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: false });
  const { cursor: late } = await mcp.callOk("events");
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => received(ctx, "pulse").length > 0, oneSecond(ctx), "the pump sent onoff.turn_off on a leak");
  await ctx.time.advance(bound * 1000 + 2000, { chunkMs: 5000 });
  const [failed] = await firedWithin(ctx, late, "safe-8-pump", 1, 2 * oneSecond(ctx), "the pump rule complete, failed(no_ack)");
  mustEqual((failed.outcomes as Outcome[]).map((o) => [o.target, short(o)]), [[PULSE, "failed(no_ack)"]], "the pump rule's outcomes");
  await report(ctx, "pulse", { on: false });
  const second = await pollUntil(async () => (await noticesOf(ctx, "safety_rule"))
    .find((x) => x.rule_id === "safe-8-pump" && x.notice_id !== failed.notice), oneSecond(ctx), "a second notice on the pump's late ack");
  ctx.evidence(`the second notice: ${JSON.stringify(second)}`);
  must(second.devices?.includes(PULSE) === true, "the second notice names the pump", second);
});

requirement("GA-SAFE-11", {
  seam: "applier", fixture: { devices: ["leak", "valve", "ac"] },
  covers: "a wet report the applier held before the leak rule was configured, re-delivered retained when the applier reconnects to the broker, does not fire it; a later wet report does. Then the rule fires once per its trigger becoming true: not again on a new wet report, nor on one from a fast clock, and again after a dry report; a rule reading the IR air conditioner's mode never fires on the value assumed from its last command; configure refuses two rules setting the valve's open differently; and across a clean restart, the wet report it held, re-delivered retained, does not fire it. A sensor whose bound is not known, and a dead one, are GA-SAFE-10's notices",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  let mcp = ctx.mcp!;
  const mark = bridge.received.length;
  // The sensor is wet before any rule reads it, and the applier holds that report.
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => (((await mcp.callOk("state", { targets: [LEAK] })).targets[LEAK]?.values ?? []) as { key: string; value: unknown }[])
    .some((v) => v.key === "leak" && v.value === true), oneSecond(ctx), "the applier holding the sensor's wet report");
  await configured(ctx, [leakRule("safe-11")], "the leak rule");
  const { cursor } = await mcp.callOk("events");
  // The applier's broker connection drops and comes back: the retained status, the same basis_time, is delivered again (and the snapshot sends it once more).
  const n = snapshots(bridge);
  ctx.link!.sever();
  await livenessWithin(ctx, LEAK, "dead", oneSecond(ctx), "with the broker cut");
  ctx.link!.restore();
  await pollUntil(async () => snapshots(bridge) > n, 10_000, "a snapshot request after the applier reconnected");
  await sleep(oneSecond(ctx));
  mustEqual(received(ctx, "valve", mark).length, 0, "valve commands after the held wet report was delivered again");
  // A retained status never revives a device (GA-BUS-8): live statuses until none of the three reads dead, as the setup does.
  await pollUntil(async () => {
    await bridge.publishStatus();
    const s = await mcp.callOk("state", { targets: [LEAK, VALVE, AC] });
    return [LEAK, VALVE, AC].every((t) => s.targets?.[t] && s.targets[t].liveness !== "dead");
  }, 10_000, "the devices alive again after the broker came back", 250);
  // A clean restart: the seen basis is kept, so the held wet report, delivered again at the start, is no new report.
  await ctx.restartApplier!();
  mcp = ctx.mcp!;
  await sleep(oneSecond(ctx));
  mustEqual(received(ctx, "valve", mark).length, 0, "valve commands after a restart re-delivered the held wet report");
  const early = (await eventsOf(mcp, cursor, "rule_fired")).filter((x) => x.rule_id === "safe-11");
  ctx.evidence(`after the held report was delivered again: ${received(ctx, "valve", mark).length} valve commands, rule_fired ${JSON.stringify(early)}`);
  mustEqual(early.length, 0, "rule_fired events after the held wet report was delivered again");
  mustEqual(received(ctx, "valve", mark).length, 0, "valve commands once the devices are alive again, no new report");
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: true });
  await firedWithin(ctx, cursor, "safe-11", 1, 2 * oneSecond(ctx), "the rule complete on the first wet report after it was configured");
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: true });
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: false });
  // A value stamped 6 s ahead of the applier's clock never becomes the last seen (GA-BUS-2): no trigger becoming true.
  await report(ctx, "leak", { leak: true }, ctx.time.now() + 6000);
  await sleep(oneSecond(ctx));
  mustEqual(received(ctx, "valve", mark).length, 1, "valve commands after a repeat, a dry report and a fast-clock wet one");
  await ctx.time.advance(8000);
  await report(ctx, "leak", { leak: true });
  await firedWithin(ctx, cursor, "safe-11", 2, 2 * oneSecond(ctx), "the rule fired again after a dry report");
  mustEqual(received(ctx, "valve", mark).length, 2, "valve commands after dry and wet again");

  // The air conditioner's mode is assumed from its last command: no report, no fire.
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-11-ac", trigger: { device: AC, key: "mode", op: "eq", value: "heat" },
    actions: [{ target: VALVE, action: "valve.close" }] } }], "a rule reading the air conditioner's mode");
  const before = received(ctx, "valve").length;
  const r = await mcp.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [ask(AC, "climate.set_mode", { mode: "heat" })] } });
  await pollUntil(async () => {
    const o = (await mcp.callOk("outcome", { apply_id: r.apply_id })).outcomes[0];
    return o?.outcome === "sent" || o?.outcome === "unanswered" ? o : undefined;
  }, 15_000, "the air conditioner's mode sent");
  const s = await mcp.callOk("state", { targets: [AC] });
  ctx.evidence(`the air conditioner's state: ${JSON.stringify(s.targets[AC]?.values)}`);
  await sleep(oneSecond(ctx));
  mustEqual(received(ctx, "valve").length, before, "valve commands after the air conditioner's assumed heat");

  const why = await refusedAs(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-11-dry", trigger: { ...WET, value: false },
    actions: [{ target: VALVE, action: "valve.open" }] } }], "a second rule opening the valve the first closes");
  ctx.evidence(`refused: ${why}`);
});

requirement("GA-SAFE-13", {
  seam: "applier", fixture: { devices: ["leak", "tv", "heater", "relay"] },
  covers: `configure refuses a safety rule whose action is the IR TV's onoff.turn_off, declared toggles: true. A rule cutting the heater, whose bridge then declares its onoff.turn_off toggles: true, is disabled with a rule_disabled notice naming it and the heater, and a leak no longer fires it (no rule_fired); that the heater is sent nothing would hold for a rule kept too, since dispatch refuses a toggle (toggle_only). configure refuses load: heating on the relay, whose onoff.turn_off toggles; the relay adopted again with no load is a load_cap notice naming it. That a cap whose turn-off a declaration change makes a toggle is a notice, and never sends it, is unit-tested. After a clean restart the rule stays disabled: a new leak still fires nothing`,
}, async (ctx) => {
  ctx.evidence(`refused: ${await refusedAs(ctx, [{ op: "upsert", kind: "load", value: { device: RELAY, load: "heating" } }], "load: heating on the toggling relay")}`);
  await configured(ctx, [{ op: "delete", kind: "adopt", value: { device: RELAY } }], "the relay's adoption deleted");
  await configured(ctx, [{ op: "upsert", kind: "adopt", value: { device: RELAY, class: "socket" } }], "the relay adopted with no load");
  const capped = await pollUntil(async () => (await noticesOf(ctx, "load_cap")).find((x) => x.devices?.includes(RELAY)),
    oneSecond(ctx), "a load_cap notice for a socket adopted with a toggling turn-off and no load");
  ctx.evidence(`notice: ${JSON.stringify(capped)}`);

  const why = await refusedAs(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-13", trigger: WET,
    actions: [{ target: TV, action: "onoff.turn_off" }] } }], "a rule sending the TV's toggling turn_off");
  ctx.evidence(`refused: ${why}`);

  const bridge = ctx.bridge!;
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-13-heat", trigger: WET,
    actions: [{ target: HEATER, action: "onoff.turn_off" }] } }], "a leak rule cutting the heater");
  // The heater's bridge re-teaches it: its turn_off now toggles (an IR code learnt again). A snapshot's
  // answer would re-publish the bridge's own document over it: the bridge answers no request, a second first.
  bridge.holdRequests(true);
  await sleep(oneSecond(ctx));
  try {
    const doc = lastDevices(bridge);
    await bridge.publishRaw("devices", { ...doc, devices: doc.devices.map((d) => d.id !== "heater" ? d : { ...d,
      actions: (d.actions as { action: string }[]).map((a) => a.action === "onoff.turn_off" ? { ...a, idempotent: false, toggles: true } : a) }) }, true);
    const n = await pollUntil(async () => ((await ctx.mcp!.callOk("events")).notices as Notice[])
      .find((x) => x.cause === "rule_disabled" && x.rule_id === "safe-13-heat"), 10_000, "a rule_disabled notice once the heater's turn_off toggles");
    ctx.evidence(`notice: ${JSON.stringify(n)}`);
    must(n.devices?.includes(HEATER) === true, "the rule_disabled notice names the heater", n);
    const mark = bridge.received.length;
    const { cursor } = await ctx.mcp!.callOk("events");
    await report(ctx, "leak", { leak: true });
    await sleep(oneSecond(ctx));
    mustEqual(received(ctx, "heater", mark).length, 0, "heater commands on a leak once the rule is disabled");
    // A rule kept would fire and be refused toggle_only at dispatch, sending nothing either way; a disabled one does not fire.
    const fired = (await eventsOf(ctx.mcp!, cursor, "rule_fired")).filter((e) => e.rule_id === "safe-13-heat");
    mustEqual(fired.length, 0, "rule_fired events of the disabled rule on a leak");
    // Disabled across a restart: the configuration keeps it (applier, *Restarts*).
    await ctx.restartApplier!();
    const { cursor: after } = await ctx.mcp!.callOk("events");
    await ctx.time.advance(1000);
    await report(ctx, "leak", { leak: false });
    await ctx.time.advance(1000);
    await report(ctx, "leak", { leak: true });
    await sleep(oneSecond(ctx));
    mustEqual(received(ctx, "heater", mark).length, 0, "heater commands on a leak after a restart, the rule disabled");
    const again = (await eventsOf(ctx.mcp!, after, "rule_fired")).filter((e) => e.rule_id === "safe-13-heat");
    mustEqual(again.length, 0, "rule_fired events of the disabled rule on a leak after a restart");
  } finally {
    bridge.holdRequests(false);
  }
});

requirement("GA-SAFE-7", {
  seam: "applier", fixture: { devices: ["leak", "valve", "pusher", "ac"] },
  covers: `a leak rule closing the valve and turning the pusher off, whose latch needs the sensor dry and the IR air conditioner's mode off: once complete, a plan to open the valve is refuse(latched), an apply of the pusher's extension set_mode refused(latched) and nothing sent, a plan to close the valve not latched; a dry report and the air conditioner's mode only assumed off keep it held; once the owner clears it, opening the valve is no_voice, refuse(token) with a token for a rule and op with a person's; and after a clean restart a plan to open the valve is still refuse(latched)`,
}, async (ctx) => {
  const bridge = ctx.bridge!;
  let mcp = ctx.mcp!;
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-7", trigger: WET,
    actions: [{ target: VALVE, action: "valve.close" }, { target: PUSHER, action: "onoff.turn_off" }],
    latch: { condition: { all: [{ ...WET, value: false }, { device: AC, key: "mode", op: "eq", value: "off" }] } } } }], "the latched leak rule");
  const { cursor } = await mcp.callOk("events");
  await report(ctx, "leak", { leak: true });
  await firedWithin(ctx, cursor, "safe-7", 1, 3 * oneSecond(ctx), "the rule complete");
  const open = (await mcp.callOk("plan", { actions: [ask(VALVE, "valve.open")] })).steps[0];
  ctx.evidence(`plan to open the valve once complete: ${JSON.stringify(open)}`);
  mustEqual([open?.verdict, open?.reason], ["refuse", "latched"], "a plan to open the valve while the latch is held");
  // A latch is held across a restart (applier, *Restarts*: "latches and their state").
  await ctx.restartApplier!();
  mcp = ctx.mcp!;
  const kept = (await mcp.callOk("plan", { actions: [ask(VALVE, "valve.open")] })).steps[0];
  ctx.evidence(`plan to open the valve after a restart: ${JSON.stringify(kept)}`);
  mustEqual([kept?.verdict, kept?.reason], ["refuse", "latched"], "a plan to open the valve after a restart, the latch held");
  const mark = bridge.received.length;
  const ext = await mcp.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [ask(PUSHER, SET_MODE, { mode: "click" })] } });
  ctx.evidence(`the pusher's set_mode while the latch is held: ${JSON.stringify(ext.outcomes)}`);
  mustEqual(short(ext.outcomes[0]), "refused(latched)", "an apply of the pusher's extension action while the latch is held");
  mustEqual(received(ctx, "pusher", mark).length, 0, "pusher commands while the latch is held");
  const close = (await mcp.callOk("plan", { actions: [ask(VALVE, "valve.close")] })).steps[0];
  must(close?.reason !== "latched", "a plan to close the valve again is no undo", close);

  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: false });
  const ac = await mcp.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [ask(AC, "climate.set_mode", { mode: "off" })] } });
  await pollUntil(async () => {
    const o = (await mcp.callOk("outcome", { apply_id: ac.apply_id })).outcomes[0];
    return o?.outcome === "sent" || o?.outcome === "unanswered" ? o : undefined;
  }, 15_000, "the air conditioner's mode sent");
  await sleep(oneSecond(ctx));
  const held = ((await mcp.callOk("state", {})).latches ?? []) as { rule_id: string }[];
  ctx.evidence(`latches with the sensor dry and the air conditioner's mode assumed off: ${JSON.stringify(held)}`);
  must(held.some((l) => l.rule_id === "safe-7"), "the latch held while the air conditioner's mode is only assumed", held);
  const still = (await mcp.callOk("plan", { actions: [ask(VALVE, "valve.open")] })).steps[0];
  mustEqual(still?.reason, "latched", "a plan to open the valve with the latch still held");

  await configured(ctx, [{ op: "upsert", kind: "clear_latch", value: { rule_id: "safe-7" } }], "the owner's clear_latch");
  const after = (await mcp.callOk("plan", { actions: [ask(VALVE, "valve.open")] })).steps[0];
  ctx.evidence(`plan to open the valve once the owner cleared the latch: ${JSON.stringify(after)}`);
  mustEqual(after?.tier, "no_voice", "opening the valve's tier once the latch cleared, until it runs");
  // Its token's `for` must name a person: a rule's token does not stand, a person's does.
  const byRule = { ...ask(VALVE, "valve.open"), via: "rule", for: { rule: "evening" } };
  const ruled = (await mcp.callOk("plan", { actions: [{ ...byRule, token: sign(ctx, byRule) }] })).steps[0];
  ctx.evidence(`plan to open the valve with a rule's token: ${JSON.stringify(ruled)}`);
  mustEqual([ruled?.verdict, ruled?.reason], ["refuse", "token"], "opening the valve with a rule's token once the latch cleared");
  const byPerson = ask(VALVE, "valve.open");
  const person = (await mcp.callOk("plan", { actions: [{ ...byPerson, token: sign(ctx, byPerson) }] })).steps[0];
  ctx.evidence(`plan to open the valve with a person's token: ${JSON.stringify(person)}`);
  mustEqual(person?.verdict, "op", "opening the valve with a person's token once the latch cleared");
});

requirement("GA-SAFE-9", {
  seam: "applier", fixture: { devices: ["leak", "valve"] },
  covers: `a latched leak rule's firing is a latch event set naming the rule and the valve, and state lists the held latch; the sensor's dry report is a latch event cleared, and state lists none; configure refuses clear_latch with no latch held; fired again, the owner's clear_latch is a latch event cleared_by_owner. A latch held across a restart is GA-SAFE-7's`,
}, async (ctx) => {
  const mcp = ctx.mcp!;
  await configured(ctx, [leakRule("safe-9", { latch: { condition: { ...WET, value: false } } })], "the latched leak rule");
  const { cursor } = await mcp.callOk("events");
  const latches = (n: number, why: string) => pollUntil(async () => {
    const e = (await eventsOf(mcp, cursor, "latch")).filter((x) => x.rule_id === "safe-9");
    return e.length >= n ? e : undefined;
  }, 2 * oneSecond(ctx), why, 50);
  const held = async () => (((await mcp.callOk("state", {})).latches ?? []) as { rule_id: string; devices: string[] }[])
    .filter((l) => l.rule_id === "safe-9");
  await report(ctx, "leak", { leak: true });
  const [set] = await latches(1, "a latch event when the rule fires");
  ctx.evidence(`latch event: ${JSON.stringify(set)}; state: ${JSON.stringify(await held())}`);
  mustEqual([set!.latch, set!.devices], ["set", [VALVE]], "the latch event on firing");
  mustEqual((await held()).map((l) => l.devices), [[VALVE]], "the held latch state lists");
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: false });
  const [, cleared] = await latches(2, "a latch event when the sensor reports dry");
  mustEqual(cleared!.latch, "cleared", "the latch event on a dry report");
  mustEqual(await held(), [], "held latches once cleared");
  const why = await refusedAs(ctx, [{ op: "upsert", kind: "clear_latch", value: { rule_id: "safe-9" } }], "clear_latch with no latch held");
  ctx.evidence(`refused: ${why}`);
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: true });
  await latches(3, "the latch set again");
  await configured(ctx, [{ op: "upsert", kind: "clear_latch", value: { rule_id: "safe-9" } }], "the owner's clear_latch");
  const [, , , owner] = await latches(4, "a latch event when the owner clears it");
  mustEqual(owner!.latch, "cleared_by_owner", "the latch event on the owner's clear_latch");
});

requirement("GA-SAFE-10", {
  seam: "applier", fixture: { devices: ["leak", "valve", "unbound"] }, timeoutMs: 120_000,
  covers: `liveness notices for a leak rule's sensor and valve: at once when the sensor goes dead, replaced by one when it is live again; after the bridge's graceful offline none within 55 s, then one for each device still dead past 60 s, each replaced on the bridge's return; the bridge's second graceful offline within 10 min at once. A rule on a sensor whose fresh_s is not known is a notice, and so is an owner's fresh_s of 600 over the sensor's declared 60. The broker's loss is unit-tested. After a clean restart the sensor's return is said. Proposed for applier 0.16, recorded and never failing this id: a stop said before the restart is not said again after it, past 60 s`,
}, async (ctx) => {
  const bridge = ctx.bridge!;
  let mcp = ctx.mcp!;
  await configured(ctx, [leakRule("safe-10")], "the leak rule");
  const lv = async (device: string) => (await noticesOf(ctx, "liveness")).filter((x) => x.rule_id === "safe-10" && x.devices?.includes(device));
  const take = async () => mcp.callOk("events", { notice_taken: (await noticesOf(ctx, "liveness")).map((x) => x.notice_id) });

  // Not live: at once; live again: a notice replacing it.
  await bridge.setAvailable("leak", false);
  const [stop] = await pollUntil(async () => { const n = await lv(LEAK); return n.length ? n : undefined; },
    oneSecond(ctx), "a notice at once when the sensor goes dead");
  // Said once across a restart (applier, *Restarts*): a start is the broker's loss, but this stop was said already.
  await ctx.restartApplier!({ dead: ["leak"] });
  mcp = ctx.mcp!;
  // Chunks well under the applier's 5 s skew bound: the dead sensor's bridge still checks it in while time
  // passes, and a check-in stamped a whole 5 s chunk ahead of the applier's clock (it takes each step on its
  // next time query) marks the sensor fast, never live on its return (GA-BUS-2).
  await ctx.time.advance(61_000, { chunkMs: 2000 });
  await sleep(oneSecond(ctx));
  // Whether the stop's own notice is still listed is GA-SAFE-8's: only a new one is looked for here.
  // 0.14's text does not forbid saying it again after a restart: recorded as a clause proposed for
  // 0.16, never failing this id (the controller's ruling on the 7b preflight's M5).
  const after = (await lv(LEAK)).filter((x) => x.notice_id !== stop!.notice_id);
  const note = `the sensor's new liveness notices 61 s after a restart: ${JSON.stringify(after)}`;
  ctx.evidence(note);
  ctx.proposed?.("said-stop-not-said-again", after.length === 0, note);
  await bridge.setAvailable("leak", true);
  const [again] = await pollUntil(async () => { const n = (await lv(LEAK)).filter((x) => x.notice_id !== stop!.notice_id); return n.length ? n : undefined; },
    oneSecond(ctx), "a notice when the sensor is live again");
  ctx.evidence(`dead: ${JSON.stringify(stop)}; live again: ${JSON.stringify(again)}`);
  mustEqual((await lv(LEAK)).map((x) => x.notice_id), [again!.notice_id], "the sensor's notices once it is live again: the newer replaces the older");
  await take();

  // A graceful offline: no notice inside 60 s; one for each device still dead past it. The test sends the
  // statuses from here on, and the bridge answers no request until it is back: a snapshot's answer
  // re-publishes the status live (the start-up one may still be on its way, so a second passes first).
  bridge.setQuiet(true);
  bridge.holdRequests(true);
  await sleep(oneSecond(ctx));
  const offlineAt = ctx.time.now();
  await bridge.publishStatus({ state: "offline", graceful: true });
  await livenessWithin(ctx, LEAK, "dead", oneSecond(ctx), "after its bridge's graceful offline");
  await sleep(oneSecond(ctx));
  // To an absolute time, 2 s and a second's settling before the 60 s (the 5b preflight's M2).
  await advanceTo(ctx, offlineAt + 58_000 - oneSecond(ctx), { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  const quiet = await noticesOf(ctx, "liveness");
  stillBefore(ctx, offlineAt, 60_000, "no liveness notice within 60 s of a graceful offline");
  ctx.evidence(`notices just before 60 s into a graceful reload: ${JSON.stringify(quiet)}`);
  mustEqual(quiet.length, 0, "liveness notices within 60 s of a graceful offline");
  await advanceTo(ctx, offlineAt + 61_000, { chunkMs: 5000 });
  for (const d of [LEAK, VALVE]) {
    await pollUntil(async () => (await lv(d)).length > 0, oneSecond(ctx), `a notice for ${d}, still dead 60 s after the graceful offline`);
  }
  await bridge.publishStatus();
  await livenessWithin(ctx, LEAK, "live", oneSecond(ctx), "its bridge back");
  await take();

  // Its second graceful offline within 10 min: at once.
  await bridge.publishStatus({ state: "offline", graceful: true });
  await pollUntil(async () => (await lv(LEAK)).length > 0, oneSecond(ctx), "a notice at once on the bridge's second graceful offline within 10 min");
  await bridge.publishStatus();
  bridge.holdRequests(false);
  bridge.setQuiet(false);
  await livenessWithin(ctx, LEAK, "live", oneSecond(ctx), "its bridge back");
  await take();

  // A rule on a sensor whose fresh_s is not known; an owner's fresh_s longer than the declared one.
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-10-unbound",
    trigger: { device: UNBOUND, key: "temperature", op: "gt", value: 60 }, actions: [{ target: VALVE, action: "valve.close" }] } }],
  "a rule on a sensor with no bound");
  const unbound = (await noticesOf(ctx, "liveness")).filter((x) => x.rule_id === "safe-10-unbound" && x.devices?.includes(UNBOUND));
  ctx.evidence(`on configuring a rule on the unbound sensor: ${JSON.stringify(unbound)}`);
  mustEqual(unbound.length, 1, "notices for a rule's sensor whose fresh_s is not known");
  await configured(ctx, [{ op: "upsert", kind: "fresh_s", value: { device: LEAK, fresh_s: 600 } }], "an owner's fresh_s of 600 on the sensor");
  const longer = await lv(LEAK);
  ctx.evidence(`on a longer fresh_s: ${JSON.stringify(longer)}`);
  mustEqual(longer.length, 1, "notices for the sensor once its owner's fresh_s is longer than declared");
});

requirement("GA-SAFE-12", {
  seam: "applier", fixture: { devices: ["leak", "valve", "pulse"] }, timeoutMs: 120_000,
  covers: `a leak rule's close skipped on a dead valve is not complete and sends nothing while the valve is dead, then is sent within 1 s of its return, the rule complete acked; a rule closing the valve and cutting the pump, both unanswered, sends the idempotent close again past its bound, which acks, and never the pump's not-idempotent turn_off, the rule complete with the pump failed(no_ack). A latch's wanting, a report that it landed and the unanswered open device are unit-tested. `
    + "A close waiting on a dead valve across a clean restart sends nothing while the valve is still dead, and is sent on the valve's return after it, the rule then complete acked; a run past its hour, and an actuation's attempts kept across a restart, are unit-tested",
}, async (ctx) => {
  const bridge = ctx.bridge!;
  await configured(ctx, [leakRule("safe-12")], "the leak rule");
  await bridge.setAvailable("valve", false);
  await livenessWithin(ctx, VALVE, "dead", oneSecond(ctx), "after available: false");
  const { cursor } = await ctx.mcp!.callOk("events");
  const mark = bridge.received.length;
  await report(ctx, "leak", { leak: true });
  await sleep(oneSecond(ctx));
  const early = (await eventsOf(ctx.mcp!, cursor, "rule_fired")).filter((x) => x.rule_id === "safe-12");
  ctx.evidence(`with the valve dead: ${received(ctx, "valve", mark).length} valve commands; rule_fired ${JSON.stringify(early)}`);
  mustEqual(received(ctx, "valve", mark).length, 0, "valve commands while it is dead");
  mustEqual(early.length, 0, "rule_fired events while the close waits on a dead valve");
  // A run waiting on its device across a restart (applier, *Restarts*: a running rule's run).
  await ctx.restartApplier!({ dead: ["valve"] });
  const { cursor: resumed } = await ctx.mcp!.callOk("events");
  await sleep(oneSecond(ctx));
  ctx.evidence(`after the restart, the valve still dead: ${received(ctx, "valve", mark).length} valve commands`);
  mustEqual(received(ctx, "valve", mark).length, 0, "valve commands after the restart, the valve still dead");
  await bridge.setAvailable("valve", true);
  await pollUntil(async () => received(ctx, "valve", mark).length > 0, 2 * oneSecond(ctx), "the close sent on the valve's return after the restart");
  const [fired] = await firedWithin(ctx, resumed, "safe-12", 1, 3 * oneSecond(ctx), "the rule complete once the valve acks");
  mustEqual((fired.outcomes as Outcome[]).map((o) => [o.target, short(o)]), [[VALVE, "acked"]], "the complete rule's outcomes");

  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: false });
  await configured(ctx, [{ op: "upsert", kind: "safety_rule", value: { id: "safe-12", trigger: WET,
    actions: [{ target: VALVE, action: "valve.close" }, { target: PULSE, action: "onoff.turn_off" }] } }], "the rule closing the valve and cutting the pump");
  const bound = Math.max(await ackWithinS(ctx, VALVE, "valve.close"), await ackWithinS(ctx, PULSE, "onoff.turn_off"));
  await report(ctx, "pulse", { on: true });
  await bridge.control({ requestId: "safe-12-valve", op: "commandResult", device: "valve", result: "none" });
  await bridge.control({ requestId: "safe-12-pulse", op: "commandResult", device: "pulse", result: "none" });
  const { cursor: again } = await ctx.mcp!.callOk("events");
  const from = bridge.received.length;
  await ctx.time.advance(1000);
  await report(ctx, "leak", { leak: true });
  await pollUntil(async () => received(ctx, "valve", from).length > 0 && received(ctx, "pulse", from).length > 0,
    oneSecond(ctx), "the valve and the pump sent their actions on a leak");
  // Chunks well under the applier's 5 s skew bound: the re-sent close is answered while time passes, and an
  // answer stamped a whole 5 s chunk ahead of the applier's clock (it takes each step on its next time query)
  // would be a fast reading, never landed (GA-BUS-2).
  await ctx.time.advance(bound * 1000 + 5000, { chunkMs: 2000 });
  const [second] = await firedWithin(ctx, again, "safe-12", 1, 3 * oneSecond(ctx), "the rule complete once the valve's second close acks");
  ctx.evidence(`valve ${JSON.stringify(received(ctx, "valve", from).map((x) => x.action))}, pump ${JSON.stringify(received(ctx, "pulse", from).map((x) => x.action))}; rule_fired ${JSON.stringify(second)}`);
  mustEqual(received(ctx, "valve", from).length, 2, "valve.close sent: the first unanswered, sent again");
  mustEqual(received(ctx, "pulse", from).length, 1, "the pump's turn_off, not idempotent, sent");
  mustEqual((second.outcomes as Outcome[]).map((o) => [o.target, short(o)]), [[VALVE, "acked"], [PULSE, "failed(no_ack)"]], "the complete rule's outcomes");
});

requirement("GA-LOAD-2", {
  seam: "applier", fixture: { devices: ["heater", "pulse", "rfplug"] }, timeoutMs: 240_000,
  covers: `three sockets with load: heating and max_on_s 30. The heater, reported on, is sent onoff.turn_off between 30 and 35 s later, its outcome events carrying load_cap and no apply_id, its state off with cause load_cap; on again, its turn-off rejected is a load_cap notice and is sent again within its ack_within_s. The pulse relay's turn_off, declared idempotent: false and answered by nothing, is sent once through its bound, with a load_cap notice. The open radio plug, turned on by a client's step that ended sent, is turned off 30 s later. "No client" is shown by the run's cause, the harness's own session staying open. Across clean restarts: the heater's rejected turn-off is still sent again within its ack_within_s; the pulse relay's turn_off, sent, unanswered and failed(no_ack) before a restart, is not sent again after it; and a restart 15 s into the heater's on-time still turns it off 30 to 35 s after it went on, the downtime counted`,
}, async (ctx) => {
  const bridge = ctx.bridge!;
  const heating = (device: string) => [{ op: "upsert", kind: "load", value: { device, load: "heating" } },
    { op: "upsert", kind: "max_on_s", value: { device, max_on_s: 30 } }];
  await configured(ctx, [...heating(HEATER), ...heating(PULSE), ...heating(RFPLUG)], "three heating sockets with max_on_s 30");
  const capOutcomes = async (cursor: string, target: string) => (await eventsOf(ctx.mcp!, cursor, "outcome"))
    .filter((e) => e.target === target && e.load_cap === target);

  // The heater, closed: from its report of on.
  let { cursor } = await ctx.mcp!.callOk("events");
  let mark = bridge.received.length;
  // The subject's on-time starts no sooner than the report's.
  let since = ctx.time.now();
  await held(ctx, HEATER, "on", true, "the heater held on", false);
  await advanceTo(ctx, since + 25_000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  await noneYet(ctx, since + 30_000, () => received(ctx, "heater", mark).length, "heater commands 25 s after it was reported on");
  await ctx.time.advance(10_000, { chunkMs: 5000 });
  await pollUntil(async () => received(ctx, "heater", mark).length > 0, oneSecond(ctx), "the heater sent onoff.turn_off past its max_on_s");
  mustEqual(received(ctx, "heater", mark).map((x) => x.action), ["onoff.turn_off"], "the heater's actions past its max_on_s");
  // The simulated heater acks 200 ms after the command, on the harness's clock, and reports off.
  await ctx.time.advance(1000);
  await held(ctx, HEATER, "on", false, "the heater held off after the cap's turn-off");
  const done = await pollUntil(async () => {
    const o = await capOutcomes(cursor, HEATER);
    return o.some((e) => e.outcome === "acked") ? o : undefined;
  }, 2 * oneSecond(ctx), "the cap's turn-off acked, its outcome events naming load_cap");
  ctx.evidence(`the cap's outcome events: ${JSON.stringify(done)}`);
  must(done.every((e) => e.apply_id === undefined), "the cap's outcome events name no apply", done);
  const off = await pollUntil(async () => (await eventsOf(ctx.mcp!, cursor, "state")).find((e) => e.target === HEATER && e.key === "on" && e.value === false),
    oneSecond(ctx), "the heater's state event of off");
  mustEqual(off.cause, "load_cap", "the cause of the heater's turn-off");

  // On again, its first turn-off rejected: a notice, and sent again within its ack_within_s.
  const bound = await ackWithinS(ctx, HEATER, "onoff.turn_off");
  ({ cursor } = await ctx.mcp!.callOk("events"));
  mark = bridge.received.length;
  await held(ctx, HEATER, "on", true, "the heater held on again", false);
  await bridge.control({ requestId: "load-2-reject", op: "commandResult", device: "heater", result: "rejected" });
  await ctx.time.advance(35_000, { chunkMs: 5000 });
  await pollUntil(async () => received(ctx, "heater", mark).length > 0, oneSecond(ctx), "the heater sent onoff.turn_off again past its max_on_s");
  const failed = await pollUntil(async () => (await noticesOf(ctx, "load_cap")).find((x) => x.devices?.includes(HEATER)),
    2 * oneSecond(ctx), "a load_cap notice for the heater's rejected turn-off");
  ctx.evidence(`notice: ${JSON.stringify(failed)}`);
  // A cap at work is kept across a restart (applier, *Restarts*): its turn-off is still sent again.
  await ctx.restartApplier!();
  await ctx.time.advance(bound * 1000, { chunkMs: 5000 });
  await pollUntil(async () => received(ctx, "heater", mark).length > 1, oneSecond(ctx), "the heater's turn-off sent again within its ack_within_s");

  // The pulse relay: its turn_off not idempotent, answered by nothing.
  const pulseBound = await ackWithinS(ctx, PULSE, "onoff.turn_off");
  await held(ctx, PULSE, "on", true, "the pulse relay held on", false);
  await bridge.control({ requestId: "load-2-none", op: "commandResult", device: "pulse", result: "none" });
  mark = bridge.received.length;
  await ctx.time.advance(35_000, { chunkMs: 5000 });
  await pollUntil(async () => received(ctx, "pulse", mark).length > 0, oneSecond(ctx), "the pulse relay sent onoff.turn_off past its max_on_s");
  await ctx.time.advance(pulseBound * 1000 + 5000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  ctx.evidence(`the pulse relay received ${JSON.stringify(received(ctx, "pulse", mark).map((x) => x.action))}`);
  mustEqual(received(ctx, "pulse", mark).length, 1, "the pulse relay's cap turn-offs");
  const pulseNotice = await pollUntil(async () => (await noticesOf(ctx, "load_cap")).find((x) => x.devices?.includes(PULSE)),
    oneSecond(ctx), "a load_cap notice for the pulse relay's unanswered turn-off");
  ctx.evidence(`notice: ${JSON.stringify(pulseNotice)}`);
  // A not-idempotent turn-off that may have run is not sent again across a restart (applier, *Restarts*;
  // GA-SAFE-5's classes). Restarted once it has ended failed(no_ack): the ack bound kept across a restart is
  // GA-PERSIST-1's, and one in flight at the restart is unit-tested.
  await ctx.restartApplier!();
  await ctx.time.advance(pulseBound * 1000 + 5000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  ctx.evidence(`after the restart, the pulse relay received ${JSON.stringify(received(ctx, "pulse", mark).map((x) => x.action))}`);
  mustEqual(received(ctx, "pulse", mark).length, 1, "the pulse relay's cap turn-offs across the restart");

  // The open radio plug: from a client's turn_on that ended sent.
  const on = ask(RFPLUG, "onoff.turn_on");
  // Dispatched no sooner than now: its on-time starts no sooner.
  since = ctx.time.now();
  const r = await ctx.mcp!.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [{ ...on, token: sign(ctx, on) }] } });
  await pollUntil(async () => (await ctx.mcp!.callOk("outcome", { apply_id: r.apply_id })).outcomes?.[0]?.outcome === "sent",
    oneSecond(ctx), "the radio plug's turn_on sent");
  mark = bridge.received.length;
  await advanceTo(ctx, since + 25_000, { chunkMs: 5000 });
  await sleep(oneSecond(ctx));
  await noneYet(ctx, since + 30_000, () => received(ctx, "rfplug", mark).length, "radio plug commands 25 s after its turn_on");
  await ctx.time.advance(10_000, { chunkMs: 5000 });
  await pollUntil(async () => received(ctx, "rfplug", mark).length > 0, oneSecond(ctx), "the radio plug sent onoff.turn_off past its max_on_s");
  mustEqual(received(ctx, "rfplug", mark).map((x) => x.action), ["onoff.turn_off"], "the radio plug's actions past its max_on_s");

  // The downtime counts (applier, *Restarts*: "so that downtime counts towards its cap").
  await held(ctx, HEATER, "on", false, "the heater held off before the downtime clause");
  mark = bridge.received.length;
  since = ctx.time.now();
  await held(ctx, HEATER, "on", true, "the heater held on before a restart", false);
  await ctx.time.advance(15_000, { chunkMs: 5000 });
  await ctx.restartApplier!();
  await advanceTo(ctx, since + 25_000, { chunkMs: 2000 });
  await sleep(oneSecond(ctx));
  await noneYet(ctx, since + 30_000, () => received(ctx, "heater", mark).length, "heater commands 25 s after it went on, a restart between");
  await advanceTo(ctx, since + 30_000, { chunkMs: 2000 });
  await pollUntil(async () => received(ctx, "heater", mark).length > 0, 5000 + ctx.allowanceMs,
    "the heater turned off 30 to 35 s after it went on, a restart between");
  ctx.evidence(`after the restart: the heater received ${JSON.stringify(received(ctx, "heater", mark).map((x) => x.action))}`);
});

requirement("GA-WIT-1", {
  seam: "applier", fixture: { devices: ["heater", "thermo", "unbound"] }, timeoutMs: 180_000,
  covers: `a witness on the heater's onoff.turn_on reads the thermometer, rises within 60 s: a step whose thermometer rose is confirmed, one whose did not is unconfirmed, each a second outcome event of the step, with its witness, within 1 s after 60 s from dispatch, the step's own outcome unchanged; a witness configured over the sensor whose bound is not known is a liveness notice. unknown on a sensor not live throughout, and an owner's fresh_s longer than the declared one, are unit-tested. A watch armed before a clean restart still gives its verdict, confirmed or unknown, within 1 s after 60 s from dispatch`,
}, async (ctx) => {
  let mcp = ctx.mcp!;
  await configured(ctx, [{ op: "upsert", kind: "witness", value: { device: HEATER, action: "onoff.turn_on", sensor: THERMO, expect: "rises", within_s: 60 } }],
    "a witness on the heater's turn_on");
  // The thermometer's reading as the test last gave it, from the fixture's 20.
  let temperature = 20;
  await report(ctx, "thermo", { temperature });
  const verdict = async (warmer: boolean, restart = false) => {
    // Off first, so the turn_on is sent and not skipped(already).
    await report(ctx, "heater", { on: false });
    const { cursor } = await mcp.callOk("events");
    const on = ask(HEATER, "onoff.turn_on");
    // Dispatched no sooner than now: its verdict is owed no sooner than 60 s after.
    const sent = ctx.time.now();
    const r = await mcp.callOk("apply", { idempotency_key: randomUUID(), request: { actions: [{ ...on, token: sign(ctx, on) }] } });
    // The simulated heater acks 200 ms after the command, on the harness's clock.
    await ctx.time.advance(1000);
    const first = await pollUntil(async () => {
      const o = (await mcp.callOk("outcome", { apply_id: r.apply_id })).outcomes?.[0];
      return o && o.outcome !== "dispatched" ? o : undefined;
    }, 2 * oneSecond(ctx), "the heater's turn_on given a final outcome");
    mustEqual(short(first), "acked", "the heater's turn_on");
    // Chunks well under the applier's 5 s skew bound. The simulated bridge and the applier each take a step
    // on their next time query; a bridge status sent between the two carries check-ins a whole chunk ahead
    // of the applier's clock, and a 5 s chunk, give or take a query's jitter, can pass the bound: the
    // thermometer is then fast, not live throughout, and the verdict unknown (GA-BUS-2).
    await ctx.time.advance(29_000, { chunkMs: 2000 });
    if (restart) {
      await ctx.restartApplier!();
      mcp = ctx.mcp!;
    }
    if (warmer) temperature += 1.5;
    await report(ctx, "thermo", { temperature });
    await ctx.time.advance(25_000, { chunkMs: 2000 });
    await sleep(oneSecond(ctx));
    await noneYet(ctx, sent + 60_000, async () => (await eventsOf(mcp, cursor, "outcome")).filter((e) => e.apply_id === r.apply_id && e.witness).length,
      "witness verdicts 55 s after dispatch");
    await ctx.time.advance(5000, { chunkMs: 2000 });
    const v = await pollUntil(async () => (await eventsOf(mcp, cursor, "outcome")).find((e) => e.apply_id === r.apply_id && e.witness),
      oneSecond(ctx), "the witness's verdict within 1 s after within_s");
    ctx.evidence(`verdict: ${JSON.stringify(v)}`);
    mustEqual((await mcp.callOk("outcome", { apply_id: r.apply_id })).outcomes?.[0]?.outcome, "acked", "the step's own outcome after the verdict");
    return v.outcome as string;
  };
  mustEqual(await verdict(true), "confirmed", "the verdict once the thermometer rose");
  mustEqual(await verdict(false), "unconfirmed", "the verdict when it did not");
  // A watch kept across a restart still gives its verdict at within_s. The text says unknown "when the
  // sensor was not live throughout", which a restart's downtime may or may not count as: confirmed or
  // unknown, never none (the controller's ruling on the 7b preflight's M5; the reference says unknown).
  const kept = await verdict(true, true);
  must(["confirmed", "unknown"].includes(kept), "the verdict of a watch armed before a restart, the thermometer risen after it: confirmed or unknown", kept);
  await configured(ctx, [{ op: "upsert", kind: "witness", value: { device: HEATER, action: "onoff.turn_off", sensor: "sim-bridge:unbound", expect: "falls", within_s: 60 } }],
    "a witness reading the sensor whose bound is not known");
  const n = await pollUntil(async () => (await noticesOf(ctx, "liveness")).find((x) => x.devices?.includes("sim-bridge:unbound") && x.devices.includes(HEATER)),
    oneSecond(ctx), "a liveness notice for a witness whose sensor's fresh_s is not known");
  ctx.evidence(`notice: ${JSON.stringify(n)}`);
});
