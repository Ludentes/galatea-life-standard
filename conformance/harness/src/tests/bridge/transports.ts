import { must } from "../../assert.js";
import { constantMs } from "../../manifest.js";
import { requirement } from "../../registry.js";
import type { Seen } from "../../seams/bridge-watcher.js";
import type { TestContext } from "../../context.js";
import { coordinator, describe, LAMP, oneSecond, topics } from "./doer.js";

type Transport = { id: string; state: string; retryIntervalMs?: number };
const transportsOf = (s: Seen): Transport[] => s.payload?.transports ?? [];
/**
 * GA-BRIDGE-11's "within 180 s": the constants' `reconnection-backoff-ceiling` carries it only in its
 * text, its number being the ceiling's (relay.ts reads it the same way).
 */
const CEILING_WITHIN_MS = 180_000;
/** How the harness lets the bridge's clock pass: a second at a time, so each of its timers runs. */
const CHUNK_MS = 1000;

/** The statuses after `from`, each with the time it was published on the bridge's clock. */
function statuses(ctx: TestContext, from: number): { at: number; transports: Transport[] }[] {
  return ctx.watch!.seen.slice(from).filter(topics(ctx).status()).map((s) => ({ at: Date.parse(s.payload.publishedAt), transports: transportsOf(s) }));
}

requirement("GA-BRIDGE-11", {
  seam: "bridge",
  covers: "a coordinator whose host link opens on each try and that never answers: retryIntervalMs reaches at least 60 s within 180 s of the link's loss and never falls while no exchange succeeds; a transmitter that can answer nothing (GA-BRIDGE-72) is not tested",
}, async (ctx) => {
  const transport = ctx.transport!;
  await describe(ctx, "lamp", LAMP);
  // The link lost, then a host link that opens on every try and a coordinator that never answers.
  const mark = ctx.watch!.seen.length;
  const lostAt = ctx.time.now();
  await transport.send({ op: "hostLink", open: false, answers: false });
  await transport.send({ op: "hostLink", open: true, answers: false });
  const within = CEILING_WITHIN_MS;
  const ceiling = constantMs("bridge", "reconnection-backoff-ceiling");
  // retryIntervalMs is seen only in a status, which comes at least every status interval (GA-BRIDGE-17):
  // a bridge that reaches the ceiling by 180 s may first show it a status interval later.
  const shownWithin = within + constantMs("bridge", "status-interval");
  try {
    await ctx.time.advance(shownWithin + 2 * CHUNK_MS, { chunkMs: CHUNK_MS });
    // From the first status that shows the loss: one published before it may still show the coordinator up.
    const all = statuses(ctx, mark);
    const down = all.findIndex((s) => s.transports.some((x) => x.state === "down"));
    must(down >= 0, "no status showed the coordinator down after its link was lost");
    const seen = all.slice(down).filter((s) => s.at <= lostAt + shownWithin + CHUNK_MS);
    // Each transport's own sequence, as it backs off on its own; a status that omits retryIntervalMs shows none.
    const byTransport = new Map<string, number[]>();
    for (const s of seen) {
      for (const x of s.transports) {
        if (x.state !== "down" || typeof x.retryIntervalMs !== "number") continue;
        byTransport.set(x.id, [...(byTransport.get(x.id) ?? []), x.retryIntervalMs]);
      }
    }
    const retries = [...byTransport.values()].flat();
    ctx.evidence(`retryIntervalMs while down: ${[...byTransport].map(([id, r]) => `${id}: ${[...new Set(r)].join(", ")}`).join("; ")} over ${seen.length} statuses`);
    must(!seen.some((s) => s.transports.some((x) => x.state === "up")), "a transport was up with no exchange succeeding");
    must(Math.max(0, ...retries) >= ceiling,
      `retryIntervalMs reached ${Math.max(0, ...retries)} ms within ${within} ms (and a status interval to show it), not ${ceiling}`);
    for (const [id, r] of byTransport) {
      for (let i = 1; i < r.length; i++) must(r[i]! >= r[i - 1]!, `${id}'s retryIntervalMs fell from ${r[i - 1]} to ${r[i]} with no exchange succeeding`);
    }
  } finally {
    await transport.send({ op: "hostLink", open: true, answers: true });
  }
});

requirement("GA-BRIDGE-23", {
  seam: "bridge",
  covers: "a coordinator that stops answering, its host link still there, is down within 30 s of its last answer (and the 1 s a status takes), and is never up again while each try connects and gets no answer; the health exchange every 10 s is not tested (the test transport does not show an exchange)",
}, async (ctx) => {
  const transport = ctx.transport!;
  await describe(ctx, "lamp", LAMP);
  await coordinator(ctx, "up");
  const window = constantMs("bridge", "transport-up-window");
  const mark = ctx.watch!.seen.length;
  const silentAt = ctx.time.now();
  await transport.send({ op: "hostLink", open: true, answers: false });
  try {
    // The window, the second a status may take, a chunk; then long enough for retries that connect.
    await ctx.time.advance(window + 2 * CHUNK_MS + 90_000, { chunkMs: CHUNK_MS });
    const seen = statuses(ctx, mark);
    const late = seen.filter((s) => s.at > silentAt + window + 1000 + CHUNK_MS);
    ctx.evidence(`statuses after the coordinator fell silent: ${seen.map((s) => `${s.at - silentAt} ms ${s.transports.map((x) => x.state).join("/")}`).join(", ")}`);
    must(late.length > 0, "no status after the window");
    must(seen.some((s) => s.at <= silentAt + window + 1000 + CHUNK_MS + oneSecond(ctx) && s.transports.length > 0 && s.transports.every((x) => x.state === "down")),
      `the coordinator was not shown down within ${window} ms of its last answer`);
    const up = late.find((s) => s.transports.some((x) => x.state === "up"));
    must(!up, `the coordinator was shown up ${up ? up.at - silentAt : 0} ms after its last answer, with no answer since`);
  } finally {
    await transport.send({ op: "hostLink", open: true, answers: true });
  }
});
