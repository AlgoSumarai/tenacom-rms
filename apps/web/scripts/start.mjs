import { cpSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const standalone = join(root, ".next", "standalone");
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
process.env.HOSTNAME = "0.0.0.0";
await import(new URL("../.next/standalone/server.js", import.meta.url));
