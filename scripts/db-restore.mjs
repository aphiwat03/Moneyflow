import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CONTAINER_NAME = "moneyflow-postgres";
const DB_USER = "moneyflow";
const DB_NAME = "moneyflow";

const targetArg = process.argv[2] || path.join("backups", "latest.sql");
const targetPath = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(targetPath)) {
  console.error(`Backup SQL file not found: ${targetPath}`);
  console.error("Usage: npm run db:restore -- backups/moneyflow_backup_YYYY-MM-DD_HH-MM-SS.sql");
  process.exit(1);
}

const sqlContent = fs.readFileSync(targetPath);

const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    CONTAINER_NAME,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
  ],
  {
    input: sqlContent,
    stdio: ["pipe", "inherit", "inherit"],
  }
);

if (result.error || result.status !== 0) {
  console.error(
    `Failed to restore database from ${targetPath} into container "${CONTAINER_NAME}".`
  );
  console.error(
    "Make sure Docker Desktop is running and start PostgreSQL with: npm run db:up"
  );
  process.exit(result.status || 1);
}

console.log(`Database restored successfully from: ${targetPath}`);
