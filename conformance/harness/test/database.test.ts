import { describe, expect, it } from "vitest";
import { databaseName, databaseUrl, lockStatement } from "../src/database.js";

describe("the test database", () => {
  it("names a fresh database in lower case, within Postgres's 63 bytes", () => {
    const a = databaseName();
    expect(a).toMatch(/^galatea_[0-9a-f]{32}$/);
    expect(databaseName()).not.toBe(a);
  });

  it("points the admin URL's server at the database, as the admin or as the test's role", () => {
    const admin = "postgres://postgres:pw@127.0.0.1:5433/postgres?sslmode=disable";
    expect(databaseUrl(admin, "galatea_x")).toBe("postgres://postgres:pw@127.0.0.1:5433/galatea_x?sslmode=disable");
    expect(databaseUrl(admin, "galatea_x", { user: "galatea_x", password: "p/w" }))
      .toBe("postgres://galatea_x:p%2Fw@127.0.0.1:5433/galatea_x?sslmode=disable");
  });

  it("locks a schema's tables by name, and refuses a name that would need quoting", () => {
    expect(lockStatement("galatea_x", ["applies", "used_tokens"]))
      .toBe("LOCK TABLE galatea_x.applies, galatea_x.used_tokens IN ACCESS EXCLUSIVE MODE");
    expect(() => lockStatement("galatea_x", ["applies; DROP TABLE x"])).toThrow(/table name/);
    expect(() => lockStatement("galatea_x", [])).toThrow(/no table/);
  });
});
