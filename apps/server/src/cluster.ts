import { spawn, type Subprocess } from "bun";
import os from "node:os";

import { logger } from "./plugins/logging";

const numWorkers =
  Number(process.env.CLUSTER_WORKERS) || os.availableParallelism();

logger.info(
  {
    event: "cluster_primary_start",
    pid: process.pid,
    workers: numWorkers,
  },
  "cluster_primary_start"
);

const workers = new Map<number, Subprocess>();

const spawnWorker = (id: number): void => {
  const child = spawn({
    cmd: ["bun", "run", new URL("./index.ts", import.meta.url).pathname],
    env: { ...process.env, WORKER_ID: String(id) },
    onExit(proc, exitCode) {
      logger.error(
        {
          event: "cluster_worker_exit",
          exitCode,
          workerPid: proc.pid,
        },
        "cluster_worker_exit"
      );
      workers.delete(id);
      spawnWorker(id);
    },
    stderr: "inherit",
    stdout: "inherit",
  });

  workers.set(id, child);
  logger.info(
    { event: "cluster_worker_start", workerId: id, workerPid: child.pid },
    "cluster_worker_start"
  );
};

for (let i = 0; i < numWorkers; i += 1) {
  spawnWorker(i);
}

const shutdown = () => {
  logger.info(
    { event: "cluster_primary_shutdown" },
    "cluster_primary_shutdown"
  );
  for (const [, child] of workers) {
    child.kill();
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
