// A build for reach.test's IO half: its mutation is read through direct comparisons only.
import { mutationFromEnv } from "./mutations.js";
const mutation = mutationFromEnv(process.env);
const wired = mutation === "at-start";
export function act(deep) {
    if (deep)
        return mutation === "drops-it";
    return wired;
}
