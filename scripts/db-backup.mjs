import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CONTAINER_NAME = "moneyflow-postgres";
const DB_USER = "moneyflow";
const DB_NAME = "moneyflow";

const backupsDir = path.resolve(process.cwd(), "backups");
fs.mkdirSync(backupsDir, { recursive: true });

const now = new Date();
const pad2 = (n) => String(n).padStart(2, "0");
const timestamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;

const datedFile = path.join(backupsDir, `moneyflow_backup_${timestamp}.sql`);
const latestFile = path.join(backupsDir, "latest.sql");

try {
  const sqlDump = execSync(
    `docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} --clean --if-exists --no-owner --no-privileges`,
    { maxBuffer: 64 * 1024 * 1024 }
  );

  fs.writeFileSync(datedFile, sqlDump);
  fs.writeFileSync(latestFile, sqlDump);

  console.log("Backup completed successfully:");
  console.log(`- Dated snapshot: ${datedFile}`);
  console.log(`- Latest snapshot: ${latestFile}`);
} catch (error) {
  console.error(
    `Failed to run pg_dump from Docker container "${CONTAINER_NAME}".`
  );
  console.error(
    "Make sure Docker Desktop is running and start PostgreSQL with: npm run db:up"
  );
  if (error instanceof Error && error.message) {
    console.error(error.message);
  }
  process.exit(1);
}
