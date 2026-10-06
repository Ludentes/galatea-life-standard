import { fixtureDevices } from "@ludentes/galatea-life-sim";
import { must } from "../../assert.js";
import { requirement } from "../../registry.js";
import { LAMP } from "../../steward-home.js";
import { pollUntil } from "../../util.js";
import { DIMMER } from "../util.js";
import { ownerDefine, ownerOf, revisionOf, up } from "./util.js";

requirement("GA-HOUSE-1", {
  seam: "steward",
  covers: "a state change at the applier moves no revision; a model change at the applier moves it once; an owner's define moves it once and wakes a describe waiting on the old revision; narrowings are not built",
}, async (ctx) => {
  const owner = ownerOf(ctx);
  const r0 = await revisionOf(ctx);
  ctx.standIn!.applier.scriptValue(LAMP, "on", true);
  const quiet = await owner.callOk("describe", { since_revision: r0, wait_s: 2 });
  ctx.evidence(`after a state change: revision ${quiet.revision} (was ${r0})`);
  must(quiet.revision === r0, `a state change at the applier moved the revision from ${r0} to ${quiet.revision}`);
  ctx.standIn!.applier.scriptDevice(fixtureDevices(["dimmer"])[0]!);
  await pollUntil(async () => ((await owner.callOk("describe")).targets as { id: string }[]).some((t) => t.id === DIMMER),
    10_000, "the steward's describe did not show the applier's new device", 100);
  const r1 = await revisionOf(ctx);
  ctx.evidence(`after the applier's model changed: revision ${r1}`);
  must(r1 === r0 + 1, `the applier's model change moved the revision from ${r0} to ${r1}, not once`);
  const waiting = owner.callOk("describe", { since_revision: r1, wait_s: 20 });
  const started = Date.now();
  const r = await ownerDefine(ctx, [up("room", { id: "attic", name: "Чердак" })], { expected_revision: r1 });
  must(r.ok, `define returned ${r.ok ? "" : r.error}`, r.body);
  const woke = await waiting;
  ctx.evidence(`define answered revision ${r.body.revision}; the waiting describe returned ${woke.revision} after ${Date.now() - started} ms`);
  must(r.body.revision === r1 + 1 && woke.revision === r1 + 1, `define moved the revision from ${r1} to ${r.body.revision}, and describe saw ${woke.revision}`);
  must(Date.now() - started < 10_000, "the describe waiting on the old revision was not woken by define");
});
