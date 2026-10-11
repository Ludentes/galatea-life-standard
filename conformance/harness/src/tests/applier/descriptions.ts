import { must, mustEqual } from "../../assert.js";
import type { TestContext } from "../../context.js";
import { requirement } from "../../registry.js";
import { pollUntil, sleep } from "../../util.js";
import { eventsOf, lastDevices, oneSecond, ownerConfigure, wire } from "../util.js";

// Applier 0.15: what a device's bridge says of it beyond its declarations (GA-DESC-19).

const CLIMATE = "sim-bridge:climate";
const R = "org.galatea.test.climate";
type Described = { id: string; awaited_keys?: string[]; settings?: string[]; undescribed?: { name: string; first_seen: string }[] };

async function described(ctx: TestContext, id: string): Promise<Described | undefined> {
  return ((await ctx.owner!.callOk("describe")).devices as Described[]).find((d) => d.id === id);
}

/** The names of the `undescribed` events since `cursor`, each target's. */
async function announced(ctx: TestContext, cursor: string): Promise<string[]> {
  return (await eventsOf(ctx.mcp!, cursor, "undescribed")).map((e) => `${e.target} ${e.name}`);
}

/** The simulated bridge hears the sensor send `name`, which no key describes: it lists it and announces it (GA-BRIDGE-76). */
async function sends(ctx: TestContext, name: string): Promise<void> {
  await ctx.bridge!.control({ requestId: `desc-19-${name}`, op: "report", device: "climate", values: { [name]: 1 }, observedAt: wire(ctx.time.now()) });
}

requirement("GA-DESC-19", {
  seam: "applier", fixture: { devices: ["climate", "lamp"] }, timeoutMs: 90_000,
  covers: "a sensor's awaitedKeys, settings and undescribed in describe as awaited_keys, settings and undescribed; the bridge's undescribed event relayed once per name, the name the devices document lists too announced no second time; a change to undescribed alone moves no revision; across a clean restart, a name announced before is not announced again from the re-sent devices, a name first met in a devices document published while the applier was down is announced exactly once, and a new one after is; a change to awaitedKeys, and one to settings, each moves the revision with a model event naming the sensor. A meta-applier's is the meta-applier's",
}, async (ctx) => {
  const before = await described(ctx, CLIMATE);
  ctx.evidence(`describe: ${JSON.stringify(before)}`);
  mustEqual(before?.awaited_keys, ["humidity"], "the sensor's awaited_keys");
  mustEqual(before?.settings, [`${R}.interval`], "the sensor's settings");

  const { cursor } = await ctx.mcp!.callOk("events");
  const revision = (await ctx.owner!.callOk("describe")).revision;
  await sends(ctx, "dp108");
  const listed = await pollUntil(async () => (await described(ctx, CLIMATE))?.undescribed, oneSecond(ctx), "the sensor's undescribed in describe");
  mustEqual(listed.map((u) => u.name), ["dp108"], "the sensor's undescribed names");
  must(typeof listed[0]?.first_seen === "string" && !Number.isNaN(Date.parse(listed[0].first_seen)), "first_seen is a time", listed);
  await pollUntil(async () => ((await announced(ctx, cursor)).length ? true : undefined), oneSecond(ctx), "an undescribed event");
  // The bridge says it once; another frame of it, or the same event again, says nothing new.
  await ctx.bridge!.publishEvent("undescribed", { device: "climate", name: "dp108" });
  await sleep(500 + ctx.allowanceMs);
  mustEqual(await announced(ctx, cursor), [`${CLIMATE} dp108`], "the undescribed events");
  mustEqual((await ctx.owner!.callOk("describe")).revision, revision, "the revision after a change to undescribed alone");

  // While the applier is down the sensor sends dp110: its event is lost, and the retained devices document lists it.
  await ctx.restartApplier!({ between: () => sends(ctx, "dp110") });
  await pollUntil(async () => ((await announced(ctx, cursor)).includes(`${CLIMATE} dp110`) ? true : undefined), oneSecond(ctx),
    "a name first met in a devices document published while the applier was down, announced at its start");
  await sleep(1000 + ctx.allowanceMs);
  mustEqual(await announced(ctx, cursor), [`${CLIMATE} dp108`, `${CLIMATE} dp110`],
    "the undescribed events after the restart: dp108 not again, dp110 once");
  await sends(ctx, "dp109");
  await pollUntil(async () => ((await announced(ctx, cursor)).includes(`${CLIMATE} dp109`) ? true : undefined), oneSecond(ctx),
    "a name new after the restart announced");
  mustEqual(await announced(ctx, cursor), [`${CLIMATE} dp108`, `${CLIMATE} dp110`, `${CLIMATE} dp109`], "the undescribed events, each name once");

  // A change to awaitedKeys, then to settings: each a model change naming the sensor. A snapshot's answer
  // would re-publish the bridge's own document over it: the bridge answers none meanwhile.
  const bridge = ctx.bridge!;
  bridge.holdRequests(true);
  try {
    await sleep(oneSecond(ctx));
    const doc = lastDevices(bridge);
    for (const [what, change] of [["awaitedKeys", { awaitedKeys: ["humidity", "pressure"] }], ["settings", { settings: [] }]] as const) {
      const at = (await ctx.owner!.callOk("describe")).revision;
      const mark = (await ctx.mcp!.callOk("events")).cursor;
      const now = lastDevices(bridge);
      await bridge.publishRaw("devices", { ...now, devices: now.devices.map((d) => (d.id === "climate" ? { ...d, ...change } : d)) }, true);
      const named = await pollUntil(async () => (await eventsOf(ctx.mcp!, mark, "model")).find((e) => e.device === CLIMATE), oneSecond(ctx),
        `a model event naming the sensor once its ${what} changed`);
      ctx.evidence(`${what}: ${JSON.stringify(named)}`);
      must((await ctx.owner!.callOk("describe")).revision > at, `the revision moved once the sensor's ${what} changed`);
    }
    await bridge.publishRaw("devices", doc, true);
  } finally {
    bridge.holdRequests(false);
  }
});

type Notice = { cause: string; rule_id?: string; devices?: string[]; text: string };

requirement("GA-SAFE-14", {
  seam: "applier", fixture: { devices: ["climate", "lamp"] }, timeoutMs: 60_000,
  covers: "configure refuses a safety rule on the sensor's humidity, which its bridge awaits, with invalid_request, data { key, device, awaited: true }, and the revision unmoved; a rule whose latch reads a key nobody declares with awaited: false; a witness on the humidity likewise; the same rule and a witness on the temperature are taken. Its bridge then re-declares the sensor without the temperature: the rule and the witness are each disabled with a rule_disabled notice naming the temperature",
}, async (ctx) => {
  const owner = ctx.owner!;
  const LAMP = "sim-bridge:lamp";
  const rule = (id: string, key: string, latchKey?: string) => ({ op: "upsert", kind: "safety_rule", value: { id,
    trigger: { device: CLIMATE, key, op: "gt", value: 30 }, actions: [{ target: LAMP, action: "onoff.turn_off" }],
    ...(latchKey ? { latch: { condition: { device: CLIMATE, key: latchKey, op: "lt", value: 25 } } } : {}) } });
  const witness = (key: string) => ({ op: "upsert", kind: "witness", value: { device: LAMP, action: "onoff.turn_on", sensor: CLIMATE, key,
    expect: "rises", within_s: 60 } });
  const refusal = async (changes: unknown[], data: Record<string, unknown>, why: string) => {
    const before = (await owner.callOk("describe")).revision;
    const r = await ownerConfigure(owner, changes);
    ctx.evidence(`${why}: ${JSON.stringify(r.body)}`);
    must(!r.ok && r.error === "invalid_request", `${why} returned ${r.ok ? "a result" : r.error}, not invalid_request`, r.body);
    mustEqual((r.body as { data?: unknown }).data, data, `${why}: the error's data`);
    mustEqual((await owner.callOk("describe")).revision, before, `the revision after ${why}`);
  };
  await refusal([rule("safe-14", "humidity")], { key: "humidity", device: CLIMATE, awaited: true }, "a rule on the awaited humidity");
  await refusal([rule("safe-14", "temperature", "pressure")], { key: "pressure", device: CLIMATE, awaited: false }, "a latch on the pressure");
  await refusal([witness("humidity")], { key: "humidity", device: CLIMATE, awaited: true }, "a witness on the awaited humidity");
  const taken = await ownerConfigure(owner, [rule("safe-14", "temperature"), witness("temperature")]);
  must(taken.ok, `the rule and the witness on the temperature returned ${taken.ok ? "" : taken.error}`, taken.body);

  // Its bridge re-declares it without the temperature. A snapshot's answer would re-publish the bridge's
  // own document over it: the bridge answers no request meanwhile.
  const bridge = ctx.bridge!;
  bridge.holdRequests(true);
  try {
    await sleep(oneSecond(ctx));
    const doc = lastDevices(bridge);
    await bridge.publishRaw("devices", { ...doc, devices: doc.devices.map((d) => (d.id !== "climate" ? d
      : { ...d, sensorKeys: ["humidity"], awaitedKeys: [] })) }, true);
    const disabled = await pollUntil(async () => {
      const n = ((await ctx.mcp!.callOk("events")).notices as Notice[]).filter((x) => x.cause === "rule_disabled");
      // The rule's notice names it; the witness's is a second one, in whatever shape the subject names a witness.
      return n.some((x) => x.rule_id === "safe-14") && n.some((x) => x.rule_id !== "safe-14") ? n : undefined;
    }, 10_000, "a rule_disabled notice for the rule and a second for the witness");
    ctx.evidence(`notices: ${JSON.stringify(disabled)}`);
    for (const n of disabled) must(/temperature/.test(n.text), "the rule_disabled notice names the temperature", n);
    for (const n of disabled) {
      if (n.devices !== undefined) must(n.devices.includes(CLIMATE), "a rule_disabled notice's devices include the sensor", n);
    }
  } finally {
    bridge.holdRequests(false);
  }
});
