import { clockFromEnv } from "@ludentes/galatea-life-test-clock";
import { need, installShutdown } from "../env.js";
import { parseBrokerUrl } from "../net.js";
import { SimBridge } from "./sim-bridge.js";

const env = process.env;

const { url, identity } = parseBrokerUrl(need(env, "GALATEA_BROKER"));
const controlTopic = need(env, "GALATEA_TEST_TRANSPORT");
const root = need(env, "GALATEA_ROOT");
const clock = await clockFromEnv(env);
const bridge = new SimBridge({
  brokerUrl: url, root, bridgeId: identity, clock, controlTopic,
  runId: env.GALATEA_TEST_RUN_ID, mutation: env.GALATEA_MUTATION,
});
await bridge.start();
console.log("ready");

installShutdown(async () => {
  await bridge.stop({ graceful: true });
  clock.close();
});
