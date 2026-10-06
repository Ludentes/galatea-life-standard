import { connectAsync, type MqttClient } from "mqtt";
import { RequirementFailure } from "../assert.js";

export interface Seen {
  topic: string;
  payload: any;
  retained: boolean;
  realAt: number;
}

/** Everything published under a filter, with its arrival time and retain flag. */
export class BridgeWatcher {
  readonly seen: Seen[] = [];
  /** Errors of the harness's own MQTT client; a wait that times out after one is a harness fault. */
  readonly clientErrors: string[] = [];
  private waiters: (() => void)[] = [];

  private constructor(private readonly client: MqttClient, private readonly filter: string) {
    client.on("error", (err) => void this.clientErrors.push(err.message));
    client.on("message", (topic, payload, packet) => {
      let body: unknown = null;
      if (payload.length) {
        try {
          body = JSON.parse(payload.toString());
        } catch {
          body = payload.toString();
        }
      }
      this.seen.push({ topic, payload: body, retained: packet.retain, realAt: Date.now() });
      for (const w of this.waiters.splice(0)) w();
    });
  }

  static async start(url: string, filter: string): Promise<BridgeWatcher> {
    const client = await connectAsync(url, { protocolVersion: 5, username: "galatea-harness" });
    const w = new BridgeWatcher(client, filter);
    await client.subscribeAsync(filter, { qos: 1 });
    return w;
  }

  async waitFor(pred: (s: Seen) => boolean, ms: number, from = 0): Promise<Seen> {
    const deadline = Date.now() + ms;
    for (;;) {
      const hit = this.seen.slice(from).find(pred);
      if (hit) return hit;
      const left = deadline - Date.now();
      if (left <= 0 && this.clientErrors.length) {
        throw new Error(`the harness's MQTT client on ${this.filter} failed: ${this.clientErrors.join("; ")}`);
      }
      if (left <= 0) throw new RequirementFailure(`nothing expected arrived on ${this.filter} within ${ms} ms`);
      await new Promise<void>((r) => {
        const t = setTimeout(r, left);
        this.waiters.push(() => { clearTimeout(t); r(); });
      });
    }
  }

  close(): Promise<void> {
    return this.client.endAsync();
  }
}
