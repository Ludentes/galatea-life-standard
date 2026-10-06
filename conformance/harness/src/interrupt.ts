import { closeOpenHomes } from "./home.js";
import { SubjectProcess } from "./subject.js";

/** The exit codes of a command stopped by a signal: 128 plus the signal's number. */
export const INTERRUPT_EXIT = { SIGINT: 130, SIGTERM: 143 } as const;

/**
 * On SIGINT or SIGTERM: kills every subject (each runs in its own process group, so the terminal's
 * Ctrl-C does not reach it), closes every open home (the broker, the time servers), and exits 130 or
 * 143. A second signal exits at once. On any exit, subjects still running are killed.
 */
export function exitOnInterrupt(): void {
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      SubjectProcess.killAll();
      if (stopping) process.exit(INTERRUPT_EXIT[signal]);
      stopping = true;
      console.error(`${signal}: stopping the subjects and closing the home`);
      void closeOpenHomes().finally(() => process.exit(INTERRUPT_EXIT[signal]));
    });
  }
  process.on("exit", () => SubjectProcess.killAll());
}
