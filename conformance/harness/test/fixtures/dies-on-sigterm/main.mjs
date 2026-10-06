// The simulated applier, without its SIGTERM handler: SIGTERM ends it on the signal, and V8 writes no
// coverage for it (coverage.test.ts).
await import("../../../../sim/dist/applier/main.js");
process.removeAllListeners("SIGTERM");
