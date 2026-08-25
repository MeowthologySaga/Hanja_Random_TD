import { copyFile, mkdir, readdir, rename } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const server = resolve(dist, "server");

await mkdir(client, { recursive: true });

for (const entry of await readdir(dist, { withFileTypes: true })) {
  if (entry.name === ".openai" || entry.name === "client" || entry.name === "server") continue;
  await rename(resolve(dist, entry.name), resolve(client, entry.name));
}

await mkdir(server, { recursive: true });
await copyFile(resolve(root, "sites", "worker.mjs"), resolve(server, "index.js"));

console.log("Prepared OpenAI Sites artifact: dist/client + dist/server/index.js");
