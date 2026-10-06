import { must, mustEqual } from "../../assert.js";
import { requirement } from "../../registry.js";
import { CHANNEL, LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { act, mustDefine, mustRefuse, ownerOf, scripted, stepsAt, stewardSees, targetIn, up } from "./util.js";

/** A rule on the lamp, `v` over it. */
const ruleOn = (v: Record<string, unknown>) => up("rule", { id: "r", name: "Правило", conditions: [{ target: LAMP, key: "on", op: "eq", value: true }],
  actions: [{ target: LAMP, action: "onoff.turn_off", args: {} }], ...v });

/** The targets of the owner's plan of `actions`, in order. */
async function targetsOf(ctx: Parameters<typeof ownerOf>[0], actions: unknown[]): Promise<string[]> {
  return (await stepsAt(ownerOf(ctx), "owner-app", actions)).map((x) => x.split(" ")[0]!);
}

requirement("GA-PLAN-5", {
  seam: "steward",
  covers: "selectors by room, by class, by capability and by two fields resolve to exactly the matching devices and channels, in code-point order of their ids, and a group in the room is never a step",
}, async (ctx) => {
  const [dimmer, tv] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "tv", adopt: "tv" }]);
  await mustDefine(ctx, [up("target", { id: LAMP, room: "hall" }), up("target", { id: dimmer, room: "kitchen" }), up("target", { id: tv, room: "hall" }),
    up("group", { id: "hall-group", name: "Холл", room: "hall", members: [LAMP], aggregate: "any" })], "rooms and a group");
  const cases: [string, Record<string, string>, string[]][] = [
    ["the hall", { room: "hall" }, [LAMP, tv!]],
    ["the lights", { class: "light" }, [dimmer!, LAMP]],
    ["the kitchen's lights", { room: "kitchen", class: "light" }, [dimmer!]],
    ["what notifies", { capability: "notify" }, [CHANNEL]],
    ["what turns on in the hall", { room: "hall", capability: "onoff" }, [LAMP, tv!]],
    ["the attic", { room: "attic" }, []],
  ];
  for (const [what, selector, want] of cases) {
    const got = await targetsOf(ctx, [act(selector)]);
    ctx.evidence(`${what} ${JSON.stringify(selector)}: ${got.join(", ") || "nothing"}`);
    mustEqual(got, want, `the selector for ${what}`);
  }
});

requirement("GA-PLAN-6", {
  seam: "steward",
  covers: "a device marked infrastructure, one marked internal after the owner put it in the hall and a group, one the applier stopped adopting after that, one it forgot after that, and one never adopted, are left out of a room's selector, a capability's selector and the group; the first three and the one never adopted are reached by their own ids",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const [dimmer, rack, entry, stray, tv, gone] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "rack", adopt: "socket" },
    { fixture: "pulse", adopt: "socket" }, { fixture: "heater", adopt: null }, { fixture: "tv", adopt: "tv" },
    { fixture: "heater", adopt: "socket", bridge: "far-bridge" }]);
  const hall = [LAMP, dimmer!, rack!, entry!, tv!, gone!];
  await mustDefine(ctx, [...hall.map((id) => up("target", { id, room: "hall" })),
    up("group", { id: "hall-all", name: "Всё в холле", room: "hall", members: hall, aggregate: "any" })], "the hall and its group");
  applier.scriptMarks(rack!, { infrastructure: true });
  applier.scriptMarks(entry!, { internal: true });
  applier.scriptAdopted(tv!, false);
  applier.scriptForget(gone!);
  await stewardSees(ctx, "the marks, the release and the forgotten device", (d) => targetIn(d, rack!)?.infrastructure === true
    && targetIn(d, entry!)?.internal === true && targetIn(d, tv!)?.adopted === false && !targetIn(d, gone!));
  const out = `${rack}, ${entry}, ${tv}, ${gone} and ${stray}`;
  const cases: [string, unknown, string[]][] = [
    ["the hall", act({ room: "hall" }), [dimmer!, LAMP]],
    ["what turns on", act({ capability: "onoff" }), [dimmer!, LAMP]],
    ["the hall's group", act("hall-all"), [dimmer!, LAMP]],
  ];
  for (const [what, a, want] of cases) {
    const got = await targetsOf(ctx, [a]);
    ctx.evidence(`${what}: ${got.join(", ") || "nothing"}`);
    mustEqual(got, want, `${what}, leaving out ${out}`);
  }
  const own = await targetsOf(ctx, [act(rack!), act(entry!), act(tv!), act(stray!)]);
  ctx.evidence(`by their own ids: ${own.join(", ")}`);
  mustEqual(own, [rack!, entry!, tv!, stray!], "each named by its own id");
});

requirement("GA-GRP-1", {
  seam: "steward",
  covers: "in state, a group of a lamp, a dimmer and a leak sensor with all is on once both lights are (the sensor, with no onoff, never holds it off), with any once one is, a group of a sensor alone has no on (null, the build's reading where no member has onoff), and a group with any counts an infrastructure member that is on",
}, async (ctx) => {
  const applier = ctx.standIn!.applier;
  const [dimmer, , rack] = await scripted(ctx, [{ fixture: "dimmer", adopt: "light" }, { fixture: "leak", adopt: "sensor" },
    { fixture: "rack", adopt: "socket" }]);
  await mustDefine(ctx, [up("group", { id: "any-pair", name: "Любая", room: null, members: [LAMP, dimmer!], aggregate: "any" }),
    up("group", { id: "all-pair", name: "Обе", room: null, members: [LAMP, dimmer!, "sim-bridge:leak"], aggregate: "all" }),
    up("group", { id: "dry", name: "Сухо", room: null, members: ["sim-bridge:leak"], aggregate: "any" }),
    up("group", { id: "with-rack", name: "Со стойкой", room: null, members: [dimmer!, rack!], aggregate: "any" })], "four groups");
  applier.scriptMarks(rack!, { infrastructure: true });
  applier.scriptValue(rack!, "on", true);
  const groups = async () => (await ownerOf(ctx).callOk("state")).groups as Record<string, { on: boolean | null }>;
  const reads = async (want: [boolean, boolean], what: string) => {
    const g = await pollUntil(async () => {
      const x = await groups();
      return x["any-pair"]?.on === want[0] && x["all-pair"]?.on === want[1] ? x : undefined;
    }, 10_000, `the groups did not read any ${want[0]} and all ${want[1]} ${what}`, 100);
    ctx.evidence(`${what}: ${JSON.stringify(g)}`);
    must(g.dry?.on === null, `a group of a sensor alone read on ${JSON.stringify(g.dry)}`);
    return g;
  };
  const off = await reads([false, false], "both off");
  must(off["with-rack"]?.on === true, `an any group whose infrastructure member is on read ${JSON.stringify(off["with-rack"])}`);
  applier.scriptValue(LAMP, "on", true);
  await reads([true, false], "the lamp on");
  applier.scriptValue(dimmer!, "on", true);
  await reads([true, true], "both on");
});

requirement("GA-DEF-9", {
  seam: "steward",
  covers: "a change set putting a device the applier has not adopted in a room, giving it a name, or putting it in a group, or a rule reading it or acting on it, is refused invalid_request, changing nothing; the adopted lamp is put in a room; a scenario acting on it, or with an if or a wait reading it, or owning it, is refused alike",
}, async (ctx) => {
  const [stray] = await scripted(ctx, [{ fixture: "heater", adopt: null }]);
  for (const [what, change] of [
    ["an unadopted heater in the hall", up("target", { id: stray, room: "hall" })],
    ["a name for an unadopted heater", up("target", { id: stray, name: "Обогреватель" })],
    ["a group with an unadopted heater", up("group", { id: "g", name: "g", room: null, members: [LAMP, stray], aggregate: "any" })],
    ["a rule reading an unadopted heater", ruleOn({ conditions: [{ target: stray, key: "on", op: "eq", value: true }] })],
    ["a rule acting on an unadopted heater", ruleOn({ actions: [{ target: stray, action: "onoff.turn_off", args: {} }] })],
  ] as const) {
    const code = await mustRefuse(ctx, [change], what);
    mustEqual(code, "invalid_request", `the error for ${what}`);
  }
  await mustDefine(ctx, [up("target", { id: LAMP, room: "hall" })], "the adopted lamp in the hall");
  for (const [what, change] of [
    ["a scenario acting on an unadopted heater", up("scenario", { id: "s", name: "s", mode: "single", steps: [{ target: stray, action: "onoff.turn_off", args: {} }] })],
    ["a scenario's if on an unadopted heater", up("scenario", { id: "s", name: "s", mode: "single",
      steps: [{ if: { target: stray, key: "on", op: "eq", value: true }, then: [act(LAMP)] }] })],
    ["a scenario's wait on an unadopted heater", up("scenario", { id: "s", name: "s", mode: "single",
      steps: [{ wait: { target: stray, key: "on", value: true, timeout_s: 5 } }] })],
    ["a scenario owning an unadopted heater", up("scenario", { id: "s", name: "s", mode: "single", owned: [stray], steps: [act(LAMP)] })],
  ] as const) {
    mustEqual(await mustRefuse(ctx, [change], what), "invalid_request", `the error for ${what}`);
  }
});

requirement("GA-DEF-10", {
  seam: "steward",
  covers: "a change set putting a device the applier marks internal in a room or a group, or naming it as the target of a rule's action, is refused invalid_request, changing nothing; the device is named with no room, and a rule reading it is taken; a scenario acting on it is refused alike, one reading it in an if taken",
}, async (ctx) => {
  const [entry] = await scripted(ctx, [{ fixture: "pulse", adopt: "socket" }]);
  ctx.standIn!.applier.scriptMarks(entry!, { internal: true });
  await stewardSees(ctx, `${entry} internal`, (d) => targetIn(d, entry!)?.internal === true);
  for (const [what, change] of [
    ["an internal device in the hall", up("target", { id: entry, room: "hall" })],
    ["a group with an internal device", up("group", { id: "g", name: "g", room: null, members: [LAMP, entry], aggregate: "any" })],
    ["a rule acting on an internal device", ruleOn({ actions: [{ target: entry, action: "onoff.turn_on", args: {} }] })],
  ] as const) {
    const code = await mustRefuse(ctx, [change], what);
    mustEqual(code, "invalid_request", `the error for ${what}`);
  }
  await mustDefine(ctx, [up("target", { id: entry, name: "Реле", room: null })], "a name for the internal device");
  await mustDefine(ctx, [ruleOn({ conditions: [{ target: entry, key: "on", op: "eq", value: true }] })], "a rule reading the internal device");
  mustEqual(await mustRefuse(ctx, [up("scenario", { id: "s", name: "s", mode: "single", steps: [{ target: entry, action: "onoff.turn_on", args: {} }] })],
    "a scenario acting on an internal device"), "invalid_request", "the error for a scenario acting on an internal device");
  await mustDefine(ctx, [up("scenario", { id: "s", name: "s", mode: "single", steps: [{ if: { target: entry, key: "on", op: "eq", value: true }, then: [act(LAMP)] }] })],
    "a scenario reading the internal device");
});
