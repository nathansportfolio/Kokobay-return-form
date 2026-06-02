import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildShopifyHowToReturnHtml } from "../lib/shopifyHowToReturnHtml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "exports");
const outFile = path.join(outDir, "shopify-how-to-return.html");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, buildShopifyHowToReturnHtml(), "utf8");

console.log(`Wrote ${outFile}`);
