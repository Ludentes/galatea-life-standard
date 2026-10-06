import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { validate, type HarnessSubject } from "@ludentes/galatea-life-schemas";

/** How the harness starts a subject (`harness/subject.json`). */
export type SubjectSpec = HarnessSubject;

export class SubjectSpecError extends Error {}

export class SubjectNotReady extends Error {
  constructor(message: string, readonly output: string[]) {
    super(message);
  }
}

/**
 * A line that starts with the subject's ready text. A line that only holds it is not one: Node's
 * bind error ("address already in use") holds "ready", and a subject that could not bind is not ready.
 */
export function isReadyLine(line: string, log: string): boolean {
  return line.startsWith(log);
}

export function loadSubject(dir: string): SubjectSpec {
  let spec: unknown;
  try {
    spec = JSON.parse(readFileSync(join(dir, "subject.json"), "utf8"));
  } catch (err) {
    throw new SubjectSpecError(`${dir}/subject.json cannot be read: ${err}`);
  }
  const errors = validate("harness/subject.json", spec);
  if (errors.length) throw new SubjectSpecError(`${dir}/subject.json: ${errors.join("; ")}`);
  return spec as SubjectSpec;
}

const KEEP_LINES = 50;
const STOP_WAIT_MS = 5000;
const CLOSE_WAIT_MS = 500;
/** A restart's starts while its port is taken (`EADDRINUSE`), and the pause between them. */
const RESTART_ATTEMPTS = 5;
const RESTART_PAUSE_MS = 500;

/**
 * The instances a check's subjects launched, and how many of them ended on a signal: such an instance
 * wrote no V8 coverage (`NODE_V8_COVERAGE` is written only by a process that exits itself).
 */
export interface CoverageLife { launches: number; signalled: number }

/** The subject's process, which the harness owns: start, restart, crash, stop. */
export class SubjectProcess {
  private static readonly running = new Set<SubjectProcess>();
  private static readonly lives = new Map<string, CoverageLife>();
  private child?: ChildProcess;
  private closed = false;
  /** True while `end` (a stop, a crash, a restart's stop) or a failed start is ending the process. */
  private ending = false;
  private unasked = false;
  private whenClosed?: Promise<void>;
  private readonly lines: string[] = [];
  /** When the latest instance was launched, in real time: a status seen before it is an earlier instance's. */
  private launchedAt = 0;

  private constructor(
    private readonly dir: string,
    private readonly spec: SubjectSpec,
    private readonly env: Record<string, string>,
    private readonly readyMs: number,
  ) {}

  static async start(
    dir: string,
    spec: SubjectSpec,
    env: Record<string, string>,
    opts: { readyMs?: number } = {},
  ): Promise<SubjectProcess> {
    const p = new SubjectProcess(dir, spec, env, opts.readyMs ?? 30_000);
    await p.launch();
    return p;
  }

  /** When the subject's latest instance was started (a start or a restart), in real time. */
  get startedAt(): number {
    return this.launchedAt;
  }

  get exited(): boolean {
    return !this.child || this.child.exitCode !== null || this.child.signalCode !== null;
  }

  /**
   * The subject exited when nothing the harness did asked it to: not a stop, a crash or a restart.
   * It stays true for the rest of the subject's life, across a later restart.
   */
  get exitedUnasked(): boolean {
    return this.unasked;
  }

  /** Waits at most `ms` for the process's pipes to close, so a pending exit event has landed. */
  async settle(ms: number): Promise<void> {
    if (this.closed || !this.whenClosed) return;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([this.whenClosed, new Promise<void>((r) => { timer = setTimeout(r, ms); })]);
    clearTimeout(timer);
  }

  /**
   * The subject's last lines, with any database URL masked: the URL carries a password, and these
   * lines go into evidence, reports and a failed start's message.
   */
  output(): string[] {
    return this.lines.map((l) => l.replace(/postgres(?:ql)?:\/\/\S+/g, "<url>"));
  }

  /**
   * Stops the subject, SIGTERM or with `crash` SIGKILL, and starts it again with the same environment;
   * `between` runs while it is down, as a change the subject does not see happen. `crash()` alone
   * kills it and starts nothing. A restarted subject comes back on its port, which another process
   * may have taken meanwhile: a start that fails saying `EADDRINUSE` is tried again after `pauseMs`,
   * up to `attempts` starts in all, and such a failure is no exit of the subject's own.
   */
  async restart(between?: () => unknown, o: { crash?: boolean; attempts?: number; pauseMs?: number } = {}): Promise<void> {
    await (o.crash ? this.crash() : this.stop());
    await between?.();
    const attempts = o.attempts ?? RESTART_ATTEMPTS;
    for (let attempt = 1; ; attempt++) {
      const unasked = this.unasked;
      try {
        await this.launch();
        return;
      } catch (err) {
        const taken = err instanceof SubjectNotReady && err.output.some((l) => l.includes("EADDRINUSE"));
        if (!taken || attempt >= attempts) throw err;
        // Its own bind failing is the port's fault, not the subject's.
        this.unasked = unasked;
        await this.settle(CLOSE_WAIT_MS);
        await new Promise((r) => setTimeout(r, o.pauseMs ?? RESTART_PAUSE_MS));
      }
    }
  }

  async crash(): Promise<void> {
    await this.end("SIGKILL");
  }

  async stop(): Promise<void> {
    await this.end("SIGTERM");
  }

  /**
   * Signals the subject's whole process group, so a subject started through a wrapper (`sh -c`,
   * `pnpm start`) is stopped with its real process. Resolves once the group has closed our pipes,
   * so the last lines ("bye" from a SIGTERM handler) are in `output()`; SIGKILL after 5 s, and
   * after that at most 500 ms more for the pipes, so a process that escaped the group cannot hang it.
   */
  private async end(signal: NodeJS.Signals): Promise<void> {
    const child = this.child;
    if (!child || this.closed) return;
    this.ending = true;
    const closed = this.whenClosed!;
    const within = async (ms: number) => {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([closed, new Promise<void>((r) => { timer = setTimeout(r, ms); })]);
      clearTimeout(timer);
    };
    this.signal(signal);
    if (signal !== "SIGKILL") await within(STOP_WAIT_MS);
    if (this.closed) return;
    this.signal("SIGKILL");
    await within(CLOSE_WAIT_MS);
  }

  private signal(sig: NodeJS.Signals): void {
    const pid = this.child?.pid;
    if (pid === undefined) return;
    try {
      process.kill(-pid, sig);
    } catch {
      // The group is gone already.
    }
  }

  /**
   * The launches and signalled ends of every subject started with `NODE_V8_COVERAGE` set to `dir`, which
   * the call forgets; a launch of none is `{ launches: 0, signalled: 0 }`.
   */
  static coverageLife(dir: string): CoverageLife {
    const life = SubjectProcess.lives.get(dir) ?? { launches: 0, signalled: 0 };
    SubjectProcess.lives.delete(dir);
    return life;
  }

  /** SIGKILLs the group of every subject still running; for a harness that is being interrupted. */
  static killAll(): void {
    for (const p of SubjectProcess.running) p.signal("SIGKILL");
  }

  private launch(): Promise<void> {
    this.launchedAt = Date.now();
    const inherited = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GALATEA_")));
    const child = spawn(this.spec.start.command, this.spec.start.args ?? [], {
      cwd: this.dir,
      env: { ...inherited, ...this.env },
      stdio: ["ignore", "pipe", "pipe"],
      // Its own process group, which `end` signals whole.
      detached: true,
    });
    this.child = child;
    this.closed = false;
    this.ending = false;
    child.once("exit", () => { if (!this.ending) this.unasked = true; });
    const coverage = this.env.NODE_V8_COVERAGE;
    if (coverage) {
      const life = SubjectProcess.lives.get(coverage) ?? { launches: 0, signalled: 0 };
      SubjectProcess.lives.set(coverage, life);
      life.launches++;
      child.once("exit", (_code, signal) => { if (signal) life.signalled++; });
    }
    SubjectProcess.running.add(this);
    this.whenClosed = new Promise<void>((r) => child.once("close", () => {
      this.closed = true;
      SubjectProcess.running.delete(this);
      r();
    }));
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (why: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.ending = true;
        this.signal("SIGKILL");
        reject(new SubjectNotReady(`the subject ${why}`, this.output()));
      };
      const timer = setTimeout(() => fail(`was not ready in ${this.readyMs} ms`), this.readyMs);
      const onLine = (line: string) => {
        this.lines.push(line);
        if (this.lines.length > KEEP_LINES) this.lines.shift();
        if (!settled && isReadyLine(line, this.spec.start.ready.log)) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };
      createInterface({ input: child.stdout! }).on("line", onLine);
      createInterface({ input: child.stderr! }).on("line", onLine);
      child.once("error", (err) => fail(`could not start: ${err.message}`));
      child.once("exit", (code, signal) => fail(`exited (${code ?? signal}) before it was ready`));
    });
  }
}
