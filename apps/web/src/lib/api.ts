import type { App } from "@ocrbase/server/app";

import { treaty } from "@elysiajs/eden";
import { env } from "@ocrbase/env/web";

export const api = treaty<App>(env.VITE_SERVER_URL, {
  fetch: {
    credentials: "include",
  },
});
