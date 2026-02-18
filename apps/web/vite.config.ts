import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

import * as MdxConfig from "./source.config";

const isPrerenderablePath = (path: string): boolean =>
  path === "/" ||
  path === "/login" ||
  path === "/signup" ||
  path.startsWith("/docs");

const disablePrerender = process.env.OCRBASE_DISABLE_PRERENDER === "1";

export default defineConfig(() => ({
  plugins: [
    mdx(MdxConfig),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      prerender: disablePrerender
        ? {
            enabled: false,
          }
        : {
            crawlLinks: true,
            enabled: true,
            filter: (page) => isPrerenderablePath(page.path),
          },
    }),
    viteReact(),
  ],
}));
