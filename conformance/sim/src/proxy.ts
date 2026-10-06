import { createConnection, createServer, type Server, type Socket } from "node:net";

/**
 * A TCP proxy in front of the shared broker, one per subject, so a test can take the broker away
 * from that subject alone: `sever` cuts every connection and refuses new ones, as a broker gone
 * would; `stall` keeps the connections open but forwards nothing, as a half-dead link would, so
 * only the subject's keepalive can find it; `restore` ends either. No broker is ever stopped.
 */
export class SeverableProxy {
  private readonly pairs = new Set<[Socket, Socket]>();
  private mode: "open" | "severed" | "stalled" | "holding" = "open";

  private constructor(private readonly server: Server, readonly url: string) {}

  /** Listens on a free loopback port and forwards to the broker at `brokerUrl` (`mqtt://host:port`). */
  static async start(brokerUrl: string): Promise<SeverableProxy> {
    const target = new URL(brokerUrl);
    let proxy: SeverableProxy | undefined;
    const server = createServer((client) => proxy!.accept(client, target.hostname, Number(target.port)));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const { port } = server.address() as { port: number };
    proxy = new SeverableProxy(server, `${target.protocol}//127.0.0.1:${port}`);
    return proxy;
  }

  private accept(client: Socket, host: string, port: number): void {
    if (this.mode === "severed") {
      client.destroy();
      return;
    }
    const upstream = createConnection({ host, port });
    // No Nagle on either leg, as the broker has none: a small packet is never held for an ACK.
    client.setNoDelay(true);
    upstream.setNoDelay(true);
    const pair: [Socket, Socket] = [client, upstream];
    this.pairs.add(pair);
    const end = () => {
      this.pairs.delete(pair);
      client.destroy();
      upstream.destroy();
    };
    for (const s of pair) {
      s.on("error", end);
      s.on("close", end);
    }
    client.pipe(upstream);
    upstream.pipe(client);
    if (this.mode === "stalled") this.pause(pair);
    if (this.mode === "holding") this.hold(pair);
  }

  private hold([client, upstream]: [Socket, Socket]): void {
    client.unpipe(upstream);
    client.pause();
  }

  private pause([a, b]: [Socket, Socket]): void {
    a.pause();
    b.pause();
    a.unpipe(b);
    b.unpipe(a);
  }

  /** Cuts every connection through the proxy, and refuses new ones until `restore`. */
  sever(): void {
    this.mode = "severed";
    for (const [a, b] of [...this.pairs]) {
      a.destroy();
      b.destroy();
    }
    this.pairs.clear();
  }

  /** Forwards nothing, in either direction, on the connections it holds and on new ones. */
  stall(): void {
    this.mode = "stalled";
    for (const pair of this.pairs) this.pause(pair);
  }

  /**
   * Holds what the subject sends, on the connections it holds and on new ones, while what the broker
   * sends still reaches it: a command published now gets no PUBACK until `restore`, and the subject
   * goes on hearing its bridges. Held for a few seconds at most: the subject's keepalive is held too.
   */
  holdOutbound(): void {
    this.mode = "holding";
    for (const pair of this.pairs) this.hold(pair);
  }

  /** Forwards again: a stalled or held connection resumes, and new connections are accepted. */
  restore(): void {
    const was = this.mode;
    this.mode = "open";
    if (was === "holding") {
      for (const [a, b] of this.pairs) {
        a.pipe(b);
        a.resume();
      }
      return;
    }
    if (was !== "stalled") return;
    for (const [a, b] of this.pairs) {
      a.pipe(b);
      b.pipe(a);
      a.resume();
      b.resume();
    }
  }

  async close(): Promise<void> {
    this.sever();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
