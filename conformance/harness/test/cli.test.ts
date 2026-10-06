import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli.js";
import { closeOpenHomes, startHomes } from "../src/home.js";

const run = (...extra: string[]) => parseArgs(["run", "--subject", "some/dir", ...extra]);

describe("the command line", () => {
  it("takes a whole number of workers of at least 1", () => {
    expect(run("--workers", "2")?.opts.workers).toBe(2);
    expect(run()?.opts.workers).toBeUndefined();
    expect(run()?.mode).toBe("run");
  });

  it("is not a command with a bad --workers, so the CLI prints the usage line and exits 2", () => {
    for (const bad of ["0", "-1", "1.5", "abc", "NaN", ""]) expect(run("--workers", bad)).toBeUndefined();
    expect(run("--workers")).toBeUndefined();
  });

  it("is not a command without a mode or a subject", () => {
    expect(parseArgs(["bogus", "--subject", "x"])).toBeUndefined();
    expect(parseArgs(["negatives"])).toBeUndefined();
  });

  it("refuses --ids naming an id in no manifest, before it starts anything, with exit 2", () => {
    const r = spawnSync(process.execPath, [cli, "run", "--subject", join(fixtures, "echo-subject"), "--ids", "GA-DESC-1,GA-TYPO"],
      { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--ids names GA-TYPO, which is in no manifest/);
    expect(r.stderr).toMatch(/usage:/);
    expect(run("--ids")).toBeUndefined();
  });

  it("starts no home for fewer than one worker", async () => {
    await expect(startHomes(0)).rejects.toThrow(/at least 1/);
    await expect(startHomes(1.5)).rejects.toThrow(/at least 1/);
  });
});

const cli = join(import.meta.dirname, "..", "dist", "cli.js");
const fixtures = join(import.meta.dirname, "fixtures");

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function until(check: () => boolean, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`not within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

const containers = () =>
  spawnSync("docker", ["ps", "-q", "--filter", `label=org.galatea.harness.pid=${process.pid}`], { encoding: "utf8" }).stdout.trim();
const viaDocker = spawnSync("sh", ["-c", "command -v mosquitto"]).status !== 0;

describe("the home, closed", () => {
  it("closes twice without an error", async () => {
    const homes = await startHomes(1);
    await Promise.all([homes.close(), homes.close()]);
    await homes.close();
  }, 30_000);

  it.skipIf(!viaDocker)("closes a home that is still starting, broker included", async () => {
    const starting = startHomes(1);
    starting.catch(() => undefined);
    await until(() => containers() !== "", 20_000);
    await closeOpenHomes();
    const homes = await starting.catch(() => undefined);
    try {
      expect(containers()).toBe("");
    } finally {
      await homes?.close();
    }
  }, 40_000);
});

describe("the command, interrupted", () => {
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
    it(`on ${signal} stops the subject, closes the home and exits ${code}`, async () => {
      const dir = mkdtempSync(join(tmpdir(), "galatea-interrupt-"));
      const pidFile = join(dir, "pid");
      try {
        // The wrapped subject publishes no status, so the guard waits for it while we interrupt.
        const child = spawn(process.execPath, [cli, "run", "--subject", join(fixtures, "wrapped-subject"), "--workers", "1"],
          { env: { ...process.env, FIXTURE_PID_FILE: pidFile }, stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (d) => { stderr += d; });
        const exited = new Promise<number | null>((r) => child.once("exit", (c) => r(c)));
        await until(() => existsSync(pidFile) && readFileSync(pidFile, "utf8").length > 0, 20_000);
        const subjectPid = Number(readFileSync(pidFile, "utf8"));
        child.kill(signal);
        expect(await exited).toBe(code);
        expect(stderr).toMatch(new RegExp(`${signal}: stopping the subjects and closing the home`));
        await until(() => !alive(subjectPid), 2000);
        const left = spawnSync("docker", ["ps", "-q", "--filter", `label=org.galatea.harness.pid=${child.pid}`], { encoding: "utf8" });
        expect(left.stdout.trim()).toBe("");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 40_000);
  }
});
