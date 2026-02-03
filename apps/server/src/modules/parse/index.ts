import { Elysia, t } from "elysia";

import { createJobHandler, getWideEvent } from "@/modules/jobs/shared";
import { requireAuth } from "@/plugins/auth";

export const parseRoutes = new Elysia({ prefix: "/api/parse" })
  .use(requireAuth)
  .post(
    "/",
    (ctx) => {
      const wideEvent = getWideEvent(ctx);
      return createJobHandler(ctx, wideEvent, { type: "parse" });
    },
    {
      body: t.Object({
        file: t.Optional(t.File()),
        url: t.Optional(t.String()),
      }),
      detail: {
        description: "Parse a document (file or URL) to markdown using OCR",
        tags: ["Parse"],
      },
    }
  );
