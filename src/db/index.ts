import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  moneyflowPool?: Pool;
  moneyflowDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 5 : 10,
    });
  }

  // Allow Next.js build-time module evaluation (e.g. DrizzleAdapter type check)
  // without opening a socket, while failing fast if a query runs unconfigured.
  const unconfiguredPool = new Pool({
    connectionString: "postgresql://unconfigured:unconfigured@127.0.0.1:5432/moneyflow",
    max: 1,
  });
  const missingEnvError = () =>
    new Error(
      "DATABASE_URL is not set. Add it to .env.local before querying PostgreSQL."
    );
  unconfiguredPool.query = (() => Promise.reject(missingEnvError())) as Pool["query"];
  unconfiguredPool.connect = (() =>
    Promise.reject(missingEnvError())) as Pool["connect"];
  return unconfiguredPool;
}

export function getPool(): Pool {
  if (!globalForDb.moneyflowPool) {
    globalForDb.moneyflowPool = createPool();
  }
  return globalForDb.moneyflowPool;
}

export const db =
  globalForDb.moneyflowDb ?? drizzle(getPool(), { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.moneyflowDb = db;
}

export type Database = typeof db;
