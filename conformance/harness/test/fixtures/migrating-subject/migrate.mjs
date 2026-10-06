// A subject's migrate-only command, for the harness's tests: fails with MIGRATE_FAIL set; counts its runs in
// MIGRATE_COUNT_FILE (one "x" each), then makes a table (with its sequence) and a view in the role's own
// schema, and lets the reader use the schema and read the view, as a build's first migration does.
import { appendFileSync } from "node:fs";
import pg from "pg";

const url = process.env.GALATEA_DATABASE_URL;
if (!url) {
  console.error("GALATEA_DATABASE_URL is not set");
  process.exit(2);
}
if (process.env.MIGRATE_FAIL) {
  console.error("the migration failed on purpose");
  process.exit(3);
}
if (process.env.MIGRATE_COUNT_FILE) appendFileSync(process.env.MIGRATE_COUNT_FILE, "x");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("CREATE TABLE IF NOT EXISTS notes (id serial PRIMARY KEY, body text NOT NULL)");
await client.query("CREATE OR REPLACE VIEW notes_v AS SELECT body FROM notes");
await client.query("DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO reader', current_schema()); END $$");
await client.query("GRANT SELECT ON notes_v TO reader");
await client.end();
console.log("migrated");
