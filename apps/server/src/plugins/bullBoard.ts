import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ElysiaAdapter } from "@bull-board/elysia";
import { auth } from "@ocrbase/auth";
import { Elysia } from "elysia";

import { getQueue } from "../services/queue";

const BOARD_BASE_PATH = "/admin/queues";

export const bullBoardPlugin = new Elysia({ name: "bull-board" })
  .onBeforeHandle({ as: "scoped" }, async ({ request, set }) => {
    if (!request.url.includes(BOARD_BASE_PATH)) {
      return;
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      set.status = 401;
      return "Unauthorized";
    }
  })
  .use(async () => {
    const queue = getQueue();
    if (!queue) {
      return new Elysia();
    }

    const serverAdapter = new ElysiaAdapter(BOARD_BASE_PATH);

    createBullBoard({
      queues: [new BullMQAdapter(queue)],
      serverAdapter,
    });

    return await serverAdapter.registerPlugin();
  });
