import { cors } from "@elysiajs/cors";
import { auth } from "@ocrbase/auth";
import { env } from "@ocrbase/env/server";
import { Elysia } from "elysia";

const app = new Elysia()
  .use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      origin: env.CORS_ORIGIN,
    })
  )
  .all("/api/auth/*", async (context) => {
    const { request, status } = await context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  })
  .get("/", () => "OK")
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });

export type App = typeof app;
