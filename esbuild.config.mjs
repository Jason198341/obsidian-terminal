import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

esbuild.build({
  entryPoints: ["main.ts"],
  bundle: true,
  external: [
    // Obsidian & Electron — provided at runtime
    "obsidian",
    "electron",
    // Codemirror (Obsidian bundles these)
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    // Node.js built-ins — available via Electron's Node integration
    "child_process",
    "path",
    "os",
    "fs",
    "net",
    "stream",
    "events",
    "util",
    "buffer",
    "crypto",
    "process",
  ],
  format: "cjs",
  target: "es2018",
  // Use "browser" platform so xterm.js (a browser lib) bundles correctly.
  // Node built-ins above are marked external, so Electron resolves them at runtime.
  platform: "browser",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
}).catch(() => process.exit(1));
