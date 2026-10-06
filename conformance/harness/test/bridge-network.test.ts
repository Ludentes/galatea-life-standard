import { describe as suite, expect, it } from "vitest";
import { BASE, conforming, fails, fake, type Hooks, run, START, withHooks, type World } from "./fake-bridge.js";

suite("GA-BRIDGE-12", () => {
  it("passes a bridge that shows the fault, keeps its status going and acks failed(unreachable)", async () => {
    await run("GA-BRIDGE-12", fake(conforming).ctx);
  });

  it("fails a bridge whose status stops partway through the window", async () => {
    // Two statuses 5 s apart, then none: every gap between them is short, but the window's tail is not.
    let stopAt = Infinity;
    const { ctx } = fake(withHooks({
      op(op, w) { conforming.op!(op, w); if (op.op === "stateMismatch" && op.disagrees) stopAt = w.now() + 12_000; },
      tick(now, w) { if (now <= stopAt && (now - START) % 5000 === 0) w.status(); },
      statusAt: (now) => now <= stopAt,
    }));
    await fails("GA-BRIDGE-12", ctx, /gap/);
  });

  it("fails a bridge that drops the fault before the owner resolves it", async () => {
    let dropAt = Infinity;
    const { ctx } = fake(withHooks({
      op(op, w) { conforming.op!(op, w); if (op.op === "stateMismatch" && op.disagrees) dropAt = w.now() + 5000; },
      tick(now, w) { if (now >= dropAt) w.faults = []; },
    }));
    await fails("GA-BRIDGE-12", ctx, /fault/);
  });
});

suite("GA-BRIDGE-14", () => {
  const admins = (n: number) => [{ vendor: "acme", label: `remote ${n}` }];
  it("passes a bridge whose otherAdmins never change", async () => {
    await run("GA-BRIDGE-14", fake(conforming).ctx);
  });

  it("passes a bridge that sends an event for each change", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      if (op.op !== "foreignBinding") return;
      for (const n of [1, 2]) {
        w.devs.get("valve")!.entry.otherAdmins = admins(n);
        w.devices();
        w.event({ type: "other_admins_changed", device: "valve" });
      }
    } }));
    await run("GA-BRIDGE-14", ctx);
  });

  it("fails a bridge that reports the first of two changes and drops the second", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      if (op.op !== "foreignBinding") return;
      for (const n of [1, 2]) {
        w.devs.get("valve")!.entry.otherAdmins = admins(n);
        w.devices();
        if (n === 1) w.event({ type: "other_admins_changed", device: "valve" });
      }
    } }));
    await fails("GA-BRIDGE-14", ctx, /other_admins_changed/);
  });

  it("waits for an event that comes after the devices document showing the change", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      if (op.op !== "foreignBinding") return;
      w.devs.get("valve")!.entry.otherAdmins = admins(1);
      w.devices();
      setTimeout(() => w.event({ type: "other_admins_changed", device: "valve" }), 300);
    } }));
    // The settled read takes no real time here, so a snapshot read would miss the event.
    await run("GA-BRIDGE-14", ctx);
  });
});

suite("GA-BRIDGE-15", () => {
  it("passes a bridge that states each class's evidence", async () => {
    await run("GA-BRIDGE-15", fake(conforming).ctx);
  });

  it("fails a classEvidence outside protocol, model_db and none", async () => {
    const { ctx } = fake(withHooks({ op(op, w) { conforming.op!(op, w); if (op.op === "classFrom") w.devs.get(String(op.device))!.entry.classEvidence = "bogus"; } }));
    await fails("GA-BRIDGE-15", ctx, /classEvidence/);
  });

  it("passes a bridge that proposes no class, which GA-BRIDGE-15 allows, and says so in the evidence", async () => {
    const { ctx } = fake(withHooks({ op() {} }));
    await run("GA-BRIDGE-15", ctx);
    expect(ctx.evidenceLog.join(" ")).toMatch(/were not proposed/);
  });
});

suite("GA-BRIDGE-36", () => {
  const pinOf = (w: World) => String((w as unknown as { pin: string }).pin);
  const remember: Hooks["op"] = (op, w) => {
    if (op.op === "lockPin" && typeof op.pin === "string") (w as unknown as { pin: string }).pin = op.pin;
    conforming.op!(op, w);
  };

  it("passes a bridge that withholds unlock, names the door, and never sends the PIN", async () => {
    await run("GA-BRIDGE-36", fake(conforming).ctx);
  });

  it("passes a fault that names the door by its topic", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      conforming.op!(op, w);
      if (op.op === "lockPin" && op.pin === undefined) w.faults = [{ code: "pin_missing", topic: `${BASE}/devices/door` }];
    } }));
    await run("GA-BRIDGE-36", ctx);
  });

  it("fails when the only fault naming the door was there before the PIN was required", async () => {
    const { ctx } = fake(withHooks({
      describe(_id, _given, _dev, w) { w.faults = [{ code: "undescribed_keys", device: "door", detail: "x" }]; },
      op(op, w) {
        conforming.op!(op, w);
        w.faults = [{ code: "undescribed_keys", device: "door", detail: "x" }];
      },
    }));
    await fails("GA-BRIDGE-36", ctx, /fault/);
  });

  it("fails cleanly on a door entry with no actions", async () => {
    const { ctx } = fake(withHooks({ op(op, w) { conforming.op!(op, w); delete w.devs.get("door")!.entry.actions; } }));
    await fails("GA-BRIDGE-36", ctx);
  });

  it("fails a bridge that puts the PIN in its will", async () => {
    const { ctx } = fake(withHooks({ op(op, w2) {
      remember(op, w2);
      if (typeof op.pin === "string") w2.records.push({ kind: "connect", conn: 2, at: Date.now(), level: 5, clientId: "b", cleanStart: false,
        keepalive: 10, sessionExpiry: 0, password: false, will: { topic: `${BASE}/lwt`, payload: `{"pin":"${op.pin}"}`, qos: 1, retain: true, delay: 0 } });
    } }));
    await fails("GA-BRIDGE-36", ctx, /PIN/);
  });

  it("fails a bridge that publishes the PIN outside its own topics", async () => {
    const { ctx } = fake(withHooks({ op(op, w) { remember(op, w); if (typeof op.pin === "string") w.publish("demo/debug", { pin: op.pin }); } }));
    await fails("GA-BRIDGE-36", ctx, /PIN/);
  });

  it("fails a bridge that puts the PIN in a user property", async () => {
    const { ctx } = fake(withHooks({ op(op, w) { remember(op, w); if (typeof op.pin === "string") w.publish(`${BASE}/status`, null, ["pin", op.pin]); } }));
    await fails("GA-BRIDGE-36", ctx, /PIN/);
  });

  it("passes a bridge whose test transport echoes the PIN on its own topics, which are not the binding", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      remember(op, w);
      if (typeof op.pin === "string") w.publish("demo/test/subject/received", { op: "lockPin", pin: op.pin });
    } }));
    await run("GA-BRIDGE-36", ctx);
  });

  it("fails a bridge that puts the PIN in a subscription's user property", async () => {
    const { ctx } = fake(withHooks({ op(op, w) {
      remember(op, w);
      if (typeof op.pin === "string") w.records.push({ kind: "subscribe", conn: 1, at: Date.now(), packetId: 9,
        filters: [{ filter: `${BASE}/devices/door/command`, qos: 1, noLocal: false, retainAsPublished: false, retainHandling: 0 }],
        properties: ["pin", op.pin] });
    } }));
    await fails("GA-BRIDGE-36", ctx, /PIN/);
  });

  it("fails a bridge that publishes the PIN after the unlock's ack", async () => {
    let leakAt = Infinity;
    const { ctx } = fake(withHooks({
      op: remember,
      command(device, _value, id, w) {
        w.publish(`${BASE}/devices/${device}/ack`, { commandId: id, result: "applied" });
        leakAt = w.now() + 3000;
        return true;
      },
      tick(now, w) {
        if (now >= leakAt) { w.event({ type: "occurrence", device: "door", detail: pinOf(w) }); leakAt = Infinity; }
      },
    }));
    await fails("GA-BRIDGE-36", ctx, /PIN/);
  });
});

suite("GA-BRIDGE-17", () => {
  const transportState: Hooks["op"] = (op, w) => { if (op.op === "transportState") w.down = op.state === "down"; };
  it("passes a bridge whose status comes every interval", async () => {
    await run("GA-BRIDGE-17", fake({ op: transportState }).ctx);
  });

  it("fails a bridge whose status stops partway through the window, on the tail's gap", async () => {
    const { ctx } = fake({
      op: transportState,
      tick(now, w) { if (now - START <= 12_000 && (now - START) % 5000 === 0) w.status(); },
      statusAt: (now) => now - START <= 12_000,
    });
    await fails("GA-BRIDGE-17", ctx, /end of the window/);
  });

  it("passes a bridge whose statuses near the window's end reach the watcher after the clock stops", async () => {
    // Statuses at 20 s and 25 s of the clock are published on time but delivered 300 ms of real time
    // late, as on a loaded host: the tail is graded once they arrive, not as a gap from 11 s.
    const late = new Set([20_000, 25_000]);
    const { ctx } = fake({
      op: transportState,
      statusAt: (now) => now - START <= 15_000 || now - START > 25_000,
      tick(now, w) {
        if (!late.has(now - START)) return;
        const at = new Date(now).toISOString();
        setTimeout(() => w.publish(`${BASE}/status`, { publishedAt: at, transports: [] }), 300);
      },
    });
    await run("GA-BRIDGE-17", ctx);
  });
});
