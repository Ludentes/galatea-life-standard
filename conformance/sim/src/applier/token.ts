import { canonical, proofHolds, type Token } from "@ludentes/galatea-life-binding";
import { validate } from "@ludentes/galatea-life-schemas";

/** How far past its `expires` a token still stands, on the stand-in's clock (applier, *Constants*). */
export const TOKEN_SKEW_MS = 5_000;
/** A token expiring further ahead than this is none (applier GA-TOKEN-2). */
export const TOKEN_HORIZON_MS = 300_000;
const NAMED = ["target", "action", "args", "via", "brain", "for"] as const;

/**
 * Why the stand-in counts `token` as none for the step it rides on, or undefined when it stands
 * (applier GA-TOKEN-2): another shape, another issuer than the client that sent it, a client with no
 * token key, a proof that does not hold under that key (the shared package's, compared in constant
 * time), another target, action, args, `via`, `brain` or `for`, expired past the skew, or expiring
 * more than 300 s ahead. Single use (GA-TOKEN-4) is the reference applier's to grade, not the
 * stand-in's. Never logs the token, its proof or the key.
 */
export function tokenFault(token: unknown, step: Record<string, unknown>, o: { client: string; key?: string; now: number }): string | undefined {
  if (validate("applier/token.json", token).length) return "not of the token's shape";
  const t = token as Token;
  if (t.issuer !== o.client) return "issued by another client than the one that sent it";
  if (o.key === undefined) return "the client has no token key";
  if (!proofHolds(t, o.key)) return "its proof does not hold";
  const differs = NAMED.filter((f) => canonical(t[f]) !== canonical(step[f]));
  if (differs.length) return `it names another ${differs.join(", ")}`;
  const expires = Date.parse(t.expires);
  if (!(expires + TOKEN_SKEW_MS >= o.now)) return "it expired";
  if (expires > o.now + TOKEN_HORIZON_MS) return "it expires more than 300 s ahead";
  return undefined;
}

/** Whether a token's `for` is an author's own confirmation, never a person's yes: a `rule`, or a `run` with no person and no endpoint (GA-PLAN-8). */
export function authorsOwn(forWhom: unknown): boolean {
  if (typeof forWhom !== "object" || forWhom === null) return false;
  const f = forWhom as Record<string, unknown>;
  return f.rule !== undefined || (f.run !== undefined && f.person === undefined && f.endpoint === undefined);
}
