import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

/** The host's first IPv4 address that is not loopback, or undefined on a host with none. */
export function nonLoopbackAddress(): string | undefined {
  return Object.values(networkInterfaces()).flat().find((a) => a && a.family === "IPv4" && !a.internal)?.address;
}

/**
 * A fresh self-signed certificate for `ip`, from the host's `openssl` (no Node API makes one), valid
 * a day; undefined where the host has no `openssl`. Nothing trusts it: a client that accepts it does
 * not validate certificates (the steward's GA-SEC-2).
 */
export async function selfSigned(ip: string): Promise<{ cert: string; key: string } | undefined> {
  const dir = await mkdtemp(join(tmpdir(), "galatea-cert-"));
  try {
    await promisify(execFile)("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes",
      "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "1", "-subj", "/CN=galatea-stand-in",
      "-addext", `subjectAltName=IP:${ip}`]);
    return { cert: await readFile(join(dir, "cert.pem"), "utf8"), key: await readFile(join(dir, "key.pem"), "utf8") };
  } catch {
    return undefined;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
