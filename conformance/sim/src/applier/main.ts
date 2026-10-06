import { clockFromEnv, TestClock } from "@ludentes/galatea-life-test-clock";
import { installShutdown, need } from "../env.js";
import { parseBrokerUrl } from "../net.js";
import { serveMcp } from "./mcp.js";
import { SimApplier } from "./sim-applier.js";

const env = process.env;

const { url, identity } = parseBrokerUrl(need(env, "GALATEA_BROKER"));
const clock = await clockFromEnv(env);
const applier = new SimApplier({
  brokerUrl: url, identity, root: need(env, "GALATEA_ROOT"), clock, ownerCredential: need(env, "GALATEA_OWNER_CREDENTIAL"),
  runId: env.GALATEA_TEST_RUN_ID, mutation: env.GALATEA_MUTATION,
  retarget: async (source) => {
    if (!(clock instanceof TestClock)) throw new Error("started without GALATEA_TIME_SOURCE");
    await clock.retarget(source);
  },
});
await applier.start();
const mcp = await serveMcp(applier, Number(need(env, "GALATEA_MCP_PORT")));
console.log("ready");

installShutdown(async () => {
  await mcp.close();
  await applier.stop();
  clock.close();
});
