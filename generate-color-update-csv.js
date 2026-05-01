/**
 * Build a minimal Shopify product CSV that updates only the `custom.color` metafield
 * (plus Handle / Title / Variant SKU for a valid import row shape).
 *
 * ## How to run
 *
 * ```bash
 * npm install csv-parser
 * node generate-color-update-csv.js
 * ```
 *
 * Optional: input path, output path, `--range START,END` (1-based inclusive data rows; output gets
 * `.range-START-END` before `.csv` when set). Defaults: `my-import.range-1-266.csv` → `shopify-color-update.csv`.
 *
 * Output columns only (in order):
 * Handle · Title · Variant SKU · Metafield: custom.color
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { normalizeCsvRow } = require("./scripts/csvParserNormalize");

/** @returns {{ input: string | null; output: string | null; range: { start: number; end: number } | null }} */
function parseColorCsvCli(argv) {
  const args = argv.slice(2);
  /** @type {{ start: number; end: number } | null} */
  let range = null;
  const filtered = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--range" && args[i + 1] != null) {
      range = parseRangeString(args[++i]);
      continue;
    }
    filtered.push(a);
  }
  const inRaw = filtered[0] != null ? String(filtered[0]).trim() : "";
  const outRaw = filtered[1] != null ? String(filtered[1]).trim() : "";
  return {
    input: inRaw || null,
    output: outRaw || null,
    range
  };
}

/** Inclusive 1-based START,END — same spirit as merge-products `--range`. */
function parseRangeString(s) {
  const parts = String(s)
    .trim()
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const start = Number.parseInt(parts[0], 10);
  const end = Number.parseInt(parts[1], 10);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 1 ||
    end < start
  ) {
    return null;
  }
  return { start, end };
}

function resolveOutputPath(defaultBase, range) {
  const base =
    defaultBase != null && String(defaultBase).trim()
      ? String(defaultBase).trim()
      : "shopify-color-update.csv";
  let out = path.resolve(process.cwd(), base);
  if (range != null) {
    const dir = path.dirname(out);
    const stem = path.basename(out, path.extname(out));
    const ext = path.extname(out) || ".csv";
    out = path.join(dir, `${stem}.range-${range.start}-${range.end}${ext}`);
  }
  return out;
}

const OUT_HEADERS = [
  "Handle",
  "Title",
  "Variant SKU",
  "Metafield: custom.color",
];

function safeString(value) {
  return String(value ?? "").trim();
}

function isColorOptionName(name) {
  const n = safeString(name).toLowerCase();
  return n === "color" || n === "colour";
}

/**
 * @param {Record<string, string>} row
 * @returns {string}
 */
function extractColorFromRow(row) {
  const pairs = [
    [row["Option1 Name"], row["Option1 Value"]],
    [row["Option2 Name"], row["Option2 Value"]],
    [row["Option3 Name"], row["Option3 Value"]],
  ];
  for (const [optName, optVal] of pairs) {
    if (isColorOptionName(optName) && safeString(optVal)) {
      return safeString(optVal);
    }
  }
  return "";
}

/**
 * Escape a field for CSV (RFC-style): always double-quoted, internal `"` → `""`.
 * @param {string} value
 */
function escapeCsvField(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function main() {
  const cli = parseColorCsvCli(process.argv);
  if (process.argv.includes("--range") && cli.range == null) {
    console.error(
      "generate-color-update-csv: invalid --range (use two 1-based inclusive indices, e.g. --range 1,50 or --range 12,12)",
    );
    process.exitCode = 1;
    return;
  }

  const INPUT_FILE = path.resolve(
    process.cwd(),
    cli.input ?? "my-import.range-1-266.csv",
  );
  const OUTPUT_FILE = resolveOutputPath(cli.output, cli.range);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input not found: ${INPUT_FILE}`);
    process.exitCode = 1;
    return;
  }

  const outRows = [];
  let recordIndex = 0;

  fs.createReadStream(INPUT_FILE, { encoding: "utf8" })
    .pipe(csv())
    .on("data", (raw) => {
      recordIndex += 1;
      if (
        cli.range != null &&
        (recordIndex < cli.range.start || recordIndex > cli.range.end)
      ) {
        return;
      }

      const row = normalizeCsvRow(raw);
      const handle = safeString(row.Handle);
      const title = safeString(row.Title);
      const color = extractColorFromRow(row);
      if (!handle || !title || !color) return;

      const sku = safeString(row["Variant SKU"]);
      outRows.push({
        Handle: handle,
        Title: title,
        "Variant SKU": sku,
        "Metafield: custom.color": color,
      });
    })
    .on("end", () => {
      const lines = [
        OUT_HEADERS.map(escapeCsvField).join(","),
        ...outRows.map((r) =>
          OUT_HEADERS.map((h) => escapeCsvField(r[h] ?? "")).join(","),
        ),
      ];
      fs.writeFileSync(OUTPUT_FILE, lines.join("\n") + "\n", {
        encoding: "utf8",
      });
      const rangeNote =
        cli.range != null
          ? ` (CSV data rows ${cli.range.start}–${cli.range.end})`
          : "";
      console.log(
        `Wrote ${outRows.length} row(s)${rangeNote} to ${path.relative(process.cwd(), OUTPUT_FILE)}`,
      );
    })
    .on("error", (err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

main();
