// The fixture's entry: it calls the build's code, which reads the mutation.
import { act } from "./run.js";
act(process.argv[2] === "deep");
