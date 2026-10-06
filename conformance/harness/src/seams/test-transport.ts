import { randomUUID } from "node:crypto";
import { validate } from "@ludentes/galatea-life-schemas";
import { connectAsync, type MqttClient } from "mqtt";
import { SubjectFault } from "../assert.js";

/**
 * The test transport answered that it cannot play `op`: a subject whose transport has no such
 * thing (a wake relay has no devices that join or report). The runner reports the test
 * not_applicable, with the refusal as its evidence. It is not a SubjectFault: the subject did
 * nothing wrong.
 */
export class OpUnsupported extends Error {
  constructor(readonly op: string, readonly detail: string) {
    super(`the test transport cannot play ${op}: ${detail}`);
  }
}

/** The harness's side of the test transport's control protocol (the spec's table). */
export class TestTransportClient {
  readonly received: Record<string, unknown>[] = [];
  /** Bodies the subject published on the reply or received topic that are not JSON objects. */
  readonly malformed: string[] = [];
  /** Errors of the harness's own MQTT client. */
  readonly clientErrors: string[] = [];
  private readonly replies = new Map<string, (r: { ok: boolean; error?: string; unsupported?: boolean }) => void>();

  private constructor(private readonly client: MqttClient, private readonly topic: string) {
    client.on("error", (err) => void this.clientErrors.push(err.message));
    client.on("message", (t, payload) => {
      let body: any;
      try {
        body = JSON.parse(payload.toString());
      } catch {
        body = undefined;
      }
      if (typeof body !== "object" || body === null) {
        this.malformed.push(`${t}: ${payload.toString().slice(0, 200)}`);
        return;
      }
      if (t === `${topic}/reply`) this.replies.get(body.requestId)?.(body);
      else if (t === `${topic}/received`) this.received.push(body);
    });
  }

  static async start(url: string, controlTopic: string): Promise<TestTransportClient> {
    const client = await connectAsync(url, { protocolVersion: 5, username: "galatea-harness" });
    const c = new TestTransportClient(client, controlTopic);
    await client.subscribeAsync([`${controlTopic}/reply`, `${controlTopic}/received`], { qos: 1 });
    return c;
  }

  /**
   * Sends one op and waits for its reply. No reply, or a refusal, is the subject's fault; a
   * malformed message, or a failure of the harness's own MQTT client, is the harness's.
   */
  async send(msg: Record<string, unknown> & { op: string }, ms = 5000): Promise<void> {
    const body = { requestId: randomUUID(), ...msg };
    const errors = validate("harness/test-control.json", body);
    if (errors.length) throw new Error(`the harness built a bad control message: ${errors.join("; ")}`);
    const reply = new Promise<{ ok: boolean; error?: string; unsupported?: boolean }>((resolve, reject) => {
      const t = setTimeout(() => {
        this.replies.delete(body.requestId);
        if (this.clientErrors.length) {
          reject(new Error(`no reply to ${msg.op} on ${this.topic}: the harness's MQTT client failed: ${this.clientErrors.join("; ")}`));
          return;
        }
        const bad = this.malformed.length ? `; the subject published bodies that are not JSON: ${this.malformed.join(" | ")}` : "";
        reject(new SubjectFault(`no reply to ${msg.op} on ${this.topic} in ${ms} ms${bad}`));
      }, ms);
      this.replies.set(body.requestId, (r) => { clearTimeout(t); resolve(r); });
    });
    await this.client.publishAsync(this.topic, JSON.stringify(body), { qos: 1 });
    const r = await reply;
    this.replies.delete(body.requestId);
    if (!r.ok && r.unsupported) throw new OpUnsupported(msg.op, r.error ?? "");
    if (!r.ok) throw new SubjectFault(`${msg.op} refused by the test transport: ${r.error}`, r);
  }

  close(): Promise<void> {
    return this.client.endAsync();
  }
}
