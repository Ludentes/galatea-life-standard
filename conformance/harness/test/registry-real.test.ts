import { describe, expect, it } from "vitest";
import { allIds } from "../src/manifest.js";
import { checkRegistry, registered } from "../src/registry.js";
import "../src/tests/index.js";

describe("the real registry", () => {
  it("holds the skeleton's tests, every id known and none twice", () => {
    expect(checkRegistry(allIds())).toEqual([]);
    expect(registered().flatMap((t) => t.ids).sort()).toEqual([
      "GA-ADOPT-1", "GA-ADOPT-2", "GA-ADOPT-3", "GA-ADOPT-6", "GA-APPLY-1", "GA-APPLY-10", "GA-APPLY-11", "GA-APPLY-14",
      "GA-APPLY-15", "GA-APPLY-16", "GA-APPLY-2", "GA-APPLY-3", "GA-APPLY-4", "GA-APPLY-5", "GA-APPLY-6", "GA-APPLY-7",
      "GA-APPLY-8", "GA-APPLY-9", "GA-AUTH-1", "GA-AUTH-2", "GA-AUTH-3", "GA-AUTH-4", "GA-AUTH-5", "GA-BIND-1",
      "GA-BIND-2", "GA-BRIDGE-1", "GA-BRIDGE-10", "GA-BRIDGE-11", "GA-BRIDGE-12", "GA-BRIDGE-13", "GA-BRIDGE-14",
      "GA-BRIDGE-15", "GA-BRIDGE-16", "GA-BRIDGE-17", "GA-BRIDGE-18", "GA-BRIDGE-19", "GA-BRIDGE-2", "GA-BRIDGE-20",
      "GA-BRIDGE-21", "GA-BRIDGE-22", "GA-BRIDGE-23", "GA-BRIDGE-25", "GA-BRIDGE-26", "GA-BRIDGE-27", "GA-BRIDGE-28",
      "GA-BRIDGE-29", "GA-BRIDGE-3", "GA-BRIDGE-30", "GA-BRIDGE-31", "GA-BRIDGE-32", "GA-BRIDGE-33", "GA-BRIDGE-34",
      "GA-BRIDGE-35", "GA-BRIDGE-36", "GA-BRIDGE-37", "GA-BRIDGE-38", "GA-BRIDGE-4", "GA-BRIDGE-40", "GA-BRIDGE-5",
      "GA-BRIDGE-55", "GA-BRIDGE-6", "GA-BRIDGE-7", "GA-BRIDGE-74", "GA-BRIDGE-75", "GA-BRIDGE-76", "GA-BRIDGE-77",
      "GA-BRIDGE-78", "GA-BRIDGE-79", "GA-BRIDGE-8", "GA-BRIDGE-80", "GA-BRIDGE-9", "GA-BUS-1", "GA-BUS-10",
      "GA-BUS-11", "GA-BUS-12", "GA-BUS-13", "GA-BUS-14", "GA-BUS-2", "GA-BUS-3", "GA-BUS-4", "GA-BUS-5", "GA-BUS-6",
      "GA-BUS-7", "GA-BUS-8", "GA-BUS-9", "GA-CFG-1", "GA-CFG-2", "GA-CFG-3", "GA-CONF-1", "GA-CONF-2", "GA-CONF-3",
      "GA-CONF-4", "GA-CONF-5", "GA-CONF-6", "GA-DEF-1", "GA-DEF-10", "GA-DEF-2", "GA-DEF-3", "GA-DEF-4", "GA-DEF-5",
      "GA-DEF-6", "GA-DEF-7", "GA-DEF-8", "GA-DEF-9", "GA-DESC-1", "GA-DESC-13", "GA-DESC-14", "GA-DESC-18",
      "GA-DESC-2", "GA-DESC-3", "GA-DESC-4", "GA-DESC-5", "GA-DESC-6", "GA-DESC-7", "GA-DESC-8", "GA-DESC-9",
      "GA-DISC-1", "GA-DISC-2", "GA-DISC-3", "GA-DISC-4", "GA-DISC-5", "GA-EVT-1", "GA-EVT-2", "GA-EVT-3", "GA-EVT-4",
      "GA-EVT-5", "GA-EVT-6", "GA-EVT-8", "GA-GRP-1", "GA-HARN-1", "GA-HARN-2", "GA-HOUSE-1", "GA-LEASE-1",
      "GA-LEASE-2", "GA-LEASE-3", "GA-LEASE-4", "GA-LEASE-5", "GA-LEASE-6", "GA-LOAD-2", "GA-LVL-1", "GA-NOTE-1",
      "GA-NOTE-2", "GA-OCC-1", "GA-PERSIST-1", "GA-PERSIST-2", "GA-PLAN-1", "GA-PLAN-2", "GA-PLAN-3", "GA-PLAN-4",
      "GA-PLAN-5", "GA-PLAN-6", "GA-PLAN-7", "GA-PLAN-8", "GA-PROV-1", "GA-PROV-2", "GA-PROV-3", "GA-RULE-1",
      "GA-RULE-2", "GA-RULE-3", "GA-RULE-4", "GA-RULE-5", "GA-RULE-6", "GA-RULE-7", "GA-RULE-8", "GA-SAFE-1",
      "GA-SAFE-10", "GA-SAFE-11", "GA-SAFE-12", "GA-SAFE-13", "GA-SAFE-2", "GA-SAFE-3", "GA-SAFE-5", "GA-SAFE-6",
      "GA-SAFE-7", "GA-SAFE-8", "GA-SAFE-9", "GA-SCHED-1", "GA-SCHED-2", "GA-SCHED-3", "GA-SCN-1", "GA-SCN-10",
      "GA-SCN-11", "GA-SCN-2", "GA-SCN-3", "GA-SCN-4", "GA-SCN-5", "GA-SCN-6", "GA-SCN-7", "GA-SCN-8", "GA-SCN-9",
      "GA-SEC-1", "GA-SEC-2", "GA-STATE-1", "GA-STATE-2", "GA-STATE-4", "GA-STATE-5", "GA-STATE-6", "GA-STW-1",
      "GA-STW-10", "GA-STW-12", "GA-STW-2", "GA-STW-3", "GA-STW-4", "GA-STW-5", "GA-STW-6", "GA-STW-7", "GA-STW-8",
      "GA-STW-9", "GA-TIER-1", "GA-TIER-2", "GA-TIER-3", "GA-TOKEN-1", "GA-TOKEN-2", "GA-TOKEN-3", "GA-TOKEN-4",
      "GA-WIT-1",
    ]);
  });
});
