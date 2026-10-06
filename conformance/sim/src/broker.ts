import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, connectAsync } from "mqtt";
import { freePort } from "./net.js";

export interface Broker {
  url: string;
  port: number;
  stop(): Promise<void>;
}

const IMAGE = "eclipse-mosquitto:2";

function hasBinary(): boolean {
  return spawnSync("sh", ["-c", "command -v mosquitto"]).status === 0;
}

/**
 * One MQTT connect that always settles: `connectAsync` never does when the listener drops the
 * connection before CONNACK (Docker's port proxy, while the broker inside is still starting).
 */
function probe(url: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = connect(url, { protocolVersion: 5, reconnectPeriod: 0, connectTimeout: ms });
    const done = (err?: Error) => {
      clearTimeout(timer);
      client.removeAllListeners();
      client.on("error", () => undefined);
      client.end(true);
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => done(new Error(`no CONNACK in ${ms} ms`)), ms);
    client.once("connect", () => done());
    client.once("error", (err) => done(err));
    client.once("close", () => done(new Error("the connection closed before CONNACK")));
  });
}

export async function waitForConnect(url: string, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  for (;;) {
    try {
      await probe(url, 1000);
      return;
    } catch (err) {
      if (Date.now() > deadline) throw new Error(`the broker at ${url} did not accept a connection: ${err}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/** The stop of every broker started and not yet stopped, registered before it accepts a connection. */
const running = new Set<() => Promise<void>>();

/** Stops every broker still running, one still starting included; for a harness being interrupted. */
export async function stopBrokers(): Promise<void> {
  for (const stop of [...running]) await stop().catch(() => undefined);
}

/**
 * Each packet sent at once: with Nagle's algorithm, a small packet waits for the ACK of the last, and a
 * delayed ACK holds it ~40 ms, so a SUBACK and the retained message after it reached a subscriber 41 ms
 * apart, and the fixture bridge's transport joined the model after a test's setup (the 5b preflight's M1).
 */
const NODELAY = "set_tcp_nodelay true\n";

/** Mosquitto 2 for one run, on a free loopback port: the binary on PATH, or else Docker. */
export async function startBroker(): Promise<Broker> {
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), "galatea-mqtt-"));
  const conf = join(dir, "mosquitto.conf");
  const url = `mqtt://127.0.0.1:${port}`;
  let kill: () => Promise<void>;
  if (hasBinary()) {
    writeFileSync(conf, `listener ${port} 127.0.0.1\nallow_anonymous true\npersistence false\n${NODELAY}`);
    const child: ChildProcess = spawn("mosquitto", ["-c", conf], { stdio: "ignore" });
    kill = async () => {
      if (child.exitCode === null) {
        const exited = new Promise((r) => child.once("exit", r));
        child.kill("SIGTERM");
        await exited;
      }
    };
  } else {
    writeFileSync(conf, `listener 1883\nallow_anonymous true\npersistence false\n${NODELAY}`);
    const name = `galatea-mqtt-${randomUUID().slice(0, 8)}`;
    // Labelled, so a container a killed harness left can be found: docker ps --filter label=org.galatea.harness
    const run = spawnSync("docker", ["run", "--rm", "-d", "--name", name, "-p", `127.0.0.1:${port}:1883`,
      "--label", "org.galatea.harness=broker", "--label", `org.galatea.harness.pid=${process.pid}`,
      "-v", `${conf}:/mosquitto/config/mosquitto.conf:ro`, IMAGE], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`docker could not start ${IMAGE}: ${run.stderr}`);
    kill = async () => { spawnSync("docker", ["rm", "-f", name]); };
  }
  let stopping: Promise<void> | undefined;
  const stop = () => {
    stopping ??= (async () => {
      running.delete(stop);
      await kill();
      rmSync(dir, { recursive: true, force: true });
    })();
    return stopping;
  };
  running.add(stop);
  try {
    await waitForConnect(url, 10_000);
  } catch (err) {
    await stop();
    throw err;
  }
  return {
    url,
    port,
    stop,
  };
}

/** The broker's delivery allowance: the slowest of `probes` QoS 1 round trips, in ms. */
export async function measureAllowance(url: string, probes = 20): Promise<number> {
  const client = await connectAsync(url, { protocolVersion: 5, reconnectPeriod: 0 });
  const topic = `galatea/probe/${randomUUID()}`;
  const arrivals = new Map<string, () => void>();
  client.on("message", (_t, payload) => arrivals.get(payload.toString())?.());
  await client.subscribeAsync(topic, { qos: 1 });
  let slowest = 0;
  for (let i = 0; i < probes; i++) {
    const id = String(i);
    const arrived = new Promise<void>((r) => arrivals.set(id, r));
    const sent = performance.now();
    await client.publishAsync(topic, id, { qos: 1 });
    await arrived;
    slowest = Math.max(slowest, performance.now() - sent);
  }
  await client.endAsync();
  return Math.ceil(slowest);
}
