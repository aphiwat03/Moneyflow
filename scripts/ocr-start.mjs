import { spawn } from "node:child_process";

const HEALTH_URL = process.env.OCR_WORKER_URL
  ? `${process.env.OCR_WORKER_URL.replace(/\/+$/, "")}/health`
  : "http://127.0.0.1:8001/health";

function runDockerComposeUp() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["compose", "--profile", "ocr", "up", "-d", "--build", "ocr-worker"],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    );

    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker compose exited with code ${code ?? 1}`));
      }
    });
  });
}

async function waitForHealth(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        const data = await response.json();
        console.log(
          `[ocr:start] Ready on ${HEALTH_URL} (${data.model ?? "OpenThai OCR"} ${data.revision ?? ""})`
        );
        return;
      }
    } catch {
      // Wait for container warmup
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(
    `Timed out waiting for OCR worker health check at ${HEALTH_URL}`
  );
}

async function main() {
  console.log(
    "[ocr:start] Starting MoneyFlow Local OCR Worker (OpenThai2.1-OCR-Text-20261118 v2.1.4) via Docker..."
  );
  try {
    await runDockerComposeUp();
    await waitForHealth(30_000);
  } catch (error) {
    console.error(
      "[ocr:start] Failed to start OCR worker. Ensure Docker Desktop is running and try again."
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();
