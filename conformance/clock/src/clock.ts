import { createSocket, type Socket } from "node:dgram";
import { performance } from "node:perf_hooks";
import { isResponse, request, transmitTime } from "./sntp.js";

/** Every time a subject uses, elapsed time included (GA-HARN-1, GA-BRIDGE-16). */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  setInterval(fn: () => void, ms: number): number;
  clear(handle: number): void;
  close(): void;
}

export function systemClock(): Clock {
  const handles = new Map<number, NodeJS.Timeout>();
  let next = 1;
  return {
    now: () => Date.now(),
    setTimeout(fn, ms) {
      const h = next++;
      handles.set(h, setTimeout(() => { handles.delete(h); fn(); }, ms));
      return h;
    },
    setInterval(fn, ms) {
      const h = next++;
      handles.set(h, setInterval(fn, ms));
      return h;
    },
    clear(h) {
      const t = handles.get(h);
      if (t) { clearTimeout(t); clearInterval(t); handles.delete(h); }
    },
    close() { for (const h of [...handles.keys()]) this.clear(h); },
  };
}

type Timer = { due: number; fn: () => void; every?: number };

const local = () => performance.timeOrigin + performance.now();

function parseSource(source: string): [string, number] {
  const i = source.lastIndexOf(":");
  const port = Number(source.slice(i + 1));
  if (i < 1 || !Number.isInteger(port)) throw new Error(`time source must be host:port, not ${source}`);
  return [source.slice(0, i), port];
}

/**
 * A clock whose time is an SNTP source's. It polls the source every `pollMs`, and fires its timers
 * against the source's time, so a step of an hour fires an hour's timers at once.
 */
export class TestClock implements Clock {
  private offset = 0;
  private readonly timers = new Map<number, Timer>();
  private next = 1;
  private readonly socket: Socket = createSocket("udp4");
  private poll?: NodeJS.Timeout;
  private tick?: NodeJS.Timeout;
  private host = "";
  private port = 0;

  private constructor(source: string, private readonly pollMs: number) {
    [this.host, this.port] = parseSource(source);
  }

  get source(): string {
    return `${this.host}:${this.port}`;
  }

  static async connect(source: string, opts: { pollMs?: number } = {}): Promise<TestClock> {
    const clock = new TestClock(source, opts.pollMs ?? 50);
    await clock.sync();
    clock.poll = setInterval(() => clock.sync().catch(() => undefined), clock.pollMs);
    clock.tick = setInterval(() => clock.fire(), 20);
    return clock;
  }

  /** Takes its time from `source` from now on; if `source` does not answer, keeps the old one. */
  async retarget(source: string): Promise<void> {
    const [host, port] = parseSource(source);
    const was: [string, number] = [this.host, this.port];
    [this.host, this.port] = [host, port];
    try {
      await this.sync();
    } catch (err) {
      [this.host, this.port] = was;
      throw err;
    }
  }

  now(): number {
    return local() + this.offset;
  }

  /** Ask the source once, take its offset, and fire what is due. */
  sync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sent = local();
      const req = request(sent);
      const onMessage = (msg: Buffer) => {
        // Only the answer to this request: after a lost packet, an older answer would skew the offset.
        if (!isResponse(msg) || !msg.subarray(24, 32).equals(req.subarray(40, 48))) return;
        clearTimeout(timeout);
        this.socket.off("message", onMessage);
        const received = local();
        this.offset = transmitTime(msg) + (received - sent) / 2 - received;
        this.fire();
        resolve();
      };
      const timeout = setTimeout(() => {
        this.socket.off("message", onMessage);
        reject(new Error(`no answer from the time source ${this.source}`));
      }, 1000);
      this.socket.on("message", onMessage);
      this.socket.send(req, this.port, this.host);
    });
  }

  setTimeout(fn: () => void, ms: number): number {
    const h = this.next++;
    this.timers.set(h, { due: this.now() + ms, fn });
    return h;
  }

  setInterval(fn: () => void, ms: number): number {
    const every = Math.max(ms, 1);
    const h = this.next++;
    this.timers.set(h, { due: this.now() + every, fn, every });
    return h;
  }

  clear(handle: number): void {
    this.timers.delete(handle);
  }

  close(): void {
    clearInterval(this.poll);
    clearInterval(this.tick);
    this.timers.clear();
    this.socket.close();
  }

  /** Fire every due timer in due order; an interval fires once for each period it was owed. */
  private fire(): void {
    for (;;) {
      const now = this.now();
      let first: [number, Timer] | undefined;
      for (const entry of this.timers) {
        if (entry[1].due <= now && (!first || entry[1].due < first[1].due)) first = entry;
      }
      if (!first) return;
      const [handle, timer] = first;
      if (timer.every !== undefined) timer.due += timer.every;
      else this.timers.delete(handle);
      try {
        timer.fn();
      } catch (err) {
        setImmediate(() => { throw err; });
      }
    }
  }
}

/** A `TestClock` on `GALATEA_TIME_SOURCE` when the harness set it, otherwise the system's. */
export async function clockFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<Clock> {
  const source = env.GALATEA_TIME_SOURCE;
  return source ? TestClock.connect(source) : systemClock();
}
