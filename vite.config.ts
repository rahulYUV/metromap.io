import { defineConfig } from "vite";
import { resolve } from "path";

import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [assetpackPlugin()],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@rendering": resolve(__dirname, "src/rendering"),
      "@engine": resolve(__dirname, "src/engine"),
      "@app": resolve(__dirname, "src/app"),
    },
  },
  server: {
    port: 8080,
    open: true,
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
