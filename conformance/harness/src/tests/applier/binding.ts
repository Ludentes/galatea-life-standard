import { must } from "../../assert.js";
import { requirement } from "../../registry.js";
import { EMPTY_HOME } from "../util.js";

requirement("GA-BIND-1", {
  seam: "applier", fixture: EMPTY_HOME, covers: "the applier serves revision 2026-07-28 to a client; the owner's configuration credential is not checked at that revision",
}, async (ctx) => {
  const version = ctx.mcp!.protocolVersion;
  must(version === "2026-07-28", `the subject was reached at MCP revision ${version ?? "unknown"}, not 2026-07-28`, { version });
});
