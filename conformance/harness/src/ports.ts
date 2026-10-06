import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

/** Where listening ports are drawn from when the kernel's ephemeral range cannot be read. */
const FALLBACK_EPHEMERAL_LOW = 32768;
/** The lowest port drawn: above the registered services a developer machine commonly runs. */
const LOWEST = 20000;

/** The first port of the kernel's ephemeral range, where outgoing connections take their local ports. */
export function ephemeralLow(read: () => string = () => readFileSync("/proc/sys/net/ipv4/ip_local_port_range", "utf8")): number {
  try {
    const low = Number(read().trim().split(/\s+/)[0]);
    return Number.isInteger(low) && low > LOWEST + 1000 ? low : FALLBACK_EPHEMERAL_LOW;
  } catch {
    return FALLBACK_EPHEMERAL_LOW;
  }
}

const bindable = (port: number): Promise<boolean> => new Promise((resolve) => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
});

/**
 * A port for a subject to listen on (GALATEA_MCP_PORT): drawn at random below the ephemeral range and
 * checked free. A port the kernel hands out for `listen(0)` (the sim's `freePort`) lies in the range
 * every outgoing connection takes its local port from, so between its close and the subject's bind
 * any connection on the machine (a subject's to Postgres or the broker, the harness's MCP clients)
 * could take it: the EADDRINUSE seen with many lanes at once. Below the range, only another listener
 * that chose the same port can, which a random draw over thousands of ports makes rare and
 * `onFreshPort`'s retry covers.
 */
export async function listenPort(random: () => number = Math.random): Promise<number> {
  const high = ephemeralLow();
  for (;;) {
    const port = LOWEST + Math.floor(random() * (high - LOWEST));
    if (await bindable(port)) return port;
  }
}

/** The kernel's own pick for `listen(0)`: what the harness used before `listenPort`. */
export function kernelPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}
