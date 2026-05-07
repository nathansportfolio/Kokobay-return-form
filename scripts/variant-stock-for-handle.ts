import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getVariantStockByHandleFromExportCsv } from "@/lib/getVariantStockByHandleFromExportCsv";

/**
 * CLI for {@link getVariantStockByHandleFromExportCsv}.
 *
 *   pnpm variant-stock -- the-cowl-maxi-blue-floral
 *   pnpm variant-stock -- the-beaded-bikini-top-khaki --source ./active-products-2.csv
 *   pnpm variant-stock -- --source ./active-products-2.csv the-beaded-bikini-top-khaki
 *
 * Default CSV is `shopify-stock-live.csv` (run `pnpm shopify-stock-export` first).
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_SOURCE = path.join(REPO_ROOT, "shopify-stock-live.csv");

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(REPO_ROOT, p);
}

function parseArgs(argv: string[]): { source: string; handle: string } {
  let source = DEFAULT_SOURCE;
  const filtered = argv.filter((a) => a !== "--");
  const idx = filtered.indexOf("--source");
  if (idx >= 0 && filtered[idx + 1]) {
    source = resolvePath(filtered[idx + 1]!);
    const rest = [
      ...filtered.slice(0, idx),
      ...filtered.slice(idx + 2),
    ].filter(Boolean);
    return { source, handle: rest.join(" ").trim() };
  }
  return { source, handle: filtered.join(" ").trim() };
}

async function main() {
  const { source, handle } = parseArgs(process.argv.slice(2));

  if (!handle) {
    console.error(
      "Usage: pnpm variant-stock -- <handle> [--source ./shopify-stock-live.csv]",
    );
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(source)) {
    console.error(`CSV not found: ${source}`);
    process.exitCode = 1;
    return;
  }

  const rows = await getVariantStockByHandleFromExportCsv(source, handle);

  if (rows.length === 0) {
    console.error(`No variant rows for handle "${handle}" in ${source}`);
    process.exitCode = 1;
    return;
  }

  for (const r of rows) {
    console.log(`${r.size}\t${r.stock}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
