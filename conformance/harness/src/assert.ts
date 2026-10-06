/** The subject did not do what the requirement says; anything else a test throws is a harness bug. */
export class RequirementFailure extends Error {
  constructor(message: string, readonly evidence?: unknown) {
    super(message);
  }
}

export function must(cond: unknown, message: string, evidence?: unknown): asserts cond {
  if (!cond) throw new RequirementFailure(message, evidence);
}

export function mustEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new RequirementFailure(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`, { actual, expected });
  }
}

export function mustWithin(actual: number, expected: number, tolerance: number, message: string): void {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new RequirementFailure(`${message}: ${actual} is ${actual - expected} from ${expected}, beyond ${tolerance}`, { actual, expected, tolerance });
  }
}

/**
 * The subject misbehaved on a seam (no reply, a refusal, a timeout, a body that is not JSON): the
 * subject's failure of the test, as a failed assertion is, and never a harness fault.
 */
export class SubjectFault extends RequirementFailure {}
