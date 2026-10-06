// A subject started through a wrapper shell, as `pnpm start` or `sh -c "... & wait"` would start it.
import { writeFileSync } from "node:fs";

const keep = setInterval(() => undefined, 1000);
// The handler goes in before "ready", so a stop right after it still reaches the handler.
process.on("SIGTERM", () => {
  if (process.env.FIXTURE_IGNORE_TERM) return;
  console.log("bye");
  clearInterval(keep);
  process.exit(0);
});
if (process.env.FIXTURE_PID_FILE) writeFileSync(process.env.FIXTURE_PID_FILE, String(process.pid));
console.log(`pid ${process.pid}`);
console.log("ready");
