import cluster from "node:cluster";
import os from "node:os";

import { logger } from "./plugins/logging";

if (cluster.isPrimary) {
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

  for (let i = 0; i < numWorkers; i += 1) {
    cluster.fork();
  }

  cluster.on("exit", (worker: { process: { pid: number } }, code: number) => {
    logger.error(
      {
        event: "cluster_worker_exit",
        exitCode: code,
        workerPid: worker.process.pid,
      },
      "cluster_worker_exit"
    );
    cluster.fork();
  });
} else {
  import("./index");
}
