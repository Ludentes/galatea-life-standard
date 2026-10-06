import { DIMMER } from "../util.js";
import { fixtureDevices } from "@ludentes/galatea-life-sim";
import { must } from "../../assert.js";
import { requirement } from "../../registry.js";
import { McpSeam } from "../../seams/mcp.js";
import { pollUntil } from "../../util.js";
import { STEWARD_CLIENT } from "../../steward-home.js";

const ERA_2025 = new Set(["2025-06-18", "2025-11-25"]);

requirement("GA-BIND-2", {
  seam: "steward",
  covers: "the steward serves 2026-07-28 to a caller that negotiates, and the 2025-11-25 handshake to one that speaks only it; it reaches its applier at 2026-07-28, and, once the applier serves only the 2025 era, at a 2025 revision; a probe at a revision outside the three is not made",
}, async (ctx) => {
  const owner = ctx.steward!.owner;
  ctx.evidence(`the owner's session: ${owner.protocolVersion}`);
  must(owner.protocolVersion === "2026-07-28", `the steward was reached at MCP revision ${owner.protocolVersion ?? "unknown"}, not 2026-07-28`);
  const legacy = await McpSeam.connect(ctx.mcpUrl!, ctx.credentials!.owner, { era: "legacy" });
  try {
    await legacy.callOk("describe");
    ctx.evidence(`a 2025-only caller: ${legacy.protocolVersion}`);
    must(legacy.protocolVersion !== undefined && ERA_2025.has(legacy.protocolVersion),
      `a caller speaking only the 2025 handshake was reached at ${legacy.protocolVersion}`);
  } finally {
    await legacy.close();
  }
  const standIn = ctx.standIn!;
  const seen = () => standIn.applier.revisions.get(STEWARD_CLIENT) ?? [];
  const before = [...new Set(seen())];
  ctx.evidence(`the steward's calls to its applier came at ${before.join(", ") || "nothing"}`);
  must(before.length === 1 && before[0] === "2026-07-28", `the steward called its applier at ${before.join(", ") || "nothing"}, not 2026-07-28 alone`);
  const n = seen().length;
  standIn.onlyLegacy(true);
  // A model change wakes the steward's long poll; its next call meets an applier of the 2025 era.
  standIn.applier.scriptDevice(fixtureDevices(["dimmer"])[0]!);
  await pollUntil(async () => ((await owner.callOk("describe")).targets as { id: string }[]).some((t) => t.id === DIMMER),
    15_000, `the steward did not follow its applier once the applier served only the 2025 era`, 200);
  const after = [...new Set(seen().slice(n))];
  ctx.evidence(`after the applier served only the 2025 era, its calls came at ${after.join(", ")}`);
  must(after.length > 0 && after.every((v) => ERA_2025.has(v)), `once the applier served only 2025, the steward called it at ${after.join(", ")}`);
});
