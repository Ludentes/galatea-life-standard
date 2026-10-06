import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { RequirementFailure, SubjectFault } from "../assert.js";

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export type McpResult = { ok: true; body: any } | { ok: false; error: string; message: string; body: any };

/** A client of an MCP seam with one bearer credential. */
export class McpSeam {
  private constructor(private readonly client: Client, private readonly again: () => Promise<McpSeam>) {}

  /**
   * Connects, or a SubjectFault: the subject serves the seam, so a failed connect is its fault.
   * The standard pins revision 2026-07-28 (GA-BIND-1), but the harness still negotiates, falling
   * back to the 2025 handshake: a subject on another revision is graded on everything else, and
   * fails GA-BIND-1 alone. `era: "legacy"` speaks only the 2025 handshake, as an older client would.
   */
  static async connect(url: string, bearer: string, opts: { era?: "auto" | "legacy" } = {}): Promise<McpSeam> {
    const client = new Client({ name: "galatea-harness", version: "0.0.0" },
      { versionNegotiation: { mode: opts.era ?? "auto" } });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
      }));
    } catch (err) {
      throw new SubjectFault(`the subject's MCP at ${url} could not be connected: ${errorText(err)}`);
    }
    return new McpSeam(client, () => McpSeam.connect(url, bearer, opts));
  }

  /** A new session with the same credential, as a client that went away and came back would open. */
  reconnect(): Promise<McpSeam> {
    return this.again();
  }

  /** The tool's result; no answer, a timeout, or a body that is not JSON is a SubjectFault. */
  async call(tool: string, args: Record<string, unknown> = {}): Promise<McpResult> {
    let r: { structuredContent?: unknown; content?: { type: string; text?: string }[]; isError?: boolean };
    try {
      r = (await this.client.callTool({ name: tool, arguments: args }, { timeout: 60_000 })) as typeof r;
    } catch (err) {
      throw new SubjectFault(`${tool}: ${errorText(err)}`);
    }
    const text = r.content?.find((c) => c.type === "text")?.text;
    let body: any = r.structuredContent;
    if (body === undefined && text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new SubjectFault(`${tool} answered a text that is not JSON: ${text.slice(0, 200)}`, text);
      }
    }
    if (r.isError) return { ok: false, error: String(body?.error), message: String(body?.message), body };
    return { ok: true, body };
  }

  /** The body, or a RequirementFailure naming the error the subject returned. */
  async callOk(tool: string, args: Record<string, unknown> = {}): Promise<any> {
    const r = await this.call(tool, args);
    if (!r.ok) throw new RequirementFailure(`${tool} returned ${r.error}: ${r.message}`, r.body);
    return r.body;
  }

  /** The MCP protocol revision the subject was reached at. */
  get protocolVersion(): string | undefined {
    return this.client.getNegotiatedProtocolVersion();
  }

  close(): Promise<void> {
    return this.client.close();
  }
}
