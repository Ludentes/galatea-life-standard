import { describe as suite, it } from "vitest";
import { conforming, type Entry, fails, fake, run, withHooks } from "./fake-bridge.js";

suite("GA-BRIDGE-38", () => {
  it("passes a bridge that publishes the socket's extension, its confirmedBy and selfChanging", async () => {
    await run("GA-BRIDGE-38", fake(conforming).ctx);
  });

  it("fails a bridge that leaves the socket's extensions out", async () => {
    const { ctx } = fake(withHooks({ describe(_id, _given, dev) { delete dev.entry.extensions; } }));
    await fails("GA-BRIDGE-38", ctx, /extension/);
  });

  it("fails a bridge that drops the socket's set_mode", async () => {
    const { ctx } = fake(withHooks({ describe(_id, given, dev) {
      conforming.describe!(_id, given, dev, undefined as never);
      dev.entry.actions = (dev.entry.actions as Entry[]).filter((a) => !String(a.action).endsWith(".set_mode"));
    } }));
    await fails("GA-BRIDGE-38", ctx, /set_mode/);
  });
});

suite("GA-BRIDGE-13", () => {
  it("passes a model's figure undoubled", async () => {
    await run("GA-BRIDGE-13", fake(conforming).ctx);
  });

  it("passes a model's figure doubled, the other reading of allowing one missed report", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      conforming.op!(op, w);
      if (op.op === "reporting" && !(op.configuredMs as number[]).length && op.modelMs !== null) w.devs.get(String(op.device))!.roster.basisMaxAgeMs = 2 * (op.modelMs as number);
    } }));
    await run("GA-BRIDGE-13", ctx);
  });

  it("fails a polled device whose entry does not say poll at its cadence", async () => {
    const { ctx } = fake(withHooks({ describe(id, given, dev, w) {
      conforming.describe!(id, given, dev, w);
      if (given.basis === "poll") dev.roster.basis = "report";
    } }));
    await fails("GA-BRIDGE-13", ctx, /poll/);
  });

  it("fails a bridge that declares a poll it never makes: the polled device's lastCheckIn never moves", async () => {
    const { ctx } = fake(withHooks({ tick() {} }));
    await fails("GA-BRIDGE-13", ctx, /not polled at the cadence declared/);
  });

  it("fails a bridge whose polled device stays observable after it fell silent", async () => {
    const { ctx } = fake(withHooks({ tick(now, w) {
      conforming.tick!(now, w);
      const dev = w.devs.get("polled");
      if (dev?.silent) dev.roster.observable = true;
    } }));
    await fails("GA-BRIDGE-13", ctx, /still observable past its bound/);
  });

  it("fails a bridge that moves a silent polled device's lastCheckIn", async () => {
    const { ctx } = fake(withHooks({ tick(now, w) {
      conforming.tick!(now, w);
      const dev = w.devs.get("polled");
      // Observable false, as the bound says, but its lastCheckIn moved to now by something no answer brought.
      if (dev?.silent) Object.assign(dev.roster, { lastCheckIn: new Date(now).toISOString(), observable: false });
    } }));
    await fails("GA-BRIDGE-13", ctx, /moved after it fell silent/);
  });

  it("grades the polled bound against the entry's own cadence", async () => {
    const { ctx } = fake(withHooks({ describe(id, given, dev, w) {
      conforming.describe!(id, given, dev, w);
      if (given.basis === "poll") dev.roster.cadenceMs = 10_000;
    } }));
    await fails("GA-BRIDGE-13", ctx, /cadence/);
  });
});

