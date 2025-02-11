import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    clean: true,
    dts: true,
    format: ["esm"],
    external: [
        "axios"
    ]
});