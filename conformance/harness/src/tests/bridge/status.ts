import { validate } from "@ludentes/galatea-life-schemas";
import { must, mustEqual, mustWithin } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import { HOUR } from "../util.js";
import { awaitTail } from "./doer.js";

requirement("GA-BRIDGE-16", {
  seam: "bridge", covers: "status carries the run's testRunId, and its times follow a step of the harness's source",
}, async (ctx) => {
  const watch = ctx.watch!;
  const topic = `${ctx.root}/bridges/${ctx.bridgeId}/status`;
  const interval = constantMs("bridge", "status-interval");
  const first = await watch.waitFor((s) => s.topic === topic && s.payload !== null, interval + ctx.allowanceMs);
  const errors = validate("bridge/status.json", first.payload);
  must(errors.length === 0, `the status is not valid: ${errors.join("; ")}`, first.payload);
  mustEqual(first.payload.testRunId, ctx.runId, "testRunId");
  // The mark comes before the step, so the status the step itself brings is caught, not the next periodic one.
  const mark = watch.seen.length;
  const stepped = Date.parse(first.payload.publishedAt) + HOUR / 2;
  await ctx.time.stepAndWait(HOUR);
  const next = await watch.waitFor((s) => s.topic === topic && s.payload !== null && Date.parse(s.payload.publishedAt) >= stepped,
    interval + ctx.allowanceMs, mark);
  ctx.evidence(`after the step: publishedAt ${next.payload.publishedAt}, source ${new Date(ctx.time.at(next.realAt)).toISOString()}`);
  mustWithin(Date.parse(next.payload.publishedAt), ctx.time.at(next.realAt), 1000 + ctx.allowanceMs, "publishedAt against the source");
});

requirement("GA-BRIDGE-17", {
  seam: "bridge", covers: "status at least every interval over 25 s of its clock, the window's tail included, and within 1 s of a transport's state changing; changes of a device's `observable` are not tested",
}, async (ctx) => {
  const watch = ctx.watch!;
  const topic = `${ctx.root}/bridges/${ctx.bridgeId}/status`;
  const interval = constantMs("bridge", "status-interval");
  const chunkMs = 1000;
  const start = watch.seen.length;
  // Time passing on the bridge's clock (GA-BRIDGE-16 makes it the source's), in chunks well under the interval.
  await ctx.time.advance(25_000, { chunkMs });
  const bound = interval + chunkMs + ctx.allowanceMs;
  const end = ctx.time.now();
  // A status published near the end may still be on its way: wait for it before grading the tail.
  await awaitTail(ctx, (s) => s.topic === topic && s.payload !== null, end, bound, start);
  const times = watch.seen.slice(start).filter((s) => s.topic === topic && s.payload !== null)
    .map((s) => Date.parse(s.payload.publishedAt));
  ctx.evidence(`statuses at ${times.map((t) => t - times[0]!).join(", ")} ms of the bridge's clock`);
  must(times.length >= 2, `${times.length} status in 25 s`);
  for (let i = 1; i < times.length; i++) must(times[i]! - times[i - 1]! <= bound, `a gap of ${times[i]! - times[i - 1]!} ms between statuses`);
  // The window's tail too: a bridge that stops partway through has a long gap after its last status.
  must(end - times.at(-1)! <= bound, `a gap of ${end - times.at(-1)!} ms from the last status to the end of the window`);
  // Send right after a status, so the next periodic one is far off and a periodic-only bridge cannot pass.
  const before = watch.seen.length;
  const isStatus = (m: { topic: string; payload: any }) => m.topic === topic && m.payload !== null;
  for (let i = 0; i < 12 && !watch.seen.slice(before).some(isStatus); i++) await ctx.time.advance(chunkMs, { chunkMs });
  must(watch.seen.slice(before).some(isStatus), "no status arrived while waiting to change the transport's state");
  const mark = watch.seen.length;
  const sentAt = ctx.time.now();
  try {
    await ctx.transport!.send({ op: "transportState", state: "down" });
    const down = await watch.waitFor((s) => isStatus(s) && (s.payload.transports ?? []).some((t: { state: string }) => t.state === "down"),
      // The 1 s the requirement gives a status after a transport's state changes (GA-BRIDGE-17).
      1000 + ctx.allowanceMs, mark);
    ctx.evidence(`down published at ${down.payload.publishedAt}, ${Date.parse(down.payload.publishedAt) - sentAt} ms after the change`);
    mustWithin(Date.parse(down.payload.publishedAt), sentAt, 1000 + ctx.allowanceMs, "publishedAt of the first down status against the change");
  } finally {
    await ctx.transport!.send({ op: "transportState", state: "up" });
  }
});
