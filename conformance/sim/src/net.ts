import { createServer, type AddressInfo } from "node:net";

/** Where the last port handed out from `GALATEA_PORT_RANGE` was, so the next is past it. */
let rangeCursor: number | undefined;

/**
 * A TCP port free on loopback now. With `GALATEA_PORT_RANGE=<low>-<high>` set (the full matrix gives
 * each parallel job its own), a port of that range, each call past the last one handed out, so no other
 * job can take a port a subject let go of while it restarts (the milestone 5+6 review, I6); else one
 * the system picks.
 */
export async function freePort(): Promise<number> {
  const range = /^(\d+)-(\d+)$/.exec(process.env.GALATEA_PORT_RANGE ?? "");
  if (!range) return bindFree(0);
  const low = Number(range[1]);
  const high = Number(range[2]);
  for (let tries = 0; tries <= high - low; tries++) {
    rangeCursor = rangeCursor === undefined || rangeCursor >= high || rangeCursor < low ? low : rangeCursor + 1;
    try {
      return await bindFree(rangeCursor);
    } catch {
      // Taken: the next.
    }
  }
  throw new Error(`no port free in GALATEA_PORT_RANGE ${low}-${high}`);
}

function bindFree(at: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(at, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** The subject contract's GALATEA_BROKER: the MQTT user name is the subject's identity. */
export function brokerUrl(url: string, identity: string): string {
  const u = new URL(url);
  u.username = encodeURIComponent(identity);
  return u.toString().replace(/\/$/, "");
}

export function parseBrokerUrl(url: string): { url: string; identity: string } {
  const u = new URL(url);
  const identity = decodeURIComponent(u.username);
  if (!identity) throw new Error(`the broker URL names no identity: ${url}`);
  return { url: `${u.protocol}//${u.host}`, identity };
}
