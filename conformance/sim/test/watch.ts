import { connectAsync, type MqttClient } from "mqtt";

export interface Seen { topic: string; payload: any; retained: boolean; realAt: number }

/** Subscribes to a filter and keeps everything, parsed; empty payloads are null. */
export async function watch(url: string, filter: string) {
  const client: MqttClient = await connectAsync(url, { protocolVersion: 5 });
  const seen: Seen[] = [];
  const waiters: (() => void)[] = [];
  client.on("message", (topic, payload, packet) => {
    let parsed: unknown = null;
    if (payload.length) {
      try {
        parsed = JSON.parse(payload.toString());
      } catch {
        parsed = payload.toString();
      }
    }
    seen.push({ topic, payload: parsed, retained: packet.retain, realAt: Date.now() });
    for (const w of waiters.splice(0)) w();
  });
  await client.subscribeAsync(filter, { qos: 1 });
  return {
    seen,
    client,
    async waitFor(pred: (s: Seen) => boolean, ms: number, from = 0): Promise<Seen> {
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = seen.slice(from).find(pred);
        if (hit) return hit;
        const left = deadline - Date.now();
        if (left <= 0) throw new Error(`nothing matched on ${filter} in ${ms} ms`);
        await new Promise<void>((r) => { waiters.push(r); setTimeout(r, left); });
      }
    },
    close: () => client.endAsync(),
  };
}
