/* Generated from conformance/schemas/applier/apply.request.json by scripts/gen-types.ts. Do not edit. */

export type ApplierApplyRequest = {
  idempotency_key: string;
  plan_id?: string;
  request?: {
    /**
     * @minItems 1
     */
    actions: [
      {
        target: string;
        action: string;
        args: unknown;
        via: "voice" | "panel" | "app" | "rule" | "schedule";
        brain: boolean;
        for: {
          [k: string]: unknown | undefined;
        };
        token?: {
          [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
      },
      ...{
        target: string;
        action: string;
        args: unknown;
        via: "voice" | "panel" | "app" | "rule" | "schedule";
        brain: boolean;
        for: {
          [k: string]: unknown | undefined;
        };
        token?: {
          [k: string]: unknown | undefined;
        };
        [k: string]: unknown | undefined;
      }[]
    ];
    [k: string]: unknown | undefined;
  };
  [k: string]: unknown | undefined;
} & {
  [k: string]: unknown | undefined;
};
