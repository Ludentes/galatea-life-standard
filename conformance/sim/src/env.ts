/** A required environment variable of the subject contract, or exit 2 (a harness fault). */
export function need(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) {
    console.error(`${name} is not set`);
    process.exit(2);
  }
  return v;
}

/** Runs `handler` once on SIGTERM or SIGINT, then exits 0 (a graceful subject shutdown). */
export function installShutdown(handler: () => Promise<void>): void {
  let shutting = false;
  const shutdown = () => {
    if (shutting) return;
    shutting = true;
    void handler().then(
      () => process.exit(0),
      (err) => {
        console.error(err);
        process.exit(2);
      },
    );
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
