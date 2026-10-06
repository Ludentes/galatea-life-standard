import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, RequirementFailure } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";

type Transport = { id: string; state: string };
const transports = (s: Seen): Transport[] => s.payload?.transports ?? [];
const allIn = (state: string) => (s: Seen) => transports(s).length > 0 && transports(s).every((t) => t.state === state);
/** GA-BRIDGE-11: a backoff reaches its ceiling within 180 s, so a transport that can come up does within it. */
const UP_WITHIN_MS = 180_000;

requirement("GA-BRIDGE-55", {
  seam: "bridge",
  covers: "each entry is open, internal, unclassed and offers only power.wake with confirms false; the transport is up on an answered ARP, down 30 s after the last answer and at once without a carrier",
}, async (ctx) => {
  const watch = ctx.watch!;
  const transport = ctx.transport!;
  const base = `${ctx.root}/bridges/${ctx.bridgeId}`;
  const status = (s: Seen) => s.topic === `${base}/status` && s.payload !== null;
  const window = constantMs("bridge", "wake-relay-s-gateway-arp");
  // `up` is bounded from above only (a link, and an answer within the window), so a wait for it lets
  // time pass on the relay's clock, in chunks, for as long as a probe on GA-BRIDGE-11's backoff may take.
  const waitUp = async (step: string, from: number): Promise<Seen> => {
    const chunkMs = 1000;
    const isUp = (s: Seen) => status(s) && allIn("up")(s);
    const until = ctx.time.now() + UP_WITHIN_MS;
    while (!watch.seen.slice(from).some(isUp) && ctx.time.now() < until) await ctx.time.advance(chunkMs, { chunkMs });
    try {
      return await watch.waitFor(isUp, 1000 + ctx.allowanceMs, from);
    } catch {
      throw new RequirementFailure(`the transport was not up ${step} within ${UP_WITHIN_MS / 1000} s of the relay's clock`);
    }
  };
  // A subject with no interface to play refuses this op, and the runner reports the test not_applicable.
  await transport.send({ op: "link", carrier: true, gatewayAnswers: true });

  const devices = await watch.waitFor((s) => s.topic === `${base}/devices` && s.payload !== null, 5000);
  const errors = validate("bridge/devices.json", devices.payload);
  must(errors.length === 0, `the devices document is not valid: ${errors.join("; ")}`, devices.payload);
  const entries = devices.payload.devices as Record<string, any>[];
  must(entries.length > 0, "the relay declares no entries; its fixture configures two");
  for (const e of entries) {
    ctx.evidence(`${e.id}: feedback ${e.feedback}, internal ${e.internal}, proposedClass ${e.proposedClass}, actions ${JSON.stringify(e.actions)}`);
    mustEqual(e.feedback, "open", `${e.id}'s feedback`);
    mustEqual(e.internal, true, `${e.id}'s internal`);
    mustEqual(e.proposedClass, null, `${e.id}'s proposedClass`);
    must(Array.isArray(e.actions) && e.actions.length === 1, `${e.id} offers ${e.actions?.length ?? 0} actions, not one`);
    mustEqual(e.actions[0].action, "power.wake", `${e.id}'s action`);
    mustEqual(e.actions[0].confirms, false, `${e.id}'s power.wake confirms`);
  }

  // An answering gateway: up.
  await waitUp("with the gateway answering", 0);

  // The carrier goes: down within 1 s, with no step of time.
  const cut = watch.seen.length;
  await transport.send({ op: "link", carrier: false, gatewayAnswers: true });
  await watch.waitFor((s) => status(s) && allIn("down")(s), 1000 + ctx.allowanceMs, cut);

  // The carrier and the gateway come back: up again.
  const back = watch.seen.length;
  await transport.send({ op: "link", carrier: true, gatewayAnswers: true });
  await waitUp("with the carrier and the gateway back", back);

  // The gateway falls silent: up for at most the window after its last answer, then down.
  const silent = watch.seen.length;
  await transport.send({ op: "link", carrier: true, gatewayAnswers: false });
  await ctx.time.advance(window + 1000, { chunkMs: 1000 });
  const down = await watch.waitFor((s) => status(s) && allIn("down")(s), 1000 + ctx.allowanceMs, silent);
  ctx.evidence(`down at ${down.payload.publishedAt} with the gateway silent`);
});
