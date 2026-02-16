import { env } from "@ocrbase/env/server";

import { app, type App } from "./app";
import { shutdownPosthog } from "./lib/posthog";
import { logger } from "./plugins/logging";

const startServer = (): void => {
  app.listen(env.PORT, () => {
    const baseUrl = `http://${env.HOST}:${env.PORT}`;
    logger.info(
      {
        event: "server_start",
        host: env.HOST,
        port: env.PORT,
      },
      "server_start"
    );
    logger.info(
      {
        event: "openapi_available",
        url: `${baseUrl}/openapi`,
      },
      "openapi_available"
    );
  });
};

const shutdown = async () => {
  logger.info({ event: "server_shutdown" }, "server_shutdown");
  await app.stop();
  await shutdownPosthog();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();

export type { App };
