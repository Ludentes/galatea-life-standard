/* Generated from conformance/schemas/harness/test-control.json by scripts/gen-types.ts. Do not edit. */

export type HarnessTestControl = {
  requestId: string;
  [k: string]: unknown | undefined;
} & (
  | {
      op: "join";
      device: string;
      model?: {
        [k: string]: unknown | undefined;
      };
      capabilities: string[];
      feedback: "closed" | "open";
      [k: string]: unknown | undefined;
    }
  | {
      op: "report";
      device: string;
      values: {
        [k: string]: unknown | undefined;
      };
      /**
       * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
       */
      observedAt: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "checkIn";
      device: string;
      /**
       * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
       */
      at: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "silence";
      device: string;
      silent: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "commandResult";
      device: string;
      result:
        | "confirmed"
        | "rejected"
        | "none"
        | "sent"
        | "unreachable"
        | "expired"
        | "no_confirmation"
        | "unsupported"
        | "received";
      afterMs?: number;
      reportAfterMs?: number;
      detail?: string;
      source?: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "commands";
      subscribed: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "transportState";
      state: "up" | "down" | "unknown";
      [k: string]: unknown | undefined;
    }
  | {
      op: "link";
      carrier: boolean;
      gatewayAnswers: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "power";
      event: "suspend" | "resume" | "shutdown";
      announced?: boolean;
      suspendedMs?: number;
      [k: string]: unknown | undefined;
    }
  | {
      op: "clock";
      steppable: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "account";
      osId: number;
      name?: string;
      interactive?: boolean;
      primaryGid?: number;
      path?: string[];
      state: "present" | "renamed" | "deleted" | "absent" | "lookupFails";
      [k: string]: unknown | undefined;
    }
  | {
      op: "session";
      id: string;
      osId?: number;
      graphical?: boolean;
      remote?: boolean;
      seat0Active?: boolean;
      state: "active" | "locked" | "disconnected" | "closed";
      idleHint?: boolean;
      /**
       * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
       */
      startedAt?: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "helper";
      session: string;
      action: "start" | "stop" | "report" | "forge";
      values?: {
        activity?: "active" | "idle";
        app?: string | null;
        camera_in_use?: boolean;
        microphone_in_use?: boolean;
      };
      from?: "helper" | "sessionProcess" | "pluginServer";
      claims?: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "admins";
      groups?: {
        name: string;
        gid: number;
        members: number[];
        [k: string]: unknown | undefined;
      }[];
      sudo?: {
        osId: number;
        root: "yes" | "no" | "cannotTell";
        [k: string]: unknown | undefined;
      }[];
      polkit?: {
        identities: string[];
        unrecognised: boolean;
        [k: string]: unknown | undefined;
      };
      reported?: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "file";
      path: string;
      exists?: boolean;
      executable?: boolean;
      writableBy?: number[];
      [k: string]: unknown | undefined;
    }
  | {
      op: "lockBehaviour";
      session: string;
      result: "locks" | "ignores";
      afterMs?: number;
      [k: string]: unknown | undefined;
    }
  | {
      op: "describe";
      device: string;
      entry: {
        [k: string]: unknown | undefined;
      };
      bySetting?: {
        key: string;
        entries: {
          [k: string]:
            | {
                [k: string]: unknown | undefined;
              }
            | undefined;
        };
        [k: string]: unknown | undefined;
      };
      seenMissing?: string[];
      [k: string]: unknown | undefined;
    }
  | {
      op: "interview";
      device: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "libraryDevice";
      device: string;
      /**
       * @minItems 1
       */
      readings: [
        {
          name: string;
          means: "movement" | "presence";
        },
        ...{
          name: string;
          means: "movement" | "presence";
        }[]
      ];
      [k: string]: unknown | undefined;
    }
  | {
      op: "setting";
      device: string;
      key: string;
      value: string | number | boolean;
      /**
       * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
       */
      observedAt: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "occur";
      device: string;
      key: string;
      value: string | number | boolean;
      frameId: string;
      /**
       * Bridge binding: RFC 3339 UTC with milliseconds (GA-BRIDGE-3)
       */
      observedAt: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "undescribed";
      device: string;
      /**
       * @minItems 1
       */
      names: [string, ...string[]];
      [k: string]: unknown | undefined;
    }
  | {
      op: "admit";
      device: string;
      /**
       * How a Zigbee device came into the network (bridge, *Provisioning*): an association or a trust-centre rejoin under the well-known key is new; a secured rejoin, or a trust-centre rejoin under the device's own key, is not while the device is in devices
       */
      how: "association" | "tcRejoinWellKnown" | "securedRejoin" | "tcRejoinUniqueKey";
      [k: string]: unknown | undefined;
    }
  | {
      op: "leave";
      device: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "windowState";
      open: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "protocolResult";
      device: string;
      result: "confirmed" | "transmitted" | "refused" | "lost" | "notSent";
      reason?: string;
      detail?: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "hostLink";
      open: boolean;
      answers: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "stateMismatch";
      disagrees: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "reporting";
      device: string;
      configuredMs: number[];
      modelMs: number | null;
      [k: string]: unknown | undefined;
    }
  | {
      op: "foreignBinding";
      device: string;
      target: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "classFrom";
      device: string;
      proposedClass:
        | "light"
        | "socket"
        | "ac"
        | "boiler"
        | "floor_heating"
        | "curtain"
        | "gate"
        | "garage_door"
        | "door_lock"
        | "water_valve"
        | "gas_valve"
        | "tv"
        | "speaker"
        | "sensor"
        | "channel"
        | "computer"
        | "player";
      from: "device" | "modelDb" | "guess";
      [k: string]: unknown | undefined;
    }
  | {
      op: "nativeControl";
      way: string;
      canDisable: boolean;
      [k: string]: unknown | undefined;
    }
  | {
      op: "lockPin";
      device: string;
      requiresPin: boolean;
      pin?: string;
      [k: string]: unknown | undefined;
    }
  | {
      op: "stall";
      ms: number;
      [k: string]: unknown | undefined;
    }
);
