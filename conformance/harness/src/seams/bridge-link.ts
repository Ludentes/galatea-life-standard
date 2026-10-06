import { createConnection, createServer, type Server, type Socket } from "node:net";

/**
 * What the bridge subject and the broker said to each other, as the link read it, in the order it
 * passed; `kind` says whose packet it is. `conn` numbers the subject's connections from 1. The
 * broker's PUBLISHes to the subject are not recorded. A `publish` carries its real topic, an MQTT 5
 * Topic Alias resolved; `puback` also records a QoS 2 publish's PUBREC.
 */
export type LinkRecord =
  | { kind: "connect"; conn: number; at: number; level: number; clientId: string; cleanStart: boolean; keepalive: number;
    /** MQTT 5's Session Expiry Interval, 0 when absent (and on 3.1.1). */
    sessionExpiry: number; username?: string; password: boolean;
    /** The text of its MQTT 5 string and binary properties (`Properties`), where it has any. */
    properties?: string[];
    /** `delay` is MQTT 5's Will Delay Interval, 0 when absent. */
    will?: { topic: string; payload: string; qos: number; retain: boolean; delay: number; properties?: string[] } }
  | { kind: "subscribe"; conn: number; at: number; packetId: number;
    filters: { filter: string; qos: number; noLocal: boolean; retainAsPublished: boolean; retainHandling: number }[];
    /** The text of its MQTT 5 string and binary properties (`Properties`), where it has any. */
    properties?: string[] }
  | { kind: "suback"; conn: number; at: number; packetId: number; codes: number[]; refused: boolean }
  | { kind: "unsubscribe"; conn: number; at: number; packetId: number; filters: string[];
    /** The text of its MQTT 5 string and binary properties (`Properties`), where it has any. */
    properties?: string[] }
  | { kind: "unsuback"; conn: number; at: number; packetId: number }
  | { kind: "publish"; conn: number; at: number; topic: string; qos: number; retain: boolean; packetId?: number; payload: string;
    /** The text of its MQTT 5 string and binary properties (`Properties`), where it has any. */
    properties?: string[] }
  | { kind: "puback"; conn: number; at: number; packetId: number; code: number; refused: boolean }
  | { kind: "disconnect"; conn: number; at: number; reason: number };

/** Which of the subject's subscriptions and publishes the link answers with a refusal (GA-BRIDGE-20). */
export interface Refusals {
  subscribe?: (filter: string) => boolean;
  publish?: (topic: string) => boolean;
}

/**
 * The text of the string and binary MQTT 5 properties a packet carried, as UTF-8: a content type, a
 * response topic, correlation data, each user property's name and value, and the rest. Integer
 * properties are not text, and are left out.
 */
export type Properties = string[];

/** MQTT 5's Topic Alias property. */
const TOPIC_ALIAS = 0x23;
/** MQTT 5 properties by the size of their value: four-byte, two-byte and one-byte integers. */
const FOUR_BYTES = new Set([0x02, 0x11, 0x18, 0x27]);
const TWO_BYTES = new Set([0x13, 0x21, 0x22, 0x23]);
const ONE_BYTE = new Set([0x01, 0x17, 0x19, 0x24, 0x25, 0x28, 0x29, 0x2a]);
/** The Session Expiry Interval and the Will Delay Interval. */
const SESSION_EXPIRY = 0x11;
const WILL_DELAY = 0x18;

/** MQTT 5's refusal on a SUBACK or a PUBACK, Not authorized; 3.1.1's SUBACK failure. */
const REFUSED_V5 = 0x87;
const REFUSED_V3 = 0x80;

/** A cursor over one packet's bytes. */
class Reader {
  i = 0;
  constructor(readonly b: Buffer) {}
  byte(): number {
    return this.b[this.i++]!;
  }
  u16(): number {
    const v = this.b.readUInt16BE(this.i);
    this.i += 2;
    return v;
  }
  varint(): number {
    let v = 0;
    for (let shift = 0; shift < 28; shift += 7) {
      const byte = this.byte();
      v += (byte & 0x7f) << shift;
      if (!(byte & 0x80)) break;
    }
    return v;
  }
  bytes(): Buffer {
    const n = this.u16();
    const v = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return v;
  }
  str(): string {
    return this.bytes().toString("utf8");
  }
  /**
   * An MQTT 5 property list: its integer properties by id. Its strings, binaries and user properties
   * go to `texts`, as UTF-8, where it is given.
   */
  props(texts?: Properties): Map<number, number> {
    const n = this.varint();
    const end = this.i + n;
    const out = new Map<number, number>();
    while (this.i < end) {
      const id = this.varint();
      if (FOUR_BYTES.has(id)) {
        out.set(id, this.b.readUInt32BE(this.i));
        this.i += 4;
      } else if (TWO_BYTES.has(id)) out.set(id, this.u16());
      else if (ONE_BYTE.has(id)) out.set(id, this.byte());
      else if (id === 0x0b) out.set(id, this.varint());
      else if (id === 0x26) {
        const name = this.bytes();
        const value = this.bytes();
        texts?.push(name.toString("utf8"), value.toString("utf8"));
      } else {
        const v = this.bytes();
        texts?.push(v.toString("utf8"));
      }
    }
    this.i = end;
    return out;
  }
  get left(): number {
    return this.b.length - this.i;
  }
}

/** The length of the whole packet at the start of `buf` (header included), or undefined while it is incomplete. */
function packetLength(buf: Buffer): number | undefined {
  let len = 0;
  for (let k = 1; k <= 4; k++) {
    if (buf.length <= k) return undefined;
    const byte = buf[k]!;
    len += (byte & 0x7f) << (7 * (k - 1));
    if (!(byte & 0x80)) return buf.length >= 1 + k + len ? 1 + k + len : undefined;
  }
  throw new Error("an MQTT packet length longer than four bytes");
}

/** The remaining-length bytes of `n`. */
function varintBytes(n: number): Buffer {
  const out: number[] = [];
  do {
    let byte = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) byte |= 0x80;
    out.push(byte);
  } while (n > 0);
  return Buffer.from(out);
}

/** One of the subject's connections through the link, with what it asked for that a refusal answers. */
interface Conn {
  n: number;
  level: number;
  client: Socket;
  upstream: Socket;
  /** SUBSCRIBE packet ids, with the indices of the filters to refuse. */
  subscribes: Map<number, number[]>;
  /** PUBLISH packet ids to refuse, on their PUBACK (QoS 1) or PUBREC (QoS 2). */
  publishes: Set<number>;
  /** PUBREL packet ids the link sent for a refused QoS 2 publish, whose PUBCOMP the subject never asked for. */
  released: Set<number>;
  /** MQTT 5 Topic Aliases, subject to broker, on this connection. */
  aliases: Map<number, string>;
  /** Whether the broker's CONNACK accepted this connection. */
  accepted: boolean;
}

/**
 * The bridge subject's own way to the broker: a TCP proxy that reads the MQTT packets it carries,
 * which a test may cut (GA-BRIDGE-9), read (GA-BRIDGE-18, 19, 22) and have answer a subscription or
 * a publish with a refusal (GA-BRIDGE-20). A refusal is the link's: it rewrites the broker's SUBACK
 * or PUBACK, so the broker itself accepted what the subject is told it refused.
 */
export class BridgeLink {
  readonly records: LinkRecord[] = [];
  private readonly conns = new Set<Conn>();
  private next = 1;
  private severed = false;
  private refusals: Refusals = {};

  private constructor(private readonly server: Server, readonly url: string) {}

  /** Listens on a free loopback port and forwards to the broker at `brokerUrl` (`mqtt://host:port`). */
  static async start(brokerUrl: string): Promise<BridgeLink> {
    const target = new URL(brokerUrl);
    let link: BridgeLink | undefined;
    const server = createServer((client) => link!.accept(client, target.hostname, Number(target.port)));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const { port } = server.address() as { port: number };
    link = new BridgeLink(server, `${target.protocol}//127.0.0.1:${port}`);
    return link;
  }

  /** From now on, the subscriptions and publishes `r` names are answered with a refusal. */
  refuse(r: Refusals): void {
    this.refusals = r;
  }

  /** Cuts every connection through the link, and refuses new ones until `restore`. */
  sever(): void {
    this.severed = true;
    for (const c of [...this.conns]) {
      c.client.destroy();
      c.upstream.destroy();
    }
    this.conns.clear();
  }

  /** Accepts connections again. */
  restore(): void {
    this.severed = false;
  }

  /** Whether the subject holds a connection through the link now that the broker's CONNACK accepted. */
  get connected(): boolean {
    return [...this.conns].some((c) => c.accepted);
  }

  async close(): Promise<void> {
    this.sever();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private accept(client: Socket, host: string, port: number): void {
    if (this.severed) {
      client.destroy();
      return;
    }
    const upstream = createConnection({ host, port });
    const c: Conn = { n: this.next++, level: 5, client, upstream, subscribes: new Map(), publishes: new Set(),
      released: new Set(), aliases: new Map(), accepted: false };
    this.conns.add(c);
    // A fault cuts both sides; a side that closes has the other ended once what it was given is
    // written, so that a DISCONNECT the subject sent last reaches the broker, and no will fires.
    const cut = () => {
      this.conns.delete(c);
      client.destroy();
      upstream.destroy();
    };
    for (const s of [client, upstream]) s.on("error", cut);
    client.on("close", () => {
      this.conns.delete(c);
      upstream.end();
    });
    upstream.on("close", () => {
      this.conns.delete(c);
      client.end();
    });
    this.pump(client, upstream, (p) => this.fromSubject(c, p));
    this.pump(upstream, client, (p) => this.fromBroker(c, p));
  }

  /** Forwards whole packets from `from` to `to`, each through `each`, which may replace it. */
  private pump(from: Socket, to: Socket, each: (p: Buffer) => Buffer): void {
    let buf = Buffer.alloc(0);
    from.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        let len: number | undefined;
        try {
          len = packetLength(buf);
        } catch {
          from.destroy();
          return;
        }
        if (len === undefined) return;
        const packet = buf.subarray(0, len);
        buf = buf.subarray(len);
        let out: Buffer = packet;
        try {
          out = each(packet);
        } catch {
          // A packet the link cannot read is forwarded as it came, unrecorded.
        }
        if (out.length) to.write(out);
      }
    });
  }

  private body(p: Buffer): Reader {
    const r = new Reader(p);
    r.byte();
    r.varint();
    return r;
  }

  private fromSubject(c: Conn, p: Buffer): Buffer {
    const type = p[0]! >> 4;
    const at = Date.now();
    const r = this.body(p);
    if (type === 1) {
      r.str();
      c.level = r.byte();
      const flags = r.byte();
      const keepalive = r.u16();
      const texts: Properties = [];
      const props = c.level === 5 ? r.props(texts) : new Map<number, number>();
      const clientId = r.str();
      let will: Extract<LinkRecord, { kind: "connect" }>["will"];
      if (flags & 0x04) {
        const willTexts: Properties = [];
        const willProps = c.level === 5 ? r.props(willTexts) : new Map<number, number>();
        const topic = r.str();
        will = { topic, payload: r.bytes().toString("utf8"), qos: (flags >> 3) & 3, retain: Boolean(flags & 0x20),
          delay: willProps.get(WILL_DELAY) ?? 0, ...(willTexts.length ? { properties: willTexts } : {}) };
      }
      const username = flags & 0x80 ? r.str() : undefined;
      this.records.push({ kind: "connect", conn: c.n, at, level: c.level, clientId, cleanStart: Boolean(flags & 0x02), keepalive,
        sessionExpiry: props.get(SESSION_EXPIRY) ?? 0, ...(username !== undefined ? { username } : {}), password: Boolean(flags & 0x40),
        ...(texts.length ? { properties: texts } : {}), ...(will ? { will } : {}) });
    } else if (type === 8) {
      const packetId = r.u16();
      const texts: Properties = [];
      if (c.level === 5) r.props(texts);
      const filters: Extract<LinkRecord, { kind: "subscribe" }>["filters"] = [];
      while (r.left > 0) {
        const filter = r.str();
        const o = r.byte();
        filters.push({ filter, qos: o & 3, noLocal: Boolean(o & 4), retainAsPublished: Boolean(o & 8), retainHandling: (o >> 4) & 3 });
      }
      const refuse = filters.flatMap((f, i) => (this.refusals.subscribe?.(f.filter) ? [i] : []));
      if (refuse.length) c.subscribes.set(packetId, refuse);
      this.records.push({ kind: "subscribe", conn: c.n, at, packetId, filters, ...(texts.length ? { properties: texts } : {}) });
    } else if (type === 10) {
      const packetId = r.u16();
      const texts: Properties = [];
      if (c.level === 5) r.props(texts);
      const filters: string[] = [];
      while (r.left > 0) filters.push(r.str());
      this.records.push({ kind: "unsubscribe", conn: c.n, at, packetId, filters, ...(texts.length ? { properties: texts } : {}) });
    } else if (type === 3) {
      const qos = (p[0]! >> 1) & 3;
      let topic = r.str();
      const packetId = qos > 0 ? r.u16() : undefined;
      const texts: Properties = [];
      const alias = c.level === 5 ? r.props(texts).get(TOPIC_ALIAS) : undefined;
      if (alias !== undefined) {
        if (topic) c.aliases.set(alias, topic);
        else topic = c.aliases.get(alias) ?? "";
      }
      const payload = r.b.subarray(r.i).toString("utf8");
      if (packetId !== undefined && c.level === 5 && this.refusals.publish?.(topic)) c.publishes.add(packetId);
      this.records.push({ kind: "publish", conn: c.n, at, topic, qos, retain: Boolean(p[0]! & 1),
        ...(packetId !== undefined ? { packetId } : {}), payload, ...(texts.length ? { properties: texts } : {}) });
    } else if (type === 14) {
      this.records.push({ kind: "disconnect", conn: c.n, at, reason: r.left > 0 ? r.byte() : 0 });
    }
    return p;
  }

  private fromBroker(c: Conn, p: Buffer): Buffer {
    const type = p[0]! >> 4;
    const at = Date.now();
    const r = this.body(p);
    if (type === 9) {
      const packetId = r.u16();
      if (c.level === 5) r.props();
      const codesAt = r.i;
      const refuse = c.subscribes.get(packetId) ?? [];
      c.subscribes.delete(packetId);
      let out = p;
      if (refuse.length) {
        out = Buffer.from(p);
        for (const i of refuse) if (codesAt + i < out.length) out[codesAt + i] = c.level === 5 ? REFUSED_V5 : REFUSED_V3;
      }
      const codes = [...out.subarray(codesAt)];
      this.records.push({ kind: "suback", conn: c.n, at, packetId, codes, refused: refuse.length > 0 });
      return out;
    }
    if (type === 11) {
      this.records.push({ kind: "unsuback", conn: c.n, at, packetId: r.u16() });
      return p;
    }
    if (type === 2) {
      r.byte();
      c.accepted = c.level === 5 ? r.byte() < 0x80 : r.byte() === 0;
      return p;
    }
    if (type === 4 || type === 5) {
      // PUBACK (QoS 1) or PUBREC (QoS 2): either frees the packet id, refused or not.
      const packetId = r.u16();
      const code = r.left > 0 ? r.byte() : 0;
      if (c.publishes.delete(packetId)) {
        this.records.push({ kind: "puback", conn: c.n, at, packetId, code: REFUSED_V5, refused: true });
        if (type === 5) {
          // A PUBREC of 0x80 or above ends the QoS 2 exchange for the subject; the broker, which accepted
          // the publish, still waits for its PUBREL, so the link sends it and keeps the PUBCOMP to itself.
          c.released.add(packetId);
          c.upstream.write(Buffer.from([0x62, 2, packetId >> 8, packetId & 0xff]));
        }
        // An MQTT 5 PUBACK or PUBREC with its reason code and no properties.
        const body = Buffer.from([packetId >> 8, packetId & 0xff, REFUSED_V5, 0]);
        return Buffer.concat([Buffer.from([type << 4]), varintBytes(body.length), body]);
      }
      this.records.push({ kind: "puback", conn: c.n, at, packetId, code, refused: false });
      return p;
    }
    if (type === 7) {
      const packetId = r.u16();
      if (c.released.delete(packetId)) return Buffer.alloc(0);
    }
    return p;
  }
}
