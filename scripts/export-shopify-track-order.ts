import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildShopifyTrackOrderHtml } from "../lib/shopifyTrackOrderHtml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "exports");
const outFile = path.join(outDir, "shopify-track-order.html");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, buildShopifyTrackOrderHtml(), "utf8");

console.log(`Wrote ${outFile}`);
