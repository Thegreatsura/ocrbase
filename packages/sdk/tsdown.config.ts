import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["./src/index.ts", "./src/react.ts"],
  format: "esm",
  outDir: "./dist",
  sourcemap: true,
});
