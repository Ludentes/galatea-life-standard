import { createConnection, createServer, type Socket } from "node:net";
import { startBroker, type Broker } from "@ludentes/galatea-life-sim";
import { connectAsync, type MqttClient } from "mqtt";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BridgeLink, type LinkRecord } from "../src/seams/bridge-link.js";

let broker: Broker;
const cleanup: (() => unknown)[] = [];
beforeAll(async () => { broker = await startBroker(); }, 60_000);
afterAll(async () => { await broker.stop(); });
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

const until = async (check: () => boolean, ms: number) => {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`not within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

async function through(link: BridgeLink, opts: Parameters<typeof connectAsync>[1] = {}): Promise<MqttClient> {
  const client = await connectAsync(link.url, { protocolVersion: 5, reconnectPeriod: 200, ...opts });
  client.on("error", () => undefined);
  cleanup.push(() => client.endAsync(true));
  return client;
}

async function open(): Promise<BridgeLink> {
  const link = await BridgeLink.start(broker.url);
  cleanup.push(() => link.close());
  return link;
}

describe("BridgeLink", () => {
  it("reads the subject's CONNECT, SUBSCRIBE, PUBLISH, UNSUBSCRIBE and DISCONNECT, and the broker's answers, in order", async () => {
    const link = await open();
    const client = await through(link, { clientId: "b-1", username: "subject-bridge", keepalive: 10, clean: true,
      properties: { sessionExpiryInterval: 30, receiveMaximum: 20, userProperties: { a: "b" } },
      will: { topic: "demo/l/lwt", payload: Buffer.from("{\"instanceId\":\"i\"}"), qos: 1, retain: true,
        properties: { willDelayInterval: 5, contentType: "application/json" } } });
    await client.subscribeAsync(["demo/l/devices/+/command", "demo/l/request/+"], { qos: 1, rh: 2 });
    await client.publishAsync("demo/l/status", "{\"state\":\"online\"}", { qos: 1, retain: true });
    await client.unsubscribeAsync(["demo/l/devices/+/command"]);
    await client.endAsync();
    await until(() => link.records.some((r) => r.kind === "disconnect"), 2000);
    expect(link.records.map((r) => r.kind)).toEqual(["connect", "subscribe", "suback", "publish", "puback", "unsubscribe", "unsuback", "disconnect"]);
    expect(link.records[0]).toMatchObject({ conn: 1, level: 5, clientId: "b-1", cleanStart: true, keepalive: 10, sessionExpiry: 30,
      username: "subject-bridge", will: { topic: "demo/l/lwt", payload: "{\"instanceId\":\"i\"}", qos: 1, retain: true, delay: 5 } });
    expect(link.records[1]).toMatchObject({ filters: [{ filter: "demo/l/devices/+/command", qos: 1, retainHandling: 2 },
      { filter: "demo/l/request/+", qos: 1, retainHandling: 2 }] });
    expect(link.records[2]).toMatchObject({ codes: [1, 1], refused: false });
    expect(link.records[3]).toMatchObject({ topic: "demo/l/status", qos: 1, retain: true, payload: "{\"state\":\"online\"}" });
    expect(link.records[5]).toMatchObject({ filters: ["demo/l/devices/+/command"] });
    expect(link.records[7]).toMatchObject({ reason: 0 });
  });

  it("answers the subscriptions and publishes it is told to with a refusal, and passes the rest", async () => {
    const link = await open();
    link.refuse({ subscribe: (f) => f.endsWith("/request/+"), publish: (t) => t.endsWith("/vault/status") });
    const client = await through(link);
    await expect(client.subscribeAsync(["demo/r/devices/+/command", "demo/r/request/+"], { qos: 1 })).rejects.toMatchObject({
      packet: { granted: [1, 0x87] } });
    await expect(client.publishAsync("demo/r/devices/vault/status", "{}", { qos: 1 })).rejects.toMatchObject({ code: 0x87 });
    await client.publishAsync("demo/r/devices/lamp/status", "{}", { qos: 1 });
    expect(link.records.filter((r) => r.kind === "suback" || r.kind === "puback").map((r) => [r.kind, (r as { refused: boolean }).refused]))
      .toEqual([["suback", true], ["puback", true], ["puback", false]]);
  });

  it("cuts every connection on sever, refuses new ones, and lets the subject back on restore", async () => {
    const link = await open();
    const client = await through(link);
    const closes: number[] = [];
    client.on("close", () => closes.push(Date.now()));
    expect(link.connected).toBe(true);
    link.sever();
    await until(() => closes.length > 0, 2000);
    await new Promise((r) => setTimeout(r, 600));
    expect(client.connected).toBe(false);
    expect(link.connected).toBe(false);
    link.restore();
    await until(() => client.connected, 3000);
    expect(link.records.filter((r) => r.kind === "connect").map((r) => r.conn)).toContain(2);
  });

  it("records the text an MQTT 5 CONNECT, its will and a PUBLISH carry in their properties", async () => {
    const link = await open();
    const client = await through(link, { clientId: "b-p", properties: { userProperties: { who: "connect" } },
      will: { topic: "demo/p/lwt", payload: Buffer.from(""), qos: 1, retain: false,
        properties: { contentType: "text/will", responseTopic: "demo/p/will-reply", userProperties: { k: "will" } } } });
    await client.publishAsync("demo/p/status", "{}", { qos: 1, properties: { contentType: "application/json",
      responseTopic: "demo/p/reply", correlationData: Buffer.from("corr-1"), userProperties: { a: "b", c: ["d", "e"] } } });
    await client.publishAsync("demo/p/plain", "{}", { qos: 1 });
    const connect = link.records.find((r) => r.kind === "connect") as Extract<LinkRecord, { kind: "connect" }>;
    expect(connect.properties).toEqual(["who", "connect"]);
    expect(connect.will?.properties?.sort()).toEqual(["demo/p/will-reply", "k", "text/will", "will"].sort());
    const publishes = link.records.filter((r) => r.kind === "publish") as Extract<LinkRecord, { kind: "publish" }>[];
    expect(publishes[0]!.properties?.sort()).toEqual(["a", "application/json", "b", "c", "c", "corr-1", "d", "demo/p/reply", "e"].sort());
    expect(publishes[1]!.properties).toBeUndefined();
  });

  it("resolves an MQTT 5 topic alias, and records and refuses a publish by its real topic", async () => {
    const link = await open();
    link.refuse({ publish: (t) => t === "demo/a/vault/status" });
    const client = await through(link);
    await expect(client.publishAsync("demo/a/vault/status", "1", { qos: 1, properties: { topicAlias: 1 } }))
      .rejects.toMatchObject({ code: 0x87 });
    await expect(client.publishAsync("", "2", { qos: 1, properties: { topicAlias: 1 } })).rejects.toMatchObject({ code: 0x87 });
    await client.publishAsync("demo/a/lamp/status", "3", { qos: 1, properties: { topicAlias: 1 } });
    await client.publishAsync("", "4", { qos: 1, properties: { topicAlias: 1 } });
    expect(link.records.filter((r) => r.kind === "publish").map((r) => [(r as { topic: string }).topic, (r as { payload: string }).payload]))
      .toEqual([["demo/a/vault/status", "1"], ["demo/a/vault/status", "2"], ["demo/a/lamp/status", "3"], ["demo/a/lamp/status", "4"]]);
  });

  it("refuses a QoS 2 publish on its PUBREC, and frees the packet id for a later publish", async () => {
    const link = await open();
    link.refuse({ publish: (t) => t.endsWith("/vault/status") });
    // Every publish takes packet id 1, so a refusal left behind would refuse the next one wrongly.
    const one = { allocate: () => 1, getLastAllocated: () => 1, register: () => true, deallocate: () => {}, clear: () => {} };
    const client = await through(link, { messageIdProvider: one } as Parameters<typeof connectAsync>[1]);
    await expect(client.publishAsync("demo/q/vault/status", "{}", { qos: 2 })).rejects.toMatchObject({ code: 0x87 });
    await client.publishAsync("demo/q/lamp/status", "{}", { qos: 1 });
    await client.publishAsync("demo/q/lamp/status", "{}", { qos: 2 });
    expect(link.records.filter((r) => r.kind === "puback").map((r) => [(r as { packetId: number }).packetId, (r as { refused: boolean }).refused]))
      .toEqual([[1, true], [1, false], [1, false]]);
  });

  it("passes on everything the subject wrote before it closed, its DISCONNECT last, and then ends the upstream", async () => {
    // A broker that reads nothing until the subject has gone: what the link wrote waits in its own buffer.
    const got: Buffer[] = [];
    let upstream: Socket | undefined;
    const ended = new Promise<void>((resolve) => {
      const slow = createServer((s) => {
        upstream = s;
        s.pause();
        s.on("data", (b: Buffer) => got.push(b));
        s.on("end", () => resolve());
        s.on("error", () => undefined);
      });
      cleanup.push(() => new Promise((r) => slow.close(r)));
      slow.listen(0, "127.0.0.1", () => {
        void BridgeLink.start(`mqtt://127.0.0.1:${(slow.address() as { port: number }).port}`).then((l) => linked(l));
      });
    });
    let linked!: (l: BridgeLink) => void;
    const link = await new Promise<BridgeLink>((r) => { linked = r; });
    cleanup.push(() => link.close());
    const str = (v: string) => { const b = Buffer.from(v); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 0xff]), b]); };
    const length = (n: number) => { const out: number[] = []; do { out.push((n % 128) | (n >= 128 ? 0x80 : 0)); n = Math.floor(n / 128); } while (n > 0); return Buffer.from(out); };
    const packet = (first: number, body: Buffer) => Buffer.concat([Buffer.from([first]), length(body.length), body]);
    // MQTT 5 CONNECT with a will; a PUBLISH larger than the kernel takes at once; DISCONNECT, reason 0; then FIN.
    const connect = packet(0x10, Buffer.concat([str("MQTT"), Buffer.from([5, 0x0e, 0, 10, 0]), str("raw-1"), Buffer.from([0]),
      str("demo/f/lwt"), str("gone")]));
    const publish = packet(0x30, Buffer.concat([str("demo/f/big"), Buffer.from([0]), Buffer.alloc(16 * 1024 * 1024, 0x61)]));
    const disconnect = Buffer.from([0xe0, 1, 0]);
    const raw = createConnection({ host: "127.0.0.1", port: Number(new URL(link.url).port) });
    raw.on("error", () => undefined);
    const closed = new Promise((r) => raw.once("close", r));
    raw.end(Buffer.concat([connect, publish, disconnect]));
    await closed;
    await until(() => link.records.some((r) => r.kind === "disconnect"), 3000);
    await new Promise((r) => setTimeout(r, 200));
    upstream!.resume();
    await ended;
    const all = Buffer.concat(got);
    expect(all.length).toBe(connect.length + publish.length + disconnect.length);
    expect([...all.subarray(-3)]).toEqual([...disconnect]);
  });

  it("counts the subject connected only once the broker's CONNACK has passed", async () => {
    const link = await open();
    const raw = createConnection({ host: "127.0.0.1", port: Number(new URL(link.url).port) });
    raw.on("error", () => undefined);
    cleanup.push(() => raw.destroy());
    await new Promise<void>((r) => raw.once("connect", () => r()));
    await new Promise((r) => setTimeout(r, 200));
    expect(link.connected).toBe(false);
    const client = await through(link);
    expect(client.connected).toBe(true);
    expect(link.connected).toBe(true);
  });
});
