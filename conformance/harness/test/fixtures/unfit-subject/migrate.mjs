// A subject's migrate-only command, for the harness's tests: makes a table, then one thing a clone of
// the template cannot keep, chosen by UNFIT (the preflight's probe, 2026-10-06): default privileges, a
// setting of the role, or a function whose text or settings name the schema, which the clone renames.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.GALATEA_DATABASE_URL });
await client.connect();
const schema = (await client.query("SELECT current_schema() AS s")).rows[0].s;
await client.query("CREATE TABLE notes (id serial PRIMARY KEY, body text)");
const unfit = {
  "default-acl": "ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO reader",
  "role-setting": `ALTER ROLE ${schema} SET statement_timeout = '1234ms'`,
  "function-text": `CREATE FUNCTION count_notes() RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RETURN (SELECT count(*) FROM ${schema}.notes); END $$`,
  "function-config": `CREATE FUNCTION count_notes() RETURNS bigint LANGUAGE sql SET search_path = ${schema} AS $$ SELECT count(*) FROM notes $$`,
}[process.env.UNFIT ?? ""];
if (unfit) await client.query(unfit);
await client.end();
console.log("migrated");
