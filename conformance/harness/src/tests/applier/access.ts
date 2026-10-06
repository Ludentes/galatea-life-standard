import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { must } from "../../assert.js";
import { requirement } from "../../registry.js";
import { McpSeam } from "../../seams/mcp.js";
import { client, EMPTY_HOME, mustBeNotPermitted, ownerConfigure } from "../util.js";

requirement("GA-AUTH-3", {
  seam: "applier", fixture: EMPTY_HOME,
  covers: "at 2026-07-28 and at the 2025 handshake, an unregistered bearer is refused, and a removed client is refused in the session it opened while registered",
}, async (ctx) => {
  for (const era of ["auto", "legacy"] as const) {
    const stranger = await mustBeNotPermitted(ctx.mcpUrl!, randomUUID(), "an unregistered bearer", era);
    const credential = randomUUID();
    const id = `auth-3-${era}`;
    const added = await ownerConfigure(ctx.owner!, [client(id, credential)]);
    must(added.ok, `registering ${id} returned ${added.ok ? "" : added.error}`, added.body);
    const session = await McpSeam.connect(ctx.mcpUrl!, credential, { era });
    try {
      await session.callOk("describe");
      const removed = await ownerConfigure(ctx.owner!, [{ op: "delete", kind: "client", value: { id } }]);
      must(removed.ok, `removing ${id} returned ${removed.ok ? "" : removed.error}`, removed.body);
      const r = await session.call("describe");
      ctx.evidence(`era ${era} (${session.protocolVersion}): stranger ${stranger}; removed client ${r.ok ? "answered" : r.error}`);
      must(!r.ok && r.error === "not_permitted",
        `a removed client's session was ${r.ok ? "answered" : `refused with ${r.error}`} (era ${era})`, r.body);
    } finally {
      await session.close();
    }
  }
});

requirement("GA-SEC-1", {
  seam: "applier", fixture: EMPTY_HOME,
  covers: "under the harness, on loopback, the applier does not serve plain HTTP on the host's other addresses",
}, async (ctx) => {
  const port = new URL(ctx.mcpUrl!).port;
  const address = Object.values(networkInterfaces()).flat()
    .find((a) => a && a.family === "IPv4" && !a.internal)?.address;
  // Not the subject's fault: the harness's host has nothing but loopback to try.
  if (!address) throw new Error("this host has no non-loopback IPv4 address to try GA-SEC-1 on");
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
});
