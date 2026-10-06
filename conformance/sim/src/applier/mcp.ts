import { createServer as createHttp, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttps } from "node:https";
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, legacyStatelessFallback, Server } from "@modelcontextprotocol/server";
import { SPEAKS_ONLY_2025, TOOLS, type SimApplier } from "./sim-applier.js";

const bearerOf = (req: Request | undefined) => {
  const auth = req?.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
};

// The low-level Server, not McpServer: each tool's schema is the operation's JSON Schema as the
// standard gives it, and McpServer takes Standard Schema objects instead.
function mcpServer(applier: SimApplier, bearer: string | undefined, version: string | null | undefined): Server {
  const server = new Server({ name: "galatea-sim-applier", version: "0.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler("tools/list", async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: `The applier's ${t.name} (standard/applier.md, Operations)`,
      inputSchema: { type: "object" as const },
      annotations: t.readOnly ? { readOnlyHint: true } : { destructiveHint: true },
    })),
  }));
  server.setRequestHandler("tools/call", async (req) => {
    const caller = applier.caller(bearer);
    applier.seen(caller, version);
    const result = await applier.call(caller, req.params.name, req.params.arguments ?? {});
    const out = result.ok ? result.body : { error: result.error, message: result.message };
    return { content: [{ type: "text" as const, text: JSON.stringify(out) }], structuredContent: out, isError: !result.ok };
  });
  return server;
}

/**
 * The applier's MCP binding over Streamable HTTP, on loopback (GA-SEC-1 allows plain HTTP there), or
 * with `tls` on another address of the host (the steward's GA-SEC-2). It serves 2026-07-28
 * (GA-BIND-1), and 2025 too through the stateless fallback, as GA-BIND-1 allows; the mutation
 * `speaks-only-2025` serves only the 2025 era, and so does the server once `onlyLegacy(true)` (a test's
 * applier that stops serving 2026-07-28, for the steward's GA-BIND-2). Each call's revision is
 * recorded (`SimApplier.revisions`).
 */
export async function serveMcp(applier: SimApplier, port: number, o: { host?: string; tls?: { cert: string; key: string } } = {}):
Promise<{ url: string; close(): Promise<void>; connections(): { tcp: number; tls: number }; onlyLegacy(on: boolean): void }> {
  const host = o.host ?? "127.0.0.1";
  const factory = (ctx: { requestInfo?: Request }) =>
    mcpServer(applier, bearerOf(ctx.requestInfo), ctx.requestInfo?.headers.get("mcp-protocol-version"));
  const modern = createMcpHandler(factory);
  const legacy = legacyStatelessFallback(factory);
  let legacyOnly = applier.mutation === SPEAKS_ONLY_2025;
  const mcp = { fetch: (req: Request) => (legacyOnly ? legacy(req) : modern.fetch(req)), close: () => modern.close() };
  const handle = toNodeHandler(mcp);
  const validHost = localhostHostValidation();
  const validOrigin = localhostOriginValidation();
  const listener = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    if (!o.tls && (!validHost(req, res) || !validOrigin(req, res))) return;
    try {
      await handle(req, res);
    } catch (err) {
      if (!res.headersSent) res.writeHead(500).end(String(err));
    }
  };
  const http = o.tls ? createHttps({ cert: o.tls.cert, key: o.tls.key }, listener) : createHttp(listener);
  // What reached the server: TCP connections, and those whose TLS handshake completed.
  const seen = { tcp: 0, tls: 0 };
  http.on("connection", () => { seen.tcp++; });
  http.on("secureConnection", () => { seen.tls++; });
  await new Promise<void>((r) => http.listen(port, host, r));
  return {
    url: `${o.tls ? "https" : "http"}://${host.includes(":") ? `[${host}]` : host}:${port}/mcp`,
    connections: () => ({ ...seen }),
    onlyLegacy: (on) => { legacyOnly = on; },
    close: async () => {
      await mcp.close();
      await new Promise<void>((r) => { http.closeAllConnections(); http.close(() => r()); });
    },
  };
}
