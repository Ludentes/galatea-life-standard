import type { SeverableProxy, SimBridge, SimFinder, TimeServer } from "@ludentes/galatea-life-sim";
import type { StandIn, StewardCredentials } from "./steward-home.js";
import type { ApplierSide } from "./seams/applier-side.js";
import type { BridgeLink } from "./seams/bridge-link.js";
import type { BridgeWatcher } from "./seams/bridge-watcher.js";
import type { McpSeam } from "./seams/mcp.js";
import type { TestTransportClient } from "./seams/test-transport.js";
import type { SubjectProcess } from "./subject.js";

/** What a requirement test is given. Only the fields of its seam are set. */
export interface TestContext {
  runId: string;
  /** The MQTT {root} of this test. */
  root: string;
  time: TimeServer;
  /** The broker's delivery allowance in ms, added to every 1 s bound. */
  allowanceMs: number;
  /** The conformance levels the subject claims (its `subject.json`). */
  claims: string[];
  subject: SubjectProcess;
  evidence(note: string): void;
  /** The notes `evidence` took, which the runner puts in the report. */
  evidenceLog: string[];
  /**
   * A clause proposed for the standard's next revision, which the subject's text does not yet require:
   * recorded on the row, held or not, and never a cause of the row's pass or fail. The reference's
   * matrix grades a mutation proposed against the clause through it (`proposed-rows.json`'s `clause`).
   */
  proposed?(clause: string, held: boolean, note: string): void;
  /** The clauses `proposed` took, which the runner puts in the report. */
  proposedLog?: ProposedClause[];
  /** Bridge seam: the subject's identity, its topics, and its test transport. */
  bridgeId?: string;
  watch?: BridgeWatcher;
  transport?: TestTransportClient;
  /** Bridge seam: the harness as the subject's applier, sending commands and requests. */
  applier?: ApplierSide;
  /** Bridge seam: the subject's own way to the broker, which a test may cut, read and have refuse. */
  bridgeLink?: BridgeLink;
  /** Applier seam: the subject as a registered client, and the in-process simulated bridge. */
  mcp?: McpSeam;
  bridge?: SimBridge;
  /** Applier seam, a fixture with `finder: true` only: the in-process simulated finder on the test's root. */
  finder?: SimFinder;
  /** Applier seam: the owner's configuration credential on the subject, and the subject's MCP URL. */
  owner?: McpSeam;
  mcpUrl?: string;
  /** Applier seam: the subject's own way to the broker, which a test may sever, stall and restore. */
  link?: SeverableProxy;
  /** Applier seam: the token key the harness's client was registered with, which signs its confirmation tokens. */
  tokenKey?: string;
  /**
   * Applier seam: stops the subject (SIGTERM, or SIGKILL with `crash`), runs `between` while it is
   * down, starts it again on the same port, reconnects `mcp` and `owner` in place, and resolves once
   * the fixture's devices are live again (a retained status never revives a bridge, GA-BUS-8), but for
   * the bridge-local ids in `dead`, which the test made unavailable and expects to stay dead.
   */
  restartApplier?: (o?: { crash?: boolean; between?: () => unknown; dead?: string[] }) => Promise<void>;
  /**
   * Applier seam, a `database: true` subject only: locks `tables` of its schema (all when none) from
   * the admin's session; resolves to the release. Undefined for a subject without a database.
   */
  stallStore?: (tables?: string[]) => Promise<() => Promise<void>>;
  /**
   * The tables the subject's `subject.json` declares (`stall_tables`) whose lock stops a safety rule's
   * firing from committing; undefined where it declares none, and every table is locked.
   */
  stallTables?: string[];
  /**
   * Steward seam: a seam per baseline credential (`owner` is also `owner` above, and `mcpUrl` the
   * steward's), their secrets, and the scripted stand-in applier the steward was started against.
   */
  steward?: { owner: McpSeam; olga: McpSeam; panel: McpSeam; brain: McpSeam; front: McpSeam };
  credentials?: StewardCredentials;
  standIn?: StandIn;
  /**
   * Steward seam: starts another steward subject with this test's environment and `env` over it, on
   * a fresh port, stopped at teardown; for a start the test expects to be refused.
   */
  startSteward?: (env: Record<string, string>) => Promise<SubjectProcess>;
}

/** A proposed clause as a test judged it (`TestContext.proposed`). */
export type ProposedClause = { clause: string; held: boolean; note: string };
