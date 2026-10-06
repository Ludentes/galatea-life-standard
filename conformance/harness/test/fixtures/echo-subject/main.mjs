const keep = setInterval(() => undefined, 1000);
// The handler goes in before "ready", so a stop right after it still reaches the handler.
process.on("SIGTERM", () => { console.log("bye"); clearInterval(keep); process.exit(0); });
console.log(`run ${process.env.GALATEA_TEST_RUN_ID ?? "none"} mutation ${process.env.GALATEA_MUTATION ?? "none"}`);
if (process.env.ECHO_SAY) console.log(process.env.ECHO_SAY);
if (process.env.ECHO_FAIL) process.exit(3);
if (process.env.ECHO_PORT) {
  // Ready once it holds its port; a port taken is a failed start, as a server's bind error is.
  const { createServer } = await import("node:net");
  const server = createServer();
  server.on("error", (err) => { console.error(String(err.message)); process.exit(1); });
  server.listen(Number(process.env.ECHO_PORT), "127.0.0.1", () => console.log("ready"));
} else if (!process.env.ECHO_SLOW) console.log("ready");
