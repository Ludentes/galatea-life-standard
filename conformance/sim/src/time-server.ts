import { createSocket, type Socket } from "node:dgram";
import type { AddressInfo } from "node:net";
import { isRequest, response } from "@ludentes/galatea-life-test-clock";

/** Where subject time starts at each reset: 2030-01-01T08:00Z. */
export const SUBJECT_EPOCH_MS = Date.UTC(2030, 0, 1, 8);

/** The longest poll the subject contract allows. */
const POLL_MS = 100;
const ACTIVE_WINDOW_MS = 1000;
/** A client that hasn't queried in this long after the step (five polls) is gone. */
const GONE_MS = 500;
const CHUNK_MS = 20_000;

/** The harness's SNTP server. Subject time is the wall clock plus an offset a test steps. */
export class TimeServer {
  private offset = 0;
  /** Real time of each client's queries, by `address:port`. */
  private readonly queries = new Map<string, number[]>();

  private constructor(private readonly socket: Socket, readonly source: string) {}

  static async start(opts: { startMs?: number } = {}): Promise<TimeServer> {
    const socket = createSocket("udp4");
    await new Promise<void>((r) => socket.bind(0, "127.0.0.1", r));
    const { port } = socket.address() as AddressInfo;
    const server = new TimeServer(socket, `127.0.0.1:${port}`);
    server.reset(opts.startMs);
    socket.on("message", (msg, rinfo) => {
      if (!isRequest(msg)) return;
      const key = `${rinfo.address}:${rinfo.port}`;
      const list = server.queries.get(key) ?? [];
      list.push(Date.now());
      if (list.length > 100) list.shift();
      server.queries.set(key, list);
      socket.send(response(msg, server.now()), rinfo.port, rinfo.address);
    });
    return server;
  }

  now(): number {
    return Date.now() + this.offset;
  }

  /** Subject time at a real time, for a message that arrived then. */
  at(realMs: number): number {
    return realMs + this.offset;
  }

  step(ms: number): void {
    this.offset += ms;
  }

  /** Subject time back to `startMs` (the epoch by default), and no clients remembered. */
  reset(startMs = SUBJECT_EPOCH_MS): void {
    this.offset = startMs - Date.now();
    this.queries.clear();
  }

  /**
   * Resolves once every client active before `afterRealMs` has queried after it, plus one poll.
   * A client that hasn't queried again within `GONE_MS` of the step (a subject that stopped,
   * restarted or crashed) is forgotten instead of waited for.
   */
  async awaitTaken(afterRealMs: number): Promise<void> {
    const active = [...this.queries]
      .filter(([, times]) => times.some((t) => t >= afterRealMs - ACTIVE_WINDOW_MS && t <= afterRealMs))
      .map(([key]) => key);
    for (;;) {
      const waiting = active.filter((key) => {
        const times = this.queries.get(key);
        if (!times) return false;
        if (times.some((t) => t > afterRealMs)) return false;
        if (Date.now() - afterRealMs > GONE_MS) {
          this.queries.delete(key);
          return false;
        }
        return true;
      });
      if (!waiting.length) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  async stepAndWait(ms: number): Promise<void> {
    const t = Date.now();
    this.step(ms);
    await this.awaitTaken(t);
  }

  /** Time passing rather than jumping: chunk by chunk, each taken by every client. */
  async advance(ms: number, { chunkMs = CHUNK_MS }: { chunkMs?: number } = {}): Promise<void> {
    for (let left = ms; left > 0; left -= chunkMs) await this.stepAndWait(Math.min(chunkMs, left));
  }

  close(): Promise<void> {
    return new Promise((r) => this.socket.close(() => r()));
  }
}
