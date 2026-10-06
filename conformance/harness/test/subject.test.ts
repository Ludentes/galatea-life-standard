import { createServer } from "node:net";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listenPort } from "../src/ports.js";
import { pollUntil } from "../src/util.js";
import { isReadyLine, loadSubject, SubjectNotReady, SubjectProcess } from "../src/subject.js";

const dir = join(import.meta.dirname, "fixtures", "echo-subject");
const wrapped = join(import.meta.dirname, "fixtures", "wrapped-subject");

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
// A killed process may linger a moment as a zombie until its new parent reaps it.
const gone = (pid: number) => pollUntil(async () => !alive(pid), 1000, `process ${pid} still running`, 20);
const childPid = (p: SubjectProcess) => Number(p.output().find((l) => l.startsWith("pid "))!.slice(4));

describe("the ready line", () => {
  it("starts with the subject's ready text: a line that only holds it, as a bind error's does, is not ready", () => {
    expect(isReadyLine("ready on http://127.0.0.1:4000/mcp", "ready on ")).toBe(true);
    expect(isReadyLine("ready", "ready")).toBe(true);
    expect(isReadyLine("Error: listen EADDRINUSE: address already in use 127.0.0.1:4000", "ready")).toBe(false);
    expect(isReadyLine("not ready yet", "ready")).toBe(false);
  });
});

describe("the subject contract", () => {
  it("starts with the contract's environment, not the harness's GALATEA_ variables", async () => {
    process.env.GALATEA_MUTATION = "leaked";
    const p = await SubjectProcess.start(dir, loadSubject(dir), { GALATEA_TEST_RUN_ID: "run-7" });
    delete process.env.GALATEA_MUTATION;
    await pollUntil(async () => p.output().includes("run run-7 mutation none"), 3000, "the subject's first line");
    await p.stop();
    expect(p.exited).toBe(true);
    await pollUntil(async () => p.output().includes("bye"), 3000, "the subject's bye line");
  });

  it("restarts with the same environment", async () => {
    const p = await SubjectProcess.start(dir, loadSubject(dir), { GALATEA_TEST_RUN_ID: "run-8" });
    await p.restart();
    expect(p.output().filter((l) => l === "run run-8 mutation none").length).toBe(2);
    await p.crash();
    expect(p.exited).toBe(true);
  });

  it("restarts after a crash with the same environment, running `between` while it is down", async () => {
    const p = await SubjectProcess.start(dir, loadSubject(dir), { GALATEA_TEST_RUN_ID: "run-9" });
    let downWhileBetween = false;
    await p.restart(() => { downWhileBetween = p.exited; }, { crash: true });
    expect(downWhileBetween).toBe(true);
    expect(p.output().filter((l) => l === "run run-9 mutation none").length).toBe(2);
    // SIGKILL: the first instance never said its SIGTERM goodbye.
    expect(p.output()).not.toContain("bye");
    await p.stop();
  });

  it("restarts on its own port once another process lets it go, trying again while it says EADDRINUSE; a port never freed fails", async () => {
    const port = await listenPort();
    const p = await SubjectProcess.start(dir, loadSubject(dir), { GALATEA_TEST_RUN_ID: "run-10", ECHO_PORT: String(port) });
    const blocker = createServer();
    await p.restart(async () => {
      await new Promise<void>((r) => blocker.listen(port, "127.0.0.1", () => r()));
      setTimeout(() => blocker.close(), 700);
    }, { crash: true, pauseMs: 300 });
    expect(p.output().filter((l) => l === "run run-10 mutation none").length).toBeGreaterThanOrEqual(3);
    expect(p.output().some((l) => l.includes("EADDRINUSE"))).toBe(true);
    // Its failed binds were no exit of its own.
    expect(p.exitedUnasked).toBe(false);
    const held = createServer();
    await p.restart(async () => { await new Promise<void>((r) => held.listen(port, "127.0.0.1", () => r())); },
      { crash: true, attempts: 2, pauseMs: 100 }).then(() => { throw new Error("restarted on a taken port"); },
      (err: unknown) => expect(err).toBeInstanceOf(SubjectNotReady));
    held.close();
  }, 15_000);

  it("is not ready when it exits first, or says nothing in time", async () => {
    await expect(SubjectProcess.start(dir, loadSubject(dir), { ECHO_FAIL: "1" })).rejects.toBeInstanceOf(SubjectNotReady);
    await expect(SubjectProcess.start(dir, loadSubject(dir), { ECHO_SLOW: "1" }, { readyMs: 500 })).rejects.toThrow(/not ready/);
  });

  it("masks a database URL in what it gives back, a failed start's output included", async () => {
    const say = "store at postgresql://applier:secret@db.local:5432/home is down; postgres://u:p@h/x too";
    const p = await SubjectProcess.start(dir, loadSubject(dir), { ECHO_SAY: say });
    expect(p.output()).toContain("store at <url> is down; <url> too");
    expect(p.output().join("\n")).not.toContain("secret");
    await p.crash();
    const failed = await SubjectProcess.start(dir, loadSubject(dir), { ECHO_SAY: say, ECHO_FAIL: "1" }).catch((err: unknown) => err);
    expect(failed).toBeInstanceOf(SubjectNotReady);
    expect((failed as SubjectNotReady).output.join("\n")).not.toContain("secret");
  });

  it("stops a subject started through a wrapper, and the real process with it", async () => {
    const p = await SubjectProcess.start(wrapped, loadSubject(wrapped), {});
    const pid = childPid(p);
    await p.stop();
    expect(p.output()).toContain("bye");
    await gone(pid);
  }, 10_000);

  it("crashes a subject started through a wrapper, and the real process with it", async () => {
    const p = await SubjectProcess.start(wrapped, loadSubject(wrapped), {});
    const pid = childPid(p);
    await p.crash();
    await gone(pid);
  }, 10_000);

  it("kills a wrapped subject that ignores SIGTERM after 5 s", async () => {
    const p = await SubjectProcess.start(wrapped, loadSubject(wrapped), { FIXTURE_IGNORE_TERM: "1" });
    const pid = childPid(p);
    const t0 = Date.now();
    await p.stop();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(4900);
    await gone(pid);
  }, 15_000);

  it("refuses an invalid subject.json", () => {
    expect(() => loadSubject(join(import.meta.dirname, "fixtures"))).toThrow(/subject.json/);
  });
});
