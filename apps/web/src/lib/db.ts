import { neon } from "@neondatabase/serverless";

/**
 * Serverless Postgres client (Neon), used by the demo-mode API when the .NET
 * gateway isn't hosted. Built lazily so importing this module never requires
 * DATABASE_URL at build time — only when a query actually runs.
 */
let client: ReturnType<typeof neon> | undefined;

function db() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// Tagged-template proxy: `sql`…`` works, but neon() is constructed on first use.
// Rows from raw SQL are dynamically typed; call sites read known columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  db()(strings, ...values)) as (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Row[]>;

export function demoModeEnabled(): boolean {
  return !process.env.NEXT_PUBLIC_GATEWAY_URL && !!process.env.DATABASE_URL;
}
