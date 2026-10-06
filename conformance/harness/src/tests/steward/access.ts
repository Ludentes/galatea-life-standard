import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { must } from "../../assert.js";
import { requirement } from "../../registry.js";
import { SubjectNotReady } from "../../subject.js";
import { pollUntil } from "../../util.js";
import { mustBeNotPermitted } from "../util.js";
import { del, ownerDefine } from "./util.js";

requirement("GA-AUTH-4", {
  seam: "steward",
  covers: "at 2026-07-28 and at the 2025 handshake, an unregistered bearer is not_permitted, and a credential the owner deleted is not_permitted in the session it opened while registered",
}, async (ctx) => {
  for (const era of ["auto", "legacy"] as const) await mustBeNotPermitted(ctx.mcpUrl!, randomUUID(), "an unregistered bearer", era);
  const olga = ctx.steward!.olga;
  await olga.callOk("describe");
  const r = await ownerDefine(ctx, [del("credential", { id: "olga-app" })]);
  must(r.ok, `deleting credential olga-app returned ${r.ok ? "" : r.error}`, r.body);
  const after = await olga.call("describe");
  ctx.evidence(`olga's session after her credential was deleted: ${after.ok ? "answered" : after.error}`);
  must(!after.ok && after.error === "not_permitted", `a deleted credential's session was ${after.ok ? "answered" : `refused with ${after.error}`}`);
});

requirement("GA-SEC-2", {
  seam: "steward", standIn: { tls: true },
  covers: "under the harness, the steward does not complete a TLS connection to an applier on another address of the host whose certificate it was not told to trust, nor call it; it serves no plain HTTP off loopback; and, started with GALATEA_STEWARD_HOST on that address and no certificate, it refuses to start",
}, async (ctx) => {
  const standIn = ctx.standIn!;
  // Not the subject's fault: the host has nothing but loopback, or no openssl, to try it with.
  if (!standIn.url.startsWith("https:")) throw new Error("this host has no non-loopback IPv4 address, or no openssl, to try GA-SEC-2 on");
  await pollUntil(async () => standIn.connections().tcp > 0, 10_000, "the steward never tried its applier", 100);
  // Room for a retry or two after the first refusal.
  await new Promise((r) => setTimeout(r, 1500));
  const seen = standIn.connections();
  const calls = standIn.applier.revisions.get("steward") ?? [];
  ctx.evidence(`the stand-in at ${standIn.url}: ${seen.tcp} TCP connections, ${seen.tls} TLS handshakes completed, ${calls.length} MCP calls`);
  must(seen.tls === 0 && calls.length === 0, `the steward accepted a certificate it was not told to trust: ${seen.tls} handshakes, ${calls.length} calls`);
  const port = new URL(ctx.mcpUrl!).port;
  const address = Object.values(networkInterfaces()).flat().find((a) => a && a.family === "IPv4" && !a.internal)!.address;
  let answered: number | undefined;
  try {
    const r = await fetch(`http://${address}:${port}/mcp`, { method: "POST", signal: AbortSignal.timeout(3000),
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" });
    answered = r.status;
  } catch {
    // Refused, reset or timed out: nothing is served there.
  }
  ctx.evidence(`http://${address}:${port}/mcp ${answered === undefined ? "was not served" : `answered ${answered}`}`);
  must(answered === undefined, `plain HTTP off loopback answered ${answered}`);
  // The server half: told to serve on that address with no certificate, the steward does not start.
  let refused: string | undefined;
  try {
    await ctx.startSteward!({ GALATEA_STEWARD_HOST: address });
  } catch (err) {
    if (!(err instanceof SubjectNotReady)) throw err;
    refused = `${err.message}${err.output.length ? `: ${err.output.at(-1)}` : ""}`;
  }
  ctx.evidence(`a steward started with GALATEA_STEWARD_HOST=${address} and no certificate: ${refused ?? "started"}`);
  must(refused !== undefined && refused.includes("exited"),
    `a steward told to serve plain HTTP on ${address} ${refused === undefined ? "started" : `was not ready, but did not exit (${refused})`}`);
});
